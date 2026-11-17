# Changelog

## Unreleased — 2026-11-17

### Changed

- Balanced replacement-key Connect/Cancel actions, kept connection buttons stationary while editing, lengthened the masked-key display, and removed spaces after disclaimer asterisks.
- Tightened History and Settings spacing, removed redundant history labels/actions and the keyboard/welcome section, replaced the history dropdown with compact limit choices, grouped masked-key connection actions, marked notes with asterisks, and enlarged shared summary-card branding.
- Replaced Settings panels with readable disclosure sections and styled actions.
- Added persisted 5/10/15/20 history limits, defaulting to 10, with version-4 migration and confirmation before trimming saved history. Counts and streaks are preserved.
- Fixed activity to 12 weeks at every width and preserved each cell’s fill on hover.
- Unified all summary cards and onboarding examples with the editorial palette and shared renderer, added pulsing skeleton loading and smooth closing, and removed the native Close tooltip.
- Restyled popup navigation, headings, logo and actions to match the onboarding’s pine-green editorial theme.
- Replaced gradient stats with four flat, muted colour treatments.
- Removed overview status/XP banners, quick-start instructions, latest summary, history-count badge and separate-window action; History and Settings remain accessible.
- Replaced bottom-left activity details with viewport-clamped count/date tooltips supporting hover, focus and Escape.
- Positioned the logo/progress header directly above the centered onboarding card.
- Completion closes the guide after opening the toolbar popup against another active tab; the last-tab case keeps the browser window alive, and popup failures preserve the guide.
- Unified the masthead across onboarding: logo left, setup steps right, aligned in one row.
- Updated the footer to “Your API key and history stay on device.”
- Completion opens the real toolbar popup without navigating to a dashboard page; unsupported popup opening shows an inline instruction.
- Balanced the welcome hero within a 1040px frame, aligned its masthead, centered the card/privacy-note group, and standardized internal padding and caption spacing.
- Removed the welcome key helper and benefit checklist.
- Applied the editorial theme to summary cards on webpages, in practice and in the welcome illustration.
- Onboarding uses an editorial pine-green palette, warm stone background, crisp borders, serif headings, uniform neutral keycaps and the supplied logo, preserving its grid and component structure.
- Removed the header tagline and main-heading eyebrows; simplified welcome/completion copy and made browser instructions neutral.
- Browser illustrations loop while visible, pause when hidden, and restart when revisited. Reduced-motion illustrations remain static.
- Reopening the guide starts a fresh walkthrough with empty transient form/demo state while retaining the connected key, history and activity.
- Continue, Ready and completion now require a successful practice summary in the current walkthrough; errors, previous runs and other tabs cannot unlock them.
- Updated the pinning illustration with puzzle-piece and pin controls.

### Maintenance

- Implemented the code-quality review: schema 6 retires write-only milestones and historical onboarding progress while preserving keys, history, chosen limits, daily activity and completion; v3/v4/v5/pre-schema migrations remain supported.
- Removed unused XP/detail payloads, obsolete popup styles/metadata/loading text, replacement-form modes and the unused dashboard hash route. Direct popup-page support remains intentional.
- Added shared runtime messaging, key-field behavior, coalesced state refreshes and action-derived illustration timelines. Notices no longer rebuild the dashboard; shortcut metadata is fetched only by onboarding.
- Consolidated superseded CSS declarations without computed-style changes across seven views and five widths; renamed accent tokens and aligned the worker badge colour.
- Added isolated worker/provider/storage/refresh regression tests, repository-owned browser checks, source/asset validation, pinned development tools and an allowlisted release packager.
- Organized shared behavior under `chrome-extension/shared/`, test fixtures/browser checks under `tests/`, release tools under `scripts/`, development docs under `docs/`, and preserved earlier mockups/screenshots under `design/archive/`.
- Removed obsolete animation-control hooks, unused onboarding style groups, unused window-control icons and old session-only practice cleanup.
- Consolidated selection normalization and shortcut keycap rendering; removed one redundant state refresh after practice success.
- Added tab-scoped, worker-validated walkthrough sessions and serialized session writes to isolate late responses from restarted runs.
- Added Node regression coverage and a repository-wide maintainability review in `docs/CODE_QUALITY_REVIEW.md`.
- Updated README and privacy documentation. The popup and shared summary cards use the editorial theme.

These are working-tree changes, not a published Web Store release. The manifest remains at 3.5.0 until a release is packaged.
