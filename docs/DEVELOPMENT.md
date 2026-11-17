# Development and repository map

## Runtime

Load `chrome-extension/` unpacked. Runtime files are native browser modules or injected scripts; no bundler, server or production dependency installation is required.

| Area               | Files                                                                   | Ownership                                                                  |
| ------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Worker             | `background.js`, `storage.js`, `core.js`, `gemini.js`                   | Message authorization, provider requests, state and serialized persistence |
| Dashboard          | `popup.html`, `bootstrap.js`, `interface.html`, `popup.js`, `popup.css` | Toolbar UI and the supported direct popup-page view                        |
| Onboarding         | `welcome.html`, `welcome.css`, `welcome.js`, `walkthroughs.js`          | Per-run flow, illustrations and native keyboard/context actions            |
| Practice           | `demo-articles.js`, `article-demo.js`                                   | Bundled practice selections and article navigation                         |
| Summary            | `summary-card.js`, `summary.css`, `content.js`                          | One renderer for webpages, practice and introduction                       |
| Shared UI behavior | `shared/client.js`, `key-field.js`, `refresh.js`, `timeline.js`         | Typed errors, field visibility, read batching and action-derived timing    |
| Local artwork      | `icon/`, `icons.js`                                                     | Extension logo and control SVGs                                            |

Keep browser entry-point files at the extension root so manifest/HTML references and injection remain easy to trace. The summary renderer intentionally supports both classic script injection and side-effect module loading. It cannot be converted into an ordinary imported UI module without changing injection.

## Checks

Use Node 22 or newer:

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run format:check
npm run package
```

`npm test` and `npm run check` need no installed dependencies. Playwright and Prettier are pinned **development-only** tools. Browser tests use a temporary isolated profile, fake API keys and simulated Gemini output. They never read the user's browser profile. Screenshots go to ignored `artifacts/`; profiles are deleted afterward.

The optional CSS regression check compares every computed style on the same DOM against a pre-change copy, across all seven views and five widths:

```sh
BASELINE_EXTENSION=/path/to/before/chrome-extension node tests/browser/styles.mjs
```

Run it after CSS consolidation. Tests cover the current UI; native toolbar placement/pinning and a live user's Gemini eligibility remain manual checks. Live-key validation is not part of automated testing.

## Storage and compatibility

Schema **6** retains the key, key verification/revision, chosen history limit, saved summaries, daily activity and onboarding completion. Upgrades from schemas 3, 4, 5 and pre-schema storage are supported. Unused XP response data, milestone records and historical step/sandbox fields are retired. Per-walkthrough authorization remains tab-scoped in session storage and cannot be replaced by saved completion.

The worker is the only writer. Preserve the storage queue, credential revisions/epoch, sender and selection checks, in-flight guards and run IDs when refactoring. All successful summaries are persisted before display; dismissing a loading card suppresses display of a late response without pretending the already-sent request was cancelled.

Older source revisions do not understand schema 6. To inspect/revert older code, use a separate browser profile or restore a profile backup rather than loading an old revision over upgraded data. Unknown future schema versions are rejected without overwriting data.

## Refresh ownership

UI controllers use `shared/refresh.js` to batch storage events and explicit mutations. A mutation holds reads until it settles, then resolves waiting refreshes after a final snapshot. Dashboard notices update independently; activity/history DOM is rebuilt only when its data or local day changes. Shortcut/platform metadata is requested only by onboarding, initially and when returning to the page.

## Release packaging and references

`npm run package` validates the extension, stages an allowlisted set of runtime sources/assets, and writes `dist/select-summary-<version>.zip`. It needs the system `zip` command. It excludes repository docs/tests, developer tooling, screenshots, secrets, Finder metadata and `node_modules`. No publishing or upload occurs.

Historical design work is preserved under `design/archive/`. Generated output belongs in ignored `artifacts/` or `dist/`. Do not put screenshots, empty documentation directories or machine metadata inside the extension runtime.
