import { getState } from '../../core/state.js';

const panel = document.getElementById('info-panel');
if (!panel) console.warn('info-panel not found');

export function updateInfo(extra = {}) {
  if (!panel) return;
  const { image, zoom, offset } = getState();
  const { pointer } = extra;
  const sizeText = image ? `${image.width} × ${image.height}` : '-';
  const zoomText = `${Math.round(zoom * 100)}%`;
  const posText = `${Math.round(offset.x)}, ${Math.round(offset.y)}`;
  const pointerText = pointer ? `<br>Cursor: ${pointer.x}, ${pointer.y}` : '';
  panel.innerHTML = `Image Size: ${sizeText}<br>Zoom: ${zoomText}<br>Position: ${posText}${pointerText}`;
} 