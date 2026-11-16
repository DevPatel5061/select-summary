import { SAMPLE_TEXT, activityStats, dayKey, shiftDay } from './core.js';
import { decorateButtons, icon } from './icons.js';

const $ = selector => document.querySelector(selector);
let state;
let currentView = 'home';
let currentNotice;
let connectingUI = false;
let successSample = null;
let setupRenderedStep = null;
let refreshSerial = 0;
let toastTimer;
let lastTotal;
let dayTimer;
let renderedDay;

async function request(type, fields = {}) {
  let result;
  try { result = await chrome.runtime.sendMessage({ type, ...fields }); }
  catch { throw new Error('The extension could not connect. Reload it from your browser’s extension settings and try again.'); }
  if (!result?.ok) throw new Error(result?.error?.message || 'Something did not load. Please reopen the extension and try again.');
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
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function showProblem(error) {
  $('#notice-title').textContent = 'A little help needed';
  $('#notice-message').textContent = error.message;
  $('#notice').hidden = false;
}

function on(selector, event, handler) {
  $(selector).addEventListener(event, async e => {
    try { await handler(e); } catch (error) { showProblem(error); }
  });
}

function navigate(view, focus = true) {
  currentView = ['home', 'history', 'settings'].includes(view) ? view : 'home';
  for (const id of ['home', 'history', 'settings']) $(`#${id}`).hidden = id !== currentView;
  $('#onboarding').hidden = true;
  document.querySelectorAll('[data-view]').forEach(button => {
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
    if (day === today) cell.dataset.today = '';
    if (day > today) { cell.dataset.future = ''; cell.disabled = true; }
    cell.addEventListener('focus', () => { $('#day-detail').textContent = label; });
    cell.addEventListener('click', () => { $('#day-detail').textContent = label; });
    cell.addEventListener('keydown', event => {
      const offset = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (!offset) return;
      event.preventDefault();
      const target = $('#heatmap').children[index + offset];
      if (target && !target.disabled) { cell.tabIndex = -1; target.tabIndex = 0; target.focus(); }
    });
    fragment.append(cell);
  }
  $('#heatmap').replaceChildren(fragment);
}

function renderSummary(item) {
  const card = element('article', 'summary-card');
  const meta = element('div', 'summary-meta');
  const date = item.timestamp ? new Date(item.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date unavailable';
  meta.append(element('span', '', date), element('span', '', `${item.summaryWords} words`));
  const text = element('p', 'summary-text', item.text);
  const actions = element('div', 'summary-actions');
  const button = element('button', '', 'Copy summary');
  button.prepend(icon('copy'));
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(item.text); toast('Copied. Ready for your next idea.'); }
    catch { toast('Copy was blocked. Select the summary text and copy it manually.'); }
  });
  actions.append(button);
  card.append(meta, text, actions);
  return card;
}

function renderDashboard() {
  renderedDay = dayKey();
  const stats = activityStats(state.activity);
  $('#stat-total').textContent = stats.total.toLocaleString();
  $('#stat-today').textContent = `${stats.today} today`;
  $('#stat-time').textContent = timeLabel(stats.secondsSaved);
  $('#stat-streak').replaceChildren(document.createTextNode(String(stats.currentStreak)), element('span', '', stats.currentStreak === 1 ? ' day' : ' days'));
  $('#stat-best-streak').textContent = `Best: ${stats.bestStreak} ${stats.bestStreak === 1 ? 'day' : 'days'}`;
  $('#stat-best').textContent = String(stats.bestDay);
  $('#activity-message').textContent = stats.total ? `${stats.total} moments of clarity. Keep going.` : 'Your next highlight starts something.';
  if (lastTotal !== undefined && stats.total > lastTotal && [1, 5, 10, 25, 50, 100].includes(stats.total)) {
    toast(`${stats.total} summaries. Look at you go.`);
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
    empty.append(element('h2', '', 'Your next idea starts here.'), element('p', '', 'Highlight text on a webpage, right-click, and choose “Summarize selection.” Your short versions will appear here.'));
    list.replaceChildren(empty);
  } else list.replaceChildren(...state.history.map(renderSummary));
  $('#latest-area').hidden = !state.history.length;
  $('#latest-summary').replaceChildren(...state.history.slice(0, 1).map(renderSummary));
  $('#key-status').textContent = `Key ending in ${state.keySuffix} · ${state.keyConfigured ? 'Connected' : 'Not connected'}`;
  $('#upgrade-intro').hidden = state.introSeen;
}

