// Estado global de la aplicación v2
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

const salesScannerState = {
    buffer: '',
    startedAt: 0,
    lastKeyAt: 0,
    processing: false
};

let quickSaleProduct = null;
const VIEW_STORAGE_KEY = 'vendlyCurrentView';
const PRINTER_CONFIG_STORAGE_KEY = 'vendlyPrinterConfig';

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

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function focusSaleBarcodeInput(delayMs = 0) {
    const focusAction = () => {
        if (AppState.currentView !== 'sales') return;
        const input = document.getElementById('saleBarcodeInput');
        if (!input) return;

        const active = document.activeElement;
        const isTypingElsewhere = active
            && active !== document.body
            && active !== input
            && (
                active.tagName === 'INPUT'
                || active.tagName === 'TEXTAREA'
                || active.tagName === 'SELECT'
                || active.isContentEditable
            );

        if (!isTypingElsewhere) {
            input.focus();
        }
    };

    if (delayMs > 0) {
        setTimeout(focusAction, delayMs);
    } else {
        focusAction();
    }
}

function resetGlobalSalesScannerBuffer() {
    salesScannerState.buffer = '';
    salesScannerState.startedAt = 0;
    salesScannerState.lastKeyAt = 0;
}

function shouldCaptureGlobalScanner(event) {
    if (AppState.currentView !== 'sales') return false;
    if (event.ctrlKey || event.altKey || event.metaKey) return false;
    if (salesScannerState.processing) return false;

    const active = document.activeElement;
    if (!active || active === document.body) return true;
    if (active.id === 'saleBarcodeInput') return false;

    const isEditable = (
        active.tagName === 'INPUT'
        || active.tagName === 'TEXTAREA'
        || active.tagName === 'SELECT'
        || active.isContentEditable
    );

    return !isEditable;
}

async function triggerGlobalSalesScannerLookup() {
    const input = document.getElementById('saleBarcodeInput');
    const code = salesScannerState.buffer.trim();
    resetGlobalSalesScannerBuffer();

    if (!input || code.length < 4) return;

    salesScannerState.processing = true;
    try {
        input.value = code;
        await lookupSaleProductByCode();
    } finally {
        salesScannerState.processing = false;
        focusSaleBarcodeInput(40);
    }
}

function handleGlobalSalesScanner(event) {
    if (!shouldCaptureGlobalScanner(event)) {
        resetGlobalSalesScannerBuffer();
        return;
    }

    const key = event.key;
    const now = Date.now();
    const gap = now - salesScannerState.lastKeyAt;

    if (gap > 120) {
        resetGlobalSalesScannerBuffer();
    }

    if (key === 'Enter') {
        if (salesScannerState.buffer.length >= 4) {
            event.preventDefault();
            triggerGlobalSalesScannerLookup().catch((error) => {
                console.error('Error processing global sales scan:', error);
            });
        } else {
            resetGlobalSalesScannerBuffer();
        }
        return;
    }

    if (key.length !== 1) return;
    if (!/[A-Za-z0-9\-.\ $/+%]/.test(key)) return;

    if (!salesScannerState.startedAt) {
        salesScannerState.startedAt = now;
    }

    salesScannerState.lastKeyAt = now;
    salesScannerState.buffer += key;
    event.preventDefault();
}

function handleQuickSalePriceEdit(event) {
    if (AppState.currentView !== 'sales') return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const active = document.activeElement;
    const submitButton = document.querySelector('#formSale button[type="submit"]');
    if (!active || active !== submitButton) return;

    if (!/[0-9.]/.test(event.key)) return;

    const priceField = document.getElementById('saleUnitPrice');
    if (!priceField) return;

    event.preventDefault();
    priceField.focus();
    priceField.value = event.key === '.' ? '0.' : event.key;

    const qty = parseFloat(document.getElementById('saleQuantity')?.value) || 0;
    const price = parseFloat(priceField.value) || 0;
    const totalField = document.getElementById('saleTotal');
    if (totalField) {
        totalField.textContent = utils.formatMoney(qty * price);
    }
}

function getPaymentMethodLabel(method) {
    const labels = {
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia',
        other: 'Otro'
    };

    return labels[method] || method || 'No definido';
}

