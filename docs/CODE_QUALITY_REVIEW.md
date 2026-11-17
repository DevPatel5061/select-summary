# Code quality and maintainability review

Reviewed and acted on: 2026-11-17. The findings below describe the pre-cleanup working tree; their line references are historical. See [DEVELOPMENT.md](DEVELOPMENT.md) for the current structure and check commands.

The authorized cleanup is implemented. Existing unrelated work was preserved. Legacy migrations, direct popup-page support, original design references and concurrency/security safeguards were deliberately retained; they remain valuable, as the review explains.

## Completion status

| Findings                                                    | Result                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–4: unused XP, milestone/progress state and dashboard copy | Completed. Schema 6 migrates supported older data without removing key/history/activity/completion; live progress remains per-run.                                                                                                   |
| 5–6: dead styles and layered CSS                            | Completed. Dead popup selectors and 144 superseded declarations removed; accent tokens renamed. Browser comparison confirms identical computed appearance across seven views at five widths. Responsive/state ordering is preserved. |
| 7–8: form modes and duplicated behavior                     | Completed. Replacement-only controller and shared message/key-field helpers; screen layouts remain independent.                                                                                                                      |
| 9–11: refresh/render/metadata churn                         | Completed. Coalesced mutation snapshots, independent notices, data-specific DOM updates, no resize grid rebuild, onboarding-only metadata calls.                                                                                     |
| 12: provider nesting/exports                                | Completed. Flattened generation and private helpers; one request per action, with provider boundary tests.                                                                                                                           |
| 13–14: scene timing/motion changes                          | Completed. Timing derives from the same actions that play; only the active visible track restarts after reduced motion is disabled.                                                                                                  |
| 15: competing article metadata/navigation                   | Completed. Unused metadata removed and keyboard navigation derives from actual tab order.                                                                                                                                            |
| 16: old route/standalone mode                               | Unused `#dashboard` shortcut removed. Direct `popup.html` remains supported and tested; its UI files are live.                                                                                                                       |
| 17–18: presentation contracts/storage startup               | Completed. Brand tokens/badge aligned, kind-specific loading validation, unused attributes removed, first-read snapshot reused, legacy cleanup only when needed.                                                                     |
| 19: reproducible regression tooling                         | Completed. Independent worker fixtures, provider/storage/refresh/content tests, portable browser smoke/style checks, formatting and asset checks.                                                                                    |
| 20: artifacts/documentation                                 | Completed. Old designs preserved in `design/archive/`; machine metadata/empty runtime docs removed. README/privacy/changelog updated; release allowlist excludes tooling and artifacts.                                              |

## Verification

- Node regression tests cover history limits; current/v3/v4/v5/legacy migrations; serialized storage; worker authorization, practice gates, replay, tab isolation and popup failures; late credential changes; provider response/error/word caps; read batching; and injected card message validation.
- Browser smoke checks use isolated profiles and simulated Gemini replies for settings persistence/confirmations, key replacement, failure/retry setup, activity tooltips, shared skeleton/cards, animated dismissal, fresh practice gating, motion changes and responsive overflow.
- Computed-style comparison against a saved pre-cleanup copy checks all seven views at 320/420/800/900/1440px. The first pass caught a shorthand-variable serialization difference; the corrected whole-declaration cleanup passes with no differences.
- Final verification passed: 41 Node tests, browser smoke checks, all 35 view/viewport computed-style comparisons, source/import/manifest validation, formatting, whitespace checks and release ZIP integrity/contents checks. Live Google eligibility and actual toolbar pinning remain manual checks; no real API keys are used by tests.

## Findings

### 1. Unused XP calculation and response field — confirmed, high priority

**Location:** `chrome-extension/core.js:190–201`, `popup.js:225`.

- **Why:** `publicState()` calculates `activityStats(...).total * 50` for `xp`, but neither UI consumes XP. The popup calculates the same aggregate statistics again. Welcome snapshots also pay for the unused XP calculation.
- **Impact:** Small code/payload reduction; removes one full aggregate scan/sort per `GET_STATE`. Benefit grows with daily activity retained. No Gemini quota savings.
- **Risk:** Old open extension pages could expect the previous message shape. XP is derived, so no stored XP balance needs deleting.
- **Plan:** Remove `xp` from the public response and its calculation; reload extension pages and keep current activity totals intact.

