import { State } from './state.js';
import { initResizeCanvas } from '../ui/canvas/resizeCanvas.js';
import { initGridFeature } from '../features/grid/toggleGrid.js';
import { initGridControls } from '../features/grid/bindGridControls.js';
import { initDragDrop } from '../loaders/dragDrop.js';
import { handleIncomingFiles } from '../loaders/fileHandlerRouter.js';
import { initZoom } from '../features/zoom-pan/zoomHandlers.js';
import { initPan } from '../features/zoom-pan/panHandlers.js';
import { updateInfo } from '../ui/controls/infoPanel.js';

// Basic Phase-1 bootstrap
console.log('%cViewer bootstrap (Phase 1)', 'color:#00c8ff;font-weight:bold');

function start() {
  console.log('App started. Current state:', State);

  // Example global listener to prove events flow
  window.addEventListener('state:changed', (e) => {
    console.log('State changed →', e.detail);
  });

  // Example usage: keep track of window size
  window.addEventListener('resize', () => {
    console.log('Window resized to', window.innerWidth, 'x', window.innerHeight);
  });

  // Phase 2: initialise Hi-DPI canvas handling
  initResizeCanvas();

  // Phase 3: grid overlay
  initGridFeature();
  initGridControls();

  // Phase 4: file input & drag-drop
  const fileInput = document.getElementById('file-input');
  const loadBtn = document.getElementById('load-btn');
  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleIncomingFiles(Array.from(e.target.files)));

  initDragDrop();

  // Phase 5: zoom + pan
  initZoom();
  initPan();

  // pointer coordinates
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('mousemove', (e) => {
    const { image, zoom, offset } = State;
    if (!image) return;
    const rect = canvas.getBoundingClientRect();
    const xScreen = e.clientX - rect.left;
    const yScreen = e.clientY - rect.top;
    const imgX = Math.floor((xScreen - offset.x) / zoom);
    const imgY = Math.floor((yScreen - offset.y) / zoom);
    updateInfo({ pointer: { x: imgX, y: imgY } });
  });
}

// Auto start on module import
start();
