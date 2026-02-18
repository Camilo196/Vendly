const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  // Referencia al usuario/local
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Referencia al producto
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  productName: {
    type: String,
    required: true
  },
  
  // Detalles de la venta
  quantity: {
    type: Number,
    required: [true, 'La cantidad es obligatoria'],
    min: [1, 'La cantidad debe ser mayor a 0']
  },
  
  unitPrice: {
    type: Number,
    required: [true, 'El precio unitario es obligatorio'],
    min: [0, 'El precio debe ser mayor o igual a 0']
  },
  
  totalSale: {
    type: Number,
    default: 0
  },
  
  // Costo del producto al momento de la venta (para calcular ganancia)
  unitCost: {
    type: Number,
    required: true
  },
  
  totalCost: {
    type: Number,
    default: 0
  },
  
  profit: {
    type: Number,
    default: 0
  },
  
  // Información adicional
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },

  customer: {
    type: String,
    trim: true
  },
  
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'other'],
    default: 'cash'
  },
  
  notes: {
    type: String,
    trim: true
  },
  
  // Fecha de la venta
  saleDate: {
    type: Date,
    default: Date.now
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para reportes y búsquedas
saleSchema.index({ userId: 1, saleDate: -1 });
saleSchema.index({ userId: 1, productId: 1 });

// Calcular totales y ganancia antes de guardar
saleSchema.pre('save', function(next) {
  this.totalSale = this.quantity * this.unitPrice;
  this.totalCost = this.quantity * this.unitCost;
  this.profit = this.totalSale - this.totalCost;
  next();
});

// Método explícito para recalcular (usado en actualizaciones)
saleSchema.methods.calculateTotals = function() {
  this.totalSale = this.quantity * this.unitPrice;
  this.totalCost = this.quantity * this.unitCost;
  this.profit = this.totalSale - this.totalCost;
};

module.exports = mongoose.model('Sale', saleSchema);