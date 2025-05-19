import { getState, setState, getAllFiles, getGlobalIndex, getBatchFileIndex, getSelectedFile } from '../../core/state.js';
import { loadImageFile } from '../../loaders/imageLoader.js';
import { refreshCanvas, scheduleRedraw, setPanelTransitionState, fitImageWithPadding } from '../canvas/renderImage.js';
import { setCanvasSize, getCanvas, clearCanvas } from '../canvas/canvasContext.js';

const container = document.getElementById('thumbnails-container');
const panelWrapper = document.getElementById('thumbnail-panel');
if (!container) console.warn('No thumbnails-container in HTML');

const closeBtn = document.getElementById('close-thumbnails');
const toggleHandle = document.getElementById('thumbnail-toggle-handle');

// Track panel state to avoid transition issues
let isPanelTransitioning = false;
let pendingRedraw = false;

// Ensure toggle handle has pointer cursor and is properly set up
if (toggleHandle) {
  // Initialize at left edge when not active
  if (!panelWrapper.classList.contains('active')) {
    toggleHandle.style.left = '0px';
    toggleHandle.setAttribute('title', 'Show thumbnails');
    toggleHandle.setAttribute('aria-label', 'Show thumbnail panel');
  } else {
    // If panel is active, position the handle at panel edge
    toggleHandle.style.left = panelWrapper.offsetWidth + 'px';
    toggleHandle.classList.add('resize');
    toggleHandle.setAttribute('title', 'Resize panel');
    toggleHandle.setAttribute('aria-label', 'Resize thumbnail panel');
  }
  
  // Ensure the handle is always visible
  toggleHandle.style.display = 'flex';
}

/**
 * Create a batch header element
 */
function createBatchHeader(batch, batchIndex) {
  const header = document.createElement('div');
  header.className = 'batch-header';
  header.dataset.batchId = batch.id;
  header.dataset.batchIndex = batchIndex;
  
  if (!batch.expanded) {
    header.classList.add('collapsed');
  }
  
  // Create title span - showing just batch number to save space
  const title = document.createElement('span');
  title.className = 'batch-title';
  
  // Extract just the batch number part (e.g., "Batch 001")
  const batchNumberMatch = batch.title.match(/^(Batch \d+)/);
  const batchNumber = batchNumberMatch ? batchNumberMatch[1] : batch.title;
  
  // Set the shortened title to display
  title.textContent = batchNumber;
  
  // Set the full title as a tooltip
  title.title = batch.title;
  
  header.appendChild(title);
  
  // Create count badge
  const count = document.createElement('span');
  count.className = 'batch-count';
  count.textContent = batch.files.length;
  header.appendChild(count);
  
  // Add delete button for batch
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'batch-delete-btn';
  deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  deleteBtn.setAttribute('title', 'Delete batch');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering batch toggle
    deleteBatch(batchIndex);
  });
  header.appendChild(deleteBtn);
  
  // Create collapse indicator
  const indicator = document.createElement('span');
  indicator.className = 'collapse-indicator';
  header.appendChild(indicator);
  
  // Set up toggle functionality
  header.addEventListener('click', () => {
    toggleBatchExpansion(batchIndex);
  });
  
  return header;
}

/**
 * Create a batch content container
 */
function createBatchContent(batch, batchIndex) {
  const content = document.createElement('div');
  content.className = 'batch-content';
  content.dataset.batchId = batch.id;
  
  if (!batch.expanded) {
    content.classList.add('collapsed');
  }
  
  console.log(`Creating batch content for batch ${batchIndex} with ${batch.files.length} files`);
  
  // Create thumbnails for each file in the batch
  batch.files.forEach((file, fileIndex) => {
    const thumbnailItem = createThumbnail(file, batchIndex, fileIndex);
    content.appendChild(thumbnailItem);
  });
  
  console.log(`Finished creating batch ${batchIndex}, added ${batch.files.length} thumbnails`);
  
  return content;
}

