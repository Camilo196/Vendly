const CompatibilityAdminState = {
    initialized: false,
    meta: null,
    brands: [],
    subtypes: [],
    groups: [],
    catalog: [],
    specs: [],
    audit: []
};

function compatAdminEl(id) {
    return document.getElementById(id);
}

function compatAdminEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function compatAdminToast(message, type = 'success') {
    if (window.utils && typeof window.utils.showToast === 'function') {
        window.utils.showToast(message, type);
        return;
    }
    console[type === 'error' ? 'error' : 'log'](message);
}

function compatAdminDebounce(fn, delay = 250) {
    let timeoutId = null;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

function compatAdminFormatNumber(value) {
    return new Intl.NumberFormat('es-CO').format(Number(value || 0));
}

function compatAdminCapitalize(value = '') {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function compatAdminParseCsvList(value = '') {
    return String(value || '')
        .split(/[,\n]/)
        .map(item => item.trim())
        .filter(Boolean);
}

function compatAdminParseMembers(value = '') {
    return String(value || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(model => ({ model, aliases: [] }));
}

function compatAdminParseEquivalentModels(value = '', fallbackBrand = '') {
    return compatAdminParseCsvList(value).map(model => ({
        brand: fallbackBrand || '',
        model,
        kind: 'full'
    }));
}

function compatAdminParseDelimitedLine(line = '', delimiter = ',') {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === delimiter && !inQuotes) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current.trim());
    return values;
}

function compatAdminParseCsv(raw = '', type = 'catalog') {
    const lines = String(raw || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        throw new Error('El CSV necesita encabezados y al menos una fila');
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = compatAdminParseDelimitedLine(lines[0], delimiter).map(header => header.trim().toLowerCase());

    const rows = lines.slice(1).map(line => {
        const columns = compatAdminParseDelimitedLine(line, delimiter);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = columns[index] || '';
        });
        return row;
    });

    if (type === 'groups') {
        return rows.map((row, index) => ({
            id: row.id || row.codigo || `group_csv_${Date.now()}_${index}`,
            label: row.label || row.etiqueta || row.nombre || '',
            brand: row.brand || row.marca || '',
            profileType: row.profiletype || row.tipo || 'mismo_molde',
            supportedSubtypes: compatAdminParseCsvList(row.supportedsubtypes || row.subtypes || row.tipos || row.tipoaccesorio || ''),
            notes: row.notes || row.notas || '',
            members: compatAdminParseCsvList(row.members || row.modelos || row.compatibles || '').map(model => ({ model, aliases: [] }))
        }));
    }

    if (type === 'specs' || type === 'device_specs') {
        return rows.map((row, index) => ({
            id: row.id || row.codigo || `spec_csv_${Date.now()}_${index}`,
            brand: row.brand || row.marca || '',
            model: row.model || row.modelo || '',
            heightMm: row.heightmm || row.alto || '',
            widthMm: row.widthmm || row.ancho || '',
            thicknessMm: row.thicknessmm || row.grosor || '',
            connector: row.connector || row.conector || '',
            cameraLayout: row.cameralayout || row.camaras || '',
            buttons: row.buttons || row.botones || '',
            caseProfile: row.caseprofile || row.perfilestuche || '',
            screenProfile: row.screenprofile || row.perfilvidrio || '',
            confidence: row.confidence || row.confianza || '',
            source: {
                name: row.source || row.fuente || '',
                url: row.sourceurl || row.url || '',
                type: 'import'
            },
            equivalents: compatAdminParseEquivalentModels(row.equivalents || row.equivalentes || '', row.brand || row.marca || '')
        }));
    }

    return rows.map((row, index) => ({
        id: row.id || row.codigo || `catalog_csv_${Date.now()}_${index}`,
        name: row.name || row.nombre || '',
        brand: row.brand || row.marca || '',
        model: row.model || row.modelo || '',
        subtype: row.subtype || row.tipo || row.tipoaccesorio || 'accesorio',
        type: row.type || row.clase || 'accesorio',
        emoji: row.emoji || '',
        keywords: row.keywords || row.palabras || row.tags || ''
    }));
}

function compatAdminGroupMembersText(group = {}) {
    return Array.isArray(group.members)
        ? group.members.map(member => member.model).filter(Boolean).join('\n')
        : '';
}

function compatAdminDownloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function compatAdminSetSelectOptions(selectId, values = [], placeholder = 'Todos') {
    const select = compatAdminEl(selectId);
    if (!select) return;

    const current = select.value;
    select.innerHTML = `<option value="">${compatAdminEscape(placeholder)}</option>`;
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === current)) {
        select.value = current;
    }
}

