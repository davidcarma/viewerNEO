# TODO: Refactor Thumbnail Pane to Shadow DOM

This document outlines the steps to refactor the `thumbnail-pane` into a modular, skinnable Web Component using Shadow DOM. The goal is to create a reusable component that encapsulates its structure, styles, and behavior, while maintaining its interaction with IndexedDB and allowing for easy theming.

## I. Core Component Definition (`<thumbnail-pane>`)

-   [x] **Define Custom Element**:
    -   [x] Create a class `ThumbnailPane` extending `HTMLElement`.
    -   [x] Register the custom element: `customElements.define('thumbnail-pane', ThumbnailPane);`.
-   [x] **Initialize Shadow DOM**:
    -   [x] In the `constructor` or `connectedCallback`, attach a shadow root (`this.attachShadow({ mode: 'open' })`).

## II. HTML Structure within Shadow DOM

-   [x] **Create a `<template>`**:
    -   [x] Define a `<template>` element to hold the internal HTML structure of the thumbnail pane. This will include:
        -   [x] The main panel container.
        -   [x] The header section (title, close button).
        -   [x] The scrollable container for thumbnails (`#thumbnails-container`).
        -   [x] The toggle/resize handle.
    -   [x] Clone and append the template's content to the shadow root.
-   [x] **Identify and Migrate Existing HTML**:
    -   [x] Review `thumbnailPanel.js` (functions like `createBatchHeader`, `createBatchContent`, `createThumbnail`) to understand dynamic HTML generation.
    -   [x] Adapt this logic to create and append elements within the Shadow DOM. (Initial adaptation done for `_createBatchHeader`, `_createBatchContent`, `_createThumbnail`)
    -   [x] Plan for dynamic content (batch headers, thumbnails) to be rendered inside the shadow root. (Initial rendering in place with `_renderThumbnails`)
-   [x] **Slots for Customization**:
    -   [x] Define `<slot>` elements for parts of the component that might need external customization (e.g., panel title).
        -   Example: `<slot name="panel-title">Thumbnails</slot>` in the header. (Implemented)

## III. CSS Styling and Skinning

-   [x] **Encapsulate Styles**:
    -   [x] Move styles from `modular_version/css/components/thumbnail-panel.css` and `modular_version/css/components/thumbnail.css` into a `<style>` tag within the Shadow DOM template. (Initial transfer and adaptation done)
    -   [x] Update selectors to target elements within the shadow root. Be mindful of IDs becoming local to the shadow DOM. (Done for initial styles)
    -   [x] Use `:host` pseudo-class for styling the component itself. (Implemented)
    -   [x] `:host(.active)` for active panel state. (Implemented)
-   [x] **CSS Custom Properties for Skinning**:
    -   [x] Identify key style properties that should be customizable (e.g., background colors, accent colors, border colors, fonts, panel width).
    -   [x] Define CSS Custom Properties (variables) within the component's default styles. (Initial set implemented)
        -   Example: `:host { --panel-bg: #111; --accent-color: #ff0059; --thumb-border-active: var(--accent-color); width: var(--thumbnail-panel-width, 160px); }`
    -   [x] Use these variables throughout the component's internal CSS. (Implemented for several properties)
        -   Example: `.thumbnail-item.active { border-color: var(--thumb-border-active); }`
    -   [ ] Document available custom properties for theming.
-   [x] **Part Pseudo-element for Styling Internal Elements (Optional but Recommended)**:
    -   [x] For more granular external styling control, expose key internal elements using the `part` attribute. (Implemented for `panel-header`, `close-button`, `list-container`, `toggle-handle`)
        -   Example: `<div class="thumbnail-header" part="panel-header">...</div>`
    -   [ ] Users can then style these from outside: `thumbnail-pane::part(panel-header) { background-color: blue; }`

## IV. JavaScript Logic and Interaction

-   [x] **Migrate Core Logic**:
    -   [x] Move the functionality from `modular_version/src/ui/panels/thumbnailPanel.js` into the `ThumbnailPane` class methods.
    -   [x] This includes:
        -   [x] Panel open/close/toggle logic. (Implemented)
        -   [x] Thumbnail creation, rendering, and updating. (Initial methods `_createThumbnail`, `_renderThumbnails` created)
        -   [x] Batch creation, expansion, and deletion. (Initial methods `_createBatchHeader`, `_createBatchContent`, `_toggleBatchExpansion`, `_handleDeleteBatch` created)
        -   [x] Image selection and highlighting. (Initial `_handleSelectImage`, `_highlightSelectedThumbnail` created)
        -   [x] Remove image functionality. (Initial `_handleRemoveImage` created)
        -   [ ] Resize handling. (Basic `panel-width` attribute handling, full drag-resize TODO)
