import { getContext, clearCanvas, getCanvas } from './canvasContext.js';
import { getState } from '../../core/state.js';
import { updateInfo } from '../controls/infoPanel.js';
import { drawGrid } from '../../features/grid/drawGrid.js';

// Last known good image position for smooth transitions
let lastRenderParams = null;

export function refreshCanvas() {
  const { image, grid, zoom, offset } = getState();
  
  // Save current parameters for transitions
  if (image) {
    lastRenderParams = { zoom, offset: {...offset} };
  }
  
  if (!image) {
    clearCanvas();
    updateInfo();
    return;
  }
  
  const canvas = getCanvas();
  const container = document.getElementById('container');
  
  // Check if canvas size matches container dimensions
  if (container) {
    const rect = container.getBoundingClientRect();
    // If canvas CSS size doesn't match container, schedule a resize event
    if (Math.abs(parseInt(canvas.style.width) - rect.width) > 2 ||
        Math.abs(parseInt(canvas.style.height) - rect.height) > 2) {
      console.log('Canvas size mismatch detected during render, triggering resize');
      window.dispatchEvent(new Event('resize'));
      return; // Exit early, the resize will trigger a new render
    }
  }

  // Use a soft clear that preserves previous content during transitions
  const isAnimating = canvas.classList.contains('canvas-animating');
  clearCanvas(isAnimating ? null : '#222'); // null = don't clear if animating

  const ctx = getContext();
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(image, 0, 0);
  ctx.restore();

  if (grid.show) {
    drawGrid();
  }

  updateInfo();
}

// convenience alias
export const renderImage = refreshCanvas;

// auto-update on state changes
window.addEventListener('state:changed', (e) => {
  if (e.detail.image || e.detail.grid) refreshCanvas();
});

let redrawPending = false;
export function scheduleRedraw() {
  if (redrawPending) return;
  redrawPending = true;
  requestAnimationFrame(() => {
    redrawPending = false;
    refreshCanvas();
  });
} 