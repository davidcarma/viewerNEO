import { getState, setState } from '../../core/state.js';
import { fitImageWithPadding } from '../../ui/canvas/renderImage.js';

/**
 * Rotates the image 90 degrees counterclockwise
 */
export function rotateLeft() {
  const { rotation } = getState();
  
  // Calculate new rotation (0, 90, 180, 270)
  let newRotation = rotation - 90;
  if (newRotation < 0) newRotation += 360;
  
  // Update rotation in state
  setState({ rotation: newRotation });
  
  // Recalculate fit after rotation
  const { zoom, offset } = fitImageWithPadding();
  setState({ zoom, offset });
}

/**
 * Rotates the image 90 degrees clockwise
 */
export function rotateRight() {
  const { rotation } = getState();
  
  // Calculate new rotation (0, 90, 180, 270)
  const newRotation = (rotation + 90) % 360;
  
  // Update rotation in state
  setState({ rotation: newRotation });
  
  // Recalculate fit after rotation
  const { zoom, offset } = fitImageWithPadding();
  setState({ zoom, offset });
}

/**
 * Initialize rotation controls
 */
export function initImageRotation() {
  const rotateLeftBtn = document.getElementById('rotate-left-btn');
  const rotateRightBtn = document.getElementById('rotate-right-btn');
  
  if (rotateLeftBtn) {
    rotateLeftBtn.addEventListener('click', rotateLeft);
  }
  
  if (rotateRightBtn) {
    rotateRightBtn.addEventListener('click', rotateRight);
  }
} 