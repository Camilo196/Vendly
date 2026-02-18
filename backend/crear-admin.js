const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');

const ADMIN = {
  businessName: 'Administrador',
  email: 'camiloher1961@gmail.com',       // ← CAMBIA ESTO
  password: 'C@milo2026',   // ← CAMBIA ESTO
  role: 'admin',
  plan: 'premium',
  isActive: true
};

async function crearAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const existe = await User.findOne({ email: ADMIN.email });
    if (existe) {
      console.log('⚠️  Ya existe un usuario con ese email');
      process.exit(0);
    }

    const admin = await User.create(ADMIN);
    console.log('✅ Admin creado exitosamente');
    console.log('   Email:', admin.email);
    console.log('   Rol:', admin.role);
    console.log('\n⚠️  Guarda estas credenciales en un lugar seguro.');
    console.log('   Puedes eliminar este archivo después de ejecutarlo.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

crearAdmin();