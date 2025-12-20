const STORAGE_KEY = 'viewerneo_debug'; // set to "1" to enable debug logs

function isDebugEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const logger = {
  debug(...args) {
    if (isDebugEnabled()) console.debug('[ViewerNeo]', ...args);
  },
  info(...args) {
    if (isDebugEnabled()) console.info('[ViewerNeo]', ...args);
  },
  warn(...args) {
    console.warn('[ViewerNeo]', ...args);
  },
  error(...args) {
    console.error('[ViewerNeo]', ...args);
  },
};

export function setDebugEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}


