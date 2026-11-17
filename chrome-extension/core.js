export const VERSION = 4;
export const HISTORY_LIMIT = 10;
export const MAX_INPUT_LENGTH = 50_000;
export const MODEL = 'gemini-3.5-flash-lite';
// Original practice prose. Canada facts were checked against
// https://en.wikipedia.org/wiki/Canada; no Wikipedia text or images are bundled.
// Keeping all demo sources here lets the worker validate selected text without
// accepting arbitrary content or collecting the source page's URL.
function practiceText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

export const DEMO_PAGES = Object.freeze({
  summary: {
    title: 'Select Summary',
    address: 'select-summary.local',
    text: practiceText(`
      Select Summary turns the text you highlight into a short explanation of its
      main ideas. Select a passage on a webpage, right-click, and choose Summarize
      selection, or use your keyboard shortcut. The result appears in a small card
      on the same page, where you can read or copy it. Your recent summaries and
      daily activity stay on your device. Requests go directly to Google using your
      own Gemini key; there is no Select Summary account or developer server.
    `)
  },
  store: {
    title: 'Select Summary – Chrome Web Store',
    address:
      'chromewebstore.google.com/detail/select-summary/cmhemijfkgdmehimocompddmibmbndfd',
    text: practiceText(`
      Select Summary is a Chrome extension for reading highlighted text more
      quickly. It uses Gemini to produce a concise summary, then displays the result
      without leaving the webpage. You can copy the summary and revisit recent
      results in your local history. A dashboard tracks daily summaries, reading
      streaks, and estimated time saved. The extension is free, has no
      advertisements or analytics, and connects directly to Google with a key you
      provide. Google’s API terms and free-tier limits apply.
    `)
  },
  canada: {
    title: 'Canada – Wikipedia',
    address: 'en.wikipedia.org/wiki/Canada',
    text: practiceText(`
      Canada occupies the northern part of North America and includes ten provinces
      and three territories. Its shores meet the Atlantic, Pacific, and Arctic
      oceans, and its total area makes it the world’s second-largest country. Ottawa
      serves as the capital, while Toronto is the largest city. Much of the
      population lives in urban areas, with many communities concentrated near the
      southern border. English and French have official status at the federal level.
      Indigenous peoples lived across these lands for thousands of years before
      European settlement. Confederation in 1867 brought together the first four
      provinces, and the country later expanded to its present boundaries. Canada
      combines a parliamentary democracy with a constitutional monarchy, with
      responsibilities divided between federal and provincial governments. Its
      landscapes range from mountain ranges and prairie grasslands to extensive
      forests and Arctic tundra. These differences in geography, climate, language,
      and history shape the country’s regional identities.
    `)
  }
});
export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Segment words by language rather than assuming all text uses spaces.
export function wordCount(text) {
  return [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)].filter(
    (part) => part.isWordLike
  ).length;
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Noon avoids DST transitions when stepping through local calendar dates.
export function shiftDay(date, amount) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

export function initialState() {
  return {
    version: VERSION,
    key: null,
    keyValidated: false,
    credentialRevision: 0,
    history: [],
    activity: {},
    onboarding: { version: 1, step: 1, completed: false, sandboxComplete: false },
    milestones: { firstSummary: false }
  };
}

export function migrateState(data) {
  if (data.appState?.version === VERSION) return data.appState;
  if (data.appState) {
    if (data.appState.version !== 3)
      throw new AppError(
        'VERSION',
        'This local data needs a compatible extension version.'
      );
    const { onboardingStep, tutorialStep, tutorialComplete, ...previous } = data.appState;
    const hasActivity = activityStats(previous.activity || {}).total > 0;
    const sandboxComplete = Boolean(tutorialStep >= 1 && hasActivity);
    return {
      ...initialState(),
      ...previous,
      version: VERSION,
      onboarding: {
        version: 1,
        step: !previous.keyValidated ? 1 : sandboxComplete ? 3 : 2,
        completed: Boolean(tutorialComplete && previous.key),
        sandboxComplete
      },
      milestones: { firstSummary: hasActivity }
    };
  }
  const state = initialState();
  state.key =
    typeof data.geminiApiKey === 'string' ? data.geminiApiKey.trim() || null : null;
  // Preserve completed legacy installations without inventing historical XP.
  state.onboarding.completed = Boolean(state.key);
  state.history = (Array.isArray(data.summaries) ? data.summaries : [])
    .flatMap((entry, index) => {
      const text = typeof entry === 'string' ? entry : entry?.text;
      if (typeof text !== 'string' || !text.trim()) return [];
      return [
        {
          id: `legacy-${index}`,
          text,
          timestamp:
            Number.isFinite(entry?.timestamp) && entry.timestamp > 0
              ? entry.timestamp
              : null,
          sourceWords: null,
          summaryWords: wordCount(text)
        }
      ];
    })
    .slice(0, HISTORY_LIMIT);
  return state;
}

