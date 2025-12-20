/**
 * Manages controls for Grid Viewer windows.
 */

import { createWindow } from './WindowsManager/window-system.js';
import { showErrorToast, showToast } from './app/toast.js';

const RESIZE_PRESET_HEIGHTS = [360, 480, 720, 1080, 1440, 2160, 3000, 3400];

// Helper function to convert HEX to RGBA
function hexToRGBA(hex, opacity) {
    let r = 0, g = 0, b = 0;
    if (!hex) hex = '#FF0000'; // Default to red if hex is invalid

    if (hex.length === 4) { // #RGB
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) { // #RRGGBB
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
    } else { // Fallback for invalid hex - default to red
        r = 255; g = 0; b = 0;
    }
    return `rgba(${r},${g},${b},${parseFloat(opacity)})`;
}

// Define the Grid Viewer Window creation function
export function createGridViewerWindow({ 
    id = `grid-viewer-${Date.now()}`, 
    title = 'Grid Viewer', 
    x = 200, 
    y = 150, 
    width = 700, 
    height = 500, 
    canvasId = `grid-canvas-${Date.now()}`, 
    controlPanelId = `grid-controls-${Date.now()}` 
}) {
    const viewerId = id; 
    const gridCanvasId = `${canvasId}-grid`;
    const gridSettingsContainerId = `${controlPanelId}-grid-settings`;
    const thresholdSettingsContainerId = `${viewerId}-threshold-settings`;
    const extraActionsContainerId = `${viewerId}-extra-actions`;
    const resizeSettingsContainerId = `${viewerId}-resize-settings`;
    const enhanceSettingsContainerId = `${viewerId}-enhance-settings`;

    const contentHtml = `
        <div class="grid-viewer-content">
            <div id="${canvasId}-container" class="grid-viewer-canvas-container">
                <canvas id="${canvasId}"></canvas>
                <canvas id="${gridCanvasId}" class="dynamic-grid-canvas" 
                        style="position: absolute; top: 0; left: 0; pointer-events: none; display: none;">
                </canvas>
            </div>
            <div id="${controlPanelId}" class="grid-viewer-control-panel">
                <div class="gv-controls-scroll">
                <div class="gv-actions-grid">
                    <button id="${viewerId}-show-grid-btn" class="gv-btn gv-btn-primary"
                        onclick="handleShowGridToggle('${viewerId}', '${canvasId}', '${gridCanvasId}', '${gridSettingsContainerId}')">
                    Show Grid
                </button>
                    <button class="gv-btn" title="Reset View" onclick="handleGridViewerResetView('${canvasId}')">Reset View</button>
                    <button class="gv-btn gv-acc-trigger" type="button" data-acc-target="${thresholdSettingsContainerId}">
                        Adaptive Threshold
                    </button>
                    <button class="gv-btn gv-btn-warn" title="Save to Batch" onclick="handleGridViewerButton10('${viewerId}')">Save to Batch</button>
                    </div>

                <div class="gv-accordion" data-accordion-root="${viewerId}">
                    <div class="gv-acc-item" data-acc-item>
                        <button class="gv-btn gv-acc-trigger" type="button" data-acc-target="${gridSettingsContainerId}">
                            Grid Options
                        </button>
                        <div id="${gridSettingsContainerId}" class="gv-acc-panel" hidden>
                            <div class="gv-field">
                                <label class="gv-label" for="${viewerId}-grid-color">Color</label>
                                <input class="gv-color" type="color" id="${viewerId}-grid-color" value="#FF0000">
                    </div>

                            <div class="gv-field">
                                <label class="gv-label" for="${viewerId}-grid-opacity">Opacity</label>
                                <input class="gv-range" type="range" id="${viewerId}-grid-opacity" min="0" max="1" step="0.05" value="0.5">
                            </div>

                            <div class="gv-field">
                                <label class="gv-label" for="${viewerId}-grid-major-spacing">Major Spacing (img px)</label>
                                <input class="gv-input" type="number" id="${viewerId}-grid-major-spacing" value="50" step="0.1" min="0.1">
                            </div>

                            <div class="gv-field">
                                <label class="gv-check">
                                    <input type="checkbox" id="${viewerId}-grid-show-minor" checked>
                                    <span>Show Minor Lines (1/10th)</span>
                        </label>
                    </div>

                            <div class="gv-field">
                                <div class="gv-label">Mode</div>
                                <div class="gv-radio-group">
                                    <label class="gv-radio">
                                        <input type="radio" id="${viewerId}-grid-mode-synced" name="${viewerId}-grid-mode" value="synced" checked>
                                        <span>Synced</span>
                                    </label>
                                    <label class="gv-radio">
                                        <input type="radio" id="${viewerId}-grid-mode-fixed" name="${viewerId}-grid-mode" value="fixed">
                                        <span>Fixed</span>
                        </label>
                    </div>
                    </div>
                </div>
                    </div>

                    <div class="gv-acc-item" data-acc-item>
                        <button class="gv-btn gv-acc-trigger" type="button" data-acc-target="${thresholdSettingsContainerId}">
                            Threshold Options
                </button>
                        <div id="${thresholdSettingsContainerId}" class="gv-acc-panel" hidden>
                            <div class="gv-field">
                                <label class="gv-label" for="${viewerId}-threshold-max-value">Max Value (0-255)</label>
                                <input class="gv-input" type="number" id="${viewerId}-threshold-max-value" value="255" min="0" max="255">
                    </div>

                            <div class="gv-field">
                                <label class="gv-label" for="${viewerId}-threshold-block-size">Block Size (odd number ≥ 3)</label>
                                <input class="gv-input" type="number" id="${viewerId}-threshold-block-size" value="11" min="3" step="2">
                            </div>

                            <div class="gv-field">
                                <label class="gv-label" for="${viewerId}-threshold-c-value">C Value (-50 to 50)</label>
                                <input class="gv-input" type="number" id="${viewerId}-threshold-c-value" value="2" min="-50" max="50" step="0.1">
                            </div>

                            <div class="gv-field">
                                <div class="gv-label">Adaptive Method</div>
                                <div class="gv-radio-group">
                                    <label class="gv-radio">
                                        <input type="radio" id="${viewerId}-threshold-method-mean" name="${viewerId}-threshold-method" value="mean" checked>
                                        <span>Mean C</span>
                        </label>
                                    <label class="gv-radio">
                                        <input type="radio" id="${viewerId}-threshold-method-gaussian" name="${viewerId}-threshold-method" value="gaussian">
                                        <span>Gaussian C</span>
                                    </label>
                    </div>
                            </div>

                            <div class="gv-field">
                                <div class="gv-label">Threshold Type</div>
                                <div class="gv-radio-group">
                                    <label class="gv-radio">
                                        <input type="radio" id="${viewerId}-threshold-type-binary" name="${viewerId}-threshold-type" value="binary" checked>
                                        <span>Binary</span>
                        </label>
                                    <label class="gv-radio">
                                        <input type="radio" id="${viewerId}-threshold-type-binary-inv" name="${viewerId}-threshold-type" value="binary_inv">
                                        <span>Binary Inverted</span>
                                    </label>
                    </div>
                    </div>

                            <button class="gv-btn gv-btn-primary" onclick="handleGridViewerButton3('${viewerId}')">
                                Apply Adaptive Threshold
                            </button>
                    </div>
                </div>

                    <div class="gv-acc-item" data-acc-item>
                        <button class="gv-btn gv-acc-trigger" type="button" data-acc-target="${resizeSettingsContainerId}">
                            Resize & Save
                        </button>
                        <div id="${resizeSettingsContainerId}" class="gv-acc-panel" hidden>
                            <div class="gv-field">
                                <div class="gv-label">Preset Height (px)</div>
                                <div class="gv-row">
                                    <button class="gv-btn gv-btn-ghost" type="button" onclick="handleResizePresetStep('${viewerId}', -1)">−</button>
                                    <select class="select gv-select" id="${viewerId}-resize-height">
                                        ${RESIZE_PRESET_HEIGHTS.map(h => `<option value="${h}">${h}px</option>`).join('')}
                                    </select>
                                    <button class="gv-btn gv-btn-ghost" type="button" onclick="handleResizePresetStep('${viewerId}', 1)">+</button>
                                </div>
                                <div class="gv-help" id="${viewerId}-resize-preview">Maintains aspect ratio (height-based).</div>
                            </div>
                            <button class="gv-btn gv-btn-primary" type="button" onclick="handleResizeAndSave('${viewerId}')">
                                Resize → New Batch → Load
                            </button>
                        </div>
                    </div>

                    <div class="gv-acc-item" data-acc-item>
                        <button class="gv-btn gv-acc-trigger" type="button" data-acc-target="${enhanceSettingsContainerId}">
                            Enhance
                        </button>
                        <div id="${enhanceSettingsContainerId}" class="gv-acc-panel" hidden>
                            <div class="gv-field">
                                <label class="gv-label" for="${viewerId}-enhance-strength">Strength</label>
                                <input class="gv-range" id="${viewerId}-enhance-strength" type="range" min="0" max="100" step="1" value="25">
                                <div class="gv-help">Soften uses blur; Sharpen uses unsharp mask.</div>
                            </div>
                            <div class="gv-actions-grid gv-actions-grid--dense">
                                <button class="gv-btn" type="button" onclick="handleSoftenImage('${viewerId}')">Soften</button>
                                <button class="gv-btn" type="button" onclick="handleSharpenImage('${viewerId}')">Sharpen</button>
                                <button class="gv-btn" type="button" onclick="handleResetToOriginal('${viewerId}')">Reset</button>
                            </div>
                        </div>
                    </div>

                    <div class="gv-acc-item" data-acc-item>
                        <button class="gv-btn gv-acc-trigger" type="button" data-acc-target="${extraActionsContainerId}">
                            More Actions
                        </button>
                        <div id="${extraActionsContainerId}" class="gv-acc-panel" hidden>
                            <div class="gv-actions-grid gv-actions-grid--dense">
                                <button class="gv-btn" onclick="handleGridViewerButton4('${viewerId}')">Action 4</button>
                                <button class="gv-btn" onclick="handleGridViewerButton5('${viewerId}')">Action 5</button>
                                <button class="gv-btn" onclick="handleGridViewerButton6('${viewerId}')">Action 6</button>
                                <button class="gv-btn" onclick="handleGridViewerButton7('${viewerId}')">Action 7</button>
                                <button class="gv-btn" onclick="handleGridViewerButton8('${viewerId}')">Action 8</button>
                                <button class="gv-btn" onclick="handleGridViewerButton9('${viewerId}')">Action 9</button>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
    `;
    const windowFrame = createWindow({ id, title, content: contentHtml, x, y, width, height });
    const viewerCanvas = windowFrame.querySelector(`#${canvasId}`);
    const gridCanvas = windowFrame.querySelector(`#${gridCanvasId}`);
    const canvasContainer = windowFrame.querySelector(`#${canvasId}-container`);

    // Accordion behavior (scoped to this window)
    initGridViewerAccordion(windowFrame, { defaultOpenTargetId: null });

    if (viewerCanvas && gridCanvas && canvasContainer) {
        viewerCanvas.gridCanvasElement = gridCanvas; 
        gridCanvas.isGridVisible = false; 

        // Initialize grid settings
        gridCanvas.gridSettings = {
            color: '#FF0000',
            opacity: 0.5,
            mode: 'synced',
            fixedGridSpacing: 50,      // Screen pixels for fixed mode
            syncedMajorSpacing: 50.0,  // Image pixels for synced mode
            showMinorLines: true,       // New setting for toggling minor lines
            rulersAlwaysVisible: false // Future setting placeholder (not yet used for logic)
        };

        // Setup event listeners for grid settings
        const colorInput = windowFrame.querySelector(`#${viewerId}-grid-color`);
        const opacityInput = windowFrame.querySelector(`#${viewerId}-grid-opacity`);
        const majorSpacingInput = windowFrame.querySelector(`#${viewerId}-grid-major-spacing`);
        const showMinorLinesCheckbox = windowFrame.querySelector(`#${viewerId}-grid-show-minor`);
        const syncedModeRadio = windowFrame.querySelector(`#${viewerId}-grid-mode-synced`);
        const fixedModeRadio = windowFrame.querySelector(`#${viewerId}-grid-mode-fixed`);

        colorInput.addEventListener('input', (e) => {
            gridCanvas.gridSettings.color = e.target.value;
            if (gridCanvas.isGridVisible) {
                drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage, gridCanvas.isGridVisible);
            }
        });
        opacityInput.addEventListener('input', (e) => {
            gridCanvas.gridSettings.opacity = parseFloat(e.target.value);
            if (gridCanvas.isGridVisible) {
                drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage, gridCanvas.isGridVisible);
            }
        });
        majorSpacingInput.addEventListener('input', (e) => {
            let newMajorSpacing = parseFloat(e.target.value);
            if (isNaN(newMajorSpacing) || newMajorSpacing <= 0) {
                // Revert to old value if input is invalid
                e.target.value = gridCanvas.gridSettings.syncedMajorSpacing.toFixed(1);
                return; // Exit without redrawing if invalid
            }
            gridCanvas.gridSettings.syncedMajorSpacing = newMajorSpacing;
            
            // If currently in fixed mode, recalculate fixedGridSpacing based on new syncedMajorSpacing
            if (gridCanvas.gridSettings.mode === 'fixed') {
                const image = window.currentLoadedImage;
                if (image && image !== true && image.naturalWidth && 
                    image.naturalHeight && viewerCanvas.transformState) {
                    const baseFitScale = Math.min(
                        viewerCanvas.width / image.naturalWidth, 
                        viewerCanvas.height / image.naturalHeight
                    );
                    const totalCurrentScale = baseFitScale * viewerCanvas.transformState.scale;
                    let currentOnScreenSpacing = newMajorSpacing * totalCurrentScale;
                    currentOnScreenSpacing = Math.max(currentOnScreenSpacing, 5); 
                    gridCanvas.gridSettings.fixedGridSpacing = currentOnScreenSpacing;
                } else {
                    // Fallback if image/transform info isn't available 
                    // (should be rare if in fixed mode with settings enabled)
                    gridCanvas.gridSettings.fixedGridSpacing = 50; 
                }
            }

            if (gridCanvas.isGridVisible) {
                drawGrid(
                    gridCanvas, 
                    viewerCanvas, 
                    window.currentLoadedImage, 
                    gridCanvas.isGridVisible
                );
            }
        });
        showMinorLinesCheckbox.addEventListener('change', (e) => {
            gridCanvas.gridSettings.showMinorLines = e.target.checked;
            if (gridCanvas.isGridVisible) {
                drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage, gridCanvas.isGridVisible);
            }
        });
        syncedModeRadio.addEventListener('change', (e) => {
            if (e.target.checked) {
                gridCanvas.gridSettings.mode = 'synced';
                if (gridCanvas.isGridVisible) {
                    drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage, gridCanvas.isGridVisible);
                }
            }
        });
        fixedModeRadio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const image = window.currentLoadedImage;
                if (image && image !== true && image.naturalWidth && 
                    image.naturalHeight && viewerCanvas.transformState) {
                    // Calculate current on-screen spacing of synced grid to apply to fixed grid
                    const baseFitScale = Math.min(
                        viewerCanvas.width / image.naturalWidth, 
                        viewerCanvas.height / image.naturalHeight
                    );
                    const totalCurrentScale = baseFitScale * viewerCanvas.transformState.scale;
                    let currentOnScreenSpacing = 
                        gridCanvas.gridSettings.syncedMajorSpacing * totalCurrentScale;
                    
                    // Ensure spacing is reasonable (e.g., not too small)
                    currentOnScreenSpacing = Math.max(currentOnScreenSpacing, 5); 
                    gridCanvas.gridSettings.fixedGridSpacing = currentOnScreenSpacing;
                } else {
                    // Fallback if image/transform info isn't available, use default
                    // This might happen if grid is turned on before an image is loaded.
                    gridCanvas.gridSettings.fixedGridSpacing = 50; // Default fixed spacing
                }

                gridCanvas.gridSettings.mode = 'fixed';
                if (gridCanvas.isGridVisible) {
                    drawGrid(
                        gridCanvas, 
                        viewerCanvas, 
                        window.currentLoadedImage, 
                        gridCanvas.isGridVisible
                    );
                }
            }
        });

        const updateCanvasSize = () => {
            if (canvasContainer.offsetParent === null) return;
            const containerWidth = canvasContainer.clientWidth;
            const containerHeight = canvasContainer.clientHeight;
            
            const currentMainWidth = viewerCanvas.width;
            const currentMainHeight = viewerCanvas.height;
            
            let changed = false;
            if (Math.abs(currentMainWidth - containerWidth) > 1 || viewerCanvas.width === 0) {
                viewerCanvas.width = containerWidth;
                gridCanvas.width = containerWidth;
                changed = true;
            }
            if (Math.abs(currentMainHeight - containerHeight) > 1 || viewerCanvas.height === 0) {
                viewerCanvas.height = containerHeight;
                gridCanvas.height = containerHeight;
                changed = true;
            }
            
            if (changed) {
                const event = new CustomEvent('grid-canvas-resized', { 
                    detail: { 
                        canvas: viewerCanvas, 
                        width: viewerCanvas.width, 
                        height: viewerCanvas.height, 
                        viewerId: viewerId 
                    } 
                });
                // This will trigger redrawCanvas, which in turn calls drawGrid
                viewerCanvas.dispatchEvent(event); 
            }
        };
        // Initialize canvas size
        setTimeout(updateCanvasSize, 0);
        
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === windowFrame) updateCanvasSize();
            }
        });
        resizeObserver.observe(windowFrame);
        windowFrame.gridViewerResizeObserver = resizeObserver; 
    }
    return windowFrame;
}

