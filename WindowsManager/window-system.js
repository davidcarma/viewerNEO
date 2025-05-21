let highestZIndex = 0;
const windows = []; // Keep track of windows for z-ordering and state
let topBarOffset = 0; // Offset for a fixed bar at the top of the page
let leftBoundary = 0; // Offset for sidebar or other left elements

// Function to allow the main page to set the top bar offset
export function setTopBarOffset(offset) {
    topBarOffset = offset;
}

// Function to set the left boundary for windows
export function setLeftBoundary(offset) {
    leftBoundary = offset;
}

const closeSVG = `<svg viewBox="0 0 12 12"><path d="M2.22 2.22L9.78 9.78M9.78 2.22L2.22 9.78" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const minimizeSVG = `<svg viewBox="0 0 12 12"><path d="M2 6L10 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const maximizeSVG = `<svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
const restoreSVG = `<svg viewBox="0 0 12 12"><rect x="3.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M1.5 3.5 H6.5 V8.5 H1.5Z" stroke="currentColor" stroke-width="1.5" fill="#4a4a4a"/></svg>`;


export function createWindow({ id = `window-${Date.now()}`, title = 'New Window', content = '', x = 100, y = 100, width = 400, height = 300, isMinimized = false, isMaximized = false }) {
    const windowFrame = document.createElement('div');
    windowFrame.className = 'window-frame';
    windowFrame.style.left = `${x}px`;
    windowFrame.style.top = `${y}px`;
    windowFrame.style.width = `${width}px`;
    windowFrame.style.height = `${height}px`;
    windowFrame.style.zIndex = ++highestZIndex;
    windowFrame.id = id;

    let originalState = { x, y, width, height };
    let isMaximizedState = isMaximized;
    let isMinimizedState = isMinimized;

    const titleBar = document.createElement('div');
    titleBar.className = 'window-title-bar';

    const controls = document.createElement('div');
    controls.className = 'window-controls';

    const closeButton = document.createElement('button');
    closeButton.className = 'window-control-close';
    closeButton.innerHTML = closeSVG;
    closeButton.title = 'Close';
    closeButton.onclick = (e) => {
        e.stopPropagation();
        windowFrame.remove();
        windows.splice(windows.findIndex(w => w.id === id), 1);
    };

    const minimizeButton = document.createElement('button');
    minimizeButton.className = 'window-control-minimize';
    minimizeButton.innerHTML = minimizeSVG;
    minimizeButton.title = 'Minimize';
    minimizeButton.onclick = (e) => {
        e.stopPropagation();
        toggleMinimize();
    };

    const maximizeButton = document.createElement('button');
    maximizeButton.className = 'window-control-maximize';
    maximizeButton.innerHTML = isMaximizedState ? restoreSVG : maximizeSVG;
    maximizeButton.title = isMaximizedState ? 'Restore' : 'Maximize';
    maximizeButton.onclick = (e) => {
        e.stopPropagation();
        toggleMaximize();
    };

    controls.appendChild(closeButton);
    controls.appendChild(minimizeButton);
    controls.appendChild(maximizeButton);

    const titleText = document.createElement('h2');
    titleText.className = 'window-title';
    titleText.textContent = title;

    titleBar.appendChild(controls);
    titleBar.appendChild(titleText);

    const contentArea = document.createElement('div');
    contentArea.className = 'window-content';
    contentArea.innerHTML = content;

    const iframeShield = document.createElement('div');
    iframeShield.className = 'iframe-shield';
    contentArea.style.position = 'relative';
    iframeShield.style.top = '0';
    iframeShield.style.left = '0';
    iframeShield.style.width = '100%';
    iframeShield.style.height = '100%';
    contentArea.appendChild(iframeShield);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';

    windowFrame.appendChild(titleBar);
    windowFrame.appendChild(contentArea);
    windowFrame.appendChild(resizeHandle);
    document.body.appendChild(windowFrame);

    const windowInstance = {
        id,
        title,
        frame: windowFrame,
        getState: () => {
            if (isMaximizedState) {
                return { id, title, x: originalState.x, y: originalState.y, width: originalState.width, height: originalState.height, zIndex: parseInt(windowFrame.style.zIndex), isMinimized: isMinimizedState, isMaximized: true, originalState };
            } else {
                return { id, title, x: windowFrame.offsetLeft, y: windowFrame.offsetTop, width: windowFrame.offsetWidth, height: windowFrame.offsetHeight, zIndex: parseInt(windowFrame.style.zIndex), isMinimized: isMinimizedState, isMaximized: false, originalState };
            }
        },
        applyState: (s) => {
            // s: { id, title, x, y, width, height, zIndex, isMinimized, isMaximized, originalState? }

            // Update title if necessary (though usually set on creation)
            titleText.textContent = s.title || title;

            // 1. Set internal "originalState" (the state to restore to from maximized)
            // If the saved state has its own originalState, use that, otherwise use the current x,y,w,h for originalState.
            if (s.originalState) {
                originalState = { ...s.originalState };
            } else {
                // Fallback for older save formats or if originalState is not explicitly saved for the restored state
                originalState = { x: s.x, y: s.y, width: s.width, height: s.height };
            }

            // 2. Apply the direct state (current position and size)
            windowFrame.style.left = `${s.x}px`;
            windowFrame.style.top = `${s.y}px`;
            windowFrame.style.width = `${s.width}px`;
            windowFrame.style.height = `${s.height}px`;
            windowFrame.classList.remove('minimized'); // Start from a clean slate

            // 3. Handle Maximized State
            // Important to set isMaximizedState *before* calling maximizeWindow/restoreWindow
            // as they might use this internal variable.
            isMaximizedState = s.isMaximized;
            if (s.isMaximized) {
                maximizeWindow(false); // false: don't re-save current state as originalState
            } else {
                // If not maximized, ensure we are in a restored state. 
                // This also updates the maximize button icon/title.
                // This also means that if it *was* maximized, it will be restored to originalState.
                // If it wasn't maximized, it effectively reapplies its current state from s.
                restoreWindow(); 
                // After restore, explicitly apply s.x, s.y etc. because restoreWindow() uses originalState
                // which might not be what s wants if s.isMaximized was false but s.x,y,w,h are specific.
                windowFrame.style.left = `${s.x}px`;
                windowFrame.style.top = `${s.y}px`;
                windowFrame.style.width = `${s.width}px`;
                windowFrame.style.height = `${s.height}px`;
            }
            // Update button after potential maximize/restore which changes it
            maximizeButton.innerHTML = isMaximizedState ? restoreSVG : maximizeSVG;
            maximizeButton.title = isMaximizedState ? 'Restore' : 'Maximize';
            
            // 4. Handle Minimized State (after potential un-maximization)
            // Set isMinimizedState *before* toggling class or calling toggleMinimize
            isMinimizedState = s.isMinimized; 
            windowFrame.classList.toggle('minimized', isMinimizedState);
            
            // If unminimized AND not maximized, ensure dimensions are explicitly from s (or originalState if consistent)
            // This step ensures that if a window is loaded as !minimized and !maximized, its explicit dimensions are respected.
            if (!isMinimizedState && !isMaximizedState) {
                 windowFrame.style.left = `${s.x}px`;
                 windowFrame.style.top = `${s.y}px`;
                 windowFrame.style.width = `${s.width}px`;
                 windowFrame.style.height = `${s.height}px`;
            }

            // 5. Set zIndex
            windowFrame.style.zIndex = s.zIndex;
            if (s.zIndex > highestZIndex) {
                highestZIndex = s.zIndex; // Keep global highestZIndex updated
            }
            bringToFront(); // Ensure it's on top according to its zIndex logic
        }
    };

    windows.push(windowInstance);

    const bringToFront = () => {
        windowFrame.style.zIndex = ++highestZIndex;
    };

    windowFrame.addEventListener('mousedown', bringToFront);
    titleBar.addEventListener('mousedown', bringToFront); // Ensure title bar click also brings to front

    if (isMinimizedState) {
        windowFrame.classList.add('minimized');
    }
    if (isMaximizedState) {
        maximizeWindow(false); // Apply maximized state without saving current as original
    }

    function toggleMinimize() {
        isMinimizedState = !isMinimizedState;
        windowFrame.classList.toggle('minimized', isMinimizedState);
        
        if (!isMinimizedState && isMaximizedState) {
            // If unminimizing and was maximized, re-apply maximized view
            // For now, assume CSS handles visual state correctly with class
            // but explicitly setting style might be needed if issues arise
            maximizeWindow(false); // Re-apply maximized dimensions/position
        } else if (!isMinimizedState && !isMaximizedState) {
            // If unminimizing and not maximized, ensure restored to originalState size AND POSITION.
            windowFrame.style.left = `${originalState.x}px`;
            windowFrame.style.top = `${originalState.y}px`;
            windowFrame.style.width = `${originalState.width}px`;
            windowFrame.style.height = `${originalState.height}px`;
        }
        // if (isMinimizedState) bringToFront(); // Optionally bring to front when minimizing
    }

    titleBar.ondblclick = () => {
        if (isMinimizedState) {
            toggleMinimize();
        } else {
            toggleMaximize(); // Double click title bar to maximize/restore
        }
    };

    function maximizeWindow(saveCurrentState = true) {
        if (saveCurrentState && !isMaximizedState) { // Only save if not already maximized
            originalState = {
                x: windowFrame.offsetLeft,
                y: windowFrame.offsetTop,
                width: windowFrame.offsetWidth,
                height: windowFrame.offsetHeight,
            };
        }
        windowFrame.style.left = `${leftBoundary}px`; // Use left boundary
        windowFrame.style.top = `${topBarOffset}px`; // Use the top offset
        windowFrame.style.width = `${window.innerWidth - leftBoundary}px`; // Adjust width
        windowFrame.style.height = `${window.innerHeight - topBarOffset}px`; // Adjust height
        isMaximizedState = true;
        maximizeButton.innerHTML = restoreSVG;
        maximizeButton.title = 'Restore';
        windowFrame.classList.remove('minimized'); // Ensure not minimized when maximized
        isMinimizedState = false;
        bringToFront();
    }

    function restoreWindow() {
        windowFrame.style.left = `${originalState.x}px`;
        windowFrame.style.top = `${originalState.y}px`;
        windowFrame.style.width = `${originalState.width}px`;
        windowFrame.style.height = `${originalState.height}px`;
        isMaximizedState = false;
        maximizeButton.innerHTML = maximizeSVG;
        maximizeButton.title = 'Maximize';
        bringToFront();
    }

    function toggleMaximize() {
        if (isMaximizedState) {
            restoreWindow();
        } else {
            maximizeWindow();
        }
    }

    // Drag functionality
    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    titleBar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return; 
        if (isMaximizedState) return; 

        isDragging = true;
        dragOffsetX = e.clientX - windowFrame.offsetLeft;
        dragOffsetY = e.clientY - windowFrame.offsetTop;
        iframeShield.style.display = 'block'; // Show shield
        bringToFront();
        e.preventDefault();
    });

    // Resize functionality
    let isResizing = false;
    let resizeStartX, resizeStartY, initialWidth, initialHeight;

    resizeHandle.addEventListener('mousedown', (e) => {
        if (isMaximizedState || isMinimizedState) return;
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        initialWidth = windowFrame.offsetWidth;
        initialHeight = windowFrame.offsetHeight;
        originalState.width = initialWidth;
        originalState.height = initialHeight;
        iframeShield.style.display = 'block'; // Show shield
        bringToFront();
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            let newX = e.clientX - dragOffsetX;
            let newY = e.clientY - dragOffsetY;
            // Use leftBoundary for the minimum X position
            newX = Math.max(leftBoundary, Math.min(newX, window.innerWidth - windowFrame.offsetWidth));
            // Use topBarOffset for the minimum Y position
            newY = Math.max(topBarOffset, Math.min(newY, window.innerHeight - windowFrame.offsetHeight));
            windowFrame.style.left = `${newX}px`;
            windowFrame.style.top = `${newY}px`;
            if (!isMaximizedState) {
                originalState.x = newX;
                originalState.y = newY;
            }
        } else if (isResizing) {
            const deltaX = e.clientX - resizeStartX;
            const deltaY = e.clientY - resizeStartY;
            let newWidth = initialWidth + deltaX;
            let newHeight = initialHeight + deltaY;
            
            const minWidth = parseInt(getComputedStyle(windowFrame).minWidth) || 150;
            const minHeight = parseInt(getComputedStyle(windowFrame).minHeight) || 100;

            newWidth = Math.max(minWidth, newWidth);
            newHeight = Math.max(minHeight, newHeight);

            windowFrame.style.width = `${newWidth}px`;
            windowFrame.style.height = `${newHeight}px`;
            if (!isMaximizedState) {
                originalState.width = newWidth;
                originalState.height = newHeight;
            }
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        iframeShield.style.display = 'none'; // Hide shield
    });

    // Return the window frame so it can be manipulated if needed
    return windowFrame;
}

