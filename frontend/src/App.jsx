import { useState, useEffect, useRef } from 'react';

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [stats, setStats] = useState({ sent: 0, received: 0 });
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connect = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    const wsUrl = `ws://${window.location.hostname}:30080`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to WebSocket server');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
      setStats(prev => ({ ...prev, received: prev.received + 1 }));
      
      if (data.type === 'system' && data.podName) {
        setConnectionInfo(data.podName);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setConnectionInfo(null);
      console.log('Disconnected from WebSocket server');
    };

    wsRef.current = ws;
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'chat',
      username,
      message: input
    };

    wsRef.current.send(JSON.stringify(message));
    setInput('');
    setStats(prev => ({ ...prev, sent: prev.sent + 1 }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleUsernameKeyPress = (e) => {
    if (e.key === 'Enter') {
      connect();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4 border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-2">
            WebSocket K8s Demo
          </h1>
          <p className="text-purple-200">
            Production-grade chat with StatefulSets, Redis Pub/Sub, and HPA
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">Connection</h2>
              
              {!isConnected ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Enter username..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={handleUsernameKeyPress}
                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={connect}
                    className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
                  >
                    Connect
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-300 font-semibold">Connected</span>
                  </div>
                  <div className="text-sm text-purple-200">
                    <p className="font-mono">User: {username}</p>
                    {connectionInfo && (
                      <p className="font-mono mt-1">Pod: {connectionInfo}</p>
                    )}
                  </div>
                  <button
                    onClick={disconnect}
                    className="w-full px-4 py-2 bg-red-500/80 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">Statistics</h2>
              <div className="space-y-2 text-purple-200">
                <div className="flex justify-between">
                  <span>Messages Sent:</span>
                  <span className="font-mono font-bold text-green-300">{stats.sent}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages Received:</span>
                  <span className="font-mono font-bold text-blue-300">{stats.received}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Messages:</span>
                  <span className="font-mono font-bold text-purple-300">{messages.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">K8s Features</h2>
              <ul className="space-y-2 text-sm text-purple-200">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>StatefulSets for persistence</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Session affinity (sticky)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Redis Pub/Sub broadcast</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>HPA auto-scaling</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Zero-downtime scaling</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 h-[600px] flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-purple-300 mt-20">
                    <p className="text-lg">No messages yet</p>
                    <p className="text-sm mt-2">Connect and start chatting!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.type === 'system'
                          ? 'bg-blue-500/20 border border-blue-400/30'
                          : msg.username === username
                          ? 'bg-purple-500/20 border border-purple-400/30 ml-12'
                          : 'bg-white/10 border border-white/20 mr-12'
                      }`}
                    >
                      {msg.type === 'system' ? (
                        <p className="text-blue-300 text-sm">{msg.message}</p>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="font-semibold text-purple-300">
                              {msg.username}
                            </span>
                            {msg.podName && (
                              <span className="text-xs text-purple-400 font-mono">
                                {msg.podName}
                              </span>
                            )}
                          </div>
                          <p className="text-white">{msg.message}</p>
                          {msg.timestamp && (
                            <p className="text-xs text-purple-400 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-6 border-t border-white/20">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isConnected ? "Type a message..." : "Connect to chat"}
                    disabled={!isConnected}
                    className="flex-1 px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!isConnected || !input.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}