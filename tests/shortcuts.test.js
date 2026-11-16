import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutKeys, matchesShortcut } from '../chrome-extension/shortcuts.js';
import { dashboardMessage, activityStats } from '../chrome-extension/core.js';

test('shortcut guide uses Mac labels and handles Chrome symbol notation', () => {
  assert.deepEqual(shortcutKeys('⌥⇧S', 'mac'), ['Option', 'Shift', 'S']);
  assert.deepEqual(shortcutKeys('Alt+Shift+S', 'win'), ['Alt', 'Shift', 'S']);
  assert.deepEqual(shortcutKeys('', 'mac'), []);
});

test('shortcut matching uses the physical key for Option-modified characters', () => {
  const event = {
    code: 'KeyS',
    key: 'Í',
    altKey: true,
    shiftKey: true,
    metaKey: false,
    ctrlKey: false
  };
  assert(matchesShortcut(event, ['Option', 'Shift', 'S']));
  assert(!matchesShortcut({ ...event, ctrlKey: true }, ['Option', 'Shift', 'S']));
  assert(!matchesShortcut(event, []));
});

test('dashboard headings reflect first use, daily records, and streaks', () => {
  const empty = activityStats({});
  assert.match(dashboardMessage(empty).title, /first summary/);
  assert.match(
    dashboardMessage({ ...empty, total: 10, today: 5, bestDay: 5 }).title,
    /best day/
  );
  assert.match(
    dashboardMessage({ ...empty, total: 10, today: 1, bestDay: 5, currentStreak: 3 })
      .title,
    /3 days/
  );
});
