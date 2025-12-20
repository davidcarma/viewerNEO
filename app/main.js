import { initThemeSelect } from '../theme-manager.js';
import { initThumbnailPanelUI } from './panel.js';
import { initPasteToPanel } from './paste.js';
import { initDragAndDrop } from './dnd.js';
import { ViewerController } from './viewer-controller.js';
import { logger } from './logger.js';

function $(sel) {
  return document.querySelector(sel);
}

function init() {
  const panel = $('#my-thumbnail-panel');
  const togglePanelBtn = $('#toggle-panel-btn');
  const placeholder = $('.thumbnail-panel-placeholder');
  const themeSelect = $('#theme-select');
  const topBar = $('#top-function-bar');
  const gridBtn = $('#grid-viewer-btn');

  initThemeSelect(themeSelect);
  initThumbnailPanelUI({ panel, toggleButton: togglePanelBtn, placeholderEl: placeholder });
  initPasteToPanel({ panel });
  initDragAndDrop({ panel, dropZone: document.body });

  const controller = new ViewerController({ panel, topBarEl: topBar });
  controller.syncBoundaries();
  controller.attachPanelListeners();

  // Keep top bar offset in sync
  window.addEventListener('resize', () => controller.syncBoundaries());

  // Backwards-compat shim: older code expects window.handleThumbnailImage
  window.handleThumbnailImage = (event) => controller.loadFileFromEvent(event);

  // Open/focus grid viewer
  gridBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await controller.openOrFocusGridViewer();

      // If a selection exists, load it once canvas is ready
      const last = window.viewerNeo?.lastSelectedThumbnail
        || (panel && typeof panel.getSelectedThumbnail === 'function' ? panel.getSelectedThumbnail() : null);
      if (last) {
        await controller.loadFile(last);
        // clear one-shot handoff
        if (window.viewerNeo) window.viewerNeo.lastSelectedThumbnail = null;
      }
    } catch (err) {
      logger.error('Failed to open Grid Viewer', err);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


