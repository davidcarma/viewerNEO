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
export function createGridViewerWindow({ id = `grid-viewer-${Date.now()}`, title = 'Grid Viewer', x = 200, y = 150, width = 700, height = 500, canvasId = `grid-canvas-${Date.now()}`, controlPanelId = `grid-controls-${Date.now()}` }) {
    const viewerId = id; 
    const gridCanvasId = `${canvasId}-grid`;
    const gridSettingsContainerId = `${controlPanelId}-grid-settings`;

    const contentHtml = `
        <div class="grid-viewer-content">
            <div id="${canvasId}-container" class="grid-viewer-canvas-container">
                <canvas id="${canvasId}"></canvas>
                <canvas id="${gridCanvasId}" class="dynamic-grid-canvas" style="position: absolute; top: 0; left: 0; pointer-events: none; display: none;"></canvas>
            </div>
            <div id="${controlPanelId}" class="grid-viewer-control-panel">
                <button id="${viewerId}-show-grid-btn" onclick="handleShowGridToggle('${viewerId}', '${canvasId}', '${gridCanvasId}', '${gridSettingsContainerId}')">Show Grid</button>
                <button onclick="handleGridViewerResetView('${canvasId}')">Reset View</button>
                <div id="${gridSettingsContainerId}" style="display: none; margin-top: 10px; border-top: 1px solid #4a4a4a; padding-top: 10px;">
                    <p style="margin-top:0; margin-bottom: 5px; font-size: 0.9em; color: #ccc;">Grid Settings:</p>
                    <div>
                        <label for="${viewerId}-grid-color" style="font-size:0.85em;">Color:</label>
                        <input type="color" id="${viewerId}-grid-color" value="#FF0000" style="width: 50%; margin-bottom:5px;">
                    </div>
                    <div>
                        <label for="${viewerId}-grid-opacity" style="font-size:0.85em;">Opacity:</label>
                        <input type="range" id="${viewerId}-grid-opacity" min="0" max="1" step="0.05" value="0.5" style="width: 100%; margin-bottom:5px;">
                    </div>
                    <div style="font-size:0.85em;">
                        <label style="display:block; margin-bottom:3px;">Mode:</label>
                        <input type="radio" id="${viewerId}-grid-mode-synced" name="${viewerId}-grid-mode" value="synced" checked>
                        <label for="${viewerId}-grid-mode-synced">Synced</label><br>
                        <input type="radio" id="${viewerId}-grid-mode-fixed" name="${viewerId}-grid-mode" value="fixed">
                        <label for="${viewerId}-grid-mode-fixed">Fixed</label>
                    </div>
                </div>
                <button onclick="handleGridViewerButton3('${viewerId}')" style="margin-top:10px;">Action 3</button>
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
            fixedGridSpacing: 50,
            syncedMajorSpacing: 50,
            syncedMinorSpacing: 10
        };

        // Setup event listeners for grid settings
        const colorInput = windowFrame.querySelector(`#${viewerId}-grid-color`);
        const opacityInput = windowFrame.querySelector(`#${viewerId}-grid-opacity`);
        const syncedModeRadio = windowFrame.querySelector(`#${viewerId}-grid-mode-synced`);
        const fixedModeRadio = windowFrame.querySelector(`#${viewerId}-grid-mode-fixed`);

        colorInput.addEventListener('input', (e) => {
            gridCanvas.gridSettings.color = e.target.value;
            if (gridCanvas.isGridVisible) drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage);
        });
        opacityInput.addEventListener('input', (e) => {
            gridCanvas.gridSettings.opacity = parseFloat(e.target.value);
            if (gridCanvas.isGridVisible) drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage);
        });
        syncedModeRadio.addEventListener('change', (e) => {
            if (e.target.checked) {
                gridCanvas.gridSettings.mode = 'synced';
                if (gridCanvas.isGridVisible) drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage);
            }
        });
        fixedModeRadio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const image = window.currentLoadedImage;
                if (image && image !== true && image.naturalWidth && image.naturalHeight && viewerCanvas.transformState) {
                    // Calculate current on-screen spacing of synced grid to apply to fixed grid
                    const baseFitScale = Math.min(viewerCanvas.width / image.naturalWidth, viewerCanvas.height / image.naturalHeight);
                    const totalCurrentScale = baseFitScale * viewerCanvas.transformState.scale;
                    let currentOnScreenSpacing = gridCanvas.gridSettings.syncedMajorSpacing * totalCurrentScale;
                    
                    // Ensure spacing is reasonable (e.g., not too small)
                    currentOnScreenSpacing = Math.max(currentOnScreenSpacing, 5); // Minimum 5px screen spacing
                    gridCanvas.gridSettings.fixedGridSpacing = currentOnScreenSpacing;
                } else {
                    // Fallback if image/transform info isn't available, use default
                    // This might happen if grid is turned on before an image is loaded and fixed is selected.
                    gridCanvas.gridSettings.fixedGridSpacing = 50; // Default fixed spacing
                }

                gridCanvas.gridSettings.mode = 'fixed';
                if (gridCanvas.isGridVisible) drawGrid(gridCanvas, viewerCanvas, window.currentLoadedImage);
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
                    detail: { canvas: viewerCanvas, width: viewerCanvas.width, height: viewerCanvas.height, viewerId: viewerId } 
                });
                viewerCanvas.dispatchEvent(event); // This will trigger redrawCanvas, which in turn calls drawGrid
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
            settingsContainer.style.display = 'block'; // Show settings
            button.textContent = 'Hide Grid';
            button.style.backgroundColor = '#5cb85c';

            // Ensure settings UI reflects current gridSettings
            const colorInput = document.getElementById(`${viewerId}-grid-color`);
            const opacityInput = document.getElementById(`${viewerId}-grid-opacity`);
            const syncedModeRadio = document.getElementById(`${viewerId}-grid-mode-synced`);
            const fixedModeRadio = document.getElementById(`${viewerId}-grid-mode-fixed`);

            if (colorInput) colorInput.value = gridCanvas.gridSettings.color;
            if (opacityInput) opacityInput.value = gridCanvas.gridSettings.opacity;
            if (syncedModeRadio) syncedModeRadio.checked = gridCanvas.gridSettings.mode === 'synced';
            if (fixedModeRadio) fixedModeRadio.checked = gridCanvas.gridSettings.mode === 'fixed';
            
            drawGrid(gridCanvas, mainCanvas, window.currentLoadedImage);
        } else {
            gridCanvas.style.display = 'none';
            settingsContainer.style.display = 'none'; // Hide settings
            button.textContent = 'Show Grid';
            button.style.backgroundColor = ''; 
            const gridCtx = gridCanvas.getContext('2d');
            gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        }
    } else {
        console.error("Could not find canvas, button, or settings container for grid toggle. IDs:", viewerId, mainCanvasId, gridCanvasId, settingsContainerId);
    }
}

