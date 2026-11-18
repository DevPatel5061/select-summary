import { timeline, TIMING } from './shared/timeline.js';

// These are bundled illustrations. Animated clicks never touch a real form,
// clipboard, Google account, browser toolbar, or provider request.
export function createWalkthroughs(onError) {
  const $ = (selector) => document.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const tracks = new Map();
  let active;
  const exampleSummary = 'Toronto is Ontario’s capital and Canada’s largest city, shaped by immigration. It features iconic landmarks like the CN Tower and hosts the Toronto International Film Festival.';
  const introCard = globalThis.SelectSummaryCard.create({
    container: $('#intro-result'),
    placement: 'embedded',
    autoDismiss: false
  });

  function createTrack(
    name,
    { root, cursor, caption, scenes, paint, finished }
  ) {
    const surface = $(root);
    const pointer = $(cursor);
    const label = $(caption);
    const animations = new Set();
    const delays = new Set();
    let controller;
    let index = 0;
    let paused = false;
    let ended = false;
    let visited = false;
    let automaticallyPaused = false;

    function update() {
      if (name === 'studio') {
        document.querySelectorAll('[data-guide-scene]').forEach((button) => {
          const position = Number(button.dataset.guideScene);
          button.dataset.complete = String(position < index || ended);
          button.querySelector('.scene-fill').style.transform =
            position < index || ended ? 'scaleX(1)' : 'scaleX(0)';
          button.setAttribute(
            'aria-pressed',
            String(Number(button.dataset.guideScene) === index)
          );
        });
      }
    }
    function abort() {
      controller?.abort();
      controller = undefined;
      surface
        .querySelectorAll('.is-hovered, .is-pressed')
        .forEach((node) => node.classList.remove('is-hovered', 'is-pressed'));
      pointer.classList.remove('is-clicking');
      pointer.hidden = true;
    }
    // Pauses retain both timer durations and Web Animation positions. Coming
    // back from AI Studio continues the guide instead of restarting it.
    function wait(milliseconds, signal) {
      return new Promise((resolve, reject) => {
        if (signal.aborted)
          return reject(new DOMException('Stopped', 'AbortError'));
        let remaining = milliseconds;
        let began;
        let timer;
        const delay = {
          pause() {
            if (timer === undefined) return;
            clearTimeout(timer);
            remaining = Math.max(0, remaining - (performance.now() - began));
            timer = undefined;
          },
          resume() {
            if (timer !== undefined || signal.aborted) return;
            began = performance.now();
            timer = setTimeout(() => {
              timer = undefined;
              cleanup();
              resolve();
            }, remaining);
          }
        };
        function cleanup() {
          clearTimeout(timer);
          delays.delete(delay);
          signal.removeEventListener('abort', stop);
        }
        function stop() {
          cleanup();
          reject(new DOMException('Stopped', 'AbortError'));
        }
        delays.add(delay);
        signal.addEventListener('abort', stop, { once: true });
        if (!paused) delay.resume();
      });
    }
    async function animate(node, frames, duration, signal) {
      if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
      const animation = node.animate(frames, {
        duration,
        easing: 'cubic-bezier(.4,0,.2,1)',
        fill: 'forwards'
      });
      animations.add(animation);
      if (paused) animation.pause();
      const stop = () => animation.cancel();
      signal.addEventListener('abort', stop, { once: true });
      try {
        await animation.finished;
        if (!signal.aborted) Object.assign(node.style, frames.at(-1));
      } catch {
        throw new DOMException('Stopped', 'AbortError');
      } finally {
        animations.delete(animation);
        signal.removeEventListener('abort', stop);
        animation.cancel();
      }
    }
    async function point(x, y, signal, duration = TIMING.move) {
      const transform = `translate(${x}px, ${y}px)`;
      pointer.hidden = false;
      await animate(
        pointer,
        [{ transform: pointer.style.transform || transform }, { transform }],
        duration,
        signal
      );
    }
    async function move(target, signal, duration = TIMING.move) {
      const node = typeof target === 'string' ? $(target) : target;
      const bounds = node.getBoundingClientRect();
      const origin = surface.getBoundingClientRect();
      await point(
        bounds.left - origin.left + bounds.width / 2,
        bounds.top - origin.top + bounds.height / 2,
        signal,
        duration
      );
    }
    async function press(target, action, signal) {
      const node = typeof target === 'string' ? $(target) : target;
      node.classList.add('is-hovered');
      try {
        await wait(TIMING.hover, signal);
        node.classList.add('is-pressed');
        pointer.classList.add('is-clicking');
        await wait(TIMING.down, signal);
        action();
        await wait(TIMING.release, signal);
      } finally {
        node.classList.remove('is-hovered', 'is-pressed');
        pointer.classList.remove('is-clicking');
      }
    }
    async function type(target, text, signal) {
      const node = $(target);
      node.textContent = '';
      for (const character of text) {
        node.textContent += character;
        await wait(TIMING.character, signal);
      }
    }
    function pause(automatic = false) {
      if (!controller || paused) return;
      paused = true;
      automaticallyPaused = automatic;
      animations.forEach((animation) => animation.pause());
      delays.forEach((delay) => delay.pause());
      update();
    }
    function resume() {
      automaticallyPaused = false;
      if (reducedMotion.matches) return;
      if (!controller) return start(ended ? 0 : index);
      paused = false;
      animations.forEach((animation) => animation.play());
      delays.forEach((delay) => delay.resume());
      update();
    }
    function start(from = 0) {
      abort();
      visited = true;
      ended = false;
      paused = false;
      automaticallyPaused = false;
      index = from;
      if (reducedMotion.matches) {
        index = scenes.length - 1;
        paint(index);
        label.textContent = finished;
        ended = true;
        update();
        return;
      }
      controller = new AbortController();
      const signal = controller.signal;
      pointer.style.transform = 'translate(24px, 86px)';
      const api = {
        wait: (ms) => wait(ms, signal),
        move: (target, duration) => move(target, signal, duration),
        point: (x, y, duration) => point(x, y, signal, duration),
        press: (target, action = () => {}) => press(target, action, signal),
        type: (target, text) => type(target, text, signal),
        animate: (target, frames, duration) =>
          animate($(target), frames, duration, signal)
      };
      void (async () => {
        try {
          while (!signal.aborted) {
            for (let scene = from; scene < scenes.length; scene++) {
              if (signal.aborted) return;
              index = scene;
              paint(index);
              label.textContent = scenes[scene].caption;
              update();
              const meter =
                name === 'studio'
                  ? $(`[data-guide-scene="${scene}"] .scene-fill`)
                  : null;
              if (meter) {
                await Promise.all([
                  scenes[scene].run(api),
                  animate(
                    meter,
                    [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
                    scenes[scene].duration,
                    signal
                  )
                ]);
              } else await scenes[scene].run(api);
            }
            if (signal.aborted) return;
            ended = true;
            pointer.hidden = true;
            label.textContent = finished;
            update();
            await wait(1500, signal);
            from = 0;
            ended = false;
            pointer.style.transform = 'translate(24px, 86px)';
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            abort();
            onError(error);
          }
        }
      })();
    }
    const track = {
      show() {
        start();
        update();
      },
      suspend() {
        pause(true);
      },
      resume() {
        if (
          automaticallyPaused ||
          (!controller && visited && !reducedMotion.matches)
        )
          resume();
      },
      resize() {
        if (!visited || ended || reducedMotion.matches) return;
        const keepPaused = paused;
        const keepAutomatic = automaticallyPaused;
        start(index);
        if (keepPaused) {
          pause(keepAutomatic);
        }
      },
      playScene(scene) {
        start(scene);
      },
      staticScene(scene) {
        abort();
        visited = true;
        index = scene;
        ended = false;
        paused = true;
        automaticallyPaused = false;
        paint(index);
        label.textContent = scenes[index].caption;
        update();
      },
      motionChanged(shouldPlay) {
        if (!visited) return;
        if (shouldPlay) {
          start();
          return;
        }
        abort();
        index = scenes.length - 1;
        paint(index);
        label.textContent = finished;
        ended = true;
        update();
      },
      stop: abort
    };
    tracks.set(name, track);
    return track;
  }

  createTrack('intro', {
    root: '#intro-browser',
    cursor: '#intro-cursor',
    caption: '#intro-caption',
    paint(index) {
      $('#intro-selection').style.backgroundSize = '';
      $('#intro-selection').classList.toggle('is-selected', index > 0);
      $('#intro-menu').hidden = index !== 1;
      $('#intro-result').hidden = index < 2;
      introCard.update({ kind: 'summary', text: exampleSummary });
    },
    scenes: [
      {
        caption: 'Highlight the part you want to understand.',
        async run(a) {
          await a.wait(850);
          const lines = [...$('#intro-selection').getClientRects()];
          const first = lines[0];
          const last = lines.at(-1);
          const root = $('#intro-browser').getBoundingClientRect();
          await a.point(first.left - root.left, first.top - root.top + 8);
          await Promise.all([
            a.animate(
              '#intro-selection',
              [{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }],
              800
            ),
            a.point(last.right - root.left - 4, last.bottom - root.top - 4, 800)
          ]);
          $('#intro-selection').classList.add('is-selected');
          await a.wait(1000);
          await a.press('#intro-selection');
        }
      },
      {
        caption: 'Right-click, then choose Summarize selection.',
        async run(a) {
          await a.wait(800);
          await a.move('#intro-summarize');
          await a.press('#intro-summarize');
          await a.wait(450);
        }
      },
      {
        caption: 'A concise summary appears without leaving the page.',
        async run(a) {
          $('#intro-menu').hidden = true;
          introCard.update({ kind: 'loading' });
          await a.wait(1000);
          introCard.update({ kind: 'summary', text: exampleSummary });
          await a.wait(1400);
        }
      }
    ],
    finished: 'Read the summary without leaving the page.'
  });

  function studioScene(index) {
    $('#create-overlay').hidden = index !== 1;
    $('#project-overlay').hidden = index !== 2;
    $('#copy-overlay').hidden = index !== 3;
    $('#mock-options').hidden = true;
    $('#mock-project-option').hidden = true;
    $('#mock-new-project').hidden = false;
    $('#mock-name').textContent = 'Select Summary';
    $('#mock-project-name').textContent = 'Select Summary';
    $('#mock-project-label').textContent = 'Create project';
    $('#mock-copy').lastChild.textContent = 'Copy';
  }
  function projectOptions(existing) {
    $('#mock-options').hidden = false;
    $('#mock-options').style.top =
      `${$('#mock-project').offsetTop + $('#mock-project').offsetHeight + 5}px`;
    $('#mock-project-option').hidden = !existing;
    $('#mock-new-project').hidden = existing;
  }
  const studio = createTrack('studio', {
    root: '#studio-guide',
    cursor: '#studio-cursor',
    caption: '#guide-caption',
    paint: studioScene,
    scenes: [
      {
        caption:
          'Open API Keys in Google AI Studio, then choose Create API key.',
        ...timeline([
          ['wait', 1300],
          ['move', '#mock-create', 650],
          ['press', '#mock-create'],
          ['wait', 450]
        ])
      },
      {
        caption:
          'Name your key, then choose a project. Already have one? You can use it.',
        ...timeline([
          () => {
            $('#mock-name').textContent = '';
          },
          ['wait', 700],
          ['move', '#mock-name'],
          ['type', '#mock-name', 'Select Summary'],
          ['wait', 650],
          ['move', '#mock-project'],
          ['press', '#mock-project', () => projectOptions(false)],
          ['wait', 700],
          ['move', '#mock-new-project'],
          ['press', '#mock-new-project']
        ])
      },
      {
        caption:
          'For a new project, give it a name and select it for your key.',
        ...timeline([
          () => {
            $('#mock-project-name').textContent = '';
          },
          ['wait', 850],
          ['move', '#mock-project-name'],
          ['type', '#mock-project-name', 'Select Summary'],
          ['wait', 650],
          ['move', '#mock-project-create'],
          [
            'press',
            '#mock-project-create',
            () => {
              studioScene(1);
              projectOptions(true);
            }
          ],
          ['wait', 750],
          ['move', '#mock-project-option'],
          [
            'press',
            '#mock-project-option',
            () => {
              $('#mock-options').hidden = true;
              $('#mock-project-label').textContent = 'Select Summary';
            }
          ],
          ['wait', 700],
          ['move', '#mock-create-confirm'],
          ['press', '#mock-create-confirm']
        ])
      },
      {
        caption:
          'Copy the new key. Keep project billing disabled to use an eligible free tier.',
        ...timeline([
          ['wait', 1000],
          ['move', '#mock-copy'],
          [
            'press',
            '#mock-copy',
            () => {
              $('#mock-copy').lastChild.textContent = 'Copied';
            }
          ],
          ['wait', 1500]
        ])
      }
    ],
    finished:
      'Return here, paste your key in the real form, and choose Connect Gemini.'
  });
  document.querySelectorAll('[data-guide-scene]').forEach((button) => {
    button.addEventListener('click', () =>
      reducedMotion.matches
        ? studio.staticScene(Number(button.dataset.guideScene))
        : studio.playScene(Number(button.dataset.guideScene))
    );
  });

  createTrack('pin', {
    root: '#pin-illustration',
    cursor: '#pin-cursor',
    caption: '#pin-caption',
    paint(index) {
      $('#pin-menu').hidden = index === 0;
      $('#pinned-example').hidden = index < 2;
      $('#pin-example').classList.toggle('is-pinned', index >= 2);
    },
    scenes: [
      {
        caption: 'Open Extensions in your browser toolbar.',
        async run(a) {
          await a.wait(1000);
          await a.move('#pin-extensions', 700);
          await a.press('#pin-extensions', () => {
            $('#pin-menu').hidden = false;
          });
          await a.wait(600);
        }
      },
      {
        caption: 'Find Select Summary and click the pin beside its name.',
        async run(a) {
          await a.wait(800);
          await a.move('#pin-example', 600);
          await a.press('#pin-example', () => {
            $('#pin-example').classList.add('is-pinned');
            $('#pinned-example').hidden = false;
          });
          await a.wait(1000);
        }
      },
      {
        caption: 'The icon stays in your toolbar, ready when you need it.',
        async run(a) {
          await a.wait(1300);
        }
      }
    ],
    finished:
      'Use your browser toolbar to pin it. You can also finish without pinning.'
  });

  reducedMotion.addEventListener('change', () =>
    tracks.forEach((track) =>
      track.motionChanged(
        !reducedMotion.matches && !document.hidden && track === active
      )
    )
  );
  return {
    show(step) {
      const next = tracks.get(
        step === 0 ? 'intro' : step === 1 ? 'studio' : step === 3 ? 'pin' : ''
      );
      if (active !== next) active?.suspend();
      active = next;
      active?.show();
    },
    suspend() {
      active?.suspend();
    },
    resume() {
      active?.resume();
    },
    resize() {
      active?.resize();
    },
    stop() {
      tracks.forEach((track) => track.stop());
      introCard.destroy();
    }
  };
}
