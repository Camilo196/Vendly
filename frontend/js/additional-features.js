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
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function editSale(saleId) {
    const sale = allSales.find(s => s._id === saleId);
    if (!sale) return;
    
    document.getElementById('updateSaleId').value = sale._id;
    document.getElementById('updateSaleQuantity').value = sale.quantity;
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

async function loadReport(period) {
    try {
        const response = await api.getReportSales(period);
        
        if (response.success) {
            currentReportData = response;
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
    
    const periodLabel = {
        'daily': 'Hoy',
        'weekly': 'Últimos 7 días',
        'monthly': 'Último mes',
        'yearly': 'Último año'
    }[data.period] || 'Personalizado';
    
    const html = `
        <div class="report-summary">
            <h3>Resumen ${periodLabel}</h3>
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
                    <h4>Ganancia</h4>
                    <p class="stat-value text-success">$${formatNumber(data.summary.totalProfit)}</p>
                </div>
                <div class="stat-card">
                    <h4>Ticket Promedio</h4>
                    <p class="stat-value">$${formatNumber(data.summary.averageTicket)}</p>
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
                    <tr style="font-size:1.1em; font-weight:700;">
                        <td>🏦 Ganancia Neta Total</td>
                        <td class="text-success" style="text-align:right;">$${formatNumber(
                            data.summary.totalProfit
                            - (data.byProduct || []).reduce((s, p) => s + (p.commissions || 0), 0)
                            + (data.summary.totalTechnicalNetProfit || 0)
                        )}</td>
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
    const periodLabel = {
        'daily': 'Hoy',
        'weekly': 'Últimos 7 días',
        'monthly': 'Último mes',
        'yearly': 'Último año'
    }[currentReportData.period] || 'Personalizado';
    
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
window.downloadReportExcel = downloadReportExcel;