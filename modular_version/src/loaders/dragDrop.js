import { handleIncomingFiles } from './fileHandlerRouter.js';

export function initDragDrop() {
  const dropOverlay = document.getElementById('drop-overlay');

  function showOverlay() {
    dropOverlay.classList.add('active');
  }
  function hideOverlay() {
    dropOverlay.classList.remove('active');
  }

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    showOverlay();
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('dragleave', (e) => {
    if (e.target === document || e.target === dropOverlay) hideOverlay();
  });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    hideOverlay();
    const files = Array.from(e.dataTransfer.files);
    await handleIncomingFiles(files);
  });
} 