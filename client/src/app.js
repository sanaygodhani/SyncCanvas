/**
 * app.js — Main application coordinator
 * Wires together the canvas renderer, toolbar, sync client, text editor, and cursor manager.
 */

class SyncCanvasApp {
  constructor() {
    const wsHost = window.location.hostname || 'localhost';
    this.sync = new SyncClient(`ws://${wsHost}:3001`);
    this.canvas = new CanvasRenderer(document.getElementById('canvas'));
    this.toolbar = new Toolbar();
    this.textEditor = new TextEditor(document.getElementById('text-layer'));
    this.cursors = new CursorManager(document.getElementById('cursor-layer'));

    this._peerSessions = new Set();
    this._sequence = 0;
    this._undoStack = [];
    this._redoStack = [];

    this._init();
  }

  _init() {
    // ===== Toolbar callbacks =====
    this.toolbar.on('toolChange', (tool) => {
      this.canvas.currentTool = tool;
      this.canvas.canvas.style.cursor = tool === 'select' ? 'default' :
        tool === 'text' ? 'text' : 'crosshair';
    });

    this.toolbar.on('styleChange', (style) => {
      this.canvas.strokeColor = style.strokeColor;
      this.canvas.fillColor = style.fillColor;
      this.canvas.strokeWidth = style.strokeWidth;
    });

    this.toolbar.on('zoomIn', () => {
      this.canvas.zoomIn();
      this.toolbar.setZoom(this.canvas.zoom);
    });

    this.toolbar.on('zoomOut', () => {
      this.canvas.zoomOut();
      this.toolbar.setZoom(this.canvas.zoom);
    });

    this.toolbar.on('fitScreen', () => {
      this.canvas.fitToScreen();
      this.toolbar.setZoom(this.canvas.zoom);
    });

    this.toolbar.on('undo', () => this._undo());
    this.toolbar.on('redo', () => this._redo());

    // ===== Canvas callbacks =====

    this.canvas.onElementCreated = (element) => {
      // Send operation to server
      this.sync.sendOperation('add', element.id, {
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation || 0,
        props: element.props,
        points: element.points,
        content: element.content,
        createdBy: this.sync.sessionId,
        createdAt: element.createdAt,
        updatedAt: element.updatedAt
      });
      this._pushUndo({ type: 'add', elementId: element.id });
    };

    this.canvas.onElementUpdated = (element, changedFields) => {
      this.sync.sendOperation('update', element.id, {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        props: element.props,
        updatedAt: element.updatedAt
      });
    };

    this.canvas.onElementDeleted = (elementId) => {
      this.sync.sendOperation('delete', elementId, {});
    };

    this.canvas.onSelectionChanged = (elementId) => {
      // If a text element was selected and text tool is active, focus it
      if (elementId) {
        const el = this.canvas.elements.find(e => e.id === elementId);
        if (el && el.type === 'text' && this.canvas.currentTool === 'select') {
          // Allow double-click to edit text
        }
      }
    };

    // ===== Text editor callbacks =====
    this.textEditor.onTextUpdated = (element) => {
      this.sync.sendOperation('update', element.id, {
        content: element.content,
        width: element.width,
        height: element.height,
        x: element.x,
        y: element.y,
        updatedAt: element.updatedAt
      });
    };

    // ===== Sync client callbacks =====

    this.sync.onConnected = () => {
      this._showNotification('Connected to server');
    };

    this.sync.onDisconnected = () => {
      this._showNotification('Disconnected — retrying...');
    };

    this.sync.onRoomState = (elements) => {
      this.canvas.setElements(elements);
      this.textEditor.syncWithElements(elements);
      this._showNotification(`Loaded ${elements.length} elements`);
      
      // Update local color picker and canvas default color to server-assigned color
      if (this.sync.color) {
        const cp = document.getElementById('color-picker');
        if (cp) {
          cp.value = this.sync.color;
          this.canvas.strokeColor = this.sync.color;
          this.toolbar.strokeColor = this.sync.color;
        }
      }
      
      // Update the avatar stack UI
      this._updateAvatarStack();
    };

    this.sync.onOperation = (op) => {
      if (op.sessionId === this.sync.sessionId) return; // Our own op

      switch (op.type) {
        case 'add':
          this.canvas.addElement(op.data);
          this.textEditor.syncWithElements(this.canvas.elements);
          break;
        case 'update':
          this.canvas.updateElement(op.elementId, op.data);
          this.textEditor.updatePositions(this.canvas);
          break;
        case 'delete':
          this.canvas.deleteElement(op.elementId);
          this.textEditor.removeEditor(op.elementId);
          break;
      }
    };

    this.sync.onCursorMove = (msg) => {
      // Skip our own cursor
      if (msg.sessionId === this.sync.sessionId) return;
      this.cursors.updateCursor(msg.sessionId, msg.x, msg.y, msg.color, msg.name);
    };

    this.sync.onPeerJoined = (peer) => {
      this._updateAvatarStack();
      this._showNotification(`${peer.name} joined`);
    };

    this.sync.onPeerLeft = (sessionId) => {
      const peer = this.sync.peers.get(sessionId);
      const name = peer ? peer.name : 'A peer';
      this.cursors.removeCursor(sessionId);
      this._updateAvatarStack();
      this._showNotification(`${name} left`);
    };

    this.sync.onPeerCount = (count) => {
      const badge = document.getElementById('sidebar-peer-badge');
      if (badge) badge.textContent = count;
    };

    // ===== Mouse events on canvas =====
    const canvas = this.canvas.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      // If middle-mouse button is held or space is held, pan instead
      this.canvas.onMouseDown(e);
    });

    canvas.addEventListener('mousemove', (e) => {
      this.canvas.onMouseMove(e);

      // Send cursor via sync (throttled)
      if (this.sync.connected) {
        const rect = canvas.getBoundingClientRect();
        this.sync.sendCursor(e.clientX - rect.left, e.clientY - rect.top);
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      this.canvas.onMouseUp(e);
    });

    canvas.addEventListener('mouseleave', () => {
      if (this.canvas._drawing) {
        this.canvas._drawing = false;
        if (this.canvas._currentElement) {
          this.canvas._currentElement = null;
          this.canvas.render();
        }
      }
    });

    canvas.addEventListener('wheel', (e) => {
      this.canvas.onWheel(e);
      this.toolbar.setZoom(this.canvas.zoom);
    });

    // Double-click to edit text elements
    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const world = this.canvas.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = this.canvas._hitTest(world.x, world.y);
      if (hit && hit.type === 'text') {
        this.textEditor.focusEditor(hit.id);
      }
    });

    // Delete selected on Backspace/Delete
    document.addEventListener('delete-selected', () => {
      const id = this.canvas.deleteSelected();
      if (id) {
        this._pushUndo({ type: 'delete', elementId: id });
      }
    });

    // ===== Touch support =====
    let lastTouchDist = 0;
    let touchStartTime = 0;
    let touchMoved = false;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      touchStartTime = Date.now();
      touchMoved = false;

      if (e.touches.length === 2) {
        // Pinch zoom start
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      } else {
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        canvas.dispatchEvent(mouseEvent);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      touchMoved = true;

      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = dist / lastTouchDist;
        this.canvas.zoom *= scale;
        this.canvas.zoom = Math.max(0.1, Math.min(10, this.canvas.zoom));
        this.canvas.render();
        this.toolbar.setZoom(this.canvas.zoom);
        lastTouchDist = dist;
      } else {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup', {});
      canvas.dispatchEvent(mouseEvent);

      // Check for tap (text tool without drag)
      if (!touchMoved && Date.now() - touchStartTime < 300) {
        if (this.canvas.currentTool === 'text') {
          // text creation already handled in text tool mousedown
        }
      }
    }, { passive: false });

    // ===== Space bar for panning =====
    let spaceHeld = false;
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' && !e.repeat) {
        spaceHeld = true;
        canvas.style.cursor = 'grab';
        e.preventDefault();
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ') {
        spaceHeld = false;
        canvas.style.cursor = this.canvas.currentTool === 'select' ? 'default' : 'crosshair';
      }
    });

    // Override mousedown for space+pan
    const origMouseDown = this.canvas.onMouseDown.bind(this.canvas);
    this.canvas.onMouseDown = (e) => {
      if (spaceHeld || e.button === 1) {
        // Start panning
        const rect = canvas.getBoundingClientRect();
        this.canvas._panning = true;
        this.canvas._panStartX = e.clientX - rect.left;
        this.canvas._panStartY = e.clientY - rect.top;
        this.canvas._panOffsetX = this.canvas.offsetX;
        this.canvas._panOffsetY = this.canvas.offsetY;
        canvas.style.cursor = 'grabbing';
        return;
      }
      origMouseDown(e);
    };

    // ===== Initialize toolbar and connect =====
    this.toolbar.init();
    this.toolbar.setZoom(this.canvas.zoom);

    // Start connection
    this.sync.connect();

    // ===== Render loop =====
    const renderLoop = () => {
      this.canvas.render();
      this.textEditor.updatePositions(this.canvas);
      requestAnimationFrame(renderLoop);
    };
    renderLoop();

    this._showNotification('SyncCanvas ready — start drawing!');
  }

  _pushUndo(action) {
    this._undoStack.push(action);
    this._redoStack = []; // Clear redo on new action
    // Keep stack manageable
    if (this._undoStack.length > 100) {
      this._undoStack.shift();
    }
  }

  _undo() {
    // For MVP, undo just removes last element
    const action = this._undoStack.pop();
    if (!action) return;
    if (action.type === 'add') {
      const el = this.canvas.elements.find(e => e.id === action.elementId);
      if (el) {
        this.canvas.deleteElement(action.elementId);
        this.textEditor.removeEditor(action.elementId);
        this.sync.sendOperation('delete', action.elementId, {});
        this._redoStack.push({ type: 'add', elementId: action.elementId });
      }
    }
  }

  _redo() {
    const action = this._redoStack.pop();
    if (!action) return;
    // For MVP, redo is limited
    this._showNotification('Redo not fully implemented in MVP');
    this._undoStack.push(action);
  }

  _showNotification(msg) {
    const el = document.getElementById('notification');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 3000);
    }
    console.log('[SyncCanvas]', msg);
  }

  _updateAvatarStack() {
    const container = document.getElementById('avatar-stack');
    if (!container) return;

    container.innerHTML = '';

    // Add local user avatar first
    if (this.sync.sessionId) {
      const localAvatar = document.createElement('div');
      localAvatar.className = 'avatar-circle';
      localAvatar.style.backgroundColor = this.sync.color;
      const name = this.sync.name || 'Anonymous';
      localAvatar.textContent = name.charAt(0).toUpperCase();
      localAvatar.title = `${name} (You)`;
      container.appendChild(localAvatar);
    }

    // Add all other active peers
    for (const [id, peer] of this.sync.peers.entries()) {
      const peerAvatar = document.createElement('div');
      peerAvatar.className = 'avatar-circle';
      peerAvatar.style.backgroundColor = peer.color;
      const name = peer.name || 'Anonymous';
      peerAvatar.textContent = name.charAt(0).toUpperCase();
      peerAvatar.title = name;
      container.appendChild(peerAvatar);
    }
  }
}

// Boot the app when DOM is ready
function boot() {
  if (!window.app) {
    window.app = new SyncCanvasApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}