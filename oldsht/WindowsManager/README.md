# macOS-Style Windowing System Module

This project implements a lightweight, draggable, resizable, and themable windowing system directly in the browser using HTML, CSS, and modern JavaScript (ES Modules).

## Features

*   **Create Windows**: Dynamically create new windows with custom titles and content.
*   **Window Behaviors**: 
    *   Draggable: Move windows around the viewport.
    *   Resizable: Resize windows from their bottom-right corner.
    *   Minimize: Collapse windows to their title bar.
    *   Maximize/Restore: Expand windows to fill the viewport (below the top controls bar) or restore to their previous size.
    *   Close: Remove windows.
    *   Z-Index Management: Clicking a window brings it to the front.
*   **Styling**: Dark macOS-like theme by default.
*   **Content Types**:
    *   Windows can contain arbitrary HTML content.
    *   Supports loading external HTML pages into windows using `<iframe>`.
*   **Layout Persistence**: 
    *   Save the current layout (positions, sizes, states of all windows) to `localStorage`.
    *   Load the previously saved layout.
*   **Iframe Interaction Shield**: A visually styled "glass pane" shield appears over `<iframe>` content during drag/resize operations to ensure smooth interactions.
*   **User Notifications**: Simple notifications for actions like saving/loading layouts or errors.

## How to Run

1.  Ensure all project files (`index.html`, `style.css`, `window-system.js`, and `iframe.html`) are in the `windows-system-module-tests` directory.
2.  Open `windows-system-module-tests/index.html` in a modern web browser that supports ES Modules (e.g., Chrome, Firefox, Edge, Safari).

## Main Files

*   `index.html`: The main test page demonstrating the windowing system. Contains example window creations and buttons for saving/loading layouts.
*   `style.css`: Contains all the CSS for the window frames, title bars, controls, content areas, dark theme, table styling, notifications, and the iframe shield.
*   `window-system.js`: The core JavaScript module that provides all windowing functionalities.
*   `iframe.html`: An example ancillary HTML page loaded into one of the windows via an `<iframe>`.
*   `API.md`: Documentation for the public API of the `window-system.js` module.

## Notes

*   The layout saving feature uses the browser's `localStorage`. The layout is saved based on window titles. If a window title in a saved layout does not match any currently open window's title upon loading, its state will be ignored.
*   The `backdrop-filter` for the "glass pane" shield effect has good browser support but might require flags in older browser versions or specific configurations in some (e.g., Firefox `about:config`). 