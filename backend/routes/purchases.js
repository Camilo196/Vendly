const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/purchases
// @desc    Obtener todas las compras del usuario
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;
    
    let query = { userId: req.user._id };
    
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) query.purchaseDate.$lte = new Date(endDate);
    }
    
    if (productId) {
      query.productId = productId;
    }
    
    const purchases = await Purchase.find(query)
      .sort({ purchaseDate: -1 })
      .populate('productId', 'name stock suggestedPrice productType');
    
    res.json({
      success: true,
      count: purchases.length,
      purchases
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener compras'
    });
  }
});

// @route   POST /api/purchases
// @desc    Registrar nueva compra CON DEBUGGING COMPLETO
// @access  Private
router.post('/', async (req, res) => {
  console.log('\n🛒 ========================================');
  console.log('📦 INICIANDO REGISTRO DE COMPRA');
  console.log('========================================');
  console.log('📅 Fecha:', new Date().toISOString());
  console.log('👤 Usuario ID:', req.user._id);
  console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      productName, 
      quantity, 
      unitCost, 
      suggestedPrice, 
      supplier, 
      invoice, 
      notes,
      productType,
      commissionRate
    } = req.body;
    
    console.log('\n🔍 VALORES EXTRAÍDOS:');
    console.log('  productName:', JSON.stringify(productName), '(tipo:', typeof productName, ')');
    console.log('  quantity:', quantity, '(tipo:', typeof quantity, ')');
    console.log('  unitCost:', unitCost, '(tipo:', typeof unitCost, ')');
    console.log('  suggestedPrice:', suggestedPrice, '(tipo:', typeof suggestedPrice, ')');
    console.log('  supplier:', JSON.stringify(supplier));
    console.log('  invoice:', JSON.stringify(invoice));
    console.log('  notes:', JSON.stringify(notes));
    console.log('  productType:', JSON.stringify(productType));
    console.log('  commissionRate:', commissionRate, '(tipo:', typeof commissionRate, ')');
    
    // VALIDACIÓN 1: productName
    console.log('\n✅ VALIDACIÓN 1: productName');
    if (!productName) {
      console.log('❌ FALLO: productName está vacío o undefined');
      return res.status(400).json({
        success: false,
        message: 'El nombre del producto es obligatorio (vacío)'
      });
    }
    if (productName.trim() === '') {
      console.log('❌ FALLO: productName está vacío después de trim');
      return res.status(400).json({
        success: false,
        message: 'El nombre del producto es obligatorio (solo espacios)'
      });
    }
    console.log('✅ productName válido:', productName.trim());
    
    // VALIDACIÓN 2: quantity
    console.log('\n✅ VALIDACIÓN 2: quantity');
    if (!quantity && quantity !== 0) {
      console.log('❌ FALLO: quantity está vacío o undefined');
      return res.status(400).json({
        success: false,
        message: 'La cantidad es obligatoria'
      });
    }
    if (isNaN(quantity)) {
      console.log('❌ FALLO: quantity no es un número:', quantity);
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser un número'
      });
    }
    if (quantity <= 0) {
      console.log('❌ FALLO: quantity debe ser mayor a 0:', quantity);
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }
    console.log('✅ quantity válida:', quantity);
    
    // VALIDACIÓN 3: unitCost
    console.log('\n✅ VALIDACIÓN 3: unitCost');
    if (unitCost === undefined || unitCost === null) {
      console.log('❌ FALLO: unitCost es undefined o null');
      return res.status(400).json({
        success: false,
        message: 'El costo unitario es obligatorio'
      });
    }
    if (isNaN(unitCost)) {
      console.log('❌ FALLO: unitCost no es un número:', unitCost);
      return res.status(400).json({
        success: false,
        message: 'El costo unitario debe ser un número'
      });
    }
    if (unitCost < 0) {
      console.log('❌ FALLO: unitCost no puede ser negativo:', unitCost);
      return res.status(400).json({
        success: false,
        message: 'El costo unitario no puede ser negativo'
      });
    }
    console.log('✅ unitCost válido:', unitCost);
    
    console.log('\n✅ TODAS LAS VALIDACIONES PASADAS');
    
    // Buscar producto existente
    console.log('\n🔎 BUSCANDO PRODUCTO EXISTENTE...');
    console.log('  userId:', req.user._id);
    console.log('  nombre a buscar:', productName.trim());
    
    let product = await Product.findOne({
      userId: req.user._id,
      name: { $regex: new RegExp(`^${productName.trim()}$`, 'i') },
      productType: productType || 'otro'
    });
    
    if (product) {
      console.log('✅ PRODUCTO ENCONTRADO:');
      console.log('  ID:', product._id);
      console.log('  Nombre:', product.name);
      console.log('  Stock actual:', product.stock);
      console.log('  Costo promedio actual:', product.averageCost);
      
      console.log('\n📝 ACTUALIZANDO PRODUCTO EXISTENTE...');
      const skipPriceUpdate = suggestedPrice !== undefined && suggestedPrice > 0;
      console.log('  skipPriceUpdate:', skipPriceUpdate);
      
      product.updateAverageCost(parseFloat(quantity), parseFloat(unitCost), skipPriceUpdate);
      console.log('  Nuevo stock:', product.stock);
      console.log('  Nuevo costo promedio:', product.averageCost);
      
      if (productType) {
        console.log('  Actualizando productType a:', productType);
        product.productType = productType;
      }
      
      if (commissionRate !== undefined && commissionRate !== null && commissionRate !== '') {
        const rate = parseFloat(commissionRate);
        console.log('  Actualizando commissionRate a:', rate);
        product.commissionRate = rate;
      }
      
      if (suggestedPrice && suggestedPrice > 0) {
        console.log('  Actualizando suggestedPrice a:', suggestedPrice);
        product.suggestedPrice = parseFloat(suggestedPrice);
      }
      
      console.log('💾 Guardando producto actualizado...');
      await product.save();
      console.log('✅ Producto actualizado correctamente');
      
    } else {
      console.log('🆕 PRODUCTO NO ENCONTRADO - CREANDO NUEVO...');
      
      const productData = {
        userId: req.user._id,
        name: productName.trim(),
        stock: parseFloat(quantity),
        averageCost: parseFloat(unitCost),
        totalPurchased: parseFloat(quantity) * parseFloat(unitCost),
        productType: productType || 'otro',
        commissionRate: (commissionRate !== undefined && commissionRate !== null && commissionRate !== '') 
          ? parseFloat(commissionRate) 
          : null
      };
      
      if (suggestedPrice && suggestedPrice > 0) {
        productData.suggestedPrice = parseFloat(suggestedPrice);
      }
      
      console.log('📦 Datos del nuevo producto:');
      console.log(JSON.stringify(productData, null, 2));
      
      console.log('💾 Creando producto en la base de datos...');
      product = await Product.create(productData);
      console.log('✅ Producto creado con ID:', product._id);
    }
    
    // Crear registro de compra
    console.log('\n📝 CREANDO REGISTRO DE COMPRA...');
    const purchaseData = {
      userId: req.user._id,
      productId: product._id,
      productName: product.name,
      productType: product.productType || 'otro',
      quantity: parseFloat(quantity),
      unitCost: parseFloat(unitCost),
      totalCost: parseFloat(quantity) * parseFloat(unitCost), // ⭐ CALCULAR EXPLÍCITAMENTE
      supplier: supplier || '',
      invoice: invoice || '',
      notes: notes || ''
    };
    
    console.log('🧾 Datos de la compra:');
    console.log(JSON.stringify(purchaseData, null, 2));
    
    console.log('💾 Guardando compra en la base de datos...');
    const purchase = new Purchase(purchaseData);
    await purchase.save();
    console.log('✅ Compra guardada con ID:', purchase._id);
    
    // Actualizar estadísticas
    console.log('\n📊 ACTUALIZANDO ESTADÍSTICAS DEL USUARIO...');
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalPurchases': 1 }
    });
    console.log('✅ Estadísticas actualizadas');
    
    console.log('\n🎉 ========================================');
    console.log('✅ COMPRA REGISTRADA EXITOSAMENTE');
    console.log('========================================\n');
    
    res.status(201).json({
      success: true,
      message: 'Compra registrada exitosamente',
      purchase,
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
        averageCost: product.averageCost,
        suggestedPrice: product.suggestedPrice,
        productType: product.productType,
        commissionRate: product.commissionRate
      }
    });
    
  } catch (error) {
    console.log('\n💥 ========================================');
    console.log('❌ ERROR EN REGISTRO DE COMPRA');
    console.log('========================================');
    console.error('❌ Error completo:', error);
    console.error('❌ Nombre del error:', error.name);
    console.error('❌ Mensaje:', error.message);
    console.error('❌ Stack trace:');
    console.error(error.stack);
    console.log('\n📦 Body que causó el error:');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('========================================\n');
    
    res.status(500).json({
      success: false,
      message: 'Error al registrar compra: ' + error.message,
      errorName: error.name,
      errorDetails: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        body: req.body
      } : undefined
    });
  }
});

