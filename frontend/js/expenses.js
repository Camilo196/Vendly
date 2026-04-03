let allExpenses = [];

function getExpenseCategoryLabel(category = '') {
    return {
        arriendo: 'Arriendo',
        servicios: 'Servicios',
        nomina: 'Nomina',
        transporte: 'Transporte',
        mercadeo: 'Mercadeo',
        papeleria: 'Papeleria',
        mantenimiento: 'Mantenimiento',
        impuestos: 'Impuestos',
        otros: 'Otros'
    }[category] || category || 'Otros';
}

function getExpensePaymentLabel(method = '') {
    return {
        cash: 'Efectivo',
        transfer: 'Transferencia',
        card: 'Tarjeta',
        other: 'Otro'
    }[method] || method || 'Otro';
}

function getExpenseFilters() {
    return {
        period: document.getElementById('expensePeriod')?.value || 'monthly',
        category: document.getElementById('expenseCategoryFilter')?.value || ''
    };
}

async function loadExpensesView() {
    try {
        const filters = getExpenseFilters();
        const response = await api.getExpenses(filters);
        if (!response.success) return;

        allExpenses = response.expenses || [];
        renderExpenseSummary(response.summary || { total: 0, count: 0, byCategory: {} }, filters.period);
        renderExpensesList(allExpenses);
    } catch (error) {
        console.error('Error loading expenses:', error);
        utils.showToast('Error al cargar gastos', 'error');
    }
}

function renderExpenseSummary(summary = {}, period = 'monthly') {
    const container = document.getElementById('expensesSummary');
    if (!container) return;

    const topCategory = Object.entries(summary.byCategory || {})
        .sort((a, b) => b[1] - a[1])[0];

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Gastos ${period === 'previous_month' ? 'Mes Anterior' : period === 'monthly' ? 'Mes Actual' : period === 'daily' ? 'Hoy' : 'Totales'}</div>
            <div class="stat-value warning">${utils.formatMoney(summary.total || 0)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Registros</div>
            <div class="stat-value">${summary.count || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Categoria Principal</div>
            <div class="stat-value">${topCategory ? getExpenseCategoryLabel(topCategory[0]) : 'Sin datos'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Monto Principal</div>
            <div class="stat-value">${topCategory ? utils.formatMoney(topCategory[1]) : utils.formatMoney(0)}</div>
        </div>
    `;
}

function renderExpensesList(expenses = []) {
    const container = document.getElementById('expensesList');
    if (!container) return;

    if (!expenses.length) {
        container.innerHTML = '<div class="empty-state"><p>No hay gastos registrados para este periodo</p></div>';
        return;
    }

    container.innerHTML = expenses.map(expense => `
        <div class="purchase-item">
            <div class="purchase-header">
                <div>
                    <strong>${escapeHtml(expense.description || 'Gasto')}</strong>
                    <small>${formatDate(expense.expenseDate)}</small>
                </div>
                <div class="purchase-actions">
                    <button class="btn btn-sm btn-danger" onclick="deleteExpenseRecord('${expense._id}')">🗑️</button>
                </div>
            </div>
            <div class="purchase-details">
                <span>Categoría: <strong>${escapeHtml(getExpenseCategoryLabel(expense.category))}</strong></span>
                <span>Monto: <strong style="color:#dc2626;">${utils.formatMoney(expense.amount || 0)}</strong></span>
                <span>Pago: ${escapeHtml(getExpensePaymentLabel(expense.paymentMethod))}</span>
                ${expense.notes ? `<span>Notas: ${escapeHtml(expense.notes)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

async function deleteExpenseRecord(expenseId) {
    if (!confirm('¿Eliminar este gasto?')) return;

    try {
        await api.deleteExpense(expenseId);
        utils.showToast('Gasto eliminado');
        await loadExpensesView();
        if (typeof app !== 'undefined' && typeof app.loadDashboard === 'function') {
            await app.loadDashboard();
        }
    } catch (error) {
        utils.showToast(error.message || 'Error al eliminar gasto', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const expenseDate = document.getElementById('expenseDate');
    if (expenseDate && !expenseDate.value) {
        expenseDate.value = new Date().toISOString().slice(0, 10);
    }

    document.getElementById('formExpense')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            description: document.getElementById('expenseDescription').value.trim(),
            amount: parseFloat(document.getElementById('expenseAmount').value || '0'),
            category: document.getElementById('expenseCategory').value,
            expenseDate: document.getElementById('expenseDate').value,
            paymentMethod: document.getElementById('expensePaymentMethod').value,
            notes: document.getElementById('expenseNotes').value.trim()
        };

        try {
            const response = await api.createExpense(payload);
            if (!response.success) return;

            utils.showToast('Gasto registrado');
            e.target.reset();
            if (expenseDate) expenseDate.value = new Date().toISOString().slice(0, 10);
            await loadExpensesView();
            if (typeof app !== 'undefined' && typeof app.loadDashboard === 'function') {
                await app.loadDashboard();
            }
        } catch (error) {
            utils.showToast(error.message || 'Error al registrar gasto', 'error');
        }
    });

    document.getElementById('expensePeriod')?.addEventListener('change', loadExpensesView);
    document.getElementById('expenseCategoryFilter')?.addEventListener('change', loadExpensesView);
});

window.loadExpensesView = loadExpensesView;
window.deleteExpenseRecord = deleteExpenseRecord;
