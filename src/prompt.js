export function buildPrompt(text, settings, context) {
  // Determine script instruction based on user preference
  const scriptInstruction = settings.scriptChoice === 'latin' 
    ? `Write in Latin/Roman script (English letters) as people commonly do when texting. 
       For example: 
       - Hindi: "kya haal hai" NOT "क्या हाल है"
       - Arabic: "kifak" NOT "كيفك"
       - Urdu: "kya kar rahe ho" NOT "کیا کر رہے ہو"
       - Japanese: Can use romaji for casual parts
       - Greek: "ti kaneis" NOT "τι κάνεις"`
    : `Write in the native script of ${settings.targetLang}`;

  // Build system prompt with context awareness
  const systemPrompt = `You are a native ${settings.targetLang} speaker translating for informal digital conversations.

CRITICAL INSTRUCTIONS:
1. ${scriptInstruction}

2. Writing Style: ${settings.stylePrompt || 'Casual, friendly conversation between friends'}
   - Use natural, conversational language
   - Include common slang and colloquialisms
   - Write as if texting a close friend
   - Keep the informal tone unless explicitly instructed otherwise

3. Platform Context: ${context?.platform || 'messaging app'}
   - Adapt to how people actually write on ${context?.platform || 'this platform'}
   - Use appropriate abbreviations and shortcuts
   - Consider character limits if relevant

4. IMPORTANT: Translate the meaning and intent, not word-for-word
   - Capture the emotion and tone
   - Use natural expressions in ${settings.targetLang}
   - Don't over-translate - keep it natural`;

  const userPrompt = `Translate to ${settings.targetLang}: "${text}"

Context: Informal chat on ${context?.platform || 'messaging platform'}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

// Helper function to format language names properly
export function getLanguageDisplayName(langCode) {
  const languages = {
    'hi': 'Hindi',
    'ar': 'Arabic', 
    'ur': 'Urdu',
    'tr': 'Turkish',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'bn': 'Bengali',
    'pa': 'Punjabi',
    'ta': 'Tamil',
    'te': 'Telugu',
    'mr': 'Marathi',
    'gu': 'Gujarati',
    'ml': 'Malayalam',
    'kn': 'Kannada',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'id': 'Indonesian',
    'ms': 'Malay',
    'tl': 'Filipino',
    'sw': 'Swahili',
    'nl': 'Dutch',
    'pl': 'Polish',
    'uk': 'Ukrainian',
    'cs': 'Czech',
    'el': 'Greek',
    'he': 'Hebrew',
    'fa': 'Persian/Farsi'
  };
  
  return languages[langCode] || langCode;
}