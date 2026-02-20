// Estado global de la aplicación
const AppState = {
    user: null,
    products: [],
    purchases: [],
    sales: [],
    currentView: 'dashboard'
};

// Elementos del DOM
const elements = {
    loadingScreen: document.getElementById('loadingScreen'),
    authScreen: document.getElementById('authScreen'),
    mainApp: document.getElementById('mainApp'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    toastContainer: document.getElementById('toast')
};

// Utilidades
const utils = {
    formatMoney(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(isoDate) {
        return new Date(isoDate).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    showToast(message, type = 'success') {
        const toast = elements.toastContainer;
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    },

    showLoading(show = true) {
        elements.loadingScreen.style.display = show ? 'flex' : 'none';
    }
};

// Autenticación
const auth = {
    async login(email, password) {
        try {
            utils.showLoading(true);
            const response = await api.login({ email, password });
            
            if (response.success) {
                api.setToken(response.token);
                AppState.user = response.user;
                this.showApp();
                utils.showToast('¡Bienvenido!');
            }
        } catch (error) {
            utils.showToast(error.message || 'Error al iniciar sesión', 'error');
        } finally {
            utils.showLoading(false);
        }
    },

    async register(userData) {
        try {
            utils.showLoading(true);
            const response = await api.register(userData);
            
            if (response.success) {
                api.setToken(response.token);
                AppState.user = response.user;
                this.showApp();
                utils.showToast('¡Cuenta creada exitosamente!');
            }
        } catch (error) {
            utils.showToast(error.message || 'Error al registrarse', 'error');
        } finally {
            utils.showLoading(false);
        }
    },

    logout() {
        api.setToken(null);
        AppState.user = null;
        elements.mainApp.style.display = 'none';
        elements.authScreen.style.display = 'flex';
    },

    showApp() {
        elements.authScreen.style.display = 'none';
        elements.mainApp.style.display = 'flex';
        
        document.getElementById('businessName').textContent = AppState.user.businessName;
        document.getElementById('userEmail').textContent = AppState.user.email;
        
        // Resetear siempre antes de aplicar rol
        document.querySelector('.app-nav').style.display = '';
        document.querySelector('.app-content').style.display = '';
        document.getElementById('adminPanel').style.display = 'none';

        if (AppState.user.role === 'admin') {
            document.querySelector('.app-nav').style.display = 'none';
            document.querySelector('.app-content').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            adminCargarUsuarios();
        } else {
            app.loadDashboard();
            app.loadProducts();
            // Cargar empleados al inicio para tenerlos disponibles en el select de ventas
            api.getEmployees({ isActive: true }).then(r => {
                if (r.employees) AppState.employees = r.employees;
            });
        }
    }
};

// Aplicación principal
const app = {
    async loadDashboard() {
        try {
            const response = await api.getDashboard();
            if (response.success) {
                this.renderDashboard(response.stats);
            }
        } catch (error) {
            utils.showToast('Error al cargar dashboard', 'error');
        }
    },
renderDashboard(stats) {
    // ✅ AGREGAR VALIDACIÓN
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Productos</div>
                <div class="stat-value">${stats.inventory.totalProducts}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Stock Total</div>
                <div class="stat-value warning">${stats.inventory.totalStock}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Inversión Actual</div>
                <div class="stat-value">${utils.formatMoney(stats.inventory.currentInvestment)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ventas Totales</div>
                <div class="stat-value success">${utils.formatMoney(stats.sales.allTime.total)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ganancia Total</div>
                <div class="stat-value success">${utils.formatMoney(stats.sales.allTime.profit)}</div>
            </div>
            <div class="stat-card" style="border: 2px solid var(--success);">
                <div class="stat-label">🏦 Ganancia Neta (Tuya)</div>
                <div class="stat-value success">${utils.formatMoney(stats.sales.allTime.netProfit || stats.sales.allTime.profit)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">👥 Comisiones Pagadas</div>
                <div class="stat-value warning">${utils.formatMoney(stats.commissions?.totalPaid || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">⚠️ Comisiones Pendientes</div>
                <div class="stat-value warning">${utils.formatMoney(stats.commissions?.totalPending || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ventas Este Mes</div>
                <div class="stat-value">${utils.formatMoney(stats.sales.thisMonth.total)}</div>
            </div>
        `;
    }

    // Low stock products
    const lowStockList = document.getElementById('lowStockList');
    if (lowStockList && stats.lowStockProducts && stats.lowStockProducts.length > 0) {
        lowStockList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Stock</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.lowStockProducts.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.stock}</td>
                            <td><span class="badge badge-warning">Bajo</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (lowStockList) {
        lowStockList.innerHTML = '<div class="empty-state"><p>No hay productos con stock bajo</p></div>';
    }

    // Top products
    const topProductsList = document.getElementById('topProductsList');
    if (topProductsList && stats.topProducts && stats.topProducts.length > 0) {
        topProductsList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad Vendida</th>
                        <th>Ingresos</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.topProducts.map(p => `
                        <tr>
                            <td>${p.productName}</td>
                            <td>${p.totalQuantity}</td>
                            <td>${utils.formatMoney(p.totalRevenue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (topProductsList) {
        topProductsList.innerHTML = '<div class="empty-state"><p>No hay ventas registradas</p></div>';
    }
},

    async loadProducts() {
        try {
const response = await api.getProducts();
            if (response.success) {
                AppState.products = response.products;
                this.updateProductSelects();
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    },

    updateProductSelects() {
    const saleProductSelect = document.getElementById('saleProductId');
    const filterSelect = document.getElementById('filterSaleProduct');
    
    if (saleProductSelect) {
        saleProductSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
    }
    
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todos los productos</option>';
    }
        
        if (saleProductSelect) {
    saleProductSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
    
    AppState.products.forEach(p => {  
        if (p.stock > 0) {
            const option = document.createElement('option');
            option.value = p._id;
            const tipo = p.productType === 'celular' ? '📱' : 
                         p.productType === 'accesorio' ? '🔌' : '📦';
            option.textContent = `${p.name} ${tipo} (Stock: ${p.stock})`;
            saleProductSelect.appendChild(option);
        }
    });
}
    },

    async loadPurchases() {
    try {
        const response = await api.getPurchases();
        if (response.success) {
            // ✅ SIEMPRE guardar en variable global
            window.allPurchases = response.purchases;
            this.renderPurchases(response.purchases);
        }
    } catch (error) {
        utils.showToast('Error al cargar compras', 'error');
    }
},

    renderPurchases(purchases) {
        const container = document.getElementById('purchasesList');
        
        if (purchases.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>No hay compras registradas</p></div>';
            return;
        }

        const html = purchases.map(purchase => `
            <div class="purchase-item">
                <div class="purchase-header">
                    <div>
                        <strong>${purchase.productName || 'Producto'}</strong>
                        <span style="margin-left: 8px;">
                        ${purchase.productType === 'celular' ? '📱' : 
                            purchase.productType === 'accesorio' ? '🔌' : '📦'}
                        </span>
                        <small>${utils.formatDate(purchase.purchaseDate)}</small>
                    </div>
                    <div class="purchase-actions">
                        <button class="btn btn-sm" onclick="editPurchase('${purchase._id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deletePurchase('${purchase._id}')">🗑️</button>
                    </div>
                </div>
                <div class="purchase-details">
                    <span>Cantidad: <strong>${purchase.quantity}</strong></span>
                    <span>Costo Unit: <strong>${utils.formatMoney(purchase.unitCost)}</strong></span>
                    <span>Total: <strong>${utils.formatMoney(purchase.totalCost)}</strong></span>
                    ${purchase.supplier ? `<span>Proveedor: ${purchase.supplier}</span>` : ''}
                    ${purchase.invoice ? `<span>Factura: ${purchase.invoice}</span>` : ''}
                    ${purchase.suggestedPrice ? `<span>Precio sugerido: <strong>${utils.formatMoney(purchase.suggestedPrice)}</strong></span>` : ''}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    },

    async loadSales() {
        try {
            const response = await api.getSales();
            if (response.success) {
                this.renderSales(response.sales);
            }
        } catch (error) {
            utils.showToast('Error al cargar ventas', 'error');
        }
    },

    renderSales(sales) {
        const container = document.getElementById('salesList');
        
        if (sales.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div><p>No hay ventas registradas</p></div>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                        <th>Total</th>
                        <th>Ganancia</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map(s => `
                        <tr>
                            <td>${utils.formatDate(s.saleDate)}</td>
                            <td>${s.productName}</td>
                            <td>${s.quantity}</td>
                            <td>${utils.formatMoney(s.unitPrice)}</td>
                            <td style="font-weight: 700; color: var(--success);">${utils.formatMoney(s.totalSale)}</td>
                            <td><span class="badge ${s.profit >= 0 ? 'badge-success' : 'badge-danger'}">${utils.formatMoney(s.profit)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async loadInventory() {
    try {
        const response = await api.getProducts();
        if (response.success) {
            AppState.products = response.products;
            this.renderInventory(response.products);
        }
    } catch (error) {
        utils.showToast('Error al cargar inventario', 'error');
    }
},

    renderInventory(products) {
    const container = document.getElementById('productsList');

    if (!products || products.length === 0) {
        container.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-state-icon">📋</div><p>No hay productos en inventario</p></div></div>';
        return;
    }

    container.innerHTML = `
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Stock</th>
                        <th>Costo Promedio</th>
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
                                <td style="font-weight: 600;">
                                    ${p.name}
                                    <br><small style="color: #666;">
                                        ${p.productType === 'celular' ? '📱 Celular' : 
                                        p.productType === 'accesorio' ? '🔌 Accesorio' : 
                                        '📦 Otro'}
                                    </small>
                                </td>
                                <td>${p.stock}</td>
                                <td>${utils.formatMoney(p.averageCost)}</td>
                                <td style="color: var(--primary);">${utils.formatMoney(stockValue)}</td>
                                <td><span class="badge badge-${status}">${statusText}</span></td>
                                <td class="action-buttons">
                                    <button class="btn btn-sm" onclick="viewProductHistory('${p._id}')" title="Ver Historial">👁️</button>
                                    <button class="btn btn-sm" onclick="editProduct('${p._id}')">✏️</button>
                                    <button class="btn btn-sm" onclick="adjustProductStock('${p._id}', '${p.name}', ${p.stock})" title="Ajustar Stock">🔧</button>
                                    <button class="btn btn-sm btn-danger" onclick="deactivateProduct('${p._id}', '${p.name}')" title="Desactivar">❌</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
},
    async loadReports() {
        try {
            await loadReport('monthly');
        } catch (error) {
            utils.showToast('Error al cargar reportes', 'error');
        }
    },

    renderReports(products) {
        const container = document.getElementById('reportContent');
        
        if (products.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay datos para mostrar</p></div>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Stock</th>
                        <th>Comprado</th>
                        <th>Vendido</th>
                        <th>Ganancia Bruta</th>
                        <th>Comisiones</th>
                        <th>Ganancia Neta</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td style="font-weight: 600;">${p.name}</td>
                            <td>${p.stock}</td>
                            <td>${utils.formatMoney(p.totalPurchased)}</td>
                            <td>${utils.formatMoney(p.totalSold)}</td>
                            <td><span class="badge badge-success">${utils.formatMoney(p.profit)}</span></td>
                            <td><span class="badge badge-warning">${utils.formatMoney(p.totalCommissions || 0)}</span></td>
                            <td><span class="badge ${p.netProfit >= 0 ? 'badge-success' : 'badge-danger'}">${utils.formatMoney(p.netProfit ?? p.profit)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    utils.showLoading(false);

    // Auth forms
    // Botones de registro deshabilitados (registro público cerrado)

    document.getElementById('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await auth.login(email, password);
    });

    document.getElementById('formRegister').addEventListener('submit', async (e) => {
        e.preventDefault();
        const userData = {
            businessName: document.getElementById('regBusinessName').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value,
            phone: document.getElementById('regPhone').value,
            city: document.getElementById('regCity').value
        };
        await auth.register(userData);
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        if (confirm('¿Seguro que quieres salir?')) {
            auth.logout();
        }
    });

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const view = btn.dataset.view;
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`).classList.add('active');
            switch(view) {
                case 'dashboard':
                    await app.loadDashboard();
                    break;
                    
                case 'purchases':
                    await app.loadProducts();
                    await app.loadPurchases();
                    break;
                    
                case 'sales':
                    await app.loadProducts();
                    await app.loadSales();
                    await app.loadEmployeeSelects(); // ⭐ AGREGAR para cargar empleados en el selector
                    break;
                    
                case 'inventory':
                    if (typeof loadInventoryProducts === 'function') {
                        await loadInventoryProducts();
                    } else {
                        await app.loadInventory();
                    }
                    break;
                    
                case 'technical':                             
                    if (typeof loadTechnicalServices === 'function') {
                        await loadTechnicalServices();
                    }
                    break;                                     
                    
                case 'reports':
                    await app.loadReports();
                    break;
                    
                case 'employees':
                    app.loadEmployees();
                    app.loadEmployeeSelects();
                    break;

                case 'commissions':
                    app.loadCommissions();
                    app.loadEmployeeSelects();
                    break;

                case 'adminPanel':
                    adminCargarUsuarios();
                    break;
            }
        });
    });

    // Purchase form
    document.getElementById('formPurchase').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const purchaseData = {
            productName: document.getElementById('purchaseProductName').value.trim(),
            quantity: parseInt(document.getElementById('purchaseQuantity').value),
            unitCost: parseFloat(document.getElementById('purchaseUnitCost').value),
            suggestedPrice: parseFloat(document.getElementById('purchaseSuggestedPrice').value) || 0,
            supplier: document.getElementById('purchaseSupplier').value.trim(),
            invoice: document.getElementById('purchaseInvoice').value.trim(),
            notes: '', // Agregar campo notes vacío
            productType: document.getElementById('purchaseProductType').value,  // ⭐ NUEVO
            commissionRate: document.getElementById('purchaseCommissionRate').value 
                ? parseFloat(document.getElementById('purchaseCommissionRate').value) 
                : null  // ⭐ NUEVO
        };
        
        // DEBUG: Ver qué se está enviando
        console.log('📤 Datos de compra a enviar:', purchaseData);
        
        try {
            const response = await api.createPurchase(purchaseData);
            
            if (response.success) {
                utils.showToast('Compra registrada exitosamente', 'success');
                
                // Mostrar info del producto
                const productInfo = response.product;
                let message = `✅ ${productInfo.name}
📦 Stock actual: ${productInfo.stock}
💰 Costo promedio: ${utils.formatMoney(productInfo.averageCost)}`;
                
                // Mostrar tipo de producto
                if (productInfo.productType === 'celular') {
                    message += `
📱 Tipo: CELULAR (genera comisión)`;
                    
                    // Mostrar comisión específica si existe
                    if (productInfo.commissionRate !== null && productInfo.commissionRate !== undefined) {
                        message += `
💵 Comisión específica: ${productInfo.commissionRate}%`;
                    } else {
                        message += `
💵 Usa comisión por defecto del vendedor`;
                    }
                } else if (productInfo.productType === 'accesorio') {
                    message += `
🔌 Tipo: ACCESORIO (sin comisión)`;
                } else {
                    message += `
📦 Tipo: OTRO (sin comisión)`;
                }
                
                console.log(message);
                
                // Limpiar formulario
                e.target.reset();
                document.getElementById('commissionRateGroup').style.display = 'none';
                document.getElementById('purchaseTotal').textContent = '$0';
                
                // Recargar listas
                await app.loadPurchases();
                await app.loadProducts();
                await app.loadDashboard();
            }
        } catch (error) {
            utils.showToast(error.message || 'Error al registrar compra', 'error');
        }
    });

    // Calculate purchase total
    ['purchaseQuantity', 'purchaseUnitCost'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const qty = parseFloat(document.getElementById('purchaseQuantity').value) || 0;
            const cost = parseFloat(document.getElementById('purchaseUnitCost').value) || 0;
            document.getElementById('purchaseTotal').textContent = utils.formatMoney(qty * cost);
        });
    });

    // Sale form
    document.getElementById('formSale').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saleData = {
            productId: document.getElementById('saleProductId').value,
            quantity: parseInt(document.getElementById('saleQuantity').value),
            unitPrice: parseFloat(document.getElementById('saleUnitPrice').value),
            employeeId: document.getElementById('saleEmployee').value,
            customer: document.getElementById('saleCustomer').value,
            paymentMethod: document.getElementById('salePaymentMethod').value

        };

        try {
            const response = await api.createSale(saleData);
            if (response.success) {
                utils.showToast('¡Venta registrada exitosamente!');
                e.target.reset();
                document.getElementById('saleTotal').textContent = '$0';
                await app.loadSales();
                await app.loadProducts();
            }
        } catch (error) {
            utils.showToast(error.message || 'Error al registrar venta', 'error');
        }
    });

    // Calculate sale total
    ['saleQuantity', 'saleUnitPrice'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const qty = parseFloat(document.getElementById('saleQuantity').value) || 0;
            const price = parseFloat(document.getElementById('saleUnitPrice').value) || 0;
            document.getElementById('saleTotal').textContent = utils.formatMoney(qty * price);
        });
    });

    // Check if already logged in
    if (api.token) {
        api.getMe().then(response => {
            if (response.success) {
                AppState.user = response.user;
                auth.showApp();
            }
        }).catch(() => {
            api.setToken(null);
        });
    }
    
    // Formulario actualizar compra
const formUpdatePurchase = document.getElementById('formUpdatePurchase');
if (formUpdatePurchase) {
    formUpdatePurchase.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const purchaseId = document.getElementById('updatePurchaseId').value;
        const updateData = {
            productName: document.getElementById('updatePurchaseName').value,
            quantity: parseInt(document.getElementById('updatePurchaseQuantity').value),
            unitCost: parseFloat(document.getElementById('updatePurchaseUnitCost').value),
            supplier: document.getElementById('updatePurchaseSupplier').value,
            suggestedPrice: parseFloat(document.getElementById('updatePurchaseSuggestedPrice').value) || undefined,
            productType: document.getElementById('updatePurchaseProductType').value
        };
        
        try {
            await api.updatePurchase(purchaseId, updateData);
            utils.showToast('Compra actualizada exitosamente');
            closePurchaseModal();
            
            // ✅ Recargar TODO (compras, productos Y dashboard)
            await app.loadPurchases();
            await app.loadProducts();
            await app.loadDashboard();  // 👈 AGREGAR ESTA LÍNEA
        } catch (error) {
            utils.showToast(error.message || 'Error al actualizar', 'error');
        }
    });
    }
});

