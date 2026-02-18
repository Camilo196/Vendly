const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const User = require('../models/User');
const Commission = require('../models/Commission');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');

router.use(protect);

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
    const { productId, quantity, unitPrice, customer, paymentMethod, notes, saleDate, employeeId } = req.body;
    
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
    
    // Actualizar estadísticas del usuario
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalSales': 1 }
    });
    
    // ⭐ CREAR COMISIÓN SOLO SI ES UN CELULAR
    console.log('\n💰 VERIFICANDO COMISIÓN...');
    console.log('  employeeId:', employeeId);
    console.log('  productType:', product.productType);
    
    if (employeeId && product.productType === 'celular') {
      try {
        console.log('✅ Producto es celular y hay empleado, buscando empleado...');
        const employee = await Employee.findOne({
          _id: employeeId,
          userId: req.user._id,
          isActive: true
        });
        
        console.log('  Empleado encontrado:', employee ? employee.name : 'No encontrado');
        console.log('  Comisión ventas habilitada:', employee?.commissionConfig?.sales?.enabled);
        
        if (employee && employee.commissionConfig.sales.enabled) {
          // ⭐ Usar comisión específica del producto si existe, sino usar la del empleado
          const commissionRate = product.commissionRate !== null && product.commissionRate !== undefined
            ? product.commissionRate
            : employee.commissionConfig.sales.rate;
          
          const commissionBase = sale.profit;
          const commissionAmount = (commissionBase * commissionRate) / 100;

          if (commissionBase > 0) {
            const commission = await Commission.create({
              userId: req.user._id,
              employeeId: employee._id,
              type: 'sale',
              referenceId: sale._id,
              description: `Venta: ${product.name} x${quantity}`,
              baseAmount: commissionBase,
              commissionRate,
              commissionAmount,
              date: sale.saleDate,
              status: 'pending'
            });
            console.log(`✅ Comisión: ${product.name} - ${commissionRate}% = $${commissionAmount.toFixed(2)}`);
          } else {
            console.log('ℹ️ No se creó comisión - venta sin ganancia');
          }
        } else {
          console.log('⚠️ No se creó comisión - Empleado no encontrado o comisión deshabilitada');
        }
      } catch (commError) {
        console.error('❌ Error al crear comisión:', commError);
        console.error('   Stack:', commError.stack);
      }
    } else {
      if (!employeeId) {
        console.log('ℹ️ No se creó comisión - No hay empleado asignado');
      } else if (product.productType !== 'celular') {
        console.log(`ℹ️ No se creó comisión - Tipo: ${product.productType} (solo celulares generan comisión)`);
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Venta registrada exitosamente',
      sale,
      product: {
        name: product.name,
        remainingStock: product.stock,
        productType: product.productType
      }
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
    
    if (quantity !== undefined && quantity !== sale.quantity) {
      const quantityDiff = quantity - sale.quantity;
      
      if (quantityDiff > 0 && product.stock < quantityDiff) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente. Disponible: ${product.stock}`
        });
      }
      
      product.stock -= quantityDiff;
      
      const oldTotal = sale.totalSale;
      sale.quantity = quantity;
      sale.calculateTotals();
      const newTotal = sale.totalSale;
      
      product.totalSold = product.totalSold - oldTotal + newTotal;
      await product.save();
    }
    
    if (unitPrice !== undefined) sale.unitPrice = unitPrice;
    if (customer !== undefined) sale.customer = customer;
    if (paymentMethod !== undefined) sale.paymentMethod = paymentMethod;
    if (notes !== undefined) sale.notes = notes;
    if (employeeId !== undefined) sale.employeeId = employeeId || null;
    
    sale.calculateTotals();
    await sale.save();

    // Actualizar comisión si cambió el empleado y es celular
    if (employeeId !== undefined && product.productType === 'celular') {
      // Borrar comisión anterior de esta venta si existe
      await Commission.deleteMany({ referenceId: sale._id, type: 'sale' });

      // Crear nueva comisión si hay empleado asignado
      if (employeeId) {
        const employee = await Employee.findOne({
          _id: employeeId,
          userId: req.user._id,
          isActive: true
        });

        if (employee && employee.commissionConfig.sales.enabled) {
          const commissionRate = product.commissionRate !== null && product.commissionRate !== undefined
            ? product.commissionRate
            : employee.commissionConfig.sales.rate;

          const commissionBase = sale.profit;
          const commissionAmount = (commissionBase * commissionRate) / 100;

          if (commissionBase > 0) {
            await Commission.create({
              userId: req.user._id,
              employeeId: employee._id,
              type: 'sale',
              referenceId: sale._id,
              description: `Venta: ${product.name} x${sale.quantity}`,
              baseAmount: commissionBase,
              commissionRate,
              commissionAmount,
              date: sale.saleDate,
              status: 'pending'
            });
          }
        }
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