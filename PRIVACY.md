# Privacy and data handling

Select Summary has no analytics, advertising, telemetry, developer-run backend, or account system. The extension is free to use. It does not collect browsing history or send activity statistics to its developer.

## What leaves your browser

When you explicitly request a summary, the selected text and fixed summarization instructions are sent directly to Google's Gemini API over HTTPS. The API key authenticates that request in a header. Google also receives the network metadata associated with the request. Page URLs and titles are not included by the extension.

The **Test and connect** action sends a bundled, synthetic paragraph about urban gardens. It does not read your active page. A request may make one additional call if the first response exceeds the summary length limit. Failed requests are not automatically retried.

Google controls its API processing and retention. Under its free-tier terms, inputs and responses may be used to improve products and may be reviewed by people, subject to regional and account terms. Do not submit sensitive, personal, or confidential information. Consult [Google's API terms](https://ai.google.dev/gemini-api/terms) for the terms that apply to you.

## What stays on your device

The extension stores the following in `chrome.storage.local`, restricted to trusted extension contexts:

| Data | Purpose |
| --- | --- |
| Your Gemini API key | Authenticate requests you initiate |
| The latest 10 summaries and available timestamps | Local summary history |
| Original/summary word counts | Estimate reading time saved without retaining source selections |
| Daily summary counts and estimated seconds saved | Local activity chart, streaks, and personal bests |
| Setup progress and a schema version | Resume onboarding and preserve data across upgrades |

Original selections are used transiently for API processing; they are not separately saved in history. **Summaries themselves may contain information from the original selection.** Local data is not sent to the developer or synchronized by the extension. Chrome's local storage is not an encrypted vault: someone with access to your browser profile or device may be able to access it.

Safe status messages are temporarily kept in `chrome.storage.session` to show progress or explain an error. They contain no API keys, source selections, or generated summaries. Closing a popup does not necessarily cancel an API request already in progress.

## Your controls

- **Clear history** removes saved summaries and their word counts. Aggregate activity remains.
- **Remove key from this device** disconnects the key while preserving history and activity.
- **Reset all local data** removes the key, history, activity, and setup progress. Requests already sent to Google cannot be recalled.
- Removing a key locally does not revoke it at Google. Revoke or rotate it in [Google AI Studio](https://aistudio.google.com/apikey).
- Uninstalling the extension removes its local extension storage through the browser.

## Costs and external links

The extension has no subscriptions, paid features, or payment integration. Gemini is a separate Google service. Use a project **without billing enabled** to avoid paid API usage; free-tier availability, quotas, and regional access vary. The extension cannot reliably determine a key's billing status, enforce Google's billing settings, or guarantee that Google will keep an API model free. It does not automatically change models or providers after a quota error. Read [Google's API pricing](https://ai.google.dev/gemini-api/docs/pricing).

Google AI Studio and documentation links open external websites with their own terms and privacy practices. Fonts and interface assets are bundled or provided by your operating system; the extension does not fetch web fonts or third-party icon assets.

## Internal development testing

Tests use synthetic text, synthetic credentials, and mocked Gemini responses. Browser tests use a disposable Chromium profile and a localhost fixture. They do not use a real API key, incur Gemini charges, or upload user data. Test diagnostics are development artifacts and are not product features.
