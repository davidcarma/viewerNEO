# Shadow DOM Thumbnail Pane and Canvas Viewer Test

This project demonstrates a thumbnail panel built as a Shadow DOM web component (`thumbnail-pane`) interacting with a main content area that includes a canvas for displaying selected images.

## Files

*   `index.html`: The main HTML page that hosts the `thumbnail-pane` component and the canvas. It contains the primary JavaScript logic for communication between the panel, the canvas, and handling image pasting.
*   `thumbnail-pane.js`: Defines the `<thumbnail-pane>` custom web component. This component manages the display of image batches and individual thumbnails, and emits events when thumbnails are selected or modified.

## How to Run

1.  Ensure both `index.html` and `thumbnail-pane.js` are in the same directory (e.g., `shadow-dom-tests/`).
2.  Open the `index.html` file in a modern web browser that supports:
    *   Web Components (Custom Elements & Shadow DOM)
    *   ES Modules
    *   Canvas API
    *   Clipboard API (for paste functionality)

    Most modern browsers like Chrome, Firefox, Edge, and Safari should work.
3.  The page should load with the thumbnail panel on the left (possibly opened by default) and a main content area with a canvas.

## Features Demonstrated

*   **Thumbnail Panel**:
    *   Displays images in collapsible batches.
    *   Allows adding new image batches by pasting images onto the page.
    *   Thumbnails can be selected.
    *   Individual thumbnails and entire batches can be removed.
*   **Canvas Viewer**:
    *   A fixed, square canvas in the center of the main content area.
    *   When an image thumbnail is clicked in the panel:
        *   If the image has actual file data (e.g., from a pasted image), the image is loaded and displayed on the canvas, scaled to fit while maintaining aspect ratio.
        *   If the image is a placeholder (from the initial `setData` example without full file data), a placeholder rectangle with the filename is shown.
*   **Interactions**:
    *   Opening/closing the thumbnail panel resizes the main content area and the canvas.
    *   Window resizing also adjusts the canvas dimensions.
    *   Events are used for communication between the `thumbnail-pane` component and the main page logic. 