/**
 * Real-time Data Sync Configuration
 * Ensures all connected clients see data updates immediately
 */

const WebSocket = require('ws');

let wss = null;
const clients = new Map(); // Map of userId -> WebSocket connections

/**
 * Initialize WebSocket server for real-time updates
 */
const initRealtimeServer = (server) => {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const userId = req.url.split('?userId=')[1] || 'anonymous';
    
    // Store connection
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    console.log(`📡 WebSocket connected: ${userId}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleRealtimeMessage(ws, userId, data);
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    });

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) {
        clients.delete(userId);
      }
      console.log(`📡 WebSocket disconnected: ${userId}`);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'Real-time sync active' }));
  });

  console.log('✅ Real-time WebSocket server initialized');
  return wss;
};

/**
 * Handle incoming real-time messages
 */
const handleRealtimeMessage = (ws, userId, data) => {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'subscribe':
      // Subscribe to specific data channels
      ws.subscriptions = ws.subscriptions || new Set();
      ws.subscriptions.add(data.channel);
      break;
    default:
      break;
  }
};

/**
 * Broadcast data update to all connected clients
 * Call this after any database write operation
 */
const broadcastUpdate = (channel, data, excludeUserId = null) => {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'update',
    channel,
    data,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Send to all or filter by subscription
      if (!client.subscriptions || client.subscriptions.has(channel) || client.subscriptions.has('all')) {
        client.send(message);
      }
    }
  });
};

/**
 * Notify specific user(s)
 */
const notifyUsers = (userIds, channel, data) => {
  if (!Array.isArray(userIds)) userIds = [userIds];

  const message = JSON.stringify({
    type: 'notification',
    channel,
    data,
    timestamp: new Date().toISOString()
  });

  userIds.forEach((userId) => {
    const userConnections = clients.get(String(userId));
    if (userConnections) {
      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  });
};

/**
 * Data change channels for different modules
 */
const CHANNELS = {
  WORK_ORDERS: 'work_orders',
  PROPERTIES: 'properties',
  VENDORS: 'vendors',
  EMPLOYEES: 'employees',
  CUSTOMERS: 'customers',
  ESTIMATES: 'estimates',
  ADDONS: 'addons',
  PACKAGES: 'packages',
  USERS: 'users',
  NOTIFICATIONS: 'notifications'
};

module.exports = {
  initRealtimeServer,
  broadcastUpdate,
  notifyUsers,
  CHANNELS
};
