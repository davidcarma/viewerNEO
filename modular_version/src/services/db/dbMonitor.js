// Database Monitoring Service
// This service monitors changes to IndexedDB from other tabs/windows
// and triggers appropriate updates to the UI

import { State, setState } from '../../core/state.js';
import { getAllImagesMetadata, getImageFromDb } from './imageStore.js';
import { getCurrentImage, createImageFromRecord } from './currentImageStore.js';
import { renderImage } from '../../ui/canvas/renderImage.js';

// Constants
const CHECK_INTERVAL = 3000; // Check every 3 seconds
const CURRENT_IMAGE_KEY = 'current_image';

// State variables
let isMonitoring = false;
let monitorInterval = null;
let lastCurrentImageTimestamp = 0;
let lastKnownBatchCount = 0;
let lastKnownImageCount = 0;
let observers = [];

/**
 * Start monitoring the database for changes
 */
export function startDbMonitoring() {
  if (isMonitoring) return;
  
  console.log('Starting IndexedDB monitoring');
  isMonitoring = true;
  
  // Initialize timestamps from current state
  initializeMonitoringState();
  
  // Set up polling interval
  monitorInterval = setInterval(checkForChanges, CHECK_INTERVAL);
  
  // Return a cleanup function
  return () => stopDbMonitoring();
}

/**
 * Stop monitoring the database
 */
export function stopDbMonitoring() {
  if (!isMonitoring) return;
  
  console.log('Stopping IndexedDB monitoring');
  isMonitoring = false;
  
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

/**
 * Initialize monitoring state from the current application state
 */
function initializeMonitoringState() {
  // Get current timestamps and counts
  const currentImageRecord = State.currentImageRecord || {};
  lastCurrentImageTimestamp = currentImageRecord.timestamp || 0;
  
  lastKnownBatchCount = State.batches?.length || 0;
  lastKnownImageCount = State.batches?.reduce((total, batch) => total + batch.files.length, 0) || 0;
  
  console.log('Initialized DB monitoring state', {
    lastCurrentImageTimestamp,
    lastKnownBatchCount,
    lastKnownImageCount
  });
}

/**
 * Register an observer function to be called when changes are detected
 * @param {Function} callback - Function to call when changes are detected
 */
export function registerChangeObserver(callback) {
  if (typeof callback === 'function' && !observers.includes(callback)) {
    observers.push(callback);
    return true;
  }
  return false;
}

/**
 * Remove an observer
 * @param {Function} callback - Function to remove from observers
 */
export function unregisterChangeObserver(callback) {
  const index = observers.indexOf(callback);
  if (index !== -1) {
    observers.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Notify all observers of a change
 * @param {Object} changeInfo - Information about what changed
 */
function notifyObservers(changeInfo) {
  observers.forEach(observer => {
    try {
      observer(changeInfo);
    } catch (error) {
      console.error('Error in DB change observer:', error);
    }
  });
}

/**
 * Check for changes in the database
 */
async function checkForChanges() {
  try {
    // Skip check if we're in the middle of loading or processing
    if (State.isLoading) {
      console.log('Skipping DB check while app is loading');
      return;
    }
    
    // Get the current image record
    const currentImageRecord = await getCurrentImage();
    const currentTimestamp = currentImageRecord?.timestamp || 0;
    
    // Check if current image has changed
    const currentImageChanged = currentTimestamp > lastCurrentImageTimestamp;
    
    // Only fetch all metadata if necessary
    let allMetadata = null;
    let batchCountChanged = false;
    let imageCountChanged = false;
    
    // If current image has changed or we need to check counts
    if (currentImageChanged) {
      allMetadata = await getAllImagesMetadata();
      
      // Count batches and images
      const batchIds = new Set();
      allMetadata.forEach(img => {
        if (img.batchId) batchIds.add(img.batchId);
      });
      
      const newBatchCount = batchIds.size;
      const newImageCount = allMetadata.length;
      
      batchCountChanged = newBatchCount !== lastKnownBatchCount;
      imageCountChanged = newImageCount !== lastKnownImageCount;
      
      // Update cached values
      lastKnownBatchCount = newBatchCount;
      lastKnownImageCount = newImageCount;
    }
    
    // Only process if something has changed
    if (currentImageChanged || batchCountChanged || imageCountChanged) {
      console.log('Detected changes in IndexedDB:', {
        currentImageChanged,
        batchCountChanged,
        imageCountChanged,
        oldTimestamp: lastCurrentImageTimestamp,
        newTimestamp: currentTimestamp
      });
      
      // Update last known timestamp
      if (currentImageChanged) {
        lastCurrentImageTimestamp = currentTimestamp;
        
        // Load the new current image if it has changed
        if (currentImageRecord && currentImageRecord.imageBlob) {
          const newImage = await createImageFromRecord(currentImageRecord);
          
          // Update state with the new image
          setState({
            image: newImage,
            // We don't update imageData here - that would require reprocessing
            // the image which is expensive and usually not necessary
            currentImageRecord
          });
          
          // Re-render the image
          renderImage();
        }
      }
      
      // Notify observers that changes have been detected
      const changeInfo = {
        currentImageChanged,
        batchCountChanged,
        imageCountChanged,
        timestamp: Date.now()
      };
      
      notifyObservers(changeInfo);
      
      // If batches have changed, trigger a full refresh
      if (batchCountChanged || imageCountChanged) {
        await refreshAllData();
      }
    }
  } catch (error) {
    console.error('Error checking for database changes:', error);
  }
}

/**
 * Refresh all data from the database
 */
async function refreshAllData() {
  console.log('Refreshing all data from database due to detected changes');
  
  try {
    // Import the necessary function here to avoid circular dependencies
    const { restoreImagesFromDb } = await import('../../core/app.js');
    
    // Force a reload of all images from DB
    setState({ image: null });  // Clear current image first
    await restoreImagesFromDb();
    
    console.log('Successfully refreshed all data from database');
  } catch (error) {
    console.error('Error refreshing data from database:', error);
  }
}

// Auto-start monitoring if in a browser environment
if (typeof window !== 'undefined') {
  // Start monitoring when the page is fully loaded
  window.addEventListener('load', () => {
    // Delay slightly to allow other initialization to complete
    setTimeout(startDbMonitoring, 1000);
  });
  
  // Stop monitoring when the page is unloaded
  window.addEventListener('unload', stopDbMonitoring);
} 