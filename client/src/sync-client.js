/**
 * sync-client.js — WebSocket client and operation management
 * Handles connection, room joining, sending/receiving ops, and cursor sync.
 * Implements the SyncCanvas WebSocket protocol.
 */

class SyncClient {
  constructor(url = 'ws://localhost:3001') {
    this.url = url;
    this.ws = null;
    this.sessionId = null;
    this.connected = false;

    // Sequence counter (per-session monotonic)
    this._sequence = 0;

    // Callbacks
    this.onConnected = null;
    this.onDisconnected = null;
    this.onRoomState = null;
    this.onOperation = null;
    this.onCursorMove = null;
    this.onPeerLeft = null;
    this.onPeerCount = null;

    // Throttle cursor sends to ~10/s
    this._cursorThrottle = false;
    this._pendingCursor = null;

    // Generate a random color for this session
    this.color = this._randomColor();

    // Peer tracking
    this._peerSessionIds = new Set();

    // Connection retry
    this._shouldReconnect = true;
    this._reconnectTimeout = null;
  }

  _randomColor() {
    const colors = [
      '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
      '#5f27cd', '#01a3a4', '#f368e0', '#ff9f43', '#00d2d3',
      '#ee5a24', '#0abde3', '#10ac84', '#5f27cd', '#341f97'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.error('[SyncClient] Connection error:', err);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[SyncClient] Connected');
      this.connected = true;
      this._send({ type: 'join', roomId: 'default' });
      if (this.onConnected) this.onConnected();
      this._updateStatus('connected');
    };

    this.ws.onclose = () => {
      console.log('[SyncClient] Disconnected');
      this.connected = false;
      if (this.onDisconnected) this.onDisconnected();
      this._updateStatus('disconnected');
      if (this._shouldReconnect) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('[SyncClient] WebSocket error:', err);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (err) {
        console.error('[SyncClient] Failed to parse message:', err);
      }
    };
  }

  disconnect() {
    this._shouldReconnect = false;
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  _scheduleReconnect() {
    if (!this._shouldReconnect) return;
    if (this._reconnectTimeout) return;
    this._reconnectTimeout = setTimeout(() => {
      this._reconnectTimeout = null;
      this.connect();
    }, 2000);
  }

  _updateStatus(status) {
    const el = document.getElementById('connection-status');
    if (el) {
      el.className = `status-${status}`;
      el.title = status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  _updatePeerCount() {
    const infoEl = document.getElementById('peer-count');
    if (infoEl) infoEl.textContent = `${this._peerSessionIds.size} peers`;
    if (this.onPeerCount) this.onPeerCount(this._peerSessionIds.size);
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'room_state':
        this.sessionId = msg.sessionId;
        // Show session ID in UI
        const sessEl = document.getElementById('session-id-label');
        if (sessEl) sessEl.textContent = `Room: default | ID: ${this.sessionId.slice(0, 8)}...`;
        if (this.onRoomState) this.onRoomState(msg.elements || []);
        break;

      case 'op':
        if (this.onOperation) this.onOperation(msg.op);
        break;

      case 'cursor':
        if (this.onCursorMove) this.onCursorMove(msg);
        break;

      case 'peer_joined': {
        this._peerSessionIds.add(msg.sessionId);
        this._updatePeerCount();
        break;
      }

      case 'peer_left':
        this._peerSessionIds.delete(msg.sessionId);
        this._updatePeerCount();
        if (this.onPeerLeft) this.onPeerLeft(msg.sessionId);
        break;

      default:
        console.log('[SyncClient] Unknown message type:', msg.type);
    }
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  _nextSeq() {
    return ++this._sequence;
  }

  // ===== Public API =====

  /** Send an operation (add / update / delete) */
  sendOperation(type, elementId, data) {
    const op = {
      type: type,
      elementId: elementId,
      sessionId: this.sessionId,
      sequence: this._nextSeq(),
      timestamp: Date.now(),
      data: data || {}
    };
    this._send({ type: 'op', op });
    return op;
  }

  /** Send cursor position (throttled to ~10Hz) */
  sendCursor(x, y) {
    if (this._cursorThrottle) {
      this._pendingCursor = { x, y };
      return;
    }
    this._cursorThrottle = true;
    this._send({
      type: 'cursor',
      x, y,
      sessionId: this.sessionId,
      color: this.color
    });
    setTimeout(() => {
      this._cursorThrottle = false;
      if (this._pendingCursor) {
        const c = this._pendingCursor;
        this._pendingCursor = null;
        this.sendCursor(c.x, c.y);
      }
    }, 100);
  }
}

// Export globally
window.SyncClient = SyncClient;
