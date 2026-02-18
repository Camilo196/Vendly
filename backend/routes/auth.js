const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { getSignedJwtToken, protect } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Registro deshabilitado - solo el admin puede crear cuentas
// @access  Disabled
router.post('/register', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'El registro público está deshabilitado. Contacta al administrador para obtener acceso.'
  });
});

// @route   POST /api/auth/login
// @desc    Login de usuario
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('La contraseña es obligatoria')
], async (req, res) => {
  console.log('\n🔐 ========================================');
  console.log('🔐 INICIANDO PROCESO DE LOGIN');
  console.log('========================================');
  console.log('📅 Fecha:', new Date().toISOString());
  console.log('📦 Body recibido:', { email: req.body.email, password: '***' });
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Errores de validación:', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { email, password } = req.body;
    console.log('✅ Validaciones pasadas');
    console.log('🔍 Buscando usuario con email:', email);
    
    // Buscar usuario (incluir password)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ Usuario NO encontrado con ese email');
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
    
    console.log('✅ Usuario encontrado:', user.businessName);
    console.log('👤 ID:', user._id);
    console.log('🏢 Negocio:', user.businessName);
    console.log('📧 Email:', user.email);
    console.log('🔓 isActive:', user.isActive);
    
    // Verificar contraseña
    console.log('🔑 Verificando contraseña...');
    const isPasswordValid = await user.comparePassword(password);
    console.log('🔑 Contraseña válida:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
    
    // Verificar si está activo
    if (!user.isActive) {
      console.log('❌ Usuario inactivo');
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
      });
    }
    
    // Actualizar último login
    console.log('📊 Actualizando último login...');
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    console.log('✅ Último login actualizado');
    
    // Generar token
    console.log('🎟️ Generando token JWT...');
    const token = getSignedJwtToken(user._id);
    console.log('✅ Token generado:', token.substring(0, 20) + '...');
    
    console.log('\n🎉 ========================================');
    console.log('✅ LOGIN EXITOSO');
    console.log('========================================\n');
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: user.toPublicJSON()
    });
    
  } catch (error) {
    console.error('\n💥 ========================================');
    console.error('❌ ERROR EN LOGIN');
    console.error('========================================');
    console.error('❌ Error:', error);
    console.error('❌ Message:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('========================================\n');
    
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Obtener usuario actual
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.toPublicJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del usuario'
    });
  }
});

// @route   PUT /api/auth/update
// @desc    Actualizar perfil del usuario
// @access  Private
router.put('/update', protect, async (req, res) => {
  try {
    const { businessName, phone, address, city } = req.body;
    
    const fieldsToUpdate = {};
    if (businessName) fieldsToUpdate.businessName = businessName;
    if (phone !== undefined) fieldsToUpdate.phone = phone;
    if (address !== undefined) fieldsToUpdate.address = address;
    if (city !== undefined) fieldsToUpdate.city = city;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Perfil actualizado',
      user: user.toPublicJSON()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Cambiar contraseña
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('La contraseña actual es obligatoria'),
  body('newPassword').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña'
    });
  }
});

module.exports = router;