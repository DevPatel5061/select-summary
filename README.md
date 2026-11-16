# Select Summary

A lightweight Chrome extension that summarizes highlighted text with Gemini. Bring your own API key, keep your history and activity locally, and get a concise 15–30 word summary.

Version **3.1.0** is available in this source branch. The [Chrome Web Store listing](https://chromewebstore.google.com/detail/select-summary/cmhemijfkgdmehimocompddmibmbndfd) may contain an earlier release until a new package is published.

## Install

1. Download this repository as a ZIP and extract it, or clone it:

   ```sh
   git clone https://github.com/DevPatel5061/select-summary.git
   ```

2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the **`chrome-extension`** folder.
4. A local welcome tab opens automatically on first installation. Follow its setup steps.

There is no build step, package manager, dependency installation, or development server. Chrome 127 or newer is required. Other Chromium browsers may differ in shortcut and toolbar behavior.

Reloading or updating the extension does not automatically open another welcome tab. Use **Settings → Open welcome guide** to revisit it. Reopening the guide preserves your key and history; practicing again makes new API requests and counts the resulting summaries.

## Set up

1. The opening animation shows selected text becoming a summary. Choose **Set up**.
2. Follow the looping, five-second local setup illustration and open [Google AI Studio](https://aistudio.google.com/apikey).
3. Create a key for a project without billing enabled. Google's free tier does not require a credit card, but eligibility, regional availability, project verification, and quotas apply. See [Google's billing guide](https://ai.google.dev/gemini-api/docs/billing).
4. Paste the key and accept the Google data notice. Paste starts one automatic connection check **after consent**; you can also choose **Connect**. A failed check does not replace an existing key or retry automatically.
5. A successful check saves the key, awards **AI Connected**, and opens the practice paragraph.
6. Complete **right-click** first, then your actual assigned **keyboard shortcut**. Both actions generate a real Gemini summary inside the welcome page. Each success earns 50 XP and updates local activity immediately.
7. Review the toolbar pinning guide and choose **Go to dashboard**.

The visual setup guide is a bundled illustration, not a recording of a Google account. No account screenshots, remote fonts, analytics, or third-party image services are loaded.

## Use

Highlight webpage text, right-click, and choose **Summarize selection**. Or use the registered shortcut:

| Action | Default |
| --- | --- |
| Open the extension | `Alt+G` |
| Summarize selection | `Alt+Shift+S` |

On Mac, Alt is **Option**. The welcome page reads your actual shortcut and shows the appropriate key labels and Mac symbols. Change assignments at `chrome://extensions/shortcuts`; unassigned or conflicting shortcuts need to be configured there. `Ctrl/Command+Z` is never the new default. Old installations may retain a previous assignment until changed manually.

Outside onboarding, results appear in an isolated in-page card. **Copy** copies the summary; **X** closes it. A smooth gray ring fills until automatic dismissal: **25 seconds for summaries**, **10 seconds for errors**. Loading cards remain until a response or dismissal. Completed results are saved even when a protected page cannot show a card.

Selections are limited to 50,000 characters. Browser settings, extension stores, and some viewers block selection access or injection. Empty selections do not call Gemini.

## Local history and activity

The latest ten summaries are stored locally. Daily aggregates retain summary counts, estimated time saved, streaks, and personal bests after older history is pruned. Both successful practice summaries count; the connection check does not.

Time saved estimates the positive difference between source and summary reading time at **225 words per minute**. Streaks use the local calendar. XP is 50 per successful summary; the reader level increases every ten summaries. These are local counters, not developer analytics.

**Clear history** preserves aggregates. **Remove key** disconnects the key while preserving history. **Reset all local data** removes the key, history, activity, and setup progress. Removing a key locally does not revoke it at Google.

## Privacy and costs

The extension has no fees, subscriptions, ads, tracking, developer-run backend, or account system. Fonts use your operating system; assets are bundled.

Gemini is a separate Google service. Connecting sends one small validation request. Each explicit practice or webpage summary sends the selected text directly to Google. Free-tier inputs and outputs may be used for product improvement and human review; billing-enabled projects can incur charges. The extension cannot verify project billing status or guarantee Google's future pricing. Avoid sensitive text.

Read [Privacy and data handling](PRIVACY.md), [Google's API terms](https://ai.google.dev/gemini-api/terms), and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## How the extension is organized

The repository contains the active extension and its installation, privacy, and license documents. Development test suites, package manifests, dependencies, reports, and screenshots have been removed.

| Component | Responsibility |
| --- | --- |
| `welcome.html`, `popup.html` | Local page entry points |
| `bootstrap.js`, `interface.html` | Shared bundled markup without duplicate screens |
| `popup.js`, `tutorial.js` | Setup, dashboard, and inline practice interactions |
| `background.js` | Validated requests, native command routing, Gemini calls, and persistence |
| `gemini.js` | Provider authentication, timeouts, safe errors, and concise output |
| `core.js`, `storage.js` | Local data migration, calendar activity, and serialized writes |
| `content.js`, `summary.css` | Isolated in-page result card |

The runtime has no third-party dependencies. Source files use multiline formatting and comments around the selection, message-routing, storage, and timing behavior.

Security boundaries include trusted-context storage, sender URL/ID checks, header-based authentication, text-only rendering of generated content, a restricted CSP, no blanket webpage host access, and one worker queue for local mutations. Keys are stored locally, **not encrypted by the extension**. A compromised browser profile or device can expose local data.

The model is `gemini-3.5-flash-lite`, centralized in `core.js`. Each summary makes one request with minimal thinking. Verbose output is shortened locally; blocked, empty, or incomplete responses are not saved. No search tools, paid fallbacks, or automatic provider switching are enabled.

## Troubleshooting

- **Key check fails:** verify the complete key, Gemini access, restrictions, project eligibility, and region in AI Studio. Retry explicitly or paste a replacement.
- **Quota exhausted:** check the project's limits and wait for reset. The extension never enables billing.
- **Practice right-click:** highlight the paragraph before opening the menu. Keyboard users can focus the paragraph, press Ctrl/Command+A, then Shift+F10.
- **Practice shortcut:** finish right-click first, highlight again, and press the displayed keys together. Results stay inside the welcome page.
- **No card:** open History; protected pages can block injection.
- **Source changes:** reload the extension, refresh webpages, then open the welcome guide if needed. A browser restart may be needed to replace an older shortcut assignment.

## License

The project retains its [GNU GPL v3 license](LICENSE). Original SVG button artwork in `icons.js` and `content.js` is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). SVGs are used only inside buttons. The existing raster extension icon is retained.
