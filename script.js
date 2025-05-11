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
    opacity: 0.5
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
    gridSettings.size = parseInt(e.target.value);
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

    const gridSize = gridSettings.size * zoomLevel;
    ctx.save();
    ctx.strokeStyle = gridSettings.color;
    ctx.globalAlpha = gridSettings.opacity;
    ctx.lineWidth = 1;

    const startX = Math.floor(-offsetX / gridSize) * gridSize + offsetX;
    const startY = Math.floor(-offsetY / gridSize) * gridSize + offsetY;
    const endX = canvas.width;
    const endY = canvas.height;

    for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }

    ctx.restore();
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

function displayProjection(horizontal, vertical, image) {
    const maxCanvasSize = 300; // Max size for image and projection canvases

    // Disable and gray out the "Show Projection" button
    const projectionButton = document.getElementById('projection-btn');
    projectionButton.disabled = true;
    projectionButton.classList.add('disabled');

    // Calculate scaled dimensions for the image
    const imgAspectRatio = image.width / image.height;
    let scaledWidth, scaledHeight;

    if (imgAspectRatio > 1) {
        scaledWidth = maxCanvasSize;
        scaledHeight = maxCanvasSize / imgAspectRatio;
    } else {
        scaledHeight = maxCanvasSize;
        scaledWidth = maxCanvasSize * imgAspectRatio;
    }

    // Create a projection overlay with a grid layout
    const projectionOverlay = document.createElement('div');
    projectionOverlay.id = 'projection-overlay';
    projectionOverlay.className = 'projection-layout';
    
    projectionOverlay.innerHTML = `
        <div class="projection-main-area">
            <div class="projection-top-area">
                <canvas id="image-canvas" width="${scaledWidth}" height="${scaledHeight}"></canvas>
                <canvas id="horizontal-projection" width="100" height="${scaledHeight}"></canvas>
                <div id="left-analysis-pane" class="analysis-pane">
                    <h3>Left Analysis Pane</h3>
                    <div class="analysis-content">
                        <p>Future analysis will appear here</p>
                    </div>
                </div>
            </div>
            <div class="projection-bottom-area">
                <canvas id="vertical-projection" width="${scaledWidth}" height="100"></canvas>
                <div id="bottom-right-pane"></div>
                <div id="bottom-analysis-pane" class="analysis-pane">
                    <h3>Bottom Analysis Pane</h3>
                    <div class="analysis-content">
                        <p>Future analysis will appear here</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="projection-controls">
            <div class="algorithm-buttons">
                <h3>Algorithm Controls</h3>
                <button id="algo-btn-1" class="algo-btn">Algorithm 1</button>
                <button id="algo-btn-2" class="algo-btn">Algorithm 2</button>
                <button id="algo-btn-3" class="algo-btn">Algorithm 3</button>
                <button id="algo-btn-4" class="algo-btn">Algorithm 4</button>
                <button id="algo-btn-5" class="algo-btn">Algorithm 5</button>
                <button id="algo-btn-6" class="algo-btn">Algorithm 6</button>
                <button id="algo-btn-7" class="algo-btn">Algorithm 7</button>
                <button id="algo-btn-8" class="algo-btn">Algorithm 8</button>
                <button id="algo-btn-9" class="algo-btn">Algorithm 9</button>
                <button id="algo-btn-10" class="algo-btn">Algorithm 10</button>
            </div>
            <div class="view-controls">
                <button id="full-screen-projection">Full Screen</button>
                <button id="close-projection">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(projectionOverlay);

    const imageCanvas = document.getElementById('image-canvas');
    const imageCtx = imageCanvas.getContext('2d');
    const hCanvas = document.getElementById('horizontal-projection'); // This is for horizontal projection (vertical graph)
    const hCtx = hCanvas.getContext('2d');
    const vCanvas = document.getElementById('vertical-projection'); // This is for vertical projection (horizontal graph)
    const vCtx = vCanvas.getContext('2d');

    // Render the original image on the image canvas, maintaining aspect ratio
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.drawImage(
        image,
        0, 0,
        scaledWidth,
        scaledHeight
    );

    // Normalize horizontal and vertical data for projections
    const normalize = (array, maxValue) =>
        array.map(value => (value / maxValue) || 0);

    const maxHorizontal = Math.max(...horizontal);
    const maxVertical = Math.max(...vertical);

    const normalizedHorizontal = normalize(horizontal, maxHorizontal);
    const normalizedVertical = normalize(vertical, maxVertical);

    // Correctly plot the horizontal projection on the vertical graph (right of image)
    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
    hCtx.beginPath();
    normalizedHorizontal.forEach((value, index) => {
        const y = (index / normalizedHorizontal.length) * hCanvas.height; // Map index to canvas height
        const x = value * hCanvas.width; // Map value to canvas width
        hCtx.lineTo(x, y);
    });
    hCtx.strokeStyle = 'white'; // White graph line
    hCtx.stroke();

    // Correctly plot the vertical projection on the horizontal graph (below the image)
    vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);
    vCtx.beginPath();
    normalizedVertical.forEach((value, index) => {
        const x = (index / normalizedVertical.length) * vCanvas.width; // Map index to canvas width
        const y = vCanvas.height - value * vCanvas.height; // Map value to canvas height
        vCtx.lineTo(x, y);
    });
    vCtx.strokeStyle = 'white'; // White graph line
    vCtx.stroke();

    // Full Screen Button Logic - Properly handle fullscreen mode
    document.getElementById('full-screen-projection').addEventListener('click', () => {
        const overlay = document.getElementById('projection-overlay');
        
        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (overlay.requestFullscreen) {
                overlay.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else if (overlay.webkitRequestFullscreen) {
                overlay.webkitRequestFullscreen();
            } else if (overlay.msRequestFullscreen) {
                overlay.msRequestFullscreen();
            }
            overlay.classList.add('fullscreen');
            document.getElementById('full-screen-projection').textContent = 'Exit Full Screen';
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            overlay.classList.remove('fullscreen');
            document.getElementById('full-screen-projection').textContent = 'Full Screen';
        }
    });

    // Track fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    function handleFullscreenChange() {
        const overlay = document.getElementById('projection-overlay');
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
            // Exited fullscreen
            overlay.classList.remove('fullscreen');
            document.getElementById('full-screen-projection').textContent = 'Full Screen';
        }
    }

    // Close button logic
    document.getElementById('close-projection').addEventListener('click', () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        
        // Exit fullscreen if active
        if (document.fullscreenElement || 
            document.webkitFullscreenElement || 
            document.mozFullScreenElement || 
            document.msFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
        
        document.body.removeChild(projectionOverlay);
        projectionButton.disabled = false;
        projectionButton.classList.remove('disabled'); // Re-enable the button
    });

    // Algorithm buttons - dummy functions for future implementation
    for (let i = 1; i <= 10; i++) {
        document.getElementById(`algo-btn-${i}`).addEventListener('click', () => {
            // Placeholder for algorithm implementation
            console.log(`Algorithm ${i} clicked - Function to be implemented`);
            
            // Show a message in both analysis panes
            const leftPane = document.getElementById('left-analysis-pane');
            const bottomPane = document.getElementById('bottom-analysis-pane');
            
            const analysisHTML = `
                <h3>Algorithm ${i} Results</h3>
                <div class="analysis-content">
                    <p>Results from Algorithm ${i} will appear here when implemented.</p>
                    <p>This is a placeholder for future functionality.</p>
                    <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                </div>
            `;
            
            leftPane.innerHTML = analysisHTML;
            bottomPane.innerHTML = analysisHTML;
        });
    }
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

