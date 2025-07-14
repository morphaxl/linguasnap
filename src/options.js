// Load saved settings when page loads
document.addEventListener('DOMContentLoaded', loadSettings);

// Save settings when form is submitted
document.getElementById('settingsForm').addEventListener('submit', saveSettings);

// Handle shortcuts link click
document.getElementById('shortcutsLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get([
      'apiKey',
      'targetLang',
      'readLang',
      'scriptChoice',
      'stylePrompt'
    ]);

    // Populate form fields
    if (settings.apiKey) {
      document.getElementById('apiKey').value = settings.apiKey;
    }
    
    if (settings.targetLang) {
      document.getElementById('targetLang').value = settings.targetLang;
    }
    
    if (settings.readLang) {
      document.getElementById('readLang').value = settings.readLang;
    } else {
      // Default to English for reading
      document.getElementById('readLang').value = 'English';
    }
    
    if (settings.scriptChoice) {
      document.getElementById('scriptChoice').value = settings.scriptChoice;
    } else {
      // Default to latin script
      document.getElementById('scriptChoice').value = 'latin';
    }
    
    if (settings.stylePrompt) {
      document.getElementById('stylePrompt').value = settings.stylePrompt;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

async function saveSettings(e) {
  e.preventDefault();
  
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn.textContent;
  
  // Show loading state
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;
  
  try {
    // Get form values
    const apiKey = document.getElementById('apiKey').value.trim();
    const targetLang = document.getElementById('targetLang').value.trim();
    const readLang = document.getElementById('readLang').value.trim();
    const scriptChoice = document.getElementById('scriptChoice').value;
    const stylePrompt = document.getElementById('stylePrompt').value.trim();
    
    // Validate required fields
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!targetLang) {
      throw new Error('Write mode language is required');
    }
    
    if (!readLang) {
      throw new Error('Read mode language is required');
    }
    
    // Validate API key format
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid API key format. It should start with "sk-"');
    }
    
    // Save to chrome storage
    await chrome.storage.sync.set({
      apiKey,
      targetLang,
      readLang,
      scriptChoice,
      stylePrompt
    });
    
    showStatus('Settings saved successfully!', 'success');
    
    // Reset save button after a short delay
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 1000);
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus(error.message || 'Error saving settings', 'error');
    
    // Reset save button
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  
  // Clear existing classes
  statusEl.className = 'status';
  
  // Add type class
  statusEl.classList.add(type);
  
  // Set message
  statusEl.textContent = message;
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
}

// Add input validation feedback
document.getElementById('apiKey').addEventListener('input', (e) => {
  const value = e.target.value.trim();
  if (value && !value.startsWith('sk-')) {
    e.target.setCustomValidity('API key should start with "sk-"');
  } else {
    e.target.setCustomValidity('');
  }
});

// Language input is now a text field, so no dynamic examples needed