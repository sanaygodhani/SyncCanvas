/**
 * text-editor.js — Rich text element management
 * Handles contenteditable div overlays for text elements on the canvas.
 */

class TextEditor {
  constructor(textLayerEl) {
    this.textLayer = textLayerEl;
    this._editors = new Map(); // elementId -> { div, element }
    this._activeEditorId = null;

    // Callbacks
    this.onTextCreated = null;
    this.onTextUpdated = null;
    this.onTextDeleted = null;

    // Listen for text-element-created events from canvas-renderer
    document.addEventListener('text-element-created', (e) => {
      this.createEditor(e.detail.element);
    });
  }

  /** Create a contenteditable div for a text element */
  createEditor(element, initialFocus = false) {
    // Remove existing editor for this element
    if (this._editors.has(element.id)) {
      this.removeEditor(element.id);
    }

    const div = document.createElement('div');
    div.className = 'text-editor';
    div.contentEditable = true;
    div.dataset.elementId = element.id;

    // Apply styles from element props
    div.style.left = '0';
    div.style.top = '0';
    div.style.color = element.props.stroke || '#ffffff';
    div.style.fontSize = (element.props.fontSize || 16) + 'px';
    div.style.fontFamily = element.props.fontFamily || '-apple-system, BlinkMacSystemFont, sans-serif';
    div.style.textAlign = element.props.textAlign || 'left';
    div.style.minWidth = '20px';
    div.style.minHeight = '20px';

    if (element.content) {
      div.innerHTML = element.content;
    }

    // Position via transform (updated during render loop)
    div.dataset.worldX = element.x;
    div.dataset.worldY = element.y;
    div.dataset.worldWidth = element.width || 200;

    this.textLayer.appendChild(div);

    // Track events
    div.addEventListener('input', () => {
      const el = this._editors.get(element.id);
      if (el) {
        el.element.content = div.innerHTML;
        el.element.updatedAt = Date.now();
        // Update bounding box to fit content
        const rect = div.getBoundingClientRect();
        el.element.width = rect.width;
        el.element.height = rect.height;
        if (this.onTextUpdated) this.onTextUpdated(el.element);
      }
    });

    div.addEventListener('blur', () => {
      const el = this._editors.get(element.id);
      if (el) {
        el.element.updatedAt = Date.now();
        // Remove selection
        if (this._activeEditorId === element.id) {
          this._activeEditorId = null;
        }
        if (this.onTextUpdated) this.onTextUpdated(el.element);
      }
    });

    div.addEventListener('focus', () => {
      this._activeEditorId = element.id;
    });

    // Enable rich text formatting (bold, italic, underline)
    div.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            document.execCommand('bold');
            break;
          case 'i':
            e.preventDefault();
            document.execCommand('italic');
            break;
          case 'u':
            e.preventDefault();
            document.execCommand('underline');
            break;
        }
      }
      // Enter creates new line (shift+enter too)
      if (e.key === 'Escape') {
        div.blur();
      }
    });

    this._editors.set(element.id, { div, element });

    if (initialFocus) {
      setTimeout(() => div.focus(), 50);
    }

    return div;
  }

  /** Remove a text editor div */
  removeEditor(elementId) {
    const entry = this._editors.get(elementId);
    if (entry) {
      entry.div.remove();
      this._editors.delete(elementId);
    }
    if (this._activeEditorId === elementId) {
      this._activeEditorId = null;
    }
  }

  /** Update positions of all text editors to match world coordinates */
  updatePositions(renderer) {
    for (const [id, entry] of this._editors) {
      const div = entry.div;
      const el = entry.element;

      // Convert world coords to screen coords
      const screen = renderer.worldToScreen(el.x, el.y);
      div.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
      div.style.fontSize = (el.props.fontSize || 16) * renderer.zoom + 'px';

      // Hide if too zoomed out
      if (renderer.zoom < 0.3) {
        div.style.display = 'none';
      } else {
        div.style.display = 'block';
      }

      // Update text content if changed remotely
      if (el.content !== undefined && div.innerHTML !== el.content && !div.matches(':focus')) {
        div.innerHTML = el.content;
      }
    }
  }

  /** Focus a text editor to start typing */
  focusEditor(elementId) {
    const entry = this._editors.get(elementId);
    if (entry) {
      entry.div.focus();
      // Place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(entry.div);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  /** Ensure all text elements have editors */
  syncWithElements(elements) {
    const textElements = elements.filter(e => e.type === 'text');
    const currentIds = new Set(textElements.map(e => e.id));
    const editorIds = new Set(this._editors.keys());

    // Remove editors for elements that no longer exist
    for (const id of editorIds) {
      if (!currentIds.has(id)) {
        this.removeEditor(id);
      }
    }

    // Create editors for new text elements
    for (const el of textElements) {
      if (!this._editors.has(el.id)) {
        this.createEditor(el);
      }
    }
  }

  getEditor(elementId) {
    return this._editors.get(elementId) || null;
  }
}

window.TextEditor = TextEditor;
