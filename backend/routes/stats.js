const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const TechnicalService = require('../models/TechnicalService');
const { protect } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/stats/dashboard
// @desc    Obtener estadísticas generales para el dashboard
// @access  Private
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Productos (incluir todos, activos e inactivos)
    const products = await Product.find({ userId, stock: { $gt: 0 } });
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const currentInvestment = products.reduce((sum, p) => sum + (p.stock * p.averageCost), 0);
    const Commission = require('../models/Commission');
    const paidCommissions = await Commission.find({ userId: req.user._id, status: 'paid' });
    const totalPaidCommissions = paidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const pendingCommissions = await Commission.find({ userId: req.user._id, status: { $in: ['pending', 'approved'] } });
    const totalPendingCommissions = pendingCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    // Ventas totales
    const sales = await Sale.find({ userId });
    const totalSales = sales.reduce((sum, s) => sum + s.totalSale, 0);
    const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);

    // Servicios técnicos: solo contar los completados o entregados como ingreso real
    const technicalServices = await TechnicalService.find({ userId });
    const completedServices = technicalServices.filter(ts =>
      ts.status === 'completed' || ts.status === 'delivered'
    );
    const totalTechnicalRevenue = completedServices.reduce((sum, ts) => sum + (ts.laborCost || 0), 0);
    const totalTechnicalPartsProfit = completedServices.reduce((sum, ts) => {
      const partsPrice = ts.partsPrice || 0;
      const partsCost = ts.partsCost || 0;
      return sum + Math.max(0, partsPrice - partsCost);
    }, 0);
    const totalTechnicalProfit = totalTechnicalRevenue + totalTechnicalPartsProfit;

    // Ganancia total combinada (ventas + servicios técnicos completados/entregados)
    const totalCombinedProfit = totalProfit + totalTechnicalProfit;
    // Ganancia neta = ganancia total - comisiones pagadas - comisiones aprobadas
    // Las "approved" son deudas reales (el técnico ya hizo el trabajo), así que también se restan
    const netProfit = totalCombinedProfit - totalPaidCommissions - totalPendingCommissions;

    // Compras totales
    const purchases = await Purchase.find({ userId });
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalCost, 0);
    
    // Estadísticas de este mes
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthSales = await Sale.find({ 
      userId, 
      saleDate: { $gte: startOfMonth } 
    });
    const monthlySalesTotal = monthSales.reduce((sum, s) => sum + s.totalSale, 0);
    const monthlyProfit = monthSales.reduce((sum, s) => sum + s.profit, 0);
    
    const monthPurchases = await Purchase.find({ 
      userId, 
      purchaseDate: { $gte: startOfMonth } 
    });
    const monthlyPurchasesTotal = monthPurchases.reduce((sum, p) => sum + p.totalCost, 0);

    // Servicios técnicos de este mes (solo completados/entregados)
    const monthTechnicalServices = await TechnicalService.find({
      userId,
      status: { $in: ['completed', 'delivered'] },
      createdAt: { $gte: startOfMonth }
    });
    const monthlyTechnicalRevenue = monthTechnicalServices.reduce((sum, ts) => sum + (ts.laborCost || 0), 0);
    const monthlyTechnicalPartsProfit = monthTechnicalServices.reduce((sum, ts) => {
      return sum + Math.max(0, (ts.partsPrice || 0) - (ts.partsCost || 0));
    }, 0);
    const monthlyTechnicalProfit = monthlyTechnicalRevenue + monthlyTechnicalPartsProfit;
    
    // Productos más vendidos
    const topProducts = await Sale.aggregate([
      { $match: { userId: userId } },
      { 
        $group: { 
          _id: '$productId',
          productName: { $first: '$productName' },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalSale' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 }
    ]);
    
    // Productos con stock bajo
    const lowStockProducts = products
      .filter(p => p.stock > 0 && p.stock <= 10)
      .map(p => ({
        id: p._id,
        name: p.name,
        stock: p.stock,
        averageCost: p.averageCost
      }))
      .sort((a, b) => a.stock - b.stock);
    
    res.json({
      success: true,
      stats: {
        inventory: {
          totalProducts,
          totalStock,
          currentInvestment
        },
        commissions: {
          totalPaid: totalPaidCommissions,
          totalPending: totalPendingCommissions
        },
        sales: {
          allTime: {
            total: totalSales,
            profit: totalCombinedProfit,
            netProfit,
            technicalProfit: totalTechnicalProfit,
            count: sales.length
          },
          thisMonth: {
            total: monthlySalesTotal,
            profit: monthlyProfit + monthlyTechnicalProfit,
            count: monthSales.length
          }
        },
        purchases: {
          allTime: {
            total: totalPurchases,
            count: purchases.length
          },
          thisMonth: {
            total: monthlyPurchasesTotal,
            count: monthPurchases.length
          }
        },
        topProducts,
        lowStockProducts
      }
    });
  } catch (error) {
    console.error('Error en estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

// @route   GET /api/stats/products
// @desc    Obtener reporte por producto
// @access  Private
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ 
      userId: req.user._id,
      isActive: true 
    });
    
    const Commission = require('../models/Commission');

    const productStats = await Promise.all(
      products.map(async (product) => {
        const sales = await Sale.find({ productId: product._id });
        const purchases = await Purchase.find({ productId: product._id });

        const totalSold = sales.reduce((sum, s) => sum + s.totalSale, 0);
        const totalPurchased = purchases.reduce((sum, p) => sum + p.totalCost, 0);
        const profit = sales.reduce((sum, s) => sum + s.profit, 0);

        // Comisiones pagadas de las ventas de este producto
        const saleIds = sales.map(s => s._id);
        const commissions = await Commission.find({
          userId: req.user._id,
          referenceId: { $in: saleIds },
          status: { $in: ['pending', 'approved', 'paid'] }
        });
        const totalCommissions = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
        const netProfit = profit - totalCommissions;

        return {
          id: product._id,
          name: product.name,
          category: product.category,
          brand: product.brand,
          stock: product.stock,
          averageCost: product.averageCost,
          stockValue: product.stock * product.averageCost,
          totalPurchased,
          totalSold,
          profit,
          totalCommissions,
          netProfit,
          unitsSold: sales.reduce((sum, s) => sum + s.quantity, 0),
          unitsPurchased: purchases.reduce((sum, p) => sum + p.quantity, 0)
        };
      })
    );
    
    res.json({
      success: true,
      count: productStats.length,
      products: productStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener reporte de productos'
    });
  }
});

// @route   GET /api/stats/period
// @desc    Obtener estadísticas por período
// @access  Private
router.get('/period', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren fechas de inicio y fin'
      });
    }
    
    const query = {
      userId: req.user._id,
      saleDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    const sales = await Sale.find(query);
    const purchases = await Purchase.find({
      ...query,
      purchaseDate: query.saleDate
    });
    
    const totalSales = sales.reduce((sum, s) => sum + s.totalSale, 0);
    const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalCost, 0);
    
    res.json({
      success: true,
      period: {
        startDate,
        endDate
      },
      stats: {
        sales: {
          total: totalSales,
          count: sales.length,
          average: sales.length > 0 ? totalSales / sales.length : 0
        },
        purchases: {
          total: totalPurchases,
          count: purchases.length,
          average: purchases.length > 0 ? totalPurchases / purchases.length : 0
        },
        profit: totalProfit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del período'
    });
  }
});

module.exports = router;