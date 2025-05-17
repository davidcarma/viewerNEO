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
      controlPanel.style.display = btn.classList.contains('active') ? 'block' : 'none';
    }
  });

  // initialize drawer
  initGridDraw();

  // start hidden
  if (controlPanel) controlPanel.style.display = 'none';
} 