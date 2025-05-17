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
  console.log(`Processing ${files.length} dropped files`);
  
  // More robust image filtering with detailed logging
  const images = [];
  const skipped = [];
  
  for (const file of files) {
    if (isImageFile(file)) {
      images.push(file);
    } else {
      skipped.push(file.name);
    }
  }
  
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} non-image files:`, 
      skipped.length <= 5 ? skipped.join(', ') : 
      `${skipped.slice(0, 5).join(', ')} and ${skipped.length - 5} more`);
  }
  
  if (!images.length) {
    console.log('No valid image files found to load');
    return;
  }
  
  console.log(`Found ${images.length} valid image files to load`);
  
  const currentState = getState();
  const combined = [...currentState.imageFiles, ...images];
  console.log('Files after adding new ones:', combined.map(f=>f.name).slice(0, 10), 
    combined.length > 10 ? `(and ${combined.length - 10} more)` : '');
  
  // Calculate the index of the first new image in the combined array
  const newImageIndex = currentState.imageFiles.length;
  
  // Always show the first newly dropped image
  const targetIndex = images.length > 0 ? newImageIndex : currentState.selectedImageIndex;
  
  // Show loading indicator
  const loadingIndicator = document.querySelector('.loading');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
    // Add text content to show what's happening
    loadingIndicator.textContent = `Loading ${images.length} image${images.length > 1 ? 's' : ''}...`;
  }
  
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
    if (loadingIndicator) {
      loadingIndicator.textContent = 'Loading...'; // Reset to default text
      loadingIndicator.style.display = 'none';
    }
  }
} 