### 2. Write-only milestone state — confirmed unused UI feature, medium priority

**Location:** `core.js:55,83,124,200`; README and PRIVACY milestone references.

- **Why:** `milestones.firstSummary` is initialized, migrated, updated and returned, but no current feature reads it. The milestone banner was removed.
- **Impact:** Small reduction in stored state and mutations; fewer concepts to maintain.
- **Risk:** Deleting saved state affects rollback to older versions that displayed milestones. It is not safe to treat persisted fields like unused local variables.
- **Plan:** Stop exposing/updating it first. Remove the stored field only in a versioned migration with legacy fixtures and a documented rollback policy; update the related documentation.

### 3. Historical onboarding progress duplicates per-run state — confirmed, medium priority

**Location:** `core.js:48–54`; `background.js:272,327–342,389–398`; `welcome.js:151–158`.

- **Why:** Persisted `onboarding.step` is written but never used to restore the displayed step; the guide always starts at Welcome. Persisted `sandboxComplete` is also no longer read to unlock the guide. The live gates are `practiceComplete` and the worker's tab-scoped welcome session. Nested `onboarding.version` has no current consumer either.
- **Impact:** Removes unnecessary writes on step navigation, corresponding storage events/snapshots, and conflicting progress representations.
- **Risk:** `onboarding.completed`, key verification, per-run worker validation and sender checks are still essential. Old migrations contain historical progress.
- **Plan:** Separate step authorization from persistence: retain worker validation, remove obsolete writes, and retire the fields through a migration. Preserve completion and test replay, denied skipping and stale results.

### 4. Unused dashboard detail strings — confirmed, low priority

**Location:** `core.js:206–230`; `popup.js:242–244`.

- **Why:** Every `dashboardMessage()` branch returns a `detail` string; its sole caller reads only `title` since overview subtitle removal.
- **Impact:** Small simplification; removes obsolete copy and unnecessary formatting.
- **Risk:** Preserve headline pluralization and activity-dependent titles.
- **Plan:** Return a headline string, rename the function accordingly, and update its single caller.

### 5. Obsolete popup UI styles — confirmed, medium priority

**Location:** `popup.css`: `.text-button`/hover, `.small`, both `kbd` blocks, `.page-heading p:last-child`, standalone `h3` declarations.

- **Why:** The current popup markup, replacement-key template and JS-generated elements do not create these controls/elements. The welcome page uses a separate stylesheet, so its keycaps do not justify popup `kbd` rules.
- **Impact:** Small CSS reduction; makes it clearer which UI still exists.
- **Risk:** Do not delete similarly named rules from `welcome.css`: its `.text-button`, `.eyebrow`, fine print and keycaps are live. Preserve `h1,h2` rules when editing grouped selectors.
- **Plan:** Remove only the confirmed popup-only selectors. Exercise empty/populated History, replacement form, notices and confirmation dialog afterward.

### 6. Accumulated stylesheet overrides — confirmed, high priority

**Location:** all of `popup.css` and `welcome.css`, especially popup's editorial block around line 615 onward and welcome's blocks around lines 1784–2180.

- **Why:** Earlier layouts and colours remain underneath successive redesign overrides. Examples include repeated `body`, header, navigation, metric, footer and scene-navigation declarations. Some earlier declarations are fully superseded; others still supply necessary properties. Repetition alone does not make every block dead.
- **Impact:** Largest maintainability gain available: fewer cascade surprises and easier visual changes. Byte savings are secondary and require a measured cleanup diff.
- **Risk:** Moving rules can change specificity, media-query precedence, coarse-pointer behavior and reduced motion. Current responsive overrides intentionally differ.
- **Plan:** Merge effective base declarations by component, then order responsive/state rules explicitly. Compare all onboarding steps and popup views before/after at 320, 420, 800, 900 and 1440px, including reduced motion. Do this separately from feature changes.

### 7. Replacement-form configurability has no second caller — confirmed, low priority

**Location:** `popup.js:263–335,410`.

