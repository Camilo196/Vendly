const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const { protect, authorize } = require('../middleware/auth');

// Todas las rutas requieren autenticación y rol de admin
router.use(protect);
router.use(authorize('admin'));

// @route   POST /api/admin/users
// @desc    Crear nuevo usuario/cliente (solo admin)
// @access  Private/Admin
router.post('/users', async (req, res) => {
  try {
    const { businessName, email, password, phone, address, city, plan } = req.body;

    if (!businessName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre del negocio, email y contraseña son obligatorios'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este email ya está registrado'
      });
    }

    const user = await User.create({
      businessName,
      email,
      password,
      phone,
      address,
      city,
      plan: plan || 'basic',
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: `Cliente "${businessName}" creado exitosamente`,
      user: user.toPublicJSON()
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  }
});

// @route   GET /api/admin/users
// @desc    Obtener todos los usuarios/locales (solo admin)
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const { isActive, plan, search } = req.query;
    
    let query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (plan) {
      query.plan = plan;
    }
    
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: users.length,
      users: users.map(u => u.toPublicJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Obtener detalles de un usuario específico
// @access  Private/Admin
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Obtener estadísticas del usuario
    const products = await Product.countDocuments({ userId: user._id, isActive: true });
    const sales = await Sale.countDocuments({ userId: user._id });
    const purchases = await Purchase.countDocuments({ userId: user._id });
    
    const totalSales = await Sale.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: null, total: { $sum: '$totalSale' } } }
    ]);
    
    const totalProfit = await Sale.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: null, total: { $sum: '$profit' } } }
    ]);
    
    res.json({
      success: true,
      user: user.toPublicJSON(),
      usage: {
        products,
        sales,
        purchases,
        totalRevenue: totalSales.length > 0 ? totalSales[0].total : 0,
        totalProfit: totalProfit.length > 0 ? totalProfit[0].total : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario'
    });
  }
});

// @route   PUT /api/admin/users/:id/password
// @desc    Cambiar contraseña de un usuario (solo admin)
// @access  Private/Admin
router.put('/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    user.password = password;
    await user.save();
    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al cambiar contraseña' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Actualizar usuario (plan, límites, estado)
// @access  Private/Admin
router.put('/users/:id', async (req, res) => {
  try {
    const { plan, isActive, limits } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    if (plan) user.plan = plan;
    if (isActive !== undefined) user.isActive = isActive;
    if (limits) {
      if (limits.maxProducts) user.limits.maxProducts = limits.maxProducts;
      if (limits.maxSalesPerMonth) user.limits.maxSalesPerMonth = limits.maxSalesPerMonth;
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Usuario actualizado',
      user: user.toPublicJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario'
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Eliminar usuario y todos sus datos
// @access  Private/Admin
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Eliminar todos los datos del usuario
    await Promise.all([
      Product.deleteMany({ userId: user._id }),
      Sale.deleteMany({ userId: user._id }),
      Purchase.deleteMany({ userId: user._id }),
      user.deleteOne()
    ]);
    
    res.json({
      success: true,
      message: 'Usuario y todos sus datos eliminados'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
});

// @route   GET /api/admin/stats
// @desc    Estadísticas globales del sistema
// @access  Private/Admin
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    const planDistribution = await User.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);
    
    const totalProducts = await Product.countDocuments({ isActive: true });
    const totalSales = await Sale.countDocuments();
    const totalPurchases = await Purchase.countDocuments();
    
    const revenueData = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: '$totalSale' } } }
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;
    
    // Usuarios más activos
    const activeUsersList = await User.aggregate([
      {
        $lookup: {
          from: 'sales',
          localField: '_id',
          foreignField: 'userId',
          as: 'sales'
        }
      },
      {
        $project: {
          businessName: 1,
          email: 1,
          salesCount: { $size: '$sales' }
        }
      },
      { $sort: { salesCount: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          byPlan: planDistribution
        },
        activity: {
          totalProducts,
          totalSales,
          totalPurchases,
          totalRevenue
        },
        topUsers: activeUsersList
      }
    });
  } catch (error) {
    console.error('Error en stats admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

module.exports = router;