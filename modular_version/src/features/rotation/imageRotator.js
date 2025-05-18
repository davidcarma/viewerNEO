/**
 * Physically rotate an image 90 degrees clockwise or counterclockwise
 * Returns a rotated image and its corresponding image data
 */
export function rotateImageData(image, direction = 'right') {
  // Create an offscreen canvas
  const canvas = document.createElement('canvas');
  
  // Set dimensions for the rotated image (swapped)
  const width = image.height;
  const height = image.width;
  
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  ctx.save();
  
  // Move to the center of canvas
  ctx.translate(width / 2, height / 2);
  
  // Rotate 90 degrees in the appropriate direction
  if (direction === 'left') {
    ctx.rotate(-Math.PI / 2); // 90 degrees counterclockwise
  } else {
    ctx.rotate(Math.PI / 2); // 90 degrees clockwise
  }
  
  // Draw the image with the center as origin
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  
  ctx.restore();
  
  // Get the rotated image data
  const imageData = ctx.getImageData(0, 0, width, height);
  
  // Create a new image from the canvas
  return new Promise((resolve) => {
    const rotatedImage = new Image();
    rotatedImage.onload = () => {
      resolve({ image: rotatedImage, imageData });
    };
    rotatedImage.src = canvas.toDataURL('image/png');
  });
}

/**
 * Create a rotated file object from the original file
 * This is necessary to update thumbnails and maintain file references
 */
export async function createRotatedFile(originalFile, direction = 'right') {
  // Create an image from the file
  const img = await createImageFromFile(originalFile);
  
  // Rotate the image
  const { image } = await rotateImageData(img, direction);
  
  // Convert the rotated image to a Blob
  const blob = await imageToBlob(image);
  
  // Create a new File object with the same name and type
  const rotatedFile = new File([blob], originalFile.name, { type: originalFile.type });
  
  return rotatedFile;
}

/**
 * Helper: Create an Image from a File object
 */
function createImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Helper: Convert an Image to a Blob
 */
function imageToBlob(image) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    canvas.toBlob(blob => {
      resolve(blob);
    }, 'image/png');
  });
} 