/**
 * settings.js - Gmail設定UI
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 設定読み込み＆設定済みバッジ表示
  try {
    const [settingsRes, statusRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/setup-status'),
    ]);
    const settings = await settingsRes.json();
    const { configured } = await statusRes.json();

    const userInput = document.getElementById('gmail-user');
    const passInput = document.getElementById('gmail-pass');
    if (userInput && settings.gmail_user) userInput.value = settings.gmail_user;
    if (passInput && settings.gmail_pass) passInput.value = settings.gmail_pass; // '***' が返る

    const badge = document.getElementById('gmail-configured-badge');
    if (badge && configured) badge.classList.remove('hidden');
  } catch (e) {
    console.error('設定読み込みエラー:', e);
  }

  // 保存
  document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
    const gmail_user = document.getElementById('gmail-user').value.trim();
    const gmail_pass = document.getElementById('gmail-pass').value.trim();

    if (!gmail_user) {
      showToast('Gmailアドレスを入力してください', 'error');
      return;
    }

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmail_user, gmail_pass: gmail_pass !== '***' ? gmail_pass : undefined }),
      });
      showToast('設定を保存しました ✅', 'success');
    } catch (e) {
      showToast('保存に失敗しました', 'error');
    }
  });

  // テストメール
  document.getElementById('test-mail-btn')?.addEventListener('click', async () => {
    const gmail_user = document.getElementById('gmail-user').value.trim();
    const btn = document.getElementById('test-mail-btn');
    btn.disabled = true;
    btn.textContent = '送信中...';
    try {
      const res = await fetch('/api/settings/test-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: gmail_user }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'テストメールを送信しました', 'success');
      } else {
        showToast(data.error || '送信に失敗しました', 'error');
      }
    } catch (e) {
      showToast('送信エラー: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📧 テスト送信';
    }
  });
});