- **Why:** `createKeyForm(container, replacement = false)` is called only once and always with `true`. Conditional cancel creation and replacement-only success handling maintain a mode that is unreachable today.
- **Impact:** Small reduction in branching and a clearer form lifecycle.
- **Risk:** Preserve equal-sized actions, existing-key protection, disabled state during validation and error recovery. Do not merge the onboarding layout into this form.
- **Plan:** Rename to `createReplacementKeyForm`, remove the mode argument and make Cancel/success cleanup unconditional.

### 8. Duplicate messaging and key-field behavior — confirmed, medium priority

**Location:** `popup.js:14–31,263–335`; `welcome.js:27–54,205–282`.

- **Why:** Both surfaces implement runtime-message result/error handling, visibility toggles, consent gating, busy state and field cleanup. Their error policies already differ. This increases the cost of fixing key behavior consistently.
- **Impact:** Medium maintenance reduction; little direct speed benefit.
- **Risk:** Welcome messages attach a run ID and retain error codes; key setup supports stored-key verification, whereas replacement must preserve the existing key on failure. These differences are intentional.
- **Plan:** Extract one transport helper with explicit context fields and structured errors; then share reveal/reset behavior. Keep screen-specific controllers and copy.

### 9. Full-dashboard refreshes for unrelated changes — confirmed, high priority

**Location:** `popup.js:132–194,225–260,339–367,468–476`; `background.js:304–323`.

- **Why:** Notice-only changes trigger `GET_STATE`, aggregate calculation, rebuilding all 84 heatmap cells and all history cards, and rewriting settings—even when app data did not change. A resize also rebuilds all heatmap cells although the column count is fixed at 12 and CSS handles sizing.
- **Impact:** Medium reduction in messages, local reads and DOM work; better focus/tooltip stability. No provider-call savings.
- **Risk:** Keep notice dismissal, local date rollover, responsive tooltip positioning and accessible heatmap keyboard navigation correct.
- **Plan:** Update session notices separately; compare data slices before rendering; coalesce refresh requests. Remove resize-driven grid rebuilding while retaining tooltip hiding/repositioning.

### 10. Mutation paths trigger duplicate snapshots — confirmed, medium priority

**Location:** `popup.js:339–385,429–450,468–476`; `welcome.js:255–269,380–392`.

- **Why:** Explicit refreshes overlap storage-change refreshes. Confirmed history-limit trimming additionally runs `refresh()` inside its save action and again in the generic confirmation success handler. Serial counters discard stale results only after the redundant requests have already run. Welcome connection/step updates likewise generate snapshots through storage events as well as explicit flows.
- **Impact:** Removes repeated `GET_STATE` calls, platform/shortcut lookups and rendering per user action; reduces race complexity.
- **Risk:** A refresh cannot simply be deleted everywhere: `connectingUI` deliberately suppresses some responses, and other tabs must still observe changes.
- **Plan:** Choose one mutation-refresh owner, coalesce pending reads and retain cross-document storage synchronization. Verify success, failure, cancel and switching views during connection.

### 11. GET_STATE mixes static metadata with frequently changing data — confirmed, low priority

**Location:** `background.js:304–323`; `popup.js:339–345`; `welcome.js:138–149`.

- **Why:** Every snapshot calls `getPlatformInfo()` and `commands.getAll()`. The popup no longer consumes either field; only onboarding uses shortcut/platform metadata.
- **Impact:** Two fewer browser API calls per popup snapshot if metadata is separated. These are local browser calls, not network calls.
- **Risk:** Shortcut assignments can change while the guide is open; do not cache them forever.
- **Plan:** Add a bootstrap/metadata request or request metadata explicitly from onboarding, refreshing shortcut data on visibility return. Keep ordinary state reads small.

### 12. Provider wrapper has unnecessary nesting and exports — confirmed, low priority

**Location:** `gemini.js:11,35–115,131`.

- **Why:** `generate()` defines a nested `request()` and immediately calls it once; it has no retry loop. `responseText` and `conciseText` are used internally but have no external imports, including current tests. The functions are live; only their public exports are unused.
- **Impact:** Small readability/API-surface improvement. Flattening saves no Gemini calls.
- **Risk:** Preserve abort handling, safe error categories, output caps and exactly one request per explicit action. Exports may be useful for focused provider tests.
- **Plan:** Flatten `generate`. Add response/timeout/word-cap tests, then either privatize helpers or intentionally keep their test-facing exports.

