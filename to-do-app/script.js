'use strict';

/*
 * To Do or Not To Do — app logic
 * All state is kept in one object and persisted to localStorage (the
 * browser's cache) under STORAGE_KEY. On every load we read that key
 * back out and re-render, so tasks and reminders survive a refresh,
 * closing the tab, or restarting the browser.
 */

const STORAGE_KEY = 'todoApp:data:v1';

const DAYS = [
  { key: 'MON', label: 'MON' },
  { key: 'TUE', label: 'TUE' },
  { key: 'WED', label: 'WED' },
  { key: 'THU', label: 'THU' },
  { key: 'FRI', label: 'FRI' },
];

function defaultData() {
  const tasks = {};
  DAYS.forEach((d) => { tasks[d.key] = []; });
  return { tasks, reminders: [] };
}

/** Load saved state from localStorage, falling back to an empty structure
 *  if nothing is saved yet or the saved value is corrupted. */
function loadData() {
  let data;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    data = raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Could not read saved to-do data, starting fresh.', err);
    data = null;
  }

  const fallback = defaultData();
  if (!data || typeof data !== 'object') return fallback;

  // Defensively merge so a partially-corrupted or older-shaped save
  // still loads instead of wiping the user's data.
  const merged = {
    tasks: {},
    reminders: Array.isArray(data.reminders) ? data.reminders : [],
  };
  DAYS.forEach((d) => {
    merged.tasks[d.key] = Array.isArray(data.tasks?.[d.key]) ? data.tasks[d.key] : [];
  });
  return merged;
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // e.g. private-browsing mode with storage disabled, or quota exceeded
    console.warn('Could not save to-do data to this browser.', err);
  }
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let state = loadData();

/* --------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------- */

const weekEl = document.getElementById('week');
const remindersListEl = document.getElementById('remindersList');
const remindersEmptyHintEl = document.getElementById('remindersEmptyHint');
const reminderForm = document.getElementById('reminderForm');
const reminderInput = document.getElementById('reminderInput');
const clearAllBtn = document.getElementById('clearAllBtn');

/** Build one <li> for a task or reminder. Uses textContent (never
 *  innerHTML) for the user-supplied text so it can never be parsed as
 *  markup. */
function buildItem(item, { onToggle, onDelete, showCheckbox }) {
  const li = document.createElement('li');
  li.className = 'task-item' + (item.done ? ' done' : '');
  li.dataset.id = item.id;

  if (showCheckbox) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!item.done;
    checkbox.setAttribute('aria-label', `Mark "${item.text}" complete`);
    checkbox.addEventListener('change', () => onToggle(item.id));
    li.appendChild(checkbox);
  }

  const span = document.createElement('span');
  span.className = 'task-text';
  span.textContent = item.text;
  li.appendChild(span);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delete-btn';
  del.setAttribute('aria-label', `Delete "${item.text}"`);
  del.textContent = '\u00D7'; // ×
  del.addEventListener('click', () => onDelete(item.id));
  li.appendChild(del);

  return li;
}

function renderWeek() {
  weekEl.innerHTML = '';

  DAYS.forEach((day, index) => {
    const row = document.createElement('div');
    row.className = 'row' + (index % 2 === 0 ? ' secondary-background' : '');

    const dayCell = document.createElement('div');
    dayCell.className = 'day square';
    const h3 = document.createElement('h3');
    h3.textContent = day.label;
    dayCell.appendChild(h3);
    row.appendChild(dayCell);

    const tasksCell = document.createElement('div');
    tasksCell.className = 'tasks-cell';

    const list = document.createElement('ul');
    list.className = 'task-list';
    const dayTasks = state.tasks[day.key];

    if (dayTasks.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'empty-hint';
      hint.textContent = 'No tasks yet.';
      tasksCell.appendChild(hint);
    } else {
      dayTasks.forEach((task) => {
        list.appendChild(buildItem(task, {
          showCheckbox: true,
          onToggle: (id) => toggleTask(day.key, id),
          onDelete: (id) => deleteTask(day.key, id),
        }));
      });
      tasksCell.appendChild(list);
    }

    const form = document.createElement('form');
    form.className = 'add-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'add-input';
    input.placeholder = 'Add a task…';
    input.maxLength = 80;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', `Add a task for ${day.label}`);

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'add-btn';
    btn.setAttribute('aria-label', `Add task for ${day.label}`);
    btn.textContent = '+';

    form.appendChild(input);
    form.appendChild(btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      addTask(day.key, input.value);
      input.value = '';
      input.focus();
    });

    tasksCell.appendChild(form);
    row.appendChild(tasksCell);
    weekEl.appendChild(row);
  });
}

function renderReminders() {
  remindersListEl.innerHTML = '';

  if (state.reminders.length === 0) {
    remindersEmptyHintEl.style.display = '';
  } else {
    remindersEmptyHintEl.style.display = 'none';
    state.reminders.forEach((reminder) => {
      remindersListEl.appendChild(buildItem(reminder, {
        showCheckbox: false,
        onToggle: () => {},
        onDelete: (id) => deleteReminder(id),
      }));
    });
  }
}

function render() {
  renderWeek();
  renderReminders();
}

/* --------------------------------------------------------------------
   Mutations — each one updates state, saves, then re-renders just the
   affected section.
   -------------------------------------------------------------------- */

function addTask(dayKey, rawText) {
  const text = rawText.trim();
  if (!text) return;
  state.tasks[dayKey].push({ id: makeId(), text, done: false });
  saveData();
  renderWeek();
}

function toggleTask(dayKey, id) {
  const task = state.tasks[dayKey].find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveData();
  renderWeek();
}

function deleteTask(dayKey, id) {
  state.tasks[dayKey] = state.tasks[dayKey].filter((t) => t.id !== id);
  saveData();
  renderWeek();
}

function addReminder(rawText) {
  const text = rawText.trim();
  if (!text) return;
  state.reminders.push({ id: makeId(), text, done: false });
  saveData();
  renderReminders();
}

function deleteReminder(id) {
  state.reminders = state.reminders.filter((r) => r.id !== id);
  saveData();
  renderReminders();
}

function clearAll() {
  const confirmed = window.confirm('Clear every task and reminder? This cannot be undone.');
  if (!confirmed) return;
  state = defaultData();
  saveData();
  render();
}

/* --------------------------------------------------------------------
   Wire up static elements + initial render
   -------------------------------------------------------------------- */

reminderForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addReminder(reminderInput.value);
  reminderInput.value = '';
  reminderInput.focus();
});

clearAllBtn.addEventListener('click', clearAll);

render();