function buildSaleReceiptHtml(sale) {
    const total = Number(sale.totalSale ?? ((sale.quantity || 0) * (sale.unitPrice || 0))) || 0;
    const businessName = escapeHtml(AppState.user?.businessName || 'Vendly');
    const productName = escapeHtml(sale.productName || sale.productId?.name || 'Producto');
    const customer = sale.customer ? escapeHtml(sale.customer) : 'Mostrador';
    const employeeName = sale.employeeId?.name || sale.employeeName || '';
    const serialNumbers = Array.isArray(sale.serialNumbers) ? sale.serialNumbers.filter(Boolean) : [];
    const paymentLabel = getPaymentMethodLabel(sale.paymentMethod);
    const saleCode = escapeHtml(String(sale._id || '').slice(-8).toUpperCase());

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Recibo de Venta</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 8px; color: #111; background: #fff; }
                .ticket { width: 80mm; margin: 0 auto; }
                .center { text-align: center; }
                .title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
                .muted { color: #555; font-size: 12px; }
                .divider { border-top: 1px dashed #222; margin: 10px 0; }
                .row { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; margin: 4px 0; }
                .product { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
                .total { font-size: 18px; font-weight: 700; }
                .serials { font-size: 12px; margin-top: 6px; word-break: break-word; }
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { padding: 4mm; }
                }
            </style>
        </head>
        <body>
            <div class="ticket">
                <div class="center">
                    <div class="title">${businessName}</div>
                    <div class="muted">Recibo de venta</div>
                    <div class="muted">${escapeHtml(utils.formatDate(sale.saleDate || new Date()))}</div>
                    <div class="muted">Ref: ${saleCode || 'N/A'}</div>
                </div>
                <div class="divider"></div>
                <div class="product">${productName}</div>
                <div class="row"><span>Cantidad</span><strong>${escapeHtml(String(sale.quantity || 0))}</strong></div>
                <div class="row"><span>Precio unitario</span><strong>${escapeHtml(utils.formatMoney(sale.unitPrice || 0))}</strong></div>
                <div class="row"><span>Pago</span><strong>${escapeHtml(paymentLabel)}</strong></div>
                <div class="row"><span>Cliente</span><strong>${customer}</strong></div>
                ${employeeName ? `<div class="row"><span>Vendedor</span><strong>${escapeHtml(employeeName)}</strong></div>` : ''}
                ${serialNumbers.length ? `<div class="serials"><strong>IMEI / Serial:</strong><br>${escapeHtml(serialNumbers.join(', '))}</div>` : ''}
                <div class="divider"></div>
                <div class="row total"><span>Total</span><span>${escapeHtml(utils.formatMoney(total))}</span></div>
                <div class="divider"></div>
                <div class="center muted">Gracias por tu compra</div>
            </div>
            <script>
                window.onload = function () {
                    setTimeout(function () { window.print(); }, 180);
                };
            <\/script>
        </body>
        </html>
    `;
}

function printSaleReceipt(sale) {
    if (!sale) {
        throw new Error('No se encontro la venta para imprimir');
    }

    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) {
        throw new Error('El navegador bloqueo la ventana de impresion');
    }

    printWindow.document.open();
    printWindow.document.write(buildSaleReceiptHtml(sale));
    printWindow.document.close();
}

function normalizeCodeText(value) {
    if (window.BarcodeTools?.normalizeCode) {
        return window.BarcodeTools.normalizeCode(value);
    }

    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9\-\.\ $\/\+%]/g, '');
}

function normalizeSkuText(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9\-_./]/g, '');
}

function suggestBarcodeFormat(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (/^\d{13}$/.test(digits)) return 'ean_13';
    if (/^\d{12}$/.test(digits)) return 'ean_13';
    if (/^\d{8}$/.test(digits)) return 'ean_8';
    return '';
}

function getProductCodeSummary(product) {
    if (!product) return '';

    const chips = [];
    if (product.sku) {
        chips.push(`<span class="inventory-code-chip">SKU: ${escapeHtml(product.sku)}</span>`);
    }
    if (product.barcode) {
        chips.push(`<span class="inventory-code-chip">Código: ${escapeHtml(product.barcode)}</span>`);
    }

    chips.push(`<button type="button" class="inventory-code-chip inventory-code-action" onclick="openAssignBarcodeModal('${product._id}')" title="Registrar código que ya trae el producto">Registrar código</button>`);
    chips.push(`<button type="button" class="inventory-code-chip inventory-code-action" onclick="regenerateProductBarcode('${product._id}')" title="Cambiar solo este producto a código Vendly">Cambiar código</button>`);

    return `<div class="inventory-code-meta">${chips.join('')}</div>`;
}

function playSaleScanTone(type = 'success') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        const frequency = type === 'success' ? 880 : 240;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.18);
        oscillator.onended = () => context.close().catch(() => {});
    } catch (error) {
        console.error('No se pudo reproducir el tono del escáner:', error);
    }
}

function clearSaleScanFeedback() {
    const box = document.getElementById('saleScanFeedback');
    if (!box) return;

    box.style.display = 'none';
    box.classList.remove('is-success', 'is-error');
    const title = document.getElementById('saleScanFeedbackTitle');
    const message = document.getElementById('saleScanFeedbackMessage');
    if (title) title.textContent = '';
    if (message) message.textContent = '';
}

function showSaleScanFeedback(type, titleText, messageText) {
    const box = document.getElementById('saleScanFeedback');
    if (!box) return;

    box.style.display = 'block';
    box.classList.remove('is-success', 'is-error');
    box.classList.add(type === 'error' ? 'is-error' : 'is-success');

    const title = document.getElementById('saleScanFeedbackTitle');
    const message = document.getElementById('saleScanFeedbackMessage');
    if (title) title.textContent = titleText || '';
    if (message) message.textContent = messageText || '';
}

function getSavedAppView() {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    return document.querySelector(`.nav-btn[data-view="${savedView}"]`) ? savedView : 'dashboard';
}

function getDefaultPrinterConfig() {
    return {
        printerName: '',
        dpi: 203,
        pageWidthMm: 72,
        pageHeightMm: 25,
        columns: 2,
        maxLabelsPerJob: 2,
        labelWidthMm: 35,
        labelHeightMm: 25,
        horizontalGapMm: 2,
        verticalGapMm: 0,
        pageXOffsetMm: 0,
        pageYOffsetMm: 0,
        barcodeWidthMm: 33.4,
        barcodeHeightMm: 15.2
    };
}

function getLocalPrinterConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(PRINTER_CONFIG_STORAGE_KEY) || '{}');
        return {
            ...getDefaultPrinterConfig(),
            ...(saved && typeof saved === 'object' ? saved : {})
        };
    } catch (error) {
        return getDefaultPrinterConfig();
    }
}

function saveLocalPrinterConfig(config = {}) {
    const nextConfig = {
        ...getLocalPrinterConfig(),
        ...config
    };
    localStorage.setItem(PRINTER_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
    return nextConfig;
}

async function activateAppView(view, options = {}) {
    const { persist = true } = options;
    const navButton = document.querySelector(`.nav-btn[data-view="${view}"]`);
    const viewElement = document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`);
    if (!navButton || !viewElement) return;

    AppState.currentView = view;
    if (persist) {
        localStorage.setItem(VIEW_STORAGE_KEY, view);
    }

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    navButton.classList.add('active');

    document.querySelectorAll('.view').forEach(item => item.classList.remove('active'));
    viewElement.classList.add('active');

    switch (view) {
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
            await app.loadEmployeeSelects();
            break;
        case 'inventory':
            if (typeof loadInventoryProducts === 'function') {
                await loadInventoryProducts();
            } else {
                await app.loadInventory();
            }
            break;
        case 'compatibility':
            if (typeof loadCompatibilityView === 'function') {
                await loadCompatibilityView();
            }
            break;
        case 'compatibilityApi':
            if (typeof loadCompatibilityApiView === 'function') {
                await loadCompatibilityApiView();
            }
            break;
        case 'technical':
            if (typeof loadTechnicalServices === 'function') {
                await loadTechnicalServices();
            }
            break;
        case 'expenses':
            if (typeof loadExpensesView === 'function') {
                await loadExpensesView();
            }
            break;
        case 'printer':
            await loadPrinterSettingsView();
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

    if (view === 'sales') {
        focusSaleBarcodeInput(120);
    }
}

function getCurrentSaleEmployeeName() {
    const option = document.getElementById('saleEmployee')?.selectedOptions?.[0];
    return option?.value ? option.textContent : '';
}

function resetSaleEntryFields() {
    const form = document.getElementById('formSale');
    const currentEmployee = document.getElementById('saleEmployee')?.value || '';
    const currentPaymentMethod = document.getElementById('salePaymentMethod')?.value || 'cash';
    const shouldPrintReceipt = document.getElementById('salePrintReceipt')?.checked ?? true;

    if (form) form.reset();

    const employeeField = document.getElementById('saleEmployee');
    const paymentField = document.getElementById('salePaymentMethod');
    const receiptField = document.getElementById('salePrintReceipt');
    if (employeeField) employeeField.value = currentEmployee;
    if (paymentField) paymentField.value = currentPaymentMethod;
    if (receiptField) receiptField.checked = shouldPrintReceipt;

    const fieldsToClear = ['selectedProductName', 'availableStock', 'suggestedPrice', 'saleBarcodeInput'];
    fieldsToClear.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });

    const totalField = document.getElementById('saleTotal');
    if (totalField) totalField.textContent = '$0';

    clearSaleScanFeedback();
    hideQuickSalePanel();

    if (typeof clearSaleSerializedUnits === 'function') {
        clearSaleSerializedUnits();
    }

    const accessoryBox = document.getElementById('saleAccessorySuggestions');
    if (accessoryBox) accessoryBox.style.display = 'none';
}

