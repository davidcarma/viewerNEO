# `thumbnail-pane` Web Component API Reference

This document provides an overview of the public API for the `<thumbnail-pane>` web component.

## I. Usage

```html
<thumbnail-pane id="my-panel" panel-width="200" opened>
    <span slot="panel-title">My Custom Title</span>
</thumbnail-pane>

<script>
    const panel = document.getElementById('my-panel');

    // Set data
    panel.setData([
        { 
            id: 'batch01', title: 'Batch One', expanded: true, files: [
                { name: 'image1.jpg', type: 'image/jpeg' },
                { name: 'image2.png', type: 'image/png' }
            ]
        }
    ]);

    // Listen to events
    panel.addEventListener('thumbnail-selected', (event) => {
        console.log('Thumbnail selected:', event.detail.file.name);
    });

    panel.addEventListener('panel-opened', () => {
        console.log('Panel was opened. Current width:', panel.getCurrentWidth());
    });
</script>
```

## II. Attributes

These can be set directly in the HTML tag.

-   **`opened`**: (Boolean attribute)
    -   If present, the panel will be open by default.
    -   Example: `<thumbnail-pane opened></thumbnail-pane>`
-   **`panel-width`**: (String, representing pixels)
    -   Sets the width of the panel. Defaults to `160` (px).
    -   Example: `<thumbnail-pane panel-width="220"></thumbnail-pane>`

## III. Properties

These can be accessed via JavaScript on the component instance.

-   **`_isPanelActive`**: (Read-only, Boolean via internal state)
    -   Indicates if the panel is currently open and active. (Primarily internal, but `getCurrentWidth()` relies on it)
-   **`_panelWidth`**: (Read-only, Number via internal state)
    -   The current configured width of the panel in pixels. (Primarily internal, but `getCurrentWidth()` and `panel-width` attribute affect it)
-   **`_batches`**: (Read-only, Array via internal state)
    -   The array of batch data currently held by the component after `setData()` is called.

## IV. Methods

Call these methods on an instance of the component.

-   **`openPanel()`**
    -   Opens the thumbnail panel.
    -   Dispatches `panel-opened` event.
-   **`closePanel()`**
    -   Closes the thumbnail panel.
    -   Dispatches `panel-closed` event.
-   **`togglePanel()`**
    -   Toggles the open/closed state of the panel.
-   **`getCurrentWidth()`**: `number`
    -   Returns the current width of the panel if it's open, otherwise `0`.
-   **`setData(batches: Array)`**
    -   Sets the data for the thumbnails to be displayed. The `batches` argument should be an array of batch objects.
    -   Each batch object should have:
        -   `id`: (String) A unique identifier for the batch.
        -   `title`: (String) The display title for the batch header.
        -   `expanded`: (Boolean) Whether the batch is initially expanded.
        -   `files`: (Array) An array of file objects.
            -   Each file object should have:
                -   `name`: (String) The display name of the file/thumbnail.
                -   `type`: (String) The MIME type of the file (e.g., 'image/jpeg', 'application/pdf'). Used to determine if a placeholder is needed.
                -   `data`: (Optional, any) Can be used to store actual file data or a URL for image rendering (currently uses a placeholder if `data` is not a direct image source for non-TIFF images).
    -   Example batch structure provided in `setData` under Usage.
-   **`addPastedFiles(filesArray: Array, batchTitlePrefix?: string)`**
    -   (Deprecated, use `createNewBatch` instead)
    -   Adds an array of `File` objects as a new batch, typically from a paste operation.
-   **`createNewBatch(filesArray: Array, options?: object)`**
    -   Creates a new batch with the provided `File` objects (or file-like objects).
    -   `filesArray`: An array of `File` objects or objects with `name`, `type`, and `data` (which should be a `File` object for preview generation).
    -   `options` (optional object):
        -   `title` (string): Title for the new batch. Defaults to "New Batch - [timestamp]".
        -   `expanded` (boolean): Whether the batch is initially expanded. Defaults to `true`.
    -   Example: `panel.createNewBatch(myFileArray, { title: "My Uploads", expanded: false });`

## V. Events

Listen for these custom events dispatched by the component.

-   **`panel-opened`**
    -   Fired when the panel transitions to an open state.
    -   `event.detail`: `{ width: number }` (current width of the panel)
-   **`panel-closed`**
    -   Fired when the panel transitions to a closed state.
    -   `event.detail`: `{ width: number }` (width of the panel before closing, typically its configured width)
-   **`panel-resized`**
    -   Fired when the `panel-width` attribute is changed and the panel is currently open.
    -   `event.detail`: `{ width: number }` (the new width of the panel)
-   **`thumbnail-selected`**
    -   Fired when a thumbnail item is clicked.
    -   `event.detail`: `{ batch: object, file: object, batchIndex: number, fileIndex: number }`
