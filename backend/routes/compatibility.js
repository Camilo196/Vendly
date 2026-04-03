const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const {
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
} = require('../services/compatibilityService');

async function getInventoryProducts(userId) {
  return Product.find({ userId, isActive: { $ne: false } })
    .select('name brand category productType stock suggestedPrice averageCost isActive')
    .lean();
}

function auditChange(req, payload = {}) {
  appendCompatibilityAuditLog({
    ...payload,
    userId: req.user?._id?.toString() || '',
    userEmail: req.user?.email || '',
    userBusiness: req.user?.businessName || ''
  });
}

function buildPublicDocs() {
  return {
    success: true,
    name: 'Vendly Compatibility API',
    version: '1.0',
    description: 'API de compatibilidad para accesorios de celulares, con catalogo, perfiles fisicos, fichas tecnicas e importacion.',
    endpoints: [
      { method: 'GET', path: '/api/compatibility/public/docs', description: 'Documentacion basica de la API publica' },
      { method: 'GET', path: '/api/compatibility/public/meta', description: 'Resumen del catalogo, marcas, specs y grupos' },
      { method: 'GET', path: '/api/compatibility/public/brands', description: 'Listado de marcas disponibles' },
      { method: 'GET', path: '/api/compatibility/public/models?brand=Samsung', description: 'Modelos por marca' },
      { method: 'GET', path: '/api/compatibility/public/subtypes', description: 'Tipos de accesorio' },
      { method: 'GET', path: '/api/compatibility/public/catalog?brand=Samsung&subtype=vidrio', description: 'Catalogo filtrado' },
      { method: 'GET', path: '/api/compatibility/public/groups?brand=Xiaomi', description: 'Grupos de compatibilidad' },
      { method: 'GET', path: '/api/compatibility/public/specs?brand=Samsung&query=A15', description: 'Fichas tecnicas y perfiles' },
      { method: 'GET', path: '/api/compatibility/public/device?query=Redmi Note 12 Pro 4G&subtype=estuche', description: 'Bundle de compatibilidad para un equipo' }
    ],
    entities: {
      catalog: ['id', 'name', 'brand', 'model', 'subtype', 'confidence', 'source', 'supplierReferences', 'images', 'equivalents'],
      group: ['id', 'label', 'brand', 'profileType', 'supportedSubtypes', 'confidence', 'source', 'members'],
      spec: ['id', 'brand', 'model', 'dimensions', 'physical', 'display', 'profiles', 'confidence', 'source', 'supplierReferences', 'images', 'equivalents']
    }
  };
}

router.get('/public/docs', async (req, res) => {
  res.json(buildPublicDocs());
});

router.get('/public/meta', async (req, res) => {
  try {
    const catalog = getAccessoryCatalogIndex();
    res.json({
      success: true,
      stats: {
        ...catalog.stats,
        totalGroups: loadCompatibilityGroups().length,
        totalDeviceSpecs: loadDeviceSpecs().length
      },
      brands: catalog.brands,
      subtypes: getCatalogSubtypes()
    });
  } catch (error) {
    console.error('Error loading public compatibility meta:', error);
    res.status(500).json({ success: false, message: 'Error al cargar metadata publica' });
  }
});

router.get('/public/brands', async (req, res) => {
  res.json({ success: true, brands: getCatalogBrands() });
});

router.get('/public/models', async (req, res) => {
  res.json({ success: true, brand: req.query.brand || '', models: getCatalogModels(req.query.brand || '') });
});

router.get('/public/subtypes', async (req, res) => {
  res.json({ success: true, subtypes: getCatalogSubtypes() });
});

router.get('/public/catalog', async (req, res) => {
  try {
    const items = listAccessoryCatalog({
      brand: req.query.brand || '',
      model: req.query.model || '',
      subtype: req.query.subtype || '',
      query: req.query.query || '',
      limit: Number(req.query.limit || 120)
    });
    res.json({ success: true, count: items.length, items });
  } catch (error) {
    console.error('Error loading public accessory catalog:', error);
    res.status(500).json({ success: false, message: 'Error al cargar catalogo publico' });
  }
});

