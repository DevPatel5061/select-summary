import { SAMPLE_TEXT, activityStats } from './core.js';
import { matchesShortcut, shortcutKeys } from './shortcuts.js';

// All practice results render here. The worker never injects a page card into
// an extension document, and menu focus cannot discard the selected source.
export function mountTutorial(container, state, options) {
  const { request, refresh, reportError, tabId, isToolbarPopup } = options;
  container.replaceChildren(
    document.querySelector('#tutorial-template').content.cloneNode(true)
  );
  const find = (selector) => container.querySelector(selector);
  const paragraph = find('#practice-source');
  const menu = find('#practice-menu');
  const next = find('#practice-next');
  const events = new AbortController();
  let step = Math.min(state.tutorialStep ?? 0, 1);
  let completed = false;
  let pinning = state.tutorialStep === 2;
  let busy = false;
  let disposed = false;
  let savedSelection = '';
  let keys = shortcutKeys(options.shortcut, options.platform);

  container.classList.remove('practice-keyboard', 'practice-interacting');
  paragraph.textContent = SAMPLE_TEXT;

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.toString().trim()) return '';
    if (!paragraph.contains(selection.getRangeAt(0).commonAncestorContainer)) return '';
    savedSelection = selection.toString().trim();
    return savedSelection;
  }

  function renderKeys() {
    const guide = find('#shortcut-guide');
    guide.replaceChildren();
    const symbols = { Option: '⌥', Shift: '⇧', Command: '⌘', Ctrl: '⌃' };
    for (const name of keys) {
      const key = document.createElement('kbd');
      key.setAttribute('aria-label', name);
      key.textContent =
        options.platform === 'mac' && symbols[name] ? `${symbols[name]} ${name}` : name;
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

  function showPayoff(stats, wordsSaved) {
    const payoff = find('#practice-payoff');
    payoff.replaceChildren();
    const labels = [
      `${stats.total} ${stats.total === 1 ? 'Summary' : 'Summaries'}`,
      `${wordsSaved} words saved`,
      `${stats.total * 50} XP`,
      `Level ${Math.floor(stats.total / 10) + 1} Reader`
    ];
    labels.forEach((label) => {
      const metric = document.createElement('span');
      metric.textContent = label;
      payoff.append(metric);
    });
    payoff.hidden = false;
    payoff.classList.remove('celebrate');
    requestAnimationFrame(() => payoff.classList.add('celebrate'));
  }

  function renderStep() {
    find('#practice-context-step').dataset.complete = String(
      step > 0 || completed || pinning
    );
    find('#practice-shortcut-step').dataset.complete = String(
      (step === 1 && completed) || pinning
    );
    find('#practice-title').textContent =
      step === 0 ? 'First: right-click' : 'Next: your shortcut';
    find('#practice-instruction').textContent =
      step === 0
        ? 'Highlight the paragraph, right-click, and choose Summarize selection to earn 50 XP.'
        : keys.length
          ? 'Highlight text again, then press these keys together.'
          : 'Assign a shortcut, return here, and highlight the paragraph.';
    find('#shortcut-guide').hidden = step !== 1;
    container.classList.toggle('practice-keyboard', step === 1);
    next.disabled = !completed || busy;
    next.textContent = 'Next';
    renderKeys();
    if (pinning) showPinGuide();
  }

  function showPinGuide() {
    pinning = true;
    for (const selector of [
      '#practice-title',
      '#practice-instruction',
      '.practice-area',
      '#shortcut-guide',
      '#practice-status',
      '#practice-result',
      '.setup-actions'
    ])
      find(selector).hidden = true;
    find('#pin-guide').hidden = false;
    find('#practice-context-step').dataset.complete = 'true';
    find('#practice-shortcut-step').dataset.complete = 'true';
    if (state.activity && find('#practice-payoff').hidden) {
      const stats = activityStats(state.activity);
      showPayoff(stats, Math.round((stats.secondsSaved * 225) / 60));
    }
  }

  async function complete(method, selectedSource) {
    if (disposed || pinning || busy || completed) return;
    if (method !== (step === 0 ? 'context' : 'shortcut')) {
      find('#practice-status').textContent = 'Complete the right-click step first.';
      return;
    }
    // Snapshot before focusing the menu or button. Browsers can collapse the
    // visible DOM selection when those controls receive focus.
    const source = selectedSource || captureSelection() || savedSelection;
    if (!source) {
      find('#practice-status').textContent = 'Highlight text in the paragraph first.';
      return;
    }
    busy = true;
    next.disabled = true;
    find('#practice-change-key').disabled = true;
    menu.hidden = true;
    container.classList.add('practice-interacting');
    find('#practice-status').textContent = 'Summarizing…';
    try {
      const result = await request('COMPLETE_TUTORIAL_STEP', {
        method,
        selection: source
      });
      if (disposed) return;
      completed = true;
      find('#practice-summary').textContent = result.summary;
      find('#practice-result').hidden = false;
      find('#practice-status').textContent =
        step === 0 ? 'Right-click complete.' : 'Shortcut complete.';
      showPayoff(result.stats, result.wordsSaved);
      next.disabled = false;
      next.focus({ preventScroll: true });
    } catch (error) {
      if (!disposed) find('#practice-status').textContent = error.message;
    } finally {
      busy = false;
      if (!disposed) {
        next.disabled = !completed;
        find('#practice-change-key').disabled = false;
      }
    }
  }

  document.addEventListener('selectionchange', captureSelection, {
    signal: events.signal
  });
  paragraph.addEventListener('pointerdown', (event) => {
    container.classList.add('practice-interacting');
    if (event.button === 0) savedSelection = '';
    else captureSelection();
  });
  paragraph.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (step !== 0 || completed || busy) return;
    const selected = captureSelection() || savedSelection;
    if (!selected) {
      find('#practice-status').textContent = 'Highlight text in the paragraph first.';
      return;
    }
    savedSelection = selected;
    container.classList.add('practice-interacting');
    menu.hidden = false;
    const area = paragraph.parentElement.getBoundingClientRect();
    menu.style.left = `${Math.max(0, Math.min(event.clientX - area.left, area.width - 190))}px`;
    menu.style.top = `${Math.max(0, Math.min(event.clientY - area.top, area.height - 45))}px`;
    find('#practice-summarize').focus({ preventScroll: true });
  });
  // Preserve selection while the user presses the custom menu item.
  menu.addEventListener('mousedown', (event) => event.preventDefault());
  find('#practice-summarize').addEventListener('click', () =>
    complete('context', savedSelection)
  );

  paragraph.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') {
      event.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      captureSelection();
      container.classList.add('practice-interacting');
    } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      const rectangle = paragraph.getBoundingClientRect();
      paragraph.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: rectangle.left + 16,
          clientY: rectangle.top + 16
        })
      );
    }
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') menu.hidden = true;
      if (!pinning && matchesShortcut(event, keys)) {
        event.preventDefault();
        void complete('shortcut');
      }
    },
    { signal: events.signal }
  );

  function commandListener(message, sender, respond) {
    if (
      !['PRACTICE_SHORTCUT', 'PRACTICE_CONTEXT'].includes(message?.type) ||
      sender.id !== chrome.runtime.id ||
      sender.tab
    )
      return false;
    const targetsThisPage = Number.isInteger(message.targetTabId)
      ? message.targetTabId === tabId
      : message.targetPopup === true && isToolbarPopup;
    if (!targetsThisPage) return false;
    respond({ handled: true });
    void complete(
      message.type === 'PRACTICE_CONTEXT' ? 'context' : 'shortcut',
      message.selection
    );
    return false;
  }
  chrome.runtime.onMessage.addListener(commandListener);

  next.addEventListener('click', () => {
    if (!completed || busy) return;
    if (step === 0) {
      step = 1;
      completed = false;
      savedSelection = '';
      window.getSelection()?.removeAllRanges();
      find('#practice-result').hidden = true;
      find('#practice-status').textContent = '';
      container.classList.remove('practice-interacting');
      renderStep();
      paragraph.focus();
    } else showPinGuide();
  });
  find('#finish-welcome').addEventListener('click', async () => {
    try {
      await request('FINISH_TUTORIAL');
      await refresh();
    } catch (error) {
      reportError(error);
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
      options.platform = platform;
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