const privacyHTML = '<div class="privacy-note">Selected text and a test sample are sent directly to Google. Free-tier inputs and responses may be used for product improvement and human review. Avoid sensitive text. For no API charges, use a project without billing enabled; we cannot verify its billing status. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Google’s terms</a> apply.</div>';

function createKeyForm(container, replacement = false) {
  // This template contains only fixed, bundled copy. User and API text use textContent.
  container.innerHTML = privacyHTML + '<form class="key-form"><label for="new-key">Your Gemini API key</label><div class="input-row"><input id="new-key" type="password" placeholder="Paste your API key" autocomplete="off" spellcheck="false" autocapitalize="none" maxlength="256" required><button type="button" class="icon-button" data-icon="eye" aria-label="Show entered key" aria-pressed="false"></button></div><label class="consent"><input type="checkbox" required><span>I understand this connects to Google and that my project’s data terms, limits, and possible API charges apply.</span></label><p class="form-status" role="status"></p><button type="submit" class="primary" data-icon="arrow">Test and connect</button></form>';
  if (replacement) {
    const cancel = element('button', 'text-button', 'Cancel replacement');
    cancel.addEventListener('click', () => { container.replaceChildren(); container.hidden = true; $('#replace-key').hidden = false; $('#replace-key').focus(); });
    container.append(cancel);
  }
  decorateButtons(container);
  const input = container.querySelector('input[type=password]');
  const reveal = container.querySelector('button[type=button]');
  reveal.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    reveal.setAttribute('aria-label', visible ? 'Hide entered key' : 'Show entered key');
    reveal.setAttribute('aria-pressed', String(visible));
  });
  container.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    if (connectingUI) return;
    const consent = container.querySelector('input[type=checkbox]');
    const status = container.querySelector('.form-status');
    const submit = container.querySelector('button[type=submit]');
    connectingUI = true;
    submit.disabled = true;
    input.readOnly = true;
    status.textContent = 'Testing a tiny sample with Gemini. This may take a moment…';
    try {
      const result = await request('CONNECT_KEY', { key: input.value, consent: consent.checked });
      input.value = '';
      const refreshed = await request('GET_STATE');
      state = refreshed.state;
      successSample = result.sample;
      setupRenderedStep = null;
      $('#navigation').hidden = true;
      for (const id of ['home', 'history', 'settings']) $(`#${id}`).hidden = true;
      container.replaceChildren();
      renderOnboarding();
    } catch (error) {
      status.textContent = error.message;
      status.setAttribute('role', 'alert');
      input.focus();
    } finally {
      connectingUI = false;
      submit.disabled = false;
      input.readOnly = false;
    }
  });
}

async function setupStep(step) {
  await request('SET_ONBOARDING', { step });
  state.onboardingStep = step;
  setupRenderedStep = null;
  renderOnboarding();
}

