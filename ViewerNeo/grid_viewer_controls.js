/**
 * Manages controls for Grid Viewer windows.
 */

import { createWindow } from '../WindowsManager/window-system.js';

// Define the Grid Viewer Window creation function
export function createGridViewerWindow({ id = `grid-viewer-${Date.now()}`, title = 'Grid Viewer', x = 200, y = 150, width = 700, height = 500, canvasId = `grid-canvas-${Date.now()}`, controlPanelId = `grid-controls-${Date.now()}` }) {
    const viewerId = id; 
    const gridCanvasId = `${canvasId}-grid`;
    const contentHtml = `
        <div class="grid-viewer-content">
            <div id="${canvasId}-container" class="grid-viewer-canvas-container">
                <canvas id="${canvasId}"></canvas>
                <canvas id="${gridCanvasId}" class="dynamic-grid-canvas" style="position: absolute; top: 0; left: 0; pointer-events: none; display: none;"></canvas>
            </div>
            <div id="${controlPanelId}" class="grid-viewer-control-panel">
                <button id="${viewerId}-show-grid-btn" onclick="handleShowGridToggle('${viewerId}', '${canvasId}', '${gridCanvasId}')">Show Grid</button>
                <button onclick="handleGridViewerResetView('${canvasId}')">Reset View</button>
                <button onclick="handleGridViewerButton3('${viewerId}')">Action 3</button>
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

function handleShowGridToggle(viewerId, mainCanvasId, gridCanvasId) {
    const mainCanvas = document.getElementById(mainCanvasId);
    const gridCanvas = document.getElementById(gridCanvasId);
    const button = document.getElementById(`${viewerId}-show-grid-btn`);

    if (mainCanvas && gridCanvas && button) {
        gridCanvas.isGridVisible = !gridCanvas.isGridVisible;
        if (gridCanvas.isGridVisible) {
            gridCanvas.style.display = 'block';
            button.textContent = 'Hide Grid';
            button.style.backgroundColor = '#5cb85c';
            drawGrid(gridCanvas, mainCanvas, window.currentLoadedImage);
        } else {
            gridCanvas.style.display = 'none';
            button.textContent = 'Show Grid';
            button.style.backgroundColor = ''; 
            const gridCtx = gridCanvas.getContext('2d');
            gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        }
    } else {
        console.error("Could not find canvas or button for grid toggle. IDs:", viewerId, mainCanvasId, gridCanvasId);
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

    if (!gridCanvas.isGridVisible) return;

    const transform = mainCanvas.transformState;
    const userScale = transform.scale;
    const panX = transform.offsetX;
    const panY = transform.offsetY;

    const natW = image.naturalWidth;
    const natH = image.naturalHeight;

    if (natW === 0 || natH === 0) return;

    const baseFitScale = Math.min(mainCanvas.width / natW, mainCanvas.height / natH);
    const totalCurrentScale = baseFitScale * userScale;
    
    const displayWidth = natW * totalCurrentScale;
    const displayHeight = natH * totalCurrentScale;

    const drawX = (mainCanvas.width - displayWidth) / 2 + panX;
    const drawY = (mainCanvas.height - displayHeight) / 2 + panY;

    gridCtx.save();
    gridCtx.translate(drawX, drawY);
    gridCtx.scale(totalCurrentScale, totalCurrentScale);

    // Now draw grid lines based on original image pixel coordinates
    // Grid lines every 50 original image pixels
    const majorGridSpacing = 50; 
    // Subdivision lines, e.g., every 10 original image pixels
    const minorGridSpacing = 10; 

    gridCtx.lineWidth = 1 / totalCurrentScale; // Aim for 1 screen pixel lines

    // Minor grid lines
    gridCtx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    for (let x = 0; x < natW; x += minorGridSpacing) {
        if (x % majorGridSpacing !== 0) { // Don't overdraw major lines
            gridCtx.beginPath();
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, natH);
            gridCtx.stroke();
        }
    }
    for (let y = 0; y < natH; y += minorGridSpacing) {
         if (y % majorGridSpacing !== 0) { // Don't overdraw major lines
            gridCtx.beginPath();
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(natW, y);
            gridCtx.stroke();
        }
    }

    // Major grid lines
    gridCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    for (let x = 0; x <= natW; x += majorGridSpacing) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, natH);
        gridCtx.stroke();
    }
    for (let y = 0; y <= natH; y += majorGridSpacing) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(natW, y);
        gridCtx.stroke();
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