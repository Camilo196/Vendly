const mongoose = require('mongoose');

const productUnitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    default: null
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    default: null
  },
  serialNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: ['available', 'sold'],
    default: 'available'
  },
  soldAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

productUnitSchema.index({ userId: 1, serialNumber: 1 }, { unique: true });
productUnitSchema.index({ userId: 1, productId: 1, status: 1 });

module.exports = mongoose.model('ProductUnit', productUnitSchema);
