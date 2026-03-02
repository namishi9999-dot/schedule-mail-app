/**
 * storage.js - localStorage ベースのデータ管理（GitHub Pages 用）
 * サーバー版の database.js に相当する機能をブラウザ内で実現
 */

function _nextId(key) {
  const n = parseInt(localStorage.getItem(key + '_seq') || '0') + 1;
  localStorage.setItem(key + '_seq', String(n));
  return n;
}

function _now() {
  return new Date().toLocaleString('ja-JP', { hour12: false })
    .replace(/\//g, '-').replace(' ', ' ').slice(0, 16);
}

function _loadTasks()     { return JSON.parse(localStorage.getItem('tasks') || '[]'); }
function _saveTasks(v)    { localStorage.setItem('tasks', JSON.stringify(v)); }
function _loadRecurring() { return JSON.parse(localStorage.getItem('recurring_tasks') || '[]'); }
function _saveRecurring(v){ localStorage.setItem('recurring_tasks', JSON.stringify(v)); }
function _loadOccs()      { return JSON.parse(localStorage.getItem('task_occurrences') || '[]'); }
function _saveOccs(v)     { localStorage.setItem('task_occurrences', JSON.stringify(v)); }

// ---- tasks ----

function getTasksByDate(date) {
  return _loadTasks().filter(t => t.date === date);
}

function getCompletedTasks() {
  return _loadTasks()
    .filter(t => t.completed)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    .slice(0, 200);
}

function addTask(date, title, description) {
  const tasks = _loadTasks();
  const task = {
    id: _nextId('task'), date, title,
    description: description || '',
    completed: 0, completed_at: null, created_at: _now(),
  };
  tasks.push(task);
  _saveTasks(tasks);
  return task;
}

function completeTask(id) {
  const tasks = _loadTasks();
  const task = tasks.find(t => t.id == id);
  if (!task) return null;
  task.completed = 1;
  task.completed_at = _now();
  _saveTasks(tasks);
  return task;
}

function deleteTask(id) {
  _saveTasks(_loadTasks().filter(t => t.id != id));
}

// ---- recurring_tasks ----

function getRecurringTasks() {
  return _loadRecurring().sort((a, b) => a.start_date.localeCompare(b.start_date));
}

function addRecurringTask(data) {
  const tasks = _loadRecurring();
  const task = {
    id: _nextId('recurring'),
    title: data.title, link: data.link || '',
    description: data.description || '',
    interval_type: data.interval_type,
    start_date: data.start_date,
    notify_days_before: data.notify_days_before ?? 3,
    created_at: _now(),
  };
  tasks.push(task);
  _saveRecurring(tasks);
  generateOccurrences(task, 3);
  return task;
}

function updateRecurringTask(id, data) {
  const tasks = _loadRecurring();
  const idx = tasks.findIndex(t => t.id == id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...data, id: tasks[idx].id };
  _saveRecurring(tasks);
  generateOccurrences(tasks[idx], 3);
  return tasks[idx];
}

function deleteRecurringTask(id) {
  _saveRecurring(_loadRecurring().filter(t => t.id != id));
  _saveOccs(_loadOccs().filter(o => o.recurring_task_id != id));
}

// ---- task_occurrences ----

function _upsertOccurrence(recurringTaskId, dueDate) {
  const occs = _loadOccs();
  if (occs.find(o => o.recurring_task_id == recurringTaskId && o.due_date === dueDate)) return;
  occs.push({
    id: _nextId('occurrence'),
    recurring_task_id: recurringTaskId,
    due_date: dueDate,
    completed: 0, completed_at: null,
  });
  _saveOccs(occs);
}

function getOccurrencesByMonth(yearMonth) {
  const recurring = _loadRecurring();
  return _loadOccs()
    .filter(o => o.due_date.startsWith(yearMonth))
    .map(o => {
      const r = recurring.find(r => r.id == o.recurring_task_id);
      return r ? { ...o, title: r.title, link: r.link, description: r.description,
                   interval_type: r.interval_type, notify_days_before: r.notify_days_before } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

function completeOccurrence(id) {
  const occs = _loadOccs();
  const occ = occs.find(o => o.id == id);
  if (!occ) return null;
  occ.completed = 1;
  occ.completed_at = _now();
  _saveOccs(occs);
  return occ;
}

function getUpcomingOccurrences(daysAhead) {
  const recurring = _loadRecurring();
  const today = todayStr();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  const futureStr = future.toISOString().split('T')[0];
  return _loadOccs()
    .filter(o => !o.completed && o.due_date >= today && o.due_date <= futureStr)
    .map(o => {
      const r = recurring.find(r => r.id == o.recurring_task_id);
      return r ? { ...o, title: r.title, link: r.link, description: r.description,
                   notify_days_before: r.notify_days_before } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

// ---- occurrences 生成（サーバー側 generateOccurrences と同ロジック）----

function generateOccurrences(task, monthsAhead = 3) {
  const intervals = {
    daily: { days: 1 }, weekly: { days: 7 }, biweekly: { days: 14 },
    '3weekly': { days: 21 }, monthly: { months: 1 }, '2monthly': { months: 2 },
    '3monthly': { months: 3 }, halfyear: { months: 6 },
  };
  const interval = intervals[task.interval_type];
  if (!interval) return;

  const end = new Date();
  end.setMonth(end.getMonth() + monthsAhead);
  const pastLimit = new Date();
  pastLimit.setMonth(pastLimit.getMonth() - 3);

  let current = new Date(task.start_date + 'T00:00:00');
  while (current <= end) {
    if (current >= pastLimit) {
      _upsertOccurrence(task.id, current.toISOString().split('T')[0]);
    }
    if (interval.days) {
      current.setDate(current.getDate() + interval.days);
    } else {
      current.setMonth(current.getMonth() + interval.months);
    }
  }
}

// ---- カレンダー用：月のタスク有無 ----

function getTaskDatesByMonth(yearMonth) {
  const dates = new Set();
  _loadTasks().filter(t => t.date.startsWith(yearMonth)).forEach(t => dates.add(t.date));
  return dates;
}
