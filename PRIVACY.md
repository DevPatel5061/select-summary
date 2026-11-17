# Privacy and data handling

Select Summary has no analytics, advertising, telemetry, developer-run backend, or account system. The extension is free to use. It does not collect browsing history or send activity statistics to its developer.

## What leaves your browser

When you explicitly request a summary, the selected text and fixed summarization instructions are sent directly to Google's Gemini API over HTTPS. The API key authenticates that request in a header. Google also receives the network metadata associated with the request. Page URLs and titles are not included by the extension.

After you accept the Google data notice and press **Connect Gemini**, one small connection-check request is sent to Gemini. Pasting, typing, and checking consent do not initiate requests. A successful check saves the key. An explicit demo summary sends only your selected bundled practice text and displays the response inside onboarding. Successful summaries count toward local history and activity; verification and walkthroughs do not. Each action makes one request, and oversized summaries are shortened locally. Failed requests do not retry automatically.

Google controls its API processing and retention. Under its free-tier terms, inputs and responses may be used to improve products and may be reviewed by people, subject to regional and account terms. Do not submit sensitive, personal, or confidential information. Consult [Google's API terms](https://ai.google.dev/gemini-api/terms) for the terms that apply to you.

## What stays on your device

The extension stores the following in `chrome.storage.local`, restricted to trusted extension contexts:

| Data                                                                   | Purpose                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Your Gemini API key                                                    | Authenticate requests you initiate                              |
| The latest 5–20 summaries (your chosen limit) and timestamps           | Local summary history; default limit 10                         |
| Original/summary word counts                                           | Estimate reading time saved without retaining source selections |
| Daily summary counts and estimated seconds saved                       | Local activity chart, streaks, and personal bests               |
| Welcome completion, verification/revision status, and a schema version | Record completion and preserve upgrades                         |

Original selections are used transiently for API processing; they are not separately saved in history. **Summaries themselves may contain information from the original selection.** Local data is not sent to the developer or synchronized by the extension. Chrome's local storage is not an encrypted vault: someone with access to your browser profile or device may be able to access it.

Safe status messages are temporarily kept in `chrome.storage.session` to show progress or explain an error. They contain no API keys, source selections, or generated summaries. Closing a popup does not necessarily cancel an API request already in progress.

A history-limit preference is stored locally. Lowering it removes the oldest saved summaries after confirmation; aggregate activity is preserved. Increasing it does not restore removed summaries.

## Your controls

- **Clear history** removes saved summaries and their word counts. Aggregate activity remains.
- **Remove key from this device** disconnects the key while preserving history and activity.
- **Reset all local data** removes the key, history, activity, and setup progress. Requests already sent to Google cannot be recalled.
- Removing a key locally does not revoke it at Google. Revoke or rotate it in [Google AI Studio](https://aistudio.google.com/apikey).
- Uninstalling the extension removes its local extension storage through the browser.

## Costs and external links

The extension has no subscriptions, paid features, or payment integration. Gemini is a separate Google service. Use a project **without billing enabled** to avoid paid API usage; free-tier availability, quotas, and regional access vary. The extension cannot reliably determine a key's billing status, enforce Google's billing settings, or guarantee that Google will keep an API model free. It does not automatically change models or providers after a quota error. Read [Google's API pricing](https://ai.google.dev/gemini-api/docs/pricing).

Google AI Studio and documentation links open external websites with their own terms and privacy practices. Fonts and interface assets are bundled or provided by your operating system; the extension does not fetch web fonts or third-party icon assets.

## Welcome and local activity

The welcome tab opens locally on first installation, not on updates. AI Studio and pinning walkthroughs are bundled illustrations that loop while visible. Their cursors operate illustrated controls only, never your Google account or actual Chrome toolbar. Playing them does not contact Gemini or award activity. Reduced-motion mode uses static illustrations.

The embedded demo contains original practice adaptations of the supplied GeeksforGeeks hash-table article and Wikipedia Toronto article. Their source URLs are displayed for attribution, but the websites, their scripts, cookies, advertisements, and tracking are not loaded. The extension opens no separate practice windows or article tabs and imposes no tab-closing restrictions.

The demo uses native browser text selection and Chrome’s existing context-menu item. Only an explicit summarization action sends selected practice text directly to Gemini using the connected key. Responses are real provider output, not bundled samples. Successful summaries update local history, activity and streaks. Switching tabs, resetting the view, and watching animations do not call Gemini. A request already sent can complete and save its response after switching tabs or resetting.

**Open Select Summary** records completion and closes the onboarding tab and opens the extension’s toolbar popup. A successful practice summary in the current walkthrough is required. Reopening the guide resets its transient state, not your saved key, history or activity. A tab-scoped session identifier and completion flag are kept temporarily in session storage; they contain no selected text or key.
