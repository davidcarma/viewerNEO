// PDF drop/render support for ViewerNeo.
// Uses vendored PDF.js module + worker under ./lib (no CDN at runtime).

const DEFAULT_PRESET_HEIGHTS = [720, 1080, 1440, 2160, 3000, 3400, 4000, 5000, 6000, 7000, 8000, 9000];

let __pdfjsPromise = null;
async function ensurePdfJs() {
  if (__pdfjsPromise) return __pdfjsPromise;
  __pdfjsPromise = (async () => {
    const pdfjsLib = await import('./lib/pdf.min.mjs');
    // worker must be an URL string
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjsLib;
  })();
  return __pdfjsPromise;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

export async function promptPdfRenderOptions({ presetHeights = DEFAULT_PRESET_HEIGHTS } = {}) {
  return new Promise((resolve) => {
    const overlay = el('div', {
      class: 'vn-modal-overlay',
      style: `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.55);
        display: grid; place-items: center;
        z-index: 10002;
        padding: 20px;
      `
    });

    const card = el('div', {
      class: 'vn-modal-card',
      style: `
        width: min(520px, 100%);
        border-radius: 16px;
        border: 1px solid var(--border, rgba(255,255,255,0.14));
        background: color-mix(in srgb, var(--surface, #111) 88%, rgba(0,0,0,0.2));
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        padding: 14px;
        color: var(--text, #fff);
        backdrop-filter: blur(12px);
      `
    });

    const title = el('div', { style: 'font-weight: 750; font-size: 14px; margin-bottom: 6px;' }, [
      'Render dropped PDF'
    ]);
    const subtitle = el('div', { style: 'color: var(--muted, #aaa); font-size: 12px; line-height: 1.35; margin-bottom: 10px;' }, [
      'Choose a target render height (px). Aspect ratio is preserved per page.'
    ]);

    const row = el('div', { style: 'display:flex; gap:10px; align-items:center; margin-bottom:10px;' });
    const label = el('label', { style: 'font-size:12px; color: var(--muted, #aaa); font-weight: 650; min-width: 140px;' }, [
      'Target height'
    ]);
    const select = el('select', {
      style: `
        flex: 1;
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid var(--field-border, rgba(255,255,255,0.16));
        background: var(--field-bg, rgba(255,255,255,0.06));
        color: var(--text, #fff);
        font-weight: 650;
        font-size: 12px;
      `
    });
    for (const h of presetHeights) {
      const opt = el('option', { value: String(h) }, [`${h}px`]);
      select.appendChild(opt);
    }
    // Default to 3000px for your workflow (falls back to first preset if not present).
    select.value = String(presetHeights.includes(3000) ? 3000 : presetHeights[0]);
    row.appendChild(label);
    row.appendChild(select);

    const modeRow = el('div', { style: 'display:flex; gap:14px; align-items:center; margin: 10px 0 12px 0; flex-wrap: wrap;' });
    const allPagesLabel = el('label', { style: 'display:flex; gap:10px; align-items:center; font-size: 12px; font-weight: 650;' });
    const allPages = el('input', { type: 'checkbox', checked: '' });
    allPagesLabel.appendChild(allPages);
    allPagesLabel.appendChild(el('span', {}, ['Render all pages']));
    const limitLabel = el('div', { style: 'color: var(--muted, #aaa); font-size: 12px;' }, [
      '(Large PDFs may take a while)'
    ]);
    modeRow.appendChild(allPagesLabel);
    modeRow.appendChild(limitLabel);

    const btnRow = el('div', { style: 'display:flex; gap:10px; justify-content:flex-end; margin-top: 6px;' });
    const cancelBtn = el('button', {
      style: `
        padding: 7px 10px; border-radius: 10px;
        border: 1px solid var(--btn-border, rgba(255,255,255,0.14));
        background: transparent;
        color: var(--text, #fff);
        font-weight: 650; font-size: 12px;
        cursor: pointer;
      `
    }, ['Cancel']);
    const okBtn = el('button', {
      style: `
        padding: 7px 10px; border-radius: 10px;
        border: 1px solid var(--btn-primary-border, rgba(34,211,238,0.35));
        background: var(--btn-primary-bg, rgba(34,211,238,0.15));
        color: var(--text, #fff);
        font-weight: 750; font-size: 12px;
        cursor: pointer;
      `
    }, ['Render']);

    const cleanup = () => {
      try { document.body.removeChild(overlay); } catch {}
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    okBtn.addEventListener('click', () => {
      const targetHeight = parseInt(select.value, 10);
      cleanup();
      resolve({
        targetHeight: Number.isFinite(targetHeight) ? targetHeight : 2160,
        renderAllPages: allPages.checked
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(row);
    card.appendChild(modeRow);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

async function renderPdfFileToCanvases(pdfFile, { targetHeight, renderAllPages }) {
  const pdfjsLib = await ensurePdfJs();

  const buf = await pdfFile.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageCount = doc.numPages;
  const maxPages = renderAllPages ? pageCount : Math.min(pageCount, 1);
  const canvases = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const viewport1 = page.getViewport({ scale: 1 });
    const scale = targetHeight / viewport1.height;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });

    // White background (PDF can have transparent areas)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push({ canvas, pageIndex: i, pageCount });
  }
  return canvases;
}

async function canvasToPngFile(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Failed to encode PNG'));
      resolve(new File([blob], filename, { type: 'image/png' }));
    }, 'image/png', 0.95);
  });
}

export async function renderPdfsToBatchAndLoad({
  pdfFiles,
  panel,
  targetHeight,
  renderAllPages,
  onProgress
}) {
  if (!pdfFiles || pdfFiles.length === 0) return { files: [] };
  if (!panel || typeof panel.createNewBatch !== 'function') {
    throw new Error('Thumbnail panel not available');
  }

  const outFiles = [];
  for (const pdfFile of pdfFiles) {
    const base = pdfFile.name.replace(/\.pdf$/i, '');
    if (onProgress) onProgress(`Rendering ${pdfFile.name}...`);
    const canvases = await renderPdfFileToCanvases(pdfFile, { targetHeight, renderAllPages });
    for (const { canvas, pageIndex, pageCount } of canvases) {
      const w = canvas.width;
      const h = canvas.height;
      const pageSuffix = pageCount > 1 ? `_p${String(pageIndex).padStart(2, '0')}` : '';
      const filename = `${base}${pageSuffix}_${w}x${h}.png`;
      const f = await canvasToPngFile(canvas, filename);
      outFiles.push(f);
    }
  }

  const batchTitle = `Rendered PDFs (${targetHeight}px)`;
  panel.createNewBatch(outFiles, { title: batchTitle, expanded: true });

  // Load the first rendered page into the viewer if available (stable public API)
  const newest = (panel.getNewestFile && typeof panel.getNewestFile === 'function') ? panel.getNewestFile() : null;
  if (newest && typeof window.handleThumbnailImage === 'function') {
    window.handleThumbnailImage({ detail: { file: newest } });
  }

  if (onProgress) onProgress(null);
  return { files: outFiles };
}