// @route   GET /api/purchases/:id
// @desc    Obtener una compra específica
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('productId', 'name stock');
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }
    
    res.json({
      success: true,
      purchase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener compra'
    });
  }
});

// @route   PUT /api/purchases/:id
// @desc    Actualizar una compra
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { quantity, unitCost, supplier, invoice, notes, suggestedPrice, productType } = req.body;
    
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }
    
    // Guardar cantidad y costo anterior antes de modificar
    const oldQuantity = purchase.quantity;
    const oldUnitCost = purchase.unitCost;

    if (quantity !== undefined) purchase.quantity = quantity;
    if (unitCost !== undefined) purchase.unitCost = unitCost;
    if (supplier !== undefined) purchase.supplier = supplier;
    if (invoice !== undefined) purchase.invoice = invoice;
    if (notes !== undefined) purchase.notes = notes;
    if (productType !== undefined) purchase.productType = productType;

    // También actualizar el producto si cambian precio sugerido o tipo
    if ((suggestedPrice !== undefined || productType !== undefined) && purchase.productId) {
      let product = await Product.findOne({ _id: purchase.productId, userId: req.user._id });
      if (!product && purchase.productName) {
        product = await Product.findOne({ userId: req.user._id, name: { $regex: new RegExp('^' + purchase.productName.trim() + '$', 'i') } });
      }
      if (product) {
        if (suggestedPrice !== undefined && suggestedPrice > 0) product.suggestedPrice = suggestedPrice;
        if (productType !== undefined) product.productType = productType;
        await product.save();
      }
    }

    purchase.calculateTotals();
    await purchase.save();

    // Ajustar stock y/o costo promedio del producto si cambió cantidad o precio
    if (quantity !== undefined || unitCost !== undefined) {
      let product = null;
      if (purchase.productId) {
        product = await Product.findOne({ _id: purchase.productId, userId: req.user._id });
      }
      if (!product && purchase.productName) {
        product = await Product.findOne({
          userId: req.user._id,
          name: { $regex: new RegExp('^' + purchase.productName.trim() + '$', 'i') }
        });
      }
      if (product) {
        // Ajustar stock si cambió la cantidad
        if (quantity !== undefined) {
          const diff = purchase.quantity - oldQuantity;
          product.stock += diff;
          if (product.stock < 0) product.stock = 0;
        }
        // Recalcular costo promedio si cambió precio o cantidad
        // Fórmula: restar el aporte viejo y sumar el nuevo
        const oldCost = oldQuantity * oldUnitCost;
        const newCost = purchase.quantity * purchase.unitCost;
        const otherStock = product.stock - purchase.quantity;
        const otherValue = otherStock * product.averageCost;
        if (product.stock > 0) {
          product.averageCost = (otherValue + newCost) / product.stock;
        }
        await product.save();
      }
    }

    res.json({
      success: true,
      message: 'Compra actualizada exitosamente',
      purchase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar compra'
    });
  }
});

// @route   DELETE /api/purchases/:id
// @desc    Eliminar una compra y ajustar el inventario
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }
    
    // Buscar el producto asociado (por ID primero, luego por nombre)
    let product = null;
    if (purchase.productId) {
      product = await Product.findOne({ _id: purchase.productId, userId: req.user._id });
    }
    if (!product && purchase.productName) {
      product = await Product.findOne({
        userId: req.user._id,
        name: { $regex: new RegExp('^' + purchase.productName.trim() + '$', 'i') }
      });
    }
    
    if (product) {
      // Restar la cantidad de esta compra del stock
      product.stock -= purchase.quantity;
      
      if (product.stock <= 0) {
        product.stock = 0;
      }
      
      // Restar del total comprado
      product.totalPurchased -= purchase.totalCost;
      if (product.totalPurchased < 0) product.totalPurchased = 0;
      
      await product.save();
      console.log(`✅ Inventario actualizado: ${product.name} - Stock: ${product.stock}`);
    }
    
    // Eliminar la compra
    await Purchase.deleteOne({ _id: purchase._id });
    
    res.json({
      success: true,
      message: 'Compra eliminada y stock ajustado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar compra'
    });
  }
});

module.exports = router;