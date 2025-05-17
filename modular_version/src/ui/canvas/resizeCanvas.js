import { setCanvasSize, clearCanvas, getCanvas } from './canvasContext.js';
import { setState } from '../../core/state.js';

export function initResizeCanvas() {
  const container = document.getElementById('container');
  if (!container) {
    console.error('Container #container not found');
    return;
  }

  function resize() {
    const canvas = getCanvas();
    
    // Don't animate if we have a snapshot active (handled by panel toggle)
    const hasSnapshot = document.querySelector('.snapshot-canvas[style*="opacity: 1"]');
    if (hasSnapshot) {
      // Just resize the canvas without animation effects
      const rect = container.getBoundingClientRect();
      setCanvasSize(rect.width, rect.height);
      return;
    }
    
    // Apply animation class for smoother transition
    canvas.classList.add('canvas-animating');
    
    const rect = container.getBoundingClientRect();
    setCanvasSize(rect.width, rect.height);
    clearCanvas(null); // Don't clear during resize animation
    
    window.dispatchEvent(new CustomEvent('canvas:resized', { detail: { width: rect.width, height: rect.height } }));
    
    // Remove animation class after transition
    setTimeout(() => {
      canvas.classList.remove('canvas-animating');
    }, 200);
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