/**
 * Toggle a batch's expanded state
 */
function toggleBatchExpansion(batchIndex) {
  const { batches } = getState();
  if (batchIndex < 0 || batchIndex >= batches.length) return;
  
  // Create a new array with the updated batch
  const updatedBatches = [...batches];
  updatedBatches[batchIndex] = {
    ...batches[batchIndex],
    expanded: !batches[batchIndex].expanded
  };
  
  // Update state
  setState({ batches: updatedBatches });
  
  // Update UI
  const header = container.querySelector(`.batch-header[data-batch-index="${batchIndex}"]`);
  const content = container.querySelector(`.batch-content[data-batch-id="${batches[batchIndex].id}"]`);
  
  if (header && content) {
    if (updatedBatches[batchIndex].expanded) {
      header.classList.remove('collapsed');
      content.classList.remove('collapsed');
    } else {
      header.classList.add('collapsed');
      content.classList.add('collapsed');
    }
  }
}

/**
 * Create a thumbnail element
 */
function createThumbnail(file, batchIndex, fileIndex) {
  const item = document.createElement('div');
  item.className = 'thumbnail-item';
  item.dataset.batchIndex = batchIndex;
  item.dataset.fileIndex = fileIndex;

  const imgEl = document.createElement('img');
  imgEl.alt = file.name;
  imgEl.loading = 'lazy'; // Add lazy loading for better performance
  item.appendChild(imgEl);

  // Add remove button (red X)
  const removeBtn = document.createElement('button');
  removeBtn.className = 'thumbnail-remove-btn';
  removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  removeBtn.setAttribute('title', 'Delete image');
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering thumbnail click
    removeImage(batchIndex, fileIndex);
  });
  item.appendChild(removeBtn);

  const label = document.createElement('div');
  label.textContent = file.name;
  item.appendChild(label);

  // Calculate the global index for z-index ordering
  const globalIndex = getGlobalIndex(batchIndex, fileIndex);
  // Make sure z-index works properly
  item.style.zIndex = (1000 - globalIndex); // Ensure thumbnails on top are given higher priority
  
  item.addEventListener('click', () => selectImage(batchIndex, fileIndex));

  // Generate preview
  if (file.type.startsWith('image/') && !/\.tiff?$/.test(file.name.toLowerCase())) {
    // Create object URL for the thumbnail and ensure it's properly stored
    const objectUrl = URL.createObjectURL(file);
    
    // Store URL for cleanup
    item.dataset.objectUrl = objectUrl;
    
    // Set image source
    imgEl.src = objectUrl;
    
    console.log(`Created thumbnail for ${file.name} (size: ${Math.round(file.size/1024)} KB)`);
  } else {
    // TIFF or other files use placeholder
    const placeholderSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxMTExMTEiLz48cGF0aCBkPSJNMzUgMjVINjVDNjguMyAyNSA3MSAyNy43IDcxIDMxVjY5QzcxIDcyLjMgNjguMyA3NSA2NSA3NUgzNUMzMS43IDc1IDI5IDcyLjMgMjkgNjlWMzFDMjkgMjcuNyAzMS43IDI1IDM1IDI1WiIgc3Ryb2tlPSIjNTU1IiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI1IiBmaWxsPSIjNTU1Ii8+PHBhdGggZD0iTTMwIDYwTDQwIDUwTDUwIDYwTDYwIDUwTDcwIDYwVjcwSDMwVjYwWiIgZmlsbD0iIzU1NSIvPjwvc3ZnPg==';
    imgEl.src = placeholderSrc;
  }

  // Highlight if active
  const { selectedImageIndex } = getState();
  if (batchIndex === selectedImageIndex.batchIndex && fileIndex === selectedImageIndex.fileIndex) {
    item.classList.add('active');
  }
  
  return item;
}

/**
 * Clean up object URLs to prevent memory leaks
 */
