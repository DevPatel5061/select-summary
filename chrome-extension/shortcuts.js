// Chrome returns either names (Alt+Shift+S) or Mac symbols (⌥⇧S).
// Normalize both so the visual guide and the keyboard handler agree.
export function shortcutKeys(shortcut, platform) {
  if (!shortcut) return [];
  const normalized = shortcut
    .replaceAll('⌥', 'Alt+')
    .replaceAll('⇧', 'Shift+')
    .replaceAll('⌘', 'Command+')
    .replaceAll('⌃', 'Ctrl+');

  return normalized
    .split('+')
    .filter(Boolean)
    .map((key) => {
      if (key === 'Alt' && platform === 'mac') return 'Option';
      if (key === 'MacCtrl') return 'Ctrl';
      return key;
    });
}

export function matchesShortcut(event, keys) {
  if (!keys.length) return false;
  const modifiers = {
    altKey: keys.includes('Alt') || keys.includes('Option'),
    shiftKey: keys.includes('Shift'),
    ctrlKey: keys.includes('Ctrl'),
    metaKey: keys.includes('Command') || keys.includes('Meta')
  };

  if (
    Object.entries(modifiers).some(([name, pressed]) => event[name] !== pressed)
  )
    return false;
  const key = keys.at(-1).toUpperCase();
  return event.code === `Key${key}` || event.key.toUpperCase() === key;
}
