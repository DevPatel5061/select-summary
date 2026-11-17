import { decorateButtons } from './icons.js';
import { createPracticeBrowser } from './practice-browser.js';
import './summary-card.js';

// The welcome page owns setup and progression; the local browser owns selection,
// tab navigation and keyboard feedback. Credentials remain in the worker.
const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const currentTab = await chrome.tabs.getCurrent();
let state;
let step = 1;
let verifying = false;
let summarizing = false;
let changingKey = false;
let liveCard;
let viewRevision = 0;
let snapshotSerial = 0;
let confettiTimer;
const summaries = new Map();
const practice = createPracticeBrowser({
  onSummarize: runSummary,
  onViewChange: changeView
});

async function request(type, fields = {}) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type, ...fields });
  } catch {
    throw new Error('The extension disconnected. Reload this page and try again.');
  }
  if (!response?.ok)
    throw new Error(
      response?.error?.message || 'Could not complete that action. Try again.'
    );
  return response;
}
function pageError(error) {
  $('#page-error').textContent = error.message;
  $('#page-error').hidden = false;
}
function message(node, text, error = false) {
  node.textContent = text;
  node.dataset.error = String(error);
  node.setAttribute('role', error ? 'alert' : 'status');
}
function updateConnect() {
  const connected = state?.keyValidated && !changingKey;
  $('#connect-title').textContent = connected
    ? 'Gemini connected.'
    : 'Add your Gemini key.';
  $('#verified-key').hidden = !connected;
  $('#key-form').hidden = connected;
  $('#continue-connect').hidden = !connected;
  $('#cancel-key').hidden = !changingKey || !state?.keyValidated;
  $('#cancel-key').disabled = verifying;
  $('#saved-key-label').textContent = `Key ending in ${state?.keySuffix || ''}`;
  const useStored = Boolean(state?.keyConfigured && !changingKey);
  $('#stored-key-hint').hidden = !useStored;
  $('#stored-key-hint').textContent = useStored
    ? `Saved key ending in ${state.keySuffix}. Leave blank to verify it.`
    : '';
  $('#verify-key').disabled =
    verifying ||
    !$('#google-consent').checked ||
    (!$('#api-key').value.trim() && !useStored);
  $('#verify-key').textContent = verifying ? 'Verifying…' : 'Verify & Continue';
}
async function snapshot() {
  const serial = ++snapshotSerial;
  const result = await request('GET_STATE');
  if (serial !== snapshotSerial) return;
  state = result.state;
  practice.setShortcut(result.shortcut, result.platform);
  if (!verifying) updateConnect();
  $('#continue-sandbox').disabled = !state.onboarding.sandboxComplete || summarizing;
}
function closeCard() {
  viewRevision++;
  liveCard?.destroy();
  liveCard = null;
}
function changeView({ pageId, reason }) {
  closeCard();
  if (reason === 'reset') summaries.delete(pageId);
  $('#show-summary').hidden = !summaries.has(pageId);
  message($('#sandbox-status'), '');
}
function showCard(payload) {
  if (!liveCard?.host.isConnected) {
    liveCard = globalThis.SelectSummaryCard.create({
      container: practice.viewport,
      placement: 'embedded',
      onClose() {
        $('#show-summary').hidden = !summaries.has(practice.pageId);
      }
    });
  }
  liveCard.update(payload);
  $('#show-summary').hidden = true;
}
async function showStep(next, { persist = true, focus = true } = {}) {
  if (!state) return;
  if (next >= 2 && !state.keyValidated) next = 1;
  if (next === 3 && !state.onboarding.sandboxComplete) next = 2;
  if (persist) {
    await request('SET_WELCOME_STEP', { step: next });
    state.onboarding.step = next;
  }
  closeCard();
  step = next;
  practice.setEnabled(step === 2);
  $('#page-error').hidden = true;
  $('#step-label').textContent = `Step ${step} of 3`;
  ['connect', 'sandbox', 'pin'].forEach((name, index) => {
    $(`#${name}-step`).hidden = index + 1 !== step;
  });
  document.querySelectorAll('.step-tab').forEach((button) => {
    const number = Number(button.dataset.step);
    button.disabled =
      number === 2
        ? !state.keyValidated
        : number === 3
          ? !state.onboarding.sandboxComplete
          : false;
    button.dataset.complete = String(number < step);
    if (number === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  if (step === 1) updateConnect();
  if (step === 2) {
    $('#continue-sandbox').disabled = !state.onboarding.sandboxComplete || summarizing;
    if (summaries.has(practice.pageId))
      showCard({ kind: 'summary', text: summaries.get(practice.pageId) });
    else $('#show-summary').hidden = true;
  }
  if (step === 3) await updatePinStatus();
  if (focus) {
    $(`#${['connect', 'sandbox', 'pin'][step - 1]}-title`).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
function celebrate() {
  clearTimeout(confettiTimer);
  const layer = $('#confetti');
  layer.replaceChildren();
  if (reducedMotion.matches) return;
  for (let index = 0; index < 18; index++) {
    const piece = document.createElement('i');
    piece.style.setProperty('--piece', index);
    layer.append(piece);
  }
  layer.hidden = false;
  confettiTimer = setTimeout(() => {
    layer.hidden = true;
    layer.replaceChildren();
  }, 1300);
}
async function runSummary({ method, selection, pageId }) {
  if (step !== 2 || summarizing) return;
  summarizing = true;
  practice.setBusy(true);
  $('#continue-sandbox').disabled = true;
  message($('#sandbox-status'), '');
  const revision = viewRevision;
  showCard({ kind: 'loading', text: 'Summarizing…' });
  try {
    const result = await request('SUMMARIZE_SANDBOX', {
      method,
      selection,
      requestId: crypto.randomUUID()
    });
    summaries.set(pageId, result.summary);
    // Tab switching and reset never cancel an already-approved API request.
    // Save its result, but do not put a card on a different page or undo reset.
    if (step === 2 && practice.pageId === pageId && revision === viewRevision) {
      showCard({ kind: 'summary', text: result.summary });
    } else {
      $('#show-summary').hidden = !summaries.has(practice.pageId);
      if (step === 2) practice.showNotice('Summary saved to History.');
    }
    await snapshot();
    $('#summary-reward').hidden = false;
    $('#reward-streak').textContent = `${result.stats.currentStreak}-day streak`;
    $('#reward-badge').textContent = result.firstMilestone
      ? 'First Summary unlocked'
      : 'First Summary';
  } catch (error) {
    if (step === 2 && revision === viewRevision)
      showCard({ kind: 'error', text: error.message });
    message($('#sandbox-status'), error.message, true);
  } finally {
    summarizing = false;
    practice.setBusy(false);
    $('#continue-sandbox').disabled = !state.onboarding.sandboxComplete;
  }
}
async function updatePinStatus() {
  try {
    const settings = await chrome.action.getUserSettings();
    $('#pin-status').textContent = settings.isOnToolbar
      ? 'Select Summary is already pinned. You’re ready to go.'
      : 'In Chrome’s top-right corner, open Extensions, then pin Select Summary.';
  } catch {
    /* Compatible browsers may not expose pin status. */
  }
}

// Verification is an explicit form action. Input, consent, optional help and
// switching demo tabs never initiate an API request.
$('#api-key').addEventListener('input', updateConnect);
$('#google-consent').addEventListener('change', updateConnect);
$('#reveal-key').addEventListener('click', () => {
  const visible = $('#api-key').type === 'password';
  $('#api-key').type = visible ? 'text' : 'password';
  $('#reveal-key').setAttribute('aria-pressed', String(visible));
  $('#reveal-key').setAttribute(
    'aria-label',
    visible ? 'Hide entered key' : 'Show entered key'
  );
});
$('#replace-key').addEventListener('click', () => {
  changingKey = true;
  $('#google-consent').checked = false;
  updateConnect();
  $('#api-key').focus();
});
$('#cancel-key').addEventListener('click', () => {
  changingKey = false;
  $('#api-key').value = '';
  $('#api-key').type = 'password';
  $('#reveal-key').setAttribute('aria-pressed', 'false');
  $('#reveal-key').setAttribute('aria-label', 'Show entered key');
  $('#google-consent').checked = false;
  message($('#key-status'), '');
  updateConnect();
  $('#continue-connect').focus();
});
$('#open-studio').addEventListener('click', () =>
  chrome.tabs.create({ url: 'https://aistudio.google.com/apikey' })
);
$('#key-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if ($('#verify-key').disabled || verifying) return;
  const typedKey = $('#api-key').value.trim();
  verifying = true;
  $('#api-key').readOnly = true;
  $('#google-consent').disabled = true;
  updateConnect();
  message($('#key-status'), '');
  try {
    await request('CONNECT_KEY', {
      key: typedKey,
      useStoredKey: !typedKey && state.keyConfigured && !changingKey,
      consent: $('#google-consent').checked
    });
    $('#api-key').value = '';
    $('#api-key').type = 'password';
    $('#reveal-key').setAttribute('aria-pressed', 'false');
    $('#reveal-key').setAttribute('aria-label', 'Show entered key');
    changingKey = false;
    await snapshot();
    celebrate();
    await showStep(2);
  } catch (error) {
    message($('#key-status'), error.message, true);
  } finally {
    verifying = false;
    $('#api-key').readOnly = false;
    $('#google-consent').disabled = false;
    updateConnect();
  }
});
$('#continue-connect').addEventListener('click', () => showStep(2).catch(pageError));
$('#back-connect').addEventListener('click', () => showStep(1).catch(pageError));
$('#continue-sandbox').addEventListener('click', () => showStep(3).catch(pageError));
$('#back-sandbox').addEventListener('click', () => showStep(2).catch(pageError));
document
  .querySelectorAll('[data-step]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      showStep(Number(button.dataset.step)).catch(pageError)
    )
  );
$('#show-summary').addEventListener('click', () => {
  const text = summaries.get(practice.pageId);
  if (text) showCard({ kind: 'summary', text });
});
chrome.runtime.onMessage.addListener((payload, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    payload?.targetTabId !== currentTab?.id ||
    !['PRACTICE_SHORTCUT', 'PRACTICE_CONTEXT'].includes(payload.type)
  )
    return false;
  respond({ handled: true });
  practice.handleCommand(
    payload.type === 'PRACTICE_CONTEXT' ? 'context' : 'shortcut',
    payload.selection
  );
  return false;
});
$('#finish-welcome').addEventListener('click', async () => {
  $('#finish-welcome').disabled = true;
  try {
    await request('FINISH_WELCOME');
    const tabs = await chrome.tabs.query({ windowId: currentTab.windowId });
    if (tabs.length === 1)
      await chrome.tabs.update(currentTab.id, { url: 'chrome://newtab/' });
    else await chrome.tabs.remove(currentTab.id);
  } catch (error) {
    $('#finish-welcome').disabled = false;
    pageError(error);
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.appState || !state) return;
  snapshot()
    .then(async () => {
      if (!state.keyConfigured) {
        summaries.clear();
        $('#show-summary').hidden = true;
      }
      if (!state.keyValidated && step !== 1) await showStep(1, { persist: false });
      else if (!state.onboarding.sandboxComplete && step === 3)
        await showStep(2, { persist: false });
      if (!state.onboarding.sandboxComplete) $('#summary-reward').hidden = true;
    })
    .catch(pageError);
});
// A browser shortcut can switch tabs without delivering keyup to this view.
// Native activation events also cover Chromium views that keep reporting focus.
chrome.tabs.onActivated.addListener(({ windowId }) => {
  if (windowId === currentTab?.windowId) {
    practice.clearKeys();
    practice.closeMenu();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    practice.clearKeys();
    practice.closeMenu();
    $('#api-key').type = 'password';
    $('#reveal-key').setAttribute('aria-pressed', 'false');
    $('#reveal-key').setAttribute('aria-label', 'Show entered key');
  } else
    snapshot()
      .then(() => {
        if (step === 3) void updatePinStatus();
      })
      .catch(pageError);
});
window.addEventListener('pagehide', () => {
  practice.destroy();
  liveCard?.destroy();
  clearTimeout(confettiTimer);
  $('#api-key').value = '';
});
async function initialize() {
  decorateButtons();
  await snapshot();
  if (state.onboarding.completed && location.hash === '#dashboard') {
    location.replace(chrome.runtime.getURL('popup.html'));
    return;
  }
  $('#boot').hidden = true;
  $('#welcome-main').setAttribute('aria-busy', 'false');
  await showStep(state.onboarding.completed ? 1 : state.onboarding.step, {
    persist: false,
    focus: false
  });
}
initialize().catch((error) => {
  $('#boot').hidden = true;
  pageError(error);
});
