/**
 * sync-canvas — Room Manager
 *
 * Manages room creation, joining, leaving, and broadcasting.
 * Each room has a set of connected WebSocket sessions and an in-memory element store.
 *
 * Protocol reference (see 02-websocket-protocol.md):
 *  - "join" → client sends roomId, server responds with room_state + sessionId
 *  - Disconnect → server broadcasts "peer_left" to remaining clients
 */

import { v4 as uuidv4 } from 'uuid';
import { initRoom, getElements, clearRoom } from './store.js';

// Room state: Map<roomId, { id, sessions: Map<sessionId, ws>, createdAt, lastActivity }>
const rooms = new Map();

/**
 * Create a new room (or return existing one).
 * @param {string} roomId — unique room identifier
 * @returns {object} room object
 */
export function createRoom(roomId) {
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
  initRoom(roomId);

  return room;
}

/**
 * Add a WebSocket session to a room. Generates a sessionId if not provided.
 * @param {string} roomId
 * @param {import('ws').WebSocket} ws — the client's WebSocket connection
 * @param {string} [existingSessionId] — optional existing sessionId (for reconnects)
 * @returns {{ room: object, sessionId: string, elements: Element[] }}
 */
export function joinRoom(roomId, ws, existingSessionId) {
  const room = createRoom(roomId);

  // Generate a new session ID if one isn't provided
  const sessionId = existingSessionId || `sess_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  // Store the WebSocket reference keyed by sessionId
  room.sessions.set(sessionId, ws);
  room.lastActivity = Date.now();

  return {
    room,
    sessionId,
    elements: getElements(roomId),
  };
}

/**
 * Remove a session from a room. Cleans up empty rooms.
 * @param {string} roomId
 * @param {string} sessionId
 * @returns {boolean} true if the room still has other sessions
 */
export function leaveRoom(roomId, sessionId) {
  const room = rooms.get(roomId);
  if (!room) return false;

  room.sessions.delete(sessionId);
  room.lastActivity = Date.now();

  // Broadcast that this peer left
  broadcastToRoom(roomId, {
    type: 'peer_left',
    sessionId,
  }, sessionId);

  // Clean up empty rooms
  if (room.sessions.size === 0) {
    clearRoom(roomId);
    rooms.delete(roomId);
    return false; // room destroyed
  }

  return true; // room still active
}

/**
 * Broadcast a message to all sessions in a room, optionally excluding one sender.
 * @param {string} roomId
 * @param {object} message — will be JSON.stringify'd
 * @param {string} [excludeSessionId] — session to exclude (the sender)
 */
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

/**
 * Send a message to a specific session.
 * @param {string} roomId
 * @param {string} sessionId
 * @param {object} message
 */
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

/**
 * Get all active room IDs.
 * @returns {string[]}
 */
export function getActiveRoomIds() {
  return Array.from(rooms.keys());
}

/**
 * Get session count for a room.
 * @param {string} roomId
 * @returns {number}
 */
export function getRoomSessionCount(roomId) {
  const room = rooms.get(roomId);
  if (!room) return 0;
  return room.sessions.size;
}

/**
 * Find which room a WebSocket belongs to.
 * @param {import('ws').WebSocket} ws
 * @returns {{ roomId: string, sessionId: string }|null}
 */
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

/**
 * Get rooms summary (for health/debug).
 * @returns {object}
 */
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