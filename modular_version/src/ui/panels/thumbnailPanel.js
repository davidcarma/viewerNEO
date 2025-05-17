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
  item.appendChild(imgEl);

  const label = document.createElement('div');
  label.textContent = file.name;
  item.appendChild(label);

  item.addEventListener('click', () => selectImage(index));
  container.appendChild(item);

  // generate preview
  if (file.type.startsWith('image/') && !/\.tiff?$/.test(file.name.toLowerCase())) {
    imgEl.src = URL.createObjectURL(file);
  } else {
    // TIFF preview fallback: use icon placeholder or generate small canvas via tiffLoader
    imgEl.src = 'placeholder.png';
  }

  // Highlight if active
  const { selectedImageIndex } = getState();
  if (index === selectedImageIndex) item.classList.add('active');
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

export async function selectImage(index) {
  const { imageFiles, selectedImageIndex } = getState();
  
  // Skip if invalid index or already selected
  if (index < 0 || index >= imageFiles.length) return;
  if (index === selectedImageIndex) return; // Already selected
  
  // Take a snapshot before changing the image (if one is currently displayed)
  const canvas = getCanvas();
  const { image } = getState();
  if (image && canvas) {
    takeCanvasSnapshot();
  }
  
  // Load the new image
  const file = imageFiles[index];
  console.log('Loading image:', file.name);
  
  try {
    // Update UI before loading (optional progress indicator)
    const thumbnails = container.querySelectorAll('.thumbnail-item');
    thumbnails.forEach((item, idx) => {
      if (idx === index) {
        item.classList.add('active', 'loading');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Load the image
    const { image, imageData } = await loadImageFile(file);
    setState({ image, imageData, selectedImageIndex: index });
    
    // Draw it on canvas
    refreshCanvas();
    
    // Update thumbnails to reflect selection
    updateThumbnails();
    
    // Remove loading indicator
    thumbnails.forEach((item, idx) => {
      if (idx === index) item.classList.remove('loading');
    });
    
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
  if (selectedIndex >= 0) {
    const thumbnails = container.querySelectorAll('.thumbnail-item');
    thumbnails.forEach((item, idx) => {
      if (idx === selectedIndex) {
        item.classList.add('active');
        // Scroll to the selected thumbnail if needed
        setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
      } else {
        item.classList.remove('active');
      }
    });
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