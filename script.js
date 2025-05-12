const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const infoPanel = document.getElementById('info-panel');
const loadingDiv = document.querySelector('.loading');
const dropOverlay = document.getElementById('drop-overlay');
const container = document.getElementById('container');
const gridBtn = document.getElementById('grid-btn');
const gridControls = document.getElementById('grid-controls');

// State variables
let image = null;
let zoomLevel = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let isDraggingFile = false;
let lastX = 0;
let lastY = 0;
let imageData = null;
let showGrid = false;

// Grid settings
const gridSettings = {
    size: 100,
    color: '#ff0000',
    opacity: 0.5,
    isFixed: false // Added for fixed grid functionality
};

// New state variables for thumbnails
let imageFiles = [];
let selectedImageIndex = -1;
let isThumbnailPanelVisible = false;
let isResizingPanel = false;
let thumbnailPanelWidth = 250;

// Get thumbnail panel elements
const thumbnailPanel = document.getElementById('thumbnail-panel');
const thumbnailsContainer = document.getElementById('thumbnails-container');
const toggleThumbnailsBtn = document.getElementById('toggle-thumbnails');
const closeThumbnailsBtn = document.getElementById('close-thumbnails');
const thumbnailToggleHandle = document.getElementById('thumbnail-toggle-handle');

// Update file input references
const fileInput = document.getElementById('file-input');
const directoryInput = document.getElementById('directory-input');

// Modify drop overlay text to indicate folder drop capability
dropOverlay.textContent = 'Drop image or folder here';

// Set canvas size
function resizeCanvas() {
    // Store current center position relative to the image
    let centerX, centerY;
    if (image) {
        const dpr = window.devicePixelRatio || 1;
        const oldWidth = canvas.width / dpr;
        const oldHeight = canvas.height / dpr;
        centerX = (oldWidth / 2 - offsetX) / zoomLevel;
        centerY = (oldHeight / 2 - offsetY) / zoomLevel;
    }
    
    // Get current container dimensions, not canvas dimensions
    const containerRect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size to match container size
    canvas.width = containerRect.width * dpr;
    canvas.height = containerRect.height * dpr;
    
    // Set display size (CSS)
    canvas.style.width = `${containerRect.width}px`;
    canvas.style.height = `${containerRect.height}px`;
    
    // Scale context for high DPI displays
    ctx.scale(dpr, dpr);
    
    // If we have an image, adjust the position to maintain the center point
    if (image) {
        const newWidth = canvas.width / dpr;
        const newHeight = canvas.height / dpr;
        offsetX = newWidth / 2 - centerX * zoomLevel;
        offsetY = newHeight / 2 - centerY * zoomLevel;
    }
    
    // Re-render the image with new dimensions
    render();
    updateInfo();
}

// Call resizeCanvas whenever container size might change
window.addEventListener('resize', resizeCanvas);
// Also add a resize observer to detect container size changes
const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
});
resizeObserver.observe(container);

// Grid controls
gridBtn.addEventListener('click', () => {
    showGrid = !showGrid;
    gridBtn.classList.toggle('active');
    gridControls.classList.toggle('visible');
    render();
});

document.getElementById('grid-size').addEventListener('change', (e) => {
    gridSettings.size = parseFloat(e.target.value); // Use parseFloat
    render();
});

document.getElementById('grid-color').addEventListener('input', (e) => {
    gridSettings.color = e.target.value;
    render();
});

document.getElementById('grid-opacity').addEventListener('input', (e) => {
    gridSettings.opacity = parseInt(e.target.value) / 100;
    render();
});

// Add event listener for the new fixed grid switch
document.getElementById('grid-fixed-switch').addEventListener('change', (e) => {
    gridSettings.isFixed = e.target.checked;
    render();
});

// Drag and drop handling
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    isDraggingFile = true;
    document.body.classList.add('dragging-file');
    dropOverlay.classList.add('active');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right ||
        e.clientY <= rect.top || e.clientY >= rect.bottom) {
        isDraggingFile = false;
        document.body.classList.remove('dragging-file');
        dropOverlay.classList.remove('active');
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    isDraggingFile = false;
    document.body.classList.remove('dragging-file');
    dropOverlay.classList.remove('active');

    console.log("Drop detected with", e.dataTransfer.files.length, "files");
    
    // Filter for both standard image types and TIFF files
    const files = Array.from(e.dataTransfer.files).filter(f => 
        f.type.startsWith('image/') || 
        f.name.toLowerCase().endsWith('.tif') || 
        f.name.toLowerCase().endsWith('.tiff')
    );
    console.log("Image files detected:", files.length);
    
    if (files.length > 0) {
        // If files are directly available, use them immediately
        processImageFiles(files);
        return;
    }
    
    // Only try File System Access API if no files were found directly
    const items = e.dataTransfer.items;
    if (items && items.length > 0 && 'getAsFileSystemHandle' in DataTransferItem.prototype) {
        try {
            let fsapiFiles = [];
            for (let i = 0; i < items.length; i++) {
                const handle = await items[i].getAsFileSystemHandle();
                if (handle.kind === 'file') {
                    const file = await handle.getFile();
                    if (file.type.startsWith('image/') || 
                        file.name.toLowerCase().endsWith('.tif') || 
                        file.name.toLowerCase().endsWith('.tiff')) {
                        fsapiFiles.push(file);
                    }
                } else if (handle.kind === 'directory') {
                    fsapiFiles = fsapiFiles.concat(await getAllFilesFromDirectoryHandle(handle));
                }
            }
            
            if (fsapiFiles.length > 0) {
                processImageFiles(fsapiFiles);
            } else {
                alert('No image files found in the dropped items.');
            }
            return;
        } catch (err) {
            console.error('File System Access API error:', err);
            // Continue to fallback approach
        }
    }
    
    // Final fallback message if nothing worked
    alert('No image files found in the dropped items. For folders, please use the "Load Folder" button.');
});

// Recursively collect all image files from a FileSystemDirectoryHandle
async function getAllFilesFromDirectoryHandle(dirHandle) {
    let files = [];
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
            const file = await entry.getFile();
            if (file.type.startsWith('image/')) files.push(file);
        } else if (entry.kind === 'directory') {
            files = files.concat(await getAllFilesFromDirectoryHandle(entry));
        }
    }
    return files;
}

// Recursively collect all image files from entries (files and folders)
async function getAllImageFilesFromEntries(entries) {
    let files = [];
    for (const entry of entries) {
        if (entry.isFile) {
            console.log('[ENTRY] isFile:', entry.name);
            files.push(await getFileFromEntry(entry));
        } else if (entry.isDirectory) {
            console.log('[ENTRY] isDirectory:', entry.name);
            files = files.concat(await getFilesFromDirectory(entry));
        } else {
            console.log('[ENTRY] Unknown entry type:', entry);
        }
    }
    // Only keep image files
    const imageFiles = files.filter(f => f && f.type && f.type.startsWith('image/'));
    console.log('[ENTRY] Filtered image files:', imageFiles);
    return imageFiles;
}

function getFileFromEntry(entry) {
    return new Promise(resolve => {
        entry.file(file => {
            console.log('[getFileFromEntry] Got file:', file);
            resolve(file);
        });
    });
}

function getFilesFromDirectory(directoryEntry) {
    return new Promise(resolve => {
        const reader = directoryEntry.createReader();
        let fileList = [];
        function readEntries() {
            reader.readEntries(async entries => {
                console.log(`[getFilesFromDirectory] Read ${entries.length} entries from ${directoryEntry.name}`);
                if (!entries.length) {
                    resolve(fileList);
                    return;
                }
                for (const entry of entries) {
                    if (entry.isFile) {
                        console.log('[getFilesFromDirectory] isFile:', entry.name);
                        fileList.push(await getFileFromEntry(entry));
                    } else if (entry.isDirectory) {
                        console.log('[getFilesFromDirectory] isDirectory:', entry.name);
                        const nestedFiles = await getFilesFromDirectory(entry);
                        fileList = fileList.concat(nestedFiles);
                    } else {
                        console.log('[getFilesFromDirectory] Unknown entry type:', entry);
                    }
                }
                readEntries();
            });
        }
        readEntries();
    });
}

// Process multiple image files
function processImageFiles(files) {
    // Sort files using natural sort order for filenames with numbers
    files.sort((a, b) => {
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
    
    // Add new images to the existing ones rather than replacing
    imageFiles = [...imageFiles, ...files];
    
    // Create thumbnails for all images
    createThumbnails(imageFiles);
    
    // Show thumbnail panel if we have multiple images
    if (imageFiles.length > 1) {
        showThumbnailPanel();
    }
    
    // Load the newly added image if this is the first load or if requested
    if (files.length > 0) {
        // Select the first of the new images (last in the combined array)
        selectImageByIndex(imageFiles.length - files.length);
    }
}

// Create thumbnails for all images with better aspect ratio handling
async function createThumbnails(files) {
    thumbnailsContainer.innerHTML = '';
    
    // Show thumbnails if not already shown
    if (!isThumbnailPanelVisible) {
        showThumbnailPanel();
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const thumbnailItem = document.createElement('div');
        thumbnailItem.className = 'thumbnail-item';
        thumbnailItem.dataset.index = i;
        thumbnailItem.draggable = true; // Make it draggable
        
        // Use the full file name for the label
        const fileName = file.name;
        
        // Create thumbnail content with remove button
        thumbnailItem.innerHTML = `
            <div class="thumbnail-image-container">
                <img src="#" alt="${fileName}" draggable="false">
                <button class="thumbnail-remove-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div class="thumbnail-label">${fileName}</div>
        `;
        
        // Add to container
        thumbnailsContainer.appendChild(thumbnailItem);
        
        // Add click event
        thumbnailItem.addEventListener('click', (e) => {
            // Ignore clicks on the remove button
            if (e.target.classList.contains('thumbnail-remove-btn')) {
                return;
            }
            selectImageByIndex(i);
        });
        
        // Add remove button click event
        const removeBtn = thumbnailItem.querySelector('.thumbnail-remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeImageByIndex(i);
        });
        
        // Add drag event handlers
        thumbnailItem.addEventListener('dragstart', (e) => {
            handleThumbnailDragStart(e, file, i);
        });
        
        thumbnailItem.addEventListener('dragend', (e) => {
            thumbnailItem.classList.remove('dragging');
        });
        
        // Load thumbnail preview
        const img = thumbnailItem.querySelector('img');
        if (file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.tif') && !file.name.toLowerCase().endsWith('.tiff')) {
            // Regular image - use URL.createObjectURL
            img.src = URL.createObjectURL(file);
        } else if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
            // TIFF image - create a small preview
            try {
                const tiff = await Tiff.initialize({locateFile: () => 'lib/tiff.wasm'});
                const buffer = await file.arrayBuffer();
                const tiffData = tiff.readFromBuffer(new Uint8Array(buffer));
                
                // Get first page and create small thumbnail
                const width = tiffData.getWidth();
                const height = tiffData.getHeight();
                const ratio = width / height;
                
                // Small canvas for thumbnail
                const thumbCanvas = document.createElement('canvas');
                const thumbCtx = thumbCanvas.getContext('2d');
                
                // Set dimensions for thumbnail (max width 200px)
                const thumbHeight = 100;
                const thumbWidth = Math.round(thumbHeight * ratio);
                
                thumbCanvas.width = thumbWidth;
                thumbCanvas.height = thumbHeight;
                
                // Get RGBA data from TIFF and draw to the thumbnail canvas
                const rgba = tiffData.readRGBAImage();
                const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
                
                // Create a temporary canvas at full size
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(imageData, 0, 0);
                
                // Draw scaled version to thumbnail canvas
                thumbCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, thumbWidth, thumbHeight);
                
                // Set as thumbnail source
                img.src = thumbCanvas.toDataURL();
                
                tiff.destroy();
            } catch (error) {
                console.error('Error creating TIFF thumbnail:', error);
                img.src = 'placeholder.png'; // Fallback
            }
        } else {
            img.src = 'placeholder.png'; // Fallback for unsupported formats
        }
    }
    
    // Update selected thumbnail if applicable
    if (selectedImageIndex >= 0) {
        const selected = thumbnailsContainer.querySelector(`.thumbnail-item[data-index="${selectedImageIndex}"]`);
        if (selected) {
            selected.classList.add('active');
        }
    }
}

// New function to remove an image by index
function removeImageByIndex(index) {
    if (index < 0 || index >= imageFiles.length) return;
    
    // Remove the file from the array
    imageFiles.splice(index, 1);
    
    // Check if we removed the currently selected image
    const wasSelected = index === selectedImageIndex;
    
    // If we removed all images
    if (imageFiles.length === 0) {
        selectedImageIndex = -1;
        image = null;
        
        // Clear canvas and info
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        infoPanel.innerHTML = `
            Image Size: -<br>
            Zoom: 100%<br>
            Position: 0, 0
        `;
        
        // Hide thumbnail panel if empty
        hideThumbnailPanel();
    } else {
        // Recreate thumbnails with updated indices
        createThumbnails(imageFiles);
        
        // If we removed the selected image, select a nearby one
        if (wasSelected) {
            // Select the same index if possible, otherwise the last image
            const newIndex = Math.min(index, imageFiles.length - 1);
            selectImageByIndex(newIndex);
        } else if (selectedImageIndex > index) {
            // If we removed an image before the selected one, adjust the selection
            selectedImageIndex--;
            // Update the UI to reflect the new index
            const thumbnails = document.querySelectorAll('.thumbnail-item');
            thumbnails.forEach(thumbnail => {
                thumbnail.classList.remove('active');
            });
            const selected = thumbnailsContainer.querySelector(`.thumbnail-item[data-index="${selectedImageIndex}"]`);
            if (selected) {
                selected.classList.add('active');
            }
        }
    }
}

