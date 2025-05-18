// Current image store service
// Handles saving/retrieving the currently viewed image to/from IndexedDB

import { saveImageToDb, getImageFromDb } from './imageStore.js';

// Constant for the current image ID
const CURRENT_IMAGE_KEY = 'current_image';

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
    
    // Prepare metadata object
    const imageMetadata = {
      filename: selectedFile?.name || 'current_image',
      fileType: selectedFile?.type || 'image/png',
      fileSize: selectedFile?.size,
      rotation: rotation || 0,
      lastAccessed: Date.now(),
      isCurrent: true,
      selectedFile, // Include the original file if available
      id: CURRENT_IMAGE_KEY // Use a fixed ID for the current image
    };
    
    // Save to IndexedDB with the special current image key
    const id = await saveImageToDb(image, imageData, imageMetadata);
    
    console.log('Current image successfully saved to IndexedDB with ID:', id);
    return id;
  } catch (error) {
    console.error('Failed to save current image to IndexedDB:', error);
    // Implement retry logic for transaction errors
    if (error.name === 'TransactionInactiveError') {
      console.log('Transaction inactive error detected, attempting alternative save approach');
      return saveWithRetry(image, imageData, metadata);
    }
    throw error;
  }
}

/**
 * Alternative save approach that breaks down the steps differently
 * Used as a fallback when the primary approach fails with transaction errors
 */
async function saveWithRetry(image, imageData, metadata) {
  try {
    console.log('Using alternative save approach for large images');
    
    // Get file information if available
    const { selectedFile, rotation } = metadata;
    
    // Create a cloned simple file if we have a selected file
    let imageBlob = null;
    
    // First, try to use the original file if available (most reliable)
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
      
      // Use a lower quality JPEG for large images to reduce storage requirements
      imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      console.log('Created optimized JPEG blob from image:', { 
        width: image.naturalWidth, 
        height: image.naturalHeight,
        blobSize: imageBlob.size 
      });
    }
    
    if (!imageBlob) {
      throw new Error('Could not create image blob in retry');
    }
    
    // Create a simplified record with just essential data
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
      isRetry: true
    };
    
    // Manually open database and handle transaction
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ImageViewerDB', 1);
      
      request.onerror = event => {
        console.error('Error opening database in retry:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = event => {
        const db = event.target.result;
        // Create a new transaction for each operation for maximum reliability
        const transaction = db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        
        const putRequest = store.put(record);
        
        putRequest.onsuccess = () => {
          console.log('Successfully saved image in retry mode');
          resolve(CURRENT_IMAGE_KEY);
        };
        
        putRequest.onerror = event => {
          console.error('Error in retry save:', event.target.error);
          reject(event.target.error);
        };
      };
    });
  } catch (error) {
    console.error('Failed in retry save:', error);
    throw error;
  }
}

/**
 * Get the currently saved image from IndexedDB
 * @returns {Promise<Object|null>} The saved image record or null if not found
 */
export async function getCurrentImage() {
  try {
    console.log('Retrieving current image from IndexedDB');
    
    // Retrieve from IndexedDB using the special current image key
    const imageRecord = await getImageFromDb(CURRENT_IMAGE_KEY);
    
    if (imageRecord) {
      console.log('Retrieved current image from IndexedDB', {
        id: imageRecord.id,
        filename: imageRecord.filename,
        hasBlob: !!imageRecord.imageBlob,
        blobSize: imageRecord.imageBlob?.size,
        width: imageRecord.dimensions?.width,
        height: imageRecord.dimensions?.height
      });
      return imageRecord;
    } else {
      console.log('No current image found in IndexedDB');
      return null;
    }
  } catch (error) {
    console.error('Failed to retrieve current image from IndexedDB:', error);
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