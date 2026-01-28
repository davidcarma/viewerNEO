import { logger } from './logger.js';
import { showErrorToast, showToast } from './toast.js';

let __vnBusyModalStyleAdded = false;
function ensureBusyModalStyle() {
  if (__vnBusyModalStyleAdded) return;
  __vnBusyModalStyleAdded = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes vnSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
  `;
  document.head.appendChild(style);
}

function showBusyModal(initialText) {
  ensureBusyModalStyle();
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0;
    display: grid; place-items: center;
    background: rgba(0,0,0,0.55);
    z-index: 10070;
    padding: 20px;
  `;
  const card = document.createElement('div');
  card.style.cssText = `
    width: min(520px, 100%);
    border-radius: 16px;
    border: 1px solid var(--border, rgba(255,255,255,0.14));
    background: color-mix(in srgb, var(--surface, #111) 88%, rgba(0,0,0,0.2));
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    padding: 14px;
    color: var(--text, #fff);
    backdrop-filter: blur(12px);
    font-family: var(--font-sans, ui-sans-serif, system-ui);
  `;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:12px; align-items:center;';
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.22);
    border-top: 2px solid rgba(255,255,255,0.9);
    animation: vnSpin 0.9s linear infinite;
    display: none;
    flex: 0 0 auto;
  `;
  const text = document.createElement('div');
  text.style.cssText = 'font-size: 12px; font-weight: 750; line-height: 1.35;';
  text.textContent = initialText || 'Working...';
  row.appendChild(spinner);
  row.appendChild(text);
  card.appendChild(row);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return {
    setText(next) { text.textContent = next; },
    showSpinner() { spinner.style.display = 'block'; },
    close() { try { overlay.remove(); } catch {} },
  };
}

function isImageFile(file) {
  const imageTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'image/bmp', 'image/webp', 'image/svg+xml', 'image/jp2', 'image/tiff',
  ];
  return imageTypes.includes(file.type) || /\.(jpe?g|png|gif|bmp|webp|svg|jp2|tiff?)$/i.test(file.name);
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function getFileFromEntry(fileEntry) {
  return new Promise((resolve, reject) => fileEntry.file(resolve, reject));
}

async function processDirectory(directoryEntry) {
  const files = [];
  return new Promise((resolve) => {
    const directoryReader = directoryEntry.createReader();
    function readEntries() {
      directoryReader.readEntries(async (entries) => {
        if (entries.length === 0) return resolve(files);
        for (const entry of entries) {
          if (entry.isFile) {
            try {
              const f = await getFileFromEntry(entry);
              if (isImageFile(f) || isPdfFile(f)) files.push(f);
            } catch (e) {
              logger.warn('Could not read dropped file', entry.name, e);
            }
          } else if (entry.isDirectory) {
            const sub = await processDirectory(entry);
            files.push(...sub);
          }
        }
        readEntries();
      });
    }
    readEntries();
  });
}

async function processDroppedItems(items) {
  const imageFiles = [];
  const pdfFiles = [];

  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.();
    if (entry) {
      if (entry.isFile) {
        const file = item.getAsFile();
        if (file && isImageFile(file)) imageFiles.push(file);
        else if (file && isPdfFile(file)) pdfFiles.push(file);
      } else if (entry.isDirectory) {
        const dirFiles = await processDirectory(entry);
        for (const f of dirFiles) {
          if (isImageFile(f)) imageFiles.push(f);
          else if (isPdfFile(f)) pdfFiles.push(f);
        }
      }
    } else {
      const file = item.getAsFile();
      if (file && isImageFile(file)) imageFiles.push(file);
      else if (file && isPdfFile(file)) pdfFiles.push(file);
    }
  }

  return { imageFiles, pdfFiles };
}

function createDropOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'drop-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    display: none;
    z-index: 10000;
    pointer-events: none;
  `;
  overlay.innerHTML = `
    <div class="drop-overlay-content">
      <div class="drop-icon">📁</div>
      <div class="drop-text">Drop images or PDFs here</div>
      <div class="drop-subtext">Supports: JPG, PNG, GIF, BMP, WebP, SVG, JP2, TIFF, PDF</div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .drop-overlay-content { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; color:#fff; font-family: var(--font-sans, ui-sans-serif, system-ui); }
    .drop-icon { font-size: 52px; margin-bottom: 10px; animation: dropBounce 1s infinite; }
    .drop-text { font-size: 18px; font-weight: 750; margin-bottom: 6px; }
    .drop-subtext { font-size: 13px; opacity: 0.85; }
    @keyframes dropBounce { 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-8px);} }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  return overlay;
}

export function initDragAndDrop({ panel, dropZone = document.body }) {
  if (!panel) return;

  let dragCounter = 0;
  const overlay = createDropOverlay();

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) overlay.style.display = 'block';
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.style.display = 'none';
    }
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.style.display = 'none';

    try {
      const items = Array.from(e.dataTransfer.items || []);
      if (items.length === 0) return;

      const busy = showToast('Processing dropped files...', { type: 'info', timeoutMs: 0 });
      const { imageFiles, pdfFiles } = await processDroppedItems(items);
      busy.close();

      if (imageFiles.length > 0) {
        let batchTitle = imageFiles.length === 1
          ? `Dropped: ${imageFiles[0].name}`
          : `Dropped Images (${imageFiles.length} files)`;
        panel.createNewBatch(imageFiles, { title: batchTitle });
        showToast(`Added ${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'}`, { type: 'success' });
      }

      if (pdfFiles.length > 0) {
        const { promptPdfRenderOptions, renderPdfsToBatchAndLoad, getPdfPageCount } = await import('../pdf-support.js');
        
        // Check if any PDF is multipage
        let totalPages = 0;
        let isMultipage = false;
        const checkingToast = showToast('Checking PDF pages...', { type: 'info', timeoutMs: 0 });
        
        for (const pdf of pdfFiles) {
          const pageCount = await getPdfPageCount(pdf);
          totalPages += pageCount;
          if (pageCount > 1) isMultipage = true;
        }
        checkingToast.close();
        
        const opts = await promptPdfRenderOptions({ 
          isMultipage, 
          totalPages: pdfFiles.length === 1 ? totalPages : null 
        });
        if (!opts) return;
        
        const busyModal = showBusyModal('Rendering PDF…');
        const spinnerTimer = window.setTimeout(() => busyModal.showSpinner(), 300);
        await renderPdfsToBatchAndLoad({
          pdfFiles,
          panel,
          targetHeight: opts.targetHeight,
          renderAllPages: opts.renderAllPages,
          onProgress: (msg) => {
            if (msg) busyModal.setText(msg);
          },
        });
        window.clearTimeout(spinnerTimer);
        busyModal.close();
        const pageText = opts.renderAllPages && totalPages > 1 ? ` (${totalPages} pages)` : '';
        showToast(`Rendered ${pdfFiles.length} PDF${pdfFiles.length === 1 ? '' : 's'}${pageText}`, { type: 'success' });
      }

      if (imageFiles.length === 0 && pdfFiles.length === 0) {
        showToast('No supported files found (images or PDFs)', { type: 'warn' });
      }
    } catch (err) {
      showErrorToast(err, 'Error processing dropped files.');
    }
  });

  // Prevent default drag behaviors on document
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
}


