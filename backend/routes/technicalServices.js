const express = require('express');
const router = express.Router();
const TechnicalService = require('../models/TechnicalService');
const Product = require('../models/Product');
const Commission = require('../models/Commission');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/technical-services
// @desc    Obtener todos los servicios técnicos del usuario
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, startDate, endDate, customer, priority } = req.query;

    let query = { userId: req.user._id };

    if (status)   query.status = status;
    if (priority) query.priority = priority;

    if (startDate || endDate) {
      query.entryDate = {};
      if (startDate) query.entryDate.$gte = new Date(startDate);
      if (endDate)   query.entryDate.$lte = new Date(endDate);
    }

    if (customer) {
      query['customer.name'] = new RegExp(customer, 'i');
    }

    const services = await TechnicalService.find(query)
      .sort({ entryDate: -1 })
      .populate('partsUsed.productId', 'name')
      .populate('technicianId', 'name position commissionConfig');

    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (error) {
    console.error('Error al obtener servicios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicios técnicos'
    });
  }
});

// @route   POST /api/technical-services
// @desc    Crear nuevo servicio técnico
// @access  Private
router.post('/', async (req, res) => {
  try {
    let technicianName           = req.body.technician || '';
    let technicianCommissionRate = req.body.technicianCommissionRate || 0;
    let technicianCommission     = req.body.technicianCommission || 0;

    // Si viene technicianId, buscar datos del técnico
    if (req.body.technicianId) {
      const emp = await Employee.findOne({
        _id:    req.body.technicianId,
        userId: req.user._id,
        isActive: true
      });

      if (emp) {
        technicianName = emp.name;

        // Heredar el % de comisión del perfil del técnico
        // SOLO si el frontend no envió un rate personalizado
        if (!req.body.technicianCommissionRate) {
          technicianCommissionRate = emp.commissionConfig.technicalServices.rate || 0;
        }

        // Calcular el monto de comisión si no viene ya calculado
        if (!req.body.technicianCommission && req.body.laborCost) {
          technicianCommission = parseFloat(
            ((req.body.laborCost * technicianCommissionRate) / 100).toFixed(2)
          );
        }
      }
    }

    const serviceData = {
      ...req.body,
      userId:                  req.user._id,
      technician:              technicianName,
      technicianCommissionRate,
      technicianCommission
    };

    const service = await TechnicalService.create(serviceData);

    // Descontar stock si se usaron repuestos del inventario
    if (service.partsUsed && service.partsUsed.length > 0) {
      for (const part of service.partsUsed) {
        if (part.productId) {
          const product = await Product.findById(part.productId);
          if (product && product.userId.toString() === req.user._id.toString()) {
            product.stock -= part.quantity;
            await product.save();
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Servicio técnico registrado exitosamente',
      service
    });
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar servicio técnico',
      error: error.message
    });
  }
});

// @route   GET /api/technical-services/stats/summary
// @desc    Obtener estadísticas de servicios técnicos
// IMPORTANTE: Esta ruta debe ir ANTES de /:id para evitar conflictos
// @access  Private
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user._id;
    const mongoose = require('mongoose');

    const stats = await TechnicalService.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id:             '$status',
          count:           { $sum: 1 },
          totalRevenue:    { $sum: '$totalCost' },
          totalLabor:      { $sum: '$laborCost' },
          totalParts:      { $sum: '$partsCost' },
          totalCommission: { $sum: '$technicianCommission' }
        }
      }
    ]);

    const summary = {
      total:                      0,
      pending:                    0,
      in_progress:                0,
      waiting_parts:              0,
      completed:                  0,
      delivered:                  0,
      cancelled:                  0,
      totalRevenue:               0,
      totalLaborCost:             0,
      totalPartsCost:             0,
      totalTechnicianCommissions: 0
    };

    stats.forEach(stat => {
      if (summary.hasOwnProperty(stat._id)) {
        summary[stat._id] = stat.count;
      }
      summary.total                      += stat.count;
      summary.totalRevenue               += stat.totalRevenue;
      summary.totalLaborCost             += stat.totalLabor;
      summary.totalPartsCost             += stat.totalParts;
      summary.totalTechnicianCommissions += stat.totalCommission;
    });

    res.json({ success: true, stats: summary });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

// @route   GET /api/technical-services/:id
// @desc    Obtener un servicio específico
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const service = await TechnicalService.findOne({
      _id:    req.params.id,
      userId: req.user._id
    })
      .populate('partsUsed.productId')
      .populate('technicianId', 'name position phone commissionConfig');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado'
      });
    }

    res.json({ success: true, service });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicio'
    });
  }
});

