# 📱 Sistema de Inventario SaaS - Multi-Tenant

Sistema completo de gestión de inventario y ventas diseñado para vender a múltiples locales comerciales. Cada cliente tiene su propia cuenta y datos completamente separados.

## 🚀 Características Principales

### Para los Clientes (Locales)
- ✅ **Registro e inicio de sesión** con email y contraseña
- 📦 **Gestión de inventario** completa
- 💰 **Registro de compras** con cálculo automático de costos
- 🛒 **Registro de ventas** con control de stock
- 📊 **Reportes y estadísticas** en tiempo real
- 📈 **Dashboard** con métricas clave

### Para Ti (Administrador)
- 👥 **Panel de administración** para ver todos los clientes
- 📊 **Estadísticas globales** del sistema
- 🔧 **Gestión de usuarios** (activar/desactivar cuentas)
- 💎 **Planes** (Free/Basic/Premium) configurables
- 📈 **Monitoreo de uso** por cliente

## 📋 Requisitos

- **Node.js** v14 o superior
- **MongoDB** (Cuenta gratuita en MongoDB Atlas)
- **npm** o **yarn**

## 🛠️ Instalación

### 1. Configurar MongoDB Atlas (GRATIS)

1. Ve a [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Crea una cuenta gratuita
3. Crea un cluster (selecciona el plan FREE - M0)
4. En "Security":
   - Database Access: Crea un usuario (guarda user y password)
   - Network Access: Añade `0.0.0.0/0` (permitir todas las IPs)
5. Click en "Connect" → "Connect your application"
6. Copia el connection string (algo como: `mongodb+srv://usuario:password@cluster.mongodb.net/`)

### 2. Instalar el Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo de configuración
cp .env.example .env

# Editar .env con tu connection string de MongoDB
nano .env  # o usa tu editor favorito
```

En el archivo `.env`, cambia:
```
MONGODB_URI=mongodb+srv://TU_USUARIO:TU_PASSWORD@cluster.mongodb.net/inventario-saas?retryWrites=true&w=majority
JWT_SECRET=cambia_esto_por_algo_super_secreto_y_unico_123456789
```

### 3. Iniciar el Backend

```bash
npm start
```

Deberías ver:
```
✅ MongoDB conectado: cluster...mongodb.net
🚀 Servidor corriendo en puerto 5000
```

### 4. Frontend

El frontend está incluido en `frontend/index.html`. Simplemente ábrelo en un navegador o usa un servidor local:

```bash
# Opción 1: Abrir directamente
# Haz doble click en frontend/index.html

# Opción 2: Servidor local con Python
cd frontend
python3 -m http.server 3000

# Opción 3: Servidor local con Node.js
npx serve frontend -p 3000
```

## 📱 Uso

### Crear tu Primera Cuenta Admin

1. Abre el backend en Postman o usa curl:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Admin Principal",
    "email": "admin@tuempresa.com",
    "password": "admin123"
  }'
```

2. Actualiza manualmente el rol a admin en MongoDB:
   - Ve a MongoDB Atlas → Browse Collections
   - Encuentra tu usuario
   - Cambia `role: "user"` a `role: "admin"`

### Para Clientes

1. Ir a la página de registro
2. Crear cuenta con:
   - Nombre del negocio
   - Email
   - Contraseña
3. Login automático después del registro
4. Empezar a registrar compras y ventas

## 🔧 Endpoints de la API

### Autenticación
- `POST /api/auth/register` - Registrar nuevo local
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual
- `PUT /api/auth/update` - Actualizar perfil

### Productos
- `GET /api/products` - Listar productos del usuario
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto

### Compras
- `GET /api/purchases` - Listar compras
- `POST /api/purchases` - Registrar compra
- `DELETE /api/purchases/:id` - Eliminar compra

### Ventas
- `GET /api/sales` - Listar ventas
- `POST /api/sales` - Registrar venta
- `DELETE /api/sales/:id` - Cancelar venta

### Estadísticas
- `GET /api/stats/dashboard` - Dashboard principal
- `GET /api/stats/products` - Reporte por producto
- `GET /api/stats/period` - Estadísticas por período

### Admin (Solo Administradores)
- `GET /api/admin/users` - Listar todos los usuarios
- `GET /api/admin/users/:id` - Detalles de usuario
- `PUT /api/admin/users/:id` - Actualizar usuario
- `DELETE /api/admin/users/:id` - Eliminar usuario
- `GET /api/admin/stats` - Estadísticas globales

## 🔐 Autenticación

Todas las peticiones (excepto login/register) requieren un token JWT en el header:

```
Authorization: Bearer TU_TOKEN_JWT
```

El token se obtiene al hacer login o registro.

## 📊 Estructura de Datos

### Usuario (Local)
```json
{
  "businessName": "Mi Tienda de Celulares",
  "email": "mitienda@email.com",
  "phone": "3001234567",
  "address": "Calle 123",
  "city": "Pasto",
  "role": "user",
  "plan": "free",
  "isActive": true
}
```

### Producto
```json
{
  "name": "iPhone 14 Pro",
  "stock": 5,
  "averageCost": 3500000,
  "category": "Smartphones",
  "brand": "Apple"
}
```

### Compra
```json
{
  "productName": "iPhone 14 Pro",
  "quantity": 3,
  "unitCost": 3500000,
  "totalCost": 10500000,
  "supplier": "Proveedor XYZ",
  "purchaseDate": "2024-02-13"
}
```

### Venta
```json
{
  "productId": "...",
  "quantity": 1,
  "unitPrice": 4200000,
  "totalSale": 4200000,
  "profit": 700000,
  "customer": "Juan Pérez",
  "paymentMethod": "cash"
}
```

## 🚀 Despliegue en Producción

### Backend (Railway / Render)

1. **Railway** (Recomendado - $5/mes):
   - Conecta tu repositorio Git
   - Railway detecta Node.js automáticamente
   - Añade las variables de entorno en el dashboard

2. **Render** (Opción gratuita):
   - Crea Web Service
   - Conecta repositorio
   - Build: `npm install`
   - Start: `npm start`

### Frontend (Vercel / Netlify)

1. Sube la carpeta `frontend` a tu repo
2. Conecta con Vercel o Netlify
3. Deploy automático

### Base de Datos

MongoDB Atlas (plan gratis hasta 512MB):
- Ya configurado si seguiste las instrucciones
- Backups automáticos
- Escalable según necesites

## 💡 Próximos Pasos para Mejorar

1. ✅ Agregar recuperación de contraseña por email
2. ✅ Implementar sistema de planes de pago (Stripe)
3. ✅ Versión móvil nativa (React Native / Flutter)
4. ✅ Exportar reportes a Excel/PDF
5. ✅ Notificaciones por email
6. ✅ Multi-idioma
7. ✅ Modo offline
8. ✅ Códigos de barras / QR

## 🐛 Solución de Problemas

### "Error conectando a MongoDB"
- Verifica tu connection string en `.env`
- Asegúrate de permitir todas las IPs en MongoDB Atlas
- Verifica usuario y password

### "Token inválido"
- El token expira después de 30 días
- Haz login nuevamente

### "Stock insuficiente"
- Verifica que tienes suficiente stock del producto
- Registra una compra primero

## 📞 Soporte

Para cualquier duda o problema:
- Email: soporte@tusistema.com
- Documentación: [Link a docs]

## 📄 Licencia

Propietaria - Todos los derechos reservados

---

**Desarrollado con ❤️ para facilitar la gestión de inventarios**
