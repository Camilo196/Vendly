const mongoose = require('mongoose');

const technicalServiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Información del cliente
  customer: {
    name: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true
    },
    phone:   { type: String, trim: true },
    email:   { type: String, trim: true },
    address: { type: String, trim: true }
  },

  // Información del equipo
  device: {
    type: {
      type: String,
      required: [true, 'El tipo de equipo es obligatorio'],
      trim: true
    },
    brand:        { type: String, trim: true },
    model:        { type: String, trim: true },
    serialNumber: { type: String, trim: true }
  },

  problemDescription: {
    type: String,
    required: [true, 'La descripción del problema es obligatoria'],
    trim: true
  },

  diagnosis: { type: String, trim: true },
  solution:  { type: String, trim: true },

  status: {
    type: String,
    enum: ['pending', 'in_progress', 'waiting_parts', 'completed', 'delivered', 'cancelled'],
    default: 'pending'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // ── COSTOS ──────────────────────────────────────────────────────────────
  laborCost: {
    type: Number,
    default: 0,
    min: 0
  },

  partsCost: {          // Costo real del repuesto (lo pagó el negocio)
    type: Number,
    default: 0,
    min: 0
  },

  partsPrice: {         // Precio cobrado al cliente por el repuesto
    type: Number,       // Si compraste en $35 y cobras $35 → ganancia $0 en repuesto
    default: 0,
    min: 0
  },

  totalCost: {          // Lo que paga el cliente: laborCost + partsPrice
    type: Number,
    default: 0
  },

  // ── COMISIÓN DEL TÉCNICO ─────────────────────────────────────────────────
  // El % se hereda del perfil del técnico al seleccionarlo,
  // pero se puede editar en este servicio sin afectar el perfil
  technicianCommissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Monto final de comisión = laborCost * technicianCommissionRate / 100
  // También editable manualmente por servicio
  technicianCommission: {
    type: Number,
    default: 0,
    min: 0
  },

  commissionApproved: {
    type: Boolean,
    default: false
  },

  commissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commission',
    default: null
  },

  // ── TÉCNICO ──────────────────────────────────────────────────────────────
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },

  technician: {
    type: String,
    trim: true
  },

  // Repuestos vinculados al inventario (opcional)
  partsUsed: [{
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    quantity:    Number,
    unitCost:    Number
  }],

  // Fechas
  entryDate:               { type: Date, default: Date.now },
  estimatedCompletionDate: { type: Date },
  completionDate:          { type: Date },
  deliveryDate:            { type: Date },

  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'pending', 'other'],
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },

  notes: { type: String, trim: true },

  createdAt: { type: Date, default: Date.now }

}, {
  timestamps: true
});

// Índices
technicalServiceSchema.index({ userId: 1, status: 1 });
technicalServiceSchema.index({ userId: 1, entryDate: -1 });
technicalServiceSchema.index({ 'customer.name': 'text', 'customer.phone': 'text' });

// Calcular totales antes de guardar
technicalServiceSchema.pre('save', function(next) {
  // totalCost = lo que paga el cliente (mano de obra + precio repuesto cobrado)
  this.totalCost = this.laborCost + (this.partsPrice || this.partsCost);
  next();
});

// Método para cambiar estado
technicalServiceSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;

  if (newStatus === 'completed' && !this.completionDate) {
    this.completionDate = new Date();
  }

  if (newStatus === 'delivered' && !this.deliveryDate) {
    this.deliveryDate     = new Date();
    this.commissionApproved = true;
  }
};

module.exports = mongoose.model('TechnicalService', technicalServiceSchema);