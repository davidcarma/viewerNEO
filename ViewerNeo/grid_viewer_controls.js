/**
 * Manages controls for Grid Viewer windows.
 */

import { createWindow } from '../WindowsManager/window-system.js';

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

    const contentHtml = `
        <div class="grid-viewer-content">
            <div id="${canvasId}-container" class="grid-viewer-canvas-container">
                <canvas id="${canvasId}"></canvas>
                <canvas id="${gridCanvasId}" class="dynamic-grid-canvas" 
                        style="position: absolute; top: 0; left: 0; pointer-events: none; display: none;">
                </canvas>
            </div>
            <div id="${controlPanelId}" class="grid-viewer-control-panel">
                <button id="${viewerId}-show-grid-btn" 
                        onclick="handleShowGridToggle('${viewerId}', '${canvasId}', '${gridCanvasId}', '${gridSettingsContainerId}')">
                    Show Grid
                </button>
                <button onclick="handleGridViewerResetView('${canvasId}')">Reset View</button>
                <div id="${gridSettingsContainerId}" 
                     style="display: none; margin-top: 10px; border-top: 1px solid #4a4a4a; padding-top: 10px;">
                    <p style="margin-top:0; margin-bottom: 5px; font-size: 0.9em; color: #ccc;">
                        Grid Settings:
                    </p>
                    <div>
                        <label for="${viewerId}-grid-color" style="font-size:0.85em;">Color:</label>
                        <input type="color" id="${viewerId}-grid-color" value="#FF0000" 
                               style="width: 50%; margin-bottom:5px;">
                    </div>
                    <div>
                        <label for="${viewerId}-grid-opacity" style="font-size:0.85em;">Opacity:</label>
                        <input type="range" id="${viewerId}-grid-opacity" min="0" max="1" step="0.05" value="0.5" 
                               style="width: 100%; margin-bottom:5px;">
                    </div>
                    <div style="font-size:0.85em; margin-bottom: 5px;">
                        <label for="${viewerId}-grid-major-spacing" style="display:block; margin-bottom:2px;">
                            Major Spacing (img px):
                        </label>
                        <input type="number" id="${viewerId}-grid-major-spacing" value="50" step="0.1" min="0.1" 
                               style="width: 98%; margin-bottom:3px;">
                    </div>
                    <div style="font-size:0.85em; margin-bottom: 8px;">
                        <input type="checkbox" id="${viewerId}-grid-show-minor" checked 
                               style="margin-right: 5px; vertical-align: middle;">
                        <label for="${viewerId}-grid-show-minor" style="vertical-align: middle;">
                            Show Minor Lines (1/10th)
                        </label>
                    </div>
                    <div style="font-size:0.85em;">
                        <label style="display:block; margin-bottom:3px;">Mode:</label>
                        <input type="radio" id="${viewerId}-grid-mode-synced" name="${viewerId}-grid-mode" 
                               value="synced" checked>
                        <label for="${viewerId}-grid-mode-synced">Synced</label><br>
                        <input type="radio" id="${viewerId}-grid-mode-fixed" name="${viewerId}-grid-mode" 
                               value="fixed">
                        <label for="${viewerId}-grid-mode-fixed">Fixed</label>
                    </div>
                </div>
                <button onclick="handleGridViewerButton3('${viewerId}')" style="margin-top:10px;">
                    Action 3
                </button>
                <button onclick="handleGridViewerButton4('${viewerId}')">Action 4</button>
                <button onclick="handleGridViewerButton5('${viewerId}')">Action 5</button>
            </div>
        </div>
    `;
    const windowFrame = createWindow({ id, title, content: contentHtml, x, y, width, height });
    const viewerCanvas = windowFrame.querySelector(`#${canvasId}`);
    const gridCanvas = windowFrame.querySelector(`#${gridCanvasId}`);
    const canvasContainer = windowFrame.querySelector(`#${canvasId}-container`);

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

// Handler functions for grid viewer buttons
function handleGridViewerButton3(viewerId) {
    console.log(`Grid Viewer Button 3 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton4(viewerId) {
    console.log(`Grid Viewer Button 4 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton5(viewerId) {
    console.log(`Grid Viewer Button 5 clicked for viewer: ${viewerId}`);
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
            settingsContainer.style.display = 'block';
            button.textContent = 'Hide Grid';
            button.style.backgroundColor = '#5cb85c';

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
            settingsContainer.style.display = 'none';
            button.textContent = 'Show Grid';
            button.style.backgroundColor = ''; 
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
const RULER_BG_COLOR = '#444444';
const RULER_TEXT_COLOR = '#E0E0E0';
const RULER_LINE_COLOR = '#AAAAAA';

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
        gridCtx.fillStyle = RULER_BG_COLOR;
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

        const natW = image ? image.naturalWidth : 0;
        const natH = image ? image.naturalHeight : 0;

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
    if (!image || image.naturalWidth === 0 || image.naturalHeight === 0) return; 
    if (!mainCanvas.transformState) return;

    gridCtx.save();
    gridCtx.font = '10px sans-serif';
    gridCtx.fillStyle = RULER_TEXT_COLOR;
    gridCtx.strokeStyle = RULER_LINE_COLOR;

    const transform = mainCanvas.transformState;
    const userScale = transform.scale;
    const panX = transform.offsetX;
    const panY = transform.offsetY;
    const natW = image.naturalWidth;
    const natH = image.naturalHeight;

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
        
        // Redraw the canvas with the reset state
        console.log("Resetting view via button click");
        redrawCanvas(canvas);
    }
}

// Make functions globally accessible for onclick handlers
window.handleGridViewerResetView = handleGridViewerResetView;
window.handleGridViewerButton3 = handleGridViewerButton3;
window.handleGridViewerButton4 = handleGridViewerButton4;
window.handleGridViewerButton5 = handleGridViewerButton5;
window.handleShowGridToggle = handleShowGridToggle; 

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
    
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    
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
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

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
        
        redrawCanvas(newCanvas);
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
            redrawCanvas(newCanvas); // Redraw to clear old mouse coords if any
            return;
        }

        const img = window.currentLoadedImage;
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;
        if (natW === 0 || natH === 0) {
            newCanvas.mouseImagePos = null;
            newCanvas.mouseScreenPos = null;
            redrawCanvas(newCanvas);
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
            redrawCanvas(newCanvas);
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
        redrawCanvas(newCanvas);
    });

    newCanvas.addEventListener('mouseleave', (e) => {
        newCanvas.mouseImagePos = null;
        newCanvas.mouseScreenPos = null;
        // Reset cursor when leaving canvas
        newCanvas.style.cursor = 'default';
        redrawCanvas(newCanvas); // Redraw to clear mouse coords and ruler markers
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
            
            redrawCanvas(newCanvas);
            // If grid is visible, redraw it after pan
            if (newCanvas.gridCanvasElement && newCanvas.gridCanvasElement.isGridVisible) {
                // console.log("Redrawing grid due to pan");
                drawGrid(
                    newCanvas.gridCanvasElement, 
                    newCanvas, 
                    window.currentLoadedImage, 
                    newCanvas.gridCanvasElement.isGridVisible
                );
            }
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