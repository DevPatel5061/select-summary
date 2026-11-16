import { SAMPLE_TEXT } from './core.js';
import { shortcutKeys, matchesShortcut } from './shortcuts.js';
import { decorateButtons } from './icons.js';
import './summary-card.js';

// This is the sole onboarding entry point. Shared rendering and provider logic
// stay in runtime modules also used by the production extension.
const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const currentTab = await chrome.tabs.getCurrent();
const canvas = $('#article-browser');
const paragraph = $('#sample-text');
let state;
let platform = 'unknown';
let shortcut = '';
let keys = [];
let step = 1;
let verifying = false;
let summarizing = false;
let changingKey = false;
let savedSelection = '';
let latestSummary = '';
let liveCard;
let demoCard;
let guideRun;
let articleRun;
let articlePlaying = false;
let demoFrameKept = false;
let confettiTimer;
let rewardFrame;
let snapshotSerial = 0;

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
}
function abortError() {
  return new DOMException('Animation stopped', 'AbortError');
}

// Every animation has one cancellable sequence. No separate CSS loops race the
// cursor against buttons, text selection, or a resized layout.
function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, milliseconds);
    function stop() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal.addEventListener('abort', stop, { once: true });
  });
}
async function animate(node, frames, duration, signal) {
  if (signal.aborted) throw abortError();
  const animation = node.animate(frames, {
    duration,
    easing: 'ease-in-out',
    fill: 'forwards'
  });
  const stop = () => animation.cancel();
  signal.addEventListener('abort', stop, { once: true });
  try {
    await animation.finished;
  } catch {
    throw abortError();
  } finally {
    signal.removeEventListener('abort', stop);
    // Commit positions explicitly so old Animation objects cannot override a
    // later replay. The controller owns the resulting inline style.
    if (!signal.aborted) {
      const final = frames.at(-1);
      for (const [property, value] of Object.entries(final)) node.style[property] = value;
    }
    animation.cancel();
  }
}
async function moveTo(cursor, root, target, signal, duration = 420) {
  const rectangle = target.getBoundingClientRect();
  const origin = root.getBoundingClientRect();
  await movePoint(
    cursor,
    rectangle.left - origin.left + rectangle.width / 2,
    rectangle.top - origin.top + rectangle.height / 2,
    signal,
    duration
  );
}
async function movePoint(cursor, x, y, signal, duration = 60) {
  const transform = `translate(${x}px, ${y}px)`;
  cursor.hidden = false;
  await animate(
    cursor,
    [{ transform: cursor.style.transform || transform }, { transform }],
    duration,
    signal
  );
}
async function clickIllustration(cursor, target, signal) {
  target.classList.add('is-hovered');
  await wait(160, signal);
  target.classList.add('is-pressed');
  cursor.classList.add('is-clicking');
  await wait(130, signal);
  // Only illustrated controls have these handlers. This never clicks a live
  // provider link, submits a real key form, or writes to the clipboard.
  target.click();
  target.classList.remove('is-hovered', 'is-pressed');
  cursor.classList.remove('is-clicking');
}

