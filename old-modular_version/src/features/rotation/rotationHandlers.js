import { getState, setState, getSelectedFile } from '../../core/state.js';
import { getCanvas } from '../../ui/canvas/canvasContext.js';
import { rotateImageData, createRotatedFile } from './imageRotator.js';
import { loadImageFile } from '../../loaders/imageLoader.js';
import { updateThumbnails } from '../../ui/panels/thumbnailPanel.js';
import { fitImageWithPadding } from '../../ui/canvas/renderImage.js';
import { saveCurrentImage } from '../../services/db/currentImageStore.js';

/**
 * Rotates the current image 90 degrees counterclockwise by physically 
 * rotating the image data and replacing it in the state
 */
export async function rotateLeft() {
  const { selectedImageIndex, batches } = getState();
  const { batchIndex, fileIndex } = selectedImageIndex;
  
  // Check if we have a valid selection
  if (batchIndex < 0 || fileIndex < 0 || batchIndex >= batches.length) return;
  const batch = batches[batchIndex];
  if (!batch || fileIndex >= batch.files.length) return;
  
  // Get the current file
  const currentFile = batch.files[fileIndex];
  if (!currentFile) return;
  
  try {
    // Show loading indicator
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    
    // Create a physically rotated file
    const rotatedFile = await createRotatedFile(currentFile, 'left');
    
    // Load the new rotated image
    const { image, imageData } = await loadImageFile(rotatedFile);
    
    // Update the file in the batch
    const updatedBatches = [...batches];
    updatedBatches[batchIndex].files[fileIndex] = rotatedFile;
    
    // First update the image and reset rotation
    setState({ 
      batches: updatedBatches,
      image,
      imageData,
      rotation: 0 // Reset rotation state since the image is physically rotated
    });
    
    // Then calculate fit parameters
    const { zoom, offset } = fitImageWithPadding();
    
    // Update zoom and offset to fit the image
    setState({ zoom, offset });
    
    // Update thumbnails to reflect the new image
    updateThumbnails();
    
    // Save the rotated image to IndexedDB for cross-page access
    try {
      await saveCurrentImage(image, imageData, {
        selectedFile: rotatedFile,
        rotation: 0 // Image is physically rotated, so rotation state is 0
      });
      console.log('Rotated image saved to IndexedDB for cross-page access');
    } catch (dbError) {
      console.error('Failed to save rotated image to IndexedDB:', dbError);
      // Continue even if DB save fails - won't block the main functionality
    }
    
    // Hide loading indicator
    if (loadingEl) loadingEl.style.display = 'none';
  } catch (error) {
    console.error('Error rotating image:', error);
    
    // Hide loading indicator if there was an error
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * Rotates the current image 90 degrees clockwise by physically 
 * rotating the image data and replacing it in the state
 */
export async function rotateRight() {
  const { selectedImageIndex, batches } = getState();
  const { batchIndex, fileIndex } = selectedImageIndex;
  
  // Check if we have a valid selection
  if (batchIndex < 0 || fileIndex < 0 || batchIndex >= batches.length) return;
  const batch = batches[batchIndex];
  if (!batch || fileIndex >= batch.files.length) return;
  
  // Get the current file
  const currentFile = batch.files[fileIndex];
  if (!currentFile) return;
  
  try {
    // Show loading indicator
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    
    // Create a physically rotated file
    const rotatedFile = await createRotatedFile(currentFile, 'right');
    
    // Load the new rotated image
    const { image, imageData } = await loadImageFile(rotatedFile);
    
    // Update the file in the batch
    const updatedBatches = [...batches];
    updatedBatches[batchIndex].files[fileIndex] = rotatedFile;
    
    // First update the image and reset rotation
    setState({ 
      batches: updatedBatches,
      image,
      imageData,
      rotation: 0 // Reset rotation state since the image is physically rotated
    });
    
    // Then calculate fit parameters
    const { zoom, offset } = fitImageWithPadding();
    
    // Update zoom and offset to fit the image
    setState({ zoom, offset });
    
    // Update thumbnails to reflect the new image
    updateThumbnails();
    
    // Save the rotated image to IndexedDB for cross-page access
    try {
      await saveCurrentImage(image, imageData, {
        selectedFile: rotatedFile,
        rotation: 0 // Image is physically rotated, so rotation state is 0
      });
      console.log('Rotated image saved to IndexedDB for cross-page access');
    } catch (dbError) {
      console.error('Failed to save rotated image to IndexedDB:', dbError);
      // Continue even if DB save fails - won't block the main functionality
    }
    
    // Hide loading indicator
    if (loadingEl) loadingEl.style.display = 'none';
  } catch (error) {
    console.error('Error rotating image:', error);
    
    // Hide loading indicator if there was an error
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * Initialize rotation controls
 */
export function initImageRotation() {
  const rotateLeftBtn = document.getElementById('rotate-left-btn');
  const rotateRightBtn = document.getElementById('rotate-right-btn');
  
  if (rotateLeftBtn) {
    rotateLeftBtn.addEventListener('click', rotateLeft);
  }
  
  if (rotateRightBtn) {
    rotateRightBtn.addEventListener('click', rotateRight);
  }
} 