function renderOnboarding() {
  const container = $('#onboarding');
  const step = successSample ? 3 : state.onboardingStep;
  container.hidden = false;
  if (setupRenderedStep === step) return;
  setupRenderedStep = step;
  container.replaceChildren();
  const progress = element('div', 'setup-progress');
  progress.setAttribute('aria-label', `Setup step ${Math.min(step + 1, 3)} of 3`);
  for (let index = 0; index < 3; index++) progress.append(element('span', index <= step ? 'active' : ''));
  container.append(progress);
  if (step === 0) {
    container.insertAdjacentHTML('beforeend', '<p class="eyebrow">YOUR NEXT GOOD IDEA, FASTER</p><h1 class="setup-heading" id="setup-title">Big ideas.<br><span>Small summaries.</span></h1><p class="setup-subtitle">Turn the text you highlight into the part you actually need. A little less reading. A lot more clarity.</p><div class="demo"><span class="demo-label">A quick preview · no API request</span><p class="demo-source">Urban gardens <mark>grow fresh food, bring neighbors together, and support local wildlife</mark>. They need water and shared care to thrive.</p><button id="preview-demo" class="secondary" data-icon="arrow">Try the preview</button><div id="demo-result" class="demo-summary" hidden><span class="demo-label">The short version</span><p>Urban gardens strengthen communities and wildlife while growing food, with water and shared care essential to success.</p></div></div><button class="primary" id="start-setup" data-icon="arrow">Make room for clarity</button><div class="setup-benefits"><span>Free extension</span><span>No extension tracking</span><span>Your own Gemini key</span></div>');
    on('#start-setup', 'click', () => setupStep(1));
    on('#preview-demo', 'click', () => { $('#demo-result').hidden = false; $('#demo-result').classList.add('celebrate'); $('#preview-demo').hidden = true; });
  } else if (step === 1) {
    container.insertAdjacentHTML('beforeend', '<p class="eyebrow">ONE KEY. A LITTLE POSSIBILITY.</p><h1 class="setup-heading" id="setup-title">Let’s get you<br><span>connected.</span></h1><p class="setup-subtitle">Bring your own Gemini key. It takes just a few steps.</p><ol class="instructions"><li><div><strong>Open Google AI Studio</strong><span class="muted">Sign in with your Google account. You may need to accept Google’s terms.</span></div></li><li><div><strong>Create or select a project</strong><span class="muted">Use a project without billing enabled to avoid API charges. Free-tier access and regional availability vary.</span></div></li><li><div><strong>Create and copy your API key</strong><span class="muted">Use a key restricted to the Gemini API. Return here to paste it and test a sample.</span></div></li></ol><a class="studio-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Open Google AI Studio</a><p class="small muted">This screen remembers your progress if the popup closes.</p><div class="setup-actions"><button class="secondary" id="setup-back">Back</button><button class="primary" id="have-key" data-icon="arrow">I have my key</button></div>');
    on('#setup-back', 'click', () => setupStep(0));
    on('#have-key', 'click', () => setupStep(2));
  } else if (step === 2) {
    container.insertAdjacentHTML('beforeend', '<p class="eyebrow">THE LAST LITTLE STEP</p><h1 class="setup-heading" id="setup-title">A key to<br><span>clearer reading.</span></h1><p class="setup-subtitle">We’ll summarize a harmless sample to check your connection. Your key is saved only when the test works.</p><div id="setup-key-form"></div><button class="text-button" id="setup-back">Back to key instructions</button>');
    createKeyForm($('#setup-key-form'));
    on('#setup-back', 'click', () => setupStep(1));
  } else {
    container.insertAdjacentHTML('beforeend', '<p class="eyebrow">CONNECTION MADE</p><h1 class="setup-heading success-heading" id="setup-title">You’re all set.<br>Go find an idea.</h1><p class="setup-subtitle">Your key works. Here’s your first little moment of clarity.</p><div class="demo success-panel celebrate"><span class="demo-label">The sample we sent</span><p id="sample-source" class="demo-source"></p><div class="demo-summary"><span class="demo-label">Gemini’s short version</span><p id="sample-result"></p></div></div><p class="small muted">This test does not count toward your activity or history.</p><button class="primary" id="finish-setup" data-icon="arrow">Meet your dashboard</button>');
    $('#sample-source').textContent = SAMPLE_TEXT;
    $('#sample-result').textContent = successSample;
    on('#finish-setup', 'click', () => { successSample = null; renderDashboard(); $('#navigation').hidden = false; navigate('home'); });
  }
  decorateButtons(container);
  const heading = $('#setup-title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function refresh() {
  const serial = ++refreshSerial;
  const response = await request('GET_STATE');
  if (serial !== refreshSerial || connectingUI) return;
  state = response.state;
  currentNotice = response.notice;
  $('#boot').hidden = true;
  $('#notice').hidden = !currentNotice || currentNotice.level === 'success';
  if (currentNotice) {
    $('#notice-title').textContent = currentNotice.title;
    $('#notice-message').textContent = currentNotice.message;
  }
  if (!state.keyConfigured || successSample) {
    $('#navigation').hidden = true;
    for (const id of ['home', 'history', 'settings']) $(`#${id}`).hidden = true;
    renderOnboarding();
  } else {
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
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue === 'confirm') {
      try { await action(); await refresh(); } catch (error) { showProblem(error); }
    }
  }, { once: true });
  dialog.showModal();
}

