# TODO: Refactor Thumbnail Pane to Shadow DOM

This document outlines the steps to refactor the `thumbnail-pane` into a modular, skinnable Web Component using Shadow DOM. The goal is to create a reusable component that encapsulates its structure, styles, and behavior, while maintaining its interaction with IndexedDB and allowing for easy theming.

## I. Core Component Definition (`<thumbnail-pane>`)

-   [ ] **Define Custom Element**:
    -   [ ] Create a class `ThumbnailPane` extending `HTMLElement`.
    -   [ ] Register the custom element: `customElements.define('thumbnail-pane', ThumbnailPane);`.
-   [ ] **Initialize Shadow DOM**:
    -   [ ] In the `constructor` or `connectedCallback`, attach a shadow root (`this.attachShadow({ mode: 'open' })`).

## II. HTML Structure within Shadow DOM

-   [ ] **Create a `<template>`**:
    -   [ ] Define a `<template>` element to hold the internal HTML structure of the thumbnail pane. This will include:
        -   The main panel container.
        -   The header section (title, close button).
        -   The scrollable container for thumbnails (`#thumbnails-container`).
        -   The toggle/resize handle.
    -   [ ] Clone and append the template's content to the shadow root.
-   [ ] **Identify and Migrate Existing HTML**:
    -   [ ] Review `thumbnailPanel.js` (functions like `createBatchHeader`, `createBatchContent`, `createThumbnail`) to understand dynamic HTML generation.
    -   [ ] Adapt this logic to create and append elements within the Shadow DOM.
    -   [ ] Plan for dynamic content (batch headers, thumbnails) to be rendered inside the shadow root.
-   [ ] **Slots for Customization**:
    -   [ ] Define `<slot>` elements for parts of the component that might need external customization (e.g., panel title).
        -   Example: `<slot name="panel-title">Thumbnails</slot>` in the header.

## III. CSS Styling and Skinning

-   [ ] **Encapsulate Styles**:
    -   [ ] Move styles from `modular_version/css/components/thumbnail-panel.css` and `modular_version/css/components/thumbnail.css` into a `<style>` tag within the Shadow DOM template.
    -   [ ] Update selectors to target elements within the shadow root. Be mindful of IDs becoming local to the shadow DOM.
    -   [ ] Use `:host` pseudo-class for styling the component itself.
    -   [ ] `:host(.active)` for active panel state.
-   [ ] **CSS Custom Properties for Skinning**:
    -   [ ] Identify key style properties that should be customizable (e.g., background colors, accent colors, border colors, fonts, panel width).
    -   [ ] Define CSS Custom Properties (variables) within the component's default styles.
        -   Example: `:host { --panel-bg: #111; --accent-color: #ff0059; --thumb-border-active: var(--accent-color); width: var(--thumbnail-panel-width, 160px); }`
    -   [ ] Use these variables throughout the component's internal CSS.
        -   Example: `.thumbnail-item.active { border-color: var(--thumb-border-active); }`
    -   [ ] Document available custom properties for theming.
-   [ ] **Part Pseudo-element for Styling Internal Elements (Optional but Recommended)**:
    -   [ ] For more granular external styling control, expose key internal elements using the `part` attribute.
        -   Example: `<div class="thumbnail-header" part="panel-header">...</div>`
    -   [ ] Users can then style these from outside: `thumbnail-pane::part(panel-header) { background-color: blue; }`

## IV. JavaScript Logic and Interaction

-   [ ] **Migrate Core Logic**:
    -   [ ] Move the functionality from `modular_version/src/ui/panels/thumbnailPanel.js` into the `ThumbnailPane` class methods.
    -   [ ] This includes:
        -   Panel open/close/toggle logic.
        -   Thumbnail creation, rendering, and updating.
        -   Batch creation, expansion, and deletion.
        -   Image selection and highlighting.
        -   Remove image functionality.
        -   Resize handling.
-   [ ] **DOM Element References**:
    -   [ ] Update all `document.getElementById` or `document.querySelector` calls that target panel internals to use `this.shadowRoot.querySelector` or `this.shadowRoot.getElementById`.
-   [ ] **Event Handling**:
    -   [ ] Re-attach event listeners to elements within the Shadow DOM.
    -   [ ] Ensure event propagation and retargeting is handled correctly (events originating from Shadow DOM will be retargeted).
    -   [ ] Dispatch custom events from the component for significant actions (e.g., `thumbnail-selected`, `panel-opened`, `panel-closed`, `image-deleted`).
        -   Example: `this.dispatchEvent(new CustomEvent('thumbnail-selected', { detail: { batchIndex, fileIndex } }));`
-   [ ] **State Management and IndexedDB Interaction**:
    -   [ ] The component should continue to use the existing state management functions (`getState`, `setState` from `../../core/state.js`).
    -   [ ] Ensure that interactions with IndexedDB (likely via `state.js`) remain functional. The component will primarily react to state changes and dispatch events that might trigger state changes.
    -   [ ] Data fetching (e.g., `getAllFiles`) should still be managed by the core state logic. The component will receive this data, perhaps via a property or method.
-   [ ] **Public API**:
    -   [ ] Define public methods on the `ThumbnailPane` class for external interaction (e.g., `openPanel()`, `closePanel()`, `refreshThumbnails(newData)`, `selectThumbnail(id)`).
    -   [ ] Define public properties/attributes for configuration (e.g., `initial-width`, `allow-resize`).
-   [ ] **Cleanup**:
    -   [ ] Implement `disconnectedCallback` to clean up event listeners, Object URLs (`cleanupObjectUrls`), and any observers to prevent memory leaks when the component is removed from the DOM.

## V. Integration and Usage

-   [ ] **Refactor Host Pages**:
    -   [ ] Remove old thumbnail panel HTML, CSS links, and JavaScript initializations from pages where it's used.
    -   [ ] Add the new `<thumbnail-pane>` custom element to these pages.
-   [ ] **Provide Data to the Component**:
    -   [ ] Implement a mechanism to pass image/batch data to the component. This could be via a method (e.g., `thumbnailPaneElement.setData(batches)`) or a property.
-   [ ] **Listen to Component Events**:
    -   [ ] Update existing code to listen for custom events dispatched by the `<thumbnail-pane>` element to react to user interactions (e.g., image selection).

## VI. Testing

-   [ ] **Create a Test Page**:
    -   [ ] Build a new HTML page dedicated to testing the `<thumbnail-pane>` component in isolation.
    -   [ ] On this page, include controls to:
        -   Toggle the panel.
        -   Load different sets of sample data.
        -   Test different skinning options using CSS custom properties.
        -   Verify event dispatches.
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

-   Ensure drag and drop for reordering (if still a goal).
-   Keyboard navigation.
-   Contextual menus.
-   Different view modes (grid/list - if still a goal).
-   Memory management for large image collections (Object URL cleanup is a good start). 