async function registerSaleAndRefresh(saleData, options = {}) {
    const {
        shouldPrintReceipt = false,
        employeeName = ''
    } = options;

    const response = await api.createSale(saleData);
    if (!response.success) return response;

    const soldProductId = String(saleData.productId || response.sale?.productId || '');
    const soldQuantity = Number(saleData.quantity || response.sale?.quantity || 0);
    const productIndex = AppState.products.findIndex(product => String(product._id) === soldProductId);
    if (productIndex >= 0) {
        AppState.products[productIndex].stock = Math.max(0, (AppState.products[productIndex].stock || 0) - soldQuantity);
        AppState.products[productIndex].totalSold = (AppState.products[productIndex].totalSold || 0) + (response.sale?.totalSale || 0);
    }

    if (Array.isArray(AppState.sales) && response.sale) {
        AppState.sales.unshift(response.sale);
    }

    utils.showToast('Venta registrada exitosamente');

    resetSaleEntryFields();
    focusSaleBarcodeInput(120);

    if (shouldPrintReceipt) {
        const receiptSale = {
            ...response.sale,
            employeeName,
            paymentMethod: saleData.paymentMethod,
            customer: saleData.customer,
            totalSale: response.sale?.totalSale ?? (saleData.quantity * saleData.unitPrice)
        };

        setTimeout(() => {
            try {
                printSaleReceipt(receiptSale);
            } catch (printError) {
                console.error('No se pudo imprimir el recibo:', printError);
                utils.showToast('Venta registrada, pero no se pudo abrir el recibo', 'warning');
            }
        }, 20);
    }

    Promise.allSettled([
        app.loadSales(),
        app.loadProducts(),
        app.loadDashboard()
    ]).catch(error => console.error('Error refrescando venta en segundo plano:', error));

    return response;
}

async function printProductWithBridge(product, quantity) {
    const payload = {
        product: {
            name: product.name,
            barcode: product.barcode,
            barcodeFormat: product.barcodeFormat || '',
            sku: product.sku || '',
            price: product.suggestedPrice || ''
        },
        quantity
    };

    await api.printBarcodeLabelViaBridge(payload);
}

