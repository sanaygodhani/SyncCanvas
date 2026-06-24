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

// Room state: Map<roomId, { id, sessions: Map<sessionId, ws>, sessionsMetadata: Map<sessionId, {color, name}>, createdAt, lastActivity }>
const rooms = new Map();

// Curated palette of distinct colors (excluding yellow to avoid clashing with brand theme colors)
const COLLAB_COLORS = [
  '#466cf3', // Signal Blue
  '#f34646', // Annotation Red
  '#ff8562', // Peach Wash
  '#10ac84', // Emerald Green
  '#5f27cd', // Electric Purple
  '#ff9f43', // Orange Sun
  '#00d2d3', // Bright Teal
  '#f368e0', // Hot Pink
  '#ee5a24', // Red-Orange
  '#0abde3'  // Sky Blue
];

const ADJECTIVES = [
  'Creative', 'Electric', 'Signal', 'Peach', 'Sunbeam', 'Carbon', 'Curious', 'Active', 'Daring', 'Bright', 'Clever', 'Quick'
];

const ANIMAL_NAMES = [
  'Sloth', 'Fox', 'Koala', 'Panda', 'Otter', 'Badger', 'Rabbit', 'Owl', 'Beaver', 'Falcon', 'Deer', 'Puffin'
];

/**
 * Assign a unique color and adjective-animal name combination.
 */
function assignColorAndName(room) {
  const activeColors = new Set();
  const activeNames = new Set();
  for (const meta of room.sessionsMetadata.values()) {
    activeColors.add(meta.color);
    activeNames.add(meta.name);
  }

  // Find first unused color
  let color = COLLAB_COLORS.find(c => !activeColors.has(c));
  if (!color) {
    // Cycle colors if all are taken
    color = COLLAB_COLORS[room.sessionsMetadata.size % COLLAB_COLORS.length];
  }

  // Find a unique name
  let name = '';
  let attempts = 0;
  while (attempts < 100) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
    const candidateName = `${adj} ${animal}`;
    if (!activeNames.has(candidateName)) {
      name = candidateName;
      break;
    }
    attempts++;
  }
  if (!name) {
    name = `Designer ${room.sessionsMetadata.size + 1}`;
  }

  return { color, name };
}

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
    sessionsMetadata: new Map(),
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

  // Assign and store unique color/name profile
  if (!room.sessionsMetadata.has(sessionId)) {
    const profile = assignColorAndName(room);
    room.sessionsMetadata.set(sessionId, profile);
  }

  room.lastActivity = Date.now();

  const profile = room.sessionsMetadata.get(sessionId);

  return {
    room,
    sessionId,
    elements: getElements(roomId),
    color: profile.color,
    name: profile.name
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
  room.sessionsMetadata.delete(sessionId);
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
 * Get all active peers in a room.
 * @param {string} roomId
 * @returns {Array<{sessionId: string, color: string, name: string}>}
 */
export function getRoomPeers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  const peers = [];
  for (const [sessionId, ws] of room.sessions.entries()) {
    const profile = room.sessionsMetadata.get(sessionId) || { color: '#000000', name: 'Unknown' };
    peers.push({
      sessionId,
      color: profile.color,
      name: profile.name
    });
  }
  return peers;
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