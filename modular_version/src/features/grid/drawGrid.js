import { getContext, getCanvas, getDpr } from '../../ui/canvas/canvasContext.js';
import { getState } from '../../core/state.js';

export function drawGrid() {
  const { grid, zoom, offset } = getState();

  if (!grid.show) return;

  const overlay = document.getElementById('grid-overlay');
  if (!overlay) return;
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0,0,overlay.width, overlay.height);

  ctx.save();

  ctx.strokeStyle = grid.color;
  ctx.globalAlpha = grid.opacity;
  ctx.setLineDash(grid.lineStyle === 'dashed' ? [4, 4] : []);

  const canvasW = overlay.width;
  const canvasH = overlay.height;

  if (grid.fixed) {
    // Grid relative to viewport
    ctx.lineWidth = 1;
    const cellPx = grid.size;
    for (let x = 0; x <= canvasW; x += cellPx) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvasH);
      ctx.stroke();
    }
    for (let y = 0; y <= canvasH; y += cellPx) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvasW, y + 0.5);
      ctx.stroke();
    }
  } else {
    // Grid relative to image
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    ctx.lineWidth = 1 / zoom;

    const cell = grid.size; // in image pixels
    const imgW = overlay.width;
    const imgH = overlay.height;

    for (let x = 0; x <= imgW; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5 / zoom, 0);
      ctx.lineTo(x + 0.5 / zoom, imgH);
      ctx.stroke();
    }
    for (let y = 0; y <= imgH; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5 / zoom);
      ctx.lineTo(imgW, y + 0.5 / zoom);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Hook events so grid redraws when things change
export function initGridDraw() {
  window.addEventListener('canvas:resized', drawGrid);
  window.addEventListener('state:changed', drawGrid);
  drawGrid();
} 