import { getState, setState } from '../../core/state.js';
import { loadImageFile } from '../../loaders/imageLoader.js';
import { refreshCanvas, scheduleRedraw } from '../canvas/renderImage.js';
import { setCanvasSize, getCanvas, getContext } from '../canvas/canvasContext.js';

const container = document.getElementById('thumbnails-container');
const panelWrapper = document.getElementById('thumbnail-panel');
if (!container) console.warn('No thumbnails-container in HTML');

const closeBtn = document.getElementById('close-thumbnails');
const tab = document.getElementById('thumbnail-tab');

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
  const { imageFiles } = getState();
  imageFiles.forEach((f, idx) => {
    createThumbnail(f, idx);
  });

  // Auto-show panel if more than one image
  if (panelWrapper && imageFiles.length > 1) {
    panelWrapper.style.display = 'block';
    panelWrapper.classList.add('active');
    const cont = document.getElementById('container');
    const panelW = parseInt(getComputedStyle(panelWrapper).width,10);
    cont.style.marginLeft = `${panelW}px`;
    cont.style.width = `calc(100% - ${panelW}px)`;
    
    // Always ensure tab is visible and properly positioned
    if (tab) {
      tab.classList.add('visible');
      tab.style.left = `${panelW}px`;
    }
    
    // Ensure canvas is correctly sized after panel is shown
    requestAnimationFrame(() => {
      updateCanvasSize();
      scheduleRedraw();
    });
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
  const { imageFiles } = getState();
  if (index < 0 || index >= imageFiles.length) return;
  const file = imageFiles[index];
  console.log('Thumbnail click -> loading', file.name);
  const { image, imageData } = await loadImageFile(file);
  setState({ image, imageData, selectedImageIndex: index });
  refreshCanvas();
  updateThumbnails();
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

function togglePanel() {
  const canvas = getCanvas();
  const { image } = getState();
  
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
  
  // Use transitionend event to ensure we update after CSS transition completes
  function handleTransitionEnd(e) {
    if (e.target === panelWrapper) {
      // Update canvas size first
      updateCanvasSize();
      
      // Wait a frame to ensure the canvas has been resized
      requestAnimationFrame(() => {
        const { image } = getState();
        if (image) {
          scheduleRedraw();
          
          // Wait for redraw to complete before removing snapshot
          requestAnimationFrame(() => {
            setTimeout(() => removeSnapshot(), 100);
          });
        } else {
          removeSnapshot();
        }
      });
      
      panelWrapper.removeEventListener('transitionend', handleTransitionEnd);
    }
  }
  
  // Listen for transition completion
  panelWrapper.addEventListener('transitionend', handleTransitionEnd);
  
  // Fallback in case transitionend doesn't fire
  setTimeout(() => {
    updateCanvasSize();
    scheduleRedraw();
    setTimeout(() => removeSnapshot(), 250);
  }, 350); // Slightly longer than transition
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