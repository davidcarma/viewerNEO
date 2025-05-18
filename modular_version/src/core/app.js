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
  
  // Set up projection button
  const projectionBtn = document.getElementById('projection-btn');
  if (projectionBtn) {
    projectionBtn.addEventListener('click', () => {
      window.location.href = 'projection.html';
    });
  }
  
  // Check if we're coming back from another page and need to restore image state
  await restoreImageFromDb();
}

/**
 * Attempt to restore the current image from IndexedDB if available
 */
async function restoreImageFromDb() {
  console.log('Checking for saved image in IndexedDB...');
  
  // Only restore if we don't already have an image loaded
  if (State.image) {
    console.log('Image already loaded, skipping restore from IndexedDB');
    return;
  }
  
  try {
    // Show loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
      loadingIndicator.textContent = 'Restoring image...';
    }
    
    // Try to get current image from DB
    const imageRecord = await getCurrentImage();
    
    if (!imageRecord || !imageRecord.imageBlob) {
      console.log('No image found in IndexedDB to restore');
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      return;
    }
    
    console.log('Found image in IndexedDB, restoring...', {
      filename: imageRecord.filename,
      dimensions: imageRecord.dimensions
    });
    
    // Create image element from the saved record
    const image = await createImageFromRecord(imageRecord);
    
    // Create a simple file-like object if the image came from a file
    let file = null;
    if (imageRecord.filename && imageRecord.fileType) {
      // Create a synthetic File object for compatibility with our app
      file = new File(
        [imageRecord.imageBlob], 
        imageRecord.filename, 
        { type: imageRecord.fileType || 'image/png' }
      );
    }
    
    // If we have a real image but no batches, create a temporary batch
    if (image && State.batches.length === 0 && file) {
      const newBatch = {
        id: 'restored_batch_' + Date.now(),
        title: `Restored (${imageRecord.filename})`,
        expanded: true,
        files: [file]
      };
      
      // Set state with the new batch and image
      setState({
        batches: [newBatch],
        image,
        selectedImageIndex: { batchIndex: 0, fileIndex: 0 },
        rotation: imageRecord.rotation || 0
      });
      
      console.log('Created temporary batch for restored image');
    } else {
      // Just restore the image without changing batches
      setState({
        image,
        rotation: imageRecord.rotation || 0
      });
      
      console.log('Restored image only, no batch updates');
    }
    
    // Render the image on the canvas
    renderImage();
    
    console.log('Image successfully restored from IndexedDB');
    
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    // Force a second render to ensure everything is visible
    setTimeout(() => {
      renderImage();
      
      // Update thumbnails with a delay if needed
      setTimeout(async () => {
        try {
          const { updateThumbnails } = await import('../ui/panels/thumbnailPanel.js');
          updateThumbnails();
        } catch (err) {
          console.error('Error updating thumbnails:', err);
        }
      }, 200);
    }, 100);
    
  } catch (error) {
    console.error('Error restoring image from IndexedDB:', error);
    
    // Hide loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

// Auto start on module import
start();