function stopGuide() {
  guideRun?.abort();
  guideRun = null;
  $('#studio-cursor').hidden = true;
  document
    .querySelectorAll('.studio-guide .is-hovered,.studio-guide .is-pressed')
    .forEach((node) => node.classList.remove('is-hovered', 'is-pressed'));
}
function showGuide(scene) {
  $('#create-overlay').hidden = scene !== 'create';
  $('#copy-overlay').hidden = scene !== 'copy';
  $('#paste-scene').hidden = scene !== 'paste';
  $('#studio-address').textContent =
    scene === 'paste'
      ? 'Select Summary · Connect Gemini'
      : 'aistudio.google.com/api-keys';
  document
    .querySelectorAll('[data-guide]')
    .forEach((button) =>
      button.classList.toggle(
        'active',
        button.dataset.guide === (scene === 'copy' ? 'create' : scene)
      )
    );
  const captions = {
    keys: 'Open API Keys. Copy an existing key, or choose Create API key.',
    create: 'Name the key, choose an imported project, then click Create key.',
    copy: 'Copy your new key. Keep project billing disabled for the free tier.',
    paste: 'Paste your key here, accept the data notice, then press Verify & Save Key.'
  };
  $('#guide-caption').textContent = captions[scene];
}
async function playGuide(scene = 'keys') {
  stopGuide();
  $('#mock-copy').lastChild.textContent = 'Copy';
  projectList.hidden = true;
  showGuide(scene);
  if (reducedMotion.matches || step !== 1) return;
  guideRun = new AbortController();
  const { signal } = guideRun;
  const cursor = $('#studio-cursor');
  cursor.style.transform = 'translate(30px, 70px)';
  try {
    if (scene === 'keys') {
      await wait(500, signal);
      await moveTo(cursor, $('#studio-guide'), $('#mock-create'), signal, 650);
      await clickIllustration(cursor, $('#mock-create'), signal);
      scene = 'create';
    }
    if (scene === 'create') {
      $('#mock-name').textContent = '';
      await moveTo(cursor, $('#studio-guide'), $('#mock-name'), signal);
      for (const character of 'Select Summary') {
        $('#mock-name').textContent += character;
        await wait(45, signal);
      }
      await moveTo(cursor, $('#studio-guide'), $('#mock-project'), signal);
      await clickIllustration(cursor, $('#mock-project'), signal);
      await wait(250, signal);
      await moveTo(cursor, $('#studio-guide'), $('#mock-project-option'), signal, 240);
      await clickIllustration(cursor, $('#mock-project-option'), signal);
      await moveTo(cursor, $('#studio-guide'), $('#mock-create-confirm'), signal);
      await clickIllustration(cursor, $('#mock-create-confirm'), signal);
      await wait(350, signal);
      await moveTo(cursor, $('#studio-guide'), $('#mock-copy'), signal);
      await clickIllustration(cursor, $('#mock-copy'), signal);
      await wait(650, signal);
      showGuide('paste');
    }
    $('#mock-paste-value').textContent = '';
    await moveTo(cursor, $('#studio-guide'), $('#mock-paste'), signal);
    cursor.classList.add('is-clicking');
    await wait(160, signal);
    cursor.classList.remove('is-clicking');
    for (let index = 0; index < 18; index++) {
      $('#mock-paste-value').textContent += '•';
      await wait(45, signal);
    }
    await wait(1000, signal);
    cursor.hidden = true;
  } catch (error) {
    if (error.name !== 'AbortError') pageError(error);
  }
}

function updateConnect() {
  const hasVerified = state?.keyValidated && !changingKey;
  $('#verified-key').hidden = !hasVerified;
  $('#key-form').hidden = hasVerified;
  $('#continue-connect').hidden = !hasVerified;
  $('#saved-key-label').textContent = state?.keyConfigured
    ? `Saved key ending in ${state.keySuffix}`
    : '';
  const canUseStored = Boolean(state?.keyConfigured && !changingKey);
  $('#stored-key-hint').hidden = !canUseStored;
  $('#stored-key-hint').textContent = canUseStored
    ? `Leave blank to verify the saved key ending in ${state.keySuffix}, or paste a replacement.`
    : '';
  $('#verify-key').disabled =
    verifying ||
    !$('#google-consent').checked ||
    (!$('#api-key').value.trim() && !canUseStored);
}
function renderKeys() {
  keys = shortcutKeys(shortcut, platform);
  const root = $('#shortcut-keys');
  root.replaceChildren();
  const symbols = { Option: '⌥', Shift: '⇧', Ctrl: '⌃', Command: '⌘' };
  for (const key of keys) {
    const cap = document.createElement('kbd');
    cap.textContent = platform === 'mac' && symbols[key] ? `${symbols[key]} ${key}` : key;
    cap.setAttribute('aria-label', key);
    root.append(cap);
  }
  if (!keys.length) {
    const button = document.createElement('button');
    button.className = 'text-button';
    button.textContent = 'Assign a shortcut';
    button.addEventListener('click', () =>
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
    );
    root.append(button);
  }
}
async function snapshot() {
  const serial = ++snapshotSerial;
  const result = await request('GET_STATE');
  if (serial !== snapshotSerial) return;
  state = result.state;
  platform = result.platform;
  shortcut = result.shortcut;
  renderKeys();
  if (!verifying) updateConnect();
  $('#continue-sandbox').disabled = !state.onboarding.sandboxComplete || summarizing;
}

