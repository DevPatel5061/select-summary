import { activityStats, dashboardMessage, dayKey, shiftDay } from './core.js';
import { decorateButtons, icon } from './icons.js';
import { mountTutorial } from './tutorial.js';
import { shortcutKeys } from './shortcuts.js';

const $ = (selector) => document.querySelector(selector);
let state;
let currentView = 'home';
let currentNotice;
let connectingUI = false;
let tutorial = null;
let platform = 'unknown';
let shortcut = '';
let setupRenderedStep = null;
let refreshSerial = 0;
let toastTimer;
let lastTotal;
let dayTimer;
let renderedDay;

async function request(type, fields = {}) {
  let result;
  try {
    result = await chrome.runtime.sendMessage({ type, ...fields });
  } catch {
    throw new Error(
      'The extension could not connect. Reload it from your browser’s extension settings and try again.'
    );
  }
  if (!result?.ok)
    throw new Error(
      result?.error?.message ||
        'Something did not load. Please reopen the extension and try again.'
    );
  return result;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => {
    $('#toast').hidden = true;
  }, 3500);
}

function showProblem(error) {
  $('#notice-title').textContent = 'Unable to complete action';
  $('#notice-message').textContent = error.message;
  $('#notice').hidden = false;
}

function on(selector, event, handler) {
  $(selector).addEventListener(event, async (e) => {
    try {
      await handler(e);
    } catch (error) {
      showProblem(error);
    }
  });
}

