# Privacy and data handling

Select Summary has no analytics, advertising, telemetry, developer-run backend, or account system. The extension is free to use. It does not collect browsing history or send activity statistics to its developer.

## What leaves your browser

When you explicitly request a summary, the selected text and fixed summarization instructions are sent directly to Google's Gemini API over HTTPS. The API key authenticates that request in a header. Google also receives the network metadata associated with the request. Page URLs and titles are not included by the extension.

After you accept the Google data notice and press **Verify & Continue**, one small connection-check request is sent to Gemini. Pasting, typing, and checking consent do not initiate requests. A successful check saves the key. An explicit sandbox summary sends the portion of the bundled article you select and displays the real response inside the welcome page. Successful summaries count toward local history, activity, and XP; validation and demo browser controls do not. Each action makes one request, and oversized summaries are shortened locally. Failed requests do not retry automatically.

Google controls its API processing and retention. Under its free-tier terms, inputs and responses may be used to improve products and may be reviewed by people, subject to regional and account terms. Do not submit sensitive, personal, or confidential information. Consult [Google's API terms](https://ai.google.dev/gemini-api/terms) for the terms that apply to you.

## What stays on your device

The extension stores the following in `chrome.storage.local`, restricted to trusted extension contexts:

| Data                                                                   | Purpose                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Your Gemini API key                                                    | Authenticate requests you initiate                              |
| The latest 10 summaries and available timestamps                       | Local summary history                                           |
| Original/summary word counts                                           | Estimate reading time saved without retaining source selections |
| Daily summary counts and estimated seconds saved                       | Local activity chart, streaks, and personal bests               |
| Three-step welcome progress, verification status, and a schema version | Resume setup and preserve upgrades                              |
| First Summary milestone                                                | Remember the first successful summary after history is cleared  |

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

## Welcome and rewards

The welcome tab opens locally on first installation, not on updates. Its Chrome-style demo has three fixed pages built from bundled HTML and original practice prose. The Wikipedia and Web Store representations do not load those sites or access your accounts or external page contents. Canada facts were checked against Wikipedia; no Wikipedia text or images are bundled. The address display is read-only and the demo cannot create tabs or install extensions.

XP is derived from local summary counts; XP and milestones are never transmitted. Switching demo tabs, opening help, using unavailable controls, and resetting practice do not contact Google or award activity. Explicitly summarizing a selected paragraph makes a Gemini request and counts as another summary. A request already sent continues if you change demo tabs or reset the view; its result is saved to local history.

Finishing the welcome guide closes its tab or shows a new tab page; it never opens a third-party sample site. The pin reminder is a bundled illustration. Browser-wide keyboard commands remain under the real browser's control.
