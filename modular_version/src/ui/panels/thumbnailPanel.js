import { getState, setState } from '../../core/state.js';
import { loadImageFile } from '../../loaders/imageLoader.js';
import { refreshCanvas, scheduleRedraw } from '../canvas/renderImage.js';

const container = document.getElementById('thumbnails-container');
const panelWrapper = document.getElementById('thumbnail-panel');
if (!container) console.warn('No thumbnails-container in HTML');

const closeBtn = document.getElementById('close-thumbnails');
const tab = document.getElementById('thumbnail-tab');

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
    if (tab) {
      tab.classList.add('visible');
      tab.style.left = `${panelW}px`;
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

function applyLayout(active) {
  const panelW = parseInt(getComputedStyle(panelWrapper).width, 10);
  const cont = document.getElementById('container');
  if (active) {
    cont.style.marginLeft = `${panelW}px`;
    cont.style.width = `calc(100% - ${panelW}px)`;
    if (tab) tab.style.left = `${panelW}px`;
  } else {
    cont.style.marginLeft = '0';
    cont.style.width = '100%';
    if (tab) tab.style.left = '0px';
  }
}

function togglePanel() {
  const active = panelWrapper.classList.toggle('active');
  applyLayout(active);
  
  // Ensure image redraws after panel toggle
  setTimeout(() => {
    scheduleRedraw();
  }, 100); // brief delay to allow layout to complete
}

// close button click hides panel
if (closeBtn && !closeBtn._bound) {
  closeBtn.addEventListener('click', togglePanel);
  closeBtn._bound = true;
} 