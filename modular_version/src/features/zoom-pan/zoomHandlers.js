import { getState, setState } from '../../core/state.js';
import { refreshCanvas, scheduleRedraw } from '../../ui/canvas/renderImage.js';

export function initZoom() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  // Note: Zoom-in, zoom-out, and Reset View buttons have been removed from the UI.
  // Zooming is now exclusively handled via the mouse wheel for a cleaner interface.
  // View reset can be achieved through double-click or by reloading the image.
  
  // Add double-click to reset view (replacing the reset button)
  canvas.addEventListener('dblclick', (e) => {
    // Reset zoom and position
    setState({ 
      zoom: 1,
      offset: { x: 0, y: 0 }
    });
    scheduleRedraw();
    console.log('View reset via double-click');
  });
  
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { zoom } = getState();
    const delta = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 50);

    // Zoom towards pointer
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    const { offset } = getState();
    const newOffsetX = px - ((px - offset.x) * (newZoom / zoom));
    const newOffsetY = py - ((py - offset.y) * (newZoom / zoom));

    setState({ zoom: newZoom, offset: { x: newOffsetX, y: newOffsetY } });
    scheduleRedraw();
  }, { passive: false });
} 