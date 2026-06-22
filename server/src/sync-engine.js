/**
 * sync-canvas — Sync Engine (CRDT + Operation Validation)
 *
 * Implements Last-Writer-Wins (LWW) CRDT conflict resolution for collaborative
 * whiteboard elements. The engine validates incoming operations and applies them
 * deterministically against the in-memory store.
 *
 * CRDT Rules (from 02-websocket-protocol.md):
 *  1. Timestamp-based: Higher `timestamp` wins for same field
 *  2. Sequence: Per-session monotonically increasing sequence number (validated)
 *  3. Append-only strokes: `points` arrays are appended, never replaced wholesale
 *  4. Full-text: Text content is replaced wholesale (not character-level OT)
 *  5. Delete wins: Once deleted, subsequent updates to the element are ignored
 */

import { addElement, updateElement, deleteElement, hasElement, getElement } from './store.js';

// Track per-session sequence numbers to detect conflicts / replays
// Map<sessionId, highestSequence>
const sessionSequences = new Map();

/**
 * Validate and apply an operation to the room's element store.
 * Returns the result (success or error) for the sender and the op to broadcast.
 *
 * @param {string} roomId
 * @param {object} op — the operation object from the client
 * @returns {{ valid: boolean, broadcastOp?: object, error?: string }}
 */
export function processOperation(roomId, op) {
  // --- Basic Validation ---
  if (!op || typeof op !== 'object') {
    return { valid: false, error: 'Invalid operation: must be an object' };
  }

  if (!op.type || !['add', 'update', 'delete'].includes(op.type)) {
    return { valid: false, error: `Invalid operation type: ${op.type}` };
  }

  if (!op.elementId || typeof op.elementId !== 'string') {
    return { valid: false, error: 'Operation must have a valid elementId' };
  }

  if (!op.sessionId || typeof op.sessionId !== 'string') {
    return { valid: false, error: 'Operation must have a valid sessionId' };
  }

  if (!op.timestamp || typeof op.timestamp !== 'number') {
    return { valid: false, error: 'Operation must have a numeric timestamp' };
  }

  // --- Sequence Validation ---
  if (typeof op.sequence !== 'number' || op.sequence < 0) {
    return { valid: false, error: 'Operation must have a non-negative sequence number' };
  }

  const lastSeq = sessionSequences.get(op.sessionId) || 0;
  if (op.sequence <= lastSeq) {
    // This is likely a duplicate or out-of-order delivery; reject to maintain causal order
    return {
      valid: false,
      error: `Sequence violation: received ${op.sequence}, expecting > ${lastSeq}`,
    };
  }
  sessionSequences.set(op.sessionId, op.sequence);

  // --- Apply Operation ---
  try {
    switch (op.type) {
      case 'add':
        return handleAdd(roomId, op);
      case 'update':
        return handleUpdate(roomId, op);
      case 'delete':
        return handleDelete(roomId, op);
      default:
        return { valid: false, error: `Unknown operation type: ${op.type}` };
    }
  } catch (err) {
    console.error(`[sync-engine] Error applying op ${op.type}/${op.elementId}:`, err.message);
    return { valid: false, error: `Internal error: ${err.message}` };
  }
}

/**
 * Handle an 'add' operation.
 * The element must not already exist.
 */
function handleAdd(roomId, op) {
  // Check for existing element (idempotency guard)
  if (hasElement(roomId, op.elementId)) {
    // If it exists, check if our stored version is newer
    const existing = getElement(roomId, op.elementId);
    if (existing && existing.updatedAt >= op.timestamp) {
      // Existing element is same or newer — silently accept as duplicate
      return {
        valid: true,
        broadcastOp: null, // don't broadcast, it's already there
        info: 'Element already exists with equal or newer timestamp; skipped broadcast',
      };
    }
    // Existing element is older — fall through to overwrite below
  }

  if (!op.data || typeof op.data !== 'object') {
    return { valid: false, error: 'Add operations require a data payload' };
  }

  // Ensure required fields are present
  const element = {
    ...op.data,
    id: op.elementId,
    updatedAt: op.timestamp,
  };

  // Attempt to add (may throw if duplicate)
  addElement(roomId, element);

  // Build the broadcast op (clean, without internal state)
  const broadcastOp = {
    type: 'add',
    elementId: op.elementId,
    sessionId: op.sessionId,
    sequence: op.sequence,
    timestamp: op.timestamp,
    data: element,
  };

  return { valid: true, broadcastOp };
}

