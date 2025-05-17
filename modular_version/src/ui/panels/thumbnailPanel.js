import { getState, setState } from '../../core/state.js';
import { loadImageFile } from '../../loaders/imageLoader.js';
import { refreshCanvas, scheduleRedraw, setPanelTransitionState } from '../canvas/renderImage.js';
import { setCanvasSize, getCanvas } from '../canvas/canvasContext.js';

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

async function createThumbnail(file, index) {
  const item = document.createElement('div');
  item.className = 'thumbnail-item';

  const imgEl = document.createElement('img');
  imgEl.alt = file.name;
  imgEl.loading = 'lazy'; // Add lazy loading for better performance
  item.appendChild(imgEl);

  // Add remove button (red X)
  const removeBtn = document.createElement('button');
  removeBtn.className = 'thumbnail-remove-btn';
  removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering thumbnail click
    removeImage(index);
  });
  item.appendChild(removeBtn);

  const label = document.createElement('div');
  label.textContent = file.name;
  item.appendChild(label);

  // Make sure z-index works properly
  item.style.zIndex = (100 - index); // Ensure thumbnails on top are given higher priority
  
  item.addEventListener('click', () => selectImage(index));
  
  // Append to container
  container.appendChild(item);

  // Default placeholder - embedded data URI for image icon
  const placeholderSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxMTExMTEiLz48cGF0aCBkPSJNMzUgMjVINjVDNjguMyAyNSA3MSAyNy43IDcxIDMxVjY5QzcxIDcyLjMgNjguMyA3NSA2NSA3NUgzNUMzMS43IDc1IDI5IDcyLjMgMjkgNjlWMzFDMjkgMjcuNyAzMS43IDI1IDM1IDI1WiIgc3Ryb2tlPSIjNTU1IiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI1IiBmaWxsPSIjNTU1Ii8+PHBhdGggZD0iTTMwIDYwTDQwIDUwTDUwIDYwTDYwIDUwTDcwIDYwVjcwSDMwVjYwWiIgZmlsbD0iIzU1NSIvPjwvc3ZnPg==';

  // generate preview
  if (file.type.startsWith('image/') && !/\.tiff?$/.test(file.name.toLowerCase())) {
    imgEl.src = URL.createObjectURL(file);
  } else {
    // TIFF or other files use placeholder
    imgEl.src = placeholderSrc;
  }

  // Highlight if active
  const { selectedImageIndex } = getState();
  if (index === selectedImageIndex) {
    item.classList.add('active');
    // Make sure the active item is visible
    setTimeout(() => {
      try {
        if (container.scrollHeight > container.clientHeight) {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (e) {
        console.warn('Failed to scroll to thumbnail', e);
      }
    }, 100);
  }
}

export function updateThumbnails() {
  if (!container) return;
  container.innerHTML = '';
  const { imageFiles, selectedImageIndex } = getState();
  
  // Create all thumbnails
  imageFiles.forEach((f, idx) => {
    createThumbnail(f, idx);
  });

  // Auto-show panel if there are images
  if (panelWrapper && imageFiles.length > 0) {
    // Make sure the panel is visible
    panelWrapper.style.display = 'block';
    
    // If more than one image, show the gallery
    if (imageFiles.length > 1) {
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
        highlightSelectedThumbnail(selectedImageIndex);
      }
    }
  }

  // Handle click toggles for the handle
  if (toggleHandle && !toggleHandle._bound) {
    toggleHandle.addEventListener('click', togglePanel);
    toggleHandle._bound = true;
  }
}

export async function selectImage(index, force = false) {
  const { imageFiles, selectedImageIndex } = getState();
  
  // Skip if invalid index or already selected
  if (index < 0 || index >= imageFiles.length) return;
  if (!force && index === selectedImageIndex) return; // Already selected
  
  // Find all thumbnails
  const thumbnails = container.querySelectorAll('.thumbnail-item');
  const currentSelectedItem = thumbnails[selectedImageIndex];
  const newSelectedItem = thumbnails[index];

  // Update the selected index in state - do this early
  setState({ selectedImageIndex: index });

  // Directly update classes on the relevant thumbnails
  if (currentSelectedItem && currentSelectedItem !== newSelectedItem) {
    currentSelectedItem.classList.remove('active');
  }
  if (newSelectedItem) {
    newSelectedItem.classList.add('active');
  }
  
  // Handle scrolling after a brief moment
  requestAnimationFrame(() => {
    highlightSelectedThumbnail(index);
  });
  
  // Load the new image
  const file = imageFiles[index];
  console.log('Loading image:', file.name);
  
  try {
    // Load the image
    const { image, imageData } = await loadImageFile(file);
    setState({ image, imageData });
    
    // Draw it on canvas
    refreshCanvas();
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

function highlightSelectedThumbnail(selectedIndex) {
  if (selectedIndex < 0 || !container) return;

  const thumbnails = container.querySelectorAll('.thumbnail-item');
  if (selectedIndex >= thumbnails.length) return;

  const selectedItem = thumbnails[selectedIndex];

  // Ensure only the current item is active
  thumbnails.forEach((item, idx) => {
    if (idx === selectedIndex) {
      if (!item.classList.contains('active')) item.classList.add('active');
    } else {
      if (item.classList.contains('active')) item.classList.remove('active');
    }
  });
  
  if (selectedItem) {
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
  
  // Handle the transition events
  handlePanelTransition();
}

// Add function to remove an image
function removeImage(index) {
  const { imageFiles, selectedImageIndex } = getState();
  
  // Validate index
  if (index < 0 || index >= imageFiles.length) return;
  
  // Create new array without the removed image
  const newFiles = [...imageFiles];
  newFiles.splice(index, 1);
  
  // Update state with new file list
  setState({ imageFiles: newFiles });
  
  // If we removed the selected image, select another one
  if (index === selectedImageIndex) {
    // Select previous image or first if this was the first
    const newIndex = index > 0 ? index - 1 : (newFiles.length > 0 ? 0 : -1);
    
    if (newIndex >= 0) {
      // We have another image to select
      selectImage(newIndex, true); // Pass true to force selection
    } else {
      // No images left
      setState({ image: null, imageData: null, selectedImageIndex: -1 });
      refreshCanvas(); // Clear canvas
    }
  } else if (selectedImageIndex > index) {
    // If we removed an image before the selected one, update the index
    setState({ selectedImageIndex: selectedImageIndex - 1 });
  }
  
  // Rebuild thumbnails
  updateThumbnails();
} 