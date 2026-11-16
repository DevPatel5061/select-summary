// Shared by isolated content scripts and the welcome page. This classic script
// also works as a side-effect module, so no remote imports or build step is needed.
(() => {
  if (globalThis.SelectSummaryCard) return;

  // Original button artwork, dedicated under CC0 1.0. SVGs stay inside buttons.
  function buttonIcon(kind) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const attributes = {
      viewBox: '0 0 32 32',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.7',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false'
    };
    for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
    if (kind === 'close') {
      for (const className of ['timer-track', 'timer-progress']) {
        const circle = document.createElementNS(namespace, 'circle');
        for (const [name, value] of Object.entries({
          cx: '16',
          cy: '16',
          r: '13',
          pathLength: '100',
          class: className
        }))
          circle.setAttribute(name, value);
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

  function create({
    container = document.documentElement,
    placement = 'floating',
    onClose = () => {}
  } = {}) {
    const host = document.createElement('select-summary-card');
    const styles = {
      all: 'initial',
      'font-family': '"Helvetica Neue", Helvetica, Arial, sans-serif',
      position: placement === 'floating' ? 'fixed' : 'absolute',
      bottom: '20px',
      right: '20px',
      width: 'min(350px, calc(100% - 40px))',
      'z-index': placement === 'floating' ? '2147483647' : '4'
    };
    for (const [name, value] of Object.entries(styles))
      host.style.setProperty(name, value, 'important');
    host.dataset.placement = placement;
    const shadow = host.attachShadow({ mode: 'closed' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = chrome.runtime.getURL('summary.css');
    shadow.append(stylesheet);
    let timer;
    let frame;
    let kind = 'summary';
    let destroyed = false;

    function clearClock() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    }
    function destroy() {
      clearClock();
      destroyed = true;
      host.remove();
    }
    function close(reason = 'manual') {
      destroy();
      onClose({ kind, reason });
    }
    function update({ kind: nextKind = 'summary', text }) {
      if (destroyed) return;
      clearClock();
      kind = nextKind;
      shadow.querySelector('.card')?.remove();
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
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'close';
      dismiss.setAttribute('aria-label', 'Close summary card');
      dismiss.title = duration
        ? `Close · automatically closes after ${duration / 1000} seconds`
        : 'Close';
      dismiss.append(buttonIcon('close'));
      dismiss.addEventListener('click', () => close());
      header.append(brand, dismiss);
      const paragraph = document.createElement('p');
      paragraph.className = 'text';
      paragraph.textContent = text;
      card.append(header, paragraph);
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
        copy.type = 'button';
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
      shadow.append(card);
      if (!host.isConnected) container.append(host);
      if (duration) {
        timer = setTimeout(() => close('timeout'), duration);
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const ring = dismiss.querySelector('.timer-progress');
          const start = performance.now();
          const draw = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            ring.style.strokeDashoffset = String(100 * (1 - progress));
            if (progress < 1) frame = requestAnimationFrame(draw);
          };
          frame = requestAnimationFrame(draw);
        }
      }
    }
    return { host, update, close, destroy };
  }

  globalThis.SelectSummaryCard = Object.freeze({ create });
})();
