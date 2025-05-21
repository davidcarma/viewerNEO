# ViewerNeo Project

ViewerNeo is a web-based application designed for viewing and interacting with images, particularly in a grid or gallery format. It features a thumbnail panel for image selection and a main viewing area with pan and zoom capabilities.

## Features

*   **Thumbnail Panel:** Displays images in categorized batches, allowing users to select images for viewing.
*   **Image Viewer:**
    *   Displays selected images in a main canvas area.
    *   **Pan functionality:** Click and drag to move the image within the canvas.
    *   **Zoom functionality:** Use the mouse wheel to zoom in and out. The zoom operation keeps the point under the mouse cursor stationary.
    *   **Reset view:** Double-click the canvas or use a "Reset View" button to revert to the default zoom and pan.
*   **Window Management System:** The image viewer is presented within a draggable and resizable window.
*   **Dynamic Layout:** The interface adjusts when the thumbnail panel is opened or closed.
*   **Paste to Upload:** Users can paste images directly from their clipboard to create new image batches in the thumbnail panel.

## Project Structure (Key Components)

*   `ViewerNeo/index.html`: The main entry point of the application, defines the layout and loads necessary scripts.
*   `ViewerNeo/grid_viewer_controls.js`: Handles the logic for the canvas-based image viewer, including pan, zoom, and image rendering.
*   `ViewerNeo/grid_viewer_style.css`: Styles specific to the grid viewer.
*   `ThumbnailGallery/thumbnail-pane.js`: A web component for displaying image thumbnails.
*   `WindowsManager/window-system.js`: Manages the creation and behavior of floating windows within the application.
*   `WindowsManager/style.css`: Styles for the windowing system.

## Running the Project

**Important:** To avoid CORS (Cross-Origin Resource Sharing) errors when loading local image files, this project **must be served by a web server**. You cannot simply open the `index.html` file directly in your browser from the file system (`file:///...`).

**Simple Web Server Options:**

1.  **Using Python:**
    If you have Python installed, navigate to the project's root directory (the one containing the `ViewerNeo` folder) in your terminal and run:
    *   Python 3: `python -m http.server`
    *   Python 2: `python -m SimpleHTTPServer`
    Then open your browser and go to `http://localhost:8000/ViewerNeo/index.html` (or the appropriate path if you run it from within the `ViewerNeo` directory itself).

2.  **Using Node.js `http-server`:**
    If you have Node.js and npm installed, you can install `http-server` globally:
    `npm install -g http-server`
    Then, navigate to the project's root directory and run:
    `http-server`
    Open your browser to the URL provided by `http-server` (usually `http://localhost:8080`), then navigate to `/ViewerNeo/index.html`.

3.  **Using VS Code Live Server Extension:**
    If you are using Visual Studio Code, you can install the "Live Server" extension. Once installed, you can right-click on `index.html` in the `ViewerNeo` folder and choose "Open with Live Server".

Once served, open `ViewerNeo/index.html` in your web browser.

## Development Ethos

See `NOTES.MD` for a detailed description of the project's design philosophy and coding approach. 