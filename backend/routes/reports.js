const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const TechnicalService = require('../models/TechnicalService');
const Commission = require('../models/Commission');
const Expense = require('../models/Expense');
const { protect } = require('../middleware/auth');

router.use(protect);

function getDateRange(period, startDate, endDate) {
  const now = new Date();
  let from = null;
  let to = null;
  let label = 'Personalizado';

  if (period === 'daily') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    label = 'Hoy';
  } else if (period === 'weekly') {
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    label = 'Últimos 7 días';
  } else if (period === 'monthly') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = 'Mes actual';
  } else if (period === 'previous_month') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 1);
    label = 'Mes anterior';
  } else if (period === 'yearly') {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear() + 1, 0, 1);
    label = 'Año actual';
  } else if (startDate && endDate) {
    from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
    label = 'Personalizado';
  }

  return {
    label,
    from,
    to,
    dateFilter: from && to ? { $gte: from, $lt: to } : null
  };
}

function buildQuery(userId, field, dateFilter) {
  const query = { userId };
  if (dateFilter) query[field] = dateFilter;
  return query;
}

function buildMonthlyTimeline({ sales, purchases, services, expenses, months = 6 }) {
  const timeline = [];
  const now = new Date();

  for (let offset = months - 1; offset >= 0; offset--) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);

    const monthSales = sales.filter(item => item.saleDate >= start && item.saleDate < end);
    const monthPurchases = purchases.filter(item => item.purchaseDate >= start && item.purchaseDate < end);
    const monthServices = services.filter(item => item.entryDate >= start && item.entryDate < end);
    const monthExpenses = expenses.filter(item => item.expenseDate >= start && item.expenseDate < end);

    timeline.push({
      label: start.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
      salesTotal: monthSales.reduce((sum, item) => sum + (item.totalSale || 0), 0),
      salesCount: monthSales.length,
      purchaseTotal: monthPurchases.reduce((sum, item) => sum + (item.totalCost || 0), 0),
      purchaseCount: monthPurchases.length,
      serviceTotal: monthServices.reduce((sum, item) => sum + (item.laborCost || 0), 0),
      serviceCount: monthServices.length,
      expenseTotal: monthExpenses.reduce((sum, item) => sum + (item.amount || 0), 0),
      expenseCount: monthExpenses.length
    });
  }

  return timeline.map(item => ({
    ...item,
    balance: item.salesTotal + item.serviceTotal - item.purchaseTotal - item.expenseTotal
  }));
}

