import { setLeftBoundary } from '../WindowsManager/window-system.js';
import { logger } from './logger.js';

export function initThumbnailPanelUI({ panel, toggleButton, placeholderEl }) {
  if (!panel || !toggleButton || !placeholderEl) return;

  const applyOpenState = () => {
    const open = panel.hasAttribute('opened') && panel.getAttribute('opened') !== 'false';
    const width = (panel.getCurrentWidth && typeof panel.getCurrentWidth === 'function') ? panel.getCurrentWidth() : 0;
    document.body.classList.toggle('thumbnail-panel-active', open);
    placeholderEl.style.width = open ? `${width}px` : '0';
    toggleButton.textContent = open ? 'Close Panel' : 'Open Panel';
    setLeftBoundary(open ? width : 0);
  };

  // Initial sync (thumbnail pane animates in after connect)
  window.setTimeout(applyOpenState, 10);
  window.setTimeout(applyOpenState, 200);

  panel.addEventListener('panel-opened', () => applyOpenState());
  panel.addEventListener('panel-closed', () => applyOpenState());

  toggleButton.addEventListener('click', () => {
    try {
      panel.togglePanel();
    } catch (e) {
      logger.error('Toggle panel failed', e);
    }
  });
}