async function showStep(next, { persist = true, focus = true } = {}) {
  if (!state) return;
  if (next >= 2 && !state.keyValidated) next = 1;
  if (next === 3 && !state.onboarding.sandboxComplete) next = 2;
  if (persist) {
    await request('SET_WELCOME_STEP', { step: next });
    state.onboarding.step = next;
  }
  stopGuide();
  stopDemo();
  hidePill();
  liveCard?.destroy();
  liveCard = null;
  canvas.classList.remove('has-card');
  step = next;
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
  if (step === 1) {
    updateConnect();
    void playGuide();
  }
  if (step === 2) {
    $('#continue-sandbox').disabled = !state.onboarding.sandboxComplete;
    if (latestSummary) showLiveCard({ kind: 'summary', text: latestSummary });
  }
  if (step === 3) await updatePinStatus();
  if (focus) {
    const heading = $(`#${['connect', 'sandbox', 'pin'][step - 1]}-title`);
    heading.focus({ preventScroll: true });
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

// Native text selection is reserved for the user's interaction. The demo uses
// inline word spans, preserving the paragraph's natural wrapping and whitespace.
for (const token of SAMPLE_TEXT.split(/(\s+)/)) {
  if (/^\s+$/.test(token)) paragraph.append(document.createTextNode(token));
  else {
    const span = document.createElement('span');
    span.className = 'demo-word';
    span.textContent = token;
    paragraph.append(span);
  }
}
function selectionText() {
  const selection = window.getSelection();
  if (
    !selection?.rangeCount ||
    !paragraph.contains(selection.getRangeAt(0).commonAncestorContainer)
  )
    return '';
  return selection.toString().trim();
}
function hidePill() {
  $('#quick-pill').hidden = true;
}
function positionPill() {
  if (step !== 2 || summarizing) return hidePill();
  const text = selectionText();
  if (!text) return hidePill();
  savedSelection = text;
  const rectangles = [...window.getSelection().getRangeAt(0).getClientRects()].filter(
    (rectangle) => rectangle.bottom > 0 && rectangle.top < innerHeight
  );
  if (!rectangles.length) return hidePill();
  const last = rectangles.at(-1);
  const origin = canvas.getBoundingClientRect();
  const pill = $('#quick-pill');
  pill.hidden = false;
  const x = Math.max(
    12,
    Math.min(
      last.right - origin.left - pill.offsetWidth,
      origin.width - pill.offsetWidth - 12
    )
  );
  let y = last.bottom - origin.top + 9;
  if (last.bottom + pill.offsetHeight + 12 > innerHeight)
    y = last.top - origin.top - pill.offsetHeight - 8;
  pill.style.left = `${x}px`;
  pill.style.top = `${Math.max(42, y)}px`;
}
function showLiveCard(payload) {
  canvas.classList.add('has-card');
  if (!liveCard?.host.isConnected) {
    liveCard = globalThis.SelectSummaryCard.create({
      container: canvas,
      placement: 'embedded',
      onClose() {
        if (latestSummary) $('#show-summary').hidden = false;
      }
    });
  }
  liveCard.update(payload);
  $('#show-summary').hidden = true;
}
function stopDemo({ keepVisual = false } = {}) {
  articleRun?.abort();
  articleRun = null;
  articlePlaying = false;
  demoFrameKept = keepVisual;
  $('#article-cursor').hidden = true;
  $('#selection-menu').hidden = true;
  $('#watch-demo').lastChild.textContent = 'Watch demo';
  if (!keepVisual) {
    paragraph
      .querySelectorAll('.is-selected')
      .forEach((word) => word.classList.remove('is-selected'));
    demoCard?.destroy();
    demoCard = null;
    $('#demo-label').textContent = 'Your live sandbox';
    if (!liveCard?.host.isConnected) canvas.classList.remove('has-card');
  }
}
function beginUserInteraction() {
  if (articlePlaying || demoFrameKept) stopDemo();
}
async function playDemo() {
  stopDemo();
  if (step !== 2) return;
  hidePill();
  liveCard?.destroy();
  liveCard = null;
  canvas.classList.add('has-card');
  $('#demo-label').textContent = 'Demonstration · no API request';
  const demoText =
    'Community gardens provide food, cooling, and community space, but need safe soil, reliable water, and shared care.';
  if (reducedMotion.matches) {
    demoFrameKept = true;
    demoCard = globalThis.SelectSummaryCard.create({
      container: canvas,
      placement: 'embedded'
    });
    demoCard.update({ kind: 'summary', text: demoText });
    return;
  }
  articleRun = new AbortController();
  const { signal } = articleRun;
  articlePlaying = true;
  $('#watch-demo').lastChild.textContent = 'Pause demo';
  const cursor = $('#article-cursor');
  cursor.classList.add('text-cursor');
  cursor.style.transform = 'translate(30px, 100px)';
  try {
    const words = [...paragraph.querySelectorAll('.demo-word')];
    await moveTo(cursor, canvas, words[0], signal, 450);
    await wait(350, signal);
    for (const word of words) {
      word.classList.add('is-selected');
      const rectangle = word.getBoundingClientRect();
      const origin = canvas.getBoundingClientRect();
      await movePoint(
        cursor,
        rectangle.right - origin.left,
        rectangle.top - origin.top + 2,
        signal,
        26
      );
    }
    cursor.classList.remove('text-cursor');
    await wait(300, signal);
    const menu = $('#selection-menu');
    const last = words.at(-1).getBoundingClientRect();
    const origin = canvas.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(last.right - origin.left, origin.width - 215))}px`;
    menu.style.top = `${Math.min(last.bottom - origin.top + 9, origin.height - 100)}px`;
    cursor.classList.add('is-clicking');
    await wait(130, signal);
    cursor.classList.remove('is-clicking');
    menu.hidden = false;
    await moveTo(cursor, canvas, $('#menu-summarize'), signal, 450);
    $('#menu-summarize').classList.add('is-hovered');
    await wait(250, signal);
    $('#menu-summarize').classList.add('is-pressed');
    cursor.classList.add('is-clicking');
    await wait(150, signal);
    menu.hidden = true;
    $('#menu-summarize').classList.remove('is-hovered', 'is-pressed');
    cursor.classList.remove('is-clicking');
    demoCard = globalThis.SelectSummaryCard.create({
      container: canvas,
      placement: 'embedded'
    });
    demoCard.update({ kind: 'loading', text: 'Summarizing…' });
    await wait(500, signal);
    demoCard.update({ kind: 'summary', text: demoText });
    cursor.hidden = true;
    await wait(3600, signal);
    stopDemo();
    if (latestSummary) showLiveCard({ kind: 'summary', text: latestSummary });
  } catch (error) {
    if (error.name !== 'AbortError') pageError(error);
  }
}

function showReward(result) {
  const reward = $('#summary-reward');
  reward.hidden = false;
  $('#reward-streak').textContent = `${result.stats.currentStreak}-day streak`;
  $('#reward-badge-note').textContent = result.firstMilestone
    ? 'Milestone unlocked'
    : 'Milestone earned';
  reward.setAttribute(
    'aria-label',
    `50 XP earned. ${result.stats.currentStreak}-day streak. First Summary milestone.`
  );
  cancelAnimationFrame(rewardFrame);
  if (reducedMotion.matches) {
    $('#reward-xp').textContent = '+50 XP';
    return;
  }
  // Animate the visual number without asking screen readers to announce frames.
  $('#reward-xp').setAttribute('aria-hidden', 'true');
  const start = performance.now();
  const draw = (now) => {
    const progress = Math.min(1, (now - start) / 450);
    $('#reward-xp').textContent = `+${Math.round(50 * (1 - (1 - progress) ** 3))} XP`;
    if (progress < 1) rewardFrame = requestAnimationFrame(draw);
  };
  rewardFrame = requestAnimationFrame(draw);
}
async function runSummary(method, providedSource) {
  if (step !== 2 || summarizing) return;
  beginUserInteraction();
  const source = providedSource || selectionText() || savedSelection;
  if (!source) {
    message($('#sandbox-status'), 'Highlight some article text first.');
    return;
  }
  summarizing = true;
  hidePill();
  $('#selection-menu').hidden = true;
  $('#quick-pill').disabled = true;
  $('#continue-sandbox').disabled = true;
  $('#watch-demo').disabled = true;
  message($('#sandbox-status'), '');
  showLiveCard({ kind: 'loading', text: 'Summarizing…' });
  try {
    const result = await request('SUMMARIZE_SANDBOX', {
      method,
      selection: source,
      requestId: crypto.randomUUID()
    });
    window.getSelection()?.removeAllRanges();
    latestSummary = result.summary;
    showLiveCard({ kind: 'summary', text: latestSummary });
    await snapshot();
    showReward(result);
  } catch (error) {
    showLiveCard({ kind: 'error', text: error.message });
    message($('#sandbox-status'), error.message, true);
  } finally {
    summarizing = false;
    $('#quick-pill').disabled = false;
    $('#watch-demo').disabled = false;
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

// Illustrated AI Studio controls only change the illustration.
$('#mock-create').addEventListener('click', () => showGuide('create'));
const projectList = document.createElement('div');
projectList.className = 'mock-options';
projectList.hidden = true;
const projectOption = document.createElement('button');
projectOption.id = 'mock-project-option';
projectOption.type = 'button';
projectOption.tabIndex = -1;
projectOption.textContent = 'Default Gemini Project';
projectList.append(projectOption);
$('#mock-project').parentElement.append(projectList);
$('#mock-project').addEventListener('click', () => {
  projectList.hidden = !projectList.hidden;
  projectList.style.top = `${$('#mock-project').offsetTop + $('#mock-project').offsetHeight + 3}px`;
});
projectOption.addEventListener('click', () => {
  projectList.hidden = true;
});
$('#mock-create-confirm').addEventListener('click', () => showGuide('copy'));
$('#mock-copy').addEventListener('click', () => {
  $('#mock-copy').lastChild.textContent = 'Copied';
});
$('#studio-guide').addEventListener('pointerdown', (event) => {
  if (event.isTrusted) stopGuide();
});
$('#guide-replay').addEventListener('click', () => {
  projectList.hidden = true;
  void playGuide();
});
document.querySelectorAll('[data-guide]').forEach((button) =>
  button.addEventListener('click', () => {
    projectList.hidden = true;
    void playGuide(button.dataset.guide);
  })
);
$('#open-studio').addEventListener('click', () =>
  chrome.tabs.create({ url: 'https://aistudio.google.com/apikey' })
);

// Key verification is exclusively an explicit form action, including Enter.
$('#api-key').addEventListener('input', updateConnect);
$('#api-key').addEventListener('focus', stopGuide);
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
  updateConnect();
  $('#api-key').focus();
});
$('#key-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if ($('#verify-key').disabled || verifying) return;
  const typedKey = $('#api-key').value.trim();
  verifying = true;
  $('#api-key').readOnly = true;
  $('#google-consent').disabled = true;
  updateConnect();
  message($('#key-status'), 'Verifying your key…');
  try {
    await request('CONNECT_KEY', {
      key: typedKey,
      useStoredKey: !typedKey && state.keyConfigured && !changingKey,
      consent: $('#google-consent').checked
    });
    $('#api-key').value = '';
    changingKey = false;
    await snapshot();
    message($('#key-status'), 'Key verified.');
    celebrate();
    await new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? 0 : 600));
    verifying = false;
    updateConnect();
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
$('#watch-demo').addEventListener('click', () => {
  if (articlePlaying) stopDemo({ keepVisual: true });
  else void playDemo();
});
$('#show-summary').addEventListener('click', () => {
  stopDemo();
  showLiveCard({ kind: 'summary', text: latestSummary });
});
paragraph.addEventListener('pointerdown', (event) => {
  beginUserInteraction();
  if (event.button === 0) savedSelection = '';
  else savedSelection = selectionText() || savedSelection;
});
document.addEventListener('selectionchange', positionPill);
window.addEventListener('scroll', positionPill, { passive: true });
$('#quick-pill').addEventListener('pointerdown', (event) => event.preventDefault());
$('#quick-pill').addEventListener('click', () => runSummary('pill', savedSelection));
paragraph.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  beginUserInteraction();
  savedSelection = selectionText() || savedSelection;
  if (!savedSelection) return;
  hidePill();
  const origin = canvas.getBoundingClientRect();
  const menu = $('#selection-menu');
  menu.hidden = false;
  menu.style.left = `${Math.max(12, Math.min(event.clientX - origin.left, origin.width - 215))}px`;
  menu.style.top = `${Math.max(40, Math.min(event.clientY - origin.top, origin.height - 100))}px`;
});
$('#selection-menu').addEventListener('pointerdown', (event) => event.preventDefault());
$('#menu-summarize').addEventListener('click', (event) => {
  if (event.isTrusted) void runSummary('context', savedSelection);
});
paragraph.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') {
    event.preventDefault();
    beginUserInteraction();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    positionPill();
  }
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
    event.preventDefault();
    const rectangle = paragraph.getBoundingClientRect();
    paragraph.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: rectangle.left + 20,
        clientY: rectangle.top + 20
      })
    );
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hidePill();
    $('#selection-menu').hidden = true;
  }
  if (step === 2 && matchesShortcut(event, keys)) {
    event.preventDefault();
    void runSummary('shortcut');
  }
});
// The browser command can arrive after focus has moved. Tab identity, not
// document.hasFocus(), decides who handles it. No onboarding overlay escapes.
chrome.runtime.onMessage.addListener((payload, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    payload?.targetTabId !== currentTab?.id ||
    !['PRACTICE_SHORTCUT', 'PRACTICE_CONTEXT'].includes(payload.type)
  )
    return false;
  respond({ handled: true });
  if (step === 2)
    void runSummary(
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
// Keep an open guide in sync with Settings or another welcome tab. Never
// advance automatically after another tab saves a key or completes a summary.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.appState || !state) return;
  snapshot()
    .then(async () => {
      if (!state.keyValidated && step !== 1) await showStep(1, { persist: false });
      else if (!state.onboarding.sandboxComplete && step === 3)
        await showStep(2, { persist: false });
    })
    .catch(pageError);
});
window.addEventListener('resize', () => {
  stopGuide();
  stopDemo();
  positionPill();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopGuide();
    stopDemo();
    $('#api-key').type = 'password';
    $('#reveal-key').setAttribute('aria-pressed', 'false');
    $('#reveal-key').setAttribute('aria-label', 'Show entered key');
  } else {
    snapshot()
      .then(() => {
        if (step === 3) void updatePinStatus();
      })
      .catch(pageError);
  }
});
window.addEventListener('pagehide', () => {
  stopGuide();
  stopDemo();
  liveCard?.destroy();
  clearTimeout(confettiTimer);
  cancelAnimationFrame(rewardFrame);
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
