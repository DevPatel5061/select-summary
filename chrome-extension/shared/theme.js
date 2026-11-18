export const THEME_KEY = 'appearanceTheme';

/** @param {unknown} value @returns {'light' | 'dark'} */
export function normalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light';
}

/** @returns {Promise<'light' | 'dark'>} */
export async function readTheme() {
  const values = await chrome.storage.local.get(THEME_KEY);

  return normalizeTheme(values[THEME_KEY]);
}
