// ============================================================
// SMART SEARCH - Autocompletado para Compras y Servicio Tecnico
// ============================================================

function initPurchaseSmartSearch() {
    const input = document.getElementById('purchaseProductName');
    if (!input || input.dataset.smartInit) return;
    input.dataset.smartInit = '1';

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
        if (q.length < 2) {
            hideDropdown(dropdown);
            return;
        }
        timer = setTimeout(() => renderPurchaseSuggestions(q, dropdown, input, preview), 120);
    });

    setupKeyboard(input, dropdown);
    closeOnClickOutside(wrapper, dropdown);
}

function inferCatalogDeviceType(brand = '', model = '', name = '') {
    const text = normalize(`${brand} ${model} ${name}`);
    if (text.includes('ipad') || text.includes('tablet') || text.includes('tab ')) {
        return 'otro';
    }
    return 'celular';
}

function composeCatalogDeviceName(brand = '', model = '') {
    const normalizedBrand = normalize(brand);
    const normalizedModel = normalize(model);
    if (!brand) return model;
    if (normalizedModel.startsWith(normalizedBrand)) return model;
    return `${brand} ${model}`.trim();
}

function compactSearchToken(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, '');
}

function getAccessorySubtypeAliases(subtype = '') {
    return {
        estuche: ['estuche', 'forro', 'funda', 'case', 'cover'],
        vidrio: ['vidrio', 'templado', 'glass', 'mica', 'protector'],
        hidrogel: ['hidrogel', 'lamina', 'film', 'corte'],
        cable: ['cable', 'usb', 'tipo c', 'lightning', 'micro usb'],
        cargador: ['cargador', 'power bank', 'carga'],
        audifonos: ['audifonos', 'bluetooth', 'manos libres']
    }[normalize(subtype)] || ['accesorio'];
}

function buildPurchaseAliases({ name = '', brand = '', model = '', subtype = '' } = {}) {
    const aliases = new Set();
    const deviceName = composeCatalogDeviceName(brand, model);

    [name, deviceName, model, `${brand} ${model}`, `${brand} ${name}`].forEach(value => {
        const clean = (value || '').trim();
        if (!clean) return;
        aliases.add(normalize(clean));
        aliases.add(compactSearchToken(clean));
    });

    getAccessorySubtypeAliases(subtype).forEach(word => {
        [deviceName, model].forEach(target => {
            const cleanTarget = (target || '').trim();
            if (!cleanTarget) return;
            aliases.add(normalize(`${word} ${cleanTarget}`));
            aliases.add(compactSearchToken(`${word} ${cleanTarget}`));
        });
    });

    return [...aliases].filter(Boolean);
}

function buildPurchaseSearchFields({ name = '', brand = '', model = '', subtype = '', keywords = '', type = '' } = {}) {
    const aliases = buildPurchaseAliases({ name, brand, model, subtype });
    const searchText = normalize([
        name,
        brand,
        model,
        subtype,
        type,
        keywords,
        ...aliases,
        ...getAccessorySubtypeAliases(subtype)
    ].join(' '));

    return {
        aliases,
        searchText,
        compactText: compactSearchToken(searchText)
    };
}

function getCompatibilityCatalogDevices() {
    const groups = Array.isArray(window.DEVICE_COMPATIBILITY_GROUPS) ? window.DEVICE_COMPATIBILITY_GROUPS : [];
    return groups.flatMap(group =>
        (group.members || []).map(member => ({
            brand: group.brand || '',
            model: member.model || ''
        }))
    ).filter(item => item.model);
}

