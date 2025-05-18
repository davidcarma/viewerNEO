import { loadImageFile } from './imageLoader.js';
import { setState, getState, getGlobalIndex } from '../core/state.js';
import { renderImage } from '../ui/canvas/renderImage.js';
import { saveCurrentImage } from '../services/db/currentImageStore.js';
import { saveAllImagesToDb } from '../services/db/imageStore.js';

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

/**
 * Natural sort comparison function for filenames
 * Correctly handles numerical parts in filenames (e.g., "file1.jpg" comes before "file10.jpg")
 */
function naturalSortCompare(a, b) {
  const aParts = a.name.replace(/(\d+)/g, (match, number) => {
    // Pad the number with leading zeros
    return String(number).padStart(10, '0');
  });
  const bParts = b.name.replace(/(\d+)/g, (match, number) => {
    return String(number).padStart(10, '0');
  });
  
  return aParts.localeCompare(bParts);
}

/**
 * Create a unique batch ID
 */
function createBatchId() {
  return 'batch_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

/**
 * Generate a batch title based on batch count
 */
function generateBatchTitle(files, currentState) {
  // Get the next batch number
  const batchCount = currentState.batches.length + 1;
  // Format with leading zeros (001, 002, etc.)
  const batchNumber = String(batchCount).padStart(3, '0');
  
  if (files.length === 1) {
    return `Batch ${batchNumber} (${files[0].name})`;
  }
  
  return `Batch ${batchNumber} (${files.length} files)`;
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
  
  // Debug logging for large batches
  console.log(`Processing ${images.length} valid images from ${files.length} files`);
  
  // Sort images using natural sort by name
  images.sort(naturalSortCompare);
  
  // Debug - log some sample filenames after sorting
  if (images.length > 10) {
    console.log('Sample sorted filenames:', 
      images.slice(0, 5).map(f => f.name).join(', ') + '... ' + 
      images.slice(-5).map(f => f.name).join(', ')
    );
  }
  
  // Show loading indicator
  const loadingIndicator = document.querySelector('.loading');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
    loadingIndicator.textContent = `Loading ${images.length} image${images.length > 1 ? 's' : ''}...`;
  }
  
  try {
    // Get current state
    const currentState = getState();
    
    // Create a new batch for these images
    const newBatch = {
      id: createBatchId(),
      title: generateBatchTitle(images, currentState),
      expanded: true, // New batches are expanded by default
      files: images
    };
    
    // Add the new batch to our existing batches
    const newBatches = [...currentState.batches, newBatch];
    
    // Calculate indices for the first image in the new batch
    const newBatchIndex = newBatches.length - 1;
    const newFileIndex = 0;
    
    // Load the first image from the new batch
    const targetFile = newBatch.files[newFileIndex];
    
    console.log('Loading initial image from batch:', targetFile.name);
    const { image, imageData } = await loadImageFile(targetFile);
    
    console.log('Image loaded successfully:', {
      width: image.naturalWidth,
      height: image.naturalHeight,
      hasImageData: !!imageData
    });
    
    // Update state with the new batch and loaded image
    setState({ 
      batches: newBatches,
      image, 
      imageData, 
      selectedImageIndex: { batchIndex: newBatchIndex, fileIndex: newFileIndex }
    });
    
    // Save the current image to IndexedDB for cross-page access
    try {
      console.log('Saving current image to IndexedDB for cross-page access');
      
      await saveCurrentImage(image, imageData, {
        selectedFile: targetFile,
        rotation: currentState.rotation
      });
      
      console.log('Current image successfully saved to IndexedDB');
    } catch (dbError) {
      console.error('Failed to save current image to IndexedDB:', dbError);
      // Continue even if DB save fails - won't block the main functionality
    }
    
    // Save all images in the batch to IndexedDB
    try {
      console.log('Saving all batch images to IndexedDB in background...');
      
      // Prepare image objects array for batch saving
      const imageObjects = images.map(file => ({
        file,
        metadata: {
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
          batchId: newBatch.id
        }
      }));
      
      // Start saving in background
      saveAllImagesToDb(imageObjects).then(savedIds => {
        console.log(`Successfully saved ${savedIds.length} of ${images.length} images to IndexedDB`);
      }).catch(error => {
        console.error('Error during batch save to IndexedDB:', error);
      });
      
    } catch (batchError) {
      console.error('Failed to start batch save to IndexedDB:', batchError);
      // Continue even if batch save fails
    }
    
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
  } finally {
    // Hide loading indicator
    if (loadingIndicator) {
      loadingIndicator.textContent = 'Loading...';
      loadingIndicator.style.display = 'none';
    }
  }
} 