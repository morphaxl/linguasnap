Below is a complete product‑requirements document (PRD) that an autonomous AI‑agent (or a human dev team!) can follow end‑to‑end to ship the Chrome extension you described. I’ve embedded sample code blocks and direct pointers to the relevant Chrome‑Extension & OpenAI docs so nothing is left ambiguous.

---

## 1 · Executive summary

Build **“LinguaSnap”**, a Manifest V3 Chrome extension that:

* Lets the user paste an OpenAI API key, pick a **target language**, define an **optional style/accent prompt**, and set two global **keyboard shortcuts** (⌘ U on macOS, Ctrl + Alt + U on Windows by default).
* On shortcut press, it grabs the text in the currently‑focused `<input>` / `<textarea>` / content‑editable element, sends it to **`gpt‑4o‑mini`** for translation, and **replaces** the original text in‑place.
* Works on any site (WhatsApp Web, Gmail, X, Discord, etc.) without extra configuration.

---

## 2 · Goals & success metrics

| Goal                            | KPI                                                       |
| ------------------------------- | --------------------------------------------------------- |
| Instant in‑place translation    | ≤ 500 ms median round‑trip latency for ≤ 200‑token inputs |
| Zero‑click UX after first setup | ≥ 90 % of sessions use keyboard shortcut (vs. popup)      |
| Privacy‑safe                    | No plaintext is stored; only hashed/obfuscated telemetry  |
| Error‑resilience                | < 1 % visible errors per 1 000 requests                   |

---

## 3 · Personas & user stories

1. **Multilingual Professional**
   *“When I’m replying to Spanish‑speaking clients in WhatsApp Web, I hit my shortcut and my English draft is swapped into flawless Spanish with a friendly tone.”*
2. **Language‑learner**
   *Wants to experiment with tones (“make it Gen‑Z slang”) while chatting on Reddit.*

Key user stories

```
US‑01  As a user, I can input my OpenAI API key once and have it stored securely.
US‑02  I can pick my target language and change it later.
US‑03  I can enter an optional “style / accent” note (e.g. “polite formal French”).
US‑04  I can trigger translation with a single shortcut regardless of the site.
US‑05  The extension replaces only the text I just typed, preserving cursor position.
US‑06  Errors (rate‑limit, network) surface as unobtrusive toast messages.
```

---

## 4 · Functional requirements

| #    | Description                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR‑1 | Options page with fields: API key, default language (dropdown, auto‑detected list), style textarea, macOS shortcut, Windows/Linux shortcut.                                                                                                                      |
| FR‑2 | Background Service Worker listens to `chrome.commands.onCommand` and relays “translate” to the active tab.                                                                                                                                                       |
| FR‑3 | Content script injected via `"all_frames": true` + `"matches": ["<all_urls>"]` captures the focused element’s current value/selection, sends it to background (MessagePassing), awaits translated text, then overwrites value + fires `input` / `change` events. |
| FR‑4 | OpenAI call (`gpt‑4o‑mini`) with robust prompt wrapper (system + user + meta) and exponential‑backoff retry on 429.                                                                                                                                              |
| FR‑5 | Shortcut conflicts handled via the Commands API: if user’s chosen combo is already taken, show warning and fallback UI.                                                                                                                                          |
| FR‑6 | Settings synced via `chrome.storage.sync` so they roam across Chrome signin.                                                                                                                                                                                     |
| FR‑7 | Graceful degradation: if no text field is focused, popup shows “Nothing to translate”.                                                                                                                                                                           |

---

## 5 · Non‑functional requirements

* **Privacy** – No user text persists beyond the API request.
* **Security** – API key is stored with `storage.sync` (encrypted at‑rest by Chrome); never logged.
* **Performance** – Debounce multiple quick presses; max 4 concurrent requests to avoid rate‑limit ([OpenAI Platform][1]).
* **Accessibility** – Options page labeled for screen readers; high‑contrast check.
* **Localization** – UI supports i18n using `__MSG_` keys and `chrome.i18n`.

---

## 6 · Technical architecture

```
┌────────────┐      chrome.commands      ┌─────────────────┐
│ Background  │  ─────────────────────▶ │  Content script │
│  SW (MV3)   │                         └────────┬────────┘
│  openai.ts  │ ◀────────────────────── Message Passing
└────┬────────┘                                     │
     │ fetch() to OpenAI                            ▼
     └──────────────▶ https://api.openai.com/v1/chat/completions
                      (model: gpt‑4o‑mini) :contentReference[oaicite:1]{index=1}
```

