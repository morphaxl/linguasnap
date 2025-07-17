// Store last selection range for contentEditable elements
let lastRange = null;
let loadingIndicator = null;

// Get the currently active editable element
function getActiveEditable() {
  const el = document.activeElement;
  
  if (!el) return null;
  
  // Check if it's an input or textarea
  if (el.tagName === 'TEXTAREA' || 
      (el.tagName === 'INPUT' && /text|search|email|url|tel/.test(el.type))) {
    return el;
  }
  
  // Check if it's contentEditable
  if (el.isContentEditable) {
    return el;
  }
  
  // Check if selection is in a contentEditable element
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    
    // Walk up the DOM tree to find contentEditable parent
    while (container && container !== document.body) {
      if (container.nodeType === Node.ELEMENT_NODE && container.isContentEditable) {
        return container;
      }
      container = container.parentNode;
    }
  }
  
  return null;
}

// Get platform context
function getContext() {
  const hostname = window.location.hostname;
  let platform = 'website';
  
  if (hostname.includes('web.whatsapp.com')) platform = 'WhatsApp';
  else if (hostname.includes('mail.google.com')) platform = 'Gmail';
  else if (hostname.includes('discord.com')) platform = 'Discord';
  else if (hostname.includes('slack.com')) platform = 'Slack';
  else if (hostname.includes('twitter.com') || hostname.includes('x.com')) platform = 'Twitter/X';
  else if (hostname.includes('facebook.com')) platform = 'Facebook';
  else if (hostname.includes('instagram.com')) platform = 'Instagram';
  else if (hostname.includes('linkedin.com')) platform = 'LinkedIn';
  else if (hostname.includes('reddit.com')) platform = 'Reddit';
  
  return {
    platform,
    url: hostname,
    timestamp: new Date().toISOString()
  };
}

// Extract text from the active element
function grabText() {
  const element = getActiveEditable();
  
  if (!element) {
    return { text: null, context: getContext() };
  }
  
  let text = '';
  
  if ('value' in element) {
    // Input or textarea
    const start = element.selectionStart;
    const end = element.selectionEnd;
    
    if (start !== end) {
      // Get selected text
      text = element.value.substring(start, end);
    } else {
      // Get all text
      text = element.value;
    }
  } else if (element.isContentEditable) {
    // ContentEditable element
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      // Save the range for later replacement
      lastRange = selection.getRangeAt(0).cloneRange();
      text = selection.toString();
    } else {
      // Get all text content
      text = element.innerText || element.textContent || '';
    }
  }
  
  return { text: text.trim(), context: getContext() };
}

