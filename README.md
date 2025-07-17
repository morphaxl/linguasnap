# charlie - Instant Translation Chrome Extension

charlie is a Chrome extension that translates text in-place using OpenAI's GPT-4o-mini model. Simply press a keyboard shortcut while typing in any text field to instantly translate your text to your chosen language.

## Features

- **Instant Translation**: Press Cmd+Shift+U (Mac) or Ctrl+Alt+U (Windows/Linux) to translate
- **Script Choice**: Choose between Latin/Roman script (how people text) or native script
- **Platform Aware**: Adapts translations for WhatsApp, Gmail, Discord, etc.
- **Informal Tone**: Default casual, friendly tone perfect for chatting with friends
- **Custom Styles**: Override with your own tone preferences
- **Works Everywhere**: Compatible with all websites and web apps

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd charlie
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

### Configuration

1. Click the extension icon and select "Open Settings"
2. Enter your OpenAI API key (get one at https://platform.openai.com/api-keys)
3. Select your target language
4. Choose script type (Latin or Native)
5. Optionally add custom style instructions

## Usage

1. Click on any text field or select text
2. Press the keyboard shortcut:
   - **macOS**: ⌘ + Shift + U
   - **Windows/Linux**: Ctrl + Alt + U
3. Your text will be instantly translated!

## Supported Languages

- Hindi, Spanish, French, German, Italian, Portuguese
- Russian, Japanese, Korean, Chinese (Simplified)
- Arabic, Turkish, Urdu, Bengali, Punjabi
- Tamil, Telugu, Marathi, Gujarati, Malayalam, Kannada
- Thai, Vietnamese, Indonesian, Malay, Filipino
- Swahili, Dutch, Polish, Ukrainian, Czech
- Greek, Hebrew, Persian/Farsi

## Development

### Project Structure

```
charlie/
├── src/
│   ├── manifest.json    # Extension manifest
│   ├── background.js    # Service worker
│   ├── content.js       # Content script
│   ├── prompt.js        # Translation prompts
│   ├── options.html/js  # Settings page
│   ├── popup.html/js    # Extension popup
│   └── icons/           # Extension icons
├── webpack.config.js    # Build configuration
└── package.json
```

### Development Commands

```bash
# Development build with watch
npm run dev

# Production build
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

### How It Works

1. **Keyboard Shortcut**: Chrome Commands API listens for the shortcut
2. **Text Capture**: Content script grabs text from the active element
3. **Translation**: Background script sends text to OpenAI API
4. **Replacement**: Content script replaces original text with translation

## Privacy

- Your API key is stored securely using Chrome's storage.sync
- No text is logged or stored beyond the translation request
- All translations happen directly between your browser and OpenAI

## Troubleshooting

### "Setup required" message
- Make sure you've entered your OpenAI API key in settings
- Verify you've selected a target language

### Translation not working
- Check your API key is valid and has credits
- Ensure you're focused on a text field
- Try refreshing the page

### Keyboard shortcut conflicts
- Go to `chrome://extensions/shortcuts` to change the shortcut

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details
