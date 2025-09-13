# Project Design Philosophy & Coding Ethos: ViewerNeo

This document outlines the guiding principles for the development of the ViewerNeo project, particularly focusing on the canvas pan and zoom functionality. It serves as a reference for maintaining a consistent approach across development efforts, especially when collaborating with AI assistants.

## Core Principles:

1.  **Modularity and Clear Separation of Concerns:**
    *   Encapsulate distinct functionalities into separate JavaScript files (e.g., `ViewerNeo/grid_viewer_controls.js`, `ThumbnailGallery/thumbnail-pane.js`, `WindowsManager/window-system.js`).
    *   Maintain separation between HTML structure (`ViewerNeo/index.html`), CSS styling (`ViewerNeo/grid_viewer_style.css`, `WindowsManager/style.css`), and JavaScript logic.
    *   Break down functionality into specific functions with clear, single responsibilities (e.g., `redrawCanvas`, `setupCanvasImageHandling`, `handleThumbnailImage`).

2.  **Event-Driven Architecture:**
    *   Leverage DOM event listeners (`mousedown`, `mousemove`, `mouseup`, `wheel`, `dblclick`, `click`) for interactivity.
    *   Utilize custom events (e.g., `thumbnail-selected`, `panel-opened`, `panel-closed`, `canvas-replaced`) for communication between components, promoting loose coupling and modularity.

3.  **Direct State Management:**
    *   Store key state, like the canvas's pan and zoom status (`transformState`), directly on the relevant DOM element (e.g., the canvas) or via global `window` properties when necessary for broader accessibility within the `index.html` script blocks.
    *   Update UI state (e.g., panel visibility, button text) dynamically in direct response to user actions and application events.

4.  **Iterative Refinement and Debugging-Driven Development:**
    *   Approach complex features, such as "zoom to mouse point," iteratively. Be prepared to explore different solutions, analyze their behavior, and refactor code as needed.
    *   Employ `console.log` extensively for debugging to understand state changes, variable values, and calculations at runtime, especially for fine-tuning mathematical formulas for transformations.

5.  **Striving for Simplicity and Clarity:**
    *   Even when dealing with complex underlying logic (e.g., transformation mathematics), aim for an implementation that is as clear, understandable, and maintainable as possible.
    *   Introduce complexity incrementally, starting from simple base requirements and building up to more precise behavioral goals.

6.  **User Experience (UX) Centric:**
    *   Prioritize an intuitive, effective, and responsive user experience.
    *   Implement visual feedback (e.g., cursor changes like `grab`/`grabbing`) and convenient controls (e.g., reset view button, double-click to reset) to enhance usability.
    *   Address challenging interaction problems (like keeping the mouse point stationary during zoom) to meet user expectations for smooth and natural interactions.

7.  **Progressive Enhancement and Robustness (Initial Steps):**
    *   Incorporate measures to ensure functionality even with variations in component loading times (e.g., `setTimeout` for UI synchronization, checks for canvas/context availability).
    *   Include basic error handling, such as for image loading.

8.  **Dynamic UI Updates:**
    *   Ensure the application dynamically adjusts its layout and content based on user interactions and application state (e.g., resizing main content when the thumbnail panel opens/closes, updating window titles based on loaded images).

9.  **Integration of Components:**
    *   Utilize custom components (e.g., `<thumbnail-pane>`) and well-defined modules (e.g., windowing system) to build the UI from self-contained, potentially reusable parts.

## Important Note for Development:

*   **Serving the Project:** To avoid CORS (Cross-Origin Resource Sharing) issues when loading local image files (e.g., from the `./images` directory or pasted files), this project **must be served by a web server**. Do not open the `index.html` file directly in the browser using the `file:///` protocol.
    *   Refer to the `README.md` for simple web server options (Python, Node.js `http-server`, VS Code Live Server).

## Ethos Summary:

Start with clear, modular components. Implement core logic through event-driven interactions. Manage state in a straightforward way, often local to the elements concerned or globally accessible for coordination. Don't shy away from iterative development and thorough debugging to solve complex interaction problems. Prioritize a clean, intuitive user experience, and aim for readable, maintainable code, even when tackling intricate features. 