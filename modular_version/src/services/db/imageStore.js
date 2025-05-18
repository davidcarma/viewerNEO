// IndexedDB service for storing and retrieving image data
// This allows images to be accessed across different pages/routes

const DB_NAME = 'ImageViewerDB';
const DB_VERSION = 2; // Increased to add current image store
const STORE_NAME = 'images';
const CURRENT_IMAGE_STORE = 'current_image_store';

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
      
      // Create separate store for current image if it doesn't exist
      if (!db.objectStoreNames.contains(CURRENT_IMAGE_STORE)) {
        const currentStore = db.createObjectStore(CURRENT_IMAGE_STORE, { keyPath: 'id' });
        currentStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('Created separate store for current image');
      }
      
      // Handle migration from v1 to v2
      if (event.oldVersion === 1 && event.newVersion === 2) {
        console.log('Migrating from DB version 1 to 2');
        // Will move current image to new store after transaction completes
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      // If this is a newly upgraded database, migrate current_image to new store
      if (request.transaction) {
        try {
          // After upgrade completed, we need to migrate the current_image
          migrateCurrentImage(db).catch(err => 
            console.error('Error during current_image migration:', err)
          );
        } catch (err) {
          console.error('Error setting up migration:', err);
        }
      }
      
      resolve(db);
    };
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Migrate current_image from images store to current_image_store
async function migrateCurrentImage(db) {
  try {
    console.log('Starting current_image migration to new store');
    
    // First get the current_image from old store
    const oldTransaction = db.transaction([STORE_NAME], 'readonly');
    const imageStore = oldTransaction.objectStore(STORE_NAME);
    const request = imageStore.get('current_image');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const currentImage = request.result;
        
        if (!currentImage) {
          console.log('No current_image found to migrate');
          resolve(false);
          return;
        }
        
        console.log('Found current_image to migrate:', {
          id: currentImage.id,
          filename: currentImage.filename
        });
        
        try {
          // Save to new store
          const newTransaction = db.transaction([CURRENT_IMAGE_STORE], 'readwrite');
          const currentStore = newTransaction.objectStore(CURRENT_IMAGE_STORE);
          
          // Create a transaction promise
          const savePromise = new Promise((resolveInner, rejectInner) => {
            const saveRequest = currentStore.put(currentImage);
            
            saveRequest.onsuccess = () => {
              console.log('Successfully migrated current_image to new store');
              resolveInner(true);
            };
            
            saveRequest.onerror = (event) => {
              console.error('Error saving current_image to new store:', event.target.error);
              rejectInner(event.target.error);
            };
          });
          
          await savePromise;
          
          // Delete from old store
          const deleteTransaction = db.transaction([STORE_NAME], 'readwrite');
          const oldStore = deleteTransaction.objectStore(STORE_NAME);
          
          const deletePromise = new Promise((resolveInner, rejectInner) => {
            const deleteRequest = oldStore.delete('current_image');
            
            deleteRequest.onsuccess = () => {
              console.log('Successfully deleted current_image from old store');
              resolveInner(true);
            };
            
            deleteRequest.onerror = (event) => {
              console.error('Error deleting current_image from old store:', event.target.error);
              rejectInner(event.target.error);
            };
          });
          
          await deletePromise;
          resolve(true);
        } catch (error) {
          console.error('Error during migration:', error);
          reject(error);
        }
      };
      
      request.onerror = (event) => {
        console.error('Error getting current_image for migration:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
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
          // Add a flag to indicate the presence of a blob
          metadata.hasBlob = !!imageBlob;
          // Also add the blob size for debugging purposes
          if (imageBlob) {
            metadata.blobSize = imageBlob.size;
          }
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

// Add this function to clear the entire database
export async function clearImageDatabase() {
  try {
    console.log('Clearing all images from IndexedDB...');
    
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      
      transaction.onerror = (event) => {
        console.error('Transaction error when clearing database:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = () => {
        console.log('Successfully cleared all images from database');
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error clearing image database:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to clear image database:', error);
    throw error;
  }
}

// Add this function to save multiple images at once
export async function saveAllImagesToDb(images) {
  if (!images || images.length === 0) {
    console.log('No images to save');
    return [];
  }
  
  console.log(`Saving ${images.length} images to IndexedDB...`);
  
  // Get existing images to check for duplicates
  const existingImages = await getAllImagesMetadata();
  const existingFilenames = new Set(existingImages.map(img => img.filename));
  
  console.log(`Found ${existingFilenames.size} existing images in database`);
  
  const savedIds = [];
  let count = 0;
  let skippedCount = 0;
  
  // Process images one by one to avoid transaction timing issues
  for (const imageObj of images) {
    try {
      // Extract metadata to get the filename
      const { file, metadata = {} } = imageObj;
      const filename = file?.name || metadata.filename || 'unnamed_image';
      
      // Skip if the image already exists in the database
      if (existingFilenames.has(filename)) {
        console.log(`Skipping duplicate image: ${filename}`);
        skippedCount++;
        continue;
      }
      
      // Generate a unique ID for each image
      const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${count++}`;
      
      // Extract image, imageData, and file 
      const { image, imageData } = imageObj;
      
      // Save the image with combined metadata
      const combinedMetadata = {
        ...metadata,
        filename,
        selectedFile: file,
        id, // Use the generated ID
        lastAccessed: Date.now(),
        isBatchSave: true
      };
      
      await saveImageToDb(image, imageData, combinedMetadata);
      savedIds.push(id);
      
      console.log(`Saved image ${count} of ${images.length} to IndexedDB with ID: ${id}`);
    } catch (error) {
      console.error(`Error saving image ${count} of ${images.length}:`, error);
      // Continue with next image even if one fails
    }
  }
  
  console.log(`Finished saving ${savedIds.length} of ${images.length} images to IndexedDB (skipped ${skippedCount} duplicates)`);
  return savedIds;
}

// Add this function to remove duplicate images from the database
export async function deduplicateImagesByFilename() {
  try {
    console.log('Starting image deduplication process...');
    
    // Get all image metadata
    const allImages = await getAllImagesMetadata();
    console.log(`Found ${allImages.length} total images in database`);
    
    // Group by filename
    const imagesByFilename = {};
    allImages.forEach(img => {
      if (!img.filename) return; // Skip images without filenames
      
      if (!imagesByFilename[img.filename]) {
        imagesByFilename[img.filename] = [];
      }
      imagesByFilename[img.filename].push(img);
    });
    
    // Find duplicates
    const filenamesToDeduplicate = Object.keys(imagesByFilename).filter(
      filename => imagesByFilename[filename].length > 1
    );
    
    if (filenamesToDeduplicate.length === 0) {
      console.log('No duplicate images found in database');
      return 0;
    }
    
    console.log(`Found ${filenamesToDeduplicate.length} filenames with duplicates`);
    
    // For each filename with duplicates, keep only the most recent one
    let deletedCount = 0;
    
    for (const filename of filenamesToDeduplicate) {
      const duplicates = imagesByFilename[filename];
      console.log(`Found ${duplicates.length} copies of ${filename}`);
      
      // Sort by timestamp (newest first)
      duplicates.sort((a, b) => b.timestamp - a.timestamp);
      
      // Keep the newest (first after sorting), and any image marked as current
      const toKeep = [duplicates[0]];
      const currentImage = duplicates.find(img => img.isCurrent || img.id === 'current_image');
      
      if (currentImage && currentImage.id !== toKeep[0].id) {
        toKeep.push(currentImage);
      }
      
      // Get IDs to keep
      const keepIds = new Set(toKeep.map(img => img.id));
      
      // Delete all others
      for (const img of duplicates) {
        if (!keepIds.has(img.id)) {
          await deleteImageFromDb(img.id);
          deletedCount++;
          console.log(`Deleted duplicate image: ${img.id} (${img.filename})`);
        }
      }
    }
    
    console.log(`Deduplication complete. Deleted ${deletedCount} duplicate images.`);
    return deletedCount;
  } catch (error) {
    console.error('Error during image deduplication:', error);
    throw error;
  }
} 