import { createClient } from './shared/client.js';
import { createKeyField } from './shared/key-field.js';
import { createRefreshQueue } from './shared/refresh.js';
import { activityStats, dashboardHeadline, dayKey, shiftDay } from './core.js';
import { decorateButtons, icon } from './icons.js';

const $ = (selector) => document.querySelector(selector);
let state;
let currentView = 'home';
let currentNotice;
let connectingUI = false;
let toastTimer;
let dayTimer;
let renderedDay;

const request = createClient();
const { refresh, mutate } = createRefreshQueue(loadState);
let activitySignature;
let historySignature;

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
  $('#notice').dataset.level = 'error';
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
  hideActivityTooltip();
  currentView = ['home', 'history', 'settings'].includes(view) ? view : 'home';
  for (const id of ['home', 'history', 'settings'])
    $(`#${id}`).hidden = id !== currentView;
  document.querySelectorAll('[data-view]').forEach((button) => {
    if (button.dataset.view === currentView)
      button.setAttribute('aria-current', 'page');
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
    $('#replace-key').disabled = false;
  }
}

function timeLabel(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

let tooltipCell;
function hideActivityTooltip() {
  $('#activity-tooltip').hidden = true;
  tooltipCell?.removeAttribute('aria-describedby');
  tooltipCell = undefined;
}
function showActivityTooltip(cell, date, count) {
  hideActivityTooltip();
  tooltipCell = cell;
  const tooltip = $('#activity-tooltip');
  $('#activity-tooltip-count').textContent =
    `${count} ${count === 1 ? 'summary' : 'summaries'}`;
  $('#activity-tooltip-date').textContent = date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  cell.setAttribute('aria-describedby', 'activity-tooltip');
  tooltip.hidden = false;
  const cellBounds = cell.getBoundingClientRect();
  const bounds = tooltip.getBoundingClientRect();
  const left = Math.max(
    8,
    Math.min(
      innerWidth - bounds.width - 8,
      cellBounds.left + (cellBounds.width - bounds.width) / 2
    )
  );
  const above = cellBounds.top - bounds.height - 9;
  const top =
    above >= 8
      ? above
      : Math.min(innerHeight - bounds.height - 8, cellBounds.bottom + 9);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}
window.addEventListener('scroll', hideActivityTooltip, true);
window.addEventListener('resize', hideActivityTooltip);

function renderHeatmap() {
  if (!state) return;
  hideActivityTooltip();
  const weeks = 12;
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
    cell.tabIndex = day === today ? 0 : -1;

    if (day > today) {
      cell.dataset.future = '';
      cell.disabled = true;
    }
    const showTooltip = () => {
      if (!cell.disabled) showActivityTooltip(cell, date, count);
    };
    cell.addEventListener('pointerenter', showTooltip);
    cell.addEventListener('pointerleave', () => {
      if (document.activeElement !== cell) hideActivityTooltip();
    });
    cell.addEventListener('focus', showTooltip);
    cell.addEventListener('blur', () => {
      if (!cell.matches(':hover')) hideActivityTooltip();
    });
    cell.addEventListener('click', showTooltip);
    cell.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideActivityTooltip();
        return;
      }
      const offset = {
        ArrowRight: 7,
        ArrowLeft: -7,
        ArrowDown: 1,
        ArrowUp: -1
      }[event.key];
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
  const nextActivity = JSON.stringify(state.activity);
  if (activitySignature !== nextActivity || renderedDay !== dayKey()) {
    activitySignature = nextActivity;
    renderedDay = dayKey();
    const stats = activityStats(state.activity);
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
    $('#home-title').textContent = dashboardHeadline(stats);
    renderHeatmap();
  }
  const nextHistory = JSON.stringify(state.history);
  if (historySignature !== nextHistory) {
    historySignature = nextHistory;
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
  }
  document.querySelectorAll('#history-limit input').forEach((input) => {
    input.checked = Number(input.value) === state.historyLimit;
  });
  $('#settings-clear-history').disabled = state.history.length === 0;
  $('#key-status').textContent = `••••••••••••••••••••••••${state.keySuffix}`;
}

// Templates contain only bundled HTML. Keys and generated text are assigned
// through DOM properties, never interpolated into markup.
function createReplacementKeyForm(container) {
  container.replaceChildren($('#key-form-template').content.cloneNode(true));
  const form = container.querySelector('form');
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
  createKeyField(input, reveal);
  const cancel = element('button', 'secondary', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    container.replaceChildren();
    container.hidden = true;
    $('#replace-key').disabled = false;
    $('#replace-key').focus();
  });
  form.querySelector('.key-form-actions').prepend(cancel);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || connectingUI) return;
    await mutate(async () => {
      connectingUI = true;
      input.readOnly = true;
      consent.disabled = true;
      cancel.disabled = true;
      updateSubmit();
      status.setAttribute('role', 'status');
      status.textContent = 'Checking Gemini…';
      try {
        await request('CONNECT_KEY', {
          key: input.value.trim(),
          consent: consent.checked
        });
        input.value = '';
        container.replaceChildren();
        container.hidden = true;
        $('#replace-key').disabled = false;
        toast('AI Connected');
      } catch (error) {
        status.textContent = error.message;
        status.setAttribute('role', 'alert');
        input.focus();
      } finally {
        connectingUI = false;
        input.readOnly = false;
        consent.disabled = false;
        cancel.disabled = false;
        updateSubmit();
      }
    }).catch(showProblem);
  });
  decorateButtons(container);
  updateSubmit();
}

