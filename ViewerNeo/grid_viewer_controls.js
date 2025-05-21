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
                <button onclick="handleGridViewerButton2('${viewerId}')">Action 2</button>
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

function handleGridViewerButton2(viewerId) {
    console.log(`Grid Viewer Button 2 clicked for viewer: ${viewerId}`);
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
window.handleGridViewerButton2 = handleGridViewerButton2;
window.handleGridViewerButton3 = handleGridViewerButton3;
window.handleGridViewerButton4 = handleGridViewerButton4;
window.handleGridViewerButton5 = handleGridViewerButton5;

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
    
    // Set up event listener for canvas resizing
    newCanvas.addEventListener('grid-canvas-resized', (e) => {
        if (window.currentLoadedImage) {
            const img = window.currentLoadedImage;
            if (!newCanvas || newCanvas.width === 0 || newCanvas.height === 0) return;
            newContext.clearRect(0, 0, newCanvas.width, newCanvas.height);
            const canvasWidth = newCanvas.width;
            const canvasHeight = newCanvas.height;
            const imgWidth = img.naturalWidth;
            const imgHeight = img.naturalHeight;
            if (imgWidth === 0 || imgHeight === 0) return;
            const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight);
            const drawnWidth = imgWidth * scale;
            const drawnHeight = imgHeight * scale;
            const dx = (canvasWidth - drawnWidth) / 2;
            const dy = (canvasHeight - drawnHeight) / 2;
            newContext.drawImage(img, dx, dy, drawnWidth, drawnHeight);
        }
    });
} 