// Define drawGrid globally or ensure it's accessible where needed
function drawGrid(gridCanvas, mainCanvas, image) {
    if (!gridCanvas || !mainCanvas || !mainCanvas.transformState || !image || image === true) {
        if(gridCanvas){
            const gridCtxClear = gridCanvas.getContext('2d');
            gridCtxClear.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        }
        return;
    }

    const gridCtx = gridCanvas.getContext('2d');
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    if (!gridCanvas.isGridVisible || !gridCanvas.gridSettings) return;

    const settings = gridCanvas.gridSettings;
    const transform = mainCanvas.transformState; // panX, panY are user's pan from center AFTER baseFitScale applied
    const userScale = transform.scale; // User's zoom factor
    const panX = transform.offsetX; 
    const panY = transform.offsetY;

    const natW = image.naturalWidth;
    const natH = image.naturalHeight;

    if (natW === 0 || natH === 0 && settings.mode === 'synced') return; // natW/H needed for synced

    gridCtx.save();

    if (settings.mode === 'synced') {
        if (natW === 0 || natH === 0) { // Double check for synced mode specifically
             gridCtx.restore(); return;
        }
        const baseFitScale = Math.min(mainCanvas.width / natW, mainCanvas.height / natH);
        const totalCurrentScale = baseFitScale * userScale;
        
        const displayWidth = natW * totalCurrentScale;
        const displayHeight = natH * totalCurrentScale;

        const drawX = (mainCanvas.width - displayWidth) / 2 + panX;
        const drawY = (mainCanvas.height - displayHeight) / 2 + panY;

        gridCtx.translate(drawX, drawY);
        gridCtx.scale(totalCurrentScale, totalCurrentScale);

        gridCtx.lineWidth = 1 / totalCurrentScale; 

        // Minor grid lines (synced)
        const minorColor = hexToRGBA(settings.color, settings.opacity * 0.4);
        gridCtx.strokeStyle = minorColor;
        for (let x = 0; x < natW; x += settings.syncedMinorSpacing) {
            if (x % settings.syncedMajorSpacing !== 0) {
                gridCtx.beginPath();
                gridCtx.moveTo(x, 0);
                gridCtx.lineTo(x, natH);
                gridCtx.stroke();
            }
        }
        for (let y = 0; y < natH; y += settings.syncedMinorSpacing) {
            if (y % settings.syncedMajorSpacing !== 0) {
                gridCtx.beginPath();
                gridCtx.moveTo(0, y);
                gridCtx.lineTo(natW, y);
                gridCtx.stroke();
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
        const spacing = settings.fixedGridSpacing;
        if (spacing < 5) { // Safety check, though already handled in radio listener
            gridCtx.restore(); return;
        }

        gridCtx.lineWidth = 1; // Keep fixed mode lines at 1 screen pixel for now
        
        const majorColor = hexToRGBA(settings.color, settings.opacity);
        // For minor lines in fixed mode, let's use a fraction of the major spacing
        // And a reduced opacity, similar to synced mode.
        const minorSpacing = spacing / 5; // Example: 5 minor divisions
        const minorColor = hexToRGBA(settings.color, settings.opacity * 0.4);

        // Minor Horizontal Lines (Fixed)
        if (minorSpacing >= 2) { // Only draw if spacing is somewhat reasonable
            gridCtx.strokeStyle = minorColor;
            for (let y = 0; y <= gridCanvas.height; y += minorSpacing) {
                if (y % spacing !== 0) { // Don't overdraw major lines
                    const lineY = Math.floor(y) + 0.5;
                    gridCtx.beginPath();
                    gridCtx.moveTo(0, lineY);
                    gridCtx.lineTo(gridCanvas.width, lineY);
                    gridCtx.stroke();
                }
            }
            // Minor Vertical Lines (Fixed)
            gridCtx.strokeStyle = minorColor; // re-set for clarity, though it should persist
            for (let x = 0; x <= gridCanvas.width; x += minorSpacing) {
                if (x % spacing !== 0) { // Don't overdraw major lines
                    const lineX = Math.floor(x) + 0.5;
                    gridCtx.beginPath();
                    gridCtx.moveTo(lineX, 0);
                    gridCtx.lineTo(lineX, gridCanvas.height);
                    gridCtx.stroke();
                }
            }
        }

        // Major Horizontal Lines (Fixed)
        gridCtx.strokeStyle = majorColor;
        for (let y = 0; y <= gridCanvas.height; y += spacing) {
            const lineY = Math.floor(y) + 0.5;
            gridCtx.beginPath();
            gridCtx.moveTo(0, lineY);
            gridCtx.lineTo(gridCanvas.width, lineY);
            gridCtx.stroke();
        }
        // Major Vertical Lines (Fixed)
        gridCtx.strokeStyle = majorColor; // re-set for clarity
        for (let x = 0; x <= gridCanvas.width; x += spacing) {
            const lineX = Math.floor(x) + 0.5;
            gridCtx.beginPath();
            gridCtx.moveTo(lineX, 0);
            gridCtx.lineTo(lineX, gridCanvas.height);
            gridCtx.stroke();
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
        
        if (canvas.gridCanvasElement) { // Check if gridCanvasElement exists
            drawGrid(canvas.gridCanvasElement, canvas, img); // Call drawGrid, it will check visibility internally
        }

        // Optional: Display zoom level (userScale) and pan coordinates
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        // Display userScale as a percentage (e.g., 1.0 -> 100%, 1.5 -> 150%)
        ctx.fillText(`Zoom: ${Math.round(userScale * 100)}%`, canvas.width - 10, canvas.height - 10);
        
        ctx.textAlign = 'left';
        ctx.fillText(`Pan: (${Math.round(panX)}, ${Math.round(panY)})`, 10, canvas.height - 10);
        
    } catch (err) {
        console.error("Error drawing image:", err);
    }
}

// Set up canvas handling for loaded images
export function setupCanvasImageHandling(newCanvas, newContext) {
    if (!newCanvas || !newContext) return;
    
    // Clear canvas and display initial message
    newContext.clearRect(0, 0, newCanvas.width, newCanvas.height);
    newContext.fillStyle = 'rgba(238, 238, 238, 0.7)';
    newContext.textAlign = 'center';
    newContext.textBaseline = 'middle';
    const fontSize = Math.min(newCanvas.width / 20, newCanvas.height / 10, 16);
    newContext.font = `${fontSize}px sans-serif`;
    if (newCanvas.width > 0 && newCanvas.height > 0) {
        newContext.fillText("Select an image from the panel.", newCanvas.width / 2, newCanvas.height / 2);
    }
    
    // Initialize transformation state for the canvas
    newCanvas.transformState = {
        scale: 1,
        offsetX: 0,
        offsetY: 0
    };
    
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
        const newUserScale = Math.min(Math.max(currentUserScale * zoomFactor, 0.1), 50); // Max 1000% zoom, Min 10%

        // Mouse position on canvas
        const rect = newCanvas.getBoundingClientRect();
        const mcx = e.clientX - rect.left;
        const mcy = e.clientY - rect.top;

        // Base scale to fit image
        const baseFitScale = Math.min(newCanvas.width / natW, newCanvas.height / natH);

        // Current total scale and display dimensions
        const currentTotalScale = baseFitScale * currentUserScale;
        const currentDisplayWidth = natW * currentTotalScale;
        const currentDisplayHeight = natH * currentTotalScale;
        
        // Current top-left of image on canvas
        const currentImgTopLeftX = (newCanvas.width - currentDisplayWidth) / 2 + currentPanX;
        const currentImgTopLeftY = (newCanvas.height - currentDisplayHeight) / 2 + currentPanY;

        // New total scale and display dimensions
        const newTotalScale = baseFitScale * newUserScale;
        const newDisplayWidth = natW * newTotalScale;
        const newDisplayHeight = natH * newTotalScale;

        // Calculate new pan values to keep point under mouse fixed
        const finalPanX = mcx - (newCanvas.width - newDisplayWidth) / 2 - (mcx - currentImgTopLeftX) * (newUserScale / currentUserScale);
        const finalPanY = mcy - (newCanvas.height - newDisplayHeight) / 2 - (mcy - currentImgTopLeftY) * (newUserScale / currentUserScale);
        
        newCanvas.transformState = {
            scale: newUserScale,
            offsetX: finalPanX,
            offsetY: finalPanY
        };
        
        redrawCanvas(newCanvas);
        // If grid is visible, redraw it after zoom
        if (newCanvas.gridCanvasElement && newCanvas.gridCanvasElement.isGridVisible) {
            // console.log("Redrawing grid due to zoom");
            drawGrid(newCanvas.gridCanvasElement, newCanvas, window.currentLoadedImage);
        }
    }, { passive: false });
    
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
                drawGrid(newCanvas.gridCanvasElement, newCanvas, window.currentLoadedImage);
            }
        }
    });
    
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            newCanvas.style.cursor = '';
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
            gridCtx.clearRect(0,0, gridCanvas.width, gridCanvas.height);
        }
    });
    
    // Make the redrawCanvas function available globally for index.html to use
    window.redrawCanvas = redrawCanvas;
} 