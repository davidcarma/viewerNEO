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
  
  // Calculate the index of the first new image in the combined array
  const newImageIndex = currentState.imageFiles.length;
  
  // Always show the first newly dropped image
  const targetIndex = images.length > 0 ? newImageIndex : currentState.selectedImageIndex;
  
  // Show loading indicator
  const loadingIndicator = document.querySelector('.loading');
  if (loadingIndicator) loadingIndicator.style.display = 'flex';
  
  try {
    // Load the image first before updating state
    // This prevents race conditions with thumbnails panel transitions
    console.log(`Loading image at index ${targetIndex} (${combined[targetIndex].name})`);
    const { image, imageData } = await loadImageFile(combined[targetIndex]);
    
    // Now update state with both files and loaded image
    setState({ 
      imageFiles: combined,
      image, 
      imageData, 
      selectedImageIndex: targetIndex 
    });
    
    // Render the image on canvas immediately
    renderImage();
    
    // Now that image is loaded and rendered, update thumbnails
    const { updateThumbnails } = await import('../ui/panels/thumbnailPanel.js');
    
    // Delay thumbnail panel update slightly to avoid rendering race conditions
    setTimeout(() => {
      updateThumbnails();
      console.log('Rendering', combined.length, 'thumbnails');
    }, 50);
    
  } catch (err) {
    console.error('Error loading image:', err);
    // Still update the file list even if the image load failed
    setState({ imageFiles: combined });
  } finally {
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
} 