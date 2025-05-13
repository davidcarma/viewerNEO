/**
 * Layout Manager
 * Provides drag functionality for components across main page and sub-pages
 */

class LayoutManager {
    constructor(containerSelector) {
        // Allow multiple containers or container types
        this.containers = [];
        
        // Try to find the container using the provided selector
        const directContainers = document.querySelectorAll(containerSelector);
        if (directContainers && directContainers.length > 0) {
            directContainers.forEach(container => this.containers.push(container));
        } else {
            console.warn(`Layout Manager: No containers found with selector: ${containerSelector}`);
        }
        
        // Also look for any element with class 'layout-container' for sub-pages
        const layoutContainers = document.querySelectorAll('.layout-container');
        if (layoutContainers && layoutContainers.length > 0) {
            layoutContainers.forEach(container => {
                if (!this.containers.includes(container)) {
                    this.containers.push(container);
                }
            });
        }
        
        // State variables
        this.dragging = null;
        this.dragOffset = { x: 0, y: 0 };
        this.currentContainer = null;
        this.startPosition = { x: 0, y: 0 };
        
        // Bind methods to maintain context
        this.handleDrag = this.handleDrag.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        
        // Watch for DOM changes to handle dynamically added content
        this.setupMutationObserver();
        
        // Listen for window resize to update container rects
        window.addEventListener('resize', () => this.updateContainerRects());
        
        // Debug mode for troubleshooting
        this.debug = false;
    }
    
    log(...args) {
        if (this.debug) {
            console.log('[LayoutManager]', ...args);
        }
    }
    
