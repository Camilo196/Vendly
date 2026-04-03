const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'La descripcion es obligatoria'],
    trim: true
  },
  category: {
    type: String,
    enum: ['arriendo', 'servicios', 'nomina', 'transporte', 'mercadeo', 'papeleria', 'mantenimiento', 'impuestos', 'otros'],
    default: 'otros'
  },
  amount: {
    type: Number,
    required: [true, 'El monto es obligatorio'],
    min: [0, 'El monto debe ser mayor o igual a 0']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'transfer', 'card', 'other'],
    default: 'cash'
  },
  notes: {
    type: String,
    trim: true
  },
  expenseDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

expenseSchema.index({ userId: 1, expenseDate: -1 });
expenseSchema.index({ userId: 1, category: 1, expenseDate: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
