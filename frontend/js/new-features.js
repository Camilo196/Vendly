// ========================================
// FUNCIONALIDADES MEJORADAS
// ========================================

let allProducts = [];
let allEmployees = [];
let selectedProduct = null;
let allServices = [];
let allPurchases = [];
let compatibilityCatalogMatches = [];
let compatibilityRelatedModels = [];
let saleSerializedUnits = [];
let accessoryCatalogIndexCache = null;
let compatibilitySearchTimer = null;

const ACCESSORY_SUBTYPE_ORDER = {
    estuche: 1,
    vidrio: 2,
    hidrogel: 3,
    cable: 4,
    cargador: 5,
    audifonos: 6
};

const ACCESSORY_MODEL_CONNECTIVITY_TOKENS = new Set(['4g', '5g', 'lte', '2022', '2023', '2024', '2025', '2026']);
const ACCESSORY_MODEL_EDITION_TOKENS = new Set(['pro', 'max', 'plus', 'ultra', 'mini', 'lite', 'fe', 'play', 'prime', 'neo', 'power']);
const ACCESSORY_MODEL_FAMILY_IGNORE_TOKENS = new Set(['galaxy', 'moto']);
const ACCESSORY_SUBTYPE_HINTS = {
    estuche: ['estuche', 'forro', 'funda', 'case', 'cover'],
    vidrio: ['vidrio', 'templado', 'glass', 'mica', 'protector'],
    hidrogel: ['hidrogel', 'lamina', 'film', 'corte'],
    cable: ['cable', 'cargador', 'usb', 'tipo c', 'lightning', 'micro usb'],
    cargador: ['cargador', 'power bank', 'carga'],
    audifonos: ['audifonos', 'bluetooth', 'manos libres']
};

function getCompatibilityGroups() {
    return Array.isArray(window.DEVICE_COMPATIBILITY_GROUPS) ? window.DEVICE_COMPATIBILITY_GROUPS : [];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function compactNormalized(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, '');
}

function normalizeCompatibilityModelReference(brand = '', model = '') {
    const normalizedBrand = normalizeWhitespace(brand);
    const cleanedModel = stripKnownModelPrefixes(normalizedBrand, model);
    const joined = normalizeWhitespace([normalizedBrand, cleanedModel].filter(Boolean).join(' '));
    return {
        joined,
        compact: compactNormalized(joined || cleanedModel || model)
    };
}

function groupMemberMatches(member, brand = '', model = '', aliases = []) {
    const memberRef = normalizeCompatibilityModelReference(brand, member.model || '');
    const memberAliases = [
        member.model || '',
        ...(Array.isArray(member.aliases) ? member.aliases : [])
    ].map(value => normalizeCompatibilityModelReference(brand, value).compact).filter(Boolean);
    const searchAliases = aliases.map(alias => compactNormalized(alias)).filter(Boolean);

    if (memberAliases.includes(searchAliases[0])) return true;
    return searchAliases.some(alias => memberAliases.includes(alias) || memberRef.compact.includes(alias) || alias.includes(memberRef.compact));
}

function groupSupportsSubtype(group, subtype = '') {
    const normalizedSubtype = normalize(subtype);
    const supportedSubtypes = Array.isArray(group?.supportedSubtypes) ? group.supportedSubtypes : [];
    if (!normalizedSubtype || !supportedSubtypes.length) return true;
    return supportedSubtypes.map(value => normalize(value)).includes(normalizedSubtype);
}

function findCompatibilityGroupsForContext(context, subtype = '') {
    const compactAliases = (context.aliases || []).map(alias => compactNormalized(alias)).filter(Boolean);

    return getCompatibilityGroups().filter(group => {
        const sameBrand = !context.brand || !group.brand || normalize(group.brand) === normalize(context.brand);
        if (!sameBrand) return false;
        if (!groupSupportsSubtype(group, subtype)) return false;

        return (group.members || []).some(member =>
            groupMemberMatches(member, group.brand || context.brand, member.model || '', compactAliases)
        );
    });
}

function getCompatibilityGroupModels(groups) {
    const groupList = Array.isArray(groups) ? groups : (groups ? [groups] : []);
    return [...new Map(groupList
        .flatMap(group => (group.members || []).map(member => ({
            brand: group.brand || '',
            model: member.model || ''
        })))
        .filter(item => item.model)
        .map(item => [`${item.brand}::${item.model}`, item])
    ).values()];
}

function getCompatibilityGroupLabel(groups) {
    const groupList = Array.isArray(groups) ? groups : (groups ? [groups] : []);
    if (!groupList.length) return '';
    if (groupList.length === 1) return groupList[0].label || '';
    return `${groupList.length} grupos compatibles`;
}

function itemMatchesCompatibilityGroup(item, groups, subtype = '') {
    const groupList = Array.isArray(groups) ? groups : (groups ? [groups] : []);
    if (!groupList.length) return false;
    const itemAliases = buildAccessoryModelAliases({ brand: item.brand, model: item.model })
        .map(alias => compactNormalized(alias))
        .filter(Boolean);

    return groupList.some(group => {
        if (!groupSupportsSubtype(group, subtype || item.subtype || '')) return false;
        return (group.members || []).some(member =>
            groupMemberMatches(member, group.brand || item.brand, member.model || '', itemAliases)
        );
    });
}

function inferInventoryAccessorySubtype(product = {}) {
    const text = normalize(`${product.name || ''} ${product.category || ''}`);
    if (text.includes('vidrio') || text.includes('templado') || text.includes('mica')) return 'vidrio';
    if (text.includes('hidrogel')) return 'hidrogel';
    if (text.includes('estuche') || text.includes('forro') || text.includes('funda') || text.includes('case')) return 'estuche';
    if (text.includes('cable') || text.includes('lightning') || text.includes('usb-c') || text.includes('usb c') || text.includes('micro usb')) return 'cable';
    if (text.includes('cargador') || text.includes('power bank')) return 'cargador';
    if (text.includes('audifono') || text.includes('manos libres') || text.includes('bluetooth')) return 'audifonos';
    return product.productType === 'accesorio' ? 'accesorio' : '';
}