    setupMutationObserver() {
        // Create a MutationObserver to watch for new elements
        const observer = new MutationObserver((mutations) => {
            let needsUpdate = false;
            
            mutations.forEach(mutation => {
                // Check for added nodes that might be containers or draggable elements
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            // Check if this is a new container
                            if (node.classList && node.classList.contains('layout-container')) {
                                if (!this.containers.includes(node)) {
                                    this.containers.push(node);
                                    needsUpdate = true;
                                }
                            }
                            
                            // Check for draggable elements added
                            if (node.querySelectorAll) {
                                const draggables = node.querySelectorAll('.analysis-pane, .graph-container');
                                if (draggables.length > 0) {
                                    needsUpdate = true;
                                }
                            }
                        }
                    });
                }
            });
            
            // Update if needed
            if (needsUpdate) {
                this.initContainers();
            }
        });
        
        // Start observing
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }
    
    updateContainerRects() {
        // Update container rectangles for position calculations
        this.containers.forEach(container => {
            container.layoutRect = this.getElementRect(container);
        });
    }
    
    // Get complete rect information including scroll offsets
    getElementRect(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // Calculate any scroll offsets that might affect positioning
        let scrollX = 0;
        let scrollY = 0;
        
        // Check if element or its parents have scrolling
        let parent = element;
        while (parent) {
            scrollX += parent.scrollLeft || 0;
            scrollY += parent.scrollTop || 0;
            parent = parent.parentElement;
        }
        
        // Return comprehensive positioning information
        return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            scrollX,
            scrollY,
            position: style.position,
            zIndex: style.zIndex
        };
    }

    init() {
        if (this.containers.length === 0) {
            console.error('Layout Manager: No containers available');
            return;
        }
        
        this.initContainers();
        console.log(`Layout Manager initialized with ${this.containers.length} containers`);
    }
    
    initContainers() {
        // Process each container
        this.containers.forEach(container => {
            // Store rectangle for position calculations
            container.layoutRect = this.getElementRect(container);
            
            // Find draggable elements
            const elements = container.querySelectorAll('.analysis-pane, .graph-container');
            elements.forEach(element => {
                // Skip if already made draggable
                if (element.hasAttribute('data-draggable-initialized')) {
                    return;
                }
                
                this.makeDraggable(element, container);
                element.setAttribute('data-draggable-initialized', 'true');
            });
        });
    }

    makeDraggable(element, container) {
        // Skip null elements
        if (!element) return;
        
        // Add container reference
        element.layoutContainer = container;
        
        // Add draggable class
        element.classList.add('draggable');

        // Create or find drag handle
        let dragHandle = element.querySelector('.drag-handle');
        if (!dragHandle) {
            dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            
            // Add title to the handle
            const title = document.createElement('div');
            title.className = 'drag-handle-title';
            title.textContent = element.getAttribute('data-title') || 'Element';
            dragHandle.appendChild(title);
            
            // Insert at the beginning of the element
            element.insertBefore(dragHandle, element.firstChild);
        }

        // Set initial position if not set
        if (!element.style.left && !element.style.top) {
            element.style.left = '10px';
            element.style.top = '10px';
        }

        // Set up drag behavior
        dragHandle.addEventListener('mousedown', (e) => {
            // Prevent default and stop propagation
            e.preventDefault();
            e.stopPropagation();
            
            // Start drag
            this.startDrag(e, element);
        });
    }

    startDrag(e, element) {
        // Get container of this element
        this.currentContainer = element.layoutContainer || this.findContainerFor(element);
        if (!this.currentContainer) {
            console.error('Cannot find container for element', element);
            return;
        }
        
        // Update container rect
        this.currentContainer.layoutRect = this.getElementRect(this.currentContainer);
        
        // Store element's current position before moving
        const computedStyle = window.getComputedStyle(element);
        this.startPosition = {
            left: parseInt(computedStyle.left, 10) || 0,
            top: parseInt(computedStyle.top, 10) || 0
        };
        
        // Get element rect with all positioning details
        const elementRect = this.getElementRect(element);
        
        // Critical: Record exact mouse position relative to element
        this.dragOffset = {
            x: e.clientX - elementRect.left,
            y: e.clientY - elementRect.top
        };
        
        this.log('Start drag', {
            elementRect,
            dragOffset: this.dragOffset,
            startPosition: this.startPosition,
            clientX: e.clientX,
            clientY: e.clientY
        });
        
        // Track the element being dragged
        this.dragging = element;
        element.classList.add('dragging');
        
        // Add document-level event listeners
        document.addEventListener('mousemove', this.handleDrag, {capture: true});
        document.addEventListener('mouseup', this.handleMouseUp, {capture: true});
    }
    
    findContainerFor(element) {
        // Find which container this element belongs to
        for (const container of this.containers) {
            if (container.contains(element)) {
                return container;
            }
        }
        return null;
    }

    handleDrag(e) {
        if (!this.dragging || !this.currentContainer) return;
        
        // Prevent any default drag behavior
        e.preventDefault();
        e.stopPropagation();
        
        // Get container rect including scroll information
        const containerRect = this.currentContainer.layoutRect;
        
        // Calculate exact new position using direct translation from mouse movement
        // This is the critical fix for the hopping issue
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // Calculate position relative to container
        let newX = mouseX - containerRect.left - this.dragOffset.x;
        let newY = mouseY - containerRect.top - this.dragOffset.y;
        
        // When in fullscreen or absolute position contexts, use more direct positioning
        if (this.currentContainer.matches('.fullscreen, [fullscreen], .projection-overlay, body')) {
            newX = mouseX - this.dragOffset.x;
            newY = mouseY - this.dragOffset.y;
        }
        
        // Debug info
        this.log('Dragging', {
            mouseX, mouseY,
            containerLeft: containerRect.left,
            containerTop: containerRect.top,
            dragOffsetX: this.dragOffset.x,
            dragOffsetY: this.dragOffset.y,
            newX, newY
        });
        
        // Get element dimensions for bounds checking
        const elementRect = this.getElementRect(this.dragging);
        
        // Keep element within container bounds
        const maxX = containerRect.width - elementRect.width;
        const maxY = containerRect.height - elementRect.height;
        
        // Apply new position with bounds checking and pixel rounding
        const boundedX = Math.max(0, Math.min(newX, maxX));
        const boundedY = Math.max(0, Math.min(newY, maxY));
        
        // Apply the calculated position
        this.dragging.style.left = `${Math.round(boundedX)}px`;
        this.dragging.style.top = `${Math.round(boundedY)}px`;
    }

    handleMouseUp(e) {
        if (!this.dragging) return;
        
        // Prevent any default behavior
        e.preventDefault();
        e.stopPropagation();
        
        // Debug info
        this.log('End drag', {
            finalLeft: this.dragging.style.left,
            finalTop: this.dragging.style.top
        });
        
        // Clean up
        this.dragging.classList.remove('dragging');
        this.dragging = null;
        this.currentContainer = null;
        this.startPosition = null;
        
        // Remove event listeners
        document.removeEventListener('mousemove', this.handleDrag, {capture: true});
        document.removeEventListener('mouseup', this.handleMouseUp, {capture: true});
    }
}

// Initialize layout manager
document.addEventListener('DOMContentLoaded', () => {
    // Initialize with main container and also look for layout-container class
    window.layoutManager = new LayoutManager('#container, .layout-container, .projection-overlay');
    window.layoutManager.init();
    
    // Make layout manager available globally for sub-pages to use
    window.initLayoutManager = () => {
        if (window.layoutManager) {
            window.layoutManager.initContainers();
        }
    };
}); 