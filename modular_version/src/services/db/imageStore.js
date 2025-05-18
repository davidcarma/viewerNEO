// IndexedDB service for storing and retrieving image data
// This allows images to be accessed across different pages/routes

const DB_NAME = 'ImageViewerDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

// Initialize the database
function initDB() {
  return new Promise((resolve, reject) => {
    // Check if IndexedDB is available in this browser
    if (!window.indexedDB) {
      console.error('IndexedDB is not supported in this browser');
      reject(new Error('IndexedDB not supported'));
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // Handle database upgrade (first creation or version change)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store for images if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Create indexes for faster retrieval
        store.createIndex('filename', 'filename', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Prepare image blob first, then save to DB in a separate transaction
export async function saveImageToDb(image, imageData, metadata = {}) {
  try {
    console.log('Starting to save image to IndexedDB', { 
      hasImage: !!image, 
      hasImageData: !!imageData, 
      metadata 
    });
    
    // Quick validation
    if (!image && !imageData && !metadata.selectedFile) {
      console.error('Cannot save current image: no valid image source provided');
      throw new Error('No valid image source provided');
    }
    
    // First prepare the blob - do this BEFORE starting the transaction
    let imageBlob = null;
    let blobCreated = false;
    
    // Method 1: From ImageData
    if (!blobCreated && imageData && imageData.data) {
      try {
        const { width, height, data } = imageData;
        // Create ImageData object for Blob creation
        if (data instanceof Uint8ClampedArray) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.putImageData(new ImageData(data, width, height), 0, 0);
          
          // Convert canvas to blob
          imageBlob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
          });
          blobCreated = true;
          console.log('Created blob from imageData', { width, height, blobSize: imageBlob?.size });
        }
      } catch (blobError) {
        console.error('Error creating blob from imageData:', blobError);
      }
    }
    
    // Method 2: From HTMLImageElement if method 1 failed
    if (!blobCreated && image instanceof HTMLImageElement) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        // Convert canvas to blob
        imageBlob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/png');
        });
        blobCreated = true;
        console.log('Created blob from HTMLImageElement', { 
          width: image.naturalWidth, 
          height: image.naturalHeight,
          blobSize: imageBlob?.size
        });
      } catch (blobError) {
        console.error('Error creating blob from HTMLImageElement:', blobError);
      }
    }
    
    // Method 3: If we have a File object in metadata
    if (!blobCreated && metadata.selectedFile instanceof File) {
      try {
        // Use the original file as blob (most efficient)
        imageBlob = metadata.selectedFile;
        blobCreated = true;
        console.log('Using File object directly as blob', { 
          filename: metadata.selectedFile.name,
          blobSize: imageBlob?.size 
        });
      } catch (fileError) {
        console.error('Error using File as blob:', fileError);
      }
    }
    
    if (!imageBlob) {
      console.error('Failed to create image blob from any source');
      throw new Error('Could not create image blob');
    }
    
    // Get dimensions from available sources
    const width = image?.naturalWidth || imageData?.width || metadata.dimensions?.width;
    const height = image?.naturalHeight || imageData?.height || metadata.dimensions?.height;
    
    if (!width || !height) {
      console.warn('Could not determine image dimensions');
    }
    
    // Prepare the record object
    const id = metadata.id || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record = {
      id,
      filename: metadata.filename || 'unnamed_image',
      imageBlob,
      dimensions: {
        width: width || 0,
        height: height || 0,
      },
      rotation: metadata.rotation || 0,
      timestamp: Date.now(),
      ...metadata // Include any additional metadata
    };
    
    // Now that we have the blob and record prepared, start a NEW transaction to save it
    const db = await initDB();
    
    // Return a promise that resolves when the data is saved
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Log the transaction state for debugging
      console.log('Starting IndexedDB transaction for image save');
      
      // Handle transaction errors
      transaction.onerror = (event) => {
        console.error('Transaction error:', event.target.error);
        reject(event.target.error);
      };
      
      // Handle transaction completion
      transaction.oncomplete = () => {
        console.log('Transaction completed successfully');
      };
      
      // Actually store the record
      const request = store.put(record);
      
      request.onsuccess = () => {
        console.log(`Image saved to IndexedDB with ID: ${id}`, { 
          blobSize: imageBlob.size,
          dimensions: record.dimensions
        });
        resolve(id);
      };
      
      request.onerror = (event) => {
        console.error('Error saving image:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to save image to IndexedDB:', error);
    throw error;
  }
}

// Get an image from IndexedDB by ID
export async function getImageFromDb(id) {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      transaction.onerror = (event) => {
        console.error('Transaction error when retrieving image:', event.target.error);
        reject(event.target.error);
      };
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          resolve(null); // Image not found
        }
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving image from IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to get image from IndexedDB:', error);
    throw error;
  }
}

// Get all stored images (metadata only, without blob data)
export async function getAllImagesMetadata() {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    
    const images = [];
    
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Create a copy without the blob to reduce memory usage
          const { imageBlob, ...metadata } = cursor.value;
          images.push(metadata);
          cursor.continue();
        } else {
          resolve(images);
        }
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving images from IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to get images from IndexedDB:', error);
    throw error;
  }
}

// Delete an image from IndexedDB
export async function deleteImageFromDb(id) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log(`Image with ID ${id} deleted from IndexedDB`);
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error deleting image from IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to delete image from IndexedDB:', error);
    throw error;
  }
}

// Clear all stored images from IndexedDB
export async function clearImageStore() {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('All images cleared from IndexedDB');
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error clearing images from IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to clear images from IndexedDB:', error);
    throw error;
  }
} 