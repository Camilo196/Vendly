const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const ProductUnit = require('../models/ProductUnit');
const User = require('../models/User');
const Commission = require('../models/Commission');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');

router.use(protect);

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeUnitIds(unitIds = []) {
  return (Array.isArray(unitIds) ? unitIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

async function getTrackedAvailability(userId, product) {
  const trackedAvailableCount = await ProductUnit.countDocuments({
    userId,
    productId: product._id,
    status: 'available'
  });

  return {
    trackedAvailableCount,
    availableUntrackedStock: Math.max(0, (parseFloat(product.stock) || 0) - trackedAvailableCount)
  };
}

async function createSaleCommission({ userId, sale, product, employeeId }) {
  if (!employeeId || product.productType !== 'celular' || sale.profit <= 0) {
    return null;
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    userId,
    isActive: true
  });

  if (!employee || !employee.commissionConfig?.sales?.enabled) {
    return null;
  }

  const commissionRate = product.commissionRate !== null && product.commissionRate !== undefined
    ? product.commissionRate
    : employee.commissionConfig.sales.rate;

  return Commission.create({
    userId,
    employeeId: employee._id,
    type: 'sale',
    referenceId: sale._id,
    description: `Venta: ${product.name} x${sale.quantity}`,
    baseAmount: sale.profit,
    commissionRate,
    commissionAmount: (sale.profit * commissionRate) / 100,
    date: sale.saleDate,
    status: 'pending'
  });
}

// @route   GET /api/sales
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;
    
    let query = { userId: req.user._id };
    
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }
    
    if (productId) {
      query.productId = productId;
    }
    
    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .populate('productId', 'name productType')
      .populate('employeeId', 'name');
    
    res.json({
      success: true,
      count: sales.length,
      sales
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener ventas'
    });
  }
});

// @route   POST /api/sales
router.post('/', async (req, res) => {
  try {
    const { productId, quantity, unitPrice, customer, paymentMethod, notes, saleDate, employeeId, unitIds } = req.body;
    const normalizedUnitIds = normalizeUnitIds(unitIds);
    const requestedQuantity = parseFloat(quantity);
    
    if (!productId || !quantity || unitPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Producto, cantidad y precio son obligatorios'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }
    
    // Buscar producto
    const product = await Product.findOne({
      _id: productId,
      userId: req.user._id,
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const { trackedAvailableCount, availableUntrackedStock } = await getTrackedAvailability(req.user._id, product);

    let selectedUnits = [];
    if (normalizedUnitIds.length > 0) {
      const uniqueIds = new Set(normalizedUnitIds);
      if (uniqueIds.size !== normalizedUnitIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Hay unidades serializadas repetidas en la venta'
        });
      }

      if (normalizedUnitIds.length !== requestedQuantity) {
        return res.status(400).json({
          success: false,
          message: 'La cantidad debe coincidir con las unidades IMEI/serial seleccionadas'
        });
      }

      selectedUnits = await ProductUnit.find({
        _id: { $in: normalizedUnitIds },
        userId: req.user._id,
        productId: product._id,
        status: 'available'
      });

      if (selectedUnits.length !== normalizedUnitIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Una o varias unidades IMEI/serial ya no están disponibles'
        });
      }
    } else if (trackedAvailableCount > 0 && requestedQuantity > availableUntrackedStock) {
      return res.status(400).json({
        success: false,
        message: `Este producto tiene ${trackedAvailableCount} unidad(es) con IMEI/serial disponible(s). Para vender más de ${availableUntrackedStock} sin serial, selecciona los IMEIs exactos.`
      });
    }
    
    // Verificar stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente. Disponible: ${product.stock}`
      });
    }
    
    // Verificar que el producto tenga un costo promedio
    if (product.averageCost === 0 || product.averageCost === undefined) {
      return res.status(400).json({
        success: false,
        message: 'El producto no tiene un costo registrado. Debe realizar una compra primero.'
      });
    }
    
    // Crear venta
    const sale = new Sale({
      userId: req.user._id,
      productId: product._id,
      productName: product.name,
      quantity: parseFloat(quantity),
      unitPrice: parseFloat(unitPrice),
      unitCost: parseFloat(product.averageCost),
      employeeId: employeeId || null,
      unitIds: selectedUnits.map(unit => unit._id),
      serialNumbers: selectedUnits.map(unit => unit.serialNumber),
      customer,
      paymentMethod,
      notes,
      saleDate: saleDate || new Date()
    });
    
    await sale.save();
    
    // Actualizar stock del producto
    product.stock -= parseFloat(quantity);
    product.totalSold += sale.totalSale;
    await product.save();

    if (selectedUnits.length > 0) {
      await ProductUnit.updateMany(
        {
          _id: { $in: selectedUnits.map(unit => unit._id) },
          userId: req.user._id
        },
        {
          $set: {
            status: 'sold',
            saleId: sale._id,
            soldAt: sale.saleDate
          }
        }
      );
    }
    
    // Actualizar estadísticas del usuario
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalSales': 1 }
    });
    
    try {
      await createSaleCommission({
        userId: req.user._id,
        sale,
        product,
        employeeId
      });
    } catch (commError) {
      console.error('❌ Error al crear comisión:', commError);
      console.error('   Stack:', commError.stack);
    }
    
    res.status(201).json({
      success: true,
      message: 'Venta registrada exitosamente',
      sale,
      product: {
        name: product.name,
        remainingStock: product.stock,
        productType: product.productType
      },
      serializedUnitsSold: selectedUnits.map(unit => unit.serialNumber)
    });
  } catch (error) {
    console.error('Error en venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar venta',
      error: error.message
    });
  }
});

