# Window System Module API (`window-system.js`)

This document details the public API exported by the `window-system.js` module.

## Exported Functions

### `createWindow(options)`

Creates a new window and appends it to the document body.

*   **`options`** (Object): Configuration for the new window.
    *   **`id`** (String, Optional): A unique ID for the window. Defaults to `window-${Date.now()}`.
    *   **`title`** (String, Optional): The title displayed in the window's title bar. Defaults to `'New Window'`.
    *   **`content`** (String, Optional): HTML string representing the content of the window. Defaults to `''` (empty).
    *   **`x`** (Number, Optional): Initial X (left) position of the window in pixels. Defaults to `100`.
    *   **`y`** (Number, Optional): Initial Y (top) position of the window in pixels. Defaults to `100`.
    *   **`width`** (Number, Optional): Initial width of the window in pixels. Defaults to `400`.
    *   **`height`** (Number, Optional): Initial height of the window in pixels. Defaults to `300`.
    *   **`isMinimized`** (Boolean, Optional): Whether the window should be created in a minimized state. Defaults to `false`.
    *   **`isMaximized`** (Boolean, Optional): Whether the window should be created in a maximized state. Defaults to `false`.
*   **Returns**: The main DOM element (`HTMLDivElement`) of the created window frame. This is typically not directly manipulated by the calling code after creation, as interactions are handled internally or via other API functions.

### `setTopBarOffset(offset)`

Informs the windowing system about the height of a fixed bar at the top of the page (e.g., a main controls bar). This offset is used to ensure that maximized windows do not render underneath this top bar.

*   **`offset`** (Number): The height of the top bar in pixels.

### `getWindows()`

Retrieves an array of all currently active window instances managed by the system.

*   **Returns**: (Array) An array of window instance objects. Each object has the following properties and methods:
    *   **`id`** (String): The unique ID of the window.
    *   **`title`** (String): The current title of the window.
    *   **`frame`** (HTMLDivElement): The main DOM element of the window.
    *   **`getState()`**: A function that returns an object representing the current state of the window. The state object includes:
        *   `id` (String)
        *   `title` (String)
        *   `x` (Number): Current left position (or restored X if maximized).
        *   `y` (Number): Current top position (or restored Y if maximized).
        *   `width` (Number): Current width (or restored width if maximized).
        *   `height` (Number): Current height (or restored height if maximized).
        *   `zIndex` (Number): Current z-index.
        *   `isMinimized` (Boolean): True if the window is currently minimized.
        *   `isMaximized` (Boolean): True if the window is currently maximized.
    *   **`applyState(stateObject)`**: A function that applies a given state to the window. This is used for restoring layouts.
        *   `stateObject`: An object with the same structure as returned by `getState()`. It will update the window's position, dimensions, z-index, and minimized/maximized status.

### `getAllWindowStates()`

Retrieves an array containing the state objects for all currently active windows. This is primarily used for saving the layout.

*   **Returns**: (Array) An array of window state objects (see `getState()` under `getWindows()` for the structure of each state object).

### `removeAllWindows()`

Removes all windows from the DOM and clears the internal tracking array. Also resets the global `highestZIndex` counter.

## Internal State (Not Directly Exposed but Relevant)

*   **`highestZIndex`**: A module-level variable tracking the highest z-index assigned, used to bring windows to the front.
*   **`windows`**: An array holding the internal window instance objects.
*   **`topBarOffset`**: A module-level variable storing the offset for a top bar.

This API allows for the creation, management, and persistence of window layouts within a web page. 