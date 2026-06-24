import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebSocketServer } from 'ws';
import { joinRoom, leaveRoom, broadcastToRoom, findSessionByWs, getRoomsSummary } from './room-manager.js';
import { processOperation, resetSessionSequence } from './sync-engine.js';
import { relayCursor, removeCursorSession } from './cursor-manager.js';
import { auth } from './auth/better-auth-config.js';
import users from './api/users.js';
import communities from './api/communities.js';
import channels from './api/channels.js';

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const MAX_PAYLOAD_SIZE = 1024 * 512; // 512KB max message size

const app = new Hono();

// Middleware
app.use('*', cors());

// Auth Routes (Better Auth)
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// API Routes
app.route('/api/users', users);
app.route('/api/communities', communities);
app.route('/api/channels', channels);

// Health Check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'sync-canvas-server',
    uptime: process.uptime(),
    rooms: getRoomsSummary(),
    timestamp: Date.now(),
  });
});

app.get('/', (c) => c.text('SyncCanvas API is running'));

// --- Start Server ---
const server = serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  SyncCanvas Backend (Hono)                ║`);
  console.log(`║  Address: http://localhost:${info.port}         ║`);
  console.log(`║  Health:  http://localhost:${info.port}/health  ║`);
  console.log(`╚═══════════════════════════════════════════╝`);
});

// --- WebSocket Server Integration ---
const wss = new WebSocketServer({
  server,
  maxPayload: MAX_PAYLOAD_SIZE,
});

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[ws] New connection from ${clientIp}`);

  let joined = false;

  ws.on('message', async (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    switch (message.type) {
      case 'join':
        await handleJoin(ws, message);
        joined = true;
        break;
      case 'op':
        await handleOp(ws, message);
        break;
      case 'cursor':
        handleCursor(ws, message);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  });

  ws.on('close', () => {
    if (joined) {
      const sessionInfo = findSessionByWs(ws);
      if (sessionInfo) {
        const { roomId, sessionId } = sessionInfo;
        removeCursorSession(sessionId);
        resetSessionSequence(sessionId);
        leaveRoom(roomId, sessionId);
      }
    }
  });
});

async function handleJoin(ws, message) {
  const roomId = (message.roomId || 'default').trim();
  const existingSessionId = message.sessionId || null;
  try {
    const { sessionId, elements } = await joinRoom(roomId, ws, existingSessionId);
    ws.send(JSON.stringify({ type: 'room_state', sessionId, elements }));
    broadcastToRoom(roomId, { type: 'peer_joined', sessionId }, sessionId);
  } catch (err) {
    console.error(`[ws] Join error:`, err);
    ws.send(JSON.stringify({ type: 'error', error: 'Failed to join room' }));
  }
}

async function handleOp(ws, message) {
  const sessionInfo = findSessionByWs(ws);
  if (!sessionInfo) return;
  const { roomId, sessionId } = sessionInfo;
  const result = await processOperation(roomId, message.op);
  if (result.valid) {
    if (result.broadcastOp) {
      broadcastToRoom(roomId, { type: 'op', op: result.broadcastOp }, sessionId);
    }
    ws.send(JSON.stringify({ type: 'op_ack', elementId: message.op.elementId, sequence: message.op.sequence }));
  } else {
    ws.send(JSON.stringify({ type: 'op_error', error: result.error }));
  }
}

function handleCursor(ws, message) {
  const sessionInfo = findSessionByWs(ws);
  if (!sessionInfo) return;
  relayCursor(sessionInfo.roomId, message, sessionInfo.sessionId);
}