-   **`image-removed`**
    -   Fired after an image's remove button is clicked and the image is processed for removal internally.
    -   `event.detail`: `{ file: object, batchIndex: number, fileIndex: number }`
-   **`batch-deleted`**
    -   Fired after a batch's delete button is clicked and the batch is processed for removal internally.
    -   `event.detail`: `{ batch: object, batchIndex: number }`
-   **`batch-toggled`**
    -   Fired when a batch header is clicked to expand or collapse it.
    -   `event.detail`: `{ batchIndex: number, expanded: boolean }`
-   **`images-pasted`**
    -   (Removed, covered by `batch-added` when files are processed from paste via `createNewBatch`)
-   **`batch-added`**
    -   Fired after a new batch is programmatically added (e.g., via `createNewBatch`).
    -   `event.detail`: `{ batch: object }` (the newly added batch object)

## VI. Slots

Use these to inject custom HTML content into the component.

-   **`slot="panel-title"`**
    -   Allows replacing the default "Thumbnails" text in the panel header.
    -   Example: `<thumbnail-pane><span slot="panel-title">My Image Bin</span></thumbnail-pane>`

## VII. CSS Custom Properties (for Skinning/Theming)

Override these CSS variables on the `<thumbnail-pane>` element or a parent element to customize its appearance.

-   `--thumbnail-panel-width`: Default `160px` (Controls host width, tied to `panel-width` attribute)
-   `--panel-bg`: Default `#111` (Panel background)
-   `--panel-border-color`: Default `#333` (Panel right border)
-   `--header-bg`: Default `#1a1a1a` (Header background)
-   `--header-border-color`: Default `#333` (Header bottom border)
-   `--header-text-color`: Default `#eee` (Header title text color)
-   `--close-btn-color`: Default `#aaa` (Close button icon color)
-   `--close-btn-hover-color`: Default `#ff0059` (Close button icon hover color)
-   `--scrollbar-thumb-color`: Default `rgba(255, 255, 255, 0.3)`
-   `--scrollbar-track-color`: Default `rgba(0, 0, 0, 0.2)`
-   `--scrollbar-thumb-border-color`: Default `rgba(0, 0, 0, 0.1)`
-   `--scrollbar-thumb-hover-color`: Default `rgba(255, 255, 255, 0.4)`
-   `--scrollbar-thumb-active-color`: Default `rgba(255, 255, 255, 0.5)`
-   `--handle-bg`: Default `#2c2c2c` (Toggle handle background)
-   `--handle-border-color`: Default `#444` (Toggle handle border)
-   `--handle-hover-bg`: Default `#3a3a3a` (Toggle handle hover background)
-   `--handle-arrow-color`: Default `rgba(255, 255, 255, 0.9)` (Toggle handle arrow icon)
-   `--batch-header-bg`: Default `linear-gradient(to bottom, #404050, #2a2a35)`
-   `--batch-header-text-color`: Default `#fff`
-   `--batch-header-hover-bg`: Default `linear-gradient(to bottom, #4a4a5a, #35353f)`
-   `--batch-count-text-color`: Default `#aaa`
-   `--batch-count-bg`: Default `rgba(0, 0, 0, 0.25)`
-   `--batch-indicator-color`: Default `#fff` (Collapse/expand arrow in batch header)
-   `--batch-delete-btn-color`: Default `#aaa`
-   `--batch-delete-btn-hover-color`: Default `#ff0059`
-   `--thumb-text-color`: Default `#ddd` (Thumbnail label text color)
-   `--thumb-border-active-color`: Default `#ff0059` (Active thumbnail border)
-   `--thumb-shadow-active-color`: Default `rgba(255,0,89,0.4)` (Active thumbnail box shadow)
-   `--thumb-img-bg`: Default `#000` (Background for the image area within a thumbnail)
-   `--thumb-label-bg`: Default `rgba(0,0,0,0.5)` (Thumbnail label background)
-   `--thumb-remove-btn-bg`: Default `rgba(0,0,0,0.5)` (Thumbnail remove button background)
-   `--thumb-remove-btn-color`: Default `#fff` (Thumbnail remove button icon color)
-   `--thumb-remove-btn-hover-bg`: Default `rgba(255,0,89,0.8)`
-   `--thumb-remove-btn-hover-color`: Default `#fff`

## VIII. CSS Parts (for Granular Styling)

Use the `::part()` pseudo-element to style specific internal elements from outside the Shadow DOM.

-   `part="panel-header"`: The main header container of the panel.
-   `part="close-button"`: The close button in the panel header.
-   `part="list-container"`: The scrollable container holding the batches and thumbnails.
-   `part="toggle-handle"`: The handle used to open/close the panel.

Example:
```css
thumbnail-pane::part(panel-header) {
  background-color: darkblue;
}

thumbnail-pane::part(toggle-handle) {
  width: 30px; /* Make the handle wider */
}
``` 