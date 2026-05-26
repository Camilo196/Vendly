const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const ProductUnit = require('../models/ProductUnit');
const { protect } = require('../middleware/auth');
const { normalizeCode, normalizeSku, prepareProductCodes } = require('../utils/productCodes');

// Todas las rutas requieren autenticación
router.use(protect);

// @route   GET /api/products
// @desc    Obtener todos los productos del usuario
// @access  Private
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ 
      userId: req.user._id,
      isActive: true 
    }).sort({ name: 1 });
    
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos'
    });
  }
});

// @route   POST /api/products
// @desc    Crear nuevo producto
// @access  Private
router.post('/', async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      description,
      profitMargin,
      productType,
      suggestedPrice,
      commissionRate,
      sku,
      barcode,
      barcodeFormat
    } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del producto es obligatorio'
      });
    }
    
    // Verificar si el producto ya existe
    const existingProduct = await Product.findOne({
      userId: req.user._id,
      name: name.trim(),
      isActive: true
    });
    
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un producto con ese nombre'
      });
    }
    
    const codes = await prepareProductCodes(Product, {
      userId: req.user._id,
      name: name.trim(),
      brand,
      productType: productType || 'otro',
      sku,
      barcode,
      barcodeFormat
    });

    const product = await Product.create({
      userId: req.user._id,
      name: name.trim(),
      category,
      brand,
      description,
      stock: 0,
      averageCost: 0,
      profitMargin: profitMargin || 30, // 30% por defecto
      productType: productType || 'otro',
      suggestedPrice: suggestedPrice || 0,
      commissionRate: commissionRate !== undefined ? commissionRate : null,
      ...codes
    });
    
    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear producto',
      error: error.message
    });
  }
});

// ✅ RUTAS ESPECÍFICAS PRIMERO (antes de /:id)

// @route   GET /api/products/lookup/code/:code
// @desc    Buscar producto por código de barras o SKU
// @access  Private
router.get('/lookup/code/:code', async (req, res) => {
  try {
    const barcodeCode = normalizeCode(req.params.code);
    const skuCode = normalizeSku(req.params.code);

    if (!barcodeCode && !skuCode) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar un código válido'
      });
    }

    const product = await Product.findOne({
      userId: req.user._id,
      isActive: true,
      $or: [
        { barcode: barcodeCode },
        { sku: skuCode }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un producto con ese código'
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al buscar producto por código'
    });
  }
});

// @route   POST /api/products/:id/adjust
// @desc    Ajustar stock manualmente
// @access  Private
router.post('/:id/adjust', async (req, res) => {
  try {
    const { adjustment, reason } = req.body;
    
    if (adjustment === undefined || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Ajuste y razón son obligatorios'
      });
    }
    
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    if (parseFloat(adjustment) < 0) {
      const trackedAvailableUnits = await ProductUnit.countDocuments({
        userId: req.user._id,
        productId: product._id,
        status: 'available'
      });

      if (trackedAvailableUnits > 0) {
        return res.status(400).json({
          success: false,
          message: 'Este producto tiene unidades con IMEI/serial registradas. Para bajar stock, usa ventas o elimina la compra correspondiente.'
        });
      }
    }
    
    const oldStock = product.stock;
    product.stock += parseFloat(adjustment);
    
    if (product.stock < 0) product.stock = 0;
    
    await product.save();
    
    // Crear registro de ajuste como Purchase
    const Purchase = require('../models/Purchase');
    if (adjustment !== 0) {
      await Purchase.create({
        userId: req.user._id,
        productId: product._id,
        productName: product.name,
        quantity: Math.abs(adjustment),
        unitCost: product.averageCost || 0,
        totalCost: Math.abs(adjustment) * (product.averageCost || 0),
        supplier: adjustment > 0 ? 'AJUSTE POSITIVO' : 'AJUSTE NEGATIVO',
        notes: `${reason} (Stock anterior: ${oldStock}, Nuevo: ${product.stock})`,
        purchaseDate: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Stock ajustado correctamente',
      product,
      oldStock,
      newStock: product.stock
    });
  } catch (error) {
    console.error('Error al ajustar stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ajustar stock'
    });
  }
});

// @route   PUT /api/products/:id/deactivate
// @desc    Desactivar producto
// @access  Private
router.put('/:id/deactivate', async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    product.isActive = false;
    await product.save();
    
    res.json({
      success: true,
      message: 'Producto desactivado correctamente',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al desactivar producto'
    });
  }
});