function compatAdminRenderStats() {
    const container = compatAdminEl('compatibilityAdminStats');
    if (!container) return;

    const stats = CompatibilityAdminState.meta?.stats || {};
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Referencias API</div>
            <div class="stat-value">${compatAdminFormatNumber(stats.totalAccessories || CompatibilityAdminState.catalog.length)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Grupos físicos</div>
            <div class="stat-value">${compatAdminFormatNumber(CompatibilityAdminState.meta?.totalGroups || CompatibilityAdminState.groups.length)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Marcas</div>
            <div class="stat-value">${compatAdminFormatNumber((CompatibilityAdminState.meta?.brands || CompatibilityAdminState.brands).length)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Tipos</div>
            <div class="stat-value">${compatAdminFormatNumber(CompatibilityAdminState.subtypes.length)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Fichas técnicas</div>
            <div class="stat-value">${compatAdminFormatNumber(CompatibilityAdminState.meta?.totalDeviceSpecs || CompatibilityAdminState.specs.length)}</div>
        </div>
    `;
}

function compatAdminRenderCatalog(items = []) {
    const container = compatAdminEl('compatibilityAdminCatalogList');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = '<div class="compat-admin-empty">No hay referencias que coincidan con el filtro.</div>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="compat-admin-item">
            <div class="compat-admin-item-main">
                <div class="compat-admin-item-title-row">
                    <strong>${compatAdminEscape(item.name)}</strong>
                    <span class="compat-admin-pill">${compatAdminEscape(compatAdminCapitalize(item.subtype || 'accesorio'))}</span>
                </div>
                <div class="compat-admin-item-meta">
                    <span>${compatAdminEscape(item.brand || 'Sin marca')}</span>
                    <span>${compatAdminEscape(item.model || 'Sin modelo')}</span>
                    ${item.supplierReferences?.[0]?.sku ? `<span>SKU: ${compatAdminEscape(item.supplierReferences[0].sku)}</span>` : ''}
                    ${item.supplierReferences?.[0]?.supplier ? `<span>${compatAdminEscape(item.supplierReferences[0].supplier)}</span>` : ''}
                    ${item.confidence ? `<span>Confianza ${compatAdminEscape(item.confidence)}%</span>` : ''}
                    <span>ID: ${compatAdminEscape(item.id || '')}</span>
                </div>
                <div class="compat-admin-item-notes">${compatAdminEscape(item.keywords || 'Sin keywords')}</div>
            </div>
            <div class="compat-admin-item-actions">
                <button type="button" class="btn btn-sm" data-action="purchase-catalog" data-id="${compatAdminEscape(item.id || '')}">Compras</button>
                <button type="button" class="btn btn-sm" data-action="edit-catalog" data-id="${compatAdminEscape(item.id || '')}">Editar</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="delete-catalog" data-id="${compatAdminEscape(item.id || '')}">Borrar</button>
            </div>
        </div>
    `).join('');
}

function compatAdminRenderGroups(groups = []) {
    const container = compatAdminEl('compatibilityAdminGroups');
    if (!container) return;

    if (!groups.length) {
        container.innerHTML = '<div class="compat-admin-empty">No hay grupos que coincidan con el filtro.</div>';
        return;
    }

    container.innerHTML = groups.map(group => `
        <div class="compat-admin-item">
            <div class="compat-admin-item-main">
                <div class="compat-admin-item-title-row">
                    <strong>${compatAdminEscape(group.label || group.id || 'Grupo')}</strong>
                    <span class="compat-admin-pill">${compatAdminEscape(compatAdminCapitalize(group.profileType || 'mismo_molde').replace(/_/g, ' '))}</span>
                </div>
                <div class="compat-admin-item-meta">
                    <span>${compatAdminEscape(group.brand || 'Multimarca')}</span>
                    <span>${Array.isArray(group.supportedSubtypes) && group.supportedSubtypes.length ? compatAdminEscape(group.supportedSubtypes.join(', ')) : 'Todos los tipos'}</span>
                    <span>${compatAdminFormatNumber((group.members || []).length)} modelos</span>
                    ${group.confidence ? `<span>Confianza ${compatAdminEscape(group.confidence)}%</span>` : ''}
                    <span>ID: ${compatAdminEscape(group.id || '')}</span>
                </div>
                <div class="compat-admin-item-notes">
                    ${(group.members || []).slice(0, 6).map(member => compatAdminEscape(member.model)).join(' • ') || 'Sin miembros'}
                </div>
                ${group.notes ? `<div class="compat-admin-item-notes">${compatAdminEscape(group.notes)}</div>` : ''}
            </div>
            <div class="compat-admin-item-actions">
                <button type="button" class="btn btn-sm" data-action="edit-group" data-id="${compatAdminEscape(group.id || '')}">Editar</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="delete-group" data-id="${compatAdminEscape(group.id || '')}">Borrar</button>
            </div>
        </div>
    `).join('');
}

function compatAdminRenderSpecs(specs = []) {
    const container = compatAdminEl('compatibilityAdminSpecs');
    if (!container) return;

    if (!specs.length) {
        container.innerHTML = '<div class="compat-admin-empty">No hay fichas técnicas cargadas para este filtro.</div>';
        return;
    }

    container.innerHTML = specs.map(spec => `
        <div class="compat-admin-item">
            <div class="compat-admin-item-main">
                <div class="compat-admin-item-title-row">
                    <strong>${compatAdminEscape([spec.brand, spec.model].filter(Boolean).join(' '))}</strong>
                    <span class="compat-admin-pill">Confianza ${compatAdminEscape(spec.confidence || '0')}%</span>
                </div>
                <div class="compat-admin-item-meta">
                    ${spec.dimensions?.heightMm ? `<span>Alto ${compatAdminEscape(spec.dimensions.heightMm)} mm</span>` : ''}
                    ${spec.dimensions?.widthMm ? `<span>Ancho ${compatAdminEscape(spec.dimensions.widthMm)} mm</span>` : ''}
                    ${spec.dimensions?.thicknessMm ? `<span>Grosor ${compatAdminEscape(spec.dimensions.thicknessMm)} mm</span>` : ''}
                    ${spec.physical?.connector ? `<span>${compatAdminEscape(spec.physical.connector)}</span>` : ''}
                </div>
                <div class="compat-admin-item-notes">
                    ${compatAdminEscape(spec.physical?.cameraLayout || spec.physical?.buttons || spec.notes || 'Sin detalles físicos todavía')}
                </div>
                <div class="compat-admin-item-notes">
                    Perfil estuche: ${compatAdminEscape(spec.profiles?.caseProfile || 'N/A')} | Perfil vidrio: ${compatAdminEscape(spec.profiles?.screenProfile || 'N/A')}
                </div>
            </div>
            <div class="compat-admin-item-actions">
                <button type="button" class="btn btn-sm" data-action="edit-spec" data-id="${compatAdminEscape(spec.id || '')}">Editar</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="delete-spec" data-id="${compatAdminEscape(spec.id || '')}">Borrar</button>
            </div>
        </div>
    `).join('');
}

function compatAdminRenderAudit(entries = []) {
    const container = compatAdminEl('compatibilityAdminAuditList');
    if (!container) return;

    if (!entries.length) {
        container.innerHTML = '<div class="compat-admin-empty">Aún no hay cambios registrados.</div>';
        return;
    }

    container.innerHTML = entries.map(entry => `
        <div class="compat-admin-item">
            <div class="compat-admin-item-main">
                <div class="compat-admin-item-title-row">
                    <strong>${compatAdminEscape((entry.action || 'update').toUpperCase())}</strong>
                    <span class="compat-admin-pill">${compatAdminEscape(entry.entityType || 'compatibility')}</span>
                </div>
                <div class="compat-admin-item-meta">
                    <span>${compatAdminEscape(entry.label || entry.entityId || '')}</span>
                    <span>${compatAdminEscape(entry.userBusiness || entry.userEmail || 'Sistema')}</span>
                    <span>${compatAdminEscape(new Date(entry.createdAt).toLocaleString('es-CO'))}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function compatAdminResetCatalogForm() {
    compatAdminEl('compatAdminCatalogId').value = '';
    compatAdminEl('formCompatibilityCatalog')?.reset();
    compatAdminEl('btnCompatibilityCatalogSave').textContent = 'Guardar Referencia';
}

function compatAdminResetGroupForm() {
    compatAdminEl('compatAdminGroupOriginalId').value = '';
    compatAdminEl('formCompatibilityGroup')?.reset();
    compatAdminEl('btnCompatibilityGroupSave').textContent = 'Guardar Grupo';
}

function compatAdminResetSpecForm() {
    compatAdminEl('compatAdminSpecId').value = '';
    compatAdminEl('formCompatibilitySpec')?.reset();
    compatAdminEl('btnCompatibilitySpecSave').textContent = 'Guardar Ficha';
}

function compatAdminEditCatalog(id) {
    const item = CompatibilityAdminState.catalog.find(entry => entry.id === id);
    if (!item) return;

    compatAdminEl('compatAdminCatalogId').value = item.id || '';
    compatAdminEl('compatAdminCatalogName').value = item.name || '';
    compatAdminEl('compatAdminCatalogBrand').value = item.brand || '';
    compatAdminEl('compatAdminCatalogModel').value = item.model || '';
    compatAdminEl('compatAdminCatalogSubtype').value = item.subtype || 'estuche';
    compatAdminEl('compatAdminCatalogKeywords').value = item.keywords || '';
    compatAdminEl('compatAdminCatalogSupplier').value = item.supplierReferences?.[0]?.supplier || '';
    compatAdminEl('compatAdminCatalogSku').value = item.supplierReferences?.[0]?.sku || '';
    compatAdminEl('compatAdminCatalogConfidence').value = item.confidence || '';
    compatAdminEl('compatAdminCatalogSourceName').value = item.source?.name || '';
    compatAdminEl('compatAdminCatalogSourceUrl').value = item.source?.url || '';
    compatAdminEl('compatAdminCatalogImageUrl').value = item.images?.[0]?.url || '';
    compatAdminEl('compatAdminCatalogEquivalents').value = (item.equivalents || []).map(entry => entry.model).join(', ');
    compatAdminEl('btnCompatibilityCatalogSave').textContent = 'Actualizar Referencia';
    compatAdminEl('formCompatibilityCatalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function compatAdminEditGroup(id) {
    const group = CompatibilityAdminState.groups.find(entry => entry.id === id);
    if (!group) return;

    compatAdminEl('compatAdminGroupOriginalId').value = group.id || '';
    compatAdminEl('compatAdminGroupId').value = group.id || '';
    compatAdminEl('compatAdminGroupLabel').value = group.label || '';
    compatAdminEl('compatAdminGroupBrand').value = group.brand || '';
    compatAdminEl('compatAdminGroupProfileType').value = group.profileType || 'mismo_molde';
    compatAdminEl('compatAdminGroupSubtypes').value = Array.isArray(group.supportedSubtypes) ? group.supportedSubtypes.join(', ') : '';
    compatAdminEl('compatAdminGroupMembers').value = compatAdminGroupMembersText(group);
    compatAdminEl('compatAdminGroupNotes').value = group.notes || '';
    compatAdminEl('compatAdminGroupSourceName').value = group.source?.name || '';
    compatAdminEl('compatAdminGroupSourceUrl').value = group.source?.url || '';
    compatAdminEl('compatAdminGroupConfidence').value = group.confidence || '';
    compatAdminEl('btnCompatibilityGroupSave').textContent = 'Actualizar Grupo';
    compatAdminEl('formCompatibilityGroup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function compatAdminEditSpec(id) {
    const spec = CompatibilityAdminState.specs.find(entry => entry.id === id);
    if (!spec) return;

    compatAdminEl('compatAdminSpecId').value = spec.id || '';
    compatAdminEl('compatAdminSpecBrand').value = spec.brand || '';
    compatAdminEl('compatAdminSpecModel').value = spec.model || '';
    compatAdminEl('compatAdminSpecHeight').value = spec.dimensions?.heightMm || '';
    compatAdminEl('compatAdminSpecWidth').value = spec.dimensions?.widthMm || '';
    compatAdminEl('compatAdminSpecThickness').value = spec.dimensions?.thicknessMm || '';
    compatAdminEl('compatAdminSpecCaseProfile').value = spec.profiles?.caseProfile || '';
    compatAdminEl('compatAdminSpecScreenProfile').value = spec.profiles?.screenProfile || '';
    compatAdminEl('compatAdminSpecConnector').value = spec.physical?.connector || '';
    compatAdminEl('compatAdminSpecCameraLayout').value = spec.physical?.cameraLayout || '';
    compatAdminEl('compatAdminSpecButtons').value = spec.physical?.buttons || '';
    compatAdminEl('compatAdminSpecConfidence').value = spec.confidence || '';
    compatAdminEl('compatAdminSpecSourceName').value = spec.source?.name || '';
    compatAdminEl('compatAdminSpecSourceUrl').value = spec.source?.url || '';
    compatAdminEl('compatAdminSpecEquivalents').value = (spec.equivalents || []).map(entry => entry.model).join(', ');
    compatAdminEl('btnCompatibilitySpecSave').textContent = 'Actualizar Ficha';
    compatAdminEl('formCompatibilitySpec')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function compatAdminDeleteCatalog(id) {
    if (!window.confirm('¿Eliminar esta referencia del catálogo?')) return;
    await api.deleteCompatibilityCatalogItem(id);
    compatAdminToast('Referencia eliminada');
    await loadCompatibilityApiView(true);
}

async function compatAdminDeleteGroup(id) {
    if (!window.confirm('¿Eliminar este grupo de compatibilidad?')) return;
    await api.deleteCompatibilityGroup(id);
    compatAdminToast('Grupo eliminado');
    await loadCompatibilityApiView(true);
}

async function compatAdminDeleteSpec(id) {
    if (!window.confirm('¿Eliminar esta ficha técnica?')) return;
    await api.deleteCompatibilitySpec(id);
    compatAdminToast('Ficha técnica eliminada');
    await loadCompatibilityApiView(true);
}

function compatAdminFillPurchaseForm(item) {
    const apply = () => {
        const nameField = document.getElementById('purchaseProductName');
        const typeField = document.getElementById('purchaseProductType');
        const priceField = document.getElementById('purchaseSuggestedPrice');
        if (!nameField || !typeField) return;

        nameField.value = item.name || [item.subtype, item.brand, item.model].filter(Boolean).join(' ');
        typeField.value = 'accesorio';
        typeField.dispatchEvent(new Event('change'));
        if (priceField && !priceField.value) priceField.value = '';
        document.getElementById('purchaseQuantity')?.focus();
        compatAdminToast('Referencia enviada a Compras');
    };

    const purchasesButton = document.querySelector('.nav-btn[data-view="purchases"]');
    if (purchasesButton) purchasesButton.click();
    setTimeout(apply, 200);
}

function compatAdminUseCurrentCatalogInPurchases() {
    const name = compatAdminEl('compatAdminCatalogName').value.trim();
    const brand = compatAdminEl('compatAdminCatalogBrand').value.trim();
    const model = compatAdminEl('compatAdminCatalogModel').value.trim();
    const subtype = compatAdminEl('compatAdminCatalogSubtype').value;

    if (!name || !brand || !model) {
        compatAdminToast('Completa nombre, marca y modelo antes de enviarlo a Compras', 'error');
        return;
    }

    compatAdminFillPurchaseForm({ name, brand, model, subtype });
}

async function compatAdminExport(type) {
    if (type === 'catalog') {
        const response = await api.getCompatibilityCatalog({ limit: 5000 });
        compatAdminDownloadJson(`compatibility-catalog-${Date.now()}.json`, response.items || []);
        compatAdminToast('Catálogo exportado');
        return;
    }

    if (type === 'specs') {
        const response = await api.getCompatibilitySpecs({ limit: 5000 });
        compatAdminDownloadJson(`compatibility-specs-${Date.now()}.json`, response.specs || []);
        compatAdminToast('Fichas exportadas');
        return;
    }

    const response = await api.getCompatibilityGroups({ limit: 5000 });
    compatAdminDownloadJson(`compatibility-groups-${Date.now()}.json`, response.groups || []);
    compatAdminToast('Grupos exportados');
}

async function compatAdminImport() {
    const type = compatAdminEl('compatImportType').value;
    const mode = compatAdminEl('compatImportMode').value;
    const raw = compatAdminEl('compatImportPayload').value.trim();

    if (!raw) {
        compatAdminToast('Pega un arreglo JSON o carga un archivo antes de importar', 'error');
        return;
    }

    let items;
    try {
        items = JSON.parse(raw);
    } catch (error) {
        try {
            items = compatAdminParseCsv(raw, type);
        } catch (csvError) {
            compatAdminToast('El contenido no es JSON válido ni CSV reconocible', 'error');
            return;
        }
    }

    if (!Array.isArray(items)) {
        compatAdminToast('La importación debe ser un arreglo JSON', 'error');
        return;
    }

    const response = await api.importCompatibilityData({ type, mode, items });
    compatAdminToast(`Importación completada. Total ${type === 'catalog' ? 'referencias' : 'grupos'}: ${compatAdminFormatNumber(response.count || items.length)}`);
    compatAdminEl('compatImportPayload').value = '';
    compatAdminEl('compatImportFile').value = '';
    await loadCompatibilityApiView(true);
}

async function compatAdminSaveCatalog(event) {
    event.preventDefault();

    const id = compatAdminEl('compatAdminCatalogId').value.trim();
    const payload = {
        name: compatAdminEl('compatAdminCatalogName').value.trim(),
        brand: compatAdminEl('compatAdminCatalogBrand').value.trim(),
        model: compatAdminEl('compatAdminCatalogModel').value.trim(),
        subtype: compatAdminEl('compatAdminCatalogSubtype').value,
        type: 'accesorio',
        keywords: compatAdminEl('compatAdminCatalogKeywords').value.trim(),
        confidence: Number(compatAdminEl('compatAdminCatalogConfidence').value || 0) || undefined,
        source: {
            name: compatAdminEl('compatAdminCatalogSourceName').value.trim(),
            url: compatAdminEl('compatAdminCatalogSourceUrl').value.trim(),
            type: 'manual'
        },
        supplierReferences: [{
            supplier: compatAdminEl('compatAdminCatalogSupplier').value.trim(),
            sku: compatAdminEl('compatAdminCatalogSku').value.trim()
        }].filter(item => item.supplier || item.sku),
        images: [{
            url: compatAdminEl('compatAdminCatalogImageUrl').value.trim(),
            label: 'principal',
            type: 'image'
        }].filter(item => item.url),
        equivalents: compatAdminParseEquivalentModels(
            compatAdminEl('compatAdminCatalogEquivalents').value,
            compatAdminEl('compatAdminCatalogBrand').value.trim()
        )
    };

    if (!payload.name || !payload.brand || !payload.model) {
        compatAdminToast('Completa nombre, marca y modelo', 'error');
        return;
    }

    if (id) {
        await api.updateCompatibilityCatalogItem(id, payload);
        compatAdminToast('Referencia actualizada');
    } else {
        await api.createCompatibilityCatalogItem(payload);
        compatAdminToast('Referencia creada');
    }

    compatAdminResetCatalogForm();
    await loadCompatibilityApiView(true);
}

async function compatAdminSaveGroup(event) {
    event.preventDefault();

    const originalId = compatAdminEl('compatAdminGroupOriginalId').value.trim();
    const payload = {
        id: compatAdminEl('compatAdminGroupId').value.trim(),
        label: compatAdminEl('compatAdminGroupLabel').value.trim(),
        brand: compatAdminEl('compatAdminGroupBrand').value.trim(),
        profileType: compatAdminEl('compatAdminGroupProfileType').value,
        supportedSubtypes: compatAdminParseCsvList(compatAdminEl('compatAdminGroupSubtypes').value),
        members: compatAdminParseMembers(compatAdminEl('compatAdminGroupMembers').value),
        notes: compatAdminEl('compatAdminGroupNotes').value.trim(),
        confidence: Number(compatAdminEl('compatAdminGroupConfidence').value || 0) || undefined,
        source: {
            name: compatAdminEl('compatAdminGroupSourceName').value.trim(),
            url: compatAdminEl('compatAdminGroupSourceUrl').value.trim(),
            type: 'manual'
        }
    };

    if (!payload.id || !payload.label || !payload.members.length) {
        compatAdminToast('Completa ID, etiqueta y por lo menos un modelo', 'error');
        return;
    }

    if (originalId) {
        if (originalId !== payload.id) {
            await api.createCompatibilityGroup(payload);
            await api.deleteCompatibilityGroup(originalId);
        } else {
            await api.updateCompatibilityGroup(originalId, payload);
        }
        compatAdminToast('Grupo actualizado');
    } else {
        await api.createCompatibilityGroup(payload);
        compatAdminToast('Grupo creado');
    }

    compatAdminResetGroupForm();
    await loadCompatibilityApiView(true);
}

async function compatAdminSaveSpec(event) {
    event.preventDefault();

    const id = compatAdminEl('compatAdminSpecId').value.trim();
    const payload = {
        brand: compatAdminEl('compatAdminSpecBrand').value.trim(),
        model: compatAdminEl('compatAdminSpecModel').value.trim(),
        heightMm: Number(compatAdminEl('compatAdminSpecHeight').value || 0) || undefined,
        widthMm: Number(compatAdminEl('compatAdminSpecWidth').value || 0) || undefined,
        thicknessMm: Number(compatAdminEl('compatAdminSpecThickness').value || 0) || undefined,
        caseProfile: compatAdminEl('compatAdminSpecCaseProfile').value.trim(),
        screenProfile: compatAdminEl('compatAdminSpecScreenProfile').value.trim(),
        connector: compatAdminEl('compatAdminSpecConnector').value.trim(),
        cameraLayout: compatAdminEl('compatAdminSpecCameraLayout').value.trim(),
        buttons: compatAdminEl('compatAdminSpecButtons').value.trim(),
        confidence: Number(compatAdminEl('compatAdminSpecConfidence').value || 0) || undefined,
        source: {
            name: compatAdminEl('compatAdminSpecSourceName').value.trim(),
            url: compatAdminEl('compatAdminSpecSourceUrl').value.trim(),
            type: 'manual'
        },
        equivalents: compatAdminParseEquivalentModels(
            compatAdminEl('compatAdminSpecEquivalents').value,
            compatAdminEl('compatAdminSpecBrand').value.trim()
        )
    };

    if (!payload.brand || !payload.model) {
        compatAdminToast('Completa marca y modelo de la ficha técnica', 'error');
        return;
    }

    if (id) {
        await api.updateCompatibilitySpec(id, payload);
        compatAdminToast('Ficha técnica actualizada');
    } else {
        await api.createCompatibilitySpec(payload);
        compatAdminToast('Ficha técnica creada');
    }

    compatAdminResetSpecForm();
    await loadCompatibilityApiView(true);
}

async function compatAdminLoadData() {
    const groupFilters = {
        brand: compatAdminEl('compatAdminGroupBrandFilter')?.value || '',
        subtype: compatAdminEl('compatAdminGroupSubtypeFilter')?.value || '',
        query: compatAdminEl('compatAdminGroupQuery')?.value.trim() || '',
        limit: 400
    };

    const catalogFilters = {
        brand: compatAdminEl('compatAdminCatalogBrandFilter')?.value || '',
        subtype: compatAdminEl('compatAdminCatalogSubtypeFilter')?.value || '',
        query: compatAdminEl('compatAdminCatalogQuery')?.value.trim() || '',
        limit: 500
    };

    const specsFilters = {
        query: compatAdminEl('compatAdminSpecQuery')?.value.trim() || '',
        limit: 300
    };

    const [
        metaResponse,
        brandsResponse,
        subtypesResponse,
        groupsResponse,
        catalogResponse,
        specsResponse,
        auditResponse
    ] = await Promise.all([
        api.getCompatibilityMeta(),
        api.getCompatibilityBrands(),
        api.getCompatibilitySubtypes(),
        api.getCompatibilityGroups(groupFilters),
        api.getCompatibilityCatalog(catalogFilters),
        api.getCompatibilitySpecs(specsFilters),
        api.getCompatibilityAuditLog(80)
    ]);

    CompatibilityAdminState.meta = metaResponse || null;
    CompatibilityAdminState.brands = brandsResponse?.brands || [];
    CompatibilityAdminState.subtypes = subtypesResponse?.subtypes || [];
    CompatibilityAdminState.groups = groupsResponse?.groups || [];
    CompatibilityAdminState.catalog = catalogResponse?.items || [];
    CompatibilityAdminState.specs = specsResponse?.specs || [];
    CompatibilityAdminState.audit = auditResponse?.entries || [];

    compatAdminSetSelectOptions('compatAdminGroupBrandFilter', CompatibilityAdminState.brands, 'Todas las marcas');
    compatAdminSetSelectOptions('compatAdminCatalogBrandFilter', CompatibilityAdminState.brands, 'Todas las marcas');
    compatAdminSetSelectOptions('compatAdminGroupSubtypeFilter', CompatibilityAdminState.subtypes, 'Todos los tipos');
    compatAdminSetSelectOptions('compatAdminCatalogSubtypeFilter', CompatibilityAdminState.subtypes, 'Todos los tipos');

    compatAdminRenderStats();
    compatAdminRenderGroups(CompatibilityAdminState.groups);
    compatAdminRenderCatalog(CompatibilityAdminState.catalog);
    compatAdminRenderSpecs(CompatibilityAdminState.specs);
    compatAdminRenderAudit(CompatibilityAdminState.audit);
}

function compatAdminBindEvents() {
    if (CompatibilityAdminState.initialized) return;
    CompatibilityAdminState.initialized = true;

    compatAdminEl('formCompatibilityCatalog')?.addEventListener('submit', async event => {
        try {
            await compatAdminSaveCatalog(event);
        } catch (error) {
            console.error('Compatibility catalog save error:', error);
            compatAdminToast(error.message || 'No se pudo guardar la referencia', 'error');
        }
    });

    compatAdminEl('formCompatibilityGroup')?.addEventListener('submit', async event => {
        try {
            await compatAdminSaveGroup(event);
        } catch (error) {
            console.error('Compatibility group save error:', error);
            compatAdminToast(error.message || 'No se pudo guardar el grupo', 'error');
        }
    });

    compatAdminEl('formCompatibilitySpec')?.addEventListener('submit', async event => {
        try {
            await compatAdminSaveSpec(event);
        } catch (error) {
            console.error('Compatibility spec save error:', error);
            compatAdminToast(error.message || 'No se pudo guardar la ficha técnica', 'error');
        }
    });

    compatAdminEl('btnReloadCompatibilityAdmin')?.addEventListener('click', () => loadCompatibilityApiView(true));
    compatAdminEl('btnCompatibilityCatalogReset')?.addEventListener('click', compatAdminResetCatalogForm);
    compatAdminEl('btnCompatibilityGroupReset')?.addEventListener('click', compatAdminResetGroupForm);
    compatAdminEl('btnCompatibilitySpecReset')?.addEventListener('click', compatAdminResetSpecForm);
    compatAdminEl('btnCompatibilityCatalogToPurchases')?.addEventListener('click', compatAdminUseCurrentCatalogInPurchases);
    compatAdminEl('btnCompatibilityAuditReload')?.addEventListener('click', () => loadCompatibilityApiView(true));
    compatAdminEl('btnCompatibilityImport')?.addEventListener('click', async () => {
        try {
            await compatAdminImport();
        } catch (error) {
            console.error('Compatibility import error:', error);
            compatAdminToast(error.message || 'No se pudo importar el JSON', 'error');
        }
    });
    compatAdminEl('btnCompatibilityExportCatalog')?.addEventListener('click', async () => {
        try {
            await compatAdminExport('catalog');
        } catch (error) {
            console.error('Compatibility catalog export error:', error);
            compatAdminToast(error.message || 'No se pudo exportar el catálogo', 'error');
        }
    });
    compatAdminEl('btnCompatibilityExportGroups')?.addEventListener('click', async () => {
        try {
            await compatAdminExport('groups');
        } catch (error) {
            console.error('Compatibility groups export error:', error);
            compatAdminToast(error.message || 'No se pudo exportar los grupos', 'error');
        }
    });
    compatAdminEl('btnCompatibilityExportSpecs')?.addEventListener('click', async () => {
        try {
            await compatAdminExport('specs');
        } catch (error) {
            console.error('Compatibility specs export error:', error);
            compatAdminToast(error.message || 'No se pudo exportar las fichas', 'error');
        }
    });

    compatAdminEl('compatImportFile')?.addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = loadEvent => {
            compatAdminEl('compatImportPayload').value = String(loadEvent.target?.result || '');
        };
        reader.readAsText(file);
    });

    const debouncedReload = compatAdminDebounce(() => loadCompatibilityApiView(true), 280);
    [
        'compatAdminGroupQuery',
        'compatAdminCatalogQuery',
        'compatAdminSpecQuery'
    ].forEach(id => compatAdminEl(id)?.addEventListener('input', debouncedReload));

    [
        'compatAdminGroupBrandFilter',
        'compatAdminGroupSubtypeFilter',
        'compatAdminCatalogBrandFilter',
        'compatAdminCatalogSubtypeFilter'
    ].forEach(id => compatAdminEl(id)?.addEventListener('change', () => loadCompatibilityApiView(true)));

    compatAdminEl('compatibilityAdminCatalogList')?.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const { action, id } = button.dataset;

        try {
            if (action === 'edit-catalog') compatAdminEditCatalog(id);
            if (action === 'delete-catalog') await compatAdminDeleteCatalog(id);
            if (action === 'purchase-catalog') {
                const item = CompatibilityAdminState.catalog.find(entry => entry.id === id);
                if (item) compatAdminFillPurchaseForm(item);
            }
        } catch (error) {
            console.error('Compatibility catalog action error:', error);
            compatAdminToast(error.message || 'No se pudo completar la acción', 'error');
        }
    });

    compatAdminEl('compatibilityAdminGroups')?.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const { action, id } = button.dataset;

        try {
            if (action === 'edit-group') compatAdminEditGroup(id);
            if (action === 'delete-group') await compatAdminDeleteGroup(id);
        } catch (error) {
            console.error('Compatibility group action error:', error);
            compatAdminToast(error.message || 'No se pudo completar la acción', 'error');
        }
    });

    compatAdminEl('compatibilityAdminSpecs')?.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const { action, id } = button.dataset;

        try {
            if (action === 'edit-spec') compatAdminEditSpec(id);
            if (action === 'delete-spec') await compatAdminDeleteSpec(id);
        } catch (error) {
            console.error('Compatibility spec action error:', error);
            compatAdminToast(error.message || 'No se pudo completar la acción', 'error');
        }
    });
}

async function loadCompatibilityApiView(force = false) {
    compatAdminBindEvents();

    if (!force && CompatibilityAdminState.meta) {
        compatAdminRenderStats();
        compatAdminRenderGroups(CompatibilityAdminState.groups);
        compatAdminRenderCatalog(CompatibilityAdminState.catalog);
        compatAdminRenderSpecs(CompatibilityAdminState.specs);
        compatAdminRenderAudit(CompatibilityAdminState.audit);
        return;
    }

    try {
        await compatAdminLoadData();
    } catch (error) {
        console.error('Compatibility admin load error:', error);
        compatAdminToast(error.message || 'No se pudo cargar la API de accesorios', 'error');
    }
}

window.loadCompatibilityApiView = loadCompatibilityApiView;
