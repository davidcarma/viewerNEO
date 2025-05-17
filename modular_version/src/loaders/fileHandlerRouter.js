import { loadImageFile } from './imageLoader.js';
import { setState, getState } from '../core/state.js';
import { renderImage } from '../ui/canvas/renderImage.js';

// Enhanced image file detection
function isImageFile(file) {
  // Check by MIME type first (most reliable)
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  
  // Check by file extension as fallback
  const filename = file.name.toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff', '.svg'];
  return validExtensions.some(ext => filename.endsWith(ext));
}

export async function handleIncomingFiles(files) {
  // Filter for valid image files
  const images = [];
  for (const file of files) {
    if (isImageFile(file)) {
      images.push(file);
    }
  }
  
  if (!images.length) {
    console.log('No valid image files found to load');
    return;
  }
  
  // Sort images alphabetically by name
  images.sort((a, b) => a.name.localeCompare(b.name));
  
  // Combine with existing files
  const currentState = getState();
  const combined = [...currentState.imageFiles, ...images];
  
  // Calculate the index of the first new image
  const newImageIndex = currentState.imageFiles.length;
  const targetIndex = images.length > 0 ? newImageIndex : currentState.selectedImageIndex;
  
  // Show loading indicator
  const loadingIndicator = document.querySelector('.loading');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
    loadingIndicator.textContent = `Loading ${images.length} image${images.length > 1 ? 's' : ''}...`;
  }
  
  try {
    // Load the image first before updating state
    const { image, imageData } = await loadImageFile(combined[targetIndex]);
    
    // Update state with the files and loaded image
    setState({ 
      imageFiles: combined,
      image, 
      imageData, 
      selectedImageIndex: targetIndex 
    });
    
    // Render the image on canvas
    renderImage();
    
    // Force a second render to ensure image is visible
    setTimeout(() => {
      renderImage();
      
      // Now update thumbnails with a delay to ensure image is fully rendered
      setTimeout(async () => {
        const { updateThumbnails } = await import('../ui/panels/thumbnailPanel.js');
        updateThumbnails();
      }, 200);
    }, 100);
    
  } catch (err) {
    console.error('Error loading image:', err);
    setState({ imageFiles: combined });
  } finally {
    // Hide loading indicator
    if (loadingIndicator) {
      loadingIndicator.textContent = 'Loading...';
      loadingIndicator.style.display = 'none';
    }
  }
} 