async function loadState() {
  const response = await request('GET_STATE');
  state = response.state;
  $('#boot').hidden = true;
  renderNotice(response.notice);

  if (!state.keyConfigured || !state.onboarding.completed) {
    if (isToolbarPopup) {
      await request('OPEN_WELCOME');
      window.close();
    } else window.location.replace(chrome.runtime.getURL('welcome.html'));
    return;
  }
  $('#navigation').hidden = false;
  renderDashboard();
  navigate(currentView, false);
}

function renderNotice(notice) {
  currentNotice = notice;
  $('#notice').hidden = !notice || notice.level === 'success';
  if (notice) {
    $('#notice').dataset.level = notice.level;
    $('#notice-title').textContent = notice.title;
    $('#notice-message').textContent = notice.message;
  }
}

let pendingConfirmation;
$('#confirm-dialog form').addEventListener('submit', (event) => {
  const action = pendingConfirmation;
  pendingConfirmation = undefined;
  if (event.submitter?.value === 'confirm' && action)
    void Promise.resolve()
      .then(() => mutate(action))
      .catch(showProblem);
});
$('#confirm-dialog').addEventListener('cancel', () => {
  pendingConfirmation = undefined;
});

function confirmAction(title, description, label, action) {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  $('#confirm-action').textContent = label;
  dialog.returnValue = '';
  pendingConfirmation = action;
  dialog.showModal();
}

const isToolbarPopup = chrome.extension
  .getViews({ type: 'popup' })
  .includes(window);
decorateButtons();
document.body.classList.toggle('window-mode', !isToolbarPopup);
document
  .querySelectorAll('[data-view]')
  .forEach((button) =>
    button.addEventListener('click', () => navigate(button.dataset.view))
  );
on('.wordmark', 'click', (event) => {
  event.preventDefault();
  if (state?.keyConfigured && state.onboarding.completed) navigate('home');
});
on('#dismiss-notice', 'click', async () => {
  $('#notice').hidden = true;
  if (currentNotice) await request('DISMISS_NOTICE', { id: currentNotice.id });
});
on('#replace-key', 'click', () => {
  $('#replace-key').disabled = true;
  $('#replacement-form').hidden = false;
  createReplacementKeyForm($('#replacement-form'));
  $('#new-key').focus();
});
function clearSavedHistory() {
  confirmAction(
    'Clear your history?',
    'Your saved summaries will be removed. Your activity, streaks, and connected key will stay.',
    'Clear history',
    () => request('CLEAR_HISTORY')
  );
}
on('#settings-clear-history', 'click', clearSavedHistory);
on('#history-limit', 'change', async (event) => {
  const limit = Number(event.target.value);
  const options = $('#history-limit');
  options.querySelectorAll('input').forEach((input) => {
    input.checked = Number(input.value) === state.historyLimit;
  });
  if (limit === state.historyLimit) return;
  const save = async () => {
    options.disabled = true;
    try {
      await request('SET_HISTORY_LIMIT', { limit });
      toast('History limit updated.');
    } finally {
      options.disabled = false;
    }
  };
  if (state.history.length > limit) {
    confirmAction(
      'Keep fewer summaries?',
      `Keep the newest ${limit} summaries and remove ${state.history.length - limit} older entries? Your activity and streaks will stay.`,
      'Update limit',
      save
    );
  } else await mutate(save);
});
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
      await request('RESET_ALL');
    }
  )
);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.notice)
    renderNotice(changes.notice.newValue);
  if (area === 'local' && changes.appState) refresh().catch(showProblem);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    document
      .querySelectorAll('input[type=text],input[type=password]')
      .forEach((input) => {
        input.type = 'password';
      });
    document
      .querySelectorAll('[aria-label="Hide entered key"]')
      .forEach((button) => {
        button.setAttribute('aria-label', 'Show entered key');
        button.setAttribute('aria-pressed', 'false');
      });
  } else refresh().catch(showProblem);
});
window.addEventListener('pagehide', () => {
  clearInterval(dayTimer);
  document
    .querySelectorAll('input[type=password],input[type=text]')
    .forEach((input) => {
      input.value = '';
    });
});
dayTimer = setInterval(() => {
  if (
    state?.keyConfigured &&
    state.onboarding.completed &&
    !document.hidden &&
    renderedDay !== dayKey()
  )
    renderDashboard();
}, 60_000);
refresh().catch((error) => {
  $('#boot').textContent = 'Could not load your local workspace.';
  showProblem(error);
});
