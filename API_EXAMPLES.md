# 📡 EJEMPLOS DE USO DE LA API

## 🔐 Autenticación

### 1. Registrar Nuevo Local

```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "businessName": "Tienda de Celulares El Pasto",
  "email": "elpasto@gmail.com",
  "password": "mipassword123",
  "phone": "3001234567",
  "address": "Calle 18 # 25-50",
  "city": "Pasto"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registro exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65d1234567890abcdef",
    "businessName": "Tienda de Celulares El Pasto",
    "email": "elpasto@gmail.com",
    "role": "user",
    "plan": "free"
  }
}
```

### 2. Login

```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "elpasto@gmail.com",
  "password": "mipassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

### 3. Obtener Información del Usuario Actual

```bash
GET http://localhost:5000/api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📦 Productos

### 4. Listar Productos

```bash
GET http://localhost:5000/api/products
Authorization: Bearer TU_TOKEN
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "products": [
    {
      "_id": "65d...",
      "name": "iPhone 14 Pro",
      "stock": 5,
      "averageCost": 3500000,
      "category": "Smartphones",
      "brand": "Apple"
    },
    {
      "_id": "65d...",
      "name": "Samsung Galaxy S23",
      "stock": 8,
      "averageCost": 2800000,
      "category": "Smartphones",
      "brand": "Samsung"
    }
  ]
}
```

### 5. Crear Producto Manual

```bash
POST http://localhost:5000/api/products
Authorization: Bearer TU_TOKEN
Content-Type: application/json

{
  "name": "AirPods Pro",
  "category": "Accesorios",
  "brand": "Apple",
  "description": "Audífonos inalámbricos"
}
```

## 🛒 Compras

### 6. Registrar Compra

```bash
POST http://localhost:5000/api/purchases
Authorization: Bearer TU_TOKEN
Content-Type: application/json

{
  "productName": "iPhone 14 Pro",
  "quantity": 3,
  "unitCost": 3500000,
  "supplier": "Distribuidora XYZ",
  "invoice": "FACT-001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Compra registrada exitosamente",
  "purchase": {
    "_id": "65d...",
    "productName": "iPhone 14 Pro",
    "quantity": 3,
    "unitCost": 3500000,
    "totalCost": 10500000,
    "purchaseDate": "2024-02-13T..."
  },
  "product": {
    "name": "iPhone 14 Pro",
    "stock": 8,
    "averageCost": 3500000
  }
}
```

### 7. Listar Compras con Filtros

```bash
# Todas las compras
GET http://localhost:5000/api/purchases
Authorization: Bearer TU_TOKEN

# Por rango de fechas
GET http://localhost:5000/api/purchases?startDate=2024-02-01&endDate=2024-02-28
Authorization: Bearer TU_TOKEN

# Por producto específico
GET http://localhost:5000/api/purchases?productId=65d...
Authorization: Bearer TU_TOKEN
```

## 💰 Ventas

### 8. Registrar Venta

```bash
POST http://localhost:5000/api/sales
Authorization: Bearer TU_TOKEN
Content-Type: application/json

{
  "productId": "65d123...",
  "quantity": 1,
  "unitPrice": 4200000,
  "customer": "Juan Pérez",
  "paymentMethod": "card"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Venta registrada exitosamente",
  "sale": {
    "_id": "65d...",
    "productName": "iPhone 14 Pro",
    "quantity": 1,
    "unitPrice": 4200000,
    "totalSale": 4200000,
    "unitCost": 3500000,
    "totalCost": 3500000,
    "profit": 700000,
    "saleDate": "2024-02-13T..."
  },
  "product": {
    "name": "iPhone 14 Pro",
    "remainingStock": 7
  }
}
```

### 9. Listar Ventas con Filtros

```bash
# Todas las ventas
GET http://localhost:5000/api/sales
Authorization: Bearer TU_TOKEN

# Ventas de hoy
GET http://localhost:5000/api/sales?startDate=2024-02-13
Authorization: Bearer TU_TOKEN

# Ventas de este mes
GET http://localhost:5000/api/sales?startDate=2024-02-01&endDate=2024-02-29
Authorization: Bearer TU_TOKEN
```

### 10. Cancelar Venta

```bash
DELETE http://localhost:5000/api/sales/65d123...
Authorization: Bearer TU_TOKEN
```

## 📊 Estadísticas y Reportes

### 11. Dashboard Principal

