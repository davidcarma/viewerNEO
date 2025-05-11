/**
 * Signal Derivative Processor
 * Calculates first derivatives of signal data
 */

// Helper function to calculate the derivative of a signal
function calculateDerivative(data) {
    if (!data || data.length <= 1) {
        return data.length === 1 ? [0] : []; // Return empty or zero array for edge cases
    }
    
    const result = new Array(data.length).fill(0);
    
    // First point - forward difference
    result[0] = data[1] - data[0];
    
    // Middle points - central difference (more accurate)
    for (let i = 1; i < data.length - 1; i++) {
        result[i] = (data[i+1] - data[i-1]) / 2;
    }
    
    // Last point - backward difference
    result[data.length - 1] = data[data.length - 1] - data[data.length - 2];
    
    return result;
} 