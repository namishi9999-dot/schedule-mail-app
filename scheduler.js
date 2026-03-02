/**
 * node-cron スケジューラー
 * - 定期タスクの発生日生成（毎日深夜）
 * - メール送信スケジュール実行（毎分チェック）
 */
const cron = require('node-cron');
const {
  getRecurringTasks,
  generateOccurrences,
  getAllEnabledEmailSchedules,
  getRecurringTaskById,
  getOccurrencesByMonth,
  updateEmailScheduleLastSent,
} = require('./database');
const { sendScheduleNotification } = require('./mailer');

/**
 * 定期タスクの発生日を生成（毎日0:05）
 */
function startOccurrenceGenerator() {
  cron.schedule('5 0 * * *', () => {
    console.log('[scheduler] 定期タスク発生日生成開始');
    try {
      const tasks = getRecurringTasks();
      for (const task of tasks) {
        generateOccurrences(task, 3);
      }
      console.log(`[scheduler] ${tasks.length}件の定期タスク更新完了`);
    } catch (err) {
      console.error('[scheduler] 発生日生成エラー:', err);
    }
  }, { timezone: 'Asia/Tokyo' });
}

/**
 * メール送信スケジュールチェック（毎分）
 */
function startEmailScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const schedules = getAllEnabledEmailSchedules();

      for (const schedule of schedules) {
        if (!shouldSendNow(schedule, now)) continue;

        try {
          const task = schedule.recurring_task_id
            ? getRecurringTaskById(schedule.recurring_task_id)
            : null;

          // 今月・来月の発生一覧を取得
          const thisMonth = now.toISOString().slice(0, 7);
          const nextDate = new Date(now);
          nextDate.setMonth(nextDate.getMonth() + 1);
          const nextMonth = nextDate.toISOString().slice(0, 7);

          const occurrences = [
            ...getOccurrencesByMonth(thisMonth),
            ...getOccurrencesByMonth(nextMonth),
          ].filter(o => task ? o.recurring_task_id === task.id : true);

          if (task && occurrences.length > 0) {
            await sendScheduleNotification(schedule.to_email, task, occurrences);
            updateEmailScheduleLastSent(schedule.id, now.toISOString());
            console.log(`[scheduler] メール送信: ${schedule.to_email} (schedule#${schedule.id})`);
          }
        } catch (err) {
          console.error(`[scheduler] メール送信エラー (schedule#${schedule.id}):`, err.message);
        }
      }
    } catch (err) {
      console.error('[scheduler] スケジュールチェックエラー:', err);
    }
  }, { timezone: 'Asia/Tokyo' });
}

/**
 * 現在時刻にメールを送信すべきか判定
 */
function shouldSendNow(schedule, now) {
  const [hh, mm] = schedule.send_time.split(':').map(Number);
  if (now.getHours() !== hh || now.getMinutes() !== mm) return false;

  // 直近1分以内に送信済みなら skip
  if (schedule.last_sent) {
    const lastSent = new Date(schedule.last_sent);
    if (now - lastSent < 60 * 1000) return false;
  }

  const dow = now.getDay(); // 0=日〜6=土
  const dom = now.getDate();

  switch (schedule.frequency) {
    case 'daily':
      return true;

    case 'weekly':
      return dow === schedule.day_of_week;

    case 'monthly-date':
      return dom === schedule.day_of_month;

    case 'monthly-nth': {
      // 第N曜日チェック
      const nth = Math.ceil(dom / 7);
      return nth === schedule.nth_week && dow === schedule.weekday;
    }

    default:
      return false;
  }
}

function startAll() {
  startOccurrenceGenerator();
  startEmailScheduler();

  // 起動時に一度発生日生成
  setTimeout(() => {
    console.log('[scheduler] 起動時 定期タスク発生日生成');
    const tasks = getRecurringTasks();
    for (const task of tasks) {
      generateOccurrences(task, 3);
    }
  }, 2000);
}

module.exports = { startAll, shouldSendNow };