export function getWindowById(id) {
    const windowInstance = windows.find(w => w.id === id);
    return windowInstance ? windowInstance.frame : null;
}

export function getWindowState(id) {
    const windowInstance = windows.find(w => w.id === id);
    return windowInstance ? windowInstance.getState() : null;
}

// Function to adjust windows to fit the viewport
export function adjustWindowsToViewport() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    windows.forEach(winInstance => {
        const windowFrame = winInstance.frame;
        // Get the current state, including originalState which might be needed by adjust logic
        const windowState = winInstance.getState(); 

        if (windowState.isMinimized) {
            return; // Don't adjust minimized windows
        }

        if (windowState.isMaximized) {
            // Re-maximize if the window was maximized
            windowFrame.style.left = `${leftBoundary}px`;
            windowFrame.style.top = `${topBarOffset}px`;
            windowFrame.style.width = `${viewportWidth - leftBoundary}px`;
            windowFrame.style.height = `${viewportHeight - topBarOffset}px`;
        } else {
            // Adjust non-maximized windows
            let currentX = windowFrame.offsetLeft;
            let currentY = windowFrame.offsetTop;
            let currentWidth = windowFrame.offsetWidth;
            let currentHeight = windowFrame.offsetHeight;

            const minWidth = parseInt(getComputedStyle(windowFrame).minWidth) || 150;
            const minHeight = parseInt(getComputedStyle(windowFrame).minHeight) || 100;

            // Adjust X position and width
            if (currentX < leftBoundary) {
                currentX = leftBoundary;
            }
            if (currentX + currentWidth > viewportWidth) {
                currentWidth = viewportWidth - currentX;
            }
            // Ensure minWidth is respected, adjust X again if needed
            if (currentWidth < minWidth) {
                currentWidth = minWidth;
                if (currentX + currentWidth > viewportWidth) { // If making it minWidth pushes it out
                    currentX = Math.max(leftBoundary, viewportWidth - minWidth);
                }
            }
             // Ensure window is not pushed beyond leftBoundary by minWidth adjustment
            if (currentX < leftBoundary) currentX = leftBoundary;
             // Final check if it still overflows after x adjustment
            if (currentX + currentWidth > viewportWidth) {
                currentWidth = viewportWidth - currentX;
            }


            // Adjust Y position and height
            if (currentY < topBarOffset) {
                currentY = topBarOffset;
            }
            if (currentY + currentHeight > viewportHeight) {
                currentHeight = viewportHeight - currentY;
            }
            // Ensure minHeight is respected, adjust Y again if needed
            if (currentHeight < minHeight) {
                currentHeight = minHeight;
                if (currentY + currentHeight > viewportHeight) { // If making it minHeight pushes it out
                    currentY = Math.max(topBarOffset, viewportHeight - minHeight);
                }
            }
            // Ensure window is not pushed beyond topBarOffset by minHeight adjustment
            if (currentY < topBarOffset) currentY = topBarOffset;
            // Final check if it still overflows after y adjustment
            if (currentY + currentHeight > viewportHeight) {
                currentHeight = viewportHeight - currentY;
            }

            // Apply calculated values
            windowFrame.style.left = `${currentX}px`;
            windowFrame.style.top = `${currentY}px`;
            windowFrame.style.width = `${Math.max(minWidth, currentWidth)}px`; // Ensure minWidth
            windowFrame.style.height = `${Math.max(minHeight, currentHeight)}px`; // Ensure minHeight

            // Update originalState so that restore operations use the new, viewport-adjusted state
            // This is crucial for when a user resizes the viewport, then maximizes, then restores.
            // We want it to restore to the state that fits the current viewport.
            const internalOriginalState = windowState.originalState; // Access the originalState from the closure
            internalOriginalState.x = currentX;
            internalOriginalState.y = currentY;
            internalOriginalState.width = Math.max(minWidth, currentWidth);
            internalOriginalState.height = Math.max(minHeight, currentHeight);
        }
    });
}

// Listen for viewport resize
window.addEventListener('resize', adjustWindowsToViewport);

// Function to get all window instances
export function getWindows() {
    return windows;
}

// Function to get all window states (e.g., for saving layout)
export function getAllWindowStates() {
    return windows.map(w => w.getState());
}

// Optional: Add a function to clear all windows
export function removeAllWindows() {
    windows.forEach(w => w.frame.remove());
    windows.length = 0; // Clear the array
    highestZIndex = 0;
} 