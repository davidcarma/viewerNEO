import { loadTiff } from './tiffLoader.js';

export async function loadImageFile(file) {
  const isTiff = /\.tiff?$/.test(file.name.toLowerCase());
  if (isTiff) {
    return loadTiff(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Draw to offscreen canvas to get ImageData
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      resolve({ image: img, imageData });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
} 