// History is bounded; daily aggregates survive when old summaries are pruned.
export function addSummary(state, text, sourceWords, timestamp, id) {
  if (state.history.some((item) => item.id === id)) return state;
  const summaryWords = wordCount(text);
  const secondsSaved = Math.max(0, ((sourceWords - summaryWords) / 225) * 60);
  const day = dayKey(new Date(timestamp));
  const previous = state.activity[day] || { count: 0, secondsSaved: 0 };
  return {
    ...state,
    keyValidated: true,
    milestones: { ...state.milestones, firstSummary: true },
    history: [{ id, text, timestamp, sourceWords, summaryWords }, ...state.history].slice(
      0,
      HISTORY_LIMIT
    ),
    activity: {
      ...state.activity,
      [day]: {
        count: previous.count + 1,
        secondsSaved: previous.secondsSaved + secondsSaved
      }
    }
  };
}

export function activityStats(activity, now = new Date()) {
  const days = Object.keys(activity)
    .filter((day) => activity[day].count > 0)
    .sort();
  let bestStreak = 0,
    run = 0,
    previous = null;
  for (const day of days) {
    const date = new Date(`${day}T12:00:00`);
    run = previous && dayKey(shiftDay(previous, 1)) === day ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = date;
  }
  let cursor = activity[dayKey(now)]?.count ? now : shiftDay(now, -1);
  let currentStreak = 0;
  while (activity[dayKey(cursor)]?.count > 0) {
    currentStreak++;
    cursor = shiftDay(cursor, -1);
  }
  return {
    total: days.reduce((sum, day) => sum + activity[day].count, 0),
    today: activity[dayKey(now)]?.count || 0,
    secondsSaved: days.reduce((sum, day) => sum + activity[day].secondsSaved, 0),
    bestDay: Math.max(0, ...days.map((day) => activity[day].count)),
    currentStreak,
    bestStreak
  };
}

export function validateSelection(text) {
  if (typeof text !== 'string' || !text.trim())
    throw new AppError(
      'NO_SELECTION',
      'Highlight some text on a webpage, then right-click and choose Summarize selection.'
    );
  if (text.length > MAX_INPUT_LENGTH)
    throw new AppError(
      'INPUT_LIMIT',
      'Selection too long. Select up to 50,000 characters and try again.'
    );
  return text.trim();
}

// The UI receives a key suffix, never the saved credential itself.
export function publicState(state) {
  return {
    version: state.version,
    keyConfigured: Boolean(state.key),
    keyValidated: state.keyValidated ?? false,
    keySuffix: state.key?.slice(-4) || '',
    history: state.history,
    activity: state.activity,
    onboarding: state.onboarding,
    milestones: state.milestones,
    xp: activityStats(state.activity).total * 50
  };
}

// Dashboard messages describe actual activity rather than generic marketing copy.
export function dashboardMessage(stats) {
  if (!stats.total)
    return {
      title: 'Ready for your first summary?',
      detail: 'Highlight text on a webpage to get started.'
    };
  if (stats.today > 0 && stats.today === stats.bestDay && stats.bestDay > 1)
    return {
      title: 'Your best day so far.',
      detail: `${stats.today} summaries today · ${stats.total} in total.`
    };
  if (stats.currentStreak >= 2)
    return {
      title: `${stats.currentStreak} days in a row.`,
      detail: `${stats.today} summaries today · ${stats.total} in total.`
    };
  if (stats.today)
    return {
      title: `${stats.today} ${stats.today === 1 ? 'summary' : 'summaries'} today.`,
      detail: `${stats.total} in total.`
    };
  return {
    title: 'Welcome back.',
    detail: `${stats.total} summaries so far. Start today’s activity with a selection.`
  };
}

// Only our top-level UI documents may manage credentials or local history.
export function isAppUrl(url, runtime) {
  if (typeof url !== 'string') return false;
  const documentUrl = url.split(/[?#]/)[0];
  return ['popup.html', 'welcome.html'].some(
    (page) => documentUrl === runtime.getURL(page)
  );
}

export function isAppSender(sender, runtime) {
  return sender.id === runtime.id && isAppUrl(sender.url, runtime);
}
