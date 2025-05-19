let highestZIndex = 0;

export function createWindow({ title = 'New Window', content = '', x = 100, y = 100, width = 400, height = 300 }) {
    const windowFrame = document.createElement('div');
    windowFrame.className = 'window-frame';
    windowFrame.style.left = `${x}px`;
    windowFrame.style.top = `${y}px`;
    windowFrame.style.width = `${width}px`;
    windowFrame.style.height = `${height}px`;
    windowFrame.style.zIndex = ++highestZIndex;

    const titleBar = document.createElement('div');
    titleBar.className = 'window-title-bar';

    const titleText = document.createElement('h2');
    titleText.className = 'window-title';
    titleText.textContent = title;

    const controls = document.createElement('div');
    controls.className = 'window-controls';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;'; // Using HTML entity for '×'
    closeButton.title = 'Close';
    closeButton.onclick = () => {
        windowFrame.remove();
    };

    controls.appendChild(closeButton);
    titleBar.appendChild(titleText);
    titleBar.appendChild(controls);

    const contentArea = document.createElement('div');
    contentArea.className = 'window-content';
    contentArea.innerHTML = content; // Allow HTML content

    windowFrame.appendChild(titleBar);
    windowFrame.appendChild(contentArea);
    document.body.appendChild(windowFrame);

    // Bring to front on click
    windowFrame.addEventListener('mousedown', () => {
        windowFrame.style.zIndex = ++highestZIndex;
    });

    // Drag functionality
    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    titleBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragOffsetX = e.clientX - windowFrame.offsetLeft;
        dragOffsetY = e.clientY - windowFrame.offsetTop;
        // Bring to front when starting drag
        windowFrame.style.zIndex = ++highestZIndex;
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            let newX = e.clientX - dragOffsetX;
            let newY = e.clientY - dragOffsetY;

            // Basic boundary collision (optional, can be improved)
            newX = Math.max(0, Math.min(newX, window.innerWidth - windowFrame.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - windowFrame.offsetHeight));

            windowFrame.style.left = `${newX}px`;
            windowFrame.style.top = `${newY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    return windowFrame;
} 