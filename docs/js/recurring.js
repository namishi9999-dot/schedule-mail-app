/**
 * recurring.js - 定期タスク設定UI（localStorage版・メール機能なし）
 */

const INTERVAL_LABELS = {
  daily: '毎日', weekly: '毎週', biweekly: '隔週',
  '3weekly': '3週ごと', monthly: '毎月', '2monthly': '2ヶ月ごと',
  '3monthly': '3ヶ月ごと', halfyear: '半年ごと',
};

let editingId = null;

function loadRecurring() {
  const list = document.getElementById('recurring-list');
  if (!list) return;
  const tasks = getRecurringTasks();
  if (!tasks.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">🔄</div><p>定期タスクがありません</p>
      <button class="btn btn-primary mt-8" id="add-recurring-empty-btn">＋ 追加する</button>
    </div>`;
    document.getElementById('add-recurring-empty-btn')?.addEventListener('click', openAddModal);
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="recurring-item">
      <div class="recurring-header">
        <div>
          <div class="recurring-title">
            ${escapeHtml(t.title)}
            <span class="badge">${INTERVAL_LABELS[t.interval_type] || t.interval_type}</span>
          </div>
          <div class="recurring-meta">
            開始: ${t.start_date} | 事前通知: ${t.notify_days_before}日前
          </div>
          ${t.link ? `<a class="task-link" href="${escapeHtml(t.link)}" target="_blank" rel="noopener">${escapeHtml(t.link)}</a>` : ''}
          ${t.description ? `<div class="recurring-meta">${escapeHtml(t.description)}</div>` : ''}
        </div>
        <div class="recurring-actions">
          <button class="btn btn-outline btn-sm" data-edit="${t.id}">編集</button>
          <button class="btn btn-danger btn-sm" data-del="${t.id}">削除</button>
        </div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(tasks.find(t => t.id == btn.dataset.edit)));
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteRecurringItem(btn.dataset.del));
  });
}

function openAddModal() {
  editingId = null;
  document.getElementById('recurring-modal-title').textContent = '定期タスクを追加';
  document.getElementById('edit-recurring-id').value = '';
  document.getElementById('rt-title').value = '';
  document.getElementById('rt-link').value = '';
  document.getElementById('rt-desc').value = '';
  document.getElementById('rt-interval').value = 'monthly';
  document.getElementById('rt-start').value = todayStr();
  document.getElementById('rt-notify').value = '3';
  openModal('recurring-modal');
}

function openEditModal(task) {
  editingId = task.id;
  document.getElementById('recurring-modal-title').textContent = '定期タスクを編集';
  document.getElementById('edit-recurring-id').value = task.id;
  document.getElementById('rt-title').value = task.title;
  document.getElementById('rt-link').value = task.link || '';
  document.getElementById('rt-desc').value = task.description || '';
  document.getElementById('rt-interval').value = task.interval_type;
  document.getElementById('rt-start').value = task.start_date;
  document.getElementById('rt-notify').value = task.notify_days_before;
  openModal('recurring-modal');
}

function deleteRecurringItem(id) {
  if (!confirm('定期タスクを削除しますか？（発生分も削除されます）')) return;
  deleteRecurringTask(id);
  showToast('削除しました', 'info');
  loadRecurring();
}

document.addEventListener('DOMContentLoaded', () => {
  loadRecurring();

  document.getElementById('add-recurring-btn')?.addEventListener('click', openAddModal);
  document.getElementById('cancel-recurring')?.addEventListener('click', () => closeModal('recurring-modal'));

  document.getElementById('submit-recurring')?.addEventListener('click', () => {
    const title = document.getElementById('rt-title').value.trim();
    const link = document.getElementById('rt-link').value.trim();
    const desc = document.getElementById('rt-desc').value.trim();
    const interval_type = document.getElementById('rt-interval').value;
    const start_date = document.getElementById('rt-start').value;
    const notify_days_before = parseInt(document.getElementById('rt-notify').value) || 3;

    if (!title || !start_date) {
      showToast('タスク名と開始日は必須です', 'error');
      return;
    }

    if (editingId) {
      updateRecurringTask(editingId, { title, link, description: desc, interval_type, start_date, notify_days_before });
    } else {
      addRecurringTask({ title, link, description: desc, interval_type, start_date, notify_days_before });
    }

    closeModal('recurring-modal');
    showToast('保存しました ✅', 'success');
    loadRecurring();
  });
});