function getPurchaseCatalog() {
    if (window.__purchaseCatalogCache) return window.__purchaseCatalogCache;

    const accessories = [];
    const devices = [];
    const accessorySeen = new Set();
    const deviceSeen = new Set();
    const templateSeen = new Set();
    const accessoryFamilySeen = new Set();
    const accessoryIndex = typeof window.getAccessoryCatalogIndex === 'function'
        ? window.getAccessoryCatalogIndex()
        : null;
    const localDb = accessoryIndex?.items?.length ? accessoryIndex.items : (Array.isArray(window.ACCESSORIES_DB) ? window.ACCESSORIES_DB : []);

    localDb.forEach(item => {
        const accessoryKey = normalize(item.name);
        if (!accessorySeen.has(accessoryKey)) {
            accessorySeen.add(accessoryKey);
            const fields = buildPurchaseSearchFields({
                name: item.name,
                brand: item.brand || '',
                model: item.model || '',
                subtype: item.subtype || 'accesorio',
                keywords: item.keywords || '',
                type: 'accesorio'
            });

            accessories.push({
                source: 'catalog',
                kind: 'accessory',
                name: item.name,
                type: 'accesorio',
                brand: item.brand || '',
                model: item.model || '',
                subtype: item.subtype || 'accesorio',
                emoji: item.emoji || '📦',
                keywords: fields.searchText,
                aliases: fields.aliases,
                compactText: fields.compactText
            });
        }

        if (['estuche', 'vidrio', 'hidrogel'].includes(item.subtype)) {
            const deviceName = composeCatalogDeviceName(item.brand, item.model);
            const deviceKey = normalize(deviceName);
            accessoryFamilySeen.add(`${normalize(item.brand)}::${normalize(item.model)}::${normalize(item.subtype)}`);

            if (!deviceSeen.has(deviceKey)) {
                deviceSeen.add(deviceKey);
                const deviceType = inferCatalogDeviceType(item.brand, item.model, deviceName);
                const fields = buildPurchaseSearchFields({
                    name: deviceName,
                    brand: item.brand || '',
                    model: item.model || '',
                    keywords: `${deviceName} celular smartphone equipo movil`,
                    type: deviceType
                });

                devices.push({
                    source: 'device_catalog',
                    kind: 'device',
                    name: deviceName,
                    type: deviceType,
                    brand: item.brand || '',
                    model: item.model || '',
                    emoji: deviceType === 'celular' ? '📱' : '💻',
                    keywords: fields.searchText,
                    aliases: fields.aliases,
                    compactText: fields.compactText
                });
            }
        }
    });

    getCompatibilityCatalogDevices().forEach(device => {
        const deviceName = composeCatalogDeviceName(device.brand, device.model);
        const deviceKey = normalize(deviceName);
        if (deviceSeen.has(deviceKey)) return;
        deviceSeen.add(deviceKey);

        const deviceType = inferCatalogDeviceType(device.brand, device.model, deviceName);
        const fields = buildPurchaseSearchFields({
            name: deviceName,
            brand: device.brand,
            model: device.model,
            keywords: `${deviceName} celular smartphone equipo compatible`,
            type: deviceType
        });

        devices.push({
            source: 'compatibility_group',
            kind: 'device',
            name: deviceName,
            type: deviceType,
            brand: device.brand,
            model: device.model,
            emoji: deviceType === 'celular' ? '📱' : '💻',
            keywords: fields.searchText,
            aliases: fields.aliases,
            compactText: fields.compactText
        });
    });

    Object.entries(MODELS).forEach(([brand, models]) => {
        models.forEach(model => {
            const deviceName = composeCatalogDeviceName(brand, model);
            const deviceKey = normalize(deviceName);
            if (deviceSeen.has(deviceKey)) return;
            deviceSeen.add(deviceKey);

            const deviceType = inferCatalogDeviceType(brand, model, deviceName);
            const fields = buildPurchaseSearchFields({
                name: deviceName,
                brand,
                model,
                keywords: `${deviceName} celular smartphone equipo`,
                type: deviceType
            });

            devices.push({
                source: 'device_catalog',
                kind: 'device',
                name: deviceName,
                type: deviceType,
                brand,
                model,
                emoji: deviceType === 'celular' ? '📱' : '💻',
                keywords: fields.searchText,
                aliases: fields.aliases,
                compactText: fields.compactText
            });
        });
    });

    devices.forEach(device => {
        ['estuche', 'vidrio', 'hidrogel'].forEach(subtype => {
            const familyKey = `${normalize(device.brand)}::${normalize(device.model)}::${subtype}`;
            if (accessoryFamilySeen.has(familyKey)) return;

            const subtypeLabel = subtype === 'estuche'
                ? 'Estuche / forro'
                : subtype === 'vidrio'
                    ? 'Vidrio templado'
                    : 'Hidrogel';
            const generatedName = `${subtypeLabel} ${device.name}`.trim();
            const generatedKey = normalize(generatedName);
            if (templateSeen.has(generatedKey)) return;
            templateSeen.add(generatedKey);

            const fields = buildPurchaseSearchFields({
                name: generatedName,
                brand: device.brand,
                model: device.model,
                subtype,
                keywords: `${generatedName} referencia sugerida compatible`,
                type: 'accesorio'
            });

            accessories.push({
                source: 'template',
                kind: 'accessory',
                name: generatedName,
                type: 'accesorio',
                brand: device.brand,
                model: device.model,
                subtype,
                emoji: subtype === 'estuche' ? '📱' : subtype === 'vidrio' ? '🔲' : '💧',
                keywords: fields.searchText,
                aliases: fields.aliases,
                compactText: fields.compactText
            });
        });
    });

    window.__purchaseCatalogCache = {
        accessories,
        devices,
        all: [...devices, ...accessories]
    };
    return window.__purchaseCatalogCache;
}

