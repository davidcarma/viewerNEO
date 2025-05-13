/**
 * Sub-page Layout Manager Initializer
 * Add this script to sub-pages that need the layout manager
 */

document.addEventListener('DOMContentLoaded', function() {
    // Mark all potential containers for draggable elements
    const containers = [
        ...document.querySelectorAll('.analysis-container, .projection-container, main, .content-area, .projection-overlay'),
        ...document.querySelectorAll('[data-layout-container]'),
        document.body // Last resort container
    ].filter(Boolean); // Remove null/undefined
    
    // Add layout-container class to containers
    containers.forEach(container => {
        if (container) {
            container.classList.add('layout-container');
            
            // Make sure container has proper positioning
            const computedStyle = window.getComputedStyle(container);
            if (computedStyle.position === 'static') {
                container.style.position = 'relative';
            }
            
            console.log('Marked container for layout manager:', container);
        }
    });
    
    // Fix for fullscreen containers
    const fullscreenContainers = document.querySelectorAll('.fullscreen, [fullscreen]');
    fullscreenContainers.forEach(container => {
        container.classList.add('layout-container');
        container.style.position = 'fixed';
        container.style.zIndex = 9000;
        console.log('Marked fullscreen container');
    });
    
    // Fix for any z-index conflicts
    document.querySelectorAll('.draggable').forEach(element => {
        element.style.zIndex = 10000;
    });
    
    // Create a function to fix positioning context for draggable elements
    function fixPositioningContext() {
        // Find any incorrectly positioned draggable elements
        document.querySelectorAll('.draggable').forEach(element => {
            // Make sure element has absolute positioning
            element.style.position = 'absolute';
            
            // Fix for drag handle positioning
            const dragHandle = element.querySelector('.drag-handle');
            if (dragHandle) {
                dragHandle.style.position = 'absolute';
                dragHandle.style.top = '0';
                dragHandle.style.left = '0';
                dragHandle.style.right = '0';
            }
        });
    }
    
    // Run the fix immediately and after a short delay
    fixPositioningContext();
    setTimeout(fixPositioningContext, 200);
    
    // Initialize layout manager with retry logic
    function initLayoutManager(retryCount = 0) {
        // Try to access existing layout manager
        if (window.layoutManager) {
            console.log('Using existing layout manager');
            window.layoutManager.initContainers();
            window.layoutManager.updateContainerRects();
            return true;
        } 
        // Try parent frame's layout manager (if in iframe)
        else if (window.parent && window.parent.layoutManager) {
            console.log('Using parent frame layout manager');
            window.parent.layoutManager.initContainers();
            window.parent.layoutManager.updateContainerRects();
            return true;
        } 
        // Use the global init function if available
        else if (window.initLayoutManager) {
            console.log('Called global layout manager initialization');
            window.initLayoutManager();
            return true;
        }
        // Create new instance if layout_manager.js is loaded but not initialized
        else if (typeof LayoutManager !== 'undefined') {
            console.log('Creating new layout manager instance');
            window.layoutManager = new LayoutManager('.layout-container');
            window.layoutManager.init();
            return true;
        }
        // Retry a few times if needed
        else if (retryCount < 3) {
            console.log(`Layout manager not found, retrying (${retryCount + 1}/3)...`);
            setTimeout(() => initLayoutManager(retryCount + 1), 300);
            return false;
        }
        // Last resort: create a minimal layout manager
        else {
            console.warn('Layout manager not available. Creating minimal version.');
            return createMinimalLayoutManager();
        }
    }
    
    // Create a minimal layout manager if needed
    function createMinimalLayoutManager() {
        class MinimalLayoutManager {
            constructor() {
                this.dragging = null;
                this.dragOffset = { x: 0, y: 0 };
                
                // Bind methods
                this.handleDrag = this.handleDrag.bind(this);
                this.handleMouseUp = this.handleMouseUp.bind(this);
                
                // Initialize right away
                this.init();
            }
            
            init() {
                // Find all draggable elements
                const draggables = document.querySelectorAll('.analysis-pane, .graph-container, .draggable');
                draggables.forEach(el => this.makeDraggable(el));
                console.log(`Minimal layout manager initialized with ${draggables.length} elements`);
            }
            
            makeDraggable(el) {
                // Ensure draggable class
                el.classList.add('draggable');
                
                // Ensure absolute positioning
                el.style.position = 'absolute';
                
                // Create or find drag handle
                let handle = el.querySelector('.drag-handle');
                if (!handle) {
                    handle = document.createElement('div');
                    handle.className = 'drag-handle';
                    
                    const title = document.createElement('div');
                    title.className = 'drag-handle-title';
                    title.textContent = el.getAttribute('data-title') || 'Element';
                    handle.appendChild(title);
                    
                    el.insertBefore(handle, el.firstChild);
                }
                
                // Position element if not already positioned
                if (!el.style.left) el.style.left = '10px';
                if (!el.style.top) el.style.top = '10px';
                
                // Add drag behavior - critical fix to prevent hopping
                handle.addEventListener('mousedown', e => {
                    // Stop propagation to prevent event bubbling
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Get exact position for drag offset calculation
                    const rect = el.getBoundingClientRect();
                    
                    // Calculate exact offset from mouse to element corner
                    this.dragOffset = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    };
                    
                    // Set dragging element
                    this.dragging = el;
                    el.classList.add('dragging');
                    
                    // Add events with capture to ensure we get all mouse events
                    document.addEventListener('mousemove', this.handleDrag, {capture: true});
                    document.addEventListener('mouseup', this.handleMouseUp, {capture: true});
                });
            }
            
            handleDrag(e) {
                if (!this.dragging) return;
                
                // Prevent any default drag behavior
                e.preventDefault();
                e.stopPropagation();
                
                // Calculate container (parent or parent's parent if needed)
                const container = this.dragging.offsetParent || 
                                 document.querySelector('.layout-container') || 
                                 document.body;
                
                // Get container bounds
                const containerRect = container.getBoundingClientRect();
                
                // Calculate new position carefully to prevent hopping
                const newX = e.clientX - containerRect.left - this.dragOffset.x;
                const newY = e.clientY - containerRect.top - this.dragOffset.y;
                
                // Round to prevent sub-pixel rendering issues
                this.dragging.style.left = `${Math.round(Math.max(0, newX))}px`;
                this.dragging.style.top = `${Math.round(Math.max(0, newY))}px`;
            }
            
            handleMouseUp(e) {
                if (!this.dragging) return;
                
                // Prevent default behavior
                e.preventDefault();
                e.stopPropagation();
                
                // Clean up
                this.dragging.classList.remove('dragging');
                this.dragging = null;
                
                // Remove events
                document.removeEventListener('mousemove', this.handleDrag, {capture: true});
                document.removeEventListener('mouseup', this.handleMouseUp, {capture: true});
            }
        }
        
        // Create the minimal manager
        window.minimalLayoutManager = new MinimalLayoutManager();
        return true;
    }
    
    // Try to initialize after a short delay to ensure DOM is ready
    setTimeout(() => {
        initLayoutManager();
    }, 200);
}); 