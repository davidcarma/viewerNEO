import { getContext, clearCanvas, getCanvas } from './canvasContext.js';
import { getState, setState } from '../../core/state.js';
import { updateInfo } from '../controls/infoPanel.js';
import { drawGrid } from '../../features/grid/drawGrid.js';

// Last known good image position for smooth transitions
let lastRenderParams = null;
let lastRenderedImage = null;

export function refreshCanvas() {
  const { image, grid, zoom, offset, canvasZoomLimits } = getState();
  const canvas = getCanvas();
  const ctx = getContext();

  if (!canvas || !ctx) return;

  if (image && image !== lastRenderedImage) {
    console.log('New image detected, calculating initial fit.');
    const margin = 0.10;
    const targetViewportWidth = canvas.width * (1 - 2 * margin);
    const targetViewportHeight = canvas.height * (1 - 2 * margin);

    let newScale = Math.min(
      targetViewportWidth / image.naturalWidth,
      targetViewportHeight / image.naturalHeight
    );

    newScale = Math.max(canvasZoomLimits.min, Math.min(canvasZoomLimits.max, newScale));

    const scaledImageWidth = image.naturalWidth * newScale;
    const scaledImageHeight = image.naturalHeight * newScale;
    
    const newOffsetX = (canvas.width - scaledImageWidth) / 2;
    const newOffsetY = (canvas.height - scaledImageHeight) / 2;

    lastRenderedImage = image;
    
    setState({ 
      zoom: newScale, 
      offset: { x: newOffsetX, y: newOffsetY },
    });
    return; 
  }
  
  if (image && image === lastRenderedImage) {
    lastRenderParams = { zoom, offset: {...offset} };
  }
  
  if (!image) {
    clearCanvas();
    updateInfo();
    lastRenderedImage = null;
    return;
  }
  
  const container = document.getElementById('container');
  
  if (container) {
    const rect = container.getBoundingClientRect();
    if (Math.abs(parseInt(canvas.style.width) - rect.width) > 2 ||
        Math.abs(parseInt(canvas.style.height) - rect.height) > 2) {
      console.log('Canvas size mismatch detected during render, triggering resize');
      window.dispatchEvent(new Event('resize'));
      return; 
    }
  }

  const isAnimating = canvas.classList.contains('canvas-animating');
  clearCanvas(isAnimating ? null : '#222');

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

export const renderImage = refreshCanvas;

window.addEventListener('state:changed', (e) => {
  if (e.detail.hasOwnProperty('image') || 
      e.detail.hasOwnProperty('grid') || 
      e.detail.hasOwnProperty('zoom') || 
      e.detail.hasOwnProperty('offset')) {
    scheduleRedraw();
  }
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