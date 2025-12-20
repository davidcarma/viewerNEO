import { setTopBarOffset, setLeftBoundary } from '../WindowsManager/window-system.js';
import { createGridViewerWindow, setupCanvasImageHandling } from '../grid_viewer_controls.js';
import { logger } from './logger.js';

// Encapsulates viewer state instead of scattering globals everywhere.
export class ViewerController {
  constructor({ panel, topBarEl }) {
    this.panel = panel;
    this.topBarEl = topBarEl;

    this.gridWindowId = 'canvas-window';
    this.canvasId = 'viewer-main-canvas';

    this.windowFrame = null;
    this.canvas = null;
    this.ctx = null;

    // Backwards compatibility for existing code paths that use globals:
    window.viewerNeo = window.viewerNeo || {};
    window.viewerNeo.controller = this;
  }

  syncBoundaries() {
    const top = this.topBarEl ? this.topBarEl.offsetHeight : 0;
    setTopBarOffset(top);
    const left = (this.panel && this.panel.getCurrentWidth) ? this.panel.getCurrentWidth() : 0;
    setLeftBoundary(left);
  }

  attachPanelListeners() {
    if (!this.panel) return;
    this.panel.addEventListener('thumbnail-selected', (event) => {
      this.loadFileFromEvent(event);
      // Store a last selection for re-open
      try {
        if (event.detail?.file) window.viewerNeo.lastSelectedThumbnail = event.detail.file;
      } catch {}
    });
  }

  loadFileFromEvent(event) {
    const fileEntry = event?.detail?.file;
    if (!fileEntry) return;
    this.loadFile(fileEntry).catch((e) => logger.error('Failed to load file', e));
  }

  ensureWindowCanvasRefs() {
    const existing = document.querySelector(`#${this.gridWindowId}`);
    if (existing) {
      this.windowFrame = existing;
      this.canvas = existing.querySelector(`#${this.canvasId}`);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      // bridge globals used by grid_viewer_controls and other logic
      window.canvas = this.canvas;
      window.ctx = this.ctx;
      return true;
    }
    return false;
  }

  focusWindow() {
    if (!this.windowFrame) return;
    try {
      const titleBar = this.windowFrame.querySelector('.window-title-bar');
      if (titleBar) titleBar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    } catch {}
  }

  openGridViewerWindow() {
    const mainContentElement = document.getElementById('main-content');
    if (!mainContentElement) throw new Error('Main content not found');

    const availableWidth = mainContentElement.clientWidth;
    const availableHeight = mainContentElement.clientHeight;
    const initialWidth = Math.floor(availableWidth * 0.82);
    const initialHeight = Math.floor(availableHeight * 0.82);
    const initialX = mainContentElement.offsetLeft + Math.floor((availableWidth - initialWidth) / 2);
    const initialY = mainContentElement.offsetTop + Math.floor((availableHeight - initialHeight) / 2);

    const selected = (this.panel && typeof this.panel.getSelectedThumbnail === 'function')
      ? this.panel.getSelectedThumbnail()
      : null;

    const initialTitle = selected?.name ? `Grid Viewer - ${selected.name}` : 'Grid Viewer';

    const frame = createGridViewerWindow({
      id: this.gridWindowId,
      title: initialTitle,
      x: initialX, y: initialY, width: initialWidth, height: initialHeight,
      canvasId: this.canvasId,
    });

    this.windowFrame = frame;
    this.canvas = frame.querySelector(`#${this.canvasId}`);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    window.canvas = this.canvas;
    window.ctx = this.ctx;

    // Hook up canvas interactions
    if (this.canvas && this.ctx) setupCanvasImageHandling(this.canvas, this.ctx);
    return frame;
  }

  async openOrFocusGridViewer() {
    if (this.ensureWindowCanvasRefs()) {
      this.focusWindow();
      return;
    }
    this.openGridViewerWindow();
  }

  async loadFile(fileEntry) {
    if (!fileEntry?.name || !fileEntry?.type) return;

    // Ensure window + canvas exist
    if (!this.canvas || !this.ctx) {
      // If window isn't open yet, we still store selection for later
      window.viewerNeo.lastSelectedThumbnail = fileEntry;
      return;
    }

    const itemName = fileEntry.name;
    const fileData = fileEntry.data;

    // TIFF: decoded via UTIF (requires File)
    if ((/\.tiff?$/i.test(itemName)) && typeof UTIF !== 'undefined') {
      if (!(fileData instanceof File)) throw new Error('TIFF loading requires a File object.');
      window.currentLoadedImage = null;
      const buffer = await fileData.arrayBuffer();
      const ifds = UTIF.decode(buffer);
      if (!ifds || ifds.length === 0) throw new Error('No TIFF pages found');
      const page = ifds[0];
      UTIF.decodeImage(buffer, page, ifds);
      const rgba = UTIF.toRGBA8(page);
      const tiffCanvas = document.createElement('canvas');
      tiffCanvas.width = page.width;
      tiffCanvas.height = page.height;
      const tctx = tiffCanvas.getContext('2d');
      tctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), page.width, page.height), 0, 0);

      window.currentLoadedImage = tiffCanvas;
      window.originalLoadedImage = tiffCanvas;
      this.canvas.transformState = { scale: 1, offsetX: 0, offsetY: 0 };
      if (typeof window.redrawCanvas === 'function') window.redrawCanvas(this.canvas);
      this._updateTitle(`Grid Viewer - ${itemName}`);
      return;
    }

    // Standard images (and JP2 handled by browser where supported)
    const img = new Image();
    const load = () => new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Error loading image: ${itemName}`));
    });

    if (fileData instanceof File) {
      const url = URL.createObjectURL(fileData);
      img.src = url;
      try {
        await load();
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (typeof fileData === 'string') {
      img.crossOrigin = 'anonymous';
      img.src = fileData + '?t=' + Date.now();
      await load();
    } else {
      throw new Error('Unsupported image data format');
    }

    window.currentLoadedImage = img;
    window.originalLoadedImage = img;
    if (!this.canvas.transformState) {
      this.canvas.transformState = { scale: 1, offsetX: 0, offsetY: 0 };
    }
    if (typeof window.redrawCanvas === 'function') window.redrawCanvas(this.canvas);
    this._updateTitle(`Grid Viewer - ${itemName}`);
  }

  _updateTitle(title) {
    try {
      const t = this.windowFrame?.querySelector('.window-title');
      if (t) t.textContent = title;
    } catch {}
  }
}


