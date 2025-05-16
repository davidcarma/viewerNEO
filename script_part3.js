function setupGraphTooltips(ctx, width, height, isVertical, algorithm, originalData, normalizedData, fftData, rawDerivativeData) {
    const canvas = ctx.canvas;
    
    // Make sure tooltip exists
    const tooltip = createTooltip();
  
    // Remove any existing event listeners to avoid duplicates
    canvas.removeEventListener('mousemove', canvas._tooltipMoveHandler);
    canvas.removeEventListener('mouseleave', canvas._tooltipLeaveHandler);
    
    // Add some interactive style to indicate the canvas is interactive
    canvas.style.cursor = 'crosshair';
    
    // Create a debug overlay to verify the event area
    const debugOverlay = document.createElement('div');
    debugOverlay.style.position = 'absolute';
    debugOverlay.style.border = '1px solid red';
    debugOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    debugOverlay.style.pointerEvents = 'none';
    debugOverlay.style.zIndex = '9999';
    
    // Position overlay on top of canvas
    const rect = canvas.getBoundingClientRect();
    debugOverlay.style.left = `${rect.left}px`;
    debugOverlay.style.top = `${rect.top}px`;
    debugOverlay.style.width = `${rect.width}px`;
    debugOverlay.style.height = `${rect.height}px`;
    
    // Add overlay to document for 3 seconds
    document.body.appendChild(debugOverlay);
    setTimeout(() => {
        if (document.body.contains(debugOverlay)) {
            document.body.removeChild(debugOverlay);
        }
    }, 3000);
    
    // Define mousemove handler
    canvas._tooltipMoveHandler = function(e) {
        e.stopPropagation();
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate data values based on mouse position
        let dataIndex, plotValue, frequency, wavelength, amplitude;
        
        // Always show tooltip - guaranteed to have some basic information
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.style.display = 'block';
        
        if (isVertical) {
            // Vertical graph (shows horizontal projection)
            // Y-axis is the data index (rows), X-axis is value
            dataIndex = Math.floor((y / rect.height) * originalData.length);
            
            if (dataIndex >= 0 && dataIndex < originalData.length) {
                if ((algorithm === 3 || algorithm === 4) && fftData) {
                    // FFT mode - directly use the position to get the frequency value
                    // For vertical graph: Y-axis is frequency, X-axis is magnitude
                    // Map y position to FFT bin
                    const binFraction = y / rect.height; // Correct: Y is frequency axis
                    const fftIndex = Math.min(Math.floor(binFraction * fftData.length), fftData.length - 1);
                    
                    // Calculate frequency - bins go from 0 to Nyquist (0.5 cycles/pixel)
                    frequency = (fftIndex / fftData.length) * 0.5; // Assuming fftData.length is num_bins to Nyquist
                    wavelength = frequency > 0 ? 1 / frequency : Infinity;
                    amplitude = fftData[fftIndex]; // Magnitude at this frequency bin
                    
                    tooltip.innerHTML = `
                        <div class="tooltip-title">FFT Measurement</div>
                        <div class="tooltip-freq">Freq: ${frequency.toFixed(4)} c/px</div>
                        <div class="tooltip-lambda">λ: ${wavelength.toFixed(1)} px</div>
                        <div class="tooltip-mag">Magnitude: ${amplitude.toFixed(1)}</div>
                        <div class="tooltip-bin">Bin: ${fftIndex} / ${fftData.length}</div>
                    `;
                } else {
                    // Non-FFT modes - use the plotted data value, not the original data
                    // Get the actual normalized value being plotted at this index
                    plotValue = normalizedData[dataIndex];
                    
                    // Get the x-coordinate this value is plotted at
                    const plotX = plotValue * width;
                    
                    // For algorithm 2 (derivative), show actual derivative value
                    let actualValue;
                    if (algorithm === 2 && rawDerivativeData) {
                        // For derivative, use the raw derivative value
                        actualValue = rawDerivativeData[dataIndex];
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Derivative Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else if (algorithm === 1) {
                        // For LPF, show the filtered value
                        // Reconstruct from the normalized plot data
                        const maxValue = Math.max(...originalData);
                        actualValue = plotValue * maxValue;
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Filtered Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(2)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else {
                        // For other algorithms, just show the normalized plot value
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Plot Value</div>
                            <div class="tooltip-amp">Value: ${plotValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    }
                }
            }
        } else {
            // Horizontal graph (shows vertical projection)
            // X-axis is the data index (columns), Y-axis is value
            dataIndex = Math.floor((x / rect.width) * originalData.length);
            
            if (dataIndex >= 0 && dataIndex < originalData.length) {
                if ((algorithm === 3 || algorithm === 4) && fftData) {
                    // FFT mode - directly use the position to get the frequency value
                    // For horizontal graph: X-axis is frequency, Y-axis is magnitude
                    // Map x position to FFT bin
                    const binFraction = x / rect.width; // Correct: X is frequency axis
                    const fftIndex = Math.min(Math.floor(binFraction * fftData.length), fftData.length - 1);
                    
                    // Calculate frequency - bins go from 0 to Nyquist (0.5 cycles/pixel)
                    frequency = (fftIndex / fftData.length) * 0.5; // Assuming fftData.length is num_bins to Nyquist
                    wavelength = frequency > 0 ? 1 / frequency : Infinity;
                    amplitude = fftData[fftIndex]; // Magnitude at this frequency bin
                    
                    tooltip.innerHTML = `
                        <div class="tooltip-title">FFT Measurement</div>
                        <div class="tooltip-freq">Freq: ${frequency.toFixed(4)} c/px</div>
                        <div class="tooltip-lambda">λ: ${wavelength.toFixed(1)} px</div>
                        <div class="tooltip-mag">Magnitude: ${amplitude.toFixed(1)}</div>
                        <div class="tooltip-bin">Bin: ${fftIndex} / ${fftData.length}</div>
                    `;
                } else {
                    // Non-FFT mode - use the plotted data value, not the original data
                    // Get the actual normalized value being plotted at this index
                    plotValue = normalizedData[dataIndex];
                    
                    // For algorithm 2 (derivative), show actual derivative value
                    let actualValue;
                    if (algorithm === 2 && rawDerivativeData) {
                        // For derivative, use the raw derivative value
                        actualValue = rawDerivativeData[dataIndex];
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Derivative Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else if (algorithm === 1) {
                        // For LPF, show the filtered value
                        // Reconstruct from the normalized plot data
                        const maxValue = Math.max(...originalData);
                        actualValue = plotValue * maxValue;
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Filtered Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(2)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else {
                        // For other algorithms, just show the normalized plot value
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Plot Value</div>
                            <div class="tooltip-amp">Value: ${plotValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    }
                }
            }
        }
    };
    
    // Define mouseleave handler
    canvas._tooltipLeaveHandler = function() {
        tooltip.style.display = 'none';
    };
    
    // Add the event listeners
    canvas.addEventListener('mousemove', canvas._tooltipMoveHandler);
    canvas.addEventListener('mouseleave', canvas._tooltipLeaveHandler);
    
}

// Simple implementation to make an element draggable and resizable
function makeElementDraggable(element, container) {
    if (!element || element.classList.contains('draggable-initialized')) return;
    
    // Mark as initialized
    element.classList.add('draggable-initialized');
    // Ensure .draggable class is present for CSS rules to apply
    if (!element.classList.contains('draggable')) {
    element.classList.add('draggable');
    }
    
    // Determine drag handle title - enhance with more descriptive names based on element type/content
    let title = '';
    
    // Check for content type to assign better titles
    if (element.id === 'image-canvas-wrapper') {
        title = 'Main Image View';
    } else if (element.id === 'right-analysis-pane') {
        title = 'Horizontal Analysis Results';
    } else if (element.id === 'bottom-main-analysis-pane') {
        title = 'Vertical Analysis Results';
    } else if (element.querySelector('#primary-horizontal-projection-graph')) {
        title = 'Horizontal Projection (Primary)';
    } else if (element.querySelector('#secondary-horizontal-projection-graph')) {
        title = 'Horizontal Projection (Secondary)';
    } else if (element.querySelector('#primary-vertical-projection-graph')) {
        title = 'Vertical Projection (Primary)';
    } else if (element.querySelector('#secondary-vertical-projection-graph')) {
        title = 'Vertical Projection (Secondary)';
    } else {
        // Fallback to existing method
        title = element.querySelector('h3')?.textContent || 
                element.dataset.dragTitle || 
                element.id || 
                'Draggable';
    }
    
    // Truncate long titles with ellipsis
    if (title.length > 30) title = title.substring(0,27) + "...";

    // Create enhanced drag handle with more padding and better styling
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.style.padding = '8px 12px'; // Increased padding even more
    dragHandle.style.minHeight = '32px';   // Increased minimum height
    dragHandle.style.display = 'flex';     // Use flexbox for alignment
    dragHandle.style.alignItems = 'center';
    dragHandle.style.justifyContent = 'space-between';
    dragHandle.style.backgroundColor = 'rgba(30, 30, 30, 0.9)'; // Darker background
    dragHandle.style.borderBottom = '2px solid rgba(255, 255, 255, 0.25)';
    dragHandle.style.fontSize = '13px';    // Slightly larger font
    
    // Add a grip icon to make it more obvious it's draggable
    dragHandle.innerHTML = `
        <span class="drag-handle-title" style="font-weight: bold; font-size: 13px;">${title}</span>
        <span class="drag-grip" style="font-size: 14px; opacity: 0.8;">☰</span>
    `;
    
    // Rest of the drag functionality remains the same
    dragHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get initial positions
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate mouse offset from element corner
        const mouseOffsetX = e.clientX - elementRect.left;
        const mouseOffsetY = e.clientY - elementRect.top;
     
        // Make sure element has absolute positioning
        if (getComputedStyle(element).position !== 'absolute') {
            element.style.position = 'absolute';
            
            // Get current position relative to container
            const currentLeft = elementRect.left - containerRect.left;
            const currentTop = elementRect.top - containerRect.top;
            
            // Set initial position
            element.style.left = currentLeft + 'px';
            element.style.top = currentTop + 'px';
            element.style.width = elementRect.width + 'px';
            element.style.height = elementRect.height + 'px';
        
        }
        
        element.classList.add('dragging');
        
        // Simple drag handler
        function handleDrag(moveEvent) {
            // Get current container position
            const currentContainerRect = container.getBoundingClientRect();
            
            // Calculate new position: mouse position - container position - mouse offset
            const newLeft = moveEvent.clientX - currentContainerRect.left - mouseOffsetX;
            const newTop = moveEvent.clientY - currentContainerRect.top - mouseOffsetY;
            
            // Get element dimensions for boundary checking
            const elemWidth = element.offsetWidth;
            const elemHeight = element.offsetHeight;
            
            // Constrain to container boundaries
            const maxLeft = currentContainerRect.width - elemWidth;
            const maxTop = currentContainerRect.height - elemHeight;
            
            const constrainedLeft = Math.max(0, Math.min(maxLeft, newLeft));
            const constrainedTop = Math.max(0, Math.min(maxTop, newTop));
            
            // Apply position
            element.style.left = constrainedLeft + 'px';
            element.style.top = constrainedTop + 'px';
            
         
        }
        
        function stopDrag() {
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            element.classList.remove('dragging');
            
           
        }
        
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
    });
    
    // Add handle to the element
    if (element.firstChild) {
        element.insertBefore(dragHandle, element.firstChild);
    } else {
        element.appendChild(dragHandle);
    }
    
    // Add a subtle border to make the draggable element more obvious
    element.style.border = '1px solid rgba(120, 120, 120, 0.35)';
    element.style.borderRadius = '4px';
    element.style.background = 'rgba(20, 20, 20, 0.7)';
    
    // Add padding to the top of the element's content to prevent overlap with the drag handle
    // First, get all the direct children except the drag handle
    const children = Array.from(element.children).filter(child => child !== dragHandle);
    
    // Add top padding/margin to the first content element to prevent it being covered by header
    if (children.length > 0) {
        // Get the drag handle height to use as padding
        const handleHeight = dragHandle.offsetHeight || 32; // Fallback if not yet rendered
        
        // Apply margin to the first content element to push it below the header
        children[0].style.marginTop = `${handleHeight + 5}px`; // Add 5px extra space
        
        // For canvas elements, need special handling
        if (children[0].tagName === 'CANVAS' || children[0].querySelector('canvas')) {
            const canvas = children[0].tagName === 'CANVAS' ? children[0] : children[0].querySelector('canvas');
            if (canvas) {
                // Ensure canvas container has proper padding
                const canvasContainer = canvas.parentElement;
                canvasContainer.style.paddingTop = `${handleHeight + 5}px`;
                canvasContainer.style.boxSizing = 'border-box';
            }
        }
    }
}

// Get elements to make draggable
const draggables = [
    document.getElementById('right-analysis-pane'),
    document.getElementById('bottom-main-analysis-pane'),
    // Graph containers
    ...document.querySelectorAll('.graph-container'),
    ...document.querySelectorAll('.primary-image-col > *'),
    ...document.querySelectorAll('.horizontal-graphs-row > *'),
    ...document.querySelectorAll('.vertical-graph-section > *')
].filter(el => el); // Filter out null elements

// Find a suitable container for draggable elements
const draggableContainer = document.getElementById('projection-content') || 
                           document.querySelector('.projection-main-area') ||
                           projectionOverlay;

console.log(`Found ${draggables.length} elements to make draggable in container: ${draggableContainer.className}`);

// Make all elements draggable
draggables.forEach(element => {
    // Make sure element is visible
    if (element.offsetWidth > 30 && element.offsetHeight > 30) {
        makeElementDraggable(element, draggableContainer);
        console.log(`Made element draggable: ${element.id || element.className}`);
    }
});

// After setting up all draggable elements, try to apply any saved layout
setTimeout(() => {
    // Try to load and apply saved layout
    if (!applyLayoutPositions()) {
        console.log('No saved layout or unable to apply it - using default layout');
    }
}, 100);

// Add a function to apply saved layout positions
function applyLayoutPositions() {
    console.log('Applying saved layout positions...');
    
    // Get saved layout from localStorage
    const savedLayout = localStorage.getItem('projectionLayoutPositions');
    if (!savedLayout) {
        console.log('No saved layout found');
        return false;
    }
    
    try {
        const layoutPositions = JSON.parse(savedLayout);
        
        // Get references to all draggable elements
        const imageCanvasWrapper = document.getElementById('image-canvas-wrapper');
        const imageCanvas = document.getElementById('image-canvas');
        const primaryHorizontalGraph = document.getElementById('primary-horizontal-projection-graph').closest('.graph-container');
        const secondaryHorizontalGraph = document.getElementById('secondary-horizontal-projection-graph').closest('.graph-container');
        const primaryVerticalGraph = document.getElementById('primary-vertical-projection-graph').closest('.graph-container');
        const secondaryVerticalGraph = document.getElementById('secondary-vertical-projection-graph').closest('.graph-container');
        const rightAnalysisPane = document.getElementById('right-analysis-pane');
        const bottomAnalysisPane = document.getElementById('bottom-main-analysis-pane');
        
        // Get the projection overlay container for reference
        const projectionContainer = document.getElementById('projection-content') || 
                                   document.getElementById('projection-overlay');
        
        // Apply positions if all elements exist
        if (imageCanvasWrapper && imageCanvas && primaryHorizontalGraph && secondaryHorizontalGraph && 
            primaryVerticalGraph && secondaryVerticalGraph && rightAnalysisPane && bottomAnalysisPane) {
            
            // 1) Position the image canvas wrapper - maintain aspect ratio while honoring position
            imageCanvasWrapper.style.position = 'absolute';
            imageCanvasWrapper.style.left = `${layoutPositions.imageCanvas.left}px`;
            imageCanvasWrapper.style.top = `${layoutPositions.imageCanvas.top}px`;
            // Don't set width/height so image maintains proper scaling
            
            // Wait for image canvas to be positioned
            setTimeout(() => {
                // Get updated rects after positioning
                const imageRect = imageCanvasWrapper.getBoundingClientRect();
                const containerRect = projectionContainer.getBoundingClientRect();
                
                // 2) Position primary horizontal graph relative to image canvas right edge
                primaryHorizontalGraph.style.position = 'absolute';
                primaryHorizontalGraph.style.left = `${imageRect.right - containerRect.left + layoutPositions.primaryHorizontalGraph.offsetRight}px`;
                primaryHorizontalGraph.style.top = `${imageRect.top - containerRect.top + layoutPositions.primaryHorizontalGraph.offsetTop}px`;
                // Scale height to match image height
                primaryHorizontalGraph.style.height = `${imageRect.height}px`;
                primaryHorizontalGraph.style.width = `${layoutPositions.primaryHorizontalGraph.width}px`;
                
                // Wait for primary horizontal to be positioned
                setTimeout(() => {
                    // Get updated primary horizontal rect
                    const primaryHorizontalRect = primaryHorizontalGraph.getBoundingClientRect();
                    
                    // 3) Position secondary horizontal graph relative to primary horizontal
                    secondaryHorizontalGraph.style.position = 'absolute';
                    secondaryHorizontalGraph.style.left = `${primaryHorizontalRect.right - containerRect.left + layoutPositions.secondaryHorizontalGraph.offsetRight}px`;
                    secondaryHorizontalGraph.style.top = `${primaryHorizontalRect.top - containerRect.top + layoutPositions.secondaryHorizontalGraph.offsetTop}px`;
                    // Match height with primary
                    secondaryHorizontalGraph.style.height = `${primaryHorizontalRect.height}px`;
                    secondaryHorizontalGraph.style.width = `${layoutPositions.secondaryHorizontalGraph.width}px`;
                }, 10);
                
                // 4) Position primary vertical graph relative to image canvas bottom edge
                primaryVerticalGraph.style.position = 'absolute';
                primaryVerticalGraph.style.top = `${imageRect.bottom - containerRect.top + layoutPositions.primaryVerticalGraph.offsetBottom}px`;
                primaryVerticalGraph.style.left = `${imageRect.left - containerRect.left + layoutPositions.primaryVerticalGraph.offsetLeft}px`;
                // Scale width to match current image width
                primaryVerticalGraph.style.width = `${imageRect.width}px`;
                primaryVerticalGraph.style.height = `${layoutPositions.primaryVerticalGraph.height}px`;
                
                // Wait for primary vertical to be positioned
                setTimeout(() => {
                    // Get updated primary vertical rect
                    const primaryVerticalRect = primaryVerticalGraph.getBoundingClientRect();
                    
                    // 5) Position secondary vertical graph relative to primary vertical
                    secondaryVerticalGraph.style.position = 'absolute';
                    secondaryVerticalGraph.style.top = `${primaryVerticalRect.bottom - containerRect.top + layoutPositions.secondaryVerticalGraph.offsetBottom}px`;
                    secondaryVerticalGraph.style.left = `${primaryVerticalRect.left - containerRect.left + layoutPositions.secondaryVerticalGraph.offsetLeft}px`;
                    // Scale width to match primary graph's width
                    secondaryVerticalGraph.style.width = `${primaryVerticalRect.width}px`;
                    secondaryVerticalGraph.style.height = `${layoutPositions.secondaryVerticalGraph.height}px`;
                }, 10);
                
                // 6-7) Position analysis panes with absolute positioning
                rightAnalysisPane.style.position = 'absolute';
                rightAnalysisPane.style.left = `${layoutPositions.rightAnalysisPane.left}px`;
                rightAnalysisPane.style.top = `${layoutPositions.rightAnalysisPane.top}px`;
                rightAnalysisPane.style.width = `${layoutPositions.rightAnalysisPane.width}px`;
                rightAnalysisPane.style.height = `${layoutPositions.rightAnalysisPane.height}px`;
                
                bottomAnalysisPane.style.position = 'absolute';
                bottomAnalysisPane.style.left = `${layoutPositions.bottomAnalysisPane.left}px`;
                bottomAnalysisPane.style.top = `${layoutPositions.bottomAnalysisPane.top}px`;
                bottomAnalysisPane.style.width = `${layoutPositions.bottomAnalysisPane.width}px`;
                bottomAnalysisPane.style.height = `${layoutPositions.bottomAnalysisPane.height}px`;
            }, 20);
            
            console.log('Layout positions applied');
            return true;
        } else {
            console.warn('Some elements not found, cannot apply layout');
            return false;
        }
    } catch (err) {
        console.error('Error applying layout positions:', err);
        return false;
    }
}
