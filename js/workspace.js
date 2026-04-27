import { state, today, toDateStr, getDayData, saveDayData, WEEKLY_TASKS, DAY_NAMES, MONTH_NAMES } from './data.js';

function debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

export function renderWorkspace() {
  const ds = toDateStr(state.selectedDate);
  const dow = state.selectedDate.getDay();
  const dd = getDayData(ds);

  document.getElementById('selected-day-label').textContent =
    `${DAY_NAMES[dow]}, ${MONTH_NAMES[state.selectedDate.getMonth()]} ${state.selectedDate.getDate()}`;

  const isToday = ds === toDateStr(today);
  document.getElementById('selected-day-sub').textContent =
    isToday ? 'Today' : state.selectedDate > today ? 'Upcoming' : 'Past Day';

  renderChecklist(ds, dow, dd);
  renderReviews(ds, dd);
  document.getElementById('daily-notes').value = dd.notes || '';
}

export function renderChecklist(ds, dow, dd) {
  const tasks = WEEKLY_TASKS[dow] || [];
  const done = tasks.filter(t => dd.tasks[t.id]).length;
  const pct = tasks.length > 0 ? (done / tasks.length) * 100 : 0;

  document.getElementById('completion-fill').style.width = pct + '%';
  document.getElementById('completion-count').textContent = `${done} / ${tasks.length}`;

  const list = document.getElementById('task-list');
  list.innerHTML = '';

  if (!tasks.length) {
    list.innerHTML = '<div class="no-reviews" style="padding:16px 0">No tasks for this day</div>';
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
      <div>
        <div class="task-text">${task.text}</div>
        ${task.note ? `<div class="task-note">${task.note}</div>` : ''}
      </div>`;
    list.appendChild(item);
  });
}

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
    const rc = rev.result ? `result-${rev.result}` : 'result-none';
    const rt = rev.result || '—';
    const meta = [
      rev.accuracy ? `${rev.accuracy}% acc` : null,
      rev.perf ? `${rev.perf} perf` : null,
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

    // Header toggle (collapse/expand)
    card.querySelector('.review-card-header').addEventListener('click', e => {
      if (e.target.closest('.delete-review-btn') || e.target.closest('.result-btn')) return;
      const body = card.querySelector('.review-body');
      const btn = card.querySelector('.review-collapse-btn');
      body.classList.toggle('collapsed');
      btn.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
    });

    // Delete
    card.querySelector('.delete-review-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Delete this game review?')) return;
      const current = getDayData(ds);
      current.reviews.splice(idx, 1);
      saveDayData(ds, current);
      renderReviews(ds, getDayData(ds));
    });

    // Result buttons (W / L / D toggle)
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

    // Numeric inputs
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

    // Textareas — debounced input so data saves while typing, not only on blur
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
