# ViewerNeo (ViewerNEO)

Client-side image/PDF viewer with a modern UI, a draggable window system, thumbnail batch gallery, and a Grid Viewer with analysis/processing tools.

## Key properties

- **100% client-side**: runs in the browser; **no backend required**
- **Static hosting friendly**: works from any static server
- **Offline-ready**: PDF rendering is vendored (no CDN at runtime)
- **ES modules**: code is organized into small modules under `app/`

## Features

- **Dark / Light / System** theme toggle (persists via `localStorage`)
- **Thumbnail batches**: drag/drop files and folders, paste from clipboard
- **PDF drop**: rasterize PDF pages to images at a chosen target resolution
- **Grid Viewer** (windowed):
  - zoom/pan + rulers/grid overlay
  - adaptive threshold (OpenCV.js)
  - resize-and-save presets (height-based, maintains aspect ratio)
  - soften/sharpen enhancements
  - save processed images to a new batch
- **Window system**: draggable, minimize/maximize, resize from all corners/edges

## Run locally (static)

Because this app uses ES Modules and a PDF worker, you should serve it over HTTP rather than opening `index.html` via `file://`.

Examples:

```bash
cd viewerNEO
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Repo layout

- `index.html`: app shell (minimal logic)
- `app/`: application modules
  - `app/main.js`: app bootstrap
  - `app/viewer-controller.js`: viewer/window coordination
  - `app/dnd.js`: drag & drop (images + PDFs)
  - `app/paste.js`: clipboard paste
  - `app/panel.js`: thumbnail panel open/close + boundary syncing
  - `app/toast.js`: toasts
  - `app/logger.js`: structured logging
- `ThumbnailGallery/thumbnail-pane.js`: `<thumbnail-pane>` web component
- `WindowsManager/window-system.js`: draggable/resizable windows
- `grid_viewer_controls.js`: Grid Viewer window + processing actions
- `lib/`:
  - `opencv.js`, `opencv-manager.js`
  - `tiff.js`
  - **vendored** `pdf.min.mjs`, `pdf.worker.min.mjs`

## Debugging

- **Enable debug logs**:
  - Set `localStorage.viewerneo_debug = "1"` in DevTools.
  - Set it back to `"0"` to disable.

## Documentation

- `docs/ARCHITECTURE.md`: module boundaries + data flow
- `CONTRIBUTING.md`: code standards / patterns


