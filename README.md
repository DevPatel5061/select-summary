# Select Summary

A lightweight Chrome extension that summarizes highlighted text with Gemini. Bring your own API key, keep your history and activity locally, and get a concise 15–30 word summary.

Version **3.5.0** is available in this source branch. The [Chrome Web Store listing](https://chromewebstore.google.com/detail/select-summary/cmhemijfkgdmehimocompddmibmbndfd) may contain an earlier release until a new package is published.

The welcome guide introduces the extension with an animated browser illustration, then guides users through connecting Gemini, hands-on practice, and optional toolbar pinning. The extension popup and shared summary card retain their existing design.

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

1. **Welcome:** Watch an illustrated passage become a concise summary inside a browser frame, then choose **Get started**. This introduction is a bundled illustration and makes no API requests.
2. **Connect:** Choose **Get a Gemini key** to open [Google AI Studio](https://aistudio.google.com/apikey), or paste a key you already have. The browser illustration demonstrates creating a key, naming and selecting a project, and copying the key. A connected stage indicator above the illustration fills as each scene plays. Choose a stage to revisit it.
3. Use an eligible free-tier project **without billing enabled**. Google's free tier does not require a credit card, but regional availability, project verification, and quotas apply. See [Google's billing guide](https://ai.google.dev/gemini-api/docs/billing).
4. Paste your key, accept the Google data notice, then press **Connect Gemini**. Only this explicit action sends a small validation request. A failed check stays inline and preserves an existing key.
5. **Try it:** Highlight paragraph text inside the embedded demo and choose **Summarize selection** from Chrome’s native right-click menu, or press your displayed shortcut. Toronto is selected first; both articles include several paragraphs of original source-based practice prose. The two tabs contain original practice adaptations of exactly these sources:
   - [GeeksforGeeks: Hash Table](https://www.geeksforgeeks.org/dsa/hash-table-data-structure/)
   - [Wikipedia: Toronto](https://en.wikipedia.org/wiki/Toronto)
6. Gemini generates a real response using your connected key. It appears inside the demo using the same summary card as normal webpages. Successful practice updates local history and activity and enables the primary Continue action. Continue stays disabled until a successful summary in this walkthrough. Ready and completion are also checked by the worker; a previous walkthrough or failed request cannot unlock them. Practice uses no canned responses, custom context menus, or floating Summarize buttons.
7. **Ready:** Watch the pinning illustration, then pin through Chrome’s actual toolbar if desired. Choose **Open Select Summary** to finish onboarding and open the existing dashboard in the same tab.

Illustrations loop while visible without replay controls, and reset when revisited. Switching away pauses the active animation; returning resumes it without starting over. Reduced-motion mode uses static illustrations, and every key-setup scene remains available through the scene buttons. Written pinning and key instructions remain available at all sizes. Opening help, switching demo tabs, resetting the view, and watching animations make no API requests. Key verification remains an explicit **Connect Gemini** action.

### Embedded practice

The demo uses bundled HTML, original condensed prose based on the two linked articles, an original Toronto skyline illustration, and an original hash-table diagram. It does not load, frame, proxy, or copy the full websites, and it opens no extra Chrome windows or website tabs. Their exact source URLs appear in the read-only address display. Selecting text uses normal browser selection and Chrome’s native context menu; the extension does not intercept right-clicks.

Only your explicitly selected practice text is sent to Gemini. Tab switching and Reset do not delete saved activity or undo onboarding progress. A response finishing after a tab switch or reset is saved without unexpectedly reopening a card; **Show summary again** restores the current article’s saved result. Browsing and summarization on ordinary webpages continue to work normally.

The onboarding uses a shared alignment grid, readable type, browser frames, and a consistent navigation footer. Short or narrow windows can scroll the page to keep every control reachable; article content can also scroll inside the embedded browser. Setup help expands in the document instead of covering the form. Errors use flat red surfaces without an accent stripe.

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

The latest ten summaries are stored locally. Daily aggregates retain summary counts, estimated time saved, streaks, and personal bests after older history is pruned. Every successful article or webpage summary counts; verification and walkthroughs do not. The First Summary milestone persists even after clearing history.

Time saved estimates the positive difference between source and summary reading time at **225 words per minute**. Streaks use the local calendar. XP is 50 per successful summary. The overview shows your XP and earned First Summary badge. These are local counters, not developer analytics.

**Clear history** preserves aggregates. **Remove key** disconnects the key while preserving history. **Reset all local data** removes the key, history, activity, and setup progress. Removing a key locally does not revoke it at Google.

## Privacy and costs

The extension has no fees, subscriptions, ads, tracking, developer-run backend, or account system. Fonts use your operating system; assets are bundled.

Gemini is a separate Google service. Connecting sends one small validation request. Each explicit practice or webpage summary sends the selected text directly to Google. The embedded demo does not contact either source website. Free-tier inputs and outputs may be used for product improvement and human review; billing-enabled projects can incur charges. The extension cannot verify project billing status or guarantee Google's future pricing. Avoid sensitive text.

Read [Privacy and data handling](PRIVACY.md), [Google's API terms](https://ai.google.dev/gemini-api/terms), and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## How the extension is organized

The runtime is in `chrome-extension/`. Dependency-free regression tests are in `tests/`; the maintainability review is in `docs/CODE_QUALITY_REVIEW.md`. Design artifacts in `work/` are not part of the extension package.

| Component                                                               | Responsibility                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `welcome.html`, `welcome.css`, `welcome.js`, `walkthroughs.js`          | Animated introduction, Gemini setup, browser illustrations, and required practice |
| `popup.html`, `bootstrap.js`, `interface.html`, `popup.js`, `popup.css` | Toolbar and standalone dashboard, history, and settings                           |
| `demo-articles.js`, `article-demo.js`                                   | Bundled practice prose, two article tabs, real selection, and shared result cards |
| `background.js`                                                         | Validated requests, native command routing, Gemini calls, and persistence         |
| `gemini.js`                                                             | Provider authentication, timeouts, safe errors, and concise output                |
| `core.js`, `storage.js`                                                 | Local data migration, calendar activity, and serialized writes                    |
| `summary-card.js`, `summary.css`                                        | Shared, isolated summary card used by webpages and the sandbox                    |
| `content.js`                                                            | Validated webpage message listener and card lifecycle                             |

The runtime has no third-party dependencies. Source files use multiline formatting and comments around the selection, message-routing, storage, and timing behavior.

Security boundaries include trusted-context storage, sender URL/ID checks, header-based authentication, text-only rendering of generated content, a restricted CSP, no blanket webpage host access, and one worker queue for local mutations. Keys are stored locally, **not encrypted by the extension**. A compromised browser profile or device can expose local data.

The model is `gemini-3.5-flash-lite`, centralized in `core.js`. Each summary makes one request with minimal thinking. Verbose output is shortened locally; blocked, empty, or incomplete responses are not saved. No search tools, paid fallbacks, or automatic provider switching are enabled.

## Troubleshooting

- **Key check fails:** verify the complete key, Gemini access, restrictions, project eligibility, and region in AI Studio. Retry explicitly or paste a replacement.
- **Quota exhausted:** check the project's limits and wait for reset. The extension never enables billing.
- **Practice:** highlight paragraph text inside either demo tab and use Chrome’s native context menu or the shortcut. Keyboard users can focus the paragraph and select it with Ctrl/Command+A.
- **Shortcut:** highlight text and press the displayed keys together. A practice result stays inside the embedded demo. Either right-click or the shortcut is enough to continue.
- **No card:** open History; protected pages can block injection.
- **Source changes:** reload the extension at `chrome://extensions`, refresh webpages, then reopen the welcome guide. The guide checks its worker interface and shows a reload instruction if an older worker is still running. A browser restart may be needed to replace an older shortcut assignment.

## License

The project retains its [GNU GPL v3 license](LICENSE). Original SVG button artwork in `icons.js` and `summary-card.js` is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). SVGs are used only inside buttons. The original CSS skyline and hash-table artwork in the welcome page are also dedicated under CC0 1.0. The existing raster extension icon is retained.

## Development checks and maintenance

Run `node --test tests/onboarding.test.mjs` with a current Node release. The tests use simulated provider responses and cover per-run gating, failures, replay, tab isolation and late responses.

Reopening the welcome guide starts at Welcome, resets animations and practice progress, and requires a new successful practice summary. Your saved key, history and activity are preserved. Animations make no provider requests. Browser instructions are neutral; toolbar pinning can differ across compatible browsers.

Onboarding uses the supplied pine-green logo, Georgia headings and warm stone surfaces without remote fonts. Popup and shared summary-card styling are unchanged. See [Changelog](CHANGELOG.md) and [Code quality review](docs/CODE_QUALITY_REVIEW.md) for implemented cleanup, remaining risks and the recommended refactor order. Package only `chrome-extension/`.
