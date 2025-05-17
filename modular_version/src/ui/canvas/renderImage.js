import { getContext, clearCanvas } from './canvasContext.js';
import { getState } from '../../core/state.js';
import { updateInfo } from '../controls/infoPanel.js';
import { drawGrid } from '../../features/grid/drawGrid.js';

export function refreshCanvas() {
  const { image, grid, zoom, offset } = getState();
  if (!image) {
    clearCanvas();
    updateInfo();
    return;
  }

  clearCanvas();
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