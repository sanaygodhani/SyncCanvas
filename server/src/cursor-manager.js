/**
 * sync-canvas — Cursor Manager
 *
 * Handles ephemeral cursor position relay between peers.
 * Cursors are not stored — they exist only in-flight as WebSocket messages.
 * Implementation uses a cooldown throttle to avoid flooding the network.
 *
 * Protocol (from 02-websocket-protocol.md):
 *  - Client → Server: { type: "cursor", x, y, sessionId, color }
 *  - Server → All OTHER Clients: same format, forwarded as-is
 */

import { broadcastToRoom } from './room-manager.js';

// Per-session throttle tracking
// Map<sessionId, lastForwardedTime>
const cursorThrottle = new Map();

// Throttle interval in ms (default: 100ms as per protocol spec)
const THROTTLE_MS = 100;

/**
 * Process and relay a cursor update from a client.
 * Throttles broadcasts to prevent flooding (max 10 updates/sec per user).
 *
 * @param {string} roomId
 * @param {object} message — parsed cursor message from client
 * @param {string} excludeSessionId — the sender, to exclude from broadcast
 * @returns {boolean} true if the cursor was relayed, false if throttled
 */
export function relayCursor(roomId, message, excludeSessionId) {
  // Basic validation
  if (typeof message.x !== 'number' || typeof message.y !== 'number') {
    return false;
  }

  if (!message.sessionId || message.sessionId !== excludeSessionId) {
    return false;
  }

  // Throttle: only forward if enough time has passed since last forward
  const now = Date.now();
  const lastForwarded = cursorThrottle.get(excludeSessionId) || 0;

  if (now - lastForwarded < THROTTLE_MS) {
    return false; // Throttled
  }

  cursorThrottle.set(excludeSessionId, now);

  // Build the relay message (forward as-is)
  const relayMessage = {
    type: 'cursor',
    x: message.x,
    y: message.y,
    sessionId: message.sessionId,
    color: message.color || '#888888',
  };

  // Broadcast to all OTHER clients in the room
  broadcastToRoom(roomId, relayMessage, excludeSessionId);

  return true;
}

/**
 * Clean up cursor throttle tracking when a session disconnects.
 * @param {string} sessionId
 */
export function removeCursorSession(sessionId) {
  cursorThrottle.delete(sessionId);
}

/**
 * Get active cursor session count (for metrics).
 * @returns {number}
 */
export function getActiveCursorSessions() {
  return cursorThrottle.size;
}