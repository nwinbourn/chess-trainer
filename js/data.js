import { writeFile } from './storage.js';

export const WEEKLY_TASKS = {
  0: [
    { id: 'sun_puzzles', text: 'Puzzles (10 min)', note: 'No games today — rest day' },
    { id: 'sun_video', text: 'Watch targeted video on this week\'s weakness', note: 'Bartholomew fundamentals or specific Gotham topic' },
  ],
  1: [
    { id: 'mon_puzzles', text: 'Puzzles (10 min)', note: 'Calculate the full line before clicking' },
    { id: 'mon_vision', text: 'Board Vision — Chess Tempo (5 min)', note: 'Square recognition trainer' },
    { id: 'mon_opening', text: 'Ruy Lopez study — interactive drills only', note: 'Skip videos, do the move-finding drills' },
    { id: 'mon_games', text: '1–2 games + full Platinum review', note: 'Find the turning point, not just the final blunder' },
  ],
  2: [
    { id: 'tue_puzzles', text: 'Puzzles (10 min)', note: 'Calculate before clicking' },
    { id: 'tue_vision', text: 'Board Vision — Chess Tempo (5 min)', note: '' },
    { id: 'tue_endgame', text: 'Endgame drill — Lucena position', note: 'Repeat until it feels automatic' },
    { id: 'tue_games', text: '1–2 games + review', note: '' },
  ],
  3: [
    { id: 'wed_puzzles', text: 'Puzzles (10 min)', note: '' },
    { id: 'wed_vision', text: 'Board Vision — Chess Tempo (5 min)', note: '' },
    { id: 'wed_opening', text: 'Sicilian — best variation drills', note: 'Check Platinum opening report to confirm your best line' },
    { id: 'wed_review', text: 'Deep review of 1 loss — full analysis', note: 'Ask: why did I think my move was good?' },
  ],
  4: [
    { id: 'thu_puzzles', text: 'Puzzles (10 min)', note: '' },
    { id: 'thu_vision', text: 'Board Vision — Chess Tempo (5 min)', note: '' },
    { id: 'thu_endgame', text: 'Endgame — K+P opposition + triangulation', note: '' },
    { id: 'thu_games', text: '1–2 games + review', note: '' },
  ],
  5: [
    { id: 'fri_puzzles', text: 'Puzzles (10 min)', note: '' },
    { id: 'fri_vision', text: 'Board Vision — Chess Tempo (5 min)', note: '' },
    { id: 'fri_opening', text: 'Petrov / Stafford trap lines', note: '' },
    { id: 'fri_games', text: '2–3 games + full Platinum review', note: '' },
  ],
  6: [
    { id: 'sat_puzzles', text: 'Longer puzzle session (15 min)', note: 'Take your time on each one' },
    { id: 'sat_vision', text: 'Board Vision — Chess Tempo (10 min)', note: '' },
    { id: 'sat_games', text: '3–4 games, unhurried review', note: 'Quality over volume — no tilting' },
  ],
};

export const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const today = new Date();
today.setHours(0, 0, 0, 0);

export const state = {
  selectedDate: new Date(today),
  calMonth: today.getMonth(),
  calYear: today.getFullYear(),
  activeTab: 'checklist',
};

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getLast5Months() {
  const months = [];
  for (let i = 4; i >= 0; i--) {
    const t = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ key: toMonthKey(t), label: `${MONTH_SHORT[t.getMonth()]} ${t.getFullYear()}` });
  }
  return months;
}

export function getData() {
  try { return JSON.parse(localStorage.getItem('chess_tracker_v2') || '{}'); }
  catch { return {}; }
}

export function saveData(data) {
  localStorage.setItem('chess_tracker_v2', JSON.stringify(data));
  writeFile(data, getMonthlyRatings());
}

export function getDayData(ds) {
  const d = getData()[ds];
  return d ? d : { tasks: {}, notes: '', reviews: [] };
}

export function saveDayData(ds, dd) {
  const data = getData();
  data[ds] = dd;
  saveData(data);
}

export function getMonthlyRatings() {
  try { return JSON.parse(localStorage.getItem('chess_monthly_ratings') || '{}'); }
  catch { return {}; }
}

export function saveMonthlyRatings(r) {
  localStorage.setItem('chess_monthly_ratings', JSON.stringify(r));
  writeFile(getData(), r);
}

export function isDayComplete(ds, dow) {
  const dd = getDayData(ds);
  const tasks = WEEKLY_TASKS[dow] || [];
  return tasks.length > 0 && tasks.every(t => dd.tasks[t.id]);
}

export function dayHasData(ds) {
  const dd = getDayData(ds);
  return dd.notes !== '' || Object.values(dd.tasks).some(Boolean) || dd.reviews.length > 0;
}
