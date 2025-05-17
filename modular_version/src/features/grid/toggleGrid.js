import { updateGridSettings } from './settings.js';
import { initGridDraw } from './drawGrid.js';

export function initGridFeature() {
  const btn = document.getElementById('grid-btn');
  if (!btn) {
    console.warn('Grid button not found');
    return;
  }

  const controlPanel = document.getElementById('grid-controls');

  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    updateGridSettings({ show: btn.classList.contains('active') });

    if (controlPanel) {
      if (btn.classList.contains('active')) {
        controlPanel.classList.add('visible');
      } else {
        controlPanel.classList.remove('visible');
      }
    }
  });

  // initialize drawer
  initGridDraw();

  // start hidden
  if (controlPanel) controlPanel.classList.remove('visible');
} 