let currentScreen = 0;
const screens = ['home-screen', 'charts-screen', 'entries-screen'];
let data = JSON.parse(localStorage.getItem('financeData')) || [];
let points = parseInt(localStorage.getItem('points') || '0');
let level = parseInt(localStorage.getItem('level') || '1');
let achievements = JSON.parse(localStorage.getItem('achievements')) || [];
let streak = parseInt(localStorage.getItem('streak') || '0');
let editingIndex = null;
let pieChart, barChart, lineChart;

const possibleAchievements = [
    { title: "Primeira Entrada", desc: "💾 Adicionou primeira receita/despesa!" },
    { title: "Saldo Positivo", desc: "⚖️ Primeiro saldo positivo!" }
];

// Funções definidas primeiro (para hoisting correto)
function showScreen(id) {
    screens.forEach((s, i) => document.getElementById(s).classList.toggle('hidden', i !== id));
    if (id === 1) updateCharts();
    if (id === 2) updateHistory();
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

    document.getElementById('progress-income').value = Math.min(totalIncome / 1000 * 100, 100);
    document.getElementById('progress-expenses').value = Math.min(totalExpenses / 1000 * 100, 100);

    const superflua = data.filter(d => d.category === 'Supérfluo').reduce((s, d) => s + d.amount, 0);
    document.getElementById('alerts').textContent = superflua > totalExpenses * 0.3 ? 'Alerta: Gastos supérfluos altos!' : '';

    document.getElementById('achievement-list').innerHTML = achievements.map(a => `<li>${a}</li>`).join('');
}

function updateCharts() {
    if (currentScreen !== 1) return;

    const required = data.filter(d => d.category === 'Obrigatório').reduce((s, d) => s + d.amount, 0);
    const necessary = data.filter(d => d.category === 'Necessário').reduce((s, d) => s + d.amount, 0);
    const superflua = data.filter(d => d.category === 'Supérfluo').reduce((s, d) => s + d.amount, 0);
    const totalExpenses = data.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    const totalIncome = data.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);

    const canvasPie = document.getElementById('pie-chart');
    canvasPie.width = canvasPie.width;
    const canvasBar = document.getElementById('bar-chart');
    canvasBar.width = canvasBar.width;
    const canvasLine = document.getElementById('line-chart');
    canvasLine.width = canvasLine.width;

    if (pieChart) pieChart.destroy();
    if (barChart) barChart.destroy();
    if (lineChart) lineChart.destroy();

    pieChart = new Chart(canvasPie, {
        type: 'pie',
        data: { labels: ['Obrigatório', 'Necessário', 'Supérfluo'], datasets: [{ data: [required, necessary, superflua], backgroundColor: ['#f00', '#ff0', '#0f0'] }] },
        options: { responsive: true }
    });

    barChart = new Chart(canvasBar, {
        type: 'bar',
        data: { labels: ['Mês Atual'], datasets: [
            { label: 'Receitas', data: [totalIncome], backgroundColor: '#0f0' },
            { label: 'Despesas', data: [totalExpenses], backgroundColor: '#f00' }
        ] },
        options: { responsive: true }
    });

    lineChart = new Chart(canvasLine, {
        type: 'line',
        data: { labels: Array.from({length: 12}, (_, i) => `Mês ${i+1}`), datasets: [{ label: 'Saldo', data: Array(12).fill(0).map((_, i) => sumUpTo(i)), borderColor: '#0f0' }] },
        options: { responsive: true }
    });
}

