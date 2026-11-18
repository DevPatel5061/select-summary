import { icon } from '../icons.js';
import { normalizeTheme, readTheme, THEME_KEY } from './theme.js';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let currentTheme = 'light';
let transition;
let toggleButton;
let saving = false;

function renderTheme(theme) {
  root.dataset.theme = theme;
  toggleButton?.setAttribute('aria-checked', String(theme === 'dark'));
}

function animateTheme(button) {
  const { left, top, width, height } = button.getBoundingClientRect();

  root.style.setProperty('--theme-origin-x', `${left + width / 2}px`);
  root.style.setProperty('--theme-origin-y', `${top + height / 2}px`);

  transition = document.startViewTransition(() => {
    renderTheme(currentTheme);
  });
}

function applyTheme(theme, button) {
  if (currentTheme === theme) return;

  currentTheme = theme;
  transition?.skipTransition();

  if (button && !reducedMotion.matches && document.startViewTransition) {
    animateTheme(button);

    return;
  }

  renderTheme(theme);
}

/** @returns {Promise<void>} */
export async function initializeTheme() {
  let receivedChange = false;

  chrome.storage.local.onChanged.addListener((changes) => {
    if (!changes[THEME_KEY]) return;

    const theme = normalizeTheme(changes[THEME_KEY].newValue);

    receivedChange = true;
    applyTheme(theme, saving ? toggleButton : undefined);
  });

  try {
    const theme = await readTheme();

    if (!receivedChange) applyTheme(theme);
  } catch {
    // Keep the page usable with its default palette if storage is unavailable.
  }
}

async function saveTheme(button, onError) {
  if (saving) return;

  const theme = currentTheme === 'dark' ? 'light' : 'dark';

  saving = true;

  try {
    await chrome.storage.local.set({ [THEME_KEY]: theme });
    applyTheme(theme, button);
  } catch {
    onError(new Error('Could not save the appearance setting. Try again.'));
  } finally {
    saving = false;
  }
}

/** @param {HTMLButtonElement} button @param {(error: Error) => void} onError @returns {void} */
export function bindThemeToggle(button, onError) {
  const sun = icon('sun');
  const moon = icon('moon');

  toggleButton = button;

  sun.classList.add('theme-sun');
  moon.classList.add('theme-moon');
  button.append(sun, moon);
  button.setAttribute('aria-checked', String(currentTheme === 'dark'));
  button.disabled = false;
  button.addEventListener('click', () => saveTheme(button, onError));
}
