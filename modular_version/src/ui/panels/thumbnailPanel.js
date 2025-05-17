import { getState, setState } from '../../core/state.js';
import { loadImageFile } from '../../loaders/imageLoader.js';
import { refreshCanvas, scheduleRedraw } from '../canvas/renderImage.js';
import { setCanvasSize, getCanvas, getContext } from '../canvas/canvasContext.js';

const container = document.getElementById('thumbnails-container');
const panelWrapper = document.getElementById('thumbnail-panel');
if (!container) console.warn('No thumbnails-container in HTML');

const closeBtn = document.getElementById('close-thumbnails');
const tab = document.getElementById('thumbnail-tab');

// Track panel state to avoid transition issues
let isPanelTransitioning = false;
let pendingRedraw = false;

// Create a canvas for snapshot during transitions
let snapshotCanvas = null;
function getSnapshotCanvas() {
  if (!snapshotCanvas) {
    snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.className = 'snapshot-canvas';
    snapshotCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:10;';
    document.getElementById('container').appendChild(snapshotCanvas);
  }
  return snapshotCanvas;
}

// Ensure tab is visible by default
if (tab) {
  tab.classList.add('visible');
  tab.style.left = '0px';
  console.log('Thumbnail tab initialized at position 0');
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
          
          // Take snapshot before making changes
          const canvas = getCanvas();
          const { image } = getState();
          if (image && canvas) {
            takeCanvasSnapshot();
          }
          
          // Add active class to open panel
          panelWrapper.classList.add('active');
          
          // Apply layout changes
          setTimeout(() => {
            const cont = document.getElementById('container');
            const panelW = parseInt(getComputedStyle(panelWrapper).width,10);
            cont.style.marginLeft = `${panelW}px`;
            cont.style.width = `calc(100% - ${panelW}px)`;
            
            if (tab) {
              tab.classList.add('visible');
              tab.style.left = `${panelW}px`;
            }
            
            // Handle panel transition
            handlePanelTransition();
          }, 10);
        } else {
          // Panel is already transitioning, just mark that we need a redraw when done
          pendingRedraw = true;
        }
      } else {
        // Panel already open, just highlight the selection
        highlightSelectedThumbnail(selectedImageIndex);
      }
    } else {
      // Just one image, don't open the panel but ensure tab is visible
      if (tab) {
        tab.classList.add('visible');
        tab.style.left = '0px';
      }
    }
  } else {
    // Even with no images, ensure tab is visible
    if (tab) {
      tab.classList.add('visible');
    }
  }

  // Handle click toggles
  if (tab && !tab._bound) {
    tab.addEventListener('click', togglePanel);
    tab._bound = true;
  }
}

export async function selectImage(index, force = false) {
  const { imageFiles, selectedImageIndex } = getState();
  
  // Skip if invalid index or already selected
  if (index < 0 || index >= imageFiles.length) return;
  if (!force && index === selectedImageIndex) return; // Already selected
  
  // Take a snapshot before changing the image (if one is currently displayed)
  const canvas = getCanvas();
  const { image } = getState();
  if (image && canvas) {
    takeCanvasSnapshot();
  }
  
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
  
  // Handle scrolling after a brief moment for class changes to apply
  // and DOM to settle. This helps if CSS transitions are involved.
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
    
    // Remove the snapshot once the new image is drawn
    setTimeout(() => removeSnapshot(), 100);
    
  } catch (err) {
    console.error('Failed to load image:', err);
    // Remove the snapshot if loading failed
    removeSnapshot();
  }
}

function updateCanvasSize() {
  const cont = document.getElementById('container');
  if (!cont) return;
  
  const rect = cont.getBoundingClientRect();
  setCanvasSize(rect.width, rect.height);
}

// Take a snapshot of the current canvas to use during transition
function takeCanvasSnapshot() {
  const mainCanvas = getCanvas();
  if (!mainCanvas) return null;
  
  const snapshot = getSnapshotCanvas();
  snapshot.width = mainCanvas.width;
  snapshot.height = mainCanvas.height;
  snapshot.style.width = mainCanvas.style.width;
  snapshot.style.height = mainCanvas.style.height;
  
  const ctx = snapshot.getContext('2d');
  ctx.clearRect(0, 0, snapshot.width, snapshot.height);
  ctx.drawImage(mainCanvas, 0, 0);
  
  // Position the snapshot exactly over the canvas
  const canvasRect = mainCanvas.getBoundingClientRect();
  const containerRect = document.getElementById('container').getBoundingClientRect();
  
  snapshot.style.top = '0px';
  snapshot.style.left = '0px';
  snapshot.style.opacity = '1';
  snapshot.style.display = 'block';
  
  return snapshot;
}

