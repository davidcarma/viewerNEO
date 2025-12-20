const STORAGE_KEY = 'viewerneo_theme'; // 'system' | 'dark' | 'light'

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function getSavedThemeMode() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  return 'system';
}

export function applyThemeMode(mode) {
  const root = document.documentElement;
  const normalized = (mode === 'dark' || mode === 'light' || mode === 'system') ? mode : 'system';

  if (normalized === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', normalized);
  }

  // Let components that read CSS vars update cached palettes
  const resolved = normalized === 'system' ? getSystemTheme() : normalized;
  window.dispatchEvent(new CustomEvent('viewerneo-theme-changed', {
    detail: { mode: normalized, resolved }
  }));
}

export function setThemeMode(mode) {
  const normalized = (mode === 'dark' || mode === 'light' || mode === 'system') ? mode : 'system';
  localStorage.setItem(STORAGE_KEY, normalized);
  applyThemeMode(normalized);
}

export function initThemeSelect(selectEl) {
  if (!selectEl) return;

  const saved = getSavedThemeMode();
  selectEl.value = saved;
  applyThemeMode(saved);

  selectEl.addEventListener('change', () => {
    setThemeMode(selectEl.value);
  });

  // If user is in system mode, follow OS changes live.
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq) {
    const handler = () => {
      if (getSavedThemeMode() === 'system') applyThemeMode('system');
    };
    // Safari compatibility
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler);
    else if (typeof mq.addListener === 'function') mq.addListener(handler);
  }
}


