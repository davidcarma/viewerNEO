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
    isFixed: false
};

// Thumbnail panel state variables
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

// Input elements
const fileInput = document.getElementById('file-input');
const directoryInput = document.getElementById('directory-input');

// Set drop overlay text
dropOverlay.textContent = 'Drop image or folder here';

// Set canvas size to match container dimensions with proper DPI scaling
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
    
    // Get current container dimensions
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
            if (file.type.startsWith('image/') || 
               file.name.toLowerCase().endsWith('.tif') || 
               file.name.toLowerCase().endsWith('.tiff')) {
                files.push(file);
            }
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
            files.push(await getFileFromEntry(entry));
        } else if (entry.isDirectory) {
            files = files.concat(await getFilesFromDirectory(entry));
        }
    }
    // Filter for image files
    return files.filter(f => f && f.type && (
        f.type.startsWith('image/') || 
        f.name.toLowerCase().endsWith('.tif') || 
        f.name.toLowerCase().endsWith('.tiff')
    ));
}

function getFileFromEntry(entry) {
    return new Promise(resolve => {
        entry.file(file => resolve(file));
    });
}

function getFilesFromDirectory(directoryEntry) {
    return new Promise(resolve => {
        const reader = directoryEntry.createReader();
        let fileList = [];
        function readEntries() {
            reader.readEntries(async entries => {
                if (!entries.length) {
                    resolve(fileList);
                    return;
                }
                for (const entry of entries) {
                    if (entry.isFile) {
                        fileList.push(await getFileFromEntry(entry));
                    } else if (entry.isDirectory) {
                        const nestedFiles = await getFilesFromDirectory(entry);
                        fileList = fileList.concat(nestedFiles);
                    }
                }
                readEntries();
            });
        }
        readEntries();
    });
}

// Process multiple image files - sorts, adds thumbnails, and loads the first image
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
        thumbnailItem.draggable = true;
        
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

// Remove an image by index
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

// Handle thumbnail drag start event
function handleThumbnailDragStart(e, file, index) {
    // Mark the item being dragged
    e.target.classList.add('dragging');
    
    // Set custom drag image (optional enhancement)
    const dragImage = e.target.querySelector('img');
    if (dragImage && dragImage.complete) {
        e.dataTransfer.setDragImage(dragImage, 50, 50);
    }
    
    // Clear any existing data
    e.dataTransfer.clearData();
    
    // Set up compatibility data for cross-app/platform drags
    createCrossAppCompatibleData(file, () => {
        // This is a success callback - nothing needed here
    });
    
    // Handle file creation from TIFF data if needed
    if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
        // For TIFF files, we need special handling - default back to just text for now
        e.dataTransfer.setData('text/plain', file.name);
        e.dataTransfer.effectAllowed = 'copy';
        return;
    }
    
    // Set compatible data formats
    try {
        e.dataTransfer.setData('application/x-moz-file', file);
    } catch (err) {
        // Firefox-specific API, may fail in other browsers
    }
    
    try {
        // Standard file transfer (works in some browsers)
        e.dataTransfer.items.add(file);
        } catch (err) {
        // Not supported in all browsers
    }
    
    // Fallback: text and URL
    try {
        e.dataTransfer.setData('text/plain', file.name);
        e.dataTransfer.setData('text/uri-list', URL.createObjectURL(file));
        } catch (err) {
        console.error('Error setting drag data:', err);
    }
    
    e.dataTransfer.effectAllowed = 'copyMove';
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