function searchPurchaseCatalog(query, { kind = 'all', limit = 8 } = {}) {
    const q = normalize(query);
    if (!q || q.length < 2) return [];

    const words = q.split(/\s+/).filter(Boolean);
    const compactQuery = compactSearchToken(query);
    const catalog = getPurchaseCatalog();
    const pool = kind === 'device'
        ? catalog.devices
        : kind === 'accessory'
            ? catalog.accessories
            : catalog.all;

    return pool
        .map(item => {
            const haystack = item.keywords || normalize(`${item.name} ${item.brand} ${item.model}`);
            const phraseHit = haystack.includes(q);
            const wordsHit = words.every(word => haystack.includes(word));
            const prefixHit = normalize(item.name).startsWith(q) || normalize(item.model).startsWith(q);
            const compactHit = (item.compactText || compactSearchToken(haystack)).includes(compactQuery);
            const aliasHit = (item.aliases || []).some(alias => alias.includes(q) || alias === compactQuery);

            if (!phraseHit && !wordsHit && !prefixHit && !compactHit && !aliasHit) return null;

            let score = 0;
            if (phraseHit) score += 5;
            if (wordsHit) score += 3;
            if (prefixHit) score += 2;
            if (compactHit) score += 4;
            if (aliasHit) score += 4;
            if (item.source === 'catalog') score += 1;

            return { ...item, _score: score };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            return a.name.localeCompare(b.name);
        })
        .slice(0, limit);
}

