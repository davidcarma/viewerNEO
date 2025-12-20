import { logger } from './logger.js';

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.id = 'vn-toast-area';
  container.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 10050;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  `;
  document.body.appendChild(container);
  return container;
}

function toastStyle(type) {
  const base = `
    pointer-events: auto;
    border-radius: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border, rgba(255,255,255,0.14));
    background: color-mix(in srgb, var(--surface-2, #111) 78%, rgba(0,0,0,0.35));
    color: var(--text, #fff);
    font-family: var(--font-sans, ui-sans-serif, system-ui);
    font-size: 12px;
    font-weight: 650;
    box-shadow: 0 14px 40px rgba(0,0,0,0.30);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(360px, calc(100vw - 32px));
    animation: vnToastIn 140ms ease-out;
  `;

  const left = {
    info: 'border-left: 4px solid color-mix(in srgb, var(--accent, #22d3ee) 70%, transparent);',
    success: 'border-left: 4px solid color-mix(in srgb, var(--ok, #28c940) 70%, transparent);',
    warn: 'border-left: 4px solid color-mix(in srgb, var(--warn, #ffbd2e) 70%, transparent);',
    error: 'border-left: 4px solid color-mix(in srgb, var(--danger, #ff5f57) 70%, transparent);',
  }[type] || '';

  return base + left;
}

function ensureKeyframes() {
  if (document.getElementById('vn-toast-style')) return;
  const style = document.createElement('style');
  style.id = 'vn-toast-style';
  style.textContent = `
    @keyframes vnToastIn {
      from { transform: translateX(10px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

export function showToast(message, { type = 'info', timeoutMs = 3000 } = {}) {
  ensureKeyframes();
  const root = ensureContainer();
  const t = document.createElement('div');
  t.style.cssText = toastStyle(type);
  t.textContent = message;
  root.appendChild(t);
  if (timeoutMs > 0) {
    window.setTimeout(() => {
      try { t.remove(); } catch {}
    }, timeoutMs);
  }
  return {
    update(next) {
      t.textContent = next;
    },
    close() {
      try { t.remove(); } catch {}
    },
  };
}

export function showErrorToast(err, fallbackMessage = 'Something went wrong.') {
  const msg = err && err.message ? err.message : fallbackMessage;
  logger.error(err);
  showToast(msg, { type: 'error', timeoutMs: 4500 });
}


