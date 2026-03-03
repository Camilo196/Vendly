// ============================================================
// COMPRA RÁPIDA POR LOTE + ESCÁNER DE CÓDIGO DE BARRAS
// ============================================================

// ── ESTADO ──────────────────────────────────────────────────
const QPState = {
    items: [],       // productos en el lote actual
    scanning: false,
};

// ── INYECTAR BOTÓN EN VISTA COMPRAS ─────────────────────────
function injectQuickPurchaseButton() {
    const purchasesView = document.getElementById('viewPurchases');
    if (!purchasesView || document.getElementById('btnQuickPurchase')) return;

    const btn = document.createElement('button');
    btn.id = 'btnQuickPurchase';
    btn.className = 'btn btn-success';
    btn.style.cssText = 'margin-bottom:1.5rem; width:100%; font-size:1rem; padding:0.9rem;';
    btn.innerHTML = '⚡ Compra rápida por lote';
    btn.onclick = openQuickPurchaseModal;

    purchasesView.insertBefore(btn, purchasesView.querySelector('.card'));
}

// ── MODAL PRINCIPAL ─────────────────────────────────────────
function openQuickPurchaseModal() {
    QPState.items = [];
    let modal = document.getElementById('quickPurchaseModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quickPurchaseModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content qp-modal">
            <button class="qp-close" onclick="closeQPModal()">✕</button>
            <h2>⚡ Compra rápida por lote</h2>

            <!-- BÚSQUEDA -->
            <div class="qp-search-row">
                <div class="qp-search-wrap" style="position:relative; flex:1;">
                    <input type="text" id="qpSearchInput" class="qp-search"
                        placeholder="🔍  Busca por modelo, marca o tipo... (ej: A55, vidrio, cable)"
                        autocomplete="off">
                    <div id="qpDropdown" class="smart-dropdown"></div>
                </div>
                <button class="btn qp-scan-btn" id="qpScanBtn" onclick="startBarcodeScanner()" title="Escanear código de barras">
                    📷 Escanear
                </button>
            </div>

            <!-- ESCÁNER -->
            <div id="qpScannerContainer" style="display:none;">
                <div id="qpScannerBox" class="qp-scanner-box">
                    <video id="qpVideo" autoplay playsinline muted></video>
                    <div class="qp-scan-line"></div>
                    <div class="qp-scan-label">Apunta al código de barras</div>
                </div>
                <button class="btn btn-sm" style="margin-top:8px;width:100%;" onclick="stopBarcodeScanner()">✕ Cancelar escáner</button>
            </div>

            <!-- TABLA DE LOTE -->
            <div class="qp-batch-wrap">
                <div id="qpBatchEmpty" class="qp-empty">
                    Busca productos arriba o escanea códigos para agregarlos al lote
                </div>
                <table id="qpBatchTable" style="display:none;">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="width:80px">Cantidad</th>
                            <th style="width:110px">Costo unit.</th>
                            <th style="width:110px">P. sugerido</th>
                            <th style="width:40px"></th>
                        </tr>
                    </thead>
                    <tbody id="qpBatchBody"></tbody>
                </table>
            </div>

            <!-- FOOTER -->
            <div class="qp-footer">
                <div class="qp-total" id="qpTotal"></div>
                <div class="qp-footer-btns">
                    <button class="btn" onclick="closeQPModal()">Cancelar</button>
                    <button class="btn btn-primary" id="qpSubmitBtn" onclick="submitQuickPurchase()" disabled>
                        💾 Registrar lote
                    </button>
                </div>
            </div>
        </div>`;

    modal.classList.add('show');
    setupQPSearch();
}

function closeQPModal() {
    stopBarcodeScanner();
    const modal = document.getElementById('quickPurchaseModal');
    if (modal) modal.classList.remove('show');
}

// ── BÚSQUEDA ─────────────────────────────────────────────────
function setupQPSearch() {
    const input = document.getElementById('qpSearchInput');
    const dropdown = document.getElementById('qpDropdown');
    if (!input) return;

    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) { dropdown.style.display = 'none'; return; }
        timer = setTimeout(() => showQPSuggestions(q, dropdown, input), 200);
    });

    input.addEventListener('keydown', e => {
        const items = dropdown.querySelectorAll('.smart-item');
        const active = dropdown.querySelector('.smart-item.active');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!active) items[0]?.classList.add('active');
            else { active.classList.remove('active'); (active.nextElementSibling || items[0]).classList.add('active'); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!active) items[items.length-1]?.classList.add('active');
            else { active.classList.remove('active'); (active.previousElementSibling || items[items.length-1]).classList.add('active'); }
        } else if (e.key === 'Enter' && active) {
            e.preventDefault(); active.click();
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', e => {
        if (!input.closest('.qp-search-wrap').contains(e.target))
            dropdown.style.display = 'none';
    });

    setTimeout(() => input.focus(), 100);
}

function showQPSuggestions(query, dropdown, input) {
    const results = [];

    // Productos propios
    const mine = (AppState.products || [])
        .filter(p => p.isActive !== false && normalize(p.name).includes(normalize(query)))
        .slice(0, 4)
        .map(p => ({ source:'mine', name:p.name, brand:'', type:'accesorio',
                     subtype: p.productType, price: p.suggestedPrice || '', cost: p.averageCost || '',
                     emoji: subtypeEmoji(p.productType) }));

    // Catálogo local
    const local = searchAccessoriesDB(query)
        .filter(a => !mine.some(m => normalize(m.name) === normalize(a.name)))
        .slice(0, 8)
        .map(a => ({ source:'local', ...a }));

    results.push(...mine, ...local);

    if (!results.length) {
        dropdown.innerHTML = `<div class="smart-empty-msg">Sin resultados para "<b>${query}</b>"</div>`;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = '';
    if (mine.length) {
        dropdown.appendChild(makeSepEl('📦 Tus productos'));
        mine.forEach(r => dropdown.appendChild(makeQPItem(r, input, dropdown)));
    }
    if (local.length) {
        dropdown.appendChild(makeSepEl('🗂️ Catálogo'));
        local.forEach(r => dropdown.appendChild(makeQPItem(r, input, dropdown)));
    }
    dropdown.style.display = 'block';
}

function makeQPItem(r, input, dropdown) {
    const el = document.createElement('div');
    el.className = 'smart-item';
    el.innerHTML = `
        <span class="smart-emoji">${r.emoji || '📦'}</span>
        <div class="smart-info">
            <div class="smart-name">${r.name}</div>
            <div class="smart-meta">
                ${r.brand ? `<span>${r.brand}</span>` : ''}
                ${r.cost  ? `<span>Costo: $${fmtN(r.cost)}</span>` : ''}
                <span class="smart-badge ${r.source}">${r.source === 'mine' ? 'tuyo' : 'catálogo'}</span>
            </div>
        </div>`;
    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', () => {
        addToQPBatch(r);
        input.value = '';
        dropdown.style.display = 'none';
        input.focus();
    });
    return el;
}

// ── LOTE ─────────────────────────────────────────────────────
function addToQPBatch(product) {
    // Si ya está, solo aumentar cantidad
    const existing = QPState.items.find(i => i.name === product.name);
    if (existing) {
        existing.qty++;
        renderQPBatch();
        return;
    }
    QPState.items.push({
        id: Date.now() + Math.random(),
        name: product.name,
        brand: product.brand || '',
        subtype: product.subtype || product.type || 'accesorio',
        emoji: product.emoji || '📦',
        qty: 1,
        cost: product.cost || '',
        price: product.price || '',
    });
    renderQPBatch();
}

function renderQPBatch() {
    const body = document.getElementById('qpBatchBody');
    const table = document.getElementById('qpBatchTable');
    const empty = document.getElementById('qpBatchEmpty');
    const submitBtn = document.getElementById('qpSubmitBtn');
    const totalEl = document.getElementById('qpTotal');

    if (!body) return;

    if (QPState.items.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
        submitBtn.disabled = true;
        totalEl.textContent = '';
        return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';
    submitBtn.disabled = false;

    body.innerHTML = QPState.items.map((item, i) => `
        <tr id="qpRow_${i}">
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span>${item.emoji}</span>
                    <div>
                        <div style="font-weight:600;font-size:.88rem;">${item.name}</div>
                        <div style="font-size:.72rem;color:var(--text-secondary);">${item.brand}</div>
                    </div>
                </div>
            </td>
            <td>
                <input type="number" class="qp-input" min="1" value="${item.qty}"
                    onchange="updateQPItem(${i},'qty',this.value)">
            </td>
            <td>
                <input type="number" class="qp-input" min="0" step="100"
                    placeholder="Costo" value="${item.cost}"
                    onchange="updateQPItem(${i},'cost',this.value)">
            </td>
            <td>
                <input type="number" class="qp-input" min="0" step="100"
                    placeholder="P. venta" value="${item.price}"
                    onchange="updateQPItem(${i},'price',this.value)">
            </td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeQPItem(${i})">✕</button>
            </td>
        </tr>`).join('');

    // Total
    let total = 0;
    QPState.items.forEach(i => { total += (parseFloat(i.cost)||0) * (parseFloat(i.qty)||0); });
    totalEl.textContent = total > 0 ? `Total inversión: $${fmtN(total)}` : '';
}

window.updateQPItem = function(idx, field, val) {
    if (QPState.items[idx]) {
        QPState.items[idx][field] = val;
        // Recalcular total sin re-renderizar
        let total = 0;
        QPState.items.forEach(i => { total += (parseFloat(i.cost)||0) * (parseFloat(i.qty)||0); });
        const totalEl = document.getElementById('qpTotal');
        if (totalEl) totalEl.textContent = total > 0 ? `Total inversión: $${fmtN(total)}` : '';
    }
};

window.removeQPItem = function(idx) {
    QPState.items.splice(idx, 1);
    renderQPBatch();
};

// ── ENVIAR LOTE ──────────────────────────────────────────────
window.submitQuickPurchase = async function() {
    const items = QPState.items.filter(i => i.qty > 0);
    if (!items.length) return;

    const btn = document.getElementById('qpSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Registrando...';

    let ok = 0, errors = 0;

    for (const item of items) {
        try {
            await api.request('/purchases', {
                method: 'POST',
                body: JSON.stringify({
                    productName:    item.name,
                    quantity:       parseInt(item.qty) || 1,
                    unitCost:       parseFloat(item.cost) || 0,
                    suggestedPrice: parseFloat(item.price) || undefined,
                    productType:    'accesorio',
                    supplier:       '',
                    invoice:        '',
                    notes:          `Lote rápido — ${item.brand}`,
                })
            });
            ok++;
        } catch(e) {
            errors++;
            console.error('Error registrando', item.name, e);
        }
    }

    closeQPModal();

    if (errors === 0) {
        utils.showToast(`✅ ${ok} producto${ok > 1 ? 's' : ''} registrado${ok > 1 ? 's' : ''} correctamente`);
    } else {
        utils.showToast(`⚠️ ${ok} OK · ${errors} con error`, 'warning');
    }

    // Recargar datos
    if (typeof app !== 'undefined') {
        app.loadProducts?.();
        app.loadInventory?.();
    }
};

// ── ESCÁNER DE CÓDIGO DE BARRAS ──────────────────────────────
let scanStream = null;
let scanInterval = null;

window.startBarcodeScanner = async function() {
    const container = document.getElementById('qpScannerContainer');
    const video = document.getElementById('qpVideo');
    if (!container || !video) return;

    // Verificar soporte de BarcodeDetector
    if (!('BarcodeDetector' in window)) {
        utils.showToast('Tu navegador no soporta escáner. Usa Chrome en Android.', 'warning');
        return;
    }

    try {
        scanStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = scanStream;
        container.style.display = 'block';
        document.getElementById('qpScanBtn').style.display = 'none';

        const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code'] });

        scanInterval = setInterval(async () => {
            if (video.readyState < 2) return;
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    stopBarcodeScanner();
                    await handleBarcode(code);
                }
            } catch(e) {}
        }, 400);

    } catch(e) {
        utils.showToast('No se pudo acceder a la cámara', 'error');
    }
};

window.stopBarcodeScanner = function() {
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
    const container = document.getElementById('qpScannerContainer');
    const btn = document.getElementById('qpScanBtn');
    if (container) container.style.display = 'none';
    if (btn) btn.style.display = 'flex';
};

async function handleBarcode(code) {
    utils.showToast(`📦 Código: ${code} — buscando...`);

    // 1. Buscar en productos propios
    const mine = (AppState.products || []).find(p =>
        p.barcode === code || p.sku === code
    );
    if (mine) {
        addToQPBatch({ source:'mine', name: mine.name, brand:'', subtype: mine.productType,
                       emoji: subtypeEmoji(mine.productType), cost: mine.averageCost, price: mine.suggestedPrice });
        utils.showToast(`✅ Encontrado: ${mine.name}`);
        return;
    }

    // 2. Buscar en API pública de códigos de barras
    try {
        const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
        if (res.ok) {
            const data = await res.json();
            const item = data.items?.[0];
            if (item) {
                addToQPBatch({
                    source: 'api',
                    name:    item.title,
                    brand:   item.brand || '',
                    subtype: 'accesorio',
                    emoji:   '📦',
                    cost:    item.lowest_recorded_price || '',
                    price:   item.highest_recorded_price || '',
                });
                utils.showToast(`✅ Encontrado: ${item.title}`);
                return;
            }
        }
    } catch(e) {}

    // 3. No encontrado — agregar manualmente
    const name = prompt(`Código ${code} no encontrado.\n¿Cómo se llama este producto?`);
    if (name?.trim()) {
        addToQPBatch({ source:'manual', name: name.trim(), brand:'', subtype:'accesorio',
                       emoji:'📦', cost:'', price:'' });
    }
}

// ── UTILIDADES ───────────────────────────────────────────────
function normalize(s) {
    return (s||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function fmtN(n) { return Number(n).toLocaleString('es-CO'); }
function subtypeEmoji(t) {
    return t === 'celular' ? '📱' : t === 'accesorio' ? '🔌' : '📦';
}
function makeSepEl(text) {
    const el = document.createElement('div');
    el.className = 'smart-sep';
    el.textContent = text;
    return el;
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-view') === 'purchases') {
                setTimeout(injectQuickPurchaseButton, 150);
            }
        });
    });
    if (document.querySelector('.nav-btn.active')?.getAttribute('data-view') === 'purchases') {
        setTimeout(injectQuickPurchaseButton, 300);
    }
});
