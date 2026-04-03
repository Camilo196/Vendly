const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect } = require('../middleware/auth');

router.use(protect);

function getDateRange(period) {
  const now = new Date();

  if (period === 'monthly') {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth(), 1),
      $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    };
  }

  if (period === 'previous_month') {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      $lt: new Date(now.getFullYear(), now.getMonth(), 1)
    };
  }

  if (period === 'daily') {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    };
  }

  return null;
}

// @route   GET /api/expenses
// @desc    Listar gastos
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { period = 'monthly', category = '', startDate, endDate } = req.query;
    const query = { userId: req.user._id };

    if (category) {
      query.category = category;
    }

    if (startDate && endDate) {
      query.expenseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const range = getDateRange(period);
      if (range) query.expenseDate = range;
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 });
    const total = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const byCategory = expenses.reduce((acc, item) => {
      const key = item.category || 'otros';
      acc[key] = (acc[key] || 0) + (item.amount || 0);
      return acc;
    }, {});

    res.json({
      success: true,
      expenses,
      summary: {
        total,
        count: expenses.length,
        byCategory
      }
    });
  } catch (error) {
    console.error('Error loading expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar gastos'
    });
  }
});

// @route   POST /api/expenses
// @desc    Crear gasto
// @access  Private
router.post('/', async (req, res) => {
  try {
    const expense = await Expense.create({
      userId: req.user._id,
      description: req.body.description,
      category: req.body.category || 'otros',
      amount: Number(req.body.amount || 0),
      paymentMethod: req.body.paymentMethod || 'cash',
      notes: req.body.notes || '',
      expenseDate: req.body.expenseDate || new Date()
    });

    res.status(201).json({
      success: true,
      expense
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al registrar gasto'
    });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Actualizar gasto
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    expense.description = req.body.description ?? expense.description;
    expense.category = req.body.category ?? expense.category;
    expense.amount = req.body.amount !== undefined ? Number(req.body.amount) : expense.amount;
    expense.paymentMethod = req.body.paymentMethod ?? expense.paymentMethod;
    expense.notes = req.body.notes ?? expense.notes;
    expense.expenseDate = req.body.expenseDate ?? expense.expenseDate;

    await expense.save();

    res.json({
      success: true,
      expense
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar gasto'
    });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Eliminar gasto
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Gasto eliminado'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar gasto'
    });
  }
});

module.exports = router;
