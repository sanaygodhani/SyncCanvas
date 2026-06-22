/**
 * sync-canvas — In-Memory Element Store
 *
 * Maintains the canonical element state per room using a Map.
 * Provides CRUD operations that the sync-engine applies ops against.
 * The store is the single source of truth for board state within a single server process.
 */

// Room elements stored as Map<roomId, Map<elementId, Element>>
const roomElements = new Map();

/**
 * Initialize a room's element store if it doesn't exist.
 * @param {string} roomId
 */
export function initRoom(roomId) {
  if (!roomElements.has(roomId)) {
    roomElements.set(roomId, new Map());
  }
}

/**
 * Get all elements for a room (as a plain array for serialization).
 * @param {string} roomId
 * @returns {Element[]}
 */
export function getElements(roomId) {
  const elements = roomElements.get(roomId);
  if (!elements) return [];
  return Array.from(elements.values());
}

/**
 * Get a single element by ID.
 * @param {string} roomId
 * @param {string} elementId
 * @returns {Element|null}
 */
export function getElement(roomId, elementId) {
  const elements = roomElements.get(roomId);
  if (!elements) return null;
  return elements.get(elementId) || null;
}

/**
 * Add an element to the store.
 * Throws if elementId already exists (use updateElement instead).
 * @param {string} roomId
 * @param {Element} element
 */
export function addElement(roomId, element) {
  initRoom(roomId);
  const elements = roomElements.get(roomId);

  if (elements.has(element.id)) {
    throw new Error(`Element ${element.id} already exists in room ${roomId}`);
  }

  elements.set(element.id, { ...element });
}

/**
 * Update an element in the store (partial merge).
 * Only fields present in `updates.data` are overwritten.
 * @param {string} roomId
 * @param {string} elementId
 * @param {Partial<Element>} data — partial element fields to merge
 * @returns {Element|null} The updated element, or null if not found
 */
export function updateElement(roomId, elementId, data) {
  const elements = roomElements.get(roomId);
  if (!elements) return null;

  const existing = elements.get(elementId);
  if (!existing) return null;

  // Merge partial updates on top of existing element
  const updated = { ...existing };
  for (const [key, value] of Object.entries(data)) {
    // Special merge for props (nested object)
    if (key === 'props' && typeof value === 'object' && value !== null) {
      updated.props = { ...(existing.props || {}), ...value };
    } else {
      updated[key] = value;
    }
  }

  elements.set(elementId, updated);
  return updated;
}

/**
 * Delete an element from the store.
 * @param {string} roomId
 * @param {string} elementId
 * @returns {boolean} true if element was found and deleted
 */
export function deleteElement(roomId, elementId) {
  const elements = roomElements.get(roomId);
  if (!elements) return false;
  return elements.delete(elementId);
}

/**
 * Check if an element exists in the store.
 * @param {string} roomId
 * @param {string} elementId
 * @returns {boolean}
 */
export function hasElement(roomId, elementId) {
  const elements = roomElements.get(roomId);
  if (!elements) return false;
  return elements.has(elementId);
}

/**
 * Remove all elements for a room (cleanup on room destruction).
 * @param {string} roomId
 */
export function clearRoom(roomId) {
  roomElements.delete(roomId);
}

/**
 * Get a snapshot of all room data (for debugging / metrics).
 * @returns {object}
 */
export function getStoreSnapshot() {
  const snapshot = {};
  for (const [roomId, elements] of roomElements.entries()) {
    snapshot[roomId] = Array.from(elements.values());
  }
  return snapshot;
}