import { getState, setState } from '../../core/state.js';
import { loadImageFile } from '../../loaders/imageLoader.js';
import { refreshCanvas } from '../canvas/renderImage.js';

const container = document.getElementById('thumbnails-container');
const panelWrapper = document.getElementById('thumbnail-panel');
if (!container) console.warn('No thumbnails-container in HTML');

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