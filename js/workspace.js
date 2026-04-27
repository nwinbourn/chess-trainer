import { state, today, toDateStr, getDayData, saveDayData,
         getTasks, saveTasks, getTasksForDay, DAY_NAMES, MONTH_NAMES } from './data.js';

const DAY_ABBR = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

function debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── WORKSPACE ────────────────────────────────────────────────────────────────

export function renderWorkspace() {
  const ds  = toDateStr(state.selectedDate);
  const dow = state.selectedDate.getDay();
  const dd  = getDayData(ds);

  document.getElementById('selected-day-label').textContent =
    `${DAY_NAMES[dow]}, ${MONTH_NAMES[state.selectedDate.getMonth()]} ${state.selectedDate.getDate()}`;

  const isToday = ds === toDateStr(today);
  document.getElementById('selected-day-sub').textContent =
    isToday ? 'Today' : state.selectedDate > today ? 'Upcoming' : 'Past Day';

  // If task manager is open, close it first so we don't show stale state
  closeTaskManager(false);
  renderChecklist(ds, dow, dd);
  renderReviews(ds, dd);
  document.getElementById('daily-notes').value = dd.notes || '';
}

// ── CHECKLIST ────────────────────────────────────────────────────────────────

export function renderChecklist(ds, dow, dd) {
  const tasks = getTasksForDay(dow);
  const done  = tasks.filter(t => dd.tasks[t.id]).length;
  const pct   = tasks.length > 0 ? (done / tasks.length) * 100 : 0;

  document.getElementById('completion-fill').style.width = pct + '%';
  document.getElementById('completion-count').textContent = `${done} / ${tasks.length}`;

  const list = document.getElementById('task-list');
  list.innerHTML = '';

  if (!tasks.length) {
    list.innerHTML = '<div class="no-reviews" style="padding:16px 0">No tasks for this day — click Edit Tasks to add some</div>';
    return;
  }

  tasks.forEach(task => {
    const isDone = !!dd.tasks[task.id];
    const item = document.createElement('div');
    item.className = `task-item${isDone ? ' done' : ''}`;
    item.dataset.taskId = task.id;
    item.dataset.ds = ds;
    item.innerHTML = `
      <div class="task-checkbox"></div>
      <div style="flex:1">
        <div class="task-text">${escHtml(task.text)}</div>
        ${task.note ? `<div class="task-note">${escHtml(task.note)}</div>` : ''}
      </div>`;
    list.appendChild(item);
  });
}

// ── TASK MANAGER ─────────────────────────────────────────────────────────────

let editingTaskId = null;   // null = adding new, string = editing existing
let activeTMDay   = 0;      // 0–6, which day tab is selected in the task manager

export function openTaskManager() {
  activeTMDay = state.selectedDate.getDay();   // open on the currently viewed day
  document.getElementById('checklist-view').hidden = true;
  const mgr = document.getElementById('task-manager');
  mgr.hidden = false;
  renderManager();
}

function closeTaskManager(reRender = true) {
  document.getElementById('task-manager').hidden = true;
  document.getElementById('checklist-view').hidden = false;
  editingTaskId = null;
  if (reRender) {
    const ds  = toDateStr(state.selectedDate);
    const dow = state.selectedDate.getDay();
    renderChecklist(ds, dow, getDayData(ds));
  }
}

function renderManager() {
  const allTasks   = getTasks();
  const dayTasks   = allTasks.filter(t => t.days.includes(activeTMDay));
  const dayName    = DAY_NAMES[activeTMDay];
  const mgr        = document.getElementById('task-manager');

  const tabsHTML = DAY_ABBR.map((abbr, i) =>
    `<button class="tm-day-tab${i === activeTMDay ? ' active' : ''}" data-day="${i}">${abbr}</button>`
  ).join('');

  const listHTML = dayTasks.length
    ? dayTasks.map(t => taskRowHTML(t)).join('')
    : `<div class="tm-empty">No tasks for ${dayName} — click Add Task to create one</div>`;

  mgr.innerHTML = `
    <div class="tm-header">
      <span class="tm-title">Edit Tasks</span>
      <button id="tm-done-btn" class="tm-done-btn">← Done</button>
    </div>

    <div class="tm-day-tabs">${tabsHTML}</div>

    <div id="tm-form-area"></div>

    <div id="tm-task-list" class="tm-task-list">${listHTML}</div>

    <button id="tm-add-btn" class="tm-add-btn">+ Add Task for ${dayName}</button>`;

  mgr.querySelector('#tm-done-btn').addEventListener('click', () => closeTaskManager(true));
  mgr.querySelector('#tm-add-btn').addEventListener('click', () => openForm(null));

  // Day tab switching
  mgr.querySelectorAll('.tm-day-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTMDay = Number(btn.dataset.day);
      renderManager();
    });
  });

  // Edit / delete buttons via delegation
  mgr.querySelector('#tm-task-list').addEventListener('click', e => {
    const editBtn   = e.target.closest('.tm-edit-btn');
    const deleteBtn = e.target.closest('.tm-delete-btn');

    if (editBtn) {
      const id = editBtn.dataset.id;
      openForm(getTasks().find(t => t.id === id) || null);
    }
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (!confirm('Delete this task? Completion history for this task will be preserved in existing days.')) return;
      const updated = getTasks().filter(t => t.id !== id);
      saveTasks(updated);
      renderManager();
    }
  });
}

