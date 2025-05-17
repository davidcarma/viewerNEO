// Canvas utility (hi-DPI aware)
// ---------------------------------

const canvas = document.getElementById('canvas');
if (!canvas) {
  console.error('Canvas element #canvas not found – did HTML copy include it?');
}

const ctx = canvas.getContext('2d');
let currentDpr = window.devicePixelRatio || 1;

/**
 * Resize canvas backing store & CSS size with proper DPR scaling.
 */
export function setCanvasSize(cssWidth, cssHeight) {
  // Keep reference to old canvas content
  const oldCanvas = document.createElement('canvas');
  oldCanvas.width = canvas.width;
  oldCanvas.height = canvas.height;
  const oldCtx = oldCanvas.getContext('2d');
  oldCtx.drawImage(canvas, 0, 0);
  
  // Resize the canvas
  currentDpr = window.devicePixelRatio || 1;
  canvas.width = cssWidth * currentDpr;
  canvas.height = cssHeight * currentDpr;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  // Reset transform then scale so 1 unit in canvas == 1 CSS pixel.
  ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
  
  // Restore previous canvas content
  ctx.drawImage(oldCanvas, 0, 0, oldCanvas.width, oldCanvas.height, 
                0, 0, canvas.width, canvas.height);

  // grid overlay canvas
  const overlay = document.getElementById('grid-overlay');
  if (overlay) {
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.width = canvas.style.width;
    overlay.style.height = canvas.style.height;
  }
}

export const getCanvas = () => canvas;
export const getContext = () => ctx;
export const getDpr = () => currentDpr;

export function clearCanvas(fill = '#222') {
  if (fill === null) return; // Skip clearing if null is passed (for animations)
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // work in pixel space
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
} 