decorateButtons();
document.body.classList.toggle('window-mode', !chrome.extension.getViews({ type: 'popup' }).includes(window));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.view)));
on('.wordmark', 'click', event => { event.preventDefault(); if (state?.keyConfigured) navigate('home'); });
on('#open-window', 'click', async () => {
  await chrome.windows.create({ url: chrome.runtime.getURL('popup.html'), type: 'popup', width: 920, height: 820 });
  if (chrome.extension.getViews({ type: 'popup' }).includes(window)) window.close();
});
on('#dismiss-notice', 'click', async () => { $('#notice').hidden = true; if (currentNotice) await request('DISMISS_NOTICE', { id: currentNotice.id }); });
on('#dismiss-intro', 'click', async () => { await request('SEEN_INTRO'); await refresh(); });
on('#view-history', 'click', () => navigate('history'));
on('#replace-key', 'click', () => { $('#replace-key').hidden = true; $('#replacement-form').hidden = false; createKeyForm($('#replacement-form'), true); $('#new-key').focus(); });
on('#clear-history', 'click', () => confirmAction('Clear your history?', 'Your saved summaries will be removed. Your activity, streaks, and connected key will stay.', 'Clear history', () => request('CLEAR_HISTORY')));
on('#remove-key', 'click', () => confirmAction('Disconnect this key?', 'The key will be removed from this browser. History and activity will stay. To revoke the key itself, use Google AI Studio.', 'Remove key', async () => { successSample = null; await request('REMOVE_KEY'); }));
on('#reset-all', 'click', () => confirmAction('Start with a clean slate?', 'Your key, summaries, and activity will be permanently removed from this browser. This does not revoke your key at Google.', 'Reset everything', async () => { successSample = null; lastTotal = undefined; await request('RESET_ALL'); }));
on('#shortcut-settings', 'click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'local' && changes.appState) || (area === 'session' && changes.notice)) refresh().catch(showProblem);
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderHeatmap, 100); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    document.querySelectorAll('input[type=text],input[type=password]').forEach(input => { input.type = 'password'; });
    document.querySelectorAll('[aria-label="Hide entered key"]').forEach(button => { button.setAttribute('aria-label', 'Show entered key'); button.setAttribute('aria-pressed', 'false'); });
  }
  else refresh().catch(showProblem);
});
window.addEventListener('pagehide', () => { clearInterval(dayTimer); document.querySelectorAll('input[type=password],input[type=text]').forEach(input => { input.value = ''; }); });
dayTimer = setInterval(() => { if (state?.keyConfigured && !document.hidden && renderedDay !== dayKey()) renderDashboard(); }, 60_000);
refresh().catch(error => { $('#boot').textContent = 'Could not load your local workspace.'; showProblem(error); });
