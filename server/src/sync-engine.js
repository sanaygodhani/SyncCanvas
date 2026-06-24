/**
 * sync-canvas — Sync Engine (CRDT + Operation Validation)
 */

import { addElement, updateElement, deleteElement, hasElement, getElement } from './store.js';

const sessionSequences = new Map();

/**
 * Validate and apply an operation to the room's element store.
 * @param {string} roomId
 * @param {object} op
 * @returns {Promise<{ valid: boolean, broadcastOp?: object, error?: string }>}
 */
export async function processOperation(roomId, op) {
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

  if (typeof op.sequence !== 'number' || op.sequence < 0) {
    return { valid: false, error: 'Operation must have a non-negative sequence number' };
  }

  const lastSeq = sessionSequences.get(op.sessionId) || 0;
  if (op.sequence <= lastSeq) {
    return {
      valid: false,
      error: `Sequence violation: received ${op.sequence}, expecting > ${lastSeq}`,
    };
  }
  sessionSequences.set(op.sessionId, op.sequence);

  try {
    switch (op.type) {
      case 'add':
        return await handleAdd(roomId, op);
      case 'update':
        return await handleUpdate(roomId, op);
      case 'delete':
        return await handleDelete(roomId, op);
      default:
        return { valid: false, error: `Unknown operation type: ${op.type}` };
    }
  } catch (err) {
    console.error(`[sync-engine] Error applying op ${op.type}/${op.elementId}:`, err.message);
    return { valid: false, error: `Internal error: ${err.message}` };
  }
}

async function handleAdd(roomId, op) {
  if (await hasElement(roomId, op.elementId)) {
    const existing = await getElement(roomId, op.elementId);
    if (existing && existing.updatedAt >= op.timestamp) {
      return { valid: true, broadcastOp: null };
    }
  }

  if (!op.data || typeof op.data !== 'object') {
    return { valid: false, error: 'Add operations require a data payload' };
  }

  const element = {
    ...op.data,
    id: op.elementId,
    updatedAt: op.timestamp,
  };

  await addElement(roomId, element);

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

async function handleUpdate(roomId, op) {
  const existing = await getElement(roomId, op.elementId);

  if (!existing) {
    return { valid: false, error: `Element ${op.elementId} not found` };
  }

  if (!op.data || typeof op.data !== 'object') {
    return { valid: false, error: 'Update operations require a data payload' };
  }

  if (op.timestamp < existing.updatedAt) {
    return { valid: false, error: 'Stale update' };
  }

  let dataToApply = { ...op.data };
  if (existing.type === 'stroke' && dataToApply.points) {
    const existingPoints = existing.points || [];
    dataToApply.points = [...existingPoints, ...dataToApply.points];
  }

  const updated = await updateElement(roomId, op.elementId, {
    ...dataToApply,
    updatedAt: op.timestamp,
  });

  if (!updated) {
    return { valid: false, error: 'Failed to update element' };
  }

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

async function handleDelete(roomId, op) {
  if (!(await hasElement(roomId, op.elementId))) {
    return {
      valid: true,
      broadcastOp: {
        type: 'delete',
        elementId: op.elementId,
        sessionId: op.sessionId,
        sequence: op.sequence,
        timestamp: op.timestamp,
        data: {},
      }
    };
  }

  await deleteElement(roomId, op.elementId);

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

export function resetSessionSequence(sessionId) {
  sessionSequences.delete(sessionId);
}