// Handle drag start from thumbnails
function handleThumbnailDragStart(e, file, index) {
    // Add visual feedback
    e.currentTarget.classList.add('dragging');
    
    // Set dragged data
    e.dataTransfer.effectAllowed = 'copyMove';
    
    // Create a drag image from the thumbnail
    const img = e.currentTarget.querySelector('img');
    if (img && img.complete) {
        // Use the thumbnail as the drag image
        const rect = img.getBoundingClientRect();
        e.dataTransfer.setDragImage(img, rect.width / 2, rect.height / 2);
    }
    
    // Create a blob URL that can be shared with other websites
    const blobUrl = URL.createObjectURL(file);
    
    // For cross-application transfers, we need to create a data URL
    // that can be embedded in the HTML
    createCrossAppCompatibleData(file, (dataUrl) => {
        // CROSS-ORIGIN COMPATIBLE FORMATS FOR WEB-TO-WEB DRAG:
        
        // 1. HTML format with embedded data URL (most compatible for cross-app)
        let imageHtml;
        if (dataUrl) {
            // If we have a data URL, use it directly in the HTML
            imageHtml = `<img src="${dataUrl}" alt="${file.name}" title="${file.name}">`;
            console.log('Added HTML format with embedded data URL for cross-app drag');
        } else {
            // Fallback to blob URL
            imageHtml = `<img src="${blobUrl}" alt="${file.name}" title="${file.name}">`;
            console.log('Added HTML format with blob URL for same-origin drag');
        }
        e.dataTransfer.setData('text/html', imageHtml);
        
        // 2. Plain text data URL as a fallback
        if (dataUrl) {
            e.dataTransfer.setData('text/plain', dataUrl);
            console.log('Added data URL as plain text for cross-app drag');
        } else {
            e.dataTransfer.setData('text/plain', blobUrl);
        }
        
        // 3. URI List format (less reliable for cross-app but works in same origin)
        if (dataUrl) {
            e.dataTransfer.setData('text/uri-list', dataUrl);
        } else {
            e.dataTransfer.setData('text/uri-list', blobUrl);
        }
        
        // 4. For local file system drag still attempt download URL format
        try {
            const downloadUrl = `${file.type}:${file.name}:${blobUrl}`;
            e.dataTransfer.setData('DownloadURL', downloadUrl);
        } catch (err) {
            console.warn('Browser doesn\'t support DownloadURL format:', err);
        }
        
        // 5. Special handling for in-browser transfers
        try {
            // Store file data in sessionStorage for other web pages to access
            const transferKey = `image_transfer_${Date.now()}`;
            e.dataTransfer.setData('application/x-image-transfer-key', transferKey);
            
            // Store reference to this file with dataUrl included
            const fileInfo = {
                name: file.name,
                type: file.type,
                size: file.size,
                url: blobUrl,
                dataUrl: dataUrl, // Include the data URL if available
                timestamp: Date.now()
            };
            
            // Store in sessionStorage for cross-page communication
            sessionStorage.setItem(transferKey, JSON.stringify(fileInfo));
            console.log('Stored file reference for cross-app transfer:', transferKey);
            
            // Schedule cleanup of this storage after some time
            setTimeout(() => {
                sessionStorage.removeItem(transferKey);
            }, 60000); // Remove after 1 minute
        } catch (err) {
            console.warn('Failed to set up cross-app file transfer:', err);
        }
    });
    
    // Store blob URL to revoke later
    const thumbnailItem = e.currentTarget;
    thumbnailItem.dataset.blobUrl = blobUrl;
    
    // Clean up event listener and blob URL after drag ends
    thumbnailItem.addEventListener('dragend', () => {
        thumbnailItem.classList.remove('dragging');
        
        // Only revoke after a delay to allow the drop target to use the URL
        setTimeout(() => {
            if (thumbnailItem.dataset.blobUrl) {
                URL.revokeObjectURL(thumbnailItem.dataset.blobUrl);
                delete thumbnailItem.dataset.blobUrl;
            }
        }, 5000); // Keep URL alive for 5 seconds after drag ends
    }, { once: true });
}

// Helper function to create cross-application compatible data
function createCrossAppCompatibleData(file, callback) {
    // For very large files, skip data URL creation to avoid performance issues
    if (file.size > 5 * 1024 * 1024) { // Skip if over 5MB
        console.log('File too large for data URL transfer, using blob URL only');
        callback(null);
        return;
    }
    
    // Create a FileReader to read the file as a data URL
    const reader = new FileReader();
    
    reader.onload = (e) => {
        // e.target.result contains the data URL
        callback(e.target.result);
    };
    
    reader.onerror = () => {
        console.error('Failed to create data URL for file:', file.name);
        callback(null);
    };
    
    // Start reading the file as a data URL
    reader.readAsDataURL(file);
}

// Add context menu for save/copy operations
function addThumbnailContextMenu() {
    // Add context menu handler to thumbnails container
    thumbnailsContainer.addEventListener('contextmenu', (e) => {
        // Find closest thumbnail item
        const thumbnailItem = e.target.closest('.thumbnail-item');
        if (!thumbnailItem) return;
        
        // Prevent default context menu
        e.preventDefault();
        
        // Get the file index
        const index = parseInt(thumbnailItem.dataset.index);
        if (isNaN(index) || index < 0 || index >= imageFiles.length) return;
        
        // Get the file
        const file = imageFiles[index];
        
        // Create and show custom context menu
        showCustomContextMenu(e.clientX, e.clientY, file);
    });
    
    // Also handle double-click for a quick copy
    thumbnailsContainer.addEventListener('dblclick', (e) => {
        const thumbnailItem = e.target.closest('.thumbnail-item');
        if (!thumbnailItem) return;
        
        const index = parseInt(thumbnailItem.dataset.index);
        if (isNaN(index) || index < 0 || index >= imageFiles.length) return;
        
        const file = imageFiles[index];
        copyImageToClipboard(file);
    });
    
    // Handle keyboard events for copy
    document.addEventListener('keydown', (e) => {
        // Check if Ctrl+C or Cmd+C (Mac) pressed
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (selectedImageIndex >= 0 && selectedImageIndex < imageFiles.length) {
                copyImageToClipboard(imageFiles[selectedImageIndex]);
            }
        }
    });
}

// Show custom context menu
function showCustomContextMenu(x, y, file) {
    // Remove any existing context menu
    const existingMenu = document.getElementById('custom-context-menu');
    if (existingMenu) {
        document.body.removeChild(existingMenu);
    }
    
    // Create menu
    const menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    // Menu options
    menu.innerHTML = `
        <div class="context-menu-item" id="copy-image">Copy Image</div>
        <div class="context-menu-item" id="copy-image-url">Copy Image URL</div>
        <div class="context-menu-item" id="download-image">Download Image</div>
    `;
    
    document.body.appendChild(menu);
    
    // Handle menu item clicks
    document.getElementById('copy-image').addEventListener('click', () => {
        copyImageToClipboard(file);
        document.body.removeChild(menu);
    });
    
    document.getElementById('copy-image-url').addEventListener('click', () => {
        const url = URL.createObjectURL(file);
        navigator.clipboard.writeText(url).then(() => {
            showNotification('Image URL copied to clipboard');
            // Keep URL alive for a while so it can be pasted
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }).catch(err => {
            console.error('Failed to copy URL:', err);
            showNotification('Failed to copy URL');
        });
        document.body.removeChild(menu);
    });
    
    document.getElementById('download-image').addEventListener('click', () => {
        downloadFile(file);
        document.body.removeChild(menu);
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeMenu);
        }
    });
}

// Helper function to download a file
function downloadFile(file) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }, 100);
}

// Copy image to clipboard
function copyImageToClipboard(file) {
    // First try to use the modern Clipboard API
    if (file.type.startsWith('image/') && navigator.clipboard && navigator.clipboard.write) {
        // Read the file and create a blob
        const reader = new FileReader();
        reader.onload = async (event) => {
            const blob = new Blob([event.target.result], { type: file.type });
            
            try {
                // Try to write the blob to clipboard
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [file.type]: blob
                    })
                ]);
                showNotification('Image copied to clipboard');
            } catch (err) {
                console.error('Failed to copy image with Clipboard API:', err);
                copyImageUrlFallback(file);
            }
        };
        reader.onerror = () => copyImageUrlFallback(file);
        reader.readAsArrayBuffer(file);
    } else {
        // Fallback to URL method
        copyImageUrlFallback(file);
    }
}

// Fallback method for copying images
function copyImageUrlFallback(file) {
    const url = URL.createObjectURL(file);
    
    // Create a temporary image element for Firefox compatibility
    const tempImg = document.createElement('img');
    tempImg.src = url;
    tempImg.style.position = 'fixed';
    tempImg.style.left = '-9999px';
    document.body.appendChild(tempImg);
    
    // Wait for image to load
    tempImg.onload = function() {
        try {
            // Create a temporary canvas
            const canvas = document.createElement('canvas');
            canvas.width = tempImg.naturalWidth;
            canvas.height = tempImg.naturalHeight;
            
            // Draw image to canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            
            // Try to copy canvas content
            canvas.toBlob((blob) => {
                try {
                    // Try the fallback method of creating a Selection and execCommand
                    const listener = function(e) {
                        e.clipboardData.setData('text/plain', 'Image from High DPI Viewer');
                        e.clipboardData.setData('text/html', `<img src="${url}" alt="${file.name}">`);
                        e.preventDefault();
                    };
                    
                    document.addEventListener('copy', listener);
                    document.execCommand('copy');
                    document.removeEventListener('copy', listener);
                    
                    showNotification('Image reference copied to clipboard');
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                    showNotification('Could not copy image, URL copied instead');
                    navigator.clipboard.writeText(url);
                } finally {
                    // Clean up
                    document.body.removeChild(tempImg);
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                }
            }, file.type);
        } catch (err) {
            console.error('Canvas operation failed:', err);
            document.body.removeChild(tempImg);
            URL.revokeObjectURL(url);
            
            // Final fallback - just copy the URL
            navigator.clipboard.writeText(url)
                .then(() => showNotification('Image URL copied to clipboard'))
                .catch(err => console.error('Clipboard write failed:', err));
        }
    };
}