function initGridViewerAccordion(windowFrame, { defaultOpenTargetId } = {}) {
    if (!windowFrame) return;
    const triggers = windowFrame.querySelectorAll('.gv-acc-trigger[data-acc-target]');
    if (!triggers || triggers.length === 0) return;

    const closeAll = () => {
        windowFrame.querySelectorAll('.gv-acc-item.is-open').forEach(item => {
            item.classList.remove('is-open');
            const panel = item.querySelector('.gv-acc-panel');
            if (panel) panel.hidden = true;
        });
        windowFrame.querySelectorAll('.gv-acc-trigger[aria-expanded="true"]').forEach(t => {
            t.setAttribute('aria-expanded', 'false');
        });
    };

    const openTarget = (targetId) => {
        const panel = windowFrame.querySelector(`#${CSS.escape(targetId)}`);
        if (!panel) return;
        const item = panel.closest('.gv-acc-item');
        if (!item) return;
        closeAll();
        item.classList.add('is-open');
        panel.hidden = false;
        const trigger = windowFrame.querySelector(`.gv-acc-trigger[data-acc-target="${CSS.escape(targetId)}"]`);
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        // ensure visibility
        try { item.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
    };

    const toggleTarget = (targetId) => {
        const panel = windowFrame.querySelector(`#${CSS.escape(targetId)}`);
        if (!panel) return;
        const item = panel.closest('.gv-acc-item');
        if (!item) return;
        const isOpen = item.classList.contains('is-open') && panel.hidden === false;
        if (isOpen) {
            item.classList.remove('is-open');
            panel.hidden = true;
            const trigger = windowFrame.querySelector(`.gv-acc-trigger[data-acc-target="${CSS.escape(targetId)}"]`);
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        } else {
            openTarget(targetId);
        }
    };

    triggers.forEach(trigger => {
        const targetId = trigger.getAttribute('data-acc-target');
        if (!targetId) return;
        trigger.setAttribute('aria-controls', targetId);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.addEventListener('click', (e) => {
            // Avoid interfering with buttons that also have onclick handlers
            if (trigger.id && trigger.id.endsWith('-show-grid-btn')) return;
            e.preventDefault();
            toggleTarget(targetId);
        });
    });

    if (defaultOpenTargetId) openTarget(defaultOpenTargetId);

    // Expose helper for global handlers (grid toggle opens its options)
    windowFrame.__gvAccordion = { openTarget, toggleTarget, closeAll };
}

// Handler functions for grid viewer buttons
function handleGridViewerButton3(viewerId) {
    console.log(`Grid Viewer Button 3 (Adaptive Threshold) clicked for viewer: ${viewerId}`);
    const mainCanvas = window.canvas;
    const mainCtx = window.ctx;

    if (!mainCanvas || !mainCtx) {
        alert("Error: Main display canvas not available.");
        return;
    }

    // Always use the original image as source, not any processed version
    let sourceImage = window.originalLoadedImage || window.currentLoadedImage;
    if (!sourceImage || sourceImage === true) {
        alert("Please load an image first.");
        return;
    }

    // Check if OpenCV manager is available
    if (!window.openCVManager) {
        alert("OpenCV manager is not available. Please ensure the library is loaded.");
        return;
    }

    // Check if OpenCV is ready
    if (!window.openCVManager.ready()) {
        alert("OpenCV library is still loading. Please wait a moment and try again.");
        return;
    }

    try {
        // Read parameter values from the UI
        const maxValueInput = document.getElementById(`${viewerId}-threshold-max-value`);
        const blockSizeInput = document.getElementById(`${viewerId}-threshold-block-size`);
        const cValueInput = document.getElementById(`${viewerId}-threshold-c-value`);
        const methodMeanRadio = document.getElementById(`${viewerId}-threshold-method-mean`);
        const methodGaussianRadio = document.getElementById(`${viewerId}-threshold-method-gaussian`);
        const typeBinaryRadio = document.getElementById(`${viewerId}-threshold-type-binary`);
        const typeBinaryInvRadio = document.getElementById(`${viewerId}-threshold-type-binary-inv`);

        // Get parameter values with validation
        let maxValue = maxValueInput ? parseInt(maxValueInput.value) : 255;
        let blockSize = blockSizeInput ? parseInt(blockSizeInput.value) : 11;
        let cValue = cValueInput ? parseFloat(cValueInput.value) : 2;

        // Validate and correct parameters
        maxValue = Math.max(0, Math.min(255, maxValue));
        blockSize = Math.max(3, blockSize);
        if (blockSize % 2 === 0) blockSize += 1; // Ensure odd number
        cValue = Math.max(-50, Math.min(50, cValue));

        // Determine adaptive method
        let adaptiveMethod = null;
        if (methodGaussianRadio && methodGaussianRadio.checked) {
            adaptiveMethod = window.openCVManager.getCV().ADAPTIVE_THRESH_GAUSSIAN_C;
        } else {
            adaptiveMethod = window.openCVManager.getCV().ADAPTIVE_THRESH_MEAN_C;
        }

        // Determine threshold type
        let thresholdType = null;
        if (typeBinaryInvRadio && typeBinaryInvRadio.checked) {
            thresholdType = window.openCVManager.getCV().THRESH_BINARY_INV;
        } else {
            thresholdType = window.openCVManager.getCV().THRESH_BINARY;
        }

        console.log(`Applying adaptive threshold with parameters:`, {
            maxValue, adaptiveMethod: methodGaussianRadio?.checked ? 'GAUSSIAN_C' : 'MEAN_C',
            thresholdType: typeBinaryInvRadio?.checked ? 'BINARY_INV' : 'BINARY',
            blockSize, cValue
        });

        // Use the OpenCV manager's adaptive threshold function with custom parameters
        const resultCanvas = window.openCVManager.applyAdaptiveThreshold(
            sourceImage, maxValue, adaptiveMethod, thresholdType, blockSize, cValue
        );
        
        if (resultCanvas) {
            // Update the current loaded image
            window.currentLoadedImage = resultCanvas;
            
            // Redraw the main display canvas
            redrawCanvas(mainCanvas);
            
            console.log("Adaptive threshold applied successfully!");
        } else {
            alert("Failed to apply adaptive threshold. Please check the console for details.");
        }
    } catch (error) {
        console.error("OpenCV operation failed:", error);
        alert("An error occurred during image processing: " + error.message);
    }
}

function handleGridViewerButton4(viewerId) {
    console.log(`Grid Viewer Button 4 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton5(viewerId) {
    console.log(`Grid Viewer Button 5 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton6(viewerId) {
    console.log(`Grid Viewer Button 6 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton7(viewerId) {
    console.log(`Grid Viewer Button 7 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton8(viewerId) {
    console.log(`Grid Viewer Button 8 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton9(viewerId) {
    console.log(`Grid Viewer Button 9 clicked for viewer: ${viewerId}`);
}

function getCurrentSourceForProcessing({ preferOriginal = false } = {}) {
    const original = window.originalLoadedImage;
    const current = window.currentLoadedImage;

    const normalizedOriginal = (!original || original === true) ? null : original;
    const normalizedCurrent = (!current || current === true) ? null : current;

    if (preferOriginal) return normalizedOriginal || normalizedCurrent;
    return normalizedCurrent || normalizedOriginal;
}

function getSourceCanvasFromImageLike(imageLike) {
    if (!imageLike) return null;
    if (imageLike instanceof HTMLCanvasElement) return imageLike;
    const w = imageLike.naturalWidth || imageLike.width || 0;
    const h = imageLike.naturalHeight || imageLike.height || 0;
    if (!w || !h) return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(imageLike, 0, 0);
    return c;
}

function resizeCanvasToHeightHighQuality(srcCanvas, targetHeight) {
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    if (!srcW || !srcH) return null;
    const scale = targetHeight / srcH;
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(targetHeight));

    const makeCanvas = (w, h) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    };

    // Progressive downscale for better quality when shrinking a lot
    let curCanvas = srcCanvas;
    let curW = srcW;
    let curH = srcH;
    while (curH / 2 > targetH * 1.25) {
        const nextW = Math.max(1, Math.round(curW / 2));
        const nextH = Math.max(1, Math.round(curH / 2));
        const tmp = makeCanvas(nextW, nextH);
        const tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = true;
        tctx.imageSmoothingQuality = 'high';
        tctx.drawImage(curCanvas, 0, 0, nextW, nextH);
        curCanvas = tmp;
        curW = nextW;
        curH = nextH;
    }

    const out = makeCanvas(targetW, targetH);
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(curCanvas, 0, 0, targetW, targetH);
    return out;
}

function canvasToPngFile(canvas, filename) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Failed to encode PNG'));
                return;
            }
            resolve(new File([blob], filename, { type: 'image/png' }));
        }, 'image/png', 0.95);
    });
}

function getBaseNameFromPanel() {
    const panel = document.getElementById('my-thumbnail-panel');
    const selected = panel && typeof panel.getSelectedThumbnail === 'function' ? panel.getSelectedThumbnail() : null;
    const raw = (selected && selected.name) ? selected.name : 'image';
    return raw.replace(/\.[^/.]+$/, '');
}

async function handleResizeAndSave(viewerId) {
    try {
        const source = getCurrentSourceForProcessing();
        if (!source) {
            alert('Please load an image first.');
            return;
        }

        const selectEl = document.getElementById(`${viewerId}-resize-height`);
        const targetH = selectEl ? parseInt(selectEl.value, 10) : 1080;
        if (!targetH || targetH < 1) {
            alert('Invalid target height.');
            return;
        }

        const srcCanvas = getSourceCanvasFromImageLike(source);
        if (!srcCanvas) {
            alert('Could not read the current image for resizing.');
            return;
        }

        const resizedCanvas = resizeCanvasToHeightHighQuality(srcCanvas, targetH);
        if (!resizedCanvas) {
            alert('Resize failed.');
            return;
        }

        const w = resizedCanvas.width;
        const h = resizedCanvas.height;

        const baseName = getBaseNameFromPanel();
        const filename = `${baseName}_${w}x${h}.png`;
        const file = await canvasToPngFile(resizedCanvas, filename);

        const panel = document.getElementById('my-thumbnail-panel');
        if (panel && typeof panel.createNewBatch === 'function') {
            const batchTitle = `Scaled ${h}px (${w}×${h})`;
            panel.createNewBatch([file], { title: batchTitle, expanded: true });

            // Load the newly created entry into the grid viewer
            const newestEntry = (panel.getNewestFile && typeof panel.getNewestFile === 'function')
                ? (panel.getNewestFile() || { name: file.name, type: file.type, data: file })
                : { name: file.name, type: file.type, data: file };
            window.handleThumbnailImage({ detail: { file: newestEntry } });
        } else {
            // Fallback: just load into viewer
            window.currentLoadedImage = resizedCanvas;
            window.originalLoadedImage = resizedCanvas;
            if (typeof window.redrawCanvas === 'function' && window.canvas) window.redrawCanvas(window.canvas);
        }
    } catch (e) {
        console.error('Resize & Save failed:', e);
        alert(`Resize & Save failed: ${e.message}`);
    }
}

function handleResizePresetStep(viewerId, delta) {
    const selectEl = document.getElementById(`${viewerId}-resize-height`);
    if (!selectEl) return;
    const values = Array.from(selectEl.options).map(o => parseInt(o.value, 10)).filter(Boolean);
    const current = parseInt(selectEl.value, 10);
    let idx = values.indexOf(current);
    if (idx === -1) idx = 0;
    idx = Math.max(0, Math.min(values.length - 1, idx + delta));
    selectEl.value = String(values[idx]);
}

function getEnhanceStrength(viewerId) {
    const el = document.getElementById(`${viewerId}-enhance-strength`);
    const v = el ? parseInt(el.value, 10) : 25;
    return Math.max(0, Math.min(100, isNaN(v) ? 25 : v));
}

function applyOpenCvEnhance(sourceCanvas, mode, strength) {
    if (!window.openCVManager || !window.openCVManager.ready()) return null;
    const cv = window.openCVManager.getCV();
    if (!cv) return null;

    const src = window.openCVManager.createMatFromCanvas(sourceCanvas);
    if (!src) return null;

    const dst = new cv.Mat();
    try {
        if (mode === 'soften') {
            const sigma = 0.5 + (strength / 18); // 0.5..~6
            let k = Math.max(3, Math.round(sigma * 3) | 1); // odd
            if (k > 51) k = 51;
            const ksize = new cv.Size(k, k);
            cv.GaussianBlur(src, dst, ksize, sigma, sigma, cv.BORDER_DEFAULT);
        } else if (mode === 'sharpen') {
            const sigma = 0.5 + (strength / 30); // small blur
            let k = Math.max(3, Math.round(sigma * 3) | 1);
            if (k > 31) k = 31;
            const blurred = new cv.Mat();
            const ksize = new cv.Size(k, k);
            cv.GaussianBlur(src, blurred, ksize, sigma, sigma, cv.BORDER_DEFAULT);
            const amount = strength / 50; // 0..2
            cv.addWeighted(src, 1 + amount, blurred, -amount, 0, dst);
            blurred.delete();
        } else {
            src.delete();
            dst.delete();
            return null;
        }

        const outCanvas = document.createElement('canvas');
        window.openCVManager.displayMatOnCanvas(dst, outCanvas);
        src.delete();
        dst.delete();
        return outCanvas;
    } catch (e) {
        console.error('OpenCV enhance failed:', e);
        try { src.delete(); } catch {}
        try { dst.delete(); } catch {}
        return null;
    }
}

function applyCanvasSoften(sourceCanvas, strength) {
    const out = document.createElement('canvas');
    out.width = sourceCanvas.width;
    out.height = sourceCanvas.height;
    const ctx = out.getContext('2d');
    const px = Math.round((strength / 100) * 6); // 0..6px
    ctx.filter = px > 0 ? `blur(${px}px)` : 'none';
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.filter = 'none';
    return out;
}

function applyCanvasSharpen(sourceCanvas, strength) {
    // Simple 3x3 sharpen kernel (fallback)
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const srcCtx = sourceCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, w, h);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const outCtx = out.getContext('2d');
    const dstData = outCtx.createImageData(w, h);

    const amt = strength / 100; // 0..1
    const kCenter = 1 + 4 * amt;
    const kSide = -amt;
    const data = srcData.data;
    const dst = dstData.data;

    const idx = (x, y) => (y * w + x) * 4;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = idx(x, y);
            for (let c = 0; c < 3; c++) {
                const v = data[i + c] * kCenter
                    + data[idx(Math.max(0, x - 1), y) + c] * kSide
                    + data[idx(Math.min(w - 1, x + 1), y) + c] * kSide
                    + data[idx(x, Math.max(0, y - 1)) + c] * kSide
                    + data[idx(x, Math.min(h - 1, y + 1)) + c] * kSide;
                dst[i + c] = Math.max(0, Math.min(255, v));
            }
            dst[i + 3] = data[i + 3];
        }
    }
    outCtx.putImageData(dstData, 0, 0);
    return out;
}

function applyEnhance(mode, viewerId) {
    // Always start from the original image to avoid compounding artifacts.
    const source = getCurrentSourceForProcessing({ preferOriginal: true });
    if (!source) {
        alert('Please load an image first.');
        return;
    }
    const strength = getEnhanceStrength(viewerId);
    const srcCanvas = getSourceCanvasFromImageLike(source);
    if (!srcCanvas) {
        alert('Could not read the current image.');
        return;
    }

    let outCanvas = applyOpenCvEnhance(srcCanvas, mode, strength);
    if (!outCanvas) {
        outCanvas = mode === 'soften'
            ? applyCanvasSoften(srcCanvas, strength)
            : applyCanvasSharpen(srcCanvas, strength);
    }

    window.currentLoadedImage = outCanvas;
    if (typeof window.redrawCanvas === 'function' && window.canvas) {
        window.redrawCanvas(window.canvas);
    }
}

function handleSoftenImage(viewerId) {
    applyEnhance('soften', viewerId);
}

function handleSharpenImage(viewerId) {
    applyEnhance('sharpen', viewerId);
}

function handleResetToOriginal(viewerId) {
    const src = window.originalLoadedImage;
    if (!src || src === true) return;
    window.currentLoadedImage = src;
    if (typeof window.redrawCanvas === 'function' && window.canvas) {
        window.redrawCanvas(window.canvas);
    }
}

function handleGridViewerButton10(viewerId) {
    console.log(`Grid Viewer Button 10 (Save to Batch) clicked for viewer: ${viewerId}`);
    
    const mainCanvas = window.canvas;
    const currentImage = window.currentLoadedImage;
    
    if (!mainCanvas || !currentImage || currentImage === true) {
        alert("No processed image to save. Please load and process an image first.");
        return;
    }
    
    try {
        // Get the thumbnail panel to access batch data
        const panel = document.getElementById('my-thumbnail-panel');
        if (!panel || typeof panel.getSelectedThumbnail !== 'function') {
            alert("Cannot access thumbnail panel to determine source batch.");
            return;
        }
        
        // Get the currently selected thumbnail to determine which batch it came from
        const selectedThumbnail = panel.getSelectedThumbnail();
        if (!selectedThumbnail) {
            alert("No source image selected. Please select an image from the thumbnail panel first.");
            return;
        }
        
        // Convert the current processed image to a blob
        let sourceCanvas;
        if (currentImage instanceof HTMLCanvasElement) {
            sourceCanvas = currentImage;
        } else if (currentImage instanceof HTMLImageElement) {
            // If it's still an Image element, draw it to a temporary canvas first
            sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = currentImage.naturalWidth || currentImage.width;
            sourceCanvas.height = currentImage.naturalHeight || currentImage.height;
            const tempCtx = sourceCanvas.getContext('2d');
            tempCtx.drawImage(currentImage, 0, 0);
        } else {
            alert("Unsupported image format for saving.");
            return;
        }
        
        // Convert canvas to blob
        sourceCanvas.toBlob((blob) => {
            if (!blob) {
                alert("Failed to create image data for saving.");
                return;
            }
            
            // Create a new file object from the blob
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const originalName = selectedThumbnail.name || 'image';
            const baseName = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
            const newFileName = `${baseName}_processed_${timestamp}.png`;
            
            const processedFile = new File([blob], newFileName, { type: 'image/png' });
            
            // Save using stable public API (avoid relying on internal batch indexing).
            const newBatch = panel.createNewBatch([processedFile], {
                title: `Processed - ${new Date().toLocaleDateString()}`,
                expanded: true
            });

            // Auto-load newest entry if possible
            const newest = (panel.getNewestFile && typeof panel.getNewestFile === 'function')
                ? panel.getNewestFile()
                : (newBatch && newBatch.files && newBatch.files[0] ? newBatch.files[0] : null);
            if (newest && typeof window.handleThumbnailImage === 'function') {
                window.handleThumbnailImage({ detail: { file: newest } });
            }
            
        }, 'image/png', 0.95); // High quality PNG
        
    } catch (error) {
        console.error("Error saving image to batch:", error);
        alert("Failed to save image to batch: " + error.message);
    }
}

function handleShowGridToggle(viewerId, mainCanvasId, gridCanvasId, settingsContainerId) {
    const mainCanvas = document.getElementById(mainCanvasId);
    const gridCanvas = document.getElementById(gridCanvasId);
    const button = document.getElementById(`${viewerId}-show-grid-btn`);
    const settingsContainer = document.getElementById(settingsContainerId);

    if (mainCanvas && gridCanvas && button && settingsContainer) {
        gridCanvas.isGridVisible = !gridCanvas.isGridVisible;
        if (gridCanvas.isGridVisible) {
            gridCanvas.style.display = 'block';
            button.textContent = 'Hide Grid';
            button.classList.add('is-on');

            // Auto-open the options accordion for this action
            try {
                const windowFrame = button.closest('.window-frame');
                if (windowFrame && windowFrame.__gvAccordion) {
                    windowFrame.__gvAccordion.openTarget(settingsContainerId);
                } else {
                    // fallback: show panel if accordion not available
                    settingsContainer.hidden = false;
                }
            } catch {
                settingsContainer.hidden = false;
            }

            const colorInput = document.getElementById(`${viewerId}-grid-color`);
            const opacityInput = document.getElementById(`${viewerId}-grid-opacity`);
            const majorSpacingInputEl = document.getElementById(`${viewerId}-grid-major-spacing`);
            const showMinorLinesCheckboxEl = document.getElementById(`${viewerId}-grid-show-minor`);
            const syncedModeRadio = document.getElementById(`${viewerId}-grid-mode-synced`);
            const fixedModeRadio = document.getElementById(`${viewerId}-grid-mode-fixed`);

            if (colorInput) colorInput.value = gridCanvas.gridSettings.color;
            if (opacityInput) opacityInput.value = gridCanvas.gridSettings.opacity;
            if (majorSpacingInputEl) {
                majorSpacingInputEl.value = gridCanvas.gridSettings.syncedMajorSpacing.toFixed(1);
            }
            if (showMinorLinesCheckboxEl) {
                showMinorLinesCheckboxEl.checked = gridCanvas.gridSettings.showMinorLines;
            }
            if (syncedModeRadio) syncedModeRadio.checked = gridCanvas.gridSettings.mode === 'synced';
            if (fixedModeRadio) fixedModeRadio.checked = gridCanvas.gridSettings.mode === 'fixed';
            
            // No direct drawGrid call here; redrawCanvas will handle it.
        } else {
            gridCanvas.style.display = 'none';
            button.textContent = 'Show Grid';
            button.classList.remove('is-on');
            // Close the options accordion for this action
            try {
                const windowFrame = button.closest('.window-frame');
                if (windowFrame && windowFrame.__gvAccordion) {
                    windowFrame.__gvAccordion.closeAll();
                } else {
                    settingsContainer.hidden = true;
                }
            } catch {
                settingsContainer.hidden = true;
            }
            // When hiding, ensure the grid canvas is cleared explicitly if redrawCanvas doesn't run 
            // immediately or if drawGrid(..., false) doesn't clear everything (it should, but belt-and-suspenders)
            const gridCtx = gridCanvas.getContext('2d');
            gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        }

        // Crucially, trigger a redraw of the main canvas.
        // This will clear the main canvas, redraw the image, and then call drawGrid with the new state.
        // drawGrid will then draw grid/rulers/text on gridCanvas if isGridVisible is true.
        // The text logic in redrawCanvas will then correctly decide whether to draw on mainCanvas.
        if (window.currentLoadedImage) { // Only redraw if there's an image
             redrawCanvas(mainCanvas);
        }

    } else {
        console.error(
            "Could not find canvas, button, or settings container for grid toggle. IDs:", 
            viewerId, mainCanvasId, gridCanvasId, settingsContainerId
        );
    }
}

const RULER_SIZE = 40; // px for ruler thickness - increased to accommodate 4-digit numbers

let __viewerneoUiPalette = null;
function readCssVar(name, fallback) {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        const trimmed = (v || '').trim();
        return trimmed || fallback;
    } catch {
        return fallback;
    }
}

function getUiPalette() {
    if (__viewerneoUiPalette) return __viewerneoUiPalette;
    __viewerneoUiPalette = {
        rulerBg: readCssVar('--ruler-bg', '#444444'),
        rulerText: readCssVar('--ruler-text', '#E0E0E0'),
        rulerLine: readCssVar('--ruler-line', '#AAAAAA'),
    };
    return __viewerneoUiPalette;
}

// Update cached palette on theme changes
try {
    window.addEventListener('viewerneo-theme-changed', () => {
        __viewerneoUiPalette = null;
        // Redraw the active canvas, if present
        if (window.canvas && typeof window.redrawCanvas === 'function') {
            window.redrawCanvas(window.canvas);
        }
    });
} catch {
    // ignore
}

// Define drawGrid globally or ensure it's accessible where needed
function drawGrid(gridCanvas, mainCanvas, image, isGridActuallyVisible) {
    if (!gridCanvas || !mainCanvas || !mainCanvas.transformState) {
        if(gridCanvas){
            const gridCtxClear = gridCanvas.getContext('2d');
            gridCtxClear.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        }
        return;
    }

    const gridCtx = gridCanvas.getContext('2d');
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    // Draw ruler backgrounds if grid (any part of it) is visible
    if (isGridActuallyVisible || gridCanvas.gridSettings.rulersAlwaysVisible) { 
        const palette = getUiPalette();
        gridCtx.fillStyle = palette.rulerBg;
        gridCtx.fillRect(0, 0, gridCanvas.width, RULER_SIZE); // Top ruler bg
        gridCtx.fillRect(0, RULER_SIZE, RULER_SIZE, gridCanvas.height - RULER_SIZE); // Left ruler bg (avoid double draw at corner)
    }

    if (!gridCanvas.isGridVisible || !gridCanvas.gridSettings) {
        // If grid lines are off, but drawGrid was called, 
        // it might be for rulers if rulersAlwaysVisible=true
        // Or, it might be that text should still be drawn if the grid WINDOW is up.
        // For now, if grid lines are off, we don't draw text from here.
        // Text drawing on gridCanvas will only happen if isGridActuallyVisible is true.
    } else {
        const settings = gridCanvas.gridSettings;
        const transform = mainCanvas.transformState; // panX, panY are user's pan from center AFTER baseFitScale applied
        const userScale = transform.scale; // User's zoom factor
        const panX = transform.offsetX; 
        const panY = transform.offsetY;

        // Handle both Image objects (naturalWidth/naturalHeight) and Canvas objects (width/height)
        const natW = image ? image.naturalWidth || image.width || 0 : 0;
        const natH = image ? image.naturalHeight || image.height || 0 : 0;

        // Adjust available drawing area for the grid itself, accounting for rulers
        const gridAreaWidth = gridCanvas.width - RULER_SIZE;
        const gridAreaHeight = gridCanvas.height - RULER_SIZE;
        const gridAreaXOffset = RULER_SIZE;
        const gridAreaYOffset = RULER_SIZE;

        gridCtx.save(); // Save before clipping/translating for grid lines
        
        // Translate context for grid drawing to be inside the ruler bounds
        gridCtx.translate(gridAreaXOffset, gridAreaYOffset);

        if (settings.mode === 'synced') {
            if (!image || natW === 0 || natH === 0) {
                 gridCtx.restore(); // Restore from translate + save
                 // Now draw rulers even if synced grid cannot be drawn
                 drawRulers(gridCtx, mainCanvas, image, settings);
                 return;
            }
            // Adjust mainCanvas effective width/height for baseFitScale, as grid is in smaller area
            const effectiveMainCanvasWidthForFit = mainCanvas.width - RULER_SIZE; 
            const effectiveMainCanvasHeightForFit = mainCanvas.height - RULER_SIZE;
            // The baseFitScale should still relate to how the image fits in the 
            // *original mainCanvas viewport* not the gridArea.
            // The panX/panY also relate to the mainCanvas viewport.
            // So, drawX, drawY for the image are calculated based on mainCanvas.width/height.
            // We need to ensure the grid, drawn in the translated gridArea, 
            // aligns with the image portion visible in that area.

            // Base fit for the *entire image canvas view*
            const baseFitScale = Math.min(mainCanvas.width / natW, mainCanvas.height / natH); 
            const totalCurrentScale = baseFitScale * userScale;
            
            // Full display width of image on main canvas
            const displayWidth = natW * totalCurrentScale; 
            // Full display height of image on main canvas
            const displayHeight = natH * totalCurrentScale; 

            // Top-left of image relative to mainCanvas top-left
            const imageOriginX_on_mainCanvas = (mainCanvas.width - displayWidth) / 2 + panX;
            const imageOriginY_on_mainCanvas = (mainCanvas.height - displayHeight) / 2 + panY;

            // We are now in a context translated by (RULER_SIZE, RULER_SIZE).
            // We need to draw the image features (grid lines) that would appear 
            // in this sub-rectangle.
            // So, we effectively translate the synced grid by the negative of 
            // where the image starts relative to this sub-rectangle.
            gridCtx.translate(
                imageOriginX_on_mainCanvas - RULER_SIZE, 
                imageOriginY_on_mainCanvas - RULER_SIZE
            );
            gridCtx.scale(totalCurrentScale, totalCurrentScale);

            gridCtx.lineWidth = 1 / totalCurrentScale; 

            // Minor grid lines (synced)
            if (settings.showMinorLines) {
                const actualSyncedMinorSpacing = 
                    Math.max(0.1, settings.syncedMajorSpacing / 10.0);
                // Check if minor lines would be too dense on screen (< 1 screen pixel apart)
                if (actualSyncedMinorSpacing * totalCurrentScale >= 1.0) { 
                    const minorColor = hexToRGBA(settings.color, settings.opacity * 0.4);
                    gridCtx.strokeStyle = minorColor;
                    for (let x = 0; x < natW; x += actualSyncedMinorSpacing) {
                        if (x % settings.syncedMajorSpacing !== 0) {
                            gridCtx.beginPath();
                            gridCtx.moveTo(x, 0);
                            gridCtx.lineTo(x, natH);
                            gridCtx.stroke();
                        }
                    }
                    for (let y = 0; y < natH; y += actualSyncedMinorSpacing) {
                        if (y % settings.syncedMajorSpacing !== 0) {
                            gridCtx.beginPath();
                            gridCtx.moveTo(0, y);
                            gridCtx.lineTo(natW, y);
                            gridCtx.stroke();
                        }
                    }
                }
            }

            // Major grid lines (synced)
            const majorColor = hexToRGBA(settings.color, settings.opacity);
            gridCtx.strokeStyle = majorColor;
            for (let x = 0; x <= natW; x += settings.syncedMajorSpacing) {
                gridCtx.beginPath();
                gridCtx.moveTo(x, 0);
                gridCtx.lineTo(x, natH);
                gridCtx.stroke();
            }
            for (let y = 0; y <= natH; y += settings.syncedMajorSpacing) {
                gridCtx.beginPath();
                gridCtx.moveTo(0, y);
                gridCtx.lineTo(natW, y);
                gridCtx.stroke();
            }
        } else if (settings.mode === 'fixed') {
            // Use fixedGridSpacing which is now set dynamically when switching to fixed mode
            const majorFixedSpacing = settings.fixedGridSpacing;
            if (majorFixedSpacing < 5) { // Safety check
                gridCtx.restore(); return;
            }

            gridCtx.lineWidth = 1; 
            
            const majorColor = hexToRGBA(settings.color, settings.opacity);
            
            // Minor lines for fixed mode
            if (settings.showMinorLines) {
                // Ensure minor spacing is at least 0.5 screen px
                const actualFixedMinorSpacing = Math.max(0.5, majorFixedSpacing / 10.0); 
                // Only draw if screen spacing is somewhat reasonable (at least 2px)
                if (actualFixedMinorSpacing >= 2) { 
                    const minorColor = hexToRGBA(settings.color, settings.opacity * 0.4);
                    gridCtx.strokeStyle = minorColor;
                    // Minor Horizontal Lines (Fixed)
                    for (let y = 0; y <= gridAreaHeight; y += actualFixedMinorSpacing) {
                        if (y % majorFixedSpacing !== 0) { 
                            const lineY = Math.floor(y) + 0.5;
                            gridCtx.beginPath();
                            gridCtx.moveTo(0, lineY);
                            gridCtx.lineTo(gridAreaWidth, lineY);
                            gridCtx.stroke();
                        }
                    }
                    // Minor Vertical Lines (Fixed)
                    gridCtx.strokeStyle = minorColor; 
                    for (let x = 0; x <= gridAreaWidth; x += actualFixedMinorSpacing) {
                        if (x % majorFixedSpacing !== 0) { 
                            const lineX = Math.floor(x) + 0.5;
                            gridCtx.beginPath();
                            gridCtx.moveTo(lineX, 0);
                            gridCtx.lineTo(lineX, gridAreaHeight);
                            gridCtx.stroke();
                        }
                    }
                }
            }

            // Major Horizontal Lines (Fixed)
            gridCtx.strokeStyle = majorColor;
            for (let y = 0; y <= gridAreaHeight; y += majorFixedSpacing) {
                const lineY = Math.floor(y) + 0.5;
                gridCtx.beginPath();
                gridCtx.moveTo(0, lineY);
                gridCtx.lineTo(gridAreaWidth, lineY);
                gridCtx.stroke();
            }
            gridCtx.strokeStyle = majorColor;
            for (let x = 0; x <= gridAreaWidth; x += majorFixedSpacing) {
                const lineX = Math.floor(x) + 0.5;
                gridCtx.beginPath();
                gridCtx.moveTo(lineX, 0);
                gridCtx.lineTo(lineX, gridAreaHeight);
                gridCtx.stroke();
            }
        }
        
        gridCtx.restore(); // Restore from the grid-specific translate/scale/clip
    }

    // Rulers are drawn based on isGridActuallyVisible or rulersAlwaysVisible
    if (isGridActuallyVisible || gridCanvas.gridSettings.rulersAlwaysVisible ) { 
        drawRulers(gridCtx, mainCanvas, image, gridCanvas.gridSettings);
    }

    // Informational text drawn on gridCanvas ONLY if the grid/rulers are meant to be visible.
    if (isGridActuallyVisible) {
        gridCtx.save(); 
        // Use the current grid color and opacity for the text
        const settings = gridCanvas.gridSettings;
        // Use grid color, boost opacity for legibility
        gridCtx.fillStyle = hexToRGBA(settings.color, Math.min(1, settings.opacity + 0.4)); 
        gridCtx.font = '12px sans-serif';
        const padding = 10;
        const lineHeight = 15;
        const transformState = mainCanvas.transformState; // get pan an zoom from here.

        if (transformState && transformState.scale !== undefined) {
            gridCtx.textAlign = 'right';
            gridCtx.textBaseline = 'bottom';
            gridCtx.fillText(
                `Zoom: ${Math.round(transformState.scale * 100)}%`, 
                gridCanvas.width - padding, 
                gridCanvas.height - padding
            );
        }

        let textY = gridCanvas.height - padding;
        const textX = (RULER_SIZE + padding < gridCanvas.width - 50) 
                        ? (RULER_SIZE + padding) 
                        : padding; 
        gridCtx.textAlign = 'left';
        gridCtx.textBaseline = 'bottom';

        if (mainCanvas.mouseImagePos) {
            gridCtx.fillText(
                `Mouse: (${mainCanvas.mouseImagePos.x.toFixed(1)}, ${mainCanvas.mouseImagePos.y.toFixed(1)})`, 
                textX, 
                textY
            );
            textY -= lineHeight;
        }
        
        if (transformState && transformState.offsetX !== undefined && 
            transformState.offsetY !== undefined) {
            gridCtx.fillText(
                `Pan: (${Math.round(transformState.offsetX)}, ${Math.round(transformState.offsetY)})`, 
                textX, 
                textY
            );
        }
        gridCtx.restore();
    }
}

function drawRulers(gridCtx, mainCanvas, image, gridSettings) {
    if (!image) return;
    
    // Handle Image objects, Canvas objects, and cv.Mat
    const natW = image.naturalWidth || image.width || (image.cols || 0);
    const natH = image.naturalHeight || image.height || (image.rows || 0);
    
    if (natW === 0 || natH === 0) return; 
    if (!mainCanvas.transformState) return;

    gridCtx.save();
    gridCtx.font = '10px sans-serif';
    const palette = getUiPalette();
    gridCtx.fillStyle = palette.rulerText;
    gridCtx.strokeStyle = palette.rulerLine;

    const transform = mainCanvas.transformState;
    const userScale = transform.scale;
    const panX = transform.offsetX;
    const panY = transform.offsetY;

    const baseFitScale = Math.min(mainCanvas.width / natW, mainCanvas.height / natH);
    const totalCurrentScale = baseFitScale * userScale;

    const displayWidth = natW * totalCurrentScale;
    const displayHeight = natH * totalCurrentScale;

    // Top-left of image relative to mainCanvas top-left 
    // (this is where image pixel 0,0 would be drawn on mainCanvas)
    const imageOriginX_on_mainCanvas = (mainCanvas.width - displayWidth) / 2 + panX;
    const imageOriginY_on_mainCanvas = (mainCanvas.height - displayHeight) / 2 + panY;

    // Function to determine tick spacing based on zoom
    const getTickSpacing = (scale) => {
        // High zoom levels - very granular measurements
        if (scale > 50) return { major: 5, minor: 1, subMinor: 0.5 }; // Extreme zoom
        if (scale > 20) return { major: 10, minor: 5, subMinor: 1 }; // Very high zoom
        if (scale > 10) return { major: 10, minor: 5, subMinor: 2 }; // High zoom
        if (scale > 5) return { major: 20, minor: 10, subMinor: 2 }; // Medium-high zoom
        if (scale > 2) return { major: 20, minor: 10, subMinor: 2 }; // Medium zoom
        if (scale > 0.8) return { major: 50, minor: 20, subMinor: 5 };
        if (scale > 0.3) return { major: 100, minor: 50, subMinor: 10 };
        if (scale > 0.1) return { major: 200, minor: 100, subMinor: 50 };
        if (scale > 0.05) return { major: 500, minor: 250, subMinor: 100 };
        return { major: 1000, minor: 500, subMinor: 200 }; // Zoomed out
    };

    const ticks = getTickSpacing(totalCurrentScale);

    // Top Ruler (X-axis)
    gridCtx.textAlign = 'center';
    gridCtx.textBaseline = 'middle';
    for (let imgX = 0; imgX <= natW; imgX += ticks.subMinor) {
        const screenX = RULER_SIZE + 
                        (imageOriginX_on_mainCanvas + imgX * totalCurrentScale - RULER_SIZE);
        
        if (screenX >= RULER_SIZE && screenX <= mainCanvas.width) {
            let tickHeight = 0;
            let showLabel = false;
            
            if (imgX % ticks.major === 0) {
                tickHeight = RULER_SIZE / 2;
                showLabel = true;
            } else if (imgX % ticks.minor === 0) {
                tickHeight = RULER_SIZE / 3;
                // Show minor labels only at very high zoom levels
                showLabel = totalCurrentScale > 15;
            } else {
                tickHeight = RULER_SIZE / 5;
            }

            gridCtx.beginPath();
            gridCtx.moveTo(screenX, RULER_SIZE - tickHeight);
            gridCtx.lineTo(screenX, RULER_SIZE);
            gridCtx.stroke();

            if (showLabel) {
                // Format numbers appropriately for zoom level
                let labelText;
                if (totalCurrentScale > 30 && imgX !== Math.floor(imgX)) {
                    // Show decimal places only at extreme zoom
                    labelText = imgX.toFixed(1);
                } else {
                    labelText = imgX.toString();
                }
                gridCtx.fillText(labelText, screenX, RULER_SIZE / 2.5);
            }
        }
    }

    // Left Ruler (Y-axis)
    gridCtx.textAlign = 'right';
    gridCtx.textBaseline = 'middle';
    for (let imgY = 0; imgY <= natH; imgY += ticks.subMinor) {
        const screenY = RULER_SIZE + 
                        (imageOriginY_on_mainCanvas + imgY * totalCurrentScale - RULER_SIZE);

        if (screenY >= RULER_SIZE && screenY <= mainCanvas.height) {
            let tickWidth = 0;
            let showLabel = false;
            
            if (imgY % ticks.major === 0) {
                tickWidth = RULER_SIZE / 2;
                showLabel = true;
            } else if (imgY % ticks.minor === 0) {
                tickWidth = RULER_SIZE / 3;
                // Show minor labels only at very high zoom levels
                showLabel = totalCurrentScale > 15;
            } else {
                tickWidth = RULER_SIZE / 5;
            }

            gridCtx.beginPath();
            gridCtx.moveTo(RULER_SIZE - tickWidth, screenY);
            gridCtx.lineTo(RULER_SIZE, screenY);
            gridCtx.stroke();

            if (showLabel) {
                // Format numbers appropriately for zoom level
                let labelText;
                if (totalCurrentScale > 30 && imgY !== Math.floor(imgY)) {
                    // Show decimal places only at extreme zoom
                    labelText = imgY.toFixed(1);
                } else {
                    labelText = imgY.toString();
                }
                // Label the exact coordinates
                gridCtx.fillText(labelText, RULER_SIZE * 0.85, screenY);
            }
        }
    }

    // Draw mouse position markers on rulers
    if (mainCanvas.mouseImagePos && mainCanvas.mouseScreenPos) {
        const mouseImgX = mainCanvas.mouseImagePos.x;
        const mouseImgY = mainCanvas.mouseImagePos.y;
        const mouseScreenX = mainCanvas.mouseScreenPos.x;
        const mouseScreenY = mainCanvas.mouseScreenPos.y;

        // Check if mouse is within the grid area (not over rulers themselves)
        const isMouseOverGridArea = mouseScreenX >= RULER_SIZE && 
                                  mouseScreenX <= mainCanvas.width && 
                                  mouseScreenY >= RULER_SIZE && 
                                  mouseScreenY <= mainCanvas.height;

        if (isMouseOverGridArea) {
            gridCtx.fillStyle = 'rgba(255, 0, 0, 0.8)'; // Bright red for marker

            // Top ruler X marker (corresponds to image X coordinate)
            // Calculate screenX for the mouseImgX position
            const markerScreenX = RULER_SIZE + 
                                (imageOriginX_on_mainCanvas + mouseImgX * totalCurrentScale - RULER_SIZE);
            if (markerScreenX >= RULER_SIZE && markerScreenX <= mainCanvas.width) {
                gridCtx.beginPath();
                gridCtx.moveTo(markerScreenX - 4, 0);
                gridCtx.lineTo(markerScreenX + 4, 0);
                gridCtx.lineTo(markerScreenX, 8);
                gridCtx.closePath();
                gridCtx.fill();
            }

            // Left ruler Y marker (corresponds to image Y coordinate)
            // Calculate screenY for the mouseImgY position
            const markerScreenY = RULER_SIZE + 
                                (imageOriginY_on_mainCanvas + mouseImgY * totalCurrentScale - RULER_SIZE);
            if (markerScreenY >= RULER_SIZE && markerScreenY <= mainCanvas.height) {
                gridCtx.beginPath();
                gridCtx.moveTo(0, markerScreenY - 4);
                gridCtx.lineTo(0, markerScreenY + 4);
                gridCtx.lineTo(8, markerScreenY);
                gridCtx.closePath();
                gridCtx.fill();
            }
        }
    }

    gridCtx.restore();
}

function handleGridViewerResetView(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
        // Reset the transform state to defaults
        canvas.transformState = {
            scale: 1,
            offsetX: 0,
            offsetY: 0
        };
        
        // Reload the original image from the thumbnail panel
        const panel = document.getElementById('my-thumbnail-panel');
        if (panel && typeof panel.getSelectedThumbnail === 'function') {
            const selectedThumbnail = panel.getSelectedThumbnail();
            if (selectedThumbnail) {
                console.log("Resetting view and reloading original image:", selectedThumbnail.name);
                
                // Clear current processed image and reload original
                window.currentLoadedImage = null;
                window.originalLoadedImage = null;
                
                // Trigger the thumbnail selection event to reload the original image
                const syntheticEvent = { detail: { file: selectedThumbnail } };
                window.handleThumbnailImage(syntheticEvent);
                
                return; // handleThumbnailImage will call redrawCanvas
            }
        }
        
        // Fallback: just reset view if no thumbnail is selected
        console.log("Resetting view only (no original image to reload)");
        redrawCanvas(canvas);
    }
}

// Make functions globally accessible for onclick handlers
window.handleGridViewerResetView = handleGridViewerResetView;
window.handleGridViewerButton3 = handleGridViewerButton3;
window.handleGridViewerButton4 = handleGridViewerButton4;
window.handleGridViewerButton5 = handleGridViewerButton5;
window.handleGridViewerButton6 = handleGridViewerButton6;
window.handleGridViewerButton7 = handleGridViewerButton7;
window.handleGridViewerButton8 = handleGridViewerButton8;
window.handleGridViewerButton9 = handleGridViewerButton9;
window.handleGridViewerButton10 = handleGridViewerButton10;
window.handleShowGridToggle = handleShowGridToggle; 
window.handleResizeAndSave = handleResizeAndSave;
window.handleResizePresetStep = handleResizePresetStep;
window.handleSoftenImage = handleSoftenImage;
window.handleSharpenImage = handleSharpenImage;
window.handleResetToOriginal = handleResetToOriginal;

// Function to redraw the canvas with the current transform state
export function redrawCanvas(canvas) {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const img = window.currentLoadedImage;
    
    if (!img || img === true) {
        // If no image or just a placeholder value, clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw placeholder text
        ctx.fillStyle = 'rgba(238, 238, 238, 0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = Math.min(canvas.width / 20, canvas.height / 10, 16);
        ctx.font = `${fontSize}px sans-serif`;
        if (canvas.width > 0 && canvas.height > 0) {
            ctx.fillText("Select an image from the panel.", canvas.width / 2, canvas.height / 2);
        }
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get transform state or create default if none exists
    if (!canvas.transformState) {
        canvas.transformState = {
            scale: 1,       // User-applied zoom factor (1.0 = no additional zoom)
            offsetX: 0,     // Pan X from true center
            offsetY: 0      // Pan Y from true center
        };
    }
    
    const userScale = canvas.transformState.scale;
    const panX = canvas.transformState.offsetX;
    const panY = canvas.transformState.offsetY;
    
    // Handle Image objects, Canvas objects, and potentially cv.Mat
    const natW = img.naturalWidth || img.width || (img.cols || 0);
    const natH = img.naturalHeight || img.height || (img.rows || 0);
    
    if (natW === 0 || natH === 0) return;
    
    // Calculate the base scale to fit the image within the canvas initially
    const baseFitScale = Math.min(canvas.width / natW, canvas.height / natH);
    
    // Calculate the total current scale applied to the image
    const totalCurrentScale = baseFitScale * userScale;
    
    // Calculate the dimensions of the image as it will be displayed
    const displayWidth = natW * totalCurrentScale;
    const displayHeight = natH * totalCurrentScale;
    
    // Calculate the top-left position for drawing:
    // 1. Start with centering the (fully scaled) image in the canvas.
    // 2. Apply the panX and panY offsets.
    const drawX = (canvas.width - displayWidth) / 2 + panX;
    const drawY = (canvas.height - displayHeight) / 2 + panY;
    
    // Draw the image with the current transform
    try {
        ctx.drawImage(img, drawX, drawY, displayWidth, displayHeight);
        
        let gridIsVisible = false;
        if (canvas.gridCanvasElement) { 
            // Pass a flag if the grid lines/rulers themselves are visible for text drawing decision
            drawGrid(
                canvas.gridCanvasElement, 
                canvas, 
                img, 
                canvas.gridCanvasElement.isGridVisible
            );
            if (canvas.gridCanvasElement.isGridVisible) {
                gridIsVisible = true;
            }
        } 

        // If the grid/rulers (and their text) are NOT visible, draw text on main canvas.
        if (!gridIsVisible) {
            // Use the default grid color (red) and a high opacity when grid is off
            // Get default color from where gridSettings are initialized or define it here.
            // For simplicity, let's assume the default is known or take it 
            // from a potential global default.
            // If gridCanvasElement exists, we can peek at its default settings.
            let textColor = 'rgba(220, 220, 220, 0.9)'; // Fallback default
            if (canvas.gridCanvasElement && canvas.gridCanvasElement.gridSettings) {
                 // Use the current grid color, even if grid is not visible itself, for consistency
                textColor = hexToRGBA(canvas.gridCanvasElement.gridSettings.color, 0.9);
            } else {
                // If grid element/settings don't exist yet, use a hardcoded default red
                textColor = hexToRGBA('#FF0000', 0.9);
            }
            ctx.fillStyle = textColor;
            ctx.font = '12px sans-serif';
            const padding = 10;
            const lineHeight = 15;

            // Zoom: Bottom-right of main canvas
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(
                `Zoom: ${Math.round(userScale * 100)}%`, 
                canvas.width - padding, 
                canvas.height - padding
            );
            
            let textY_main = canvas.height - padding;
            const textX_main = padding; 
            ctx.textAlign = 'left';

            if (canvas.mouseImagePos) {
                ctx.fillText(
                    `Mouse: (${canvas.mouseImagePos.x.toFixed(1)}, ${canvas.mouseImagePos.y.toFixed(1)})`, 
                    textX_main, 
                    textY_main
                );
                textY_main -= lineHeight;
            }
            ctx.fillText(
                `Pan: (${Math.round(panX)}, ${Math.round(panY)})`, 
                textX_main, 
                textY_main
            );
        }
        
    } catch (err) {
        console.error("Error drawing image:", err);
    }
}

// Set up canvas handling for loaded images
export function setupCanvasImageHandling(newCanvas, newContext) {
    if (!newCanvas || !newContext) return;
    
    newCanvas.mouseImagePos = null; // Initialize mouse position store
    newCanvas.mouseScreenPos = null; // Initialize screen position store

    // rAF-throttled redraw to avoid re-rendering on every mouse event.
    let redrawQueued = false;
    const scheduleRedraw = () => {
        if (redrawQueued) return;
        redrawQueued = true;
        requestAnimationFrame(() => {
            redrawQueued = false;
            redrawCanvas(newCanvas);
        });
    };

    // Right-click: copy full-resolution image to clipboard (grid included only if enabled)
    attachFullResCopyContextMenu(newCanvas);

    // Clear canvas and display initial message
    newContext.clearRect(0, 0, newCanvas.width, newCanvas.height);
    newContext.fillStyle = 'rgba(238, 238, 238, 0.7)';
    newContext.textAlign = 'center';
    newContext.textBaseline = 'middle';
    const fontSize = Math.min(newCanvas.width / 20, newCanvas.height / 10, 16);
    newContext.font = `${fontSize}px sans-serif`;
    if (newCanvas.width > 0 && newCanvas.height > 0) {
        newContext.fillText(
            "Select an image from the panel.", 
            newCanvas.width / 2, 
            newCanvas.height / 2
        );
    }
    
    // Initialize transformation state for the canvas
    newCanvas.transformState = {
        scale: 1,
        offsetX: 0,
        offsetY: 0
    };
    
    // Set default cursor to grab (indicates draggable)
    newCanvas.style.cursor = 'grab';
    
    // Set up mouse wheel event for zooming with simpler, more accurate tracking
    newCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        if (!window.currentLoadedImage || window.currentLoadedImage === true) return;
        
        const img = window.currentLoadedImage;
        const natW = img.naturalWidth || img.width || 0;
        const natH = img.naturalHeight || img.height || 0;

        if (natW === 0 || natH === 0) return;
        
        if (!newCanvas.transformState) {
            newCanvas.transformState = { scale: 1, offsetX: 0, offsetY: 0 };
        }
        
        const currentPanX = newCanvas.transformState.offsetX;
        const currentPanY = newCanvas.transformState.offsetY;
        const currentUserScale = newCanvas.transformState.scale;
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newUserScale = Math.min(Math.max(currentUserScale * zoomFactor, 0.1), 100); 

        const rect = newCanvas.getBoundingClientRect();
        const mcx = e.clientX - rect.left;
        const mcy = e.clientY - rect.top;

        const baseFitScale = Math.min(newCanvas.width / natW, newCanvas.height / natH);

        const currentTotalScale = baseFitScale * currentUserScale;
        const currentDisplayWidth = natW * currentTotalScale;
        const currentDisplayHeight = natH * currentTotalScale;
        
        const currentImgTopLeftX = (newCanvas.width - currentDisplayWidth) / 2 + currentPanX;
        const currentImgTopLeftY = (newCanvas.height - currentDisplayHeight) / 2 + currentPanY;

        const newTotalScale = baseFitScale * newUserScale;
        const newDisplayWidth = natW * newTotalScale;
        const newDisplayHeight = natH * newTotalScale;

        const finalPanX = mcx - (newCanvas.width - newDisplayWidth) / 2 - (mcx - currentImgTopLeftX) * (newUserScale / currentUserScale);
        const finalPanY = mcy - (newCanvas.height - newDisplayHeight) / 2 - (mcy - currentImgTopLeftY) * (newUserScale / currentUserScale);
        
        newCanvas.transformState = {
            scale: newUserScale,
            offsetX: finalPanX,
            offsetY: finalPanY
        };

        // If in fixed grid mode, update its fixedGridSpacing based on the new zoom level
        if (newCanvas.gridCanvasElement && 
            newCanvas.gridCanvasElement.gridSettings && 
            newCanvas.gridCanvasElement.gridSettings.mode === 'fixed') {
            
            const gridCanvas = newCanvas.gridCanvasElement;
            // Recalculate fixedGridSpacing based on syncedMajorSpacing and new totalCurrentScale
            // totalCurrentScale here uses newUserScale which is now in newCanvas.transformState.scale
            const effectiveTotalScale = baseFitScale * newCanvas.transformState.scale; 
            let currentOnScreenSpacing = 
                gridCanvas.gridSettings.syncedMajorSpacing * effectiveTotalScale;
            currentOnScreenSpacing = Math.max(currentOnScreenSpacing, 5); // Ensure minimum 5px spacing
            gridCanvas.gridSettings.fixedGridSpacing = currentOnScreenSpacing;
        }
        
        // Zoom should feel immediate but still benefits from rAF batching
        scheduleRedraw();
        // The drawGrid call within redrawCanvas will now use the updated fixedGridSpacing 
        // if in fixed mode. No need for a separate drawGrid call here for the grid canvas 
        // text part as redrawCanvas handles it.
    }, { passive: false });
    
    // Capture mouse move for coordinate display and ruler marking
    newCanvas.addEventListener('mousemove', (e) => {
        // Ensure cursor is set to grab when hovering (if not currently dragging)
        if (!isDragging) {
            newCanvas.style.cursor = 'grab';
        }
        
        if (!window.currentLoadedImage || 
            window.currentLoadedImage === true || 
            !newCanvas.transformState) {
            newCanvas.mouseImagePos = null;
            newCanvas.mouseScreenPos = null;
            scheduleRedraw(); // Redraw to clear old mouse coords if any
            return;
        }

        const img = window.currentLoadedImage;
        const natW = img.naturalWidth || img.width || 0;
        const natH = img.naturalHeight || img.height || 0;
        if (natW === 0 || natH === 0) {
            newCanvas.mouseImagePos = null;
            newCanvas.mouseScreenPos = null;
            scheduleRedraw();
            return;
        }

        const rect = newCanvas.getBoundingClientRect();
        const mouseX_on_canvas = e.clientX - rect.left;
        const mouseY_on_canvas = e.clientY - rect.top;
        newCanvas.mouseScreenPos = { x: mouseX_on_canvas, y: mouseY_on_canvas };

        const transform = newCanvas.transformState;
        const userScale = transform.scale;
        const panX = transform.offsetX;
        const panY = transform.offsetY;

        const baseFitScale = Math.min(newCanvas.width / natW, newCanvas.height / natH);
        const totalCurrentScale = baseFitScale * userScale;

        if (totalCurrentScale === 0) { // Avoid division by zero
            newCanvas.mouseImagePos = null;
            scheduleRedraw();
            return;
        }

        const displayWidth = natW * totalCurrentScale;
        const displayHeight = natH * totalCurrentScale;

        // Top-left of image relative to newCanvas top-left
        const imageOriginX_on_canvas = (newCanvas.width - displayWidth) / 2 + panX;
        const imageOriginY_on_canvas = (newCanvas.height - displayHeight) / 2 + panY;

        // Mouse position relative to the image's top-left (0,0) point
        const mouseX_relative_to_image_origin = mouseX_on_canvas - imageOriginX_on_canvas;
        const mouseY_relative_to_image_origin = mouseY_on_canvas - imageOriginY_on_canvas;

        // Convert to image coordinates
        const imageMouseX = mouseX_relative_to_image_origin / totalCurrentScale;
        const imageMouseY = mouseY_relative_to_image_origin / totalCurrentScale;

        newCanvas.mouseImagePos = { x: imageMouseX, y: imageMouseY };
        
        // Trigger redraw of canvas (which will call drawGrid, then drawRulers)
        scheduleRedraw();
    });

    newCanvas.addEventListener('mouseleave', (e) => {
        newCanvas.mouseImagePos = null;
        newCanvas.mouseScreenPos = null;
        // Reset cursor when leaving canvas
        newCanvas.style.cursor = 'default';
        scheduleRedraw(); // Redraw to clear mouse coords and ruler markers
    });

    // Set up mouse events for panning
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    newCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only handle left mouse button
        
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        newCanvas.style.cursor = 'grabbing';
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        
        lastX = e.clientX;
        lastY = e.clientY;
        
        if (newCanvas.transformState) {
            newCanvas.transformState.offsetX += deltaX;
            newCanvas.transformState.offsetY += deltaY;
            
            // redrawCanvas already redraws the image + grid, so don't double-draw here
            scheduleRedraw();
        }
    });
    
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            newCanvas.style.cursor = 'grab'; // Return to grab cursor after dragging
        }
    });
    
    // Double-click to reset view
    newCanvas.addEventListener('dblclick', () => {
        // Reset the transform state
        newCanvas.transformState = {
            scale: 1,
            offsetX: 0,
            offsetY: 0
        };
        
        // Redraw the canvas with the reset state
        redrawCanvas(newCanvas);
    });
    
    // Set up event listener for canvas resizing
    newCanvas.addEventListener('grid-canvas-resized', (e) => {
        const { canvas: resizedMainCanvas } = e.detail;
        if (window.currentLoadedImage) {
            redrawCanvas(resizedMainCanvas); // This will redraw the main image and the grid
        } else if (resizedMainCanvas.gridCanvasElement) {
            // If no image, but grid canvas exists, ensure it's cleared if visible
            const gridCanvas = resizedMainCanvas.gridCanvasElement;
            const gridCtx = gridCanvas.getContext('2d');
            gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        }
    });
    
    // Make the redrawCanvas function available globally for index.html to use
    window.redrawCanvas = redrawCanvas;
} 

function attachFullResCopyContextMenu(canvas) {
    if (!canvas || canvas.__vnCopyMenuAttached) return;
    canvas.__vnCopyMenuAttached = true;

    let menuEl = null;
    const removeMenu = () => {
        if (menuEl && document.body.contains(menuEl)) {
            document.body.removeChild(menuEl);
        }
        menuEl = null;
        window.removeEventListener('mousedown', onOutsideClick, true);
        window.removeEventListener('scroll', removeMenu, true);
        window.removeEventListener('resize', removeMenu, true);
    };

    const onOutsideClick = (e) => {
        if (!menuEl) return;
        if (e.target === menuEl || menuEl.contains(e.target)) return;
        removeMenu();
    };

    canvas.addEventListener('contextmenu', (e) => {
        // Custom menu since native browser context menu cannot be extended.
        e.preventDefault();
        e.stopPropagation();

        removeMenu();

        const gridEnabled = !!(canvas.gridCanvasElement && canvas.gridCanvasElement.isGridVisible);

        menuEl = document.createElement('div');
        menuEl.className = 'vn-context-menu';
        menuEl.style.cssText = `
            position: fixed;
            left: ${Math.min(window.innerWidth - 220, Math.max(8, e.clientX))}px;
            top: ${Math.min(window.innerHeight - 90, Math.max(8, e.clientY))}px;
            width: 210px;
            border-radius: 12px;
            border: 1px solid var(--border, rgba(255,255,255,0.14));
            background: color-mix(in srgb, var(--surface-2, #111) 82%, rgba(0,0,0,0.32));
            box-shadow: 0 18px 50px rgba(0,0,0,0.38);
            backdrop-filter: blur(10px);
            padding: 6px;
            z-index: 10060;
            color: var(--text, #fff);
            font-family: var(--font-sans, ui-sans-serif, system-ui);
        `;

        const item = document.createElement('button');
        item.type = 'button';
        item.textContent = gridEnabled ? 'Copy image (full res + grid)' : 'Copy image (full res)';
        item.style.cssText = `
            width: 100%;
            text-align: left;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid transparent;
            background: transparent;
            color: var(--text, #fff);
            font-size: 12px;
            font-weight: 650;
            cursor: pointer;
        `;
        item.addEventListener('mouseenter', () => {
            item.style.background = 'color-mix(in srgb, var(--btn-bg-hover, rgba(255,255,255,0.10)) 70%, transparent)';
            item.style.borderColor = 'var(--border, rgba(255,255,255,0.14))';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
            item.style.borderColor = 'transparent';
        });
        item.addEventListener('click', async () => {
            try {
                await copyFullResolutionToClipboard(canvas, { includeGrid: gridEnabled });
                showToast('Copied full-resolution image to clipboard.', { type: 'success' });
            } catch (err) {
                showErrorToast(err, 'Copy failed. Your browser may block clipboard writes.');
            } finally {
                removeMenu();
            }
        });

        const hint = document.createElement('div');
        hint.textContent = 'Uses the original image resolution.';
        hint.style.cssText = `
            padding: 6px 10px 8px 10px;
            font-size: 11px;
            color: color-mix(in srgb, var(--muted, #aaa) 92%, transparent);
        `;

        menuEl.appendChild(item);
        menuEl.appendChild(hint);
        document.body.appendChild(menuEl);

        window.addEventListener('mousedown', onOutsideClick, true);
        window.addEventListener('scroll', removeMenu, true);
        window.addEventListener('resize', removeMenu, true);
    });
}

async function copyFullResolutionToClipboard(mainCanvas, { includeGrid }) {
    if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
        throw new Error('Clipboard API not available. Serve over https/localhost and allow clipboard permissions.');
    }

    const source = window.originalLoadedImage || window.currentLoadedImage;
    if (!source || source === true) throw new Error('No image loaded.');

    // Build an export canvas at native resolution
    const srcCanvas = (source instanceof HTMLCanvasElement)
        ? source
        : imageToCanvas(source);
    if (!srcCanvas) throw new Error('Could not read source image.');

    const out = document.createElement('canvas');
    out.width = srcCanvas.width;
    out.height = srcCanvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0);

    if (includeGrid && mainCanvas.gridCanvasElement && mainCanvas.gridCanvasElement.gridSettings) {
        drawGridForExport(ctx, srcCanvas.width, srcCanvas.height, mainCanvas);
    }

    const blob = await new Promise((resolve, reject) => {
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG'))), 'image/png', 0.95);
    });

    // ClipboardItem is required for images
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
}

function imageToCanvas(img) {
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (!w || !h) return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return c;
}

function drawGridForExport(ctx, width, height, mainCanvas) {
    const gridCanvas = mainCanvas.gridCanvasElement;
    const settings = gridCanvas.gridSettings;

    // Determine major spacing in image pixels:
    let majorSpacingImgPx = settings.syncedMajorSpacing || 50;
    if (settings.mode === 'fixed') {
        // Convert on-screen spacing to image pixels based on current zoom state
        const image = window.currentLoadedImage;
        const natW = image ? (image.naturalWidth || image.width || 0) : 0;
        const natH = image ? (image.naturalHeight || image.height || 0) : 0;
        if (natW && natH && mainCanvas.transformState) {
            const baseFitScale = Math.min(mainCanvas.width / natW, mainCanvas.height / natH);
            const totalCurrentScale = baseFitScale * mainCanvas.transformState.scale;
            if (totalCurrentScale > 0) {
                majorSpacingImgPx = Math.max(1, settings.fixedGridSpacing / totalCurrentScale);
            }
        }
    }

    const minorSpacing = settings.showMinorLines ? Math.max(1, majorSpacingImgPx / 10) : null;

    // Use the same colors/opacity as overlay
    const majorColor = hexToRGBA(settings.color, settings.opacity);
    const minorColor = hexToRGBA(settings.color, Math.min(1, settings.opacity * 0.4));

    ctx.save();
    ctx.lineWidth = 1;

    if (minorSpacing) {
        ctx.strokeStyle = minorColor;
        for (let x = 0; x <= width; x += minorSpacing) {
            if (Math.round(x) % Math.round(majorSpacingImgPx) === 0) continue;
            ctx.beginPath();
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += minorSpacing) {
            if (Math.round(y) % Math.round(majorSpacingImgPx) === 0) continue;
            ctx.beginPath();
            ctx.moveTo(0, Math.round(y) + 0.5);
            ctx.lineTo(width, Math.round(y) + 0.5);
            ctx.stroke();
        }
    }

    ctx.strokeStyle = majorColor;
    for (let x = 0; x <= width; x += majorSpacingImgPx) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, height);
        ctx.stroke();
    }
    for (let y = 0; y <= height; y += majorSpacingImgPx) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(width, Math.round(y) + 0.5);
        ctx.stroke();
    }
    ctx.restore();
} 