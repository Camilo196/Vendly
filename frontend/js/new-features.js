// ========================================
// FUNCIONALIDADES MEJORADAS
// ========================================

let allProducts = [];
let allEmployees = [];
let selectedProduct = null;
let allServices = [];
let allPurchases = [];

// Cargar productos para búsqueda
async function loadProductsForSearch() {
    try {
        // Si AppState ya tiene productos frescos, usarlos directamente
        if (typeof AppState !== 'undefined' && AppState.products && AppState.products.length > 0) {
            allProducts = AppState.products;
            return;
        }
        const response = await api.getProducts();
        if (response.success) {
            allProducts = response.products || [];
        }
    } catch (error) {
        console.error('❌ Error loading products:', error);
    }
}

// Cargar empleados técnicos para el dropdown
async function loadEmployeesForService() {
    try {
        const response = await api.getEmployees({ isActive: true });
        if (response.success) {
            allEmployees = response.employees || [];
            fillTechnicianDropdowns();
        }
    } catch (error) {
        console.error('❌ Error loading employees:', error);
    }
}

// Llenar todos los dropdowns de técnico en el formulario
function fillTechnicianDropdowns() {
    // Técnicos: posición 'tecnico' o 'vendedor_tecnico'
    const technicians = allEmployees.filter(e =>
        e.position === 'tecnico' || e.position === 'vendedor_tecnico'
    );

    const dropdowns = ['serviceTechnicianId', 'updateServiceTechnicianId'];
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '<option value="">Sin técnico asignado</option>' +
            technicians.map(e =>
                `<option value="${e._id}" data-rate="${e.commissionConfig?.technicalServices?.rate || 0}">${e.name}</option>`
            ).join('');
    });
}

// ========================================
// BARRA DE BÚSQUEDA (VENTAS)
// ========================================

function initProductSearch() {
    const searchBar = document.getElementById('productSearchBar');
    const searchResults = document.getElementById('searchResults');

    if (!searchBar) return;

    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        if (query.length === 0) {
            searchResults.classList.remove('show');
            return;
        }

        const filtered = allProducts.filter(product => {
            const name     = product.name.toLowerCase();
            const category = (product.category || '').toLowerCase();
            const brand    = (product.brand || '').toLowerCase();
            const matches  = name.includes(query) || category.includes(query) || brand.includes(query);
            const available = product.stock > 0 && product.isActive !== false;
            return matches && available;
        });

        displaySearchResults(filtered);
    });

    document.addEventListener('click', (e) => {
        if (!searchBar.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('show');
        }
    });
}

function displaySearchResults(products) {
    const searchResults = document.getElementById('searchResults');

    if (products.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">No se encontraron productos</div>';
        searchResults.classList.add('show');
        return;
    }

    const html = products.map(product => {
    const tipo = product.productType === 'celular' ? '📱 Celular' : 
                 product.productType === 'accesorio' ? '🔌 Accesorio' : 
                 '📦 Otro';
    
    return `
        <div class="search-result-item" onclick="selectProductFromSearch('${product._id}')">
            <div class="search-result-name">${product.name} ${product.productType === 'celular' ? '📱' : product.productType === 'accesorio' ? '🔌' : '📦'}</div>
            <div class="search-result-details">
                <span>${tipo}</span>
                ${product.category ? `<span>📂 ${product.category}</span>` : ''}
                ${product.brand    ? `<span>🏷️ ${product.brand}</span>` : ''}
                <span>📦 Stock: ${product.stock}</span>
                <span>💰 Sugerido: $${formatNumber(product.suggestedPrice || 0)}</span>
            </div>
        </div>
    `;
}).join('');

    searchResults.innerHTML = html;
    searchResults.classList.add('show');
}

function selectProductFromSearch(productId) {
    selectedProduct = allProducts.find(p => p._id === productId);
    if (!selectedProduct) return;

    document.getElementById('saleProductId').value           = selectedProduct._id;
    document.getElementById('selectedProductName').value     = selectedProduct.name;
    document.getElementById('availableStock').value          = selectedProduct.stock;
    document.getElementById('suggestedPrice').value          = `$${formatNumber(selectedProduct.suggestedPrice || 0)}`;

    if (selectedProduct.suggestedPrice > 0) {
        document.getElementById('saleUnitPrice').value = selectedProduct.suggestedPrice;
    }

    document.getElementById('productSearchBar').value = '';
    document.getElementById('searchResults').classList.remove('show');
    document.getElementById('saleQuantity').focus();

    updateSaleTotal();
}

