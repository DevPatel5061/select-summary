# Changelog
## [v3.0.1] - 2026-11-18
### Updated
- Gemini instructions for summarizations have been updated to increase the upper limit word target and provide more detail.
- Onboarding text for the "Get Started" page has been lengthened. 
- Onboarding text for demo articles have been shortened. 

## [v3.0.0] - 2026-11-17

### Important Changes

- Shortened summaries to a 15-30-word target with a 35-word limit enforced locally without extra API requests.
- Required Chrome 127 or newer.

### Added

- Added onboarding with Gemini key validation, practice articles and optional toolbar pinning instructions.
- Added activity tracking with reading-time estimates, streaks and a 12-week activity grid with count and date tooltips.
- Added history limits of 5, 10, 15 or 20 summaries, with confirmation before discarding existing entries.
- Added skeleton loading and animated opening and closing for summary cards.

### Changed

- Changed the default summary shortcut from Ctrl/Command+Z to Alt/Option+Shift+S.
- Updated the configured model from Gemini 2.5 Flash-Lite to Gemini 3.5 Flash-Lite.
- Applied consistent colours and typography across onboarding, the popup and summary cards.
- Grouped settings into collapsible sections with key replacement and disconnection controls.
- Preserved existing API keys and saved summaries during local data migration.
- Moved API keys to request headers and restricted privileged messages and local storage access to trusted extension contexts.

### Fixed

- Prevented requests using an old key from saving results after key replacement, disconnection or reset.
- Prevented late results from reopening a dismissed loading card.
- Preserved saved summaries in History when a page blocks card display.
