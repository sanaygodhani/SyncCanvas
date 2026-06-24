/**
 * sync-canvas — Server Entry Point
 *
 * HTTP + WebSocket server for real-time collaborative whiteboarding.
 *
 * - HTTP serves a health-check endpoint at GET /health
 * - WebSocket handles: join, op (add/update/delete), cursor position
 * - CORS enabled for cross-origin clients (any origin allowed)
 *
 * Protocol: See 02-websocket-protocol.md for full message format.
 * Architecture: See 01-system-architecture.md for system design.
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { joinRoom, leaveRoom, broadcastToRoom, sendToSession, findSessionByWs, getRoomsSummary, getRoomPeers } from './room-manager.js';
import { processOperation, resetSessionSequence } from './sync-engine.js';
import { relayCursor, removeCursorSession } from './cursor-manager.js';

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces
const MAX_PAYLOAD_SIZE = 1024 * 512; // 512KB max message size

// --- HTTP Server (for health checks) ---
const httpServer = createServer((req, res) => {
  // Enable CORS for health endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'sync-canvas-server',
      uptime: process.uptime(),
      rooms: getRoomsSummary(),
      timestamp: Date.now(),
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// --- WebSocket Server ---
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_PAYLOAD_SIZE,
});

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[server] New WebSocket connection from ${clientIp}`);

  let joined = false;

  // --- Message Handler ---
  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      console.warn(`[server] Invalid JSON from ${clientIp}:`, err.message);
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    if (!message.type || typeof message.type !== 'string') {
      ws.send(JSON.stringify({ type: 'error', error: 'Message must have a "type" field' }));
      return;
    }

    switch (message.type) {
      case 'join':
        handleJoin(ws, message);
        joined = true;
        break;
      case 'op':
        handleOp(ws, message);
        break;
      case 'cursor':
        handleCursor(ws, message);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${message.type}` }));
        break;
    }
  });

  // --- Disconnect Handler ---
  ws.on('close', () => {
    console.log(`[server] WebSocket disconnected from ${clientIp}`);

    if (joined) {
      const sessionInfo = findSessionByWs(ws);
      if (sessionInfo) {
        const { roomId, sessionId } = sessionInfo;
        console.log(`[server] Session ${sessionId} left room ${roomId}`);
        removeCursorSession(sessionId);
        resetSessionSequence(sessionId);
        leaveRoom(roomId, sessionId);
      }
    }
  });

  // --- Error Handler ---
  ws.on('error', (err) => {
    console.error(`[server] WebSocket error from ${clientIp}:`, err.message);
  });
});

// ============================================================
// Message Handler Implementations
// ============================================================

/**
 * Handle a 'join' message.
 * Protocol: See 02-websocket-protocol.md §1
 */
function handleJoin(ws, message) {
  const roomId = (message.roomId || 'default').trim();
  if (!roomId) {
    ws.send(JSON.stringify({ type: 'error', error: 'roomId is required' }));
    return;
  }

  const existingSessionId = message.sessionId || null;

  try {
    const { sessionId, elements, color, name } = joinRoom(roomId, ws, existingSessionId);
    console.log(`[server] Session ${sessionId} joined room "${roomId}" with color ${color} and name ${name}`);

    // Send room state and all active peers to the joining client
    ws.send(JSON.stringify({
      type: 'room_state',
      sessionId,
      elements,
      color,
      name,
      peers: getRoomPeers(roomId)
    }));

    // Notify existing peers about the new user and their color/name
    broadcastToRoom(roomId, {
      type: 'peer_joined',
      sessionId,
      color,
      name
    }, sessionId);
  } catch (err) {
    console.error(`[server] Error joining room "${roomId}":`, err.message);
    ws.send(JSON.stringify({ type: 'error', error: 'Failed to join room' }));
  }
}

/**
 * Handle an 'op' (operation) message.
 * Validates, applies CRDT logic, and broadcasts to peers.
 * Protocol: See 02-websocket-protocol.md §2
 */
function handleOp(ws, message) {
  const sessionInfo = findSessionByWs(ws);
  if (!sessionInfo) {
    ws.send(JSON.stringify({ type: 'error', error: 'Must join a room before sending operations' }));
    return;
  }

  const { roomId, sessionId } = sessionInfo;
  const op = message.op;

  if (!op) {
    ws.send(JSON.stringify({ type: 'error', error: 'Operation payload (op) is required' }));
    return;
  }

  const result = processOperation(roomId, op);

  if (result.valid) {
    // Broadcast the operation to other peers (not the sender)
    if (result.broadcastOp) {
      broadcastToRoom(roomId, {
        type: 'op',
        op: result.broadcastOp,
      }, sessionId);
    }

    // Acknowledge to sender (for reliability tracking)
    ws.send(JSON.stringify({
      type: 'op_ack',
      elementId: op.elementId,
      sequence: op.sequence,
      timestamp: op.timestamp,
    }));
  } else {
    // Send error back to sender
    ws.send(JSON.stringify({
      type: 'op_error',
      elementId: op.elementId,
      sequence: op.sequence,
      error: result.error,
    }));
  }
}

/**
 * Handle a 'cursor' message.
 * Relays cursor position to other peers with throttling.
 * Protocol: See 02-websocket-protocol.md §3
 */
function handleCursor(ws, message) {
  const sessionInfo = findSessionByWs(ws);
  if (!sessionInfo) return; // Silently ignore cursors from unjoined sockets

  relayCursor(sessionInfo.roomId, message, sessionInfo.sessionId);
}

// ============================================================
// Start Server
// ============================================================
httpServer.listen(PORT, HOST, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  SyncCanvas Sync Server                   ║`);
  console.log(`║  WebSocket: ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}         ║`);
  console.log(`║  Health:    http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/health   ║`);
  console.log(`╚═══════════════════════════════════════════╝`);
  console.log(`[server] Ready to accept connections`);
});