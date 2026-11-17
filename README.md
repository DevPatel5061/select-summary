# Select Summary

A lightweight Chrome extension that summarizes highlighted text with Gemini. Bring your own API key, keep your history and activity locally, and get a concise 15–30 word summary.

Version **3.3.0** is available in this source branch. The [Chrome Web Store listing](https://chromewebstore.google.com/detail/select-summary/cmhemijfkgdmehimocompddmibmbndfd) may contain an earlier release until a new package is published.

This release restores the AI Studio walkthrough beside a cleaner setup form, moves practice into a real Chrome window, and animates the pinning guide.

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

1. **Connect:** Paste your Gemini key into the form on the left. The walkthrough on the right shows how to create and copy it. Expand **Get a key** for a direct [Google AI Studio](https://aistudio.google.com/apikey) button.
2. Use an eligible free-tier project **without billing enabled**. Google's free tier does not require a credit card, but regional availability, project verification, and quotas apply. See [Google's billing guide](https://ai.google.dev/gemini-api/docs/billing).
3. Paste your key, accept the Google data notice, then press **Verify & Continue**. Only this explicit action sends a small validation request. A failed check stays inline and preserves an existing key.
4. **Try it:** Choose **Open practice window**. Select Summary moves the onboarding tab into a dedicated Chrome window and opens exactly two actual websites:
   - [GeeksforGeeks: Hash Table](https://www.geeksforgeeks.org/dsa/hash-table-data-structure/)
   - [Wikipedia: Toronto](https://en.wikipedia.org/wiki/Toronto)
5. Highlight text on either article, then use Chrome’s normal right-click menu → **Summarize selection**, or your assigned shortcut. The production summary card appears on the actual webpage. One successful practice summary unlocks Continue, updates local activity, awards 50 XP, and preserves the First Summary milestone.
6. Return to the **Select Summary** tab, choose Continue, and follow the animated toolbar pinning guide. Actual pinning is done through Chrome’s own Extensions menu. Choose **Start Browsing & Earning Streaks** to finish.

The key walkthrough is a bundled illustration, not a recording of a Google account. Pasting, opening help, and playing either walkthrough do not contact Gemini. Verification happens only after **Verify & Continue**.

### Practice window restrictions

New extra tabs created inside the dedicated practice window close automatically while practice is active. This does not affect tabs created in other windows. Navigation inside existing tabs is unrestricted; the extension requests no additional URL-reading permissions.

Choose **Exit practice** to stop the restriction immediately. Continuing to the pin step or finishing also stops it. Closing/moving a practice tab or leaving the onboarding page ends restrictions. Existing personal tabs dragged into the practice window are preserved and restrictions stop. A newly created tab moved out before the guard processes it is also preserved.

The temporary session survives a worker restart. An interrupted setup releases restrictions rather than trying to close unknown tabs. Exiting or finishing leaves website tabs intact for normal browsing. Returning to the guide and reopening practice after exit starts a new dedicated session.

The articles are real websites with their own network requests, cookies, advertising, and privacy practices. No pages are copied, framed, proxied, or remotely streamed by the extension. If one article is unavailable, use the other. No substitute websites are opened.

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

Gemini is a separate Google service. Connecting sends one small validation request. Each explicit practice or webpage summary sends the selected text directly to Google. Opening practice also loads the two supplied websites normally in Chrome. Free-tier inputs and outputs may be used for product improvement and human review; billing-enabled projects can incur charges. The extension cannot verify project billing status or guarantee Google's future pricing. Avoid sensitive text.

Read [Privacy and data handling](PRIVACY.md), [Google's API terms](https://ai.google.dev/gemini-api/terms), and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## How the extension is organized

The repository contains the active extension and its installation, privacy, and license documents. Development test suites, package manifests, dependencies, reports, and screenshots have been removed.

| Component                                                               | Responsibility                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `welcome.html`, `welcome.css`, `welcome.js`, `walkthroughs.js`          | Setup, AI Studio/pinning illustrations, and the real-window practice guide |
| `popup.html`, `bootstrap.js`, `interface.html`, `popup.js`, `popup.css` | Toolbar and standalone dashboard, history, and settings                    |
| `practice-session.js`                                                   | Dedicated Chrome window, temporary session IDs, and scoped extra-tab guard |
| `background.js`                                                         | Validated requests, native command routing, Gemini calls, and persistence  |
| `gemini.js`                                                             | Provider authentication, timeouts, safe errors, and concise output         |
| `core.js`, `storage.js`                                                 | Local data migration, calendar activity, and serialized writes             |
| `summary-card.js`, `summary.css`                                        | Shared, isolated summary card used by webpages and the sandbox             |
| `content.js`                                                            | Validated webpage message listener and card lifecycle                      |

The runtime has no third-party dependencies. Source files use multiline formatting and comments around the selection, message-routing, storage, and timing behavior.

Security boundaries include trusted-context storage, sender URL/ID checks, header-based authentication, text-only rendering of generated content, a restricted CSP, no blanket webpage host access, and one worker queue for local mutations. Keys are stored locally, **not encrypted by the extension**. A compromised browser profile or device can expose local data.

The model is `gemini-3.5-flash-lite`, centralized in `core.js`. Each summary makes one request with minimal thinking. Verbose output is shortened locally; blocked, empty, or incomplete responses are not saved. No search tools, paid fallbacks, or automatic provider switching are enabled.

## Troubleshooting

- **Key check fails:** verify the complete key, Gemini access, restrictions, project eligibility, and region in AI Studio. Retry explicitly or paste a replacement.
- **Quota exhausted:** check the project's limits and wait for reset. The extension never enables billing.
- **Practice:** highlight text on either actual article and use Chrome’s native context menu or the assigned shortcut. Return to the Select Summary tab afterward; it will show Continue when a summary succeeds.
- **Shortcut:** highlight text and press the displayed keys together. A practice result appears on the actual article webpage. Either right-click or the shortcut is enough to continue.
- **No card:** open History; protected pages can block injection.
- **Source changes:** reload the extension, refresh webpages, then open the welcome guide if needed. A browser restart may be needed to replace an older shortcut assignment.

## License

The project retains its [GNU GPL v3 license](LICENSE). Original SVG button artwork in `icons.js` and `summary-card.js` is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). SVGs are used only inside buttons. The existing raster extension icon is retained.
