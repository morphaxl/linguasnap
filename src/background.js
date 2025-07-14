// Test if commands are working
console.log('Background script loaded');

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  if (command === 'translate-now') {
    await handleWriteMode();
  } else if (command === 'translate-read') {
    await handleReadMode();
  }
});

// Handle write mode (replace text)
async function handleWriteMode() {
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Active tab:', tab);
    
    if (!tab?.id) {
      console.log('No active tab found');
      return;
    }

    // Get user settings
    const settings = await chrome.storage.sync.get([
      'apiKey',
      'targetLang',
      'scriptChoice',
      'stylePrompt'
    ]);
    
    console.log('Settings:', settings);

    if (!settings.apiKey) {
      console.log('No API key found');
      await chrome.tabs.sendMessage(tab.id, {
        type: 'ERROR',
        message: 'Please set your OpenAI API key in the extension options'
      });
      return;
    }

    if (!settings.targetLang) {
      console.log('No target language found');
      await chrome.tabs.sendMessage(tab.id, {
        type: 'ERROR',
        message: 'Please select a target language in the extension options'
      });
      return;
    }

    console.log('Requesting text from content script...');
    
    // Request text from content script with error handling
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_TEXT' });
    } catch (error) {
      console.log('Content script not ready, trying to inject...');
      // Try to inject content script if it's not loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // Wait a moment and try again
        await new Promise(resolve => setTimeout(resolve, 100));
        response = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_TEXT' });
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
        // Fallback: show a helpful error message
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'LinguaSnap',
          message: 'Please refresh the page and try again'
        });
        return;
      }
    }
    
    console.log('Content script response:', response);
    
    if (!response?.text) {
      console.log('No text found');
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'ERROR',
          message: 'No text selected or focused'
        });
      } catch (error) {
        console.log('Could not send error message to content script');
      }
      return;
    }

    // Show loading state
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'LOADING', show: true });
    } catch (error) {
      console.log('Could not show loading state');
    }

    try {
      console.log('Translating text:', response.text);
      // Translate the text
      const translatedText = await translateText(response.text, settings, response.context);
      
      console.log('Translation result:', translatedText);
      
      // Send translated text back to content script
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'REPLACE_TEXT',
          text: translatedText
        });
      } catch (error) {
        console.log('Could not send translated text to content script');
        // Show notification as fallback
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Translation Complete',
          message: `Translation: ${translatedText}`
        });
      }
    } finally {
      // Hide loading state
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'LOADING', show: false });
      } catch (error) {
        console.log('Could not hide loading state');
      }
    }
  } catch (error) {
    console.error('Translation error:', error);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'ERROR',
        message: error.message || 'Translation failed'
      });
    }
  }
}

// Handle read mode (show translation in popup)
async function handleReadMode() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Read mode - Active tab:', tab);
    
    if (!tab?.id) {
      console.log('No active tab found');
      return;
    }

    // Get user settings (including read language)
    const settings = await chrome.storage.sync.get([
      'apiKey',
      'readLang',
      'targetLang', // fallback to write language
      'scriptChoice',
      'stylePrompt'
    ]);
    
    console.log('Read mode settings:', settings);

    if (!settings.apiKey) {
      console.log('No API key found');
      await chrome.tabs.sendMessage(tab.id, {
        type: 'ERROR',
        message: 'Please set your OpenAI API key in the extension options'
      });
      return;
    }

    const readLanguage = settings.readLang || settings.targetLang || 'English';
    
    console.log('Requesting selected text for reading...');
    
    // Request selected text from content script
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_SELECTED_TEXT' });
    
    console.log('Selected text response:', response);
    
    if (!response?.text) {
      console.log('No text selected');
      await chrome.tabs.sendMessage(tab.id, {
        type: 'ERROR',
        message: 'Please select some text to translate'
      });
      return;
    }

    console.log('Translating selected text for reading:', response.text);
    
    // Translate the text for reading (AI will clean it)
    const translatedText = await translateForReading(response.text, readLanguage, settings, response.context);
    
    console.log('Read translation result:', translatedText);
    
    // Show translation in popup overlay
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_TRANSLATION_POPUP',
      originalText: response.text,
      translatedText: translatedText,
      targetLanguage: readLanguage,
      position: response.position
    });
    
  } catch (error) {
    console.error('Read mode translation error:', error);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'ERROR',
        message: error.message || 'Translation failed'
      });
    }
  }
}

