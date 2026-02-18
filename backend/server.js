const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Verificar variables de entorno críticas
if (!process.env.MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI no está definida en el archivo .env');
  console.error('');
  console.error('Por favor:');
  console.error('1. Crea un archivo llamado .env en la carpeta backend');
  console.error('2. Copia el contenido de .env.example');
  console.error('3. Reemplaza MONGODB_URI con tu connection string de MongoDB Atlas');
  console.error('');
  console.error('Ejemplo:');
  console.error('MONGODB_URI=mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/inventario-saas');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET no está definida en el archivo .env');
  process.exit(1);
}

// Importar rutas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const purchaseRoutes = require('./routes/purchases');
const saleRoutes = require('./routes/sales');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const technicalServiceRoutes = require('./routes/technicalServices');
const reportsRoutes = require('./routes/reports');
const employeeRoutes = require('./routes/employees');
const commissionRoutes = require('./routes/commissions');

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:5000',
      process.env.FRONTEND_URL
    ].filter(Boolean).map(u => u.replace(/\/$/, ''));
    const clean = origin ? origin.replace(/\/$/, '') : '';
    if (!origin || allowed.includes(clean)) {
      callback(null, true);
    } else {
      callback(new Error('CORS no permitido: ' + origin));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/technical-services', technicalServiceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/commissions', commissionRoutes);
// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sistema de Inventario SaaS API',
    version: '1.0.0',
    status: 'running'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Conectar a MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

// Iniciar servidor
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Ambiente: ${process.env.NODE_ENV}`);
  });
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
  process.exit(1);
});
