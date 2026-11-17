import { DEMO_PAGES } from './core.js';
import { shortcutKeys, matchesShortcut } from './shortcuts.js';

// A bounded local browser view, not an iframe or remote browser. Every page,
// selection and control uses native DOM elements and the same summary request.
export function createPracticeBrowser({ onSummarize, onViewChange }) {
  const root = document.querySelector('#practice-browser');
  const viewport = root.querySelector('#browser-viewport');
  const scroll = root.querySelector('#browser-scroll');
  const menu = root.querySelector('#selection-menu');
  const keycaps = document.querySelector('#shortcut-keys');
  const $ = (selector) => root.querySelector(selector);
  let pageId = 'canada';
  let enabled = false;
  let busy = false;
  let menuSelection = '';
  let menuScrollTop = 0;
  let keys = [];
  let keySignature = '';
  let history = ['canada'];
  let historyIndex = 0;
  let noticeTimer;
  let flashTimer;
  const downCodes = new Set();

  for (const [id, page] of Object.entries(DEMO_PAGES)) {
    $(`[data-sample="${id}"]`).textContent = page.text;
  }

  function sample() {
    return $(`[data-sample="${pageId}"]`);
  }
  function selectedText() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return '';
    const range = selection.getRangeAt(0);
    if (!sample().contains(range.commonAncestorContainer)) return '';
    return selection.toString().trim();
  }
  function closeMenu({ restoreFocus = false } = {}) {
    menu.hidden = true;
    menuSelection = '';
    if (restoreFocus) sample().focus({ preventScroll: true });
  }
  function clearKeys() {
    clearTimeout(flashTimer);
    downCodes.clear();
    keycaps.querySelectorAll('kbd').forEach((cap) => cap.classList.remove('is-pressed'));
  }
  function showNotice(text) {
    clearTimeout(noticeTimer);
    $('#demo-notice').textContent = text;
    $('#demo-notice').hidden = false;
    noticeTimer = setTimeout(() => {
      $('#demo-notice').hidden = true;
    }, 3500);
  }
  function clearView() {
    closeMenu();
    window.getSelection()?.removeAllRanges();
    clearKeys();
    clearTimeout(noticeTimer);
    $('#demo-notice').hidden = true;
    scroll.scrollTop = 0;
  }
  function navigate(id, { record = true } = {}) {
    if (!Object.hasOwn(DEMO_PAGES, id) || id === pageId) return;
    clearView();
    pageId = id;
    if (record) {
      history = [...history.slice(0, historyIndex + 1), id];
      historyIndex = history.length - 1;
    }
    root.querySelectorAll('[data-demo-tab]').forEach((tab) => {
      const active = tab.dataset.demoTab === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      $(`#page-${tab.dataset.demoTab}`).hidden = !active;
    });
    $('#demo-address').value = DEMO_PAGES[id].address;
    $('#demo-back').disabled = historyIndex === 0;
    $('#demo-forward').disabled = historyIndex === history.length - 1;
    onViewChange({ pageId, reason: 'navigate' });
  }
  function reset() {
    clearView();
    onViewChange({ pageId, reason: 'reset' });
  }
  function submit(method, providedSource = '') {
    if (!enabled || busy) return;
    // Context menus capture an explicit selection; shortcuts always read the
    // current selection, so clearing text can never summarize an old passage.
    const selection = method === 'context' ? providedSource : selectedText();
    const normalized = (value) => value.replace(/\s+/g, ' ').trim();
    if (
      !selection ||
      !normalized(DEMO_PAGES[pageId].text).includes(normalized(selection))
    ) {
      showNotice('Highlight some paragraph text first.');
      return;
    }
    closeMenu();
    onSummarize({ method, selection, pageId });
  }
  function openMenu(x, y, keyboard = false) {
    const selection = selectedText();
    if (!enabled || busy || !selection) return false;
    menuSelection = selection;
    menuScrollTop = scroll.scrollTop;
    menu.hidden = false;
    const bounds = viewport.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x - bounds.left, bounds.width - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y - bounds.top, bounds.height - menu.offsetHeight - 8))}px`;
    if (keyboard) $('#menu-copy').focus({ preventScroll: true });
    return true;
  }

  // Only the three existing tabs can be selected. There are no close or new-tab
  // controls, editable addresses, external frames, or dynamic tab creation.
  root.querySelectorAll('[data-demo-tab]').forEach((tab) => {
    tab.title = DEMO_PAGES[tab.dataset.demoTab].title;
    tab.addEventListener('click', () => navigate(tab.dataset.demoTab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...root.querySelectorAll('[data-demo-tab]')];
      const index = tabs.indexOf(tab);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      navigate(tabs[next].dataset.demoTab);
      tabs[next].focus();
    });
  });
  root
    .querySelectorAll('[data-demo-go]')
    .forEach((button) =>
      button.addEventListener('click', () => navigate(button.dataset.demoGo))
    );
  root
    .querySelectorAll('[data-unavailable]')
    .forEach((button) =>
      button.addEventListener('click', () => showNotice(button.dataset.unavailable))
    );
  root.querySelectorAll('[data-demo-scroll]').forEach((button) =>
    button.addEventListener('click', () => {
      $(`#canada-${button.dataset.demoScroll}`).scrollIntoView({
        block: 'start',
        behavior: 'instant'
      });
    })
  );
  $('#demo-back').addEventListener('click', () =>
    navigate(history[--historyIndex], { record: false })
  );
  $('#demo-forward').addEventListener('click', () =>
    navigate(history[++historyIndex], { record: false })
  );
  $('#reset-practice').addEventListener('click', reset);

  root.addEventListener('contextmenu', (event) => {
    // Some browsers deliver Shift+F10's context event after focus has already
    // moved into this menu. Prevent a second, native menu from replacing it.
    if (!menu.hidden && menu.contains(event.target)) {
      event.preventDefault();
      return;
    }
    // Leave native browser menus alone outside selectable practice text.
    if (!sample().contains(event.target)) return;
    if (openMenu(event.clientX, event.clientY)) event.preventDefault();
  });
  menu.addEventListener('pointerdown', (event) => event.preventDefault());
  $('#menu-summarize').addEventListener('click', () => submit('context', menuSelection));
  $('#menu-copy').addEventListener('click', async () => {
    const text = menuSelection;
    closeMenu({ restoreFocus: true });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      showNotice('Press your system Copy shortcut to copy the selected text.');
    }
  });
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
              items.length;
      items[next].focus();
    }
    if (event.key === 'Tab') closeMenu();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.contains(event.target)) closeMenu();
  });
  scroll.addEventListener(
    'scroll',
    () => {
      // Focusing a paragraph may queue a scroll event before Shift+F10 opens
      // its menu. Only movement since opening should dismiss that menu.
      if (!menu.hidden && scroll.scrollTop !== menuScrollTop) closeMenu();
    },
    { passive: true }
  );
  window.addEventListener('resize', () => closeMenu());
  document.addEventListener('selectionchange', () => {
    if (!menu.hidden && !selectedText()) closeMenu();
  });

  function physicalCodes(key) {
    if (/^[a-z]$/i.test(key)) return [`Key${key.toUpperCase()}`];
    if (/^[0-9]$/.test(key)) return [`Digit${key}`, `Numpad${key}`];
    const names = {
      Left: 'ArrowLeft',
      Right: 'ArrowRight',
      Up: 'ArrowUp',
      Down: 'ArrowDown',
      ',': 'Comma',
      '.': 'Period'
    };
    return [names[key] || key];
  }
  function renderPressed(event) {
    const modifierPressed = {
      Alt: event.altKey,
      Option: event.altKey,
      Shift: event.shiftKey,
      Ctrl: event.ctrlKey,
      Command: event.metaKey,
      Meta: event.metaKey
    };
    keycaps.querySelectorAll('kbd').forEach((cap) => {
      const key = cap.dataset.key;
      const pressed = Object.hasOwn(modifierPressed, key)
        ? modifierPressed[key]
        : physicalCodes(key).some((code) => downCodes.has(code));
      cap.classList.toggle('is-pressed', pressed);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (!enabled) return;
    clearTimeout(flashTimer);
    downCodes.add(event.code);
    renderPressed(event);
    if (event.key === 'Escape') closeMenu({ restoreFocus: !menu.hidden });
    // Ctrl/Command+A selects only the focused practice paragraph. Inputs retain
    // their normal selection behavior, as do all real browser shortcuts.
    if (
      document.activeElement === sample() &&
      (event.ctrlKey || event.metaKey) &&
      event.code === 'KeyA'
    ) {
      event.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(sample());
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (
      (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) &&
      selectedText()
    ) {
      event.preventDefault();
      const bounds = window.getSelection().getRangeAt(0).getBoundingClientRect();
      openMenu(bounds.left + 12, bounds.top + 20, true);
    }
    if (matchesShortcut(event, keys) && !event.repeat) {
      event.preventDefault();
      submit('shortcut');
    }
  });
  document.addEventListener('keyup', (event) => {
    downCodes.delete(event.code);
    if (enabled) renderPressed(event);
  });
  window.addEventListener('focus', clearKeys);
  window.addEventListener('blur', () => {
    clearKeys();
    closeMenu();
  });

  return {
    viewport,
    get pageId() {
      return pageId;
    },
    showNotice,
    closeMenu,
    clearKeys,
    reset,
    setEnabled(value) {
      enabled = value;
      if (!value) {
        closeMenu();
        clearKeys();
        window.getSelection()?.removeAllRanges();
      }
    },
    setBusy(value) {
      busy = value;
      $('#menu-summarize').disabled = value;
    },
    setShortcut(shortcut, platform) {
      const next = shortcutKeys(shortcut, platform);
      const signature = JSON.stringify([next, platform]);
      if (signature === keySignature) return;
      clearKeys();
      keySignature = signature;
      keys = next;
      keycaps.replaceChildren();
      const symbols = { Option: '⌥', Shift: '⇧', Ctrl: '⌃', Command: '⌘' };
      for (const key of keys) {
        const cap = document.createElement('kbd');
        cap.dataset.key = key;
        cap.textContent =
          platform === 'mac' && symbols[key] ? `${symbols[key]} ${key}` : key;
        cap.setAttribute('aria-label', key);
        keycaps.append(cap);
      }
      if (!keys.length)
        keycaps.textContent = 'Assign one at chrome://extensions/shortcuts';
    },
    handleCommand(method, selection) {
      if (!enabled || busy) return;
      // Chrome may consume the key event itself. Echo an actual native command
      // with a brief press, even when no document keydown was delivered.
      if (method === 'shortcut') {
        keycaps.querySelectorAll('kbd').forEach((cap) => cap.classList.add('is-pressed'));
        clearTimeout(flashTimer);
        flashTimer = setTimeout(clearKeys, 200);
      }
      submit(method, selection);
    },
    destroy() {
      clearKeys();
      clearTimeout(noticeTimer);
    }
  };
}