function cleanupObjectUrls() {
  const thumbnails = container.querySelectorAll('.thumbnail-item[data-object-url]');
  thumbnails.forEach(thumbnail => {
    const objectUrl = thumbnail.dataset.objectUrl;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      console.log('Revoked object URL:', objectUrl.substring(0, 30) + '...');
        }
  });
}

/**
 * Update the thumbnail panel with all batches and images
 */
export function updateThumbnails() {
  if (!container) return;
  
  // Clean up existing object URLs before clearing
  cleanupObjectUrls();
  
  // Clear existing content
  container.innerHTML = '';
  
  const { batches, selectedImageIndex } = getState();
  
  if (batches.length === 0) {
    // Empty state - no images
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-thumbnail-state';
    emptyState.textContent = 'No images loaded';
    container.appendChild(emptyState);
    return;
  }

  // Create elements for each batch
  batches.forEach((batch, batchIndex) => {
    // Add batch header
    const header = createBatchHeader(batch, batchIndex);
    container.appendChild(header);
    
    // Add batch content container
    const content = createBatchContent(batch, batchIndex);
    container.appendChild(content);
    
    // Add divider if not the last batch
    if (batchIndex < batches.length - 1) {
      const divider = document.createElement('div');
      divider.className = 'batch-divider';
      container.appendChild(divider);
    }
  });

  // Auto-show panel if there are images
  if (panelWrapper && batches.length > 0) {
    // Make sure the panel is visible
    panelWrapper.style.display = 'block';
    
    // If any images, show the gallery
      const wasActive = panelWrapper.classList.contains('active');
      
      // Only trigger transition if not already active
      if (!wasActive) {
        if (!isPanelTransitioning) {
          isPanelTransitioning = true;
          
          // Start panel animation - both panel and container simultaneously
          panelWrapper.classList.add('active');
          document.getElementById('container').classList.add('with-thumbnails');
          
          // Set up panel transition handler
          handlePanelTransition();
        } else {
          // Panel is already transitioning, just mark that we need a redraw when done
          pendingRedraw = true;
        }
      } else {
        // Panel already open, just highlight the selection
      highlightSelectedThumbnail(selectedImageIndex.batchIndex, selectedImageIndex.fileIndex);
    }
  }

  // Handle click toggles for the handle
  if (toggleHandle && !toggleHandle._bound) {
    toggleHandle.addEventListener('click', togglePanel);
    toggleHandle._bound = true;
  }
}

/**
 * Select an image by batch and file indices
 */
export async function selectImage(batchIndex, fileIndex, force = false) {
  const { batches, selectedImageIndex } = getState();
  
  // Skip if invalid index or already selected
  if (batchIndex < 0 || batchIndex >= batches.length) return;
  const batch = batches[batchIndex];
  if (!batch || fileIndex < 0 || fileIndex >= batch.files.length) return;
  
  // Skip if already selected and not forced
  if (!force && batchIndex === selectedImageIndex.batchIndex && fileIndex === selectedImageIndex.fileIndex) return;
  
  // Ensure batch is expanded
  if (!batch.expanded) {
    toggleBatchExpansion(batchIndex);
  }

  // Update the selected index in state - do this early
  setState({ selectedImageIndex: { batchIndex, fileIndex } });
  
  // Update visual highlight
  highlightSelectedThumbnail(batchIndex, fileIndex);
  
  // Load the new image
  const file = batch.files[fileIndex];
  console.log('Loading image:', file.name);
  
  try {
    // Load the image
    const { image, imageData } = await loadImageFile(file);
    setState({ image, imageData });
    
    // Draw it on canvas
    refreshCanvas();

    // Save to IndexedDB for cross-page access
    try {
      const { saveCurrentImage } = await import('../../services/db/currentImageStore.js');
      const currentState = getState();
      await saveCurrentImage(image, imageData, {
        selectedFile: file,
        rotation: currentState.rotation
      });
      console.log('Current image saved to IndexedDB for cross-page access');
    } catch (dbError) {
      console.error('Failed to save image to IndexedDB:', dbError);
      // Continue even if DB save fails - won't block the main functionality
    }
  } catch (err) {
    console.error('Failed to load image:', err);
  }
}