function ensurePrinterSettingsView() {
    const nav = document.querySelector('.app-nav');
    if (nav && !document.querySelector('.nav-btn[data-view="printer"]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nav-btn';
        button.dataset.view = 'printer';
        button.textContent = 'Impresora';
        const reportsButton = document.querySelector('.nav-btn[data-view="reports"]');
        nav.insertBefore(button, reportsButton || null);
    }

    const content = document.querySelector('.app-content');
    if (!content || document.getElementById('viewPrinter')) return;

    const view = document.createElement('div');
    view.id = 'viewPrinter';
    view.className = 'view';
    view.innerHTML = `
        <h2>Configuracion de Impresora</h2>
        <div class="card printer-settings-card">
            <h3>Etiquetas de codigo de barras</h3>
            <p class="printer-help">Puedes imprimir desde navegador sin instalar nada. Para etiquetas termicas exactas y calibracion guardada por computador, usa Vendly Print Helper.</p>
            <div id="printerStatus" class="sale-scan-feedback" style="display:none;"></div>

            <div class="form-row">
                <div class="form-group">
                    <label>Nombre de impresora</label>
                    <input type="text" id="printerNameSetting" placeholder="Vacio = impresora predeterminada">
                </div>
                <div class="form-group">
                    <label>DPI</label>
                    <input type="number" id="printerDpiSetting" min="100" step="1">
                </div>
                <div class="form-group">
                    <label>Columnas</label>
                    <input type="number" id="printerColumnsSetting" min="1" step="1">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Ancho papel mm</label>
                    <input type="number" id="printerPageWidthSetting" step="0.1">
                </div>
                <div class="form-group">
                    <label>Alto etiqueta mm</label>
                    <input type="number" id="printerLabelHeightSetting" step="0.1">
                </div>
                <div class="form-group">
                    <label>Ancho etiqueta mm</label>
                    <input type="number" id="printerLabelWidthSetting" step="0.1">
                </div>
            </div>

            <div class="printer-calibration-grid">
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('pageXOffsetMm', -0.5)">Mover izquierda</button>
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('pageXOffsetMm', 0.5)">Mover derecha</button>
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('pageYOffsetMm', -0.5)">Subir</button>
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('pageYOffsetMm', 0.5)">Bajar</button>
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('barcodeWidthMm', 1)">Agrandar codigo</button>
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('barcodeWidthMm', -1)">Reducir codigo</button>
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('barcodeHeightMm', 1)">Mas alto</button>
                <button type="button" class="btn btn-secondary" onclick="adjustPrinterSetting('barcodeHeightMm', -1)">Mas bajo</button>
            </div>

            <div class="printer-values" id="printerCalibrationValues"></div>

            <div class="form-actions">
                <button type="button" class="btn" onclick="testPrinterConnection()">Probar conexion</button>
                <button type="button" class="btn btn-secondary" onclick="savePrinterSettings()">Guardar configuracion</button>
                <button type="button" class="btn btn-primary" onclick="printPrinterTestLabel()">Imprimir prueba</button>
                <button type="button" class="btn btn-secondary" onclick="printBrowserTestLabel()">Prueba navegador</button>
            </div>
        </div>
    `;
    content.appendChild(view);
}

function getPrinterSettingsFromForm() {
    return {
        ...(window.currentPrinterConfig || {}),
        printerName: document.getElementById('printerNameSetting')?.value || '',
        dpi: Number(document.getElementById('printerDpiSetting')?.value) || 203,
        columns: Number(document.getElementById('printerColumnsSetting')?.value) || 2,
        pageWidthMm: Number(document.getElementById('printerPageWidthSetting')?.value) || 72,
        labelHeightMm: Number(document.getElementById('printerLabelHeightSetting')?.value) || 25,
        labelWidthMm: Number(document.getElementById('printerLabelWidthSetting')?.value) || 35
    };
}

function setPrinterStatus(message, type = 'success') {
    const box = document.getElementById('printerStatus');
    if (!box) return;
    box.style.display = 'block';
    box.classList.remove('is-success', 'is-error');
    box.classList.add(type === 'error' ? 'is-error' : 'is-success');
    box.textContent = message;
}

function renderPrinterConfig(config = {}) {
    window.currentPrinterConfig = {
        ...getDefaultPrinterConfig(),
        ...(window.currentPrinterConfig || {}),
        ...config
    };

    const assignValue = (id, value) => {
        const input = document.getElementById(id);
        if (input) input.value = value ?? '';
    };

    assignValue('printerNameSetting', config.printerName || '');
    assignValue('printerDpiSetting', config.dpi || 203);
    assignValue('printerColumnsSetting', config.columns || 2);
    assignValue('printerPageWidthSetting', config.pageWidthMm || 72);
    assignValue('printerLabelHeightSetting', config.labelHeightMm || 25);
    assignValue('printerLabelWidthSetting', config.labelWidthMm || 35);

    const values = document.getElementById('printerCalibrationValues');
    if (values) {
        values.innerHTML = `
            <span>Izq/Der: <strong>${config.pageXOffsetMm ?? 0}mm</strong></span>
            <span>Arriba/Abajo: <strong>${config.pageYOffsetMm ?? 0}mm</strong></span>
            <span>Ancho codigo: <strong>${config.barcodeWidthMm ?? 0}mm</strong></span>
            <span>Alto codigo: <strong>${config.barcodeHeightMm ?? 0}mm</strong></span>
        `;
    }
}

async function loadPrinterSettingsView() {
    ensurePrinterSettingsView();
    renderPrinterConfig(getLocalPrinterConfig());
    try {
        const response = await api.getPrintBridgeConfig();
        renderPrinterConfig(response.config || {});
        setPrinterStatus('Helper conectado. Puedes calibrar e imprimir prueba.');
    } catch (error) {
        setPrinterStatus('Modo navegador disponible. Para calibracion perfecta, abre Vendly Print Helper en este computador.', 'error');
    }
}

window.adjustPrinterSetting = function(key, delta) {
    const config = {
        ...(window.currentPrinterConfig || getPrinterSettingsFromForm())
    };
    config[key] = Number((Number(config[key] || 0) + delta).toFixed(2));
    renderPrinterConfig(config);
};

window.savePrinterSettings = async function() {
    const config = {
        ...(window.currentPrinterConfig || {}),
        ...getPrinterSettingsFromForm()
    };
    const localConfig = saveLocalPrinterConfig(config);
    renderPrinterConfig(localConfig);

    try {
        const response = await api.savePrintBridgeConfig(config);
        const savedConfig = saveLocalPrinterConfig(response.config || config);
        renderPrinterConfig(savedConfig);
        setPrinterStatus('Configuracion guardada en helper y navegador.');
        utils.showToast('Configuracion de impresora guardada');
        return { mode: 'helper', config: savedConfig };
    } catch (error) {
        setPrinterStatus('Helper no conectado. Configuracion guardada para impresion por navegador en este computador.', 'error');
        utils.showToast('Configuracion guardada en navegador');
        return { mode: 'browser', config: localConfig };
    }
};

window.testPrinterConnection = async function() {
    try {
        await loadPrinterSettingsView();
        utils.showToast('Helper local conectado');
    } catch (error) {
        utils.showToast(error.message || 'Helper local no disponible', 'error');
    }
};

window.printPrinterTestLabel = async function() {
    try {
        const result = await savePrinterSettings();
        if (result?.mode === 'browser') {
            printBrowserTestLabel();
            return;
        }
        await api.printTestBarcodeLabel({ quantity: Number(window.currentPrinterConfig?.columns || 2) });
        setPrinterStatus('Etiqueta de prueba enviada. Si sale corrida, ajusta con los botones y vuelve a imprimir prueba.');
    } catch (error) {
        setPrinterStatus('No se encontro el helper. Abriendo prueba desde navegador.', 'error');
        printBrowserTestLabel();
    }
};

window.printBrowserTestLabel = function() {
    if (!window.BarcodeTools?.printLabels) {
        setPrinterStatus('No se pudo abrir la impresion del navegador.', 'error');
        return;
    }

    const config = getPrinterSettingsFromForm();
    const layout = {
        columns: Number(config.columns || 2),
        labelWidthMm: Number(config.labelWidthMm || 35),
        labelHeightMm: Number(config.labelHeightMm || 25),
        gapMm: Number(config.horizontalGapMm || 2),
        rowGapMm: Number(config.verticalGapMm || 0),
        pagePaddingMm: 0
    };

    BarcodeTools.printLabels({
        name: 'Prueba Vendly',
        barcode: '2001234567890',
        barcodeFormat: 'ean_13',
        sku: 'TEST'
    }, layout.columns, null, layout);

    setPrinterStatus('Prueba abierta desde navegador. Deja copias en 1; la cantidad se maneja desde Vendly. Usa escala 100%, margenes ninguno y papel del tamano de la etiqueta.');
};

function prepareScannedSale(product) {
    const quantityField = document.getElementById('saleQuantity');
    const priceField = document.getElementById('saleUnitPrice');
    const totalField = document.getElementById('saleTotal');

    if (quantityField) {
        quantityField.value = 1;
    }

    if (priceField && (!priceField.value || Number(priceField.value) <= 0) && product?.suggestedPrice > 0) {
        priceField.value = product.suggestedPrice;
    }

    const quantity = parseFloat(quantityField?.value) || 0;
    const price = parseFloat(priceField?.value) || 0;
    if (totalField) {
        totalField.textContent = utils.formatMoney(quantity * price);
    }

    showSaleScanFeedback(
        'success',
        `Listo para vender: ${product?.name || 'Producto'}`,
        `Escribe el precio y presiona Enter para registrar la venta.`
    );
    playSaleScanTone('success');

    showQuickSalePanel(product);
}

function updateQuickSaleTotal() {
    const quantity = parseFloat(document.getElementById('quickSaleQuantity')?.value) || 0;
    const price = parseFloat(document.getElementById('quickSalePrice')?.value) || 0;
    const unitCost = Number(quickSaleProduct?.averageCost || 0);
    const total = document.getElementById('quickSaleTotal');
    const profit = document.getElementById('quickSaleProfit');
    if (total) total.textContent = `Total: ${utils.formatMoney(quantity * price)}`;
    if (profit) {
        const estimatedProfit = (price - unitCost) * quantity;
        profit.textContent = `Ganancia estimada: ${utils.formatMoney(estimatedProfit)}`;
        profit.classList.toggle('quick-sale-loss', estimatedProfit < 0);
    }
}

function normalizeQuickSaleQuantity() {
    const quantityField = document.getElementById('quickSaleQuantity');
    if (!quantityField) return 1;

    const stock = Math.max(0, Number(quickSaleProduct?.stock ?? 0));
    const maxQuantity = stock > 0 ? stock : 1;
    const nextQuantity = Math.min(maxQuantity, Math.max(1, parseInt(quantityField.value, 10) || 1));
    quantityField.value = nextQuantity;
    updateQuickSaleTotal();
    return nextQuantity;
}

window.changeQuickSaleQuantity = function(delta = 0) {
    const quantityField = document.getElementById('quickSaleQuantity');
    if (!quantityField) return;

    const current = parseInt(quantityField.value, 10) || 1;
    quantityField.value = current + Number(delta || 0);
    normalizeQuickSaleQuantity();
    quantityField.focus();
    quantityField.select();
};

function showQuickSalePanel(product) {
    quickSaleProduct = product || null;
    const panel = document.getElementById('quickSalePanel');
    if (!panel || !quickSaleProduct) return;

    const name = document.getElementById('quickSaleProductName');
    const meta = document.getElementById('quickSaleProductMeta');
    const cost = document.getElementById('quickSaleCost');
    const price = document.getElementById('quickSalePrice');
    const quantity = document.getElementById('quickSaleQuantity');
    const payment = document.getElementById('quickSalePaymentMethod');

    if (name) name.textContent = quickSaleProduct.name || 'Producto';
    if (meta) {
        const suggested = quickSaleProduct.suggestedPrice > 0
            ? ` | Sugerido: ${utils.formatMoney(quickSaleProduct.suggestedPrice)}`
            : '';
        meta.textContent = `Stock disponible: ${quickSaleProduct.stock ?? 0}${suggested}`;
    }
    if (cost) {
        cost.textContent = `Costo promedio / compra: ${utils.formatMoney(quickSaleProduct.averageCost || 0)}`;
    }

    if (quantity) quantity.value = 1;
    if (price) {
        price.value = quickSaleProduct.suggestedPrice > 0 ? quickSaleProduct.suggestedPrice : '';
    }
    if (payment) {
        payment.value = document.getElementById('salePaymentMethod')?.value || 'cash';
    }

    panel.style.display = 'block';
    updateQuickSaleTotal();

    setTimeout(() => {
        if (!price) return;
        price.focus();
        price.select();
    }, 60);
}

function hideQuickSalePanel() {
    quickSaleProduct = null;
    const panel = document.getElementById('quickSalePanel');
    if (panel) panel.style.display = 'none';
}

window.cancelQuickScannedSale = function() {
    hideQuickSalePanel();
    clearSaleScanFeedback();
    focusSaleBarcodeInput(60);
};

window.confirmQuickScannedSale = async function() {
    if (!quickSaleProduct?._id) {
        utils.showToast('Escanea un producto primero', 'warning');
        focusSaleBarcodeInput(60);
        return;
    }

    const quantity = parseInt(document.getElementById('quickSaleQuantity')?.value, 10) || 1;
    const unitPrice = parseFloat(document.getElementById('quickSalePrice')?.value) || 0;

    if (quantity < 1) {
        utils.showToast('La cantidad debe ser minimo 1', 'warning');
        return;
    }

    if (unitPrice <= 0) {
        utils.showToast('Escribe en cuanto se vendio', 'warning');
        document.getElementById('quickSalePrice')?.focus();
        return;
    }

    if ((quickSaleProduct.stock ?? 0) < quantity) {
        utils.showToast('No hay stock suficiente para esa venta', 'error');
        return;
    }

    const saleData = {
        productId: quickSaleProduct._id,
        quantity,
        unitPrice,
        employeeId: document.getElementById('saleEmployee')?.value || '',
        customer: document.getElementById('saleCustomer')?.value || '',
        paymentMethod: document.getElementById('quickSalePaymentMethod')?.value || 'cash',
        unitIds: typeof getSelectedSaleUnitIds === 'function' ? getSelectedSaleUnitIds() : []
    };

    const salePaymentField = document.getElementById('salePaymentMethod');
    if (salePaymentField) salePaymentField.value = saleData.paymentMethod;

    try {
        await registerSaleAndRefresh(saleData, {
            shouldPrintReceipt: document.getElementById('salePrintReceipt')?.checked,
            employeeName: getCurrentSaleEmployeeName()
        });
    } catch (error) {
        utils.showToast(error.message || 'Error al registrar venta', 'error');
        document.getElementById('quickSalePrice')?.focus();
    }
};

async function applySaleProductSelection(product, options = {}) {
    if (!product?._id) return;

    const {
        focusQuantity = false,
        forceSuggestedPrice = false,
        loadDetails = true
    } = options;

    const productIdField = document.getElementById('saleProductId');
    const productNameField = document.getElementById('selectedProductName');
    const stockField = document.getElementById('availableStock');
    const suggestedPriceField = document.getElementById('suggestedPrice');
    const salePriceField = document.getElementById('saleUnitPrice');
    const quantityField = document.getElementById('saleQuantity');
    const totalField = document.getElementById('saleTotal');

    if (productIdField) productIdField.value = product._id;
    if (productNameField) productNameField.value = product.name || '';
    if (stockField) stockField.value = product.stock ?? 0;
    if (suggestedPriceField) suggestedPriceField.value = utils.formatMoney(product.suggestedPrice || 0);

    if (salePriceField && product.suggestedPrice > 0) {
        const currentPrice = parseFloat(salePriceField.value) || 0;
        if (forceSuggestedPrice || currentPrice <= 0) {
            salePriceField.value = product.suggestedPrice;
        }
    }

    const quantity = parseFloat(quantityField?.value) || 0;
    const price = parseFloat(salePriceField?.value) || 0;
    if (totalField) {
        totalField.textContent = utils.formatMoney(quantity * price);
    }

    if (loadDetails && typeof window.updateSaleAccessorySuggestions === 'function') {
        window.updateSaleAccessorySuggestions(product);
    }

    if (loadDetails && typeof window.loadSaleSerializedUnits === 'function') {
        await window.loadSaleSerializedUnits(product);
    }

    if (focusQuantity && quantityField) {
        quantityField.focus();
    }
}

window.applySaleProductSelection = applySaleProductSelection;

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
            activateAppView(getSavedAppView(), { persist: false }).catch(() => app.loadDashboard());
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
            <div class="stat-card">
                <div class="stat-label">Venta Diaria</div>
                <div class="stat-value success">${utils.formatMoney(stats.sales?.today?.total || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ganancia Neta Este Mes</div>
                <div class="stat-value success">${utils.formatMoney(stats.sales.thisMonth.netProfit || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Gastos Este Mes</div>
                <div class="stat-value warning">${utils.formatMoney(stats.expenses?.thisMonth?.total || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Inversión Mensual</div>
                <div class="stat-value">${utils.formatMoney(stats.inventory?.monthlyInvestment ?? stats.purchases?.thisMonth?.total ?? 0)}</div>
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

    if (!saleProductSelect || saleProductSelect.tagName !== 'SELECT') {
        return;
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
                AppState.sales = response.sales || [];
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
                        <th>Acciones</th>
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
                            <td><button class="btn btn-sm" onclick="printSaleReceiptById('${s._id}')" title="Imprimir recibo">🧾</button></td>
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
                                    ${getProductCodeSummary(p)}
                                </td>
                                <td>${p.stock}</td>
                                <td>${utils.formatMoney(p.averageCost)}</td>
                                <td style="color: var(--primary);">${utils.formatMoney(stockValue)}</td>
                                <td><span class="badge badge-${status}">${statusText}</span></td>
                                <td class="action-buttons">
                                    <button class="btn btn-sm" onclick="viewProductHistory('${p._id}')" title="Ver Historial">👁️</button>
                                    <button class="btn btn-sm" onclick="printProductBarcode('${p._id}')" title="Imprimir etiqueta">🏷️</button>
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
            const selectedPeriod = document.getElementById('reportPeriod')?.value || 'monthly';
            await loadReport(selectedPeriod);
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
    ensurePrinterSettingsView();

    const saleForm = document.getElementById('formSale');
    saleForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        const saleData = {
            productId: document.getElementById('saleProductId').value,
            quantity: parseInt(document.getElementById('saleQuantity').value, 10),
            unitPrice: parseFloat(document.getElementById('saleUnitPrice').value),
            employeeId: document.getElementById('saleEmployee').value,
            customer: document.getElementById('saleCustomer').value,
            paymentMethod: document.getElementById('salePaymentMethod').value,
            unitIds: typeof getSelectedSaleUnitIds === 'function' ? getSelectedSaleUnitIds() : []
        };

        try {
            await registerSaleAndRefresh(saleData, {
                shouldPrintReceipt: document.getElementById('salePrintReceipt')?.checked,
                employeeName: getCurrentSaleEmployeeName()
            });
        } catch (error) {
            utils.showToast(error.message || 'Error al registrar venta', 'error');
        }
    }, true);
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

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            await activateAppView(btn.dataset.view);
        }, true);
    });

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const view = btn.dataset.view;
            AppState.currentView = view;
            
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

                case 'compatibility':
                    if (typeof loadCompatibilityView === 'function') {
                        await loadCompatibilityView();
                    }
                    break;

                case 'compatibilityApi':
                    if (typeof loadCompatibilityApiView === 'function') {
                        await loadCompatibilityApiView();
                    }
                    break;
                     
                case 'technical':                             
                    if (typeof loadTechnicalServices === 'function') {
                        await loadTechnicalServices();
                    }
                    break;                                     

                case 'expenses':
                    if (typeof loadExpensesView === 'function') {
                        await loadExpensesView();
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

            if (view === 'sales') {
                focusSaleBarcodeInput(120);
            }
        });
    });

    // Purchase form
    document.getElementById('formPurchase').addEventListener('submit', async (e) => {
        e.preventDefault();
        const shouldPrintLabels = document.getElementById('purchasePrintLabels')?.checked;
        const labelQuantity = parseInt(document.getElementById('purchaseLabelQuantity')?.value, 10) || 1;
        let printWindow = null;

        if (shouldPrintLabels) {
            printWindow = window.open('', '_blank', 'width=960,height=720');
        }
        
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
                : null,  // ⭐ NUEVO
            sku: document.getElementById('purchaseSku').value.trim(),
            barcode: document.getElementById('purchaseBarcode').value.trim(),
            barcodeFormat: document.getElementById('purchaseBarcodeFormat').value || undefined,
            serialNumbers: (document.getElementById('purchaseSerialNumbers')?.value || '')
                .split(/\r?\n|,/)
                .map(value => value.trim())
                .filter(Boolean)
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

                    if (productInfo.trackedUnits) {
                        message += `
🔐 IMEIs/seriales registrados: ${productInfo.trackedUnits}`;
                    }
                } else if (productInfo.productType === 'accesorio') {
                    message += `
🔌 Tipo: ACCESORIO (sin comisión)`;
                } else {
                    message += `
📦 Tipo: OTRO (sin comisión)`;
                }
                
                console.log(message);

                if (shouldPrintLabels && productInfo.barcode) {
                    const printableProduct = {
                        name: productInfo.name,
                        sku: productInfo.sku,
                        barcode: productInfo.barcode,
                        barcodeFormat: productInfo.barcodeFormat || '',
                        suggestedPrice: productInfo.suggestedPrice
                    };

                    try {
                        await printProductWithBridge(printableProduct, labelQuantity);
                        utils.showToast('Etiqueta enviada a la impresora local');
                        if (printWindow && !printWindow.closed) {
                            printWindow.close();
                        }
                    } catch (bridgeError) {
                        console.warn('No se pudo usar el helper local, se usara el navegador:', bridgeError);

                        if (window.BarcodeTools?.printLabels) {
                            BarcodeTools.printLabels(printableProduct, labelQuantity, printWindow);
                            utils.showToast('Helper local no disponible. Se abrio la impresion del navegador.');
                        } else if (printWindow && !printWindow.closed) {
                            printWindow.close();
                        }
                    }
                } else if (printWindow && !printWindow.closed) {
                    printWindow.close();
                }
                
                // Limpiar formulario
                e.target.reset();
                document.getElementById('commissionRateGroup').style.display = 'none';
                const purchaseSerialGroup = document.getElementById('purchaseSerialNumbersGroup');
                if (purchaseSerialGroup) purchaseSerialGroup.style.display = 'none';
                document.getElementById('purchaseTotal').textContent = '$0';
                
                // Recargar listas
                await app.loadPurchases();
                await app.loadProducts();
                await app.loadDashboard();
            }
        } catch (error) {
            if (printWindow && !printWindow.closed) {
                printWindow.close();
            }
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
            paymentMethod: document.getElementById('salePaymentMethod').value,
            unitIds: typeof getSelectedSaleUnitIds === 'function' ? getSelectedSaleUnitIds() : []
        };
        const shouldPrintReceipt = document.getElementById('salePrintReceipt')?.checked;

        try {
            const response = await api.createSale(saleData);
            if (response.success) {
                utils.showToast('¡Venta registrada exitosamente!');
                e.target.reset();
                document.getElementById('selectedProductName').value = '';
                document.getElementById('availableStock').value = '';
                document.getElementById('suggestedPrice').value = '';
                document.getElementById('saleTotal').textContent = '$0';
                clearSaleScanFeedback();
                if (typeof clearSaleSerializedUnits === 'function') {
                    clearSaleSerializedUnits();
                }
                const accessoryBox = document.getElementById('saleAccessorySuggestions');
                if (accessoryBox) accessoryBox.style.display = 'none';
                if (shouldPrintReceipt) {
                    try {
                        const receiptSale = {
                            ...response.sale,
                            employeeName: document.getElementById('saleEmployee')?.selectedOptions?.[0]?.textContent || '',
                            paymentMethod: saleData.paymentMethod,
                            customer: saleData.customer,
                            totalSale: response.sale?.totalSale ?? (saleData.quantity * saleData.unitPrice)
                        };
                        printSaleReceipt(receiptSale);
                    } catch (printError) {
                        console.error('No se pudo imprimir el recibo:', printError);
                        utils.showToast('Venta registrada, pero no se pudo abrir el recibo', 'warning');
                    }
                }
                await app.loadSales();
                await app.loadProducts();
                focusSaleBarcodeInput(120);
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

    ['quickSalePrice', 'quickSaleQuantity'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            if (id === 'quickSaleQuantity') {
                normalizeQuickSaleQuantity();
            } else {
                updateQuickSaleTotal();
            }
        });
        document.getElementById(id)?.addEventListener('keydown', async (e) => {
            if (id === 'quickSaleQuantity' && e.key === 'ArrowUp') {
                e.preventDefault();
                changeQuickSaleQuantity(1);
                return;
            }

            if (id === 'quickSaleQuantity' && e.key === 'ArrowDown') {
                e.preventDefault();
                changeQuickSaleQuantity(-1);
                return;
            }

            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (id === 'quickSaleQuantity') normalizeQuickSaleQuantity();
            await confirmQuickScannedSale();
        });
    });

    document.getElementById('quickSalePaymentMethod')?.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        await confirmQuickScannedSale();
    });

    const purchaseTypeSelect = document.getElementById('purchaseProductType');
    const purchaseSerialGroup = document.getElementById('purchaseSerialNumbersGroup');
    if (purchaseTypeSelect && purchaseSerialGroup) {
        const syncPurchaseSerialVisibility = () => {
            purchaseSerialGroup.style.display = purchaseTypeSelect.value === 'celular' ? 'block' : 'none';
        };
        purchaseTypeSelect.addEventListener('change', syncPurchaseSerialVisibility);
        syncPurchaseSerialVisibility();
    }

    document.getElementById('saleBarcodeInput')?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await lookupSaleProductByCode();
        }
    });

    document.getElementById('saleBarcodeInput')?.addEventListener('input', () => {
        const currentValue = document.getElementById('saleBarcodeInput').value.trim();
        if (!currentValue) {
            clearSaleScanFeedback();
        }
    });

    const purchasePrintLabelsCheckbox = document.getElementById('purchasePrintLabels');
    const purchaseLabelQuantityRow = document.getElementById('purchaseLabelQuantityRow');
    if (purchasePrintLabelsCheckbox && purchaseLabelQuantityRow) {
        const syncPurchaseLabelQuantityRow = () => {
            purchaseLabelQuantityRow.style.display = purchasePrintLabelsCheckbox.checked ? 'flex' : 'none';
        };

        purchasePrintLabelsCheckbox.addEventListener('change', syncPurchaseLabelQuantityRow);
        syncPurchaseLabelQuantityRow();
    }

    document.addEventListener('keydown', handleGlobalSalesScanner);
    document.addEventListener('keydown', handleQuickSalePriceEdit);

    document.getElementById('purchaseBarcode')?.addEventListener('input', (e) => {
        const suggested = suggestBarcodeFormat(e.target.value);
        const formatField = document.getElementById('purchaseBarcodeFormat');
        if (formatField && suggested) {
            formatField.value = suggested;
        }
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
    document.getElementById('editProductSku').value = product.sku || '';
    document.getElementById('editProductBarcode').value = product.barcode || '';
    document.getElementById('editProductBarcodeFormat').value = product.barcodeFormat || 'code_39';
    document.getElementById('editProductModal').classList.add('show');
};

window.closeEditProductModal = function() {
    document.getElementById('editProductModal').classList.remove('show');
};

window.generateProductBarcodeFromModal = async function() {
    const id = document.getElementById('editProductId').value;
    if (!id) return;

    try {
        const response = await api.generateProductBarcode(id);
        if (response.success) {
            document.getElementById('editProductSku').value = response.product.sku || '';
            document.getElementById('editProductBarcode').value = response.product.barcode || '';
            document.getElementById('editProductBarcodeFormat').value = response.product.barcodeFormat || 'code_39';

            const idx = AppState.products.findIndex(p => p._id === response.product._id);
            if (idx >= 0) AppState.products[idx] = response.product;

            utils.showToast('Código generado correctamente');
        }
    } catch (error) {
        utils.showToast(error.message || 'Error al generar código', 'error');
    }
};

window.printProductBarcode = async function(productId) {
    let product = AppState.products?.find(p => p._id === productId);

    try {
        if (!product) {
            const response = await api.getProducts();
            product = response.products?.find(p => p._id === productId);
        }

        if (!product) {
            throw new Error('Producto no encontrado');
        }

        if (!product.barcode) {
            const response = await api.generateProductBarcode(productId);
            product = response.product;
            const idx = AppState.products.findIndex(p => p._id === product._id);
            if (idx >= 0) AppState.products[idx] = product;
        }

        const quantityText = prompt('¿Cuántas etiquetas quieres imprimir?', '1');
        if (quantityText === null) return;
        const quantity = Math.max(1, parseInt(quantityText, 10) || 1);

        try {
            await printProductWithBridge(product, quantity);
            utils.showToast('Etiqueta enviada a la impresora local');
        } catch (bridgeError) {
            console.warn('No se pudo usar el helper local, se usara el navegador:', bridgeError);
            BarcodeTools.printLabels(product, quantity);
            utils.showToast('Helper local no disponible. Se abrio la impresion del navegador.');
        }
    } catch (error) {
        utils.showToast(error.message || 'Error al imprimir etiqueta', 'error');
    }
};

window.generateMissingProductBarcodes = async function() {
    const confirmed = confirm('Se generarán códigos solo para los productos que todavía no tienen uno. Los productos que ya tienen código conservarán el mismo. ¿Continuar?');
    if (!confirmed) return;

    try {
        const response = await api.backfillProductBarcodes();
        utils.showToast(response.message || 'Proceso completado');
        await app.loadProducts();
        await app.loadInventory();
    } catch (error) {
        utils.showToast(error.message || 'Error al generar códigos faltantes', 'error');
    }
};

window.regenerateProductBarcode = async function(productId) {
    const product = AppState.products?.find(p => p._id === productId);
    const productName = product?.name || 'este producto';
    const confirmed = confirm(`Esto cambiará el código de ${productName}. Las etiquetas anteriores de ese producto dejarán de servir y tendrás que imprimir la nueva. ¿Continuar?`);
    if (!confirmed) return;

    try {
        const response = await api.regenerateProductBarcode(productId);
        const idx = AppState.products.findIndex(p => p._id === response.product._id);
        if (idx >= 0) AppState.products[idx] = response.product;

        utils.showToast('Código Vendly generado para este producto');
        await app.loadInventory();

        if (confirm('¿Quieres imprimir la nueva etiqueta ahora?')) {
            await printProductBarcode(response.product._id);
        }
    } catch (error) {
        utils.showToast(error.message || 'Error al cambiar código del producto', 'error');
    }
};

window.openAssignBarcodeModal = function(productId) {
    const product = AppState.products?.find(p => p._id === productId);
    if (!product) {
        utils.showToast('Producto no encontrado', 'error');
        return;
    }

    document.getElementById('assignBarcodeProductId').value = product._id;
    document.getElementById('assignBarcodeProductName').value = product.name || '';
    document.getElementById('assignBarcodeValue').value = '';
    document.getElementById('assignBarcodeFormat').value = '';
    document.getElementById('assignBarcodeModal').classList.add('show');

    setTimeout(() => {
        document.getElementById('assignBarcodeValue')?.focus();
    }, 80);
};

window.closeAssignBarcodeModal = function() {
    document.getElementById('assignBarcodeModal')?.classList.remove('show');
};

window.migrateLegacyProductBarcodes = async function() {
    const confirmed = confirm('Esto cambiará una sola vez los códigos internos antiguos tipo VDL- u otros códigos legacy para que usen el formato nuevo numérico. Las etiquetas viejas de esos productos dejarán de servir y tocará reimprimirlas. ¿Continuar?');
    if (!confirmed) return;

    try {
        const response = await api.migrateLegacyProductBarcodes();
        utils.showToast(response.message || 'Migración completada');
        await app.loadProducts();
        await app.loadInventory();
    } catch (error) {
        utils.showToast(error.message || 'Error al migrar códigos antiguos', 'error');
    }
};

window.lookupSaleProductByCode = async function() {
    const input = document.getElementById('saleBarcodeInput');
    const rawValue = input?.value || '';
    const code = normalizeCodeText(rawValue);
    const skuCode = normalizeSkuText(rawValue);

    if (!code && !skuCode) {
        utils.showToast('Escribe o escanea un código primero', 'warning');
        return;
    }

    try {
        let product = AppState.products?.find(p => p.barcode === code || p.sku === skuCode);

        if (!product) {
            const response = await api.lookupProductByCode(rawValue);
            product = response.product;

            const existingIndex = AppState.products.findIndex(p => p._id === product._id);
            if (existingIndex >= 0) {
                AppState.products[existingIndex] = product;
            } else {
                AppState.products.push(product);
            }
        }

        if (!product || product.stock <= 0) {
            throw new Error('Ese producto no tiene stock disponible para vender');
        }

        await applySaleProductSelection(product, {
            forceSuggestedPrice: true,
            loadDetails: product.productType === 'celular'
        });

        prepareScannedSale(product);
        input.value = '';
        utils.showToast(`Producto listo para vender: ${product.name}`);
    } catch (error) {
        showSaleScanFeedback(
            'error',
            'Código no encontrado',
            error.message || 'No se encontró un producto con ese código.'
        );
        playSaleScanTone('error');
        utils.showToast(error.message || 'No se encontró un producto con ese código', 'error');
    }
};

window.printSaleReceiptById = async function(saleId) {
    try {
        let sale = AppState.sales?.find(item => item._id === saleId);

        if (!sale) {
            const response = await api.getSales();
            sale = response.sales?.find(item => item._id === saleId);
        }

        if (!sale) {
            throw new Error('Venta no encontrada');
        }

        printSaleReceipt(sale);
    } catch (error) {
        utils.showToast(error.message || 'No se pudo imprimir el recibo', 'error');
    }
};

window.openSaleBarcodeScanner = async function() {
    try {
        await BarcodeTools.openScanner({
            title: 'Escanear producto para venta',
            onDetected: async (code) => {
                const input = document.getElementById('saleBarcodeInput');
                if (input) input.value = code;
                await lookupSaleProductByCode();
            }
        });
    } catch (error) {
        utils.showToast(error.message || 'No fue posible abrir el escáner', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('formAssignBarcode')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productId = document.getElementById('assignBarcodeProductId').value;
        const barcode = document.getElementById('assignBarcodeValue').value.trim();
        const barcodeFormat = document.getElementById('assignBarcodeFormat').value || undefined;

        try {
            const response = await api.assignProductBarcode(productId, { barcode, barcodeFormat });
            const idx = AppState.products.findIndex(p => p._id === response.product._id);
            if (idx >= 0) AppState.products[idx] = response.product;

            utils.showToast('Código registrado para el producto');
            closeAssignBarcodeModal();
            await app.loadInventory();
        } catch (error) {
            utils.showToast(error.message || 'Error al registrar código', 'error');
        }
    });

    document.getElementById('assignBarcodeValue')?.addEventListener('input', (e) => {
        const suggested = suggestBarcodeFormat(e.target.value);
        const formatField = document.getElementById('assignBarcodeFormat');
        if (formatField && suggested) {
            formatField.value = suggested;
        }
    });

    document.getElementById('formEditProduct')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editProductId').value;
        const data = {
            name: document.getElementById('editProductName').value.trim(),
            productType: document.getElementById('editProductType').value,
            suggestedPrice: parseFloat(document.getElementById('editProductSuggestedPrice').value) || undefined,
            sku: document.getElementById('editProductSku').value.trim(),
            barcode: document.getElementById('editProductBarcode').value.trim(),
            barcodeFormat: document.getElementById('editProductBarcodeFormat').value,
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