function taskRowHTML(t) {
  // Show which other days this task also appears on (compact, secondary info)
  const otherDays = t.days.filter(d => d !== activeTMDay);
  const alsoOn = otherDays.length
    ? `<span class="tm-row-also">also: ${otherDays.map(d => DAY_ABBR[d]).join(' ')}</span>`
    : '';
  return `
    <div class="tm-task-row" data-id="${escHtml(t.id)}">
      <div class="tm-row-text">
        <div class="tm-row-title">${escHtml(t.text)}${alsoOn}</div>
        ${t.note ? `<div class="tm-row-note">${escHtml(t.note)}</div>` : ''}
      </div>
      <div class="tm-row-actions">
        <button class="tm-edit-btn" data-id="${escHtml(t.id)}">✎</button>
        <button class="tm-delete-btn" data-id="${escHtml(t.id)}">✕</button>
      </div>
    </div>`;
}

function openForm(task) {
  // task = null means "add new" — pre-select the active tab day
  editingTaskId = task ? task.id : null;
  const selectedDays = task ? task.days : [activeTMDay];

  const formArea = document.getElementById('tm-form-area');
  formArea.innerHTML = `
    <div class="tm-form">
      <div class="tm-form-field">
        <label class="tm-form-label">Days</label>
        <div class="tm-day-toggles">
          ${DAY_ABBR.map((abbr, i) =>
            `<button type="button" class="tm-day-btn${selectedDays.includes(i) ? ' on' : ''}" data-day="${i}">${abbr}</button>`
          ).join('')}
        </div>
      </div>
      <div class="tm-form-field">
        <label class="tm-form-label">Title</label>
        <input id="tm-title" class="tm-form-input" placeholder="e.g. Puzzles (10 min)" value="${escHtml(task?.text || '')}">
      </div>
      <div class="tm-form-field">
        <label class="tm-form-label">Note <span style="opacity:.5">(optional)</span></label>
        <input id="tm-note" class="tm-form-input" placeholder="e.g. Calculate before clicking" value="${escHtml(task?.note || '')}">
      </div>
      <div class="tm-form-actions">
        <button id="tm-cancel" class="tm-cancel-btn">Cancel</button>
        <button id="tm-save" class="tm-save-btn">${task ? 'Save Changes' : 'Add Task'}</button>
      </div>
    </div>`;

  // Day toggle buttons
  formArea.querySelectorAll('.tm-day-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('on'));
  });

  formArea.querySelector('#tm-cancel').addEventListener('click', () => {
    formArea.innerHTML = '';
    editingTaskId = null;
  });

  formArea.querySelector('#tm-save').addEventListener('click', () => saveForm(formArea));
}

function saveForm(formArea) {
  const text = formArea.querySelector('#tm-title').value.trim();
  if (!text) {
    formArea.querySelector('#tm-title').focus();
    return;
  }

  const days = [...formArea.querySelectorAll('.tm-day-btn.on')]
    .map(b => Number(b.dataset.day));

  if (!days.length) {
    alert('Please select at least one day.');
    return;
  }

  const note  = formArea.querySelector('#tm-note').value.trim();
  const tasks = getTasks();

  if (editingTaskId) {
    // Update existing
    const idx = tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], text, note, days };
  } else {
    // Add new — ID is timestamp + small random suffix
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    tasks.push({ id, text, note, days });
  }

  saveTasks(tasks);
  editingTaskId = null;
  renderManager();   // re-render list, form clears
}

// ── REVIEWS ──────────────────────────────────────────────────────────────────

