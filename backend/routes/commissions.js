const express = require('express');
const router = express.Router();
const Commission = require('../models/Commission');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET todas las comisiones
router.get('/', async (req, res) => {
  try {
    const { employeeId, status, type, startDate, endDate } = req.query;
    
    let query = { userId: req.user._id };
    
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (type) query.type = type;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const commissions = await Commission.find(query)
      .populate('employeeId', 'name position')
      .sort({ date: -1 });
    
    const total = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    
    res.json({
      success: true,
      count: commissions.length,
      total,
      commissions
    });
  } catch (error) {
    console.error('Error al obtener comisiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener comisiones'
    });
  }
});

// GET reporte mensual de un empleado
router.get('/employee/:employeeId/monthly', async (req, res) => {
  try {
    const now = new Date();
    const { year, month } = req.query;
    const currentYear = parseInt(year) || now.getFullYear();
    const currentMonth = parseInt(month) || (now.getMonth() + 1);
    
    const report = await Commission.getMonthlyReport(
      req.user._id,
      req.params.employeeId,
      currentYear,
      currentMonth
    );
    
    const employee = await Employee.findById(req.params.employeeId);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    res.json({
      success: true,
      employee: {
        id: employee._id,
        name: employee.name,
        position: employee.position
      },
      report
    });
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte mensual'
    });
  }
});

// PUT aprobar comisión
router.put('/:id/approve', async (req, res) => {
  try {
    const commission = await Commission.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Comisión no encontrada'
      });
    }
    
    commission.status = 'approved';
    commission.approvedDate = new Date();
    await commission.save();
    
    res.json({
      success: true,
      message: 'Comisión aprobada exitosamente',
      commission
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al aprobar comisión'
    });
  }
});

// PUT pagar múltiples comisiones
router.put('/batch/pay', async (req, res) => {
  try {
    const { commissionIds, notes } = req.body;
    
    const result = await Commission.updateMany(
      {
        _id: { $in: commissionIds },
        userId: req.user._id,
        status: { $in: ['pending', 'approved'] }
      },
      {
        $set: {
          status: 'paid',
          paidDate: new Date(),
          notes: notes || 'Pago en lote'
        }
      }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} comisiones pagadas`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al procesar pagos'
    });
  }
});

// PUT marcar como pagada
router.put('/:id/pay', async (req, res) => {
  try {
    const commission = await Commission.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Comisión no encontrada'
      });
    }
    
    commission.status = 'paid';
    commission.paidDate = new Date();
    if (req.body.notes) commission.notes = req.body.notes;
    
    await commission.save();
    
    res.json({
      success: true,
      message: 'Comisión marcada como pagada',
      commission
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al procesar pago'
    });
  }
});

module.exports = router;