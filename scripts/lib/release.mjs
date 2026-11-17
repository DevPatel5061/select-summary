import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const extension = new URL('../../chrome-extension/', import.meta.url);

// Explicit release boundary. New imports must be added here to pass `npm run check`.
// A file's extension alone never makes it safe to ship (e.g. credentials.json).
const runtimeFiles = [
  'manifest.json',
  'background.js',
  'core.js',
  'storage.js',
  'gemini.js',
  'popup.html',
  'bootstrap.js',
  'interface.html',
  'popup.js',
  'popup.css',
  'welcome.html',
  'welcome.js',
  'welcome.css',
  'walkthroughs.js',
  'demo-articles.js',
  'article-demo.js',
  'shortcuts.js',
  'icons.js',
  'summary-card.js',
  'summary.css',
  'content.js',
  'shared/client.js',
  'shared/key-field.js',
  'shared/refresh.js',
  'shared/timeline.js',
  'icon/onboarding.svg',
  'icon/icon.png'
];
export function releaseFiles() {
  return [...runtimeFiles].sort();
}
