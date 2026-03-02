/**
 * tasks.js - タスクCRUD・完了処理（localStorage版）
 */

function loadDayTasks(date) {
  const label = document.getElementById('day-label');
  const list = document.getElementById('task-list');
  const recurringList = document.getElementById('recurring-today-list');
  const newDateInput = document.getElementById('new-task-date');

  if (label) {
    label.textContent = date === todayStr() ? '今日のタスク' : `${date} のタスク`;
  }
  if (newDateInput) newDateInput.value = date;

  // 通常タスク
  if (list) {
    const tasks = getTasksByDate(date);
    renderTaskList(list, tasks);
    if (tasks.length > 0) taskDates.add(date); else taskDates.delete(date);
    renderCalendar();
  }

  // 定期タスク（発生分）
  if (recurringList) {
    const month = date.slice(0, 7);
    const occs = getOccurrencesByMonth(month).filter(o => o.due_date === date);
    renderOccurrenceList(recurringList, occs);
  }
}

function renderTaskList(container, tasks) {
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="icon">📋</div><p>タスクがありません</p>
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

  container.querySelectorAll('[data-check]').forEach(el => {
    el.addEventListener('click', () => {
      const item = el.closest('.task-item');
      if (item.classList.contains('completed')) return;
      completeTask(el.dataset.check);
      showToast('タスクを完了しました ✅', 'success');
      loadDayTasks(selectedDate);
    });
  });

  container.querySelectorAll('[data-del]').forEach(el => {
    el.addEventListener('click', () => {
      if (!confirm('タスクを削除しますか？')) return;
      deleteTask(el.dataset.del);
      showToast('タスクを削除しました', 'info');
      loadDayTasks(selectedDate);
    });
  });
}

function renderOccurrenceList(container, occs) {
  if (!occs.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="icon">🔄</div><p>定期タスクなし</p>
    </div>`;
    return;
  }
  container.innerHTML = occs.map(o => `
    <div class="task-item ${o.completed ? 'completed' : ''}" data-occ="${o.id}">
      <div class="task-check ${o.completed ? 'done' : ''}" data-occ-check="${o.id}">
        ${o.completed ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">🔄 ${escapeHtml(o.title)}</div>
        ${o.link ? `<a class="task-link" href="${escapeHtml(o.link)}" target="_blank" rel="noopener">${escapeHtml(o.link)}</a>` : ''}
        ${o.description ? `<div class="task-meta">${escapeHtml(o.description)}</div>` : ''}
        ${o.completed_at ? `<div class="task-meta">✅ ${o.completed_at.slice(0,16)}</div>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-occ-check]').forEach(el => {
    el.addEventListener('click', () => {
      const item = el.closest('.task-item');
      if (item.classList.contains('completed')) return;
      completeOccurrence(el.dataset.occCheck);
      showToast('定期タスクを完了しました ✅', 'success');
      loadDayTasks(selectedDate);
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

  submitBtn?.addEventListener('click', () => {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const date = document.getElementById('new-task-date').value;
    if (!title) { showToast('タスク名を入力してください', 'error'); return; }
    addTask(date, title, desc);
    closeModal('add-task-modal');
    showToast('タスクを追加しました', 'success');
    if (date === selectedDate) loadDayTasks(selectedDate);
    else {
      fetchCalendarData(currentYear, currentMonth);
      renderCalendar();
    }
  });

  document.getElementById('new-task-title')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn?.click();
  });
});
