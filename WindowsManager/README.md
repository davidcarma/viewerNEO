# macOS-Style Windowing System Module

This directory contains a lightweight, draggable, resizable, and theme-aware windowing system used by ViewerNEO.

## Features

*   **Create Windows**: Dynamically create new windows with custom titles and content.
*   **Window Behaviors**: 
    *   Draggable: Move windows around the viewport.
    *   Resizable: Resize windows from **all corners and edges**.
    *   Minimize: Collapse windows to their title bar.
    *   Maximize/Restore: Expand windows to fill the viewport (below the top controls bar) or restore to their previous size.
    *   Close: Remove windows.
    *   Z-Index Management: Clicking a window brings it to the front.
*   **Styling**: Uses shared theme tokens when present (CSS variables from `app.css`).
*   **Content Types**:
    *   Windows can contain arbitrary HTML content.
    *   Supports loading external HTML pages into windows using `<iframe>`.
*   **Layout Persistence**: 
    *   Save the current layout (positions, sizes, states of all windows) to `localStorage`.
    *   Load the previously saved layout.
*   **Iframe Interaction Shield**: A visually styled "glass pane" shield appears over `<iframe>` content during drag/resize operations to ensure smooth interactions.
*   **User Notifications**: Simple notifications for actions like saving/loading layouts or errors.

## How to Run

This module is used by the main app. See the root `README.md` for how to run ViewerNEO.

## Main Files

* `style.css`: Window frame/titlebar/control styling (tokenized).
* `window-system.js`: Core module (create/drag/resize/minimize/maximize).
* `API.md`: Public API reference.

## Notes

* The `backdrop-filter` for the iframe shield has good browser support, but may require flags in older browsers.