// Text cleaning is now handled by AI with smart prompts

// Translate text for reading (different prompt than write mode)
async function translateForReading(text, targetLanguage, settings, context) {
  const messages = buildReadPrompt(text, targetLanguage, settings, context);
  
  const maxRetries = 4;
  let retryDelay = 200;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.1, // Lower for more consistent translations
          max_tokens: Math.ceil(text.length * 2) // More generous for reading
        })
      });

      if (!response.ok) {
        const error = await response.json();
        
        if (response.status === 429 && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2;
          continue;
        }
        
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      let translatedText = data.choices[0].message.content.trim();
      
      // Remove quotes if AI added them
      if ((translatedText.startsWith('"') && translatedText.endsWith('"')) ||
          (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
        translatedText = translatedText.slice(1, -1);
      }
      
      return translatedText;
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      if (error.name === 'TypeError' && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
        continue;
      }
      
      throw error;
    }
  }
}

// Build prompt for reading mode
function buildReadPrompt(text, targetLanguage, settings, context) {
  const systemPrompt = `You are a professional translator helping someone understand content from ${context?.platform || 'messaging platforms'}.

Your task is to provide a clear, natural translation into ${targetLanguage}.

CRITICAL INSTRUCTIONS:
1. AUTOMATICALLY IGNORE timestamps, usernames, delivery indicators, and formatting metadata
2. Focus ONLY on the actual message content that needs to be understood
3. If you see patterns like "12:34 PM", "John:", "✓✓", ignore them completely
4. Translate into natural, conversational ${targetLanguage}
5. If there are multiple messages, separate them with line breaks
6. Preserve the emotional tone and meaning
7. Don't add explanations or notes - just provide clean translation

Example:
Input: "John: 10:30 AM ✓✓ Hey how are you doing today?"
Output: "Hey how are you doing today?" (in ${targetLanguage})`;

  const userPrompt = `Clean and translate this ${context?.platform || 'messaging'} content into ${targetLanguage}:

"${text}"`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

// Flexible prompt builder for write mode
function buildPrompt(text, settings, context) {
  const scriptInstruction = settings.scriptChoice === 'latin' 
    ? `Write in Latin/Roman script (English letters) as people commonly do when texting.`
    : `Write in the native script of ${settings.targetLang}`;

  const styleInstruction = settings.stylePrompt 
    ? `CRITICAL STYLE REQUIREMENTS: ${settings.stylePrompt}
    
Apply this style completely - if the user wants poetic language, allegories, or specific texting patterns, fully embrace that style. Transform the content to match these style requirements while keeping the core meaning.`
    : 'Use casual, friendly conversational tone.';

  const systemPrompt = `You are a native ${settings.targetLang} speaker helping someone write in ${settings.targetLang}.

Your task: Rewrite the following text into proper, natural ${settings.targetLang} following the user's specific style preferences.

INSTRUCTIONS:
- If it's already in ${settings.targetLang}, fix any grammar/spelling errors minimally
- If it's in another language, translate it to ${settings.targetLang}  
- If it's mixed languages, convert everything to ${settings.targetLang}
- If it's broken ${settings.targetLang}, correct it naturally
- ${scriptInstruction}
- Platform context: ${context?.platform || 'messaging app'}

${styleInstruction}

IMPORTANT: The style requirements above are mandatory - fully transform the text to match the requested style, don't just translate literally.`;

  const userPrompt = `Rewrite this into proper ${settings.targetLang} following the style requirements: "${text}"`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

// Translate text using OpenAI API
async function translateText(text, settings, context) {
  const messages = buildPrompt(text, settings, context);
  
  const maxRetries = 4;
  let retryDelay = 200;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.2,
          max_tokens: Math.ceil(text.length * 1.5) // Allow for expansion
        })
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle rate limits with retry
        if (response.status === 429 && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2; // Exponential backoff
          continue;
        }
        
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      let translatedText = data.choices[0].message.content.trim();
      
      // Remove quotes if AI added them
      if ((translatedText.startsWith('"') && translatedText.endsWith('"')) ||
          (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
        translatedText = translatedText.slice(1, -1);
      }
      
      return translatedText;
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Network errors - retry
      if (error.name === 'TypeError' && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
        continue;
      }
      
      throw error;
    }
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['apiKey', 'targetLang'], (result) => {
    if (!result.apiKey || !result.targetLang) {
      chrome.runtime.openOptionsPage();
    }
  });
});