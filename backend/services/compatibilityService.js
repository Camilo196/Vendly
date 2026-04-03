const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cachedAccessories = null;
let cachedGroups = null;
let cachedCatalog = null;
let cachedDeviceSpecs = null;
let cachedAuditLog = null;
let cachedProfileSeeds = null;
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CONFIG_DIR = path.join(ROOT_DIR, 'backend', 'config');
const ACCESSORIES_JSON_PATH = path.join(CONFIG_DIR, 'accessories-catalog.json');
const GROUPS_JSON_PATH = path.join(CONFIG_DIR, 'compatibility-groups.json');
const DEVICE_SPECS_JSON_PATH = path.join(CONFIG_DIR, 'device-specs.json');
const AUDIT_LOG_JSON_PATH = path.join(CONFIG_DIR, 'compatibility-audit-log.json');
const PROFILE_SEEDS_JSON_PATH = path.join(CONFIG_DIR, 'device-profile-seeds.json');

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
  cable: ['cable', 'usb', 'tipo c', 'lightning', 'micro usb'],
  cargador: ['cargador', 'power bank', 'carga'],
  audifonos: ['audifonos', 'bluetooth', 'manos libres']
};

function readFrontendScript(relativePath) {
  const filePath = path.resolve(__dirname, '..', '..', 'frontend', 'js', relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function resetCompatibilityCache() {
  cachedAccessories = null;
  cachedGroups = null;
  cachedCatalog = null;
  cachedDeviceSpecs = null;
  cachedAuditLog = null;
  cachedProfileSeeds = null;
}

function readJsonFileSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, data) {
  ensureConfigDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeSource(source = {}) {
  if (!source || typeof source !== 'object') return undefined;

  const normalized = {
    type: normalize(source.type || source.sourceType || ''),
    name: normalizeWhitespace(source.name || source.sourceName || ''),
    url: normalizeWhitespace(source.url || source.sourceUrl || ''),
    note: normalizeWhitespace(source.note || source.notes || ''),
    verifiedAt: source.verifiedAt || source.date || undefined
  };

  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

function sanitizeSupplierReference(reference = {}) {
  if (!reference || typeof reference !== 'object') return null;

  const normalized = {
    supplier: normalizeWhitespace(reference.supplier || reference.provider || ''),
    sku: normalizeWhitespace(reference.sku || reference.code || ''),
    name: normalizeWhitespace(reference.name || ''),
    url: normalizeWhitespace(reference.url || ''),
    price: Number(reference.price || 0) || 0,
    currency: normalizeWhitespace(reference.currency || 'COP') || 'COP',
    notes: normalizeWhitespace(reference.notes || '')
  };

  return Object.values(normalized).some(value => value && value !== 0) ? normalized : null;
}

function sanitizeImageReference(image = {}) {
  if (!image || typeof image !== 'object') return null;

  const normalized = {
    url: normalizeWhitespace(image.url || ''),
    label: normalizeWhitespace(image.label || image.name || ''),
    type: normalizeWhitespace(image.type || 'image') || 'image'
  };

  return normalized.url ? normalized : null;
}

function sanitizeEquivalentReference(entry = {}) {
  if (typeof entry === 'string') {
    const value = normalizeWhitespace(entry);
    return value ? { brand: '', model: value, kind: 'full' } : null;
  }

  if (!entry || typeof entry !== 'object') return null;

  const normalized = {
    brand: normalizeWhitespace(entry.brand || ''),
    model: normalizeWhitespace(entry.model || ''),
    kind: normalize(entry.kind || 'full') || 'full',
    notes: normalizeWhitespace(entry.notes || '')
  };

  return normalized.model ? normalized : null;
}

function loadAccessories() {
  if (cachedAccessories) return cachedAccessories;
  const jsonData = readJsonFileSafe(ACCESSORIES_JSON_PATH);
  if (Array.isArray(jsonData)) {
    cachedAccessories = jsonData;
    return cachedAccessories;
  }
  const script = `${readFrontendScript('accessories-db.js')}\nthis.__result = ACCESSORIES_DB;`;
  const sandbox = { window: {} };
  vm.runInNewContext(script, sandbox, { filename: 'accessories-db.js' });
  cachedAccessories = Array.isArray(sandbox.__result)
    ? sandbox.__result
    : (Array.isArray(sandbox.window.ACCESSORIES_DB) ? sandbox.window.ACCESSORIES_DB : []);
  return cachedAccessories;
}

function loadCompatibilityGroups() {
  if (cachedGroups) return cachedGroups;
  const jsonData = readJsonFileSafe(GROUPS_JSON_PATH);
  if (Array.isArray(jsonData)) {
    cachedGroups = jsonData;
    return cachedGroups;
  }
  const sandbox = { window: {} };
  vm.runInNewContext(readFrontendScript('device-compatibility-profiles.js'), sandbox, {
    filename: 'device-compatibility-profiles.js'
  });
  cachedGroups = Array.isArray(sandbox.window.DEVICE_COMPATIBILITY_GROUPS)
    ? sandbox.window.DEVICE_COMPATIBILITY_GROUPS
    : [];
  return cachedGroups;
}

function sanitizeProfileSeed(seed = {}, index = 0) {
  return {
    id: normalizeWhitespace(seed.id || seed.groupId || `profile_seed_${index}`),
    dimensions: {
      heightMm: Number(seed.dimensions?.heightMm || seed.heightMm || 0) || undefined,
      widthMm: Number(seed.dimensions?.widthMm || seed.widthMm || 0) || undefined,
      thicknessMm: Number(seed.dimensions?.thicknessMm || seed.thicknessMm || 0) || undefined
    },
    physical: {
      cameraLayout: normalizeWhitespace(seed.physical?.cameraLayout || seed.cameraLayout || ''),
      buttons: normalizeWhitespace(seed.physical?.buttons || seed.buttons || ''),
      connector: normalizeWhitespace(seed.physical?.connector || seed.connector || ''),
      fingerprint: normalizeWhitespace(seed.physical?.fingerprint || seed.fingerprint || ''),
      speakers: normalizeWhitespace(seed.physical?.speakers || seed.speakers || '')
    },
    display: {
      sizeInches: Number(seed.display?.sizeInches || seed.sizeInches || 0) || undefined,
      aspectRatio: normalizeWhitespace(seed.display?.aspectRatio || seed.aspectRatio || '')
    },
    confidence: Number(seed.confidence || 0) || undefined,
    notes: normalizeWhitespace(seed.notes || ''),
    source: sanitizeSource(seed.source || seed)
  };
}

function loadDeviceProfileSeeds() {
  if (cachedProfileSeeds) return cachedProfileSeeds;
  const data = readJsonFileSafe(PROFILE_SEEDS_JSON_PATH);
  cachedProfileSeeds = Array.isArray(data) ? data.map(sanitizeProfileSeed) : [];
  return cachedProfileSeeds;
}

function buildGeneratedDeviceSpecs() {
  const map = new Map();
  const seedsById = new Map(loadDeviceProfileSeeds().map(seed => [seed.id, seed]));

  loadCompatibilityGroups().forEach(group => {
    const seed = seedsById.get(normalizeWhitespace(group.id || '')) || {};
    const members = safeArray(group.members).filter(member => normalizeWhitespace(member.model || ''));
    members.forEach(member => {
      const inferredBrand = normalizeWhitespace(group.brand || detectAccessoryBrand(member.model || '') || '');
      const key = `${normalize(inferredBrand)}::${normalize(member.model)}`;
      const current = map.get(key) || {
        id: `spec_${compactNormalized(`${inferredBrand}_${member.model}`)}`,
        brand: inferredBrand,
        model: normalizeWhitespace(member.model || ''),
        aliases: safeArray(member.aliases).map(alias => normalizeWhitespace(alias)).filter(Boolean),
        dimensions: {
          heightMm: Number(seed.dimensions?.heightMm || group.dimensions?.heightMm || 0) || undefined,
          widthMm: Number(seed.dimensions?.widthMm || group.dimensions?.widthMm || 0) || undefined,
          thicknessMm: Number(seed.dimensions?.thicknessMm || group.dimensions?.thicknessMm || 0) || undefined
        },
        physical: {
          cameraLayout: normalizeWhitespace(seed.physical?.cameraLayout || group.cameraLayout || ''),
          buttons: normalizeWhitespace(seed.physical?.buttons || ''),
          connector: normalizeWhitespace(seed.physical?.connector || (inferredBrand && normalize(inferredBrand) !== 'apple' ? 'USB-C' : '')),
          fingerprint: normalizeWhitespace(seed.physical?.fingerprint || ''),
          speakers: normalizeWhitespace(seed.physical?.speakers || '')
        },
        display: {
          sizeInches: Number(seed.display?.sizeInches || 0) || undefined,
          aspectRatio: normalizeWhitespace(seed.display?.aspectRatio || '')
        },
        profiles: {},
        source: {
          type: seed.source?.type || 'compatibility_group_seed',
          name: normalizeWhitespace(seed.source?.name || group.label || group.id || 'Grupo de compatibilidad'),
          url: normalizeWhitespace(seed.source?.url || ''),
          note: normalizeWhitespace(seed.source?.note || '')
        },
        confidence: Number(seed.confidence || 58) || 58,
        supplierReferences: [],
        images: [],
        equivalents: [],
        notes: normalizeWhitespace(seed.notes || '')
      };

      const supported = safeArray(group.supportedSubtypes).map(value => normalize(value));
      if (!supported.length || supported.includes('estuche')) {
        current.profiles.caseProfile = current.profiles.caseProfile || normalizeWhitespace(group.id || group.label || '');
      }
      if (!supported.length || supported.includes('vidrio') || supported.includes('hidrogel')) {
        current.profiles.screenProfile = current.profiles.screenProfile || normalizeWhitespace(group.id || group.label || '');
      }

      members
        .filter(candidate => normalize(candidate.model) !== normalize(member.model))
        .forEach(candidate => {
          const exists = current.equivalents.some(entry =>
            normalize(entry.brand) === normalize(inferredBrand || '') &&
            normalize(entry.model) === normalize(candidate.model || '')
          );

          if (!exists) {
            current.equivalents.push({
              brand: inferredBrand,
              model: normalizeWhitespace(candidate.model || ''),
              kind: supported.includes('vidrio') || supported.includes('hidrogel') ? 'screen' : 'full'
            });
          }
        });

      map.set(key, current);
    });
  });

  return [...map.values()];
}

function sanitizeDeviceSpec(spec = {}, index = 0) {
  const brand = normalizeWhitespace(spec.brand || '');
  const rawModel = normalizeWhitespace(spec.model || '');
  let strippedModel = rawModel;
  const normalizedBrand = normalize(brand);
  if (normalizedBrand) {
    strippedModel = normalizeWhitespace(rawModel.replace(new RegExp(`^${brand}\\s+`, 'i'), ''));
  }
  const model = strippedModel || rawModel;
  const aliases = safeArray(spec.aliases)
    .map(alias => normalizeWhitespace(alias))
    .filter(Boolean);
  const supplierReferences = safeArray(spec.supplierReferences || spec.suppliers)
    .map(sanitizeSupplierReference)
    .filter(Boolean);
  const images = safeArray(spec.images)
    .map(sanitizeImageReference)
    .filter(Boolean);
  const equivalents = safeArray(spec.equivalents)
    .map(sanitizeEquivalentReference)
    .filter(Boolean);

  return {
    id: spec.id || `spec_custom_${Date.now()}_${index}`,
    brand,
    model,
    aliases,
    dimensions: {
      heightMm: Number(spec.dimensions?.heightMm || spec.heightMm || 0) || undefined,
      widthMm: Number(spec.dimensions?.widthMm || spec.widthMm || 0) || undefined,
      thicknessMm: Number(spec.dimensions?.thicknessMm || spec.thicknessMm || 0) || undefined
    },
    physical: {
      cameraLayout: normalizeWhitespace(spec.physical?.cameraLayout || spec.cameraLayout || ''),
      buttons: normalizeWhitespace(spec.physical?.buttons || spec.buttons || ''),
      connector: normalizeWhitespace(spec.physical?.connector || spec.connector || ''),
      fingerprint: normalizeWhitespace(spec.physical?.fingerprint || spec.fingerprint || ''),
      speakers: normalizeWhitespace(spec.physical?.speakers || spec.speakers || '')
    },
    display: {
      sizeInches: Number(spec.display?.sizeInches || spec.sizeInches || 0) || undefined,
      aspectRatio: normalizeWhitespace(spec.display?.aspectRatio || spec.aspectRatio || '')
    },
    profiles: {
      caseProfile: normalizeWhitespace(spec.profiles?.caseProfile || spec.caseProfile || ''),
      screenProfile: normalizeWhitespace(spec.profiles?.screenProfile || spec.screenProfile || ''),
      bodyProfile: normalizeWhitespace(spec.profiles?.bodyProfile || spec.bodyProfile || '')
    },
    source: sanitizeSource(spec.source || spec),
    confidence: Number(spec.confidence || 0) || undefined,
    supplierReferences,
    images,
    equivalents,
    notes: normalizeWhitespace(spec.notes || '')
  };
}

function loadDeviceSpecs() {
  if (cachedDeviceSpecs) return cachedDeviceSpecs;

  const manual = readJsonFileSafe(DEVICE_SPECS_JSON_PATH);
  const generated = buildGeneratedDeviceSpecs();
  const map = new Map();

  generated.forEach((spec, index) => {
    const sanitized = sanitizeDeviceSpec(spec, index);
    map.set(`${normalize(sanitized.brand)}::${normalize(sanitized.model)}`, sanitized);
  });

  if (Array.isArray(manual)) {
    manual.forEach((spec, index) => {
      const sanitized = sanitizeDeviceSpec(spec, index);
      map.set(`${normalize(sanitized.brand)}::${normalize(sanitized.model)}`, sanitized);
    });
  }

  cachedDeviceSpecs = [...map.values()];
  return cachedDeviceSpecs;
}

function loadCompatibilityAuditLog() {
  if (cachedAuditLog) return cachedAuditLog;
  const data = readJsonFileSafe(AUDIT_LOG_JSON_PATH);
  cachedAuditLog = Array.isArray(data) ? data : [];
  return cachedAuditLog;
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeWhitespace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function compactNormalized(value = '') {
  return normalize(value).replace(/[^a-z0-9]+/g, '');
}

function stripKnownModelPrefixes(brand = '', model = '') {
  let cleaned = normalizeWhitespace(model);
  const normalizedBrand = normalize(brand);

  if (!cleaned) return '';
  if (normalizedBrand === 'samsung') cleaned = cleaned.replace(/^samsung\s+/i, '').replace(/^galaxy\s+/i, '');
  if (normalizedBrand === 'motorola') cleaned = cleaned.replace(/^motorola\s+/i, '').replace(/^moto\s+/i, '');
  if (normalizedBrand === 'apple') cleaned = cleaned.replace(/^apple\s+/i, '');
  if (normalizedBrand === 'xiaomi') cleaned = cleaned.replace(/^xiaomi\s+/i, '');
  if (normalizedBrand === 'oppo') cleaned = cleaned.replace(/^oppo\s+/i, '');
  if (normalizedBrand === 'honor') cleaned = cleaned.replace(/^honor\s+/i, '');
  if (normalizedBrand === 'realme') cleaned = cleaned.replace(/^realme\s+/i, '');

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

function getAccessoryCatalogIndex() {
  if (cachedCatalog) return cachedCatalog;

  const db = loadAccessories();
  const brandSet = new Set();
  const allModelsSet = new Set();
  const modelsByBrand = new Map();
  const aliasSet = new Set();

  const items = db.map(item => {
    const brand = normalizeWhitespace(item.brand);
    const model = normalizeWhitespace(item.model);
    const equivalentAliases = safeArray(item.equivalents)
      .map(sanitizeEquivalentReference)
      .filter(Boolean)
      .flatMap(entry => buildAccessoryModelAliases({ brand: entry.brand || brand, model: entry.model }));
    const aliases = [...new Set([
      ...buildAccessoryModelAliases({ brand, model }),
      ...equivalentAliases
    ])];
    const profile = buildAccessoryCompatibilityProfile(brand, model);
    const normalizedSubtype = normalize(item.subtype);
    const subtypeHints = ACCESSORY_SUBTYPE_HINTS[normalizedSubtype] || [];
    const source = sanitizeSource(item.source || item);
    const supplierReferences = safeArray(item.supplierReferences || item.suppliers)
      .map(sanitizeSupplierReference)
      .filter(Boolean);
    const images = safeArray(item.images)
      .map(sanitizeImageReference)
      .filter(Boolean);
    const equivalents = safeArray(item.equivalents)
      .map(sanitizeEquivalentReference)
      .filter(Boolean);
    const searchText = normalize([
      item.name,
      brand,
      model,
      item.subtype,
      item.keywords || '',
      ...equivalents.map(entry => `${entry.brand || brand} ${entry.model}`),
      ...supplierReferences.map(entry => `${entry.supplier} ${entry.sku} ${entry.name}`),
      ...aliases,
      ...subtypeHints
    ].join(' '));

    brandSet.add(brand);
    aliases.forEach(alias => aliasSet.add(alias));

    const brandKey = normalize(brand);
    if (!modelsByBrand.has(brandKey)) modelsByBrand.set(brandKey, new Set());
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
      profile,
      source,
      confidence: Number(item.confidence || 0) || undefined,
      supplierReferences,
      images,
      equivalents
    };
  });

  cachedCatalog = {
    items,
    brands: [...brandSet].filter(Boolean).sort(),
    modelsByBrand: new Map([...modelsByBrand.entries()].map(([key, set]) => [key, [...set].sort()])),
    allModels: [...allModelsSet].map(value => value.split('::')[1]).filter(Boolean).sort(),
    stats: {
      totalAccessories: db.length,
      totalBrands: brandSet.size,
      totalModels: allModelsSet.size,
      totalAliases: aliasSet.size,
      totalCompatibilityGroups: loadCompatibilityGroups().length
    }
  };

  return cachedCatalog;
}

function detectAccessoryBrand(rawText = '') {
  const normalizedText = normalize(rawText);
  return getAccessoryCatalogIndex().brands
    .sort((a, b) => b.length - a.length)
    .find(brand => normalizedText.includes(normalize(brand))) || '';
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

function normalizeCompatibilityModelReference(brand = '', model = '') {
  const normalizedBrand = normalizeWhitespace(brand);
  const cleanedModel = stripKnownModelPrefixes(normalizedBrand, model);
  const joined = normalizeWhitespace([normalizedBrand, cleanedModel].filter(Boolean).join(' '));
  return {
    joined,
    compact: compactNormalized(joined || cleanedModel || model)
  };
}

function findDeviceSpecForContext(context = {}) {
  const aliases = new Set((context.aliases || []).map(alias => compactNormalized(alias)).filter(Boolean));
  const raw = compactNormalized([context.brand, context.model, context.rawQuery].filter(Boolean).join(' '));
  if (raw) aliases.add(raw);

  return loadDeviceSpecs().find(spec => {
    const specAliases = [
      ...buildAccessoryModelAliases({ brand: spec.brand, model: spec.model }),
      ...safeArray(spec.aliases)
    ].map(alias => compactNormalized(alias)).filter(Boolean);

    return specAliases.some(alias => aliases.has(alias));
  }) || null;
}

function getEquivalentDeviceSpecs(baseSpec = null, subtype = '') {
  if (!baseSpec) return [];

  const normalizedSubtype = normalize(subtype);
  const allSpecs = loadDeviceSpecs();
  const compareByScreen = ['vidrio', 'hidrogel'].includes(normalizedSubtype);
  const profileKey = compareByScreen
    ? (baseSpec.profiles?.screenProfile || baseSpec.profiles?.bodyProfile || '')
    : (baseSpec.profiles?.caseProfile || baseSpec.profiles?.bodyProfile || '');

  const equivalentKeys = new Set(
    safeArray(baseSpec.equivalents).map(entry => `${normalize(entry.brand || '')}::${normalize(entry.model || '')}`)
  );

  return allSpecs.filter(candidate => {
    if (normalize(candidate.brand) === normalize(baseSpec.brand) && normalize(candidate.model) === normalize(baseSpec.model)) {
      return false;
    }

    const candidateKey = `${normalize(candidate.brand || '')}::${normalize(candidate.model || '')}`;
    if (equivalentKeys.has(candidateKey)) return true;

    if (profileKey) {
      const candidateProfile = compareByScreen
        ? (candidate.profiles?.screenProfile || candidate.profiles?.bodyProfile || '')
        : (candidate.profiles?.caseProfile || candidate.profiles?.bodyProfile || '');
      if (candidateProfile && normalize(candidateProfile) === normalize(profileKey)) return true;
    }

    if (!compareByScreen && baseSpec.physical?.connector && candidate.physical?.connector) {
      return normalize(baseSpec.physical.connector) === normalize(candidate.physical.connector) &&
        normalize(baseSpec.brand) === normalize(candidate.brand);
    }

    return false;
  });
}

function buildSpecAliases(spec = null) {
  if (!spec) return [];
  const aliases = [
    ...buildAccessoryModelAliases({ brand: spec.brand, model: spec.model }),
    ...safeArray(spec.aliases),
    ...safeArray(spec.equivalents).flatMap(entry =>
      buildAccessoryModelAliases({ brand: entry.brand || spec.brand, model: entry.model || '' })
    )
  ];

  return [...new Set(aliases.map(alias => normalize(alias)).filter(Boolean))];
}

function groupMemberMatches(member, brand = '', aliases = []) {
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

  return loadCompatibilityGroups().filter(group => {
    const sameBrand = !context.brand || !group.brand || normalize(group.brand) === normalize(context.brand);
    if (!sameBrand) return false;
    if (!groupSupportsSubtype(group, subtype)) return false;

    return (group.members || []).some(member =>
      groupMemberMatches(member, group.brand || context.brand, compactAliases)
    );
  });
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
      groupMemberMatches(member, group.brand || item.brand, itemAliases)
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

function inferAccessoryConnector({ brand = '', model = '', rawQuery = '' } = {}) {
  const normalizedBrand = normalize(brand || detectAccessoryBrand(rawQuery));
  const normalizedModel = normalize(model || rawQuery);

  if (normalizedBrand === 'apple' && normalizedModel.includes('iphone')) {
    const match = normalizedModel.match(/iphone\s*(\d+)/);
    const generation = match ? parseInt(match[1], 10) : 0;
    return generation >= 15 ? 'usbc' : 'lightning';
  }

  if (['samsung', 'xiaomi', 'motorola', 'oppo', 'vivo', 'realme', 'huawei', 'tecno', 'infinix', 'honor'].includes(normalizedBrand)) {
    return 'usbc';
  }

  return '';
}

function getUniversalAccessoryMatches(context = {}) {
  const catalog = getAccessoryCatalogIndex();
  const connector = inferAccessoryConnector(context);
  const universalMatches = [];

  if (connector) {
    universalMatches.push(...catalog.items.filter(item => {
      const compactModel = item.profile.compactModel;
      const itemKeywords = item.searchText;
      if (connector === 'lightning') return compactModel.includes('lightning') || itemKeywords.includes('lightning');
      if (connector === 'usbc') return compactModel.includes('usbc') || itemKeywords.includes('usb-c') || itemKeywords.includes('usb c');
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
    .slice(0, 12);
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

function getInventoryCompatibilityMatches(context, subtype = '', compatibilityGroups = [], inventory = []) {
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

  return inventory
    .filter(product => product.isActive !== false && Number(product.stock || 0) > 0)
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
        stock: Number(product.stock || 0),
        productId: product._id,
        _score: score
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score || a.name.localeCompare(b.name))
    .slice(0, 24);
}

function searchCompatibility({ brand = '', model = '', query = '', text = '', subtype = '', limit = 60, inventory = [] } = {}) {
  const catalog = getAccessoryCatalogIndex();
  const context = extractAccessorySearchContext({ brand, model, query, text });
  const normalizedSubtype = normalize(subtype);
  const deviceSpec = findDeviceSpecForContext(context);
  const equivalentSpecs = getEquivalentDeviceSpecs(deviceSpec, normalizedSubtype);
  const expandedAliases = [...new Set([
    ...(context.aliases || []),
    ...buildSpecAliases(deviceSpec),
    ...equivalentSpecs.flatMap(buildSpecAliases)
  ])].filter(Boolean);
  const compatibilityGroups = findCompatibilityGroupsForContext(context, normalizedSubtype);
  const compatibilityGroup = compatibilityGroups[0] || null;
  const hasSearch = expandedAliases.length > 0 || context.words.length > 0;

  if (!hasSearch) {
    return {
      context,
      deviceSpec,
      equivalentSpecs,
      compatibilityGroup,
      compatibilityGroups,
      compatibilityLabel: getCompatibilityGroupLabel(compatibilityGroups),
      inventoryMatches: [],
      exactMatches: [],
      profileMatches: [],
      specMatches: [],
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
      const aliasHit = expandedAliases.some(alias => alias && item.aliasSet.has(alias));
      const compactHit = expandedAliases.some(alias => alias && item.profile.compactModel.includes(compactNormalized(alias)));
      const wordsHit = context.words.length > 0 && context.words.every(word =>
        item.searchText.includes(word) || item.aliases.some(alias => alias.includes(word))
      );
      const explicitProfileHit = itemMatchesCompatibilityGroup(item, compatibilityGroups, normalizedSubtype);
      const inferredProfileHit = isConnectivityVariantProfileMatch(context.profile, item.profile);
      const specHit = equivalentSpecs.some(spec =>
        buildSpecAliases(spec).some(alias => item.aliasSet.has(normalize(alias)) || item.profile.compactModel.includes(compactNormalized(alias)))
      );
      const profileHit = explicitProfileHit || inferredProfileHit;
      const familyHit = Boolean(
        context.profile?.familyKey &&
        item.profile.familyKey &&
        context.profile.familyKey === item.profile.familyKey &&
        (!context.brand || brandMatches)
      );

      if ((!brandMatches && !aliasHit && !wordsHit && !familyHit && !profileHit && !specHit) || !subtypeMatches) {
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
        if (!aliasHit && !compactHit && !profileHit) matchType = 'family';
      }
      if (specHit) {
        score += 8;
        if (!profileHit) matchType = 'spec';
      }
      if (score === 0) return null;

      return { ...item, matchType, _score: score };
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
  const specMatches = scoredMatches.filter(item => item.matchType === 'spec');
  const exactMatches = scoredMatches.filter(item => !['family', 'profile', 'spec'].includes(item.matchType));
  const familyMatches = scoredMatches.filter(item => item.matchType === 'family');
  const inventoryMatches = getInventoryCompatibilityMatches({ ...context, aliases: expandedAliases }, subtype, compatibilityGroups, inventory);
  const universalMatches = getUniversalAccessoryMatches(context)
    .filter(item => !normalizedSubtype || item.normalizedSubtype === normalizedSubtype)
    .map(item => ({ ...item, matchType: 'universal' }));

  const allMatches = [...new Map(
    [...inventoryMatches, ...profileMatches, ...specMatches, ...exactMatches, ...familyMatches, ...universalMatches]
      .slice(0, Math.max(limit, 12))
      .map(item => [item.id, item])
  ).values()];

  const relatedModels = context.profile?.seriesKey
    ? [...new Map(
      catalog.items
        .filter(item => {
          const sameBrand = !context.brand || item.normalizedBrand === normalize(context.brand);
          return sameBrand && item.profile.seriesKey && item.profile.seriesKey === context.profile.seriesKey;
        })
        .map(item => [`${item.brand}::${item.model}`, { brand: item.brand, model: item.model }])
    ).values()]
      .filter(item => compactNormalized(item.model) !== compactNormalized(context.model))
      .sort((a, b) => a.model.localeCompare(b.model))
      .slice(0, 12)
    : [];

  getCompatibilityGroupModels(compatibilityGroups).reverse().forEach(item => {
    if (compactNormalized(item.model) === compactNormalized(context.model)) return;
    relatedModels.unshift(item);
  });

  equivalentSpecs.forEach(spec => {
    const key = `${spec.brand}::${spec.model}`;
    if (!relatedModels.some(item => `${item.brand}::${item.model}` === key)) {
      relatedModels.unshift({ brand: spec.brand, model: spec.model });
    }
  });

  return {
    context,
    deviceSpec,
    equivalentSpecs,
    compatibilityGroup,
    compatibilityGroups,
    compatibilityLabel: getCompatibilityGroupLabel(compatibilityGroups),
    inventoryMatches,
    exactMatches,
    profileMatches,
    specMatches,
    familyMatches,
    universalMatches,
    allMatches: allMatches.slice(0, limit),
    relatedModels
  };
}

function getPurchaseSuggestions(query = '', inventory = [], limit = 18) {
  const normalizedQuery = normalize(query);
  const compactQuery = compactNormalized(query);
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return { mine: [], devices: [], accessories: [], suggestions: [] };
  }

  const compatibilityResults = searchCompatibility({ query, limit: Math.max(limit, 24), inventory });
  const mine = inventory
    .filter(product => product.isActive !== false && (
      normalize(product.name).includes(normalizedQuery) ||
      compactNormalized(product.name).includes(compactQuery) ||
      normalize(`${product.brand || ''} ${product.category || ''}`).includes(normalizedQuery)
    ))
    .slice(0, 6)
    .map(product => ({
      source: 'mine',
      name: product.name,
      type: product.productType,
      brand: product.brand || '',
      model: product.category || '',
      stock: Number(product.stock || 0),
      suggestedPrice: Number(product.suggestedPrice || 0)
    }));

  const devices = [...new Map(
    [
      ...(compatibilityResults.relatedModels || []),
      ...(compatibilityResults.compatibilityGroups || []).flatMap(group =>
        (group.members || []).map(member => ({
          brand: group.brand || '',
          model: member.model || ''
        }))
      )
    ]
      .filter(item => item.model)
      .map(item => {
        const fullName = [item.brand, item.model].filter(Boolean).join(' ').trim();
        return [`${item.brand}::${item.model}`, {
          source: 'compatibility_device',
          kind: 'device',
          name: fullName || item.model,
          type: 'celular',
          brand: item.brand || '',
          model: item.model
        }];
      })
  ).values()]
    .filter(item =>
      normalize(item.name).includes(normalizedQuery) ||
      compactNormalized(item.name).includes(compactQuery) ||
      normalize(item.model).includes(normalizedQuery)
    )
    .slice(0, 8);

  const accessories = compatibilityResults.allMatches
    .slice(0, limit)
    .map(item => ({
      source: item.matchType === 'inventory' ? 'mine' : 'compatibility',
      kind: 'accessory',
      name: item.name,
      type: 'accesorio',
      brand: item.brand || '',
      model: item.model || '',
      subtype: item.subtype || 'accesorio',
      stock: Number(item.stock || 0),
      matchType: item.matchType
    }));

  const suggestions = [...mine, ...devices, ...accessories]
    .slice(0, limit);

  return { mine, devices, accessories, suggestions };
}

function getCatalogBrands() {
  return getAccessoryCatalogIndex().brands;
}

function getCatalogModels(brand = '') {
  const catalog = getAccessoryCatalogIndex();
  const normalizedBrand = normalize(brand);
  if (!normalizedBrand) return catalog.allModels;
  return catalog.modelsByBrand.get(normalizedBrand) || [];
}

function getCatalogSubtypes() {
  return [...new Set(
    getAccessoryCatalogIndex().items
      .map(item => item.normalizedSubtype || item.subtype)
      .filter(Boolean)
  )].sort((a, b) => (ACCESSORY_SUBTYPE_ORDER[a] || 99) - (ACCESSORY_SUBTYPE_ORDER[b] || 99));
}

function listCompatibilityGroups({ brand = '', subtype = '', query = '', limit = 100 } = {}) {
  const normalizedBrand = normalize(brand);
  const normalizedSubtype = normalize(subtype);
  const normalizedQuery = normalize(query);

  return loadCompatibilityGroups()
    .filter(group => {
      if (normalizedBrand && normalize(group.brand) !== normalizedBrand) return false;
      if (!groupSupportsSubtype(group, normalizedSubtype)) return false;
      if (!normalizedQuery) return true;

      const haystack = normalize([
        group.label,
        group.brand,
        group.notes,
        ...(group.members || []).flatMap(member => [member.model, ...(member.aliases || [])])
      ].join(' '));

      return haystack.includes(normalizedQuery);
    })
    .slice(0, limit);
}

function listAccessoryCatalog({ brand = '', model = '', subtype = '', query = '', limit = 120 } = {}) {
  const catalog = getAccessoryCatalogIndex();
  const normalizedBrand = normalize(brand);
  const normalizedModel = normalize(model);
  const compactModel = compactNormalized(model);
  const normalizedSubtype = normalize(subtype);
  const normalizedQuery = normalize(query);
  const compactQuery = compactNormalized(query);

  return catalog.items
    .filter(item => {
      if (normalizedBrand && item.normalizedBrand !== normalizedBrand) return false;
      if (normalizedSubtype && item.normalizedSubtype !== normalizedSubtype) return false;
      if (normalizedModel) {
        const modelMatches = normalize(item.model).includes(normalizedModel) || item.profile.compactModel.includes(compactModel);
        if (!modelMatches) return false;
      }
      if (normalizedQuery) {
        const queryMatches = item.searchText.includes(normalizedQuery) ||
          compactNormalized(item.name).includes(compactQuery) ||
          item.aliases.some(alias => alias.includes(normalizedQuery) || compactNormalized(alias).includes(compactQuery));
        if (!queryMatches) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const subtypeDiff = (ACCESSORY_SUBTYPE_ORDER[a.subtype] || 99) - (ACCESSORY_SUBTYPE_ORDER[b.subtype] || 99);
      if (subtypeDiff !== 0) return subtypeDiff;
      const brandDiff = a.brand.localeCompare(b.brand);
      if (brandDiff !== 0) return brandDiff;
      return a.model.localeCompare(b.model);
    })
    .slice(0, limit);
}

function getDeviceCompatibilityBundle({ brand = '', model = '', query = '', text = '', subtype = '', limit = 60, inventory = [] } = {}) {
  const results = searchCompatibility({ brand, model, query, text, subtype, limit, inventory });
  return {
    ...results,
    catalogStats: getAccessoryCatalogIndex().stats,
    availableSubtypes: getCatalogSubtypes(),
    totalDeviceSpecs: loadDeviceSpecs().length
  };
}

function listDeviceSpecs({ brand = '', query = '', limit = 200 } = {}) {
  const normalizedBrand = normalize(brand);
  const normalizedQuery = normalize(query);
  const compactQuery = compactNormalized(query);

  return loadDeviceSpecs()
    .filter(spec => {
      if (normalizedBrand && normalize(spec.brand) !== normalizedBrand) return false;
      if (!normalizedQuery) return true;

      const aliases = buildSpecAliases(spec);
      const haystack = normalize([
        spec.brand,
        spec.model,
        spec.notes || '',
        spec.physical?.cameraLayout || '',
        spec.physical?.buttons || '',
        ...aliases,
        ...safeArray(spec.supplierReferences).map(ref => `${ref.supplier} ${ref.sku}`)
      ].join(' '));

      return haystack.includes(normalizedQuery) || compactNormalized(haystack).includes(compactQuery);
    })
    .sort((a, b) => {
      const brandDiff = String(a.brand || '').localeCompare(String(b.brand || ''));
      if (brandDiff !== 0) return brandDiff;
      return String(a.model || '').localeCompare(String(b.model || ''));
    })
    .slice(0, limit);
}

function sanitizeCatalogItem(item = {}, index = 0) {
  const brand = normalizeWhitespace(item.brand || '');
  const model = normalizeWhitespace(item.model || '');
  const subtype = normalize(item.subtype || 'accesorio') || 'accesorio';
  const name = normalizeWhitespace(item.name || [subtype, brand, model].filter(Boolean).join(' '));

  return {
    id: item.id || `acc_custom_${Date.now()}_${index}`,
    name,
    brand,
    model,
    type: item.type || 'accesorio',
    subtype,
    emoji: item.emoji || '',
    keywords: normalizeWhitespace(item.keywords || [brand, model, subtype, name].filter(Boolean).join(' ')),
    source: sanitizeSource(item.source || item),
    confidence: Number(item.confidence || 0) || undefined,
    supplierReferences: safeArray(item.supplierReferences || item.suppliers).map(sanitizeSupplierReference).filter(Boolean),
    images: safeArray(item.images).map(sanitizeImageReference).filter(Boolean),
    equivalents: safeArray(item.equivalents).map(sanitizeEquivalentReference).filter(Boolean)
  };
}

function sanitizeGroup(group = {}, index = 0) {
  return {
    id: group.id || `group_custom_${Date.now()}_${index}`,
    label: normalizeWhitespace(group.label || 'Grupo compatible'),
    brand: normalizeWhitespace(group.brand || ''),
    profileType: normalize(group.profileType || 'mismo_molde') || 'mismo_molde',
    supportedSubtypes: Array.isArray(group.supportedSubtypes)
      ? group.supportedSubtypes.map(value => normalize(value)).filter(Boolean)
      : undefined,
    notes: normalizeWhitespace(group.notes || ''),
    dimensions: group.dimensions || undefined,
    cameraLayout: group.cameraLayout || undefined,
    source: sanitizeSource(group.source || group),
    confidence: Number(group.confidence || 0) || undefined,
    members: (Array.isArray(group.members) ? group.members : [])
      .map(member => ({
        model: normalizeWhitespace(member.model || ''),
        aliases: Array.isArray(member.aliases)
          ? member.aliases.map(alias => normalizeWhitespace(alias)).filter(Boolean)
          : []
      }))
      .filter(member => member.model)
  };
}

function saveAccessoriesCatalog(items = []) {
  const sanitized = items.map((item, index) => sanitizeCatalogItem(item, index));
  writeJsonFile(ACCESSORIES_JSON_PATH, sanitized);
  resetCompatibilityCache();
  return sanitized;
}

function saveCompatibilityGroups(groups = []) {
  const sanitized = groups.map((group, index) => sanitizeGroup(group, index));
  writeJsonFile(GROUPS_JSON_PATH, sanitized);
  resetCompatibilityCache();
  return sanitized;
}

function upsertCatalogItem(item = {}) {
  const current = loadAccessories();
  const sanitized = sanitizeCatalogItem(item, current.length);
  const next = current.filter(entry => entry.id !== sanitized.id);
  next.push(sanitized);
  saveAccessoriesCatalog(next);
  return sanitized;
}

function deleteCatalogItem(id = '') {
  const current = loadAccessories();
  const next = current.filter(entry => entry.id !== id);
  saveAccessoriesCatalog(next);
  return next.length !== current.length;
}

function upsertCompatibilityGroup(group = {}) {
  const current = loadCompatibilityGroups();
  const sanitized = sanitizeGroup(group, current.length);
  const next = current.filter(entry => entry.id !== sanitized.id);
  next.push(sanitized);
  saveCompatibilityGroups(next);
  return sanitized;
}

function deleteCompatibilityGroup(id = '') {
  const current = loadCompatibilityGroups();
  const next = current.filter(entry => entry.id !== id);
  saveCompatibilityGroups(next);
  return next.length !== current.length;
}

function importCatalogItems(items = [], mode = 'merge') {
  const current = mode === 'replace' ? [] : loadAccessories();
  const map = new Map(current.map(item => [item.id, item]));
  items.forEach((item, index) => {
    const sanitized = sanitizeCatalogItem(item, index);
    map.set(sanitized.id, sanitized);
  });
  const saved = saveAccessoriesCatalog([...map.values()]);
  return { count: saved.length };
}

function importCompatibilityGroups(groups = [], mode = 'merge') {
  const current = mode === 'replace' ? [] : loadCompatibilityGroups();
  const map = new Map(current.map(group => [group.id, group]));
  groups.forEach((group, index) => {
    const sanitized = sanitizeGroup(group, index);
    map.set(sanitized.id, sanitized);
  });
  const saved = saveCompatibilityGroups([...map.values()]);
  return { count: saved.length };
}

function saveDeviceSpecs(specs = []) {
  const sanitized = specs.map((spec, index) => sanitizeDeviceSpec(spec, index));
  writeJsonFile(DEVICE_SPECS_JSON_PATH, sanitized);
  resetCompatibilityCache();
  return sanitized;
}

function upsertDeviceSpec(spec = {}) {
  const current = loadDeviceSpecs();
  const sanitized = sanitizeDeviceSpec(spec, current.length);
  const next = current.filter(entry => entry.id !== sanitized.id);
  next.push(sanitized);
  saveDeviceSpecs(next);
  return sanitized;
}

function deleteDeviceSpec(id = '') {
  const current = loadDeviceSpecs();
  const next = current.filter(entry => entry.id !== id);
  saveDeviceSpecs(next);
  return next.length !== current.length;
}

function importDeviceSpecs(specs = [], mode = 'merge') {
  const current = mode === 'replace' ? [] : loadDeviceSpecs();
  const map = new Map(current.map(spec => [spec.id, spec]));
  specs.forEach((spec, index) => {
    const sanitized = sanitizeDeviceSpec(spec, index);
    map.set(sanitized.id, sanitized);
  });
  const saved = saveDeviceSpecs([...map.values()]);
  return { count: saved.length };
}

function appendCompatibilityAuditLog(entry = {}) {
  const current = loadCompatibilityAuditLog();
  const auditEntry = {
    id: `audit_${Date.now()}_${current.length}`,
    action: normalize(entry.action || '') || 'update',
    entityType: normalize(entry.entityType || '') || 'compatibility',
    entityId: normalizeWhitespace(entry.entityId || ''),
    label: normalizeWhitespace(entry.label || ''),
    userId: normalizeWhitespace(entry.userId || ''),
    userEmail: normalizeWhitespace(entry.userEmail || ''),
    userBusiness: normalizeWhitespace(entry.userBusiness || ''),
    details: entry.details && typeof entry.details === 'object' ? entry.details : {},
    createdAt: entry.createdAt || new Date().toISOString()
  };

  const next = [auditEntry, ...current].slice(0, 500);
  writeJsonFile(AUDIT_LOG_JSON_PATH, next);
  cachedAuditLog = next;
  return auditEntry;
}

function getCompatibilityAuditLog(limit = 120) {
  return loadCompatibilityAuditLog().slice(0, limit);
}

module.exports = {
  getAccessoryCatalogIndex,
  getCatalogBrands,
  getCatalogModels,
  getCatalogSubtypes,
  loadCompatibilityGroups,
  loadDeviceSpecs,
  listCompatibilityGroups,
  listAccessoryCatalog,
  listDeviceSpecs,
  searchCompatibility,
  getDeviceCompatibilityBundle,
  getPurchaseSuggestions,
  saveAccessoriesCatalog,
  saveCompatibilityGroups,
  saveDeviceSpecs,
  upsertCatalogItem,
  deleteCatalogItem,
  upsertCompatibilityGroup,
  deleteCompatibilityGroup,
  importCatalogItems,
  importCompatibilityGroups,
  upsertDeviceSpec,
  deleteDeviceSpec,
  importDeviceSpecs,
  appendCompatibilityAuditLog,
  getCompatibilityAuditLog
};