function updateCanvasSize() {
  const cont = document.getElementById('container');
  if (!cont) return;
  
  const rect = cont.getBoundingClientRect();
  setCanvasSize(rect.width, rect.height);
}

function applyLayout(active) {
  const panelW = parseInt(getComputedStyle(panelWrapper).width, 10);
  const cont = document.getElementById('container');
  
  if (active) {
    // Add a class to the container to synchronize the animation
    cont.classList.add('with-thumbnails');
    
    // Position handle at the edge of the panel
    if (toggleHandle) {
      toggleHandle.style.left = panelW + 'px';
      toggleHandle.classList.add('resize');
    }
  } else {
    // Remove the class from the container to synchronize the animation
    cont.classList.remove('with-thumbnails');
    
    // Position handle at the edge of the screen
    if (toggleHandle) {
      toggleHandle.style.left = '0px';
      toggleHandle.classList.remove('resize');
    }
  }
  
  // Don't trigger canvas resize - the image will just shift with the container
}

// Helper function to handle panel transition and ensure redraws happen in the right order
function handlePanelTransition() {
  // Tell the renderer we're in a transition - this prevents image resizing
  setPanelTransitionState(true);
  
  // Force a render immediately when transition begins
  refreshCanvas();
  
  // Set up rendering during transition - more frequent interval for smoother animation
  let transitionTimer = setInterval(() => {
    refreshCanvas();
  }, 16); // ~60fps for smoother animation
  
  // Additional forced renders to ensure the image stays visible
  for (let i = 1; i < 10; i++) {
    setTimeout(() => refreshCanvas(), i * 25);
  }

  function onTransitionEnd(e) {
    if (e.target === panelWrapper) {
      // Clear the interval
      clearInterval(transitionTimer);
      
      // Determine panel state after transition
      const isActive = panelWrapper.classList.contains('active');
      
      // Apply layout based on final state
      applyLayout(isActive);

      // Skip canvas resize - we want to maintain canvas dimensions
      // Just redraw the image at its current position
      refreshCanvas();
      
      // Do another render after a small delay
      setTimeout(() => {
        // Tell the renderer the transition is complete
        setPanelTransitionState(false);
        
        // Recenter the image with padding
        const { zoom, offset } = fitImageWithPadding();
        setState({ zoom, offset });
        
        refreshCanvas();
        
        // Panel transition is complete
        isPanelTransitioning = false;
        
        // Check if another redraw was requested during transition
        if (pendingRedraw) {
          pendingRedraw = false;
          scheduleRedraw();
        }
      }, 50);
      
      panelWrapper.removeEventListener('transitionend', onTransitionEnd);
    }
  }
  
  // Listen for transition completion
  panelWrapper.addEventListener('transitionend', onTransitionEnd);
  
  // Fallback in case transitionend doesn't fire
  setTimeout(() => {
    if (isPanelTransitioning) {
      // Clear the interval if it's still running
      clearInterval(transitionTimer);
      
      const isActive = panelWrapper.classList.contains('active');
      applyLayout(isActive);
      
      // Skip canvas resize, just redraw
      refreshCanvas();
      
      setTimeout(() => {
        // Tell the renderer the transition is complete
        setPanelTransitionState(false);
        
        // Recenter the image with padding
        const { zoom, offset } = fitImageWithPadding();
        setState({ zoom, offset });
        
        refreshCanvas();
        isPanelTransitioning = false;
        if (pendingRedraw) {
          pendingRedraw = false;
          scheduleRedraw();
        }
      }, 50);
    }
  }, 350);
}

/**
 * Highlight the selected thumbnail and ensure it's visible
 */
