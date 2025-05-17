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
    // Fixed grid - unaffected by zoom/pan
    ctx.lineWidth = 1;
    
    // Ensure we use exact logical pixels for fixed grid
    const fixedCellSize = cellSize;
    
    // Calculate where to start drawing the grid
    const startX = 0;
    const startY = 0;
    
    // Draw vertical lines
    for (let x = startX; x < canvasWidth; x += fixedCellSize) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvasHeight);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = startY; y < canvasHeight; y += fixedCellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvasWidth, y + 0.5);
      ctx.stroke();
    }
  } else {
    // Image-aligned grid - scrolls with image
    
    // Account for image position and zoom
    // First, determine the grid cell size in screen pixels
    const cellSizeScaled = cellSize * zoom;
    
    // Calculate where the grid lines should start
    // Need to align with image origin (0,0) after applying offset
    const xOffset = (offset.x % cellSizeScaled);
    const yOffset = (offset.y % cellSizeScaled);
    
    // Draw vertical lines
    ctx.lineWidth = 1;
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