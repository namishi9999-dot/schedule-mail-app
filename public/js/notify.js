/**
 * notify.js - ブラウザ通知・期日接近ポーリング
 */

let notifInterval = null;

async function checkNotifications() {
  try {
    const res = await fetch('/api/notifications?days=7');
    const occs = await res.json();

    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (occs.length > 0) {
        badge.textContent = occs.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // ブラウザ通知
    if (occs.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      // 同日に一度だけ通知
      const today = todayStr();
      const lastNotifDate = localStorage.getItem('lastNotifDate');
      if (lastNotifDate !== today) {
        localStorage.setItem('lastNotifDate', today);
        const todayOccs = occs.filter(o => o.due_date === today);
        const urgentOccs = occs.filter(o => {
          const days = Math.ceil((new Date(o.due_date) - new Date()) / (1000 * 60 * 60 * 24));
          return days <= 1;
        });
        if (urgentOccs.length > 0) {
          new Notification('📅 スケジュール管理', {
            body: `期日が近いタスクが${urgentOccs.length}件あります`,
            icon: '/icons/icon-192.png',
          });
        }
      }
    }

    return occs;
  } catch (e) {
    return [];
  }
}

function renderNotifList(occs) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!occs.length) {
    list.innerHTML = '<p class="text-muted">期日接近のタスクはありません</p>';
    return;
  }
  const today = new Date();
  list.innerHTML = occs.map(o => {
    const days = Math.ceil((new Date(o.due_date) - today) / (1000 * 60 * 60 * 24));
    const daysText = days === 0 ? '今日' : days < 0 ? `${Math.abs(days)}日超過` : `あと${days}日`;
    const cls = days <= 0 ? 'error' : days <= 2 ? 'warning' : '';
    return `<div class="task-item" style="margin-bottom:8px;">
      <span class="badge ${cls}">${daysText}</span>
      <div class="task-body">
        <div class="task-title">${escapeHtml(o.title)}</div>
        <div class="task-meta">期日: ${o.due_date}</div>
      </div>
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  // 通知許可リクエスト
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // 通知ボタン
  const notifBtn = document.getElementById('notif-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
      const occs = await checkNotifications();
      renderNotifList(occs);
      openModal('notif-modal');
    });
  }

  document.getElementById('close-notif-modal')?.addEventListener('click', () => {
    closeModal('notif-modal');
  });

  // 初回チェック & 5分ごとポーリング
  checkNotifications();
  notifInterval = setInterval(checkNotifications, 5 * 60 * 1000);
});
