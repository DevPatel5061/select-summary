# Select Summary

A lightweight Chrome extension that summarizes highlighted text with Gemini. Bring your own API key, keep your history and activity locally, and get a concise 15–30 word summary.

Version **3.2.1** is available in this source branch. The [Chrome Web Store listing](https://chromewebstore.google.com/detail/select-summary/cmhemijfkgdmehimocompddmibmbndfd) may contain an earlier release until a new package is published.

This release simplifies key setup and replaces onboarding animations with a hands-on Chrome-style browser containing three fixed, local pages.

## Install

1. Download this repository as a ZIP and extract it, or clone it:

   ```sh
   git clone --branch feat/modern-extension-experience https://github.com/DevPatel5061/select-summary.git
   ```

2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the **`chrome-extension`** folder.
4. A local welcome tab opens automatically on first installation. Follow its setup steps.

There is no build step, package manager, dependency installation, or development server. Chrome 127 or newer is required. Other Chromium browsers may differ in shortcut and toolbar behavior.

Reloading or updating the extension does not automatically open another welcome tab. Use **Settings → Open welcome guide** to revisit it. Reopening the guide preserves your key and history; practicing again makes new API requests and counts the resulting summaries.

## Set up

1. **Connect:** Paste your Gemini key into the focused setup form. Need a key? Expand **Get a key** for three short instructions and a direct [Google AI Studio](https://aistudio.google.com/apikey) button.
2. Use an eligible free-tier project **without billing enabled**. Google's free tier does not require a credit card, but regional availability, project verification, and quotas apply. See [Google's billing guide](https://ai.google.dev/gemini-api/docs/billing).
3. Paste your key, accept the Google data notice, then press **Verify & Continue**. Only this explicit action sends a small validation request. A failed check stays inline and preserves an existing key.
4. **Try it:** The local browser starts on a Wikipedia-style Canada article. Highlight paragraph text, right-click, and choose **Summarize selection**, or press the displayed shortcut. Each keycap visibly presses as you hold its key. The real Gemini result appears inside the demo using the same card as webpage summaries. One successful summary unlocks the next step, awards **50 XP**, updates your actual streak, and saves the **First Summary** milestone.
5. **Make it a habit:** Follow the toolbar pinning diagram, then choose **Start Browsing & Earning Streaks**. The welcome tab closes; if it is the window's only tab, it opens a new tab page instead.

The demo has three clickable tabs: **Select Summary**, **Web Store**, and **Canada – Wikipedia**. Each is bundled HTML with original practice prose, not a remotely loaded site. Canada facts were checked against [Wikipedia's Canada article](https://en.wikipedia.org/wiki/Canada); no Wikipedia text or images are bundled. Selectable paragraphs on all three tabs work with the extension.

Back and forward navigate only among these pages. **Reset practice** clears the selection and displayed card without deleting history, changing completed progress, or sending a request. Unavailable actions show a brief in-demo notice. There are no new-tab or tab-close controls, and the address display is read-only. Browser-wide shortcuts such as Ctrl/Command+T still belong to your real browser, not the local demo.

Switching tabs, opening setup help, and resetting practice make no API requests or rewards. No recordings, account screenshots, remote fonts, analytics, or third-party image services are loaded.

## Use

Highlight webpage text, right-click, and choose **Summarize selection**. Or use the registered shortcut:

| Action              | Default       |
| ------------------- | ------------- |
| Open the extension  | `Alt+G`       |
| Summarize selection | `Alt+Shift+S` |

On Mac, Alt is **Option**. The welcome page reads your actual shortcut and shows the appropriate key labels and Mac symbols. Change assignments at `chrome://extensions/shortcuts`; unassigned or conflicting shortcuts need to be configured there. `Ctrl/Command+Z` is never the new default. Old installations may retain a previous assignment until changed manually.

Outside onboarding, results appear in an isolated in-page card. **Copy** copies the summary; **X** closes it. A smooth gray ring fills until automatic dismissal: **25 seconds for summaries**, **10 seconds for errors**. Loading cards remain until a response or dismissal. Completed results are saved even when a protected page cannot show a card.

Selections are limited to 50,000 characters. Browser settings, extension stores, and some viewers block selection access or injection. Empty selections do not call Gemini.

## Local history and activity

The latest ten summaries are stored locally. Daily aggregates retain summary counts, estimated time saved, streaks, and personal bests after older history is pruned. Every successful live sandbox or webpage summary counts; validation and browser controls do not. The First Summary milestone persists even after clearing history.

Time saved estimates the positive difference between source and summary reading time at **225 words per minute**. Streaks use the local calendar. XP is 50 per successful summary. The overview shows your XP and earned First Summary badge. These are local counters, not developer analytics.

**Clear history** preserves aggregates. **Remove key** disconnects the key while preserving history. **Reset all local data** removes the key, history, activity, and setup progress. Removing a key locally does not revoke it at Google.

## Privacy and costs

The extension has no fees, subscriptions, ads, tracking, developer-run backend, or account system. Fonts use your operating system; assets are bundled.

Gemini is a separate Google service. Connecting sends one small validation request. Each explicit practice or webpage summary sends the selected text directly to Google. Free-tier inputs and outputs may be used for product improvement and human review; billing-enabled projects can incur charges. The extension cannot verify project billing status or guarantee Google's future pricing. Avoid sensitive text.

Read [Privacy and data handling](PRIVACY.md), [Google's API terms](https://ai.google.dev/gemini-api/terms), and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## How the extension is organized

The repository contains the active extension and its installation, privacy, and license documents. Development test suites, package manifests, dependencies, reports, and screenshots have been removed.

| Component                                                               | Responsibility                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `welcome.html`, `welcome.css`, `welcome.js`, `practice-browser.js`      | Three-step setup, fixed-tab browser, selection/menu handling, keyboard feedback, and pin guide |
| `popup.html`, `bootstrap.js`, `interface.html`, `popup.js`, `popup.css` | Toolbar and standalone dashboard, history, and settings                                        |
| `background.js`                                                         | Validated requests, native command routing, Gemini calls, and persistence                      |
| `gemini.js`                                                             | Provider authentication, timeouts, safe errors, and concise output                             |
| `core.js`, `storage.js`                                                 | Local data migration, calendar activity, and serialized writes                                 |
| `summary-card.js`, `summary.css`                                        | Shared, isolated summary card used by webpages and the sandbox                                 |
| `content.js`                                                            | Validated webpage message listener and card lifecycle                                          |

The runtime has no third-party dependencies. Source files use multiline formatting and comments around the selection, message-routing, storage, and timing behavior.

Security boundaries include trusted-context storage, sender URL/ID checks, header-based authentication, text-only rendering of generated content, a restricted CSP, no blanket webpage host access, and one worker queue for local mutations. Keys are stored locally, **not encrypted by the extension**. A compromised browser profile or device can expose local data.

The model is `gemini-3.5-flash-lite`, centralized in `core.js`. Each summary makes one request with minimal thinking. Verbose output is shortened locally; blocked, empty, or incomplete responses are not saved. No search tools, paid fallbacks, or automatic provider switching are enabled.

## Troubleshooting

- **Key check fails:** verify the complete key, Gemini access, restrictions, project eligibility, and region in AI Studio. Retry explicitly or paste a replacement.
- **Quota exhausted:** check the project's limits and wait for reset. The extension never enables billing.
- **Demo selection:** highlight paragraph text and right-click → Summarize selection. Keyboard users can focus a paragraph, press Ctrl/Command+A, then Shift+F10 and use the menu’s arrow keys and Enter.
- **Shortcut:** highlight text and press the displayed keys together. A sandbox result stays inside the welcome page. Either right-click or the shortcut is enough to continue.
- **No card:** open History; protected pages can block injection.
- **Source changes:** reload the extension, refresh webpages, then open the welcome guide if needed. A browser restart may be needed to replace an older shortcut assignment.

## License

The project retains its [GNU GPL v3 license](LICENSE). Original SVG button artwork in `icons.js` and `summary-card.js` is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). SVGs are used only inside buttons. The existing raster extension icon is retained.
