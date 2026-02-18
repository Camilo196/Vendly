# 📐 ARQUITECTURA TÉCNICA DEL SISTEMA

## 🏗️ Stack Tecnológico

### Backend
- **Runtime:** Node.js v14+
- **Framework:** Express.js 4.18
- **Base de datos:** MongoDB (con Mongoose ODM)
- **Autenticación:** JWT (JSON Web Tokens)
- **Encriptación:** bcryptjs
- **Validación:** express-validator
- **CORS:** Habilitado para frontend

### Frontend (Opción 1 - Actual)
- **HTML5 + CSS3 + JavaScript Vanilla**
- **Sin frameworks** (fácil de entender y modificar)
- **LocalStorage** para token
- **Fetch API** para peticiones HTTP

### Frontend (Opción 2 - Recomendada para Producción)
- **React.js** con Hooks
- **React Router** para navegación
- **Axios** para HTTP
- **Material-UI** o **TailwindCSS**
- **React Query** para cache

## 🔒 Seguridad

### Multi-Tenancy
Cada usuario solo puede acceder a SUS propios datos mediante:
```javascript
// Todas las queries incluyen userId
const products = await Product.find({ userId: req.user._id });
```

### Autenticación JWT
```
1. Usuario hace login → Recibe token
2. Cada petición incluye: Authorization: Bearer <token>
3. Middleware verifica token → Extrae userId
4. Request solo puede acceder a datos de ese userId
```

### Passwords
- Hasheados con bcryptjs (salt rounds: 10)
- Nunca se devuelven en responses (select: false)
- Mínimo 6 caracteres

### Roles
- **user:** Acceso a sus propios datos
- **admin:** Acceso a panel de administración

## 📊 Modelo de Datos

### Colecciones MongoDB

#### 1. Users (usuarios/locales)
```javascript
{
  _id: ObjectId,
  businessName: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  address: String,
  city: String,
  role: 'user' | 'admin',
  plan: 'free' | 'basic' | 'premium',
  isActive: Boolean,
  limits: {
    maxProducts: Number,
    maxSalesPerMonth: Number
  },
  stats: {
    totalProducts: Number,
    totalSales: Number,
    totalPurchases: Number
  },
  createdAt: Date,
  lastLogin: Date
}
```

#### 2. Products
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  name: String,
  stock: Number,
  averageCost: Number,
  totalPurchased: Number,
  totalSold: Number,
  category: String,
  brand: String,
  description: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

Índices:
- `{ userId: 1, name: 1 }` - Búsquedas rápidas

#### 3. Purchases
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  productId: ObjectId (ref: Product),
  productName: String,
  quantity: Number,
  unitCost: Number,
  totalCost: Number,
  supplier: String,
  invoice: String,
  notes: String,
  purchaseDate: Date,
  createdAt: Date
}
```

Índices:
- `{ userId: 1, purchaseDate: -1 }` - Reportes por fecha
- `{ userId: 1, productId: 1 }` - Historial por producto

#### 4. Sales
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  productId: ObjectId (ref: Product),
  productName: String,
  quantity: Number,
  unitPrice: Number,
  totalSale: Number,
  unitCost: Number,
  totalCost: Number,
  profit: Number,
  customer: String,
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other',
  notes: String,
  saleDate: Date,
  createdAt: Date
}
```

Índices:
- `{ userId: 1, saleDate: -1 }` - Reportes por fecha
- `{ userId: 1, productId: 1 }` - Historial por producto

## 🔄 Flujo de Datos

### Registro de Compra
```
1. Usuario envía: POST /api/purchases
   {
     productName: "iPhone 14",
     quantity: 5,
     unitCost: 3500000
   }

2. Backend:
   a. Verifica autenticación (JWT)
   b. Busca/crea producto
   c. Calcula costo promedio:
      nuevoCosto = (stockActual * costoActual + cantidad * costoNuevo) / (stockActual + cantidad)
   d. Actualiza stock: stock += cantidad
   e. Crea registro de compra
   f. Actualiza stats del usuario

3. Response:
   {
     success: true,
     purchase: {...},
     product: {...}
   }
```

### Registro de Venta
```
1. Usuario envía: POST /api/sales
   {
     productId: "...",
     quantity: 1,
     unitPrice: 4200000
   }

2. Backend:
   a. Verifica autenticación
   b. Busca producto
   c. Verifica stock >= cantidad
   d. Calcula ganancia: (precioVenta - costoPromedio) * cantidad
   e. Crea registro de venta
   f. Actualiza stock: stock -= cantidad
   g. Actualiza stats del usuario

3. Response:
   {
     success: true,
     sale: {
       profit: 700000,
       ...
     }
   }
```

## 🌐 Arquitectura de Despliegue

### Desarrollo Local
```
[Frontend:3000] ←→ [Backend:5000] ←→ [MongoDB Atlas]
```

### Producción Recomendada
```
[Vercel/Netlify]     [Railway/Render]     [MongoDB Atlas]
   (Frontend)    ←→     (Backend)      ←→   (Database)
    HTTPS               HTTPS                Cloud
```

## 📈 Escalabilidad

### Para 10-50 clientes
- MongoDB Atlas Free (M0): 512MB
- Railway/Render: $5-10/mes
- **Total:** $5-10/mes

### Para 50-500 clientes
- MongoDB Atlas M10: $0.08/hr (~$57/mes)
- Railway/Render: $10-20/mes
- CDN para frontend: Gratis (Vercel/Netlify)
- **Total:** $67-77/mes

### Para 500+ clientes
- MongoDB Atlas M30+: Escalable
- Backend en múltiples instancias
- Load balancer
- Redis para cache
- **Total:** $200+/mes

## 🔧 Mejoras Futuras

### Fase 1 (Esencial)
- [ ] Recuperación de contraseña por email
- [ ] Verificación de email
- [ ] Exportar reportes a PDF/Excel
- [ ] Imágenes de productos

### Fase 2 (Mejoras)
- [ ] Notificaciones push/email
- [ ] Múltiples usuarios por local (empleados)
- [ ] Roles y permisos granulares
- [ ] Historial de cambios (audit log)
- [ ] Códigos de barras/QR

### Fase 3 (Avanzado)
- [ ] App móvil nativa
- [ ] Integración con punto de venta
- [ ] Facturación electrónica
- [ ] Integración con proveedores
- [ ] Machine learning para predicciones

## 🧪 Testing

### Unit Tests (Recomendado: Jest)
```javascript
describe('Purchase', () => {
  it('should update product average cost', async () => {
    const product = await Product.create({...});
    product.updateAverageCost(5, 100);
    expect(product.averageCost).toBe(100);
  });
});
```

### Integration Tests (Recomendado: Supertest)
```javascript
describe('POST /api/purchases', () => {
  it('should create purchase and update stock', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({...});
    expect(res.status).toBe(201);
  });
});
```

## 📊 Monitoreo

### Logs
```javascript
// Winston para logs
const logger = winston.createLogger({
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Métricas
- Usuarios activos por día
- Ventas totales por período
- Errores de API
- Tiempo de respuesta promedio

### Alertas
- Stock bajo (< 5 unidades)
- Errores críticos
- Uso excesivo de API

## 🔐 Backup

### MongoDB Atlas
- Backups automáticos cada 24h
- Retención: 7 días (plan free)
- Restauración con un click

### Recomendación Adicional
```bash
# Script de backup manual
mongodump --uri="mongodb+srv://..." --out=./backup-$(date +%Y%m%d)
```

## 📱 API Rate Limiting

### Implementación con express-rate-limit
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de requests
});

app.use('/api', limiter);
```

---

**Última actualización:** Febrero 2024
