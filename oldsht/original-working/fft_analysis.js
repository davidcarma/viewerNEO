/**
 * FFT Analysis Utilities
 * 
 * Common functions for displaying FFT analysis results consistently across algorithms
 */

/**
 * Updates the analysis panes with FFT results using a consistent table format
 * @param {HTMLElement} rightPane - The right analysis pane (horizontal analysis)
 * @param {HTMLElement} bottomPane - The bottom analysis pane (vertical analysis)
 * @param {Array} horizontalPeaks - FFT peaks for horizontal data
 * @param {Array} verticalPeaks - FFT peaks for vertical data
 * @param {String} algorithmName - Name of the algorithm for display
 */
function updateFFTAnalysisPanes(rightPane, bottomPane, horizontalPeaks, verticalPeaks, algorithmName) {
    // Helper function to create the table content
    function createTableContent(peaks) {
        return peaks.map((peak, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${peak.index}</td>
                <td>${peak.frequency.toFixed(4)} c/px</td>
                <td>${peak.wavelength.toFixed(1)}</td>
                <td>${peak.magnitude.toFixed(1)}</td>
            </tr>
        `).join('');
    }

    // Update RIGHT analysis pane (horizontal projection analysis)
    if (rightPane) {
        console.log(`Updating rightPane with ${algorithmName} algorithm`);
        rightPane.classList.remove('draggable-initialized');
        rightPane.innerHTML = `
            <h3>Horizontal Projection ${algorithmName} Analysis</h3>
            <div class="analysis-content" style="padding: 15px; margin-top: 10px;">
                <table class="peak-table" style="margin-top: 10px; width: 100%;">
                    <tr><th>Rank</th><th>Bin</th><th>Frequency</th><th>λ (pixels)</th><th>Magnitude</th></tr>
                    ${createTableContent(horizontalPeaks)}
                </table>
                <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
            </div>
        `;
    }

    // Update BOTTOM analysis pane (vertical projection analysis)
    if (bottomPane) {
        console.log(`Updating bottomPane with ${algorithmName} algorithm`);
        bottomPane.classList.remove('draggable-initialized');
        bottomPane.innerHTML = `
            <h3>Vertical Projection ${algorithmName} Analysis</h3>
            <div class="analysis-content" style="padding: 15px; margin-top: 10px;">
                <table class="peak-table" style="margin-top: 10px; width: 100%;">
                    <tr><th>Rank</th><th>Bin</th><th>Frequency</th><th>λ (pixels)</th><th>Magnitude</th></tr>
                    ${createTableContent(verticalPeaks)}
                </table>
                <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
            </div>
        `;
    }
}