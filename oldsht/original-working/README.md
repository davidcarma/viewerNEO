# OCR Research Viewer

A high-DPI image viewer designed for OCR (Optical Character Recognition) research with advanced analysis tools.

## Overview

This tool allows researchers to load, view, and analyze high-resolution images with pixel-perfect accuracy. It's particularly useful for OCR development, document image analysis, and related research that requires detailed examination of image characteristics.

## Features

- **High-DPI Support**: Optimized for retina and high-resolution displays
- **Smooth Navigation**:
  - Zoom in/out with precise control
  - Pan/drag to navigate large images
  - Reset view to fit the image to screen
- **Multi-Image Support**:
  - Load multiple images at once
  - Browse images via thumbnail panel
  - Sort images automatically by filename
  - Support for folder/directory loading
- **Grid Overlay**:
  - Customizable grid size
  - Adjustable color and opacity
  - Perfect for pixel-level analysis
- **Projection Analysis**:
  - Generate horizontal and vertical intensity profiles
  - Visualize text line positions and character boundaries
  - Full-screen projection view
- **User-Friendly Interface**:
  - Drag and drop image loading (single files, multiple files, or folders)
  - Real-time information display (image size, zoom level, position)
  - Collapsible thumbnail panel
  - Simple, intuitive controls

## How to Use

### Getting Started

1. Open `index.html` in a modern web browser (Chrome recommended for all features)
2. Load images using any of these methods:
   - Click the "Load Image" button and select "Load Files" for individual images
   - Click the "Load Image" button and select "Load Folder" for an entire directory
   - Drag and drop one or more image files onto the viewer
   - Drag and drop a folder containing images onto the viewer (Chrome)

### Navigation

- **Pan**: Click and drag to move around the image
- **Zoom**: Use the mouse wheel or the Zoom In/Out buttons
- **Reset View**: Click "Reset View" to fit the image to screen
- **Switch Images**: Click on thumbnails in the side panel to switch between loaded images

### Thumbnail Panel

- **Show/Hide**: Click "Show Thumbnails" or "Hide Thumbnails" to toggle the panel
- **Quick Access**: Use the side handle to show/hide the panel
- **Navigation**: Click any thumbnail to display that image
- **Scrolling**: Scroll through thumbnails when many images are loaded
- **Auto-Display**: Panel automatically appears when multiple images are loaded

### Grid Overlay

1. Click the "Grid" button to toggle the grid on/off
2. Adjust grid settings:
   - Size: Change the grid cell size in pixels
   - Color: Select any color for the grid lines
   - Opacity: Adjust the transparency level

### Projection Analysis

1. Load an image
2. Click "Show Projection" to generate intensity profiles
3. The projection view shows:
   - The image in the top-left
   - Horizontal projection (vertical graph) on the right
   - Vertical projection (horizontal graph) below
4. Use "Full Screen" for a larger view or "Close" to return to the main viewer
5. Projection analysis helps visualize:
   - Text line positions (horizontal projection)
   - Character spacing and boundaries (vertical projection)
   - Image density variations for OCR analysis

## Technical Details

The viewer is built with vanilla JavaScript, HTML5 Canvas, and CSS. It includes:

- Device pixel ratio adjustment for sharp rendering on high-DPI displays
- Efficient canvas operations for smooth performance with large images
- Multi-image loading and management system
- File and directory access using both standard and modern APIs:
  - Standard File API for basic file operations
  - File System Access API for folder traversal (Chrome/Edge)
  - Support for webkitdirectory for directory input
- Thumbnail generation with aspect ratio preservation
- Intensity analysis algorithms for projection profiles
- Responsive design that works in various screen sizes

## Browser Compatibility

For best experience with all features:
- Chrome/Edge (latest): Full support including folder drag-and-drop
- Firefox (latest): Most features, limited folder support
- Safari (latest): Most features, no folder drag-and-drop

## Use Cases

- OCR algorithm development and testing
- Document layout analysis
- Character segmentation research
- Image preprocessing for text recognition
- Visual analysis of document structure
- Batch processing and comparison of multiple document images

## Tips for Best Performance

- For large image collections, use Chrome or Edge
- When working with folders containing many images, use the "Load Folder" button
- Use the thumbnail panel to quickly compare multiple images
- For very high resolution images, use the grid feature to analyze pixel details
- Use projection profiles to identify text lines and character boundaries

## License

[MIT License](LICENSE)