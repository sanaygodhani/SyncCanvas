import { supabase } from './lib/supabase.js';

/**
 * sync-canvas — Database Store (Supabase)
 *
 * Persists whiteboard elements to PostgreSQL.
 * Provides CRUD operations that the sync-engine applies ops against.
 */

/**
 * Initialize a room (no-op for database, maybe ensure channel exists?)
 * @param {string} roomId (channel_id)
 */
export async function initRoom(roomId) {
  // In a real app, we might verify the channel exists in the 'channels' table.
}

/**
 * Get all elements for a room.
 * @param {string} roomId (channel_id)
 * @returns {Promise<Element[]>}
 */
export async function getElements(roomId) {
  const { data, error } = await supabase
    .from('whiteboard_elements')
    .select('*')
    .eq('channel_id', roomId)
    .eq('is_deleted', false);

  if (error) {
    console.error(`[store] Error fetching elements for room ${roomId}:`, error.message);
    return [];
  }

  // Map database fields back to the format expected by the client
  return data.map(item => ({
    id: item.id,
    type: item.type,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    props: item.props,
    points: item.points,
    content: item.content,
    createdBy: item.created_by,
    updatedAt: new Date(item.updated_at).getTime(),
    version: item.version,
  }));
}

/**
 * Get a single element by ID.
 * @param {string} roomId
 * @param {string} elementId
 * @returns {Promise<Element|null>}
 */
export async function getElement(roomId, elementId) {
  const { data, error } = await supabase
    .from('whiteboard_elements')
    .select('*')
    .eq('channel_id', roomId)
    .eq('id', elementId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    type: data.type,
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
    rotation: data.rotation,
    props: data.props,
    points: data.points,
    content: data.content,
    createdBy: data.created_by,
    updatedAt: new Date(data.updated_at).getTime(),
    version: data.version,
    isDeleted: data.is_deleted
  };
}

/**
 * Add an element to the store.
 * @param {string} roomId
 * @param {Element} element
 */
export async function addElement(roomId, element) {
  const { error } = await supabase
    .from('whiteboard_elements')
    .insert([{
      id: element.id,
      channel_id: roomId,
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
      props: element.props || {},
      points: element.points || [],
      content: element.content,
      created_by: element.createdBy,
      version: 1,
      updated_at: new Date(element.updatedAt || Date.now()).toISOString()
    }]);

  if (error) {
    throw new Error(`Failed to add element: ${error.message}`);
  }
}

/**
 * Update an element in the store.
 * @param {string} roomId
 * @param {string} elementId
 * @param {object} data — partial element fields to merge
 */
export async function updateElement(roomId, elementId, data) {
  // Better to fetch existing and merge if we want to preserve fields not in 'data'
  // But for LWW, we can just update the provided fields.
  
  // Note: 'data' contains fields like x, y, props, points, updatedAt.
  const updateData = {
    updated_at: new Date(data.updatedAt || Date.now()).toISOString()
  };

  if (data.x !== undefined) updateData.x = data.x;
  if (data.y !== undefined) updateData.y = data.y;
  if (data.width !== undefined) updateData.width = data.width;
  if (data.height !== undefined) updateData.height = data.height;
  if (data.props !== undefined) updateData.props = data.props;
  if (data.points !== undefined) updateData.points = data.points;
  if (data.content !== undefined) updateData.content = data.content;

  const { data: updated, error } = await supabase
    .from('whiteboard_elements')
    .update(updateData)
    .eq('channel_id', roomId)
    .eq('id', elementId)
    .select()
    .single();

  if (error) return null;
  return updated;
}

/**
 * Delete an element (soft delete).
 * @param {string} roomId
 * @param {string} elementId
 */
export async function deleteElement(roomId, elementId) {
  const { error } = await supabase
    .from('whiteboard_elements')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('channel_id', roomId)
    .eq('id', elementId);

  return !error;
}

/**
 * Check if an element exists.
 */
export async function hasElement(roomId, elementId) {
  const { count, error } = await supabase
    .from('whiteboard_elements')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', roomId)
    .eq('id', elementId)
    .eq('is_deleted', false);

  return !error && count > 0;
}

/**
 * Clear a room (soft delete all).
 */
export async function clearRoom(roomId) {
  await supabase
    .from('whiteboard_elements')
    .update({ is_deleted: true })
    .eq('channel_id', roomId);
}
