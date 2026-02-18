const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  type: {
    type: String,
    enum: ['sale', 'technical_service'],
    required: true
  },
  
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  description: {
    type: String,
    required: true
  },
  
  baseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  commissionRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  commissionAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  },
  
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  approvedDate: Date,
  paidDate: Date,
  notes: String
  
}, {
  timestamps: true
});

commissionSchema.index({ userId: 1, employeeId: 1, date: -1 });
commissionSchema.index({ status: 1 });

commissionSchema.methods.calculateCommission = function() {
  this.commissionAmount = (this.baseAmount * this.commissionRate) / 100;
  return this.commissionAmount;
};

commissionSchema.statics.getMonthlyReport = async function(userId, employeeId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
  const commissions = await this.find({
    userId,
    employeeId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });
  
  const salesCommissions = commissions.filter(c => c.type === 'sale');
  const serviceCommissions = commissions.filter(c => c.type === 'technical_service');
  
  const totalSalesCommission = salesCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalServiceCommission = serviceCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  
  const byStatus = {
    pending: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commissionAmount, 0),
    approved: commissions.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.commissionAmount, 0),
    paid: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commissionAmount, 0)
  };
  
  return {
    period: { year, month, startDate, endDate },
    summary: {
      totalCommissions: totalSalesCommission + totalServiceCommission,
      salesCommissions: {
        count: salesCommissions.length,
        total: totalSalesCommission
      },
      serviceCommissions: {
        count: serviceCommissions.length,
        total: totalServiceCommission
      },
      byStatus
    },
    commissions
  };
};

module.exports = mongoose.model('Commission', commissionSchema);