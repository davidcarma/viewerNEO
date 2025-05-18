import { State, setState } from './state.js';
import { initResizeCanvas } from '../ui/canvas/resizeCanvas.js';
import { initGridFeature } from '../features/grid/toggleGrid.js';
import { initGridControls } from '../features/grid/bindGridControls.js';
import { initDragDrop } from '../loaders/dragDrop.js';
import { handleIncomingFiles } from '../loaders/fileHandlerRouter.js';
import { initZoom } from '../features/zoom-pan/zoomHandlers.js';
import { initPan } from '../features/zoom-pan/panHandlers.js';
import { updateInfo } from '../ui/controls/infoPanel.js';
import { initClipboardPaste } from '../features/clipboard/clipboardPaste.js';
import { initImageRotation } from '../features/rotation/rotationHandlers.js';
import { getCurrentImage, createImageFromRecord } from '../services/db/currentImageStore.js';
import { renderImage } from '../ui/canvas/renderImage.js';
import { clearImageDatabase, getAllImagesMetadata } from '../services/db/imageStore.js';
import { clearCanvas } from '../ui/canvas/canvasContext.js';

// Basic Phase-1 bootstrap
console.log('%cViewer bootstrap (Phase 1)', 'color:#00c8ff;font-weight:bold');

async function start() {
  console.log('App started. Current state:', State);

  // Example global listener to prove events flow
  window.addEventListener('state:changed', (e) => {
    console.log('State changed →', e.detail);
  });

  // Example usage: keep track of window size
  window.addEventListener('resize', () => {
    console.log('Window resized to', window.innerWidth, 'x', window.innerHeight);
  });

  // Phase 2: initialise Hi-DPI canvas handling
  initResizeCanvas();

  // Phase 3: grid overlay
  initGridFeature();
  initGridControls();

  // Phase 4: file input & drag-drop
  const fileInput = document.getElementById('file-input');
  const loadBtn = document.getElementById('load-btn');
  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleIncomingFiles(Array.from(e.target.files)));

  initDragDrop();

  // Phase 5: zoom + pan
  initZoom();
  initPan();

  // Initialize image rotation
  initImageRotation();

  // Clipboard paste
  initClipboardPaste();

  // pointer coordinates
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('mousemove', (e) => {
    const { image, zoom, offset } = State;
    if (!image) return;
    const rect = canvas.getBoundingClientRect();
    const xScreen = e.clientX - rect.left;
    const yScreen = e.clientY - rect.top;
    const imgX = Math.floor((xScreen - offset.x) / zoom);
    const imgY = Math.floor((yScreen - offset.y) / zoom);
    updateInfo({ pointer: { x: imgX, y: imgY } });
  });
  
  // Set up clear DB button
  const clearDbBtn = document.getElementById('clear-db-btn');
  if (clearDbBtn) {
    clearDbBtn.addEventListener('click', clearDatabase);
  }
  
  // Set up projection page button (already implemented with <a> tag)
  
  // Check if we're coming back from another page and need to restore image state
  await restoreImagesFromDb();
}

/**
 * Clear all images from IndexedDB
 */
async function clearDatabase() {
  console.log('Clearing image database...');
  
  // Show loading indicator
  const loadingIndicator = document.querySelector('.loading');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
    loadingIndicator.textContent = 'Clearing database...';
  }
  
  try {
    // Confirm with user before proceeding
    if (!confirm('Are you sure you want to clear all images from the database?')) {
      console.log('Database clear operation cancelled by user');
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      return;
    }
    
    // Clear the database
    await clearImageDatabase();
    
    // Also clear the current image and state
    setState({
      image: null,
      imageData: null,
      batches: [],
      selectedImageIndex: { batchIndex: -1, fileIndex: -1 }
    });
    
    // Clear the canvas
    clearCanvas('#222');
    
    // Show success message
    alert('Image database cleared successfully');
    
  } catch (error) {
    console.error('Error clearing database:', error);
    alert('Error clearing database: ' + error.message);
  } finally {
    // Hide loading indicator
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
}

/**
 * Restore images from IndexedDB to provide a seamless experience
 */
