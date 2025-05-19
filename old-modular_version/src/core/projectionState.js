// Simple state management for the projection page
// Provides compatibility with functions expecting state from the main viewer

// Default initial state
const initialState = {
  image: null,
  zoom: 1,
  offset: { x: 0, y: 0 },
  rotation: 0,
  grid: { show: false }
};

// Current state object
export const State = { ...initialState };

/**
 * Update the state with new values
 * @param {Object} newState - The new state values to merge
 */
export function setState(newState) {
  Object.assign(State, newState);
  
  // Dispatch state changed event for compatibility with main viewer
  const event = new CustomEvent('state:changed', { 
    detail: newState 
  });
  window.dispatchEvent(event);
}

/**
 * Get the current state
 * @returns {Object} - The current state
 */
export function getState() {
  return State;
}

// Reset the state to initial values
export function resetState() {
  Object.assign(State, initialState);
} 