/**
 * cursors.js — Remote cursor rendering
 * Shows other users' cursors with name/color tags.
 */

class CursorManager {
  constructor(cursorLayerEl) {
    this.cursorLayer = cursorLayerEl;
    this._cursors = new Map(); // sessionId -> { div, label, color, x, y }
  }

  /** Update or create a remote cursor */
  updateCursor(sessionId, x, y, color, name) {
    let entry = this._cursors.get(sessionId);

    if (!entry) {
      // Create cursor DOM elements
      const cursorEl = document.createElement('div');
      cursorEl.className = 'remote-cursor';

      // Simple triangle cursor shape
      cursorEl.innerHTML = `
        <svg width="12" height="16" viewBox="0 0 12 16">
          <polygon points="2,2 10,10 6,10 8,14 6,14 4,10 2,10" fill="${color || '#ffffff'}" stroke="none"/>
        </svg>
      `;

      const label = document.createElement('div');
      label.className = 'remote-cursor-label';
      label.style.background = color || '#ffffff';
      label.style.color = '#000000';
      label.textContent = name || sessionId.slice(0, 6);

      this.cursorLayer.appendChild(cursorEl);
      this.cursorLayer.appendChild(label);

      entry = { div: cursorEl, label, color, name };
      this._cursors.set(sessionId, entry);
    }

    // Position the cursor
    entry.div.style.transform = `translate(${x}px, ${y}px)`;
    entry.label.style.transform = `translate(${x}px, ${y + 18}px)`;

    // Update name/color if changed
    if (name && name !== entry.name) {
      entry.name = name;
      entry.label.textContent = name;
    }

    if (color && color !== entry.color) {
      entry.color = color;
      entry.label.style.background = color;
      entry.div.querySelector('polygon').setAttribute('fill', color);
    }
  }

  /** Remove a cursor when a peer leaves */
  removeCursor(sessionId) {
    const entry = this._cursors.get(sessionId);
    if (entry) {
      entry.div.remove();
      entry.label.remove();
      this._cursors.delete(sessionId);
    }
  }

  /** Clear all cursors */
  clearAll() {
    for (const [id] of this._cursors) {
      this.removeCursor(id);
    }
  }

  getActiveCount() {
    return this._cursors.size;
  }
}

window.CursorManager = CursorManager;