/**
 * OpenCV.js Manager - Shared module for ViewerNeo
 * Handles initialization, state management, and utility functions
 */

class OpenCVManager {
    constructor() {
        this.isReady = false;
        this.cv = null;
        this.loadingPromise = null;
        this.readyCallbacks = [];
        this.errorCallbacks = [];
        
        // Auto-initialize if OpenCV script is already loaded
        this.initialize();
    }

    /**
     * Initialize OpenCV.js with proper async handling
     */
    initialize() {
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = new Promise((resolve, reject) => {
            const handleReady = () => {
                this.isReady = true;
                console.log('OpenCV.js is ready!');
                
                // Fire all pending callbacks
                this.readyCallbacks.forEach(callback => {
                    try {
                        callback(this.cv);
                    } catch (error) {
                        console.error('Error in OpenCV ready callback:', error);
                    }
                });
                this.readyCallbacks = [];
                
                resolve(this.cv);
            };

            const handleError = (error) => {
                console.error('OpenCV.js failed to load:', error);
                this.errorCallbacks.forEach(callback => callback(error));
                this.errorCallbacks = [];
                reject(error);
            };

            // Handle different OpenCV.js initialization patterns
            if (typeof cv !== 'undefined') {
                if (typeof cv.then === 'function') {
                    // Promise-based (latest builds)
                    cv.then((realCV) => {
                        this.cv = realCV;
                        handleReady();
                    }).catch(handleError);
                } else if (cv.getBuildInformation) {
                    // Already loaded
                    this.cv = cv;
                    handleReady();
                } else {
                    // Callback-based (older builds)
                    cv['onRuntimeInitialized'] = () => {
                        this.cv = cv;
                        handleReady();
                    };
                }
            } else {
                // cv not defined yet, wait for script to load
                let checkInterval = setInterval(() => {
                    if (typeof cv !== 'undefined') {
                        clearInterval(checkInterval);
                        if (typeof cv.then === 'function') {
                            cv.then((realCV) => {
                                this.cv = realCV;
                                handleReady();
                            }).catch(handleError);
                        } else {
                            cv['onRuntimeInitialized'] = () => {
                                this.cv = cv;
                                handleReady();
                            };
                        }
                    }
                }, 100);

                // Timeout after 30 seconds
                setTimeout(() => {
                    if (!this.isReady) {
                        clearInterval(checkInterval);
                        handleError(new Error('OpenCV.js loading timeout'));
                    }
                }, 30000);
            }
        });

        return this.loadingPromise;
    }

    /**
     * Register a callback to run when OpenCV is ready
     * @param {Function} callback - Function to call when ready
     */
    onReady(callback) {
        if (this.isReady) {
            callback(this.cv);
        } else {
            this.readyCallbacks.push(callback);
        }
    }

    /**
     * Register a callback to run if OpenCV fails to load
     * @param {Function} callback - Function to call on error
     */
    onError(callback) {
        this.errorCallbacks.push(callback);
    }

    /**
     * Check if OpenCV is ready
     * @returns {boolean}
     */
    ready() {
        return this.isReady;
    }

    /**
     * Get the OpenCV object (only if ready)
     * @returns {Object|null}
     */
    getCV() {
        return this.isReady ? this.cv : null;
    }

    /**
     * Create cv.Mat from canvas element
     * @param {HTMLCanvasElement} canvas 
     * @returns {cv.Mat|null}
     */
    createMatFromCanvas(canvas) {
        if (!this.isReady) return null;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const mat = new this.cv.Mat(imageData.height, imageData.width, this.cv.CV_8UC4);
        mat.data.set(imageData.data);
        return mat;
    }

    /**
     * Create cv.Mat from image element
     * @param {HTMLImageElement} image 
     * @returns {cv.Mat|null}
     */
    createMatFromImage(image) {
        if (!this.isReady) return null;
        
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        return this.createMatFromCanvas(canvas);
    }

    /**
     * Display cv.Mat on canvas
     * @param {cv.Mat} mat 
     * @param {HTMLCanvasElement} canvas 
     */
    displayMatOnCanvas(mat, canvas) {
        if (!this.isReady) return;
        
        // Convert to RGBA if needed
        let display = new this.cv.Mat();
        if (mat.channels() === 1) {
            this.cv.cvtColor(mat, display, this.cv.COLOR_GRAY2RGBA);
        } else {
            display = mat.clone();
        }
        
        // Create ImageData and display
        const ctx = canvas.getContext('2d');
        canvas.width = display.cols;
        canvas.height = display.rows;
        const imageData = ctx.createImageData(display.cols, display.rows);
        imageData.data.set(display.data);
        ctx.putImageData(imageData, 0, 0);
        
        display.delete();
    }

    /**
     * Apply adaptive threshold to an image
     * @param {HTMLImageElement|HTMLCanvasElement} sourceImage 
     * @returns {HTMLCanvasElement|null}
     */
    applyAdaptiveThreshold(sourceImage, maxValue = 255, adaptiveMethod = null, thresholdType = null, blockSize = 11, C = 2) {
        if (!this.isReady) {
            console.error('OpenCV is not ready');
            return null;
        }

        try {
            // Create source Mat
            let src;
            if (sourceImage instanceof HTMLImageElement) {
                src = this.createMatFromImage(sourceImage);
            } else if (sourceImage instanceof HTMLCanvasElement) {
                src = this.createMatFromCanvas(sourceImage);
            } else {
                console.error('Unsupported image type');
                return null;
            }

            if (!src) {
                console.error('Failed to create source Mat');
                return null;
            }

            // Convert to grayscale
            const gray = new this.cv.Mat();
            this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);
            
            // Apply adaptive threshold
            const dst = new this.cv.Mat();
            const adaptiveMethodValue = adaptiveMethod || this.cv.ADAPTIVE_THRESH_MEAN_C;
            const thresholdTypeValue = thresholdType || this.cv.THRESH_BINARY;
            
            this.cv.adaptiveThreshold(gray, dst, maxValue, adaptiveMethodValue, thresholdTypeValue, blockSize, C);

            // Create result canvas
            const resultCanvas = document.createElement('canvas');
            this.displayMatOnCanvas(dst, resultCanvas);

            // Cleanup
            src.delete();
            gray.delete();
            dst.delete();

            return resultCanvas;

        } catch (error) {
            console.error('Error in adaptive threshold:', error);
            return null;
        }
    }

    /**
     * Execute function when OpenCV is ready, or immediately if already ready
     * @param {Function} fn - Function to execute
     * @returns {Promise}
     */
    whenReady(fn) {
        if (this.isReady) {
            return Promise.resolve(fn(this.cv));
        } else {
            return this.loadingPromise.then(() => fn(this.cv));
        }
    }
}

// Create global instance
window.openCVManager = new OpenCVManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpenCVManager;
}

export default OpenCVManager; 