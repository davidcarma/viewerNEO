import { updateGridSettings } from './settings.js';

export function initGridControls() {
  const sizeInput = document.getElementById('grid-size');
  const colorInput = document.getElementById('grid-color');
  const opacityInput = document.getElementById('grid-opacity');
  const fixedSwitch = document.getElementById('grid-fixed-switch');

  if (!sizeInput || !colorInput || !opacityInput || !fixedSwitch) {
    console.warn('Grid controls not found in DOM');
    return;
  }

  sizeInput.addEventListener('change', () => {
    const value = parseFloat(sizeInput.value) || 100;
    updateGridSettings({ size: value });
  });

  colorInput.addEventListener('input', () => {
    updateGridSettings({ color: colorInput.value });
  });

  opacityInput.addEventListener('input', () => {
    const valNum = parseInt(opacityInput.value, 10);
    document.getElementById('grid-opacity-label').textContent = `${valNum}%`;
    const val = Math.min(Math.max(valNum, 0), 100) / 100;
    updateGridSettings({ opacity: val });
  });

  fixedSwitch.addEventListener('change', () => {
    updateGridSettings({ fixed: fixedSwitch.checked });
  });

  const styleSelect = document.getElementById('grid-line-style');
  styleSelect.addEventListener('change', () => {
    updateGridSettings({ lineStyle: styleSelect.value });
  });
} 