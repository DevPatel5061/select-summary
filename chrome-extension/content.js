// One controller per isolated content-script world prevents duplicate listeners.
(() => {
  if (globalThis.__selectSummaryInstalled) return;
  globalThis.__selectSummaryInstalled = true;

  let host;
  let closeTimer;
  let dismissedWhileLoading = false;

  // Original CC0 button artwork; no remote images or icon library.
  function buttonIcon(kind) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    if (kind === 'close') {
      for (const className of ['timer-track', 'timer-progress']) {
        const circle = document.createElementNS(namespace, 'circle');
        circle.setAttribute('cx', '16');
        circle.setAttribute('cy', '16');
        circle.setAttribute('r', '13');
        circle.setAttribute('pathLength', '1');
        circle.setAttribute('class', className);
        svg.append(circle);
      }
    }

    const path = document.createElementNS(namespace, 'path');
    path.setAttribute(
      'd',
      kind === 'close' ? 'M12 12l8 8m0-8-8 8' : 'M12 12h14v14H12zM6 20V6h14'
    );
    svg.append(path);
    return svg;
  }

  function dismiss() {
    clearTimeout(closeTimer);
    host?.remove();
  }

  function show({ kind, title, text }) {
    if (kind === 'loading') dismissedWhileLoading = false;
    if (dismissedWhileLoading && kind !== 'loading') return;
    dismiss();

    host = document.createElement('select-summary-card');
    // Reset the host independently of the webpage's style rules.
    const hostStyles = {
      all: 'initial',
      'font-family': '"Helvetica Neue", Helvetica, Arial, sans-serif',
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      'z-index': '2147483647'
    };
    for (const [name, value] of Object.entries(hostStyles)) {
      host.style.setProperty(name, value, 'important');
    }

    const shadow = host.attachShadow({ mode: 'closed' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = chrome.runtime.getURL('summary.css');

    const card = document.createElement('section');
    card.className = `card ${kind}`;
    card.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    card.setAttribute('aria-label', 'Select Summary');

    const header = document.createElement('div');
    header.className = 'header';
    const brand = document.createElement('span');
    brand.className = 'brand';
    brand.textContent = 'Select Summary';

    const duration = kind === 'summary' ? 25_000 : kind === 'error' ? 10_000 : 0;
    const close = document.createElement('button');
    close.className = duration ? 'close timed' : 'close';
    close.setAttribute('aria-label', 'Close summary card');
    close.title = duration
      ? `Close · automatically closes after ${duration / 1000} seconds`
      : 'Close';
    close.style.setProperty('--close-duration', `${duration}ms`);
    close.append(buttonIcon('close'));
    close.addEventListener('click', () => {
      dismissedWhileLoading = kind === 'loading';
      dismiss();
    });
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
      const actions = document.createElement('div');
      actions.className = 'actions';
      const copy = document.createElement('button');
      copy.className = 'copy';
      const label = document.createElement('span');
      label.textContent = 'Copy';
      copy.append(buttonIcon('copy'), label);
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          label.textContent = 'Copied';
        } catch {
          label.textContent = 'Select text to copy';
        }
      });
      actions.append(copy);
      card.append(actions);
    }

    shadow.append(stylesheet, card);
    document.documentElement.append(host);

    // Loading does not expire. Replacing a card always cancels its old timer.
    if (duration) closeTimer = setTimeout(dismiss, duration);
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (
      sender.id !== chrome.runtime.id ||
      sender.tab ||
      message?.type !== 'SELECT_SUMMARY_CARD'
    )
      return;
    if (!['summary', 'loading', 'error'].includes(message.kind)) return;
    if (typeof message.title !== 'string' || typeof message.text !== 'string') return;
    show(message);
  });
})();