function getInventoryCompatibilityMatches(context, subtype = '', compatibilityGroups = []) {
    if (typeof AppState === 'undefined' || !Array.isArray(AppState.products)) return [];

    const normalizedSubtype = normalize(subtype);
    const groupList = Array.isArray(compatibilityGroups) ? compatibilityGroups : (compatibilityGroups ? [compatibilityGroups] : []);
    const groupAliases = groupList.flatMap(group =>
        (group.members || []).flatMap(member =>
            buildAccessoryModelAliases({
                brand: group.brand || context.brand,
                model: member.model || ''
            })
        )
    );
    const searchAliases = [...new Set([...(context.aliases || []), ...groupAliases])]
        .map(alias => compactNormalized(alias))
        .filter(Boolean);

    return AppState.products
        .filter(product => product.isActive !== false && product.stock > 0)
        .map(product => {
            const subtypeGuess = inferInventoryAccessorySubtype(product);
            if (normalizedSubtype && subtypeGuess !== normalizedSubtype) return null;

            const haystack = normalize(`${product.name || ''} ${product.brand || ''} ${product.category || ''}`);
            const compactHaystack = compactNormalized(`${product.name || ''} ${product.brand || ''} ${product.category || ''}`);
            const aliasHit = searchAliases.some(alias => alias && (compactHaystack.includes(alias) || alias.includes(compactHaystack)));
            const profileHit = groupList.some(group => (group.members || []).some(member => {
                const memberRef = normalizeCompatibilityModelReference(group.brand || context.brand, member.model || '');
                return memberRef.compact && compactHaystack.includes(memberRef.compact);
            }));
            const wordsHit = context.words.length > 0 && context.words.every(word => haystack.includes(word));

            if (!aliasHit && !profileHit && !wordsHit) return null;

            let score = 0;
            if (profileHit) score += 10;
            if (aliasHit) score += 8;
            if (wordsHit) score += 3;

            return {
                id: `inventory_${product._id}`,
                name: product.name,
                brand: product.brand || context.brand || 'Tu inventario',
                model: product.category || product.brand || 'Inventario',
                subtype: subtypeGuess || 'accesorio',
                matchType: 'inventory',
                stock: product.stock,
                productId: product._id,
                _score: score
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            return a.name.localeCompare(b.name);
        })
        .slice(0, 24);
}

function getAccessoryCatalogBrands() {
    return getAccessoryCatalogIndex().brands;
}

function detectAccessoryBrand(rawText = '') {
    const normalizedText = normalize(rawText);
    return getAccessoryCatalogBrands()
        .sort((a, b) => b.length - a.length)
        .find(brand => normalizedText.includes(normalize(brand))) || '';
}

function stripKnownModelPrefixes(brand = '', model = '') {
    let cleaned = normalizeWhitespace(model);
    const normalizedBrand = normalize(brand);

    if (!cleaned) return '';

    while (normalizedBrand && normalize(cleaned).startsWith(`${normalizedBrand} `)) {
        cleaned = cleaned.slice(cleaned.split(/\s+/)[0].length).trim();
    }

    if (normalizedBrand === 'samsung') {
        while (/^galaxy\s+/i.test(cleaned)) {
            cleaned = cleaned.replace(/^galaxy\s+/i, '').trim();
        }
    }

    if (normalizedBrand === 'motorola') {
        while (/^moto\s+/i.test(cleaned)) {
            cleaned = cleaned.replace(/^moto\s+/i, '').trim();
        }
    }

    return cleaned;
}

function tokenizeAccessoryModel(brand = '', model = '') {
    const cleaned = stripKnownModelPrefixes(brand, model);
    const normalizedModel = normalize(cleaned)
        .replace(/[\(\)\[\]{}]/g, ' ')
        .replace(/[\/,+-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const tokens = normalizedModel.split(/\s+/).filter(Boolean);

    return {
        cleaned,
        normalizedModel,
        compactModel: compactNormalized(normalizedModel),
        tokens
    };
}

function buildAccessoryCompatibilityProfile(brand = '', model = '') {
    const brandNormalized = normalize(brand);
    const { cleaned, normalizedModel, compactModel, tokens } = tokenizeAccessoryModel(brand, model);
    const familyTokens = tokens.filter(token =>
        !ACCESSORY_MODEL_CONNECTIVITY_TOKENS.has(token) &&
        !ACCESSORY_MODEL_FAMILY_IGNORE_TOKENS.has(token)
    );
    const seriesTokens = familyTokens.filter(token => !ACCESSORY_MODEL_EDITION_TOKENS.has(token));
    const editionTokens = familyTokens.filter(token => ACCESSORY_MODEL_EDITION_TOKENS.has(token));

    return {
        brandNormalized,
        cleanedModel: cleaned,
        normalizedModel,
        compactModel,
        familyKey: compactNormalized(familyTokens.join(' ')),
        seriesKey: compactNormalized(seriesTokens.join(' ')),
        editionKey: compactNormalized(editionTokens.join(' ')),
        tokens
    };
}

function getProfileTokensWithoutConnectivity(profile = {}) {
    return (profile.tokens || []).filter(token => !ACCESSORY_MODEL_CONNECTIVITY_TOKENS.has(token));
}

function hasConnectivityToken(profile = {}) {
    return (profile.tokens || []).some(token => ACCESSORY_MODEL_CONNECTIVITY_TOKENS.has(token));
}

function isConnectivityVariantProfileMatch(baseProfile = {}, candidateProfile = {}) {
    if (!baseProfile.brandNormalized || !candidateProfile.brandNormalized) return false;
    if (baseProfile.brandNormalized !== candidateProfile.brandNormalized) return false;
    if (!baseProfile.seriesKey || !candidateProfile.seriesKey) return false;
    if (baseProfile.seriesKey !== candidateProfile.seriesKey) return false;
    if ((baseProfile.editionKey || '') !== (candidateProfile.editionKey || '')) return false;

    const baseCore = compactNormalized(getProfileTokensWithoutConnectivity(baseProfile).join(' '));
    const candidateCore = compactNormalized(getProfileTokensWithoutConnectivity(candidateProfile).join(' '));

    if (!baseCore || baseCore !== candidateCore) return false;

    return hasConnectivityToken(baseProfile) || hasConnectivityToken(candidateProfile);
}

function buildAccessoryModelAliases({ brand = '', model = '', raw = '' } = {}) {
    const aliases = new Set();
    const baseBrand = normalizeWhitespace(brand);
    const baseModel = normalizeWhitespace(model || raw);
    const strippedModel = stripKnownModelPrefixes(baseBrand, baseModel);
    const variants = [baseModel, strippedModel].filter(Boolean);

    variants.forEach(value => {
        aliases.add(normalize(value));
        aliases.add(compactNormalized(value));
    });

    if (baseBrand) {
        variants.forEach(value => {
            aliases.add(normalize(`${baseBrand} ${value}`));
            aliases.add(compactNormalized(`${baseBrand} ${value}`));
        });
    }

    if (normalize(baseBrand) === 'samsung' && strippedModel) {
        aliases.add(normalize(`Galaxy ${strippedModel}`));
        aliases.add(compactNormalized(`Galaxy ${strippedModel}`));
        aliases.add(normalize(`Samsung Galaxy ${strippedModel}`));
        aliases.add(compactNormalized(`Samsung Galaxy ${strippedModel}`));
    }

    if (normalize(baseBrand) === 'motorola' && strippedModel) {
        aliases.add(normalize(`Moto ${strippedModel}`));
        aliases.add(compactNormalized(`Moto ${strippedModel}`));
        aliases.add(normalize(`Motorola Moto ${strippedModel}`));
        aliases.add(compactNormalized(`Motorola Moto ${strippedModel}`));
    }

    if (normalize(baseBrand) === 'apple' && /^iphone\s+/i.test(baseModel)) {
        const shortIphone = baseModel.replace(/^iphone\s+/i, '').trim();
        aliases.add(normalize(shortIphone));
        aliases.add(compactNormalized(shortIphone));
    }

    return [...aliases].filter(Boolean);
}

function extractAccessorySearchContext({ brand = '', model = '', query = '', text = '' } = {}) {
    const normalizedBrand = normalizeWhitespace(brand);
    const rawQuery = normalizeWhitespace(query || text);
    const detectedBrand = normalizedBrand || detectAccessoryBrand(rawQuery);
    const modelSource = normalizeWhitespace(model) || rawQuery.replace(new RegExp(`^${detectedBrand}\\s+`, 'i'), '').trim() || rawQuery;
    const aliases = new Set(buildAccessoryModelAliases({
        brand: detectedBrand,
        model: modelSource,
        raw: rawQuery
    }));
    const combined = normalizeWhitespace([detectedBrand, modelSource, rawQuery].filter(Boolean).join(' '));
    const words = normalize(combined).split(/\s+/).filter(Boolean);

    if (combined) {
        aliases.add(normalize(combined));
        aliases.add(compactNormalized(combined));
    }

    return {
        brand: detectedBrand,
        model: modelSource,
        rawQuery,
        words,
        aliases: [...aliases].filter(Boolean),
        profile: buildAccessoryCompatibilityProfile(detectedBrand, modelSource || rawQuery)
    };
}

function getAccessoryModelCore(brand = '', model = '') {
    const base = stripKnownModelPrefixes(brand, model);
    return compactNormalized(
        normalize(base)
            .replace(/\b(4g|5g|lte|2023|2024|2025|2026)\b/g, ' ')
            .replace(/\s+/g, ' ')
    );
}

function getAccessoryCatalogIndex() {
    if (accessoryCatalogIndexCache) return accessoryCatalogIndexCache;

    const db = Array.isArray(window.ACCESSORIES_DB) ? window.ACCESSORIES_DB : [];
    const brandSet = new Set();
    const allModelsSet = new Set();
    const modelsByBrand = new Map();
    const aliasSet = new Set();

    const items = db.map(item => {
        const brand = normalizeWhitespace(item.brand);
        const model = normalizeWhitespace(item.model);
        const aliases = buildAccessoryModelAliases({ brand, model });
        const profile = buildAccessoryCompatibilityProfile(brand, model);
        const normalizedSubtype = normalize(item.subtype);
        const subtypeHints = ACCESSORY_SUBTYPE_HINTS[normalizedSubtype] || [];
        const searchText = normalize([
            item.name,
            brand,
            model,
            item.subtype,
            item.keywords || '',
            ...aliases,
            ...subtypeHints
        ].join(' '));

        brandSet.add(brand);
        aliases.forEach(alias => aliasSet.add(alias));

        const brandKey = normalize(brand);
        if (!modelsByBrand.has(brandKey)) {
            modelsByBrand.set(brandKey, new Set());
        }
        if (model) {
            modelsByBrand.get(brandKey).add(model);
            allModelsSet.add(`${brand}::${model}`);
        }

        return {
            ...item,
            brand,
            model,
            normalizedBrand: brandKey,
            normalizedSubtype,
            aliases,
            aliasSet: new Set(aliases),
            searchText,
            profile
        };
    });

    const modelLists = new Map(
        [...modelsByBrand.entries()].map(([key, set]) => [key, [...set].sort()])
    );

    accessoryCatalogIndexCache = {
        items,
        brands: [...brandSet].filter(Boolean).sort(),
        modelsByBrand: modelLists,
        allModels: [...allModelsSet]
            .map(value => value.split('::')[1])
            .filter(Boolean)
            .sort(),
        stats: {
            totalAccessories: db.length,
            totalBrands: brandSet.size,
            totalModels: allModelsSet.size,
            totalAliases: aliasSet.size
        }
    };

    return accessoryCatalogIndexCache;
}

function inferAccessoryConnector({ brand = '', model = '', rawQuery = '' } = {}) {
    const normalizedBrand = normalize(brand || detectAccessoryBrand(rawQuery));
    const normalizedModel = normalize(model || rawQuery);

    if (normalizedBrand === 'apple' && normalizedModel.includes('iphone')) {
        const match = normalizedModel.match(/iphone\s*(\d+)/);
        const generation = match ? parseInt(match[1], 10) : 0;
        return generation >= 15 ? 'usbc' : 'lightning';
    }

    if (['samsung', 'xiaomi', 'motorola', 'oppo', 'vivo', 'realme', 'huawei', 'tecno', 'infinix'].includes(normalizedBrand)) {
        return 'usbc';
    }

    return '';
}

function getUniversalAccessoryMatches(context = {}) {
    const catalog = getAccessoryCatalogIndex();
    if (!catalog.items.length) return [];

    const connector = inferAccessoryConnector(context);
    const universalMatches = [];

    if (connector) {
        universalMatches.push(...catalog.items.filter(item => {
            const compactModel = item.profile.compactModel;
            const itemKeywords = item.searchText;

            if (connector === 'lightning') {
                return compactModel.includes('lightning') || itemKeywords.includes('lightning');
            }

            if (connector === 'usbc') {
                return compactModel.includes('usbc') || itemKeywords.includes('usb-c') || itemKeywords.includes('usb c');
            }

            return false;
        }));
    }

    universalMatches.push(...catalog.items.filter(item =>
        item.normalizedBrand === 'universal' &&
        ['cargador', 'audifonos'].includes(item.normalizedSubtype)
    ));

    return [...new Map(universalMatches.map(item => [item.id, item])).values()]
        .sort((a, b) => {
            const typeDiff = (ACCESSORY_SUBTYPE_ORDER[a.subtype] || 99) - (ACCESSORY_SUBTYPE_ORDER[b.subtype] || 99);
            if (typeDiff !== 0) return typeDiff;
            return a.name.localeCompare(b.name);
        })
        .slice(0, 8);
}

function searchAccessoryCatalog({ brand = '', model = '', query = '', text = '', subtype = '', limit = 60 } = {}) {
    const catalog = getAccessoryCatalogIndex();
    if (!catalog.items.length) {
        return {
            context: extractAccessorySearchContext({ brand, model, query, text }),
            compatibilityGroup: null,
            inventoryMatches: [],
            exactMatches: [],
            profileMatches: [],
            familyMatches: [],
            universalMatches: [],
            allMatches: [],
            relatedModels: []
        };
    }

    const normalizedSubtype = normalize(subtype);
    const context = extractAccessorySearchContext({ brand, model, query, text });
    const compatibilityGroups = findCompatibilityGroupsForContext(context, normalizedSubtype);
    const compatibilityGroup = compatibilityGroups[0] || null;
    const hasSearch = context.aliases.length > 0 || context.words.length > 0;
    if (!hasSearch) {
        return {
            context,
            compatibilityGroup,
            inventoryMatches: [],
            exactMatches: [],
            profileMatches: [],
            familyMatches: [],
            universalMatches: [],
            allMatches: [],
            relatedModels: []
        };
    }

    const scoredMatches = catalog.items
        .map(item => {
            const brandMatches = !context.brand || item.normalizedBrand === normalize(context.brand);
            const subtypeMatches = !normalizedSubtype || item.normalizedSubtype === normalizedSubtype;
            const aliasHit = context.aliases.some(alias => alias && item.aliasSet.has(alias));
            const compactHit = context.aliases.some(alias => alias && item.profile.compactModel.includes(alias));
            const wordsHit = context.words.length > 0 && context.words.every(word =>
                item.searchText.includes(word) ||
                item.aliases.some(alias => alias.includes(word))
            );
            const explicitProfileHit = itemMatchesCompatibilityGroup(item, compatibilityGroups, normalizedSubtype);
            const inferredProfileHit = isConnectivityVariantProfileMatch(context.profile, item.profile);
            const profileHit = explicitProfileHit || inferredProfileHit;
            const familyHit = Boolean(
                context.profile?.familyKey &&
                item.profile.familyKey &&
                context.profile.familyKey === item.profile.familyKey &&
                (!context.brand || brandMatches)
            );

            if ((!brandMatches && !aliasHit && !wordsHit && !familyHit && !profileHit) || !subtypeMatches) {
                return null;
            }

            let score = 0;
            let matchType = 'catalogo';

            if (brandMatches) score += 2;
            if (aliasHit) score += 9;
            if (compactHit) score += 5;
            if (wordsHit) score += 3;
            if (profileHit) {
                score += explicitProfileHit ? 11 : 8;
                matchType = 'profile';
            }
            if (familyHit) {
                score += aliasHit || compactHit ? 4 : 7;
                if (!aliasHit && !compactHit && !profileHit) {
                    matchType = 'family';
                }
            }

            if (score === 0) return null;

            return {
                ...item,
                matchType,
                _score: score
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            const modelDiff = a.model.localeCompare(b.model);
            if (modelDiff !== 0) return modelDiff;
            const subtypeDiff = (ACCESSORY_SUBTYPE_ORDER[a.subtype] || 99) - (ACCESSORY_SUBTYPE_ORDER[b.subtype] || 99);
            if (subtypeDiff !== 0) return subtypeDiff;
            return a.name.localeCompare(b.name);
        });

    const profileMatches = scoredMatches.filter(item => item.matchType === 'profile');
    const exactMatches = scoredMatches.filter(item => !['family', 'profile'].includes(item.matchType));
    const familyMatches = scoredMatches.filter(item => item.matchType === 'family');
    const inventoryMatches = getInventoryCompatibilityMatches(context, subtype, compatibilityGroups);

    const universalMatches = getUniversalAccessoryMatches(context)
        .filter(item => !normalizedSubtype || item.normalizedSubtype === normalizedSubtype)
        .map(item => ({
            ...item,
            matchType: 'universal'
        }));

    const allMatches = [...new Map(
        [...inventoryMatches, ...profileMatches, ...exactMatches, ...familyMatches, ...universalMatches]
            .slice(0, Math.max(limit, 12))
            .map(item => [item.id, item])
    ).values()];

    const relatedModels = context.profile?.seriesKey
        ? [...new Map(
            catalog.items
                .filter(item => {
                    const sameBrand = !context.brand || item.normalizedBrand === normalize(context.brand);
                    if (!sameBrand) return false;
                    return item.profile.seriesKey && item.profile.seriesKey === context.profile.seriesKey;
                })
                .map(item => [`${item.brand}::${item.model}`, {
                    brand: item.brand,
                    model: item.model
                }])
        ).values()]
            .filter(item => compactNormalized(item.model) !== compactNormalized(context.model))
            .sort((a, b) => a.model.localeCompare(b.model))
            .slice(0, 12)
        : [];

    getCompatibilityGroupModels(compatibilityGroups).reverse().forEach(item => {
        if (compactNormalized(item.model) === compactNormalized(context.model)) return;
        relatedModels.unshift(item);
    });

    return {
        context,
        compatibilityGroup,
        compatibilityGroups,
        compatibilityLabel: getCompatibilityGroupLabel(compatibilityGroups),
        inventoryMatches,
        exactMatches,
        profileMatches,
        familyMatches,
        universalMatches,
        allMatches: allMatches.slice(0, limit),
        relatedModels
    };
}

function getCompatibleAccessories({ brand = '', model = '', text = '' } = {}) {
    return searchAccessoryCatalog({ brand, model, text, limit: 8 }).allMatches.slice(0, 8);
}

function formatAccessorySubtype(subtype) {
    const labels = {
        estuche: 'Estuche',
        vidrio: 'Vidrio',
        hidrogel: 'Hidrogel',
        cable: 'Cable',
        cargador: 'Cargador',
        audifonos: 'Audifonos'
    };
    return labels[subtype] || subtype || 'Accesorio';
}

function renderAccessorySuggestionBox(containerId, contentId, suggestions, emptyMessage) {
    const box = document.getElementById(containerId);
    const content = document.getElementById(contentId);
    if (!box || !content) return;

    if (!suggestions.length) {
        box.style.display = 'none';
        content.innerHTML = '';
        return;
    }

    content.innerHTML = `
        <div style="display:grid; gap:8px;">
            ${suggestions.map(item => `
                <div style="display:flex; justify-content:space-between; gap:12px; padding:10px; border:1px solid #e2e8f0; border-radius:10px; background:#fff;">
                    <div>
                        <div style="font-weight:600;">${escapeHtml(item.name)}</div>
                        <div style="font-size:.85rem; color:#64748b;">
                            ${escapeHtml(item.brand)} ${escapeHtml(item.model)}
                        </div>
                    </div>
                    <div style="align-self:center;">
                        <span class="badge badge-info">${escapeHtml(formatAccessorySubtype(item.subtype))}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        ${emptyMessage ? `<small style="display:block; margin-top:8px; color:#64748b;">${escapeHtml(emptyMessage)}</small>` : ''}
    `;
    box.style.display = 'block';
}

function updateSaleAccessorySuggestions(product) {
    if (!product || product.productType !== 'celular') {
        renderAccessorySuggestionBox('saleAccessorySuggestions', 'saleAccessorySuggestionsContent', []);
        return;
    }

    const suggestions = getCompatibleAccessories({
        brand: product.brand,
        text: `${product.brand || ''} ${product.name || ''}`
    });

    renderAccessorySuggestionBox(
        'saleAccessorySuggestions',
        'saleAccessorySuggestionsContent',
        suggestions,
        'Estas sugerencias salen del catálogo local y no modifican tu inventario actual.'
    );
}

function updateServiceAccessorySuggestions() {
    const brand = document.getElementById('deviceBrand')?.value || '';
    const model = document.getElementById('deviceModel')?.value || '';

    if (!brand && !model) {
        renderAccessorySuggestionBox('serviceAccessorySuggestions', 'serviceAccessorySuggestionsContent', []);
        return;
    }

    const suggestions = getCompatibleAccessories({
        brand,
        model,
        text: `${brand} ${model}`
    });

    renderAccessorySuggestionBox(
        'serviceAccessorySuggestions',
        'serviceAccessorySuggestionsContent',
        suggestions,
        'Te sirve para responder rápido qué estuche, vidrio o hidrogel le queda al equipo.'
    );
}

function clearSaleSerializedUnits() {
    saleSerializedUnits = [];
    const box = document.getElementById('saleSerializedUnitsBox');
    const summary = document.getElementById('saleSerializedUnitsSummary');
    const list = document.getElementById('saleSerializedUnitsList');
    if (box) box.style.display = 'none';
    if (summary) summary.textContent = '';
    if (list) list.innerHTML = '';
}

function getSelectedSaleUnitIds() {
    return Array.from(document.querySelectorAll('.sale-unit-checkbox:checked'))
        .map(input => input.value);
}

function renderSaleSerializedUnits(product, units = [], availableCount = 0) {
    const box = document.getElementById('saleSerializedUnitsBox');
    const summary = document.getElementById('saleSerializedUnitsSummary');
    const list = document.getElementById('saleSerializedUnitsList');
    if (!box || !summary || !list) return;

    if (!product || product.productType !== 'celular') {
        clearSaleSerializedUnits();
        return;
    }

    if (!units.length) {
        box.style.display = 'block';
        summary.textContent = 'Este producto no tiene IMEIs/seriales registrados disponibles. Puedes venderlo por cantidad normal.';
        list.innerHTML = '';
        return;
    }

    const totalStock = Number(product.stock) || 0;
    const availableUntrackedStock = Math.max(0, totalStock - availableCount);
    const stockHint = availableUntrackedStock > 0
        ? `Tambien tienes ${availableUntrackedStock} unidad(es) sin serial que puedes vender sin seleccionar IMEI.`
        : 'Para vender este producto, selecciona los IMEIs/seriales exactos.';

    summary.textContent = `${availableCount} unidad(es) con IMEI/serial disponible(s). Si seleccionas alguna(s), la cantidad de la venta debe coincidir. ${stockHint}`;
    list.innerHTML = `
        <div style="display:grid; gap:8px; max-height:220px; overflow:auto;">
            ${units.map(unit => `
                <label style="display:flex; gap:10px; align-items:center; padding:10px; border:1px solid #e2e8f0; border-radius:10px; background:#fff; color:#0f172a;">
                    <input type="checkbox" class="sale-unit-checkbox" value="${escapeHtml(unit._id)}">
                    <span style="font-weight:600;">${escapeHtml(unit.serialNumber)}</span>
                </label>
            `).join('')}
        </div>
    `;
    box.style.display = 'block';

    list.querySelectorAll('.sale-unit-checkbox').forEach(input => {
        input.addEventListener('change', () => {
            const selectedCount = getSelectedSaleUnitIds().length;
            const quantityInput = document.getElementById('saleQuantity');
            if (selectedCount > 0 && quantityInput) {
                quantityInput.value = selectedCount;
                updateSaleTotal();
            }
        });
    });
}

async function loadSaleSerializedUnits(product) {
    if (!product || product.productType !== 'celular') {
        clearSaleSerializedUnits();
        return;
    }

    try {
        const response = await api.getProductUnits(product._id, 'available');
        saleSerializedUnits = response.units || [];
        renderSaleSerializedUnits(product, saleSerializedUnits, response.availableCount || saleSerializedUnits.length);
    } catch (error) {
        console.error('Error loading serialized units:', error);
        clearSaleSerializedUnits();
    }
}

function getAccessoryBrands() {
    const inventoryBrands = (typeof AppState !== 'undefined' && Array.isArray(AppState.products))
        ? AppState.products
            .map(product => normalizeWhitespace(product.brand || ''))
            .filter(Boolean)
        : [];

    return [...new Set([...getAccessoryCatalogBrands(), ...inventoryBrands])].sort();
}

function getAccessoryModels(brand = '') {
    const catalog = getAccessoryCatalogIndex();
    const normalizedBrand = normalize(brand);
    const inventoryModels = (typeof AppState !== 'undefined' && Array.isArray(AppState.products))
        ? AppState.products
            .filter(product => {
                const productBrand = normalize(product.brand || '');
                return !normalizedBrand || productBrand === normalizedBrand;
            })
            .flatMap(product => {
                const models = [];
                const category = normalizeWhitespace(product.category || '');
                const productName = normalizeWhitespace(product.name || '');

                if (category) models.push(category);

                if (product.productType === 'celular' && productName) {
                    const brandText = normalizeWhitespace(product.brand || '');
                    const compactBrand = compactNormalized(brandText);
                    const compactName = compactNormalized(productName);
                    if (compactBrand && compactName.startsWith(compactBrand)) {
                        const stripped = normalizeWhitespace(productName.slice(brandText.length));
                        if (stripped) models.push(stripped);
                    }
                }

                return models;
            })
            .filter(Boolean)
        : [];

    const catalogModels = !normalizedBrand ? catalog.allModels : (catalog.modelsByBrand.get(normalizedBrand) || []);
    return [...new Set([...catalogModels, ...inventoryModels])].sort();
}

function populateCompatibilityFilters() {
    const brandList = document.getElementById('compatibilityBrandList');
    const modelList = document.getElementById('compatibilityModelList');
    const brandInput = document.getElementById('compatibilityBrand');
    if (!brandList || !modelList || !brandInput) return;

    brandList.innerHTML = getAccessoryBrands()
        .map(brand => `<option value="${escapeHtml(brand)}"></option>`)
        .join('');

    const renderModels = () => {
        modelList.innerHTML = getAccessoryModels(brandInput.value)
            .map(model => `<option value="${escapeHtml(model)}"></option>`)
            .join('');
    };

    if (!brandInput.dataset.compatibilityBound) {
        brandInput.addEventListener('input', renderModels);
        brandInput.dataset.compatibilityBound = '1';
    }

    renderModels();
}

function getAccessoryCatalogBaseStats() {
    return getAccessoryCatalogIndex().stats;
}

function renderCompatibilitySummary(searchData) {
    const container = document.getElementById('compatibilitySummary');
    if (!container) return;

    const baseStats = getAccessoryCatalogBaseStats();
    const compatibilityGroup = searchData?.compatibilityGroup;
    const compatibilityLabel = searchData?.compatibilityLabel || compatibilityGroup?.label || '';
    const inventoryMatches = searchData?.inventoryMatches || [];
    const exactMatches = searchData?.exactMatches || [];
    const profileMatches = searchData?.profileMatches || [];
    const specMatches = searchData?.specMatches || [];
    const familyMatches = searchData?.familyMatches || [];
    const universalMatches = searchData?.universalMatches || [];
    const relatedModels = searchData?.relatedModels || [];
    const deviceSpec = searchData?.deviceSpec || null;
    const workingSet = searchData?.allMatches || [];

    const bySubtype = workingSet.reduce((acc, item) => {
        const key = item.subtype || 'accesorio';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const cards = (workingSet.length ? [
        { title: 'En tu inventario', value: inventoryMatches.length },
        { title: 'Mismo molde', value: profileMatches.length },
        { title: 'Por ficha tecnica', value: specMatches.length },
        { title: 'Compatibles directos', value: exactMatches.length },
        { title: 'Por familia cercana', value: familyMatches.length },
        { title: 'Universales', value: universalMatches.length },
        { title: 'Modelos relacionados', value: relatedModels.length },
        { title: 'Estuches', value: bySubtype.estuche || 0 },
        { title: 'Vidrios / Hidrogeles', value: (bySubtype.vidrio || 0) + (bySubtype.hidrogel || 0) },
        { title: 'Modelos encontrados', value: new Set(workingSet.map(item => item.model)).size },
        compatibilityLabel ? { title: 'Perfil fisico', value: compatibilityLabel } : null,
        deviceSpec ? { title: 'Ficha tecnica', value: `${deviceSpec.brand || ''} ${deviceSpec.model || ''}`.trim() } : null
    ] : [
        { title: 'Accesorios cargados', value: baseStats.totalAccessories },
        { title: 'Marcas', value: baseStats.totalBrands },
        { title: 'Modelos', value: baseStats.totalModels },
        { title: 'Alias detectables', value: baseStats.totalAliases },
        { title: 'Cobertura', value: 'Local' }
    ]).filter(Boolean);

    container.innerHTML = cards.map(card => `
        <div class="compatibility-summary-card">
            <h4>${escapeHtml(card.title)}</h4>
            <strong>${escapeHtml(card.value)}</strong>
        </div>
    `).join('');
}

function renderCompatibilityRelatedModels(searchData) {
    const container = document.getElementById('compatibilityRelatedModels');
    if (!container) return;

    compatibilityRelatedModels = searchData?.relatedModels || [];
    const deviceSpec = searchData?.deviceSpec || null;
    const equivalentSpecs = searchData?.equivalentSpecs || [];

    const technicalData = deviceSpec ? `
        <div class="compatibility-tech-box">
            <h4>Datos tecnicos</h4>
            <div class="compatibility-tech-grid">
                <span><strong>Equipo:</strong> ${escapeHtml([deviceSpec.brand, deviceSpec.model].filter(Boolean).join(' '))}</span>
                ${deviceSpec.dimensions?.heightMm ? `<span><strong>Alto:</strong> ${escapeHtml(deviceSpec.dimensions.heightMm)} mm</span>` : ''}
                ${deviceSpec.dimensions?.widthMm ? `<span><strong>Ancho:</strong> ${escapeHtml(deviceSpec.dimensions.widthMm)} mm</span>` : ''}
                ${deviceSpec.dimensions?.thicknessMm ? `<span><strong>Grosor:</strong> ${escapeHtml(deviceSpec.dimensions.thicknessMm)} mm</span>` : ''}
                ${deviceSpec.physical?.cameraLayout ? `<span><strong>Camara:</strong> ${escapeHtml(deviceSpec.physical.cameraLayout)}</span>` : ''}
                ${deviceSpec.physical?.buttons ? `<span><strong>Botones:</strong> ${escapeHtml(deviceSpec.physical.buttons)}</span>` : ''}
                ${deviceSpec.physical?.connector ? `<span><strong>Conector:</strong> ${escapeHtml(deviceSpec.physical.connector)}</span>` : ''}
                ${deviceSpec.confidence ? `<span><strong>Confianza:</strong> ${escapeHtml(deviceSpec.confidence)}%</span>` : ''}
            </div>
            ${equivalentSpecs.length ? `<p class="compatibility-result-caption">Compatibles por ficha: ${equivalentSpecs.slice(0, 8).map(item => `${escapeHtml(item.brand)} ${escapeHtml(item.model)}`).join(' � ')}</p>` : ''}
        </div>
    ` : '';

    if (!compatibilityRelatedModels.length) {
        container.innerHTML = technicalData || '<div class="compatibility-empty">Cuando exista una familia parecida en el catalogo, te la mostrare aqui para comparar rapido.</div>';
        return;
    }

    container.innerHTML = `
        ${technicalData}
        <p class="compatibility-result-caption">Estos modelos se parecen por familia o variante dentro del mismo catalogo. Usalos para revisar si tambien manejas ese vidrio, hidrogel o estuche.</p>
        <div class="compatibility-related-wrap">
            ${compatibilityRelatedModels.map((item, index) => `
                <button type="button" class="compatibility-related-chip" onclick="applyCompatibilityRelatedModel(${index})">
                    ${escapeHtml(item.brand)} ${escapeHtml(item.model)}
                </button>
            `).join('')}
        </div>
    `;
}
function renderCompatibilityResults(searchData, contextLabel = '') {
    const container = document.getElementById('compatibilityResults');
    if (!container) return;

    const compatibilityGroup = searchData?.compatibilityGroup;
    const compatibilityLabel = searchData?.compatibilityLabel || compatibilityGroup?.label || '';
    const inventoryMatches = searchData?.inventoryMatches || [];
    const exactMatches = searchData?.exactMatches || [];
    const profileMatches = searchData?.profileMatches || [];
    const specMatches = searchData?.specMatches || [];
    const familyMatches = searchData?.familyMatches || [];
    const universalMatches = searchData?.universalMatches || [];
    const allMatches = searchData?.allMatches || [];
    const displayInventoryMatches = inventoryMatches.slice(0, 24);
    const displayProfileMatches = profileMatches.slice(0, 48);
    const displaySpecMatches = specMatches.slice(0, 48);
    const displayExactMatches = exactMatches.slice(0, 48);
    const displayFamilyMatches = familyMatches.slice(0, 36);
    const displayUniversalMatches = universalMatches.slice(0, 12);

    compatibilityCatalogMatches = [...displayInventoryMatches, ...displayProfileMatches, ...displaySpecMatches, ...displayExactMatches, ...displayFamilyMatches, ...displayUniversalMatches];

    if (!allMatches.length) {
        container.innerHTML = contextLabel
            ? `<div class="compatibility-empty">No encontre coincidencias para <strong>${escapeHtml(contextLabel)}</strong>. Prueba con otra marca, modelo o busqueda libre.</div>`
            : '<div class="compatibility-empty">Escribe una marca, un modelo o una busqueda libre para ver que accesorios le sirven.</div>';
        return;
    }

    const renderCards = (items, offset = 0) => `
        <div class="compatibility-results-grid">
            ${items.map((item, index) => `
                <div class="compatibility-result-card">
                    <div>
                        <div style="font-weight:700; font-size:1rem;">${escapeHtml(item.name)}</div>
                        <div class="compatibility-result-meta">
                            <span>${escapeHtml(item.brand)}</span>
                            <span>${escapeHtml(item.model)}</span>
                            <span class="badge badge-info">${escapeHtml(formatAccessorySubtype(item.subtype))}</span>
                            ${item.matchType === 'inventory'
                                ? '<span class="badge badge-success">Inventario</span>'
                                : item.matchType === 'universal'
                                    ? '<span class="badge badge-warning">Universal</span>'
                                    : item.matchType === 'profile'
                                        ? '<span class="badge badge-success">Mismo molde</span>'
                                        : item.matchType === 'spec'
                                            ? '<span class="badge badge-info">Ficha tecnica</span>'
                                            : item.matchType === 'family'
                                                ? '<span class="badge badge-warning">Familia</span>'
                                                : '<span class="badge badge-success">Directo</span>'}
                            ${item.matchType === 'inventory'
                                ? `<span class="badge badge-warning">Stock ${escapeHtml(item.stock || 0)}</span>`
                                : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-sm" onclick="sendCompatibilityToPurchase(${offset + index})" style="width:auto;">Pasar a compras</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    const sections = [];
    if (displayInventoryMatches.length) {
        sections.push(`
            <section class="compatibility-result-section">
                <h4>Disponibles en tu tienda</h4>
                <p class="compatibility-result-caption">Estas referencias ya existen en tu inventario y te pueden servir para vender o reponer mas rapido.</p>
                ${renderCards(displayInventoryMatches, 0)}
            </section>
        `);
    }
    if (displayProfileMatches.length) {
        sections.push(`
            <section class="compatibility-result-section">
                <h4>Compatibles por mismo molde</h4>
                <p class="compatibility-result-caption">${
                    compatibilityLabel
                        ? `Grupo detectado: ${escapeHtml(compatibilityLabel)}. Aqui aparecen accesorios de equipos con medidas y forma fisica compartida.`
                        : 'Resultados agrupados por perfil fisico compartido.'
                }</p>
                ${renderCards(displayProfileMatches, displayInventoryMatches.length)}
            </section>
        `);
    }
    if (displaySpecMatches.length) {
        sections.push(`
            <section class="compatibility-result-section">
                <h4>Compatibles por ficha tecnica</h4>
                <p class="compatibility-result-caption">Estos resultados salen por dimensiones, camaras, botones, conectores o equivalencias ya registradas en la ficha del equipo.</p>
                ${renderCards(displaySpecMatches, displayInventoryMatches.length + displayProfileMatches.length)}
            </section>
        `);
    }
    if (displayExactMatches.length) {
        sections.push(`
            <section class="compatibility-result-section">
                <h4>Compatibles directos</h4>
                <p class="compatibility-result-caption">Resultados encontrados por coincidencia de modelo, alias o forma comun de escribirlo.</p>
                ${renderCards(displayExactMatches, displayInventoryMatches.length + displayProfileMatches.length + displaySpecMatches.length)}
            </section>
        `);
    }

    if (displayFamilyMatches.length) {
        sections.push(`
            <section class="compatibility-result-section">
                <h4>Compatibles por familia cercana</h4>
                <p class="compatibility-result-caption">Aqui aparecen variantes muy cercanas del mismo modelo o version. Son utiles cuando cambian 4G/5G, nombre comercial o forma de escribirlo.</p>
                ${renderCards(displayFamilyMatches, displayInventoryMatches.length + displayProfileMatches.length + displaySpecMatches.length + displayExactMatches.length)}
            </section>
        `);
    }

    if (displayUniversalMatches.length) {
        sections.push(`
            <section class="compatibility-result-section">
                <h4>Accesorios universales recomendados</h4>
                <p class="compatibility-result-caption">Incluye cables, cargadores y accesorios generales que suelen funcionar con el conector o tipo de equipo detectado.</p>
                ${renderCards(displayUniversalMatches, displayInventoryMatches.length + displayProfileMatches.length + displaySpecMatches.length + displayExactMatches.length + displayFamilyMatches.length)}
            </section>
        `);
    }

    container.innerHTML = sections.join('');
}
function syncCompatibilityQuickFilters(selectedSubtype = '') {
    document.querySelectorAll('.compatibility-quick-chip').forEach(chip => {
        chip.classList.toggle('active', (chip.dataset.subtype || '') === selectedSubtype);
    });
}

function scheduleCompatibilitySearch(delay = 180) {
    clearTimeout(compatibilitySearchTimer);
    compatibilitySearchTimer = setTimeout(() => {
        runCompatibilitySearch();
    }, delay);
}

async function runCompatibilitySearch() {
    const brand = document.getElementById('compatibilityBrand')?.value || '';
    const model = document.getElementById('compatibilityModel')?.value || '';
    const query = document.getElementById('compatibilityQuery')?.value || '';
    const subtype = document.getElementById('compatibilitySubtype')?.value || '';
    const subtypeLabel = subtype ? formatAccessorySubtype(subtype) : '';
    const contextLabel = [brand, model, query, subtypeLabel].filter(Boolean).join(' · ');
    syncCompatibilityQuickFilters(subtype);
    let searchData = null;
    try {
        if (typeof api !== 'undefined' && typeof api.searchCompatibility === 'function') {
            const response = await api.searchCompatibility({ brand, model, query, subtype, limit: 60 });
            if (response && response.success) {
                searchData = response;
            }
        }
    } catch (error) {
        console.warn('Compatibility API fallback:', error);
    }
    if (!searchData) {
        searchData = searchAccessoryCatalog({ brand, model, query, subtype, limit: 60 });
    }
    renderCompatibilitySummary(searchData);
    renderCompatibilityRelatedModels(searchData);
    renderCompatibilityResults(searchData, contextLabel);
}

async function loadCompatibilityView() {
    if (typeof AppState !== 'undefined' && (!Array.isArray(AppState.products) || !AppState.products.length) && typeof app !== 'undefined' && typeof app.loadProducts === 'function') {
        try {
            await app.loadProducts();
        } catch (error) {
            console.error('Error loading products for compatibility:', error);
        }
    }

    populateCompatibilityFilters();
    const brand = document.getElementById('compatibilityBrand')?.value || '';
    const model = document.getElementById('compatibilityModel')?.value || '';
    const query = document.getElementById('compatibilityQuery')?.value || '';
    const subtype = document.getElementById('compatibilitySubtype')?.value || '';

    if (brand || model || query || subtype) {
        runCompatibilitySearch();
        return;
    }

    renderCompatibilitySummary(null);
    renderCompatibilityRelatedModels(null);
    renderCompatibilityResults(null, '');
}

window.getAccessoryCatalogIndex = getAccessoryCatalogIndex;

window.sendCompatibilityToPurchase = function(index) {
    const item = compatibilityCatalogMatches[index];
    if (!item) return;

    const purchasesBtn = document.querySelector('.nav-btn[data-view="purchases"]');
    if (!purchasesBtn) return;

    purchasesBtn.click();

    setTimeout(() => {
        const nameInput = document.getElementById('purchaseProductName');
        const typeInput = document.getElementById('purchaseProductType');
        const notesInput = document.getElementById('purchaseSupplier');

        if (nameInput) nameInput.value = item.name;
        if (typeInput) {
            typeInput.value = 'accesorio';
            typeInput.dispatchEvent(new Event('change'));
        }
        if (notesInput && !notesInput.value) notesInput.value = item.brand;
        nameInput?.focus();
        utils.showToast(`Listo para comprar: ${item.name}`);
    }, 200);
};

window.applyCompatibilityRelatedModel = function(index) {
    const item = compatibilityRelatedModels[index];
    if (!item) return;

    const brandInput = document.getElementById('compatibilityBrand');
    const modelInput = document.getElementById('compatibilityModel');
    const queryInput = document.getElementById('compatibilityQuery');

    if (brandInput) brandInput.value = item.brand;
    if (modelInput) modelInput.value = item.model;
    if (queryInput) queryInput.value = '';

    runCompatibilitySearch();
};

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

    updateSaleAccessorySuggestions(selectedProduct);
    loadSaleSerializedUnits(selectedProduct);
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
                ${purchase.serialNumbers?.length ? `<span>IMEIs/Seriales: ${purchase.serialNumbers.length}</span>` : ''}
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
                    ${service.device.serialNumber ? `
                    <div style="margin-top:4px; font-size:12px; color:var(--text-secondary);">
                        IMEI / Serial: <strong>${escapeHtml(service.device.serialNumber)}</strong>
                    </div>` : ''}
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
    document.getElementById('updateServiceSerialNumber').value = service.device?.serialNumber || '';

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
    populateCompatibilityFilters();
    ['deviceBrand', 'deviceModel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateServiceAccessorySuggestions);
    });

    const compatibilityBrand = document.getElementById('compatibilityBrand');
    const compatibilityModel = document.getElementById('compatibilityModel');
    const compatibilityQuery = document.getElementById('compatibilityQuery');
    const compatibilitySubtype = document.getElementById('compatibilitySubtype');
    const compatibilitySearchBtn = document.getElementById('btnCompatibilitySearch');
    const compatibilityClearBtn = document.getElementById('btnCompatibilityClear');
    const compatibilityQuickChips = document.querySelectorAll('.compatibility-quick-chip');

    [compatibilityBrand, compatibilityModel, compatibilityQuery].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => scheduleCompatibilitySearch());
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runCompatibilitySearch();
            }
        });
    });

    compatibilitySubtype?.addEventListener('change', runCompatibilitySearch);
    compatibilityQuickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (compatibilitySubtype) {
                compatibilitySubtype.value = chip.dataset.subtype || '';
            }
            runCompatibilitySearch();
        });
    });
    compatibilitySearchBtn?.addEventListener('click', runCompatibilitySearch);
    compatibilityClearBtn?.addEventListener('click', () => {
        if (compatibilityBrand) compatibilityBrand.value = '';
        if (compatibilityModel) compatibilityModel.value = '';
        if (compatibilityQuery) compatibilityQuery.value = '';
        if (compatibilitySubtype) compatibilitySubtype.value = '';
        syncCompatibilityQuickFilters('');
        populateCompatibilityFilters();
        renderCompatibilitySummary(null);
        renderCompatibilityRelatedModels(null);
        renderCompatibilityResults(null, '');
    });

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
                    model: document.getElementById('deviceModel')?.value || '',
                    serialNumber: document.getElementById('deviceSerialNumber')?.value || ''
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

                    const serialInput = document.getElementById('deviceSerialNumber');
                    if (serialInput) serialInput.value = '';

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
                device: {
                    ...((allServices.find(s => s._id === serviceId)?.device) || {}),
                    serialNumber: document.getElementById('updateServiceSerialNumber')?.value || ''
                },
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
            selectedProduct = null;
            clearSaleSerializedUnits();
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
window.updateServiceAccessorySuggestions = updateServiceAccessorySuggestions;
window.loadCompatibilityView    = loadCompatibilityView;
window.getSelectedSaleUnitIds   = getSelectedSaleUnitIds;
window.clearSaleSerializedUnits = clearSaleSerializedUnits;

