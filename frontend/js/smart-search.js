// ============================================================
// SMART SEARCH — Autocompletado para Compras y Servicio Técnico
// ============================================================

// ── COMPRAS ─────────────────────────────────────────────────

function initPurchaseSmartSearch() {
    const input = document.getElementById('purchaseProductName');
    if (!input || input.dataset.smartInit) return;
    input.dataset.smartInit = '1';

    // Wrapper relativo para posicionar el dropdown
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'smart-dropdown';
    wrapper.appendChild(dropdown);

    const preview = document.createElement('div');
    preview.className = 'product-preview';
    preview.style.display = 'none';
    input.closest('.form-group').appendChild(preview);

    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) { hideDropdown(dropdown); return; }
        timer = setTimeout(() => renderPurchaseSuggestions(q, dropdown, input, preview), 200);
    });

    setupKeyboard(input, dropdown);
    closeOnClickOutside(wrapper, dropdown);
}

function renderPurchaseSuggestions(query, dropdown, input, preview) {
    const results = [];

    // 1. Tus productos existentes
    const mine = (AppState.products || [])
        .filter(p => p.isActive !== false &&
            normalize(p.name).includes(normalize(query)))
        .slice(0, 5)
        .map(p => ({ source: 'mine', name: p.name, type: p.productType,
                     price: p.suggestedPrice, cost: p.averageCost, emoji: typeEmoji(p.productType) }));

    // 2. Base de datos local de accesorios
    const local = searchAccessoriesDB(query)
        .filter(a => !mine.some(m => normalize(m.name) === normalize(a.name)))
        .slice(0, 6)
        .map(a => ({ source: 'local', name: a.name, type: 'accesorio',
                     brand: a.brand, model: a.model, emoji: a.emoji }));

    results.push(...mine, ...local);

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="smart-empty-msg">Sin sugerencias para "<b>${query}</b>" — escríbelo manualmente</div>`;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = '';

    if (mine.length) {
        dropdown.appendChild(makeSep('📦 Tus productos'));
        mine.forEach(r => dropdown.appendChild(makePurchaseItem(r, input, preview, dropdown)));
    }
    if (local.length) {
        dropdown.appendChild(makeSep('🗂️ Catálogo accesorios'));
        local.forEach(r => dropdown.appendChild(makePurchaseItem(r, input, preview, dropdown)));
    }

    dropdown.style.display = 'block';
}

function makePurchaseItem(r, input, preview, dropdown) {
    const el = document.createElement('div');
    el.className = 'smart-item';
    el.innerHTML = `
        <span class="smart-emoji">${r.emoji || '📦'}</span>
        <div class="smart-info">
            <div class="smart-name">${r.name}</div>
            <div class="smart-meta">
                ${r.brand ? `<span>${r.brand}</span>` : ''}
                ${r.model ? `<span>${r.model}</span>` : ''}
                ${r.price ? `<span style="color:var(--success)">$${fmtNum(r.price)}</span>` : ''}
                <span class="smart-badge ${r.source}">${r.source === 'mine' ? 'tuyo' : 'catálogo'}</span>
            </div>
        </div>`;

    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', () => {
        input.value = r.name;
        hideDropdown(dropdown);

        // Autocompletar tipo
        const typeField = document.getElementById('purchaseProductType');
        if (typeField) { typeField.value = r.type || 'accesorio'; typeField.dispatchEvent(new Event('change')); }

        // Autocompletar precio sugerido si está vacío
        if (r.price) {
            const pf = document.getElementById('purchaseSuggestedPrice');
            if (pf && !pf.value) pf.value = r.price;
        }

        // Mini preview
        if (r.brand) {
            preview.style.display = 'flex';
            preview.innerHTML = `
                <span style="font-size:2rem">${r.emoji || '📦'}</span>
                <div class="preview-info">
                    <strong>${r.name}</strong>
                    ${r.brand ? `<span>${r.brand} ${r.model || ''}</span>` : ''}
                </div>
                <button type="button" class="preview-close" onclick="this.closest('.product-preview').style.display='none'">✕</button>`;
        }
        input.focus();
    });
    return el;
}

// ── SERVICIO TÉCNICO ─────────────────────────────────────────

const BRANDS = ['Apple','Samsung','Huawei','Xiaomi','Motorola','LG','Sony',
    'OnePlus','Oppo','Vivo','Realme','Nokia','ZTE','Tecno','Infinix',
    'Honor','Asus','Lenovo','HP','Dell','Acer','Toshiba'];

const MODELS = {
    'Apple':    ['iPhone 7','iPhone 8','iPhone X','iPhone XR','iPhone XS Max','iPhone 11',
                 'iPhone 11 Pro','iPhone 12','iPhone 12 Pro Max','iPhone 13','iPhone 13 Pro',
                 'iPhone 13 Pro Max','iPhone 14','iPhone 14 Pro','iPhone 14 Pro Max',
                 'iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPad Air','iPad Pro'],
    'Samsung':  ['Galaxy A05','Galaxy A15','Galaxy A25','Galaxy A35','Galaxy A55',
                 'Galaxy A53','Galaxy A54','Galaxy S22','Galaxy S23','Galaxy S24',
                 'Galaxy S24 Ultra','Galaxy Note 20','Galaxy Tab A8'],
    'Huawei':   ['P30 Lite','P40 Lite','P50','Nova 9','Nova 11','Y9s','Y7a','Mate 50'],
    'Xiaomi':   ['Redmi 9A','Redmi 10','Redmi 12','Redmi 12C','Redmi 13',
                 'Redmi Note 10','Redmi Note 11','Redmi Note 12','Redmi Note 13',
                 'Redmi Note 13 Pro','POCO X5','POCO M5'],
    'Motorola': ['Moto G14','Moto G24','Moto G34','Moto G54','Moto G84','Moto E40','Edge 40','Edge 50'],
    'Honor':    ['X6A','X7A','X8A','X9A','Magic5 Lite','Magic6'],
    'Realme':   ['C30','C35','C55','10','11','GT Neo 5'],
};

function initTechnicalSmartSearch() {
    const brandInput = document.getElementById('deviceBrand');
    const modelInput = document.getElementById('deviceModel');
    if (!brandInput || !modelInput || brandInput.dataset.smartInit) return;
    brandInput.dataset.smartInit = '1';

    setupBrandAutocomplete(brandInput, modelInput);
    setupModelAutocomplete(modelInput, brandInput);
}

function setupBrandAutocomplete(brandInput, modelInput) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;';
    brandInput.parentNode.insertBefore(wrapper, brandInput);
    wrapper.appendChild(brandInput);

    const dropdown = document.createElement('div');
    dropdown.className = 'smart-dropdown';
    wrapper.appendChild(dropdown);

    const show = () => {
        const q = normalize(brandInput.value);
        const matches = BRANDS.filter(b => !q || normalize(b).includes(q)).slice(0, 8);
        if (!matches.length) { hideDropdown(dropdown); return; }
        dropdown.innerHTML = matches.map(b => `
            <div class="smart-item" data-brand="${b}">
                <span class="smart-emoji">📱</span>
                <div class="smart-info"><div class="smart-name">${b}</div></div>
            </div>`).join('');
        dropdown.querySelectorAll('.smart-item').forEach(el => {
            el.addEventListener('mousedown', e => e.preventDefault());
            el.addEventListener('click', () => {
                brandInput.value = el.dataset.brand;
                hideDropdown(dropdown);
                modelInput.focus();
                triggerModelSuggestions(modelInput, brandInput);
            });
        });
        dropdown.style.display = 'block';
    };

    brandInput.addEventListener('input', show);
    brandInput.addEventListener('focus', show);
    closeOnClickOutside(wrapper, dropdown);
}

function setupModelAutocomplete(modelInput, brandInput) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;';
    modelInput.parentNode.insertBefore(wrapper, modelInput);
    wrapper.appendChild(modelInput);

    const dropdown = document.createElement('div');
    dropdown.className = 'smart-dropdown';
    wrapper.appendChild(dropdown);

    let timer;
    modelInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => triggerModelSuggestions(modelInput, brandInput, dropdown), 200);
    });
    modelInput.addEventListener('focus', () => triggerModelSuggestions(modelInput, brandInput, dropdown));

    setupKeyboard(modelInput, dropdown);
    closeOnClickOutside(wrapper, dropdown);
}

function triggerModelSuggestions(modelInput, brandInput, dropdown) {
    dropdown = dropdown || modelInput.closest('[style*="position"]')?.querySelector('.smart-dropdown');
    if (!dropdown) return;

    const brand = brandInput.value.trim();
    const q = normalize(modelInput.value);
    const pool = MODELS[brand] || Object.values(MODELS).flat();
    const matches = pool.filter(m => !q || normalize(m).includes(q)).slice(0, 8);

    if (!matches.length) { hideDropdown(dropdown); return; }

    dropdown.innerHTML = (brand ? `<div class="smart-sep">Modelos ${brand}</div>` : '') +
        matches.map(m => `
            <div class="smart-item" data-model="${m}">
                <span class="smart-emoji">📲</span>
                <div class="smart-info"><div class="smart-name">${m}</div></div>
            </div>`).join('');

    dropdown.querySelectorAll('.smart-item').forEach(el => {
        el.addEventListener('mousedown', e => e.preventDefault());
        el.addEventListener('click', () => {
            modelInput.value = el.dataset.model;
            hideDropdown(dropdown);
        });
    });
    dropdown.style.display = 'block';
}

// ── UTILIDADES ───────────────────────────────────────────────

function normalize(str) {
    return (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function fmtNum(n) { return Number(n).toLocaleString('es-CO'); }

function typeEmoji(type) {
    return type === 'celular' ? '📱' : type === 'accesorio' ? '🔌' : '📦';
}

function makeSep(text) {
    const el = document.createElement('div');
    el.className = 'smart-sep';
    el.textContent = text;
    return el;
}

function hideDropdown(dropdown) {
    if (dropdown) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; }
}

function setupKeyboard(input, dropdown) {
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
            hideDropdown(dropdown);
        }
    });
}

function closeOnClickOutside(wrapper, dropdown) {
    document.addEventListener('click', e => {
        if (!wrapper.contains(e.target)) hideDropdown(dropdown);
    });
}

// ── INICIALIZAR al cambiar de vista ──────────────────────────
const _smartInit = {};
function maybeInitSmartSearch(view) {
    if (view === 'purchases' && !_smartInit.purchases) {
        setTimeout(() => { initPurchaseSmartSearch(); _smartInit.purchases = true; }, 150);
    }
    if (view === 'technical' && !_smartInit.technical) {
        setTimeout(() => { initTechnicalSmartSearch(); _smartInit.technical = true; }, 150);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            if (view) maybeInitSmartSearch(view);
        });
    });
    // Si ya está en purchases al cargar
    const activeView = document.querySelector('.nav-btn.active')?.getAttribute('data-view');
    if (activeView) maybeInitSmartSearch(activeView);
});
