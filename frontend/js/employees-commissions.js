// ============================================
// GESTIÓN DE EMPLEADOS Y COMISIONES
// ============================================

// Verificar que el objeto app exista
if (typeof app === 'undefined') {
  console.error('❌ ERROR: El objeto app no está definido. Asegúrate de cargar app.js antes de employees-commissions.js');
  throw new Error('app object is not defined');
}

console.log('✅ employees-commissions.js cargado correctamente');

// ============================================
// GESTIÓN DE EMPLEADOS
// ============================================

app.loadEmployees = async function() {
  console.log('🔍 Cargando empleados...');
  try {
    const position = document.getElementById('employeePositionFilter')?.value || '';
    const isActive = document.getElementById('employeeStatusFilter')?.value || '';
    
    const filters = {};
    if (position) filters.position = position;
    if (isActive !== '') filters.isActive = isActive;
    
    const response = await api.getEmployees(filters);
    const tbody = document.getElementById('employeesTableBody');
    
    if (!tbody) {
      console.error('❌ No se encontró el elemento employeesTableBody');
      return;
    }
    
    // Guardar en AppState para uso global (ej: selector de vendedor en ventas)
    AppState.employees = response.employees || [];

    if (!response.employees || response.employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No hay empleados registrados</td></tr>';
      return;
    }
    
    tbody.innerHTML = response.employees.map(emp => `
      <tr>
        <td>${emp.name}</td>
        <td>${app.translatePosition(emp.position)}</td>
        <td>${emp.phone || '-'}</td>
        <td>${emp.commissionConfig.sales.enabled ? emp.commissionConfig.sales.rate + '%' : 'No'}</td>
        <td>${emp.commissionConfig.technicalServices.enabled ? emp.commissionConfig.technicalServices.rate + '%' : 'No'}</td>
        <td>
          <span class="badge ${emp.isActive ? 'badge-success' : 'badge-secondary'}">
            ${emp.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td>
          <button class="btn-icon" onclick="app.editEmployee('${emp._id}')" title="Editar">✏️</button>
          ${emp.isActive ? `
            <button class="btn-icon" onclick="app.viewEmployeeCommissions('${emp._id}')" title="Ver comisiones">💰</button>
            <button class="btn-icon btn-danger" onclick="app.deleteEmployee('${emp._id}')" title="Desactivar">❌</button>
          ` : `
            <button class="btn-icon btn-success" onclick="app.activateEmployee('${emp._id}')" title="Activar">✅</button>
          `}
        </td>
      </tr>
    `).join('');
    
    console.log(`✅ ${response.employees.length} empleados cargados`);
    
  } catch (error) {
    console.error('❌ Error al cargar empleados:', error);
    utils.showToast('Error al cargar empleados', 'error');
  }
};

app.translatePosition = function(position) {
  const positions = {
    'vendedor': 'Vendedor',
    'tecnico': 'Técnico',
    'vendedor_tecnico': 'Vendedor/Técnico'
  };
  return positions[position] || position;
};

app.showEmployeeModal = function(employeeId = null) {
  const modal = document.getElementById('employeeModal');
  const form = document.getElementById('employeeForm');
  const title = document.getElementById('employeeModalTitle');
  
  if (!modal || !form || !title) {
    console.error('❌ Elementos del modal de empleado no encontrados');
    return;
  }
  
  form.reset();
  document.getElementById('employeeId').value = '';
  
  if (employeeId) {
    title.textContent = 'Editar Empleado';
    app.loadEmployeeData(employeeId);
  } else {
    title.textContent = 'Nuevo Empleado';
  }
  
  modal.style.display = 'block';
};

app.closeEmployeeModal = function() {
  const modal = document.getElementById('employeeModal');
  if (modal) modal.style.display = 'none';
};

app.loadEmployeeData = async function(id) {
  try {
    const response = await api.getEmployee(id);
    const emp = response.employee;
    
    document.getElementById('employeeId').value = emp._id;
    document.getElementById('employeeName').value = emp.name;
    document.getElementById('employeeEmail').value = emp.email || '';
    document.getElementById('employeePhone').value = emp.phone || '';
    document.getElementById('employeePosition').value = emp.position;
    document.getElementById('salesCommissionEnabled').checked = emp.commissionConfig.sales.enabled;
    document.getElementById('salesCommissionRate').value = emp.commissionConfig.sales.rate;
    document.getElementById('servicesCommissionEnabled').checked = emp.commissionConfig.technicalServices.enabled;
    document.getElementById('servicesCommissionRate').value = emp.commissionConfig.technicalServices.rate;
    document.getElementById('employeeNotes').value = emp.notes || '';
    
  } catch (error) {
    console.error('Error al cargar empleado:', error);
    utils.showToast('Error al cargar datos del empleado', 'error');
  }
};

