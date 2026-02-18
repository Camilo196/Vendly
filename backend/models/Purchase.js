const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
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
  productType: {
  type: String,
  enum: ['celular', 'accesorio', 'otro'],
  default: 'otro'
  },
  
  // Detalles de la compra
  quantity: {
    type: Number,
    required: [true, 'La cantidad es obligatoria'],
    min: [1, 'La cantidad debe ser mayor a 0']
  },
  
  unitCost: {
    type: Number,
    required: [true, 'El costo unitario es obligatorio'],
    min: [0, 'El costo debe ser mayor o igual a 0']
  },
  
  totalCost: {
    type: Number,
    default: 0
  },
  
  // Información adicional
  supplier: {
    type: String,
    trim: true
  },
  
  invoice: {
    type: String,
    trim: true
  },
  
  notes: {
    type: String,
    trim: true
  },
  
  // Fecha de la compra
  purchaseDate: {
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
purchaseSchema.index({ userId: 1, purchaseDate: -1 });
purchaseSchema.index({ userId: 1, productId: 1 });

// Calcular total antes de guardar
purchaseSchema.pre('save', function(next) {
  this.totalCost = this.quantity * this.unitCost;
  next();
});

// Método explícito para recalcular (usado en actualizaciones)
purchaseSchema.methods.calculateTotals = function() {
  this.totalCost = this.quantity * this.unitCost;
};

module.exports = mongoose.model('Purchase', purchaseSchema);
