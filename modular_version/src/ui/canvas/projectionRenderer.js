// Simplified canvas renderer for the projection page
// This avoids dependencies on DOM elements that don't exist in projection.html

/**
 * Get the canvas element
 * @returns {HTMLCanvasElement}
 */
export function getCanvas() {
  return document.getElementById('canvas');
}

/**
 * Get the 2D context of the canvas
 * @returns {CanvasRenderingContext2D}
 */
export function getContext() {
  const canvas = getCanvas();
  return canvas ? canvas.getContext('2d') : null;
}

/**
 * Clear the canvas with a specified color
 * @param {string} fill - Color to fill the canvas with
 */
export function clearCanvas(fill = '#222') {
  const canvas = getCanvas();
  const ctx = getContext();
  
  if (!canvas || !ctx) return;
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Use identity transform
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/**
 * Render an image to the canvas
 * @param {HTMLImageElement} image - The image to render
 */
export function renderImage(image) {
  const canvas = getCanvas();
  const ctx = getContext();
  
  if (!canvas || !ctx || !image) return;
  
  // Clear the canvas first
  clearCanvas('#222');
  
  // Calculate best fit for the image in the canvas
  const { zoom, offsetX, offsetY } = calculateBestFit(image, canvas);
  
  // Draw the image with the calculated parameters
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, zoom);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/**
 * Calculate the best fit for an image in the canvas with padding
 * @param {HTMLImageElement} image - The image to fit
 * @param {HTMLCanvasElement} canvas - The canvas to fit the image into
 * @returns {Object} - The zoom and offset values
 */
function calculateBestFit(image, canvas) {
  // Add padding (10% of canvas dimensions)
  const padding = 0.1;
  
  // Calculate available space
  const availableWidth = canvas.width * (1 - padding * 2);
  const availableHeight = canvas.height * (1 - padding * 2);
  
  // Calculate zoom to fit image in available space
  const hZoom = availableWidth / image.width;
  const vZoom = availableHeight / image.height;
  const zoom = Math.min(hZoom, vZoom, 1.0); // Don't zoom in beyond 100%
  
  // Calculate centered position with padding
  const offsetX = (canvas.width - (image.width * zoom)) / 2;
  const offsetY = (canvas.height - (image.height * zoom)) / 2;
  
  return { zoom, offsetX, offsetY };
}

// Export a simple version of refreshCanvas that doesn't depend on state
export function refreshCanvas(image) {
  if (image) {
    renderImage(image);
  } else {
    clearCanvas('#222');
  }
} 