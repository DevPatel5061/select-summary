# Frontend & Chrome Extension Engineering Standards (JS, HTML, CSS)

Write clean, calm, senior-level code. Prioritize human readability, low nesting, generous vertical whitespace, high speed, and rock-solid reliability.

## Senior-Level Comments

- **Explain "Why":** Never write play-by-play comments that narrate obvious code (e.g., `// Loop through items` or `// Save to storage`).
- \*\*Explain "What" sometimes: Never write play-by-play comments that narrate obvious code but explain how complicated systems work and what some functions do, the non-obvious ones.
- **Document Intent & Trade-offs:** Add brief, clear comments only when explaining _why_ a non-obvious decision, browser workaround, performance optimization, or business rule exists.
- **Self-Documenting First:** Before writing a comment to clarify confusing code, extract the logic into a well-named function or descriptive boolean variable.
- **JSDoc for Shared Utilities:** Add concise, one-line JSDoc comments (`/** ... */`) above exported functions or shared helpers to document parameters and return types.

## Speed, Scaling & Reliability

- **Batch Storage & Network Operations:** Avoid calling `chrome.storage` or `fetch` inside loops. Batch reads and writes into single calls (`chrome.storage.local.get(['key1', 'key2'])`).
- **Prevent Duplicate Work:** Debounce or throttle frequent UI events (`input`, `scroll`, `resize`). Use `AbortController` to cancel outdated or duplicate `fetch` requests (e.g., when a user triggers a new summary before the previous one finishes).
- **Efficient DOM Updates:** Minimize reflows and repaints. Build lists or repeated elements using `DocumentFragment` or batch updates instead of mutating the DOM inside loops. Cache DOM queries at the top of modules.
- **Graceful Degradation & Timeouts:** Always wrap external API calls (like Gemini requests) in `try/catch` blocks with explicit timeouts, HTTP status checks, and user-friendly fallback states so the UI never hangs silently.
- **Bounded Data Growth:** Enforce strict size or item limits on stored history and caches so `chrome.storage.local` stays fast and never hits quota limits.
- **Prevent Memory Leaks:** Clean up event listeners, timers, and observers when views close or re-render.

## General Formatting

- **Visual Breathing Room:** Leave a blank line between logical blocks, variable declarations, CSS rule sets, and major HTML sections.

## JavaScript

- **Flat Control Flow:** Use guard clauses and early returns at the top of functions to handle edge cases. Never nest `if` statements more than two levels deep.
- **Small, Focused Functions:** Keep functions under 25 lines and focused on one clear job. Extract complex `if` conditions into descriptive boolean variables (e.g., `const isEligibleForSummary = ...`).
- **Clear Naming:** Use full, descriptive camelCase names (`activeMenuButton`, `fetchSummaryHistory`). Avoid abbreviations (`btn`, `el`, `usr`, `res`) except in tiny array callbacks.
- **Modern & Predictable:** Default to `const`, use `let` only when reassignment is required, and never use `var`. Prefer `async/await` with Chrome MV3 APIs over nested callbacks or `.then()` chains.

## HTML

- **Semantic First:** Use native semantic tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`) instead of generic `<div>` soup.
- **Shallow Nesting:** Keep DOM depth as flat as possible. Avoid wrapper `<div>` elements unless strictly required for layout.
- **Clean Attributes:** Keep attribute order consistent (`class`, `id`, `src`/`href`, `type`, `data-*`, `aria-*`). Use double quotes for all attributes.
- **Accessibility:** Always include `alt` text on images, `<label>` tags for form inputs, and proper `type` attributes on `<button>` elements.

## CSS

- **Modern Layout:** Use CSS Grid and Flexbox for layout. Never use `float`, fixed pixel heights for text containers, or `!important`.
- **Design Tokens:** Store colors, spacing, and font sizes in `:root` CSS custom properties (`--color-surface`, `--space-md`) rather than hardcoding magic numbers.
- **Low Specificity:** Style using clean, single class names (e.g., `.card-header`, `.nav-link`). Avoid styling by ID (`#header`) or deep tag chains (`.nav ul li a`).
- **Consistent Property Order:** Group properties logically inside each rule:
  1. Positioning (`position`, `top`, `z-index`)
  2. Display & Box Model (`display`, `flex`, `grid`, `width`, `padding`, `margin`)
  3. Typography (`font-size`, `line-height`, `color`)
  4. Visuals (`background`, `border`, `border-radius`, `box-shadow`)
  5. Transitions & Animations

## Strict Preservation & Security Rules

- **Zero Behavior Breakage:** Optimizations must preserve existing user-facing behavior, storage key names, message action names, and API contracts.
- **UI & UX Parity:** Never change existing HTML structure, CSS class names, visual layout, animations, or user-facing copy unless explicitly asked.
- **Chrome Extension Security (MV3):**
  - Never use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `eval()` to render dynamic or AI-generated text. Always use `textContent` or safe DOM creation (`document.createElement`) to prevent XSS.
  - Never hardcode, log, or expose user API keys (such as Gemini keys) in `console.log` statements or URL query parameters. Keep keys strictly in `chrome.storage.local` and pass them via request headers.
  - Preserve all `chrome.runtime` message listener return values (`return true` for async responses).