// Select an image by its index in the imageFiles array
function selectImageByIndex(index) {
    if (index < 0 || index >= imageFiles.length) return;
    
        // Update selected index
        selectedImageIndex = index;
        
    // Update thumbnail selection in UI
        const thumbnails = document.querySelectorAll('.thumbnail-item');
        thumbnails.forEach(thumbnail => {
            thumbnail.classList.remove('active');
        });
        
        const selectedThumbnail = document.querySelector(`.thumbnail-item[data-index="${index}"]`);
        if (selectedThumbnail) {
            selectedThumbnail.classList.add('active');
        
        // Scroll into view if not visible
        if (isThumbnailPanelVisible) {
            selectedThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        }
        
        // Load the selected image
        loadImage(imageFiles[index]);
}

// Toggle thumbnail panel visibility
function toggleThumbnailPanel() {
    if (isThumbnailPanelVisible) {
        hideThumbnailPanel();
    } else {
        showThumbnailPanel();
    }
}

// Show the thumbnail panel
function showThumbnailPanel() {
    if (imageFiles.length === 0) return;
    
    // Update state
    isThumbnailPanelVisible = true;
    
    // Show panel
    thumbnailPanel.classList.add('active');
    container.classList.add('with-thumbnails');
    
    // Update toggle handle
    thumbnailToggleHandle.classList.remove('hidden');
    
    // Set width
    thumbnailPanel.style.width = thumbnailPanelWidth + 'px';
    thumbnailPanel.style.transform = 'translateX(0)';
    container.style.marginLeft = thumbnailPanelWidth + 'px';
    container.style.width = `calc(100vw - ${thumbnailPanelWidth}px)`;
    
    // Redraw canvas to adapt to new size
    resizeCanvas();
}

// Hide the thumbnail panel
function hideThumbnailPanel() {
    // Update state
    isThumbnailPanelVisible = false;
    
    // Hide panel
    thumbnailPanel.classList.remove('active');
    container.classList.remove('with-thumbnails');
    
    // Update toggle handle
    thumbnailToggleHandle.classList.add('hidden');
    
    // Reset container
    container.style.marginLeft = '0';
    container.style.width = '100vw';
    
    // Redraw canvas to adapt to new size
    resizeCanvas();
}

// Reset view to fit image to screen
function resetView() {
    if (!image) return;
    
    // Calculate zoom level to fit image to canvas
    const dpr = window.devicePixelRatio || 1;
    const containerWidth = canvas.width / dpr;
    const containerHeight = canvas.height / dpr;
    
    const hZoom = containerWidth / image.width;
    const vZoom = containerHeight / image.height;
    zoomLevel = Math.min(hZoom, vZoom) * 0.9; // 90% of fit-to-screen
    
    // Center image
    offsetX = (containerWidth - image.width * zoomLevel) / 2;
    offsetY = (containerHeight - image.height * zoomLevel) / 2;
    
    // Update UI
    render();
    updateInfo();
}

// Draw grid overlay on the canvas
function drawGrid() {
    if (!showGrid) return;
    
    // Get current canvas dimensions
    const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
    
    // Set grid properties based on settings
    ctx.strokeStyle = gridSettings.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = gridSettings.opacity;
    
    // Draw based on whether grid is fixed or scrolls with image
    if (gridSettings.isFixed) {
        // Fixed grid (stays in place when image moves)
        const cellSize = gridSettings.size;
        
        // Draw vertical lines
        for (let x = 0; x < canvasWidth; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y < canvasHeight; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
    } else {
        // Scrollable grid (moves with the image)
        // Calculate grid cell size in screen pixels
        const cellSize = gridSettings.size * zoomLevel;
        
        // Calculate grid offset based on image offset
        const offsetGridX = offsetX % cellSize;
        const offsetGridY = offsetY % cellSize;
        
        // Draw vertical lines
        for (let x = offsetGridX; x < canvasWidth; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = offsetGridY; y < canvasHeight; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
    }
    
    // Reset alpha
    ctx.globalAlpha = 1.0;
}

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

// Load TIFF image using the TIFF.js library
async function loadTiffImage(file) {
    loadingDiv.style.display = 'block';
    try {
        // Initialize TIFF.js
        const tiff = await Tiff.initialize({locateFile: () => 'lib/tiff.wasm'});
        
        // Read file data
        const buffer = await file.arrayBuffer();
        const tiffData = tiff.readFromBuffer(new Uint8Array(buffer));
        
        // Get image dimensions
        const width = tiffData.getWidth();
        const height = tiffData.getHeight();
        
        // Create a canvas to render the TIFF
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
                const ctx = canvas.getContext('2d');
        
        // Get RGBA data from TIFF
        const rgba = tiffData.readRGBAImage();
        imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
        
        // Draw to canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Create image from canvas
            image = new Image();
            image.onload = () => {
                resetView();
                loadingDiv.style.display = 'none';
                updateInfo();
            };
        image.onerror = () => {
                loadingDiv.style.display = 'none';
                alert('Failed to load image from TIFF data');
            };
        
            // Convert canvas to data URL and set as image source
                image.src = canvas.toDataURL('image/png');
        
        // Clean up
        tiff.destroy();
    } catch (error) {
            console.error('Failed to load TIFF file:', error);
            loadingDiv.style.display = 'none';
            alert('Failed to load TIFF file: ' + error.message);
    }
}

// Load an image file and display it on the canvas
function loadImage(file) {
    loadingDiv.style.display = 'block';
    
    // Check if this is a TIFF file
    if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
        loadTiffImage(file);
    } else {
        // Handle standard image formats
        const url = URL.createObjectURL(file);
        image = new Image();
        image.onload = () => {
            // Create an offscreen canvas for image data processing
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

// Load image and update thumbnail selection
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

// Render the current image to the canvas
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

// Update the information panel
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
    
    // Create the HTML layout with EXACT matching dimensions and improved titles
    projectionOverlay.innerHTML = `
        <div class="projection-main-area">
            <div class="projection-top-row">
                <div class="primary-image-col">
                    <div id="image-canvas-wrapper" data-drag-title="Main Image View">
                <canvas id="image-canvas" width="${finalImageWidth}" height="${finalImageHeight}"></canvas>
                    </div>
                    <div class="graph-container horizontal" data-drag-title="Primary Vertical Projection (Bottom Graph)">
                <canvas id="primary-vertical-projection-graph" width="${finalImageWidth}" height="${verticalGraphHeight}"></canvas>
                        <div class="graph-label">Primary Vertical Projection</div>
            </div>
                    <div class="graph-container horizontal" data-drag-title="Secondary Vertical Projection (Bottom Graph)">
                <canvas id="secondary-vertical-projection-graph" width="${finalImageWidth}" height="${verticalGraphHeight}"></canvas>
                        <div class="graph-label">Secondary Vertical Graph</div>
            </div>
                    <div id="bottom-main-analysis-pane" class="analysis-pane" data-drag-title="Vertical Analysis Results">
                        <h3>Vertical Analysis Results</h3>
                        <div class="analysis-content">
                            <p>Analysis will appear here when you select an algorithm</p>
                        </div>
                    </div>
                </div>
                <div class="right-section">
                    <div class="horizontal-graphs-row">
                        <div class="graph-container vertical" data-drag-title="Horizontal Projection (Right Graph)">
                <canvas id="primary-horizontal-projection-graph" width="${horizontalGraphWidth}" height="${finalImageHeight}"></canvas>
                            <div class="graph-label">Horizontal Projection</div>
            </div>
                        <div class="graph-container vertical" data-drag-title="Secondary Horizontal Projection (Right Graph)">
                <canvas id="secondary-horizontal-projection-graph" width="${horizontalGraphWidth}" height="${finalImageHeight}"></canvas>
                            <div class="graph-label">Secondary Horizontal Graph</div>
            </div>
                    </div>
                    <div id="right-analysis-pane" class="analysis-pane" data-drag-title="Horizontal Analysis Results">
                <h3>Horizontal Analysis Results</h3>
                <div class="analysis-content">
                            <p>Analysis will appear here when you select an algorithm</p>
                </div>
            </div>
                </div>
            </div>
        </div>
        <!-- Fixed footer controls -->
        <div class="projection-controls" style="position: absolute; bottom: 20px; left: 0; right: 0; z-index: 50;">
            <div class="algorithm-buttons">
                <h3>Algorithm Controls</h3>
                <button id="algo-btn-1" class="algo-btn">LPF</button>
                <button id="algo-btn-2" class="algo-btn">Derivative</button>
                <button id="algo-btn-3" class="algo-btn">Deriv + FFT</button>
                <button id="algo-btn-4" class="algo-btn">DiffRectFFT</button>
                <button id="algo-btn-5" class="algo-btn">Algorithm 5</button>
                <button id="algo-btn-6" class="algo-btn">Algorithm 6</button>
                <button id="algo-btn-7" class="algo-btn">Algorithm 7</button>
                <button id="algo-btn-8" class="algo-btn">Algorithm 8</button>
                <button id="algo-btn-9" class="algo-btn">Algorithm 9</button>
                <button id="algo-btn-10" class="algo-btn">Algorithm 10</button>
            </div>
            <div class="view-controls">
                <button id="full-screen-projection">Full Screen</button>
                <button id="save-layout">Save Layout</button>
                <button id="close-projection">Close</button>
            </div>
        </div>
    `;
    
    // Add the overlay to the document
    document.body.appendChild(projectionOverlay);
    
    // Make all elements draggable by default
    console.log('Making all projection elements draggable by default');
    
    // Set up close button handler
    document.getElementById('close-projection').addEventListener('click', function() {
        // Ensure proper cleanup and removal
        if (document.fullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
        
        // Call cleanup function
        cleanup();
    });
    
    // Add the Save Layout button handler
    document.getElementById('save-layout').addEventListener('click', function() {
        saveLayoutPositions();
    });
    
    // Function to save all layout positions according to the relational positioning requirements
    function saveLayoutPositions() {
        console.log('Saving layout positions...');
        
        const projectionContainer = document.getElementById('projection-content') || 
                                  document.getElementById('projection-overlay');
        
        if (projectionContainer) {
            const pcRect = projectionContainer.getBoundingClientRect();
            const pcStyles = getComputedStyle(projectionContainer);
            console.log('%cState of projectionContainer during saveLayoutPositions:', 'font-weight:bold; color: blue;', {
                id: projectionContainer.id,
                rect: JSON.parse(JSON.stringify(pcRect)),
                paddingLeft: pcStyles.paddingLeft,
                paddingTop: pcStyles.paddingTop,
                marginLeft: pcStyles.marginLeft,
                marginTop: pcStyles.marginTop,
                borderLeftWidth: pcStyles.borderLeftWidth,
                borderTopWidth: pcStyles.borderTopWidth,
                offsetLeft: projectionContainer.offsetLeft, // Also log offsetLeft/Top
                offsetTop: projectionContainer.offsetTop
            });
        } else {
            console.warn('projectionContainer not found during saveLayoutPositions');
        }

        // Get references to all draggable elements
        const imageCanvasWrapper = document.getElementById('image-canvas-wrapper');
        const primaryHorizontalGraph = document.getElementById('primary-horizontal-projection-graph')?.closest('.graph-container');
        const secondaryHorizontalGraph = document.getElementById('secondary-horizontal-projection-graph')?.closest('.graph-container');
        const primaryVerticalGraph = document.getElementById('primary-vertical-projection-graph')?.closest('.graph-container');
        const secondaryVerticalGraph = document.getElementById('secondary-vertical-projection-graph')?.closest('.graph-container');
        const rightAnalysisPane = document.getElementById('right-analysis-pane');
        const bottomAnalysisPane = document.getElementById('bottom-main-analysis-pane');
        const rightAnalysisPaneRect = rightAnalysisPane.getBoundingClientRect(); // Moved up for clarity
        const bottomAnalysisPaneRect = bottomAnalysisPane.getBoundingClientRect(); // Moved up

        const containerRect = projectionContainer ? projectionContainer.getBoundingClientRect() : {left: 0, top: 0, width: window.innerWidth, height: window.innerHeight}; // Fallback
        
        // 1) Store absolute position of image-canvas-wrapper
        const imageRect = imageCanvasWrapper.getBoundingClientRect();
        
        // Calculate relative positions to container
        const imageLeft = imageRect.left - containerRect.left;
        const imageTop = imageRect.top - containerRect.top;
        
        // 2) Store primary-horizontal-projection-graph position relative to right of image-canvas
        // Note: horizontal projection graphs are vertically oriented (on the right)
        const primaryHorizontalRect = primaryHorizontalGraph.getBoundingClientRect();
        const primaryHorizontalOffsetRight = primaryHorizontalRect.left - imageRect.right;
        const primaryHorizontalOffsetTop = primaryHorizontalRect.top - imageRect.top;
        
        // 3) Store secondary-horizontal-projection-graph position relative to right of primary-horizontal
        const secondaryHorizontalRect = secondaryHorizontalGraph.getBoundingClientRect();
        const secondaryHorizontalOffsetRight = secondaryHorizontalRect.left - primaryHorizontalRect.right;
        const secondaryHorizontalOffsetTop = secondaryHorizontalRect.top - primaryHorizontalRect.top;
        
        // 4) Store primary-vertical-projection-graph position relative to bottom of image canvas
        // Note: vertical projection graphs are horizontally oriented (at the bottom)
        const primaryVerticalRect = primaryVerticalGraph.getBoundingClientRect();
        const primaryVerticalOffsetBottom = primaryVerticalRect.top - imageRect.bottom;
        const primaryVerticalOffsetLeft = primaryVerticalRect.left - imageRect.left;
        
        // 5) Store secondary-vertical-projection-graph position relative to primary vertical graph
        const secondaryVerticalRect = secondaryVerticalGraph.getBoundingClientRect();
        const secondaryVerticalOffsetBottom = secondaryVerticalRect.top - primaryVerticalRect.bottom;
        const secondaryVerticalOffsetLeft = secondaryVerticalRect.left - primaryVerticalRect.left;
        
        // 6-7) Store analysis panes with absolute positioning
        const rightAnalysisRect = rightAnalysisPane.getBoundingClientRect();
        const rightAnalysisLeft = rightAnalysisRect.left - containerRect.left;
        const rightAnalysisTop = rightAnalysisRect.top - containerRect.top;
        
        const bottomAnalysisRect = bottomAnalysisPane.getBoundingClientRect();
        const bottomAnalysisLeft = bottomAnalysisRect.left - containerRect.left;
        const bottomAnalysisTop = bottomAnalysisRect.top - containerRect.top;
        
        // Create layout object
        const layoutPositions = {
            imageCanvas: {
                left: Math.round(imageLeft),
                top: Math.round(imageTop),
                width: Math.round(imageRect.width),
                height: Math.round(imageRect.height)
            },
            primaryHorizontalGraph: {
                offsetRight: Math.round(primaryHorizontalOffsetRight),
                offsetTop: Math.round(primaryHorizontalOffsetTop),
                width: Math.round(primaryHorizontalRect.width),
                height: Math.round(primaryHorizontalRect.height)
            },
            secondaryHorizontalGraph: {
                offsetRight: Math.round(secondaryHorizontalOffsetRight), 
                offsetTop: Math.round(secondaryHorizontalOffsetTop),
                width: Math.round(secondaryHorizontalRect.width),
                height: Math.round(secondaryHorizontalRect.height)
            },
            primaryVerticalGraph: {
                offsetBottom: Math.round(primaryVerticalOffsetBottom),
                offsetLeft: Math.round(primaryVerticalOffsetLeft),
                width: Math.round(primaryVerticalRect.width),
                height: Math.round(primaryVerticalRect.height)
            },
            secondaryVerticalGraph: {
                offsetBottom: Math.round(secondaryVerticalOffsetBottom),
                offsetLeft: Math.round(secondaryVerticalOffsetLeft),
                width: Math.round(secondaryVerticalRect.width),
                height: Math.round(secondaryVerticalRect.height)
            },
            rightAnalysisPane: {
                left: Math.round(rightAnalysisLeft),
                top: Math.round(rightAnalysisTop),
                width: Math.round(rightAnalysisRect.width),
                height: Math.round(rightAnalysisRect.height)
            },
            bottomAnalysisPane: {
                left: Math.round(bottomAnalysisLeft),
                top: Math.round(bottomAnalysisTop),
                width: Math.round(bottomAnalysisRect.width),
                height: Math.round(bottomAnalysisRect.height)
            }
        };
        
        localStorage.setItem('projectionLayoutPositions', JSON.stringify(layoutPositions));
        showNotification('Layout positions saved');
        console.log('%cLayout saved:', 'font-weight:bold; color: green;', layoutPositions);
    }
    
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
        
        /* Add specific styles for all canvases to ensure they clear the drag handles */
        .graph-container canvas, #image-canvas-wrapper canvas {
            margin-top: 36px; /* Space for the drag handle */
        }
        
        /* Ensure graph labels are properly positioned */
        .graph-label {
            margin-top: 5px;
            font-weight: bold;
            text-align: center;
        }
        
        /* Style for the drag handles */
        .drag-handle {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10;
            cursor: move;
        }
        
        /* Ensure analysis panes have proper internal spacing */
        .analysis-pane {
            padding-top: 40px; /* Space for header plus some extra */
        }
        
        /* Make sure analysis content doesn't touch the edges */
        .analysis-content {
            padding: 10px;
        }
        
        /* Ensure draggable elements have proper spacing */
        .draggable {
            padding-top: 36px; /* Ensure space for drag handle */
            position: relative;
            overflow: visible; /* Allow the drag handle to be visible */
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
        // Remove all style elements we added
        if (document.head.contains(styleElement)) {
            document.head.removeChild(styleElement);
        }
        
        if (document.head.contains(controlsStyle)) {
            document.head.removeChild(controlsStyle);
        }
        
        // Remove any other styles we might have added
        const styles = document.head.querySelectorAll('style[data-projection-style]');
        styles.forEach(style => {
            document.head.removeChild(style);
        });
        
        // Remove the overlay
        if (document.body.contains(projectionOverlay)) {
            document.body.removeChild(projectionOverlay);
        }
        
        // Re-enable the button
        projectionButton.disabled = false;
        projectionButton.classList.remove('disabled');
        
        console.log('Projection display cleaned up');
    };
    
    // STEP 7: Initialize draggable elements with proper container
    console.log('Initializing draggable elements with enhanced container detection');
    
    // Ensure we have a proper container
    let draggableContainer = projectionOverlay;
    
    // Check if we need to create a content container
    if (!document.getElementById('projection-content')) {
        // Create a container for all draggable content
        const contentContainer = document.createElement('div');
        contentContainer.id = 'projection-content';
        contentContainer.style.position = 'relative'; 
        contentContainer.style.width = '100%';
        contentContainer.style.height = 'calc(100% - 100px)'; // Leave room for controls
        contentContainer.style.overflow = 'hidden';
        
        // Extract controls so we can position them at the bottom
        const controls = projectionOverlay.querySelector('.projection-controls');
        
        // Move all elements except controls into the content container
        Array.from(projectionOverlay.children).forEach(child => {
            if (child !== controls) {
                contentContainer.appendChild(child);
            }
        });
        
        // Add content container back to the main overlay
        if (controls) {
            projectionOverlay.insertBefore(contentContainer, controls);
        } else {
            projectionOverlay.appendChild(contentContainer);
        }
        
        // Set this as our draggable container
        draggableContainer = contentContainer;
        console.log('Created projection-content container for draggables');
    } else {
        draggableContainer = document.getElementById('projection-content');
        console.log('Using existing projection-content container');
    }
    
    // Find all elements that need to be draggable using their IDs or a common class if applicable
    const draggableElements = [
        document.getElementById('image-canvas-wrapper'), // The new wrapper for the image canvas
        document.getElementById('right-analysis-pane'),
        document.getElementById('bottom-main-analysis-pane'),
        // Use querySelectorAll for graph containers as they share a class
        // but ensure they are direct children of the projection-main-area or right-section to avoid nesting issues.
        // This example assumes graph containers are identifiable and directly within the draggable area.
    ];

    // Add graph containers. We select them by their common class or structure.
    // Ensure these selectors are precise to avoid making unintended elements draggable.
    projectionOverlay.querySelectorAll('.graph-container').forEach(gc => draggableElements.push(gc));
    
    // Filter out any null elements if some IDs don't exist
    const validDraggableElements = draggableElements.filter(el => el);
    
    // Initialize each element with our simplified draggable function
    validDraggableElements.forEach(element => {
        // Remove any existing draggable initialization
        element.classList.remove('draggable-initialized');
        
        // Store original position for reset
        const rect = element.getBoundingClientRect();
        const containerRect = draggableContainer.getBoundingClientRect();
        
        element.dataset.originalLeft = (rect.left - containerRect.left) + 'px';
        element.dataset.originalTop = (rect.top - containerRect.top) + 'px';
        
        // Add .draggable class if not already present, ensure it's applied for styling
        if (!element.classList.contains('draggable')) {
             element.classList.add('draggable');
        }
        
        console.log(`Making ${element.id || element.className} draggable within ${draggableContainer.id || 'unnamed-container'}`);
        
        // Apply draggable behavior
        makeElementDraggable(element, draggableContainer);
    });
    
    // Additionally, make any other graph containers draggable that we might have missed
    const projectionArea = draggableContainer || projectionOverlay;
    
    // Find all potential draggable elements: graph containers and other visual elements
    const additionalDraggables = [
        ...projectionArea.querySelectorAll('.graph-container'),
        ...projectionArea.querySelectorAll('.primary-image-col > *'),
        ...projectionArea.querySelectorAll('.horizontal-graphs-row > *'),
        ...projectionArea.querySelectorAll('.vertical-graph-section > *')
    ].filter(el => el && !el.classList.contains('draggable-initialized')); // Only include elements not already initialized
    
    console.log(`Found ${additionalDraggables.length} additional elements to make draggable`);
    
    // Make these elements draggable too
    additionalDraggables.forEach(element => {
        // Skip elements without a proper display style or that are very small
        if (element.offsetWidth < 50 || element.offsetHeight < 50) {
            return;
        }
        
        // Store original position for reset
        const rect = element.getBoundingClientRect();
        const containerRect = projectionArea.getBoundingClientRect();
        
        element.dataset.originalLeft = (rect.left - containerRect.left) + 'px';
        element.dataset.originalTop = (rect.top - containerRect.top) + 'px';
        
        // Add draggable class if not present
        if (!element.classList.contains('draggable')) {
            element.classList.add('draggable');
        }
        
        console.log(`Making additional element draggable: ${element.id || element.className}`);
        
        // Apply draggable behavior
        makeElementDraggable(element, projectionArea);
    });
    
    // After all draggable elements are set up, try to apply saved layout
    setTimeout(() => {
        applyLayoutPositions(); // This calls the local applyLayoutPositions
    }, 100);
    
    // Function to apply saved layout positions
    function applyLayoutPositions() {
        console.log('Applying saved layout positions...');
        
        const savedLayout = localStorage.getItem('projectionLayoutPositions');
        if (!savedLayout) {
            console.log('No saved layout found');
            return false;
        }
        
        try {
            const layoutPositions = JSON.parse(savedLayout);
            console.log('%cLoaded layoutPositions from localStorage:', 'font-weight:bold; color: orange;', JSON.parse(JSON.stringify(layoutPositions)));
            
            const projectionContainer = document.getElementById('projection-content') || 
                                       document.getElementById('projection-overlay');
            
            if (projectionContainer) {
                const pcRectApply = projectionContainer.getBoundingClientRect();
                const pcStylesApply = getComputedStyle(projectionContainer);
                console.log('%cState of projectionContainer at start of applyLayoutPositions:', 'font-weight:bold; color: blue;', {
                    id: projectionContainer.id,
                    rect: JSON.parse(JSON.stringify(pcRectApply)),
                    paddingLeft: pcStylesApply.paddingLeft,
                    paddingTop: pcStylesApply.paddingTop,
                    marginLeft: pcStylesApply.marginLeft,
                    marginTop: pcStylesApply.marginTop,
                    borderLeftWidth: pcStylesApply.borderLeftWidth,
                    borderTopWidth: pcStylesApply.borderTopWidth,
                    offsetLeft: projectionContainer.offsetLeft, // Also log offsetLeft/Top
                    offsetTop: projectionContainer.offsetTop
                });
            } else {
                console.warn('projectionContainer not found at start of applyLayoutPositions');
            }
            const containerRectForApply = projectionContainer ? projectionContainer.getBoundingClientRect() : {left: 0, top: 0, width: window.innerWidth, height: window.innerHeight}; // Fallback
            
            // Get references to all elements needed for layout
            const imageCanvasWrapper = document.getElementById('image-canvas-wrapper');
            const imageCanvas = document.getElementById('image-canvas');
            const primaryHorizontalGraph = document.getElementById('primary-horizontal-projection-graph')?.closest('.graph-container');
            const secondaryHorizontalGraph = document.getElementById('secondary-horizontal-projection-graph')?.closest('.graph-container');
            const primaryVerticalGraph = document.getElementById('primary-vertical-projection-graph')?.closest('.graph-container');
            const secondaryVerticalGraph = document.getElementById('secondary-vertical-projection-graph')?.closest('.graph-container');
            const rightAnalysisPane = document.getElementById('right-analysis-pane');
            const bottomAnalysisPane = document.getElementById('bottom-main-analysis-pane');
            
            // Apply positions if all elements exist
            if (imageCanvasWrapper && imageCanvas && primaryHorizontalGraph && secondaryHorizontalGraph && 
                primaryVerticalGraph && secondaryVerticalGraph && rightAnalysisPane && bottomAnalysisPane) {
                
                console.log('All target elements for layout application found.');

                console.log(`Applying to imageCanvasWrapper: left=${layoutPositions.imageCanvas.left}px, top=${layoutPositions.imageCanvas.top}px`);
                imageCanvasWrapper.style.position = 'absolute';
                imageCanvasWrapper.style.left = `${layoutPositions.imageCanvas.left}px`;
                imageCanvasWrapper.style.top = `${layoutPositions.imageCanvas.top}px`;
                
                setTimeout(() => {
                    const imageRect = imageCanvasWrapper.getBoundingClientRect(); 
                    const containerRect = containerRectForApply; 
                    console.log('imageCanvasWrapper rect after positioning:', JSON.parse(JSON.stringify(imageRect)), 'using containerRect.left:', containerRect.left, 'containerRect.top:', containerRect.top);

                    const phgLeft = imageRect.right - containerRect.left + layoutPositions.primaryHorizontalGraph.offsetRight;
                    const phgTop = imageRect.top - containerRect.top + layoutPositions.primaryHorizontalGraph.offsetTop;
                    console.log(`Applying to primaryHorizontalGraph: left=${phgLeft}px, top=${phgTop}px, width=${layoutPositions.primaryHorizontalGraph.width}px, height=${imageRect.height}px (matches image)`);
                    primaryHorizontalGraph.style.position = 'absolute';
                    primaryHorizontalGraph.style.left = `${phgLeft}px`;
                    primaryHorizontalGraph.style.top = `${phgTop}px`;
                    primaryHorizontalGraph.style.height = `${imageRect.height}px`; 
                    primaryHorizontalGraph.style.width = `${layoutPositions.primaryHorizontalGraph.width}px`;
                    
                    setTimeout(() => {
                        const primaryHorizontalRect = primaryHorizontalGraph.getBoundingClientRect();
                        console.log('primaryHorizontalGraph rect after positioning:', JSON.parse(JSON.stringify(primaryHorizontalRect)));
                        
                        const shgLeft = primaryHorizontalRect.right - containerRect.left + layoutPositions.secondaryHorizontalGraph.offsetRight;
                        const shgTop = primaryHorizontalRect.top - containerRect.top + layoutPositions.secondaryHorizontalGraph.offsetTop;
                        console.log(`Applying to secondaryHorizontalGraph: left=${shgLeft}px, top=${shgTop}px, width=${layoutPositions.secondaryHorizontalGraph.width}px, height=${primaryHorizontalRect.height}px (matches primary)`);
                        secondaryHorizontalGraph.style.position = 'absolute';
                        secondaryHorizontalGraph.style.left = `${shgLeft}px`;
                        secondaryHorizontalGraph.style.top = `${shgTop}px`;
                        secondaryHorizontalGraph.style.height = `${primaryHorizontalRect.height}px`; 
                        secondaryHorizontalGraph.style.width = `${layoutPositions.secondaryHorizontalGraph.width}px`;
                    }, 10);
                    
                    const pvgTop = imageRect.bottom - containerRect.top + layoutPositions.primaryVerticalGraph.offsetBottom;
                    const pvgLeft = imageRect.left - containerRect.left + layoutPositions.primaryVerticalGraph.offsetLeft;
                    console.log(`Applying to primaryVerticalGraph: left=${pvgLeft}px, top=${pvgTop}px, width=${imageRect.width}px (matches image), height=${layoutPositions.primaryVerticalGraph.height}px`);
                    primaryVerticalGraph.style.position = 'absolute';
                    primaryVerticalGraph.style.top = `${pvgTop}px`;
                    primaryVerticalGraph.style.left = `${pvgLeft}px`;
                    primaryVerticalGraph.style.width = `${imageRect.width}px`; 
                    primaryVerticalGraph.style.height = `${layoutPositions.primaryVerticalGraph.height}px`;
                    
                    setTimeout(() => {
                        const primaryVerticalRect = primaryVerticalGraph.getBoundingClientRect();
                        console.log('primaryVerticalGraph rect after positioning:', JSON.parse(JSON.stringify(primaryVerticalRect)));

                        const svgTop = primaryVerticalRect.bottom - containerRect.top + layoutPositions.secondaryVerticalGraph.offsetBottom;
                        const svgLeft = primaryVerticalRect.left - containerRect.left + layoutPositions.secondaryVerticalGraph.offsetLeft;
                        console.log(`Applying to secondaryVerticalGraph: left=${svgLeft}px, top=${svgTop}px, width=${primaryVerticalRect.width}px (matches primary), height=${layoutPositions.secondaryVerticalGraph.height}px`);
                        secondaryVerticalGraph.style.position = 'absolute';
                        secondaryVerticalGraph.style.top = `${svgTop}px`;
                        secondaryVerticalGraph.style.left = `${svgLeft}px`;
                        secondaryVerticalGraph.style.width = `${primaryVerticalRect.width}px`; 
                        secondaryVerticalGraph.style.height = `${layoutPositions.secondaryVerticalGraph.height}px`;
                    }, 10);
                    
                    console.log(`Applying to rightAnalysisPane: left=${layoutPositions.rightAnalysisPane.left}px, top=${layoutPositions.rightAnalysisPane.top}px, width=${layoutPositions.rightAnalysisPane.width}px, height=${layoutPositions.rightAnalysisPane.height}px`);
                    rightAnalysisPane.style.position = 'absolute';
                    rightAnalysisPane.style.left = `${layoutPositions.rightAnalysisPane.left}px`;
                    rightAnalysisPane.style.top = `${layoutPositions.rightAnalysisPane.top}px`;
                    rightAnalysisPane.style.width = `${layoutPositions.rightAnalysisPane.width}px`;
                    rightAnalysisPane.style.height = `${layoutPositions.rightAnalysisPane.height}px`; 
                    
                    console.log(`Applying to bottomAnalysisPane: left=${layoutPositions.bottomAnalysisPane.left}px, top=${layoutPositions.bottomAnalysisPane.top}px, width=${layoutPositions.bottomAnalysisPane.width}px, height=${layoutPositions.bottomAnalysisPane.height}px`);
                    bottomAnalysisPane.style.position = 'absolute';
                    bottomAnalysisPane.style.left = `${layoutPositions.bottomAnalysisPane.left}px`;
                    bottomAnalysisPane.style.top = `${layoutPositions.bottomAnalysisPane.top}px`;
                    bottomAnalysisPane.style.width = `${layoutPositions.bottomAnalysisPane.width}px`;
                    bottomAnalysisPane.style.height = `${layoutPositions.bottomAnalysisPane.height}px`;

                    setTimeout(() => {
                        const adjustPaneSize = (pane, savedLayoutPane) => { // Renamed to avoid conflict
                            if (!pane || !savedLayoutPane) return;
                            console.log(`Initial check for ${pane.id}: scrollH=${pane.scrollHeight}, clientH=${pane.clientHeight}, scrollW=${pane.scrollWidth}, clientW=${pane.clientWidth}`);
                            
                            const originalW = pane.style.width;
                            const originalH = pane.style.height;
                            pane.style.width = 'auto';
                            pane.style.height = 'auto';

                            const contentWidth = pane.scrollWidth;
                            const contentHeight = pane.scrollHeight;
                            console.log(`${pane.id} natural content size: W=${contentWidth}, H=${contentHeight}`);

                            pane.style.width = originalW; 
                            pane.style.height = originalH;

                            let newWidth = parseFloat(originalW);
                            let newHeight = parseFloat(originalH);

                            if (contentWidth > newWidth - 30) { 
                                newWidth = contentWidth + 30;
                                console.log(`${pane.id} adjusting width to content: ${newWidth}px`);
                            }
                            if (contentHeight > newHeight - 20) { 
                                newHeight = contentHeight + 20;
                                console.log(`${pane.id} adjusting height to content: ${newHeight}px`);
                            }
                            pane.style.width = `${newWidth}px`;
                            pane.style.height = `${newHeight}px`;
                            console.log(`Final adjusted size for ${pane.id}: W=${pane.style.width}, H=${pane.style.height}`);
                        };

                        adjustPaneSize(rightAnalysisPane, layoutPositions.rightAnalysisPane);
                        adjustPaneSize(bottomAnalysisPane, layoutPositions.bottomAnalysisPane);
                    }, 50);

                }, 20); 
                
                console.log('Layout positions application initiated.');
                return true;
            } else {
                console.warn('Some elements not found, cannot apply layout. Missing elements:', {
                    imageCanvasWrapper: !!imageCanvasWrapper,
                    imageCanvas: !!imageCanvas,
                    primaryHorizontalGraph: !!primaryHorizontalGraph,
                    secondaryHorizontalGraph: !!secondaryHorizontalGraph,
                    primaryVerticalGraph: !!primaryVerticalGraph,
                    secondaryVerticalGraph: !!secondaryVerticalGraph,
                    rightAnalysisPane: !!rightAnalysisPane,
                    bottomAnalysisPane: !!bottomAnalysisPane
                });
                return false;
            }
        } catch (err) {
            console.error('Error applying layout positions:', err);
            return false;
        }
    }
    
    // Set up algorithm button handlers
    setupAlgorithmButtons(horizontal, vertical, 
                         primaryHorizontalProjectionGraphCtx, primaryVerticalProjectionGraphCtx,
                         secondaryHorizontalProjectionGraphCtx, secondaryVerticalProjectionGraphCtx,
                         horizontalGraphWidth, finalImageHeight, 
                         finalImageWidth, verticalGraphHeight);
    
    // Ensure the projection-controls div is always at the bottom
    const projectionControls = projectionOverlay.querySelector('.projection-controls');
    if (projectionControls) {
        projectionOverlay.appendChild(projectionControls);
        
        // Make sure controls have a proper z-index to stay on top
        projectionControls.style.zIndex = '1000';
        projectionControls.style.position = 'relative';
    }

    // Add CSS styles to ensure projection-controls stay fixed at the bottom
    const controlsStyle = document.createElement('style');
    controlsStyle.textContent = `
        .projection-controls {
            position: absolute !important;
            bottom: 20px !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 1000 !important;
        }
        
        /* Fix for custom layout mode to prevent elements from disappearing */
        .projection-layout.custom-layout .draggable {
            position: absolute !important;
            display: block !important;
            visibility: visible !important;
        }
    `;
    document.head.appendChild(controlsStyle);
    
    // Return the cleanup function in case it's needed elsewhere
    return cleanup;
}


// Helper function to set up algorithm buttons
