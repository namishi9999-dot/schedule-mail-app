/**
 * app.js - PWA登録・共通ユーティリティ（GitHub Pages 静的版）
 */

// Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
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
});

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