async function restoreImagesFromDb() {
  console.log('Checking for saved images in IndexedDB...');
  
  // Only restore if we don't already have an image loaded
  if (State.image) {
    console.log('Images already loaded, skipping restore from IndexedDB');
    return;
  }
  
  try {
    // Show loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
      loadingIndicator.textContent = 'Restoring images...';
    }
    
    // Try to get all available image metadata from DB
    const allImageMetadata = await getAllImagesMetadata();
    
    // If no images found, just return
    if (!allImageMetadata || allImageMetadata.length === 0) {
      console.log('No images found in IndexedDB to restore');
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      return;
    }
    
    console.log(`Found ${allImageMetadata.length} images in IndexedDB`);
    
    // Group images by batchId
    const batchMap = new Map();
    
    allImageMetadata.forEach(metadata => {
      const batchId = metadata.batchId || 'default';
      
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, []);
      }
      
      batchMap.get(batchId).push(metadata);
    });
    
    console.log(`Grouped into ${batchMap.size} batches`);
    
    // Now create the batches structure
    const batches = [];
    let selectedBatchIndex = 0;
    let selectedFileIndex = 0;
    let currentImage = null;
    let currentImageData = null;
    
    // Process each batch
    for (const [batchId, imagesList] of batchMap.entries()) {
      // Sort images by timestamp
      imagesList.sort((a, b) => a.timestamp - b.timestamp);
      
      // Create File objects for each image
      const files = imagesList.map(metadata => {
        if (metadata.imageBlob) {
          return new File(
            [metadata.imageBlob],
            metadata.filename || 'image.png',
            { type: metadata.fileType || 'image/png' }
          );
        }
        return null;
      }).filter(file => file !== null);
      
      if (files.length > 0) {
        // Create batch with original ID or a new one if default
        const batch = {
          id: batchId === 'default' ? ('batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)) : batchId,
          title: `Batch ${batches.length + 1} (${files.length} files)`,
          expanded: true,
          files
        };
        
        batches.push(batch);
        
        // If this batch has the current image, note its position
        const currentImageIndex = imagesList.findIndex(img => img.isCurrent);
        if (currentImageIndex >= 0 && files[currentImageIndex]) {
          selectedBatchIndex = batches.length - 1;
          selectedFileIndex = currentImageIndex;
          
          // Get the current image for display
          try {
            const { getCurrentImage, createImageFromRecord } = await import('../services/db/currentImageStore.js');
            const currentImageRecord = await getCurrentImage();
            if (currentImageRecord && currentImageRecord.imageBlob) {
              currentImage = await createImageFromRecord(currentImageRecord);
              // For simplicity, we're not populating imageData here
            }
          } catch (err) {
            console.error('Error loading current image:', err);
          }
        }
      }
    }
    
    // If we have batches but no current image selected, select the first image
    if (batches.length > 0 && !currentImage && batches[0].files.length > 0) {
      try {
        const { loadImageFile } = await import('../loaders/imageLoader.js');
        const { image, imageData } = await loadImageFile(batches[0].files[0]);
        currentImage = image;
        currentImageData = imageData;
        selectedBatchIndex = 0;
        selectedFileIndex = 0;
      } catch (err) {
        console.error('Error loading first image:', err);
      }
    }
    
    // Update state with restored batches and selected image
    if (batches.length > 0) {
      setState({
        batches,
        image: currentImage,
        imageData: currentImageData,
        selectedImageIndex: { 
          batchIndex: selectedBatchIndex, 
          fileIndex: selectedFileIndex 
        }
      });
      
      console.log(`Restored ${batches.length} batches with ${batches.reduce((sum, batch) => sum + batch.files.length, 0)} total images`);
      
      // Render the current image
      if (currentImage) {
        renderImage();
      }
    }
    
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    // Update thumbnails with a delay
    setTimeout(async () => {
      try {
        const { updateThumbnails } = await import('../ui/panels/thumbnailPanel.js');
        updateThumbnails();
      } catch (err) {
        console.error('Error updating thumbnails:', err);
      }
    }, 200);
    
  } catch (error) {
    console.error('Error restoring images from IndexedDB:', error);
    
    // Hide loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

// Auto start on module import
start();
