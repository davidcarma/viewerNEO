import { loadImageFile } from './imageLoader.js';
import { setState, getState } from '../core/state.js';
import { renderImage } from '../ui/canvas/renderImage.js';

export async function handleIncomingFiles(files) {
  // Filter image types
  const images = files.filter(f => f.type.startsWith('image/') || /\.tiff?$/.test(f.name.toLowerCase()));
  if (!images.length) return;

  const currentState = getState();
  const combined = [...currentState.imageFiles, ...images];
  console.log('Files after drop:', combined.map(f=>f.name));
  setState({ imageFiles: combined });

  // load first new image if none selected
  const targetIndex = combined.length === images.length ? 0 : currentState.selectedImageIndex;
  if (targetIndex === -1) {
    await selectAndDisplay(0, combined);
  } else {
    await selectAndDisplay(targetIndex, combined);
  }

  import('../ui/panels/thumbnailPanel.js').then(({ updateThumbnails }) => {
    updateThumbnails();
    console.log('Rendering', currentState.imageFiles.length, 'thumbnails');
  });

  async function selectAndDisplay(index, list) {
    const { image, imageData } = await loadImageFile(list[index]);
    setState({ image, imageData, selectedImageIndex: index });
    renderImage();
  }
} 