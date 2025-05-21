/**
 * Manages controls for Grid Viewer windows.
 */

import { createWindow } from '../WindowsManager/window-system.js';

// Define the Grid Viewer Window creation function
export function createGridViewerWindow({ id = `grid-viewer-${Date.now()}`, title = 'Grid Viewer', x = 200, y = 150, width = 700, height = 500, canvasId = `grid-canvas-${Date.now()}`, controlPanelId = `grid-controls-${Date.now()}` }) {
    const viewerId = id; 
    const contentHtml = `
        <div class="grid-viewer-content">
            <div id="${canvasId}-container" class="grid-viewer-canvas-container">
                <canvas id="${canvasId}"></canvas>
            </div>
            <div id="${controlPanelId}" class="grid-viewer-control-panel">
                <button onclick="handleGridViewerButton1('${viewerId}')">Action 1</button>
                <button onclick="handleGridViewerResetView('${canvasId}')">Reset View</button>
                <button onclick="handleGridViewerButton3('${viewerId}')">Action 3</button>
                <button onclick="handleGridViewerButton4('${viewerId}')">Action 4</button>
                <button onclick="handleGridViewerButton5('${viewerId}')">Action 5</button>
            </div>
        </div>
    `;
    const windowFrame = createWindow({ id, title, content: contentHtml, x, y, width, height });
    const viewerCanvas = windowFrame.querySelector(`#${canvasId}`);
    const canvasContainer = windowFrame.querySelector(`#${canvasId}-container`);
    if (viewerCanvas && canvasContainer) {
        const updateCanvasSize = () => {
            if (canvasContainer.offsetParent === null) return;
            const containerWidth = canvasContainer.clientWidth;
            const containerHeight = canvasContainer.clientHeight;
            
            const currentWidth = viewerCanvas.width;
            const currentHeight = viewerCanvas.height;
            
            // Only update canvas dimensions if they've significantly changed (by more than 5px)
            // This prevents feedback loops during subtle window resizing
            if (Math.abs(currentWidth - containerWidth) > 5) viewerCanvas.width = containerWidth;
            if (Math.abs(currentHeight - containerHeight) > 5) viewerCanvas.height = containerHeight;
            
            // Only dispatch resize event if dimensions actually changed
            if (viewerCanvas.width !== currentWidth || viewerCanvas.height !== currentHeight) {
                const event = new CustomEvent('grid-canvas-resized', { 
                    detail: { canvas: viewerCanvas, width: viewerCanvas.width, height: viewerCanvas.height, viewerId: viewerId } 
                });
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
function handleGridViewerButton1(viewerId) {
    console.log(`Grid Viewer Button 1 clicked for viewer: ${viewerId}`);
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

function handleGridViewerButton3(viewerId) {
    console.log(`Grid Viewer Button 3 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton4(viewerId) {
    console.log(`Grid Viewer Button 4 clicked for viewer: ${viewerId}`);
}

function handleGridViewerButton5(viewerId) {
    console.log(`Grid Viewer Button 5 clicked for viewer: ${viewerId}`);
}

// Make functions globally accessible for onclick handlers
window.handleGridViewerButton1 = handleGridViewerButton1;
window.handleGridViewerResetView = handleGridViewerResetView;
window.handleGridViewerButton3 = handleGridViewerButton3;
window.handleGridViewerButton4 = handleGridViewerButton4;
window.handleGridViewerButton5 = handleGridViewerButton5;

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
        console.log("DRAW DEBUG (New Offset Definition) ===========================");
        console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
        console.log(`Transform state: userScale=${userScale.toFixed(2)}, pan=(${panX.toFixed(1)}, ${panY.toFixed(1)})`);
        console.log(`Image natural size: ${natW}x${natH}`);
        console.log(`Base fit scale: ${baseFitScale.toFixed(3)}`);
        console.log(`Total current scale: ${totalCurrentScale.toFixed(3)}`);
        console.log(`Display size: ${displayWidth.toFixed(1)}x${displayHeight.toFixed(1)}`);
        console.log(`Drawing image at (${drawX.toFixed(1)}, ${drawY.toFixed(1)})`);
        
        ctx.drawImage(img, drawX, drawY, displayWidth, displayHeight);
        
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
        
        console.log("ZOOM DEBUG (New Offset Definition) ===========================");
        console.log(`Canvas: ${newCanvas.width}x${newCanvas.height}, Mouse: (${mcx.toFixed(1)},${mcy.toFixed(1)})`);
        console.log(`User Scale: ${currentUserScale.toFixed(2)} -> ${newUserScale.toFixed(2)}`);
        console.log(`Pan: (${currentPanX.toFixed(1)},${currentPanY.toFixed(1)}) -> (${finalPanX.toFixed(1)},${finalPanY.toFixed(1)})`);
        console.log(`Current TL: (${currentImgTopLeftX.toFixed(1)}, ${currentImgTopLeftY.toFixed(1)})`);
        console.log(`(mcx - currentImgTopLeftX): ${(mcx - currentImgTopLeftX).toFixed(1)}`);
        console.log(`Scale Ratio (newUserScale / currentUserScale): ${(newUserScale / currentUserScale).toFixed(3)}`);
        
        newCanvas.transformState = {
            scale: newUserScale,
            offsetX: finalPanX,
            offsetY: finalPanY
        };
        
        redrawCanvas(newCanvas);
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
        
        // Calculate the distance moved
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        
        console.log("DRAG DEBUG ===========================");
        console.log(`Mouse from (${lastX}, ${lastY}) to (${e.clientX}, ${e.clientY})`);
        console.log(`Delta: (${deltaX}, ${deltaY})`);
        
        // Update the last position
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Update the transform state with the new offset
        if (newCanvas.transformState) {
            const oldOffsetX = newCanvas.transformState.offsetX;
            const oldOffsetY = newCanvas.transformState.offsetY;
            
            // Add deltas directly - this works for both positive and negative movements
            newCanvas.transformState.offsetX += deltaX;
            newCanvas.transformState.offsetY += deltaY;
            
            console.log(`Offset updated from (${oldOffsetX}, ${oldOffsetY}) to (${newCanvas.transformState.offsetX}, ${newCanvas.transformState.offsetY})`);
            console.log(`Current scale: ${newCanvas.transformState.scale}`);
            
            if (window.currentLoadedImage && window.currentLoadedImage !== true) {
                const img = window.currentLoadedImage;
                const baseScale = Math.min(newCanvas.width / img.naturalWidth, newCanvas.height / img.naturalHeight);
                const imageX = (newCanvas.width - img.naturalWidth * baseScale * newCanvas.transformState.scale) / 2 + newCanvas.transformState.offsetX;
                const imageY = (newCanvas.height - img.naturalHeight * baseScale * newCanvas.transformState.scale) / 2 + newCanvas.transformState.offsetY;
                console.log(`Base scale: ${baseScale}, Image position: (${imageX}, ${imageY})`);
            }
            
            console.log("END DRAG DEBUG ===========================");
            
            // Redraw the canvas with the updated state
            redrawCanvas(newCanvas);
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
        if (window.currentLoadedImage) {
            // Use our custom redraw function to maintain transform state during resize
            redrawCanvas(newCanvas);
        }
    });
    
    // Make the redrawCanvas function available globally for index.html to use
    window.redrawCanvas = redrawCanvas;
} 