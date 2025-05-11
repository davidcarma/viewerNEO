/**
 * Low-Pass Filter Implementation
 * Applies a moving average filter to smooth signals
 */

// Helper function to apply a Low Pass Filter (Moving Average)
function applyLPF(data, windowSize) {
    if (!data || data.length === 0 || windowSize <= 1) {
        return [...data]; // Return a copy if no filtering is needed
    }
    const result = new Array(data.length).fill(0);
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = -halfWindow; j <= halfWindow; j++) {
            const index = i + j;
            if (index >= 0 && index < data.length) {
                sum += data[index];
                count++;
            }
        }
        result[i] = count > 0 ? sum / count : 0;
    }
    return result;
} 