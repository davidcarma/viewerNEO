# ViewerNeo Project

ViewerNeo is a web-based application designed for viewing and interacting with images, particularly in a grid or gallery format. It features a thumbnail panel for image selection and a main viewing area with advanced pan, zoom, and measurement capabilities.

## Features

### Image Viewing & Navigation
*   **Thumbnail Panel:** Displays images in categorized batches, allowing users to select images for viewing.
*   **Advanced Image Viewer:**
    *   Displays selected images in a main canvas area with precise controls.
    *   **Pan functionality:** Click and drag to move the image within the canvas (grab/grabbing cursor feedback).
    *   **Zoom functionality:** Use the mouse wheel to zoom in and out (0.1x to 10,000x range). The zoom operation keeps the point under the mouse cursor stationary.
    *   **Reset view:** Double-click the canvas or use a "Reset View" button to revert to the default zoom and pan.

### Advanced Grid & Measurement System
*   **Precision Grid Overlay:**
    *   **Synced Mode:** Grid lines correspond to actual image pixels, scaling with zoom level.
    *   **Fixed Mode:** Grid lines maintain consistent screen spacing regardless of zoom.
    *   **Customizable spacing:** Adjustable major grid spacing with minor grid lines (1/10th intervals).
    *   **Color & opacity controls:** Fully customizable appearance.
    *   **Show/hide minor lines:** Toggle for cleaner display when needed.

*   **Professional Rulers:**
    *   **Pixel-accurate measurements:** Display exact image coordinates.
    *   **Smart tick spacing:** Automatic adjustment based on zoom level for optimal readability.
    *   **Multi-level markings:** Major, minor, and sub-minor ticks with intelligent labeling.
    *   **Real-time mouse tracking:** Live coordinate display and ruler markers.
    *   **40px ruler width:** Accommodates 4-digit coordinate numbers.

### Input & File Handling
*   **Multiple Upload Methods:**
    *   **Paste to Upload:** Paste images directly from clipboard to create new batches.
    *   **Drag & Drop:** Drop individual image files or entire directories (auto-filters for image files).
    *   **Traditional File Input:** Standard file selection dialog.

*   **Supported Image Formats:** All browser-supported formats (PNG, JPEG, GIF, WebP, SVG, BMP).

### Window Management & UI
*   **Professional Window System:** Draggable and resizable windows with proper focus management.
*   **Dynamic Layout:** Interface adjusts automatically when panels are opened or closed.
*   **Responsive Design:** Works across different screen sizes and devices.

### Calibration & Accuracy Tools
*   **Built-in Calibration Ruler Generator:**
    *   Creates precise 1024×1024 pixel test images.
    *   Multiple grid intervals (5px, 10px, 50px) for accuracy verification.
    *   Sharp, anti-aliased rendering for pixel-perfect measurements.
    *   Test points at specific coordinates for validation.
    *   Downloadable PNG format for external use.

## Project Structure (Key Components)

*   `ViewerNeo/index.html`: Main application entry point with enhanced drag & drop support.
*   `ViewerNeo/grid_viewer_controls.js`: Advanced canvas-based viewer with grid, rulers, and measurement tools.
*   `ViewerNeo/grid_viewer_style.css`: Styles for the grid viewer interface.
*   `ViewerNeo/calibration_ruler_generator.html`: Standalone calibration tool for accuracy testing.
*   `ThumbnailGallery/thumbnail-pane.js`: Web component for thumbnail display and batch management.
*   `WindowsManager/window-system.js`: Professional windowing system with advanced controls.
*   `WindowsManager/style.css`: Window system styling and animations.

## Usage Guide

### Grid Viewer Controls
1. **Show/Hide Grid:** Toggle the grid overlay and measurement tools.
2. **Grid Settings Panel:** 
   - **Color Picker:** Choose grid line color
   - **Opacity Slider:** Adjust transparency (0-100%)
   - **Major Spacing:** Set grid interval in image pixels
   - **Minor Lines:** Toggle 1/10th subdivision lines
   - **Mode Selection:**
     - **Synced:** Grid scales with image (pixel-accurate measurements)
     - **Fixed:** Grid maintains screen spacing (consistent visual reference)

### Navigation Controls
*   **Mouse Wheel:** Zoom in/out (maintains cursor position)
*   **Click + Drag:** Pan the image
*   **Double-click:** Reset to fit view
*   **Reset View Button:** Return to default zoom and position

### Measurement Features
*   **Live Coordinates:** Mouse position displayed in image pixels
*   **Ruler Markers:** Red triangular markers follow mouse position
*   **Zoom Indicator:** Current zoom percentage
*   **Pan Display:** Current pan offset values

### File Management
*   **Drag Files:** Drag image files directly onto the interface
*   **Drag Directories:** Drop entire folders (automatically filters for images)
*   **Paste Images:** Ctrl+V to paste from clipboard
*   **Batch Organization:** Images automatically grouped into named batches

## Running the Project

**Important:** To avoid CORS (Cross-Origin Resource Sharing) errors when loading local image files, this project **must be served by a web server**. You cannot simply open the `index.html` file directly in your browser from the file system (`file:///...`).

**Simple Web Server Options:**

1.  **Using Python:**
    Navigate to the project's root directory in your terminal and run:
    *   Python 3: `python -m http.server 8000`
    *   Python 2: `python -m SimpleHTTPServer 8000`
    Then open your browser and go to `http://localhost:8000/ViewerNeo/index.html`

2.  **Using Node.js `http-server`:**
    Install and run http-server:
    ```bash
    npm install -g http-server
    http-server
    ```
    Open your browser to `http://localhost:8080/ViewerNeo/index.html`

3.  **Using VS Code Live Server Extension:**
    Install the "Live Server" extension, right-click on `ViewerNeo/index.html` and choose "Open with Live Server".

## Calibration & Testing

Use the built-in calibration tool to verify measurement accuracy:

1. Open `ViewerNeo/calibration_ruler_generator.html`
2. Generate and download the calibration image
3. Load the calibration image in the main viewer
4. Enable the grid overlay and verify:
   - Grid lines align with calibration image grid
   - Ruler coordinates match image pixel positions
   - Mouse coordinates are accurate
   - Zoom measurements are precise

## Browser Support

*   **Modern Browsers:** Chrome, Firefox, Safari, Edge (latest versions)
*   **Canvas API:** Required for image rendering and grid overlay
*   **File API:** Required for drag & drop functionality
*   **Clipboard API:** Required for paste functionality

## Development Ethos

See `NOTES.MD` for detailed information about the project's design philosophy and coding approach. 