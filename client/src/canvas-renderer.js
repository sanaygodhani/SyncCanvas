/**
 * canvas-renderer.js — HTML5 Canvas drawing engine
 * Handles zoom/pan, freehand drawing, shape tools, selection, and rendering.
 */

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Viewport state
    this.offsetX = 0;
    this.offsetY = 0;
    this.zoom = 1.0;

    // Drawing style
    this.currentTool = 'select';
    this.strokeColor = '#23251d';
    this.fillColor = null;
    this.strokeWidth = 3;

    // Elements store (global array)
    this.elements = [];

    // Selection
    this.selectedElementId = null;

    // Drawing state
    this._drawing = false;
    this._currentElement = null;
    this._startX = 0;
    this._startY = 0;
    this._panning = false;
    this._panStartX = 0;
    this._panStartY = 0;
    this._panOffsetX = 0;
    this._panOffsetY = 0;
    this._strokePoints = [];
    this._draggingElement = false;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;

    // Callbacks
    this.onElementCreated = null;
    this.onElementUpdated = null;
    this.onElementDeleted = null;
    this.onSelectionChanged = null;

    // Set up resize observer
    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(canvas);

    // Initial resize
    requestAnimationFrame(() => this._handleResize());
  }

  _handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this._dpr = dpr;
    this._width = rect.width;
    this._height = rect.height;
    this.render();
  }

  // ===== Coordinate transforms =====

  /** Screen coordinates to canvas (world) coordinates */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this._width / 2 - this.offsetX) / this.zoom,
      y: (sy - this._height / 2 - this.offsetY) / this.zoom
    };
  }

  /** Canvas (world) coordinates to screen coordinates */
  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this._width / 2 + this.offsetX,
      y: wy * this.zoom + this._height / 2 + this.offsetY
    };
  }

  // ===== Mouse/Touch event handlers =====

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.screenToWorld(sx, sy);

    if (this.currentTool === 'select') {
      // Check if clicking on an element
      const hit = this._hitTest(world.x, world.y);
      if (hit) {
        this.selectedElementId = hit.id;
        if (this.onSelectionChanged) this.onSelectionChanged(hit.id);
        this._draggingElement = true;
        this._dragOffsetX = world.x - hit.x;
        this._dragOffsetY = world.y - hit.y;
      } else {
        // Start panning
        this._panning = true;
        this._panStartX = sx;
        this._panStartY = sy;
        this._panOffsetX = this.offsetX;
        this._panOffsetY = this.offsetY;
        // Deselect
        this.selectedElementId = null;
        if (this.onSelectionChanged) this.onSelectionChanged(null);
      }
    } else if (this.currentTool === 'text') {
      // Text tool — create new text element on click
      const id = 'elem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const element = {
        id,
        type: 'text',
        x: world.x,
        y: world.y,
        width: 200,
        height: 30,
        rotation: 0,
        props: {
          fill: this.fillColor || 'transparent',
          stroke: this.strokeColor,
          strokeWidth: 0,
          fontSize: 16,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          textAlign: 'left'
        },
        content: '',
        createdBy: 'local',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.elements.push(element);
      if (this.onElementCreated) this.onElementCreated(element);
      // Dispatch event so text-editor.js can focus it
      document.dispatchEvent(new CustomEvent('text-element-created', { detail: { element } }));
    } else {
      // Drawing tool (pen, rect, ellipse, arrow)
      this._drawing = true;
      this._startX = world.x;
      this._startY = world.y;
      if (this.currentTool === 'pen') {
        this._strokePoints = [[world.x, world.y]];
        this._currentElement = {
          id: 'elem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          type: 'stroke',
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          rotation: 0,
          props: {
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            opacity: 1
          },
          points: [[world.x, world.y]],
          createdBy: 'local',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      } else {
        // Shape tool
        this._currentElement = {
          id: 'elem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          type: this.currentTool,
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          rotation: 0,
          props: {
            fill: this.fillColor,
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            opacity: 1
          },
          createdBy: 'local',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.screenToWorld(sx, sy);

    // Update cursor coordinates in status bar
    const coordsEl = document.getElementById('canvas-coords');
    if (coordsEl) {
      coordsEl.textContent = `${Math.round(world.x)}, ${Math.round(world.y)}`;
    }

    // Send cursor via sync (handled in app.js)
    document.dispatchEvent(new CustomEvent('cursor-move', {
      detail: { screenX: sx, screenY: sy, worldX: world.x, worldY: world.y }
    }));

    if (this._panning) {
      this.offsetX = this._panOffsetX + (sx - this._panStartX);
      this.offsetY = this._panOffsetY + (sy - this._panStartY);
      this.render();
      return;
    }

    if (this._draggingElement && this.selectedElementId) {
      const el = this.elements.find(e => e.id === this.selectedElementId);
      if (el) {
        el.x = world.x - this._dragOffsetX;
        el.y = world.y - this._dragOffsetY;
        el.updatedAt = Date.now();
        this.render();
        if (this.onElementUpdated) this.onElementUpdated(el, { x: el.x, y: el.y });
      }
      return;
    }

    if (this._drawing && this._currentElement) {
      if (this.currentTool === 'pen') {
        this._strokePoints.push([world.x, world.y]);
        this._currentElement.points = [...this._strokePoints];
      } else {
        // Shape: update width/height from drag
        this._currentElement.width = world.x - this._startX;
        this._currentElement.height = world.y - this._startY;
        // For arrows, set length
        if (this._currentElement.type === 'arrow') {
          this._currentElement.x = this._startX;
          this._currentElement.y = this._startY;
        }
      }
      this.render();
    }
  }

  onMouseUp(e) {
    if (this._panning) {
      this._panning = false;
      return;
    }

    if (this._draggingElement) {
      this._draggingElement = false;
      return;
    }

    if (this._drawing && this._currentElement) {
      this._drawing = false;

      // Skip tiny shapes (accidental clicks)
      if (this.currentTool !== 'pen' && this._currentElement.type !== 'stroke') {
        const w = Math.abs(this._currentElement.width);
        const h = Math.abs(this._currentElement.height);
        if (w < 5 && h < 5) {
          this._currentElement = null;
          this.render();
          return;
        }
        // Normalize x/y for negative width/height
        if (this._currentElement.width < 0) {
          this._currentElement.x = this._startX + this._currentElement.width;
          this._currentElement.width = Math.abs(this._currentElement.width);
        }
        if (this._currentElement.height < 0) {
          this._currentElement.y = this._startY + this._currentElement.height;
          this._currentElement.height = Math.abs(this._currentElement.height);
        }
      }

      // Skip tiny strokes (accidental clicks)
      if (this.currentTool === 'pen' && this._strokePoints.length < 3) {
        this._currentElement = null;
        this.render();
        return;
      }

      this._currentElement.updatedAt = Date.now();
      this.elements.push(this._currentElement);
      if (this.onElementCreated) this.onElementCreated(this._currentElement);
      this._currentElement = null;
      this._strokePoints = [];
      this.render();
    }
  }

  // ===== Wheel zoom =====

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.screenToWorld(sx, sy);

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(0.1, Math.min(10, this.zoom * delta));

    // Zoom towards cursor
    const newWorld = this.screenToWorld(sx, sy);
    this.offsetX += (newWorld.x - world.x) * this.zoom;
    this.offsetY += (newWorld.y - world.y) * this.zoom;

    this.render();
  }

  // ===== Hit testing =====

  _hitTest(wx, wy) {
    // Check in reverse (top-most first)
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      let hit = false;

      if (el.type === 'stroke') {
        // Check distance to any point
        if (el.points) {
          for (const p of el.points) {
            const dx = wx - p[0];
            const dy = wy - p[1];
            if (dx * dx + dy * dy < 400) { // 20px radius at zoom=1
              hit = true;
              break;
            }
          }
        }
      } else if (el.type === 'rect' || el.type === 'ellipse' || el.type === 'text') {
        // Bounding box check
        if (wx >= el.x && wx <= el.x + el.width &&
            wy >= el.y && wy <= el.y + el.height) {
          hit = true;
        }
      } else if (el.type === 'arrow') {
        // Simple bounding box for arrows
        const minX = Math.min(el.x, el.x + (el.width || 0));
        const maxX = Math.max(el.x, el.x + (el.width || 0));
        const minY = Math.min(el.y, el.y + (el.height || 0));
        const maxY = Math.max(el.y, el.y + (el.height || 0));
        if (wx >= minX && wx <= maxX && wy >= minY && wy <= maxY) {
          hit = true;
        }
      }

      if (hit) return el;
    }
    return null;
  }

  // ===== Render =====

  render() {
    const ctx = this.ctx;
    const dpr = this._dpr || 1;
    const w = this._width || this.canvas.width;
    const h = this._height || this.canvas.height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Draw grid
    this._drawGrid(ctx, w, h);

    // Apply camera transform
    ctx.save();
    ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
    ctx.scale(this.zoom, this.zoom);

    // Draw all elements
    for (const el of this.elements) {
      this._drawElement(ctx, el);
    }

    // Draw in-progress element
    if (this._currentElement) {
      ctx.globalAlpha = 0.7;
      this._drawElement(ctx, this._currentElement);
      ctx.globalAlpha = 1;
    }

    // Draw selection handles
    if (this.selectedElementId) {
      const el = this.elements.find(e => e.id === this.selectedElementId);
      if (el) {
        this._drawSelectionHandles(ctx, el);
      }
    }

    ctx.restore();
  }

  _drawGrid(ctx, w, h) {
    const gridSize = 32 * this.zoom;
    if (gridSize < 8) return; // Too zoomed out

    const offsetX = (this.offsetX + w / 2) % gridSize;
    const offsetY = (this.offsetY + h / 2) % gridSize;

    ctx.fillStyle = 'var(--color-hairline-gray)';
    
    for (let x = offsetX; x < w; x += gridSize) {
      for (let y = offsetY; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawElement(ctx, el) {
    if (!el) return;

    switch (el.type) {
      case 'stroke':
        this._drawStroke(ctx, el);
        break;
      case 'rect':
        this._drawRect(ctx, el);
        break;
      case 'ellipse':
        this._drawEllipse(ctx, el);
        break;
      case 'arrow':
        this._drawArrow(ctx, el);
        break;
      case 'text':
        // Text is rendered via HTML (contenteditable) in text-layer
        // We just draw a bounding box indicator
        this._drawTextBounds(ctx, el);
        break;
    }
  }

  _drawStroke(ctx, el) {
    if (!el.points || el.points.length < 2) return;

    ctx.strokeStyle = el.props.stroke || this.strokeColor;
    ctx.lineWidth = el.props.strokeWidth || this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = el.props.opacity || 1;

    ctx.beginPath();
    ctx.moveTo(el.points[0][0], el.points[0][1]);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i][0], el.points[i][1]);
    }
    ctx.stroke();
  }

  _drawRect(ctx, el) {
    ctx.strokeStyle = el.props.stroke || this.strokeColor;
    ctx.lineWidth = el.props.strokeWidth || this.strokeWidth;
    ctx.globalAlpha = el.props.opacity || 1;

    if (el.props.fill && el.props.fill !== 'transparent') {
      ctx.fillStyle = el.props.fill;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    }

    ctx.strokeRect(el.x, el.y, el.width, el.height);
  }

  _drawEllipse(ctx, el) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rx = Math.abs(el.width) / 2;
    const ry = Math.abs(el.height) / 2;

    ctx.strokeStyle = el.props.stroke || this.strokeColor;
    ctx.lineWidth = el.props.strokeWidth || this.strokeWidth;
    ctx.globalAlpha = el.props.opacity || 1;

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, Math.PI * 2);

    if (el.props.fill && el.props.fill !== 'transparent') {
      ctx.fillStyle = el.props.fill;
      ctx.fill();
    }

    ctx.stroke();
  }

  _drawArrow(ctx, el) {
    const dx = el.width || 0;
    const dy = el.height || 0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;

    const angle = Math.atan2(dy, dx);
    const ax = el.x;
    const ay = el.y;
    const bx = el.x + dx;
    const by = el.y + dy;

    ctx.strokeStyle = el.props.stroke || this.strokeColor;
    ctx.lineWidth = el.props.strokeWidth || this.strokeWidth;
    ctx.globalAlpha = el.props.opacity || 1;

    // Line
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Arrowhead
    const headLen = Math.min(20, len / 3);
    const headAngle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(
      bx - headLen * Math.cos(angle - headAngle),
      by - headLen * Math.sin(angle - headAngle)
    );
    ctx.moveTo(bx, by);
    ctx.lineTo(
      bx - headLen * Math.cos(angle + headAngle),
      by - headLen * Math.sin(angle + headAngle)
    );
    ctx.stroke();
  }

  _drawTextBounds(ctx, el) {
    if (this.selectedElementId === el.id) {
      ctx.strokeStyle = el.props.stroke || '#466cf3';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(el.x, el.y, el.width, el.height);
      ctx.setLineDash([]);
    }
  }

  _drawSelectionHandles(ctx, el) {
    ctx.strokeStyle = '#466cf3';
    ctx.lineWidth = 2 / this.zoom;
    ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);

    let bx, by, bw, bh;
    if (el.type === 'stroke') {
      // Compute stroke bounding box
      if (!el.points || el.points.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of el.points) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
      bx = minX - 5; by = minY - 5;
      bw = maxX - minX + 10; bh = maxY - minY + 10;
    } else {
      bx = el.x; by = el.y;
      bw = el.width || 50; bh = el.height || 50;
    }

    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);

    // Draw corner handles
    const handleSize = 8 / this.zoom;
    const handles = [
      [bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh],
      [bx + bw / 2, by], [bx + bw / 2, by + bh],
      [bx, by + bh / 2], [bx + bw, by + bh / 2]
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#466cf3';
    ctx.lineWidth = 2 / this.zoom;
    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }
  }

  // ===== Public API =====

  setZoom(z) {
    this.zoom = Math.max(0.1, Math.min(10, z));
    this.render();
  }

  zoomIn() {
    this.setZoom(this.zoom * 1.25);
  }

  zoomOut() {
    this.setZoom(this.zoom / 1.25);
  }

  fitToScreen() {
    if (this.elements.length === 0) {
      this.zoom = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      this.render();
      return;
    }
    // Compute bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of this.elements) {
      if (el.type === 'stroke' && el.points) {
        for (const p of el.points) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
        }
      } else {
        if (el.x < minX) minX = el.x;
        if (el.y < minY) minY = el.y;
        if (el.x + (el.width || 50) > maxX) maxX = el.x + (el.width || 50);
        if (el.y + (el.height || 50) > maxY) maxY = el.y + (el.height || 50);
      }
    }

    const elW = maxX - minX + 40;
    const elH = maxY - minY + 40;
    const zoomX = (this._width - 80) / elW;
    const zoomY = (this._height - 80) / elH;
    this.zoom = Math.min(zoomX, zoomY, 2);
    this.offsetX = -(minX + elW / 2) * this.zoom + this._width / 2;
    this.offsetY = -(minY + elH / 2) * this.zoom + this._height / 2;
    // Convert to the right offset system
    this.offsetX = -(minX + (maxX - minX) / 2) * this.zoom;
    this.offsetY = -(minY + (maxY - minY) / 2) * this.zoom;
    this.render();
  }

  getSelectedElement() {
    if (!this.selectedElementId) return null;
    return this.elements.find(e => e.id === this.selectedElementId) || null;
  }

  deleteSelected() {
    if (!this.selectedElementId) return null;
    const el = this.elements.find(e => e.id === this.selectedElementId);
    if (el) {
      this.elements = this.elements.filter(e => e.id !== this.selectedElementId);
      this.selectedElementId = null;
      if (this.onElementDeleted) this.onElementDeleted(el.id);
      if (this.onSelectionChanged) this.onSelectionChanged(null);
      this.render();
      return el.id;
    }
    return null;
  }

  deleteElement(id) {
    this.elements = this.elements.filter(e => e.id !== id);
    if (this.selectedElementId === id) {
      this.selectedElementId = null;
      if (this.onSelectionChanged) this.onSelectionChanged(null);
    }
    this.render();
  }

  addElement(el) {
    // Don't add duplicates
    if (this.elements.some(e => e.id === el.id)) return;
    this.elements.push(el);
    this.render();
  }

  updateElement(id, updates) {
    const el = this.elements.find(e => e.id === id);
    if (!el) return;
    Object.assign(el, updates);
    this.render();
  }

  setElements(elements) {
    this.elements = elements;
    this.render();
  }
}

window.CanvasRenderer = CanvasRenderer;