router.get('/public/groups', async (req, res) => {
  try {
    const groups = listCompatibilityGroups({
      brand: req.query.brand || '',
      subtype: req.query.subtype || '',
      query: req.query.query || '',
      limit: Number(req.query.limit || 100)
    });
    res.json({ success: true, count: groups.length, groups });
  } catch (error) {
    console.error('Error loading public compatibility groups:', error);
    res.status(500).json({ success: false, message: 'Error al cargar grupos publicos' });
  }
});

router.get('/public/specs', async (req, res) => {
  try {
    const specs = listDeviceSpecs({
      brand: req.query.brand || '',
      query: req.query.query || '',
      limit: Number(req.query.limit || 200)
    });
    res.json({ success: true, count: specs.length, specs });
  } catch (error) {
    console.error('Error loading public device specs:', error);
    res.status(500).json({ success: false, message: 'Error al cargar fichas tecnicas publicas' });
  }
});

router.get('/public/device', async (req, res) => {
  try {
    const bundle = getDeviceCompatibilityBundle({
      brand: req.query.brand || '',
      model: req.query.model || '',
      query: req.query.query || '',
      text: req.query.text || '',
      subtype: req.query.subtype || '',
      limit: Number(req.query.limit || 60),
      inventory: []
    });
    res.json({ success: true, ...bundle });
  } catch (error) {
    console.error('Error loading public device bundle:', error);
    res.status(500).json({ success: false, message: 'Error al cargar compatibilidad publica del dispositivo' });
  }
});

router.use(protect);

router.use('/admin', (req, res, next) => {
  const permissions = req.user?.permissions?.compatibility || {};

  if (req.method === 'GET') {
    return next();
  }

  if (req.path.includes('/import') && permissions.canImport === false) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para importar datos de compatibilidad' });
  }

  if (req.method === 'DELETE' && permissions.canDelete === false) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para borrar datos de compatibilidad' });
  }

  if (permissions.canWrite === false) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para editar la API de accesorios' });
  }

  return next();
});

router.get('/meta', async (req, res) => {
  try {
    const catalog = getAccessoryCatalogIndex();
    res.json({
      success: true,
      stats: catalog.stats,
      brands: catalog.brands,
      totalGroups: loadCompatibilityGroups().length,
      totalDeviceSpecs: loadDeviceSpecs().length
    });
  } catch (error) {
    console.error('Error loading compatibility meta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar metadatos de compatibilidad'
    });
  }
});

router.get('/brands', async (req, res) => {
  try {
    res.json({
      success: true,
      brands: getCatalogBrands()
    });
  } catch (error) {
    console.error('Error loading compatibility brands:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar marcas'
    });
  }
});

router.get('/models', async (req, res) => {
  try {
    res.json({
      success: true,
      brand: req.query.brand || '',
      models: getCatalogModels(req.query.brand || '')
    });
  } catch (error) {
    console.error('Error loading compatibility models:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar modelos'
    });
  }
});

router.get('/subtypes', async (req, res) => {
  try {
    res.json({
      success: true,
      subtypes: getCatalogSubtypes()
    });
  } catch (error) {
    console.error('Error loading compatibility subtypes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar tipos de accesorio'
    });
  }
});

router.get('/specs', async (req, res) => {
  try {
    const specs = listDeviceSpecs({
      brand: req.query.brand || '',
      query: req.query.query || '',
      limit: Number(req.query.limit || 200)
    });

    res.json({
      success: true,
      count: specs.length,
      specs
    });
  } catch (error) {
    console.error('Error loading compatibility specs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar fichas tecnicas'
    });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const groups = listCompatibilityGroups({
      brand: req.query.brand || '',
      subtype: req.query.subtype || '',
      query: req.query.query || '',
      limit: Number(req.query.limit || 100)
    });

    res.json({
      success: true,
      count: groups.length,
      groups
    });
  } catch (error) {
    console.error('Error loading compatibility groups:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar grupos de compatibilidad'
    });
  }
});

