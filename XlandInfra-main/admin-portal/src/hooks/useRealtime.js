/**
 * Real-time Data Sync Hook
 * Automatically refreshes data when changes occur on the server
 */

import { useEffect, useRef, useCallback } from 'react';

// WebSocket connection singleton
let ws = null;
let reconnectTimeout = null;
const listeners = new Map();

/**
 * Get or create WebSocket connection
 */
const getWebSocket = (userId) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return ws;
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}`;
  
  ws = new WebSocket(`${wsHost}/ws?userId=${userId}`);

  ws.onopen = () => {
    console.log('🔄 Real-time sync connected');
    // Resubscribe all listeners
    listeners.forEach((_, channel) => {
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'update' || data.type === 'notification') {
        const channelListeners = listeners.get(data.channel) || [];
        channelListeners.forEach((callback) => callback(data.data));
        
        // Also notify 'all' listeners
        const allListeners = listeners.get('all') || [];
        allListeners.forEach((callback) => callback(data));
      }
    } catch (e) {
      console.error('WebSocket message parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('🔄 Real-time sync disconnected, reconnecting...');
    // Reconnect after 3 seconds
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      ws = null;
      getWebSocket(userId);
    }, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return ws;
};

/**
 * Subscribe to a channel
 */
const subscribe = (channel, callback) => {
  if (!listeners.has(channel)) {
    listeners.set(channel, []);
  }
  listeners.get(channel).push(callback);

  // Send subscribe message if connected
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribe', channel }));
  }
};

/**
 * Unsubscribe from a channel
 */
const unsubscribe = (channel, callback) => {
  const channelListeners = listeners.get(channel);
  if (channelListeners) {
    const index = channelListeners.indexOf(callback);
    if (index > -1) {
      channelListeners.splice(index, 1);
    }
  }
};

/**
 * React hook for real-time data updates
 * 
 * @param {string} channel - Channel to subscribe to (e.g., 'work_orders', 'addons')
 * @param {function} onUpdate - Callback when data changes
 * @param {string} userId - Current user ID for connection
 * 
 * Usage:
 * useRealtime('addons', () => fetchAddons(), user?.id);
 */
export const useRealtime = (channel, onUpdate, userId) => {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!userId) return;

    // Initialize WebSocket
    getWebSocket(userId);

    // Subscribe to channel
    const callback = (data) => {
      callbackRef.current(data);
    };
    subscribe(channel, callback);

    // Cleanup
    return () => {
      unsubscribe(channel, callback);
    };
  }, [channel, userId]);
};

/**
 * Hook to trigger data refresh on any update
 * Useful for dashboards that need to show latest data
 */
export const useRealtimeRefresh = (refreshFunction, channels, userId) => {
  useEffect(() => {
    if (!userId || !channels?.length) return;

    getWebSocket(userId);

    const callback = () => {
      refreshFunction();
    };

    channels.forEach((channel) => {
      subscribe(channel, callback);
    });

    return () => {
      channels.forEach((channel) => {
        unsubscribe(channel, callback);
      });
    };
  }, [channels, userId]);
};

/**
 * Manual trigger to close WebSocket (e.g., on logout)
 */
export const closeRealtimeConnection = () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  clearTimeout(reconnectTimeout);
  listeners.clear();
};

export default useRealtime;