function highlightSelectedThumbnail(batchIndex, fileIndex) {
  if (!container) return;

  // Get all thumbnail items
  const thumbnails = container.querySelectorAll('.thumbnail-item');
  
  // Remove active class from all thumbnails
  thumbnails.forEach(item => {
    item.classList.remove('active');
  });
  
  // Find and highlight the selected thumbnail
  const selectedItem = container.querySelector(`.thumbnail-item[data-batch-index="${batchIndex}"][data-file-index="${fileIndex}"]`);
  if (selectedItem) {
    selectedItem.classList.add('active');
    
    // Ensure it's visible by scrolling to it
    setTimeout(() => {
    // Get the current positions using absolute coordinates
    const containerRect = container.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();

    const containerScrollTop = container.scrollTop;
    const containerVisibleHeight = container.clientHeight;
    
    // Calculate item's position relative to the scrollable content of the container
    const itemOffsetTop = selectedItem.offsetTop;
    const itemHeight = selectedItem.offsetHeight;

    // Desired visible portion when scrolling
    const scrollMargin = 12; 

    // Check if item is above the visible area
    if (itemOffsetTop < containerScrollTop + scrollMargin) {
      container.scrollTop = Math.max(0, itemOffsetTop - scrollMargin);
    } 
    // Check if item is below the visible area
    else if (itemOffsetTop + itemHeight > containerScrollTop + containerVisibleHeight - scrollMargin) {
      container.scrollTop = itemOffsetTop + itemHeight - containerVisibleHeight + scrollMargin;
    }
    }, 10);
  }
}

// close button click hides panel
if (closeBtn && !closeBtn._bound) {
  closeBtn.addEventListener('click', togglePanel);
  closeBtn._bound = true;
}

// Initialize toggle thumbnails button if exists
const toggleBtn = document.getElementById('toggle-thumbnails');
if (toggleBtn && !toggleBtn._bound) {
  toggleBtn.addEventListener('click', togglePanel);
  toggleBtn._bound = true;
}

// Update the togglePanel function to simplify it
function togglePanel() {
  if (isPanelTransitioning) return; // Prevent toggling during transitions
  
  // Start transition tracking
  isPanelTransitioning = true;
  
  // Get current state
  const isActive = panelWrapper.classList.contains('active');
  
  // Apply both changes simultaneously to synchronize animations
  if (isActive) {
    // If currently active, deactivate it
    panelWrapper.classList.remove('active');
    document.getElementById('container').classList.remove('with-thumbnails');
    // Change handle to normal mode (pointer) and move to left edge
    if (toggleHandle) {
      toggleHandle.classList.remove('resize');
      toggleHandle.style.left = '0px';
      toggleHandle.setAttribute('title', 'Show thumbnails');
      toggleHandle.setAttribute('aria-label', 'Show thumbnail panel');
    }
  } else {
    // If currently inactive, activate it
    panelWrapper.classList.add('active');
    document.getElementById('container').classList.add('with-thumbnails');
    // Change handle to resize mode when panel is open and move it to panel edge
    if (toggleHandle) {
      toggleHandle.classList.add('resize');
      toggleHandle.style.left = panelWrapper.offsetWidth + 'px';
      toggleHandle.setAttribute('title', 'Resize panel');
      toggleHandle.setAttribute('aria-label', 'Resize thumbnail panel');
    }
  }
  
  // Handle panel transition
  handlePanelTransition();
}

/**
 * Remove an image from a batch
 */
