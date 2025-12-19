let currentScreen = 0;
const screens = ['home-screen', 'charts-screen', 'entries-screen'];

let data = JSON.parse(localStorage.getItem('financeData')) || [];
let points = parseInt(localStorage.getItem('points') || '0', 10);
let level = parseInt(localStorage.getItem('level') || '1', 10);
let achievements = JSON.parse(localStorage.getItem('achievements')) || [];
let streak = parseInt(localStorage.getItem('streak') || '0', 10);

let editingIndex = null;
let pieChart, barChart, lineChart;

let lastFocusedElement = null;
let lastDeleted = null;

const possibleAchievements = [
  { title: "Primeira Entrada", desc: "💾 Adicionou primeira receita/despesa!" },
  { title: "Saldo Positivo", desc: "⚖️ Primeiro saldo positivo!" }
];

/* ===== Estado da view (filtros/ordenação) ===== */
const entriesView = {
  month: localStorage.getItem('entriesMonth') || currentMonthString(), // "YYYY-MM" ou ""
  type: localStorage.getItem('entriesType') || 'all',                 // all|income|expense
  category: localStorage.getItem('entriesCategory') || 'all',         // all|Obrigatório|Necessário|Supérfluo
  sortBy: localStorage.getItem('entriesSortBy') || 'date-desc'        // date-desc|date-asc|amount-desc|amount-asc
};

