/**
 * Layout Manager for Projection Overlay
 * Provides drag, resize, and alignment functionality for projection components
 */

class LayoutManager {
    constructor(containerId) {
        console.log('LayoutManager constructor called with:', containerId);
        
        // Try different methods to find the container
        this.container = null;
        
        if (typeof containerId === 'string') {
            this.container = document.getElementById(containerId);
        }
        
        if (!this.container) {
            this.container = document.querySelector('.projection-main-area');
        }
        
        // If still no container, log error and exit
        if (!this.container) {
            console.error('LayoutManager: Could not find container element');
            return;
        }
        
        console.log('LayoutManager: Container found', this.container);
        
        // Initialize properties
        this.draggableElements = [];
        this.snapToGrid = false;
        this.gridSize = 20;
        this.activeElement = null;
        this.resizing = false;
        this.resizeDirection = '';
        this.dragOffset = { x: 0, y: 0 }; // Store offset from mouse to element corner
        
        // Ensure method binding (manually bind each method that needs 'this' context)
        this.makeElementsDraggable = this.makeElementsDraggable.bind(this);
        this.makeDraggable = this.makeDraggable.bind(this);
        this.startDrag = this.startDrag.bind(this);
        this.startResize = this.startResize.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleDrag = this.handleDrag.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.checkAlignment = this.checkAlignment.bind(this);
        this.resetElementPosition = this.resetElementPosition.bind(this);
        this.toggleSnap = this.toggleSnap.bind(this);
        this.init = this.init.bind(this);
        this.addSnapToggle = this.addSnapToggle.bind(this);
        this.setupInitialLayout = this.setupInitialLayout.bind(this);
        this.updateGridSize = this.updateGridSize.bind(this);
        this.makeTableResizable = this.makeTableResizable.bind(this);
        
        // Create alignment guides
        try {
            this.horizontalGuide = document.createElement('div');
            this.horizontalGuide.className = 'alignment-guide horizontal';
            this.horizontalGuide.style.display = 'none';
            
            this.verticalGuide = document.createElement('div');
            this.verticalGuide.className = 'alignment-guide vertical';
            this.verticalGuide.style.display = 'none';
            
            this.container.appendChild(this.horizontalGuide);
            this.container.appendChild(this.verticalGuide);
            
            console.log('Added alignment guides to container');
        } catch (error) {
            console.error('Error creating alignment guides:', error);
        }
        
        // Track initial positions and sizes
        this.initialX = 0;
        this.initialY = 0;
        this.initialLeft = 0;
        this.initialTop = 0;
        this.initialWidth = 0;
        this.initialHeight = 0;
        
        console.log('LayoutManager constructor completed successfully');
    }
    
    // Update grid size method
    updateGridSize(newSize) {
        if (newSize > 0) {
            this.gridSize = newSize;
            console.log(`Grid size updated to ${newSize}px`);
            
            // Update the grid size display if it exists
            const gridSizeDisplay = document.getElementById('grid-size-display');
            if (gridSizeDisplay) {
                gridSizeDisplay.textContent = `${newSize}px`;
            }
        }
    }
    
    // Make tables resizable
    makeTableResizable() {
        const tables = this.container.querySelectorAll('.peak-table');
        tables.forEach(table => {
            // Check if table is already resizable
            if (table.classList.contains('resizable-table')) return;
            
            table.classList.add('resizable-table');
            
            // Make table expandable/collapsible
            if (table.parentElement) {
                // Create expand button
                const expandBtn = document.createElement('button');
                expandBtn.className = 'table-expand-btn';
                expandBtn.innerHTML = '&#x21A7;'; // Down arrow
                expandBtn.title = 'Expand table';
                
                expandBtn.addEventListener('click', () => {
                    const currentHeight = table.style.maxHeight || 
                                         getComputedStyle(table).maxHeight;
                    
                    if (currentHeight === 'none' || currentHeight === 'auto') {
                        table.style.maxHeight = '150px'; // Collapse
                        expandBtn.innerHTML = '&#x21A7;'; // Down arrow
                        expandBtn.title = 'Expand table';
                    } else {
                        table.style.maxHeight = 'none'; // Expand
                        expandBtn.innerHTML = '&#x21A5;'; // Up arrow
                        expandBtn.title = 'Collapse table';
                    }
                });
                
                // Insert before the table
                table.parentElement.insertBefore(expandBtn, table);
            }
        });
    }
    
