/**
 * nodemailer Gmail送信モジュール
 */
const nodemailer = require('nodemailer');
const { getSetting } = require('./database');

function createTransport() {
  const user = getSetting('gmail_user') || process.env.GMAIL_USER;
  const pass = getSetting('gmail_pass') || process.env.GMAIL_PASS;

  if (!user || !pass) {
    throw new Error('Gmail設定が未完了です。設定画面でGmailアドレスとアプリパスワードを入力してください。');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

/**
 * メール送信
 * @param {string} to 宛先
 * @param {string} subject 件名
 * @param {string} text 本文（テキスト）
 * @param {string} [html] 本文（HTML）
 */
async function sendMail(to, subject, text, html) {
  const transport = createTransport();
  const user = getSetting('gmail_user') || process.env.GMAIL_USER;

  const info = await transport.sendMail({
    from: `スケジュール管理 <${user}>`,
    to,
    subject,
    text,
    html: html || text,
  });

  return info;
}

/**
 * 定期タスク通知メール送信
 */
async function sendScheduleNotification(to, task, occurrences) {
  const subject = `【スケジュール通知】${task.title}`;

  const rows = occurrences.map(o => {
    const days = Math.ceil((new Date(o.due_date) - new Date()) / (1000 * 60 * 60 * 24));
    const daysText = days === 0 ? '今日' : days < 0 ? `${Math.abs(days)}日前` : `あと${days}日`;
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${o.due_date}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${daysText}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${o.completed ? '✅ 完了' : '⏳ 未完了'}</td>
    </tr>`;
  }).join('');

  const linkHtml = task.link
    ? `<p>リンク: <a href="${task.link}">${task.link}</a></p>`
    : '';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#4A90D9;border-bottom:2px solid #4A90D9;padding-bottom:8px;">
        📅 ${task.title}
      </h2>
      ${task.description ? `<p style="color:#555;">${task.description}</p>` : ''}
      ${linkHtml}
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="background:#4A90D9;color:white;">
            <th style="padding:8px 12px;text-align:left;">期日</th>
            <th style="padding:8px 12px;text-align:left;">残り</th>
            <th style="padding:8px 12px;text-align:left;">状態</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:24px;">
        このメールはスケジュール管理アプリから自動送信されています。
      </p>
    </div>
  `;

  const text = occurrences.map(o => `${o.due_date}: ${o.completed ? '完了' : '未完了'}`).join('\n');

  return sendMail(to, subject, text, html);
}

/**
 * テストメール送信
 */
async function sendTestMail(to) {
  return sendMail(
    to,
    '【スケジュール管理】テストメール',
    'Gmail設定が正常に完了しました。このメールはテスト送信です。',
    `<div style="font-family:sans-serif;">
      <h2 style="color:#4A90D9;">✅ Gmail設定完了</h2>
      <p>スケジュール管理アプリのGmail設定が正常に完了しました。</p>
      <p>このメールはテスト送信です。</p>
    </div>`
  );
}

module.exports = { sendMail, sendScheduleNotification, sendTestMail };