app.saveEmployee = async function(event) {
  event.preventDefault();
  
  const employeeId = document.getElementById('employeeId').value;
  const employeeData = {
    name: document.getElementById('employeeName').value,
    email: document.getElementById('employeeEmail').value,
    phone: document.getElementById('employeePhone').value,
    position: document.getElementById('employeePosition').value,
    commissionConfig: {
      sales: {
        enabled: document.getElementById('salesCommissionEnabled').checked,
        rate: parseFloat(document.getElementById('salesCommissionRate').value) || 0
      },
      technicalServices: {
        enabled: document.getElementById('servicesCommissionEnabled').checked,
        rate: parseFloat(document.getElementById('servicesCommissionRate').value) || 0
      }
    },
    notes: document.getElementById('employeeNotes').value
  };
  
  try {
    if (employeeId) {
      await api.updateEmployee(employeeId, employeeData);
      utils.showToast('Empleado actualizado exitosamente', 'success');
    } else {
      await api.createEmployee(employeeData);
      utils.showToast('Empleado creado exitosamente', 'success');
    }
    
    app.closeEmployeeModal();
    await app.loadEmployees();
    await app.loadEmployeeSelects();
    
  } catch (error) {
    console.error('Error al guardar empleado:', error);
    utils.showToast(error.message || 'Error al guardar empleado', 'error');
  }
};

app.editEmployee = function(id) {
  app.showEmployeeModal(id);
};

app.deleteEmployee = async function(id) {
  if (!confirm('¿Estás seguro de desactivar este empleado?')) return;
  
  try {
    await api.deleteEmployee(id);
    utils.showToast('Empleado desactivado', 'success');
    await app.loadEmployees();
  } catch (error) {
    console.error('Error al desactivar empleado:', error);
    utils.showToast('Error al desactivar empleado', 'error');
  }
};

app.activateEmployee = async function(id) {
  if (!confirm('¿Estás seguro de activar este empleado?')) return;
  
  try {
    await api.activateEmployee(id);
    utils.showToast('Empleado activado exitosamente', 'success');
    await app.loadEmployees();
    await app.loadEmployeeSelects(); // Recargar selectores
  } catch (error) {
    console.error('Error al activar empleado:', error);
    utils.showToast('Error al activar empleado', 'error');
  }
};

app.viewEmployeeCommissions = function(employeeId) {
  // Cambiar a la vista de comisiones y filtrar por empleado
  document.querySelector('[data-view="commissions"]').click();
  setTimeout(() => {
    const filter = document.getElementById('commissionEmployeeFilter');
    if (filter) {
      filter.value = employeeId;
      app.loadCommissions();
    }
  }, 100);
};

app.loadEmployeeSelects = async function() {
  try {
    const response = await api.getEmployees({ isActive: true });
    const employees = response.employees || [];
    
    // Selector en ventas
    const saleSelect = document.getElementById('saleEmployee');
    if (saleSelect) {
      saleSelect.innerHTML = '<option value="">Sin vendedor</option>' +
        employees
          .filter(e => e.position === 'vendedor' || e.position === 'vendedor_tecnico')
          .map(e => `<option value="${e._id}">${e.name}</option>`)
          .join('');
    }
    
    // Selector en servicios técnicos
    const serviceSelect = document.getElementById('serviceEmployee');
    if (serviceSelect) {
      serviceSelect.innerHTML = '<option value="">Sin técnico</option>' +
        employees
          .filter(e => e.position === 'tecnico' || e.position === 'vendedor_tecnico')
          .map(e => `<option value="${e._id}">${e.name}</option>`)
          .join('');
    }
    
    // Selector en filtro de comisiones
    const commissionFilter = document.getElementById('commissionEmployeeFilter');
    if (commissionFilter) {
      commissionFilter.innerHTML = '<option value="">Todos los empleados</option>' +
        employees.map(e => `<option value="${e._id}">${e.name}</option>`).join('');
    }
    
    // Selector en reporte mensual
    const reportSelect = document.getElementById('reportEmployee');
    if (reportSelect) {
      reportSelect.innerHTML = '<option value="">Seleccionar empleado...</option>' +
        employees.map(e => `<option value="${e._id}">${e.name}</option>`).join('');
    }
    
  } catch (error) {
    console.error('Error al cargar empleados en selectores:', error);
  }
};

// ============================================
// GESTIÓN DE COMISIONES
// ============================================