// Replace text in the active element
function replaceText(newText) {
  const element = getActiveEditable();
  
  if (!element) return;
  
  if ('value' in element) {
    // Input or textarea
    const start = element.selectionStart;
    const end = element.selectionEnd;
    
    if (start !== end) {
      // Replace selected text
      const before = element.value.substring(0, start);
      const after = element.value.substring(end);
      element.value = before + newText + after;
      
      // Set cursor position after replaced text
      element.selectionStart = element.selectionEnd = start + newText.length;
    } else {
      // Replace all text
      element.value = newText;
    }
    
    // Trigger input event for frameworks
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
  } else if (element.isContentEditable) {
    // ContentEditable element - use a more robust approach
    try {
      // For WhatsApp and other complex apps, use execCommand or direct manipulation
      if (lastRange) {
        // Use the saved range
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(lastRange);
        
        // Try execCommand first (works better with React apps)
        if (document.execCommand) {
          document.execCommand('delete', false);
          document.execCommand('insertText', false, newText);
        } else {
          // Fallback to manual replacement
          lastRange.deleteContents();
          const textNode = document.createTextNode(newText);
          lastRange.insertNode(textNode);
          
          // Move cursor to end
          lastRange.setStartAfter(textNode);
          lastRange.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(lastRange);
        }
        
        lastRange = null;
      } else {
        // Select all and replace
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        
        if (document.execCommand) {
          document.execCommand('delete', false);
          document.execCommand('insertText', false, newText);
        } else {
          element.innerText = newText;
        }
      }
      
      // Trigger events that React/Vue might be listening for
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      
    } catch (error) {
      console.log('execCommand failed, using fallback:', error);
      // Ultimate fallback
      element.innerText = newText;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  // Focus the element
  element.focus();
}

// Create and show toast notification
function showToast(message, type = 'info') {
  // Remove existing toast if any
  const existing = document.querySelector('.linguasnap-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `linguasnap-toast linguasnap-toast-${type}`;
  toast.textContent = message;
  
  // Styles
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Create loading indicator
function createLoadingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'linguasnap-loading';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  
  indicator.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 4px;
    z-index: 999999;
  `;
  
  const dotStyles = `
    width: 8px;
    height: 8px;
    background: #3b82f6;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  `;
  
  indicator.querySelectorAll('span').forEach((dot, i) => {
    dot.style.cssText = dotStyles;
    dot.style.animationDelay = `${i * 0.16}s`;
  });
  
  return indicator;
}

// Show/hide loading indicator
function toggleLoading(show) {
  if (show) {
    if (!loadingIndicator) {
      loadingIndicator = createLoadingIndicator();
      document.body.appendChild(loadingIndicator);
    }
  } else {
    if (loadingIndicator) {
      loadingIndicator.remove();
      loadingIndicator = null;
    }
  }
}

// Add CSS animations and popup styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
  
  @keyframes linguasnap-popup-appear {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  .linguasnap-popup-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .linguasnap-popup-title {
    font-weight: 600;
    font-size: 14px;
  }
  
  .linguasnap-popup-close {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    transition: background 0.2s;
  }
  
  .linguasnap-popup-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .linguasnap-popup-content {
    padding: 16px;
  }
  
  .linguasnap-popup-section {
    margin-bottom: 12px;
  }
  
  .linguasnap-popup-section:last-child {
    margin-bottom: 0;
  }
  
  .linguasnap-popup-label {
    font-weight: 600;
    color: #555;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  
  .linguasnap-popup-text {
    color: #333;
    line-height: 1.4;
    font-size: 14px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 3px solid #ddd;
  }
  
  .linguasnap-popup-translation {
    background: #e8f5e8;
    border-left-color: #4caf50;
    font-weight: 500;
  }
`;
document.head.appendChild(style);

// Get selected text and its position for read mode
function grabSelectedText() {
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return { text: null, context: getContext() };
  }
  
  const range = selection.getRangeAt(0);
  const text = selection.toString();
  
  // Get position for popup placement
  const rect = range.getBoundingClientRect();
  const position = {
    x: rect.left + rect.width / 2,
    y: rect.top,
    width: rect.width,
    height: rect.height
  };
  
  return { 
    text: text.trim(), 
    context: getContext(),
    position: position
  };
}

// Show translation popup overlay
function showTranslationPopup(originalText, translatedText, targetLanguage, position) {
  // Remove existing popup if any
  const existing = document.querySelector('.linguasnap-popup');
  if (existing) existing.remove();
  
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'linguasnap-popup';
  
  // Create popup content
  popup.innerHTML = `
    <div class="linguasnap-popup-header">
      <span class="linguasnap-popup-title">Translation (${targetLanguage})</span>
      <button class="linguasnap-popup-close">&times;</button>
    </div>
    <div class="linguasnap-popup-content">
      <div class="linguasnap-popup-section">
        <div class="linguasnap-popup-label">Original:</div>
        <div class="linguasnap-popup-text">${originalText}</div>
      </div>
      <div class="linguasnap-popup-section">
        <div class="linguasnap-popup-label">Translation:</div>
        <div class="linguasnap-popup-text linguasnap-popup-translation">${translatedText}</div>
      </div>
    </div>
  `;
  
  // Style the popup
  popup.style.cssText = `
    position: fixed;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 999999;
    max-width: 400px;
    min-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    animation: linguasnap-popup-appear 0.2s ease-out;
  `;
  
  // Position the popup
  let left = position.x - 200; // Center on selection
  
  // Keep popup on screen horizontally
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  if (left < 10) left = 10;
  if (left + 400 > viewport.width) left = viewport.width - 410;
  
  // Estimate popup height (approximately 140px based on content)
  const estimatedPopupHeight = 140;
  
  // Determine best vertical position
  const abovePosition = position.y - estimatedPopupHeight - 10;
  const belowPosition = position.y + position.height + 10;
  
  let top;
  
  // Check if popup fits above the selection
  if (abovePosition >= 10) {
    top = abovePosition;
  } 
  // Check if popup fits below the selection
  else if (belowPosition + estimatedPopupHeight <= viewport.height - 10) {
    top = belowPosition;
  }
  // If neither fits perfectly, choose the position with more space
  else {
    const spaceAbove = position.y - 10;
    const spaceBelow = viewport.height - (position.y + position.height) - 10;
    
    if (spaceAbove > spaceBelow) {
      // Position at top of available space above
      top = Math.max(10, position.y - estimatedPopupHeight - 10);
    } else {
      // Position at bottom of available space below
      top = Math.min(belowPosition, viewport.height - estimatedPopupHeight - 10);
    }
  }
  
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  
  document.body.appendChild(popup);
  
  // Add close functionality
  const closeBtn = popup.querySelector('.linguasnap-popup-close');
  closeBtn.addEventListener('click', () => popup.remove());
  
  // Close on click outside
  const closeOnOutside = (e) => {
    if (!popup.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutside), 100);
  
  // Auto-close after 15 seconds
  setTimeout(() => {
    if (popup.parentNode) popup.remove();
  }, 15000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  switch (message.type) {
    case 'GRAB_TEXT':
      const result = grabText();
      console.log('Grab text result:', result);
      sendResponse(result);
      return false; // Synchronous response
      
    case 'GRAB_SELECTED_TEXT':
      const selectedResult = grabSelectedText();
      console.log('Grab selected text result:', selectedResult);
      sendResponse(selectedResult);
      return false; // Synchronous response
      
    case 'REPLACE_TEXT':
      console.log('Replacing text with:', message.text);
      replaceText(message.text);
      showToast('Translation complete!', 'success');
      return false; // Synchronous response
      
    case 'SHOW_TRANSLATION_POPUP':
      console.log('Showing translation popup:', message);
      showTranslationPopup(message.originalText, message.translatedText, message.targetLanguage, message.position);
      return false; // Synchronous response
      
    case 'ERROR':
      console.log('Showing error:', message.message);
      showToast(message.message || 'Translation failed', 'error');
      return false; // Synchronous response
      
    case 'LOADING':
      console.log('Toggle loading:', message.show);
      toggleLoading(message.show);
      return false; // Synchronous response
  }
  
  return false; // No async response needed
});