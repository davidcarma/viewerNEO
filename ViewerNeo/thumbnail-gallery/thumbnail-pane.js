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
                    content: \"\";
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
                    content: \"\";
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
                }
            </style>
            <div id="panel-header">
                <h3>Panel Title</h3>
                <button id="close-panel-button">
                    <svg viewBox="0 0 12 12"><path d="M2.22 2.22L9.78 9.78M9.78 2.22L2.22 9.78" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div id="thumbnails-list-container">
                <!-- Thumbnails will be dynamically added here -->
            </div>
            <button id="toggle-handle">
                <svg viewBox="0 0 12 12"><path d="M2.22 2.22L9.78 9.78M9.78 2.22L2.22 9.78" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
        `;

        this.shadowRoot.appendChild(this._template.content.cloneNode(true));
        this._thumbnailsListContainer = this.shadowRoot.getElementById('thumbnails-list-container');
        this._panelHeader = this.shadowRoot.getElementById('panel-header');
        this._panelTitle = this.shadowRoot.querySelector('#panel-header h3');
        this._closeButton = this.shadowRoot.getElementById('close-panel-button');
        this._toggleHandle = this.shadowRoot.getElementById('toggle-handle');

        this._batches = [];
        this._selectedThumbnail = { batchIndex: -1, fileIndex: -1 };
        this._draggedItem = null;
        this._dropTarget = null;
        this._isResizing = false;
        this._initialWidth = this._panelWidth;
        this._initialMouseX = 0;

        // Bind methods
        this.openPanel = this.openPanel.bind(this);
        this.closePanel = this.closePanel.bind(this);
        this.togglePanel = this.togglePanel.bind(this);
        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);

        this._setupEventListeners();
        this._updateHandleTitle(); // Set initial title for the handle
        
        // Set initial state based on attribute, if present
        if (this.hasAttribute('active')) {
            this.openPanel(false); // Open without animation if initially active
        } else {
            // Ensure correct initial styling for closed state if it wasn't active
            // This might be redundant if CSS handles it, but good for robustness
            this.style.transform = `translateX(-${this.getCurrentWidth()}px)`;
            this.classList.remove('active');
            this._isPanelActive = false;
        }

        // Allow panel title to be set via attribute
        if (this.hasAttribute('panel-title')) {
            this._panelTitle.textContent = this.getAttribute('panel-title');
        }
    }

    _setupEventListeners() {
        this._closeButton.addEventListener('click', this.closePanel);
        this._toggleHandle.addEventListener('click', this.togglePanel);
        
        // Optional: Drag to resize panel width (more complex, basic example)
        // this._toggleHandle.addEventListener('mousedown', this._handleMouseDown);
        // document.addEventListener('mousemove', this._handleMouseMove);
        // document.addEventListener('mouseup', this._handleMouseUp);
    }

    // Basic resize logic (example, can be expanded)
    _handleMouseDown(event) {
        // if (event.target === this._toggleHandle) { // Only if dragging the handle itself
        //     this._isResizing = true;
        //     this._initialMouseX = event.clientX;
        //     this._initialWidth = this.offsetWidth;
        //     this.shadowRoot.host.style.transition = 'none'; // Disable transition during resize
        //     event.preventDefault();
        // }
    }

    _handleMouseMove(event) {
        // if (!this._isResizing) return;
        // const deltaX = event.clientX - this._initialMouseX;
        // let newWidth = this._initialWidth + (this._isPanelActive ? deltaX : -deltaX); 
        // newWidth = Math.max(100, Math.min(newWidth, 500)); // Min/max width
        // this.style.setProperty('--thumbnail-panel-width', `${newWidth}px`);
    }

    _handleMouseUp() {
        // if (this._isResizing) {
        //     this._isResizing = false;
        //     this.shadowRoot.host.style.transition = ''; // Re-enable transition
        //     this._panelWidth = this.offsetWidth; // Update internal width
        // }
    }

    connectedCallback() {
        // console.log("ThumbnailPane connected to DOM");
        if (!this.constructor.isDefined) {
            customElements.define('thumbnail-pane', ThumbnailPane);
            this.constructor.isDefined = true;
        }
        // If initially active via attribute, ensure class is set.
        if (this.hasAttribute('active') && !this.classList.contains('active')) {
             this.openPanel(false);
        }
    }

    // Static property to prevent re-definition
    static isDefined = false;

    disconnectedCallback() {
        // Revoke all object URLs to prevent memory leaks
        this._revokeAllObjectUrls();
        // document.removeEventListener('mousemove', this._handleMouseMove);
        // document.removeEventListener('mouseup', this._handleMouseUp);
    }

    openPanel(animate = true) {
        if (this._isPanelActive && this.classList.contains('active')) return;

        if (!animate) {
            this.style.transition = 'none';
        }
        this.style.transform = 'translateX(0)';
        this.classList.add('active');
        this._isPanelActive = true;
        this._updateHandleTitle();
        this.dispatchEvent(new CustomEvent('panel-opened', { bubbles: true, composed: true }));
        
        if (!animate) {
            // Force reflow to apply no-transition style, then re-enable for future
            this.offsetHeight; // NOSONAR
            this.style.transition = '';
        }
    }

    closePanel(animate = true) {
        if (!this._isPanelActive && !this.classList.contains('active')) return;

        if (!animate) {
            this.style.transition = 'none';
        }
        const currentWidth = this.getCurrentWidth();
        this.style.transform = `translateX(-${currentWidth}px)`;
        this.classList.remove('active');
        this._isPanelActive = false;
        this._updateHandleTitle();
        this.dispatchEvent(new CustomEvent('panel-closed', { bubbles: true, composed: true }));

        if (!animate) {
            this.offsetHeight; // NOSONAR
            this.style.transition = '';
        }
    }

    togglePanel() {
        if (this._isPanelActive) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }
    
    getCurrentWidth() {
        // Attempts to get the width from the CSS variable, falls back to offsetWidth or the internal _panelWidth
        const style = getComputedStyle(this);
        const cssVarWidth = style.getPropertyValue('--thumbnail-panel-width');
        if (cssVarWidth && cssVarWidth.endsWith('px')) {
            return parseFloat(cssVarWidth);
        }
        return this.offsetWidth || this._panelWidth; // offsetWidth might be 0 if not fully rendered
    }

    _updateHandleTitle() {
        this._toggleHandle.setAttribute('title', this._isPanelActive ? 'Close Panel' : 'Open Panel');
    }

    /**
     * Sets the data for the thumbnail panel.
     * @param {Array<Object>} batches - An array of batch objects.
     * Each batch object should have: { batchTitle: String, files: Array<File|Object>, expanded?: Boolean, options?: Object }
     * File objects can be actual File instances or objects like { name: String, dataUrl?: String, type?: String, id?: String|Number }
     */
    setData(batches = []) {
        this._batches = batches.map((batch, index) => ({
            ...batch,
            id: batch.id || `batch-${Date.now()}-${index}`,
            files: batch.files.map((file, fileIdx) => ({
                id: file.id || `file-${Date.now()}-${index}-${fileIdx}`,
                name: file.name,
                dataUrl: file.dataUrl || (file instanceof File ? URL.createObjectURL(file) : null),
                type: file.type || (file instanceof File ? file.type : 'application/octet-stream'),
                originalFile: file instanceof File ? file : null,
                ...batch.options // Batch-level options can be overridden by file-specific ones if needed
            })),
            expanded: batch.expanded !== undefined ? batch.expanded : true, // Default to expanded
        }));
        this._revokeAllObjectUrls(); // Revoke previous URLs before creating new ones
        this._batches.forEach(batch => 
            batch.files.forEach(file => {
                if (file.dataUrl && file.dataUrl.startsWith('blob:')) {
                    this._objectUrls.add(file.dataUrl);
                }
            })
        );
        this._renderThumbnails();
        this._highlightSelectedThumbnail(-1, -1); // Clear selection
    }

    /**
     * Creates a new batch and adds it to the panel.
     * @param {Array<File|Object>} filesArray - Array of File objects or file-like objects.
     * @param {Object} options - Options for the batch (e.g., { batchTitle: 'My Batch', expanded: true }).
     */
    createNewBatch(filesArray, options = {}) {
        const newBatch = {
            batchTitle: options.batchTitle || `Batch ${this._batches.length + 1}`,
            id: `batch-${Date.now()}`,
            files: filesArray.map((file, fileIdx) => {
                const isFileInstance = file instanceof File;
                const dataUrl = isFileInstance ? URL.createObjectURL(file) : (file.dataUrl || null);
                if (dataUrl && dataUrl.startsWith('blob:')) {
                    this._objectUrls.add(dataUrl); 
                }
                return {
                    id: file.id || `file-${Date.now()}-${this._batches.length}-${fileIdx}`,
                    name: file.name,
                    dataUrl: dataUrl,
                    type: file.type || (isFileInstance ? file.type : 'application/octet-stream'),
                    originalFile: isFileInstance ? file : null,
                };
            }),
            expanded: options.expanded !== undefined ? options.expanded : true,
        };
        this._batches.push(newBatch);
        this._renderThumbnails(); 
        // Optionally, scroll to the new batch or expand it
    }

    _renderThumbnails() {
        this._thumbnailsListContainer.innerHTML = ''; // Clear existing thumbnails

        this._batches.forEach((batch, batchIndex) => {
            const batchHeader = this._createBatchHeader(batch, batchIndex);
            const batchContent = this._createBatchContent(batch, batchIndex);
            
            this._thumbnailsListContainer.appendChild(batchHeader);
            this._thumbnailsListContainer.appendChild(batchContent);

            if (!batch.expanded) {
                batchContent.style.display = 'none';
            }
            
            // Render thumbnails for this batch
            batch.files.forEach((file, fileIndex) => {
                const thumbnailElement = this._createThumbnail(file, batch, batchIndex, fileIndex);
                batchContent.appendChild(thumbnailElement);
            });
        });
        this._highlightSelectedThumbnail(); // Re-apply selection if any
    }

    _createBatchHeader(batch, batchIndex) {
        const header = document.createElement('div');
        header.className = 'batch-header';
        header.dataset.batchIndex = batchIndex;
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', batch.expanded);
        header.setAttribute('aria-controls', `batch-content-${batch.id}`);
        header.tabIndex = 0;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'batch-title';
        titleSpan.textContent = batch.batchTitle || 'Untitled Batch';
        titleSpan.title = batch.batchTitle || 'Untitled Batch';

        const countSpan = document.createElement('span');
        countSpan.className = 'batch-count';
        countSpan.textContent = batch.files.length;

        const indicator = document.createElement('span');
        indicator.className = 'collapse-indicator';
        // SVG for collapse/expand will be in CSS ::before or ::after

        header.appendChild(indicator); // Indicator first for visual hierarchy (or last)
        header.appendChild(titleSpan);
        header.appendChild(countSpan);
        
        // Delete button for the batch
        const deleteBatchButton = document.createElement('button');
        deleteBatchButton.className = 'delete-batch-button';
        deleteBatchButton.innerHTML = `<svg viewBox="0 0 12 12"><path d="M2.22 2.22L9.78 9.78M9.78 2.22L2.22 9.78" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
        deleteBatchButton.title = 'Delete Batch';
        deleteBatchButton.onclick = (e) => {
            e.stopPropagation(); // Prevent header click
            this._handleDeleteBatch(batchIndex);
        };
        header.appendChild(deleteBatchButton);

        header.addEventListener('click', () => this._toggleBatchExpansion(batchIndex));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                this._toggleBatchExpansion(batchIndex);
                e.preventDefault();
            }
        });
        return header;
    }

    _createBatchContent(batch, batchIndex) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'batch-content';
        contentDiv.id = `batch-content-${batch.id}`; 
        // contentDiv.style.display = batch.expanded ? 'block' : 'none'; // Initial state handled in _renderThumbnails
        return contentDiv;
    }

    _createThumbnail(file, batch, batchIndex, fileIndex) {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumbnail-item';
        thumbDiv.dataset.batchIndex = batchIndex;
        thumbDiv.dataset.fileIndex = fileIndex;
        thumbDiv.tabIndex = 0; // Make it focusable
        thumbDiv.setAttribute('role', 'option');
        thumbDiv.setAttribute('aria-selected', 'false');
        thumbDiv.title = file.name;

        const imgContainer = document.createElement('div');
        imgContainer.className = 'thumbnail-image-container';

        const img = document.createElement('img');
        img.alt = file.name;
        img.className = 'thumbnail-image';

        if (file.dataUrl) {
            img.src = file.dataUrl;
        } else if (file.type && file.type.startsWith('image/')) {
            // Fallback if dataUrl not directly provided but it's an image file
            // This path might be less common if createNewBatch always creates object URLs
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
                if (e.target.result.startsWith('blob:')) { // Should be data: URL here
                    this._objectUrls.add(e.target.result); // Track if FileReader somehow makes a blob (unlikely for readAsDataURL)
                }
            };
            reader.onerror = () => img.src = 'https://via.placeholder.com/100x80/eee/ccc?text=Error'; // Placeholder for error
            if (file.originalFile) {
                reader.readAsDataURL(file.originalFile);
            }
        } else {
            // Placeholder for non-image files or if no dataUrl/File object
            const fileTypeShort = file.type ? file.type.split('/').pop().toUpperCase() : (file.name.split('.').pop() || 'FILE').toUpperCase();
            img.src = `https://via.placeholder.com/100x80/ccc/777?text=${fileTypeShort.substring(0,4)}`;
            img.classList.add('thumbnail-placeholder');
        }
        imgContainer.appendChild(img);

        const nameLabel = document.createElement('span');
        nameLabel.className = 'thumbnail-name';
        nameLabel.textContent = file.name;
        
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'thumbnail-controls';

        const removeButton = document.createElement('button');
        removeButton.className = 'thumbnail-remove-button';
        removeButton.innerHTML = '&#x2715;'; //✖
        removeButton.title = 'Remove Image';
        removeButton.onclick = (e) => {
            e.stopPropagation();
            this._handleRemoveImage(batchIndex, fileIndex);
        };
        controlsDiv.appendChild(removeButton);

        thumbDiv.appendChild(imgContainer);
        thumbDiv.appendChild(nameLabel);
        thumbDiv.appendChild(controlsDiv);

        thumbDiv.addEventListener('click', () => this._handleSelectImage(batchIndex, fileIndex));
        thumbDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                this._handleSelectImage(batchIndex, fileIndex);
                e.preventDefault();
            }
        });

        // Drag and Drop (simplified)
        thumbDiv.draggable = true;
        thumbDiv.addEventListener('dragstart', (e) => {
            this._draggedItem = { batchIndex, fileIndex, element: thumbDiv };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({ batchIndex, fileIndex, id: file.id }));
            thumbDiv.classList.add('dragging');
        });
        thumbDiv.addEventListener('dragend', (e) => {
            thumbDiv.classList.remove('dragging');
            this._draggedItem = null;
            if (this._dropTarget) {
                this._dropTarget.element.classList.remove('drop-target-hover');
                this._dropTarget = null;
            }
        });

        thumbDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this._draggedItem && (this._draggedItem.batchIndex !== batchIndex || this._draggedItem.fileIndex !== fileIndex)) {
                if (this._dropTarget && this._dropTarget.element !== thumbDiv) {
                    this._dropTarget.element.classList.remove('drop-target-hover');
                }
                this._dropTarget = { batchIndex, fileIndex, element: thumbDiv };
                thumbDiv.classList.add('drop-target-hover');
                e.dataTransfer.dropEffect = 'move';
            }
        });

        thumbDiv.addEventListener('dragleave', (e) => {
            if (e.target === thumbDiv) { // Ensure it's not a child element triggering
                thumbDiv.classList.remove('drop-target-hover');
                if (this._dropTarget && this._dropTarget.element === thumbDiv) {
                     this._dropTarget = null;
                }
            }
        });

        thumbDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            thumbDiv.classList.remove('drop-target-hover');
            if (this._draggedItem && this._dropTarget && 
                (this._draggedItem.batchIndex !== this._dropTarget.batchIndex || this._draggedItem.fileIndex !== this._dropTarget.fileIndex)) {
                
                const sourceBatch = this._batches[this._draggedItem.batchIndex];
                const [movedFile] = sourceBatch.files.splice(this._draggedItem.fileIndex, 1);

                const targetBatch = this._batches[this._dropTarget.batchIndex];
                targetBatch.files.splice(this._dropTarget.fileIndex, 0, movedFile);

                this._selectedThumbnail = { batchIndex: this._dropTarget.batchIndex, fileIndex: this._dropTarget.fileIndex };
                this._renderThumbnails();
                this.dispatchEvent(new CustomEvent('thumbnail-reordered', {
                    bubbles: true, composed: true,
                    detail: { 
                        fileId: movedFile.id,
                        from: { batchIndex: this._draggedItem.batchIndex, fileIndex: this._draggedItem.fileIndex },
                        to: { batchIndex: this._dropTarget.batchIndex, fileIndex: this._dropTarget.fileIndex }
                    }
                }));
            }
            this._draggedItem = null;
            this._dropTarget = null;
        });

        return thumbDiv;
    }

    _toggleBatchExpansion(batchIndex) {
        const batch = this._batches[batchIndex];
        if (!batch) return;

        batch.expanded = !batch.expanded;
        const batchContent = this.shadowRoot.querySelector(`#batch-content-${batch.id}`);
        const batchHeader = this.shadowRoot.querySelector(`.batch-header[data-batch-index="${batchIndex}"]`);

        if (batchContent && batchHeader) {
            if (batch.expanded) {
                batchContent.style.display = ''; // Or 'block', 'flex', etc., depending on CSS
                batchHeader.setAttribute('aria-expanded', 'true');
            } else {
                batchContent.style.display = 'none';
                batchHeader.setAttribute('aria-expanded', 'false');
            }
            // Update collapse indicator style via class on header or directly if needed
            batchHeader.classList.toggle('collapsed', !batch.expanded);
        }
        this.dispatchEvent(new CustomEvent('batch-expansion-changed', {
            bubbles: true, composed: true,
            detail: { batchId: batch.id, batchIndex, expanded: batch.expanded }
        }));
    }

    _handleSelectImage(batchIndex, fileIndex) {
        const previouslySelected = this._selectedThumbnail;
        this._selectedThumbnail = { batchIndex, fileIndex };
        this._highlightSelectedThumbnail(previouslySelected.batchIndex, previouslySelected.fileIndex);
        
        const selectedFile = this._batches[batchIndex]?.files[fileIndex];
        if (selectedFile) {
            this.dispatchEvent(new CustomEvent('thumbnail-selected', {
                bubbles: true,
                composed: true,
                detail: { 
                    ...selectedFile,
                    batchId: this._batches[batchIndex].id,
                    batchTitle: this._batches[batchIndex].batchTitle,
                    batchIndex: batchIndex,
                    fileIndex: fileIndex
                }
            }));
        }
    }

    _highlightSelectedThumbnail(prevBatchIndex = -1, prevFileIndex = -1) {
        // Deselect previous
        if (prevBatchIndex !== -1 && prevFileIndex !== -1) {
            const prevThumbEl = this.shadowRoot.querySelector(`.thumbnail-item[data-batch-index="${prevBatchIndex}"][data-file-index="${prevFileIndex}"]`);
            if (prevThumbEl) {
                prevThumbEl.classList.remove('selected');
                prevThumbEl.setAttribute('aria-selected', 'false');
            }
        }
        // Select current
        if (this._selectedThumbnail.batchIndex !== -1 && this._selectedThumbnail.fileIndex !== -1) {
            const currentThumbEl = this.shadowRoot.querySelector(`.thumbnail-item[data-batch-index="${this._selectedThumbnail.batchIndex}"][data-file-index="${this._selectedThumbnail.fileIndex}"]`);
            if (currentThumbEl) {
                currentThumbEl.classList.add('selected');
                currentThumbEl.setAttribute('aria-selected', 'true');
                // currentThumbEl.focus(); // Optional: focus selected thumbnail
                // Ensure it's visible
                currentThumbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
    _handleRemoveImage(batchIndex, fileIndex) {
        const batch = this._batches[batchIndex];
        if (!batch || !batch.files[fileIndex]) return;

        const removedFile = batch.files.splice(fileIndex, 1)[0];
        if (removedFile.dataUrl && removedFile.dataUrl.startsWith('blob:')) {
            URL.revokeObjectURL(removedFile.dataUrl);
            this._objectUrls.delete(removedFile.dataUrl);
        }
        
        // If selected item was removed, clear selection
        if (this._selectedThumbnail.batchIndex === batchIndex && this._selectedThumbnail.fileIndex === fileIndex) {
            this._selectedThumbnail = { batchIndex: -1, fileIndex: -1 };
        }
        // If selected item was after the removed one in the same batch, adjust its index
        else if (this._selectedThumbnail.batchIndex === batchIndex && this._selectedThumbnail.fileIndex > fileIndex) {
            this._selectedThumbnail.fileIndex--;
        }

        this._renderThumbnails(); // Re-render to reflect removal
        this.dispatchEvent(new CustomEvent('thumbnail-removed', {
            bubbles: true, composed: true,
            detail: { fileId: removedFile.id, batchId: batch.id, batchIndex, fileIndex }
        }));
    }

    _handleDeleteBatch(batchIndex) {
        const batch = this._batches[batchIndex];
        if (!batch) return;

        // Revoke URLs for all files in this batch
        batch.files.forEach(file => {
            if (file.dataUrl && file.dataUrl.startsWith('blob:')) {
                URL.revokeObjectURL(file.dataUrl);
                this._objectUrls.delete(file.dataUrl);
            }
        });

        const removedBatch = this._batches.splice(batchIndex, 1)[0];

        // Adjust selection if it was in or after the deleted batch
        if (this._selectedThumbnail.batchIndex === batchIndex) {
            this._selectedThumbnail = { batchIndex: -1, fileIndex: -1 }; // Clear selection
        } else if (this._selectedThumbnail.batchIndex > batchIndex) {
            this._selectedThumbnail.batchIndex--;
        }

        this._renderThumbnails(); // Re-render
        this.dispatchEvent(new CustomEvent('batch-deleted', {
            bubbles: true, composed: true,
            detail: { batchId: removedBatch.id, batchIndex }
        }));
    }

    static get observedAttributes() {
        return ['active', 'panel-title', 'width']; // Added 'width'
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'active') {
            if (newValue !== null) {
                this.openPanel(false); // Open without animation if attribute is set
            } else {
                this.closePanel(false); // Close without animation if attribute is removed
            }
        } else if (name === 'panel-title' && this._panelTitle) {
            this._panelTitle.textContent = newValue;
        } else if (name === 'width' && newValue !== oldValue) {
            this.style.setProperty('--thumbnail-panel-width', newValue);
            this._panelWidth = parseInt(newValue, 10) || this._panelWidth;
            // If the panel is closed and width changes, we might need to re-calculate transform
            if (!this._isPanelActive) {
                this.style.transform = `translateX(-${this.getCurrentWidth()}px)`;
            }
        }
    }

    _revokeAllObjectUrls() {
        this._objectUrls.forEach(url => URL.revokeObjectURL(url));
        this._objectUrls.clear();
    }

    /**
     * Public method to add files as a new batch. Exposed for external use.
     * @param {Array<File>} files - Array of File objects.
     * @param {string} [batchTitle] - Optional title for the new batch.
     * @param {boolean} [expanded=true] - Whether the new batch should be expanded by default.
     */
    addFilesAsNewBatch(files, batchTitle, expanded = true) {
        if (!files || files.length === 0) return;
        this.createNewBatch(files, { batchTitle, expanded });
    }

    /**
     * Public method to get all current batches and their files.
     * @returns {Array<Object>} Clones of the internal batch data.
     */
    getAllBatches() {
        // Return a deep clone to prevent external modification of internal state
        return JSON.parse(JSON.stringify(this._batches.map(b => ({
            ...b,
            files: b.files.map(f => ({...f, originalFile: undefined})) // Don't stringify File objects
        }))));
    }

    /**
     * Clears all thumbnails and batches from the panel.
     */
    clearAllThumbnails() {
        this._revokeAllObjectUrls();
        this._batches = [];
        this._selectedThumbnail = { batchIndex: -1, fileIndex: -1 };
        this._renderThumbnails();
        this.dispatchEvent(new CustomEvent('all-thumbnails-cleared', { bubbles: true, composed: true }));
    }
}

// Define the custom element if it hasn't been defined yet.
// The connectedCallback also tries to define it, ensuring it's defined before use.
if (!customElements.get('thumbnail-pane')) {
    customElements.define('thumbnail-pane', ThumbnailPane);
    ThumbnailPane.isDefined = true; // Mark as defined using the static property
}

export default ThumbnailPane; 