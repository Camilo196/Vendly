const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: [true, 'El nombre del negocio es obligatorio'],
    trim: true
  },

  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalido']
  },

  password: {
    type: String,
    required: [true, 'La contrasena es obligatoria'],
    minlength: [6, 'La contrasena debe tener al menos 6 caracteres'],
    select: false
  },

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

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  isActive: {
    type: Boolean,
    default: true
  },

  plan: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free'
  },

  limits: {
    maxProducts: {
      type: Number,
      default: 100
    },
    maxSalesPerMonth: {
      type: Number,
      default: 200
    }
  },

  permissions: {
    compatibility: {
      canWrite: {
        type: Boolean,
        default: true
      },
      canImport: {
        type: Boolean,
        default: true
      },
      canDelete: {
        type: Boolean,
        default: true
      },
      publicApiEnabled: {
        type: Boolean,
        default: true
      }
    }
  },

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

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

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
    permissions: this.permissions,
    stats: this.stats,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

module.exports = mongoose.model('User', userSchema);
