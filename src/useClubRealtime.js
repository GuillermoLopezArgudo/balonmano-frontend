import { useEffect, useRef } from 'react';
import { clubWsUrl } from './api';

const MIEMBROS_EVENT = 'siete:miembros';

export function dispatchMiembrosChanged(detail) {
  window.dispatchEvent(new CustomEvent(MIEMBROS_EVENT, { detail }));
}

export function onMiembrosChanged(handler) {
  const fn = (e) => handler(e.detail);
  window.addEventListener(MIEMBROS_EVENT, fn);
  return () => window.removeEventListener(MIEMBROS_EVENT, fn);
}

/**
 * Mantiene un WebSocket con el club. Reconecta con backoff.
 * @param {{ enabled: boolean, token: string | null, onEvent?: (ev: object) => void }} opts
 */
export function useClubRealtime({ enabled, token, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const intentionalClose = useRef(false);

  useEffect(() => {
    if (!enabled || !token) return undefined;

    intentionalClose.current = false;
    let ws;
    let retryTimer;
    let pingTimer;
    let attempt = 0;

    const clearTimers = () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      retryTimer = null;
      pingTimer = null;
    };

    const scheduleReconnect = () => {
      if (intentionalClose.current) return;
      const delay = Math.min(15000, 1000 * 2 ** attempt);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      clearTimers();
      const url = clubWsUrl(token);
      if (!url) return;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send('ping');
        }, 25000);
      };

      ws.onmessage = (msg) => {
        let data;
        try {
          data = JSON.parse(msg.data);
        } catch {
          return;
        }
        if (data?.type === 'pong' || data?.type === 'connected') return;
        onEventRef.current?.(data);
        if (data?.type === 'miembros.changed') {
          dispatchMiembrosChanged(data);
        }
      };

      ws.onclose = () => {
        clearTimers();
        scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    const onVis = () => {
      if (document.visibilityState === 'visible' && ws?.readyState !== WebSocket.OPEN) {
        attempt = 0;
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      intentionalClose.current = true;
      document.removeEventListener('visibilitychange', onVis);
      clearTimers();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, token]);
}
