// Note: lib/tiff.js is loaded via <script> in index.html and exposes global `Tiff`.

export async function loadTiff(file) {
  const { Tiff } = window;
  if (!Tiff) throw new Error('TIFF.js library not found');

  const buffer = await file.arrayBuffer();
  const tiff = await Tiff.initialize({ locateFile: () => 'lib/tiff.wasm' });
  const tiffData = tiff.readFromBuffer(new Uint8Array(buffer));

  const width = tiffData.getWidth();
  const height = tiffData.getHeight();

  // RGBA data
  const rgba = tiffData.readRGBAImage();
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);

  // Create canvas to turn into Image for drawing
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);

  const img = new Image();
  img.src = canvas.toDataURL();
  await img.decode();

  tiff.destroy();
  return { image: img, imageData };
} 