router.get('/catalog', async (req, res) => {
  try {
    const items = listAccessoryCatalog({
      brand: req.query.brand || '',
      model: req.query.model || '',
      subtype: req.query.subtype || '',
      query: req.query.query || '',
      limit: Number(req.query.limit || 120)
    });

    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('Error loading accessory catalog:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar el catalogo de accesorios'
    });
  }
});

router.get('/device', async (req, res) => {
  try {
    const inventory = await getInventoryProducts(req.user._id);
    const bundle = getDeviceCompatibilityBundle({
      brand: req.query.brand || '',
      model: req.query.model || '',
      query: req.query.query || '',
      text: req.query.text || '',
      subtype: req.query.subtype || '',
      limit: Number(req.query.limit || 60),
      inventory
    });

    res.json({
      success: true,
      ...bundle
    });
  } catch (error) {
    console.error('Error loading device compatibility bundle:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar compatibilidad del dispositivo'
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const inventory = await getInventoryProducts(req.user._id);
    const results = searchCompatibility({
      brand: req.query.brand || '',
      model: req.query.model || '',
      query: req.query.query || '',
      text: req.query.text || '',
      subtype: req.query.subtype || '',
      limit: Number(req.query.limit || 60),
      inventory
    });

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Error searching compatibility:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar compatibilidad'
    });
  }
});

router.get('/purchase-suggestions', async (req, res) => {
  try {
    const query = String(req.query.q || req.query.query || '').trim();
    const inventory = await getInventoryProducts(req.user._id);
    const suggestions = getPurchaseSuggestions(query, inventory, Number(req.query.limit || 18));

    res.json({
      success: true,
      query,
      ...suggestions
    });
  } catch (error) {
    console.error('Error loading purchase suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar sugerencias para compras'
    });
  }
});

router.post('/admin/catalog', async (req, res) => {
  try {
    const item = upsertCatalogItem(req.body || {});
    auditChange(req, {
      action: 'create',
      entityType: 'catalog',
      entityId: item.id,
      label: item.name,
      details: { brand: item.brand, model: item.model, subtype: item.subtype }
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Error saving catalog item:', error);
    res.status(400).json({ success: false, message: 'Error al guardar referencia del catalogo' });
  }
});

router.put('/admin/catalog/:id', async (req, res) => {
  try {
    const item = upsertCatalogItem({ ...req.body, id: req.params.id });
    auditChange(req, {
      action: 'update',
      entityType: 'catalog',
      entityId: item.id,
      label: item.name,
      details: { brand: item.brand, model: item.model, subtype: item.subtype }
    });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating catalog item:', error);
    res.status(400).json({ success: false, message: 'Error al actualizar referencia del catalogo' });
  }
});

router.delete('/admin/catalog/:id', async (req, res) => {
  try {
    const deleted = deleteCatalogItem(req.params.id);
    if (deleted) {
      auditChange(req, {
        action: 'delete',
        entityType: 'catalog',
        entityId: req.params.id,
        label: req.params.id
      });
    }
    res.json({ success: deleted, message: deleted ? 'Referencia eliminada' : 'Referencia no encontrada' });
  } catch (error) {
    console.error('Error deleting catalog item:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar referencia del catalogo' });
  }
});

router.post('/admin/groups', async (req, res) => {
  try {
    const group = upsertCompatibilityGroup(req.body || {});
    auditChange(req, {
      action: 'create',
      entityType: 'group',
      entityId: group.id,
      label: group.label,
      details: { brand: group.brand, members: (group.members || []).length }
    });
    res.status(201).json({ success: true, group });
  } catch (error) {
    console.error('Error saving compatibility group:', error);
    res.status(400).json({ success: false, message: 'Error al guardar grupo de compatibilidad' });
  }
});

router.put('/admin/groups/:id', async (req, res) => {
  try {
    const group = upsertCompatibilityGroup({ ...req.body, id: req.params.id });
    auditChange(req, {
      action: 'update',
      entityType: 'group',
      entityId: group.id,
      label: group.label,
      details: { brand: group.brand, members: (group.members || []).length }
    });
    res.json({ success: true, group });
  } catch (error) {
    console.error('Error updating compatibility group:', error);
    res.status(400).json({ success: false, message: 'Error al actualizar grupo de compatibilidad' });
  }
});

router.delete('/admin/groups/:id', async (req, res) => {
  try {
    const deleted = deleteCompatibilityGroup(req.params.id);
    if (deleted) {
      auditChange(req, {
        action: 'delete',
        entityType: 'group',
        entityId: req.params.id,
        label: req.params.id
      });
    }
    res.json({ success: deleted, message: deleted ? 'Grupo eliminado' : 'Grupo no encontrado' });
  } catch (error) {
    console.error('Error deleting compatibility group:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar grupo de compatibilidad' });
  }
});

