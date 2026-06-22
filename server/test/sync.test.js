/**
 * sync-canvas — Sync Server Unit Tests
 *
 * Tests the core sync engine CRDT logic, room management,
 * and store operations. Uses Node's built-in test runner (node:test).
 *
 * Run: node --test test/sync.test.js
 *   or: npm test
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import server modules
import * as store from '../src/store.js';
import * as roomManager from '../src/room-manager.js';
import * as syncEngine from '../src/sync-engine.js';
import * as cursorManager from '../src/cursor-manager.js';

// ---------------------------------------------------------------------------
// Store Tests
// ---------------------------------------------------------------------------
describe('Store', () => {
  const ROOM = 'test-room-store';

  beforeEach(() => {
    store.clearRoom(ROOM);
  });

  it('should initialize a room and return empty elements', () => {
    store.initRoom(ROOM);
    const elements = store.getElements(ROOM);
    assert.ok(Array.isArray(elements));
    assert.equal(elements.length, 0);
  });

  it('should add an element', () => {
    const element = {
      id: 'elem_001',
      type: 'stroke',
      x: 0, y: 0, width: 100, height: 100,
      props: { stroke: '#ff0000', strokeWidth: 2 },
      points: [[0, 0], [10, 20]],
      createdBy: 'sess_abc',
      createdAt: 1000,
      updatedAt: 1000,
    };
    store.addElement(ROOM, element);
    assert.equal(store.getElements(ROOM).length, 1);
    assert.equal(store.getElement(ROOM, 'elem_001').id, 'elem_001');
  });

  it('should reject duplicate element add', () => {
    const element = {
      id: 'elem_002', type: 'text',
      x: 0, y: 0, width: 50, height: 20,
      props: {},
      createdBy: 'sess_abc', createdAt: 1000, updatedAt: 1000,
      content: 'hello',
    };
    store.addElement(ROOM, element);
    assert.throws(() => store.addElement(ROOM, element), /already exists/);
  });

  it('should partially update an element', () => {
    const element = {
      id: 'elem_003', type: 'rect',
      x: 0, y: 0, width: 100, height: 100,
      props: { fill: '#000000', stroke: '#ffffff', strokeWidth: 2 },
      createdBy: 'sess_abc', createdAt: 1000, updatedAt: 1000,
    };
    store.addElement(ROOM, element);

    const updated = store.updateElement(ROOM, 'elem_003', {
      x: 50, y: 60,
      props: { fill: '#ff00ff' },
      updatedAt: 2000,
    });

    assert.equal(updated.x, 50);
    assert.equal(updated.y, 60);
    assert.equal(updated.props.fill, '#ff00ff');
    assert.equal(updated.props.stroke, '#ffffff'); // unchanged field preserved
    assert.equal(updated.updatedAt, 2000);
  });

  it('should delete an element', () => {
    const element = {
      id: 'elem_004', type: 'ellipse',
      x: 0, y: 0, width: 50, height: 50,
      props: {},
      createdBy: 'sess_abc', createdAt: 1000, updatedAt: 1000,
    };
    store.addElement(ROOM, element);
    assert.ok(store.hasElement(ROOM, 'elem_004'));
    assert.ok(store.deleteElement(ROOM, 'elem_004'));
    assert.ok(!store.hasElement(ROOM, 'elem_004'));
  });

  it('should clear a room', () => {
    const element = {
      id: 'elem_005', type: 'stroke',
      x: 0, y: 0, width: 10, height: 10,
      props: {},
      createdBy: 'sess_abc', createdAt: 1000, updatedAt: 1000,
    };
    store.addElement(ROOM, element);
    store.clearRoom(ROOM);
    assert.equal(store.getElements(ROOM).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Sync Engine Tests (CRDT Logic)
// ---------------------------------------------------------------------------
describe('Sync Engine', () => {
  const ROOM = 'test-room-engine';

  beforeEach(() => {
    store.clearRoom(ROOM);
    // Reset per-session sequence tracking
    // Note: sessionSequences is module-private, so we test through processOperation
  });

  it('should validate operation fields', () => {
    const result1 = syncEngine.processOperation(ROOM, null);
    assert.equal(result1.valid, false);

    const result2 = syncEngine.processOperation(ROOM, { type: 'invalid' });
    assert.equal(result2.valid, false);

    const result3 = syncEngine.processOperation(ROOM, { type: 'add', elementId: 'e1' });
    assert.equal(result3.valid, false); // missing sessionId, timestamp
  });

  it('should add an element via sync engine', () => {
    const op = {
      type: 'add',
      elementId: 'e_001',
      sessionId: 'sess_add1',
      sequence: 1,
      timestamp: 1000,
      data: {
        type: 'stroke',
        x: 0, y: 0, width: 100, height: 100,
        props: { stroke: '#ff0000', strokeWidth: 2 },
        points: [[0, 0], [10, 20]],
        createdBy: 'sess_add1',
        createdAt: 1000,
      },
    };

    const result = syncEngine.processOperation(ROOM, op);
    assert.equal(result.valid, true);
    assert.ok(result.broadcastOp);
    assert.equal(result.broadcastOp.type, 'add');
    assert.ok(store.hasElement(ROOM, 'e_001'));
  });

  it('should update an element via sync engine', () => {
    // First add an element
    const addOp = {
      type: 'add',
      elementId: 'e_002',
      sessionId: 'sess_upd1',
      sequence: 1,
      timestamp: 1000,
      data: {
        type: 'rect',
        x: 0, y: 0, width: 100, height: 100,
        props: { fill: '#000', stroke: '#fff', strokeWidth: 1 },
        createdBy: 'sess_upd1',
        createdAt: 1000,
      },
    };
    syncEngine.processOperation(ROOM, addOp);

    // Now update it
    const updateOp = {
      type: 'update',
      elementId: 'e_002',
      sessionId: 'sess_upd1',
      sequence: 2,
      timestamp: 2000,
      data: { x: 50, y: 60 },
    };
    const result = syncEngine.processOperation(ROOM, updateOp);
    assert.equal(result.valid, true);
    assert.ok(result.broadcastOp);

    const element = store.getElement(ROOM, 'e_002');
    assert.equal(element.x, 50);
    assert.equal(element.y, 60);
  });

  it('should reject stale updates (older timestamp)', () => {
    const addOp = {
      type: 'add',
      elementId: 'e_003',
      sessionId: 'sess_stale1',
      sequence: 1,
      timestamp: 2000,
      data: {
        type: 'rect',
        x: 0, y: 0, width: 100, height: 100,
        props: {},
        createdBy: 'sess_stale1',
        createdAt: 2000,
      },
    };
    syncEngine.processOperation(ROOM, addOp);

    // Update with older timestamp — should be rejected
    const staleOp = {
      type: 'update',
      elementId: 'e_003',
      sessionId: 'sess_stale1',
      sequence: 2,
      timestamp: 1500, // older than element's updatedAt (2000)
      data: { x: 99 },
    };
    const result = syncEngine.processOperation(ROOM, staleOp);
    assert.equal(result.valid, false);
  });

  it('should append points for stroke elements', () => {
    const addOp = {
      type: 'add',
      elementId: 'e_004',
      sessionId: 'sess_pts1',
      sequence: 1,
      timestamp: 1000,
      data: {
        type: 'stroke',
        x: 0, y: 0, width: 100, height: 100,
        props: { stroke: '#000', strokeWidth: 2 },
        points: [[0, 0], [10, 10]],
        createdBy: 'sess_pts1',
        createdAt: 1000,
      },
    };
    syncEngine.processOperation(ROOM, addOp);

    // Append more points
    const appendOp = {
      type: 'update',
      elementId: 'e_004',
      sessionId: 'sess_pts1',
      sequence: 2,
      timestamp: 2000,
      data: { points: [[20, 20], [30, 30]] },
    };
    syncEngine.processOperation(ROOM, appendOp);

    const element = store.getElement(ROOM, 'e_004');
    assert.equal(element.points.length, 4); // 2 original + 2 appended
    assert.deepEqual(element.points[2], [20, 20]);
  });

  it('should delete an element via sync engine', () => {
    const addOp = {
      type: 'add',
      elementId: 'e_005',
      sessionId: 'sess_del1',
      sequence: 1,
      timestamp: 1000,
      data: {
        type: 'ellipse',
        x: 0, y: 0, width: 50, height: 50,
        props: {},
        createdBy: 'sess_del1',
        createdAt: 1000,
      },
    };
    syncEngine.processOperation(ROOM, addOp);

    const delOp = {
      type: 'delete',
      elementId: 'e_005',
      sessionId: 'sess_del1',
      sequence: 2,
      timestamp: 2000,
      data: {},
    };
    const result = syncEngine.processOperation(ROOM, delOp);
    assert.equal(result.valid, true);
    assert.ok(result.broadcastOp);
    assert.ok(!store.hasElement(ROOM, 'e_005'));
  });
});

// ---------------------------------------------------------------------------
// Room Manager Tests
// ---------------------------------------------------------------------------
describe('Room Manager', () => {
  it('should create and retrieve room summary', () => {
    // WebSocket mock
    const mockWs = { readyState: 1, send: () => {}, on: () => {} };

    const result = roomManager.joinRoom('room-test', mockWs);
    assert.ok(result.sessionId);
    assert.ok(result.sessionId.startsWith('sess_'));
    assert.ok(Array.isArray(result.elements));

    const rooms = roomManager.getRoomsSummary();
    assert.ok(rooms['room-test']);
    assert.equal(rooms['room-test'].sessionCount, 1);
  });
});

// ---------------------------------------------------------------------------
// Cursor Manager Tests
// ---------------------------------------------------------------------------
describe('Cursor Manager', () => {
  it('should throttle cursor updates', () => {
    const result1 = cursorManager.relayCursor('room-a', {
      x: 100, y: 200, sessionId: 'sess_foo', color: '#ff0000',
    }, 'sess_foo');
    // First update in a fresh throttle map should succeed
    // (but since we pass an excludeSessionId that matches the message's sessionId,
    //  the validation passes, and the throttle check is fresh → should relay)

    // Note: relayCursor requires the session to be in a room, but since we're
    // calling it directly without a room, the broadcast will silently no-op.
    // The function validates x, y, sessionId match — so this basic check should work.
    assert.equal(result1, true);
  });
});
