// Current image store service
// Handles saving/retrieving the currently viewed image to/from IndexedDB

import { getImageFromDb } from './imageStore.js';

// Constant for the current image ID
const CURRENT_IMAGE_KEY = 'current_image';
const DB_NAME = 'ImageViewerDB';
const CURRENT_IMAGE_STORE = 'current_image_store';

// Helper function to get DB connection
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onerror = event => reject(event.target.error);
    request.onsuccess = event => resolve(event.target.result);
  });
}

/**
 * Save the currently viewed image to IndexedDB
 * @param {HTMLImageElement} image - The image element
 * @param {Object} imageData - The image data object (optional)
 * @param {Object} metadata - Additional metadata about the image 
 * @returns {Promise<string>} The ID of the saved image
 */
export async function saveCurrentImage(image, imageData, metadata = {}) {
  try {
    console.log('Saving current image to IndexedDB', {
      hasImage: !!image,
      imageWidth: image?.naturalWidth,
      imageHeight: image?.naturalHeight,
      hasImageData: !!imageData,
      imageDataWidth: imageData?.width,
      imageDataHeight: imageData?.height,
      metadataKeys: Object.keys(metadata),
      hasFile: !!metadata.selectedFile
    });
    
    // Quick validation
    if (!image && !imageData && !metadata.selectedFile) {
      console.error('Cannot save current image: no valid image source provided');
      throw new Error('No valid image source provided');
    }
    
    // Get file information if available
    const { selectedFile, rotation } = metadata;
    
    // First create the blob - this needs to happen outside the transaction
    let imageBlob = null;
    
    // Try to use the original file first (most efficient)
    if (selectedFile instanceof File || selectedFile instanceof Blob) {
      imageBlob = selectedFile;
      console.log('Using original file directly:', {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });
    }
    // If no file but we have an image element, create blob from it
    else if (!imageBlob && image instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      
      // Create blob from canvas
      imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      console.log('Created blob from image element:', {
        width: image.naturalWidth,
        height: image.naturalHeight,
        blobSize: imageBlob.size
      });
    }
    // If we have image data, use that
    else if (!imageBlob && imageData && imageData.data) {
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
          imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          console.log('Created blob from imageData:', {
            width,
            height,
            blobSize: imageBlob.size
          });
        }
      } catch (error) {
        console.error('Error creating blob from imageData:', error);
      }
    }
    
    if (!imageBlob) {
      throw new Error('Could not create image blob');
    }
    
    // Prepare the record object
    const record = {
      id: CURRENT_IMAGE_KEY,
      filename: selectedFile?.name || 'current_image',
      fileType: selectedFile?.type || 'image/jpeg',
      imageBlob,
      dimensions: {
        width: image?.naturalWidth || imageData?.width || 0,
        height: image?.naturalHeight || imageData?.height || 0
      },
      rotation: rotation || 0,
      timestamp: Date.now(),
      isCurrent: true,
      // If the metadata has originalId, preserve it to reference the original image
      originalId: metadata.originalId || metadata.id || null
    };
    
    if (metadata.batchId) {
      record.batchId = metadata.batchId;
    }
    
    // Save to current image store
    const db = await openDb();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([CURRENT_IMAGE_STORE], 'readwrite');
        const store = transaction.objectStore(CURRENT_IMAGE_STORE);
        
        transaction.onerror = (event) => {
          console.error('Transaction error:', event.target.error);
          reject(event.target.error);
        };
        
        const request = store.put(record);
        
        request.onsuccess = () => {
          console.log('Current image saved successfully to dedicated store');
          resolve(CURRENT_IMAGE_KEY);
        };
        
        request.onerror = (event) => {
          console.error('Error saving current image:', event.target.error);
          reject(event.target.error);
        };
      } catch (error) {
        console.error('Error in current image save transaction:', error);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to save current image:', error);
    throw error;
  }
}

/**
 * Get the currently saved image from IndexedDB
 * @returns {Promise<Object|null>} The saved image record or null if not found
 */
export async function getCurrentImage() {
  try {
    console.log('Retrieving current image from dedicated store');
    
    const db = await openDb();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([CURRENT_IMAGE_STORE], 'readonly');
        const store = transaction.objectStore(CURRENT_IMAGE_STORE);
        
        const request = store.get(CURRENT_IMAGE_KEY);
        
        request.onsuccess = () => {
          if (request.result) {
            console.log('Retrieved current image from dedicated store', {
              id: request.result.id,
              filename: request.result.filename,
              hasBlob: !!request.result.imageBlob,
              blobSize: request.result.imageBlob?.size
            });
            resolve(request.result);
          } else {
            console.log('No current image found in dedicated store');
            
            // For backward compatibility, try the old method
            getImageFromDb(CURRENT_IMAGE_KEY)
              .then(oldRecord => {
                if (oldRecord) {
                  console.log('Found current image in main store (legacy) - migrating');
                  // Migrate it to the new store
                  saveCurrentImage(null, null, {
                    ...oldRecord,
                    selectedFile: oldRecord.imageBlob
                  }).then(() => {
                    resolve(oldRecord);
                  }).catch(err => {
                    console.error('Error migrating legacy current image:', err);
                    resolve(oldRecord);
                  });
                } else {
                  resolve(null);
                }
              })
              .catch(error => {
                console.error('Error checking for legacy current image:', error);
                resolve(null);
              });
          }
        };
        
        request.onerror = (event) => {
          console.error('Error retrieving current image:', event.target.error);
          reject(event.target.error);
        };
      } catch (error) {
        console.error('Error in current image retrieval transaction:', error);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to retrieve current image:', error);
    throw error;
  }
}

/**
 * Create an image element from a stored image record
 * @param {Object} imageRecord - The image record from IndexedDB
 * @returns {Promise<HTMLImageElement>} A new image element with the loaded image
 */
export async function createImageFromRecord(imageRecord) {
  return new Promise((resolve, reject) => {
    try {
      if (!imageRecord) {
        reject(new Error('Invalid image record: record is null or undefined'));
        return;
      }
      
      if (!imageRecord.imageBlob) {
        reject(new Error('Invalid image record: missing image data'));
        return;
      }
      
      console.log('Creating image from record', {
        id: imageRecord.id,
        filename: imageRecord.filename,
        blobType: imageRecord.imageBlob.type,
        blobSize: imageRecord.imageBlob.size
      });
      
      // Create URL from blob
      const objectUrl = URL.createObjectURL(imageRecord.imageBlob);
      
      // Create and load image
      const img = new Image();
      
      img.onload = () => {
        console.log('Image successfully created from blob', {
          width: img.naturalWidth,
          height: img.naturalHeight,
          src: img.src.substring(0, 30) + '...' // Just log beginning of URL
        });
        resolve(img);
      };
      
      img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        console.error('Failed to load image from blob:', e);
        reject(new Error('Failed to load image from blob'));
      };
      
      // Set crossOrigin to allow canvas operations later if needed
      img.crossOrigin = 'anonymous';
      
      // Set the source to start loading
      img.src = objectUrl;
    } catch (error) {
      console.error('Error creating image from record:', error);
      reject(error);
    }
  });
} 