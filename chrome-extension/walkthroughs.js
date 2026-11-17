// Bundled illustrations only. These controls never operate a Google account
// or the actual Chrome toolbar; the cursor targets measured button positions.
export function createWalkthroughs(onError) {
  const $ = (selector) => document.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pageError = onError;
  let step = 0;
  let guideRun;
  let pinRun;
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
        for (const [property, value] of Object.entries(final))
          node.style[property] = value;
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
    $('#project-overlay').hidden = scene !== 'project';
    $('#copy-overlay').hidden = scene !== 'copy';
    $('#paste-scene').hidden = scene !== 'paste';
    $('#studio-address').textContent =
      scene === 'paste'
        ? 'Select Summary · Connect Gemini'
        : 'aistudio.google.com/api-keys';
    const captions = {
      keys: 'Open API Keys. Copy an existing key, or choose Create API key.',
      create: 'Name your key and choose a project.',
      project: 'Create a project, name it, and select it for your key.',
      copy: 'Copy your new key. Keep project billing disabled for the free tier.',
      paste: 'Paste your key here, accept the data notice, then press Verify & Continue.'
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
      while (!signal.aborted && step === 1) {
        scene = 'keys';
        projectList.hidden = true;
        projectOption.hidden = true;
        $('#mock-project-label').textContent = 'Create project';
        $('#mock-project-name').textContent = '';
        $('#mock-copy').lastChild.textContent = 'Copy';
        showGuide(scene);
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
          await moveTo(cursor, $('#studio-guide'), $('#mock-new-project'), signal, 260);
          await clickIllustration(cursor, $('#mock-new-project'), signal);
          await moveTo(cursor, $('#studio-guide'), $('#mock-project-name'), signal);
          for (const character of 'Select Summary') {
            $('#mock-project-name').textContent += character;
            await wait(65, signal);
          }
          await moveTo(cursor, $('#studio-guide'), $('#mock-project-create'), signal);
          await clickIllustration(cursor, $('#mock-project-create'), signal);
          await wait(350, signal);
          await moveTo(cursor, $('#studio-guide'), $('#mock-project-option'), signal);
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
        await wait(700, signal);
      }
    } catch (error) {
      if (error.name !== 'AbortError') pageError(error);
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
  projectOption.textContent = 'Select Summary';
  projectOption.hidden = true;
  const newProject = document.createElement('button');
  newProject.id = 'mock-new-project';
  newProject.tabIndex = -1;
  newProject.textContent = 'Create project';
  projectList.append(projectOption, newProject);
  $('#mock-project').parentElement.append(projectList);
  $('#mock-project').addEventListener('click', () => {
    projectList.hidden = !projectList.hidden;
    projectList.style.top = `${$('#mock-project').offsetTop + $('#mock-project').offsetHeight + 3}px`;
  });
  projectOption.addEventListener('click', () => {
    projectList.hidden = true;
    $('#mock-project-label').textContent = 'Select Summary';
  });
  newProject.addEventListener('click', () => {
    projectList.hidden = true;
    showGuide('project');
  });
  $('#mock-project-create').addEventListener('click', () => {
    showGuide('create');
    projectOption.hidden = false;
    projectList.hidden = false;
  });
  $('#mock-create-confirm').addEventListener('click', () => showGuide('copy'));
  $('#mock-copy').addEventListener('click', () => {
    $('#mock-copy').lastChild.textContent = 'Copied';
  });

  function stopPin() {
    pinRun?.abort();
    pinRun = null;
    $('#pin-cursor').hidden = true;
    document
      .querySelectorAll('#pin-illustration .is-pressed,#pin-illustration .is-hovered')
      .forEach((node) => node.classList.remove('is-pressed', 'is-hovered'));
  }
  async function playPin() {
    stopPin();
    $('#pin-menu').hidden = !reducedMotion.matches;
    $('#pinned-example').hidden = !reducedMotion.matches;
    $('#pin-example').classList.toggle('is-pinned', reducedMotion.matches);
    if (reducedMotion.matches || step !== 3) return;
    pinRun = new AbortController();
    const { signal } = pinRun;
    const cursor = $('#pin-cursor');
    cursor.style.transform = 'translate(30px, 30px)';
    try {
      while (!signal.aborted && step === 3) {
        $('#pin-menu').hidden = true;
        $('#pinned-example').hidden = true;
        $('#pin-example').classList.remove('is-pinned');
        await wait(400, signal);
        await moveTo(cursor, $('#pin-illustration'), $('#pin-extensions'), signal, 650);
        await clickIllustration(cursor, $('#pin-extensions'), signal);
        await wait(350, signal);
        await moveTo(cursor, $('#pin-illustration'), $('#pin-example'), signal, 500);
        await clickIllustration(cursor, $('#pin-example'), signal);
        await wait(700, signal);
        cursor.hidden = true;
        await wait(1400, signal);
      }
    } catch (error) {
      if (error.name !== 'AbortError') pageError(error);
    }
  }
  $('#pin-extensions').addEventListener('click', () => {
    $('#pin-menu').hidden = !$('#pin-menu').hidden;
  });
  $('#pin-example').addEventListener('click', () => {
    const pinned = !$('#pin-example').classList.contains('is-pinned');
    $('#pin-example').classList.toggle('is-pinned', pinned);
    $('#pinned-example').hidden = !pinned;
  });
  reducedMotion.addEventListener('change', () => {
    stopGuide();
    stopPin();
    if (step === 1) void playGuide();
    if (step === 3) void playPin();
  });
  return {
    show(next) {
      step = next;
      stopGuide();
      stopPin();
      if (step === 1) void playGuide();
      if (step === 3) void playPin();
    },
    stop() {
      stopGuide();
      stopPin();
    }
  };
}