// @route   GET /api/reports/sales
// @desc    Reporte de ventas con filtros
// @access  Private
router.get('/sales', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const userId = req.user._id;
    const { dateFilter, from, to, label } = getDateRange(period, startDate, endDate);

    const sales = await Sale.find(buildQuery(userId, 'saleDate', dateFilter))
      .populate('productId', 'name category')
      .sort({ saleDate: -1 });
    
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
    
    const purchases = await Purchase.find(buildQuery(userId, 'purchaseDate', dateFilter)).sort({ purchaseDate: -1 });
    const technicalServices = await TechnicalService.find(buildQuery(userId, 'entryDate', dateFilter)).sort({ entryDate: -1 });
    const expenses = await Expense.find(buildQuery(userId, 'expenseDate', dateFilter)).sort({ expenseDate: -1 });

    const totalTechnicalRevenue = technicalServices.reduce((sum, ts) => sum + (ts.laborCost || 0), 0);
    const totalTechnicalCommissions = technicalServices.reduce((sum, ts) => sum + (ts.technicianCommission || 0), 0);
    const totalTechnicalNetProfit = totalTechnicalRevenue - totalTechnicalCommissions;
    const totalExpenses = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.totalCost || 0), 0);
    const totalPurchaseUnits = purchases.reduce((sum, purchase) => sum + (purchase.quantity || 0), 0);
    const totalSalesCommissions = Object.values(byProduct).reduce((sum, product) => sum + (product.commissions || 0), 0);
    const openTechnicalServices = technicalServices.filter(ts => !['delivered', 'cancelled'].includes(ts.status)).length;
    const completedTechnicalServices = technicalServices.filter(ts => ['completed', 'delivered'].includes(ts.status)).length;

    const timelineStart = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
    const [timelineSales, timelinePurchases, timelineServices] = await Promise.all([
      Sale.find(buildQuery(userId, 'saleDate', { $gte: timelineStart })).select('saleDate totalSale profit'),
      Purchase.find(buildQuery(userId, 'purchaseDate', { $gte: timelineStart })).select('purchaseDate totalCost quantity'),
      TechnicalService.find(buildQuery(userId, 'entryDate', { $gte: timelineStart })).select('entryDate laborCost technicianCommission')
    ]);
    const timelineExpenses = await Expense.find(buildQuery(userId, 'expenseDate', { $gte: timelineStart })).select('expenseDate amount category');

    const byTechnicalService = technicalServices.map(ts => ({
      customer: ts.customer?.name || 'Sin nombre',
      device: `${ts.device?.brand || ''} ${ts.device?.model || ''}`.trim(),
      laborCost: ts.laborCost || 0,
      technicianCommission: ts.technicianCommission || 0,
      netProfit: (ts.laborCost || 0) - (ts.technicianCommission || 0),
      status: ts.status,
      date: ts.createdAt
    }));
    const byExpenseCategory = Object.entries(expenses.reduce((acc, item) => {
      const key = item.category || 'otros';
      acc[key] = (acc[key] || 0) + (item.amount || 0);
      return acc;
    }, {})).map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      period: period || 'custom',
      periodInfo: {
        label,
        startDate: from,
        endDate: to
      },
      summary: {
        totalTransactions: sales.length,
        totalSales,
        totalCost,
        totalProfit,
        totalItems,
        averageTicket: sales.length > 0 ? totalSales / sales.length : 0,
        totalPurchases,
        totalPurchaseUnits,
        totalPurchaseTransactions: purchases.length,
        totalExpenses,
        totalExpenseTransactions: expenses.length,
        totalSalesCommissions,
        totalTechnicalRevenue,
        totalTechnicalCommissions,
        totalTechnicalNetProfit,
        totalTechnicalTransactions: technicalServices.length,
        netBusinessProfit: totalProfit - totalSalesCommissions + totalTechnicalNetProfit - totalExpenses,
        operationalBalance: totalSales + totalTechnicalRevenue - totalPurchases - totalExpenses,
        openTechnicalServices,
        completedTechnicalServices
      },
      activity: {
        salesCount: sales.length,
        itemsSold: totalItems,
        purchaseCount: purchases.length,
        purchaseUnits: totalPurchaseUnits,
        purchaseInvestment: totalPurchases,
        expenseCount: expenses.length,
        expenseTotal: totalExpenses,
        technicalCount: technicalServices.length,
        openTechnicalServices,
        completedTechnicalServices
      },
      byProduct: Object.values(byProduct).sort((a, b) => b.sales - a.sales),
      byTechnicalService,
      byExpenseCategory,
      monthlyTimeline: buildMonthlyTimeline({
        sales: timelineSales,
        purchases: timelinePurchases,
        services: timelineServices,
        expenses: timelineExpenses
      }),
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
    const { dateFilter, label, from, to } = getDateRange(period, null, null);

    const sales = await Sale.find(buildQuery(userId, 'saleDate', dateFilter));
    const purchases = await Purchase.find(buildQuery(userId, 'purchaseDate', dateFilter));
    const services = await TechnicalService.find(buildQuery(userId, 'entryDate', dateFilter));
    const expenses = await Expense.find(buildQuery(userId, 'expenseDate', dateFilter));
    
    const totalSales = sales.reduce((sum, s) => sum + (s.totalSale || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const totalServices = services.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    res.json({
      success: true,
      period: period || 'all',
      periodInfo: {
        label,
        startDate: from,
        endDate: to
      },
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
        expenses: {
          count: expenses.length,
          total: totalExpenses
        },
        balance: totalSales + totalServices - totalPurchases - totalExpenses
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
