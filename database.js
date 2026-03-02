/**
 * SQLite データベース初期化・操作モジュール
 * Node.js 22.5.0+ 組み込み node:sqlite を使用
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'schedule.db');
const db = new DatabaseSync(dbPath);

// WALモード・外部キー有効化
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// node:sqlite の prepare をラップして bare named params を有効化
// （better-sqlite3 との互換性のため）
const _prepare = db.prepare.bind(db);
db.prepare = (sql) => {
  const stmt = _prepare(sql);
  stmt.setAllowBareNamedParameters(true);
  return stmt;
};

// スキーマ初期化
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    completed INTEGER DEFAULT 0,
    completed_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS recurring_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    link TEXT DEFAULT '',
    description TEXT DEFAULT '',
    interval_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    notify_days_before INTEGER DEFAULT 3,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS task_occurrences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_task_id INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TEXT DEFAULT NULL,
    FOREIGN KEY (recurring_task_id) REFERENCES recurring_tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS email_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_task_id INTEGER,
    to_email TEXT NOT NULL,
    frequency TEXT NOT NULL,
    day_of_week INTEGER DEFAULT NULL,
    day_of_month INTEGER DEFAULT NULL,
    nth_week INTEGER DEFAULT NULL,
    weekday INTEGER DEFAULT NULL,
    send_time TEXT NOT NULL DEFAULT '09:00',
    enabled INTEGER DEFAULT 1,
    last_sent TEXT DEFAULT NULL,
    FOREIGN KEY (recurring_task_id) REFERENCES recurring_tasks(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);

// ---- tasks ----

function getTasksByDate(date) {
  return db.prepare('SELECT * FROM tasks WHERE date = ? ORDER BY created_at').all(date);
}

function getCompletedTasks() {
  return db.prepare(`
    SELECT * FROM tasks WHERE completed = 1 ORDER BY completed_at DESC LIMIT 200
  `).all();
}

function addTask(date, title, description) {
  const result = db.prepare(
    'INSERT INTO tasks (date, title, description) VALUES (?, ?, ?)'
  ).run(date, title, description || '');
  return getTaskById(result.lastInsertRowid);
}

function getTaskById(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function completeTask(id) {
  db.prepare(
    "UPDATE tasks SET completed = 1, completed_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(id);
  return getTaskById(id);
}

function deleteTask(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// ---- recurring_tasks ----

function getRecurringTasks() {
  return db.prepare('SELECT * FROM recurring_tasks ORDER BY start_date').all();
}

function getRecurringTaskById(id) {
  return db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id);
}

function addRecurringTask(data) {
  const result = db.prepare(`
    INSERT INTO recurring_tasks (title, link, description, interval_type, start_date, notify_days_before)
    VALUES (@title, @link, @description, @interval_type, @start_date, @notify_days_before)
  `).run(data);
  return getRecurringTaskById(result.lastInsertRowid);
}

function updateRecurringTask(id, data) {
  db.prepare(`
    UPDATE recurring_tasks
    SET title=@title, link=@link, description=@description,
        interval_type=@interval_type, start_date=@start_date,
        notify_days_before=@notify_days_before
    WHERE id=@id
  `).run({ ...data, id });
  return getRecurringTaskById(id);
}

function deleteRecurringTask(id) {
  db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(id);
}

// ---- task_occurrences ----

function getOccurrencesByMonth(yearMonth) {
  return db.prepare(`
    SELECT o.*, r.title, r.link, r.description, r.interval_type, r.notify_days_before
    FROM task_occurrences o
    JOIN recurring_tasks r ON o.recurring_task_id = r.id
    WHERE o.due_date LIKE ?
    ORDER BY o.due_date
  `).all(yearMonth + '-%');
}

function getOccurrenceById(id) {
  return db.prepare('SELECT * FROM task_occurrences WHERE id = ?').get(id);
}

function upsertOccurrence(recurringTaskId, dueDate) {
  const existing = db.prepare(
    'SELECT * FROM task_occurrences WHERE recurring_task_id = ? AND due_date = ?'
  ).get(recurringTaskId, dueDate);
  if (existing) return existing;
  const result = db.prepare(
    'INSERT INTO task_occurrences (recurring_task_id, due_date) VALUES (?, ?)'
  ).run(recurringTaskId, dueDate);
  return getOccurrenceById(result.lastInsertRowid);
}

function completeOccurrence(id) {
  db.prepare(
    "UPDATE task_occurrences SET completed = 1, completed_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(id);
  return getOccurrenceById(id);
}

function getUpcomingOccurrences(daysAhead) {
  return db.prepare(`
    SELECT o.*, r.title, r.link, r.description, r.notify_days_before
    FROM task_occurrences o
    JOIN recurring_tasks r ON o.recurring_task_id = r.id
    WHERE o.completed = 0
      AND o.due_date >= date('now', 'localtime')
      AND o.due_date <= date('now', 'localtime', '+' || ? || ' days')
    ORDER BY o.due_date
  `).all(daysAhead);
}

// ---- email_schedules ----

function getEmailSchedulesByTask(recurringTaskId) {
  return db.prepare(
    'SELECT * FROM email_schedules WHERE recurring_task_id = ?'
  ).all(recurringTaskId);
}

function getAllEnabledEmailSchedules() {
  return db.prepare('SELECT * FROM email_schedules WHERE enabled = 1').all();
}

function getEmailScheduleById(id) {
  return db.prepare('SELECT * FROM email_schedules WHERE id = ?').get(id);
}

function addEmailSchedule(data) {
  const result = db.prepare(`
    INSERT INTO email_schedules
      (recurring_task_id, to_email, frequency, day_of_week, day_of_month,
       nth_week, weekday, send_time, enabled)
    VALUES
      (@recurring_task_id, @to_email, @frequency, @day_of_week, @day_of_month,
       @nth_week, @weekday, @send_time, @enabled)
  `).run(data);
  return getEmailScheduleById(result.lastInsertRowid);
}

function updateEmailSchedule(id, data) {
  db.prepare(`
    UPDATE email_schedules
    SET recurring_task_id=@recurring_task_id, to_email=@to_email,
        frequency=@frequency, day_of_week=@day_of_week, day_of_month=@day_of_month,
        nth_week=@nth_week, weekday=@weekday, send_time=@send_time, enabled=@enabled
    WHERE id=@id
  `).run({ ...data, id });
  return getEmailScheduleById(id);
}

function updateEmailScheduleLastSent(id, datetime) {
  db.prepare('UPDATE email_schedules SET last_sent = ? WHERE id = ?').run(datetime, id);
}

function deleteEmailSchedule(id) {
  db.prepare('DELETE FROM email_schedules WHERE id = ?').run(id);
}

// ---- app_settings ----

function getSetting(key) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  ).run(key, value);
}

function getAllSettings() {
  return db.prepare('SELECT key, value FROM app_settings').all();
}

// 定期タスクの次回発生日を計算してDBに登録（月次バッファ生成）
function generateOccurrences(task, monthsAhead = 3) {
  const intervals = {
    daily:     { days: 1 },
    weekly:    { days: 7 },
    biweekly:  { days: 14 },
    '3weekly': { days: 21 },
    monthly:   { months: 1 },
    '2monthly':{ months: 2 },
    '3monthly':{ months: 3 },
    halfyear:  { months: 6 },
  };

  const interval = intervals[task.interval_type];
  if (!interval) return;

  const start = new Date(task.start_date + 'T00:00:00');
  const end = new Date();
  end.setMonth(end.getMonth() + monthsAhead);

  let current = new Date(start);
  const generated = [];

  const pastLimit = new Date();
  pastLimit.setMonth(pastLimit.getMonth() - 3);

  while (current <= end) {
    if (current >= pastLimit) {
      const dateStr = current.toISOString().split('T')[0];
      const occ = upsertOccurrence(task.id, dateStr);
      generated.push(occ);
    }

    if (interval.days) {
      current.setDate(current.getDate() + interval.days);
    } else if (interval.months) {
      current.setMonth(current.getMonth() + interval.months);
    }
  }

  return generated;
}

module.exports = {
  db,
  getTasksByDate,
  getCompletedTasks,
  addTask,
  getTaskById,
  completeTask,
  deleteTask,
  getRecurringTasks,
  getRecurringTaskById,
  addRecurringTask,
  updateRecurringTask,
  deleteRecurringTask,
  getOccurrencesByMonth,
  getOccurrenceById,
  upsertOccurrence,
  completeOccurrence,
  getUpcomingOccurrences,
  getEmailSchedulesByTask,
  getAllEnabledEmailSchedules,
  getEmailScheduleById,
  addEmailSchedule,
  updateEmailSchedule,
  updateEmailScheduleLastSent,
  deleteEmailSchedule,
  getSetting,
  setSetting,
  getAllSettings,
  generateOccurrences,
};
