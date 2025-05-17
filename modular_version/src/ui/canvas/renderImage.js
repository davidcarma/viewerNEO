import { getContext, clearCanvas, getCanvas } from './canvasContext.js';
import { getState, setState } from '../../core/state.js';
import { updateInfo } from '../controls/infoPanel.js';
import { drawGrid } from '../../features/grid/drawGrid.js';

// Simple tracking of last rendered image to avoid duplicate fitting
let lastRenderedImage = null;

export function refreshCanvas() {
  const { image, grid } = getState();
  let { zoom: currentZoom, offset: currentOffset } = getState();

  const canvas = getCanvas();
  const ctx = getContext();

  if (!canvas || !ctx) return;

  // For new images, reset zoom to 100% and position to top-left (0,0)
  if (image && image !== lastRenderedImage) {
    console.log('New image detected, positioning at 0,0 with 100% zoom');
    
    // Always use 100% zoom for new images
    const newScale = 1.0;
    
    // Position at top-left (0,0)
    const newOffsetX = 0;
    const newOffsetY = 0;

    lastRenderedImage = image;
    
    // Update local variables for current draw and state
    currentZoom = newScale;
    currentOffset = { x: newOffsetX, y: newOffsetY };
    
    setState({ 
      zoom: currentZoom, 
      offset: currentOffset,
    });
  }
  
  // Clear canvas and draw image
  clearCanvas('#222');

  if (image) {
    ctx.save();
    ctx.translate(currentOffset.x, currentOffset.y);
    ctx.scale(currentZoom, currentZoom);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  // Draw grid if enabled
  if (grid && grid.show) {
    drawGrid();
  }

  // Update info panel
  updateInfo();
}

// Alias for compatibility
export const renderImage = refreshCanvas;

// Listen for state changes
window.addEventListener('state:changed', (e) => {
  if (e.detail.hasOwnProperty('image') || 
      e.detail.hasOwnProperty('grid') || 
      e.detail.hasOwnProperty('zoom') || 
      e.detail.hasOwnProperty('offset')) {
    scheduleRedraw();
  }
});

// Schedule a redraw using requestAnimationFrame
let redrawPending = false;
export function scheduleRedraw() {
  if (redrawPending) return;
  redrawPending = true;
  requestAnimationFrame(() => {
    redrawPending = false;
    refreshCanvas();
  });
} 