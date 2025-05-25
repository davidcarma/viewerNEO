class ThumbnailPane extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._panelWidth = 160; // Default width, will be configurable
        this._isPanelActive = false;
        this._objectUrls = new Set(); // To track created object URLs for revocation

        this._template = document.createElement('template');
        this._template.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: absolute; 
                    top: 0;
                    bottom: 0;
                    left: 0;
                    width: var(--thumbnail-panel-width, ${this._panelWidth}px);
                    background: var(--panel-bg, #111);
                    border-right: 1px solid var(--panel-border-color, #333);
                    transform: translateX(-100%);
                    transition: transform 0.25s ease;
                    display: flex;
                    flex-direction: column;
                    overflow: visible; /* CRITICAL: Allow handle to be visible outside host bounds */
                    z-index: 90;
                    will-change: transform;
                }

                :host(.active) {
                    transform: translateX(0);
                    /* overflow: hidden; If re-enabled, handle will be clipped when host is not active */
                }

                #panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 10px;
                    background-color: var(--header-bg, #1a1a1a);
                    border-bottom: 1px solid var(--header-border-color, #333);
                    min-height: 30px;
                    flex-shrink: 0;
                }

                #panel-header h3 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--header-text-color, #eee);
                }

                #close-panel-button {
                    background: none;
                    border: none;
                    color: var(--close-btn-color, #aaa);
                    cursor: pointer;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.6;
                    transition: opacity 0.2s ease, color 0.2s ease;
                    padding: 2px;
                }

                #close-panel-button:hover {
                    color: var(--close-btn-hover-color, #ff0059);
                    opacity: 1;
                }

                #close-panel-button svg {
                    width: 14px;
                    height: 14px;
                    stroke-width: 1.5;
                }
                
                #thumbnails-list-container {
                    flex: 1;
                    overflow-y: auto; /* Changed from scroll to auto */
                    /* height: 100%; */ /* Already flex:1 */
                    /* max-height: calc(100vh - 46px); */ /* Handled by flex */
                    padding: 4px 0;
                    box-sizing: border-box;
                    position: relative;
                    overscroll-behavior: contain;
                    scroll-behavior: auto;
                    
                    /* For Firefox */
                    scrollbar-width: thin;
                    scrollbar-color: var(--scrollbar-thumb-color, rgba(255, 255, 255, 0.3)) var(--scrollbar-track-color, rgba(0, 0, 0, 0.2));
                }

                #thumbnails-list-container::-webkit-scrollbar {
                    width: 10px;
                    background-color: var(--scrollbar-track-color, rgba(0, 0, 0, 0.2));
                }

                #thumbnails-list-container::-webkit-scrollbar-track {
                    background-color: var(--scrollbar-track-color, rgba(0, 0, 0, 0.2));
                    border-radius: 4px;
                    margin: 4px 0;
                }

                #thumbnails-list-container::-webkit-scrollbar-thumb {
                    background-color: var(--scrollbar-thumb-color, rgba(255, 255, 255, 0.3));
                    border-radius: 4px;
                    border: 1px solid var(--scrollbar-thumb-border-color, rgba(0, 0, 0, 0.1));
                    transition: background-color 0.3s ease;
                }

                #thumbnails-list-container::-webkit-scrollbar-thumb:hover {
                    background-color: var(--scrollbar-thumb-hover-color, rgba(255, 255, 255, 0.4));
                }

                #thumbnails-list-container::-webkit-scrollbar-thumb:active {
                    background-color: var(--scrollbar-thumb-active-color, rgba(255, 255, 255, 0.5));
                }
                 
                /* Fade effect at the top and bottom of scrollable area */
                #thumbnails-list-container::before,
                #thumbnails-list-container::after {
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 15px;
                    pointer-events: none;
                    z-index: 5;
                }

                #thumbnails-list-container::before {
                    top: 0;
                    background: linear-gradient(to bottom, var(--panel-bg, rgba(17, 17, 17, 1)) 0%, rgba(17, 17, 17, 0) 100%);
                }

                #thumbnails-list-container::after {
                    bottom: 0;
                    background: linear-gradient(to top, var(--panel-bg, rgba(17, 17, 17, 1)) 0%, rgba(17, 17, 17, 0) 100%);
                }

                #toggle-handle {
                    position: absolute; 
                    left: 100%; /* Always at the right edge of the host container */
                    top: 50%;
                    transform: translateY(-50%); /* Vertical centering */
                    width: 22px;
                    height: 44px;
                    background-color: var(--handle-bg, #2c2c2c);
                    border-radius: 0 4px 4px 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                    z-index: 95; 
                    border: 1px solid var(--handle-border-color, #444);
                    border-left: none;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    /* Transition for left is not needed as it's fixed relative to host */
                    /* The host's transform transition handles the perceived movement */
                    transition: background-color 0.2s ease, opacity 0.2s ease;
                    opacity: 0.95;
                }
                
                /* Remove redundant positioning blocks for :host(:not(.active)) and :host(.active) for #toggle-handle */

                #toggle-handle:hover {
                    opacity: 1;
                    background-color: var(--handle-hover-bg, #3a3a3a);
                }

                #toggle-handle::before { /* Arrow indicator */
                    content: "";
                    position: absolute;
                    width: 0; 
                    height: 0; 
                    border-top: 6px solid transparent;
                    border-bottom: 6px solid transparent;
                    border-left: 6px solid var(--handle-arrow-color, rgba(255, 255, 255, 0.9));
                    transform: translateX(2px); /* Adjust for centering */
                    transition: transform 0.25s ease;
                }

                /* When panel is open (host.active), flip the arrow and change title */
                :host(.active) #toggle-handle::before {
                    transform: translateX(-2px) rotate(180deg);
                }
                
                /* Styles for batch headers */
                .batch-header {
                    cursor: pointer;
                    background: var(--batch-header-bg, linear-gradient(to bottom, #404050, #2a2a35));
                    margin: 10px 4px 5px 4px; /* Adjusted margin for panel padding */
                    padding: 8px 5px;
                    border-radius: 5px;
                    color: var(--batch-header-text-color, #fff);
                    font-size: 13px;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                    position: sticky;
                    top: 0;
                    z-index: 50;
                    user-select: none;
                    transition: background-color 0.2s ease;
                    min-height: 22px;
                }

                .batch-header:hover {
                    background: var(--batch-header-hover-bg, linear-gradient(to bottom, #4a4a5a, #35353f));
                }

                .batch-header .batch-title {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-right: 5px;
                    min-width: 60px; /* Ensure title has some space */
                    font-size: 12px;
                }

                .batch-header .batch-count {
                    font-size: 11px;
                    color: var(--batch-count-text-color, #aaa);
                    padding: 1px 4px;
                    background: var(--batch-count-bg, rgba(0, 0, 0, 0.25));
                    border-radius: 10px;
                    min-width: 16px;
                    text-align: center;
                    margin-left: auto; /* Pushes to the right before other fixed elements */
                    flex-shrink: 0;
                }

                .batch-header .collapse-indicator {
                    width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s ease;
                    flex-shrink: 0;
                    margin-left: 3px;
                }

                .batch-header .collapse-indicator::before {
                    content: '';
                    width: 0;
                    height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 6px solid var(--batch-indicator-color, #fff);
                    display: block;
                }

                .batch-header.collapsed .collapse-indicator::before {
                    transform: rotate(-90deg);
                }

                .batch-delete-btn {
                    background: none;
                    border: none;
                    color: var(--batch-delete-btn-color, #aaa);
                    cursor: pointer;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.6;
                    transition: opacity 0.2s ease, color 0.2s ease;
                    margin-left: 5px; /* Space from count */
                    flex-shrink: 0;
                }

                .batch-delete-btn:hover {
                    color: var(--batch-delete-btn-hover-color, #ff0059);
                    opacity: 1;
                }

                .batch-delete-btn svg {
                    width: 14px;
                    height: 14px;
                }
                
                .batch-content {
                    overflow: visible; /* Can be hidden by parent if needed */
                    transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease, margin 0.3s ease;
                    height: auto;
                    opacity: 1;
                    position: relative;
                    padding-top: 5px;
                    z-index: 5; /* Below batch header */
                }

                .batch-content.collapsed {
                    max-height: 0 !important; /* Ensure it collapses */
                    opacity: 0;
                    overflow: hidden;
                    margin-top: 0;
                    margin-bottom: 0;
                    padding-top: 0;
                    padding-bottom: 0;
                }

                /* Thumbnail Item Styles */
                .thumbnail-item {
                    display: block;
                    margin: 12px auto;
                    width: calc(100% - 20px); /* Responsive to panel width, with padding */
                    max-width: 130px; /* Max width from original */
                    cursor: pointer;
                    border: 2px solid transparent;
                    border-radius: 8px;
                    overflow: hidden;
                    font-size: 11px;
                    color: var(--thumb-text-color, #ddd);
                    position: relative;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    box-sizing: border-box;
                    user-select: none;
                    z-index: 10;
                }

                .thumbnail-item.active {
                    border-color: var(--thumb-border-active-color, #ff0059);
                    box-shadow: 0 0 8px var(--thumb-shadow-active-color, rgba(255,0,89,0.4));
                }

                .thumbnail-item:not(.active):hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }

                .thumbnail-item img {
                    width: 100%;
                    height: 80px;
                    display: block;
                    object-fit: contain;
                    background-color: var(--thumb-img-bg, #000);
                }

                .thumbnail-item .label {
                    padding: 5px;
                    width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-align: center;
                    background-color: var(--thumb-label-bg, rgba(0,0,0,0.5));
                    height: 22px; /* Fixed height */
                    box-sizing: border-box;
                    font-size: 10px; /* Slightly smaller */
                    line-height: 12px; /* Adjust for smaller font */
                }

                .thumbnail-remove-btn {
                    position: absolute;
                    top: 3px;
                    right: 3px;
                    background: var(--thumb-remove-btn-bg, rgba(0,0,0,0.5));
                    border: none;
                    color: var(--thumb-remove-btn-color, #fff);
                    cursor: pointer;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s ease, background-color 0.2s ease;
                    z-index: 15; /* Above image */
                }

                .thumbnail-item:hover .thumbnail-remove-btn {
                    opacity: 1;
                }

                .thumbnail-remove-btn:hover {
                    background: var(--thumb-remove-btn-hover-bg, rgba(255,0,89,0.8));
                    color: var(--thumb-remove-btn-hover-color, #fff);
                }

                .thumbnail-remove-btn svg {
                    width: 10px;
                    height: 10px;
                    stroke-width: 2;
                }
                
                .empty-thumbnail-state {
                    text-align: center;
                    padding: 20px;
                    color: #777;
                    font-style: italic;
                }

            </style>
            <div id="panel-header" part="panel-header">
                <h3><slot name="panel-title">Thumbnails</slot></h3>
                <button id="close-panel-button" part="close-button" title="Close panel">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div id="thumbnails-list-container" part="list-container">
                <!-- Batches and thumbnails will be rendered here -->
            </div>
            <div id="toggle-handle" part="toggle-handle" title="Show thumbnails">
                <!-- Arrow is ::before pseudo-element -->
            </div>
        `;
        this.shadowRoot.appendChild(this._template.content.cloneNode(true));

        // Element references
        this._closeButton = this.shadowRoot.getElementById('close-panel-button');
        this._toggleHandle = this.shadowRoot.getElementById('toggle-handle');
        this._thumbnailListContainer = this.shadowRoot.getElementById('thumbnails-list-container');
    }

    connectedCallback() {
        this._closeButton.addEventListener('click', () => this.closePanel());
        this._toggleHandle.addEventListener('click', () => this.togglePanel());

        // Set initial state if specified by attribute
        if (this.hasAttribute('opened') && this.getAttribute('opened') !== 'false') {
            this.openPanel();
        } else {
            this._updateHandleTitle();
        }
    }

    disconnectedCallback() {
        this._revokeAllObjectUrls(); // Revoke any remaining URLs
    }

    // --- Public API Methods ---
    openPanel() {
        if (this._isPanelActive) return;
        this.classList.add('active');
        this._isPanelActive = true;
        this.setAttribute('opened', '');
        this._updateHandleTitle();
        this.dispatchEvent(new CustomEvent('panel-opened', { bubbles: true, composed: true, detail: { width: this._panelWidth } }));
    }

    closePanel() {
        if (!this._isPanelActive) return;
        this.classList.remove('active');
        this._isPanelActive = false;
        this.removeAttribute('opened');
        this._updateHandleTitle();
        this.dispatchEvent(new CustomEvent('panel-closed', { bubbles: true, composed: true, detail: { width: this._panelWidth } }));
    }

    togglePanel() {
        if (this._isPanelActive) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }
    
    getCurrentWidth() {
        return this._isPanelActive ? this._panelWidth : 0;
    }

    _updateHandleTitle() {
        if (this._isPanelActive) {
            this._toggleHandle.setAttribute('title', 'Hide thumbnails');
        } else {
            this._toggleHandle.setAttribute('title', 'Show thumbnails');
        }
    }

    // --- Data Handling (Placeholder - will be expanded) ---
    setData(batches = []) {
        this._revokeAllObjectUrls(); // Revoke old URLs before setting new data
        this._batches = batches; // Store data internally
        this._renderThumbnails();
    }

    /**
     * Creates a new batch with the provided files.
     * @param {File[]} filesArray - An array of File objects (or objects with `name`, `type`, `data` properties).
     * @param {object} options - Optional parameters for the new batch.
     * @param {string} [options.title] - A title for the new batch. Defaults to "New Batch - [timestamp]".
     * @param {boolean} [options.expanded] - Whether the new batch should be expanded. Defaults to true.
     */
    createNewBatch(filesArray, options = {}) {
        if (!filesArray || filesArray.length === 0) {
            console.log('No files provided to createNewBatch.');
            return;
        }
        const batchTitle = options.title || `New Batch - ${new Date().toLocaleTimeString()}`;
        const expanded = options.expanded === undefined ? true : options.expanded;

        this._addFilesAsNewBatch(filesArray, batchTitle, expanded);
    }

    // --- Rendering Logic (Placeholder - will be expanded) ---
    _renderThumbnails() {
        this._revokeAllObjectUrls(); // Ensure any existing object URLs from previous renders are cleaned up
        this._thumbnailListContainer.innerHTML = ''; // Clear existing

        if (!this._batches || this._batches.length === 0) {
            this._thumbnailListContainer.innerHTML = `<div class="empty-thumbnail-state">No images loaded</div>`;
            return;
        }

        this._batches.forEach((batch, batchIndex) => {
            const batchHeader = this._createBatchHeader(batch, batchIndex);
            const batchContent = this._createBatchContent(batch, batchIndex);
            this._thumbnailListContainer.appendChild(batchHeader);
            this._thumbnailListContainer.appendChild(batchContent);
        });
    }

    _createBatchHeader(batch, batchIndex) {
        const header = document.createElement('div');
        header.className = 'batch-header';
        if (!batch.expanded) {
            header.classList.add('collapsed');
        }
        header.dataset.batchId = batch.id;
        header.dataset.batchIndex = batchIndex;

        const title = document.createElement('span');
        title.className = 'batch-title';
        const batchNumberMatch = batch.title.match(/^(Batch \d+)/);
        title.textContent = batchNumberMatch ? batchNumberMatch[1] : batch.title;
        title.title = batch.title; // Full title as tooltip
        header.appendChild(title);

        const count = document.createElement('span');
        count.className = 'batch-count';
        count.textContent = batch.files.length;
        header.appendChild(count);
        
        // Delete button for batch
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'batch-delete-btn';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        deleteBtn.title = 'Delete batch';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._handleDeleteBatch(batchIndex);
        });
        header.appendChild(deleteBtn);

        const indicator = document.createElement('span');
        indicator.className = 'collapse-indicator';
        header.appendChild(indicator);

        header.addEventListener('click', () => this._toggleBatchExpansion(batchIndex));
        return header;
    }

    _createBatchContent(batch, batchIndex) {
        const content = document.createElement('div');
        content.className = 'batch-content';
        content.dataset.batchId = batch.id;
        if (!batch.expanded) {
            content.classList.add('collapsed');
        }

        batch.files.forEach((file, fileIndex) => {
            const thumbnailItem = this._createThumbnail(file, batch, batchIndex, fileIndex);
            content.appendChild(thumbnailItem);
        });
        return content;
    }

    _createThumbnail(file, batch, batchIndex, fileIndex) {
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.dataset.batchIndex = batchIndex;
        item.dataset.fileIndex = fileIndex;

        const imgEl = document.createElement('img');
        imgEl.alt = file.name;
        imgEl.loading = 'lazy';
        
        // Check if file.data is a File object for Object URL creation
        if (file.data instanceof File && file.data.type.startsWith('image/') && !/\.(tiff?|jp2)$/i.test(file.name.toLowerCase())) {
            const objectUrl = URL.createObjectURL(file.data);
            imgEl.src = objectUrl;
            item.dataset.objectUrl = objectUrl; // Store for revocation
            this._objectUrls.add(objectUrl); // Track for cleanup
        } else if (typeof file.data === 'string' && file.data.startsWith('blob:')) { // Already an object URL probably from external source
            imgEl.src = file.data;
            item.dataset.objectUrl = file.data; // Assume we should track it if provided this way
            this._objectUrls.add(file.data);
        } else if (file.type.startsWith('image/') && !/\.(tiff?|jp2)$/i.test(file.name.toLowerCase())) {
            // Original placeholder for image types if no File object
            imgEl.src = file.data || `https://via.placeholder.com/130x80.png?text=${encodeURIComponent(file.name)}`; 
        } else if (/\.(tiff?)$/i.test(file.name.toLowerCase()) && typeof UTIF !== 'undefined') {
            // Handle TIFF files using UTIF for thumbnail
            imgEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxRDIwMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2FlYWVhZSIgZm9udC1zaXplPSIxMnB4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+TG9hZGluZyBUUEZGIHByZXZpZXcuLi48L3RleHQ+PC9zdmc+'; // Placeholder while loading
            this._generateTiffThumbnail(file.data, imgEl);
        } else {
            // SVG placeholder for non-images or other unhandled types (like JP2)
            imgEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxMTExMTEiLz48cGF0aCBkPSJNMzUgMjVINjVDNjguMyAyNSA3MSAyNy43IDcxIDMxVjY5QzcxIDcyLjMgNjguMyA3NSA2NSA3NUgzNUMzMS43IDc1IDI5IDcyLjMgMjkgNjlWMzFDMjkgMjcuNyAzMS43IDI1IDM1IDI1WiIgc3Ryb2tlPSIjNTU1IiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI1IiBmaWxsPSIjNTU1Ii8+PHBhdGggZD0iTTMwIDYwTDQwIDUwTDUwIDYwTDYwIDUwTDcwIDYwVjcwSDMwVjYwWiIgZmlsbD0iIzU1NSIvPjwvc3ZnPg==';
        }
        item.appendChild(imgEl);

        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = file.name;
        item.appendChild(label);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'thumbnail-remove-btn';
        removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        removeBtn.title = 'Delete image';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._handleRemoveImage(batchIndex, fileIndex);
        });
        item.appendChild(removeBtn);
        
        item.addEventListener('click', () => this._handleSelectImage(batchIndex, fileIndex));
        
        return item;
    }

    _toggleBatchExpansion(batchIndex) {
        if (!this._batches || !this._batches[batchIndex]) return;

        this._batches[batchIndex].expanded = !this._batches[batchIndex].expanded;
        
        // Re-render (simple approach for now, could be more targeted)
        // this._renderThumbnails(); 
        // More targeted update:
        const header = this.shadowRoot.querySelector(`.batch-header[data-batch-index="${batchIndex}"]`);
        const content = this.shadowRoot.querySelector(`.batch-content[data-batch-id="${this._batches[batchIndex].id}"]`);
        if (header && content) {
            if (this._batches[batchIndex].expanded) {
                header.classList.remove('collapsed');
                content.classList.remove('collapsed');
            } else {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
            }
        }
        this.dispatchEvent(new CustomEvent('batch-toggled', { detail: { batchIndex, expanded: this._batches[batchIndex].expanded } }));
    }

    async _generateTiffThumbnail(fileData, imgEl) {
        if (!(fileData instanceof File)) {
            console.error('TIFF thumbnail generation requires a File object.');
            imgEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxRDIwMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2FlYWVhZSIgZm9udC1zaXplPSIxMnB4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+RWFpbGVkOiBUUEZGIHByZXZpZXcuLi48L3RleHQ+PC9zdmc+';
            return;
        }
        try {
            const buffer = await fileData.arrayBuffer();
            const ifds = UTIF.decode(buffer);
            if (!ifds || ifds.length === 0) throw new Error('No TIFF pages found');
            
            const page = ifds[0]; // Use first page
            UTIF.decodeImage(buffer, page, ifds);
            
            if (!page.data) throw new Error('Failed to decode TIFF image data');

            // Create canvas from decoded TIFF data
            const canvas = document.createElement('canvas');
            canvas.width = page.width;
            canvas.height = page.height;
            const ctx = canvas.getContext('2d');
            
            // Convert TIFF data to ImageData
            const rgba = UTIF.toRGBA8(page);
            const imageData = new ImageData(new Uint8ClampedArray(rgba), page.width, page.height);
            ctx.putImageData(imageData, 0, 0);

            // Resize to thumbnail dimensions (e.g., 130x80)
            const thumbCanvas = document.createElement('canvas');
            const thumbCtx = thumbCanvas.getContext('2d');
            const targetWidth = 130;
            const targetHeight = 80;
            thumbCanvas.width = targetWidth;
            thumbCanvas.height = targetHeight;

            // Calculate aspect ratios
            const sourceWidth = canvas.width;
            const sourceHeight = canvas.height;
            const sourceRatio = sourceWidth / sourceHeight;
            const targetRatio = targetWidth / targetHeight;
            let drawWidth, drawHeight, drawX, drawY;

            if (sourceRatio > targetRatio) { // Source is wider than target
                drawHeight = targetHeight;
                drawWidth = drawHeight * sourceRatio;
                drawX = (targetWidth - drawWidth) / 2;
                drawY = 0;
            } else { // Source is taller or same aspect ratio
                drawWidth = targetWidth;
                drawHeight = drawWidth / sourceRatio;
                drawX = 0;
                drawY = (targetHeight - drawHeight) / 2;
            }

            thumbCtx.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);
            imgEl.src = thumbCanvas.toDataURL();

        } catch (error) {
            console.error('Error generating TIFF thumbnail:', error);
            // Fallback to a generic error SVG or the existing SVG placeholder
            imgEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxRDIwMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2FlYWVhZSIgZm9udC1zaXplPSIxMnB4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+RWFpbGVkOiBUUEZGIHByZXZpZXcuLi48L3RleHQ+PC9zdmc+';
        }
    }

    _handleSelectImage(batchIndex, fileIndex) {
        // Placeholder: update internal state and highlight, then dispatch event
        console.log(`Selected image: Batch ${batchIndex}, File ${fileIndex}`);
        this._highlightSelectedThumbnail(batchIndex, fileIndex);
        this.dispatchEvent(new CustomEvent('thumbnail-selected', {
            bubbles: true, 
            composed: true, 
            detail: { batch: this._batches[batchIndex], file: this._batches[batchIndex].files[fileIndex], batchIndex, fileIndex }
        }));
    }
    
    _highlightSelectedThumbnail(selectedBatchIndex, selectedFileIndex) {
        this.shadowRoot.querySelectorAll('.thumbnail-item.active').forEach(activeItem => {
            activeItem.classList.remove('active');
        });
        const newActiveItem = this.shadowRoot.querySelector(
            `.thumbnail-item[data-batch-index="${selectedBatchIndex}"][data-file-index="${selectedFileIndex}"]`
        );
        if (newActiveItem) {
            newActiveItem.classList.add('active');
            newActiveItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    _handleRemoveImage(batchIndex, fileIndex) {
        // Placeholder: remove from internal state, re-render, dispatch event
        const fileToRemove = this._batches[batchIndex].files[fileIndex];
        console.log(`Removing image: ${fileToRemove.name}`);
        
        this._batches[batchIndex].files.splice(fileIndex, 1);
        
        // If batch becomes empty, optionally remove batch or handle display
        if (this._batches[batchIndex].files.length === 0) {
            // Decide if to auto-delete batch or leave it empty
            // For now, let's re-render and it will show 0 files.
        }
        this._renderThumbnails(); // Re-render the list

        this.dispatchEvent(new CustomEvent('image-removed', {
            bubbles: true, 
            composed: true, 
            detail: { file: fileToRemove, batchIndex, fileIndex }
        }));
    }

    _handleDeleteBatch(batchIndex) {
        const batchToRemove = this._batches[batchIndex];
        console.log(`Deleting batch: ${batchToRemove.title}`);

        this._batches.splice(batchIndex, 1);
        this._renderThumbnails(); // Re-render the list

        this.dispatchEvent(new CustomEvent('batch-deleted', {
            bubbles: true, 
            composed: true, 
            detail: { batch: batchToRemove, batchIndex }
        }));
    }

    // Attribute Changed Callback for panel width, etc.
    static get observedAttributes() {
        return ['opened', 'panel-width']; // Add other attributes to observe
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'opened') {
            if (newValue === null) { // Attribute removed
                this.closePanel();
            } else { // Attribute added or changed
                this.openPanel();
            }
        }
        if (name === 'panel-width' && oldValue !== newValue) {
            const newWidth = parseInt(newValue, 10);
            if (!isNaN(newWidth) && newWidth > 50) { // Basic validation
                this._panelWidth = newWidth;
                this.shadowRoot.host.style.setProperty('--thumbnail-panel-width', `${this._panelWidth}px`);
                 if (this._isPanelActive) {
                    // If panel is open, dispatch event so parent page can adjust
                    this.dispatchEvent(new CustomEvent('panel-resized', { detail: { width: this._panelWidth } }));
                 }
            }
        }
    }

    _revokeAllObjectUrls() {
        this._objectUrls.forEach(url => URL.revokeObjectURL(url));
        this._objectUrls.clear();
        // Also clear from dataset if items are still in DOM (though _renderThumbnails clears innerHTML)
        this.shadowRoot.querySelectorAll('.thumbnail-item[data-object-url]').forEach(thumb => {
            delete thumb.dataset.objectUrl;
        });
    }

    _addFilesAsNewBatch(files, batchTitle, expanded = true) {
        const newBatchId = `batch_${Date.now()}`;
        
        // Debug: Show original file order
        console.log('Original file order:', files.map(f => f.name));
        
        // Sort files using natural sort order for filenames with numbers
        const sortedFiles = [...files].sort((a, b) => {
            // Extract filename without extension for better matching
            const nameA = a.name.split('.')[0];
            const nameB = b.name.split('.')[0];
            
            // Check if both filenames follow a pattern like "page_X" where X is a number
            const patternRegex = /^(.*?)(\d+)(.*)$/;
            const matchA = nameA.match(patternRegex);
            const matchB = nameB.match(patternRegex);
            
            // If both filenames contain numbers, perform numerical sort
            if (matchA && matchB && matchA[1] === matchB[1]) {
                // Same prefix, compare numbers
                const numA = parseInt(matchA[2], 10);
                const numB = parseInt(matchB[2], 10);
                
                if (numA !== numB) {
                    return numA - numB; // Sort by the numeric part
                }
                
                // If numbers are the same, sort by the suffix
                return matchA[3].localeCompare(matchB[3]);
            }
            
            // Fall back to standard string comparison
            return nameA.localeCompare(nameB);
        });
        
        // Debug: Show sorted file order
        console.log('Sorted file order:', sortedFiles.map(f => f.name));
        
        const fileEntries = sortedFiles.map(file => ({
            name: file.name,
            type: file.type,
            data: file, // Store the actual File object here
        }));

        const newBatch = {
            id: newBatchId,
            title: batchTitle,
            expanded: expanded,
            files: fileEntries
        };

        if (!this._batches) {
            this._batches = [];
        }
        this._batches.unshift(newBatch); // Add new batch to the beginning
        this._renderThumbnails();

        // Dispatch an event that a batch was added programmatically
        this.dispatchEvent(new CustomEvent('batch-added', {
            bubbles: true,
            composed: true,
            detail: { batch: newBatch }
        }));
    }
}

customElements.define('thumbnail-pane', ThumbnailPane); 