export function renderReviews(ds, dd) {
  const reviews = dd.reviews || [];
  document.getElementById('reviews-count').textContent =
    `${reviews.length} ${reviews.length === 1 ? 'Review' : 'Reviews'}`;

  const list = document.getElementById('reviews-list');
  list.innerHTML = '';

  if (!reviews.length) {
    list.innerHTML = '<div class="no-reviews">No game reviews for this day.<br>Add one using the button above.</div>';
    return;
  }

  reviews.forEach((rev, idx) => {
    const rc   = rev.result ? `result-${rev.result}` : 'result-none';
    const rt   = rev.result || '—';
    const meta = [
      rev.accuracy ? `${rev.accuracy}% acc` : null,
      rev.perf     ? `${rev.perf} perf`     : null,
    ].filter(Boolean).join(' · ') || 'No stats';

    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="review-card-header">
        <span class="review-num">Game ${idx + 1}</span>
        <span class="result-badge ${rc}">${rt}</span>
        <span class="review-meta">${meta}</span>
        <button class="review-collapse-btn">▾</button>
        <button class="delete-review-btn">✕</button>
      </div>
      <div class="review-body">
        <div class="review-stats-row">
          <div class="review-field">
            <div class="review-field-label">Result</div>
            <div class="result-selector">
              <button class="result-btn${rev.result === 'W' ? ' sel-W' : ''}">W</button>
              <button class="result-btn${rev.result === 'L' ? ' sel-L' : ''}">L</button>
              <button class="result-btn${rev.result === 'D' ? ' sel-D' : ''}">D</button>
            </div>
          </div>
          <div class="review-field">
            <div class="review-field-label">Accuracy %</div>
            <input class="review-input" type="number" placeholder="87" min="0" max="100" value="${rev.accuracy || ''}">
          </div>
          <div class="review-field">
            <div class="review-field-label">Performance Rating</div>
            <input class="review-input" type="number" placeholder="1220" min="400" max="3000" value="${rev.perf || ''}">
          </div>
        </div>
        <div class="review-field review-field-full">
          <div class="review-field-label">PGN / Notation</div>
          <textarea class="review-textarea pgn-textarea" placeholder="Paste PGN or notation here...">${rev.pgn || ''}</textarea>
        </div>
        <div class="review-field">
          <div class="review-field-label">Notes — What I Learned / Missed</div>
          <textarea class="review-textarea" placeholder="Key moments, mistakes, patterns noticed, what I'd play differently...">${rev.notes || ''}</textarea>
        </div>
      </div>`;

    card.querySelector('.review-card-header').addEventListener('click', e => {
      if (e.target.closest('.delete-review-btn') || e.target.closest('.result-btn')) return;
      const body = card.querySelector('.review-body');
      const btn  = card.querySelector('.review-collapse-btn');
      body.classList.toggle('collapsed');
      btn.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
    });

    card.querySelector('.delete-review-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Delete this game review?')) return;
      const current = getDayData(ds);
      current.reviews.splice(idx, 1);
      saveDayData(ds, current);
      renderReviews(ds, getDayData(ds));
    });

    const resultBtns = card.querySelectorAll('.result-btn');
    ['W', 'L', 'D'].forEach((r, i) => {
      resultBtns[i].addEventListener('click', e => {
        e.stopPropagation();
        const current = getDayData(ds);
        current.reviews[idx].result = current.reviews[idx].result === r ? null : r;
        saveDayData(ds, current);
        renderReviews(ds, getDayData(ds));
      });
    });

    const [accuracyInput, perfInput] = card.querySelectorAll('.review-input');
    accuracyInput.addEventListener('change', () => {
      const current = getDayData(ds);
      current.reviews[idx].accuracy = accuracyInput.value;
      saveDayData(ds, current);
    });
    perfInput.addEventListener('change', () => {
      const current = getDayData(ds);
      current.reviews[idx].perf = perfInput.value;
      saveDayData(ds, current);
    });

    const [pgnArea, notesArea] = card.querySelectorAll('.review-textarea');
    pgnArea.addEventListener('input', debounce(() => {
      const current = getDayData(ds);
      current.reviews[idx].pgn = pgnArea.value;
      saveDayData(ds, current);
    }, 600));
    notesArea.addEventListener('input', debounce(() => {
      const current = getDayData(ds);
      current.reviews[idx].notes = notesArea.value;
      saveDayData(ds, current);
    }, 400));

    list.appendChild(card);
  });
}
