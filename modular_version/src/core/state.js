// Global application state & helpers
// ----------------------------------
// This lightweight store is intentionally vanilla JS to avoid framework lock-in.

export const State = {
  image: null,
  batches: [], // Array of batch objects: {id, title, expanded, files}
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
  selectedImageIndex: { batchIndex: -1, fileIndex: -1 }, // Updated to track both batch and file
  canvasZoomLimits: { min: 0.1, max: 50 },
  canvasReady: false,
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

// Helper function to get flat list of all files across all batches
export function getAllFiles() {
  return State.batches.flatMap(batch => batch.files);
}

// Helper to get currently selected file
export function getSelectedFile() {
  const { batchIndex, fileIndex } = State.selectedImageIndex;
  if (batchIndex < 0 || fileIndex < 0 || batchIndex >= State.batches.length) return null;
  
  const batch = State.batches[batchIndex];
  if (!batch || fileIndex >= batch.files.length) return null;
  
  return batch.files[fileIndex];
}

// Helper to get global index for a file
export function getGlobalIndex(batchIndex, fileIndex) {
  let globalIndex = 0;
  for (let i = 0; i < batchIndex; i++) {
    globalIndex += State.batches[i].files.length;
  }
  return globalIndex + fileIndex;
}

// Helper to convert global index to batch+file index
export function getBatchFileIndex(globalIndex) {
  let filesChecked = 0;
  for (let i = 0; i < State.batches.length; i++) {
    const batchSize = State.batches[i].files.length;
    if (globalIndex < filesChecked + batchSize) {
      return { batchIndex: i, fileIndex: globalIndex - filesChecked };
    }
    filesChecked += batchSize;
  }
  return { batchIndex: -1, fileIndex: -1 };
}
