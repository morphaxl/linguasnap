// Check settings and update status
async function checkSettings() {
  const statusEl = document.getElementById('statusText');
  const statusDot = document.querySelector('.status-dot');
  
  try {
    const settings = await chrome.storage.sync.get(['apiKey', 'targetLang', 'scriptChoice']);
    
    if (!settings.apiKey || !settings.targetLang) {
      statusEl.textContent = 'Setup required';
      statusDot.classList.add('error');
      return false;
    }
    
    statusEl.textContent = `Ready to translate to ${settings.targetLang}`;
    statusDot.classList.remove('error');
    return true;
    
  } catch (error) {
    statusEl.textContent = 'Error checking settings';
    statusDot.classList.add('error');
    return false;
  }
}

// Get language display name
function getLanguageName(code) {
  const languages = {
    'hi': 'Hindi',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'tr': 'Turkish',
    'ur': 'Urdu'
  };
  return languages[code] || code;
}

// Update keyboard shortcut display
async function updateShortcut() {
  const shortcutEl = document.getElementById('shortcut');
  
  try {
    const commands = await chrome.commands.getAll();
    const translateCommand = commands.find(cmd => cmd.name === 'translate-now');
    
    if (translateCommand && translateCommand.shortcut) {
      const isMac = navigator.platform.includes('Mac');
      const shortcut = translateCommand.shortcut
        .replace('MacCtrl', isMac ? '⌘' : 'Ctrl')
        .replace('Command', '⌘')
        .replace('Ctrl', 'Ctrl')
        .replace('Alt', 'Alt')
        .replace('Shift', 'Shift')
        .split('+')
        .map(key => `<kbd>${key.trim()}</kbd>`)
        .join(' + ');
      
      shortcutEl.innerHTML = shortcut;
    } else {
      shortcutEl.innerHTML = '<kbd>Not set</kbd>';
    }
  } catch (error) {
    shortcutEl.innerHTML = '<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Y</kbd> (Mac) / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Y</kbd>';
  }
}

// Open settings page
document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Initialize popup
checkSettings();
updateShortcut();