// ========================================
// FUNCIONES PARA COMPRAS (Editar/Eliminar)
// ========================================

window.editPurchase = async function(purchaseId) {
    const purchases = window.allPurchases || [];
    const purchase = purchases.find(p => p._id === purchaseId);
    if (!purchase) {
        utils.showToast('Compra no encontrada', 'error');
        return;
    }
    
    // Buscar el precio sugerido y tipo en el producto (más actualizado que en la compra)
    const producto = AppState.products ? AppState.products.find(p =>
        p._id === purchase.productId || p.name?.toLowerCase() === purchase.productName?.toLowerCase()
    ) : null;

    document.getElementById('updatePurchaseId').value = purchase._id;
    document.getElementById('updatePurchaseName').value = purchase.productName || '';
    document.getElementById('updatePurchaseQuantity').value = purchase.quantity;
    document.getElementById('updatePurchaseUnitCost').value = purchase.unitCost;
    document.getElementById('updatePurchaseSupplier').value = purchase.supplier || '';
    document.getElementById('updatePurchaseSuggestedPrice').value = producto?.suggestedPrice || purchase.suggestedPrice || '';
    document.getElementById('updatePurchaseProductType').value = producto?.productType || purchase.productType || 'otro';

    document.getElementById('purchaseModal').classList.add('show');
};

