import { handleIncomingFiles } from './fileHandlerRouter.js';

// Function to handle directory entries recursively
async function processEntry(entry, filesList = []) {
  if (entry.isFile) {
    // Handle file entry
    try {
      const file = await getFileFromEntry(entry);
      filesList.push(file);
    } catch (error) {
      console.error('Error reading file entry:', error);
    }
  } else if (entry.isDirectory) {
    // Handle directory entry
    try {
      // Get directory reader
      const reader = entry.createReader();
      // Read all entries in the directory
      const entries = await readEntriesPromise(reader);
      
      // Process each entry recursively
      for (const childEntry of entries) {
        await processEntry(childEntry, filesList);
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }
  }
  return filesList;
}

// Convert FileEntry to File with Promise
function getFileFromEntry(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

// Read entries from a directory with Promise
function readEntriesPromise(reader) {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

// Process all items from DataTransfer
async function processItems(items) {
  console.log(`Processing ${items.length} dropped items`);
  const files = [];
  
  // Process all items in parallel for better performance with multiple files
  const promises = items.map(async (item) => {
    // Get entry (works for files and directories)
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : 
                 (item.getAsEntry ? item.getAsEntry() : null);
    
    if (entry) {
      // Process entry (file or directory)
      const entryFiles = await processEntry(entry, []);
      return entryFiles;
    } else if (item.kind === 'file') {
      // Fallback method if entry API not available
      const file = item.getAsFile();
      return file ? [file] : [];
    }
    return [];
  });
  
  // Wait for all promises to resolve and flatten the results
  const results = await Promise.all(promises);
  results.forEach(result => {
    if (Array.isArray(result)) {
      files.push(...result);
    } else if (result) {
      files.push(result);
    }
  });
  
  return files;
}

export function initDragDrop() {
  const dropOverlay = document.getElementById('drop-overlay');

  function showOverlay() {
    dropOverlay.classList.add('active');
  }
  function hideOverlay() {
    dropOverlay.classList.remove('active');
  }

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    showOverlay();
  });
  
  document.addEventListener('dragover', (e) => e.preventDefault());
  
  document.addEventListener('dragleave', (e) => {
    if (e.target === document || e.target === dropOverlay) hideOverlay();
  });
  
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    hideOverlay();
    
    // Show loading indicator for potentially large directories
    const loadingIndicator = document.querySelector('.loading');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    try {
      let files = [];
      
      // Debug log the raw data transfer
      console.log(`Drop event contains ${e.dataTransfer.items?.length || 0} items and ${e.dataTransfer.files?.length || 0} files`);
      
      // Always try to use both APIs to maximize compatibility
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        // Modern API for directories and complex drops
        files = await processItems(Array.from(e.dataTransfer.items));
        console.log(`Processed ${files.length} files from items API`);
      } 
      
      // If no files were found from items API, try the files API
      if (files.length === 0 && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        files = Array.from(e.dataTransfer.files);
        console.log(`Processed ${files.length} files from files API (fallback)`);
      }
      
      // Extra protection for multi-file drops
      if (files.length > 0) {
        console.log(`Found ${files.length} files to process:`, files.map(f => f.name).slice(0, 5).join(', ') + 
          (files.length > 5 ? ` and ${files.length - 5} more` : ''));
        
        await handleIncomingFiles(files);
      } else {
        console.log('No valid files found in drop');
        // Hide loading indicator if no files found
        if (loadingIndicator) loadingIndicator.style.display = 'none';
      }
    } catch (error) {
      console.error('Error processing dropped items:', error);
      // Hide loading indicator in case of error
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  });
} 