function removeSnapshot() {
  if (snapshotCanvas) {
    // Fade out gradually
    snapshotCanvas.style.opacity = '0';
    setTimeout(() => {
      snapshotCanvas.style.display = 'none';
    }, 300);
  }
}

function applyLayout(active) {
  const panelW = parseInt(getComputedStyle(panelWrapper).width, 10);
  const cont = document.getElementById('container');
  
  // Get current dimensions before any changes
  const prevWidth = cont.offsetWidth;
  const prevHeight = cont.offsetHeight;
  
  if (active) {
    cont.style.marginLeft = `${panelW}px`;
    cont.style.width = `calc(100% - ${panelW}px)`;
    if (tab) {
      tab.style.left = `${panelW}px`;
      tab.classList.add('visible');
    }
  } else {
    cont.style.marginLeft = '0';
    cont.style.width = '100%';
    if (tab) {
      tab.style.left = '0px';
      tab.classList.add('visible');
    }
  }
  
  // Get dimensions after changes
  const newWidth = parseInt(getComputedStyle(cont).width, 10);
  const newHeight = cont.offsetHeight;
  
  // If dimensions changed, force canvas update
  if (prevWidth !== newWidth || prevHeight !== newHeight) {
    console.log(`Container dimensions changed: ${prevWidth}x${prevHeight} -> ${newWidth}x${newHeight}`);
  }
}

// Helper function to handle panel transition and ensure redraws happen in the right order
function handlePanelTransition() {
  function onTransitionEnd(e) {
    if (e.target === panelWrapper) {
      // Update canvas size first
      updateCanvasSize();
      
      // Force a refresh immediately for newly added images
      refreshCanvas();
      
      // Wait another frame to remove the snapshot
      requestAnimationFrame(() => {
        setTimeout(() => {
          removeSnapshot();
          isPanelTransitioning = false;
          
          // Check if another redraw was requested during transition
          if (pendingRedraw) {
            pendingRedraw = false;
            scheduleRedraw();
          }
        }, 100);
      });
      
      panelWrapper.removeEventListener('transitionend', onTransitionEnd);
    }
  }
  
  // Listen for transition completion
  panelWrapper.addEventListener('transitionend', onTransitionEnd);
  
  // Fallback in case transitionend doesn't fire
  setTimeout(() => {
    if (isPanelTransitioning) {
      updateCanvasSize();
      refreshCanvas();
      setTimeout(() => {
        removeSnapshot();
        isPanelTransitioning = false;
        if (pendingRedraw) {
          pendingRedraw = false;
          scheduleRedraw();
        }
      }, 100);
    }
  }, 350);
}

function highlightSelectedThumbnail(selectedIndex) {
  if (selectedIndex < 0 || !container) return;

  const thumbnails = container.querySelectorAll('.thumbnail-item');
  if (selectedIndex >= thumbnails.length) return;

  const selectedItem = thumbnails[selectedIndex];

  // Ensure only the current item is active
  // This is a bit redundant if selectImage already did it, but good for direct calls.
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

    // Desired visible portion when scrolling (e.g., ensure item is not right at the edge)
    const scrollMargin = 12; 

    // Check if item is above the visible area
    if (itemOffsetTop < containerScrollTop + scrollMargin) {
      container.scrollTop = Math.max(0, itemOffsetTop - scrollMargin);
    } 
    // Check if item is below the visible area
    else if (itemOffsetTop + itemHeight > containerScrollTop + containerVisibleHeight - scrollMargin) {
      container.scrollTop = itemOffsetTop + itemHeight - containerVisibleHeight + scrollMargin;
    }
    // No scroll needed if item is already sufficiently visible.
    // The original logic with itemTop/containerTop could be problematic if container itself is scrolled within page.
    // Using offsetTop and scrollTop provides values relative to the scroll container.
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

// Update the togglePanel function to use the shared panel transition handler
function togglePanel() {
  if (isPanelTransitioning) return; // Prevent toggling during transitions
  
  const canvas = getCanvas();
  const { image } = getState();
  
  // Start transition tracking
  isPanelTransitioning = true;
  
  // Only take snapshot if we have an image
  if (image && canvas) {
    takeCanvasSnapshot();
  }
  
  // Apply panel toggle
  const active = panelWrapper.classList.toggle('active');
  
  // Use a brief timeout to ensure snapshot is rendered before layout changes
  setTimeout(() => {
    applyLayout(active);
  }, 10);
  
  // Handle the transition events
  handlePanelTransition();
}

// Add new function to remove an image
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
  
  // Rebuild thumbnails (this is a legitimate reason to rebuild)
  updateThumbnails();
} 