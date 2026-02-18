const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const TechnicalService = require('../models/TechnicalService');
const Commission = require('../models/Commission');
const { protect } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/reports/sales
// @desc    Reporte de ventas con filtros
// @access  Private
router.get('/sales', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const userId = req.user._id;
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'daily') {
      const today = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      };
    } else if (period === 'weekly') {
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { $gte: weekAgo };
    } else if (period === 'monthly') {
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
      dateFilter = { $gte: monthAgo };
    } else if (period === 'yearly') {
      const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
      dateFilter = { $gte: yearAgo };
    } else if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const sales = await Sale.find({
      userId,
      saleDate: dateFilter
    }).populate('productId', 'name category').sort({ saleDate: -1 });
    
    const totalSales = sales.reduce((sum, sale) => sum + (sale.totalSale || 0), 0);
    const totalCost = sales.reduce((sum, sale) => sum + (sale.totalCost || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const totalItems = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    
    const byProduct = {};
    sales.forEach(sale => {
      const productName = sale.productName || 'Sin nombre';
      if (!byProduct[productName]) {
        byProduct[productName] = {
          name: productName,
          quantity: 0,
          sales: 0,
          profit: 0,
          commissions: 0,
          netProfit: 0,
          saleIds: []
        };
      }
      byProduct[productName].quantity += sale.quantity;
      byProduct[productName].sales += sale.totalSale;
      byProduct[productName].profit += sale.profit;
      byProduct[productName].saleIds.push(sale._id);
    });

    // Agregar comisiones por producto
    for (const key of Object.keys(byProduct)) {
      const commissions = await Commission.find({
        userId,
        referenceId: { $in: byProduct[key].saleIds },
        status: { $in: ['pending', 'approved', 'paid'] }
      });
      byProduct[key].commissions = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
      byProduct[key].netProfit = byProduct[key].profit - byProduct[key].commissions;
      delete byProduct[key].saleIds;
    }
    
    // Servicios técnicos en el mismo período
    const technicalServices = await TechnicalService.find({
      userId,
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
    });

    const totalTechnicalRevenue = technicalServices.reduce((sum, ts) => sum + (ts.laborCost || 0), 0);
    const totalTechnicalCommissions = technicalServices.reduce((sum, ts) => sum + (ts.technicianCommission || 0), 0);
    const totalTechnicalNetProfit = totalTechnicalRevenue - totalTechnicalCommissions;

    const byTechnicalService = technicalServices.map(ts => ({
      customer: ts.customer?.name || 'Sin nombre',
      device: `${ts.device?.brand || ''} ${ts.device?.model || ''}`.trim(),
      laborCost: ts.laborCost || 0,
      technicianCommission: ts.technicianCommission || 0,
      netProfit: (ts.laborCost || 0) - (ts.technicianCommission || 0),
      status: ts.status,
      date: ts.createdAt
    }));

    res.json({
      success: true,
      period: period || 'custom',
      summary: {
        totalTransactions: sales.length,
        totalSales,
        totalCost,
        totalProfit,
        totalItems,
        averageTicket: sales.length > 0 ? totalSales / sales.length : 0,
        totalTechnicalRevenue,
        totalTechnicalCommissions,
        totalTechnicalNetProfit
      },
      byProduct: Object.values(byProduct).sort((a, b) => b.sales - a.sales),
      byTechnicalService,
      transactions: sales
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte de ventas'
    });
  }
});

// @route   GET /api/reports/summary
// @desc    Reporte consolidado
// @access  Private
router.get('/summary', async (req, res) => {
  try {
    const { period } = req.query;
    const userId = req.user._id;
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'daily') {
      const today = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      };
    } else if (period === 'weekly') {
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { $gte: weekAgo };
    } else if (period === 'monthly') {
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
      dateFilter = { $gte: monthAgo };
    } else if (period === 'yearly') {
      const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
      dateFilter = { $gte: yearAgo };
    }
    
    const sales = await Sale.find({ userId, saleDate: dateFilter });
    const purchases = await Purchase.find({ userId, purchaseDate: dateFilter });
    const services = await TechnicalService.find({ userId, entryDate: dateFilter });
    
    const totalSales = sales.reduce((sum, s) => sum + (s.totalSale || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const totalServices = services.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    
    res.json({
      success: true,
      period: period || 'all',
      summary: {
        sales: {
          count: sales.length,
          total: totalSales,
          profit: totalProfit
        },
        purchases: {
          count: purchases.length,
          total: totalPurchases
        },
        services: {
          count: services.length,
          total: totalServices
        },
        balance: totalSales + totalServices - totalPurchases
      }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar resumen'
    });
  }
});

module.exports = router;