// @route   PUT /api/technical-services/:id
// @desc    Actualizar servicio técnico
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const service = await TechnicalService.findOne({
      _id:    req.params.id,
      userId: req.user._id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado'
      });
    }

    // Si cambió el técnico, actualizar nombre y heredar % de comisión
    if (req.body.technicianId && String(req.body.technicianId) !== String(service.technicianId)) {
      const emp = await Employee.findOne({
        _id:    req.body.technicianId,
        userId: req.user._id
      });
      if (emp) {
        req.body.technician = emp.name;
        // Solo heredar rate si no viene uno personalizado en el body
        if (req.body.technicianCommissionRate === undefined) {
          req.body.technicianCommissionRate = emp.commissionConfig.technicalServices.rate || 0;
        }
      }
    }

    // Recalcular monto de comisión si cambió la mano de obra o el rate
    // pero NO si el usuario ya mandó technicianCommission manualmente
    const laborChanged = req.body.laborCost !== undefined;
    const rateChanged  = req.body.technicianCommissionRate !== undefined;
    if ((laborChanged || rateChanged) && req.body.technicianCommission === undefined) {
      const labor = req.body.laborCost                  ?? service.laborCost;
      const rate  = req.body.technicianCommissionRate   ?? service.technicianCommissionRate;
      req.body.technicianCommission = parseFloat(((labor * rate) / 100).toFixed(2));
    }

    // Actualizar campos (proteger _id y userId)
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'userId') {
        service[key] = req.body[key];
      }
    });

    await service.save();

    res.json({
      success: true,
      message: 'Servicio actualizado exitosamente',
      service
    });
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar servicio'
    });
  }
});

// @route   PUT /api/technical-services/:id/status
// @desc    Cambiar estado del servicio
// @access  Private
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    const service = await TechnicalService.findOne({
      _id:    req.params.id,
      userId: req.user._id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado'
      });
    }

    service.updateStatus(status);
    await service.save();

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      service
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado'
    });
  }
});

// @route   PUT /api/technical-services/:id/deliver
// @desc    Marcar equipo como entregado y aprobar comisión del técnico
// @access  Private
router.put('/:id/deliver', async (req, res) => {
  try {
    const service = await TechnicalService.findOne({
      _id:    req.params.id,
      userId: req.user._id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado'
      });
    }

    if (service.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Este equipo ya fue entregado al cliente'
      });
    }

    // Marcar como entregado
    service.status             = 'delivered';
    service.deliveryDate       = new Date();
    service.commissionApproved = true;

    if (!service.completionDate) {
      service.completionDate = new Date();
    }

    // ── Crear o aprobar la comisión del técnico ──────────────────────────
    if (service.technicianId && service.technicianCommission > 0) {

      if (!service.commissionId) {
        // No existía → crear directamente en "approved"
        const commission = await Commission.create({
          userId:           req.user._id,
          employeeId:       service.technicianId,
          type:             'technical_service',
          referenceId:      service._id,
          description:      `Servicio técnico | Cliente: ${service.customer.name}${service.customer.phone ? ' (' + service.customer.phone + ')' : ''} | ${service.device.brand || ''} ${service.device.model || ''} | Mano de obra: $${service.laborCost}`,
          baseAmount:       service.laborCost,
          commissionRate:   service.technicianCommissionRate,
          commissionAmount: service.technicianCommission,
          status:           'approved',
          approvedDate:     new Date(),
          date:             new Date()
        });

        service.commissionId = commission._id;

      } else {
        // Ya existía pendiente → aprobarla y actualizar monto
        await Commission.findByIdAndUpdate(service.commissionId, {
          status:           'approved',
          approvedDate:     new Date(),
          commissionRate:   service.technicianCommissionRate,
          commissionAmount: service.technicianCommission
        });
      }
    }

    await service.save();

    res.json({
      success: true,
      message: `Equipo entregado a ${service.customer.name}. Comisión de $${service.technicianCommission} aprobada al técnico.`,
      service
    });

  } catch (error) {
    console.error('Error al procesar entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la entrega del equipo'
    });
  }
});

// @route   DELETE /api/technical-services/:id
// @desc    Eliminar servicio técnico
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const service = await TechnicalService.findOne({
      _id:    req.params.id,
      userId: req.user._id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado'
      });
    }

    // Devolver repuestos al inventario si los había
    if (service.partsUsed && service.partsUsed.length > 0) {
      for (const part of service.partsUsed) {
        if (part.productId) {
          const product = await Product.findById(part.productId);
          if (product) {
            product.stock += part.quantity;
            await product.save();
          }
        }
      }
    }

    // Cancelar comisión asociada si existe
    try {
      await Commission.updateMany(
        { referenceId: service._id, type: 'technical_service' },
        { status: 'cancelled' }
      );
    } catch (commError) {
      console.error('Error al cancelar comisión:', commError);
    }

    await service.deleteOne();

    res.json({
      success: true,
      message: 'Servicio eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar servicio'
    });
  }
});

module.exports = router;