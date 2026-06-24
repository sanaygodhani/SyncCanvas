/**
 * sync-canvas — Room Manager
 */

import { v4 as uuidv4 } from 'uuid';
import { initRoom, getElements, clearRoom } from './store.js';

const rooms = new Map();

/**
 * Create a new room (or return existing one).
 * @param {string} roomId
 */
export async function createRoom(roomId) {
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }

  const room = {
    id: roomId,
    sessions: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  rooms.set(roomId, room);
  await initRoom(roomId);

  return room;
}

/**
 * Add a WebSocket session to a room.
 */
export async function joinRoom(roomId, ws, existingSessionId) {
  const room = await createRoom(roomId);
  const sessionId = existingSessionId || `sess_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  room.sessions.set(sessionId, ws);
  room.lastActivity = Date.now();

  const elements = await getElements(roomId);

  return {
    room,
    sessionId,
    elements,
  };
}

/**
 * Remove a session from a room.
 */
export function leaveRoom(roomId, sessionId) {
  const room = rooms.get(roomId);
  if (!room) return false;

  room.sessions.delete(sessionId);
  room.lastActivity = Date.now();

  broadcastToRoom(roomId, {
    type: 'peer_left',
    sessionId,
  }, sessionId);

  if (room.sessions.size === 0) {
    // We don't necessarily want to clear room in DB just because everyone left
    // clearRoom(roomId); 
    rooms.delete(roomId);
    return false;
  }

  return true;
}

export function broadcastToRoom(roomId, message, excludeSessionId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(message);

  for (const [sessionId, ws] of room.sessions.entries()) {
    if (sessionId === excludeSessionId) continue;
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(data);
      } catch (err) {
        console.error(`[room-manager] Error sending to ${sessionId}:`, err.message);
      }
    }
  }
}

export function sendToSession(roomId, sessionId, message) {
  const room = rooms.get(roomId);
  if (!room) return;

  const ws = room.sessions.get(sessionId);
  if (!ws || ws.readyState !== ws.OPEN) return;

  try {
    ws.send(JSON.stringify(message));
  } catch (err) {
    console.error(`[room-manager] Error sending to ${sessionId}:`, err.message);
  }
}

export function findSessionByWs(ws) {
  for (const [roomId, room] of rooms.entries()) {
    for (const [sessionId, sessionWs] of room.sessions.entries()) {
      if (sessionWs === ws) {
        return { roomId, sessionId };
      }
    }
  }
  return null;
}

export function getRoomsSummary() {
  const summary = {};
  for (const [roomId, room] of rooms.entries()) {
    summary[roomId] = {
      sessionCount: room.sessions.size,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
    };
  }
  return summary;
}
