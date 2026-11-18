import { initializeTheme } from './shared/theme-page.js';

// The only HTML parsed here is the extension's own bundled file.
try {
  const [response] = await Promise.all([
    fetch(chrome.runtime.getURL('interface.html')),
    initializeTheme()
  ]);

  if (!response.ok) {
    throw new Error('Local interface unavailable');
  }

  const template = document.createElement('template');

  template.innerHTML = await response.text();

  document.body.replaceChildren(template.content.cloneNode(true));

  await import('./popup.js');
} catch {
  document.body.textContent =
    'Could not open Select Summary. Reload the extension and try again.';
}