app.loadCommissions = async function() {
  console.log('🔍 Cargando comisiones...');
  try {
    const filters = {};
    const employeeFilter = document.getElementById('commissionEmployeeFilter')?.value;
    const statusFilter = document.getElementById('commissionStatusFilter')?.value;
    const typeFilter = document.getElementById('commissionTypeFilter')?.value;
    
    if (employeeFilter) filters.employeeId = employeeFilter;
    if (statusFilter) filters.status = statusFilter;
    if (typeFilter) filters.type = typeFilter;
    
    const response = await api.getCommissions(filters);
    const tbody = document.getElementById('commissionsTableBody');
    
    if (!tbody) {
      console.error('❌ No se encontró el elemento commissionsTableBody');
      return;
    }
    
    if (!response.commissions || response.commissions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No hay comisiones registradas</td></tr>';
      app.updateCommissionStats([]);
      return;
    }
    
    tbody.innerHTML = response.commissions.map(com => `
      <tr>
        <td>
          <input type="checkbox" class="commission-checkbox" value="${com._id}" 
            ${com.status === 'pending' || com.status === 'approved' ? '' : 'disabled'}>
        </td>
        <td>${new Date(com.createdAt).toLocaleDateString('es-CO')}</td>
        <td>${com.employeeId?.name || 'N/A'}</td>
        <td>${app.translateCommissionType(com.type)}</td>
        <td>${com.description}</td>
        <td>${utils.formatMoney(com.baseAmount)}</td>
        <td>${com.commissionRate}%</td>
        <td><strong>${utils.formatMoney(com.commissionAmount)}</strong></td>
        <td>
          <span class="badge badge-${app.getCommissionStatusClass(com.status)}">
            ${app.translateCommissionStatus(com.status)}
          </span>
        </td>
        <td>
          ${com.status === 'pending' ? `
            <button class="btn-icon" onclick="app.approveCommission('${com._id}')" title="Aprobar">✅</button>
          ` : ''}
          ${com.status === 'approved' ? `
            <button class="btn-icon btn-success" onclick="app.payCommission('${com._id}')" title="Pagar">💵</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
    
    app.updateCommissionStats(response.commissions);
    console.log(`✅ ${response.commissions.length} comisiones cargadas`);
    
  } catch (error) {
    console.error('❌ Error al cargar comisiones:', error);
    utils.showToast('Error al cargar comisiones', 'error');
  }
};

app.translateCommissionType = function(type) {
  const types = {
    'sale': 'Venta',
    'technical_service': 'Servicio Técnico'
  };
  return types[type] || type;
};

app.translateCommissionStatus = function(status) {
  const statuses = {
    'pending': 'Pendiente',
    'approved': 'Aprobada',
    'paid': 'Pagada'
  };
  return statuses[status] || status;
};

app.getCommissionStatusClass = function(status) {
  const classes = {
    'pending': 'warning',
    'approved': 'info',
    'paid': 'success'
  };
  return classes[status] || 'secondary';
};

app.updateCommissionStats = function(commissions) {
  const pending = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commissionAmount, 0);
  const approved = commissions.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.commissionAmount, 0);
  
  // Calcular pagadas del mes actual
  const now = new Date();
  const thisMonth = commissions.filter(c => {
    const comDate = new Date(c.paidAt || c.createdAt);
    return c.status === 'paid' && 
           comDate.getMonth() === now.getMonth() && 
           comDate.getFullYear() === now.getFullYear();
  }).reduce((sum, c) => sum + c.commissionAmount, 0);
  
  const pendingEl = document.getElementById('pendingCommissionsTotal');
  const approvedEl = document.getElementById('approvedCommissionsTotal');
  const paidEl = document.getElementById('paidCommissionsTotal');
  
  if (pendingEl) pendingEl.textContent = utils.formatMoney(pending);
  if (approvedEl) approvedEl.textContent = utils.formatMoney(approved);
  if (paidEl) paidEl.textContent = utils.formatMoney(thisMonth);
};

app.approveCommission = async function(id) {
  if (!confirm('¿Aprobar esta comisión?')) return;
  
  try {
    await api.approveCommission(id);
    utils.showToast('Comisión aprobada', 'success');
    await app.loadCommissions();
  } catch (error) {
    console.error('Error al aprobar comisión:', error);
    utils.showToast('Error al aprobar comisión', 'error');
  }
};

app.payCommission = async function(id) {
  const notes = prompt('Notas de pago (opcional):');
  if (notes === null) return; // Usuario canceló
  
  try {
    await api.payCommission(id, notes);
    utils.showToast('Comisión pagada', 'success');
    await app.loadCommissions();
  } catch (error) {
    console.error('Error al pagar comisión:', error);
    utils.showToast('Error al pagar comisión', 'error');
  }
};