### 6.1 Manifest V3 skeleton

```jsonc
{
  "manifest_version": 3,
  "name": "LinguaSnap",
  "version": "0.1.0",
  "description": "Translate typed text in‑place with GPT‑4o mini",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "commands": {
    "translate-now": {
      "suggested_key": {
        "default": "Ctrl+Alt+U",
        "mac": "Command+U"
      },
      "description": "Translate selected / focused text"
    }
  },
  "options_page": "options.html",
  "icons": {
    "16": "icons/16.png",
    "32": "icons/32.png",
    "128": "icons/128.png"
  }
}
```

*Reference: Chrome Commands API ([Chrome for Developers][2])*

### 6.2 Background service‑worker (`background.js`)

```js
// background.js
import { buildPrompt } from './prompt.js';

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-now') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const settings = await chrome.storage.sync.get([
    'apiKey', 'targetLang', 'stylePrompt'
  ]);
  chrome.tabs.sendMessage(tab.id, { type: 'GRAB_TEXT' }, async (res) => {
    if (!res?.text) return;
    try {
      const body = {
        model: 'gpt-4o-mini',
        messages: buildPrompt(res.text, settings),
        temperature: 0.2
      };
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(body)
      });
      const { choices } = await r.json();
      chrome.tabs.sendMessage(tab.id, {
        type: 'REPLACE_TEXT',
        text: choices[0].message.content.trim()
      });
    } catch (err) {
      chrome.tabs.sendMessage(tab.id, { type: 'ERROR', err: String(err) });
    }
  });
});
```

### 6.3 Content script (`content.js`)

```js
// content.js
let lastRange;
function getActiveEditable() {
  const el = document.activeElement;
  if (
    el &&
    (el.tagName === 'TEXTAREA' ||
     (el.tagName === 'INPUT' && /text|search|email|url/.test(el.type)) ||
     el.isContentEditable)
  ) { return el; }
  return null;
}

chrome.runtime.onMessage.addListener(async (msg, _sender, respond) => {
  if (msg.type === 'GRAB_TEXT') {
    const node = getActiveEditable();
    if (!node) return respond({});
    let text;
    if (node.isContentEditable) {
      const selection = window.getSelection();
      lastRange = selection.rangeCount ? selection.getRangeAt(0) : null;
      text = selection.toString() || node.innerText;
    } else {
      text = node.value.substring(node.selectionStart, node.selectionEnd) || node.value;
    }
    return respond({ text });
  }

  if (msg.type === 'REPLACE_TEXT') {
    const node = getActiveEditable();
    if (!node) return;
    if (node.isContentEditable && lastRange) {
      lastRange.deleteContents();
      lastRange.insertNode(document.createTextNode(msg.text));
    } else if ('value' in node) {
      node.value = msg.text;
    }
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (msg.type === 'ERROR') {
    console.error('LinguaSnap:', msg.err);
    // Optional: display toast
  }
});
```

*Pattern for text‑replacement inspired by StackOverflow example ([Stack Overflow][3])*

### 6.4 Prompt builder (`prompt.js`)

```js
export function buildPrompt(original, { targetLang, stylePrompt }) {
  return [
    {
      role: 'system',
      content:
        `You are a high‑quality translator. ` +
        `Translate the user text into ${targetLang} while preserving meaning. ` +
        `Obey any additional style instructions.`
    },
    {
      role: 'user',
      content: `Translate the following:\n"""${original}"""` +
               (stylePrompt ? `\n\nStyle: ${stylePrompt}` : '')
    }
  ];
}
```

### 6.5 Options page (sketch)

`options.html` loads `options.js` which:

```js
document.getElementById('save').onclick = async () => {
  const apiKey = document.getElementById('key').value.trim();
  const targetLang = document.getElementById('lang').value;
  const stylePrompt = document.getElementById('style').value;
  await chrome.storage.sync.set({ apiKey, targetLang, stylePrompt });
  alert('Saved!');
};
```

---

## 7 · OpenAI integration details