### 13. Animation progress has a separate timing source — confirmed, medium priority

**Location:** `walkthroughs.js:202–228` and each studio scene's `run` method.

- **Why:** The hard-coded `[2840,5690,8000,3440]` progress durations are maintained separately from each scene's waits, cursor moves, clicks and typing. Editing the illustration can desynchronize the progress indicator.
- **Impact:** Medium maintenance improvement; less manual timing repair.
- **Risk:** The pauseable/abortable engine is required for looping, tab visibility, resizing and reduced motion. Replacing it with ordinary chained timeouts would lose behavior.
- **Plan:** Put timing metadata beside each scene, then derive progress from a single timeline. Retain cancellation and pause/resume semantics.

### 14. Motion-preference changes lack an active-track policy — confirmed behavior, medium priority

**Location:** `walkthroughs.js:282–290,498–500`.

- **Why:** Every preference change stops all visited tracks and paints their final scene. Switching from reduced motion back to normal also takes this static path, so the visible guide does not automatically resume looping until another interaction starts it.
- **Impact:** Small controller simplification and correct response to preference changes.
- **Risk:** Restart only the active, visible track. Inactive illustrations must remain stopped; enabling reduced motion must immediately stop animation.
- **Plan:** Branch on the new preference and page visibility, show a static scene when reduced and restart/resume only the active track otherwise. Add a preference-toggle regression check.

### 15. Demo metadata and article selection have competing sources — confirmed, low priority

**Location:** `demo-articles.js:9–65`; `article-demo.js:54–90`; article markup in `welcome.html`.

- **Why:** Demo `title` and `site` fields have no runtime consumers; UI labels are hard-coded in HTML. Tab order is read from DOM, but arrow navigation still hard-codes the `hash`/`toronto` pair.
- **Impact:** Small cleanup today; prevents inconsistencies when changing/adding examples.
- **Risk:** Preserve attribution and accessible tab order. The article illustrations intentionally have different markup and should not be forced into one large component.
- **Plan:** Either render labels from metadata or remove unused metadata. Derive previous/next article from `articleOrder`, preserving Home/End and selection reset.

### 16. Old dashboard entry route and standalone support — candidate, low priority

**Location:** `welcome.js:431–434`; `popup.js:349–357,389–393`; `popup.css` window-mode rules.

- **Why:** `welcome.html#dashboard` still redirects to a standalone popup page, although no current source constructs that hash and onboarding now finishes through the toolbar popup. This is a legacy entry path, not a dead runtime file.
- **Impact:** Tiny if removing only the hash branch; larger CSS/controller simplification if standalone mode is deliberately retired.
- **Risk:** Bookmarks or previously opened tabs may use that URL. Direct `popup.html` remains a functioning view and useful testing surface.
- **Plan:** Remove only the unused hash shortcut after deciding compatibility policy. Keep standalone mode until its supported status is explicitly decided; do not delete `popup.html`, bootstrap or its template as dead code.

### 17. Presentation contracts retain old names and ignored payloads — confirmed, low priority

**Location:** `popup.css`/`welcome.css` `--blue` variables; `background.js:37`; loading payloads in `background.js:101` and `article-demo.js:146`; `content.js:15–19`; `popup.html:10`.

- **Why:** Pine colours are still named blue, the worker badge retains an old blue literal, and skeleton loading ignores the supplied “Summarizing…” text. `content.js` nevertheless requires `text` for loading. `data-page="popup"` has no consumer.
- **Impact:** Small clarity improvement; prevents inconsistent colours and stale message requirements.
- **Risk:** Removing loading text without updating validation would silently reject loading messages. Do not remove text from success/error messages.
- **Plan:** Rename tokens to brand/accent, align the badge, validate payloads by kind, remove only ignored loading strings and the unused body attribute. Keep the shared card renderer.

### 18. Storage startup repeats work, but its queue is essential — confirmed minor inefficiency

**Location:** `storage.js:7–23`.

