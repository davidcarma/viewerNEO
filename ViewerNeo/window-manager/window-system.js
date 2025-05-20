let highestZIndex = 0;
const windows = []; // Keep track of windows for z-ordering and state
let topBarOffset = 0; // Offset for a fixed bar at the top of the page

// Function to allow the main page to set the top bar offset
export function setTopBarOffset(offset) {
    topBarOffset = offset;
}

const closeSVG = `<svg viewBox=\"0 0 12 12\"><path d=\"M2.22 2.22L9.78 9.78M9.78 2.22L2.22 9.78\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>`;
const minimizeSVG = `<svg viewBox=\"0 0 12 12\"><path d=\"M2 6L10 6\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>`;
const maximizeSVG = `<svg viewBox=\"0 0 12 12\"><rect x=\"2.5\" y=\"2.5\" width=\"7\" height=\"7\" rx=\"1\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/></svg>`;
const restoreSVG = `<svg viewBox=\"0 0 12 12\"><rect x=\"3.5\" y=\"1.5\" width=\"7\" height=\"7\" rx=\"1\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><path d=\"M1.5 3.5 H6.5 V8.5 H1.5Z\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"#4a4a4a\"/></svg>`;


export function createWindow({ id = `window-${Date.now()}`, title = 'New Window', content = '', x = 100, y = 100, width = 400, height = 300, isMinimized = false, isMaximized = false }) {
    const windowContainer = document.getElementById('window-manager-container') || document.body;

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
        // Dispatch event when window is closed
        document.dispatchEvent(new CustomEvent('windowclosed', { detail: { id } }));
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
    
    // If content is a string, set as innerHTML. If it's a Node, append it.
    if (typeof content === 'string') {
        contentArea.innerHTML = content;
    } else if (content instanceof Node) {
        contentArea.appendChild(content);
    }

    const iframeShield = document.createElement('div');
    iframeShield.className = 'iframe-shield';
    // contentArea.style.position = 'relative'; // Already handled by window-frame usually or specific content needs
    iframeShield.style.top = '0';
    iframeShield.style.left = '0';
    iframeShield.style.width = '100%';
    iframeShield.style.height = '100%';
    // iframeShield should be appended to contentArea if contentArea itself could contain iframes
    // For general drag/resize, it might be better on windowFrame or a dedicated layer
    // For now, let's assume it's for content inside the window.
    contentArea.appendChild(iframeShield); 

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';

    windowFrame.appendChild(titleBar);
    windowFrame.appendChild(contentArea);
    windowFrame.appendChild(resizeHandle);
    // document.body.appendChild(windowFrame); // Append to the specific container
    windowContainer.appendChild(windowFrame);


    const bringToFront = () => {
        // Prevent z-index issues if it's the only window or already on top of its siblings within its container
        const siblings = Array.from(windowContainer.children).filter(child => child.classList.contains('window-frame'));
        const maxSiblingZIndex = Math.max(0, ...siblings.map(s => parseInt(s.style.zIndex) || 0));
        highestZIndex = Math.max(highestZIndex, maxSiblingZIndex); 
        windowFrame.style.zIndex = ++highestZIndex;
    };

    windowFrame.addEventListener('mousedown', bringToFront);
    // titleBar.addEventListener('mousedown', bringToFront); // Already covered by windowFrame mousedown

    if (isMinimizedState) {
        windowFrame.classList.add('minimized');
        // If minimized, content might not be visible, so shield logic might need adjustment.
    }
    if (isMaximizedState) {
        maximizeWindow(false); 
    }

    function toggleMinimize() {
        isMinimizedState = !isMinimizedState;
        windowFrame.classList.toggle('minimized', isMinimizedState);
        
        if (isMinimizedState) {
            // Optional: Store dimensions before minimizing if needed for a specific restore behavior
            // that CSS alone doesn't handle for `minimized` class.
            windowFrame.style.setProperty('--pre-minimize-width', windowFrame.style.width);
            windowFrame.style.setProperty('--pre-minimize-height', windowFrame.style.height);
            // Bring to front could be called here if minimized windows should also come to front
            // bringToFront(); 
        } else {
            // Restore to either maximized or original state
            if (isMaximizedState) {
                maximizeWindow(false); // Re-apply maximized state
            } else {
                // Ensure restored to originalState or last known good state
                windowFrame.style.left = `${originalState.x}px`;
                windowFrame.style.top = `${originalState.y}px`;
                windowFrame.style.width = windowFrame.style.getPropertyValue('--pre-minimize-width') || `${originalState.width}px`;
                windowFrame.style.height = windowFrame.style.getPropertyValue('--pre-minimize-height') || `${originalState.height}px`;
            }
        }
        // Dispatch event for minimize toggle
        document.dispatchEvent(new CustomEvent('windowminimized', { detail: { id, minimized: isMinimizedState } }));
    }

    titleBar.ondblclick = () => {
        if (isMinimizedState) {
            // If minimized, a double click should probably unminimize to previous state (maximized or normal)
            toggleMinimize(); 
        } else {
            toggleMaximize(); 
        }
    };

    function maximizeWindow(saveCurrentState = true) {
        const containerRect = windowContainer.getBoundingClientRect();

        if (saveCurrentState && !isMaximizedState) { 
            originalState = {
                x: windowFrame.offsetLeft,
                y: windowFrame.offsetTop,
                width: windowFrame.offsetWidth,
                height: windowFrame.offsetHeight,
            };
        }
        // Maximize within the windowContainer, considering the topBarOffset globally applied to the container's usable area
        windowFrame.style.left = '0px';
        windowFrame.style.top = '0px'; // Relative to windowContainer, topBarOffset is handled by main page layout
        windowFrame.style.width = `${containerRect.width}px`;
        windowFrame.style.height = `${containerRect.height}px`; 
        
        isMaximizedState = true;
        maximizeButton.innerHTML = restoreSVG;
        maximizeButton.title = 'Restore';
        windowFrame.classList.remove('minimized'); 
        windowFrame.classList.add('maximized'); // Add a class for maximized state
        isMinimizedState = false;
        bringToFront();
        document.dispatchEvent(new CustomEvent('windowmaximized', { detail: { id, maximized: true } }));
    }

    function restoreWindow() {
        windowFrame.style.left = `${originalState.x}px`;
        windowFrame.style.top = `${originalState.y}px`;
        windowFrame.style.width = `${originalState.width}px`;
        windowFrame.style.height = `${originalState.height}px`;
        isMaximizedState = false;
        maximizeButton.innerHTML = maximizeSVG;
        maximizeButton.title = 'Maximize';
        windowFrame.classList.remove('maximized'); // Remove maximized class
        bringToFront();
        document.dispatchEvent(new CustomEvent('windowmaximized', { detail: { id, maximized: false } }));
    }

    function toggleMaximize() {
        if (isMaximizedState) {
            restoreWindow();
        } else {
            maximizeWindow();
        }
    }

    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    titleBar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return; 
        // Allow dragging even if maximized, to potentially drag to another screen in future or re-dock.
        // For now, if maximized, dragging will do nothing until a snap/dock feature is added.
        // if (isMaximizedState) return; 

        isDragging = true;
        // Calculate offset relative to the window frame itself, not the container's clientX/Y
        dragOffsetX = e.clientX - windowFrame.getBoundingClientRect().left;
        dragOffsetY = e.clientY - windowFrame.getBoundingClientRect().top;
        
        iframeShield.style.display = 'block';
        bringToFront();
        e.preventDefault();
    });

    let isResizing = false;
    let resizeStartX, resizeStartY, initialWidth, initialHeight, initialFrameX, initialFrameY;

    resizeHandle.addEventListener('mousedown', (e) => {
        if (isMaximizedState || isMinimizedState) return;
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        initialWidth = windowFrame.offsetWidth;
        initialHeight = windowFrame.offsetHeight;
        initialFrameX = windowFrame.offsetLeft;
        initialFrameY = windowFrame.offsetTop;
        
        // originalState.width = initialWidth; // Should update originalState only on mouseup if not maximized
        // originalState.height = initialHeight;
        iframeShield.style.display = 'block'; 
        bringToFront();
        e.preventDefault();
        e.stopPropagation();
    });

    // Use a shared mousemove on the window manager container or document to capture mouse outside window
    // const moveTarget = windowContainer; // Or document for wider capture area
    document.addEventListener('mousemove', (e) => {
        e.preventDefault(); // Prevent text selection etc. during drag/resize
        if (isDragging) {
            let newX = e.clientX - dragOffsetX - windowContainer.getBoundingClientRect().left;
            let newY = e.clientY - dragOffsetY - windowContainer.getBoundingClientRect().top + windowContainer.scrollTop; // adjust for container scroll

            // Constrain within windowContainer boundaries
            newX = Math.max(0, Math.min(newX, windowContainer.scrollWidth - windowFrame.offsetWidth));
            newY = Math.max(0, Math.min(newY, windowContainer.scrollHeight - windowFrame.offsetHeight));
            
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

            // Prevent resizing beyond container boundaries
            if (initialFrameX + newWidth > windowContainer.scrollWidth) {
                newWidth = windowContainer.scrollWidth - initialFrameX;
            }
            if (initialFrameY + newHeight > windowContainer.scrollHeight) {
                newHeight = windowContainer.scrollHeight - initialFrameY;
            }

            windowFrame.style.width = `${newWidth}px`;
            windowFrame.style.height = `${newHeight}px`;
            // originalState update for width/height should happen on mouseup
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            iframeShield.style.display = 'none';
            // Update originalState position if not maximized after drag
            if (!isMaximizedState) {
                originalState.x = windowFrame.offsetLeft;
                originalState.y = windowFrame.offsetTop;
            }
            document.dispatchEvent(new CustomEvent('windowdragged', { detail: { id, x: originalState.x, y: originalState.y } }));
        }
        if (isResizing) {
            isResizing = false;
            iframeShield.style.display = 'none';
            // Update originalState dimensions if not maximized after resize
            if (!isMaximizedState) {
                originalState.width = windowFrame.offsetWidth;
                originalState.height = windowFrame.offsetHeight;
            }
            document.dispatchEvent(new CustomEvent('windowresized', { detail: { id, width: originalState.width, height: originalState.height } }));
        }
    });

    // Add to internal tracking array
    windows.push({ 
        id, 
        frame: windowFrame, 
        get state() { 
            return { 
                id, title, 
                x: windowFrame.offsetLeft, y: windowFrame.offsetTop, 
                width: windowFrame.offsetWidth, height: windowFrame.offsetHeight, 
                zIndex: parseInt(windowFrame.style.zIndex),
                isMinimized: isMinimizedState, 
                isMaximized: isMaximizedState 
            }; 
        }
    });
    document.dispatchEvent(new CustomEvent('windowcreated', { detail: { id } }));
    bringToFront(); // Ensure new window is on top
    return { id, frame: windowFrame }; 
}

