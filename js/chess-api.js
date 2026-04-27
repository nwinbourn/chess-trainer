const BASE = 'https://api.chess.com/pub/player';

function getUsername() {
  return localStorage.getItem('chess_username') || 'Monkes_Gambit';
}

/** Clear all cached API results (call when the username or mode changes). */
export function clearApiCache() {
  const remove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('chess_api_')) remove.push(k);
  }
  remove.forEach(k => localStorage.removeItem(k));
}

// ── Cache helpers ────────────────────────────────────────────────────────────

function cacheGet(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const { value, fetchedAt } = JSON.parse(raw);
    if (Date.now() - fetchedAt < ttlMs) return value;
  } catch { /* ignore */ }
  return undefined;
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, fetchedAt: Date.now() }));
  } catch { /* ignore */ }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current rating for the given time class ('blitz'|'bullet'|'rapid'),
 * or null if unavailable. Cached for 5 minutes.
 */
export async function fetchCurrentRating(timeClass = 'blitz') {
  const username = getUsername();
  if (!username) return null;

  const KEY = `chess_api_stats_${timeClass}`;
  const TTL = 5 * 60 * 1000;

  const cached = cacheGet(KEY, TTL);
  if (cached !== undefined) return cached;

  const res = await fetch(`${BASE}/${username}/stats`);
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  const data = await res.json();

  // Chess.com keys: chess_blitz, chess_bullet, chess_rapid
  const rating = data[`chess_${timeClass}`]?.last?.rating ?? null;
  cacheSet(KEY, rating);
  return rating;
}

/**
 * Returns raw per-game data for the given month: [{ endTime, rating }].
 * Filters by time class. Returns [] if no archive or no matching games.
 * Cached 1 hour for the current month, 24 hours for past months.
 */
async function fetchMonthGames(year, month, timeClass) {
  const username = getUsername();
  if (!username) return [];

  const monthStr = String(month).padStart(2, '0');
  const KEY = `chess_api_games_${year}-${monthStr}_${timeClass}`;

  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const TTL = isCurrent ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const cached = cacheGet(KEY, TTL);
  if (cached !== undefined) return cached;

  const res = await fetch(`${BASE}/${username}/games/${year}/${monthStr}`);
  if (res.status === 404) { cacheSet(KEY, []); return []; }
  if (!res.ok) throw new Error(`Games fetch failed: ${res.status}`);

  const data = await res.json();
  const lc = username.toLowerCase();
  const games = (data.games ?? [])
    .filter(g => g.time_class === timeClass)
    .map(g => {
      const rating = g.white.username.toLowerCase() === lc ? g.white.rating
                   : g.black.username.toLowerCase() === lc ? g.black.rating
                   : null;
      return rating !== null ? { endTime: g.end_time, rating } : null;
    })
    .filter(Boolean);

  cacheSet(KEY, games);
  return games;
}

/**
 * Returns weekly average ratings over the given months.
 * months: Array<{ year: number, month: number }>
 * Returns: Array<{ weekStart: Date, rating: number }>, sorted chronologically.
 * Only weeks with at least one game are included.
 */
export async function fetchWeeklyRatings(months, timeClass = 'blitz') {
  const perMonth = await Promise.all(
    months.map(({ year, month }) => fetchMonthGames(year, month, timeClass))
  );
  const allGames = perMonth.flat();
  if (allGames.length === 0) return [];

  const WEEK_SECS = 7 * 24 * 60 * 60;
  const buckets = new Map();
  for (const { endTime, rating } of allGames) {
    const weekIndex = Math.floor(endTime / WEEK_SECS);
    if (!buckets.has(weekIndex)) buckets.set(weekIndex, []);
    buckets.get(weekIndex).push(rating);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, ratings]) => ({
      weekStart: new Date(weekIndex * WEEK_SECS * 1000),
      rating: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length),
    }));
}

/**
 * Returns the average rating for the given time class and year/month (1-indexed),
 * or null if no games were played that month.
 * Cached 1 hour for the current month, 24 hours for past months.
 */
export async function fetchMonthAvgRating(year, month, timeClass = 'blitz') {
  const username = getUsername();
  if (!username) return null;

  const monthStr = String(month).padStart(2, '0');
  const KEY = `chess_api_month_${year}-${monthStr}_${timeClass}`;

  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const TTL = isCurrent ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const cached = cacheGet(KEY, TTL);
  if (cached !== undefined) return cached;
  const res = await fetch(`${BASE}/${username}/games/${year}/${monthStr}`);

  // 404 = no archive for that month yet
  if (res.status === 404) { cacheSet(KEY, null); return null; }
  if (!res.ok) throw new Error(`Games fetch failed: ${res.status}`);

  const data = await res.json();
  const games = data.games ?? [];
  const lc = username.toLowerCase();

  const ratings = games
    .filter(g => g.time_class === timeClass)
    .map(g => {
      if (g.white.username.toLowerCase() === lc) return g.white.rating;
      if (g.black.username.toLowerCase() === lc) return g.black.rating;
      return null;
    })
    .filter(r => r !== null);

  const avg = ratings.length > 0
    ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
    : null;

  cacheSet(KEY, avg);
  return avg;
}
