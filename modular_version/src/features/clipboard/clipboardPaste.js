import { handleIncomingFiles } from '../../loaders/fileHandlerRouter.js';

export function initClipboardPaste() {
  console.log('Initializing clipboard paste support');

  // Set up global paste event listener
  document.addEventListener('paste', async (e) => {
    console.log('Paste event detected');
    e.preventDefault();
    
    // Process clipboard items
    const items = e.clipboardData.items;
    if (!items) return;
    
    const files = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Only handle image items
      if (item.type.startsWith('image/')) {
        console.log(`Found image in clipboard: ${item.type}`);
        const file = item.getAsFile();
        if (file) {
          // Rename for better display in thumbnails
          const newFile = new File([file], `Pasted_${new Date().toISOString().replace(/:/g, '-')}.png`, {
            type: file.type
          });
          files.push(newFile);
        }
      }
    }
    
    if (files.length > 0) {
      console.log(`Processing ${files.length} pasted image(s)`);
      await handleIncomingFiles(files);
    }
  });
  
  // Show paste hint
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      // Show brief paste hint/overlay if needed
      showPasteHint();
    }
  });
}

// Optional visual feedback when paste is happening
function showPasteHint() {
  // Simple flash notice
  const notice = document.createElement('div');
  notice.className = 'paste-hint';
  notice.textContent = 'Pasting...';
  notice.style.position = 'absolute';
  notice.style.top = '50%';
  notice.style.left = '50%';
  notice.style.transform = 'translate(-50%, -50%)';
  notice.style.background = 'rgba(0,0,0,0.7)';
  notice.style.color = 'white';
  notice.style.padding = '10px 20px';
  notice.style.borderRadius = '5px';
  notice.style.zIndex = '1000';
  document.body.appendChild(notice);
  
  // Remove after timeout
  setTimeout(() => {
    if (document.body.contains(notice)) {
      document.body.removeChild(notice);
    }
  }, 1000);
} 