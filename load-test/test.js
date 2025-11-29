const WebSocket = require('ws');
const { performance } = require('perf_hooks');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:30080';
const TOTAL_CONNECTIONS = parseInt(process.env.CONNECTIONS || '10000');
const RAMP_UP_TIME = parseInt(process.env.RAMP_UP || '60'); // seconds
const TEST_DURATION = parseInt(process.env.DURATION || '300'); // seconds
const MESSAGE_INTERVAL = parseInt(process.env.MSG_INTERVAL || '10000'); // ms
const BATCH_SIZE = 100; // connections per batch

class LoadTester {
  constructor() {
    this.connections = [];
    this.stats = {
      connected: 0,
      disconnected: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      reconnects: 0
    };
    this.startTime = null;
    this.podDistribution = new Map();
  }

  async connect(id) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(WS_URL);
        const username = `User${id}`;
        let reconnectAttempts = 0;
        let messageTimer = null;

        ws.on('open', () => {
          this.stats.connected++;
          console.log(`✓ Connection ${id} established (${this.stats.connected}/${TOTAL_CONNECTIONS})`);
          
          // Start sending messages
          messageTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const msg = {
                type: 'chat',
                username,
                message: `Test message from ${username} at ${new Date().toISOString()}`
              };
              ws.send(JSON.stringify(msg));
              this.stats.messagesSent++;
            }
          }, MESSAGE_INTERVAL);

          resolve(ws);
        });

        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data);
            this.stats.messagesReceived++;
            
            if (parsed.type === 'system' && parsed.podName) {
              const count = this.podDistribution.get(parsed.podName) || 0;
              this.podDistribution.set(parsed.podName, count + 1);
            }
          } catch (err) {
            console.error(`Error parsing message:`, err);
          }
        });

        ws.on('close', () => {
          clearInterval(messageTimer);
          this.stats.disconnected++;
          
          // Attempt reconnect if during test
          if (this.isTestRunning() && reconnectAttempts < 3) {
            reconnectAttempts++;
            this.stats.reconnects++;
            setTimeout(() => this.connect(id), 1000 * reconnectAttempts);
          }
        });

        ws.on('error', (err) => {
          this.stats.errors++;
          console.error(`✗ Connection ${id} error:`, err.message);
          clearInterval(messageTimer);
          reject(err);
        });

        this.connections.push({ id, ws, messageTimer });
      } catch (err) {
        reject(err);
      }
    });
  }

  async rampUp() {
    console.log(`\n🚀 Starting ramp-up: ${TOTAL_CONNECTIONS} connections over ${RAMP_UP_TIME}s`);
    this.startTime = performance.now();

    const connectionsPerSecond = TOTAL_CONNECTIONS / RAMP_UP_TIME;
    const delayBetweenBatches = (1000 * BATCH_SIZE) / connectionsPerSecond;

    for (let i = 0; i < TOTAL_CONNECTIONS; i += BATCH_SIZE) {
      const batchStart = performance.now();
      const batchPromises = [];
      
      const batchEnd = Math.min(i + BATCH_SIZE, TOTAL_CONNECTIONS);
      for (let j = i; j < batchEnd; j++) {
        batchPromises.push(
          this.connect(j).catch(err => {
            console.error(`Failed to connect ${j}:`, err.message);
          })
        );
      }

      await Promise.allSettled(batchPromises);

      const batchTime = performance.now() - batchStart;
      const sleepTime = Math.max(0, delayBetweenBatches - batchTime);
      
      if (sleepTime > 0) {
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }

      this.printStats();
    }

    console.log(`\n✅ Ramp-up complete! Connected: ${this.stats.connected}`);
  }

  isTestRunning() {
    if (!this.startTime) return false;
    const elapsed = (performance.now() - this.startTime) / 1000;
    return elapsed < (RAMP_UP_TIME + TEST_DURATION);
  }

  async holdLoad() {
    console.log(`\n⏱️  Holding load for ${TEST_DURATION}s...`);
    
    const statsInterval = setInterval(() => {
      this.printStats();
    }, 10000);

    await new Promise(resolve => setTimeout(resolve, TEST_DURATION * 1000));
    
    clearInterval(statsInterval);
    console.log('\n✅ Load test complete!');
  }

  printStats() {
    const elapsed = this.startTime ? ((performance.now() - this.startTime) / 1000).toFixed(1) : 0;
    const msgRate = this.stats.messagesSent > 0 
      ? (this.stats.messagesSent / elapsed).toFixed(1) 
      : 0;

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 LOAD TEST STATISTICS (${elapsed}s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connections:
  • Connected:     ${this.stats.connected}
  • Disconnected:  ${this.stats.disconnected}
  • Active:        ${this.stats.connected - this.stats.disconnected}
  • Errors:        ${this.stats.errors}
  • Reconnects:    ${this.stats.reconnects}

Messages:
  • Sent:          ${this.stats.messagesSent}
  • Received:      ${this.stats.messagesReceived}
  • Rate:          ${msgRate} msg/s

Pod Distribution:`);
    
    this.podDistribution.forEach((count, pod) => {
      console.log(`  • ${pod}: ${count} connections`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up connections...');
    
    for (const conn of this.connections) {
      try {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.close();
        }
      } catch (err) {
        // Ignore errors during cleanup
      }
    }

    console.log('✅ Cleanup complete');
  }

  async run() {
    console.log(`
╔═══════════════════════════════════════════╗
║   WEBSOCKET KUBERNETES LOAD TEST          ║
╚═══════════════════════════════════════════╝

Configuration:
  • Target URL:          ${WS_URL}
  • Total Connections:   ${TOTAL_CONNECTIONS}
  • Ramp-up Time:        ${RAMP_UP_TIME}s
  • Test Duration:       ${TEST_DURATION}s
  • Message Interval:    ${MESSAGE_INTERVAL}ms
  • Batch Size:          ${BATCH_SIZE}
`);

    try {
      await this.rampUp();
      await this.holdLoad();
      this.printStats();
    } catch (err) {
      console.error('Load test failed:', err);
    } finally {
      await this.cleanup();
      process.exit(0);
    }
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the load test
const tester = new LoadTester();
tester.run();