// Show a notification
function showNotification(message) {
    // Check if there's already a notification
    let notification = document.getElementById('notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set message and show
    notification.textContent = message;
    notification.classList.add('show');
    
    // Hide after delay
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Call this after page load
document.addEventListener('DOMContentLoaded', addThumbnailContextMenu);

// Select and load an image by its index
function selectImageByIndex(index) {
    if (index >= 0 && index < imageFiles.length) {
        // Update selected index
        selectedImageIndex = index;
        
        // Update thumbnail selection UI
        const thumbnails = document.querySelectorAll('.thumbnail-item');
        thumbnails.forEach(thumbnail => {
            thumbnail.classList.remove('active');
        });
        
        const selectedThumbnail = document.querySelector(`.thumbnail-item[data-index="${index}"]`);
        if (selectedThumbnail) {
            selectedThumbnail.classList.add('active');
            // Scroll to the selected thumbnail
            selectedThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Load the selected image
        loadImage(imageFiles[index]);
    }
}

// Toggle thumbnail panel
toggleThumbnailsBtn.addEventListener('click', toggleThumbnailPanel);
closeThumbnailsBtn.addEventListener('click', () => {
    hideThumbnailPanel();
});
thumbnailToggleHandle.addEventListener('click', toggleThumbnailPanel);

function toggleThumbnailPanel() {
    if (isThumbnailPanelVisible) {
        hideThumbnailPanel();
    } else {
        showThumbnailPanel();
    }
}

function showThumbnailPanel() {
    thumbnailPanel.classList.add('active');
    container.classList.add('with-thumbnails');
    isThumbnailPanelVisible = true;
    toggleThumbnailsBtn.textContent = 'Hide Thumbnails';
    toggleThumbnailsBtn.classList.add('active');
    thumbnailToggleHandle.classList.remove('hidden');
    
    // Apply current width
    thumbnailPanel.style.width = `${thumbnailPanelWidth}px`;
    thumbnailToggleHandle.style.left = `${thumbnailPanelWidth}px`;
    container.style.marginLeft = `${thumbnailPanelWidth}px`;
    container.style.width = `calc(100vw - ${thumbnailPanelWidth}px)`;
    
    // Ensure canvas resizes to new container dimensions
    setTimeout(resizeCanvas, 50); // Short delay to allow CSS transitions to apply
}

function hideThumbnailPanel() {
    thumbnailPanel.classList.remove('active');
    container.classList.remove('with-thumbnails');
    isThumbnailPanelVisible = false;
    toggleThumbnailsBtn.textContent = 'Show Thumbnails';
    toggleThumbnailsBtn.classList.remove('active');
    
    // Add the hidden class first, then update left position to ensure proper transition
    thumbnailToggleHandle.classList.add('hidden');
    thumbnailToggleHandle.style.left = '0';
    
    // Reset container styles
    container.style.marginLeft = '';
    container.style.width = '';
    
    // Ensure canvas resizes to new container dimensions
    setTimeout(resizeCanvas, 50); // Short delay to allow CSS transitions to apply
}

// Thumbnail panel resize functionality
thumbnailToggleHandle.addEventListener('mousedown', (e) => {
    if (thumbnailToggleHandle.classList.contains('hidden')) {
        // If the toggle is hidden, treat as a click to show panel
        toggleThumbnailPanel();
        return;
    }
    
    e.preventDefault();
    isResizingPanel = true;
    lastX = e.clientX;
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
    // Handle panel resizing
    if (isResizingPanel && isThumbnailPanelVisible) {
        const newWidth = Math.max(150, Math.min(500, e.clientX));
        thumbnailPanelWidth = newWidth;
        
        // Apply new width to panel and related elements
        thumbnailPanel.style.width = `${newWidth}px`;
        thumbnailToggleHandle.style.left = `${newWidth}px`;
        container.style.marginLeft = `${newWidth}px`;
        container.style.width = `calc(100vw - ${newWidth}px)`;
        
        // Resize canvas to match new container size
        resizeCanvas();
    }
    
    // Existing code for canvas dragging
    if (!isDragging || isDraggingFile) return;
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    offsetX += deltaX;
    offsetY += deltaY;
    lastX = e.clientX;
    lastY = e.clientY;
    render();
    updateInfo();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.classList.remove('dragging');
    
    // Release resize handle
    if (isResizingPanel) {
        isResizingPanel = false;
        document.body.style.cursor = '';
    }
});

// Mouse controls
canvas.addEventListener('mousedown', (e) => {
    if (isDraggingFile) return;
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.classList.add('dragging');
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || isDraggingFile) return;
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    offsetX += deltaX;
    offsetY += deltaY;
    lastX = e.clientX;
    lastY = e.clientY;
    render();
    updateInfo();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.classList.remove('dragging');
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const imageX = (mouseX - offsetX) / zoomLevel;
    const imageY = (mouseY - offsetY) / zoomLevel;

    if (e.deltaY < 0) {
        zoomLevel *= 1.1;
    } else {
        zoomLevel *= 0.9;
    }

    offsetX = mouseX - imageX * zoomLevel;
    offsetY = mouseY - imageY * zoomLevel;

    render();
    updateInfo();
});

// Load button should trigger a menu to choose file or directory
document.getElementById('load-btn').addEventListener('click', () => {
    // Create popup menu for file/folder choice
    const menu = document.createElement('div');
    menu.className = 'file-menu';
    menu.innerHTML = `
        <button id="load-files">Load Files</button>
        <button id="load-folder">Load Folder</button>
    `;
    
    // Position the menu near the button
    const button = document.getElementById('load-btn');
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    
    document.body.appendChild(menu);
    
    // Handle clicks on the menu options
    document.getElementById('load-files').addEventListener('click', () => {
        document.body.removeChild(menu);
        fileInput.value = null; // Reset to allow selecting the same files again
        fileInput.click();
    });
    
    document.getElementById('load-folder').addEventListener('click', () => {
        document.body.removeChild(menu);
        directoryInput.value = null; // Reset to allow selecting the same folder again
        directoryInput.click();
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== button) {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeMenu);
        }
    });
});

// Update file input event listeners
fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        // Filter for both standard image types and TIFF files
        const imageFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/') || 
            file.name.toLowerCase().endsWith('.tif') || 
            file.name.toLowerCase().endsWith('.tiff')
        );
        if (imageFiles.length > 0) {
            processImageFiles(imageFiles);
        }
    }
});

directoryInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        // Filter for both standard image types and TIFF files
        const imageFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/') || 
            file.name.toLowerCase().endsWith('.tif') || 
            file.name.toLowerCase().endsWith('.tiff')
        );
        if (imageFiles.length > 0) {
            processImageFiles(imageFiles);
        }
    }
});

// Zoom controls
document.getElementById('zoom-in').addEventListener('click', () => {
    zoomLevel *= 1.2;
    render();
    updateInfo();
});

document.getElementById('zoom-out').addEventListener('click', () => {
    zoomLevel *= 0.8;
    render();
    updateInfo();
});

document.getElementById('reset').addEventListener('click', resetView);

function resetView() {
    if (!image) return;

    // Calculate the zoom level to fit the image within the canvas
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;
    
    // Calculate the zoom level to fit the image in both dimensions
    const zoomX = canvasWidth / image.width;
    const zoomY = canvasHeight / image.height;
    zoomLevel = Math.min(zoomX, zoomY) * 0.95; // 95% to add a slight margin
    
    // Center the image
    offsetX = (canvasWidth - (image.width * zoomLevel)) / 2;
    offsetY = (canvasHeight - (image.height * zoomLevel)) / 2;

    render();
    updateInfo();
}

function drawGrid() {
    if (!showGrid || !image) return;

    const dpr = window.devicePixelRatio || 1;
    const scaledGridSize = gridSettings.size * zoomLevel;

    ctx.save();
    ctx.strokeStyle = gridSettings.color;
    ctx.globalAlpha = gridSettings.opacity;
    ctx.lineWidth = 1; // This will be 1 CSS pixel thick, scaled by DPR before drawing.

    // Define image boundaries on the canvas (in CSS pixels)
    const imgDisplayX = offsetX;
    const imgDisplayY = offsetY;
    const imgDisplayWidth = image.width * zoomLevel;
    const imgDisplayHeight = image.height * zoomLevel;

    // Set clipping region to the image's display area on the canvas
    ctx.beginPath();
    ctx.rect(imgDisplayX, imgDisplayY, imgDisplayWidth, imgDisplayHeight);
    ctx.clip();

    if (gridSettings.isFixed) {
        // Fixed grid: Lines are relative to canvas origin (0,0), but scaled by zoom.
        // The grid appears fixed on screen, image moves underneath.
        const canvasWidth = canvas.width / dpr;
        const canvasHeight = canvas.height / dpr;

        // Calculate the starting offset for grid lines so they appear aligned
        // with the image's pan position if it were not fixed.
        // This makes the fixed grid appear as if it's an extension of the image's grid.
        const startGridX = - (offsetX % scaledGridSize);
        const startGridY = - (offsetY % scaledGridSize);

        // Draw vertical lines across the visible canvas area
        for (let x = startGridX; x < canvasWidth; x += scaledGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }

        // Draw horizontal lines across the visible canvas area
        for (let y = startGridY; y < canvasHeight; y += scaledGridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }

    } else {
        // Floating grid (moves with image): Lines are relative to image origin.
        // Draw vertical lines
        for (let k = 0; (k * scaledGridSize) <= imgDisplayWidth; k++) {
            const x = imgDisplayX + (k * scaledGridSize);
            ctx.beginPath();
            ctx.moveTo(x, imgDisplayY);
            ctx.lineTo(x, imgDisplayY + imgDisplayHeight);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let k = 0; (k * scaledGridSize) <= imgDisplayHeight; k++) {
            const y = imgDisplayY + (k * scaledGridSize);
            ctx.beginPath();
            ctx.moveTo(imgDisplayX, y);
            ctx.lineTo(imgDisplayX + imgDisplayWidth, y);
            ctx.stroke();
        }
    }

    ctx.restore(); // Restore context to remove clipping
}

// Add function to handle TIFF files
async function loadTiffImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // Use the UTIF.js library to process the TIFF file
                const buffer = e.target.result;
                const ifds = UTIF.decode(buffer);
                if (!ifds || ifds.length === 0) {
                    reject(new Error('No valid TIFF image found in file'));
                    return;
                }
                
                // Get the first image from the TIFF file
                const tiffImg = ifds[0];
                UTIF.decodeImage(buffer, tiffImg);
                
                // Create a canvas to render the TIFF image
                const canvas = document.createElement('canvas');
                canvas.width = tiffImg.width;
                canvas.height = tiffImg.height;
                
                // Get RGBA data from TIFF image
                const rgba = UTIF.toRGBA8(tiffImg);
                
                // Draw the image data to the canvas
                const ctx = canvas.getContext('2d');
                const imgData = ctx.createImageData(tiffImg.width, tiffImg.height);
                
                // Copy the RGBA data to the canvas image data
                for (let i = 0; i < rgba.length; i++) {
                    imgData.data[i] = rgba[i];
                }
                
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas);
            } catch (error) {
                console.error('Error processing TIFF file:', error);
                reject(error);
            }
        };
        reader.onerror = function() {
            reject(new Error('Failed to read TIFF file'));
        };
        reader.readAsArrayBuffer(file);
    });
}

// Modify the loadImage function to handle TIFF files
function loadImage(file) {
    loadingDiv.style.display = 'block';
    
    // Check if the file is a TIFF file
    const filename = file.name.toLowerCase();
    if (filename.endsWith('.tif') || filename.endsWith('.tiff')) {
        // Handle TIFF files
        loadTiffImage(file).then(canvas => {
            // Create an image from the canvas
            image = new Image();
            image.onload = () => {
                const offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = image.width;
                offscreenCanvas.height = image.height;
                const offscreenCtx = offscreenCanvas.getContext('2d');
                offscreenCtx.drawImage(image, 0, 0);
                imageData = offscreenCtx.getImageData(0, 0, image.width, image.height);
                
                resetView();
                loadingDiv.style.display = 'none';
                updateInfo();
            };
            image.onerror = (err) => {
                console.error('Failed to load image from TIFF canvas:', err);
                loadingDiv.style.display = 'none';
                alert('Failed to load image from TIFF data');
            };
            // Convert canvas to data URL and set as image source
            try {
                image.src = canvas.toDataURL('image/png');
            } catch (e) {
                console.error('Error converting canvas to data URL:', e);
                loadingDiv.style.display = 'none';
                alert('Error converting TIFF data to displayable format');
            }
        }).catch(error => {
            console.error('Failed to load TIFF file:', error);
            loadingDiv.style.display = 'none';
            alert('Failed to load TIFF file: ' + error.message);
        });
    } else {
        // Handle other image formats with the existing code
        const url = URL.createObjectURL(file);
        image = new Image();
        image.onload = () => {
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = image.width;
            offscreenCanvas.height = image.height;
            const offscreenCtx = offscreenCanvas.getContext('2d');
            offscreenCtx.drawImage(image, 0, 0);
            imageData = offscreenCtx.getImageData(0, 0, image.width, image.height);

            resetView();
            loadingDiv.style.display = 'none';
            updateInfo();
        };
        image.onerror = (err) => {
            console.error('Failed to load image:', err);
            loadingDiv.style.display = 'none';
            alert('Failed to load image: ' + file.name);
        };
        image.src = url;
    }
}

// Function to wrap the original loadImage with thumbnail selection
function loadImageWithThumbnails(file) {
    // Call the original function
    loadImage(file);
    
    // Find the index of this file in our image files array
    const index = imageFiles.findIndex(imgFile => imgFile.name === file.name);
    if (index !== -1) {
        selectedImageIndex = index;
        // Update thumbnail selection
        const thumbnails = document.querySelectorAll('.thumbnail-item');
        thumbnails.forEach(thumbnail => {
            thumbnail.classList.remove('active');
        });
        
        const selectedThumbnail = document.querySelector(`.thumbnail-item[data-index="${index}"]`);
        if (selectedThumbnail) {
            selectedThumbnail.classList.add('active');
        }
    }
}

function render() {
    if (!image) return;

    // Get the current canvas dimensions
    const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

    // Clear the entire canvas
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context, apply transformations, and draw the image
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.drawImage(image, 0, 0);
    ctx.restore();

    // Draw grid overlay if enabled
    drawGrid();
}

function updateInfo() {
    if (!image) return;
    infoPanel.innerHTML = `
        Image Size: ${image.width} × ${image.height}<br>
        Zoom: ${(zoomLevel * 100).toFixed(0)}%<br>
        Position: ${Math.round(offsetX)}, ${Math.round(offsetY)}
        ${image ? '<br><span class="drag-hint">Ctrl+Drag to OCR</span>' : ''}
    `;
}

// Initial setup
resizeCanvas();

document.getElementById('projection-btn').addEventListener('click', () => {
    if (!imageData) {
        alert("No image loaded!");
        return;
    }

    const { width, height, data } = imageData;

    // Detect image format
    const channelCount = data.length / (width * height);
    const isRGBA = channelCount === 4; // RGBA format
    const isGrayscale = channelCount === 1; // Grayscale format

    console.log(`Image Format: Grayscale=${isGrayscale}, RGBA=${isRGBA}, Channels=${channelCount}`);

    const horizontalProfile = new Float64Array(height).fill(0);
    const verticalProfile = new Float64Array(width).fill(0);

    // Calculate projection profiles
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * (isRGBA ? 4 : 1); // Adjust for color depth
            let intensity = 0.0;

            if (isRGBA) {
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3]; // Alpha channel

                // Handle transparency
                if (a === 0) continue;

                // Average RGB values and invert intensity
                intensity = 255 - (r + g + b) / 3.0;
            } else {
                // Grayscale intensity directly, inverted
                intensity = 255 - data[index] * 1.0;
            }

            // Accumulate inverted intensity for projection profiles
            horizontalProfile[y] += intensity;
            verticalProfile[x] += intensity;
        }
    }

    // Pass profiles to the displayProjection function
    displayProjection(horizontalProfile, verticalProfile, image);
});

