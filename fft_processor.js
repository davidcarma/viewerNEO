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
    
    // Create array of [index, value] pairs
    const indexedData = fftData.map((value, index) => [index, value]);
    
    // Sort by value in descending order
    indexedData.sort((a, b) => b[1] - a[1]);
    
    // Calculate frequency scale based on original signal length (before padding)
    const nyquist = 0.5; // Nyquist frequency (0.5 cycles/pixel)
    let frequencyScale;

    if (originalLength > 0) {
        frequencyScale = nyquist / (originalLength / 2);
    } else {
        // Log a warning as this indicates an issue with how originalLength is provided
        // or the data processing stage prior to calling this function.
        console.warn(`findFFTPeaks: Invalid originalLength (${originalLength}). Frequencies and wavelengths will likely be NaN or Infinity.`);
        frequencyScale = NaN; // Leads to NaN frequency/wavelength, clearly indicating error
    }
    
    // Return top N peaks (index, frequency, wavelength, and magnitude)
    return indexedData.slice(0, numPeaks).map(pair => {
        const index = pair[0];
        const magnitudeValue = pair[1]; // Raw magnitude from fftData

        // Calculate frequency
        let frequency = index * frequencyScale; // Can be NaN if frequencyScale is NaN, or 0 if index is 0.

        // Calculate wavelength
        let wavelength;
        if (Number.isNaN(frequency)) {
            wavelength = NaN;
        } else if (frequency === 0) {
            // DC component or zero frequency: wavelength is infinite.
            wavelength = Infinity; 
        } else {
            // For non-zero, non-NaN frequencies.
            wavelength = 1 / frequency;
        }
        
        // Format numbers for the output object
        // .toFixed converts to string, Number() converts back.
        // This ensures that NaN and Infinity are preserved as such if they occur.
        const formattedFrequency = Number(frequency.toFixed(4));
        const formattedWavelength = Number(wavelength.toFixed(2));
        const formattedMagnitude = Number(magnitudeValue.toFixed(2));

        return {
            index: index,
            frequency: formattedFrequency,
            wavelength: formattedWavelength,
            magnitude: formattedMagnitude
        };
    });
} 