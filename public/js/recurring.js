/**
 * recurring.js - 定期タスク設定UI
 */

const INTERVAL_LABELS = {
  daily:     '毎日',
  weekly:    '毎週',
  biweekly:  '隔週',
  '3weekly': '3週ごと',
  monthly:   '毎月',
  '2monthly':'2ヶ月ごと',
  '3monthly':'3ヶ月ごと',
  halfyear:  '半年ごと',
};

let editingId = null;

async function loadRecurring() {
  const list = document.getElementById('recurring-list');
  if (!list) return;
  try {
    const res = await fetch('/api/recurring');
    const tasks = await res.json();
    if (!tasks.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="icon">🔄</div>
        <p>定期タスクがありません</p>
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
              開始: ${t.start_date}
              | 事前通知: ${t.notify_days_before}日前
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
      btn.addEventListener('click', () => deleteRecurring(btn.dataset.del));
    });
  } catch (e) {
    list.innerHTML = '<p class="text-muted">読み込みエラー</p>';
  }
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
  document.getElementById('es-email').value = '';
  document.getElementById('es-freq').value = '';
  document.getElementById('es-time').value = '09:00';
  updateEmailFreqUI();
  openModal('recurring-modal');
}

async function openEditModal(task) {
  editingId = task.id;
  document.getElementById('recurring-modal-title').textContent = '定期タスクを編集';
  document.getElementById('edit-recurring-id').value = task.id;
  document.getElementById('rt-title').value = task.title;
  document.getElementById('rt-link').value = task.link || '';
  document.getElementById('rt-desc').value = task.description || '';
  document.getElementById('rt-interval').value = task.interval_type;
  document.getElementById('rt-start').value = task.start_date;
  document.getElementById('rt-notify').value = task.notify_days_before;

  // メールスケジュール取得
  try {
    const res = await fetch(`/api/email-schedules/${task.id}`);
    const schedules = await res.json();
    if (schedules.length > 0) {
      const s = schedules[0];
      document.getElementById('es-email').value = s.to_email;
      document.getElementById('es-freq').value = s.frequency;
      document.getElementById('es-time').value = s.send_time;
      document.getElementById('es-dow').value = s.day_of_week ?? 1;
      document.getElementById('es-dom').value = s.day_of_month ?? 1;
      document.getElementById('es-nth').value = s.nth_week ?? 1;
      document.getElementById('es-weekday').value = s.weekday ?? 1;
    }
  } catch (e) {}
  updateEmailFreqUI();
  openModal('recurring-modal');
}

async function deleteRecurring(id) {
  if (!confirm('定期タスクを削除しますか？（発生分も削除されます）')) return;
  try {
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
    showToast('削除しました', 'info');
    loadRecurring();
  } catch (e) {
    showToast('エラーが発生しました', 'error');
  }
}

function updateEmailFreqUI() {
  const freq = document.getElementById('es-freq')?.value;
  document.getElementById('es-weekly-opts')?.classList.toggle('hidden', freq !== 'weekly');
  document.getElementById('es-monthly-date-opts')?.classList.toggle('hidden', freq !== 'monthly-date');
  const nthEl = document.getElementById('es-monthly-nth-opts');
  if (nthEl) {
    nthEl.style.display = freq === 'monthly-nth' ? 'flex' : 'none';
    nthEl.classList.toggle('hidden', freq !== 'monthly-nth');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadRecurring();

  document.getElementById('add-recurring-btn')?.addEventListener('click', openAddModal);
  document.getElementById('cancel-recurring')?.addEventListener('click', () => closeModal('recurring-modal'));
  document.getElementById('es-freq')?.addEventListener('change', updateEmailFreqUI);

  document.getElementById('submit-recurring')?.addEventListener('click', async () => {
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

    try {
      let taskId = editingId;
      if (editingId) {
        await fetch(`/api/recurring/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, link, description: desc, interval_type, start_date, notify_days_before }),
        });
      } else {
        const res = await fetch('/api/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, link, description: desc, interval_type, start_date, notify_days_before }),
        });
        const newTask = await res.json();
        taskId = newTask.id;
      }

      // メールスケジュール保存
      const esFreq = document.getElementById('es-freq').value;
      const esEmail = document.getElementById('es-email').value.trim();
      if (esFreq && esEmail) {
        const esData = {
          recurring_task_id: taskId,
          to_email: esEmail,
          frequency: esFreq,
          day_of_week: parseInt(document.getElementById('es-dow').value),
          day_of_month: parseInt(document.getElementById('es-dom').value),
          nth_week: parseInt(document.getElementById('es-nth').value),
          weekday: parseInt(document.getElementById('es-weekday').value),
          send_time: document.getElementById('es-time').value,
          enabled: 1,
        };

        // 既存スケジュールを確認
        const schedRes = await fetch(`/api/email-schedules/${taskId}`);
        const existing = await schedRes.json();
        if (existing.length > 0) {
          await fetch(`/api/email-schedules/${existing[0].id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(esData),
          });
        } else {
          await fetch('/api/email-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(esData),
          });
        }
      }

      closeModal('recurring-modal');
      showToast('保存しました ✅', 'success');
      loadRecurring();
    } catch (e) {
      showToast('エラーが発生しました', 'error');
    }
  });
});
