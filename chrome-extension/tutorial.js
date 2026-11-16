import { SAMPLE_TEXT, SAMPLE_SUMMARY } from './core.js';
import { matchesShortcut, shortcutKeys } from './shortcuts.js';

// Practice stays local. Neither action consumes Gemini quota or creates history.
// A completed action is persisted so closing a toolbar popup doesn't reset it.
export function mountTutorial(container, state, options) {
  const { request, refresh, reportError } = options;
  container.replaceChildren(
    document.querySelector('#tutorial-template').content.cloneNode(true)
  );
  const find = (selector) => container.querySelector(selector);
  const paragraph = find('#practice-source');
  const menu = find('#practice-menu');
  const next = find('#practice-next');
  let step = Math.min(state.tutorialStep, 1);
  let completed = state.tutorialStep === 2;
  let busy = false;
  let disposed = false;
  let keys = shortcutKeys(options.shortcut, options.platform);
  const events = new AbortController();

  container.classList.remove('practice-keyboard', 'practice-interacting');
  paragraph.textContent = SAMPLE_TEXT;

  function selectedParagraph() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.toString().trim()) return false;
    const range = selection.getRangeAt(0);
    return paragraph.contains(range.commonAncestorContainer);
  }

  function renderKeys() {
    const guide = find('#shortcut-guide');
    guide.replaceChildren();
    for (const name of keys) {
      const key = document.createElement('kbd');
      key.textContent = name;
      guide.append(key);
    }
    if (!keys.length) {
      const assign = document.createElement('button');
      assign.className = 'secondary';
      assign.textContent = 'Assign a shortcut';
      assign.addEventListener('click', () =>
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
      );
      guide.append(assign);
    }
  }

  function renderStep() {
    find('#practice-context-step').dataset.complete = String(step > 0);
    find('#practice-shortcut-step').dataset.complete = String(completed && step === 1);
    find('#practice-title').textContent =
      step === 0 ? 'Practice right-click' : 'Practice the shortcut';
    find('#practice-instruction').textContent =
      step === 0
        ? 'Highlight text in the paragraph, right-click it, then choose Summarize selection.'
        : keys.length
          ? `Highlight text again, then press ${keys.join(' + ')}.`
          : 'Assign a summarization shortcut, return here, and highlight the paragraph.';
    find('#shortcut-guide').hidden = step !== 1;
    container.classList.toggle('practice-keyboard', step === 1);
    next.disabled = !completed;
    next.textContent = step === 0 ? 'Next' : 'Done';
    if (completed) {
      find('#practice-result').hidden = false;
      find('#practice-summary').textContent = SAMPLE_SUMMARY;
    }
    renderKeys();
  }

  async function complete(method) {
    if (busy || completed) return;
    if (!selectedParagraph()) {
      find('#practice-status').textContent =
        'Highlight some text in the paragraph first.';
      return;
    }
    if (method !== (step === 0 ? 'context' : 'shortcut')) return;
    busy = true;
    find('#practice-change-key').disabled = true;
    menu.hidden = true;
    container.classList.add('practice-interacting');
    try {
      await request('COMPLETE_TUTORIAL_STEP', { method });
      if (disposed) return;
      completed = true;
      find('#practice-status').textContent =
        step === 0 ? 'Right-click complete.' : 'Shortcut complete.';
      renderStep();
      find('#practice-result').classList.add('celebrate');
      next.focus({ preventScroll: true });
    } catch (error) {
      reportError(error);
    } finally {
      busy = false;
      if (!disposed) find('#practice-change-key').disabled = false;
    }
  }

  // This menu mirrors the extension's native selection command, but works
  // inside protected extension pages and across Chromium popup implementations.
  paragraph.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (step !== 0 || completed) return;
    if (!selectedParagraph()) {
      find('#practice-status').textContent =
        'Highlight some text in the paragraph first.';
      return;
    }
    container.classList.add('practice-interacting');
    menu.hidden = false;
    const area = paragraph.parentElement.getBoundingClientRect();
    menu.style.left = `${Math.max(0, Math.min(event.clientX - area.left, area.width - 185))}px`;
    menu.style.top = `${Math.max(0, Math.min(event.clientY - area.top, area.height - 45))}px`;
    find('#practice-summarize').focus({ preventScroll: true });
  });

  find('#practice-summarize').addEventListener('click', () => complete('context'));
  paragraph.addEventListener('pointerdown', () =>
    container.classList.add('practice-interacting')
  );

  // Support the context-menu key and Shift+F10 as well as pointer right-click.
  paragraph.addEventListener('keydown', (event) => {
    // Let keyboard-only users select this focused paragraph without selecting
    // the surrounding headings, controls, and privacy copy as well.
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') {
      event.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      container.classList.add('practice-interacting');
      return;
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      paragraph.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: paragraph.getBoundingClientRect().left + 16,
          clientY: paragraph.getBoundingClientRect().top + 16
        })
      );
    }
  });

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') menu.hidden = true;
      if (step === 1 && matchesShortcut(event, keys)) {
        event.preventDefault();
        void complete('shortcut');
      }
    },
    { signal: events.signal }
  );

  // Registered Chrome commands may bypass DOM keydown. Only the focused
  // walkthrough responds, so unrelated windows cannot swallow real shortcuts.
  function commandListener(message, sender, respond) {
    if (
      message?.type !== 'PRACTICE_SHORTCUT' ||
      sender.id !== chrome.runtime.id ||
      sender.tab ||
      !document.hasFocus()
    )
      return false;
    respond({ handled: true });
    if (step === 1) void complete('shortcut');
    else find('#practice-status').textContent = 'Complete the right-click step first.';
    return false;
  }
  chrome.runtime.onMessage.addListener(commandListener);

  next.addEventListener('click', async () => {
    if (!completed || busy) return;
    if (step === 0) {
      step = 1;
      completed = false;
      window.getSelection()?.removeAllRanges();
      find('#practice-result').hidden = true;
      find('#practice-status').textContent = '';
      container.classList.remove('practice-interacting');
      renderStep();
      paragraph.focus();
    } else {
      try {
        await request('FINISH_TUTORIAL');
        await refresh();
      } catch (error) {
        reportError(error);
      }
    }
  });

  find('#practice-change-key').addEventListener('click', async () => {
    try {
      await request('REMOVE_KEY');
      await refresh();
    } catch (error) {
      reportError(error);
    }
  });

  renderStep();
  return {
    updateShortcut(shortcut, platform) {
      keys = shortcutKeys(shortcut, platform);
      renderStep();
    },
    destroy() {
      disposed = true;
      events.abort();
      container.classList.remove('practice-keyboard', 'practice-interacting');
      chrome.runtime.onMessage.removeListener(commandListener);
    }
  };
}