function updateHistory() {
    if (currentScreen !== 2) return;
    const tbody = document.getElementById('entries-body');
    tbody.innerHTML = '';
    data.forEach((entry, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.type === 'income' ? '💰 Receita' : '📉 Despesa'}</td>
            <td>R$ ${entry.amount.toFixed(2)}</td>
            <td>${entry.date}</td>
            <td>${entry.description}</td>
            <td>${entry.category || 'N/A'}</td>
            <td><button onclick="deleteEntry(${i})">🗑️</button> <button onclick="editEntry(${i})">✏️</button> <button onclick="duplicateEntry(${i})">🔁</button></td>
        `;
        tbody.appendChild(row);
    });
}

function sumUpTo(i) {
    const entries = data.slice(0, i + 1);
    const income = entries.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
    const expenses = entries.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    return income - expenses;
}

function deleteEntry(index) {
    data.splice(index, 1);
    saveData();
    updateUI();
}

function editEntry(index) {
    const entry = data[index];
    document.getElementById('amount').value = entry.amount;
    document.getElementById('date').value = entry.date;
    document.getElementById('description').value = entry.description;
    if (entry.category) document.getElementById('category').value = entry.category;
    document.querySelector(`input[name="type"][value="${entry.type}"]`).checked = true;
    document.getElementById('category-section').style.display = entry.type === 'expense' ? 'block' : 'none';
    editingIndex = index;
    document.getElementById('modal-title').textContent = 'Editar Lançamento';
    openAddModal();
}

function duplicateEntry(index) {
    const entry = { ...data[index], id: Date.now() };
    data.push(entry);
    saveData();
    updateUI();
}

function openAddModal() {
    document.getElementById('modal-add-entry').classList.remove('hidden');
}

function closeModal() {
    editingIndex = null;
    document.getElementById('finance-form').reset();
    document.getElementById('category-section').style.display = 'none';
    document.getElementById('modal-title').textContent = 'Novo Lançamento';
    document.getElementById('modal-add-entry').classList.add('hidden');
}

function handleFormSubmit(e) {
    e.preventDefault();
    const entry = {
        id: Date.now(),
        type: document.querySelector('input[name="type"]:checked').value,
        amount: parseFloat(document.getElementById('amount').value),
        date: document.getElementById('date').value,
        description: document.getElementById('description').value,
        category: document.querySelector('input[name="type"]:checked').value === 'expense' ? document.getElementById('category').value : null
    };
    if (editingIndex !== null) data[editingIndex] = entry; else data.push(entry);
    points += 10;
    streak++;
    if (points >= level * 100) level++;
    const randomAch = possibleAchievements[Math.floor(Math.random() * possibleAchievements.length)];
    if (!achievements.includes(randomAch.desc)) achievements.push(randomAch.desc);
    saveData();
    updateUI();
    closeModal();
}

function saveData() {
    localStorage.setItem('financeData', JSON.stringify(data));
    localStorage.setItem('points', points);
    localStorage.setItem('level', level);
    localStorage.setItem('streak', streak);
    localStorage.setItem('achievements', JSON.stringify(achievements));
}

// Event Listeners (após definições)
document.addEventListener('DOMContentLoaded', () => {
    showScreen(currentScreen); // Agora funciona
    updateUI();

    // Navegação
    document.getElementById('nav-left').addEventListener('click', () => {
        currentScreen = (currentScreen - 1 + screens.length) % screens.length;
        showScreen(currentScreen);
    });
    document.getElementById('nav-right').addEventListener('click', () => {
        currentScreen = (currentScreen + 1) % screens.length;
        showScreen(currentScreen);
    });

    // Theme
    document.getElementById('theme-switcher').addEventListener('click', () => {
        const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        document.body.dataset.theme = theme;
        document.getElementById('theme-switcher').textContent = theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('theme', theme);
    });

    document.getElementById('btn-add-entry').addEventListener('click', openAddModal);
    document.getElementById('btn-close-modal').addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    // Fechar modal com X, fundo, etc.
    document.querySelector('.close-btn').addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    document.getElementById('modal-add-entry').addEventListener('click', (e) => {
        if (e.target.id === 'modal-add-entry') closeModal();
    });
    document.getElementById('finance-form').addEventListener('submit', handleFormSubmit);

    // Form radio
    document.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener('change', (e) => {
        document.getElementById('category-section').style.display = e.target.value === 'expense' ? 'block' : 'none';
    }));
});
