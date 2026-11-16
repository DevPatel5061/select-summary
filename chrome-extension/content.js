(() => {
  if (globalThis.__selectSummaryInstalled) return;
  globalThis.__selectSummaryInstalled = true;
  let host;
  let dismissedWhileLoading = false;

  function show({ kind, title, text }) {
    if (kind === 'loading') dismissedWhileLoading = false;
    if (dismissedWhileLoading && kind === 'summary') return;
    host?.remove();
    host = document.createElement('select-summary-card');
    host.style.setProperty('all', 'initial', 'important');
    host.style.setProperty('font-family', '"Helvetica Neue", Helvetica, Arial, sans-serif', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('bottom', '20px', 'important');
    host.style.setProperty('right', '20px', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('summary.css');
    const card = document.createElement('section');
    card.className = `card ${kind}`;
    card.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    card.setAttribute('aria-label', 'Select Summary');
    const header = document.createElement('div');
    header.className = 'header';
    const brand = document.createElement('span');
    brand.className = 'brand';
    brand.textContent = 'Select Summary';
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = 'Close';
    close.setAttribute('aria-label', 'Close summary card');
    close.addEventListener('click', () => { dismissedWhileLoading = kind === 'loading'; host?.remove(); });
    header.append(brand, close);
    const heading = document.createElement('h2');
    heading.textContent = title;
    const paragraph = document.createElement('p');
    paragraph.className = 'text';
    paragraph.textContent = text;
    card.append(header, heading, paragraph);
    if (kind === 'loading') {
      const progress = document.createElement('div');
      progress.className = 'progress';
      progress.setAttribute('aria-hidden', 'true');
      card.append(progress);
    }
    if (kind === 'summary') {
      const footer = document.createElement('div');
      footer.className = 'footer';
      const hint = document.createElement('span');
      hint.textContent = 'Saved to your history';
      const copy = document.createElement('button');
      copy.textContent = 'Copy summary';
      copy.className = 'copy';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; }
        catch { hint.textContent = 'Copy blocked. Select this text to copy manually.'; }
      });
      footer.append(hint, copy);
      card.append(footer);
    }
    shadow.append(style, card);
    document.documentElement.append(host);
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id || sender.tab || message?.type !== 'SELECT_SUMMARY_CARD') return;
    if (!['summary', 'loading', 'error'].includes(message.kind) || typeof message.title !== 'string' || typeof message.text !== 'string') return;
    show(message);
  });
})();
