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
    
    // Create the HTML layout with EXACT matching dimensions
    projectionOverlay.innerHTML = `
        <div class="projection-main-area">
            <div class="projection-top-row">
                <div class="primary-image-col">
                    <div id="image-canvas-wrapper" data-drag-title="Image Preview">
                <canvas id="image-canvas" width="${finalImageWidth}" height="${finalImageHeight}"></canvas>
                    </div>
                    <div class="graph-container horizontal" data-drag-title="Primary Vertical Projection">
                <canvas id="primary-vertical-projection-graph" width="${finalImageWidth}" height="${verticalGraphHeight}"></canvas>
                        <div class="graph-label">Primary Vertical Projection</div>
            </div>
                    <div class="graph-container horizontal" data-drag-title="Secondary Vertical Graph">
                <canvas id="secondary-vertical-projection-graph" width="${finalImageWidth}" height="${verticalGraphHeight}"></canvas>
                        <div class="graph-label">Secondary Vertical Graph</div>
            </div>
                    <div id="bottom-main-analysis-pane" class="analysis-pane" data-drag-title="Bottom Analysis">
                        <h3>Bottom Analysis Pane</h3>
                        <div class="analysis-content">
                            <p>Future analysis will appear here</p>
                        </div>
                    </div>
                </div>
                <div class="right-section">
                    <div class="horizontal-graphs-row">
                        <div class="graph-container vertical" data-drag-title="Horizontal Projection">
                <canvas id="primary-horizontal-projection-graph" width="${horizontalGraphWidth}" height="${finalImageHeight}"></canvas>
                            <div class="graph-label">Horizontal Projection</div>
            </div>
                        <div class="graph-container vertical" data-drag-title="Secondary Horizontal Graph">
                <canvas id="secondary-horizontal-projection-graph" width="${horizontalGraphWidth}" height="${finalImageHeight}"></canvas>
                            <div class="graph-label">Secondary Horizontal Graph</div>
            </div>
                    </div>
                    <div id="right-analysis-pane" class="analysis-pane" data-drag-title="Right Analysis">
                <h3>Right Analysis Pane</h3>
                <div class="analysis-content">
                            <p>Future analysis will appear here</p>
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
                <button id="algo-btn-4" class="algo-btn">Mod+FFT</button>
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
        
        // Get references to all draggable elements
        const imageCanvasWrapper = document.getElementById('image-canvas-wrapper');
        const primaryHorizontalGraph = document.getElementById('primary-horizontal-projection-graph').closest('.graph-container');
        const secondaryHorizontalGraph = document.getElementById('secondary-horizontal-projection-graph').closest('.graph-container');
        const primaryVerticalGraph = document.getElementById('primary-vertical-projection-graph').closest('.graph-container');
        const secondaryVerticalGraph = document.getElementById('secondary-vertical-projection-graph').closest('.graph-container');
        const rightAnalysisPane = document.getElementById('right-analysis-pane');
        const bottomAnalysisPane = document.getElementById('bottom-main-analysis-pane');
        
        // Get the projection overlay container for reference
        const projectionContainer = document.getElementById('projection-content') || 
                                  document.getElementById('projection-overlay');
        
        // 1) Store absolute position of image-canvas-wrapper
        const imageRect = imageCanvasWrapper.getBoundingClientRect();
        const containerRect = projectionContainer.getBoundingClientRect();
        
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
                left: imageLeft,
                top: imageTop,
                width: imageRect.width,
                height: imageRect.height
            },
            primaryHorizontalGraph: {
                offsetRight: primaryHorizontalOffsetRight,
                offsetTop: primaryHorizontalOffsetTop,
                width: primaryHorizontalRect.width,
                height: primaryHorizontalRect.height
            },
            secondaryHorizontalGraph: {
                offsetRight: secondaryHorizontalOffsetRight, 
                offsetTop: secondaryHorizontalOffsetTop,
                width: secondaryHorizontalRect.width,
                height: secondaryHorizontalRect.height
            },
            primaryVerticalGraph: {
                offsetBottom: primaryVerticalOffsetBottom,
                offsetLeft: primaryVerticalOffsetLeft,
                width: primaryVerticalRect.width,
                height: primaryVerticalRect.height
            },
            secondaryVerticalGraph: {
                offsetBottom: secondaryVerticalOffsetBottom,
                offsetLeft: secondaryVerticalOffsetLeft,
                width: secondaryVerticalRect.width,
                height: secondaryVerticalRect.height
            },
            rightAnalysisPane: {
                left: rightAnalysisLeft,
                top: rightAnalysisTop,
                width: rightAnalysisRect.width,
                height: rightAnalysisRect.height
            },
            bottomAnalysisPane: {
                left: bottomAnalysisLeft,
                top: bottomAnalysisTop,
                width: bottomAnalysisRect.width,
                height: bottomAnalysisRect.height
            }
        };
        
        // Save to localStorage
        localStorage.setItem('projectionLayoutPositions', JSON.stringify(layoutPositions));
        
        // Show notification
        showNotification('Layout positions saved');
        console.log('Layout saved:', layoutPositions);
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
        applyLayoutPositions();
    }, 100);
    
    // Function to apply saved layout positions
    function applyLayoutPositions() {
        console.log('Applying saved layout positions...');
        
        // Get saved layout from localStorage
        const savedLayout = localStorage.getItem('projectionLayoutPositions');
        if (!savedLayout) {
            console.log('No saved layout found');
            return false;
        }
        
        try {
            const layoutPositions = JSON.parse(savedLayout);
            
            // Get references to all draggable elements
            const imageCanvasWrapper = document.getElementById('image-canvas-wrapper');
            const primaryHorizontalGraph = document.getElementById('primary-horizontal-projection-graph').closest('.graph-container');
            const secondaryHorizontalGraph = document.getElementById('secondary-horizontal-projection-graph').closest('.graph-container');
            const primaryVerticalGraph = document.getElementById('primary-vertical-projection-graph').closest('.graph-container');
            const secondaryVerticalGraph = document.getElementById('secondary-vertical-projection-graph').closest('.graph-container');
            const rightAnalysisPane = document.getElementById('right-analysis-pane');
            const bottomAnalysisPane = document.getElementById('bottom-main-analysis-pane');
            
            // Get the projection overlay container for reference
            const projectionContainer = document.getElementById('projection-content') || 
                                       document.getElementById('projection-overlay');
            
            // Apply positions if all elements exist
            if (imageCanvasWrapper && primaryHorizontalGraph && secondaryHorizontalGraph && 
                primaryVerticalGraph && secondaryVerticalGraph && rightAnalysisPane && bottomAnalysisPane) {
                
                // 1) Position the image canvas wrapper
                imageCanvasWrapper.style.position = 'absolute';
                imageCanvasWrapper.style.left = `${layoutPositions.imageCanvas.left}px`;
                imageCanvasWrapper.style.top = `${layoutPositions.imageCanvas.top}px`;
                imageCanvasWrapper.style.width = `${layoutPositions.imageCanvas.width}px`;
                imageCanvasWrapper.style.height = `${layoutPositions.imageCanvas.height}px`;
                
                // Wait for image canvas to be positioned
                setTimeout(() => {
                    // Get updated rects after positioning
                    const imageRect = imageCanvasWrapper.getBoundingClientRect();
                    const containerRect = projectionContainer.getBoundingClientRect();
                    
                    // 2) Position primary horizontal graph relative to image canvas right edge
                    primaryHorizontalGraph.style.position = 'absolute';
                    primaryHorizontalGraph.style.left = `${imageRect.right - containerRect.left + layoutPositions.primaryHorizontalGraph.offsetRight}px`;
                    primaryHorizontalGraph.style.top = `${imageRect.top - containerRect.top + layoutPositions.primaryHorizontalGraph.offsetTop}px`;
                    primaryHorizontalGraph.style.width = `${layoutPositions.primaryHorizontalGraph.width}px`;
                    primaryHorizontalGraph.style.height = `${layoutPositions.primaryHorizontalGraph.height}px`;
                    
                    // Wait for primary horizontal to be positioned
                    setTimeout(() => {
                        // Get updated primary horizontal rect
                        const primaryHorizontalRect = primaryHorizontalGraph.getBoundingClientRect();
                        
                        // 3) Position secondary horizontal graph relative to primary horizontal
                        secondaryHorizontalGraph.style.position = 'absolute';
                        secondaryHorizontalGraph.style.left = `${primaryHorizontalRect.right - containerRect.left + layoutPositions.secondaryHorizontalGraph.offsetRight}px`;
                        secondaryHorizontalGraph.style.top = `${primaryHorizontalRect.top - containerRect.top + layoutPositions.secondaryHorizontalGraph.offsetTop}px`;
                        secondaryHorizontalGraph.style.width = `${layoutPositions.secondaryHorizontalGraph.width}px`;
                        secondaryHorizontalGraph.style.height = `${layoutPositions.secondaryHorizontalGraph.height}px`;
                    }, 10);
                    
                    // 4) Position primary vertical graph relative to image canvas bottom edge
                    primaryVerticalGraph.style.position = 'absolute';
                    primaryVerticalGraph.style.top = `${imageRect.bottom - containerRect.top + layoutPositions.primaryVerticalGraph.offsetBottom}px`;
                    primaryVerticalGraph.style.left = `${imageRect.left - containerRect.left + layoutPositions.primaryVerticalGraph.offsetLeft}px`;
                    primaryVerticalGraph.style.width = `${layoutPositions.primaryVerticalGraph.width}px`;
                    primaryVerticalGraph.style.height = `${layoutPositions.primaryVerticalGraph.height}px`;
                    
                    // Wait for primary vertical to be positioned
                    setTimeout(() => {
                        // Get updated primary vertical rect
                        const primaryVerticalRect = primaryVerticalGraph.getBoundingClientRect();
                        
                        // 5) Position secondary vertical graph relative to primary vertical
                        secondaryVerticalGraph.style.position = 'absolute';
                        secondaryVerticalGraph.style.top = `${primaryVerticalRect.bottom - containerRect.top + layoutPositions.secondaryVerticalGraph.offsetBottom}px`;
                        secondaryVerticalGraph.style.left = `${primaryVerticalRect.left - containerRect.left + layoutPositions.secondaryVerticalGraph.offsetLeft}px`;
                        secondaryVerticalGraph.style.width = `${layoutPositions.secondaryVerticalGraph.width}px`;
                        secondaryVerticalGraph.style.height = `${layoutPositions.secondaryVerticalGraph.height}px`;
                    }, 10);
                    
                    // 6-7) Position analysis panes with absolute positioning
                    rightAnalysisPane.style.position = 'absolute';
                    rightAnalysisPane.style.left = `${layoutPositions.rightAnalysisPane.left}px`;
                    rightAnalysisPane.style.top = `${layoutPositions.rightAnalysisPane.top}px`;
                    rightAnalysisPane.style.width = `${layoutPositions.rightAnalysisPane.width}px`;
                    rightAnalysisPane.style.height = `${layoutPositions.rightAnalysisPane.height}px`;
                    
                    bottomAnalysisPane.style.position = 'absolute';
                    bottomAnalysisPane.style.left = `${layoutPositions.bottomAnalysisPane.left}px`;
                    bottomAnalysisPane.style.top = `${layoutPositions.bottomAnalysisPane.top}px`;
                    bottomAnalysisPane.style.width = `${layoutPositions.bottomAnalysisPane.width}px`;
                    bottomAnalysisPane.style.height = `${layoutPositions.bottomAnalysisPane.height}px`;
                }, 20);
                
                showNotification('Layout positions applied');
                console.log('Layout positions applied');
                return true;
            } else {
                console.warn('Some elements not found, cannot apply layout');
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

    // Find the container for draggables - needed for re-initialization
    const draggableContainer = document.getElementById('projection-content') || 
                               document.querySelector('.projection-main-area') ||
                               document.getElementById('projection-overlay');

    // Get references to the analysis panes
    const rightPane = document.getElementById('right-analysis-pane');
    const bottomPane = document.getElementById('bottom-main-analysis-pane');

    switch(algorithm) {
        case 1: // LPF button
            {
                const lpfWindowSize = 15; // Increased window size for more noticeable smoothing
                const filteredHorizontal = applyLPF(horizontalProfile, lpfWindowSize);
                const filteredVertical = applyLPF(verticalProfile, lpfWindowSize);

                plotDataHorizontal = normalize(filteredHorizontal, Math.max(...filteredHorizontal));
                plotDataVertical = normalize(filteredVertical, Math.max(...filteredVertical));
                
                // Update analysis pane with LPF information
                if (rightPane) {
                    rightPane.classList.remove('draggable-initialized'); // Allow re-init
                    rightPane.innerHTML = `
                    <h3>Low Pass Filter Results</h3>
                    <div class="analysis-content">
                        <p>Applied moving average filter with window size: ${lpfWindowSize}</p>
                        <p>This filter smooths the signal by reducing high-frequency components.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                    if (draggableContainer) makeElementDraggable(rightPane, draggableContainer);
                }
                 if (bottomPane) {
                    bottomPane.classList.remove('draggable-initialized');
                    bottomPane.innerHTML = `<h3>Algorithm ${algorithm} - Bottom</h3><div class="analysis-content"><p>LPF Applied</p></div>`;
                    if (draggableContainer) makeElementDraggable(bottomPane, draggableContainer);
                }
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
                if (rightPane) {
                    rightPane.classList.remove('draggable-initialized');
                    rightPane.innerHTML = `
                    <h3>Derivative Results</h3>
                    <div class="analysis-content">
                        <p>First derivative shows rate of change at each point.</p>
                        <p>Horizontal Derivative: Min=${minDerivHorizontal.toFixed(2)}, Max=${maxDerivHorizontal.toFixed(2)}</p>
                        <p>Vertical Derivative: Min=${minDerivVertical.toFixed(2)}, Max=${maxDerivVertical.toFixed(2)}</p>
                        <p>Zero-crossings indicate local maxima and minima in the original signal.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                     if (draggableContainer) makeElementDraggable(rightPane, draggableContainer);
                }
                 if (bottomPane) {
                    bottomPane.classList.remove('draggable-initialized');
                    bottomPane.innerHTML = `<h3>Algorithm ${algorithm} - Bottom</h3><div class="analysis-content"><p>Derivative Applied</p></div>`;
                    if (draggableContainer) makeElementDraggable(bottomPane, draggableContainer);
                }
            }
            break;
        case 3: // Derivative + FFT
        case 4: // Mod(Derivative) + FFT
            {
                const isMod = algorithm === 4;
                const titlePrefix = isMod ? "|Deriv|+FFT" : "Deriv+FFT";
                const analysisText = isMod ? "|Derivative| + FFT analysis" : "Derivative + FFT analysis";

                fftHorizontal = isMod ? calculateModDerivativeFFT(horizontalProfile) : calculateDerivativeFFT(horizontalProfile);
                fftVertical = isMod ? calculateModDerivativeFFT(verticalProfile) : calculateDerivativeFFT(verticalProfile);
                
                const originalHorizontalLength = horizontalProfile.length;
                const originalVerticalLength = verticalProfile.length;

                let horizontalPeaks = findFFTPeaks(fftHorizontal, 8, originalHorizontalLength);
                let verticalPeaks = findFFTPeaks(fftVertical, 8, originalVerticalLength);

                plotDataHorizontal = normalize(fftHorizontal, Math.max(...fftHorizontal));
                plotDataVertical = normalize(fftVertical, Math.max(...fftVertical));
                
                isDerivativeMode = true; // Use line chart for FFT magnitude
                
                minDerivHorizontal = 0;
                maxDerivHorizontal = Math.max(...fftHorizontal);
                minDerivVertical = 0;
                maxDerivVertical = Math.max(...fftVertical);
                
                // Update RIGHT analysis pane
                if (rightPane) {
                    console.log(`${new Date().toISOString()} - Updating rightPane (Algorithm ${algorithm})`);
                    console.log(`${new Date().toISOString()} - Before rightPane.innerHTML set`);
                    rightPane.classList.remove('draggable-initialized');
                    rightPane.innerHTML = `
                        <h3>Horizontal Proj. ${titlePrefix} Peaks</h3>
                        <div class="analysis-content">
                            <p>${analysisText} of horizontal projection:</p>
                            <table class="peak-table">
                                <tr><th>Rank</th><th>Bin</th><th>Frequency</th><th>λ (pixels)</th><th>Magnitude</th></tr>
                                ${horizontalPeaks.map((peak, i) => `
                                    <tr><td>${i+1}</td><td>${peak.index}</td><td>${peak.frequency.toFixed(4)} c/px</td><td>${peak.wavelength.toFixed(1)}</td><td>${peak.magnitude.toFixed(1)}</td></tr>
                                `).join('')}
                            </table>
                            <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                        </div>
                    `;
                    console.log(`${new Date().toISOString()} - After rightPane.innerHTML set`);
                    
                    requestAnimationFrame(() => {
                        console.log(`${new Date().toISOString()} - requestAnimationFrame for rightPane resize`);
                        rightPane.style.height = ''; // Reset height first
                        const rightScrollHeight = rightPane.scrollHeight;
                        const rightComputedStyle = getComputedStyle(rightPane);
                        
                        let rightMaxHeightPixels = Infinity; // Default to no limit
                        if (rightComputedStyle.maxHeight && rightComputedStyle.maxHeight !== 'none') {
                            const parsed = parseFloat(rightComputedStyle.maxHeight);
                            if (!isNaN(parsed) && parsed > 0) { // Check if it's a valid positive number
                                rightMaxHeightPixels = parsed;
                            } else {
                                console.warn(`${new Date().toISOString()} - rightPane: Could not parse valid number from maxHeight '${rightComputedStyle.maxHeight}'. Using Infinity.`);
                            }
                        }

                        const rightClientHeight = rightPane.clientHeight;
                        console.log(`${new Date().toISOString()} - rightPane measurements: scrollH=${rightScrollHeight}, clientH=${rightClientHeight}, computedH=${rightComputedStyle.height}, computedMaxH=${rightComputedStyle.maxHeight}(${rightMaxHeightPixels}px)`);
                        
                        if (rightScrollHeight > rightClientHeight && !rightPane.classList.contains('dragging')) {
                             const targetHeight = Math.min(rightScrollHeight + 10, rightMaxHeightPixels);
                             console.log(`${new Date().toISOString()} - rightPane targetHeight=${targetHeight}`);
                             rightPane.style.height = `${targetHeight}px`;
                             console.log(`${new Date().toISOString()} - rightPane style.height set to: ${rightPane.style.height}`);
                        }

                        if (draggableContainer) {
                            console.log(`${new Date().toISOString()} - Calling makeElementDraggable for rightPane`);
                            makeElementDraggable(rightPane, draggableContainer);
                        }
                    });

                } else {
                     if (rightPane && draggableContainer) {
                        console.log(`${new Date().toISOString()} - rightPane exists but no resize, calling makeElementDraggable`);
                        makeElementDraggable(rightPane, draggableContainer);
                     }
                }
                
                // Update BOTTOM analysis pane
                if (bottomPane) {
                    console.log(`${new Date().toISOString()} - Updating bottomPane (Algorithm ${algorithm})`);
                    console.log(`${new Date().toISOString()} - Before bottomPane.innerHTML set`);
                    bottomPane.classList.remove('draggable-initialized');
                    bottomPane.innerHTML = `
                        <h3>Vertical Proj. ${titlePrefix} Peaks</h3>
                        <div class="analysis-content">
                            <p>${analysisText} of vertical projection:</p>
                            <table class="peak-table">
                                <tr><th>Rank</th><th>Bin</th><th>Frequency</th><th>λ (pixels)</th><th>Magnitude</th></tr>
                                ${verticalPeaks.map((peak, i) => `
                                    <tr><td>${i+1}</td><td>${peak.index}</td><td>${peak.frequency.toFixed(4)} c/px</td><td>${peak.wavelength.toFixed(1)}</td><td>${peak.magnitude.toFixed(1)}</td></tr>
                                `).join('')}
                            </table>
                            <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                        </div>
                    `;
                    console.log(`${new Date().toISOString()} - After bottomPane.innerHTML set`);

                    requestAnimationFrame(() => {
                        console.log(`${new Date().toISOString()} - requestAnimationFrame for bottomPane resize`);
                        bottomPane.style.height = ''; // Reset height
                        const bottomScrollHeight = bottomPane.scrollHeight;
                        const bottomComputedStyle = getComputedStyle(bottomPane);
                        
                        let bottomMaxHeightPixels = Infinity; // Default to no limit
                        if (bottomComputedStyle.maxHeight && bottomComputedStyle.maxHeight !== 'none') {
                            const parsed = parseFloat(bottomComputedStyle.maxHeight);
                            if (!isNaN(parsed) && parsed > 0) { // Check if it's a valid positive number
                                bottomMaxHeightPixels = parsed;
                            } else {
                                console.warn(`${new Date().toISOString()} - bottomPane: Could not parse valid number from maxHeight '${bottomComputedStyle.maxHeight}'. Using Infinity.`);
                            }
                        }
                        
                        const bottomClientHeight = bottomPane.clientHeight;
                        console.log(`${new Date().toISOString()} - bottomPane measurements: scrollH=${bottomScrollHeight}, clientH=${bottomClientHeight}, computedH=${bottomComputedStyle.height}, computedMaxH=${bottomComputedStyle.maxHeight}(${bottomMaxHeightPixels}px)`);

                        if (bottomScrollHeight > bottomClientHeight && !bottomPane.classList.contains('dragging')) {
                            const targetHeight = Math.min(bottomScrollHeight + 10, bottomMaxHeightPixels);
                            console.log(`${new Date().toISOString()} - bottomPane targetHeight=${targetHeight}`);
                            bottomPane.style.height = `${targetHeight}px`;
                            console.log(`${new Date().toISOString()} - bottomPane style.height set to: ${bottomPane.style.height}`);
                        }

                        if (draggableContainer) {
                             console.log(`${new Date().toISOString()} - Calling makeElementDraggable for bottomPane`);
                            makeElementDraggable(bottomPane, draggableContainer);
                        }
                    });
                } else {
                    if (bottomPane && draggableContainer) {
                        console.log(`${new Date().toISOString()} - bottomPane exists but no resize, calling makeElementDraggable`);
                        makeElementDraggable(bottomPane, draggableContainer);
                    }
                }
            }
            break;
        default: // Algorithmic patterns (sine, step, etc.)
            {
                const baseHorizontalNormalized = normalize(horizontalProfile, Math.max(...horizontalProfile));
                const baseVerticalNormalized = normalize(verticalProfile, Math.max(...verticalProfile));
                
                plotDataHorizontal = new Array(baseHorizontalNormalized.length);
                plotDataVertical = new Array(baseVerticalNormalized.length);

                for (let i = 0; i < baseHorizontalNormalized.length; i++) {
                    plotDataHorizontal[i] = Math.abs(Math.sin(i * 0.1 * (algorithm % 3 + 1)) * 0.4 + 0.6);
                }

                for (let i = 0; i < baseVerticalNormalized.length; i++) {
                    plotDataVertical[i] = Math.abs(Math.sin(i * 0.05 * (algorithm % 3 + 1)) * 0.4 + 0.3);
                }
                
                // Update analysis pane with algorithm information
                 if (rightPane) {
                    rightPane.classList.remove('draggable-initialized');
                    rightPane.innerHTML = `
                    <h3>Algorithm ${algorithm} Results</h3>
                    <div class="analysis-content">
                        <p>Demonstrating pattern generation algorithm ${algorithm}.</p>
                        <p class="algorithm-timestamp">Timestamp: ${new Date().toLocaleTimeString()}</p>
                    </div>
                `;
                    if (draggableContainer) makeElementDraggable(rightPane, draggableContainer);
                }
                 if (bottomPane) {
                    bottomPane.classList.remove('draggable-initialized');
                    bottomPane.innerHTML = `<h3>Algorithm ${algorithm} - Bottom</h3><div class="analysis-content"><p>Pattern Applied</p></div>`;
                     if (draggableContainer) makeElementDraggable(bottomPane, draggableContainer);
                }
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

// Main canvas drag functionality for OCR
function setupMainCanvasDrag() {
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
    // Set up canvas size
    resizeCanvas();
    
    // Add event listeners for panning (dragging)
    canvas.addEventListener('mousedown', (e) => {
        // Only handle left mouse button
        if (e.button !== 0) return;
        
        // Don't start drag if Ctrl/Cmd is pressed (used for OCR drag)
        if (e.ctrlKey || e.metaKey) return;
        
        // Start dragging
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.classList.add('dragging');
    });
    
    document.addEventListener('mousemove', (e) => {
        // Handle thumbnail panel resizing
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
            return;
        }
        
        // Handle image panning
        if (!isDragging || isDraggingFile) return;
        
        // Calculate distance moved
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        
        // Update position
        offsetX += deltaX;
        offsetY += deltaY;
        
        // Update last position
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Re-render
        render();
        updateInfo();
    });
    
    document.addEventListener('mouseup', () => {
        // End image dragging
        isDragging = false;
        canvas.classList.remove('dragging');
        
        // End thumbnail panel resizing
        if (isResizingPanel) {
            isResizingPanel = false;
            document.body.style.cursor = '';
        }
    });
    
    // Add event listener for zooming (wheel)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Get mouse position
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate position in image space
        const imageX = (mouseX - offsetX) / zoomLevel;
        const imageY = (mouseY - offsetY) / zoomLevel;
        
        // Calculate zoom delta
        const delta = -Math.sign(e.deltaY) * 0.1;
        const newZoom = Math.max(0.1, Math.min(10, zoomLevel * (1 + delta)));
        
        // Apply zoom
        zoomLevel = newZoom;
        
        // Adjust offset to zoom around mouse position
        offsetX = mouseX - imageX * zoomLevel;
        offsetY = mouseY - imageY * zoomLevel;
        
        // Re-render
        render();
        updateInfo();
    });
    
    // Handle thumbnail panel toggle buttons
    toggleThumbnailsBtn.addEventListener('click', toggleThumbnailPanel);
    closeThumbnailsBtn.addEventListener('click', hideThumbnailPanel);
    
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
    
    // Set up Main Canvas dragging
    setupMainCanvasDrag();
    
    // Set up clipboard paste
    setupClipboardPaste();
    
    // Initialize thumbnail context menu
    addThumbnailContextMenu();
    
    console.log('Viewer app initialized with drag, zoom, OCR and clipboard support');
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
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            showPasteOverlay();
        }
    });
    
    // Add paste event listener to the document
    document.addEventListener('paste', (e) => {
        // Hide paste overlay
        hidePasteOverlay();
        
        // Check if there are any items to paste
        if (!e.clipboardData || !e.clipboardData.items) return;
        
        // Look for an image in the clipboard
        for (const item of e.clipboardData.items) {
            if (item.type.startsWith('image/')) {
                // Get the image file
                const file = item.getAsFile();
                if (!file) continue;
                
                // Give the file a name based on timestamp if it doesn't have one
                if (!file.name || file.name === 'image.png') {
                    const now = new Date();
                    file.name = `clipboard_${now.getFullYear()}-${(now.getMonth() + 1)
                        .toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now
                        .getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}.png`;
                }
                
                // Process the image file
                processImageFiles([file]);
                
                // Prevent default browser handling
                e.preventDefault();
                return;
            }
        }
        
        // If we get here, no image was found in the clipboard
        // Display a tip about pasting images
        showPasteTip();
    });
}

// Update the app UI with paste instructions
function showPasteTip() {
    const tip = document.createElement('div');
    tip.className = 'paste-tip';
    tip.textContent = 'Copy an image first, then paste here';
    
    document.body.appendChild(tip);
    
    // Auto-hide after 3 seconds
        setTimeout(() => {
        tip.classList.add('fade-out');
            setTimeout(() => {
            document.body.removeChild(tip);
        }, 500);
    }, 3000);
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
    };
    
    // Add the event listeners
    canvas.addEventListener('mousemove', canvas._tooltipMoveHandler);
    canvas.addEventListener('mouseleave', canvas._tooltipLeaveHandler);
    
}

// Simple implementation to make an element draggable and resizable
function makeElementDraggable(element, container) {
    if (!element || element.classList.contains('draggable-initialized')) return;
    
    // Mark as initialized
    element.classList.add('draggable-initialized');
    // Ensure .draggable class is present for CSS rules to apply
    if (!element.classList.contains('draggable')) {
    element.classList.add('draggable');
    }
    
    
    // Determine drag handle title
    let title = element.querySelector('h3')?.textContent || 
                element.dataset.dragTitle || // Use data-drag-title attribute
                element.id || // Fallback to ID
                'Draggable'; // Default
    if (title.length > 25) title = title.substring(0,22) + "..."; // Truncate long titles

    
    // Create simple drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = `
        <span class="drag-handle-title">${title}</span>
    `;
    
    // SIMPLIFIED DRAG HANDLER - No more transforms, simpler positioning
    dragHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get initial positions
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate mouse offset from element corner
        const mouseOffsetX = e.clientX - elementRect.left;
        const mouseOffsetY = e.clientY - elementRect.top;
     
        // Make sure element has absolute positioning
        if (getComputedStyle(element).position !== 'absolute') {
            element.style.position = 'absolute';
            
            // Get current position relative to container
            const currentLeft = elementRect.left - containerRect.left;
            const currentTop = elementRect.top - containerRect.top;
            
            // Set initial position
            element.style.left = currentLeft + 'px';
            element.style.top = currentTop + 'px';
            element.style.width = elementRect.width + 'px';
            element.style.height = elementRect.height + 'px';
        
        }
        
        element.classList.add('dragging');
        
        // Simple drag handler
        function handleDrag(moveEvent) {
            // Get current container position
            const currentContainerRect = container.getBoundingClientRect();
            
            // Calculate new position: mouse position - container position - mouse offset
            const newLeft = moveEvent.clientX - currentContainerRect.left - mouseOffsetX;
            const newTop = moveEvent.clientY - currentContainerRect.top - mouseOffsetY;
            
            // Get element dimensions for boundary checking
            const elemWidth = element.offsetWidth;
            const elemHeight = element.offsetHeight;
            
            // Constrain to container boundaries
            const maxLeft = currentContainerRect.width - elemWidth;
            const maxTop = currentContainerRect.height - elemHeight;
            
            const constrainedLeft = Math.max(0, Math.min(maxLeft, newLeft));
            const constrainedTop = Math.max(0, Math.min(maxTop, newTop));
            
            // Apply position
            element.style.left = constrainedLeft + 'px';
            element.style.top = constrainedTop + 'px';
            
         
        }
        
        function stopDrag() {
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            element.classList.remove('dragging');
            
           
        }
        
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
    });
    
    // Add handle to the element
    element.appendChild(dragHandle);
}

// Get elements to make draggable
const draggables = [
    document.getElementById('right-analysis-pane'),
    document.getElementById('bottom-main-analysis-pane'),
    // Graph containers
    ...document.querySelectorAll('.graph-container'),
    ...document.querySelectorAll('.primary-image-col > *'),
    ...document.querySelectorAll('.horizontal-graphs-row > *'),
    ...document.querySelectorAll('.vertical-graph-section > *')
].filter(el => el); // Filter out null elements

// Find a suitable container for draggable elements
const draggableContainer = document.getElementById('projection-content') || 
                           document.querySelector('.projection-main-area') ||
                           projectionOverlay;

console.log(`Found ${draggables.length} elements to make draggable in container: ${draggableContainer.className}`);

// Make all elements draggable
draggables.forEach(element => {
    // Make sure element is visible
    if (element.offsetWidth > 30 && element.offsetHeight > 30) {
        makeElementDraggable(element, draggableContainer);
        console.log(`Made element draggable: ${element.id || element.className}`);
    }
});

// After setting up all draggable elements, try to apply any saved layout
setTimeout(() => {
    // Try to load and apply saved layout
    if (!applyLayoutPositions()) {
        console.log('No saved layout or unable to apply it - using default layout');
    }
}, 100);

// Add a function to apply saved layout positions
function applyLayoutPositions() {
    console.log('Applying saved layout positions...');
    
    // Get saved layout from localStorage
    const savedLayout = localStorage.getItem('projectionLayoutPositions');
    if (!savedLayout) {
        console.log('No saved layout found');
        return false;
    }
    
    try {
        const layoutPositions = JSON.parse(savedLayout);
        
        // Get references to all draggable elements
        const imageCanvasWrapper = document.getElementById('image-canvas-wrapper');
        const primaryHorizontalGraph = document.getElementById('primary-horizontal-projection-graph').closest('.graph-container');
        const secondaryHorizontalGraph = document.getElementById('secondary-horizontal-projection-graph').closest('.graph-container');
        const primaryVerticalGraph = document.getElementById('primary-vertical-projection-graph').closest('.graph-container');
        const secondaryVerticalGraph = document.getElementById('secondary-vertical-projection-graph').closest('.graph-container');
        const rightAnalysisPane = document.getElementById('right-analysis-pane');
        const bottomAnalysisPane = document.getElementById('bottom-main-analysis-pane');
        
        // Get the projection overlay container for reference
        const projectionContainer = document.getElementById('projection-content') || 
                                  document.getElementById('projection-overlay');
        
        // Apply positions if all elements exist
        if (imageCanvasWrapper && primaryHorizontalGraph && secondaryHorizontalGraph && 
            primaryVerticalGraph && secondaryVerticalGraph && rightAnalysisPane && bottomAnalysisPane) {
            
            // 1) Position the image canvas wrapper
            imageCanvasWrapper.style.position = 'absolute';
            imageCanvasWrapper.style.left = `${layoutPositions.imageCanvas.left}px`;
            imageCanvasWrapper.style.top = `${layoutPositions.imageCanvas.top}px`;
            imageCanvasWrapper.style.width = `${layoutPositions.imageCanvas.width}px`;
            imageCanvasWrapper.style.height = `${layoutPositions.imageCanvas.height}px`;
            
            // Wait for image canvas to be positioned
            setTimeout(() => {
                // Get updated rects after positioning
                const imageRect = imageCanvasWrapper.getBoundingClientRect();
                
                // 2) Position primary horizontal graph relative to image canvas right edge
                primaryHorizontalGraph.style.position = 'absolute';
                primaryHorizontalGraph.style.left = `${imageRect.right - projectionContainer.getBoundingClientRect().left + layoutPositions.primaryHorizontalGraph.offsetRight}px`;
                primaryHorizontalGraph.style.top = `${imageRect.top - projectionContainer.getBoundingClientRect().top + layoutPositions.primaryHorizontalGraph.offsetTop}px`;
                primaryHorizontalGraph.style.width = `${layoutPositions.primaryHorizontalGraph.width}px`;
                primaryHorizontalGraph.style.height = `${layoutPositions.primaryHorizontalGraph.height}px`;
                
                // Wait for primary horizontal to be positioned
                setTimeout(() => {
                    // Get updated primary horizontal rect
                    const primaryHorizontalRect = primaryHorizontalGraph.getBoundingClientRect();
                    
                    // 3) Position secondary horizontal graph relative to primary horizontal
                    secondaryHorizontalGraph.style.position = 'absolute';
                    secondaryHorizontalGraph.style.left = `${primaryHorizontalRect.right - projectionContainer.getBoundingClientRect().left + layoutPositions.secondaryHorizontalGraph.offsetRight}px`;
                    secondaryHorizontalGraph.style.top = `${primaryHorizontalRect.top - projectionContainer.getBoundingClientRect().top + layoutPositions.secondaryHorizontalGraph.offsetTop}px`;
                    secondaryHorizontalGraph.style.width = `${layoutPositions.secondaryHorizontalGraph.width}px`;
                    secondaryHorizontalGraph.style.height = `${layoutPositions.secondaryHorizontalGraph.height}px`;
                }, 10);
                
                // 4) Position primary vertical graph relative to image canvas bottom edge
                primaryVerticalGraph.style.position = 'absolute';
                primaryVerticalGraph.style.top = `${imageRect.bottom - projectionContainer.getBoundingClientRect().top + layoutPositions.primaryVerticalGraph.offsetBottom}px`;
                primaryVerticalGraph.style.left = `${imageRect.left - projectionContainer.getBoundingClientRect().left + layoutPositions.primaryVerticalGraph.offsetLeft}px`;
                primaryVerticalGraph.style.width = `${layoutPositions.primaryVerticalGraph.width}px`;
                primaryVerticalGraph.style.height = `${layoutPositions.primaryVerticalGraph.height}px`;
                
                // Wait for primary vertical to be positioned
                setTimeout(() => {
                    // Get updated primary vertical rect
                    const primaryVerticalRect = primaryVerticalGraph.getBoundingClientRect();
                    
                    // 5) Position secondary vertical graph relative to primary vertical
                    secondaryVerticalGraph.style.position = 'absolute';
                    secondaryVerticalGraph.style.top = `${primaryVerticalRect.bottom - projectionContainer.getBoundingClientRect().top + layoutPositions.secondaryVerticalGraph.offsetBottom}px`;
                    secondaryVerticalGraph.style.left = `${primaryVerticalRect.left - projectionContainer.getBoundingClientRect().left + layoutPositions.secondaryVerticalGraph.offsetLeft}px`;
                    secondaryVerticalGraph.style.width = `${layoutPositions.secondaryVerticalGraph.width}px`;
                    secondaryVerticalGraph.style.height = `${layoutPositions.secondaryVerticalGraph.height}px`;
                }, 10);
                
                // 6-7) Position analysis panes with absolute positioning
                rightAnalysisPane.style.position = 'absolute';
                rightAnalysisPane.style.left = `${layoutPositions.rightAnalysisPane.left}px`;
                rightAnalysisPane.style.top = `${layoutPositions.rightAnalysisPane.top}px`;
                rightAnalysisPane.style.width = `${layoutPositions.rightAnalysisPane.width}px`;
                rightAnalysisPane.style.height = `${layoutPositions.rightAnalysisPane.height}px`;
                
                bottomAnalysisPane.style.position = 'absolute';
                bottomAnalysisPane.style.left = `${layoutPositions.bottomAnalysisPane.left}px`;
                bottomAnalysisPane.style.top = `${layoutPositions.bottomAnalysisPane.top}px`;
                bottomAnalysisPane.style.width = `${layoutPositions.bottomAnalysisPane.width}px`;
                bottomAnalysisPane.style.height = `${layoutPositions.bottomAnalysisPane.height}px`;
            }, 20);
            
            console.log('Layout positions applied');
            return true;
        } else {
            console.warn('Some elements not found, cannot apply layout');
            return false;
        }
    } catch (err) {
        console.error('Error applying layout positions:', err);
        return false;
    }
}
        