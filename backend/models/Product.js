const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Referencia al usuario/local (multi-tenancy)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Información del producto
  name: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true
  },
  
  // ⭐ NUEVO: Tipo de producto para comisiones
  productType: {
    type: String,
    enum: ['celular', 'accesorio', 'otro'],
    default: 'otro',
    required: false
  },
  
  // ⭐ NUEVO: Comisión específica para este producto (en porcentaje)
  // Si es null, usa la comisión por defecto del empleado
  commissionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  
  // Inventario
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'El stock no puede ser negativo']
  },
  
  // Costo promedio (se actualiza con cada compra)
  averageCost: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  // Precio sugerido de venta
  suggestedPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Margen de ganancia deseado (porcentaje)
  profitMargin: {
    type: Number,
    default: 30, // 30% por defecto
    min: 0,
    max: 1000
  },
  
  // Totales acumulados
  totalPurchased: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalSold: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Información adicional opcional
  category: {
    type: String,
    trim: true
  },
  
  brand: {
    type: String,
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  // Metadatos
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas rápidas por usuario
productSchema.index({ userId: 1, name: 1 });

// Método para actualizar el costo promedio
productSchema.methods.updateAverageCost = function(newQuantity, newCost, skipPriceUpdate = false) {
  const currentValue = this.stock * this.averageCost;
  const newValue = newQuantity * newCost;
  const totalQuantity = this.stock + newQuantity;
  
  this.averageCost = (currentValue + newValue) / totalQuantity;
  this.stock = totalQuantity;
  this.totalPurchased += newValue;
  
  // ✅ Solo actualizar precio sugerido si no se va a establecer manualmente
  if (!skipPriceUpdate) {
    this.updateSuggestedPrice();
  }
};

// Método para calcular el precio sugerido basado en el costo y margen
productSchema.methods.updateSuggestedPrice = function() {
  if (this.averageCost > 0) {
    this.suggestedPrice = this.averageCost * (1 + this.profitMargin / 100);
  }
};

// Hook para calcular precio sugerido antes de guardar
productSchema.pre('save', function(next) {
  // Solo recalcular si no se ha establecido manualmente el precio sugerido
  if ((this.isModified('averageCost') || this.isModified('profitMargin')) && !this.isModified('suggestedPrice')) {
    this.updateSuggestedPrice();
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);