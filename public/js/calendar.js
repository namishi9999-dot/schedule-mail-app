/**
 * calendar.js - カレンダー描画・日付クリック
 */

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-based
let selectedDate = todayStr();

// カレンダー上のタスク情報キャッシュ
let taskDates = new Set();       // 通常タスクがある日
let occurrenceDates = new Set(); // 定期タスクがある日

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DOW = ['日','月','火','水','木','金','土'];

async function fetchCalendarData(year, month) {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  taskDates = new Set();
  occurrenceDates = new Set();

  // 月の全日のタスクを取得する代わりに occurrences API を使用
  try {
    const [occRes] = await Promise.all([
      fetch(`/api/occurrences?month=${monthStr}`),
    ]);
    const occs = await occRes.json();
    for (const o of occs) {
      occurrenceDates.add(o.due_date);
    }
  } catch (e) {
    console.error('カレンダーデータ取得エラー:', e);
  }

  // 通常タスクは選択日ロード時に個別取得（月全体取得APIは未実装）
}

function renderCalendar() {
  const title = document.getElementById('calendar-title');
  const grid = document.getElementById('calendar-grid');
  if (!title || !grid) return;

  title.textContent = `${currentYear}年 ${MONTHS[currentMonth]}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = todayStr();

  // 曜日ヘッダー
  let html = DOW.map((d, i) =>
    `<div class="cal-dow ${i===0?'sun':i===6?'sat':''}">${d}</div>`
  ).join('');

  // 前月の空白
  const prevDays = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month"><span>${prevDays - i}</span></div>`;
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const isSel = dateStr === selectedDate;
    const hasTask = taskDates.has(dateStr);
    const hasOcc = occurrenceDates.has(dateStr);

    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (isSel) cls += ' selected';
    if (hasTask) cls += ' has-task';
    if (hasOcc) cls += ' has-recurring';

    const dot = (hasTask || hasOcc) ? '<span class="task-dot"></span>' : '';

    html += `<div class="${cls}" data-date="${dateStr}">
      ${dot}
      <span>${d}</span>
    </div>`;
  }

  // 翌月の空白（6行になるように）
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month"><span>${d}</span></div>`;
  }

  grid.innerHTML = html;

  // 日クリック
  grid.querySelectorAll('.cal-day[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      selectedDate = el.dataset.date;
      renderCalendar();
      loadDayTasks(selectedDate);
    });
  });
}

async function initCalendar() {
  await fetchCalendarData(currentYear, currentMonth);
  renderCalendar();
  loadDayTasks(selectedDate);

  document.getElementById('prev-month')?.addEventListener('click', async () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    await fetchCalendarData(currentYear, currentMonth);
    renderCalendar();
  });

  document.getElementById('next-month')?.addEventListener('click', async () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    await fetchCalendarData(currentYear, currentMonth);
    renderCalendar();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('calendar-grid')) {
    initCalendar();
  }
});
