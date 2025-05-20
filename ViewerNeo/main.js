import ThumbnailPane from './thumbnail-gallery/thumbnail-pane.js';
import { createWindow, setTopBarOffset } from './window-manager/window-system.js';

document.addEventListener('DOMContentLoaded', () => {
    const topBar = document.getElementById('top-bar');
    const thumbnailGalleryContainer = document.getElementById('thumbnail-gallery-container');
    // The window-manager-container is where windows will be appended by window-system.js

    // Populate top bar with buttons
    for (let i = 1; i <= 10; i++) {
        const button = document.createElement('button');
        button.textContent = `Function ${i}`;
        button.id = `func-btn-${i}`;
        button.addEventListener('click', () => {
            console.log(`Function ${i} clicked`);
            // Example: Create a window when a button is clicked
            createWindow({
                title: `Window for Function ${i}`,
                content: `<p>Content for window ${i}. Timestamp: ${Date.now()}</p>`,
                x: 50 + (i * 20) % 300,
                y: 50 + (i * 20) % 200,
            });
        });
        topBar.appendChild(button);
    }

    // Set top bar offset for window manager
    const topBarHeight = topBar.offsetHeight;
    setTopBarOffset(topBarHeight);

    // Initialize Thumbnail Gallery
    if (customElements.get('thumbnail-pane')) {
        const thumbnailPane = document.createElement('thumbnail-pane');
        thumbnailGalleryContainer.appendChild(thumbnailPane);

        // Example: Populate thumbnail gallery with some data
        // This is a placeholder. You'll need to adapt this to how your ThumbnailPane expects data.
        const sampleBatches = [
            {
                batchTitle: 'Sample Batch 1',
                expanded: true,
                files: [
                    { name: 'Image1.jpg', type: 'image/jpeg', dataUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Img1' },
                    { name: 'Image2.png', type: 'image/png', dataUrl: 'https://via.placeholder.com/150/00FF00/FFFFFF?text=Img2' },
                ]
            },
            {
                batchTitle: 'Sample Batch 2',
                expanded: false,
                files: [
                    { name: 'Doc1.pdf', type: 'application/pdf', dataUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=PDF1' },
                ]
            }
        ];
        // thumbnailPane.setData(sampleBatches); // Assuming a method like this exists
        // OR: thumbnailPane.addBatch(...) or thumbnailPane.addFilesAsNewBatch(...)
        // Check ThumbnailGallery API for correct usage.
        // For now, let's try to call a method that might exist based on previous context
        if (thumbnailPane.createNewBatch && typeof thumbnailPane.createNewBatch === 'function') {
            sampleBatches.forEach(batch => {
                const filesArray = batch.files.map(f => new File([""], f.name, {type: f.type})); // Mock File objects
                thumbnailPane.createNewBatch(filesArray, { batchTitle: batch.batchTitle, expanded: batch.expanded });
            });
        } else if (thumbnailPane.setData && typeof thumbnailPane.setData === 'function') {
            thumbnailPane.setData(sampleBatches); 
        }
        

        // Example: Handle thumbnail selection
        thumbnailPane.addEventListener('thumbnail-selected', (event) => {
            const selectedItem = event.detail; // Assuming event.detail contains info about the selected thumbnail
            console.log('Thumbnail selected:', selectedItem);
            createWindow({
                title: selectedItem.name || 'New Window from Thumbnail',
                content: `<h2>${selectedItem.name}</h2><img src="${selectedItem.dataUrl || selectedItem.url || ''}" alt="${selectedItem.name}" style="max-width:100%;">`,
                x: 250,
                y: 100
            });
        });

    } else {
        console.error('thumbnail-pane custom element is not defined. Make sure it is imported and registered correctly.');
        thumbnailGalleryContainer.innerHTML = '<p style="color:red; padding:10px;">Error: Thumbnail gallery component (thumbnail-pane) could not be loaded. Check console.</p>';
    }

    // Initial window (optional)
    createWindow({
        title: 'Welcome Window',
        content: '<h1>Welcome to ViewerNeo!</h1><p>This is the main content area. Use the buttons above or thumbnails to open new windows.</p>',
        x: 10,
        y: 10,
        width: 500,
        height: 350
    });

}); 