async function removeImage(batchIndex, fileIndex) {
  // Get the current state
  const { batches, selectedImageIndex } = getState();
  
  // Validate indices
  if (batchIndex < 0 || batchIndex >= batches.length) return;
  const batch = batches[batchIndex];
  if (!batch || fileIndex < 0 || fileIndex >= batch.files.length) return;
  
  // Get the file we're removing (for info)
  const fileToRemove = batch.files[fileIndex];
  
  // No confirmation, just proceed with deletion
  
  try {
    // Show loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
      loadingIndicator.textContent = 'Deleting image...';
    }
    
    // Clean up any object URL associated with this thumbnail
    const thumbnailItem = container.querySelector(`.thumbnail-item[data-batch-index="${batchIndex}"][data-file-index="${fileIndex}"]`);
    if (thumbnailItem && thumbnailItem.dataset.objectUrl) {
      URL.revokeObjectURL(thumbnailItem.dataset.objectUrl);
      console.log(`Revoked URL for removed image: ${fileToRemove.name}`);
    }
    
    // If this is the last file in the batch, remove the whole batch
    if (batch.files.length === 1) {
      return deleteBatch(batchIndex);
    }
    
    // Import needed functions
    const { getAllImagesMetadata, deleteImageFromDb } = await import('../../services/db/imageStore.js');
    
    // Get all images from the database
    const allImages = await getAllImagesMetadata();
    
    // Find image to delete by matching filename
    const imageToDelete = allImages.find(img => img.filename === fileToRemove.name);
    
    if (imageToDelete) {
      try {
        await deleteImageFromDb(imageToDelete.id);
        console.log(`Deleted image ${imageToDelete.id} (${imageToDelete.filename}) from database`);
      } catch (error) {
        console.error(`Failed to delete image ${imageToDelete.id} from database:`, error);
      }
    } else {
      console.warn(`Image ${fileToRemove.name} not found in database`);
    }
    
    // Create a copy of the batches
    const updatedBatches = [...batches];
    
    // Remember if we're removing the currently selected image
    const isRemovingSelected = batchIndex === selectedImageIndex.batchIndex && 
                              fileIndex === selectedImageIndex.fileIndex;
  
    // Remove the file from its batch
    const updatedBatch = {...batch};
    updatedBatch.files = [...batch.files];
    updatedBatch.files.splice(fileIndex, 1);
    
    // If this was the last file in the batch, remove the batch
    if (updatedBatch.files.length === 0) {
      updatedBatches.splice(batchIndex, 1);
    } else {
      // Otherwise update the batch
      updatedBatches[batchIndex] = updatedBatch;
      
      // Update the batch title if needed
      if (updatedBatch.files.length === 1) {
        updatedBatch.title = updatedBatch.files[0].name;
      }
    }
    
    // Determine the new selected image index
    let newSelectedIndex = {...selectedImageIndex};
  
    // If we removed the currently selected image
    if (isRemovingSelected) {
      // If this was the last file in the batch
      if (updatedBatch.files.length === 0) {
        // Select another batch if possible
        if (updatedBatches.length > 0) {
          const newBatchIndex = Math.min(batchIndex, updatedBatches.length - 1);
          newSelectedIndex = { 
            batchIndex: newBatchIndex, 
            fileIndex: 0 
          };
        } else {
          // No more images
          newSelectedIndex = { batchIndex: -1, fileIndex: -1 };
        }
      } else {
        // Select adjacent file in same batch
        newSelectedIndex = {
          batchIndex,
          fileIndex: Math.min(fileIndex, updatedBatch.files.length - 1)
        };
      }
    } 
    // If we removed a file before the selected file in the same batch
    else if (batchIndex === selectedImageIndex.batchIndex && fileIndex < selectedImageIndex.fileIndex) {
      // Just adjust the file index
      newSelectedIndex = {
        batchIndex,
        fileIndex: selectedImageIndex.fileIndex - 1
      };
    }
    // If we removed a batch before the selected batch
    else if (batchIndex < selectedImageIndex.batchIndex && updatedBatch.files.length === 0) {
      // Adjust the batch index
      newSelectedIndex = {
        batchIndex: selectedImageIndex.batchIndex - 1,
        fileIndex: selectedImageIndex.fileIndex
      };
    }
    
    // Store the batches update
    setState({ batches: updatedBatches });
    
    // Handle the case where there are no more images
    if (updatedBatches.length === 0) {
      // Clear the image and update the state in one go
      setState({
        image: null,
        imageData: null,
        selectedImageIndex: { batchIndex: -1, fileIndex: -1 }
      });
      
      // Clear the canvas
      clearCanvas('#222');
      
      // Update thumbnails
      updateThumbnails();
      
      // Hide loading indicator
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      return;
    }
    
    // Set the new selection index
    setState({ selectedImageIndex: newSelectedIndex });
    
    // If we removed the currently selected image, need to load a new one
    if (isRemovingSelected) {
      // Get the new file to load based on the new indices
      const newBatch = updatedBatches[newSelectedIndex.batchIndex];
      if (newBatch && newSelectedIndex.fileIndex >= 0 && newSelectedIndex.fileIndex < newBatch.files.length) {
        const newFile = newBatch.files[newSelectedIndex.fileIndex];
        
        // Load the new image immediately
        loadImageFile(newFile).then(({ image, imageData }) => {
          setState({ image, imageData });
          refreshCanvas();
          
          // Hide loading indicator
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
        }).catch(err => {
          console.error('Failed to load next image after deletion:', err);
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
        });
      } else {
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
      }
    } else {
      // Hide loading indicator if we're not loading a new image
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }
    
    // Always highlight the new selection and update thumbnails
    highlightSelectedThumbnail(newSelectedIndex.batchIndex, newSelectedIndex.fileIndex);
    updateThumbnails();
  } catch (error) {
    console.error('Error removing image:', error);
    // Hide loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
}

