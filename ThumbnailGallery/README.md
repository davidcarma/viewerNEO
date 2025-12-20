# Thumbnail Gallery (`<thumbnail-pane>`)

This directory contains the **Shadow DOM** web component used by ViewerNEO for managing image batches and thumbnails.

## Files

* `thumbnail-pane.js`: Defines the `<thumbnail-pane>` custom element. It owns batch state and emits events when thumbnails/batches change.

## Public API (stable)

- `createNewBatch(filesArray, options)` → creates a new batch and returns it
- `getSelectedThumbnail()` → returns selected file entry, or `null`
- `getNewestFile()` → returns newest file entry, or `null`
- `openPanel()`, `closePanel()`, `togglePanel()`, `getCurrentWidth()`

## Events

- `thumbnail-selected` (bubbles, composed)
- `batch-added`, `batch-deleted`, `image-removed`

## Notes

- Callers should **not** depend on internal fields like `_batches`.
- Rendering and selection styling is encapsulated in the component’s Shadow DOM.