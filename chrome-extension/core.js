export const VERSION = 3;
export const HISTORY_LIMIT = 10;
export const MAX_INPUT_LENGTH = 50_000;
export const MODEL = 'gemini-3.5-flash-lite';
export const SAMPLE_TEXT = 'Urban gardens turn unused spaces into places to grow food. They help neighbors meet, support pollinators, and reduce summer heat. Successful gardens need reliable water, shared maintenance, and plants suited to the local climate.';

export class AppError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function wordCount(text) {
  return [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)]
    .filter(part => part.isWordLike).length;
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftDay(date, amount) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

export function initialState() {
  return { version: VERSION, key: null, credentialRevision: 0, history: [], activity: {}, onboardingStep: 0, introSeen: false };
}

export function migrateState(data) {
  if (data.appState?.version === VERSION) return data.appState;
  const state = initialState();
  state.key = typeof data.geminiApiKey === 'string' ? data.geminiApiKey.trim() || null : null;
  state.history = (Array.isArray(data.summaries) ? data.summaries : []).flatMap((entry, index) => {
    const text = typeof entry === 'string' ? entry : entry?.text;
    if (typeof text !== 'string' || !text.trim()) return [];
    return [{ id: `legacy-${index}`, text, timestamp: Number.isFinite(entry?.timestamp) && entry.timestamp > 0 ? entry.timestamp : null, sourceWords: null, summaryWords: wordCount(text) }];
  }).slice(0, HISTORY_LIMIT);
  return state;
}

export function addSummary(state, text, sourceWords, timestamp, id) {
  if (state.history.some(item => item.id === id)) return state;
  const summaryWords = wordCount(text);
  const secondsSaved = Math.max(0, (sourceWords - summaryWords) / 225 * 60);
  const day = dayKey(new Date(timestamp));
  const previous = state.activity[day] || { count: 0, secondsSaved: 0 };
  return {
    ...state,
    history: [{ id, text, timestamp, sourceWords, summaryWords }, ...state.history].slice(0, HISTORY_LIMIT),
    activity: { ...state.activity, [day]: { count: previous.count + 1, secondsSaved: previous.secondsSaved + secondsSaved } }
  };
}

export function activityStats(activity, now = new Date()) {
  const days = Object.keys(activity).filter(day => activity[day].count > 0).sort();
  let bestStreak = 0, run = 0, previous = null;
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
    bestDay: Math.max(0, ...days.map(day => activity[day].count)), currentStreak, bestStreak
  };
}

export function validateSelection(text) {
  if (typeof text !== 'string' || !text.trim()) throw new AppError('NO_SELECTION', 'Highlight some text on a webpage, then right-click and choose Summarize selection.');
  if (text.length > MAX_INPUT_LENGTH) throw new AppError('INPUT_LIMIT', 'That selection is a little too long. Select up to 50,000 characters and try again.');
  return text.trim();
}

export function publicState(state) {
  return { version: state.version, keyConfigured: Boolean(state.key), keySuffix: state.key?.slice(-4) || '', history: state.history, activity: state.activity, onboardingStep: state.onboardingStep, introSeen: state.introSeen };
}

export function isPopupSender(sender, runtime) {
  return sender.id === runtime.id && sender.url === runtime.getURL('popup.html');
}
