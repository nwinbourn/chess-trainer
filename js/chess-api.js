const BASE = 'https://api.chess.com/pub/player';

function getUsername() {
  return localStorage.getItem('chess_username') || 'Monkes_Gambit';
}

/** Clear all cached API results (call when the username changes). */
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
 * Returns the current blitz rating (number) or null if unavailable.
 * Cached for 5 minutes.
 */
export async function fetchCurrentBlitzRating() {
  const KEY = 'chess_api_stats';
  const TTL = 5 * 60 * 1000;

  const cached = cacheGet(KEY, TTL);
  if (cached !== undefined) return cached;

  const res = await fetch(`${BASE}/${getUsername()}/stats`);
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  const data = await res.json();

  const rating = data.chess_blitz?.last?.rating ?? null;
  cacheSet(KEY, rating);
  return rating;
}

/**
 * Returns the average blitz rating for the given year/month (1-indexed),
 * or null if no blitz games were played that month.
 * Cached 1 hour for the current month, 24 hours for past months.
 */
export async function fetchMonthAvgRating(year, month) {
  const monthStr = String(month).padStart(2, '0');
  const KEY = `chess_api_month_${year}-${monthStr}`;

  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const TTL = isCurrent ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const cached = cacheGet(KEY, TTL);
  if (cached !== undefined) return cached;

  const username = getUsername();
  const res = await fetch(`${BASE}/${username}/games/${year}/${monthStr}`);

  // 404 = no archive for that month yet
  if (res.status === 404) { cacheSet(KEY, null); return null; }
  if (!res.ok) throw new Error(`Games fetch failed: ${res.status}`);

  const data = await res.json();
  const games = data.games ?? [];
  const lc = username.toLowerCase();

  const ratings = games
    .filter(g => g.time_class === 'blitz')
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