export function getWindow(id) {
    return windows.find(w => w.id === id);
}

export function getWindows() {
    return [...windows];
}

export function getAllWindowStates() {
    return windows.map(w => w.state);
}

export function removeAllWindows() {
    windows.forEach(w => w.frame.remove());
    windows.length = 0; // Clear the array
    highestZIndex = 0;
    document.dispatchEvent(new CustomEvent('allwindowsremoved'));
}

// Optional: Add a function to focus a window by ID (brings to front)
export function focusWindow(id) {
    const win = getWindow(id);
    if (win) {
        // Mimic bringToFront logic for this specific window
        const windowContainer = win.frame.parentElement;
        const siblings = Array.from(windowContainer.children).filter(child => child.classList.contains('window-frame'));
        const maxSiblingZIndex = Math.max(0, ...siblings.map(s => parseInt(s.style.zIndex) || 0));
        highestZIndex = Math.max(highestZIndex, maxSiblingZIndex);
        win.frame.style.zIndex = ++highestZIndex;
        
        // If minimized, unminimize it
        const winData = windows.find(w => w.id === id); // Need internal state access
        // This part is tricky as internal state is not directly exposed. This is a conceptual addition.
        // For a real implementation, toggleMinimize might need to be callable with a target state.
        // if (winData && winData.isMinimized) { /* Call a function to unminimize */ }
    }
} 