// Create tooltip element function
function createTooltip() {
    // First check if tooltip already exists
    let tooltip = document.getElementById('graph-tooltip');
    if (tooltip) {
        console.log('Tooltip already exists, no need to recreate');
        return tooltip;
    }
    
    // Check if projection overlay exists
    const projectionOverlay = document.getElementById('projection-overlay');
    
    // Create new tooltip
    tooltip = document.createElement('div');
    tooltip.id = 'graph-tooltip';
    tooltip.className = 'graph-tooltip';
    
    // Apply inline styles to ensure visibility regardless of CSS loading
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.zIndex = '10000';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    tooltip.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
    tooltip.style.border = '1px solid #444';
    
    // Add to projection overlay if it exists, otherwise to document body
    if (projectionOverlay) {
        projectionOverlay.appendChild(tooltip);
        console.log('Created new tooltip element in projection overlay');
    } else {
        document.body.appendChild(tooltip);
        console.log('Created new tooltip element in document body');
    }
    
    return tooltip;
}

function displayProjection(horizontal, vertical, image) {
    // Create tooltip element for measurements
    createTooltip();
    
    // Define max dimensions for the image preview canvas attributes
    const previewBoxMaxWidth = 600; 
    const previewBoxMaxHeight = 450;
    // Define minimum dimensions to ensure small images are scaled up
    const previewBoxMinWidth = 300;
    const previewBoxMinHeight = 200;

    const imgOriginalWidth = image.width;
    const imgOriginalHeight = image.height;
    const imgAspectRatio = imgOriginalWidth / imgOriginalHeight;

    let imgCanvasRenderWidth = imgOriginalWidth;
    let imgCanvasRenderHeight = imgOriginalHeight;

    // First check if the image is too small, scale up if needed while preserving aspect ratio
    if (imgCanvasRenderWidth < previewBoxMinWidth && imgCanvasRenderHeight < previewBoxMinHeight) {
        if (imgAspectRatio >= 1) {
            // Width is larger than height, scale to min width
            imgCanvasRenderWidth = previewBoxMinWidth;
            imgCanvasRenderHeight = imgCanvasRenderWidth / imgAspectRatio;
        } else {
            // Height is larger than width, scale to min height
            imgCanvasRenderHeight = previewBoxMinHeight;
            imgCanvasRenderWidth = imgCanvasRenderHeight * imgAspectRatio;
        }
    }

    // Then check if it's too big and scale down if needed
    if (imgCanvasRenderWidth > previewBoxMaxWidth) {
        imgCanvasRenderWidth = previewBoxMaxWidth;
        imgCanvasRenderHeight = imgCanvasRenderWidth / imgAspectRatio;
    }
    // Then, adjust if it exceeds previewBoxMaxHeight, preserving aspect ratio
    if (imgCanvasRenderHeight > previewBoxMaxHeight) {
        imgCanvasRenderHeight = previewBoxMaxHeight;
        imgCanvasRenderWidth = imgCanvasRenderHeight * imgAspectRatio;
    }
    // Final check on width if height adjustment made it too wide (for very tall, thin images)
    if (imgCanvasRenderWidth > previewBoxMaxWidth) {
        imgCanvasRenderWidth = previewBoxMaxWidth;
        imgCanvasRenderHeight = imgCanvasRenderWidth / imgAspectRatio;
    }

    // Ensure integer values for canvas attributes
    const finalImageWidth = Math.round(imgCanvasRenderWidth);
    const finalImageHeight = Math.round(imgCanvasRenderHeight);

    console.log(`Final image dimensions: ${finalImageWidth}x${finalImageHeight}`);
    
    // Fixed sizes for the graph dimensions that don't match the image
    const horizontalGraphWidth = 100; // Width of the horizontal projection graphs
    const verticalGraphHeight = 80;   // Height of the vertical projection graphs

    const projectionButton = document.getElementById('projection-btn');
    projectionButton.disabled = true;
    projectionButton.classList.add('disabled');

    const projectionOverlay = document.createElement('div');
    projectionOverlay.id = 'projection-overlay';
    projectionOverlay.className = 'projection-layout';

    // Create the HTML layout with EXACT matching dimensions
    projectionOverlay.innerHTML = `
        <div class="projection-main-area">
            <div class="projection-top-row">
                <div class="primary-image-col">
                    <canvas id="image-canvas" width="${finalImageWidth}" height="${finalImageHeight}"></canvas>
                    <div class="graph-container horizontal">
                        <canvas id="primary-vertical-projection-graph" width="${finalImageWidth}" height="${verticalGraphHeight}"></canvas>
                        <div class="graph-label">Primary Vertical Projection</div>
                    </div>
                    <div class="graph-container horizontal">
                        <canvas id="secondary-vertical-projection-graph" width="${finalImageWidth}" height="${verticalGraphHeight}"></canvas>
                        <div class="graph-label">Secondary Vertical Graph</div>
                    </div>
                    <div id="bottom-main-analysis-pane" class="analysis-pane">
                        <h3>Bottom Analysis Pane</h3>
                        <div class="analysis-content">
                            <p>Future analysis will appear here</p>
                        </div>
                    </div>
                </div>
                <div class="right-section">
                    <div class="horizontal-graphs-row">
                        <div class="graph-container vertical">
                            <canvas id="primary-horizontal-projection-graph" width="${horizontalGraphWidth}" height="${finalImageHeight}"></canvas>
                            <div class="graph-label">Horizontal Projection</div>
                        </div>
                        <div class="graph-container vertical">
                            <canvas id="secondary-horizontal-projection-graph" width="${horizontalGraphWidth}" height="${finalImageHeight}"></canvas>
                            <div class="graph-label">Secondary Horizontal Graph</div>
                        </div>
                    </div>
                    <div id="right-analysis-pane" class="analysis-pane">
                        <h3>Right Analysis Pane</h3>
                        <div class="analysis-content">
                            <p>Future analysis will appear here</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="projection-controls">
            <div class="algorithm-buttons">
                <h3>Algorithm Controls</h3>
                <button id="algo-btn-1" class="algo-btn">LPF</button>
                <button id="algo-btn-2" class="algo-btn">Derivative</button>
                <button id="algo-btn-3" class="algo-btn">Deriv + FFT</button>
                <button id="algo-btn-4" class="algo-btn">Mod+FFT</button>
                <button id="algo-btn-5" class="algo-btn">Algorithm 5</button>
                <button id="algo-btn-6" class="algo-btn">Algorithm 6</button>
                <button id="algo-btn-7" class="algo-btn">Algorithm 7</button>
                <button id="algo-btn-8" class="algo-btn">Algorithm 8</button>
                <button id="algo-btn-9" class="algo-btn">Algorithm 9</button>
                <button id="algo-btn-10" class="algo-btn">Algorithm 10</button>
            </div>
            <div class="view-controls">
                <button id="toggle-layout-mode">Toggle Layout Mode</button>
                <button id="full-screen-projection">Full Screen</button>
                <button id="close-projection">Close</button>
            </div>
        </div>
    `;
    
    // Add the overlay to the document
    document.body.appendChild(projectionOverlay);
    
    // Set initial state (not in custom layout mode)
    const projectionLayout = projectionOverlay;
    if (projectionLayout) {
        projectionLayout.classList.remove('custom-layout');
    }
    
    // Set initial button text
    const toggleLayoutBtn = projectionOverlay.querySelector('#toggle-layout-mode');
    if (toggleLayoutBtn) {
        toggleLayoutBtn.textContent = 'Enable Custom Layout';
        
        // Handle layout toggle - create simpler direct implementation
        toggleLayoutBtn.addEventListener('click', function() {
            const layout = projectionOverlay;
            
            if (layout.classList.contains('custom-layout')) {
                // Switch to fixed layout
                layout.classList.remove('custom-layout');
                this.textContent = 'Enable Custom Layout';
                
                // Get all draggable elements and reset their positions
                const draggableElements = layout.querySelectorAll('.draggable');
                draggableElements.forEach(element => {
                    // Reset positioning
                    element.style.position = '';
                    element.style.left = '';
                    element.style.top = '';
                    element.style.width = '';
                    element.style.height = '';
                    element.style.flex = '';
                });
                
                console.log('Reverted to fixed layout');
                
            } else {
                // Switch to custom layout
                layout.classList.add('custom-layout');
                this.textContent = 'Reset to Fixed Layout';
                
                console.log('Switched to custom layout');
                
                // Initialize layout manager using a simpler approach
                try {
                    const container = layout.querySelector('.projection-main-area');
                    if (!container) {
                        console.error('Could not find projection-main-area');
                        return;
                    }
                    
                    const elements = [
                        ...container.querySelectorAll('.analysis-pane'),
                        ...container.querySelectorAll('.graph-container')
                    ];
                    
                    console.log(`Found ${elements.length} elements to make draggable`);
                    
                    // Make each element draggable with a simpler implementation
                    elements.forEach(element => {
                        makeElementDraggable(element, container);
                    });
                    
                } catch (err) {
                    console.error('Error setting up draggable elements:', err);
                }
            }
        });
    }
    
    // Initialize the layout manager to make components draggable and resizable
    console.log('Using simpler layout implementation rather than layout_manager.js');
    
    // Get references to all canvases
    const imageCanvas = document.getElementById('image-canvas');
    const primaryVerticalProjectionGraph = document.getElementById('primary-vertical-projection-graph');
    const secondaryVerticalProjectionGraph = document.getElementById('secondary-vertical-projection-graph');
    const primaryHorizontalProjectionGraph = document.getElementById('primary-horizontal-projection-graph');
    const secondaryHorizontalProjectionGraph = document.getElementById('secondary-horizontal-projection-graph');
    
    // Add CSS style to ensure graphs are displayed with correct dimensions
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #image-canvas {
            width: ${finalImageWidth}px;
            height: ${finalImageHeight}px;
        }
        
        /* Force vertical graphs (horizontal projections on right) to be exactly as tall as image */
        #primary-horizontal-projection-graph, 
        #secondary-horizontal-projection-graph {
            height: ${finalImageHeight}px !important;
            width: ${horizontalGraphWidth}px;
        }
        
        /* Force horizontal graphs (vertical projections on bottom) to be exactly as wide as image */
        #primary-vertical-projection-graph,
        #secondary-vertical-projection-graph {
            width: ${finalImageWidth}px !important;
            height: ${verticalGraphHeight}px;
        }
        
        /* Ensure the graph containers also respect these dimensions */
        .graph-container.vertical {
            height: ${finalImageHeight}px !important;
        }
        
        .graph-container.horizontal {
            width: ${finalImageWidth}px !important; 
        }
    `;
    document.head.appendChild(styleElement);
    
    // Get all drawing contexts
    const imageCtx = imageCanvas.getContext('2d');
    const primaryHorizontalProjectionGraphCtx = primaryHorizontalProjectionGraph.getContext('2d');
    const primaryVerticalProjectionGraphCtx = primaryVerticalProjectionGraph.getContext('2d');
    const secondaryHorizontalProjectionGraphCtx = secondaryHorizontalProjectionGraph.getContext('2d');
    const secondaryVerticalProjectionGraphCtx = secondaryVerticalProjectionGraph.getContext('2d');

    // Make sure all contexts are cleared before drawing
    imageCtx.clearRect(0, 0, finalImageWidth, finalImageHeight);
    primaryHorizontalProjectionGraphCtx.clearRect(0, 0, horizontalGraphWidth, finalImageHeight);
    secondaryHorizontalProjectionGraphCtx.clearRect(0, 0, horizontalGraphWidth, finalImageHeight);
    primaryVerticalProjectionGraphCtx.clearRect(0, 0, finalImageWidth, verticalGraphHeight);
    secondaryVerticalProjectionGraphCtx.clearRect(0, 0, finalImageWidth, verticalGraphHeight);

    // STEP 1: Draw the main image with sharp rendering
    imageCtx.imageSmoothingEnabled = false;
    imageCtx.mozImageSmoothingEnabled = false;
    imageCtx.webkitImageSmoothingEnabled = false;
    imageCtx.msImageSmoothingEnabled = false;
    
    // Draw the image
    imageCtx.drawImage(image, 0, 0, finalImageWidth, finalImageHeight);
    
    // STEP 2: Normalize the projection data for visualization
    const normalize = (array, maxValue) => array.map(value => (value / maxValue) || 0);
    
    const maxHorizontal = Math.max(...horizontal);
    const maxVertical = Math.max(...vertical);
    
    const normalizedHorizontal = normalize(horizontal, maxHorizontal);
    const normalizedVertical = normalize(vertical, maxVertical);
    
    // STEP 3: Draw PRIMARY horizontal projection (right side, vertical graph)
    // Maps image Y-coordinates to graph Y-position
    primaryHorizontalProjectionGraphCtx.beginPath();
    primaryHorizontalProjectionGraphCtx.strokeStyle = 'white';
    primaryHorizontalProjectionGraphCtx.lineWidth = 2;
    
    // Make sure we use exactly the finalImageHeight for scaling to match image precisely
    for (let i = 0; i < normalizedHorizontal.length; i++) {
        // Map y-position to match exact image height
        const y = (i / normalizedHorizontal.length) * finalImageHeight;
        // Scale x value from left edge (0) to right based on intensity
        const x = normalizedHorizontal[i] * horizontalGraphWidth;
        
        if (i === 0) {
            primaryHorizontalProjectionGraphCtx.moveTo(0, y);
        }
        primaryHorizontalProjectionGraphCtx.lineTo(x, y);
    }
    primaryHorizontalProjectionGraphCtx.stroke();
    
    // STEP 4: Draw SECONDARY horizontal projection (right side, vertical graph)
    // Also maps image Y-coordinates to graph Y-position but with different styling
    secondaryHorizontalProjectionGraphCtx.beginPath();
    secondaryHorizontalProjectionGraphCtx.strokeStyle = '#4a90e2'; // Blue
    secondaryHorizontalProjectionGraphCtx.lineWidth = 2;
    
    // Also use exactly the finalImageHeight to match image precisely
    for (let i = 0; i < normalizedHorizontal.length; i++) {
        // Exact same y-mapping as primary to match image height
        const y = (i / normalizedHorizontal.length) * finalImageHeight;
        // Different visualization but still based on the same data
        const x = (normalizedHorizontal[i] * 0.8 + 0.1) * horizontalGraphWidth;
        
        if (i === 0) {
            secondaryHorizontalProjectionGraphCtx.moveTo(0, y);
        }
        secondaryHorizontalProjectionGraphCtx.lineTo(x, y);
    }
    secondaryHorizontalProjectionGraphCtx.stroke();
    
    // STEP 5: Draw PRIMARY vertical projection (bottom, horizontal graph)
    // Maps image X-coordinates to graph X-position
    primaryVerticalProjectionGraphCtx.beginPath();
    primaryVerticalProjectionGraphCtx.strokeStyle = 'white';
    primaryVerticalProjectionGraphCtx.lineWidth = 2;
    
    for (let i = 0; i < normalizedVertical.length; i++) {
        // Map x-position to match exact image width
        const x = (i / normalizedVertical.length) * finalImageWidth;
        // Draw from bottom to top based on intensity
        const yStart = verticalGraphHeight;
        const yEnd = verticalGraphHeight - (normalizedVertical[i] * verticalGraphHeight);
        
        if (i === 0) {
            primaryVerticalProjectionGraphCtx.moveTo(x, yStart);
        }
        primaryVerticalProjectionGraphCtx.lineTo(x, yEnd);
    }
    primaryVerticalProjectionGraphCtx.stroke();
    
    // STEP 6: Draw SECONDARY vertical projection (bottom, horizontal graph)
    // Also maps image X-coordinates to graph X-position but with different styling
    secondaryVerticalProjectionGraphCtx.beginPath();
    secondaryVerticalProjectionGraphCtx.strokeStyle = '#72c02c'; // Green
    secondaryVerticalProjectionGraphCtx.lineWidth = 2;
    
    for (let i = 0; i < normalizedVertical.length; i++) {
        // Exact same x-mapping as primary to match image width
        const x = (i / normalizedVertical.length) * finalImageWidth;
        // Draw from bottom to top with a slightly different pattern
        const yStart = verticalGraphHeight;
        const yEnd = verticalGraphHeight - (normalizedVertical[i] * verticalGraphHeight * 0.9);
        
        if (i === 0) {
            secondaryVerticalProjectionGraphCtx.moveTo(x, yStart);
        }
        secondaryVerticalProjectionGraphCtx.lineTo(x, yEnd);
    }
    secondaryVerticalProjectionGraphCtx.stroke();
    
    // Clean up function to ensure proper removal of all elements
    const cleanup = () => {
        // Remove the style element
        if (document.head.contains(styleElement)) {
            document.head.removeChild(styleElement);
        }
        
        // Remove the overlay
        if (document.body.contains(projectionOverlay)) {
            document.body.removeChild(projectionOverlay);
        }
        
        // Re-enable the button
        projectionButton.disabled = false;
        projectionButton.classList.remove('disabled');
        
        console.log('Projection display cleaned up');
    };
    
    // Set up algorithm button handlers
    setupAlgorithmButtons(horizontal, vertical, 
                         primaryHorizontalProjectionGraphCtx, primaryVerticalProjectionGraphCtx,
                         secondaryHorizontalProjectionGraphCtx, secondaryVerticalProjectionGraphCtx,
                         horizontalGraphWidth, finalImageHeight, 
                         finalImageWidth, verticalGraphHeight);

    // Set up close button handler
    document.getElementById('close-projection').addEventListener('click', function() {
        // Ensure proper cleanup and removal
        if (document.fullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
        
        cleanup();
    });

    // Handle fullscreen toggle
    document.getElementById('full-screen-projection').addEventListener('click', function() {
        const overlay = document.getElementById('projection-overlay');
        
        if (!document.fullscreenElement) {
            if (overlay.requestFullscreen) overlay.requestFullscreen();
            else if (overlay.webkitRequestFullscreen) overlay.webkitRequestFullscreen();
            else if (overlay.msRequestFullscreen) overlay.msRequestFullscreen();
            
            this.textContent = 'Exit Full Screen';
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
            
            this.textContent = 'Full Screen';
        }
    });
    
    // Handle layout toggle
    document.getElementById('toggle-layout-mode').addEventListener('click', function() {
        const layout = document.querySelector('.projection-layout');
        
        if (layout.classList.contains('custom-layout')) {
            // Switch to fixed layout
            layout.classList.remove('custom-layout');
            this.textContent = 'Enable Custom Layout';
            
            // Reset positions of all draggable elements
            if (window.projectionLayoutManager) {
                window.projectionLayoutManager.draggableElements.forEach(item => {
                    window.projectionLayoutManager.resetElementPosition(item.element);
                });
            }
        } else {
            // Switch to custom layout
            layout.classList.add('custom-layout');
            this.textContent = 'Reset to Fixed Layout';
            
            // Initialize layout manager if not already done
            if (window.projectionLayoutManager) {
                window.projectionLayoutManager.init();
            } else if (typeof initLayoutManager === 'function') {
                initLayoutManager();
            }
        }
    });
    
    // Return the cleanup function in case it's needed elsewhere
    return cleanup;
}


// Helper function to set up algorithm buttons
function setupAlgorithmButtons(horizontalProfile, verticalProfile, 
                             primaryHorizCtx, primaryVertCtx,
                             secondaryHorizCtx, secondaryVertCtx,
                             horizGraphWidth, horizGraphHeight,
                             vertGraphWidth, vertGraphHeight) {
    
    // Debug function to help diagnose tooltip issues
    function debugAlgorithmClick(algorithmNumber) {
        console.log(`Algorithm ${algorithmNumber} button clicked`);
        console.log(`Horizontal projection data length: ${horizontalProfile.length}`);
        console.log(`Vertical projection data length: ${verticalProfile.length}`);
        
        // Log canvas element references
        console.log('Secondary horizontal canvas:', secondaryHorizCtx.canvas);
        console.log('Secondary vertical canvas:', secondaryVertCtx.canvas);
        
        // Report if tooltips exist
        const tooltip = document.getElementById('graph-tooltip');
        console.log('Tooltip element exists:', !!tooltip);
    }
    
    for (let i = 1; i <= 10; i++) {
        const button = document.getElementById(`algo-btn-${i}`);
        if (!button) continue;
        
        button.addEventListener('click', function() {
            // Debug logging
            debugAlgorithmClick(i);
            
            // Update results display
            document.getElementById('right-analysis-pane').innerHTML = `
                <h3>Algorithm ${i} Results</h3>
                <div class="analysis-content">
                    <p>Results from Algorithm ${i} (operating on full-resolution data) will appear here.</p>
                    <p>Full-res image: ${horizontalProfile.length}x${verticalProfile.length}</p>
                    <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                </div>
            `;
            
            // Redraw secondary graphs with different visualizations
            updateSecondaryGraphs(i, horizontalProfile, verticalProfile, 
                               secondaryHorizCtx, secondaryVertCtx,
                               horizGraphWidth, horizGraphHeight,
                               vertGraphWidth, vertGraphHeight);
        });
    }
}

// Function to update secondary graphs based on algorithm selection
function updateSecondaryGraphs(algorithm, horizontalProfile, verticalProfile, 
                             horizCtx, vertCtx,
                             horizWidth, horizHeight,
                             vertWidth, vertHeight) {
    // Normalize function (remains the same)
    const normalize = (array, maxValue) => array.map(value => (value / Math.max(0.00001, maxValue)) || 0); // Added Math.max to avoid div by zero
    
    // Color selection based on algorithm
    const colors = ['#4a90e2', '#72c02c', '#e74c3c', '#f39c12', '#9b59b6', 
                  '#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#1abc9c'];
    
    // Clear previous content
    horizCtx.clearRect(0, 0, horizWidth, horizHeight);
    vertCtx.clearRect(0, 0, vertWidth, vertHeight);
    
    // Data for plotting
    let plotDataHorizontal, plotDataVertical;
    let isDerivativeMode = false;
    
    // For derivative mode, store raw data for proper grid markers
    let rawDerivHorizontal, rawDerivVertical;
    let minDerivHorizontal, maxDerivHorizontal, minDerivVertical, maxDerivVertical;
    
    // Declare FFT data variables to avoid ReferenceError
    let fftHorizontal = null;
    let fftVertical = null;

    switch(algorithm) {
        case 1: // LPF button
            {
                const lpfWindowSize = 15; // Increased window size for more noticeable smoothing
                const filteredHorizontal = applyLPF(horizontalProfile, lpfWindowSize);
                const filteredVertical = applyLPF(verticalProfile, lpfWindowSize);

                plotDataHorizontal = normalize(filteredHorizontal, Math.max(...filteredHorizontal));
                plotDataVertical = normalize(filteredVertical, Math.max(...filteredVertical));
                
                // Update analysis pane with LPF information
                document.getElementById('right-analysis-pane').innerHTML = `
                    <h3>Low Pass Filter Results</h3>
                    <div class="analysis-content">
                        <p>Applied moving average filter with window size: ${lpfWindowSize}</p>
                        <p>This filter smooths the signal by reducing high-frequency components.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
            }
            break;
        case 2: // Derivative button
            {
                isDerivativeMode = true;
                
                // Calculate derivatives
                rawDerivHorizontal = calculateDerivative(horizontalProfile);
                rawDerivVertical = calculateDerivative(verticalProfile);
                
                // Find min/max values for proper scaling and grid marking
                minDerivHorizontal = Math.min(...rawDerivHorizontal);
                maxDerivHorizontal = Math.max(...rawDerivHorizontal);
                minDerivVertical = Math.min(...rawDerivVertical);
                maxDerivVertical = Math.max(...rawDerivVertical);
                
                // Find max absolute value for proper normalization (derivative can be positive or negative)
                const maxAbsHorizontal = Math.max(Math.abs(minDerivHorizontal), Math.abs(maxDerivHorizontal));
                const maxAbsVertical = Math.max(Math.abs(minDerivVertical), Math.abs(maxDerivVertical));
                
                // Create normalized derivative values for display (map -1...1 to 0...1)
                plotDataHorizontal = rawDerivHorizontal.map(v => 0.5 + (v / (2 * maxAbsHorizontal + 0.00001)));
                plotDataVertical = rawDerivVertical.map(v => 0.5 + (v / (2 * maxAbsVertical + 0.00001)));
                
                // Update analysis pane with derivative information
                document.getElementById('right-analysis-pane').innerHTML = `
                    <h3>Derivative Results</h3>
                    <div class="analysis-content">
                        <p>First derivative shows rate of change at each point.</p>
                        <p>Horizontal Derivative: Min=${minDerivHorizontal.toFixed(2)}, Max=${maxDerivHorizontal.toFixed(2)}</p>
                        <p>Vertical Derivative: Min=${minDerivVertical.toFixed(2)}, Max=${maxDerivVertical.toFixed(2)}</p>
                        <p>Zero-crossings indicate local maxima and minima in the original signal.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
            }
            break;
        case 3: // Derivative + FFT
            {
                // Modified to use Derivative + FFT
                // Assign to the outer scope variables
                fftHorizontal = calculateDerivativeFFT(horizontalProfile);
                fftVertical = calculateDerivativeFFT(verticalProfile);
                
                const originalHorizontalLength = horizontalProfile.length;
                const originalVerticalLength = verticalProfile.length;

                // Find top peaks in FFT results
                let horizontalPeaksRaw = findFFTPeaks(fftHorizontal, 8, originalHorizontalLength);
                let verticalPeaksRaw = findFFTPeaks(fftVertical, 8, originalVerticalLength);

                // Use peaks directly - they now have correct frequency calculations
                const horizontalPeaks = horizontalPeaksRaw;
                const verticalPeaks = verticalPeaksRaw;
                
                // Normalize FFT results
                plotDataHorizontal = normalize(fftHorizontal, Math.max(...fftHorizontal));
                plotDataVertical = normalize(fftVertical, Math.max(...fftVertical));
                
                // Create a special mode for FFT visualization - it's a frequency spectrum
                isDerivativeMode = true; // Use line chart
                
                // Store min/max values for grid rendering
                minDerivHorizontal = 0; // FFT magnitudes are always positive
                maxDerivHorizontal = Math.max(...fftHorizontal);
                minDerivVertical = 0;
                maxDerivVertical = Math.max(...fftVertical);
                
                // Update RIGHT analysis pane with Horizontal FFT information (from rows/horizontal projection)
                document.getElementById('right-analysis-pane').innerHTML = `
                    <h3>Horizontal Proj. FFT Peaks</h3>
                    <div class="analysis-content">
                        <p>Derivative + FFT analysis of horizontal projection:</p>
                        <table class="peak-table">
                            <tr>
                                <th>Rank</th>
                                <th>Bin</th>
                                <th>Frequency</th>
                                <th>λ (pixels)</th>
                                <th>Magnitude</th>
                            </tr>
                            ${horizontalPeaks.map((peak, i) => `
                                <tr>
                                    <td>${i+1}</td>
                                    <td>${peak.index}</td>
                                    <td>${peak.frequency.toFixed(4)} c/px</td>
                                    <td>${peak.wavelength.toFixed(1)}</td>
                                    <td>${peak.magnitude.toFixed(1)}</td>
                                </tr>
                            `).join('')}
                        </table>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                
                // Update BOTTOM analysis pane with Vertical FFT information (from columns/vertical projection)
                document.getElementById('bottom-main-analysis-pane').innerHTML = `
                    <h3>Vertical Proj. FFT Peaks</h3>
                    <div class="analysis-content">
                        <p>Derivative + FFT analysis of vertical projection:</p>
                        <table class="peak-table">
                            <tr>
                                <th>Rank</th>
                                <th>Bin</th>
                                <th>Frequency</th>
                                <th>λ (pixels)</th>
                                <th>Magnitude</th>
                            </tr>
                            ${verticalPeaks.map((peak, i) => `
                                <tr>
                                    <td>${i+1}</td>
                                    <td>${peak.index}</td>
                                    <td>${peak.frequency.toFixed(4)} c/px</td>
                                    <td>${peak.wavelength.toFixed(1)}</td>
                                    <td>${peak.magnitude.toFixed(1)}</td>
                                </tr>
                            `).join('')}
                        </table>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
            }
            break;
        case 4: // Algorithm 4 - Mod(Derivative) + FFT
            {
                // Use Mod(Derivative) + FFT
                // Assign to the outer scope variables
                fftHorizontal = calculateModDerivativeFFT(horizontalProfile);
                fftVertical = calculateModDerivativeFFT(verticalProfile);
                
                const originalHorizontalLength = horizontalProfile.length;
                const originalVerticalLength = verticalProfile.length;

                // Find top peaks in FFT results
                let horizontalPeaksRaw = findFFTPeaks(fftHorizontal, 8, originalHorizontalLength);
                let verticalPeaksRaw = findFFTPeaks(fftVertical, 8, originalVerticalLength);

                // Use peaks directly - they now have correct frequency calculations
                const horizontalPeaks = horizontalPeaksRaw;
                const verticalPeaks = verticalPeaksRaw;
                
                // Normalize FFT results
                plotDataHorizontal = normalize(fftHorizontal, Math.max(...fftHorizontal));
                plotDataVertical = normalize(fftVertical, Math.max(...fftVertical));
                
                // Create a special mode for FFT visualization - it's a frequency spectrum
                isDerivativeMode = true; // Use line chart
                
                // Store min/max values for grid rendering
                minDerivHorizontal = 0; // FFT magnitudes are always positive
                maxDerivHorizontal = Math.max(...fftHorizontal);
                minDerivVertical = 0;
                maxDerivVertical = Math.max(...fftVertical);
                
                // Update RIGHT analysis pane with Horizontal FFT information (from rows/horizontal projection)
                document.getElementById('right-analysis-pane').innerHTML = `
                    <h3>Horizontal Proj. |Deriv|+FFT Peaks</h3>
                    <div class="analysis-content">
                        <p>|Derivative| + FFT analysis of horizontal projection:</p>
                        <table class="peak-table">
                            <tr>
                                <th>Rank</th>
                                <th>Bin</th>
                                <th>Frequency</th>
                                <th>λ (pixels)</th>
                                <th>Magnitude</th>
                            </tr>
                            ${horizontalPeaks.map((peak, i) => `
                                <tr>
                                    <td>${i+1}</td>
                                    <td>${peak.index}</td>
                                    <td>${peak.frequency.toFixed(4)} c/px</td>
                                    <td>${peak.wavelength.toFixed(1)}</td>
                                    <td>${peak.magnitude.toFixed(1)}</td>
                                </tr>
                            `).join('')}
                        </table>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                
                // Update BOTTOM analysis pane with Vertical FFT information (from columns/vertical projection)
                document.getElementById('bottom-main-analysis-pane').innerHTML = `
                    <h3>Vertical Proj. |Deriv|+FFT Peaks</h3>
                    <div class="analysis-content">
                        <p>|Derivative| + FFT analysis of vertical projection:</p>
                        <table class="peak-table">
                            <tr>
                                <th>Rank</th>
                                <th>Bin</th>
                                <th>Frequency</th>
                                <th>λ (pixels)</th>
                                <th>Magnitude</th>
                            </tr>
                            ${verticalPeaks.map((peak, i) => `
                                <tr>
                                    <td>${i+1}</td>
                                    <td>${peak.index}</td>
                                    <td>${peak.frequency.toFixed(4)} c/px</td>
                                    <td>${peak.wavelength.toFixed(1)}</td>
                                    <td>${peak.magnitude.toFixed(1)}</td>
                                </tr>
                            `).join('')}
                        </table>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
            }
            break;
        default: // Algorithmic patterns (sine, step, etc.)
            {
                // For algorithmic patterns, we still need a base length from original profiles
                const baseHorizontalNormalized = normalize(horizontalProfile, Math.max(...horizontalProfile));
                const baseVerticalNormalized = normalize(verticalProfile, Math.max(...verticalProfile));
                
                // Generate pattern data of the same length
                plotDataHorizontal = new Array(baseHorizontalNormalized.length);
                plotDataVertical = new Array(baseVerticalNormalized.length);

                // Generate different pattern based on algorithm number
                for (let i = 0; i < baseHorizontalNormalized.length; i++) {
                    // Use algorithmic patterns for other buttons
                    plotDataHorizontal[i] = Math.abs(Math.sin(i * 0.1 * (algorithm % 3 + 1)) * 0.4 + 0.6);
                }

                for (let i = 0; i < baseVerticalNormalized.length; i++) {
                    // Use algorithmic patterns for other buttons
                    plotDataVertical[i] = Math.abs(Math.sin(i * 0.05 * (algorithm % 3 + 1)) * 0.4 + 0.3);
                }
                
                // Update analysis pane with algorithm information
                document.getElementById('right-analysis-pane').innerHTML = `
                    <h3>Algorithm ${algorithm} Results</h3>
                    <div class="analysis-content">
                        <p>Demonstrating pattern generation algorithm ${algorithm}.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
            }
            break;
    }
        
    // Draw HORIZONTAL projection (vertical graph on right) using plotDataHorizontal
    horizCtx.beginPath();
    horizCtx.strokeStyle = colors[(algorithm - 1) % colors.length];
    horizCtx.lineWidth = 2;
    
    if (isDerivativeMode) {
        // For derivative mode, draw a line chart instead of bars
        for (let i = 0; i < plotDataHorizontal.length; i++) {
            const y = (i / plotDataHorizontal.length) * horizHeight;
            const x_value = plotDataHorizontal[i] * horizWidth;
            
            if (i === 0) {
                horizCtx.moveTo(x_value, y);
            } else {
                horizCtx.lineTo(x_value, y);
            }
        }
    } else {
        // For other modes, draw bars as before
        for (let i = 0; i < plotDataHorizontal.length; i++) {
            const y = (i / plotDataHorizontal.length) * horizHeight;
            const x_value = plotDataHorizontal[i] * horizWidth;
            horizCtx.moveTo(0, y);
            horizCtx.lineTo(x_value, y);
        }
    }
    horizCtx.stroke();
    
    // Draw VERTICAL projection (horizontal graph at bottom) using plotDataVertical
    vertCtx.beginPath();
    // Use a consistent color indexing, e.g., (algorithm - 1) or ensure colors array is long enough
    vertCtx.strokeStyle = colors[Math.min(algorithm, colors.length -1)]; // Ensure valid index
    vertCtx.lineWidth = 2;
    
    if (isDerivativeMode) {
        // For derivative mode, draw a line chart instead of bars
        for (let i = 0; i < plotDataVertical.length; i++) {
            const x_coord = (i / plotDataVertical.length) * vertWidth;
            const y_value = (1 - plotDataVertical[i]) * vertHeight; // Flip Y since canvas Y is inverted
            
            if (i === 0) {
                vertCtx.moveTo(x_coord, y_value);
            } else {
                vertCtx.lineTo(x_coord, y_value);
            }
        }
    } else {
        // For other modes, draw bars as before
        for (let i = 0; i < plotDataVertical.length; i++) {
            const x_coord = (i / plotDataVertical.length) * vertWidth;
            const y_value_scaled = plotDataVertical[i] * vertHeight;
            const yStart = vertHeight;
            const yEnd = vertHeight - y_value_scaled;
            
            vertCtx.moveTo(x_coord, yStart);
            vertCtx.lineTo(x_coord, yEnd);
        }
    }
    vertCtx.stroke();
    
    // Now draw grids ON TOP of the data for both graphs
    if (isDerivativeMode) {
        // Add tooltip event handlers for measurements
        setupGraphTooltips(horizCtx, horizWidth, horizHeight, true, algorithm, 
                          horizontalProfile, plotDataHorizontal, 
                          algorithm === 3 || algorithm === 4 ? fftHorizontal : null,
                          algorithm === 2 ? rawDerivHorizontal : null);
                          
        setupGraphTooltips(vertCtx, vertWidth, vertHeight, false, algorithm,
                          verticalProfile, plotDataVertical,
                          algorithm === 3 || algorithm === 4 ? fftVertical : null,
                          algorithm === 2 ? rawDerivVertical : null);
                          
        if (algorithm === 3 || algorithm === 4) {
            // For FFT modes, use a frequency grid
            if (Array.isArray(fftHorizontal) && Array.isArray(fftVertical)) {
                drawFFTGrid(horizCtx, horizWidth, horizHeight, true, fftHorizontal.length, horizontalProfile.length);
                drawFFTGrid(vertCtx, vertWidth, vertHeight, false, fftVertical.length, verticalProfile.length);
            } else {
                console.error(`FFT data is invalid or null for algorithm ${algorithm}. Horizontal:`, fftHorizontal, `Vertical:`, fftVertical);
                // Fallback: Clear the canvas for secondary graphs if FFT data is invalid
                horizCtx.clearRect(0, 0, horizWidth, horizHeight);
                vertCtx.clearRect(0, 0, vertWidth, vertHeight);
                // Optionally, draw a default grid or a message
                drawGrid(horizCtx, horizWidth, horizHeight, true, false); 
                drawGrid(vertCtx, vertWidth, vertHeight, false, false);   
            }
        } else {
            // For standard derivative mode, pass the actual derivative ranges for proper grid marking
            drawDerivativeGrid(horizCtx, horizWidth, horizHeight, true, minDerivHorizontal, maxDerivHorizontal, horizontalProfile.length);
            drawDerivativeGrid(vertCtx, vertWidth, vertHeight, false, minDerivVertical, maxDerivVertical, verticalProfile.length);
        }
    } else {
        // For other modes, use the original grid function
        // Add tooltip event handlers for non-derivative/non-FFT modes as well
        setupGraphTooltips(horizCtx, horizWidth, horizHeight, true, algorithm, 
                          horizontalProfile, plotDataHorizontal, null, null);
                          
        setupGraphTooltips(vertCtx, vertWidth, vertHeight, false, algorithm,
                          verticalProfile, plotDataVertical, null, null);
                          
        drawGrid(horizCtx, horizWidth, horizHeight, true, false);
        drawGrid(vertCtx, vertWidth, vertHeight, false, false);
    }
}

