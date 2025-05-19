function setupAlgorithmButtons(horizontalProfile, verticalProfile, 
                             primaryHorizCtx, primaryVertCtx,
                             secondaryHorizCtx, secondaryVertCtx,
                             horizGraphWidth, horizGraphHeight,
                             vertGraphWidth, vertGraphHeight) {
    
    // Debug function to help diagnose tooltip issues
    function debugAlgorithmClick(algorithmNumber) {
        console.log(`Algorithm ${algorithmNumber} button clicked`);
        console.log(`Horizontal projection data length: ${horizontalProfile.length}`);
        console.log(`Vertical projection data length: ${verticalProfile.length}`);
        
        // Log canvas element references
        console.log('Secondary horizontal canvas:', secondaryHorizCtx.canvas);
        console.log('Secondary vertical canvas:', secondaryVertCtx.canvas);
        
        // Report if tooltips exist
        const tooltip = document.getElementById('graph-tooltip');
        console.log('Tooltip element exists:', !!tooltip);
    }
    
    for (let i = 1; i <= 10; i++) {
        const button = document.getElementById(`algo-btn-${i}`);
        if (!button) continue;
        
        button.addEventListener('click', function() {
            // Debug logging
            debugAlgorithmClick(i);
            
            // Update results display
            document.getElementById('right-analysis-pane').innerHTML = `
                <h3>Algorithm ${i} Results</h3>
                <div class="analysis-content">
                    <p>Results from Algorithm ${i} (operating on full-resolution data) will appear here.</p>
                    <p>Full-res image: ${horizontalProfile.length}x${verticalProfile.length}</p>
                    <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                </div>
            `;
            
            // Redraw secondary graphs with different visualizations
            updateSecondaryGraphs(i, horizontalProfile, verticalProfile, 
                               secondaryHorizCtx, secondaryVertCtx,
                               horizGraphWidth, horizGraphHeight,
                               vertGraphWidth, vertGraphHeight);
        });
    }
}

