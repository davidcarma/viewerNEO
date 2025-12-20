# Contributing

This repo is intended to be a **high-quality sample** for client-side, statically hosted apps. Please keep changes modular, stable, and easy to reason about.

## Ground rules

- **No backend assumptions**: everything runs in-browser.
- **Static hosting compatible**: no build step required; use native ES modules.
- **No runtime CDNs**: any critical dependency should be vendored under `lib/`.
- **Prefer stable APIs**: do not reach into private fields like `_batches` or rely on DOM internals.

## Project conventions

### Structure

- Keep app orchestration in `app/`.
- Keep reusable UI logic in small modules (`app/dnd.js`, `app/toast.js`, etc.).
- Keep web components encapsulated (Shadow DOM, clear events, clear public methods).

### Logging

- Use `app/logger.js`:
  - `logger.debug()` and `logger.info()` are gated behind `localStorage.viewerneo_debug = "1"`
  - `logger.warn()` and `logger.error()` are always allowed (sparingly)
- Avoid noisy logs in hot paths (mousemove, render loops).

### Errors and user feedback

- Catch errors at module boundaries and show a toast when user action fails.
- Prefer actionable messages: what failed + what the user can do next.

### Performance

- Avoid per-event heavy work; schedule redraws with `requestAnimationFrame`.
- Don’t double-render overlays. `redrawCanvas()` should own the full render pass.
- Be mindful of layout thrash:
  - avoid repeated `getBoundingClientRect()` in loops when possible

### UI / Styling

- Prefer CSS variables from `app.css` tokens.
- Keep inline styles limited to truly dynamic sizing; otherwise use classes.

## How to test changes

1. Serve locally (needed for ES modules + workers):

```bash
python3 -m http.server 8080
```

2. Manual checks:
- Drag/drop images + folders
- Drag/drop PDF → prompt → render → batch created → first page loads
- Open Grid Viewer → zoom/pan + grid/rulers
- Resize windows from all corners
- Save-to-batch, Resize & Save, Soften/Sharpen


