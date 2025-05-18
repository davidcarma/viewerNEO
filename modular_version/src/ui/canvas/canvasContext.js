// Canvas utility for projection page (hi-DPI aware)
// ---------------------------------

// Get the canvas element - using a function to allow dynamic access
export function getCanvas() {
  return document.getElementById('canvas');
}

// Get the canvas context - using a function for dynamic access
export function getContext() {
  const canvas = getCanvas();
  return canvas ? canvas.getContext('2d') : null;
}

// Get the current device pixel ratio
export function getDpr() {
  return window.devicePixelRatio || 1;
}

/**
 * Resize canvas backing store & CSS size with proper DPR scaling.
 */
export function setCanvasSize(cssWidth, cssHeight) {
  const canvas = getCanvas();
  if (!canvas) return;
  
  // Keep reference to old canvas content
  const oldCanvas = document.createElement('canvas');
  oldCanvas.width = canvas.width;
  oldCanvas.height = canvas.height;
  const oldCtx = oldCanvas.getContext('2d');
  if (oldCtx) {
    oldCtx.drawImage(canvas, 0, 0);
  }
  
  // Resize the canvas
  const currentDpr = getDpr();
  canvas.width = cssWidth * currentDpr;
  canvas.height = cssHeight * currentDpr;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  // Reset transform then scale so 1 unit in canvas == 1 CSS pixel
  const ctx = getContext();
  if (ctx) {
    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    
    // Restore previous canvas content
    ctx.drawImage(oldCanvas, 0, 0, oldCanvas.width, oldCanvas.height, 
                  0, 0, canvas.width, canvas.height);
  }

  // grid overlay canvas
  const overlay = document.getElementById('grid-overlay');
  if (overlay) {
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.width = canvas.style.width;
    overlay.style.height = canvas.style.height;
  }
}

export function clearCanvas(fill = '#222') {
  if (fill === null) return; // Skip clearing if null is passed (for animations)
  
  const canvas = getCanvas();
  const ctx = getContext();
  if (!canvas || !ctx) return;
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // work in pixel space
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
} 