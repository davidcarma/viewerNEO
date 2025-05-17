import { getContext, getCanvas, getDpr } from '../../ui/canvas/canvasContext.js';
import { getState } from '../../core/state.js';

export function drawGrid() {
  const { grid, zoom, offset, image } = getState();
  
  if (!grid.show || !image) return;

  // Use main canvas context for direct drawing
  const dpr = window.devicePixelRatio || 1;
  const ctx = getContext();

  // Start with a clean state
  ctx.save();
  
  // Set general grid styles
  ctx.strokeStyle = grid.color;
  ctx.globalAlpha = grid.opacity;
  ctx.setLineDash(grid.lineStyle === 'dashed' ? [4, 4] : []);
  
  // Grid cell size in logical pixels
  const cellSize = grid.size;
  
  // Canvas dimensions in CSS pixels
  const canvasEl = getCanvas();
  const canvasWidth = canvasEl.width / dpr;
  const canvasHeight = canvasEl.height / dpr;
  
  // Debugging
  console.log('Drawing grid with size:', grid.size, typeof grid.size);
  
  if (grid.fixed) {
    // "Fixed" grid: Scales with zoom, but does NOT pan with the image.
    // Acts like a ruler fixed to the viewport, but whose markings scale with zoom.
    ctx.lineWidth = 1;
    
    const actualCellSizeOnScreen = cellSize * zoom;
    console.log('[Fixed Viewport Grid] original cellSize:', cellSize, 'zoom:', zoom, 'actualCellSizeOnScreen:', actualCellSizeOnScreen);
    
    const startX = 0; // Does not pan with image offset.x
    const startY = 0; // Does not pan with image offset.y
    
    // Draw vertical lines
    for (let x = startX; x < canvasWidth; x += actualCellSizeOnScreen) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvasHeight);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = startY; y < canvasHeight; y += actualCellSizeOnScreen) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvasWidth, y + 0.5);
      ctx.stroke();
    }
  } else {
    // Image-aligned grid - scrolls and scales with image
    ctx.lineWidth = 1;
    const cellSizeScaled = cellSize * zoom; // This is correct for image-aligned
    console.log('[Image-Aligned Grid] Using cellSize:', cellSize, 'zoom:', zoom, 'Resulting cellSizeScaled:', cellSizeScaled);
    
    const xOffset = (offset.x % cellSizeScaled);
    const yOffset = (offset.y % cellSizeScaled);
    
    // Draw vertical lines
    for (let x = xOffset; x < canvasWidth; x += cellSizeScaled) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvasHeight);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = yOffset; y < canvasHeight; y += cellSizeScaled) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvasWidth, y + 0.5);
      ctx.stroke();
    }
  }
  
  ctx.restore();
}

// Hook events so grid redraws when things change
export function initGridDraw() {
  window.addEventListener('canvas:resized', drawGrid);
  window.addEventListener('state:changed', (e) => {
    // Only redraw if grid-related state changed
    const relevantProps = ['grid', 'zoom', 'offset', 'image'];
    const changedStateKeys = Object.keys(e.detail);
    const shouldRedraw = relevantProps.some(prop => changedStateKeys.includes(prop));
    if (shouldRedraw) drawGrid();
  });
} 