- **Why:** First transaction reads/migrates state, then reads `appState` again. Every worker lifetime also removes legacy keys, even on an already-current installation.
- **Impact:** At most one avoidable initial read and legacy cleanup operation per worker startup; low priority relative to UI refresh churn.
- **Risk:** Migration and serialized read/modify/write behavior protect keys/history and concurrent updates. An in-memory cache can create more complexity than it removes.
- **Plan:** Reuse the initialized snapshot for that transaction and condition legacy cleanup on actual keys being present. Keep the queue; test current, v4, v3 and pre-schema fixtures.

### 19. Regression tooling is not reproducible from the repository — confirmed, high priority

**Location:** `tests/onboarding.test.mjs`, `tests/history.test.mjs`; prior browser scripts under `/private/tmp/select-summary-tools/`.

- **Why:** The committed-source tests cover important worker/history paths, but no repository-owned browser harness reproduces the settings, key-form layout, card lifecycle, activity tooltip or animation checks used during development. The worker suite groups many behaviors into one shared-state test. Provider errors, credential cancellation, serialized storage and older migrations lack dedicated coverage.
- **Impact:** High confidence/maintenance benefit; makes future aggressive deletion reviewable. This adds targeted tests rather than removing runtime code.
- **Risk:** Excess infrastructure can outweigh the needs of a small extension. Simulated Chrome APIs do not prove native toolbar behavior or live provider availability.
- **Plan:** Keep Node's built-in runner. Split worker cases into isolated fixtures; add boundary tests for migrations, credential revisions and provider failures. Check in a minimal, documented browser harness for the critical UI flows and screenshot comparisons; use fake keys/responses.

### 20. Disconnected artifacts and stale documentation — confirmed, medium priority

**Location:** `work/` (~2.4 MB), `.DS_Store` files, otherwise-empty `chrome-extension/docs/`, README/PRIVACY reward references, previous review text.

- **Why:** Mockups/screenshots have no manifest/import path and several show superseded UI. Finder metadata has no application purpose and can enter manually created release archives despite being ignored by Git. Documentation still describes XP/milestones without current UI value; the previous review mixed completed work with now-outdated deferrals.
- **Impact:** Repository/package clarity; no runtime speed improvement. Removing all `work/` would free roughly 2.4 MB locally, but it is currently untracked and is not shipped by the manifest.
- **Risk:** Screenshots are user-owned design references; archive useful examples before deletion. Privacy text describing fields still actually stored must remain accurate until schema cleanup lands.
- **Plan:** Retain a small approved preview set outside the release tree; exclude `work/`, Finder metadata and empty directories from packaging. Reconcile README/privacy after state cleanup. This report replaces the obsolete review; source behavior is unchanged.

## What should stay

- **Every runtime file is connected.** Manifest/HTML entry points, module imports, the local `interface.html` fetch and worker injection account for all runtime JS/HTML/CSS files. `content.js` is dynamically injected; a manifest-only search would incorrectly label it unused.
- **No unused third-party dependencies were found.** The runtime remains dependency-free. Pinned Playwright/Prettier tooling is now intentionally managed as development-only dependencies; no framework or build system was introduced.
- **No database or SQL queries exist.** Repeated work is in `chrome.storage` and UI snapshots. Provider validation and explicit summarization each make one Gemini request; no redundant automatic retry/repair request was found. Demo request IDs are checked before generation when their results remain in history. Do not add retries or a persistent summary cache just for cleanup.
- **Storage migrations are compatibility code, not abandoned code.** Current/v4/v3/legacy key/history readers protect existing installations. Keep them until an explicit support policy and migration fixtures justify removal. Dropping them can lose access to saved data.
- **Credential revisions/epochs, sender checks, input validation, request IDs, session gates, in-flight guards and mutation queues remain necessary.** Their complexity protects real races and authorization boundaries.
- **The shared summary renderer, shadow DOM, global injection guards, bundled illustrations, native confirmation dialog, notices and clipboard failure paths are live.** Do not duplicate the summary renderer or remove these as unused UI. Browser-frame controls in illustrations are instructional artwork, not disconnected production actions.

## Final organization

See the [repository map and maintenance guide](DEVELOPMENT.md). Runtime entry points stay flat for traceability; reusable behavior, tests, fixtures, browser checks, tooling and design references have explicit directories. Generated output is ignored and excluded by the release allowlist.
