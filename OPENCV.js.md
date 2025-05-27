# OpenCV.js Integration Guide

## Overview

This document explains how to properly integrate OpenCV.js in web applications, addressing common loading issues and providing best practices for both old and new OpenCV.js builds.

## The Problem

### Common Errors

1. **`cv is not defined`** - Script hasn't loaded yet
2. **`cv.Mat is not a constructor`** - OpenCV object is empty/not initialized
3. **`cv.imread is not a function`** - Functions not available in current build
4. **Page hangs with loading spinner** - Promise never resolves

### Root Causes

- **Async Loading**: OpenCV.js is large (10+ MB) and loads asynchronously
- **API Changes**: Newer builds use Promise-based initialization vs callback-based
- **Build Variations**: Some builds don't include high-level functions like `cv.imread`
- **Timing Issues**: Code runs before OpenCV.js is fully initialized

## OpenCV.js Build Types

### Old Builds (Pre-2024)
- Global `cv` object available immediately after `onRuntimeInitialized`
- Uses callback pattern: `cv.onRuntimeInitialized = function() { ... }`
- All functions available directly: `cv.Mat`, `cv.imread`, etc.

### New Builds (2024+)
- `cv` is a Promise that resolves to the actual API
- Uses Promise pattern: `cv.then(function(realCV) { ... })`
- Must wait for Promise resolution before using any functions

## Best Practice Solution

### 1. Use Async Loading with State Management

```html
<!-- Keep async for better page performance -->
<script async src="opencv.js"></script>
```

### 2. Implement State Variables

```javascript
// OpenCV state management
window.cvReady = false;
window.cv = undefined;
```

### 3. Universal Initialization Handler

```javascript
function onOpenCvReady() {
    console.log('OpenCV.js is ready!');
    window.cvReady = true;
    
    // Update UI - enable buttons, hide spinners, etc.
    document.getElementById('myButton').disabled = false;
    document.body.classList.remove('loading');
    
    // Process any pending operations
    if (pendingImage) {
        processImage(pendingImage);
    }
}

// Handle different OpenCV.js initialization patterns
if (typeof cv !== 'undefined') {
    if (typeof cv.then === 'function') {
        // Promise-based (latest builds)
        cv.then(function(realCV) {
            window.cv = realCV;
            onOpenCvReady();
        }).catch(function(error) {
            console.error('OpenCV.js failed to load:', error);
        });
    } else if (cv.getBuildInformation) {
        // Already loaded
        window.cv = cv;
        onOpenCvReady();
    } else {
        // Callback-based (older builds)
        cv['onRuntimeInitialized'] = function() {
            window.cv = cv;
            onOpenCvReady();
        };
    }
} else {
    // cv not defined yet, wait for script to load
    let checkInterval = setInterval(function() {
        if (typeof cv !== 'undefined') {
            clearInterval(checkInterval);
            if (typeof cv.then === 'function') {
                cv.then(function(realCV) {
                    window.cv = realCV;
                    onOpenCvReady();
                });
            } else {
                cv['onRuntimeInitialized'] = function() {
                    window.cv = cv;
                    onOpenCvReady();
                };
            }
        }
    }, 100);
}
```

### 4. Safe Function Calls

```javascript
function runOpenCvOperation() {
    // Always check if OpenCV is ready
    if (!window.cvReady) {
        alert('OpenCV.js is still loading, please wait...');
        return;
    }
    
    // Use local reference for cleaner code
    let cv = window.cv;
    
    // Now safe to use OpenCV functions
    let mat = new cv.Mat();
    // ... your OpenCV code ...
    mat.delete(); // Don't forget cleanup!
}
```

### 5. UI State Management

```javascript
// Disable buttons initially
document.getElementById('processButton').disabled = true;
document.getElementById('processButton').textContent = 'Loading OpenCV...';

// Enable when ready
function onOpenCvReady() {
    document.getElementById('processButton').disabled = false;
    document.getElementById('processButton').textContent = 'Process Image';
}
```

## Handling Missing Functions

Some OpenCV.js builds don't include `cv.imread` or `cv.imshow`. Use manual conversion:

