const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  position: {
    type: String,
    enum: ['vendedor', 'tecnico', 'vendedor_tecnico'],
    required: true
  },
  
  // Configuración de comisiones
  commissionConfig: {
    sales: {
      enabled: {
        type: Boolean,
        default: true
      },
      rate: {
        type: Number,
        default: 5,
        min: 0,
        max: 100
      }
    },
    technicalServices: {
      enabled: {
        type: Boolean,
        default: true
      },
      rate: {
        type: Number,
        default: 10,
        min: 0,
        max: 100
      }
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  hireDate: {
    type: Date,
    default: Date.now
  },
  
  notes: {
    type: String,
    trim: true
  }
  
}, {
  timestamps: true
});

employeeSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('Employee', employeeSchema);