window.deletePurchase = async function(purchaseId) {
    if (!confirm('¿Eliminar esta compra? Se ajustará el inventario.')) return;
    
    try {
        await api.deletePurchase(purchaseId);
        utils.showToast('Compra eliminada exitosamente');
        
        // ✅ Recargar TODO (compras, productos Y dashboard)
        await app.loadPurchases();
        await app.loadProducts();
        await app.loadDashboard();
    } catch (error) {
        utils.showToast(error.message || 'Error al eliminar', 'error');
    }
};
// ========================================
// FUNCIONES PARA INVENTARIO
// ========================================

window.viewProductHistory = async function(productId) {
    try {
        const history = await api.getProductHistory(productId);
        const product = AppState.products.find(p => p._id === productId);
        
        document.getElementById('productHistoryTitle').textContent = `Historial de ${product?.name || 'Producto'}`;
        
        // Renderizar compras
        const purchasesList = document.getElementById('productPurchasesList');
        if (history.purchases.length > 0) {
            purchasesList.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Cantidad</th>
                            <th>Costo Unit.</th>
                            <th>Total</th>
                            <th>Proveedor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.purchases.map(p => `
                            <tr>
                                <td>${utils.formatDate(p.purchaseDate)}</td>
                                <td>${product?.productType === 'celular' ? '📱' : product?.productType === 'accesorio' ? '🔌' : '📦'}</td>
                                <td>${p.quantity}</td>
                                <td>${utils.formatMoney(p.unitCost)}</td>
                                <td>${utils.formatMoney(p.totalCost)}</td>
                                <td>${p.supplier || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            purchasesList.innerHTML = '<p style="text-align:center; color:#999;">No hay compras registradas</p>';
        }
        
        // Renderizar ventas
        const salesList = document.getElementById('productSalesList');
        if (history.sales.length > 0) {
            salesList.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Cantidad</th>
                            <th>Precio Unit.</th>
                            <th>Total</th>
                            <th>Cliente</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.sales.map(s => `
                            <tr>    
                                <td>${utils.formatDate(s.saleDate)}</td>
                                <td>${product?.productType === 'celular' ? '📱' : product?.productType === 'accesorio' ? '🔌' : '📦'}</td>
                                <td>${s.quantity}</td>
                                <td>${utils.formatMoney(s.unitPrice)}</td>
                                <td>${utils.formatMoney(s.totalSale)}</td>
                                <td>${s.customer || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            salesList.innerHTML = '<p style="text-align:center; color:#999;">No hay ventas registradas</p>';
        }
        
        document.getElementById('productHistoryModal').classList.add('show');
    } catch (error) {
        utils.showToast('Error al cargar historial', 'error');
    }
};

window.showHistoryTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`history${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).classList.add('active');
};

window.closeProductHistoryModal = function() {
    document.getElementById('productHistoryModal').classList.remove('show');
};

window.adjustProductStock = function(productId, productName, currentStock) {
    document.getElementById('adjustProductId').value = productId;
    document.getElementById('adjustProductName').value = productName;
    document.getElementById('adjustCurrentStock').value = currentStock;
    document.getElementById('adjustmentValue').value = '';
    document.getElementById('adjustReason').value = '';
    document.getElementById('adjustReasonOther').value = '';
    document.getElementById('adjustReasonOtherGroup').style.display = 'none';
    document.getElementById('newStockPreview').style.display = 'none';
    
    document.getElementById('adjustStockModal').classList.add('show');
};

window.closeAdjustStockModal = function() {
    document.getElementById('adjustStockModal').classList.remove('show');
};

window.deactivateProduct = async function(productId, productName) {
    if (!confirm(`¿Desactivar el producto "${productName}"?\n\nEl producto no se eliminará, solo se ocultará de las listas.`)) {
        return;
    }
    
    try {
        await api.deactivateProduct(productId);
        utils.showToast('Producto desactivado correctamente');
        await app.loadInventory();
        await app.loadDashboard();
    } catch (error) {
        utils.showToast(error.message || 'Error al desactivar', 'error');
    }
};

// Formulario de ajuste de stock
document.addEventListener('DOMContentLoaded', () => {
    const formAdjustStock = document.getElementById('formAdjustStock');
    if (formAdjustStock) {
        // Calcular preview del nuevo stock
        document.getElementById('adjustmentValue').addEventListener('input', function() {
            const current = parseFloat(document.getElementById('adjustCurrentStock').value) || 0;
            const adjustment = parseFloat(this.value) || 0;
            const newStock = current + adjustment;
            
            document.getElementById('newStockValue').textContent = newStock;
            document.getElementById('newStockPreview').style.display = 'block';
            
            if (newStock < 0) {
                document.getElementById('newStockValue').style.color = 'red';
            } else {
                document.getElementById('newStockValue').style.color = 'green';
            }
        });
        
        // Mostrar campo "Otro" si se selecciona
        document.getElementById('adjustReason').addEventListener('change', function() {
            const otherGroup = document.getElementById('adjustReasonOtherGroup');
            if (this.value === 'Otro') {
                otherGroup.style.display = 'block';
                document.getElementById('adjustReasonOther').required = true;
            } else {
                otherGroup.style.display = 'none';
                document.getElementById('adjustReasonOther').required = false;
            }
        });
        
        // Submit
        formAdjustStock.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const productId = document.getElementById('adjustProductId').value;
            const adjustment = parseFloat(document.getElementById('adjustmentValue').value);
            let reason = document.getElementById('adjustReason').value;
            
            if (reason === 'Otro') {
                reason = document.getElementById('adjustReasonOther').value;
            }
            
            try {
                await api.adjustStock(productId, { adjustment, reason });
                utils.showToast('Stock ajustado correctamente');
                closeAdjustStockModal();
                await app.loadInventory();
                await app.loadPurchases();
                await app.loadDashboard();
            } catch (error) {
                utils.showToast(error.message || 'Error al ajustar stock', 'error');
            }
        });
    }
});

window.closePurchaseModal = function() {
    document.getElementById('purchaseModal').classList.remove('show');
};

// =============================================
// FUNCIONES DEL PANEL DE ADMINISTRACIÓN
// =============================================

let adminUsuarioSeleccionado = null;

window.adminCargarUsuarios = async function() {
    const panel = document.getElementById('adminPanel');
    panel.innerHTML = `
        <h2 style="margin:0 0 24px;">⚙️ Panel de Administración</h2>

        <div style="background:white; border-radius:10px; padding:20px; margin-bottom:20px; box-shadow:0 2px 6px rgba(0,0,0,0.08);">
            <h3 style="margin:0 0 16px; color:#1e3a5f;">➕ Crear nuevo cliente</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div><label style="font-size:.85rem; color:#555;">Nombre del negocio *</label><br>
                    <input id="newClientName" type="text" placeholder="Mi Tienda" style="width:100%; padding:9px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; margin-top:4px;"></div>
                <div><label style="font-size:.85rem; color:#555;">Ciudad</label><br>
                    <input id="newClientCity" type="text" placeholder="Pasto" style="width:100%; padding:9px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; margin-top:4px;"></div>
                <div><label style="font-size:.85rem; color:#555;">Email *</label><br>
                    <input id="newClientEmail" type="email" placeholder="correo@negocio.com" style="width:100%; padding:9px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; margin-top:4px;"></div>
                <div><label style="font-size:.85rem; color:#555;">Contraseña inicial *</label><br>
                    <input id="newClientPassword" type="password" placeholder="Mínimo 6 caracteres" style="width:100%; padding:9px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; margin-top:4px;"></div>
            </div>
            <button onclick="adminCrearCliente()" class="btn btn-primary" style="margin-top:14px;">✅ Crear cliente</button>
        </div>

        <div style="background:white; border-radius:10px; padding:20px; box-shadow:0 2px 6px rgba(0,0,0,0.08);">
            <h3 style="margin:0 0 16px; color:#1e3a5f;">👥 Clientes registrados</h3>
            <div id="adminUsersList">Cargando...</div>
        </div>

        <div id="modalCambiarPassword" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:white; border-radius:10px; padding:24px; width:340px;">
                <h3 style="margin:0 0 8px;">🔑 Cambiar contraseña</h3>
                <p id="modalClienteNombre" style="color:#666; font-size:.9rem; margin:0 0 16px;"></p>
                <input id="nuevaPasswordInput" type="password" placeholder="Nueva contraseña"
                    style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; margin-bottom:14px;">
                <div style="display:flex; gap:10px;">
                    <button onclick="adminGuardarPassword()" class="btn btn-primary" style="flex:1;">Guardar</button>
                    <button onclick="document.getElementById('modalCambiarPassword').style.display='none'" class="btn btn-secondary" style="flex:1;">Cancelar</button>
                </div>
            </div>
        </div>
    `;

    const contenedor = document.getElementById('adminUsersList');
    try {
        const res = await fetch(`${api.baseURL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${api.token}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        const clientes = data.users.filter(u => u.role !== 'admin');
        if (clientes.length === 0) {
            contenedor.innerHTML = '<p style="color:#888;">No hay clientes registrados aún.</p>';
            return;
        }

        contenedor.innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:.9rem;">
                <thead>
                    <tr style="background:#f5f5f5;">
                        <th style="padding:10px; text-align:left;">Negocio</th>
                        <th style="padding:10px; text-align:left;">Email</th>
                        <th style="padding:10px; text-align:left;">Ciudad</th>
                        <th style="padding:10px; text-align:center;">Estado</th>
                        <th style="padding:10px; text-align:center;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${clientes.map(u => `
                        <tr style="border-bottom:1px solid #eee;">
                            <td style="padding:10px; font-weight:600;">${u.businessName}</td>
                            <td style="padding:10px; color:#555;">${u.email}</td>
                            <td style="padding:10px; color:#777;">${u.city || '—'}</td>
                            <td style="padding:10px; text-align:center;">
                                <span style="background:${u.isActive ? '#d4edda' : '#f8d7da'}; color:${u.isActive ? '#155724' : '#721c24'}; padding:3px 10px; border-radius:20px; font-size:.8rem; font-weight:600;">
                                    ${u.isActive ? '✅ Activo' : '❌ Inactivo'}
                                </span>
                            </td>
                            <td style="padding:10px; text-align:center;">
                                <button onclick="adminAbrirModalPassword('${u.id}', '${u.businessName}')" class="btn btn-sm" style="margin-right:5px;">🔑 Contraseña</button>
                                <button onclick="adminToggleEstado('${u.id}', ${u.isActive})" class="btn btn-sm ${u.isActive ? 'btn-danger' : ''}">
                                    ${u.isActive ? '🚫 Desactivar' : '✅ Activar'}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        contenedor.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
    }
};

window.adminAbrirModalPassword = function(userId, nombre) {
    adminUsuarioSeleccionado = userId;
    document.getElementById('modalClienteNombre').textContent = `Cliente: ${nombre}`;
    document.getElementById('nuevaPasswordInput').value = '';
    document.getElementById('modalCambiarPassword').style.display = 'flex';
};

window.adminGuardarPassword = async function() {
    const nuevaPassword = document.getElementById('nuevaPasswordInput').value;
    if (!nuevaPassword || nuevaPassword.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    try {
        const res = await fetch(`${api.baseURL}/admin/users/${adminUsuarioSeleccionado}/password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${api.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: nuevaPassword })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        document.getElementById('modalCambiarPassword').style.display = 'none';
        alert('✅ Contraseña actualizada exitosamente');
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

window.adminToggleEstado = async function(userId, isCurrentlyActive) {
    if (!confirm(`¿Seguro que deseas ${isCurrentlyActive ? 'desactivar' : 'activar'} este cliente?`)) return;
    try {
        const res = await fetch(`${api.baseURL}/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${api.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !isCurrentlyActive })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        adminCargarUsuarios();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

window.adminCrearCliente = async function() {
    const businessName = document.getElementById('newClientName').value.trim();
    const email = document.getElementById('newClientEmail').value.trim();
    const password = document.getElementById('newClientPassword').value;
    const city = document.getElementById('newClientCity').value.trim();

    if (!businessName || !email || !password) {
        alert('Nombre, email y contraseña son obligatorios');
        return;
    }
    try {
        const res = await fetch(`${api.baseURL}/admin/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${api.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ businessName, email, password, city })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        alert(`✅ Cliente "${businessName}" creado exitosamente`);
        document.getElementById('newClientName').value = '';
        document.getElementById('newClientEmail').value = '';
        document.getElementById('newClientPassword').value = '';
        document.getElementById('newClientCity').value = '';
        adminCargarUsuarios();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};
window.editProduct = function(productId) {
    const product = AppState.products ? AppState.products.find(p => p._id === productId) : null;
    if (!product) { utils.showToast('Producto no encontrado', 'error'); return; }
    document.getElementById('editProductId').value = product._id;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductType').value = product.productType || 'otro';
    document.getElementById('editProductSuggestedPrice').value = product.suggestedPrice || '';
    document.getElementById('editProductCommission').value = product.commissionRate ?? '';
    document.getElementById('editProductModal').classList.add('show');
};

window.closeEditProductModal = function() {
    document.getElementById('editProductModal').classList.remove('show');
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('formEditProduct')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editProductId').value;
        const data = {
            name: document.getElementById('editProductName').value.trim(),
            productType: document.getElementById('editProductType').value,
            suggestedPrice: parseFloat(document.getElementById('editProductSuggestedPrice').value) || undefined,
            commissionRate: document.getElementById('editProductCommission').value !== '' 
                ? parseFloat(document.getElementById('editProductCommission').value) 
                : null
        };
        try {
            await api.request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            utils.showToast('Producto actualizado');
            closeEditProductModal();
            app.loadInventory();
            app.loadProducts();
        } catch (error) {
            utils.showToast(error.message || 'Error al actualizar', 'error');
        }
    });
});