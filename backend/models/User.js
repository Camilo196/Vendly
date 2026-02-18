const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Información del local/negocio
  businessName: {
    type: String,
    required: [true, 'El nombre del negocio es obligatorio'],
    trim: true
  },
  
  // Credenciales
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // No devolver en queries por defecto
  },
  
  // Información de contacto
  phone: {
    type: String,
    trim: true
  },
  
  address: {
    type: String,
    trim: true
  },
  
  city: {
    type: String,
    trim: true
  },
  
  // Rol del usuario
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // Estado de la cuenta
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Plan (para futuras funcionalidades)
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free'
  },
  
  // Límites según el plan
  limits: {
    maxProducts: {
      type: Number,
      default: 100 // Free: 100, Basic: 500, Premium: unlimited
    },
    maxSalesPerMonth: {
      type: Number,
      default: 200
    }
  },
  
  // Estadísticas de uso
  stats: {
    totalProducts: {
      type: Number,
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    },
    totalPurchases: {
      type: Number,
      default: 0
    }
  },
  
  // Metadatos
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Encriptar password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para obtener info pública del usuario
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    businessName: this.businessName,
    email: this.email,
    phone: this.phone,
    address: this.address,
    city: this.city,
    role: this.role,
    plan: this.plan,
    isActive: this.isActive,
    stats: this.stats,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

module.exports = mongoose.model('User', userSchema);
