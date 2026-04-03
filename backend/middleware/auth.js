const jwt = require('jsonwebtoken');
const User = require('../models/User');

const DEFAULT_JWT_EXPIRE = '30d';

function resolveJwtExpire() {
  const rawValue = String(process.env.JWT_EXPIRE || '').trim();

  if (!rawValue) {
    return DEFAULT_JWT_EXPIRE;
  }

  let normalized = rawValue.replace(/^JWT_EXPIRE\s*=\s*/i, '').trim();

  // Render y otros paneles a veces guardan la variable con comillas.
  normalized = normalized.replace(/^['"]+|['"]+$/g, '').trim();

  if (!normalized) {
    return DEFAULT_JWT_EXPIRE;
  }

  const expiresIn = /^\d+$/.test(normalized) ? Number(normalized) : normalized;

  try {
    jwt.sign({ probe: true }, process.env.JWT_SECRET || 'validation-secret', {
      expiresIn
    });
    return expiresIn;
  } catch (error) {
    console.warn(
      `JWT_EXPIRE invalido (${rawValue}). Se usara el valor por defecto ${DEFAULT_JWT_EXPIRE}.`
    );
    return DEFAULT_JWT_EXPIRE;
  }
}

// Proteger rutas - verificar token JWT
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Obtener token del header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token no proporcionado'
      });
    }
    
    try {
      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario
      req.user = await User.findById(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'No autorizado - Usuario no encontrado'
        });
      }
      
      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Cuenta desactivada - Contacta al administrador'
        });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token inválido'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
};

// Verificar que el usuario sea admin
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
    }
    next();
  };
};

// Generar JWT token
exports.getSignedJwtToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: resolveJwtExpire()
  });
};
