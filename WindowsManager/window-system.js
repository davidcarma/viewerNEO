let highestZIndex = 0;
const windows = []; // Keep track of windows for z-ordering and state
let topBarOffset = 0; // Offset for a fixed bar at the top of the page

// Function to allow the main page to set the top bar offset
export function setTopBarOffset(offset) {
    topBarOffset = offset;
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
        windowFrame.style.left = '0px';
        windowFrame.style.top = `${topBarOffset}px`; // Use the offset
        windowFrame.style.width = `${window.innerWidth}px`;
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
            newX = Math.max(0, Math.min(newX, window.innerWidth - windowFrame.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - windowFrame.offsetHeight));
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
            
            // Enforce minimum dimensions (defined in CSS or here)
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
        if (isDragging || isResizing) {
            iframeShield.style.display = 'none'; // Hide shield
        }
        isDragging = false;
        isResizing = false;
    });

    const windowInstance = {
        id,
        title,
        frame: windowFrame,
        getState: () => {
            if (isMaximizedState) {
                return { id, title, x: originalState.x, y: originalState.y, width: originalState.width, height: originalState.height, zIndex: parseInt(windowFrame.style.zIndex), isMinimized: isMinimizedState, isMaximized: true };
            } else {
                return { id, title, x: windowFrame.offsetLeft, y: windowFrame.offsetTop, width: windowFrame.offsetWidth, height: windowFrame.offsetHeight, zIndex: parseInt(windowFrame.style.zIndex), isMinimized: isMinimizedState, isMaximized: false };
            }
        },
        applyState: (s) => {
            // s: { x, y, width, height, zIndex, isMinimized, isMaximized }

            // 1. Set "original" (restored) state from saved state
            originalState.x = s.x;
            originalState.y = s.y;
            originalState.width = s.width;
            originalState.height = s.height;

            // 2. Apply restored dimensions and remove transient classes
            windowFrame.style.left = `${originalState.x}px`;
            windowFrame.style.top = `${originalState.y}px`;
            windowFrame.style.width = `${originalState.width}px`;
            windowFrame.style.height = `${originalState.height}px`;
            windowFrame.classList.remove('minimized'); // Start from a clean slate before applying new states

            // 3. Handle Maximized State
            if (s.isMaximized) {
                if (!isMaximizedState) maximizeWindow(false); // Maximize if not already (false: use existing originalState)
            } else {
                if (isMaximizedState) restoreWindow(); // Restore if currently maximized
            }
            
            // 4. Handle Minimized State (after potential un-maximization)
            isMinimizedState = s.isMinimized; // Directly set the state variable
            windowFrame.classList.toggle('minimized', s.isMinimized); // Apply class based on this new state
            
            // If unminimized and NOT maximized, ensure dimensions are from originalState
            // This might be redundant if step 2 and restoreWindow() cover it, but good for clarity.
            if (!s.isMinimized && !s.isMaximized) {
                 windowFrame.style.width = `${originalState.width}px`;
                 windowFrame.style.height = `${originalState.height}px`;
            }

            // 5. Set zIndex
            windowFrame.style.zIndex = s.zIndex;
            if (s.zIndex > highestZIndex) {
                highestZIndex = s.zIndex; // Keep global highestZIndex updated
            }
        }
    };

    windows.push(windowInstance);
    return windowFrame;
}

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