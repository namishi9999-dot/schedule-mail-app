/**
 * tasks.js - タスクCRUD・完了処理・カレンダー連携
 */

async function loadDayTasks(date) {
  const label = document.getElementById('day-label');
  const list = document.getElementById('task-list');
  const recurringList = document.getElementById('recurring-today-list');
  const newDateInput = document.getElementById('new-task-date');

  if (label) {
    const today = todayStr();
    if (date === today) label.textContent = '今日のタスク';
    else label.textContent = `${date} のタスク`;
  }
  if (newDateInput) newDateInput.value = date;

  // 通常タスク
  if (list) {
    list.innerHTML = '<div class="text-muted text-sm" style="padding:8px">読み込み中...</div>';
    try {
      const res = await fetch(`/api/tasks?date=${date}`);
      const tasks = await res.json();
      renderTaskList(list, tasks);
      // カレンダーのドット更新
      if (tasks.length > 0) {
        taskDates.add(date);
      } else {
        taskDates.delete(date);
      }
      renderCalendar();
    } catch (e) {
      list.innerHTML = '<p class="text-muted">読み込みエラー</p>';
    }
  }

  // 定期タスク（発生分）
  if (recurringList) {
    const month = date.slice(0, 7);
    try {
      const res = await fetch(`/api/occurrences?month=${month}`);
      const occs = await res.json();
      const dayOccs = occs.filter(o => o.due_date === date);
      renderOccurrenceList(recurringList, dayOccs);
    } catch (e) {
      recurringList.innerHTML = '<p class="text-muted">読み込みエラー</p>';
    }
  }
}

function renderTaskList(container, tasks) {
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="icon">📋</div>
      <p>タスクがありません</p>
    </div>`;
    return;
  }
  container.innerHTML = tasks.map(t => `
    <div class="task-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
      <div class="task-check ${t.completed ? 'done' : ''}" data-check="${t.id}">
        ${t.completed ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="task-meta">${escapeHtml(t.description)}</div>` : ''}
        ${t.completed_at ? `<div class="task-meta">✅ ${t.completed_at.slice(0,16)}</div>` : ''}
      </div>
      ${!t.completed ? `<button class="task-del-btn" data-del="${t.id}" title="削除">🗑</button>` : ''}
    </div>
  `).join('');

  // 完了チェック
  container.querySelectorAll('[data-check]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.check;
      const item = el.closest('.task-item');
      if (item.classList.contains('completed')) return;
      try {
        await fetch(`/api/tasks/${id}/complete`, { method: 'PUT' });
        showToast('タスクを完了しました ✅', 'success');
        loadDayTasks(selectedDate);
      } catch (e) {
        showToast('エラーが発生しました', 'error');
      }
    });
  });

  // 削除
  container.querySelectorAll('[data-del]').forEach(el => {
    el.addEventListener('click', async () => {
      if (!confirm('タスクを削除しますか？')) return;
      try {
        await fetch(`/api/tasks/${el.dataset.del}`, { method: 'DELETE' });
        showToast('タスクを削除しました', 'info');
        loadDayTasks(selectedDate);
      } catch (e) {
        showToast('エラーが発生しました', 'error');
      }
    });
  });
}

function renderOccurrenceList(container, occs) {
  if (!occs.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="icon">🔄</div>
      <p>定期タスクなし</p>
    </div>`;
    return;
  }
  container.innerHTML = occs.map(o => `
    <div class="task-item ${o.completed ? 'completed' : ''}" data-occ="${o.id}">
      <div class="task-check ${o.completed ? 'done' : ''}" data-occ-check="${o.id}">
        ${o.completed ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">
          🔄 ${escapeHtml(o.title)}
        </div>
        ${o.link ? `<a class="task-link" href="${escapeHtml(o.link)}" target="_blank" rel="noopener">${escapeHtml(o.link)}</a>` : ''}
        ${o.description ? `<div class="task-meta">${escapeHtml(o.description)}</div>` : ''}
        ${o.completed_at ? `<div class="task-meta">✅ ${o.completed_at.slice(0,16)}</div>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-occ-check]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.occCheck;
      const item = el.closest('.task-item');
      if (item.classList.contains('completed')) return;
      try {
        await fetch(`/api/occurrences/${id}/complete`, { method: 'PUT' });
        showToast('定期タスクを完了しました ✅', 'success');
        loadDayTasks(selectedDate);
      } catch (e) {
        showToast('エラーが発生しました', 'error');
      }
    });
  });
}

// タスク追加モーダル
document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('add-task-btn');
  const cancelBtn = document.getElementById('cancel-add-task');
  const submitBtn = document.getElementById('submit-add-task');

  addBtn?.addEventListener('click', () => {
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-desc').value = '';
    document.getElementById('new-task-date').value = selectedDate;
    openModal('add-task-modal');
  });

  cancelBtn?.addEventListener('click', () => closeModal('add-task-modal'));

  submitBtn?.addEventListener('click', async () => {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const date = document.getElementById('new-task-date').value;
    if (!title) {
      showToast('タスク名を入力してください', 'error');
      return;
    }
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, title, description: desc }),
      });
      closeModal('add-task-modal');
      showToast('タスクを追加しました', 'success');
      loadDayTasks(date === selectedDate ? selectedDate : date);
    } catch (e) {
      showToast('エラーが発生しました', 'error');
    }
  });

  // Enterキーで送信
  document.getElementById('new-task-title')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn?.click();
  });
});
