import { setCanvasSize, clearCanvas, getCanvas } from './canvasContext.js';
import { setState } from '../../core/state.js';

export function initResizeCanvas() {
  const container = document.getElementById('container');
  if (!container) {
    console.error('Container #container not found');
    return;
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    setCanvasSize(rect.width, rect.height);
    clearCanvas();
    window.dispatchEvent(new CustomEvent('canvas:resized', { detail: { width: rect.width, height: rect.height } }));
  }

  // Initial
  resize();

  // Resize on window change
  window.addEventListener('resize', resize);

  // Also observe container size changes (if side panels open etc.)
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // Save observer on canvas element for future cleanup
  getCanvas()._resizeObserver = ro;

  // expose in state (optional)
  setState({ canvasReady: true });
} 