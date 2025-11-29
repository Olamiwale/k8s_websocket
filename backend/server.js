const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const REDIS_HOST = process.env.REDIS_HOST || 'redis-service';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb-0.mongodb-service:27017,mongodb-1.mongodb-service:27017/chat?replicaSet=rs0';
const POD_NAME = process.env.POD_NAME || 'unknown';

// Redis Pub/Sub
const redisPub = new Redis({ host: REDIS_HOST, port: 6379 });
const redisSub = new Redis({ host: REDIS_HOST, port: 6379 });

// MongoDB
const messageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  podName: String
});
const Message = mongoose.model('Message', messageSchema);

// Connection tracking
const connections = new Set();
let connectionCount = 0;

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log(`[${POD_NAME}] Connected to MongoDB`);
}).catch(err => {
  console.error(`[${POD_NAME}] MongoDB connection error:`, err);
});

// Subscribe to Redis channel
redisSub.subscribe('chat-messages', (err) => {
  if (err) {
    console.error(`[${POD_NAME}] Redis subscribe error:`, err);
  } else {
    console.log(`[${POD_NAME}] Subscribed to chat-messages channel`);
  }
});

// Handle messages from Redis
redisSub.on('message', (channel, message) => {
  if (channel === 'chat-messages') {
    const data = JSON.parse(message);
    // Broadcast to all local connections
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });
  }
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  connectionCount++;
  connections.add(ws);
  
  const clientIp = req.socket.remoteAddress;
  console.log(`[${POD_NAME}] New connection from ${clientIp}. Total: ${connections.size}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    message: `Connected to pod: ${POD_NAME}`,
    podName: POD_NAME,
    timestamp: new Date()
  }));

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.type === 'chat') {
        // Save to MongoDB
        const msg = new Message({
          username: parsed.username || 'Anonymous',
          message: parsed.message,
          podName: POD_NAME
        });
        await msg.save();

        // Publish to Redis for other pods
        const broadcastData = {
          type: 'chat',
          username: parsed.username || 'Anonymous',
          message: parsed.message,
          podName: POD_NAME,
          timestamp: new Date()
        };
        
        await redisPub.publish('chat-messages', JSON.stringify(broadcastData));
      }
    } catch (err) {
      console.error(`[${POD_NAME}] Error processing message:`, err);
    }
  });

  ws.on('close', () => {
    connections.delete(ws);
    console.log(`[${POD_NAME}] Connection closed. Total: ${connections.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[${POD_NAME}] WebSocket error:`, err);
    connections.delete(ws);
  });
});

// Health checks
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    pod: POD_NAME,
    connections: connections.size,
    uptime: process.uptime()
  });
});

// Metrics endpoint for HPA
app.get('/metrics', (req, res) => {
  res.json({
    active_connections: connections.size,
    total_connections: connectionCount,
    pod_name: POD_NAME,
    memory_usage: process.memoryUsage(),
    cpu_usage: process.cpuUsage()
  });
});

// Get chat history
app.get('/history', async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[${POD_NAME}] SIGTERM received, starting graceful shutdown...`);
  
  // Stop accepting new connections
  wss.close(() => {
    console.log(`[${POD_NAME}] WebSocket server closed`);
  });

  // Close existing connections gracefully
  connections.forEach(ws => {
    ws.send(JSON.stringify({
      type: 'system',
      message: 'Server is shutting down. Please reconnect.'
    }));
    ws.close(1001, 'Server shutdown');
  });

  // Close database connections
  mongoose.connection.close();
  redisPub.quit();
  redisSub.quit();

  setTimeout(() => {
    process.exit(0);
  }, 10000); // 10 second grace period
});

server.listen(PORT, () => {
  console.log(`[${POD_NAME}] WebSocket server listening on port ${PORT}`);
  console.log(`[${POD_NAME}] Hostname: ${os.hostname()}`);
});