    // Initialize draggable elements
    init() {
        if (!this.container) {
            console.error('LayoutManager: Cannot initialize, container not found');
            return;
        }
        
        console.log('LayoutManager: Initializing...');
        
        try {
            // When initializing in the projection overlay, make it use a custom layout
            const projectionLayout = document.querySelector('.projection-layout');
            if (projectionLayout) {
                projectionLayout.classList.add('custom-layout');
                console.log('Added custom-layout class to projection-layout');
            } else {
                console.warn('projection-layout element not found');
            }
            
            // Make elements draggable
            this.makeElementsDraggable();
            
            // Make tables resizable
            this.makeTableResizable();
            
            // Add snap toggle button
            this.addSnapToggle();
            
            // Initial layout setup
            this.setupInitialLayout();
            
            console.log('LayoutManager: Initialization complete');
        } catch (error) {
            console.error('Error in LayoutManager.init():', error);
        }
    }
    
    // Add snap toggle button to controls
    addSnapToggle() {
        const controlsArea = document.querySelector('.view-controls');
        if (controlsArea) {
            // Create container for grid controls
            const gridControlsContainer = document.createElement('div');
            gridControlsContainer.className = 'grid-controls-container';
            
            // Snap toggle button
            const snapButton = document.createElement('button');
            snapButton.className = 'snap-grid-toggle';
            snapButton.textContent = 'Snap to Grid';
            snapButton.addEventListener('click', this.toggleSnap);
            
            // Grid size control
            const gridSizeLabel = document.createElement('label');
            gridSizeLabel.textContent = 'Grid Size: ';
            gridSizeLabel.style.color = 'white';
            gridSizeLabel.style.marginLeft = '10px';
            
            const gridSizeInput = document.createElement('input');
            gridSizeInput.type = 'number';
            gridSizeInput.min = '5';
            gridSizeInput.max = '100';
            gridSizeInput.value = this.gridSize;
            gridSizeInput.style.width = '50px';
            gridSizeInput.addEventListener('change', (e) => {
                const newSize = parseInt(e.target.value, 10);
                if (!isNaN(newSize) && newSize > 0) {
                    this.updateGridSize(newSize);
                }
            });
            
            // Grid size display
            const gridSizeDisplay = document.createElement('span');
            gridSizeDisplay.id = 'grid-size-display';
            gridSizeDisplay.textContent = `${this.gridSize}px`;
            gridSizeDisplay.style.marginLeft = '5px';
            gridSizeDisplay.style.color = 'white';
            
            // Assemble controls
            gridSizeLabel.appendChild(gridSizeInput);
            gridSizeLabel.appendChild(gridSizeDisplay);
            
            // Add to container
            gridControlsContainer.appendChild(snapButton);
            gridControlsContainer.appendChild(gridSizeLabel);
            
            // Add to view controls
            controlsArea.appendChild(gridControlsContainer);
            
            this.snapButton = snapButton;
        }
    }
    
