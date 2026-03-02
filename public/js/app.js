/**
 * app.js - PWA登録・共通ユーティリティ
 */

// Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('[SW] 登録成功:', reg.scope))
      .catch(err => console.warn('[SW] 登録失敗:', err));
  });
}

// PWAインストールプロンプト
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const area = document.getElementById('install-prompt-area');
  if (area) area.classList.remove('hidden');
});

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('install-pwa-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') showToast('ホーム画面に追加されました', 'success');
      deferredInstallPrompt = null;
    });
  }

  // Gmail未設定なら setup wizard を自動表示
  if (document.getElementById('setup-wizard-modal')) {
    checkFirstRun();

    document.getElementById('setup-submit-btn').addEventListener('click', handleSetupSubmit);
    document.getElementById('setup-skip-btn').addEventListener('click', () => closeModal('setup-wizard-modal'));
  }
});

async function checkFirstRun() {
  try {
    const res = await fetch('/api/setup-status');
    const { configured } = await res.json();
    if (!configured) openModal('setup-wizard-modal');
  } catch (e) {}
}

async function handleSetupSubmit() {
  const user = document.getElementById('setup-gmail-user').value.trim();
  const pass = document.getElementById('setup-gmail-pass').value.trim();

  if (!user || !pass) {
    showToast('メールアドレスとアプリパスワードを入力してください', 'error');
    return;
  }

  const btn = document.getElementById('setup-submit-btn');
  btn.disabled = true;
  btn.textContent = '送信中...';

  try {
    // 設定を保存
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_user: user, gmail_pass: pass }),
    });

    // テスト送信
    const testRes = await fetch('/api/settings/test-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!testRes.ok) {
      const err = await testRes.json();
      throw new Error(err.error || 'テスト送信に失敗しました');
    }

    closeModal('setup-wizard-modal');
    showToast('設定完了！テストメールを送信しました', 'success');
  } catch (e) {
    showToast(e.message || 'エラーが発生しました', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ 保存してテスト送信';
  }
}

// ============================================================
// Toast
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ============================================================
// HTML エスケープ
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// 今日の日付（YYYY-MM-DD）
// ============================================================
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// モーダル開閉
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// モーダル外クリックで閉じる
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

// グローバルに公開
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.todayStr = todayStr;
window.openModal = openModal;
window.closeModal = closeModal;
