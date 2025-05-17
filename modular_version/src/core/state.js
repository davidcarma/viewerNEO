// Global application state & helpers
// ----------------------------------
// This lightweight store is intentionally vanilla JS to avoid framework lock-in.

export const State = {
  image: null,
  imageFiles: [],
  zoom: 1,
  offset: { x: 0, y: 0 },
  grid: {
    show: false,
    size: 100,
    color: '#ff0059',
    opacity: 0.5,
    fixed: false,
    lineStyle: 'solid',
  },
  selectedImageIndex: -1,
};

/**
 * Merge a partial update into State and emit `state:changed`.
 * Components can subscribe via:
 *   window.addEventListener('state:changed', (e) => { ... })
 */
export function setState(partial) {
  Object.assign(State, partial);
  window.dispatchEvent(new CustomEvent('state:changed', { detail: partial }));
}

export const getState = () => State;