    // Toggle snap to grid
    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
        if (this.snapButton) {
            this.snapButton.classList.toggle('active', this.snapToGrid);
        }
    }
    
    // Set up initial positions of draggable elements
    setupInitialLayout() {
        // For now, rely on the existing CSS layout
        // Later we could implement saved layouts
    }
    
    // Make elements draggable
    makeElementsDraggable() {
        if (!this.container) {
            console.error('LayoutManager: Cannot make elements draggable, container not found');
            return;
        }
        
        try {
            // Find elements to make draggable
            const analysisElements = this.container.querySelectorAll('.analysis-pane');
            const graphElements = this.container.querySelectorAll('.graph-container');
            
            console.log(`Found ${analysisElements.length} analysis panes and ${graphElements.length} graph containers`);
            
            // Process analysis panes
            analysisElements.forEach(element => {
                try {
                    this.makeDraggable(element);
                } catch (err) {
                    console.error('Error making analysis pane draggable:', err);
                }
            });
            
            // Process graph containers
            graphElements.forEach(element => {
                try {
                    this.makeDraggable(element);
                } catch (err) {
                    console.error('Error making graph container draggable:', err);
                }
            });
        } catch (error) {
            console.error('Error in makeElementsDraggable:', error);
        }
    }
    
    // Make a single element draggable
    makeDraggable(element) {
        if (element.classList.contains('draggable')) return;
        
        // Add draggable class
        element.classList.add('draggable');
        
        // Create drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        
        // Add grip icon
        const grip = document.createElement('span');
        grip.className = 'drag-handle-grip';
        dragHandle.appendChild(grip);
        
        // Add title based on element content
        const title = document.createElement('span');
        title.className = 'drag-handle-title';
        let titleText = '';
        
        if (element.classList.contains('analysis-pane')) {
            const heading = element.querySelector('h3');
            titleText = heading ? heading.innerText : 'Analysis Pane';
        } else if (element.classList.contains('graph-container')) {
            const label = element.querySelector('.graph-label');
            titleText = label ? label.innerText : 'Graph';
        }
        
        title.innerText = titleText;
        dragHandle.appendChild(title);
        
        // Add controls
        const controls = document.createElement('div');
        controls.className = 'drag-handle-controls';
        
        // Reset position button
        const resetBtn = document.createElement('button');
        resetBtn.innerHTML = '&#8634;'; // Reset icon
        resetBtn.title = 'Reset Position';
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.resetElementPosition(element);
        });
        controls.appendChild(resetBtn);
        
        dragHandle.appendChild(controls);
        element.appendChild(dragHandle);
        
        // Add resize handles
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.direction = pos;
            element.appendChild(handle);
            
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, element, pos);
            });
        });
        
        // Add mousedown event for dragging
        dragHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startDrag(e, element);
        });
        
        // Track this element
        this.draggableElements.push({
            element,
            dragHandle,
            position: { x: 0, y: 0 },
            size: { width: element.offsetWidth, height: element.offsetHeight }
        });
    }
    
    // Start dragging an element
    startDrag(e, element) {
        if (!element || !this.container) {
            console.error('Invalid element or container for dragging');
            return;
        }
        
        e.preventDefault();
        
        this.activeElement = element;
        element.classList.add('dragging');
        
        try {
            // Get initial mouse position
            this.initialX = e.clientX;
            this.initialY = e.clientY;
            
            // Get element's current position
            const rect = element.getBoundingClientRect();
            
            if (!rect) {
                console.error('Unable to get bounding client rect for element', element);
                return;
            }
            
            const containerRect = this.container.getBoundingClientRect();
            
            if (!containerRect) {
                console.error('Unable to get bounding client rect for container', this.container);
                return;
            }
            
            // Calculate position relative to container
            this.initialLeft = rect.left - containerRect.left;
            this.initialTop = rect.top - containerRect.top;
            
            // Calculate the offset from the mouse to the element's top-left corner
            // This ensures we drag from the exact point we clicked, not the element's corner
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            // Set absolute positioning if not already set
            if (getComputedStyle(element).position !== 'absolute') {
                element.style.position = 'absolute';
                element.style.left = `${this.initialLeft}px`;
                element.style.top = `${this.initialTop}px`;
                element.style.width = `${rect.width}px`;
                element.style.height = `${rect.height}px`;
                
                // If this is a flex item, we need to make it a block element
                element.style.flex = 'none';
            }
            
            // Add global mouse event listeners
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
            
        } catch (error) {
            console.error('Error in startDrag:', error);
            // Clean up in case of error
            element.classList.remove('dragging');
            this.activeElement = null;
        }
    }
    
    // Start resizing an element
    startResize(e, element, direction) {
        e.preventDefault();
        
        this.activeElement = element;
        this.resizing = true;
        this.resizeDirection = direction;
        element.classList.add('dragging');
        
        // Get initial mouse position
        this.initialX = e.clientX;
        this.initialY = e.clientY;
        
        // Get element's current position and size
        const rect = element.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        this.initialLeft = rect.left - containerRect.left;
        this.initialTop = rect.top - containerRect.top;
        this.initialWidth = rect.width;
        this.initialHeight = rect.height;
        
        // Make sure the element has absolute positioning
        if (getComputedStyle(element).position !== 'absolute') {
            element.style.position = 'absolute';
            element.style.left = `${this.initialLeft}px`;
            element.style.top = `${this.initialTop}px`;
            element.style.width = `${rect.width}px`;
            element.style.height = `${rect.height}px`;
            element.style.flex = 'none';
        }
        
        // Add global mouse event listeners
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }
    
    // Handle mouse movement for drag or resize
    handleMouseMove(e) {
        if (!this.activeElement) return;
        
        if (this.resizing) {
            this.handleResize(e);
        } else {
            this.handleDrag(e);
        }
    }
    
    // Handle drag movement
    handleDrag(e) {
        const containerRect = this.container.getBoundingClientRect();
        
        // Calculate new position based on the mouse position and drag offset
        let newLeft = e.clientX - containerRect.left - this.dragOffset.x;
        let newTop = e.clientY - containerRect.top - this.dragOffset.y;
        
        // Apply snap to grid if enabled
        if (this.snapToGrid) {
            newLeft = Math.round(newLeft / this.gridSize) * this.gridSize;
            newTop = Math.round(newTop / this.gridSize) * this.gridSize;
        }
        
        // Check for alignment with other elements and container edges/center
        const { showHorizontalGuide, horizontalGuidePos, showVerticalGuide, verticalGuidePos } = 
            this.checkAlignment(newLeft, newTop, this.activeElement);
        
        // Show alignment guides if needed
        if (showHorizontalGuide) {
            this.horizontalGuide.style.display = 'block';
            this.horizontalGuide.style.top = `${horizontalGuidePos}px`;
            // Snap to horizontal guide
            newTop = horizontalGuidePos;
        } else {
            this.horizontalGuide.style.display = 'none';
        }
        
        if (showVerticalGuide) {
            this.verticalGuide.style.display = 'block';
            this.verticalGuide.style.left = `${verticalGuidePos}px`;
            // Snap to vertical guide
            newLeft = verticalGuidePos;
        } else {
            this.verticalGuide.style.display = 'none';
        }
        
        // Ensure the element stays within the container bounds
        newLeft = Math.max(0, newLeft);
        newTop = Math.max(0, newTop);
        
        // Apply the new position
        this.activeElement.style.left = `${newLeft}px`;
        this.activeElement.style.top = `${newTop}px`;
    }
    
    // Handle resize movement
    handleResize(e) {
        // Calculate how far the mouse has moved
        const deltaX = e.clientX - this.initialX;
        const deltaY = e.clientY - this.initialY;
        
        let newLeft = this.initialLeft;
        let newTop = this.initialTop;
        let newWidth = this.initialWidth;
        let newHeight = this.initialHeight;
        
        // Apply resize based on direction
        switch (this.resizeDirection) {
            case 'top-left':
                newLeft = this.initialLeft + deltaX;
                newTop = this.initialTop + deltaY;
                newWidth = this.initialWidth - deltaX;
                newHeight = this.initialHeight - deltaY;
                break;
            case 'top-right':
                newTop = this.initialTop + deltaY;
                newWidth = this.initialWidth + deltaX;
                newHeight = this.initialHeight - deltaY;
                break;
            case 'bottom-left':
                newLeft = this.initialLeft + deltaX;
                newWidth = this.initialWidth - deltaX;
                newHeight = this.initialHeight + deltaY;
                break;
            case 'bottom-right':
                newWidth = this.initialWidth + deltaX;
                newHeight = this.initialHeight + deltaY;
                break;
        }
        
        // Apply snap to grid if enabled
        if (this.snapToGrid) {
            newLeft = Math.round(newLeft / this.gridSize) * this.gridSize;
            newTop = Math.round(newTop / this.gridSize) * this.gridSize;
            newWidth = Math.round(newWidth / this.gridSize) * this.gridSize;
            newHeight = Math.round(newHeight / this.gridSize) * this.gridSize;
        }
        
        // Determine minimum sizes based on element type
        let minWidth = 100;
        let minHeight = 50;
        
        // Use smaller minimums for tables to allow more visibility
        if (this.activeElement.querySelector('.peak-table')) {
            minWidth = 200; // Tables need more width to be useful
            minHeight = 150; // Higher minimum to show more rows
        } else if (this.activeElement.classList.contains('analysis-pane')) {
            minWidth = 180;
            minHeight = 100;
        }
        
        // Enforce minimum sizes
        if (newWidth < minWidth) newWidth = minWidth;
        if (newHeight < minHeight) newHeight = minHeight;
        
        // Apply the new position and size
        this.activeElement.style.left = `${newLeft}px`;
        this.activeElement.style.top = `${newTop}px`;
        this.activeElement.style.width = `${newWidth}px`;
        this.activeElement.style.height = `${newHeight}px`;
        
        // If this is a table-containing element, adjust the table's max-height
        const table = this.activeElement.querySelector('.peak-table');
        if (table) {
            // Set table height to be slightly less than container to allow for padding
            const tableHeight = newHeight - 30; // Allow for padding/headers
            table.style.maxHeight = `${tableHeight}px`;
            table.style.height = `${tableHeight}px`;
        }
    }
    
    // Handle mouse up - end drag/resize
    handleMouseUp() {
        if (this.activeElement) {
            this.activeElement.classList.remove('dragging');
            this.activeElement = null;
        }
        
        this.resizing = false;
        this.resizeDirection = '';
        
        // Hide alignment guides
        this.horizontalGuide.style.display = 'none';
        this.verticalGuide.style.display = 'none';
        
        // Remove global mouse event listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
    
    // Check for alignment with other elements
    checkAlignment(left, top, activeElement) {
        const threshold = 10; // Snap threshold in pixels
        let showHorizontalGuide = false;
        let horizontalGuidePos = 0;
        let showVerticalGuide = false;
        let verticalGuidePos = 0;
        
        // Get bounds of the active element
        const activeBounds = activeElement.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        // Adjusted positions and dimensions
        const activeTop = top;
        const activeBottom = activeTop + activeBounds.height;
        const activeLeft = left;
        const activeRight = activeLeft + activeBounds.width;
        const activeMiddleY = activeTop + activeBounds.height / 2;
        const activeMiddleX = activeLeft + activeBounds.width / 2;
        
        // Container dimensions
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // Helper function to check if a snap should take priority
        const isPrioritySnap = (distance) => distance < 5; // Tighter threshold for priority
        
        // Check container edges first (with better center alignment)
        // Top edge
        const topEdgeDist = Math.abs(activeTop);
        if (topEdgeDist < threshold) {
            showHorizontalGuide = true;
            horizontalGuidePos = 0;
        }
        
        // Bottom edge
        const bottomEdgeDist = Math.abs(activeBottom - containerHeight);
        if (bottomEdgeDist < threshold && (!showHorizontalGuide || isPrioritySnap(bottomEdgeDist))) {
            showHorizontalGuide = true;
            horizontalGuidePos = containerHeight - activeBounds.height;
        }
        
        // Horizontal center
        const horizCenterDist = Math.abs(activeMiddleY - containerHeight / 2);
        if (horizCenterDist < threshold && (!showHorizontalGuide || isPrioritySnap(horizCenterDist))) {
            showHorizontalGuide = true;
            horizontalGuidePos = containerHeight / 2 - activeBounds.height / 2;
        }
        
        // Left edge
        const leftEdgeDist = Math.abs(activeLeft);
        if (leftEdgeDist < threshold) {
            showVerticalGuide = true;
            verticalGuidePos = 0;
        }
        
        // Right edge
        const rightEdgeDist = Math.abs(activeRight - containerWidth);
        if (rightEdgeDist < threshold && (!showVerticalGuide || isPrioritySnap(rightEdgeDist))) {
            showVerticalGuide = true;
            verticalGuidePos = containerWidth - activeBounds.width;
        }
        
        // Vertical center
        const vertCenterDist = Math.abs(activeMiddleX - containerWidth / 2);
        if (vertCenterDist < threshold && (!showVerticalGuide || isPrioritySnap(vertCenterDist))) {
            showVerticalGuide = true;
            verticalGuidePos = containerWidth / 2 - activeBounds.width / 2;
        }
        
        // Check horizontal quarter lines
        const quarterHeight = containerHeight / 4;
        const threeQuarterHeight = quarterHeight * 3;
        
        if (Math.abs(activeTop - quarterHeight) < threshold && (!showHorizontalGuide || isPrioritySnap(Math.abs(activeTop - quarterHeight)))) {
            showHorizontalGuide = true;
            horizontalGuidePos = quarterHeight;
        }
        
        if (Math.abs(activeTop - threeQuarterHeight) < threshold && (!showHorizontalGuide || isPrioritySnap(Math.abs(activeTop - threeQuarterHeight)))) {
            showHorizontalGuide = true;
            horizontalGuidePos = threeQuarterHeight;
        }
        
        // Check vertical quarter lines
        const quarterWidth = containerWidth / 4;
        const threeQuarterWidth = quarterWidth * 3;
        
        if (Math.abs(activeLeft - quarterWidth) < threshold && (!showVerticalGuide || isPrioritySnap(Math.abs(activeLeft - quarterWidth)))) {
            showVerticalGuide = true;
            verticalGuidePos = quarterWidth;
        }
        
        if (Math.abs(activeLeft - threeQuarterWidth) < threshold && (!showVerticalGuide || isPrioritySnap(Math.abs(activeLeft - threeQuarterWidth)))) {
            showVerticalGuide = true;
            verticalGuidePos = threeQuarterWidth;
        }
        
        // Check alignment with other draggable elements
        this.draggableElements.forEach(item => {
            if (item.element === activeElement) return;
            
            const elemRect = item.element.getBoundingClientRect();
            const elemTop = elemRect.top - containerRect.top;
            const elemBottom = elemTop + elemRect.height;
            const elemLeft = elemRect.left - containerRect.left;
            const elemRight = elemLeft + elemRect.width;
            const elemMiddleY = elemTop + elemRect.height / 2;
            const elemMiddleX = elemLeft + elemRect.width / 2;
            
            // Check vertical alignment (top, middle, bottom)
            const topAlignDist = Math.abs(activeTop - elemTop);
            if (topAlignDist < threshold && (!showHorizontalGuide || isPrioritySnap(topAlignDist))) {
                showHorizontalGuide = true;
                horizontalGuidePos = elemTop;
            }
            
            const bottomAlignDist = Math.abs(activeBottom - elemBottom);
            if (bottomAlignDist < threshold && (!showHorizontalGuide || isPrioritySnap(bottomAlignDist))) {
                showHorizontalGuide = true;
                horizontalGuidePos = elemBottom - activeBounds.height;
            }
            
            const middleYAlignDist = Math.abs(activeMiddleY - elemMiddleY);
            if (middleYAlignDist < threshold && (!showHorizontalGuide || isPrioritySnap(middleYAlignDist))) {
                showHorizontalGuide = true;
                horizontalGuidePos = elemMiddleY - activeBounds.height / 2;
            }
            
            // Check horizontal alignment (left, middle, right)
            const leftAlignDist = Math.abs(activeLeft - elemLeft);
            if (leftAlignDist < threshold && (!showVerticalGuide || isPrioritySnap(leftAlignDist))) {
                showVerticalGuide = true;
                verticalGuidePos = elemLeft;
            }
            
            const rightAlignDist = Math.abs(activeRight - elemRight);
            if (rightAlignDist < threshold && (!showVerticalGuide || isPrioritySnap(rightAlignDist))) {
                showVerticalGuide = true;
                verticalGuidePos = elemRight - activeBounds.width;
            }
            
            const middleXAlignDist = Math.abs(activeMiddleX - elemMiddleX);
            if (middleXAlignDist < threshold && (!showVerticalGuide || isPrioritySnap(middleXAlignDist))) {
                showVerticalGuide = true;
                verticalGuidePos = elemMiddleX - activeBounds.width / 2;
            }
        });
        
        return { showHorizontalGuide, horizontalGuidePos, showVerticalGuide, verticalGuidePos };
    }
    
    // Reset an element to its original position
    resetElementPosition(element) {
        element.style.position = '';
        element.style.left = '';
        element.style.top = '';
        element.style.width = '';
        element.style.height = '';
        element.style.flex = '';
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // No immediate initialization - wait until needed
    window.projectionLayoutManager = null;
});

// Additional function to initialize layout manager after projection overlay is created
function initLayoutManager() {
    // Delay initialization to ensure DOM elements are ready
    setTimeout(() => {
        try {
            const container = document.querySelector('.projection-main-area');
            if (!container) {
                console.warn('Projection main area not found, postponing layout manager initialization');
                return;
            }
            
            // Create new manager instance only if needed
            if (!window.projectionLayoutManager) {
                window.projectionLayoutManager = new LayoutManager('projection-main-area');
            }
            
            // Initialize the manager
            window.projectionLayoutManager.init();
            console.log('Layout manager initialized successfully');
            
        } catch (error) {
            console.error('Error initializing layout manager:', error);
        }
    }, 500); // Longer delay to ensure layout is fully rendered
} 