function updateSaleTotal() {
    const quantity = parseFloat(document.getElementById('saleQuantity').value)   || 0;
    const price    = parseFloat(document.getElementById('saleUnitPrice').value)  || 0;
    document.getElementById('saleTotal').textContent = `$${formatNumber(quantity * price)}`;
}

// ========================================
// COMPRAS MEJORADAS
// ========================================

async function loadPurchasesEnhanced() {
    try {
        const response = await api.getPurchases();
        if (response.success) {
            allPurchases = response.purchases || [];
            displayPurchases(allPurchases);
        }
    } catch (error) {
        console.error('Error loading purchases:', error);
    }
}

function displayPurchases(purchases) {
    const container = document.getElementById('purchasesList');
    if (!container) return;

    if (purchases.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay compras registradas</p></div>';
        return;
    }

    const html = purchases.map(purchase => `
        <div class="purchase-item">
            <div class="purchase-header">
                <div>
                    <strong>${purchase.productName || 'Producto'}</strong>
                    <span style="margin-left: 8px;">${purchase.productType === 'celular' ? '📱' : purchase.productType === 'accesorio' ? '🔌' : '📦'}</span>
                    <small>${formatDate(purchase.purchaseDate)}</small>
                </div>
                <div class="purchase-actions">
                    <button class="btn btn-sm" onclick="editPurchase('${purchase._id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePurchase('${purchase._id}')">🗑️</button>
                </div>
            </div>
            <div class="purchase-details">
                <span>Cantidad: <strong>${purchase.quantity}</strong></span>
                <span>Costo Unit: <strong>$${formatNumber(purchase.unitCost)}</strong></span>
                <span>Total: <strong>$${formatNumber(purchase.totalCost)}</strong></span>
                ${purchase.supplier ? `<span>Proveedor: ${purchase.supplier}</span>` : ''}
                ${purchase.invoice  ? `<span>Factura: ${purchase.invoice}</span>`   : ''}
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

async function editPurchase(purchaseId) {
    const purchases = window.allPurchases || allPurchases;
    const purchase  = purchases.find(p => p._id === purchaseId);
    if (!purchase) return;

    document.getElementById('updatePurchaseId').value            = purchase._id;
    document.getElementById('updatePurchaseQuantity').value      = purchase.quantity;
    document.getElementById('updatePurchaseUnitCost').value      = purchase.unitCost;
    document.getElementById('updatePurchaseSupplier').value      = purchase.supplier || '';
    document.getElementById('updatePurchaseSuggestedPrice').value = purchase.productId?.suggestedPrice || '';

    document.getElementById('purchaseModal').classList.add('show');
}

async function deletePurchase(purchaseId) {
    if (!confirm('¿Eliminar esta compra? Se ajustará el inventario.')) return;

    try {
        await api.deletePurchase(purchaseId);
        utils.showToast('Compra eliminada exitosamente');

        if (typeof app !== 'undefined' && app.loadPurchases) await app.loadPurchases();
        if (typeof app !== 'undefined' && app.loadProducts)  app.loadProducts();
    } catch (error) {
        utils.showToast(error.message || 'Error al eliminar', 'error');
    }
}

function closePurchaseModal() {
    document.getElementById('purchaseModal').classList.remove('show');
}

// ========================================
// SERVICIO TÉCNICO
// ========================================

async function loadTechnicalServices(filters = {}) {
    try {
        let endpoint = '/technical-services';
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (params.toString()) endpoint += '?' + params.toString();

        const response = await api.getTechnicalServices(endpoint);

        if (response.success) {
            allServices = response.services || [];
            displayTechnicalServices(allServices);
            updateServiceStats(allServices);
        }
    } catch (error) {
        console.error('Error loading services:', error);
        utils.showToast('Error al cargar servicios técnicos', 'error');
    }
}

function displayTechnicalServices(services) {
    const container = document.getElementById('servicesList');
    if (!container) return;

    if (services.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay servicios registrados</p></div>';
        return;
    }

    const html = services.map(service => {
        const labor      = service.laborCost  || 0;
        const partsCost  = service.partsCost  || 0;   // lo que pagó el negocio
        const partsPrice = service.partsPrice || partsCost; // lo que cobra al cliente
        const commission = service.technicianCommission || 0;
        const rate       = service.technicianCommissionRate || 0;
        // Total cobrado = mano de obra + precio repuesto al cliente
        const total      = labor + partsPrice;
        // Ganancia neta = total cobrado - comisión técnico - costo real del repuesto
        // Ej: $135 - $50 comisión - $35 repuesto = $50
        const localNet   = total - commission - partsCost;
        const isDelivered = service.status === 'delivered';

        return `
        <div class="service-item status-${service.status}">
            <div class="service-header">
                <div>
                    <div class="service-customer">
                        ${service.customer.name}
                        ${service.customer.phone ? `<span style="font-weight:400; color:var(--text-secondary); font-size:13px;"> · ${service.customer.phone}</span>` : ''}
                    </div>
                    <div class="service-device">${service.device.brand || ''} ${service.device.model || ''} ${service.device.type}</div>
                </div>
                <div style="text-align: right;">
                    <span class="service-status-badge ${service.status}">
                        ${getStatusLabel(service.status)}
                    </span>
                    ${service.commissionApproved ? `<div style="margin-top:4px; font-size:11px; color:var(--success);">✅ Comisión aprobada</div>` : ''}
                </div>
            </div>

            <div class="service-body">
                <div class="service-problem">
                    <strong>Problema:</strong> ${service.problemDescription}
                </div>

                ${service.technician ? `
                <div style="margin: 8px 0; padding: 8px; background: var(--bg-secondary); border-radius: 8px; font-size: 13px;">
                    🔧 <strong>Técnico:</strong> ${service.technician}
                </div>` : ''}

                <div class="service-costs-breakdown">
                    <div class="cost-row">
                        <span>Mano de Obra:</span>
                        <strong>$${formatNumber(labor)}</strong>
                    </div>
                    ${service.technicianId ? `
                    <div class="cost-row cost-sub">
                        <span>→ Comisión Técnico (${rate}%):</span>
                        <span class="text-info">$${formatNumber(commission)}</span>
                    </div>
                    <div class="cost-row cost-sub">
                        <span>→ Local (mano de obra):</span>
                        <span class="text-success">$${formatNumber(labor - commission)}</span>
                    </div>
                    ` : `
                    <div class="cost-row cost-sub">
                        <span>→ Local (mano de obra):</span>
                        <span class="text-success">$${formatNumber(labor)}</span>
                    </div>
                    `}

                    <div class="cost-row">
                        <span>Repuesto cobrado al cliente:</span>
                        <strong>$${formatNumber(partsPrice)}</strong>
                    </div>
                    <div class="cost-row cost-sub">
                        <span>→ Costo del repuesto (negocio):</span>
                        <span style="color:#ef4444;">-$${formatNumber(partsCost)}</span>
                    </div>

                    <div class="cost-row cost-total">
                        <span><strong>Total Cobrado al Cliente:</strong></span>
                        <strong class="text-primary">$${formatNumber(total)}</strong>
                    </div>
                    <div class="cost-row cost-earnings">
                        <span><strong>✅ Ganancia Neta Local:</strong></span>
                        <strong class="text-success">$${formatNumber(localNet)}</strong>
                    </div>
                </div>
            </div>

            <div class="service-actions">
                ${!isDelivered ? `
                <button class="btn btn-sm btn-success" onclick="deliverService('${service._id}', '${service.customer.name}')">
                    📦 Entregar
                </button>
                ` : `
                <span style="font-size:13px; color:var(--success);">📦 Entregado el ${formatDate(service.deliveryDate)}</span>
                `}
                <button class="btn btn-sm btn-primary" onclick="editService('${service._id}')">
                    ✏️ Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteService('${service._id}')">
                    🗑️ Eliminar
                </button>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// ✅ NUEVO: Marcar como entregado y aprobar comisión
async function deliverService(serviceId, customerName) {
    if (!confirm(`¿Confirmar entrega del equipo a ${customerName}? Esto aprobará la comisión del técnico.`)) return;

    try {
        const response = await api.deliverService(serviceId);
        if (response.success) {
            utils.showToast(response.message || 'Equipo entregado y comisión aprobada ✅');
            loadTechnicalServices();
        }
    } catch (error) {
        utils.showToast(error.message || 'Error al entregar el equipo', 'error');
    }
}

function updateServiceStats(services) {
    let pending        = 0;
    let inProgress     = 0;
    let totalRevenue   = 0;
    let totalLocalNet  = 0;

    services.forEach(service => {
        if (service.status === 'pending')    pending++;
        if (service.status === 'in_progress') inProgress++;
        if (service.status === 'completed' || service.status === 'delivered') {
            const labor      = service.laborCost  || 0;
            const partsCost  = service.partsCost  || 0;
            const partsPrice = service.partsPrice || partsCost;
            const commission = service.technicianCommission || 0;
            const total      = labor + partsPrice;
            totalRevenue  += total;
            totalLocalNet += total - commission - partsCost;
        }
    });

    const pendingEl    = document.getElementById('statServicesPending');
    const inProgressEl = document.getElementById('statServicesInProgress');
    const revenueEl    = document.getElementById('statServicesRevenue');
    const laborEl      = document.getElementById('statServicesLabor');

    if (pendingEl)    pendingEl.textContent    = pending;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (revenueEl)    revenueEl.textContent    = `$${formatNumber(totalRevenue)}`;
    if (laborEl)      laborEl.textContent      = `$${formatNumber(totalLocalNet)}`;
}

function getStatusLabel(status) {
    const labels = {
        'pending':       'Pendiente',
        'in_progress':   'En Proceso',
        'waiting_parts': 'Esperando Repuesto',
        'completed':     'Completado',
        'delivered':     'Entregado',
        'cancelled':     'Cancelado'
    };
    return labels[status] || status;
}

async function editService(serviceId) {
    const service = allServices.find(s => s._id === serviceId);
    if (!service) return;

    document.getElementById('updateServiceId').value         = service._id;
    document.getElementById('updateStatus').value            = service.status;
    document.getElementById('updateLaborCost').value         = service.laborCost || 0;
    document.getElementById('updatePartsCost').value         = service.partsCost || 0;

    // ✅ Técnico y comisión en modal de edición
    const techSelect = document.getElementById('updateServiceTechnicianId');
    if (techSelect) {
        techSelect.value = service.technicianId || '';
    }

    const rateInput = document.getElementById('updateCommissionRate');
    if (rateInput) rateInput.value = service.technicianCommissionRate || 0;

    const commInput = document.getElementById('updateTechnicianCommission');
    if (commInput) commInput.value = service.technicianCommission || 0;

    document.getElementById('serviceModal').classList.add('show');
}

async function deleteService(serviceId) {
    if (!confirm('¿Eliminar este servicio?')) return;

    try {
        await api.deleteTechnicalService(serviceId);
        utils.showToast('Servicio eliminado exitosamente');
        loadTechnicalServices();
    } catch (error) {
        utils.showToast(error.message || 'Error al eliminar', 'error');
    }
}

function closeServiceModal() {
    document.getElementById('serviceModal').classList.remove('show');
}

// ========================================
// CÁLCULO DE TOTALES DEL FORMULARIO
// ========================================

window.updateServiceTotals = function() {
    const laborCost  = parseFloat(document.getElementById('laborCost')?.value)  || 0;
    const rate       = parseFloat(document.getElementById('commissionRate')?.value) || 0;

    // Costo del repuesto (lo pagó el negocio) y precio que le cobra al cliente
    const partsCost  = parseFloat(document.getElementById('partsCost')?.value)  || 0;
    const partsPrice = parseFloat(document.getElementById('partsPrice')?.value) || 0;

    // ── Lógica de ganancia ───────────────────────────────────────────────
    // Ejemplo: mano de obra $100, repuesto comprado en $35, cobrado al cliente $35
    // Total cobrado = mano de obra + precio repuesto cobrado al cliente
    const totalCobrado = laborCost + partsPrice;

    // Comisión del técnico: solo sobre la mano de obra
    const commission = parseFloat(((laborCost * rate) / 100).toFixed(2));

    // Ganancia neta local:
    //   Total cobrado - comisión técnico - costo real del repuesto
    //   Ejemplo: $135 cobrado - $50 comisión - $35 repuesto = $50 ganancia
    const localNet = totalCobrado - commission - partsCost;

    // Actualizar campo de comisión automáticamente
    const commInput = document.getElementById('technicianCommission');
    if (commInput && !commInput.dataset.manualOverride) {
        commInput.value = commission;
    }

    // Actualizar todos los displays
    const totalEl      = document.getElementById('serviceTotal');
    const laborDisp    = document.getElementById('serviceLaborDisplay');
    const partsDisp    = document.getElementById('servicePartsPriceDisplay');
    const techEl       = document.getElementById('serviceTechnicianEarnings');
    const partsCostEl  = document.getElementById('servicePartsCostDisplay');
    const localEl      = document.getElementById('serviceLocalEarnings');

    if (totalEl)     totalEl.textContent     = `$${formatNumber(totalCobrado)}`;
    if (laborDisp)   laborDisp.textContent   = `$${formatNumber(laborCost)}`;
    if (partsDisp)   partsDisp.textContent   = `$${formatNumber(partsPrice)}`;
    if (techEl)      techEl.textContent      = `$${formatNumber(commission)}`;
    if (partsCostEl) partsCostEl.textContent = `$${formatNumber(partsCost)}`;
    if (localEl)     localEl.textContent     = `$${formatNumber(localNet)}`;
};

// ========================================
// UTILIDADES
// ========================================

function formatNumber(num) {
    return new Intl.NumberFormat('es-CO').format(Math.round(num));
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
        year:  'numeric',
        month: 'short',
        day:   'numeric'
    });
}

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initProductSearch();

    // Totales de compra
    ['purchaseQuantity', 'purchaseUnitCost'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const qty  = parseFloat(document.getElementById('purchaseQuantity').value) || 0;
                const cost = parseFloat(document.getElementById('purchaseUnitCost').value) || 0;
                document.getElementById('purchaseTotal').textContent = `$${formatNumber(qty * cost)}`;
            });
        }
    });

    // Totales de venta
    ['saleQuantity', 'saleUnitPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateSaleTotal);
    });

    // ── SERVICIO TÉCNICO: cuando cambia el técnico, cargar su % de comisión ──
    const techSelect = document.getElementById('serviceTechnicianId');
    if (techSelect) {
        techSelect.addEventListener('change', () => {
            const selected = techSelect.options[techSelect.selectedIndex];
            const rate     = selected ? (parseFloat(selected.dataset.rate) || 0) : 0;

            const rateInput = document.getElementById('commissionRate');
            if (rateInput) {
                rateInput.value = rate;
                // Limpiar override manual al cambiar técnico
                const commInput = document.getElementById('technicianCommission');
                if (commInput) delete commInput.dataset.manualOverride;
            }

            updateServiceTotals();
        });
    }

    // Cuando cambia cualquier campo de costo → recalcular totales
    ['laborCost', 'commissionRate', 'partsCost', 'partsPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateServiceTotals);
    });

    // Si el usuario edita manualmente el monto de comisión → marcar override
    const commInput = document.getElementById('technicianCommission');
    if (commInput) {
        commInput.addEventListener('input', () => {
            commInput.dataset.manualOverride = 'true';
        });
    }

    // Agregar repuesto al servicio
    window.addServicePart = function() {
        const productSelect = document.getElementById('servicePartProduct');
        const quantityInput = document.getElementById('servicePartQuantity');
        if (!productSelect || !quantityInput) return;

        const productId = productSelect.value;
        const quantity  = parseInt(quantityInput.value) || 0;

        if (!productId || quantity <= 0) {
            utils.showToast('Seleccione un producto y cantidad válida', 'error');
            return;
        }

        const product = allProducts.find(p => p._id === productId);
        if (!product) return;

        if (quantity > product.stock) {
            utils.showToast('No hay suficiente stock disponible', 'error');
            return;
        }

        const partsContainer = document.getElementById('servicePartsList');
        if (!partsContainer) return;

        if (partsContainer.querySelector(`[data-product-id="${productId}"]`)) {
            utils.showToast('Este repuesto ya fue agregado', 'error');
            return;
        }

        const unitCost  = product.averageCost || 0;
        const partTotal = quantity * unitCost;

        partsContainer.insertAdjacentHTML('beforeend', `
            <div class="service-part-row" data-product-id="${productId}" data-product-name="${product.name}" data-unit-cost="${unitCost}">
                <span>${product.name}</span>
                <span class="part-quantity">${quantity}</span>
                <span>$${formatNumber(unitCost)}</span>
                <span>$${formatNumber(partTotal)}</span>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeServicePart('${productId}')">×</button>
            </div>
        `);

        productSelect.value = '';
        quantityInput.value = '1';
        updateServiceTotals();
    };

    window.removeServicePart = function(productId) {
        const partRow = document.querySelector(`.service-part-row[data-product-id="${productId}"]`);
        if (partRow) {
            partRow.remove();
            updateServiceTotals();
        }
    };

    // ── FORMULARIO CREAR SERVICIO ─────────────────────────────────────────
    const formTechnicalService = document.getElementById('formTechnicalService');
    if (formTechnicalService) {
        formTechnicalService.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Recopilar repuestos
            const partsUsed    = [];
            let   totalPartsCost = 0;

            document.querySelectorAll('.service-part-row').forEach(row => {
                const productId   = row.dataset.productId;
                const productName = row.dataset.productName;
                const quantity    = parseInt(row.querySelector('.part-quantity').textContent) || 0;
                const unitCost    = parseFloat(row.dataset.unitCost) || 0;

                if (productId && quantity > 0) {
                    partsUsed.push({ productId, productName, quantity, unitCost });
                    totalPartsCost += quantity * unitCost;
                }
            });

            const laborCost               = parseFloat(document.getElementById('laborCost')?.value || 0);
            const partsCost               = parseFloat(document.getElementById('partsCost')?.value  || 0);
            const partsPrice              = parseFloat(document.getElementById('partsPrice')?.value || 0);
            const technicianId            = document.getElementById('serviceTechnicianId')?.value || null;
            const technicianCommissionRate = parseFloat(document.getElementById('commissionRate')?.value || 0);
            const technicianCommission     = parseFloat(document.getElementById('technicianCommission')?.value || 0);

            const serviceData = {
                customer: {
                    name:  document.getElementById('customerName').value,
                    phone: document.getElementById('customerPhone').value
                },
                device: {
                    type:  document.getElementById('deviceType').value,
                    brand: document.getElementById('deviceBrand')?.value || '',
                    model: document.getElementById('deviceModel')?.value || ''
                },
                problemDescription:       document.getElementById('problemDescription').value,
                laborCost,
                partsCost,               // costo real del repuesto (lo pagó el negocio)
                partsPrice,              // precio cobrado al cliente por el repuesto
                partsUsed,
                technicianId:            technicianId || undefined,
                technicianCommissionRate,
                technicianCommission
            };

            try {
                const response = await api.createTechnicalService(serviceData);
                if (response && response.success) {
                    utils.showToast('Servicio registrado exitosamente ✅');
                    e.target.reset();

                    // Limpiar comisión override
                    const commInput = document.getElementById('technicianCommission');
                    if (commInput) delete commInput.dataset.manualOverride;

                    // Resetear totales
                    ['serviceTotal', 'serviceTechnicianEarnings', 'serviceLocalEarnings'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.textContent = '$0';
                    });

                    const partsContainer = document.getElementById('servicePartsList');
                    if (partsContainer) partsContainer.innerHTML = '';

                    if (typeof loadTechnicalServices === 'function') loadTechnicalServices();
                    if (typeof app !== 'undefined' && app.loadProducts) app.loadProducts();
                }
            } catch (error) {
                console.error('Error al registrar servicio:', error);
                utils.showToast(error.message || 'Error al registrar servicio', 'error');
            }
        });
    }

    // ── FORMULARIO EDITAR SERVICIO ────────────────────────────────────────
    const formUpdateService = document.getElementById('formUpdateService');
    if (formUpdateService) {
        formUpdateService.addEventListener('submit', async (e) => {
            e.preventDefault();

            const serviceId = document.getElementById('updateServiceId').value;
            const laborCost = parseFloat(document.getElementById('updateLaborCost').value || 0);
            const partsCost = parseFloat(document.getElementById('updatePartsCost').value || 0);
            const techId    = document.getElementById('updateServiceTechnicianId')?.value || null;
            const rate      = parseFloat(document.getElementById('updateCommissionRate')?.value || 0);
            const commision = parseFloat(document.getElementById('updateTechnicianCommission')?.value || 0);

            const updateData = {
                status:                   document.getElementById('updateStatus').value,
                laborCost,
                partsCost,
                technicianId:             techId || undefined,
                technicianCommissionRate: rate,
                technicianCommission:     commision
            };

            try {
                await api.updateTechnicalService(serviceId, updateData);
                utils.showToast('Servicio actualizado exitosamente');
                closeServiceModal();
                loadTechnicalServices();
            } catch (error) {
                utils.showToast(error.message || 'Error al actualizar', 'error');
            }
        });
    }

    // formUpdatePurchase ya está manejado en app.js — no duplicar

    // Modal de edición: cuando cambia técnico → actualizar rate y recalcular
    const updateTechSelect = document.getElementById('updateServiceTechnicianId');
    if (updateTechSelect) {
        updateTechSelect.addEventListener('change', () => {
            const selected = updateTechSelect.options[updateTechSelect.selectedIndex];
            const rate     = selected ? (parseFloat(selected.dataset.rate) || 0) : 0;
            const rateInput = document.getElementById('updateCommissionRate');
            if (rateInput) rateInput.value = rate;
            // Recalcular monto
            const labor     = parseFloat(document.getElementById('updateLaborCost')?.value || 0);
            const commInput = document.getElementById('updateTechnicianCommission');
            if (commInput)  commInput.value = parseFloat(((labor * rate) / 100).toFixed(2));
        });
    }

    // Modal edición: si cambia mano de obra o rate → recalcular comisión
    ['updateLaborCost', 'updateCommissionRate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const labor = parseFloat(document.getElementById('updateLaborCost')?.value || 0);
                const rate  = parseFloat(document.getElementById('updateCommissionRate')?.value || 0);
                const commInput = document.getElementById('updateTechnicianCommission');
                if (commInput) commInput.value = parseFloat(((labor * rate) / 100).toFixed(2));
            });
        }
    });

    // Filtros de servicio técnico
    const filterStatus = document.getElementById('filterServiceStatus');
    if (filterStatus) {
        filterStatus.addEventListener('change', () => {
            loadTechnicalServices({ status: filterStatus.value });
        });
    }

    // Cargar al abrir vistas
    document.querySelectorAll('[data-view="technical"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await loadEmployeesForService();
            await loadProductsForSearch();
            loadTechnicalServices();

            // Llenar select de repuestos
            const partSelect = document.getElementById('servicePartProduct');
            if (partSelect && allProducts.length > 0) {
                partSelect.innerHTML = '<option value="">Seleccionar repuesto...</option>' +
                    allProducts
                        .filter(p => p.stock > 0 && p.isActive !== false)
                        .map(p => `<option value="${p._id}">${p.name} (Stock: ${p.stock}) - $${formatNumber(p.averageCost || 0)}</option>`)
                        .join('');
            }
        });
    });

    document.querySelectorAll('[data-view="purchases"]').forEach(btn => {
        btn.addEventListener('click', () => loadPurchasesEnhanced());
    });

    document.querySelectorAll('[data-view="sales"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await loadProductsForSearch();
        });
    });
});

// ========================================
// EXPORTAR FUNCIONES GLOBALES
// ========================================
window.selectProductFromSearch  = selectProductFromSearch;
window.loadProductsForSearch    = loadProductsForSearch;
window.loadEmployeesForService  = loadEmployeesForService;
window.loadTechnicalServices    = loadTechnicalServices;
window.editService              = editService;
window.deleteService            = deleteService;
window.deliverService           = deliverService;
window.closeServiceModal        = closeServiceModal;
window.editPurchase             = editPurchase;
window.deletePurchase           = deletePurchase;
window.closePurchaseModal       = closePurchaseModal;
window.loadPurchasesEnhanced    = loadPurchasesEnhanced;