* **Model:** `gpt‑4o‑mini` (multimodal‑to‑text, cost‑efficient) ([clarifai.com][4])
* **Endpoint:** `POST /v1/chat/completions`
* **Recommended max tokens:** `max_tokens = original_tokens * 1.3` to account for expansion.
* **Rate limits:** obey RPM & TPM quotas; implement exponential back‑off (200 ms, 400 ms, 800 ms…) up to 4 retries ([OpenAI Platform][1]).
* **Temperature:** 0–0.3 for deterministic translations.
* **Safety:** No log retention; set `user` parameter to a hashed user‑id to align with policy.

---

## 8 · Security & privacy

1. API key stored only via `chrome.storage.sync` (AES‑256 at rest).
2. No content logging; debugging is purely local.
3. Extension requests minimal host permissions (`<all_urls>` + `activeTab`).
4. CSP in `manifest.json` to restrict network to `https://api.openai.com`.

---

## 9 · Edge cases & error flows

| Scenario                                               | Expected behaviour                                            |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| User presses shortcut with no editable element focused | Show toast: “Cursor not in a text box.”                       |
| OpenAI returns 429 or 5xx                              | Show toast; auto‑retry up to 4×, then fall back to popup.     |
| Invalid API key                                        | Prompt user to open Options page.                             |
| Shortcut conflict                                      | Options page highlights conflict; user must choose new combo. |

---

## 10 · Implementation roadmap

| Phase | Tasks                                                          | Owner            | Done‑When                         |
| ----- | -------------------------------------------------------------- | ---------------- | --------------------------------- |
| 0     | Repo scaffolding (`pnpm init`, ESLint, Prettier, Webpack/Vite) | Agent            | All baseline checks pass          |
| 1     | Implement Options UI + storage sync                            | Agent            | Values persist across restart     |
| 2     | Build background SW & content script, wire message passing     | Agent            | Shortcut logs captured in console |
| 3     | Integrate OpenAI, prompt builder, error handling               | Agent            | Translation works in Gmail draft  |
| 4     | UX polish: toasts, icon badge, i18n                            | Agent            | Manual QA in WhatsApp, Discord    |
| 5     | Package, run `chrome://extensions` load‑unpacked QA            | Agent + Human QA | Test plan passes                  |
| 6     | Publish to Chrome Web Store (beta channel)                     | Human            | Store listing approved            |

---

## 11 · Directory structure

```
linguasnap/
├─ manifest.json
├─ background.js
├─ content.js
├─ prompt.js
├─ options.html
├─ options.js
├─ icons/
└─ README.md
```

---

## 12 · Testing checklist

* Unit tests for `prompt.js` (Jest).
* E2E tests with Puppeteer (simulate WhatsApp Web input) on macOS + Windows VMs.
* Lighthouse performance run (expect < 50 kB JS).
* Verify permissions diff using `chrome-web-ext-permissions`.

---

## 13 · Open questions

1. **Model fallback** – Should we auto‑switch to `gpt‑4o` if `gpt‑4o‑mini` is unavailable?
2. **Privacy banner** – Do we need an explicit disclosure for GDPR/DPDP?
3. **Enterprise use‑case** – Allow proxying via an internal gateway?

---

## 14 · Appendix A · Prompt best practice reference

OpenAI recommends a **system** message for role specification plus a **user** message containing the raw text and style instructions. Keep temperature low for consistency; include delimiters (`"""`) to avoid prompt injection. (See OpenAI docs) ([OpenAI Platform][5])

---

### Done ✨

With the structure, specs, and code above, an AI agent (or your dev) can scaffold, code, and ship the extension in one uninterrupted pass. Good luck, and happy cross‑language chatting!

[1]: https://platform.openai.com/docs/guides/rate-limits?utm_source=chatgpt.com "Rate limits - OpenAI API"
[2]: https://developer.chrome.com/docs/extensions/reference/api/commands?utm_source=chatgpt.com "chrome.commands | API - Chrome for Developers"
[3]: https://stackoverflow.com/questions/38220320/how-to-replace-input-field-selected-text-with-chrome-extension-context-menu?utm_source=chatgpt.com "How to replace input field selected text with Chrome extension ..."
[4]: https://clarifai.com/openai/chat-completion/models/gpt-4o-mini?utm_source=chatgpt.com "gpt-4o-mini model | Clarifai - The World's AI"
[5]: https://platform.openai.com/docs/guides/tools-web-search?utm_source=chatgpt.com "Web search - OpenAI API"
