import { getState, setState } from '../../core/state.js';
import { refreshCanvas, scheduleRedraw } from '../../ui/canvas/renderImage.js';

export function initPan() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // left only
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const { offset } = getState();
    setState({ offset: { x: offset.x + dx, y: offset.y + dy } });
    scheduleRedraw();
  });
  window.addEventListener('mouseup', () => isDragging = false);
} 