// Helper function specifically for drawing derivative grids with proper coordinate marking
function drawDerivativeGrid(ctx, width, height, isVertical, minValue, maxValue, dataLength) {
    ctx.save();
    
    // Electric blue for grid lines
    const gridColor = '#00BFFF'; // Electric blue
    
    // Draw background grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([2, 2]); // Dotted lines for grid
    
    // Calculate absolute maximum for scaling
    const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
    
    ctx.beginPath();
    if (isVertical) {
        // This is the right-side graph (horizontal projection)
        // Y-axis represents the pixel positions in the image
        const ySteps = 10; // Number of horizontal lines
        for (let i = 0; i <= ySteps; i++) {
            const y = (i / ySteps) * height;
            const pixelPos = Math.floor((dataLength - 1) * (i / ySteps));
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        
        // X-axis represents derivative values
        // Draw grid lines at specific derivative values
        const xSteps = 4; // -max, -max/2, 0, max/2, max
        for (let i = 0; i <= xSteps; i++) {
            // Map from derivative value to x position (normalized to [0, 1] range)
            const derivValue = minValue + (i / xSteps) * (maxValue - minValue);
            const normalizedX = (derivValue - minValue) / (maxValue - minValue);
            const x = normalizedX * width;
            
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
    } else {
        // This is the bottom graph (vertical projection)
        // X-axis represents the pixel positions
        const xSteps = 10; // Number of vertical lines
        for (let i = 0; i <= xSteps; i++) {
            const x = (i / xSteps) * width;
            const pixelPos = Math.floor((dataLength - 1) * (i / xSteps));
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        
        // Y-axis represents derivative values (Y is inverted in canvas)
        // Draw grid lines at specific derivative values
        const ySteps = 4; // -max, -max/2, 0, max/2, max
        for (let i = 0; i <= ySteps; i++) {
            // Map from derivative value to y position (normalized to [0, 1] range)
            // Remember to invert Y since canvas Y is top-down
            const derivValue = minValue + (i / ySteps) * (maxValue - minValue);
            const normalizedY = 1 - (derivValue - minValue) / (maxValue - minValue);
            const y = normalizedY * height;
            
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
    }
    ctx.stroke();
    
    // Reset line style for axes
    ctx.setLineDash([]); // Solid lines for axes
    
    // Draw the axes with higher emphasis
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff'; // White color for axes
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    
    if (isVertical) {
        // Y-axis (left edge - represents pixel position)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents derivative values)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    } else {
        // Y-axis (left edge - represents derivative values)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents pixel position)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    }
    ctx.stroke();
    
    // Draw the zero line with higher emphasis - THIS IS KEY FOR DERIVATIVE
    ctx.beginPath();
    ctx.strokeStyle = '#00AFFF'; // Bright blue for zero line (changed from red)
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    
    if (isVertical) {
        // For the vertical graph (right side), find where zero is on X-axis
        const zeroX = (-minValue) / (maxValue - minValue) * width;
        ctx.moveTo(zeroX, 0);
        ctx.lineTo(zeroX, height);
    } else {
        // For the horizontal graph (bottom), find where zero is on Y-axis
        const zeroY = (1 - (-minValue) / (maxValue - minValue)) * height;
        ctx.moveTo(0, zeroY);
        ctx.lineTo(width, zeroY);
    }
    ctx.stroke();
    
    // Add axis and value labels
    ctx.fillStyle = '#ffffff'; // White text
    ctx.globalAlpha = 0.9;
    ctx.font = '10px Arial';
    
    if (isVertical) {
        // For the vertical graph (right side)
        // Y-axis: pixel positions
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
            const y = (i / 5) * height;
            const pixelPos = Math.floor((dataLength - 1) * (i / 5));
            ctx.fillText(`${pixelPos}`, -5, y);
        }
        
        // X-axis: derivative values
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const derivSteps = 5;
        for (let i = 0; i <= derivSteps; i++) {
            const derivValue = minValue + (i / derivSteps) * (maxValue - minValue);
            const x = (derivValue - minValue) / (maxValue - minValue) * width;
            ctx.fillText(derivValue.toFixed(1), x, height + 5);
        }
        
        // Label the zero line specially
        const zeroX = (-minValue) / (maxValue - minValue) * width;
        ctx.fillStyle = '#00AFFF'; // Bright blue for zero label (changed from red)
        ctx.fillText("0", zeroX, height + 5);
        
    } else {
        // For the horizontal graph (bottom)
        // X-axis: pixel positions
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const x = (i / 5) * width;
            const pixelPos = Math.floor((dataLength - 1) * (i / 5));
            ctx.fillText(`${pixelPos}`, x, height + 5);
        }
        
        // Y-axis: derivative values (remember Y is inverted)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const derivSteps = 5;
        for (let i = 0; i <= derivSteps; i++) {
            const derivValue = minValue + (i / derivSteps) * (maxValue - minValue);
            const y = (1 - (derivValue - minValue) / (maxValue - minValue)) * height;
            ctx.fillText(derivValue.toFixed(1), -5, y);
        }
        
        // Label the zero line specially
        const zeroY = (1 - (-minValue) / (maxValue - minValue)) * height;
        ctx.fillStyle = '#00AFFF'; // Bright blue for zero label (changed from red)
        ctx.fillText("0", -5, zeroY);
    }
    
    ctx.restore();
}

// Main canvas drag functionality
function setupCanvasDragForOCR() {
    // Make canvas draggable, but only when Ctrl or Cmd key is pressed (to avoid interfering with pan)
    canvas.setAttribute('draggable', 'true');
    
    canvas.addEventListener('dragstart', (e) => {
        // Check if image is loaded
        if (!image) {
            e.preventDefault();
            return;
        }
        
        // Only allow drag when Ctrl or Cmd key is pressed
        // This prevents conflict with panning functionality
        if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            return;
        }
        
        console.log('Starting canvas drag to OCR app');
        
        // Create a temp canvas with the current view
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width / (window.devicePixelRatio || 1);
        tempCanvas.height = canvas.height / (window.devicePixelRatio || 1);
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the current view to the temp canvas
        tempCtx.drawImage(canvas, 0, 0);
        
        // Create a smaller drag preview image
        const dragCanvas = document.createElement('canvas');
        const dragScale = 0.3; // 30% of original size
        dragCanvas.width = tempCanvas.width * dragScale;
        dragCanvas.height = tempCanvas.height * dragScale;
        const dragCtx = dragCanvas.getContext('2d');
        dragCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, dragCanvas.width, dragCanvas.height);
        
        // Set drag image
        dragCanvas.style.position = 'absolute';
        dragCanvas.style.left = '-9999px';
        document.body.appendChild(dragCanvas);
        e.dataTransfer.setDragImage(dragCanvas, dragCanvas.width / 2, dragCanvas.height / 2);
        
        // Schedule removal of the drag canvas
        setTimeout(() => {
            document.body.removeChild(dragCanvas);
        }, 100);
        
        // Get data URL directly from the canvas (most reliable cross-app method)
        const dataUrl = tempCanvas.toDataURL('image/png');
        
        // Create a blob URL as well for same-origin transfers
        tempCanvas.toBlob((blob) => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }
            
            // Create a file object from the blob
            const currentImage = imageFiles[selectedImageIndex] || { name: 'canvas_image.png' };
            const fileName = `view_of_${currentImage.name}`;
            const file = new File([blob], fileName, { type: 'image/png' });
            
            // Create blob URL for same-origin use
            const blobUrl = URL.createObjectURL(blob);
            
            // Set data transfer properties using both data URL and blob URL
            e.dataTransfer.effectAllowed = 'copyMove';
            
            // HTML format with embedded data URL (most compatible)
            const imageHtml = `<img src="${dataUrl}" alt="${fileName}" title="${fileName}">`;
            e.dataTransfer.setData('text/html', imageHtml);
            console.log('Added HTML format with embedded data URL for cross-app drag');
            
            // Plain text data URL for cross-app compatibility
            e.dataTransfer.setData('text/plain', dataUrl);
            console.log('Added data URL as plain text for cross-app drag');
            
            // URI List format for general web compatibility
            e.dataTransfer.setData('text/uri-list', dataUrl);
            
            // For local file system drag attempt download URL format
            try {
                const downloadUrl = `image/png:${fileName}:${blobUrl}`;
                e.dataTransfer.setData('DownloadURL', downloadUrl);
            } catch (err) {
                console.warn('Browser doesn\'t support DownloadURL format:', err);
            }
            
            // Special handling for in-browser transfers
            try {
                const transferKey = `canvas_image_transfer_${Date.now()}`;
                e.dataTransfer.setData('application/x-image-transfer-key', transferKey);
                
                // Store a reference to this file with both URLs
                const fileInfo = {
                    name: fileName,
                    type: 'image/png',
                    size: blob.size,
                    url: blobUrl,
                    dataUrl: dataUrl, // Include data URL for cross-origin use
                    timestamp: Date.now()
                };
                
                // Store in sessionStorage for cross-page communication
                sessionStorage.setItem(transferKey, JSON.stringify(fileInfo));
                console.log('Stored canvas image for cross-app transfer:', transferKey);
                
                // Schedule cleanup
                setTimeout(() => {
                    sessionStorage.removeItem(transferKey);
                }, 60000); // Remove after 1 minute
            } catch (err) {
                console.warn('Failed to set up cross-app canvas image transfer:', err);
            }
            
            // Clean up blob URL after drag
            canvas.addEventListener('dragend', () => {
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 5000); // Keep URL alive for 5 seconds after drag ends
            }, { once: true });
        }, 'image/png');
    });
}