```bash
GET http://localhost:5000/api/stats/dashboard
Authorization: Bearer TU_TOKEN
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "inventory": {
      "totalProducts": 15,
      "totalStock": 234,
      "currentInvestment": 82500000
    },
    "sales": {
      "allTime": {
        "total": 125000000,
        "profit": 18500000,
        "count": 45
      },
      "thisMonth": {
        "total": 32000000,
        "profit": 4800000,
        "count": 12
      }
    },
    "purchases": {
      "allTime": {
        "total": 106500000,
        "count": 38
      },
      "thisMonth": {
        "total": 28000000,
        "count": 8
      }
    },
    "topProducts": [
      {
        "_id": "65d...",
        "productName": "iPhone 14 Pro",
        "totalQuantity": 15,
        "totalRevenue": 63000000
      }
    ],
    "lowStockProducts": [
      {
        "id": "65d...",
        "name": "AirPods Pro",
        "stock": 3,
        "averageCost": 850000
      }
    ]
  }
}
```

### 12. Reporte por Producto

```bash
GET http://localhost:5000/api/stats/products
Authorization: Bearer TU_TOKEN
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "products": [
    {
      "id": "65d...",
      "name": "iPhone 14 Pro",
      "stock": 7,
      "averageCost": 3500000,
      "stockValue": 24500000,
      "totalPurchased": 31500000,
      "totalSold": 63000000,
      "profit": 10500000,
      "unitsSold": 15,
      "unitsPurchased": 9
    }
  ]
}
```

### 13. Estadísticas por Período

```bash
GET http://localhost:5000/api/stats/period?startDate=2024-02-01&endDate=2024-02-28
Authorization: Bearer TU_TOKEN
```

## 👨‍💼 Panel de Admin

### 14. Listar Todos los Usuarios

```bash
GET http://localhost:5000/api/admin/users
Authorization: Bearer ADMIN_TOKEN

# Con filtros
GET http://localhost:5000/api/admin/users?plan=free&isActive=true
GET http://localhost:5000/api/admin/users?search=tienda
```

**Response:**
```json
{
  "success": true,
  "count": 25,
  "users": [
    {
      "id": "65d...",
      "businessName": "Tienda de Celulares El Pasto",
      "email": "elpasto@gmail.com",
      "plan": "free",
      "isActive": true,
      "stats": {
        "totalProducts": 15,
        "totalSales": 45,
        "totalPurchases": 38
      }
    }
  ]
}
```

### 15. Ver Detalles de un Usuario

```bash
GET http://localhost:5000/api/admin/users/65d123...
Authorization: Bearer ADMIN_TOKEN
```

### 16. Actualizar Plan de Usuario

```bash
PUT http://localhost:5000/api/admin/users/65d123...
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "plan": "premium",
  "limits": {
    "maxProducts": 1000,
    "maxSalesPerMonth": 10000
  }
}
```

### 17. Desactivar Usuario

```bash
PUT http://localhost:5000/api/admin/users/65d123...
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "isActive": false
}
```

### 18. Estadísticas Globales del Sistema

```bash
GET http://localhost:5000/api/admin/stats
Authorization: Bearer ADMIN_TOKEN
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "users": {
      "total": 25,
      "active": 23,
      "inactive": 2,
      "byPlan": [
        { "_id": "free", "count": 18 },
        { "_id": "basic", "count": 5 },
        { "_id": "premium", "count": 2 }
      ]
    },
    "activity": {
      "totalProducts": 375,
      "totalSales": 1250,
      "totalPurchases": 980,
      "totalRevenue": 3125000000
    }
  }
}
```

## 📝 Colección de Postman

### Importar en Postman

1. Abre Postman
2. Click "Import" → "Raw text"
3. Pega el siguiente JSON:

```json
{
  "info": {
    "name": "Inventario SaaS API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000/api"
    },
    {
      "key": "token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/auth/register",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"businessName\": \"Mi Tienda\",\n  \"email\": \"test@test.com\",\n  \"password\": \"password123\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            }
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/auth/login",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@test.com\",\n  \"password\": \"password123\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            }
          }
        }
      ]
    }
  ]
}
```

## 🧪 Casos de Prueba

### Flujo Completo: Nuevo Cliente

```bash
# 1. Registrarse
POST /api/auth/register
{
  "businessName": "Celulares Express",
  "email": "express@test.com",
  "password": "test123"
}
# Guardar el token

# 2. Ver productos (debe estar vacío)
GET /api/products
Authorization: Bearer TOKEN

# 3. Registrar primera compra
POST /api/purchases
{
  "productName": "iPhone 13",
  "quantity": 5,
  "unitCost": 3000000
}

# 4. Ver inventario (debe mostrar el iPhone)
GET /api/products

# 5. Hacer una venta
POST /api/sales
{
  "productId": "ID_DEL_IPHONE",
  "quantity": 1,
  "unitPrice": 3800000
}

# 6. Ver estadísticas
GET /api/stats/dashboard
# Debe mostrar:
# - 1 producto
# - Stock: 4
# - Venta total: 3,800,000
# - Ganancia: 800,000
```

---

**💡 Tip:** Usa las variables de entorno en Postman para almacenar el `base_url` y `token`, así no tienes que cambiarlos en cada request.
