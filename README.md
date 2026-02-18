# 🛍️ Vendly
### Gestiona tu negocio, potencia tus ventas

Vendly es un sistema SaaS de gestión de inventario, ventas y comisiones diseñado para pequeños y medianos negocios. Permite registrar compras, ventas, controlar stock, gestionar empleados y calcular comisiones automáticamente.

---

## 🚀 Funcionalidades

- **Autenticación** — Registro e inicio de sesión con JWT, multi-tenancy (cada negocio ve solo sus datos)
- **Inventario** — Control de stock, costo promedio ponderado, ajuste de stock manual
- **Compras** — Registro de compras, precio sugerido de venta, historial
- **Ventas** — Registro de ventas, historial, edición y eliminación
- **Servicio Técnico** — Gestión de equipos en reparación
- **Empleados** — Registro de vendedores con configuración de comisiones
- **Comisiones** — Cálculo automático de comisiones por venta de celulares, aprobación y pago
- **Reportes** — Dashboard con estadísticas de ventas, ganancias y stock
- **Admin** — Panel de administración para gestión de usuarios

---

## 🛠️ Tecnologías

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT para autenticación
- API REST

**Frontend**
- HTML5, CSS3, JavaScript vanilla
- Diseño responsive

---

## ⚙️ Instalación

### Requisitos
- Node.js v18+
- MongoDB Atlas (o MongoDB local)

### Pasos

**1. Clona el repositorio**
```bash
git clone https://github.com/tuusuario/vendly.git
cd vendly
```

**2. Instala dependencias del backend**
```bash
cd backend
npm install
```

**3. Configura las variables de entorno**

Crea un archivo `.env` en la carpeta `backend` con el siguiente contenido:
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/vendly
JWT_SECRET=tu_secreto_seguro
JWT_EXPIRE=30d
FRONTEND_URL=http://localhost:3000
```

**4. Inicia el servidor**
```bash
npm start
```

**5. Abre el frontend**

Abre el archivo `frontend/index.html` en tu navegador o usa un servidor estático como Live Server.

---

## 📁 Estructura del proyecto

```
vendly/
├── backend/
│   ├── models/          # Modelos de MongoDB
│   ├── routes/          # Rutas de la API
│   ├── middleware/       # Autenticación JWT
│   └── server.js        # Servidor principal
└── frontend/
    ├── css/             # Estilos
    ├── js/              # Lógica del cliente
    └── index.html       # Aplicación principal
```

---

## 📌 Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI` | Connection string de MongoDB Atlas |
| `JWT_SECRET` | Clave secreta para tokens JWT |
| `JWT_EXPIRE` | Tiempo de expiración del token |
| `FRONTEND_URL` | URL del frontend (para CORS) |
| `PORT` | Puerto del servidor (default: 5000) |

---

## 👤 Autor

Desarrollado con 💙 — 2026