/* ========= Toast (feedback) ========= */
function showToast({
  message,
  variant = 'info',
  duration = 3500,
  actionText = null,
  onAction = null
}) {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${variant}`;
  toast.setAttribute('role', 'status');

  const msg = document.createElement('div');
  msg.className = 'toast__message';
  msg.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'toast__actions';

  let timeoutId = null;

  if (actionText && typeof onAction === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast__btn';
    actionBtn.textContent = actionText;
    actionBtn.addEventListener('click', () => {
      onAction();
      dismiss();
    });
    actions.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast__btn';
  closeBtn.textContent = 'Fechar';
  closeBtn.addEventListener('click', () => dismiss());
  actions.appendChild(closeBtn);

  toast.appendChild(msg);
  toast.appendChild(actions);
  region.appendChild(toast);

  function dismiss() {
    if (timeoutId) clearTimeout(timeoutId);
    toast.remove();
  }

  if (duration && duration > 0) {
    timeoutId = window.setTimeout(() => dismiss(), duration);
  }

  return { dismiss };
}
/* ========= /Toast ========= */

function showScreen(screenIndex) {
  screens.forEach((screenId, i) => {
    document.getElementById(screenId).classList.toggle('hidden', i !== screenIndex);
  });

  if (screenIndex === 1) updateCharts();
  if (screenIndex === 2) updateHistory();
}

function updateUI() {
  const totalIncome = data.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
  const totalExpenses = data.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
  const balance = totalIncome - totalExpenses;

  document.getElementById('balance').textContent = balance.toFixed(2);
  document.getElementById('total-income').textContent = totalIncome.toFixed(2);
  document.getElementById('total-expenses').textContent = totalExpenses.toFixed(2);
  document.getElementById('points').textContent = points;
  document.getElementById('level').textContent = level;
  document.getElementById('streak').textContent = streak;

  document.getElementById('progress-income').value = Math.min((totalIncome / 1000) * 100, 100);
  document.getElementById('progress-expenses').value = Math.min((totalExpenses / 1000) * 100, 100);

  const superflua = data.filter(d => d.category === 'Supérfluo').reduce((s, d) => s + d.amount, 0);
  document.getElementById('alerts').textContent =
    totalExpenses > 0 && superflua > totalExpenses * 0.3
      ? 'Alerta: Gastos supérfluos altos!'
      : '';

  document.getElementById('achievement-list').innerHTML =
    achievements.map(a => `<li>${a}</li>`).join('');

  if (currentScreen === 1) updateCharts();
  if (currentScreen === 2) updateHistory();
}

function sumUpTo(i) {
  const entries = data.slice(0, i + 1);
  const income = entries.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
  const expenses = entries.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
  return income - expenses;
}

function updateCharts() {
  if (currentScreen !== 1) return;

  const required = data.filter(d => d.category === 'Obrigatório').reduce((s, d) => s + d.amount, 0);
  const necessary = data.filter(d => d.category === 'Necessário').reduce((s, d) => s + d.amount, 0);
  const superflua = data.filter(d => d.category === 'Supérfluo').reduce((s, d) => s + d.amount, 0);

  const totalExpenses = data.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
  const totalIncome = data.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);

  const canvasPie = document.getElementById('pie-chart');
  const canvasBar = document.getElementById('bar-chart');
  const canvasLine = document.getElementById('line-chart');

  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();
  if (lineChart) lineChart.destroy();

  pieChart = new Chart(canvasPie, {
    type: 'pie',
    data: {
      labels: ['Obrigatório', 'Necessário', 'Supérfluo'],
      datasets: [{ data: [required, necessary, superflua], backgroundColor: ['#f00', '#ff0', '#9b59b6'] }]
    },
    options: { responsive: true }
  });

  barChart = new Chart(canvasBar, {
    type: 'bar',
    data: {
      labels: ['Mês Atual'],
      datasets: [
        { label: 'Receitas', data: [totalIncome], backgroundColor: '#0f0' },
        { label: 'Despesas', data: [totalExpenses], backgroundColor: '#f00' }
      ]
    },
    options: { responsive: true }
  });

  lineChart = new Chart(canvasLine, {
    type: 'line',
    data: {
      labels: Array.from({ length: 12 }, (_, i) => `Mês ${i + 1}`),
      datasets: [{
        label: 'Saldo',
        data: Array(12).fill(0).map((_, i) => sumUpTo(i)),
        borderColor: '#0f0'
      }]
    },
    options: { responsive: true }
  });
}

function saveData() {
  localStorage.setItem('financeData', JSON.stringify(data));
  localStorage.setItem('points', String(points));
  localStorage.setItem('level', String(level));
  localStorage.setItem('streak', String(streak));
  localStorage.setItem('achievements', JSON.stringify(achievements));
}

function setCategoryVisibilityByType(type) {
  const section = document.getElementById('category-section');
  const category = document.getElementById('category');

  const isExpense = type === 'expense';
  section.style.display = isExpense ? 'block' : 'none';

  category.required = isExpense;
  if (!isExpense) category.value = 'Obrigatório';
}

function openAddModal() {
  lastFocusedElement = document.activeElement;

  const modal = document.getElementById('modal-add-entry');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  const dateInput = document.getElementById('date');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  const type = document.querySelector('input[name="type"]:checked')?.value || 'income';
  setCategoryVisibilityByType(type);

  document.getElementById('amount')?.focus();
}

function closeModal() {
  editingIndex = null;

  document.getElementById('finance-form').reset();
  document.getElementById('modal-title').textContent = 'Novo Lançamento';
  setCategoryVisibilityByType('income');

  const modal = document.getElementById('modal-add-entry');
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

/* ===== Helpers ===== */
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentMonthString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function categoryClass(entry) {
  if (entry.type === 'income') return 'income';
  if (entry.category === 'Obrigatório') return 'obrigatorio';
  if (entry.category === 'Necessário') return 'necessario';
  if (entry.category === 'Supérfluo') return 'superfluo';
  return 'necessario';
}

function categoryLabel(entry) {
  if (entry.type === 'income') return 'Receita';
  return entry.category || 'Despesa';
}

function persistEntriesView() {
  localStorage.setItem('entriesMonth', entriesView.month);
  localStorage.setItem('entriesType', entriesView.type);
  localStorage.setItem('entriesCategory', entriesView.category);
  localStorage.setItem('entriesSortBy', entriesView.sortBy);
}

function getVisibleEntries() {
  // retorna [{ entry, index }] para manter índice original
  let list = data.map((entry, index) => ({ entry, index }));

  // filtro por mês: se entriesView.month === "" => todos
  if (entriesView.month) {
    list = list.filter(({ entry }) => typeof entry.date === 'string' && entry.date.startsWith(entriesView.month));
  }

  // filtro por tipo
  if (entriesView.type !== 'all') {
    list = list.filter(({ entry }) => entry.type === entriesView.type);
  }

  // filtro por categoria (somente despesas fazem sentido)
  if (entriesView.category !== 'all') {
    list = list.filter(({ entry }) => entry.type === 'expense' && entry.category === entriesView.category);
  }

  // ordenação
  const sort = entriesView.sortBy;
  list.sort((a, b) => {
    if (sort === 'date-desc') return (b.entry.date || '').localeCompare(a.entry.date || '');
    if (sort === 'date-asc') return (a.entry.date || '').localeCompare(b.entry.date || '');
    if (sort === 'amount-desc') return (b.entry.amount || 0) - (a.entry.amount || 0);
    if (sort === 'amount-asc') return (a.entry.amount || 0) - (b.entry.amount || 0);
    return 0;
  });

  return list;
}

function updateEntriesSummary(visible) {
  const chipPeriod = document.getElementById('chip-period');
  const chipCount = document.getElementById('chip-count');
  const chipIncome = document.getElementById('chip-income');
  const chipExpense = document.getElementById('chip-expense');

  const periodLabel = entriesView.month ? entriesView.month : 'Todos';
  const incomeSum = visible.filter(x => x.entry.type === 'income').reduce((s, x) => s + (x.entry.amount || 0), 0);
  const expenseSum = visible.filter(x => x.entry.type === 'expense').reduce((s, x) => s + (x.entry.amount || 0), 0);

  chipPeriod.textContent = `Período: ${periodLabel}`;
  chipCount.textContent = `Itens: ${visible.length}`;
  chipIncome.textContent = `Receitas: R$ ${formatBRL(incomeSum)}`;
  chipExpense.textContent = `Despesas: R$ ${formatBRL(expenseSum)}`;
}

/* ===== Swipe actions ===== */
function closeAllSwipes(exceptEl = null) {
  document.querySelectorAll('.entry-swipe[data-swipe]').forEach(el => {
    if (exceptEl && el === exceptEl) return;
    el.removeAttribute('data-swipe');
    const content = el.querySelector('.entry-swipe__content');
    if (content) content.style.transform = '';
  });
}

function initSwipeHandlers() {
  const list = document.getElementById('entries-list');
  if (!list) return;

  let activeSwipe = null;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let decided = false;
  let allowSwipe = false;

  list.addEventListener('pointerdown', (e) => {
    const content = e.target.closest('.entry-swipe__content');
    if (!content) return;

    const swipe = content.closest('.entry-swipe');
    if (!swipe) return;

    // Evita iniciar swipe ao clicar em botões
    if (e.target.closest('button')) return;

    activeSwipe = swipe;
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    decided = false;
    allowSwipe = false;

    closeAllSwipes(activeSwipe);
    content.setPointerCapture(e.pointerId);
  });

  list.addEventListener('pointermove', (e) => {
    if (!isDragging || !activeSwipe) return;

    const content = activeSwipe.querySelector('.entry-swipe__content');
    if (!content) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = true;
      allowSwipe = Math.abs(dx) > Math.abs(dy);
    }

    if (!allowSwipe) return;

    // agora é swipe horizontal: evita scroll “competir”
    e.preventDefault();

    const reveal = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--swipe-reveal'), 10) || 128;
    const clamped = Math.max(-reveal, Math.min(reveal, dx));

    // movimentação “ao vivo”
    content.style.transition = 'none';
    content.style.transform = `translateX(${clamped}px)`;
  }, { passive: false });

  list.addEventListener('pointerup', (e) => {
    if (!isDragging || !activeSwipe) return;

    const content = activeSwipe.querySelector('.entry-swipe__content');
    if (!content) return;

    const dx = e.clientX - startX;
    const reveal = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--swipe-reveal'), 10) || 128;

    content.style.transition = '';
    content.style.transform = '';

    if (allowSwipe) {
      if (dx > reveal / 2) {
        activeSwipe.setAttribute('data-swipe', 'open-left');
      } else if (dx < -reveal / 2) {
        activeSwipe.setAttribute('data-swipe', 'open-right');
      } else {
        activeSwipe.removeAttribute('data-swipe');
      }
    }

    isDragging = false;
    decided = false;
    allowSwipe = false;
    activeSwipe = null;
  });

  // Fecha swipe ao tocar fora
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.entry-swipe')) return;
    closeAllSwipes();
  });
}

/* ===== Render de cards ===== */
function updateHistory() {
  if (currentScreen !== 2) return;

  const listEl = document.getElementById('entries-list');
  const emptyEl = document.getElementById('entries-empty');

  const visible = getVisibleEntries();
  updateEntriesSummary(visible);

  listEl.innerHTML = '';
  closeAllSwipes();

  if (visible.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  visible.forEach(({ entry, index }) => {
    const isExpense = entry.type === 'expense';
    const catCls = categoryClass(entry);
    const titleIcon = isExpense ? '📉' : '💰';
    const amountCls = isExpense ? 'entry-card__amount entry-card__amount--expense' : 'entry-card__amount';

    const item = document.createElement('article');
    item.className = 'entry-swipe';
    item.setAttribute('role', 'listitem');

    item.innerHTML = `
      <div class="entry-swipe__actions entry-swipe__actions--left" aria-hidden="true">
        <button type="button" class="pixel-btn btn-compact" data-action="edit" data-index="${index}">✏️</button>
        <button type="button" class="pixel-btn btn-compact" data-action="duplicate" data-index="${index}">🔁</button>
      </div>

      <div class="entry-swipe__actions entry-swipe__actions--right" aria-hidden="true">
        <button type="button" class="pixel-btn btn-compact" data-action="delete" data-index="${index}">🗑️</button>
      </div>

      <div class="entry-swipe__content">
        <div class="entry-card entry-card--${catCls}">
          <div class="entry-card__top">
            <div class="entry-card__title">${titleIcon} ${escapeHtml(entry.description)}</div>
            <span class="badge badge--${catCls}">${escapeHtml(categoryLabel(entry))}</span>
          </div>

          <div class="entry-card__meta">
            <div class="entry-card__row">
              <span class="${amountCls}">R$ ${formatBRL(entry.amount || 0)}</span>
              <span>📅 ${escapeHtml(entry.date || '')}</span>
            </div>
          </div>

          <div class="entry-card__row" style="margin-top: 10px;">
            <button type="button" class="pixel-btn btn-compact" data-action="edit" data-index="${index}">✏️ Editar</button>
            <button type="button" class="pixel-btn btn-compact" data-action="duplicate" data-index="${index}">🔁 Duplicar</button>
            <button type="button" class="pixel-btn btn-compact" data-action="delete" data-index="${index}">🗑️ Excluir</button>
          </div>
        </div>
      </div>
    `;

    listEl.appendChild(item);
  });
}

/* ========= CRUD com feedback ========= */
function deleteEntry(index) {
  const entry = data[index];
  if (!entry) return;

  const ok = window.confirm('Deseja realmente excluir este lançamento?');
  if (!ok) return;

  lastDeleted = { entry: { ...entry }, index };

  data.splice(index, 1);
  saveData();
  updateUI();

  showToast({
    message: 'Lançamento excluído.',
    variant: 'danger',
    duration: 6000,
    actionText: 'Desfazer',
    onAction: () => {
      if (!lastDeleted) return;

      const insertAt = Math.min(lastDeleted.index, data.length);
      data.splice(insertAt, 0, lastDeleted.entry);

      lastDeleted = null;
      saveData();
      updateUI();

      showToast({ message: 'Exclusão desfeita.', variant: 'success', duration: 2500 });
    }
  });
}

function editEntry(index) {
  const entry = data[index];
  if (!entry) return;

  document.getElementById('amount').value = entry.amount;
  document.getElementById('date').value = entry.date;
  document.getElementById('description').value = entry.description;

  document.querySelector(`input[name="type"][value="${entry.type}"]`).checked = true;
  setCategoryVisibilityByType(entry.type);

  if (entry.category) document.getElementById('category').value = entry.category;

  editingIndex = index;
  document.getElementById('modal-title').textContent = 'Editar Lançamento';
  openAddModal();
}

function duplicateEntry(index) {
  const original = data[index];
  if (!original) return;

  const entry = { ...original, id: Date.now() };
  data.push(entry);
  saveData();
  updateUI();

  showToast({ message: 'Lançamento duplicado.', variant: 'success', duration: 2500 });
}

function handleFormSubmit(e) {
  e.preventDefault();

  const type = document.querySelector('input[name="type"]:checked')?.value;
  const amount = parseFloat(document.getElementById('amount').value);
  const date = document.getElementById('date').value;
  const description = document.getElementById('description').value.trim();
  const category = (type === 'expense') ? document.getElementById('category').value : null;

  if (!type || Number.isNaN(amount) || amount <= 0 || !date || !description) {
    showToast({
      message: 'Preencha todos os campos corretamente (valor > 0 e descrição).',
      variant: 'danger',
      duration: 4000
    });
    return;
  }

  const entry = { id: Date.now(), type, amount, date, description, category };
  const isEdit = editingIndex !== null;

  if (isEdit) data[editingIndex] = entry;
  else data.push(entry);

  points += 10;
  streak += 1;
  if (points >= level * 100) level += 1;

  const randomAch = possibleAchievements[Math.floor(Math.random() * possibleAchievements.length)];
  if (!achievements.includes(randomAch.desc)) achievements.push(randomAch.desc);

  saveData();
  updateUI();
  closeModal();

  showToast({
    message: isEdit ? 'Lançamento atualizado com sucesso.' : 'Lançamento salvo com sucesso.',
    variant: 'success',
    duration: 2500
  });
}
/* ========= /CRUD ========= */

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.body.dataset.theme = savedTheme;
    document.getElementById('theme-switcher').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
}

/* ===== Controles: sincroniza UI <-> estado ===== */
function syncEntriesControlsFromState() {
  const month = document.getElementById('filter-month');
  const type = document.getElementById('filter-type');
  const category = document.getElementById('filter-category');
  const sortBy = document.getElementById('sort-by');

  month.value = entriesView.month || '';
  type.value = entriesView.type;
  category.value = entriesView.category;
  sortBy.value = entriesView.sortBy;
}

function wireEntriesControls() {
  const month = document.getElementById('filter-month');
  const type = document.getElementById('filter-type');
  const category = document.getElementById('filter-category');
  const sortBy = document.getElementById('sort-by');

  month.addEventListener('change', () => {
    entriesView.month = month.value || '';
    persistEntriesView();
    updateHistory();
  });

  type.addEventListener('change', () => {
    entriesView.type = type.value;
    persistEntriesView();
    updateHistory();
  });

  category.addEventListener('change', () => {
    entriesView.category = category.value;
    persistEntriesView();
    updateHistory();
  });

  sortBy.addEventListener('change', () => {
    entriesView.sortBy = sortBy.value;
    persistEntriesView();
    updateHistory();
  });

  // Chips rápidos
  document.querySelector('.chip-row')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-chip]');
    if (!btn) return;

    const chip = btn.dataset.chip;

    if (chip === 'month-current') entriesView.month = currentMonthString();
    if (chip === 'month-all') entriesView.month = '';

    if (chip === 'type-all') entriesView.type = 'all';
    if (chip === 'type-expense') entriesView.type = 'expense';
    if (chip === 'type-income') entriesView.type = 'income';

    persistEntriesView();
    syncEntriesControlsFromState();
    updateHistory();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // Aplica estado inicial nos controles (antes de renderizar)
  syncEntriesControlsFromState();
  wireEntriesControls();
  initSwipeHandlers();

  showScreen(currentScreen);
  updateUI();

  document.getElementById('nav-left').addEventListener('click', () => {
    currentScreen = (currentScreen - 1 + screens.length) % screens.length;
    showScreen(currentScreen);
  });

  document.getElementById('nav-right').addEventListener('click', () => {
    currentScreen = (currentScreen + 1) % screens.length;
    showScreen(currentScreen);
  });

  document.getElementById('theme-switcher').addEventListener('click', () => {
    const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = theme;
    document.getElementById('theme-switcher').textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
    showToast({ message: 'Tema alterado.', variant: 'info', duration: 1800 });
  });

  document.getElementById('btn-add-entry').addEventListener('click', () => {
    document.getElementById('modal-title').textContent = 'Novo Lançamento';
    editingIndex = null;
    openAddModal();
  });

  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.querySelector('.close-btn').addEventListener('click', closeModal);

  document.getElementById('modal-add-entry').addEventListener('click', (e) => {
    if (e.target.id === 'modal-add-entry') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal-add-entry');
      if (modal && !modal.classList.contains('hidden')) closeModal();
    }
  });

  document.getElementById('finance-form').addEventListener('submit', handleFormSubmit);

  document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', (e) => setCategoryVisibilityByType(e.target.value));
  });

  // Delegação de eventos: ações nos cards (botões visíveis e swipe)
  document.getElementById('entries-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action][data-index]');
    if (!btn) return;

    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index, 10);
    if (Number.isNaN(index)) return;

    closeAllSwipes();

    if (action === 'delete') deleteEntry(index);
    if (action === 'edit') editEntry(index);
    if (action === 'duplicate') duplicateEntry(index);
  });
});