// Function to update secondary graphs based on algorithm selection
function updateSecondaryGraphs(algorithm, horizontalProfile, verticalProfile, 
                             horizCtx, vertCtx,
                             horizWidth, horizHeight,
                             vertWidth, vertHeight) {
    // Normalize function (remains the same)
    const normalize = (array, maxValue) => array.map(value => (value / Math.max(0.00001, maxValue)) || 0); // Added Math.max to avoid div by zero
    
    // Color selection based on algorithm
    const colors = ['#4a90e2', '#72c02c', '#e74c3c', '#f39c12', '#9b59b6', 
                  '#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#1abc9c'];
    
    // Clear previous content
    horizCtx.clearRect(0, 0, horizWidth, horizHeight);
    vertCtx.clearRect(0, 0, vertWidth, vertHeight);
    
    // Data for plotting
    let plotDataHorizontal, plotDataVertical;
    let isDerivativeMode = false;
    
    // For derivative mode, store raw data for proper grid markers
    let rawDerivHorizontal, rawDerivVertical;
    let minDerivHorizontal, maxDerivHorizontal, minDerivVertical, maxDerivVertical;
    
    // Declare FFT data variables to avoid ReferenceError
    let fftHorizontal = null;
    let fftVertical = null;

    // Find the container for draggables - needed for re-initialization
    const draggableContainer = document.getElementById('projection-content') || 
                               document.querySelector('.projection-main-area') ||
                               document.getElementById('projection-overlay');

    // Get references to the analysis panes
    const rightPane = document.getElementById('right-analysis-pane');
    const bottomPane = document.getElementById('bottom-main-analysis-pane');

    switch(algorithm) {
        case 1: // LPF button
            {
                const lpfWindowSize = 15; // Increased window size for more noticeable smoothing
                const filteredHorizontal = applyLPF(horizontalProfile, lpfWindowSize);
                const filteredVertical = applyLPF(verticalProfile, lpfWindowSize);

                plotDataHorizontal = normalize(filteredHorizontal, Math.max(...filteredHorizontal));
                plotDataVertical = normalize(filteredVertical, Math.max(...filteredVertical));
                
                // Update analysis pane with LPF information
                if (rightPane) {
                    rightPane.classList.remove('draggable-initialized'); // Allow re-init
                    rightPane.innerHTML = `
                    <h3>Low Pass Filter Results</h3>
                    <div class="analysis-content">
                        <p>Applied moving average filter with window size: ${lpfWindowSize}</p>
                        <p>This filter smooths the signal by reducing high-frequency components.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                    if (draggableContainer) makeElementDraggable(rightPane, draggableContainer);
                }
                 if (bottomPane) {
                    bottomPane.classList.remove('draggable-initialized');
                    bottomPane.innerHTML = `<h3>Algorithm ${algorithm} - Bottom</h3><div class="analysis-content"><p>LPF Applied</p></div>`;
                    if (draggableContainer) makeElementDraggable(bottomPane, draggableContainer);
                }
            }
            break;
        case 2: // Derivative button
            {
                isDerivativeMode = true;
                
                // Calculate derivatives
                rawDerivHorizontal = calculateDerivative(horizontalProfile);
                rawDerivVertical = calculateDerivative(verticalProfile);
                
                // Find min/max values for proper scaling and grid marking
                minDerivHorizontal = Math.min(...rawDerivHorizontal);
                maxDerivHorizontal = Math.max(...rawDerivHorizontal);
                minDerivVertical = Math.min(...rawDerivVertical);
                maxDerivVertical = Math.max(...rawDerivVertical);
                
                // Find max absolute value for proper normalization (derivative can be positive or negative)
                const maxAbsHorizontal = Math.max(Math.abs(minDerivHorizontal), Math.abs(maxDerivHorizontal));
                const maxAbsVertical = Math.max(Math.abs(minDerivVertical), Math.abs(maxDerivVertical));
                
                // Create normalized derivative values for display (map -1...1 to 0...1)
                plotDataHorizontal = rawDerivHorizontal.map(v => 0.5 + (v / (2 * maxAbsHorizontal + 0.00001)));
                plotDataVertical = rawDerivVertical.map(v => 0.5 + (v / (2 * maxAbsVertical + 0.00001)));
                
                // Update analysis pane with derivative information
                if (rightPane) {
                    rightPane.classList.remove('draggable-initialized');
                    rightPane.innerHTML = `
                    <h3>Derivative Results</h3>
                    <div class="analysis-content">
                        <p>First derivative shows rate of change at each point.</p>
                        <p>Horizontal Derivative: Min=${minDerivHorizontal.toFixed(2)}, Max=${maxDerivHorizontal.toFixed(2)}</p>
                        <p>Vertical Derivative: Min=${minDerivVertical.toFixed(2)}, Max=${maxDerivVertical.toFixed(2)}</p>
                        <p>Zero-crossings indicate local maxima and minima in the original signal.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                     if (draggableContainer) makeElementDraggable(rightPane, draggableContainer);
                }
                 if (bottomPane) {
                    bottomPane.classList.remove('draggable-initialized');
                    bottomPane.innerHTML = `<h3>Algorithm ${algorithm} - Bottom</h3><div class="analysis-content"><p>Derivative Applied</p></div>`;
                    if (draggableContainer) makeElementDraggable(bottomPane, draggableContainer);
                }
            }
            break;
        case 3: // Derivative + FFT
            {
                fftHorizontal = calculateDerivativeFFT(horizontalProfile);
                fftVertical = calculateDerivativeFFT(verticalProfile);
                
                const originalHorizontalLength = horizontalProfile.length;
                const originalVerticalLength = verticalProfile.length;

                let horizontalPeaks = findFFTPeaks(fftHorizontal, 8, originalHorizontalLength);
                let verticalPeaks = findFFTPeaks(fftVertical, 8, originalVerticalLength);

                plotDataHorizontal = normalize(fftHorizontal, Math.max(...fftHorizontal));
                plotDataVertical = normalize(fftVertical, Math.max(...fftVertical));
                
                isDerivativeMode = true; // Use line chart for FFT magnitude
                
                minDerivHorizontal = 0;
                maxDerivHorizontal = Math.max(...fftHorizontal);
                minDerivVertical = 0;
                maxDerivVertical = Math.max(...fftVertical);
                
                // Use our shared FFT analysis utility for consistent table format
                updateFFTAnalysisPanes(
                    rightPane, 
                    bottomPane, 
                    horizontalPeaks, 
                    verticalPeaks, 
                    "Deriv + FFT"
                );
            }
            break;
        case 4: // Derivative + Rectify + FFT
            console.log('Running Algorithm 4: Derivative + Half-Wave Rectification + FFT');
            
            // Call our new derivative + rectify + FFT function
            fftHorizontal = calculateDiffRectFFT(horizontalProfile);
            fftVertical = calculateDiffRectFFT(verticalProfile);
            
            // Store derivative data for visualization
            rawDerivHorizontal = horizontalProfile.map((_, i, arr) => {
                if (i === 0) return arr[1] - arr[0];
                if (i === arr.length - 1) return arr[i] - arr[i-1];
                return (arr[i+1] - arr[i-1]) / 2;
            });
            
            rawDerivVertical = verticalProfile.map((_, i, arr) => {
                if (i === 0) return arr[1] - arr[0];
                if (i === arr.length - 1) return arr[i] - arr[i-1];
                return (arr[i+1] - arr[i-1]) / 2;
            });
            
            // Apply half-wave rectification and store for visualization
            rawDerivHorizontal = rawDerivHorizontal.map(v => v > 0 ? v : 0);
            rawDerivVertical = rawDerivVertical.map(v => v > 0 ? v : 0);
            
            // Find min/max values for proper scaling
            minDerivHorizontal = 0; // For half-wave rectification, min is always 0
            maxDerivHorizontal = Math.max(...rawDerivHorizontal, 0.001); // Avoid division by zero
            minDerivVertical = 0; // For half-wave rectification, min is always 0
            maxDerivVertical = Math.max(...rawDerivVertical, 0.001); // Avoid division by zero
            
            // Normalize for plotting
            const normalizedDerivHorizontal = rawDerivHorizontal.map(v => v / maxDerivHorizontal);
            const normalizedDerivVertical = rawDerivVertical.map(v => v / maxDerivVertical);
            
            // Use normalized FFT data for plotting
            plotDataHorizontal = fftHorizontal.slice(0, Math.min(fftHorizontal.length, horizontalProfile.length / 2));
            plotDataVertical = fftVertical.slice(0, Math.min(fftVertical.length, verticalProfile.length / 2));
            
            // Normalize FFT data properly for visualization
            const maxFFTHorizontal = Math.max(...plotDataHorizontal, 0.001);
            const maxFFTVertical = Math.max(...plotDataVertical, 0.001);
            plotDataHorizontal = plotDataHorizontal.map(v => v / maxFFTHorizontal);
            plotDataVertical = plotDataVertical.map(v => v / maxFFTVertical);
            
            // Analyze the FFT results
            const horizontalPeaks = findFFTPeaks(fftHorizontal, 8, horizontalProfile.length);
            const verticalPeaks = findFFTPeaks(fftVertical, 8, verticalProfile.length);
            
            // Use our shared FFT analysis utility for consistent table format
            updateFFTAnalysisPanes(
                rightPane, 
                bottomPane, 
                horizontalPeaks, 
                verticalPeaks, 
                "DiffRectFFT"
            );
            
            // Setup tooltips for the graphs
            setupGraphTooltips(horizCtx, horizWidth, horizHeight, true, algorithm, 
                              horizontalProfile, plotDataHorizontal, fftHorizontal, rawDerivHorizontal);
            setupGraphTooltips(vertCtx, vertWidth, vertHeight, false, algorithm, 
                              verticalProfile, plotDataVertical, fftVertical, rawDerivVertical);
            
            isDerivativeMode = true;
            break;
        default: // Algorithmic patterns (sine, step, etc.)
            {
                const baseHorizontalNormalized = normalize(horizontalProfile, Math.max(...horizontalProfile));
                const baseVerticalNormalized = normalize(verticalProfile, Math.max(...verticalProfile));
                
                plotDataHorizontal = new Array(baseHorizontalNormalized.length);
                plotDataVertical = new Array(baseVerticalNormalized.length);

                for (let i = 0; i < baseHorizontalNormalized.length; i++) {
                    plotDataHorizontal[i] = Math.abs(Math.sin(i * 0.1 * (algorithm % 3 + 1)) * 0.4 + 0.6);
                }

                for (let i = 0; i < baseVerticalNormalized.length; i++) {
                    plotDataVertical[i] = Math.abs(Math.sin(i * 0.05 * (algorithm % 3 + 1)) * 0.4 + 0.3);
                }
                
                // Update analysis pane with algorithm information
                 if (rightPane) {
                    rightPane.classList.remove('draggable-initialized');
                    rightPane.innerHTML = `
                    <h3>Algorithm ${algorithm} Results</h3>
                    <div class="analysis-content">
                        <p>Demonstrating pattern generation algorithm ${algorithm}.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                    if (draggableContainer) makeElementDraggable(rightPane, draggableContainer);
                }
                 if (bottomPane) {
                    bottomPane.classList.remove('draggable-initialized');
                    bottomPane.innerHTML = `<h3>Algorithm ${algorithm} - Bottom</h3><div class="analysis-content"><p>Pattern Applied</p></div>`;
                     if (draggableContainer) makeElementDraggable(bottomPane, draggableContainer);
                }
            }
            break;
    }
        
    // Draw HORIZONTAL projection (vertical graph on right) using plotDataHorizontal
    horizCtx.beginPath();
    horizCtx.strokeStyle = colors[(algorithm - 1) % colors.length];
    horizCtx.lineWidth = 2;
    
    if (isDerivativeMode) {
        // For derivative mode, draw a line chart instead of bars
        for (let i = 0; i < plotDataHorizontal.length; i++) {
            const y = (i / plotDataHorizontal.length) * horizHeight;
            const x_value = plotDataHorizontal[i] * horizWidth;
            
            if (i === 0) {
                horizCtx.moveTo(x_value, y);
            } else {
                horizCtx.lineTo(x_value, y);
            }
        }
    } else {
        // For other modes, draw bars as before
        for (let i = 0; i < plotDataHorizontal.length; i++) {
            const y = (i / plotDataHorizontal.length) * horizHeight;
            const x_value = plotDataHorizontal[i] * horizWidth;
            horizCtx.moveTo(0, y);
            horizCtx.lineTo(x_value, y);
        }
    }
    horizCtx.stroke();
    
    // Draw VERTICAL projection (horizontal graph at bottom) using plotDataVertical
    vertCtx.beginPath();
    // Use a consistent color indexing, e.g., (algorithm - 1) or ensure colors array is long enough
    vertCtx.strokeStyle = colors[Math.min(algorithm, colors.length -1)]; // Ensure valid index
    vertCtx.lineWidth = 2;
    
    if (isDerivativeMode) {
        // For derivative mode, draw a line chart instead of bars
        for (let i = 0; i < plotDataVertical.length; i++) {
            const x_coord = (i / plotDataVertical.length) * vertWidth;
            const y_value = (1 - plotDataVertical[i]) * vertHeight; // Flip Y since canvas Y is inverted
            
            if (i === 0) {
                vertCtx.moveTo(x_coord, y_value);
            } else {
                vertCtx.lineTo(x_coord, y_value);
            }
        }
    } else {
        // For other modes, draw bars as before
        for (let i = 0; i < plotDataVertical.length; i++) {
            const x_coord = (i / plotDataVertical.length) * vertWidth;
            const y_value_scaled = plotDataVertical[i] * vertHeight;
            const yStart = vertHeight;
            const yEnd = vertHeight - y_value_scaled;
            
            vertCtx.moveTo(x_coord, yStart);
            vertCtx.lineTo(x_coord, yEnd);
        }
    }
    vertCtx.stroke();
    
    // Now draw grids ON TOP of the data for both graphs
    if (isDerivativeMode) {
        // Add tooltip event handlers for measurements
        setupGraphTooltips(horizCtx, horizWidth, horizHeight, true, algorithm, 
                          horizontalProfile, plotDataHorizontal, 
                          algorithm === 3 || algorithm === 4 ? fftHorizontal : null,
                          algorithm === 2 ? rawDerivHorizontal : null);
                          
        setupGraphTooltips(vertCtx, vertWidth, vertHeight, false, algorithm,
                          verticalProfile, plotDataVertical,
                          algorithm === 3 || algorithm === 4 ? fftVertical : null,
                          algorithm === 2 ? rawDerivVertical : null);
                          
        if (algorithm === 3 || algorithm === 4) {
            // For FFT modes, use a frequency grid
            if (Array.isArray(fftHorizontal) && Array.isArray(fftVertical)) {
                drawFFTGrid(horizCtx, horizWidth, horizHeight, true, fftHorizontal.length, horizontalProfile.length);
                drawFFTGrid(vertCtx, vertWidth, vertHeight, false, fftVertical.length, verticalProfile.length);
            } else {
                console.error(`FFT data is invalid or null for algorithm ${algorithm}. Horizontal:`, fftHorizontal, `Vertical:`, fftVertical);
                // Fallback: Clear the canvas for secondary graphs if FFT data is invalid
                horizCtx.clearRect(0, 0, horizWidth, horizHeight);
                vertCtx.clearRect(0, 0, vertWidth, vertHeight);
                // Optionally, draw a default grid or a message
                drawGrid(horizCtx, horizWidth, horizHeight, true, false); 
                drawGrid(vertCtx, vertWidth, vertHeight, false, false);   
            }
        } else {
            // For standard derivative mode, pass the actual derivative ranges for proper grid marking
            drawDerivativeGrid(horizCtx, horizWidth, horizHeight, true, minDerivHorizontal, maxDerivHorizontal, horizontalProfile.length);
            drawDerivativeGrid(vertCtx, vertWidth, vertHeight, false, minDerivVertical, maxDerivVertical, verticalProfile.length);
        }
    } else {
        // For other modes, use the original grid function
        // Add tooltip event handlers for non-derivative/non-FFT modes as well
        setupGraphTooltips(horizCtx, horizWidth, horizHeight, true, algorithm, 
                          horizontalProfile, plotDataHorizontal, null, null);
                          
        setupGraphTooltips(vertCtx, vertWidth, vertHeight, false, algorithm,
                          verticalProfile, plotDataVertical, null, null);
                          
        drawGrid(horizCtx, horizWidth, horizHeight, true, false);
        drawGrid(vertCtx, vertWidth, vertHeight, false, false);
    }
}

// Helper function specifically for drawing derivative grids with proper coordinate marking
function drawDerivativeGrid(ctx, width, height, isVertical, minValue, maxValue, dataLength) {
    ctx.save();
    
    // Electric blue for grid lines
    const gridColor = '#00BFFF'; // Electric blue
    
    // Draw background grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([2, 2]); // Dotted lines for grid
    
    // Calculate absolute maximum for scaling
    const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
    
    ctx.beginPath();
    if (isVertical) {
        // This is the right-side graph (horizontal projection)
        // Y-axis represents the pixel positions in the image
        const ySteps = 10; // Number of horizontal lines
        for (let i = 0; i <= ySteps; i++) {
            const y = (i / ySteps) * height;
            const pixelPos = Math.floor((dataLength - 1) * (i / ySteps));
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        
        // X-axis represents derivative values
        // Draw grid lines at specific derivative values
        const xSteps = 4; // -max, -max/2, 0, max/2, max
        for (let i = 0; i <= xSteps; i++) {
            // Map from derivative value to x position (normalized to [0, 1] range)
            const derivValue = minValue + (i / xSteps) * (maxValue - minValue);
            const normalizedX = (derivValue - minValue) / (maxValue - minValue);
            const x = normalizedX * width;
            
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
    } else {
        // This is the bottom graph (vertical projection)
        // X-axis represents the pixel positions
        const xSteps = 10; // Number of vertical lines
        for (let i = 0; i <= xSteps; i++) {
            const x = (i / xSteps) * width;
            const pixelPos = Math.floor((dataLength - 1) * (i / xSteps));
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        
        // Y-axis represents derivative values (Y is inverted in canvas)
        // Draw grid lines at specific derivative values
        const ySteps = 4; // -max, -max/2, 0, max/2, max
        for (let i = 0; i <= ySteps; i++) {
            // Map from derivative value to y position (normalized to [0, 1] range)
            // Remember to invert Y since canvas Y is top-down
            const derivValue = minValue + (i / ySteps) * (maxValue - minValue);
            const normalizedY = 1 - (derivValue - minValue) / (maxValue - minValue);
            const y = normalizedY * height;
            
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
    }
    ctx.stroke();
    
    // Reset line style for axes
    ctx.setLineDash([]); // Solid lines for axes
    
    // Draw the axes with higher emphasis
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff'; // White color for axes
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    
    if (isVertical) {
        // Y-axis (left edge - represents pixel position)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents derivative values)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    } else {
        // Y-axis (left edge - represents derivative values)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents pixel position)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    }
    ctx.stroke();
    
    // Draw the zero line with higher emphasis - THIS IS KEY FOR DERIVATIVE
    ctx.beginPath();
    ctx.strokeStyle = '#00AFFF'; // Bright blue for zero line (changed from red)
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    
    if (isVertical) {
        // For the vertical graph (right side), find where zero is on X-axis
        const zeroX = (-minValue) / (maxValue - minValue) * width;
        ctx.moveTo(zeroX, 0);
        ctx.lineTo(zeroX, height);
    } else {
        // For the horizontal graph (bottom), find where zero is on Y-axis
        const zeroY = (1 - (-minValue) / (maxValue - minValue)) * height;
        ctx.moveTo(0, zeroY);
        ctx.lineTo(width, zeroY);
    }
    ctx.stroke();
    
    // Add axis and value labels
    ctx.fillStyle = '#ffffff'; // White text
    ctx.globalAlpha = 0.9;
    ctx.font = '10px Arial';
    
    if (isVertical) {
        // For the vertical graph (right side)
        // Y-axis: pixel positions
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
            const y = (i / 5) * height;
            const pixelPos = Math.floor((dataLength - 1) * (i / 5));
            ctx.fillText(`${pixelPos}`, -5, y);
        }
        
        // X-axis: derivative values
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const derivSteps = 5;
        for (let i = 0; i <= derivSteps; i++) {
            const derivValue = minValue + (i / derivSteps) * (maxValue - minValue);
            const x = (derivValue - minValue) / (maxValue - minValue) * width;
            ctx.fillText(derivValue.toFixed(1), x, height + 5);
        }
        
        // Label the zero line specially
        const zeroX = (-minValue) / (maxValue - minValue) * width;
        ctx.fillStyle = '#00AFFF'; // Bright blue for zero label (changed from red)
        ctx.fillText("0", zeroX, height + 5);
        
    } else {
        // For the horizontal graph (bottom)
        // X-axis: pixel positions
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const x = (i / 5) * width;
            const pixelPos = Math.floor((dataLength - 1) * (i / 5));
            ctx.fillText(`${pixelPos}`, x, height + 5);
        }
        
        // Y-axis: derivative values (remember Y is inverted)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const derivSteps = 5;
        for (let i = 0; i <= derivSteps; i++) {
            const derivValue = minValue + (i / derivSteps) * (maxValue - minValue);
            const y = (1 - (derivValue - minValue) / (maxValue - minValue)) * height;
            ctx.fillText(derivValue.toFixed(1), -5, y);
        }
        
        // Label the zero line specially
        const zeroY = (1 - (-minValue) / (maxValue - minValue)) * height;
        ctx.fillStyle = '#00AFFF'; // Bright blue for zero label (changed from red)
        ctx.fillText("0", -5, zeroY);
    }
    
    ctx.restore();
}

// Main canvas drag functionality for OCR
function setupMainCanvasDrag() {
    canvas.addEventListener('dragstart', (e) => {
        // Check if image is loaded
        if (!image) {
            e.preventDefault();
            return;
        }
        
        // Only allow drag when Ctrl or Cmd key is pressed
        // This prevents conflict with panning functionality
        if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            return;
        }
        
        console.log('Starting canvas drag to OCR app');
        
        // Create a temp canvas with the current view
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width / (window.devicePixelRatio || 1);
        tempCanvas.height = canvas.height / (window.devicePixelRatio || 1);
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the current view to the temp canvas
        tempCtx.drawImage(canvas, 0, 0);
        
        // Create a smaller drag preview image
        const dragCanvas = document.createElement('canvas');
        const dragScale = 0.3; // 30% of original size
        dragCanvas.width = tempCanvas.width * dragScale;
        dragCanvas.height = tempCanvas.height * dragScale;
        const dragCtx = dragCanvas.getContext('2d');
        dragCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, dragCanvas.width, dragCanvas.height);
        
        // Set drag image
        dragCanvas.style.position = 'absolute';
        dragCanvas.style.left = '-9999px';
        document.body.appendChild(dragCanvas);
        e.dataTransfer.setDragImage(dragCanvas, dragCanvas.width / 2, dragCanvas.height / 2);
        
        // Schedule removal of the drag canvas
        setTimeout(() => {
            document.body.removeChild(dragCanvas);
        }, 100);
        
        // Get data URL directly from the canvas (most reliable cross-app method)
        const dataUrl = tempCanvas.toDataURL('image/png');
        
        // Create a blob URL as well for same-origin transfers
        tempCanvas.toBlob((blob) => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }
            
            // Create a file object from the blob
            const currentImage = imageFiles[selectedImageIndex] || { name: 'canvas_image.png' };
            const fileName = `view_of_${currentImage.name}`;
            const file = new File([blob], fileName, { type: 'image/png' });
            
            // Create blob URL for same-origin use
            const blobUrl = URL.createObjectURL(blob);
            
            // Set data transfer properties using both data URL and blob URL
            e.dataTransfer.effectAllowed = 'copyMove';
            
            // HTML format with embedded data URL (most compatible)
            const imageHtml = `<img src="${dataUrl}" alt="${fileName}" title="${fileName}">`;
            e.dataTransfer.setData('text/html', imageHtml);
            console.log('Added HTML format with embedded data URL for cross-app drag');
            
            // Plain text data URL for cross-app compatibility
            e.dataTransfer.setData('text/plain', dataUrl);
            console.log('Added data URL as plain text for cross-app drag');
            
            // URI List format for general web compatibility
            e.dataTransfer.setData('text/uri-list', dataUrl);
            
            // For local file system drag attempt download URL format
            try {
                const downloadUrl = `image/png:${fileName}:${blobUrl}`;
                e.dataTransfer.setData('DownloadURL', downloadUrl);
            } catch (err) {
                console.warn('Browser doesn\'t support DownloadURL format:', err);
            }
            
            // Special handling for in-browser transfers
            try {
                const transferKey = `canvas_image_transfer_${Date.now()}`;
                e.dataTransfer.setData('application/x-image-transfer-key', transferKey);
                
                // Store a reference to this file with both URLs
                const fileInfo = {
                    name: fileName,
                    type: 'image/png',
                    size: blob.size,
                    url: blobUrl,
                    dataUrl: dataUrl, // Include data URL for cross-origin use
                    timestamp: Date.now()
                };
                
                // Store in sessionStorage for cross-page communication
                sessionStorage.setItem(transferKey, JSON.stringify(fileInfo));
                console.log('Stored canvas image for cross-app transfer:', transferKey);
                
                // Schedule cleanup
                setTimeout(() => {
                    sessionStorage.removeItem(transferKey);
                }, 60000); // Remove after 1 minute
            } catch (err) {
                console.warn('Failed to set up cross-app canvas image transfer:', err);
            }
            
            // Clean up blob URL after drag
            canvas.addEventListener('dragend', () => {
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 5000); // Keep URL alive for 5 seconds after drag ends
            }, { once: true });
        }, 'image/png');
    });
}

// Call this setup function after initialization
window.addEventListener('load', () => {
    // Set up canvas size
    resizeCanvas();
    
    // Add event listeners for panning (dragging)
    canvas.addEventListener('mousedown', (e) => {
        // Only handle left mouse button
        if (e.button !== 0) return;
        
        // Don't start drag if Ctrl/Cmd is pressed (used for OCR drag)
        if (e.ctrlKey || e.metaKey) return;
        
        // Start dragging
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.classList.add('dragging');
    });
    
    document.addEventListener('mousemove', (e) => {
        // Handle thumbnail panel resizing
        if (isResizingPanel && isThumbnailPanelVisible) {
            const newWidth = Math.max(150, Math.min(500, e.clientX));
            thumbnailPanelWidth = newWidth;
            
            // Apply new width to panel and related elements
            thumbnailPanel.style.width = `${newWidth}px`;
            thumbnailToggleHandle.style.left = `${newWidth}px`;
            container.style.marginLeft = `${newWidth}px`;
            container.style.width = `calc(100vw - ${newWidth}px)`;
            
            // Resize canvas to match new container size
            resizeCanvas();
            return;
        }
        
        // Handle image panning
        if (!isDragging || isDraggingFile) return;
        
        // Calculate distance moved
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        
        // Update position
        offsetX += deltaX;
        offsetY += deltaY;
        
        // Update last position
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Re-render
        render();
        updateInfo();
    });
    
    document.addEventListener('mouseup', () => {
        // End image dragging
        isDragging = false;
        canvas.classList.remove('dragging');
        
        // End thumbnail panel resizing
        if (isResizingPanel) {
            isResizingPanel = false;
            document.body.style.cursor = '';
        }
    });
    
    // Add event listener for zooming (wheel)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Get mouse position
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate position in image space
        const imageX = (mouseX - offsetX) / zoomLevel;
        const imageY = (mouseY - offsetY) / zoomLevel;
        
        // Calculate zoom delta
        const delta = -Math.sign(e.deltaY) * 0.1;
        const newZoom = Math.max(0.1, Math.min(10, zoomLevel * (1 + delta)));
        
        // Apply zoom
        zoomLevel = newZoom;
        
        // Adjust offset to zoom around mouse position
        offsetX = mouseX - imageX * zoomLevel;
        offsetY = mouseY - imageY * zoomLevel;
        
        // Re-render
        render();
        updateInfo();
    });
    
    // Handle thumbnail panel toggle buttons
    toggleThumbnailsBtn.addEventListener('click', toggleThumbnailPanel);
    closeThumbnailsBtn.addEventListener('click', hideThumbnailPanel);
    
    // Thumbnail panel resize functionality
    thumbnailToggleHandle.addEventListener('mousedown', (e) => {
        if (thumbnailToggleHandle.classList.contains('hidden')) {
            // If the toggle is hidden, treat as a click to show panel
            toggleThumbnailPanel();
            return;
        }
        
        e.preventDefault();
        isResizingPanel = true;
        lastX = e.clientX;
        document.body.style.cursor = 'col-resize';
    });
    
    // Set up Main Canvas dragging
    setupMainCanvasDrag();
    
    // Set up clipboard paste
    setupClipboardPaste();
    
    // Initialize thumbnail context menu
    addThumbnailContextMenu();
    
    console.log('Viewer app initialized with drag, zoom, OCR and clipboard support');
});

// Create a paste overlay to show visual feedback
function createPasteOverlay() {
    // Check if overlay already exists
    if (document.getElementById('paste-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'paste-overlay';
    overlay.innerHTML = `
        <div class="paste-overlay-content">
            <div class="paste-icon">📋</div>
            <div class="paste-text">Paste image with Ctrl+V / Cmd+V</div>
        </div>
    `;
    
    // Add to the container
    container.appendChild(overlay);
    
    // Add click event to remove overlay
    overlay.addEventListener('click', () => {
        hidePasteOverlay();
    });
    
    return overlay;
}

// Show paste overlay
function showPasteOverlay() {
    let overlay = document.getElementById('paste-overlay');
    if (!overlay) {
        overlay = createPasteOverlay();
    }
    
    overlay.classList.add('active');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        hidePasteOverlay();
    }, 10000);
}

// Hide paste overlay
function hidePasteOverlay() {
    const overlay = document.getElementById('paste-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Set up clipboard paste functionality
function setupClipboardPaste() {
    // Create paste overlay
    createPasteOverlay();
    
    // Add a keyboard event listener to show paste overlay when Ctrl or Cmd is pressed
    document.addEventListener('keydown', (e) => {
        // If Ctrl or Cmd is pressed, show the paste overlay
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            showPasteOverlay();
        }
    });
    
    // Add paste event listener to the document
    document.addEventListener('paste', (e) => {
        // Hide paste overlay
        hidePasteOverlay();
        
        // Check if there are any items to paste
        if (!e.clipboardData || !e.clipboardData.items) return;
        
        // Look for an image in the clipboard
        for (const item of e.clipboardData.items) {
            if (item.type.startsWith('image/')) {
                // Get the image file
                const file = item.getAsFile();
                if (!file) continue;
                
                // Give the file a name based on timestamp if it doesn't have one
                if (!file.name || file.name === 'image.png') {
                    const now = new Date();
                    file.name = `clipboard_${now.getFullYear()}-${(now.getMonth() + 1)
                        .toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now
                        .getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}.png`;
                }
                
                // Process the image file
                processImageFiles([file]);
                
                // Prevent default browser handling
                e.preventDefault();
                return;
            }
        }
        
        // If we get here, no image was found in the clipboard
        // Display a tip about pasting images
        showPasteTip();
    });
}

// Update the app UI with paste instructions
function showPasteTip() {
    const tip = document.createElement('div');
    tip.className = 'paste-tip';
    tip.textContent = 'Copy an image first, then paste here';
    
    document.body.appendChild(tip);
    
    // Auto-hide after 3 seconds
        setTimeout(() => {
        tip.classList.add('fade-out');
            setTimeout(() => {
            document.body.removeChild(tip);
        }, 500);
    }, 3000);
}

// Call showPasteTip after initial setup
document.addEventListener('DOMContentLoaded', () => {
    showPasteTip();
    addThumbnailContextMenu();
});

// Helper function specifically for drawing FFT grids with frequency labels
function drawFFTGrid(ctx, width, height, isVertical, fftLength, originalDataLength) {
    ctx.save();
    
    // Purple-ish color for frequency grid lines
    const gridColor = '#9370DB'; // Medium purple
    
    // Draw background grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([2, 2]); // Dotted lines for grid
    
    ctx.beginPath();
    if (isVertical) {
        // This is the right-side graph (horizontal projection)
        // Y-axis still represents the pixel positions in the image
        const ySteps = 10; // Number of horizontal lines
        for (let i = 0; i <= ySteps; i++) {
            const y = (i / ySteps) * height;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        
        // X-axis represents frequency bins
        const xSteps = 10; // Frequency markers
        for (let i = 0; i <= xSteps; i++) {
            const x = (i / xSteps) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
    } else {
        // This is the bottom graph (vertical projection)
        // X-axis represents frequency bins
        const xSteps = 10; 
        for (let i = 0; i <= xSteps; i++) {
            const x = (i / xSteps) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        
        // Y-axis represents magnitude
        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = (i / ySteps) * height;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
    }
    ctx.stroke();
    
    // Reset line style for axes
    ctx.setLineDash([]); // Solid lines for axes
    
    // Draw the axes with higher emphasis
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff'; // White color for axes
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    
    if (isVertical) {
        // Y-axis (left edge - represents pixel position)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents frequency)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    } else {
        // Y-axis (left edge - represents magnitude)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents frequency)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    }
    ctx.stroke();
    
    // Add frequency labels
    ctx.fillStyle = '#ffffff'; // White text
    ctx.globalAlpha = 0.9;
    ctx.font = '10px Arial';
    
    // Calculate the Nyquist frequency (half of sampling rate)
    // In spatial domain, sampling rate is 1 pixel
    const nyquistFreq = 0.5; // In cycles per pixel
    
    if (isVertical) {
        // For the vertical graph (right side)
        // Y-axis: positions in original data
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
            const y = (i / 5) * height;
            const pixelPos = Math.floor((originalDataLength - 1) * (i / 5));
            ctx.fillText(`${pixelPos}px`, -5, y);
        }
        
        // X-axis: frequency labels (as fraction of Nyquist)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const freq = (i / 5) * nyquistFreq;
            const x = (i / 5) * width;
            ctx.fillText(`${freq.toFixed(2)}`, x, height + 5);
        }
        
        // Add units at the end
        ctx.textAlign = 'right';
        ctx.fillText("freq (cycles/px)", width, height + 20);
        
    } else {
        // For the horizontal graph (bottom)
        // X-axis: frequency labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const freq = (i / 5) * nyquistFreq;
            const x = (i / 5) * width;
            ctx.fillText(`${freq.toFixed(2)}`, x, height + 5);
        }
        
        // Y-axis: magnitude (remember Y is inverted)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
            const y = (1 - i / 4) * height;
            const magValue = (i / 4);
            ctx.fillText(magValue.toFixed(1), -5, y);
        }
        
        // Add units at the end
        ctx.textAlign = 'right';
        ctx.fillText("freq (cycles/px)", width, height + 20);
    }
    
    ctx.restore();
}

// Add the tooltip setup function to the end of the file
// Helper function to set up tooltips for graph measurements