app.toggleAllCommissions = function() {
  const selectAll = document.getElementById('selectAllCommissions');
  const checkboxes = document.querySelectorAll('.commission-checkbox:not([disabled])');
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
};

app.showPayBatchModal = function() {
  const selected = Array.from(document.querySelectorAll('.commission-checkbox:checked')).map(cb => cb.value);
  
  if (selected.length === 0) {
    utils.showToast('Selecciona al menos una comisión', 'warning');
    return;
  }
  
  // Calcular total
  const total = Array.from(document.querySelectorAll('.commission-checkbox:checked'))
    .map(cb => {
      const row = cb.closest('tr');
      const amountText = row.cells[7].textContent.replace(/[^0-9]/g, '');
      return parseInt(amountText);
    })
    .reduce((sum, val) => sum + val, 0);
  
  document.getElementById('batchPayCount').textContent = `${selected.length} comisiones seleccionadas`;
  document.getElementById('batchPayTotal').textContent = utils.formatMoney(total);
  document.getElementById('payBatchModal').style.display = 'block';
};

app.closePayBatchModal = function() {
  document.getElementById('payBatchModal').style.display = 'none';
};

app.payBatchCommissions = async function(event) {
  event.preventDefault();
  
  const selected = Array.from(document.querySelectorAll('.commission-checkbox:checked')).map(cb => cb.value);
  const notes = document.getElementById('batchPayNotes').value;
  
  try {
    await api.payCommissionsBatch(selected, notes);
    utils.showToast(`${selected.length} comisiones pagadas exitosamente`, 'success');
    app.closePayBatchModal();
    await app.loadCommissions();
  } catch (error) {
    console.error('Error al pagar comisiones:', error);
    utils.showToast('Error al pagar comisiones', 'error');
  }
};

app.showMonthlyReportModal = function() {
  const modal = document.getElementById('monthlyReportModal');
  if (modal) {
    modal.style.display = 'block';
    // Establecer mes actual
    const now = new Date();
    const monthInput = document.getElementById('reportMonth');
    if (monthInput) {
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
  }
};

app.closeMonthlyReportModal = function() {
  const modal = document.getElementById('monthlyReportModal');
  if (modal) modal.style.display = 'none';
};

app.generateMonthlyReport = async function() {
  const employeeId = document.getElementById('reportEmployee').value;
  const monthValue = document.getElementById('reportMonth').value;
  
  if (!employeeId || !monthValue) return;
  
  const [year, month] = monthValue.split('-');
  
  try {
    const response = await api.getEmployeeMonthlyReport(employeeId, year, month);
    const content = document.getElementById('monthlyReportContent');
    
    if (!response.report?.commissions || response.report.commissions.length === 0) {
      content.innerHTML = '<p style="text-align: center;">No hay comisiones para este empleado en este mes</p>';
      return;
    }
    
    const total = response.report?.summary?.totalCommissions || 0;
    const paid = response.report?.summary?.byStatus?.paid || 0;
    const pending = (response.report?.summary?.byStatus?.pending || 0) + (response.report?.summary?.byStatus?.approved || 0);
        
    content.innerHTML = `
      <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
          <h4>Total</h4>
          <p class="stat-value">${utils.formatMoney(total)}</p>
        </div>
        <div class="stat-card">
          <h4>Pagado</h4>
          <p class="stat-value text-success">${utils.formatMoney(paid)}</p>
        </div>
        <div class="stat-card">
          <h4>Pendiente</h4>
          <p class="stat-value text-warning">${utils.formatMoney(pending)}</p>
        </div>
      </div>
      
      <table class="data-table" style="width: 100%;">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Descripción</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${response.report.commissions.map(c => `
            <tr>
              <td>${new Date(c.createdAt).toLocaleDateString('es-CO')}</td>
              <td>${app.translateCommissionType(c.type)}</td>
              <td>${c.description}</td>
              <td>${utils.formatMoney(c.commissionAmount)}</td>
              <td>
                <span class="badge badge-${app.getCommissionStatusClass(c.status)}">
                  ${app.translateCommissionStatus(c.status)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
  } catch (error) {
    console.error('Error al generar reporte:', error);
    utils.showToast('Error al generar reporte', 'error');
  }
};

// Utilidad para mostrar notificaciones (compatible con utils.showToast)
app.showNotification = function(message, type = 'info') {
  if (typeof utils !== 'undefined' && utils.showToast) {
    utils.showToast(message, type);
  } else {
    alert(message);
  }
};

console.log('✅ Todas las funciones de empleados y comisiones cargadas correctamente');