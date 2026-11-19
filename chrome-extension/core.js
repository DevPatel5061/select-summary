export const VERSION = 6;
export const INTERFACE_VERSION = 4;
export const HISTORY_LIMIT = 10;
export const HISTORY_LIMITS = Object.freeze([5, 10, 15, 20]);
export const historyLimitFor = (state) =>
  HISTORY_LIMITS.includes(state.historyLimit)
    ? state.historyLimit
    : HISTORY_LIMIT;
export const MAX_INPUT_LENGTH = 50_000;
export const MODEL = 'gemini-3.5-flash-lite';
export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Segment words by language rather than assuming all text uses spaces.
export function wordCount(text) {
  return [
    ...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)
  ].filter((part) => part.isWordLike).length;
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Noon avoids DST transitions when stepping through local calendar dates.
export function shiftDay(date, amount) {
  const shifted = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12
  );
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
    historyLimit: HISTORY_LIMIT,
    activity: {},
    onboarding: { completed: false }
  };
}

export function migrateState(data) {
  if (data.appState?.version === VERSION) return data.appState;
  if (data.appState) {
    const previous = data.appState;
    if (![3, 4, 5].includes(previous.version))
      throw new AppError(
        'VERSION',
        'This local data needs a compatible extension version.'
      );
    // Explicitly project supported fields; obsolete rewards and progress stay out.
    return {
      ...initialState(),
      key: previous.key ?? null,
      keyValidated: previous.keyValidated ?? false,
      credentialRevision: previous.credentialRevision ?? 0,
      history: previous.history ?? [],
      historyLimit: historyLimitFor(previous),
      activity: previous.activity ?? {},
      onboarding: {
        completed:
          previous.version === 3
            ? Boolean(previous.tutorialComplete && previous.key)
            : Boolean(previous.onboarding?.completed)
      }
    };
  }
  const state = initialState();
  state.key =
    typeof data.geminiApiKey === 'string'
      ? data.geminiApiKey.trim() || null
      : null;
  // Preserve completed legacy installations without inventing historical activity.
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
    history: [
      { id, text, timestamp, sourceWords, summaryWords },
      ...state.history
    ].slice(0, historyLimitFor(state)),
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
    secondsSaved: days.reduce(
      (sum, day) => sum + activity[day].secondsSaved,
      0
    ),
    bestDay: Math.max(0, ...days.map((day) => activity[day].count)),
    currentStreak,
    bestStreak
  };
}

export function normalizeSelection(text) {
  return text.replace(/\s+/g, ' ').trim();
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
    historyLimit: historyLimitFor(state),
    activity: state.activity,
    onboarding: state.onboarding
  };
}

// Headlines reflect actual activity; detailed counters are shown in the metrics.
export function dashboardHeadline(stats) {
  if (!stats.total) return 'Ready for your first summary?';
  if (stats.today > 1 && stats.today === stats.bestDay) {
    return 'Your best day so far.';
  }
  if (!stats.today) return 'Ready to summarize something today?';
  if (stats.today === 1) return 'A great start. Keep going.';
  if (stats.today < 5) return 'Keep the momentum going.';
  if (stats.today < 10) return 'You’re making great progress.';

  return 'Impressive work today.';
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