/**
 * Handle an 'update' operation.
 * Uses LWW per field: higher timestamp wins. For points (strokes), we append.
 */
function handleUpdate(roomId, op) {
  const existing = getElement(roomId, op.elementId);

  if (!existing) {
    return { valid: false, error: `Element ${op.elementId} not found in room ${roomId}` };
  }

  if (!op.data || typeof op.data !== 'object') {
    return { valid: false, error: 'Update operations require a data payload' };
  }

  // CRDT Rule #5: Delete wins — if the operation's timestamp is older than
  // the element's current updatedAt, ignore the update (stale).
  // This is a simplified check; the elem doesn't actually track a "deleted at" time.
  // For proper tombstone tracking, we'd have a deleted flag. For MVP, we rely
  // on the fact that delete removes the element from the store — so if it's
  // not found, the update is rejected above.

  // CRDT Rule #1: Timestamp-based. Only apply if op is newer.
  if (op.timestamp < existing.updatedAt) {
    // Stale update — reject
    return {
      valid: false,
      error: `Stale update: op timestamp ${op.timestamp} < element updatedAt ${existing.updatedAt}`,
    };
  }

  // CRDT Rule #3: For strokes, points are append-only
  let dataToApply = { ...op.data };
  if (existing.type === 'stroke' && dataToApply.points) {
    // Append new points to the existing array, don't replace
    const existingPoints = existing.points || [];
    dataToApply.points = [...existingPoints, ...dataToApply.points];
  }

  // Apply the update
  const updated = updateElement(roomId, op.elementId, {
    ...dataToApply,
    updatedAt: op.timestamp,
  });

  if (!updated) {
    return { valid: false, error: `Failed to update element ${op.elementId}` };
  }

  // Broadcast the effective operation to other clients
  const broadcastOp = {
    type: 'update',
    elementId: op.elementId,
    sessionId: op.sessionId,
    sequence: op.sequence,
    timestamp: op.timestamp,
    data: dataToApply,
  };

  return { valid: true, broadcastOp };
}

/**
 * Handle a 'delete' operation.
 * CRDT Rule #5: Delete wins — once deleted, subsequent updates are ignored.
 * We just remove the element from the store.
 */
function handleDelete(roomId, op) {
  if (!hasElement(roomId, op.elementId)) {
    // Already deleted or never existed — still broadcast to converge state
    return {
      valid: true,
      broadcastOp: {
        type: 'delete',
        elementId: op.elementId,
        sessionId: op.sessionId,
        sequence: op.sequence,
        timestamp: op.timestamp,
        data: {},
      },
      info: 'Element already missing; broadcasting delete for convergence',
    };
  }

  deleteElement(roomId, op.elementId);

  const broadcastOp = {
    type: 'delete',
    elementId: op.elementId,
    sessionId: op.sessionId,
    sequence: op.sequence,
    timestamp: op.timestamp,
    data: {},
  };

  return { valid: true, broadcastOp };
}

/**
 * Reset sequence tracking for a session (used on disconnect/reconnect).
 * @param {string} sessionId
 */
export function resetSessionSequence(sessionId) {
  sessionSequences.delete(sessionId);
}

/**
 * Get sync engine stats.
 * @returns {{ sessionCount: number }}
 */
export function getSyncStats() {
  return {
    sessionCount: sessionSequences.size,
  };
}