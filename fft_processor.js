/**
 * FFT Signal Processor
 * Implements Fast Fourier Transform for frequency analysis
 */

// A simple FFT implementation for real-valued signals
function calculateFFT(data) {
    if (!data || data.length === 0) {
        return [];
    }
    
    // Ensure data length is a power of 2 for FFT
    const paddedData = padToPowerOf2(data);
    const n = paddedData.length;
    
    // Create complex array (real, imaginary pairs)
    const complex = new Array(n * 2).fill(0);
    for (let i = 0; i < n; i++) {
        complex[i * 2] = paddedData[i];    // Real part
        complex[i * 2 + 1] = 0;            // Imaginary part
    }
    
    // Perform in-place FFT
    fft(complex, n);
    
    // Calculate magnitude (absolute values)
    const magnitude = new Array(n / 2).fill(0);
    for (let i = 0; i < n / 2; i++) {
        const real = complex[i * 2];
        const imag = complex[i * 2 + 1];
        magnitude[i] = Math.sqrt(real * real + imag * imag);
    }
    
    return magnitude;
}

// Pad array to the next power of 2
function padToPowerOf2(data) {
    const n = data.length;
    const log2n = Math.ceil(Math.log2(n));
    const newSize = Math.pow(2, log2n);
    
    if (n === newSize) {
        return [...data]; // Already power of 2
    }
    
    const result = new Array(newSize).fill(0);
    for (let i = 0; i < n; i++) {
        result[i] = data[i];
    }
    return result;
}

// Cooley-Tukey FFT algorithm for complex numbers
function fft(complex, n) {
    // Bit-reverse permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
        if (i < j) {
            // Swap complex[i] and complex[j]
            [complex[i * 2], complex[j * 2]] = [complex[j * 2], complex[i * 2]];
            [complex[i * 2 + 1], complex[j * 2 + 1]] = [complex[j * 2 + 1], complex[i * 2 + 1]];
        }
        
        let k = n / 2;
        while (k <= j) {
            j -= k;
            k /= 2;
        }
        j += k;
    }
    
    // Compute FFT
    for (let s = 1; s <= Math.log2(n); s++) {
        const m = Math.pow(2, s);
        const omega_m_real = Math.cos(2 * Math.PI / m);
        const omega_m_imag = -Math.sin(2 * Math.PI / m);
        
        for (let k = 0; k < n; k += m) {
            let omega_real = 1;
            let omega_imag = 0;
            
            for (let j = 0; j < m / 2; j++) {
                const index1 = k + j;
                const index2 = k + j + m / 2;
                
                const tReal = omega_real * complex[index2 * 2] - omega_imag * complex[index2 * 2 + 1];
                const tImag = omega_real * complex[index2 * 2 + 1] + omega_imag * complex[index2 * 2];
                
                complex[index2 * 2] = complex[index1 * 2] - tReal;
                complex[index2 * 2 + 1] = complex[index1 * 2 + 1] - tImag;
                
                complex[index1 * 2] += tReal;
                complex[index1 * 2 + 1] += tImag;
                
                // Update omega for next iteration
                const nextOmegaReal = omega_real * omega_m_real - omega_imag * omega_m_imag;
                const nextOmegaImag = omega_real * omega_m_imag + omega_imag * omega_m_real;
                omega_real = nextOmegaReal;
                omega_imag = nextOmegaImag;
            }
        }
    }
}

// Combined derivative + FFT processor
function calculateDerivativeFFT(data) {
    if (!data || data.length <= 1) {
        return data.length === 1 ? [0] : [];
    }
    
    // First calculate the derivative
    const derivative = calculateDerivative(data);
    
    // Then apply FFT to the derivative
    const fftResult = calculateFFT(derivative);
    
    return fftResult;
}

// Combined mod(derivative) + FFT processor
function calculateModDerivativeFFT(data) {
    if (!data || data.length <= 1) {
        return data.length === 1 ? [0] : [];
    }
    
    // First calculate the derivative
    const derivative = calculateDerivative(data);
    
    // Take absolute value (modulus) of each derivative value
    const modDerivative = derivative.map(value => Math.abs(value));
    
    // Then apply FFT to the mod derivative
    const fftResult = calculateFFT(modDerivative);
    
    return fftResult;
}

// Find top N peaks in FFT results
function findFFTPeaks(fftData, numPeaks = 3, originalLength) {
    if (!fftData || fftData.length === 0) {
        return [];
    }
    
    // Create array of [index, value] pairs, excluding DC component (index 0)
    const indexedData = fftData.map((value, index) => [index, value])
        .slice(1); // Skip DC component (index 0)
    
    // Sort by value in descending order
    indexedData.sort((a, b) => b[1] - a[1]);
    
    // Return top N peaks (index, frequency, wavelength, and magnitude)
    return indexedData.slice(0, numPeaks).map(pair => {
        const index = pair[0];
        const magnitudeValue = pair[1];

        // Calculate frequency using the same method as the tooltip
        // frequency = bin_index / fftData.length * 0.5 (Nyquist frequency)
        const frequency = (index / fftData.length) * 0.5;

        // Calculate wavelength in pixels
        const wavelength = frequency > 0 ? 1.0 / frequency : Infinity;
        
        return {
            index: index,
            frequency: Number(frequency.toFixed(4)),
            wavelength: Number(wavelength.toFixed(1)),
            magnitude: Number(magnitudeValue.toFixed(1))
        };
    });
} 