/**
 * Delete an entire batch of images
 */
async function deleteBatch(batchIndex) {
  const { batches, selectedImageIndex } = getState();
  if (batchIndex < 0 || batchIndex >= batches.length) return;
  
  const batchToDelete = batches[batchIndex];
  
  // No confirmation, just proceed with deletion
  
  try {
    // Show loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
      loadingIndicator.textContent = 'Deleting batch...';
    }
    
    // Import needed functions
    const { getAllImagesMetadata, deleteImageFromDb } = await import('../../services/db/imageStore.js');
    
    // Get all images from the database
    const allImages = await getAllImagesMetadata();
    
    // Get filenames of files in this batch
    const batchFilenames = new Set(batchToDelete.files.map(file => file.name));
    
    // Find images to delete by matching filenames
    const imagesToDelete = allImages.filter(img => batchFilenames.has(img.filename));
    
    console.log(`Found ${imagesToDelete.length} images to delete from database for batch ${batchIndex}`);
    
    // Delete all images from the database
    for (const image of imagesToDelete) {
      try {
        await deleteImageFromDb(image.id);
        console.log(`Deleted image ${image.id} (${image.filename}) from database`);
      } catch (error) {
        console.error(`Failed to delete image ${image.id} from database:`, error);
      }
    }
    
    // Create a new array without the deleted batch for UI state
    const updatedBatches = batches.filter((_, index) => index !== batchIndex);
    
    // Update state with new batches array
    setState({ batches: updatedBatches });
    
    // If the selected image was in this batch, we need to select a new image
    if (selectedImageIndex.batchIndex === batchIndex) {
      // Try to select an image in the same position in the previous batch
      if (updatedBatches.length > 0) {
        let newBatchIndex = batchIndex > 0 ? batchIndex - 1 : 0;
        let newFileIndex = Math.min(
          selectedImageIndex.fileIndex, 
          updatedBatches[newBatchIndex].files.length - 1
        );
        selectImage(newBatchIndex, newFileIndex);
      } else {
        // No batches left
        setState({ 
          image: null,
          selectedImageIndex: { batchIndex: -1, fileIndex: -1 }
        });
        
        // Clear canvas when no images remain
        clearCanvas('#222');
      }
    } else if (selectedImageIndex.batchIndex > batchIndex) {
      // If selected image is in a batch after the deleted one, adjust its index
      setState({
        selectedImageIndex: {
          batchIndex: selectedImageIndex.batchIndex - 1,
          fileIndex: selectedImageIndex.fileIndex
        }
      });
  }
  
    // Hide loading indicator
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    // Update the thumbnails display
  updateThumbnails();
  } catch (error) {
    console.error('Error deleting batch from database:', error);
    // Hide loading indicator
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
} 