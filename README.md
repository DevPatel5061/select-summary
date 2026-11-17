# Select Summary

A Chrome extension that turns selected text into a concise Gemini summary. Bring your own API key; your key, history and activity stay on device.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select **`chrome-extension/`**.
4. Follow the welcome guide to connect your Gemini key and try a summary.

Chrome 127 or newer is required. No build, dependency installation or development server is needed.

## Use

Select text on a webpage, right-click, and choose **Summarize selection**. The default shortcut is **Alt + Shift + S** (Option + Shift + S on Mac). **Alt + G** opens the extension. Change shortcuts at `chrome://extensions/shortcuts`.

The popup contains activity, saved history and settings. Choose a history limit of **5, 10, 15 or 20** summaries in Settings; the default is 10. Replaced or cleared summaries cannot be restored. History pruning preserves aggregate activity. Protected browser pages and some viewers may block selection access or summary cards.

## Data and API usage

Explicit summaries send the selected text directly to Google's Gemini API using your key. Connecting a key makes one small validation request. Page URLs/titles and local activity are not sent by the extension. There are no extension accounts, analytics, developer servers or automatic retries.

Keys and summaries are stored locally and are **not encrypted by the extension**. Summaries can contain sensitive source information. Google controls API processing and pricing: free-tier content may be used for improvement/human review, and billing-enabled projects can incur charges. Avoid sensitive text; review [Google's terms](https://ai.google.dev/gemini-api/terms) and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

Settings lets you replace/disconnect the key, clear history or reset local data. Disconnecting does not revoke the key at Google; revoke it in AI Studio.

## Source

`chrome-extension/` contains the complete runtime. Its manifest defines entry points and required assets; `shared/` contains reusable UI behavior. Both files in `icon/` are used by the extension.

The full development snapshot—including tests, tooling, documentation and design references—is preserved on the [`main-backup`](https://github.com/DevPatel5061/select-summary/tree/main-backup) branch. `main` contains the lean runtime distribution. Reload the extension and refresh existing webpages after source changes.

Upgraded storage uses schema 6. Older source revisions may not understand it; use a separate browser profile when testing older versions.

## License

[GNU GPL v3](LICENSE). Original control SVGs and CSS skyline/hash-table artwork are dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
