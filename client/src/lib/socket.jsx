import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const handlersRef = useRef(new Map());

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    // Fallback to direct WebSocket connection if proxy isn't available
    const fallbackUrl = `ws://localhost:3001`;

    function createConnection(url) {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[Socket] Connected to', url);
        setConnected(true);
      };

      ws.onclose = () => {
        console.log('[Socket] Disconnected');
        setConnected(false);
        // Reconnect after 3 seconds
        setTimeout(() => connect(), 3000);
      };

      ws.onerror = () => {
        console.error('[Socket] Error');
        // If primary fails, try fallback
        if (url === wsUrl) {
          console.log('[Socket] Trying fallback...');
          createConnection(fallbackUrl);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          // Notify registered handlers
          const type = data.type;
          if (handlersRef.current.has(type)) {
            handlersRef.current.get(type).forEach((handler) => handler(data));
          }
          if (handlersRef.current.has('*')) {
            handlersRef.current.get('*').forEach((handler) => handler(data));
          }
        } catch (e) {
          console.error('[Socket] Failed to parse message:', e);
        }
      };

      wsRef.current = ws;
    }

    createConnection(wsUrl);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const addHandler = useCallback((type, handler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type).add(handler);
    return () => handlersRef.current.get(type)?.delete(handler);
  }, []);

  const value = {
    connected,
    lastMessage,
    sendMessage,
    addHandler,
    ws: wsRef.current,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}