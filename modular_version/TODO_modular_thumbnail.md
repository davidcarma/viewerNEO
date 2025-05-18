# TODO: Modular Thumbnail Panel

This document outlines the plan for converting the thumbnail panel into a reusable, modular component using Shadow DOM to encapsulate styling and functionality.

## Goals

- Create a single consistent implementation of the thumbnail panel
- Eliminate code duplication between index.html and projection.html
- Ensure styling consistency across all pages
- Improve maintainability by centralizing changes
- Use modern web component techniques with Shadow DOM for proper encapsulation

## Implementation Steps

### 1. Component Creation

- [ ] Create a `ThumbnailPanel` class that extends `HTMLElement`
- [ ] Define a shadow DOM for the component
- [ ] Move all thumbnail panel HTML structure into the component template
- [ ] Encapsulate all thumbnail styles within the shadow DOM
- [ ] Create public methods for common operations (open, close, refresh, etc.)
- [ ] Add custom events for important state changes

### 2. Data Handling

- [ ] Create a standardized data interface for passing image data to the component
- [ ] Implement data binding between the component and image database
- [ ] Support for filtering and sorting thumbnails
- [ ] Handle batch grouping internally in the component
- [ ] Create proper callbacks for selection changes

### 3. Integration

- [ ] Remove duplicate thumbnail code from index.html and projection.html
- [ ] Import the component in both pages
- [ ] Add configuration options for page-specific behaviors
- [ ] Make the component compatible with both the main viewer and projection page

### 4. Advanced Features

- [ ] Add drag and drop support for thumbnail reordering
- [ ] Support for keyboard navigation within thumbnails
- [ ] Add contextual menus for thumbnails
- [ ] Implement lazy loading for better performance with many thumbnails
- [ ] Support for different thumbnail view modes (grid, list, etc.)

## Example Usage

```javascript
// Initialize the component
const thumbnailPanel = document.createElement('thumbnail-panel');
thumbnailPanel.config = {
  containerWidth: 250,
  position: 'left',
  showCloseButton: true
};

// Add to page
document.body.appendChild(thumbnailPanel);

// Set data
thumbnailPanel.setImages(imageData);

// Listen for events
thumbnailPanel.addEventListener('selection-change', (e) => {
  console.log('Selected image:', e.detail.image);
});
```

## Shadow DOM Structure

```html
<template id="thumbnail-panel-template">
  <style>
    /* Encapsulated styles */
    :host {
      display: block;
      width: var(--thumbnail-panel-width, 250px);
      background: #333;
      /* Other styles */
    }
    /* Panel, thumbnails, batch headers, etc. */
  </style>
  
  <div class="thumbnail-header">
    <h3><slot name="title">Images</slot></h3>
    <button class="close-btn">×</button>
  </div>
  
  <div class="thumbnails-container">
    <!-- Thumbnails will be generated here -->
  </div>
  
  <div class="thumbnail-toggle-handle">
    <!-- Arrow icon -->
  </div>
</template>
```

## Benefits

1. **Consistency**: Single source of truth for thumbnail panel implementation
2. **Maintainability**: Bug fixes and improvements in one place
3. **Encapsulation**: Shadow DOM prevents style leakage
4. **Reusability**: Easy to add to any page in the application
5. **Performance**: Optimized rendering for thumbnails

## Technical Considerations

- Shadow DOM polyfills for older browsers if needed
- CSS variable pass-through for theming
- Proper cleanup of event listeners and observers
- Memory management for large image collections 