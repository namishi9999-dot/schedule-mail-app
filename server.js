/**
 * Express サーバー + 全APIルート
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const { sendTestMail } = require('./mailer');
const { startAll } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// tasks API
// ============================================================

// 日付別タスク取得
app.get('/api/tasks', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date parameter required' });
  res.json(db.getTasksByDate(date));
});

// 完了済みタスク
app.get('/api/tasks/completed', (req, res) => {
  res.json(db.getCompletedTasks());
});

// タスク追加
app.post('/api/tasks', (req, res) => {
  const { date, title, description } = req.body;
  if (!date || !title) return res.status(400).json({ error: 'date and title required' });
  const task = db.addTask(date, title, description);
  res.status(201).json(task);
});

// タスク完了
app.put('/api/tasks/:id/complete', (req, res) => {
  const task = db.completeTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'task not found' });
  res.json(task);
});

// タスク削除
app.delete('/api/tasks/:id', (req, res) => {
  db.deleteTask(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// recurring_tasks API
// ============================================================

// 定期タスク一覧
app.get('/api/recurring', (req, res) => {
  res.json(db.getRecurringTasks());
});

// 定期タスク追加
app.post('/api/recurring', (req, res) => {
  const { title, link, description, interval_type, start_date, notify_days_before } = req.body;
  if (!title || !interval_type || !start_date) {
    return res.status(400).json({ error: 'title, interval_type, start_date required' });
  }
  const task = db.addRecurringTask({
    title,
    link: link || '',
    description: description || '',
    interval_type,
    start_date,
    notify_days_before: notify_days_before ?? 3,
  });
  // 発生日を即時生成
  db.generateOccurrences(task, 3);
  res.status(201).json(task);
});

// 定期タスク更新
app.put('/api/recurring/:id', (req, res) => {
  const { title, link, description, interval_type, start_date, notify_days_before } = req.body;
  const task = db.updateRecurringTask(req.params.id, {
    title,
    link: link || '',
    description: description || '',
    interval_type,
    start_date,
    notify_days_before: notify_days_before ?? 3,
  });
  db.generateOccurrences(task, 3);
  res.json(task);
});

// 定期タスク削除
app.delete('/api/recurring/:id', (req, res) => {
  db.deleteRecurringTask(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// occurrences API
// ============================================================

// 月別発生一覧
app.get('/api/occurrences', (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) return res.status(400).json({ error: 'month parameter required' });
  res.json(db.getOccurrencesByMonth(month));
});

// 発生完了
app.put('/api/occurrences/:id/complete', (req, res) => {
  const occ = db.completeOccurrence(req.params.id);
  if (!occ) return res.status(404).json({ error: 'occurrence not found' });
  res.json(occ);
});

// ============================================================
// email_schedules API
// ============================================================

// タスク別メールスケジュール取得
app.get('/api/email-schedules/:taskId', (req, res) => {
  res.json(db.getEmailSchedulesByTask(req.params.taskId));
});

// メールスケジュール登録
app.post('/api/email-schedules', (req, res) => {
  const {
    recurring_task_id, to_email, frequency,
    day_of_week, day_of_month, nth_week, weekday,
    send_time, enabled,
  } = req.body;
  if (!to_email || !frequency) {
    return res.status(400).json({ error: 'to_email and frequency required' });
  }
  const schedule = db.addEmailSchedule({
    recurring_task_id: recurring_task_id || null,
    to_email,
    frequency,
    day_of_week: day_of_week ?? null,
    day_of_month: day_of_month ?? null,
    nth_week: nth_week ?? null,
    weekday: weekday ?? null,
    send_time: send_time || '09:00',
    enabled: enabled ?? 1,
  });
  res.status(201).json(schedule);
});

// メールスケジュール更新
app.put('/api/email-schedules/:id', (req, res) => {
  const {
    recurring_task_id, to_email, frequency,
    day_of_week, day_of_month, nth_week, weekday,
    send_time, enabled,
  } = req.body;
  const schedule = db.updateEmailSchedule(req.params.id, {
    recurring_task_id: recurring_task_id || null,
    to_email,
    frequency,
    day_of_week: day_of_week ?? null,
    day_of_month: day_of_month ?? null,
    nth_week: nth_week ?? null,
    weekday: weekday ?? null,
    send_time: send_time || '09:00',
    enabled: enabled ?? 1,
  });
  res.json(schedule);
});

// メールスケジュール削除
app.delete('/api/email-schedules/:id', (req, res) => {
  db.deleteEmailSchedule(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// notifications API
// ============================================================

app.get('/api/notifications', (req, res) => {
  const daysAhead = parseInt(req.query.days) || 7;
  const occurrences = db.getUpcomingOccurrences(daysAhead);
  res.json(occurrences);
});

// ============================================================
// settings API
// ============================================================

// Gmail設定済みかを返す
app.get('/api/setup-status', (req, res) => {
  const user = db.getSetting('gmail_user') || process.env.GMAIL_USER || '';
  const pass = db.getSetting('gmail_pass') || process.env.GMAIL_PASS || '';
  res.json({ configured: !!(user && pass) });
});

app.get('/api/settings', (req, res) => {
  const settings = db.getAllSettings();
  const result = {};
  for (const s of settings) {
    // パスワードはマスク
    result[s.key] = s.key === 'gmail_pass' && s.value ? '***' : s.value;
  }
  res.json(result);
});

app.post('/api/settings', (req, res) => {
  const { gmail_user, gmail_pass } = req.body;
  if (gmail_user !== undefined) db.setSetting('gmail_user', gmail_user);
  if (gmail_pass !== undefined && gmail_pass !== '***') {
    db.setSetting('gmail_pass', gmail_pass);
  }
  res.json({ ok: true });
});

app.post('/api/settings/test-mail', async (req, res) => {
  try {
    const { to } = req.body;
    const target = to || db.getSetting('gmail_user') || process.env.GMAIL_USER;
    if (!target) return res.status(400).json({ error: '送信先メールアドレスが不明です' });
    await sendTestMail(target);
    res.json({ ok: true, message: `テストメールを ${target} に送信しました` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SPA fallback（全HTMLはpublicで配信）
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// スケジューラー起動
startAll();

app.listen(PORT, () => {
  console.log(`[server] スケジュール管理アプリ起動: http://localhost:${PORT}`);
});
