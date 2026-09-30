import { useCallback, useEffect, useRef, useState } from "react";

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  onMessage?: (msg: WsMessage) => void;
  autoConnect?: boolean;
  reconnectDelay?: number;
  maxRetries?: number;
}

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const WS_URL = API_URL.replace(/^http/, "ws");

export function useWebSocket(
  path: string,
  options: UseWebSocketOptions = {}
) {
  const { onMessage, autoConnect = true, reconnectDelay = 2000, maxRetries = 5 } = options;
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(`${WS_URL}${path}`);
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        setStatus("connected");
        retriesRef.current = 0;
      };

      ws.onmessage = (e) => {
        try {
          const msg: WsMessage = JSON.parse(e.data);
          setLastMessage(msg);
          onMessage?.(msg);
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onerror = () => setStatus("error");

      ws.onclose = () => {
        setStatus("disconnected");
        if (retriesRef.current < maxRetries) {
          retriesRef.current += 1;
          const delay = reconnectDelay * Math.pow(1.5, retriesRef.current - 1);
          timerRef.current = setTimeout(connect, delay);
        }
      };
    } catch {
      setStatus("error");
    }
  }, [path, onMessage, reconnectDelay, maxRetries]);

  const disconnect = useCallback(() => {
    clearTimeout(timerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return disconnect;
  }, [autoConnect, connect, disconnect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, lastMessage, connect, disconnect, send };
}