router.post('/admin/import', async (req, res) => {
  try {
    const type = String(req.body.type || '').trim();
    const mode = String(req.body.mode || 'merge').trim();

    if (type === 'catalog') {
      const result = importCatalogItems(Array.isArray(req.body.items) ? req.body.items : [], mode);
      auditChange(req, {
        action: 'import',
        entityType: 'catalog',
        entityId: type,
        label: `Importacion ${type}`,
        details: { mode, count: result.count || 0 }
      });
      return res.json({ success: true, type, mode, ...result });
    }

    if (type === 'groups') {
      const result = importCompatibilityGroups(Array.isArray(req.body.items) ? req.body.items : [], mode);
      auditChange(req, {
        action: 'import',
        entityType: 'group',
        entityId: type,
        label: `Importacion ${type}`,
        details: { mode, count: result.count || 0 }
      });
      return res.json({ success: true, type, mode, ...result });
    }

    if (type === 'specs' || type === 'device_specs') {
      const result = importDeviceSpecs(Array.isArray(req.body.items) ? req.body.items : [], mode);
      auditChange(req, {
        action: 'import',
        entityType: 'spec',
        entityId: type,
        label: `Importacion ${type}`,
        details: { mode, count: result.count || 0 }
      });
      return res.json({ success: true, type, mode, ...result });
    }

    return res.status(400).json({
      success: false,
      message: 'Tipo de importacion invalido. Usa "catalog", "groups" o "specs"'
    });
  } catch (error) {
    console.error('Error importing compatibility data:', error);
    res.status(400).json({ success: false, message: 'Error al importar datos de compatibilidad' });
  }
});

router.post('/admin/specs', async (req, res) => {
  try {
    const spec = upsertDeviceSpec(req.body || {});
    auditChange(req, {
      action: 'create',
      entityType: 'spec',
      entityId: spec.id,
      label: `${spec.brand} ${spec.model}`.trim(),
      details: { brand: spec.brand, model: spec.model }
    });
    res.status(201).json({ success: true, spec });
  } catch (error) {
    console.error('Error saving device spec:', error);
    res.status(400).json({ success: false, message: 'Error al guardar ficha tecnica' });
  }
});

router.put('/admin/specs/:id', async (req, res) => {
  try {
    const spec = upsertDeviceSpec({ ...req.body, id: req.params.id });
    auditChange(req, {
      action: 'update',
      entityType: 'spec',
      entityId: spec.id,
      label: `${spec.brand} ${spec.model}`.trim(),
      details: { brand: spec.brand, model: spec.model }
    });
    res.json({ success: true, spec });
  } catch (error) {
    console.error('Error updating device spec:', error);
    res.status(400).json({ success: false, message: 'Error al actualizar ficha tecnica' });
  }
});

router.delete('/admin/specs/:id', async (req, res) => {
  try {
    const deleted = deleteDeviceSpec(req.params.id);
    if (deleted) {
      auditChange(req, {
        action: 'delete',
        entityType: 'spec',
        entityId: req.params.id,
        label: req.params.id
      });
    }
    res.json({ success: deleted, message: deleted ? 'Ficha tecnica eliminada' : 'Ficha tecnica no encontrada' });
  } catch (error) {
    console.error('Error deleting device spec:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar ficha tecnica' });
  }
});

router.get('/admin/audit', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const entries = getCompatibilityAuditLog(limit);
    res.json({ success: true, count: entries.length, entries });
  } catch (error) {
    console.error('Error loading compatibility audit log:', error);
    res.status(500).json({ success: false, message: 'Error al cargar historial de cambios' });
  }
});

module.exports = router;
