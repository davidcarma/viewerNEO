# Architecture

ViewerNEO is a **client-side**, **static-hosted** web application built with native ES modules and custom elements.

## Principles

- **Static + offline-friendly**: no backend; vendored dependencies for critical runtime features (PDF.js worker)
- **Small modules**: prefer composable modules over large scripts
- **Stable public APIs**: avoid reaching into private fields of web components (`_batches`, etc.)
- **Performance first**: redraws are throttled with `requestAnimationFrame`, avoid duplicate rendering work

## High-level data flow

1. **Input sources**
   - Drag & drop (images, folders, PDFs)
   - Clipboard paste (images)
   - Thumbnail selection

2. **Gallery**
   - The `<thumbnail-pane>` component owns batch state and emits events:
     - `thumbnail-selected`
     - `batch-added`, `batch-deleted`, `image-removed`

3. **Viewer**
   - `app/viewer-controller.js` coordinates:
     - window creation / focus
     - active canvas references
     - loading image entries (File / URL / TIFF decode)
   - Grid viewer interactions live in `grid_viewer_controls.js`.

4. **Rendering**
   - `grid_viewer_controls.js` owns the canvas redraw pipeline:
     - image draw
     - grid overlay (optional)
     - rulers/text overlays
   - Redraw is scheduled via `requestAnimationFrame` to avoid per-event repaint storms.

## Module boundaries

### App shell
- `index.html`
  - static markup
  - loads `app/main.js`

### Application modules
- `app/main.js`
  - bootstraps UI + modules
  - wires up theme select, DnD/paste, panel UI, and Grid Viewer button

- `app/viewer-controller.js`
  - single source of truth for “viewer state”
  - ensures the Grid Viewer window exists and canvas refs are connected
  - loads selected file entries (images, TIFF via UTIF)
  - provides a compatibility shim `window.handleThumbnailImage(...)`

- `app/dnd.js`
  - implements drag/drop and folder traversal
  - routes PDF files to `pdf-support.js`

- `app/paste.js`
  - clipboard image import into the panel

- `app/panel.js`
  - panel open/close + `WindowsManager` boundary syncing

- `app/toast.js`
  - toasts in a single place (avoids duplicated DOM/toast logic)

- `app/logger.js`
  - debug-gated logging (`localStorage.viewerneo_debug = "1"`)

### Components
- `ThumbnailGallery/thumbnail-pane.js`
  - `<thumbnail-pane>` Shadow DOM component
  - stable public APIs:
    - `createNewBatch(files, options)` → returns new batch
    - `getSelectedThumbnail()`
    - `getNewestFile()`
  - events:
    - `thumbnail-selected`
    - `batch-added`

### Window system
- `WindowsManager/window-system.js`
  - window lifecycle: create, drag, minimize/maximize
  - resize from **all corners/edges**
  - global bounds:
    - `setTopBarOffset(px)`
    - `setLeftBoundary(px)`

### PDF support
- `pdf-support.js`
  - uses **vendored** PDF.js (`lib/pdf.min.mjs` + `lib/pdf.worker.min.mjs`)
  - prompts for target render size
  - rasterizes to PNG files and adds as a new batch

### OpenCV
- `lib/opencv-manager.js`
  - async OpenCV lifecycle and reusable helpers

## Extension points

- Add new processing tools:
  - Prefer adding them under the Grid Viewer accordion in `grid_viewer_controls.js`
  - Use the “original image as source” pattern for non-compounding tools

- Add new import types:
  - Extend `app/dnd.js` (file type detection + routing)
  - Keep import side-effects (batch creation, toast) localized to the importer


