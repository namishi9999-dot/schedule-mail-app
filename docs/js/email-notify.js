/**
 * email-notify.js - EmailJS を使った定期スケジュールメール通知
 * サーバー不要でブラウザから Gmail 送信が可能
 */

const EMAIL_SETTINGS_KEY = 'email_notify_settings';

function getEmailSettings() {
  return JSON.parse(localStorage.getItem(EMAIL_SETTINGS_KEY) || '{}');
}

function saveEmailSettings(settings) {
  localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
}

// スケジュール概要テキストを生成
function buildScheduleSummary() {
  const today = todayStr();
  const todayTasks = getTasksByDate(today).filter(t => !t.completed);
  const upcoming = getUpcomingOccurrences(7);

  const lines = [];
  lines.push(`📅 ${today} のスケジュール\n`);

  if (todayTasks.length) {
    lines.push('【今日のタスク】');
    todayTasks.forEach(t => lines.push(`  ・${t.title}${t.description ? '（' + t.description + '）' : ''}`));
  } else {
    lines.push('【今日のタスク】なし');
  }

  lines.push('');

  if (upcoming.length) {
    lines.push('【今後7日間の定期タスク】');
    upcoming.forEach(o => {
      const days = Math.ceil((new Date(o.due_date) - new Date()) / (1000 * 60 * 60 * 24));
      const label = days === 0 ? '今日' : days < 0 ? `${Math.abs(days)}日超過` : `あと${days}日`;
      lines.push(`  ・${o.title}（${o.due_date} / ${label}）`);
    });
  } else {
    lines.push('【今後7日間の定期タスク】なし');
  }

  return lines.join('\n');
}

// EmailJS でメール送信
async function sendScheduleMail(settings, summary) {
  const { publicKey, serviceId, templateId, toEmail } = settings;
  if (!publicKey || !serviceId || !templateId || !toEmail) return false;

  // EmailJS SDKを動的ロード（まだない場合）
  if (!window.emailjs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  emailjs.init({ publicKey });

  await emailjs.send(serviceId, templateId, {
    to_email: toEmail,
    subject: `📅 スケジュール通知 ${todayStr()}`,
    message: summary,
    date: todayStr(),
  });

  return true;
}

// アプリ起動時に自動チェック・送信
async function checkAndSendScheduleMail() {
  const s = getEmailSettings();
  if (!s.enabled || !s.publicKey || !s.serviceId || !s.templateId || !s.toEmail) return;

  const today = todayStr();
  const nowHour = new Date().getHours();
  const sendHour = parseInt((s.sendTime || '08:00').split(':')[0]);
  const lastSent = s.lastSent || '';

  // 今日の指定時刻以降、かつ今日まだ送っていない場合
  if (lastSent === today || nowHour < sendHour) return;

  // 頻度チェック
  const dow = new Date().getDay(); // 0=日
  if (s.frequency === 'weekly' && dow !== parseInt(s.sendDow ?? 1)) return;

  try {
    const summary = buildScheduleSummary();
    await sendScheduleMail(s, summary);
    saveEmailSettings({ ...s, lastSent: today });
    showToast('スケジュールメールを送信しました 📧', 'success');
  } catch (e) {
    console.warn('[email-notify] 送信エラー:', e);
  }
}

// 手動送信
async function sendScheduleMailNow() {
  const s = getEmailSettings();
  const btn = document.getElementById('send-test-email-btn');
  if (btn) { btn.disabled = true; btn.textContent = '送信中...'; }

  try {
    const summary = buildScheduleSummary();
    await sendScheduleMail(s, summary);
    saveEmailSettings({ ...s, lastSent: todayStr() });
    showToast('メールを送信しました ✅', 'success');
  } catch (e) {
    showToast('送信失敗: ' + (e?.text || e?.message || '設定を確認してください'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📧 今すぐ送信テスト'; }
  }
}
