import { getContext, clearCanvas, getCanvas } from './canvasContext.js';
import { getState, setState } from '../../core/state.js';
import { updateInfo } from '../controls/infoPanel.js';
import { drawGrid } from '../../features/grid/drawGrid.js';

// Simple tracking of last rendered image to avoid duplicate fitting
let lastRenderedImage = null;
// Track when we're in a panel transition to avoid transformation changes
let inPanelTransition = false;

// Export function to allow thumbnail panel to signal transition state
export function setPanelTransitionState(isTransitioning) {
  inPanelTransition = isTransitioning;
}

/**
 * Calculate zoom and offset to fit image with 10% padding on all sides
 * respecting the control panel on the right and thumbnail panel if visible
 */
export function fitImageWithPadding() {
  const { image, rotation } = getState();
  if (!image) return { zoom: 1, offset: { x: 0, y: 0 } };
  
  const canvas = getCanvas();
  if (!canvas) return { zoom: 1, offset: { x: 0, y: 0 } };
  
  // Get canvas dimensions
  const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
  const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
  
  // Account for control panel on the right (assume it takes 170px)
  const controlPanelWidth = 170; // Width of control panel + spacing
  
  // Check if thumbnail panel is visible
  const container = document.getElementById('container');
  const isThumbnailPanelVisible = container && container.classList ? container.classList.contains('with-thumbnails') : false;
  
  // If the panel is visible, it shifts the container, but doesn't
  // actually reduce the available width since the container has transformed
  
  // Calculate effective canvas width accounting for control panel
  const effectiveWidth = canvasWidth - controlPanelWidth;
  
  // Calculate available space (subtract 10% padding from each side)
  const paddingFactor = 0.1; // 10% padding
  const availableWidth = effectiveWidth * (1 - paddingFactor * 2);
  const availableHeight = canvasHeight * (1 - paddingFactor * 2);
  
  // Determine image dimensions considering rotation
  let imageWidth = image.width;
  let imageHeight = image.height;
  
  // If rotated by 90 or 270 degrees, swap dimensions
  if (rotation === 90 || rotation === 270) {
    imageWidth = image.height;
    imageHeight = image.width;
  }
  
  // Calculate zoom to fit image in available space
  const hZoom = availableWidth / imageWidth;
  const vZoom = availableHeight / imageHeight;
  const zoom = Math.min(hZoom, vZoom);
  
  // Calculate centered position with padding
  // Start with padding for left side, don't account for control panel here
  const xPadding = canvasWidth * paddingFactor;
  const yPadding = canvasHeight * paddingFactor;
  
  // Center the image in the available space (considering the control panel)
  const offsetX = xPadding + (availableWidth - (imageWidth * zoom)) / 2;
  const offsetY = yPadding + (availableHeight - (imageHeight * zoom)) / 2;
  
  return { 
    zoom, 
    offset: { 
      x: offsetX, 
      y: offsetY 
    } 
  };
}

export function refreshCanvas() {
  const { image, grid, rotation } = getState();
  let { zoom: currentZoom, offset: currentOffset } = getState();

  const canvas = getCanvas();
  const ctx = getContext();

  if (!canvas || !ctx) return;

  // For new images, fit and center with padding
  if (image && image !== lastRenderedImage) {
    console.log('New image detected, fitting with padding');
    
    // Calculate fit parameters
    const { zoom, offset } = fitImageWithPadding();
    
    lastRenderedImage = image;
    
    // Update local variables for current draw
    currentZoom = zoom;
    currentOffset = offset;
    
    // Update state
    setState({ 
      zoom: currentZoom, 
      offset: currentOffset,
    });
  }
  
  // Clear canvas and draw image
  clearCanvas('#222');

  if (image) {
    ctx.save();
    
    // During panel transitions, maintain exact same position and scale
    // to prevent the image from jumping or resizing
    if (!inPanelTransition) {
      ctx.translate(currentOffset.x, currentOffset.y);
      ctx.scale(currentZoom, currentZoom);
    } else {
      // Just use the stored values during transition, no adjustments
      ctx.translate(currentOffset.x, currentOffset.y);
      ctx.scale(currentZoom, currentZoom);
    }
    
    // Apply rotation if needed
    if (rotation !== 0) {
      // Move to center of the image for rotation
      const imgCenterX = image.width / 2;
      const imgCenterY = image.height / 2;
      
      ctx.translate(imgCenterX, imgCenterY);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.translate(-imgCenterX, -imgCenterY);
    }
    
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

// Schedule redraws to prevent multiple rapid refreshes
let redrawScheduled = false;
export function scheduleRedraw() {
  if (redrawScheduled) return;
  redrawScheduled = true;
  requestAnimationFrame(() => {
    refreshCanvas();
    redrawScheduled = false;
  });
}

// Alias for compatibility
export const renderImage = refreshCanvas;

// Listen for state changes
window.addEventListener('state:changed', (e) => {
  if (e.detail.hasOwnProperty('image') || 
      e.detail.hasOwnProperty('grid') || 
      e.detail.hasOwnProperty('zoom') || 
      e.detail.hasOwnProperty('offset') ||
      e.detail.hasOwnProperty('rotation')) {
    scheduleRedraw();
  }
}); 