-   [x] **DOM Element References**:
    -   [x] Update all `document.getElementById` or `document.querySelector` calls that target panel internals to use `this.shadowRoot.querySelector` or `this.shadowRoot.getElementById`. (Done for current logic)
-   [x] **Event Handling**:
    -   [x] Re-attach event listeners to elements within the Shadow DOM. (Done for close, toggle, batch, thumbnail interactions)
    -   [x] Ensure event propagation and retargeting is handled correctly (events originating from Shadow DOM will be retargeted). (Using `bubbles: true, composed: true` for custom events)
    -   [x] Dispatch custom events from the component for significant actions (e.g., `thumbnail-selected`, `panel-opened`, `panel-closed`, `image-deleted`). (Implemented for panel open/close, selection, removal, toggle)
        -   Example: `this.dispatchEvent(new CustomEvent('thumbnail-selected', { detail: { batchIndex, fileIndex } }));`
-   [ ] **State Management and IndexedDB Interaction**:
    -   [ ] The component should continue to use the existing state management functions (`getState`, `setState` from `../../core/state.js`). (TODO: Integrate with external state.js)
    -   [ ] Ensure that interactions with IndexedDB (likely via `state.js`) remain functional. The component will primarily react to state changes and dispatch events that might trigger state changes.
    -   [ ] Data fetching (e.g., `getAllFiles`) should still be managed by the core state logic. The component will receive this data, perhaps via a property or method. (Current `setData` is a placeholder)
-   [x] **Public API**:
    -   [x] Define public methods on the `ThumbnailPane` class for external interaction (e.g., `openPanel()`, `closePanel()`, `togglePanel()`, `setData()`, `getCurrentWidth()`). (Implemented)
    -   [x] Define public properties/attributes for configuration (e.g., `initial-width`, `allow-resize`). (`opened`, `panel-width` attributes handled)
-   [ ] **Cleanup**:
    -   [ ] Implement `disconnectedCallback` to clean up event listeners, Object URLs (`cleanupObjectUrls`), and any observers to prevent memory leaks when the component is removed from the DOM. (Basic `disconnectedCallback` present, Object URL cleanup TODO)

## V. Integration and Usage

-   [x] **Refactor Host Pages**:
    -   [ ] Remove old thumbnail panel HTML, CSS links, and JavaScript initializations from pages where it's used.
    -   [x] Add the new `<thumbnail-pane>` custom element to these pages. (Done for `index.html` test page)
-   [x] **Provide Data to the Component**:
    -   [x] Implement a mechanism to pass image/batch data to the component. This could be via a method (e.g., `thumbnailPaneElement.setData(batches)`) or a property. (Basic `setData` method created)
-   [x] **Listen to Component Events**:
    -   [x] Update existing code to listen for custom events dispatched by the `<thumbnail-pane>` element to react to user interactions (e.g., image selection). (Basic listeners in `index.html` for `panel-opened`, `panel-closed`)

## VI. Testing

-   [x] **Create a Test Page**:
    -   [x] Build a new HTML page dedicated to testing the `<thumbnail-pane>` component in isolation. (Created `shadow-dom-tests/index.html`)
    -   [ ] On this page, include controls to:
        -   [x] Toggle the panel. (Can be done via `panel.togglePanel()` in console; UI button TODO)
        -   [ ] Load different sets of sample data.
        -   [ ] Test different skinning options using CSS custom properties.
        -   [ ] Verify event dispatches.
-   [ ] **Manual Testing**:
    -   [ ] Test all functionalities: panel open/close, toggle, resize.
    -   [ ] Test thumbnail rendering, selection, deletion.
    -   [ ] Test batch expansion, deletion.
    -   [ ] Test lazy loading of images.
    -   [ ] Test responsiveness and different screen sizes.
    -   [ ] Verify skinning works as expected.
    -   [ ] Check for console errors or warnings.
    -   [ ] Test in different browsers (if applicable).

## VII. Documentation

-   [ ] **Update `TODO_modular_thumbnail.md`** (or deprecate if this file supersedes it).
-   [ ] Document the public API of the `<thumbnail-pane>` component (methods, properties, attributes, events).
-   [ ] Document available CSS Custom Properties and `::part()`s for styling/skinning.
-   [ ] Provide examples of how to use and configure the component.

## Key Considerations from Original `TODO_modular_thumbnail.md` to Incorporate:

-   [ ] Ensure drag and drop for reordering (if still a goal).
-   [ ] Keyboard navigation.
-   [ ] Contextual menus.
-   [ ] Different view modes (grid/list - if still a goal).
-   [ ] Memory management for large image collections (Object URL cleanup is a good start). 