// @route   GET /api/products/:id/units
// @desc    Obtener unidades serializadas de un producto
// @access  Private
router.get('/:id/units', async (req, res) => {
  try {
    const { status } = req.query;

    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const query = {
      userId: req.user._id,
      productId: product._id
    };

    if (status) query.status = status;

    const units = await ProductUnit.find(query).sort({ serialNumber: 1 });
    const availableCount = await ProductUnit.countDocuments({
      userId: req.user._id,
      productId: product._id,
      status: 'available'
    });

    res.json({
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        productType: product.productType,
        stock: product.stock
      },
      count: units.length,
      availableCount,
      units
    });
  } catch (error) {
    console.error('Error al obtener unidades serializadas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener unidades serializadas'
    });
  }
});

// @route   PUT /api/products/repair/reactivate
// @desc    Reactivar productos con isActive:false para que vuelvan a aparecer
// @access  Private
router.put('/repair/reactivate', async (req, res) => {
  try {
    const result = await Product.updateMany(
      { userId: req.user._id, isActive: false },
      { $set: { isActive: true } }
    );
    res.json({
      success: true,
      message: `${result.modifiedCount} productos reactivados`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al reparar productos' });
  }
});

// @route   POST /api/products/:id/barcode/generate
// @desc    Generar código interno para un producto
// @access  Private
router.post('/:id/barcode/generate', async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    if (product.barcode) {
      return res.json({
        success: true,
        message: 'Este producto ya tiene un código asignado',
        product
      });
    }

    const codes = await prepareProductCodes(Product, {
      userId: req.user._id,
      existingProduct: product,
      name: product.name,
      brand: product.brand,
      productType: product.productType
    });

    product.sku = codes.sku;
    product.barcode = codes.barcode;
    product.barcodeFormat = codes.barcodeFormat;
    product.barcodeSource = 'internal';
    await product.save();

    res.json({
      success: true,
      message: 'Código generado correctamente',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al generar código de barras'
    });
  }
});

// @route   POST /api/products/barcode/backfill
// @desc    Generar códigos internos solo para productos que aún no tienen
// @access  Private
router.post('/barcode/backfill', async (req, res) => {
  try {
    const products = await Product.find({
      userId: req.user._id,
      isActive: true,
      $or: [
        { barcode: { $exists: false } },
        { barcode: null },
        { barcode: '' }
      ]
    }).sort({ createdAt: 1 });

    let updatedCount = 0;

    for (const product of products) {
      const codes = await prepareProductCodes(Product, {
        userId: req.user._id,
        existingProduct: product,
        name: product.name,
        brand: product.brand,
        productType: product.productType
      });

      product.sku = product.sku || codes.sku;
      product.barcode = codes.barcode;
      product.barcodeFormat = codes.barcodeFormat;
      product.barcodeSource = 'internal';
      await product.save();
      updatedCount += 1;
    }

    res.json({
      success: true,
      message: updatedCount > 0
        ? `Se generaron códigos para ${updatedCount} producto(s)`
        : 'Todos tus productos ya tienen código',
      updatedCount
    });
  } catch (error) {
    console.error('Error generando códigos faltantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar códigos faltantes'
    });
  }
});

// ✅ RUTAS GENÉRICAS DESPUÉS (/:id debe ir al final)

// @route   GET /api/products/:id
// @desc    Obtener un producto específico
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener producto'
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Actualizar producto
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      description,
      profitMargin,
      productType,
      suggestedPrice,
      commissionRate,
      sku,
      barcode,
      barcodeFormat
    } = req.body;
    
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    const nextName = name ? name.trim() : product.name;
    const nextBrand = brand !== undefined ? brand : product.brand;
    const nextType = productType !== undefined ? productType : product.productType;

    if (name) product.name = nextName;
    if (category !== undefined) product.category = category;
    if (brand !== undefined) product.brand = brand;
    if (description !== undefined) product.description = description;
    if (profitMargin !== undefined) product.profitMargin = profitMargin;
    if (productType !== undefined) product.productType = nextType;
    if (suggestedPrice !== undefined) product.suggestedPrice = suggestedPrice;
    if (commissionRate !== undefined) product.commissionRate = commissionRate;

    if (sku !== undefined || barcode !== undefined || barcodeFormat !== undefined) {
      const codes = await prepareProductCodes(Product, {
        userId: req.user._id,
        existingProduct: product,
        name: nextName,
        brand: nextBrand,
        productType: nextType,
        sku,
        barcode,
        barcodeFormat
      });

      product.sku = codes.sku;
      product.barcode = codes.barcode;
      product.barcodeFormat = codes.barcodeFormat;
      product.barcodeSource = codes.barcodeSource;
    }
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Producto actualizado',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar producto'
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Eliminar producto (soft delete)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    if (product.stock > 0) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar un producto con stock. Véndelo o ajusta el inventario primero.'
      });
    }
    
    product.isActive = false;
    await product.save();
    
    res.json({
      success: true,
      message: 'Producto eliminado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar producto'
    });
  }
});

module.exports = router;
