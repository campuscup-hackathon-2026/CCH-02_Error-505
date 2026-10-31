export function createAlertsSocket(onMessage) {
  const configuredBase = import.meta.env.VITE_WS_BASE_URL;
  const fallbackBase = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/ws/alerts`;
  const socketBase = configuredBase
    ? (() => {
        if (configuredBase.startsWith('ws://') || configuredBase.startsWith('wss://')) {
          return configuredBase;
        }

        const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const path = configuredBase.startsWith('/') ? configuredBase : `/${configuredBase}`;
        return `${scheme}://${window.location.host}${path}`;
      })()
    : fallbackBase;
  const ws = new WebSocket(socketBase);
  let cancelled = false;
  let flushHandle = 0;
  let pendingMessages = [];

  const flushMessages = () => {
    flushHandle = 0;
    if (cancelled || pendingMessages.length === 0) {
      pendingMessages = [];
      return;
    }

    const batch = pendingMessages;
    pendingMessages = [];
    for (const message of batch) {
      onMessage(message);
    }
  };

  ws.onopen = () => {
    if (cancelled) {
      ws.close();
      return;
    }
    ws.send('subscribe');
  };

  ws.onerror = () => {};

  ws.onclose = () => {
  };

  ws.onmessage = (event) => {
    try {
      pendingMessages.push(JSON.parse(event.data));
    } catch {
      pendingMessages.push({ channel: 'raw', payload: event.data });
    }

    if (!flushHandle) {
      flushHandle = window.requestAnimationFrame(flushMessages);
    }
  };

  ws.safeClose = () => {
    cancelled = true;
    if (flushHandle) {
      window.cancelAnimationFrame(flushHandle);
      flushHandle = 0;
    }
    pendingMessages = [];
    // A route can unmount while the socket is still connecting. Close both
    // CONNECTING and OPEN sockets so they cannot complete after unmount.
    if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };

  return ws;
}
