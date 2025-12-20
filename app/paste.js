import { logger } from './logger.js';
import { showToast } from './toast.js';

export function initPasteToPanel({ panel }) {
  if (!panel) return;
  document.addEventListener('paste', async (event) => {
    try {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        event.preventDefault();
        panel.createNewBatch(imageFiles, { title: 'Pasted Images' });
        showToast(`Added ${imageFiles.length} pasted image${imageFiles.length === 1 ? '' : 's'}`, { type: 'success' });
      }
    } catch (e) {
      logger.error('Paste handler failed', e);
    }
  });
}


