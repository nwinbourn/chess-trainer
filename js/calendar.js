import { state, today, toDateStr, getData, getTasksForDay, MONTH_NAMES } from './data.js';

export function renderCalendar() {
  document.getElementById('cal-title').textContent = `${MONTH_NAMES[state.calMonth]} ${state.calYear}`;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  const firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
  const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  const selStr = toDateStr(state.selectedDate);
  const allData = getData(); // single localStorage parse for the whole render

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(state.calYear, state.calMonth, d);
    const ds = toDateStr(date);
    const dow = date.getDay();
    const dayData = allData[ds] || { tasks: {}, notes: '', reviews: [] };
    const tasks = getTasksForDay(dow);

    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;
    cell.dataset.date = ds;

    const complete = tasks.length > 0 && tasks.every(t => dayData.tasks[t.id]);
    const hasData = dayData.notes !== '' || Object.values(dayData.tasks).some(Boolean) || dayData.reviews.length > 0;

    if (complete) cell.classList.add('complete');
    else if (hasData) cell.classList.add('has-data');
    if (date.getTime() === today.getTime()) cell.classList.add('today');
    if (ds === selStr) cell.classList.add('selected');

    grid.appendChild(cell);
  }
}