// Call this setup function after initialization
window.addEventListener('load', () => {
    setupCanvasDragForOCR();
    setupClipboardPaste();
    console.log('Viewer app initialized with OCR drag and clipboard paste support');
});

// Create a paste overlay to show visual feedback
function createPasteOverlay() {
    // Check if overlay already exists
    if (document.getElementById('paste-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'paste-overlay';
    overlay.innerHTML = `
        <div class="paste-overlay-content">
            <div class="paste-icon">📋</div>
            <div class="paste-text">Paste image with Ctrl+V / Cmd+V</div>
        </div>
    `;
    
    // Add to the container
    container.appendChild(overlay);
    
    // Add click event to remove overlay
    overlay.addEventListener('click', () => {
        hidePasteOverlay();
    });
    
    return overlay;
}

// Show paste overlay
function showPasteOverlay() {
    let overlay = document.getElementById('paste-overlay');
    if (!overlay) {
        overlay = createPasteOverlay();
    }
    
    overlay.classList.add('active');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        hidePasteOverlay();
    }, 10000);
}

// Hide paste overlay
function hidePasteOverlay() {
    const overlay = document.getElementById('paste-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Set up clipboard paste functionality
function setupClipboardPaste() {
    // Create paste overlay
    createPasteOverlay();
    
    // Add a keyboard event listener to show paste overlay when Ctrl or Cmd is pressed
    document.addEventListener('keydown', (e) => {
        // If Ctrl or Cmd is pressed, show the paste overlay
        if ((e.ctrlKey || e.metaKey) && e.key !== 'v') { // Not when V is already pressed
            showPasteOverlay();
        }
    });
    
    // Hide overlay when keys are released
    document.addEventListener('keyup', (e) => {
        // If Ctrl or Cmd is released, hide the paste overlay
        if (!e.ctrlKey && !e.metaKey) {
            hidePasteOverlay();
        }
    });
    
    // Add paste event listener to the document
    document.addEventListener('paste', (e) => {
        console.log('Paste event detected');
        
        // Hide paste overlay
        hidePasteOverlay();
        
        // Check if clipboard contains any images
        const items = e.clipboardData.items;
        let imageFound = false;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Check if the item is an image
            if (item.type.startsWith('image/')) {
                imageFound = true;
                
                // Get the image as a File object
                const file = item.getAsFile();
                if (!file) continue;
                
                // Generate a unique filename for the pasted image
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = file.type.split('/')[1] || 'png';
                const newFile = new File([file], `pasted_image_${timestamp}.${extension}`, { type: file.type });
                
                // Add the image to our gallery
                processImageFiles([newFile]);
                
                // Show notification
                showNotification('Image pasted to gallery');
                
                // Only process the first image
                break;
            }
        }
        
        if (!imageFound) {
            // Check if we should show a message that no image was found
            if (items.length > 0) {
                console.log('No image found in clipboard data');
                showNotification('No image found in clipboard');
            }
        }
    });
    
    // Add "Paste Image" button to controls
    const controlsPanel = document.getElementById('controls');
    const pasteButton = document.createElement('button');
    pasteButton.id = 'paste-btn';
    pasteButton.textContent = 'Paste Image';
    pasteButton.addEventListener('click', () => {
        showPasteOverlay();
        showNotification('Press Ctrl+V / Cmd+V to paste');
    });
    
    // Add button before toggle thumbnails button
    const toggleThumbnailsBtn = document.getElementById('toggle-thumbnails');
    if (toggleThumbnailsBtn) {
        controlsPanel.insertBefore(pasteButton, toggleThumbnailsBtn);
    } else {
        controlsPanel.appendChild(pasteButton);
    }
}

// Update the app UI with paste instructions
function showPasteTip() {
    const pasteTip = document.createElement('div');
    pasteTip.className = 'paste-tip';
    pasteTip.innerHTML = 'Tip: Ctrl+V or Cmd+V to paste image';
    
    // Add to container, if not already present
    if (!document.querySelector('.paste-tip')) {
        container.appendChild(pasteTip);
        
        // Auto-hide tip after 5 seconds
        setTimeout(() => {
            pasteTip.classList.add('fade-out');
            setTimeout(() => {
                if (pasteTip.parentNode) {
                    pasteTip.parentNode.removeChild(pasteTip);
                }
            }, 1000);
        }, 5000);
    }
}

// Call showPasteTip after initial setup
document.addEventListener('DOMContentLoaded', () => {
    showPasteTip();
    addThumbnailContextMenu();
});

// Helper function specifically for drawing FFT grids with frequency labels
function drawFFTGrid(ctx, width, height, isVertical, fftLength, originalDataLength) {
    ctx.save();
    
    // Purple-ish color for frequency grid lines
    const gridColor = '#9370DB'; // Medium purple
    
    // Draw background grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([2, 2]); // Dotted lines for grid
    
    ctx.beginPath();
    if (isVertical) {
        // This is the right-side graph (horizontal projection)
        // Y-axis still represents the pixel positions in the image
        const ySteps = 10; // Number of horizontal lines
        for (let i = 0; i <= ySteps; i++) {
            const y = (i / ySteps) * height;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        
        // X-axis represents frequency bins
        const xSteps = 10; // Frequency markers
        for (let i = 0; i <= xSteps; i++) {
            const x = (i / xSteps) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
    } else {
        // This is the bottom graph (vertical projection)
        // X-axis represents frequency bins
        const xSteps = 10; 
        for (let i = 0; i <= xSteps; i++) {
            const x = (i / xSteps) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        
        // Y-axis represents magnitude
        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = (i / ySteps) * height;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
    }
    ctx.stroke();
    
    // Reset line style for axes
    ctx.setLineDash([]); // Solid lines for axes
    
    // Draw the axes with higher emphasis
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff'; // White color for axes
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    
    if (isVertical) {
        // Y-axis (left edge - represents pixel position)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents frequency)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    } else {
        // Y-axis (left edge - represents magnitude)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        
        // X-axis (bottom edge - represents frequency)
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
    }
    ctx.stroke();
    
    // Add frequency labels
    ctx.fillStyle = '#ffffff'; // White text
    ctx.globalAlpha = 0.9;
    ctx.font = '10px Arial';
    
    // Calculate the Nyquist frequency (half of sampling rate)
    // In spatial domain, sampling rate is 1 pixel
    const nyquistFreq = 0.5; // In cycles per pixel
    
    if (isVertical) {
        // For the vertical graph (right side)
        // Y-axis: positions in original data
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
            const y = (i / 5) * height;
            const pixelPos = Math.floor((originalDataLength - 1) * (i / 5));
            ctx.fillText(`${pixelPos}px`, -5, y);
        }
        
        // X-axis: frequency labels (as fraction of Nyquist)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const freq = (i / 5) * nyquistFreq;
            const x = (i / 5) * width;
            ctx.fillText(`${freq.toFixed(2)}`, x, height + 5);
        }
        
        // Add units at the end
        ctx.textAlign = 'right';
        ctx.fillText("freq (cycles/px)", width, height + 20);
        
    } else {
        // For the horizontal graph (bottom)
        // X-axis: frequency labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const freq = (i / 5) * nyquistFreq;
            const x = (i / 5) * width;
            ctx.fillText(`${freq.toFixed(2)}`, x, height + 5);
        }
        
        // Y-axis: magnitude (remember Y is inverted)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
            const y = (1 - i / 4) * height;
            const magValue = (i / 4);
            ctx.fillText(magValue.toFixed(1), -5, y);
        }
        
        // Add units at the end
        ctx.textAlign = 'right';
        ctx.fillText("freq (cycles/px)", width, height + 20);
    }
    
    ctx.restore();
}

