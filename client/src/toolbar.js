/**
 * toolbar.js — Tool selection UI and style controls
 * Manages the toolbar buttons, color picker, stroke width, and keyboard shortcuts.
 */

class Toolbar {
  constructor() {
    this.currentTool = 'select';
    this.strokeColor = '#23251d';
    this.fillColor = null; // null = no fill
    this.strokeWidth = 3;
    this.fontSize = 16;

    this._callbacks = {
      onToolChange: null,
      onStyleChange: null,
      onUndo: null,
      onRedo: null,
      onZoomIn: null,
      onZoomOut: null,
      onFitScreen: null
    };
  }

  init() {
    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this._setTool(btn.dataset.tool));
    });

    // Color picker
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        this.strokeColor = e.target.value;
        this._notifyStyleChange();
      });
    }

    // Stroke width
    const strokeWidth = document.getElementById('stroke-width');
    const strokeVal = document.getElementById('stroke-width-value');
    if (strokeWidth) {
      strokeWidth.addEventListener('input', (e) => {
        this.strokeWidth = parseInt(e.target.value);
        if (strokeVal) strokeVal.textContent = this.strokeWidth;
        this._notifyStyleChange();
      });
    }

    // Fill picker
    const fillPicker = document.getElementById('fill-picker');
    if (fillPicker) {
      fillPicker.addEventListener('input', (e) => {
        this.fillColor = e.target.value !== '#000000' && e.target.value ? e.target.value : null;
        this._notifyStyleChange();
      });
    }

    // Fill toggle
    const fillToggle = document.getElementById('fill-toggle');
    if (fillToggle) {
      fillToggle.addEventListener('click', () => {
        this.fillColor = this.fillColor ? null : '#ffffff';
        if (fillPicker) fillPicker.value = this.fillColor || '#000000';
        this._notifyStyleChange();
      });
    }

    // Action buttons
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.addEventListener('click', () => { if (this._callbacks.onUndo) this._callbacks.onUndo(); });

    const redoBtn = document.getElementById('btn-redo');
    if (redoBtn) redoBtn.addEventListener('click', () => { if (this._callbacks.onRedo) this._callbacks.onRedo(); });

    const zoomInBtn = document.getElementById('btn-zoom-in');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => { if (this._callbacks.onZoomIn) this._callbacks.onZoomIn(); });

    const zoomOutBtn = document.getElementById('btn-zoom-out');
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { if (this._callbacks.onZoomOut) this._callbacks.onZoomOut(); });

    const fitBtn = document.getElementById('btn-fit');
    if (fitBtn) fitBtn.addEventListener('click', () => { if (this._callbacks.onFitScreen) this._callbacks.onFitScreen(); });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't capture when editing text
      if (e.target.closest('.text-editor')) return;

      switch (e.key.toLowerCase()) {
        case 'v': this._setTool('select'); break;
        case 'p': this._setTool('pen'); break;
        case 'r': this._setTool('rect'); break;
        case 'e': this._setTool('ellipse'); break;
        case 'a': this._setTool('arrow'); break;
        case 't': this._setTool('text'); break;
        case 'escape': this._setTool('select'); break;
        case 'delete':
        case 'backspace':
          // Handled by app.js for deleting selections
          document.dispatchEvent(new CustomEvent('delete-selected'));
          break;
      }

      // Ctrl+Z / Ctrl+Shift+Z
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (this._callbacks.onRedo) this._callbacks.onRedo();
        } else {
          if (this._callbacks.onUndo) this._callbacks.onUndo();
        }
      }

      // Zoom
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        if (this._callbacks.onZoomIn) this._callbacks.onZoomIn();
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        if (this._callbacks.onZoomOut) this._callbacks.onZoomOut();
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        if (this._callbacks.onFitScreen) this._callbacks.onFitScreen();
      }
    });
  }

  _setTool(tool) {
    if (this.currentTool === tool) return;
    this.currentTool = tool;

    // Update active button
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Update tool name in status bar
    const toolNameEl = document.getElementById('tool-name');
    if (toolNameEl) {
      const names = {
        select: 'Select',
        pen: 'Pen',
        rect: 'Rectangle',
        ellipse: 'Ellipse',
        arrow: 'Arrow',
        text: 'Text',
        eraser: 'Eraser'
      };
      toolNameEl.textContent = names[tool] || tool;
    }

    if (this._callbacks.onToolChange) this._callbacks.onToolChange(tool);
  }

  setZoom(zoom) {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `${Math.round(zoom * 100)}%`;
  }

  _notifyStyleChange() {
    if (this._callbacks.onStyleChange) {
      this._callbacks.onStyleChange({
        strokeColor: this.strokeColor,
        fillColor: this.fillColor,
        strokeWidth: this.strokeWidth,
        fontSize: this.fontSize
      });
    }
  }

  on(event, callback) {
    const key = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
    if (key in this._callbacks) {
      this._callbacks[key] = callback;
    }
  }
}

window.Toolbar = Toolbar;