import { state, today, toDateStr, getDayData, saveDayData, getData, getMonthlyRatings,
         getAppName, saveAppName, getChessUsername, saveChessUsername } from './data.js';
import { clearApiCache } from './chess-api.js';
import { renderCalendar } from './calendar.js';
import { renderGraph } from './graph.js';
import { renderWorkspace, renderChecklist, renderReviews } from './workspace.js';
import { initStorage, reconnect, createNewFile, openExistingFile, readFile, getFileName, writeFile } from './storage.js';

// ── LOGO: editable name + Chess.com username ──

const appNameEl      = document.getElementById('app-name');
const chessUsernameEl = document.getElementById('chess-username');

function preventNewline(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
}

appNameEl.addEventListener('keydown', preventNewline);
appNameEl.addEventListener('blur', () => {
  const val = appNameEl.textContent.trim() || 'Noah';
  appNameEl.textContent = val;
  saveAppName(val);
});

chessUsernameEl.addEventListener('keydown', preventNewline);
chessUsernameEl.addEventListener('blur', () => {
  const val = chessUsernameEl.textContent.trim() || 'Monkes_Gambit';
  chessUsernameEl.textContent = val;
  saveChessUsername(val);
  clearApiCache();   // invalidate cached ratings for the old username
  renderGraph();     // re-fetch with new username
});

// ── CALENDAR NAVIGATION ──

document.getElementById('prev-month').addEventListener('click', () => {
  state.calMonth--;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
  state.calMonth++;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  renderCalendar();
});

document.getElementById('today-btn').addEventListener('click', () => {
  flushNotes();
  state.selectedDate = new Date(today);
  state.calMonth = today.getMonth();
  state.calYear = today.getFullYear();
  renderCalendar();
  renderWorkspace();
});

// Calendar day click (event delegation — cells have data-date set by renderCalendar)
document.getElementById('cal-grid').addEventListener('click', e => {
  const cell = e.target.closest('.cal-day:not(.empty)');
  if (!cell) return;
  flushNotes();
  const [y, m, d] = cell.dataset.date.split('-').map(Number);
  state.selectedDate = new Date(y, m - 1, d);
  renderCalendar();
  renderWorkspace();
});

// ── TABS ──

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.activeTab = btn.dataset.tab;
    document.getElementById(`tab-${state.activeTab}`).classList.add('active');
  });
});

// ── TASKS (event delegation — items have data-task-id and data-ds set by renderChecklist) ──

document.getElementById('task-list').addEventListener('click', e => {
  const item = e.target.closest('.task-item');
  if (!item) return;
  const { taskId, ds } = item.dataset;
  const dow = state.selectedDate.getDay();
  const current = getDayData(ds);
  current.tasks[taskId] = !current.tasks[taskId];
  saveDayData(ds, current);
  renderChecklist(ds, dow, getDayData(ds));
  renderCalendar();
});

// ── NOTES ──

let notesTimer;
let pendingNoteSave = null;

function flushNotes() {
  if (pendingNoteSave) {
    clearTimeout(notesTimer);
    pendingNoteSave();
    pendingNoteSave = null;
  }
}

document.getElementById('daily-notes').addEventListener('input', e => {
  clearTimeout(notesTimer);
  const ds = toDateStr(state.selectedDate);
  const value = e.target.value; // capture now, not at timeout time
  pendingNoteSave = () => {
    const dd = getDayData(ds);
    dd.notes = value;
    saveDayData(ds, dd);
  };
  notesTimer = setTimeout(() => {
    pendingNoteSave?.();
    pendingNoteSave = null;
  }, 500);
});

// ── REVIEWS ──

document.getElementById('add-review-btn').addEventListener('click', () => {
  const ds = toDateStr(state.selectedDate);
  const dd = getDayData(ds);
  dd.reviews.push({ pgn: '', result: null, accuracy: '', perf: '', notes: '' });
  saveDayData(ds, dd);
  renderReviews(ds, dd);
  if (state.activeTab !== 'reviews') {
    document.querySelector('[data-tab="reviews"]').click();
  }
});

// ── RESIZE ──

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderGraph, 80);
});

// ── FILE STORAGE ──

function updateFileBar(status) {
  const dot = document.getElementById('file-dot');
  const label = document.getElementById('file-label');
  const newBtn = document.getElementById('file-new-btn');
  const openBtn = document.getElementById('file-open-btn');
  const reconnectBtn = document.getElementById('file-reconnect-btn');

  dot.className = 'file-dot ' + status;

  if (status === 'connected') {
    label.textContent = getFileName();
    newBtn.hidden = true;
    openBtn.hidden = true;
    reconnectBtn.hidden = true;
  } else if (status === 'error') {
    label.textContent = 'Write failed — data unsaved';
    newBtn.hidden = true;
    openBtn.hidden = true;
    reconnectBtn.hidden = true;
  } else if (status === 'needs-permission') {
    label.textContent = getFileName();
    newBtn.hidden = true;
    openBtn.hidden = true;
    reconnectBtn.hidden = false;
  } else {
    label.textContent = 'No save file';
    newBtn.hidden = false;
    openBtn.hidden = false;
    reconnectBtn.hidden = true;
  }
}

document.getElementById('file-new-btn').addEventListener('click', async () => {
  const ok = await createNewFile();
  if (!ok) return;
  await writeFile(getData(), getMonthlyRatings());
  updateFileBar('connected');
});

document.getElementById('file-open-btn').addEventListener('click', async () => {
  const ok = await openExistingFile();
  if (!ok) return;
  const fileData = await readFile();
  if (fileData) {
    if (fileData.days) localStorage.setItem('chess_tracker_v2', JSON.stringify(fileData.days));
    if (fileData.ratings) localStorage.setItem('chess_monthly_ratings', JSON.stringify(fileData.ratings));
    renderCalendar();
    renderWorkspace();
    renderGraph();
  }
  updateFileBar('connected');
});

document.getElementById('file-reconnect-btn').addEventListener('click', async () => {
  const ok = await reconnect();
  if (ok) updateFileBar('connected');
});

window.addEventListener('file-write-error', () => updateFileBar('error'));
window.addEventListener('file-write-ok', () => {
  if (document.getElementById('file-dot').classList.contains('error')) {
    updateFileBar('connected');
  }
});

// ── INIT ──

async function init() {
  const status = await initStorage();
  updateFileBar(status);

  if (status === 'connected') {
    const fileData = await readFile();
    if (fileData) {
      if (fileData.days) localStorage.setItem('chess_tracker_v2', JSON.stringify(fileData.days));
      if (fileData.ratings) localStorage.setItem('chess_monthly_ratings', JSON.stringify(fileData.ratings));
    } else {
      // File exists but is empty — write current localStorage data into it
      writeFile(getData(), getMonthlyRatings());
    }
  }

  // Populate editable logo fields from storage
  appNameEl.textContent      = getAppName();
  chessUsernameEl.textContent = getChessUsername();

  renderCalendar();
  renderWorkspace();
  renderGraph();
}

init();
