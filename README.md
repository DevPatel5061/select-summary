# Select Summary

A lightweight Chrome extension that summarizes highlighted text with Gemini. Bring your own API key, keep your history and activity locally, and get a concise 15–30 word summary.

Source version: **3.5.0**. The [Chrome Web Store listing](https://chromewebstore.google.com/detail/select-summary/cmhemijfkgdmehimocompddmibmbndfd) may contain an earlier release until a new package is published.

## Install

1. Download and extract the repository, or clone it:

   ```sh
   git clone https://github.com/DevPatel5061/select-summary.git
   ```

2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select **`chrome-extension/`**.
4. Follow the welcome guide that opens on first installation.

No build, dependency installation or development server is needed to load the extension. Chrome 127 or newer is required; other Chromium browsers may differ in toolbar and shortcut behavior. The runtime has no third-party dependencies. Optional development tools are separate.

Reloads and updates do not open another welcome tab. To revisit the guide manually, open `chrome-extension://<extension-id>/welcome.html`; the ID is shown on `chrome://extensions` in Developer mode. Each run starts fresh while preserving your connected key, saved history and activity.

## Set up

1. **Welcome:** Watch the bundled browser illustration and choose **Get started**. Illustrations make no API requests.
2. **Connect:** Choose **Get a Gemini key** to open [Google AI Studio](https://aistudio.google.com/apikey). The illustrated stages demonstrate creating a key, naming/selecting a project and copying it. Use an eligible project **without billing enabled** if you intend to use Google's free tier. Regional access, quotas and Google's terms still apply.
3. Paste the key, accept the data notice, and press **Connect Gemini**. This explicit action sends one small validation request. Failed validation keeps the existing saved key intact.
4. **Try it:** Select paragraph text in either demo article. Right-click and choose **Summarize selection**, or use the displayed shortcut. Gemini returns a real summary using your key. Continue, Ready and completion require a successful practice summary in this run, enforced in both the UI and worker.
5. **Ready:** Pin the extension through your browser toolbar if desired, then choose **Open Select Summary**. The guide opens the native toolbar popup and closes its own tab. Popup-opening failures preserve the guide with an inline message. A normal tab is created first if closing the guide would otherwise close its entire window.

Illustrations loop while visible, pause while hidden, and reset when revisited. Reduced motion uses static illustrations; returning to normal motion restarts the active visible illustration. Key-setup stage buttons also work in reduced-motion mode. Pinning is optional and the illustration cannot manipulate your actual toolbar or Google account.

The practice tabs contain original condensed adaptations of [GeeksforGeeks: Hash Table](https://www.geeksforgeeks.org/dsa/hash-table-data-structure/) and [Wikipedia: Toronto](https://en.wikipedia.org/wiki/Toronto). Their source URLs are displayed for attribution; no source websites, scripts or tracking are loaded. Only selected practice text is sent to Gemini. Switching articles, resetting the view and watching animations make no API requests. A pending summary may finish and save after the view changes; **Show summary again** restores the current article's saved result.

## Use

Select webpage text, right-click, and choose **Summarize selection**, or use the registered shortcut:

| Action              | Default       |
| ------------------- | ------------- |
| Open the extension  | `Alt+G`       |
| Summarize selection | `Alt+Shift+S` |

On Mac, Alt is **Option**. Onboarding displays the actual registered shortcut. Change assignments at `chrome://extensions/shortcuts`; older installations may retain an earlier assignment or need a conflicting shortcut reassigned.

The shared summary card appears on the page without navigating away. Loading uses a pulsing skeleton. Copy is available when complete, and cards dismiss after 25 seconds (summaries) or 10 seconds (errors), or when closed manually. Closing a loading card suppresses a late result's display; an already-sent request can still finish and save. The same renderer is used in onboarding examples and live practice.

Selections are limited to 50,000 characters. Protected browser pages, extension stores and some viewers block selection access or card injection. Empty selections do not call Gemini. If a result cannot be displayed on the page, read it in History.

## Popup and settings

Overview shows summary totals, estimated time saved, streaks, personal bests and the latest 12 calendar weeks of daily activity. Hover or focus a day for its count/date; arrow keys navigate days and Escape dismisses the tooltip. Hover lifts cells without changing their colour.

History retains the newest **5, 10, 15 or 20** summaries; the default is **10**. Change the limit in **Settings → Saved history**. Lowering it asks before discarding existing entries; increasing it cannot restore removed summaries. Daily counts and streaks survive history pruning or clearing. Time saved is estimated from the positive difference between source and summary reading time at 225 words/minute. Streaks use your local calendar.

Settings use collapsible sections for history, Gemini connection, privacy and local data. The key is masked except for its last four characters. Change API key opens an inline replacement form with balanced Cancel/Connect buttons; Disconnect remains stationary. Disconnect preserves history and activity. Reset all local data removes local data. Neither action revokes a key at Google; revoke it in AI Studio.

## Privacy and provider behavior

There is no extension account, analytics, telemetry, advertising, developer backend or synchronization. Your API key, history and aggregate activity stay on device in trusted-context local extension storage. Keys are **not encrypted by the extension**. Summaries may themselves contain sensitive information from selected text.

Each explicit summary sends selected text directly to Google with the key in an authentication header. Page URLs/titles are not sent. Connecting sends one small validation request. There are no automatic retries, paid fallbacks or provider switching. The model is centralized as `gemini-3.5-flash-lite` in `core.js`; verbose responses are shortened locally. Blocked, empty or incomplete responses are not saved.

Google controls its API data handling, regional eligibility and pricing. Free-tier content may be used for improvement/human review; billing-enabled projects can incur charges. Avoid sensitive text. Read [PRIVACY.md](PRIVACY.md), [Google API terms](https://ai.google.dev/gemini-api/terms) and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Development and organization

- `chrome-extension/`: loadable runtime, artwork and `shared/` UI behavior helpers.
- `tests/`: isolated Node regression tests, fixtures and browser checks.
- `scripts/`: source/reference validation and release packaging.
- `docs/`: [development guide](docs/DEVELOPMENT.md) and [cleanup review/status](docs/CODE_QUALITY_REVIEW.md).
- `design/archive/`: preserved historical mockups/screenshots; excluded from releases.
- `artifacts/` and `dist/`: ignored generated previews and release archives.

With Node 22+, `npm test` and `npm run check` require no dependencies. For browser/format checks, run `npm ci` and `npx playwright install chromium`, then `npm run test:browser` and `npm run format:check`. Tests use fake keys and mocked Gemini responses in isolated profiles. Run `npm run package` to validate and create an allowlisted archive in `dist/` without docs, tests, secrets or design artifacts. Nothing is uploaded or published.

The [development guide](docs/DEVELOPMENT.md) documents storage schema 6, supported migrations, refresh ownership and rollback considerations. Reload the extension and refresh existing webpages after source changes. Native pinning/toolbar behavior and a real user's provider eligibility remain manual checks.

## License

[GNU GPL v3](LICENSE). Original control SVGs in `icons.js` and `summary-card.js`, plus the original CSS skyline/hash-table artwork, are dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The existing raster extension icon is retained. See [CHANGELOG.md](CHANGELOG.md) for changes.