function navigate(view, focus = true) {
  currentView = ['home', 'history', 'settings'].includes(view) ? view : 'home';
  for (const id of ['home', 'history', 'settings'])
    $(`#${id}`).hidden = id !== currentView;
  $('#onboarding').hidden = true;
  document.querySelectorAll('[data-view]').forEach((button) => {
    if (button.dataset.view === currentView) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (focus) {
    const heading = $(`#${currentView} h1`);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  if (currentView !== 'settings') {
    $('#replacement-form').replaceChildren();
    $('#replacement-form').hidden = true;
    $('#replace-key').hidden = false;
  }
}

function timeLabel(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function renderHeatmap() {
  if (!state) return;
  const weeks = window.innerWidth >= 800 ? 52 : 13;
  $('#activity-range').textContent = `Last ${weeks} weeks`;
  const now = new Date();
  const today = dayKey(now);
  const sunday = shiftDay(now, -now.getDay());
  const start = shiftDay(sunday, -(weeks - 1) * 7);
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < weeks * 7; index++) {
    const date = shiftDay(start, index);
    const day = dayKey(date);
    const count = state.activity[day]?.count || 0;
    const label = `${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}: ${count} ${count === 1 ? 'summary' : 'summaries'}`;
    const cell = element('button');
    cell.dataset.level = String(Math.min(4, count));
    cell.setAttribute('aria-label', label);
    cell.title = label;
    cell.tabIndex = day === today ? 0 : -1;

    if (day > today) {
      cell.dataset.future = '';
      cell.disabled = true;
    }
    cell.addEventListener('focus', () => {
      $('#day-detail').textContent = label;
    });
    cell.addEventListener('click', () => {
      $('#day-detail').textContent = label;
    });
    cell.addEventListener('keydown', (event) => {
      const offset = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[
        event.key
      ];
      if (!offset) return;
      event.preventDefault();
      const target = $('#heatmap').children[index + offset];
      if (target && !target.disabled) {
        cell.tabIndex = -1;
        target.tabIndex = 0;
        target.focus();
      }
    });
    fragment.append(cell);
  }
  $('#heatmap').replaceChildren(fragment);
}

function renderSummary(item) {
  const card = element('article', 'summary-card');
  const meta = element('div', 'summary-meta');
  const date = item.timestamp
    ? new Date(item.timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Date unavailable';
  meta.append(
    element('span', '', date),
    element('span', '', `${item.summaryWords} words`)
  );
  const text = element('p', 'summary-text', item.text);
  const actions = element('div', 'summary-actions');
  const button = element('button', '', 'Copy');
  button.prepend(icon('copy'));
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(item.text);
      toast('Copied.');
    } catch {
      toast('Copy was blocked. Select the summary text and copy it manually.');
    }
  });
  actions.append(button);
  card.append(meta, text, actions);
  return card;
}

function renderDashboard() {
  renderedDay = dayKey();
  const stats = activityStats(state.activity);
  const keys = shortcutKeys(shortcut, platform);
  $('#settings-shortcut').textContent =
    `Open: ${platform === 'mac' ? 'Option' : 'Alt'} + G. Summarize: ${keys.length ? keys.join(' + ') : 'Unassigned'}.`;
  $('#stat-total').textContent = stats.total.toLocaleString();
  $('#stat-today').textContent = `${stats.today} today`;
  $('#stat-time').textContent = timeLabel(stats.secondsSaved);
  $('#stat-streak').replaceChildren(
    document.createTextNode(String(stats.currentStreak)),
    element('span', '', stats.currentStreak === 1 ? ' day' : ' days')
  );
  $('#stat-best-streak').textContent =
    `Best: ${stats.bestStreak} ${stats.bestStreak === 1 ? 'day' : 'days'}`;
  $('#stat-best').textContent = String(stats.bestDay);
  const message = dashboardMessage(stats);
  $('#home-title').textContent = message.title;
  $('#home-message').textContent = message.detail;
  $('#activity-message').textContent = `${stats.total} total`;
  if (
    lastTotal !== undefined &&
    stats.total > lastTotal &&
    [1, 5, 10, 25, 50, 100].includes(stats.total)
  ) {
    toast(`${stats.total} summaries`);
    $('.activity-panel').classList.remove('celebrate');
    requestAnimationFrame(() => $('.activity-panel').classList.add('celebrate'));
  }
  lastTotal = stats.total;
  renderHeatmap();
  $('#history-count').textContent = String(state.history.length);
  $('#clear-history').disabled = state.history.length === 0;
  const list = $('#summary-list');
  if (!state.history.length) {
    const empty = element('div', 'empty');
    empty.append(
      element('h2', '', 'No summaries yet.'),
      element(
        'p',
        '',
        'Highlight text on a webpage, right-click, and choose “Summarize selection.” Your summaries will appear here.'
      )
    );
    list.replaceChildren(empty);
  } else list.replaceChildren(...state.history.map(renderSummary));
  $('#latest-area').hidden = !state.history.length;
  $('#latest-summary').replaceChildren(...state.history.slice(0, 1).map(renderSummary));
  $('#key-status').textContent = `Key ending in ${state.keySuffix}`;
}

// Templates contain only bundled HTML. Keys and generated text are assigned
// through DOM properties, never interpolated into markup.
function createKeyForm(container, replacement = false) {
  container.replaceChildren($('#key-form-template').content.cloneNode(true));
  const input = container.querySelector('#new-key');
  const consent = container.querySelector('input[type=checkbox]');
  const submit = container.querySelector('button[type=submit]');
  const reveal = container.querySelector('button[type=button]');
  const status = container.querySelector('.form-status');

  function updateSubmit() {
    submit.disabled = connectingUI || !consent.checked || !input.value.trim();
  }

  input.addEventListener('input', updateSubmit);
  consent.addEventListener('change', updateSubmit);
  reveal.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    reveal.setAttribute('aria-label', visible ? 'Hide entered key' : 'Show entered key');
    reveal.setAttribute('aria-pressed', String(visible));
  });

  if (replacement) {
    const cancel = element('button', 'secondary', 'Cancel');
    cancel.addEventListener('click', () => {
      container.replaceChildren();
      container.hidden = true;
      $('#replace-key').hidden = false;
      $('#replace-key').focus();
    });
    container.append(cancel);
  }

  container.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || connectingUI) return;
    connectingUI = true;
    updateSubmit();

    try {
      // Save locally and continue immediately; no Gemini validation request.
      await request('CONNECT_KEY', { key: input.value, consent: consent.checked });
      input.value = '';
      container.replaceChildren();
      if (replacement) {
        container.hidden = true;
        $('#replace-key').hidden = false;
        toast('Key saved.');
      }
      setupRenderedStep = null;
      connectingUI = false;
      await refresh();
    } catch (error) {
      status.textContent = error.message;
      status.setAttribute('role', 'alert');
      input.focus();
    } finally {
      connectingUI = false;
      updateSubmit();
    }
  });

  decorateButtons(container);
  updateSubmit();
}

async function setupStep(step) {
  await request('SET_ONBOARDING', { step });
  state.onboardingStep = step;
  setupRenderedStep = null;
  renderOnboarding();
}

