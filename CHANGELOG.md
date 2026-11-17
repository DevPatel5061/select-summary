# Changelog

## Unreleased — 2026-11-17

### Changed
- Onboarding uses an editorial pine-green palette, warm stone background, crisp borders, serif headings, uniform neutral keycaps and the supplied logo, preserving its grid and component structure.
- Removed the header tagline and main-heading eyebrows; simplified welcome/completion copy and made browser instructions neutral.
- Browser illustrations loop while visible, pause when hidden, and restart when revisited. Reduced-motion illustrations remain static.
- Reopening the guide starts a fresh walkthrough with empty transient form/demo state while retaining the connected key, history and activity.
- Continue, Ready and completion now require a successful practice summary in the current walkthrough; errors, previous runs and other tabs cannot unlock them.
- Updated the pinning illustration with puzzle-piece and pin controls.

### Maintenance
- Removed obsolete animation-control hooks, unused onboarding style groups, unused window-control icons and old session-only practice cleanup.
- Consolidated selection normalization and shortcut keycap rendering; removed one redundant state refresh after practice success.
- Added tab-scoped, worker-validated walkthrough sessions and serialized session writes to isolate late responses from restarted runs.
- Added Node regression coverage and a repository-wide maintainability review in `docs/CODE_QUALITY_REVIEW.md`.
- Updated README and privacy documentation. Existing popup and shared summary-card design remain unchanged.

These are working-tree changes, not a published Web Store release. The manifest remains at 3.5.0 until a release is packaged.