```javascript
function createMatFromCanvas(canvas) {
    if (!window.cvReady) return null;
    
    let cv = window.cv;
    let ctx = canvas.getContext('2d');
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create cv.Mat manually
    let mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
    mat.data.set(imageData.data);
    return mat;
}

function displayMatOnCanvas(mat, canvas) {
    if (!window.cvReady) return;
    
    let cv = window.cv;
    
    // Convert to RGBA if needed
    let display = new cv.Mat();
    if (mat.channels() === 1) {
        cv.cvtColor(mat, display, cv.COLOR_GRAY2RGBA);
    } else {
        display = mat.clone();
    }
    
    // Create ImageData and display
    let ctx = canvas.getContext('2d');
    let imageData = ctx.createImageData(display.cols, display.rows);
    imageData.data.set(display.data);
    ctx.putImageData(imageData, 0, 0);
    
    display.delete();
}
```

## Complete Example

See `opencv.js.tests/index.html` for a working implementation that:

- ✅ Loads OpenCV.js asynchronously (non-blocking)
- ✅ Works with both old and new OpenCV.js builds
- ✅ Provides proper user feedback during loading
- ✅ Safely handles all OpenCV operations
- ✅ Includes error handling and fallbacks

## Troubleshooting

### Issue: `cv is not defined`
**Solution**: Check that script is loaded and use state management

### Issue: `cv.Mat is not a constructor`
**Solution**: Wait for proper initialization, check `window.cvReady`

### Issue: `cv.imread is not a function`
**Solution**: Use manual canvas-to-Mat conversion (see above)

### Issue: Page hangs during loading
**Solution**: Check browser console for WASM/CORS errors, use local server

### Issue: Functions work in console but not in code
**Solution**: Timing issue - ensure code runs after `onOpenCvReady()`

## ViewerNeo Integration

For the ViewerNeo project, we've created a modular OpenCV manager (`lib/opencv-manager.js`) that:

### Features
- ✅ **Universal Compatibility**: Works with all OpenCV.js builds (old and new)
- ✅ **Async Loading**: Non-blocking initialization with proper state management
- ✅ **Utility Functions**: Pre-built functions for common operations
- ✅ **Error Handling**: Comprehensive error handling and user feedback
- ✅ **Memory Management**: Automatic cleanup of OpenCV objects

### Usage in ViewerNeo

```javascript
// Check if OpenCV is ready
if (window.openCVManager.ready()) {
    // Use OpenCV functions
    const resultCanvas = window.openCVManager.applyAdaptiveThreshold(sourceImage);
}

// Or wait for it to be ready
window.openCVManager.whenReady((cv) => {
    // Your OpenCV code here
});

// Register callbacks
window.openCVManager.onReady((cv) => {
    console.log('OpenCV is ready!');
});
```

### Available Methods

- `ready()` - Check if OpenCV is ready
- `getCV()` - Get the OpenCV object
- `createMatFromCanvas(canvas)` - Convert canvas to cv.Mat
- `createMatFromImage(image)` - Convert image to cv.Mat
- `displayMatOnCanvas(mat, canvas)` - Display cv.Mat on canvas
- `applyAdaptiveThreshold(image)` - Apply adaptive threshold filter
- `whenReady(callback)` - Execute when OpenCV is ready

## Official Resources

- [OpenCV.js Documentation](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html)
- [Latest OpenCV.js Build](https://docs.opencv.org/master/opencv.js)
- [Utils.js Helper](https://docs.opencv.org/master/utils.js)

## Version Compatibility

| OpenCV.js Version | Initialization Pattern | Notes |
|-------------------|------------------------|-------|
| 3.x - 4.5         | `cv.onRuntimeInitialized` | Callback-based |
| 4.6+              | `cv.then(...)` | Promise-based |
| Latest (2024+)    | `cv.then(...)` | Promise-based, may lack some functions |

---

**Last Updated**: May 2024  
**Tested With**: OpenCV.js 4.x (latest nightly builds)  
**ViewerNeo Integration**: `lib/opencv-manager.js` provides modular access 