// Resto de rutas (GET, PUT, DELETE) - mantener igual que antes
router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('productId', 'name productType');
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }
    
    res.json({
      success: true,
      sale
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener venta'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { quantity, unitPrice, customer, paymentMethod, notes, employeeId } = req.body;
    
    const sale = await Sale.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }
    
    const product = await Product.findOne({
      _id: sale.productId,
      userId: req.user._id
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const nextQuantity = quantity !== undefined ? parseFloat(quantity) : sale.quantity;
    if (quantity !== undefined && (Number.isNaN(nextQuantity) || nextQuantity <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    const nextUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : sale.unitPrice;
    if (unitPrice !== undefined && Number.isNaN(nextUnitPrice)) {
      return res.status(400).json({
        success: false,
        message: 'El precio debe ser válido'
      });
    }

    if (sale.unitIds?.length > 0 && quantity !== undefined && nextQuantity !== sale.unitIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Esta venta tiene IMEIs/seriales asociados. Si necesitas cambiar la cantidad, elimina la venta y regístrala de nuevo.'
      });
    }

    const oldTotalSale = sale.totalSale;

    if (quantity !== undefined && nextQuantity !== sale.quantity) {
      const quantityDiff = nextQuantity - sale.quantity;
      
      if (quantityDiff > 0) {
        if (product.stock < quantityDiff) {
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente. Disponible: ${product.stock}`
          });
        }

        if (!sale.unitIds?.length) {
          const { trackedAvailableCount, availableUntrackedStock } = await getTrackedAvailability(req.user._id, product);

          if (trackedAvailableCount > 0 && quantityDiff > availableUntrackedStock) {
            return res.status(400).json({
              success: false,
              message: `Este producto tiene ${trackedAvailableCount} unidad(es) con IMEI/serial disponible(s). Para aumentar esta venta por encima de ${availableUntrackedStock} unidad(es) sin serial, registra una venta nueva seleccionando los IMEIs exactos.`
            });
          }
        }
      }

      product.stock -= quantityDiff;
      if (product.stock < 0) product.stock = 0;
      sale.quantity = nextQuantity;
    }

    if (unitPrice !== undefined) sale.unitPrice = nextUnitPrice;
    if (customer !== undefined) sale.customer = customer;
    if (paymentMethod !== undefined) sale.paymentMethod = paymentMethod;
    if (notes !== undefined) sale.notes = notes;
    if (employeeId !== undefined) sale.employeeId = employeeId || null;
    
    sale.calculateTotals();
    product.totalSold = Math.max(0, (product.totalSold || 0) - oldTotalSale + sale.totalSale);
    await product.save();
    await sale.save();

    const shouldRefreshCommission = product.productType === 'celular' && (
      hasValue(quantity) || hasValue(unitPrice) || employeeId !== undefined
    );

    if (shouldRefreshCommission) {
      const existingCommissions = await Commission.find({
        referenceId: sale._id,
        type: 'sale',
        userId: req.user._id
      });

      const hasPaidCommission = existingCommissions.some(c => c.status === 'paid');

      if (!hasPaidCommission) {
        await Commission.deleteMany({
          referenceId: sale._id,
          type: 'sale',
          userId: req.user._id
        });

        await createSaleCommission({
          userId: req.user._id,
          sale,
          product,
          employeeId: sale.employeeId
        });
      }
    }

    res.json({
      success: true,
      message: 'Venta actualizada exitosamente',
      sale
    });
  } catch (error) {
    console.error('Error al actualizar venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar venta'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }
    
    const product = await Product.findOne({
      _id: sale.productId,
      userId: req.user._id
    });
    
    if (product) {
      product.stock += sale.quantity;
      product.totalSold -= sale.totalSale;
      await product.save();
    }

    if (sale.unitIds?.length > 0) {
      await ProductUnit.updateMany(
        {
          _id: { $in: sale.unitIds },
          userId: req.user._id
        },
        {
          $set: {
            status: 'available',
            saleId: null,
            soldAt: null
          }
        }
      );
    }
    
    await Commission.deleteMany({
      referenceId: sale._id,
      type: 'sale'
    });
    
    await Sale.deleteOne({ _id: sale._id });
    
    res.json({
      success: true,
      message: 'Venta eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar venta'
    });
  }
});

module.exports = router;
