// ========================================
// FUNCIONALIDADES ADICIONALES
// ========================================

// ========================================
// EDITAR/ELIMINAR VENTAS
// ========================================

let allSales = [];

async function loadSalesEnhanced() {
    try {
        const response = await api.getSales();
        if (response.success) {
            allSales = response.sales || [];
            displaySales(allSales);
        }
    } catch (error) {
        console.error('Error loading sales:', error);
    }
}

function displaySales(sales) {
    const container = document.getElementById('salesList');
    if (!container) return;
    
    if (sales.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay ventas registradas</p></div>';
        return;
    }
    
    const html = sales.map(sale => `
        <div class="sale-item">
            <div class="sale-header">
                <div>
                    <strong>${sale.productName || 'Producto'}</strong>
                    <span style="margin-left: 8px;">
                    ${sale.productId?.productType === 'celular' ? '📱' : 
                        sale.productId?.productType === 'accesorio' ? '🔌' : '📦'}
                    </span>
                    <small>${formatDate(sale.saleDate)}</small>
                </div>
                <div class="sale-actions">
                    <button class="btn btn-sm" onclick="editSale('${sale._id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSale('${sale._id}')">🗑️</button>
                </div>
            </div>
            <div class="sale-details">
                <span>Cantidad: <strong>${sale.quantity}</strong></span>
                <span>Precio Unit: <strong>$${formatNumber(sale.unitPrice)}</strong></span>
                <span>Total: <strong>$${formatNumber(sale.totalSale)}</strong></span>
                <span>Ganancia: <strong class="text-success">$${formatNumber(sale.profit)}</strong></span>
                ${sale.customer ? `<span>Cliente: ${sale.customer}</span>` : ''}
                ${sale.paymentMethod ? `<span>Pago: ${getPaymentLabel(sale.paymentMethod)}</span>` : ''}
                ${sale.employeeId ? `<span>Vendedor: <strong>${sale.employeeId.name || sale.employeeName || '—'}</strong></span>` : ''}
                ${sale.serialNumbers?.length ? `<span>IMEIs/Seriales: <strong>${sale.serialNumbers.join(', ')}</strong></span>` : ''}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function editSale(saleId) {
    const sale = allSales.find(s => s._id === saleId);
    if (!sale) return;
    
    document.getElementById('updateSaleId').value = sale._id;
    const quantityInput = document.getElementById('updateSaleQuantity');
    quantityInput.value = sale.quantity;
    quantityInput.readOnly = Array.isArray(sale.unitIds) && sale.unitIds.length > 0;
    quantityInput.title = quantityInput.readOnly
        ? 'Esta venta tiene IMEIs/seriales asociados. Si necesitas cambiar la cantidad, elimina la venta y regístrala de nuevo.'
        : '';
    document.getElementById('updateSaleUnitPrice').value = sale.unitPrice;
    document.getElementById('updateSaleCustomer').value = sale.customer || '';
    document.getElementById('updateSalePaymentMethod').value = sale.paymentMethod;

    // Llenar select de empleados
    const empSelect = document.getElementById('updateSaleEmployee');
    empSelect.innerHTML = '<option value="">Sin vendedor</option>';
    if (AppState.employees) {
        AppState.employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp._id;
            opt.textContent = emp.name;
            if (sale.employeeId && (sale.employeeId === emp._id || sale.employeeId?._id === emp._id)) {
                opt.selected = true;
            }
            empSelect.appendChild(opt);
        });
    }

    document.getElementById('saleModal').classList.add('show');
}

async function deleteSale(saleId) {
    if (!confirm('¿Eliminar esta venta? Se devolverá el stock.')) return;
    
    try {
        await api.deleteSale(saleId);
        utils.showToast('Venta eliminada y stock restaurado');
        loadSalesEnhanced();
        
        // ✅ Recargar productos Y dashboard
        if (typeof app !== 'undefined' && app.loadProducts) {
            await app.loadProducts();
        }
        if (typeof app !== 'undefined' && app.loadDashboard) {
            await app.loadDashboard();
        }
    } catch (error) {
        utils.showToast(error.message || 'Error al eliminar', 'error');
    }
}

function closeSaleModal() {
    document.getElementById('saleModal').classList.remove('show');
}

function getPaymentLabel(method) {
    const labels = {
        'cash': 'Efectivo',
        'card': 'Tarjeta',
        'transfer': 'Transferencia',
        'other': 'Otro'
    };
    return labels[method] || method;
}

// ========================================
// BÚSQUEDA EN INVENTARIO
// ========================================

let allInventoryProducts = [];

function initInventorySearch() {
    const searchBar = document.getElementById('inventorySearchBar');
    if (!searchBar) return;
    
    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length === 0) {
            displayInventoryProducts(allInventoryProducts);
            return;
        }
        
        const filtered = allInventoryProducts.filter(product => {
            const name = product.name.toLowerCase();
            const category = (product.category || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            
            return name.includes(query) || 
                   category.includes(query) || 
                   brand.includes(query);
        });
        
        displayInventoryProducts(filtered);
    });
}

function displayInventoryProducts(products) {
    const container = document.getElementById('productsList');
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No se encontraron productos</p></div>';
        return;
    }
    
    // ✅ USAR FORMATO DE TABLA CON PRECIO SUGERIDO
    const html = `
        <table>
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Stock</th>
                    <th>Costo Promedio</th>
                    <th>Precio Sugerido</th>
                    <th>Valor en Stock</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(p => {
                    const stockValue = p.stock * p.averageCost;
                    const status = p.stock > 10 ? 'success' : p.stock > 5 ? 'warning' : 'danger';
                    const statusText = p.stock > 10 ? 'Disponible' : p.stock > 5 ? 'Bajo' : 'Crítico';
                    
                    return `
                        <tr>
                            <td data-label="Producto" style="font-weight: 600;">
                            ${p.name}
                            <br><small style="color: #666;">
                                ${p.productType === 'celular' ? '📱 Celular' : 
                                p.productType === 'accesorio' ? '🔌 Accesorio' : 
                                '📦 Otro'}
                            </small>
                            </td>
                            <td data-label="Stock">${p.stock}</td>
                            <td data-label="Costo">${utils.formatMoney(p.averageCost)}</td>
                            <td data-label="P. Sugerido" style="color: var(--success); font-weight: 600;">${utils.formatMoney(p.suggestedPrice || 0)}</td>
                            <td data-label="Valor Stock" style="color: var(--primary);">${utils.formatMoney(stockValue)}</td>
                            <td data-label="Estado"><span class="badge badge-${status}">${statusText}</span></td>
                            <td class="action-buttons">
                                <button class="btn btn-sm" onclick="viewProductHistory('${p._id}')" title="Ver Historial">👁️</button>
                                <button class="btn btn-sm" onclick="editProduct('${p._id}')" title="Editar">✏️</button>
                                <button class="btn btn-sm" onclick="adjustProductStock('${p._id}', '${p.name}', ${p.stock})" title="Ajustar Stock">🔧</button>
                                <button class="btn btn-sm btn-danger" onclick="deactivateProduct('${p._id}', '${p.name}')" title="Desactivar">❌</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

async function loadInventoryProducts() {
    try {
        const response = await api.getProducts();
        if (response.success) {
            allInventoryProducts = response.products || [];
            AppState.products = response.products; // ✅ Guardar en AppState
            displayInventoryProducts(allInventoryProducts);
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        // ✅ QUITAR el showToast de aquí - no es error real
    }
}
// ========================================
// REPORTES
// ========================================

let currentReportData = null;

function getReportPeriodLabel(period) {
    return {
        'daily': 'Hoy',
        'weekly': 'Últimos 7 días',
        'monthly': 'Mes actual',
        'yearly': 'Año actual'
    }[period] || 'Personalizado';
}

function formatDateRangeForReport(periodInfo) {
    if (!periodInfo?.startDate || !periodInfo?.endDate) return '';
    const endDate = new Date(new Date(periodInfo.endDate).getTime() - 86400000);
    return `${formatDate(periodInfo.startDate)} - ${formatDate(endDate)}`;
}

function toggleMonthlyCloseButton(period) {
    const btn = document.getElementById('btnMonthlyClosePDF');
    if (!btn) return;
    btn.style.display = period === 'monthly' ? 'inline-flex' : 'none';
}

async function loadReport(period) {
    try {
        const response = await api.getReportSales(period);
        
        if (response.success) {
            currentReportData = response;
            toggleMonthlyCloseButton(response.period);
            displayReport(response);
        }
    } catch (error) {
        console.error('Error loading report:', error);
        utils.showToast('Error al cargar reporte', 'error');
    }
}

function displayReport(data) {
    const container = document.getElementById('reportContent');
    if (!container) return;
    
    const periodLabel = getReportPeriodLabel(data.period);
    const periodRange = formatDateRangeForReport(data.periodInfo);
    
    const html = `
        <div class="report-summary">
            <h3>Resumen ${periodLabel}</h3>
            ${periodRange ? `<p style="margin:0 0 16px; color:var(--text-secondary);">Período: ${periodRange}</p>` : ''}
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Ventas</h4>
                    <p class="stat-value">$${formatNumber(data.summary.totalSales)}</p>
                    <small>${data.summary.totalTransactions} transacciones</small>
                </div>
                <div class="stat-card">
                    <h4>Costo</h4>
                    <p class="stat-value">$${formatNumber(data.summary.totalCost)}</p>
                </div>
                <div class="stat-card">
                    <h4>Ganancia Neta</h4>
                    <p class="stat-value text-success">$${formatNumber(data.summary.netBusinessProfit ?? data.summary.totalProfit)}</p>
                </div>
                <div class="stat-card">
                    <h4>Ticket Promedio</h4>
                    <p class="stat-value">$${formatNumber(data.summary.averageTicket)}</p>
                </div>
                <div class="stat-card">
                    <h4>Compras</h4>
                    <p class="stat-value">$${formatNumber(data.summary.totalPurchases || 0)}</p>
                    <small>${data.summary.totalPurchaseTransactions || 0} registros</small>
                </div>
                <div class="stat-card">
                    <h4>Servicios</h4>
                    <p class="stat-value">$${formatNumber(data.summary.totalTechnicalRevenue || 0)}</p>
                    <small>${data.summary.totalTechnicalTransactions || 0} servicios</small>
                </div>
                <div class="stat-card">
                    <h4>Balance Operativo</h4>
                    <p class="stat-value">${data.summary.operationalBalance >= 0 ? '$' + formatNumber(data.summary.operationalBalance) : '-$' + formatNumber(Math.abs(data.summary.operationalBalance || 0))}</p>
                </div>
            </div>
        </div>

        <div class="report-products" style="margin-top:20px;">
            <h3>Actividad del Período</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Ítems Vendidos</h4>
                    <p class="stat-value">${formatNumber(data.activity?.itemsSold || 0)}</p>
                </div>
                <div class="stat-card">
                    <h4>Unidades Compradas</h4>
                    <p class="stat-value">${formatNumber(data.activity?.purchaseUnits || 0)}</p>
                </div>
                <div class="stat-card">
                    <h4>Servicios Abiertos</h4>
                    <p class="stat-value">${formatNumber(data.activity?.openTechnicalServices || 0)}</p>
                </div>
                <div class="stat-card">
                    <h4>Servicios Cerrados</h4>
                    <p class="stat-value">${formatNumber(data.activity?.completedTechnicalServices || 0)}</p>
                </div>
            </div>
        </div>
        
        <div class="report-products">
            <h3>Productos más vendidos</h3>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Ventas</th>
                        <th>Ganancia Bruta</th>
                        <th>Comisiones</th>
                        <th>Ganancia Neta</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.byProduct.map(p => `
                        <tr>
                            <td data-label="Producto">${p.name}</td>
                            <td data-label="Cantidad">${p.quantity}</td>
                            <td data-label="Ventas">$${formatNumber(p.sales)}</td>
                            <td data-label="G. Bruta" class="text-success">$${formatNumber(p.profit)}</td>
                            <td data-label="Comisiones" style="color:#d97706;">$${formatNumber(p.commissions || 0)}</td>
                            <td data-label="G. Neta" class="text-success">$${formatNumber(p.netProfit ?? p.profit)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${data.byTechnicalService && data.byTechnicalService.length > 0 ? `
        <div class="report-products" style="margin-top:20px;">
            <h3>🔧 Servicios Técnicos</h3>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Equipo</th>
                        <th>Mano de Obra</th>
                        <th>Comisión Técnico</th>
                        <th>Ganancia Neta</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.byTechnicalService.map(ts => `
                        <tr>
                            <td data-label="Cliente">${ts.customer}</td>
                            <td data-label="Equipo">${ts.device || '—'}</td>
                            <td data-label="Mano de Obra">$${formatNumber(ts.laborCost)}</td>
                            <td data-label="Com. Técnico" style="color:#d97706;">$${formatNumber(ts.technicianCommission)}</td>
                            <td data-label="G. Neta" class="text-success">$${formatNumber(ts.netProfit)}</td>
                            <td data-label="Estado">${ts.status}</td>
                        </tr>
                    `).join('')}
                    <tr style="font-weight:bold; background:var(--bg-card); color:var(--text-primary);">
                        <td colspan="2">Total</td>
                        <td>$${formatNumber(data.summary.totalTechnicalRevenue || 0)}</td>
                        <td style="color:#d97706;">$${formatNumber(data.summary.totalTechnicalCommissions || 0)}</td>
                        <td class="text-success">$${formatNumber(data.summary.totalTechnicalNetProfit || 0)}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
        ` : ''}

        ${data.monthlyTimeline && data.monthlyTimeline.length > 0 ? `
        <div class="report-products" style="margin-top:20px;">
            <h3>Resumen por Mes</h3>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th>Ventas</th>
                        <th>Compras</th>
                        <th>Servicios</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.monthlyTimeline.map(month => `
                        <tr>
                            <td data-label="Mes">${month.label}</td>
                            <td data-label="Ventas">$${formatNumber(month.salesTotal || 0)}</td>
                            <td data-label="Compras">$${formatNumber(month.purchaseTotal || 0)}</td>
                            <td data-label="Servicios">$${formatNumber(month.serviceTotal || 0)}</td>
                            <td data-label="Balance" class="${month.balance >= 0 ? 'text-success' : ''}">${month.balance >= 0 ? '$' + formatNumber(month.balance) : '-$' + formatNumber(Math.abs(month.balance || 0))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="report-products" style="margin-top:24px; border-top:3px solid var(--primary); padding-top:16px;">
            <h3>🏦 Resumen Total</h3>
            <table class="report-table">
                <tbody>
                    <tr>
                        <td>Ganancia Ventas (Bruta)</td>
                        <td class="text-success" style="text-align:right; font-weight:600;">$${formatNumber(data.summary.totalProfit)}</td>
                    </tr>
                    <tr>
                        <td>Comisiones Ventas</td>
                        <td style="text-align:right; font-weight:600; color:var(--warning);">- $${formatNumber(
                            (data.byProduct || []).reduce((s, p) => s + (p.commissions || 0), 0)
                        )}</td>
                    </tr>
                    <tr>
                        <td>Ganancia Servicios Técnicos</td>
                        <td class="text-success" style="text-align:right; font-weight:600;">$${formatNumber(data.summary.totalTechnicalRevenue || 0)}</td>
                    </tr>
                    <tr>
                        <td>Comisiones Técnicos</td>
                        <td style="text-align:right; font-weight:600; color:var(--warning);">- $${formatNumber(data.summary.totalTechnicalCommissions || 0)}</td>
                    </tr>
                    <tr>
                        <td>Inversión en Compras</td>
                        <td style="text-align:right; font-weight:600; color:var(--warning);">- $${formatNumber(data.summary.totalPurchases || 0)}</td>
                    </tr>
                    <tr style="font-size:1.1em; font-weight:700;">
                        <td>🏦 Ganancia Neta Total</td>
                        <td class="text-success" style="text-align:right;">$${formatNumber(data.summary.netBusinessProfit ?? (
                            data.summary.totalProfit
                            - (data.byProduct || []).reduce((s, p) => s + (p.commissions || 0), 0)
                            + (data.summary.totalTechnicalNetProfit || 0)
                        ))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

function downloadReportPDF() {
    if (!currentReportData) {
        utils.showToast('No hay reporte para descargar', 'error');
        return;
    }
    
    const printWindow = window.open('', '', 'height=600,width=800');
    const periodLabel = getReportPeriodLabel(currentReportData.period);
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Reporte de Ventas - ${periodLabel}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; }
                .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
                .stat { background: #f5f5f5; padding: 15px; border-radius: 8px; }
                .stat h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
                .stat p { margin: 0; font-size: 24px; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background: #f5f5f5; font-weight: bold; }
                .text-success { color: #10b981; }
            </style>
        </head>
        <body>
            <h1>Reporte de Ventas - ${periodLabel}</h1>
            <p>Fecha: ${new Date().toLocaleDateString('es-CO')}</p>
            
            <div class="summary">
                <div class="stat">
                    <h3>Total Ventas</h3>
                    <p>$${formatNumber(currentReportData.summary.totalSales)}</p>
                </div>
                <div class="stat">
                    <h3>Total Costo</h3>
                    <p>$${formatNumber(currentReportData.summary.totalCost)}</p>
                </div>
                <div class="stat">
                    <h3>Ganancia</h3>
                    <p class="text-success">$${formatNumber(currentReportData.summary.totalProfit)}</p>
                </div>
                <div class="stat">
                    <h3>Transacciones</h3>
                    <p>${currentReportData.summary.totalTransactions}</p>
                </div>
            </div>
            
            <h2>Productos más vendidos</h2>
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Ventas</th>
                        <th>Ganancia Bruta</th>
                        <th>Comisiones</th>
                        <th>Ganancia Neta</th>
                    </tr>
                </thead>
                <tbody>
                    ${currentReportData.byProduct.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.quantity}</td>
                            <td>$${formatNumber(p.sales)}</td>
                            <td class="text-success">$${formatNumber(p.profit)}</td>
                            <td style="color:#d97706;">$${formatNumber(p.commissions || 0)}</td>
                            <td class="text-success">$${formatNumber(p.netProfit ?? p.profit)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ${currentReportData.byTechnicalService && currentReportData.byTechnicalService.length > 0 ? `
            <h2>Servicios Técnicos</h2>
            <table>
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Equipo</th>
                        <th>Mano de Obra</th>
                        <th>Comisión Técnico</th>
                        <th>Ganancia Neta</th>
                    </tr>
                </thead>
                <tbody>
                    ${currentReportData.byTechnicalService.map(ts => `
                        <tr>
                            <td>${ts.customer}</td>
                            <td>${ts.device || '—'}</td>
                            <td>$${formatNumber(ts.laborCost)}</td>
                            <td>$${formatNumber(ts.technicianCommission)}</td>
                            <td class="text-success">$${formatNumber(ts.netProfit)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : ''}

        <div style="margin-top:30px; border-top:3px solid #333; padding-top:15px;">
            <h2>RESUMEN TOTAL</h2>
            <table>
                <tbody>
                    <tr>
                        <td><strong>Ganancia Ventas (Bruta)</strong></td>
                        <td>$${formatNumber(currentReportData.summary.totalProfit)}</td>
                    </tr>
                    <tr>
                        <td><strong>Comisiones Ventas</strong></td>
                        <td style="color:#d97706;">- $${formatNumber(
                            (currentReportData.byProduct || []).reduce((s, p) => s + (p.commissions || 0), 0)
                        )}</td>
                    </tr>
                    <tr>
                        <td><strong>Ganancia Servicios Técnicos</strong></td>
                        <td>$${formatNumber(currentReportData.summary.totalTechnicalRevenue || 0)}</td>
                    </tr>
                    <tr>
                        <td><strong>Comisiones Técnicos</strong></td>
                        <td style="color:#d97706;">- $${formatNumber(currentReportData.summary.totalTechnicalCommissions || 0)}</td>
                    </tr>
                    <tr style="font-size:1.2em; background:#f0f0f0;">
                        <td><strong>🏦 GANANCIA NETA TOTAL</strong></td>
                        <td><strong style="color:#10b981;">$${formatNumber(
                            currentReportData.summary.totalProfit
                            - (currentReportData.byProduct || []).reduce((s, p) => s + (p.commissions || 0), 0)
                            + (currentReportData.summary.totalTechnicalNetProfit || 0)
                        )}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

function downloadMonthlyClosePDF() {
    if (!currentReportData) {
        utils.showToast('No hay reporte cargado', 'error');
        return;
    }

    if (currentReportData.period !== 'monthly') {
        utils.showToast('El cierre mensual solo se genera con el período "Mes actual"', 'warning');
        return;
    }

    const periodRange = formatDateRangeForReport(currentReportData.periodInfo);
    const salesCommissions = (currentReportData.byProduct || []).reduce((sum, item) => sum + (item.commissions || 0), 0);
    const topProducts = (currentReportData.byProduct || []).slice(0, 8);
    const monthlyTimeline = currentReportData.monthlyTimeline || [];

    const printWindow = window.open('', '', 'height=760,width=980');
    printWindow.document.write(`
        <html>
        <head>
            <title>Cierre Mensual</title>
            <style>
                body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px; background: #fff; }
                h1, h2, h3, p { margin: 0; }
                .hero { border: 2px solid #0f172a; border-radius: 16px; padding: 24px; margin-bottom: 22px; }
                .hero p { color: #475569; margin-top: 8px; }
                .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 18px 0 22px; }
                .card { border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; background: #f8fafc; }
                .card h3 { font-size: 13px; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
                .card strong { font-size: 24px; }
                .section { margin-top: 24px; }
                .section-title { margin-bottom: 12px; font-size: 18px; }
                .highlights { display: grid; gap: 10px; }
                .highlight { border-left: 4px solid #2563eb; padding: 10px 14px; background: #eff6ff; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 13px; }
                th { background: #f8fafc; }
                .success { color: #059669; }
                .warning { color: #b45309; }
                .muted { color: #64748b; }
                .footer { margin-top: 28px; padding-top: 14px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="hero">
                <h1>Cierre Mensual</h1>
                <p>${periodRange ? `Período: ${periodRange}` : 'Mes actual'} | Generado: ${new Date().toLocaleDateString('es-CO')}</p>
            </div>

            <div class="grid">
                <div class="card">
                    <h3>Ventas</h3>
                    <strong>$${formatNumber(currentReportData.summary.totalSales || 0)}</strong>
                    <p class="muted">${currentReportData.summary.totalTransactions || 0} transacciones</p>
                </div>
                <div class="card">
                    <h3>Compras</h3>
                    <strong>$${formatNumber(currentReportData.summary.totalPurchases || 0)}</strong>
                    <p class="muted">${currentReportData.summary.totalPurchaseTransactions || 0} registros</p>
                </div>
                <div class="card">
                    <h3>Servicios</h3>
                    <strong>$${formatNumber(currentReportData.summary.totalTechnicalRevenue || 0)}</strong>
                    <p class="muted">${currentReportData.summary.totalTechnicalTransactions || 0} servicios</p>
                </div>
                <div class="card">
                    <h3>Ganancia Neta</h3>
                    <strong class="success">$${formatNumber(currentReportData.summary.netBusinessProfit || 0)}</strong>
                    <p class="muted">Resultado del mes</p>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">Resumen Ejecutivo</h2>
                <div class="highlights">
                    <div class="highlight">Se vendieron <strong>${formatNumber(currentReportData.activity?.itemsSold || 0)}</strong> unidades y se registraron <strong>${formatNumber(currentReportData.summary.totalTransactions || 0)}</strong> ventas.</div>
                    <div class="highlight">La inversión en compras fue de <strong>$${formatNumber(currentReportData.summary.totalPurchases || 0)}</strong> en <strong>${formatNumber(currentReportData.activity?.purchaseUnits || 0)}</strong> unidades.</div>
                    <div class="highlight">Servicios técnicos: <strong>${formatNumber(currentReportData.summary.totalTechnicalTransactions || 0)}</strong> registrados, <strong>${formatNumber(currentReportData.activity?.openTechnicalServices || 0)}</strong> abiertos y <strong>${formatNumber(currentReportData.activity?.completedTechnicalServices || 0)}</strong> cerrados.</div>
                    <div class="highlight">Balance operativo del mes: <strong>${currentReportData.summary.operationalBalance >= 0 ? '$' + formatNumber(currentReportData.summary.operationalBalance) : '-$' + formatNumber(Math.abs(currentReportData.summary.operationalBalance || 0))}</strong>.</div>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">Top Productos</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Ventas</th>
                            <th>Comisiones</th>
                            <th>Ganancia Neta</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topProducts.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>$${formatNumber(item.sales || 0)}</td>
                                <td class="warning">$${formatNumber(item.commissions || 0)}</td>
                                <td class="success">$${formatNumber(item.netProfit ?? item.profit ?? 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2 class="section-title">Histórico Reciente</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Mes</th>
                            <th>Ventas</th>
                            <th>Compras</th>
                            <th>Servicios</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlyTimeline.map(month => `
                            <tr>
                                <td>${month.label}</td>
                                <td>$${formatNumber(month.salesTotal || 0)}</td>
                                <td>$${formatNumber(month.purchaseTotal || 0)}</td>
                                <td>$${formatNumber(month.serviceTotal || 0)}</td>
                                <td class="${month.balance >= 0 ? 'success' : 'warning'}">${month.balance >= 0 ? '$' + formatNumber(month.balance) : '-$' + formatNumber(Math.abs(month.balance || 0))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2 class="section-title">Cierre Financiero</h2>
                <table>
                    <tbody>
                        <tr><td>Ganancia ventas (bruta)</td><td>$${formatNumber(currentReportData.summary.totalProfit || 0)}</td></tr>
                        <tr><td>Comisiones ventas</td><td class="warning">- $${formatNumber(salesCommissions)}</td></tr>
                        <tr><td>Ganancia servicios técnicos</td><td>$${formatNumber(currentReportData.summary.totalTechnicalRevenue || 0)}</td></tr>
                        <tr><td>Comisiones técnicos</td><td class="warning">- $${formatNumber(currentReportData.summary.totalTechnicalCommissions || 0)}</td></tr>
                        <tr><td>Inversión en compras</td><td class="warning">- $${formatNumber(currentReportData.summary.totalPurchases || 0)}</td></tr>
                        <tr><td><strong>Ganancia neta del mes</strong></td><td class="success"><strong>$${formatNumber(currentReportData.summary.netBusinessProfit || 0)}</strong></td></tr>
                    </tbody>
                </table>
            </div>

            <div class="footer">
                Documento generado desde el módulo de reportes. Úsalo como soporte interno del cierre mensual.
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

function downloadReportExcel() {
    if (!currentReportData) {
        utils.showToast('No hay reporte para descargar', 'error');
        return;
    }
    
    let csv = 'Producto,Cantidad,Ventas,Ganancia Bruta,Comisiones,Ganancia Neta\n';
    currentReportData.byProduct.forEach(p => {
        csv += `${p.name},${p.quantity},${p.sales},${p.profit},${p.commissions || 0},${p.netProfit ?? p.profit}\n`;
    });
    
    if (currentReportData.byTechnicalService && currentReportData.byTechnicalService.length > 0) {
        csv += '\nSERVICIOS TÉCNICOS\n';
        csv += 'Cliente,Equipo,Mano de Obra,Comisión Técnico,Ganancia Neta,Estado\n';
        currentReportData.byTechnicalService.forEach(ts => {
            csv += `${ts.customer},${ts.device || ''},${ts.laborCost},${ts.technicianCommission},${ts.netProfit},${ts.status}\n`;
        });
    }

    const totalComisionesVentas = (currentReportData.byProduct || []).reduce((s, p) => s + (p.commissions || 0), 0);
    const gananciaNeta = currentReportData.summary.totalProfit - totalComisionesVentas + (currentReportData.summary.totalTechnicalNetProfit || 0);
    csv += '\nRESUMEN TOTAL\n';
    csv += `Ganancia Ventas (Bruta),${currentReportData.summary.totalProfit}\n`;
    csv += `Comisiones Ventas,-${totalComisionesVentas}\n`;
    csv += `Ganancia Servicios Técnicos,${currentReportData.summary.totalTechnicalRevenue || 0}\n`;
    csv += `Comisiones Técnicos,-${currentReportData.summary.totalTechnicalCommissions || 0}\n`;
    csv += `GANANCIA NETA TOTAL,${gananciaNeta}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_ventas_${currentReportData.period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ========================================
// UTILIDADES
// ========================================

function formatNumber(num) {
    return new Intl.NumberFormat('es-CO').format(num);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Override de loadSales para usar nuestra versión mejorada
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar búsqueda en inventario
    initInventorySearch();
    
    // Sobrescribir loadSales del app principal
    if (typeof app !== 'undefined') {
        const originalLoadSales = app.loadSales;
        app.loadSales = async function() {
            await loadSalesEnhanced();
        };
        
        const originalLoadProducts = app.loadProducts;
        app.loadProducts = async function() {
            await originalLoadProducts.call(this);
            // Sincronizar allProducts para que el buscador de ventas
            // se actualice cuando se registra una compra nueva
            if (typeof allProducts !== 'undefined') {
                allProducts = AppState.products || [];
            }
            await loadInventoryProducts();
        };
    }
    
    // Formulario de actualización de venta
    const formUpdateSale = document.getElementById('formUpdateSale');
    if (formUpdateSale) {
        formUpdateSale.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const saleId = document.getElementById('updateSaleId').value;
            const updateData = {
                quantity: parseInt(document.getElementById('updateSaleQuantity').value),
                unitPrice: parseFloat(document.getElementById('updateSaleUnitPrice').value),
                customer: document.getElementById('updateSaleCustomer').value,
                paymentMethod: document.getElementById('updateSalePaymentMethod').value,
                employeeId: document.getElementById('updateSaleEmployee').value || null
            };
            
            try {
                await api.updateSale(saleId, updateData);
                utils.showToast('Venta actualizada exitosamente');
                closeSaleModal();
                loadSalesEnhanced();
                if (typeof app !== 'undefined' && app.loadProducts) {
                    app.loadProducts();
                }
            } catch (error) {
                utils.showToast(error.message || 'Error al actualizar', 'error');
            }
        });
    }
    
    // Cargar ventas mejoradas al abrir vista
    document.querySelectorAll('[data-view="sales"]').forEach(btn => {
        btn.addEventListener('click', () => {
            loadSalesEnhanced();
            if (typeof loadProductsForSearch === 'function') {
                loadProductsForSearch();
            }
        });
    });
    
    // Cargar inventario al abrir vista
    document.querySelectorAll('[data-view="inventory"]').forEach(btn => {
        btn.addEventListener('click', () => {
            loadInventoryProducts();
        });
    });
    
    // Selector de período de reportes
    const reportPeriod = document.getElementById('reportPeriod');
    if (reportPeriod) {
        reportPeriod.addEventListener('change', (e) => {
            loadReport(e.target.value);
        });
    }
    
    // Botones de descarga de reportes
    const btnDownloadPDF = document.getElementById('btnDownloadPDF');
    if (btnDownloadPDF) {
        btnDownloadPDF.addEventListener('click', downloadReportPDF);
    }
    
    const btnMonthlyClosePDF = document.getElementById('btnMonthlyClosePDF');
    if (btnMonthlyClosePDF) {
        btnMonthlyClosePDF.addEventListener('click', downloadMonthlyClosePDF);
        toggleMonthlyCloseButton(document.getElementById('reportPeriod')?.value || 'monthly');
    }

    const btnDownloadExcel = document.getElementById('btnDownloadExcel');
    if (btnDownloadExcel) {
        btnDownloadExcel.addEventListener('click', downloadReportExcel);
    }
});

// Exportar funciones
window.editSale = editSale;
window.deleteSale = deleteSale;
window.closeSaleModal = closeSaleModal;
window.loadReport = loadReport;
window.downloadReportPDF = downloadReportPDF;
window.downloadMonthlyClosePDF = downloadMonthlyClosePDF;
window.downloadReportExcel = downloadReportExcel;