// Add the tooltip setup function to the end of the file
// Helper function to set up tooltips for graph measurements
function setupGraphTooltips(ctx, width, height, isVertical, algorithm, originalData, normalizedData, fftData, rawDerivativeData) {
    const canvas = ctx.canvas;
    
    // Make sure tooltip exists
    const tooltip = createTooltip();
    
    console.log(`Setting up tooltip for canvas ID: ${canvas.id || 'unnamed'}, type: ${isVertical ? 'Vertical' : 'Horizontal'}`);
    console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}, DOM size: ${canvas.clientWidth}x${canvas.clientHeight}`);
    
    // Remove any existing event listeners to avoid duplicates
    canvas.removeEventListener('mousemove', canvas._tooltipMoveHandler);
    canvas.removeEventListener('mouseleave', canvas._tooltipLeaveHandler);
    
    // Add some interactive style to indicate the canvas is interactive
    canvas.style.cursor = 'crosshair';
    
    // Create a debug overlay to verify the event area
    const debugOverlay = document.createElement('div');
    debugOverlay.style.position = 'absolute';
    debugOverlay.style.border = '1px solid red';
    debugOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    debugOverlay.style.pointerEvents = 'none';
    debugOverlay.style.zIndex = '9999';
    
    // Position overlay on top of canvas
    const rect = canvas.getBoundingClientRect();
    debugOverlay.style.left = `${rect.left}px`;
    debugOverlay.style.top = `${rect.top}px`;
    debugOverlay.style.width = `${rect.width}px`;
    debugOverlay.style.height = `${rect.height}px`;
    
    // Add overlay to document for 3 seconds
    document.body.appendChild(debugOverlay);
    setTimeout(() => {
        if (document.body.contains(debugOverlay)) {
            document.body.removeChild(debugOverlay);
        }
    }, 3000);
    
    // Define mousemove handler
    canvas._tooltipMoveHandler = function(e) {
        e.stopPropagation();
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate data values based on mouse position
        let dataIndex, plotValue, frequency, wavelength, amplitude;
        
        // Always show tooltip - guaranteed to have some basic information
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.style.display = 'block';
        
        if (isVertical) {
            // Vertical graph (shows horizontal projection)
            // Y-axis is the data index (rows), X-axis is value
            dataIndex = Math.floor((y / rect.height) * originalData.length);
            
            if (dataIndex >= 0 && dataIndex < originalData.length) {
                if ((algorithm === 3 || algorithm === 4) && fftData) {
                    // FFT mode - directly use the position to get the frequency value
                    // For vertical graph: Y-axis is frequency, X-axis is magnitude
                    // Map y position to FFT bin
                    const binFraction = y / rect.height; // Correct: Y is frequency axis
                    const fftIndex = Math.min(Math.floor(binFraction * fftData.length), fftData.length - 1);
                    
                    // Calculate frequency - bins go from 0 to Nyquist (0.5 cycles/pixel)
                    frequency = (fftIndex / fftData.length) * 0.5; // Assuming fftData.length is num_bins to Nyquist
                    wavelength = frequency > 0 ? 1 / frequency : Infinity;
                    amplitude = fftData[fftIndex]; // Magnitude at this frequency bin
                    
                    tooltip.innerHTML = `
                        <div class="tooltip-title">FFT Measurement</div>
                        <div class="tooltip-freq">Freq: ${frequency.toFixed(4)} c/px</div>
                        <div class="tooltip-lambda">λ: ${wavelength.toFixed(1)} px</div>
                        <div class="tooltip-mag">Magnitude: ${amplitude.toFixed(1)}</div>
                        <div class="tooltip-bin">Bin: ${fftIndex} / ${fftData.length}</div>
                    `;
                } else {
                    // Non-FFT modes - use the plotted data value, not the original data
                    // Get the actual normalized value being plotted at this index
                    plotValue = normalizedData[dataIndex];
                    
                    // Get the x-coordinate this value is plotted at
                    const plotX = plotValue * width;
                    
                    // For algorithm 2 (derivative), show actual derivative value
                    let actualValue;
                    if (algorithm === 2 && rawDerivativeData) {
                        // For derivative, use the raw derivative value
                        actualValue = rawDerivativeData[dataIndex];
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Derivative Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else if (algorithm === 1) {
                        // For LPF, show the filtered value
                        // Reconstruct from the normalized plot data
                        const maxValue = Math.max(...originalData);
                        actualValue = plotValue * maxValue;
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Filtered Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(2)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else {
                        // For other algorithms, just show the normalized plot value
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Plot Value</div>
                            <div class="tooltip-amp">Value: ${plotValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    }
                }
            }
        } else {
            // Horizontal graph (shows vertical projection)
            // X-axis is the data index (columns), Y-axis is value
            dataIndex = Math.floor((x / rect.width) * originalData.length);
            
            if (dataIndex >= 0 && dataIndex < originalData.length) {
                if ((algorithm === 3 || algorithm === 4) && fftData) {
                    // FFT mode - directly use the position to get the frequency value
                    // For horizontal graph: X-axis is frequency, Y-axis is magnitude
                    // Map x position to FFT bin
                    const binFraction = x / rect.width; // Correct: X is frequency axis
                    const fftIndex = Math.min(Math.floor(binFraction * fftData.length), fftData.length - 1);
                    
                    // Calculate frequency - bins go from 0 to Nyquist (0.5 cycles/pixel)
                    frequency = (fftIndex / fftData.length) * 0.5; // Assuming fftData.length is num_bins to Nyquist
                    wavelength = frequency > 0 ? 1 / frequency : Infinity;
                    amplitude = fftData[fftIndex]; // Magnitude at this frequency bin
                    
                    tooltip.innerHTML = `
                        <div class="tooltip-title">FFT Measurement</div>
                        <div class="tooltip-freq">Freq: ${frequency.toFixed(4)} c/px</div>
                        <div class="tooltip-lambda">λ: ${wavelength.toFixed(1)} px</div>
                        <div class="tooltip-mag">Magnitude: ${amplitude.toFixed(1)}</div>
                        <div class="tooltip-bin">Bin: ${fftIndex} / ${fftData.length}</div>
                    `;
                } else {
                    // Non-FFT mode - use the plotted data value, not the original data
                    // Get the actual normalized value being plotted at this index
                    plotValue = normalizedData[dataIndex];
                    
                    // For algorithm 2 (derivative), show actual derivative value
                    let actualValue;
                    if (algorithm === 2 && rawDerivativeData) {
                        // For derivative, use the raw derivative value
                        actualValue = rawDerivativeData[dataIndex];
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Derivative Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else if (algorithm === 1) {
                        // For LPF, show the filtered value
                        // Reconstruct from the normalized plot data
                        const maxValue = Math.max(...originalData);
                        actualValue = plotValue * maxValue;
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Filtered Value</div>
                            <div class="tooltip-amp">Value: ${actualValue.toFixed(2)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    } else {
                        // For other algorithms, just show the normalized plot value
                        tooltip.innerHTML = `
                            <div class="tooltip-title">Plot Value</div>
                            <div class="tooltip-amp">Value: ${plotValue.toFixed(3)}</div>
                            <div class="tooltip-pos">Position: ${dataIndex}</div>
                        `;
                    }
                }
            }
        }
    };
    
    // Define mouseleave handler
    canvas._tooltipLeaveHandler = function() {
        tooltip.style.display = 'none';
        console.log('Hiding tooltip (mouseleave)');
    };
    
    // Add the event listeners
    canvas.addEventListener('mousemove', canvas._tooltipMoveHandler);
    canvas.addEventListener('mouseleave', canvas._tooltipLeaveHandler);
    
    // Log that we've set up the tooltip
    console.log(`Tooltip setup complete for ${isVertical ? 'Vertical' : 'Horizontal'} projection, canvas: ${canvas.id || 'unnamed'}`);
}

// Simple implementation to make an element draggable and resizable
function makeElementDraggable(element, container) {
    if (!element || element.classList.contains('draggable-initialized')) return;
    
    // Mark as initialized
    element.classList.add('draggable-initialized');
    element.classList.add('draggable');
    
    // Create drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = `
        <span class="drag-handle-grip">|||</span>
        <span class="drag-handle-title">${element.querySelector('h3')?.textContent || 'Draggable'}</span>
        <div class="drag-handle-controls">
            <button title="Reset Position">&#8634;</button>
        </div>
    `;
    
    // Add resize handles
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.dataset.direction = pos;
        element.appendChild(handle);
        
        // Resize logic
        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            const startLeft = startRect.left - containerRect.left;
            const startTop = startRect.top - containerRect.top;
            const startWidth = startRect.width;
            const startHeight = startRect.height;
            
            // Position element absolutely if not already
            if (getComputedStyle(element).position !== 'absolute') {
                element.style.position = 'absolute';
                element.style.left = startLeft + 'px';
                element.style.top = startTop + 'px';
                element.style.width = startWidth + 'px';
                element.style.height = startHeight + 'px';
                element.style.flex = 'none';
            }
            
            element.classList.add('dragging');
            
            function handleResize(moveEvent) {
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;
                
                let newLeft = startLeft;
                let newTop = startTop;
                let newWidth = startWidth;
                let newHeight = startHeight;
                
                // Apply resize based on direction
                switch (pos) {
                    case 'top-left':
                        newLeft = startLeft + deltaX;
                        newTop = startTop + deltaY;
                        newWidth = startWidth - deltaX;
                        newHeight = startHeight - deltaY;
                        break;
                    case 'top-right':
                        newTop = startTop + deltaY;
                        newWidth = startWidth + deltaX;
                        newHeight = startHeight - deltaY;
                        break;
                    case 'bottom-left':
                        newLeft = startLeft + deltaX;
                        newWidth = startWidth - deltaX;
                        newHeight = startHeight + deltaY;
                        break;
                    case 'bottom-right':
                        newWidth = startWidth + deltaX;
                        newHeight = startHeight + deltaY;
                        break;
                }
                
                // Enforce minimum size
                if (newWidth < 100) newWidth = 100;
                if (newHeight < 100) newHeight = 100;
                
                // Apply the new position and size
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
                element.style.width = newWidth + 'px';
                element.style.height = newHeight + 'px';
            }
            
            function stopResize() {
                document.removeEventListener('mousemove', handleResize);
                document.removeEventListener('mouseup', stopResize);
                element.classList.remove('dragging');
            }
            
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        });
    });
    
    // Add reset button functionality
    const resetBtn = dragHandle.querySelector('button');
    resetBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        element.style.position = '';
        element.style.left = '';
        element.style.top = '';
        element.style.width = '';
        element.style.height = '';
        element.style.flex = '';
    });
    
    // Add drag functionality to the handle
    dragHandle.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
        
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const startLeft = rect.left - containerRect.left;
        const startTop = rect.top - containerRect.top;
        
        // Position element absolutely if not already
        if (getComputedStyle(element).position !== 'absolute') {
            element.style.position = 'absolute';
            element.style.left = startLeft + 'px';
            element.style.top = startTop + 'px';
            element.style.width = rect.width + 'px';
            element.style.height = rect.height + 'px';
            element.style.flex = 'none';
        }
        
        element.classList.add('dragging');
        
        function handleDrag(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            
            element.style.left = (startLeft + deltaX) + 'px';
            element.style.top = (startTop + deltaY) + 'px';
        }
        
        function stopDrag() {
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            element.classList.remove('dragging');
        }
        
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
    });
    
    element.appendChild(dragHandle);
    console.log('Made element draggable:', element);
}