async function renderPurchaseSuggestions(query, dropdown, input, preview) {
    const results = [];
    const normalizedQuery = normalize(query);
    const compactQuery = compactSearchToken(query);

    const mine = (AppState.products || [])
        .filter(product => product.isActive !== false && (
            normalize(product.name).includes(normalizedQuery) ||
            compactSearchToken(product.name).includes(compactQuery) ||
            normalize(`${product.brand || ''} ${product.category || ''}`).includes(normalizedQuery)
        ))
        .slice(0, 5)
        .map(product => ({
            source: 'mine',
            name: product.name,
            type: product.productType,
            price: product.suggestedPrice,
            cost: product.averageCost,
            brand: product.brand || '',
            emoji: typeEmoji(product.productType)
        }));

    const suggestedDevices = searchPurchaseCatalog(query, { kind: 'device', limit: 8 })
        .filter(device => !mine.some(item => normalize(item.name) === normalize(device.name)))
        .map(device => ({ ...device, source: 'device_catalog' }));

    const local = searchPurchaseCatalog(query, { kind: 'accessory', limit: 10 })
        .filter(accessory => !mine.some(item => normalize(item.name) === normalize(accessory.name)))
        .filter(accessory => !suggestedDevices.some(item => normalize(item.name) === normalize(accessory.name)))
        .slice(0, 10)
        .map(accessory => ({
            ...accessory,
            source: accessory.source === 'template' ? 'template' : 'local'
        }));

    let apiDevices = [];
    let apiAccessories = [];
    try {
        if (typeof api !== 'undefined' && typeof api.getCompatibilityPurchaseSuggestions === 'function') {
            const response = await api.getCompatibilityPurchaseSuggestions(query, 18);
            if (response?.success) {
                apiDevices = (response.devices || [])
                    .filter(device => !mine.some(item => normalize(item.name) === normalize(device.name)))
                    .filter(device => !suggestedDevices.some(item => normalize(item.name) === normalize(device.name)))
                    .map(device => ({
                        ...device,
                        emoji: '📱',
                        source: 'api_device'
                    }));

                apiAccessories = (response.accessories || [])
                    .filter(item => !mine.some(existing => normalize(existing.name) === normalize(item.name)))
                    .filter(item => !local.some(existing => normalize(existing.name) === normalize(item.name)))
                    .map(item => ({
                        ...item,
                        emoji: item.subtype === 'estuche' ? '📱' : item.subtype === 'vidrio' ? '🔲' : item.subtype === 'hidrogel' ? '💧' : '📦',
                        source: 'api_catalog'
                    }));
            }
        }
    } catch (error) {
        console.warn('Purchase suggestions API fallback:', error);
    }

    results.push(...mine, ...suggestedDevices, ...apiDevices, ...local, ...apiAccessories);

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="smart-empty-msg">Sin sugerencias para "<b>${query}</b>" - escribelo manualmente</div>`;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = '';

    if (mine.length) {
        dropdown.appendChild(makeSep('📦 Tus productos'));
        mine.forEach(item => dropdown.appendChild(makePurchaseItem(item, input, preview, dropdown)));
    }
    if (suggestedDevices.length) {
        dropdown.appendChild(makeSep('📱 Equipos sugeridos'));
        suggestedDevices.forEach(item => dropdown.appendChild(makePurchaseItem(item, input, preview, dropdown)));
    }
    if (apiDevices.length) {
        dropdown.appendChild(makeSep('🧠 Compatibilidad API'));
        apiDevices.forEach(item => dropdown.appendChild(makePurchaseItem(item, input, preview, dropdown)));
    }
    if (local.length) {
        dropdown.appendChild(makeSep('🗂 Catalogo accesorios'));
        local.forEach(item => dropdown.appendChild(makePurchaseItem(item, input, preview, dropdown)));
    }
    if (apiAccessories.length) {
        dropdown.appendChild(makeSep('🔗 Accesorios compatibles'));
        apiAccessories.forEach(item => dropdown.appendChild(makePurchaseItem(item, input, preview, dropdown)));
    }

    dropdown.style.display = 'block';
}

function makePurchaseItem(result, input, preview, dropdown) {
    const el = document.createElement('div');
    el.className = 'smart-item';
    el.innerHTML = `
        <span class="smart-emoji">${result.emoji || '📦'}</span>
        <div class="smart-info">
            <div class="smart-name">${result.name}</div>
            <div class="smart-meta">
                ${result.brand ? `<span>${result.brand}</span>` : ''}
                ${result.model ? `<span>${result.model}</span>` : ''}
                ${result.price ? `<span style="color:var(--success)">$${fmtNum(result.price)}</span>` : ''}
                <span class="smart-badge ${result.source}">${
                    result.source === 'mine'
                        ? 'tuyo'
                        : result.source === 'device_catalog'
                            ? 'equipo'
                            : result.source === 'api_device'
                                ? 'api'
                                : result.source === 'api_catalog'
                                    ? 'compatible'
                            : result.source === 'template'
                                ? 'sugerido'
                                : 'catalogo'
                }</span>
            </div>
        </div>`;

    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', () => {
        input.value = result.name;
        hideDropdown(dropdown);

        const typeField = document.getElementById('purchaseProductType');
        if (typeField) {
            typeField.value = result.type || 'accesorio';
            typeField.dispatchEvent(new Event('change'));
        }

        if (result.price) {
            const priceField = document.getElementById('purchaseSuggestedPrice');
            if (priceField && !priceField.value) priceField.value = result.price;
        }

        if (result.brand) {
            preview.style.display = 'flex';
            preview.innerHTML = `
                <span style="font-size:2rem">${result.emoji || '📦'}</span>
                <div class="preview-info">
                    <strong>${result.name}</strong>
                    ${result.brand ? `<span>${result.brand} ${result.model || ''}</span>` : ''}
                    <span style="color:var(--text-secondary); font-size:.8rem;">${
                        result.type === 'celular'
                            ? 'Equipo sugerido del catalogo'
                            : result.source === 'template'
                                ? 'Referencia sugerida para registrar mas rapido'
                                : 'Accesorio sugerido del catalogo'
                    }</span>
                </div>
                <button type="button" class="preview-close" onclick="this.closest('.product-preview').style.display='none'">x</button>`;
        }
        input.focus();
    });
    return el;
}

// ============================================================
// SERVICIO TECNICO
// ============================================================

const BRANDS = [
    'Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Motorola', 'LG', 'Sony',
    'OnePlus', 'Oppo', 'Vivo', 'Realme', 'Nokia', 'ZTE', 'Tecno',
    'Infinix', 'Honor', 'Asus', 'Lenovo', 'HP', 'Dell', 'Acer', 'Toshiba'
];

const MODELS = {
    Apple: [
        'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
        'iPhone SE 2020', 'iPhone SE 2022',
        'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
        'iPhone 12', 'iPhone 12 Mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
        'iPhone 13', 'iPhone 13 Mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
        'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
        'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
        'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
        'iPad Air', 'iPad Pro'
    ],
    Samsung: [
        'Galaxy A03', 'Galaxy A04', 'Galaxy A05', 'Galaxy A05s', 'Galaxy A06',
        'Galaxy A10', 'Galaxy A11', 'Galaxy A12', 'Galaxy A13', 'Galaxy A14',
        'Galaxy A14 5G', 'Galaxy A15', 'Galaxy A15 5G', 'Galaxy A16', 'Galaxy A20', 'Galaxy A21', 'Galaxy A22',
        'Galaxy A23', 'Galaxy A24', 'Galaxy A25', 'Galaxy A30', 'Galaxy A31',
        'Galaxy A32', 'Galaxy A33', 'Galaxy A34', 'Galaxy A35', 'Galaxy A50',
        'Galaxy A51', 'Galaxy A52', 'Galaxy A53', 'Galaxy A54', 'Galaxy A55',
        'Galaxy M12', 'Galaxy M13', 'Galaxy M14', 'Galaxy M15', 'Galaxy M23', 'Galaxy M33', 'Galaxy M34',
        'Galaxy S20 FE', 'Galaxy S21', 'Galaxy S21 FE', 'Galaxy S22', 'Galaxy S23', 'Galaxy S23 FE', 'Galaxy S24', 'Galaxy S24 Plus', 'Galaxy S24 Ultra',
        'Galaxy Note 20', 'Galaxy Tab A8'
    ],
    Huawei: ['P30 Lite', 'P40 Lite', 'P50', 'Nova 9', 'Nova 11', 'Y9s', 'Y7a', 'Y8p', 'Y9a', 'Mate 50'],
    Xiaomi: [
        'Redmi 9A', 'Redmi 9C', 'Redmi 10', 'Redmi 10A', 'Redmi 10C', 'Redmi 12', 'Redmi 12C', 'Redmi 13', 'Redmi 13C',
        'Redmi Note 9', 'Redmi Note 10', 'Redmi Note 10 5G', 'Redmi Note 11', 'Redmi Note 11S', 'Redmi Note 11 Pro', 'Redmi Note 12',
        'Redmi Note 12 Pro 4G', 'Redmi Note 13', 'Redmi Note 13 Pro', 'Redmi Note 13 Pro 4G', 'Redmi Note 13 Pro 5G',
        'POCO C65', 'POCO M3 Pro 5G', 'POCO M4 Pro', 'POCO M5', 'POCO M6 Pro', 'POCO X3', 'POCO X4 Pro', 'POCO X5', 'POCO X6'
    ],
    Motorola: ['Moto E20', 'Moto E30', 'Moto E40', 'Moto G10', 'Moto G20', 'Moto G30', 'Moto G14', 'Moto G24', 'Moto G34', 'Moto G54', 'Moto G73', 'Moto G84', 'Edge 40', 'Edge 50'],
    Honor: ['X6', 'X6A', 'X7', 'X7A', 'X7B', 'X8', 'X8 5G', 'X8A', 'X8C', 'X9A', '90 Lite', '90 Smart 5G', '200 Lite', '400 Lite', 'Magic5 Lite', 'Magic6'],
    Realme: ['C30', 'C35', 'C51', 'C53', 'C55', 'C61', 'C63', '10', '11', 'Note 50', 'Note 60', 'GT Neo 5'],
    Oppo: ['A17', 'A18', 'A38', 'A40', 'A40m', 'A58', 'A60', 'A60 5G', 'A80 5G', 'Reno 7', 'Reno 8'],
    Vivo: ['Y16', 'Y17s', 'Y22', 'Y27', 'Y36', 'V29'],
    Tecno: ['Spark 10', 'Spark 20', 'Spark 20C', 'Spark Go 2024', 'Camon 18', 'Camon 20', 'Pova 5'],
    Infinix: ['Hot 10', 'Hot 20', 'Hot 30', 'Hot 40', 'Hot 40i', 'Smart 8', 'Note 12', 'Note 30']
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
        const matches = BRANDS.filter(brand => !q || normalize(brand).includes(q)).slice(0, 8);
        if (!matches.length) {
            hideDropdown(dropdown);
            return;
        }

        dropdown.innerHTML = matches.map(brand => `
            <div class="smart-item" data-brand="${brand}">
                <span class="smart-emoji">📱</span>
                <div class="smart-info"><div class="smart-name">${brand}</div></div>
            </div>`).join('');

        dropdown.querySelectorAll('.smart-item').forEach(el => {
            el.addEventListener('mousedown', e => e.preventDefault());
            el.addEventListener('click', () => {
                brandInput.value = el.dataset.brand;
                hideDropdown(dropdown);
                if (typeof updateServiceAccessorySuggestions === 'function') {
                    updateServiceAccessorySuggestions();
                }
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
        timer = setTimeout(() => triggerModelSuggestions(modelInput, brandInput, dropdown), 120);
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
    const matches = pool.filter(model => !q || normalize(model).includes(q)).slice(0, 8);

    if (!matches.length) {
        hideDropdown(dropdown);
        return;
    }

    dropdown.innerHTML = (brand ? `<div class="smart-sep">Modelos ${brand}</div>` : '') +
        matches.map(model => `
            <div class="smart-item" data-model="${model}">
                <span class="smart-emoji">📲</span>
                <div class="smart-info"><div class="smart-name">${model}</div></div>
            </div>`).join('');

    dropdown.querySelectorAll('.smart-item').forEach(el => {
        el.addEventListener('mousedown', e => e.preventDefault());
        el.addEventListener('click', () => {
            modelInput.value = el.dataset.model;
            hideDropdown(dropdown);
            if (typeof updateServiceAccessorySuggestions === 'function') {
                updateServiceAccessorySuggestions();
            }
        });
    });

    dropdown.style.display = 'block';
}

// ============================================================
// UTILIDADES
// ============================================================

function normalize(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fmtNum(n) {
    return Number(n).toLocaleString('es-CO');
}

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
    if (dropdown) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
    }
}

function setupKeyboard(input, dropdown) {
    input.addEventListener('keydown', e => {
        const items = dropdown.querySelectorAll('.smart-item');
        const active = dropdown.querySelector('.smart-item.active');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!active) {
                items[0]?.classList.add('active');
            } else {
                active.classList.remove('active');
                (active.nextElementSibling || items[0])?.classList.add('active');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!active) {
                items[items.length - 1]?.classList.add('active');
            } else {
                active.classList.remove('active');
                (active.previousElementSibling || items[items.length - 1])?.classList.add('active');
            }
        } else if (e.key === 'Enter' && active) {
            e.preventDefault();
            active.click();
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

// ============================================================
// INICIALIZAR AL CAMBIAR DE VISTA
// ============================================================

const _smartInit = {};

function maybeInitSmartSearch(view) {
    if (view === 'purchases' && !_smartInit.purchases) {
        setTimeout(() => {
            initPurchaseSmartSearch();
            _smartInit.purchases = true;
        }, 150);
    }

    if (view === 'technical' && !_smartInit.technical) {
        setTimeout(() => {
            initTechnicalSmartSearch();
            _smartInit.technical = true;
        }, 150);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            if (view) maybeInitSmartSearch(view);
        });
    });

    const activeView = document.querySelector('.nav-btn.active')?.getAttribute('data-view');
    if (activeView) maybeInitSmartSearch(activeView);
});

window.searchPurchaseCatalog = searchPurchaseCatalog;
window.getPurchaseCatalog = getPurchaseCatalog;