function renderOnboarding() {
  const container = $('#onboarding');
  const step = state.onboardingStep;
  container.hidden = false;
  if (setupRenderedStep === step) return;
  setupRenderedStep = step;

  const template = [
    '#setup-welcome-template',
    '#setup-instructions-template',
    '#setup-key-template'
  ][step];
  container.replaceChildren($(template).content.cloneNode(true));
  if (step === 0) {
    on('#start-setup', 'click', () => setupStep(1));
  } else if (step === 1) {
    on('#setup-back', 'click', () => setupStep(0));
    on('#have-key', 'click', () => setupStep(2));
  } else {
    createKeyForm($('#setup-key-form'));
    on('#setup-back', 'click', () => setupStep(1));
  }

  const heading = $('#setup-title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function unmountTutorial() {
  tutorial?.destroy();
  tutorial = null;
}

async function refresh() {
  const serial = ++refreshSerial;
  const response = await request('GET_STATE');
  if (serial !== refreshSerial || connectingUI) return;
  state = response.state;
  platform = response.platform;
  shortcut = response.shortcut;
  currentNotice = response.notice;
  $('#boot').hidden = true;
  $('#notice').hidden = !currentNotice || currentNotice.level === 'success';
  if (currentNotice) {
    $('#notice-title').textContent = currentNotice.title;
    $('#notice-message').textContent = currentNotice.message;
  }

  if (!state.keyConfigured || !state.tutorialComplete) {
    $('#navigation').hidden = true;
    for (const id of ['home', 'history', 'settings']) $(`#${id}`).hidden = true;
    $('#onboarding').hidden = false;

    if (!state.keyConfigured) {
      unmountTutorial();
      renderOnboarding();
    } else if (!tutorial) {
      setupRenderedStep = null;
      tutorial = mountTutorial($('#onboarding'), state, {
        request,
        refresh,
        reportError: showProblem,
        platform,
        shortcut
      });
    } else {
      tutorial.updateShortcut(shortcut, platform);
    }
  } else {
    unmountTutorial();
    setupRenderedStep = null;
    $('#navigation').hidden = false;
    renderDashboard();
    navigate(currentView, false);
  }
}

function confirmAction(title, description, label, action) {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  $('#confirm-action').textContent = label;
  dialog.returnValue = '';
  dialog.addEventListener(
    'close',
    async () => {
      if (dialog.returnValue === 'confirm') {
        try {
          await action();
          await refresh();
        } catch (error) {
          showProblem(error);
        }
      }
    },
    { once: true }
  );
  dialog.showModal();
}

decorateButtons();
document.body.classList.toggle(
  'window-mode',
  !chrome.extension.getViews({ type: 'popup' }).includes(window)
);
document
  .querySelectorAll('[data-view]')
  .forEach((button) =>
    button.addEventListener('click', () => navigate(button.dataset.view))
  );
on('.wordmark', 'click', (event) => {
  event.preventDefault();
  if (state?.keyConfigured && state.tutorialComplete) navigate('home');
});
on('#open-window', 'click', async () => {
  await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 920,
    height: 820
  });
  if (chrome.extension.getViews({ type: 'popup' }).includes(window)) window.close();
});
on('#dismiss-notice', 'click', async () => {
  $('#notice').hidden = true;
  if (currentNotice) await request('DISMISS_NOTICE', { id: currentNotice.id });
});
on('#view-history', 'click', () => navigate('history'));
on('#replace-key', 'click', () => {
  $('#replace-key').hidden = true;
  $('#replacement-form').hidden = false;
  createKeyForm($('#replacement-form'), true);
  $('#new-key').focus();
});
on('#clear-history', 'click', () =>
  confirmAction(
    'Clear your history?',
    'Your saved summaries will be removed. Your activity, streaks, and connected key will stay.',
    'Clear history',
    () => request('CLEAR_HISTORY')
  )
);
on('#remove-key', 'click', () =>
  confirmAction(
    'Disconnect this key?',
    'The key will be removed from this browser. History and activity will stay. To revoke the key itself, use Google AI Studio.',
    'Remove key',
    async () => {
      await request('REMOVE_KEY');
    }
  )
);
on('#reset-all', 'click', () =>
  confirmAction(
    'Reset local data?',
    'Your key, summaries, and activity will be permanently removed from this browser. This does not revoke your key at Google.',
    'Reset everything',
    async () => {
      lastTotal = undefined;
      await request('RESET_ALL');
    }
  )
);
on('#shortcut-settings', 'click', () =>
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
);
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'local' && changes.appState) || (area === 'session' && changes.notice))
    refresh().catch(showProblem);
});
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderHeatmap, 100);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    document
      .querySelectorAll('input[type=text],input[type=password]')
      .forEach((input) => {
        input.type = 'password';
      });
    document.querySelectorAll('[aria-label="Hide entered key"]').forEach((button) => {
      button.setAttribute('aria-label', 'Show entered key');
      button.setAttribute('aria-pressed', 'false');
    });
  } else refresh().catch(showProblem);
});
window.addEventListener('pagehide', () => {
  clearInterval(dayTimer);
  document.querySelectorAll('input[type=password],input[type=text]').forEach((input) => {
    input.value = '';
  });
});
dayTimer = setInterval(() => {
  if (
    state?.keyConfigured &&
    state.tutorialComplete &&
    !document.hidden &&
    renderedDay !== dayKey()
  )
    renderDashboard();
}, 60_000);
refresh().catch((error) => {
  $('#boot').textContent = 'Could not load your local workspace.';
  showProblem(error);
});
