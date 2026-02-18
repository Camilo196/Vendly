# 🎨 GUÍA VISUAL DE INSTALACIÓN

## 📂 Estructura del Proyecto

```
inventario-saas/
│
├── 📄 README.md              ← Documentación principal
├── 🚀 QUICKSTART.md          ← Empieza aquí (10 minutos)
├── 📐 ARCHITECTURE.md        ← Arquitectura técnica
├── 📡 API_EXAMPLES.md        ← Ejemplos de uso
│
├── 🔧 backend/               ← SERVIDOR (Node.js)
│   ├── server.js            ← Archivo principal
│   ├── package.json         ← Dependencias
│   ├── .env.example         ← Plantilla de configuración
│   │
│   ├── models/              ← Esquemas de MongoDB
│   │   ├── User.js          ← Usuarios/Locales
│   │   ├── Product.js       ← Productos
│   │   ├── Purchase.js      ← Compras
│   │   └── Sale.js          ← Ventas
│   │
│   ├── routes/              ← API Endpoints
│   │   ├── auth.js          ← Login/Register
│   │   ├── products.js      ← Gestión productos
│   │   ├── purchases.js     ← Gestión compras
│   │   ├── sales.js         ← Gestión ventas
│   │   ├── stats.js         ← Estadísticas
│   │   └── admin.js         ← Panel admin
│   │
│   └── middleware/
│       └── auth.js          ← Autenticación JWT
│
└── 🌐 frontend/             ← INTERFAZ WEB
    ├── index.html           ← Página principal
    ├── css/
    │   └── styles.css       ← Estilos
    └── js/
        ├── api.js           ← Cliente HTTP
        └── app.js           ← Lógica de la app
```

## 🎯 PASO A PASO CON CAPTURAS

### Paso 1: MongoDB Atlas (GRATIS)

1. **Ir a:** https://www.mongodb.com/cloud/atlas/register
2. **Crear cuenta** con Google o email
3. **Build a Database** → Seleccionar **FREE** (M0 Sandbox)
4. **AWS** → Región más cercana → **Create**
5. **Security:**
   - Username: `admin`
   - Password: `[TU_PASSWORD_SEGURA]` ⭐ **GUARDAR**
   - Click **Create User**
6. **Network Access:**
   - Click **Add Current IP**
   - **IMPORTANTE:** También agregar `0.0.0.0/0` (para desarrollo)
7. **Connect:**
   - Click **Drivers**
   - Copiar el **Connection String**:
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Paso 2: Configurar Backend

```bash
# 1. Descomprimir el ZIP
unzip inventario-saas.zip
cd inventario-saas/backend

# 2. Instalar Node.js (si no lo tienes)
# Windows: https://nodejs.org
# Mac: brew install node
# Linux: sudo apt install nodejs npm

# 3. Instalar dependencias
npm install

# 4. Configurar variables de entorno
cp .env.example .env

# 5. Editar .env
# Windows: notepad .env
# Mac/Linux: nano .env
```

**Contenido de .env:**
```env
PORT=5000
NODE_ENV=development

# REEMPLAZA CON TU CONNECTION STRING DE MONGODB
MONGODB_URI=mongodb+srv://admin:TU_PASSWORD@cluster0.xxxxx.mongodb.net/inventario-saas?retryWrites=true&w=majority

# Cambia este secreto por algo único
JWT_SECRET=miSuperSecreto123456789!@#

JWT_EXPIRE=30d

FRONTEND_URL=http://localhost:3000
```

### Paso 3: Iniciar Backend

```bash
# Desde la carpeta backend
npm start
```

**✅ Salida esperada:**
```
✅ MongoDB conectado: cluster0.xxxxx.mongodb.net
🚀 Servidor corriendo en puerto 5000
📱 Ambiente: development
```

**❌ Si hay error:**
```
Error: querySrv ENOTFOUND _mongodb._tcp.cluster0.xxxxx.mongodb.net
```
→ Verifica el connection string en .env
→ Asegúrate de reemplazar `<password>` con tu password real

### Paso 4: Probar Backend

**Opción 1 - Navegador:**
```
Abre: http://localhost:5000
Deberías ver:
{
  "message": "Sistema de Inventario SaaS API",
  "version": "1.0.0",
  "status": "running"
}
```

**Opción 2 - Terminal:**
```bash
curl http://localhost:5000
```

### Paso 5: Abrir Frontend

**Opción 1 - Navegador directo:**
```
1. Ve a la carpeta: inventario-saas/frontend
2. Doble click en: index.html
3. Se abrirá en tu navegador
```

**Opción 2 - Servidor local (recomendado):**
```bash
# Desde inventario-saas/frontend
python3 -m http.server 3000

# O con Node.js
npx serve . -p 3000
```

Luego abrir: http://localhost:3000

### Paso 6: Crear Primera Cuenta

1. **En el navegador:** Verás la pantalla de login
2. Click en **"Registrarse"**
3. Llenar el formulario:
   - Nombre del Negocio: `Mi Tienda Test`
   - Email: `test@test.com`
   - Contraseña: `test123`
4. Click **"Registrarse"**
5. **¡Listo!** Ya estás dentro del sistema

### Paso 7: Probar el Sistema

1. **Registrar una compra:**
   - Ir a **Compras**
   - Producto: `iPhone 14`
   - Cantidad: `5`
   - Costo: `3500000`
   - Click **Registrar Compra**

2. **Ver inventario:**
   - Ir a **Inventario**
   - Deberías ver el iPhone con stock 5

3. **Hacer una venta:**
   - Ir a **Ventas**
   - Seleccionar: `iPhone 14`
   - Cantidad: `1`
   - Precio: `4200000`
   - Click **Registrar Venta**

4. **Ver dashboard:**
   - Ir a **Dashboard**
   - Verás las estadísticas actualizadas

## 🎨 Vista del Sistema

```
┌─────────────────────────────────────┐
│  📱 Mi Tienda    test@test.com [Salir] │
├─────────────────────────────────────┤
│ 📊Dashboard │📦Compras │💰Ventas │... │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │Productos│ │  Stock  │ │ Ventas ││
│  │   15    │ │   234   │ │$125M   ││
│  └─────────┘ └─────────┘ └────────┘│
│                                     │
│  Productos con Stock Bajo:          │
│  ┌──────────────────────────────┐  │
│  │ AirPods Pro      | 3 | ⚠️    │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 🔧 Troubleshooting

### Error: "Cannot connect to MongoDB"
```
✅ Solución:
1. Ve a MongoDB Atlas
2. Network Access → Add IP → 0.0.0.0/0
3. Espera 2-3 minutos
4. Reinicia el servidor backend
```

### Error: "Token invalid"
```
✅ Solución:
1. Borra localStorage en el navegador:
   - F12 → Application → Local Storage → Clear
2. Recarga la página
3. Haz login de nuevo
```

### Puerto 5000 ocupado
```
✅ Solución:
# Opción 1: Cambiar puerto en .env
PORT=5001

# Opción 2: Matar proceso
# Windows: netstat -ano | findstr :5000
# Mac/Linux: lsof -ti:5000 | xargs kill -9
```

### Frontend no se conecta al backend
```
✅ Solución:
1. Verifica que el backend esté corriendo
2. En frontend/js/api.js, línea 2:
   baseURL: 'http://localhost:5000/api'
3. Debe coincidir con el puerto del backend
```

## 📱 Usando desde el Celular

1. **Encontrar tu IP local:**
```bash
# Windows
ipconfig
# Busca: IPv4 Address (ej: 192.168.1.100)

# Mac/Linux
ifconfig
# Busca: inet (ej: 192.168.1.100)
```

2. **Actualizar .env:**
```env
FRONTEND_URL=http://192.168.1.100:3000
```

3. **Abrir en el celular:**
```
http://192.168.1.100:3000
```

## 🚀 Siguiente Nivel: Subir a Internet

### Backend → Railway (Recomendado)
1. Ir a: https://railway.app
2. Login con GitHub
3. New Project → Deploy from GitHub
4. Seleccionar tu repositorio
5. Add variables de entorno (copiar de .env)
6. Deploy! 🚀

### Frontend → Vercel
1. Ir a: https://vercel.com
2. Login con GitHub
3. Import Project
4. Seleccionar carpeta `frontend`
5. Deploy! 🚀

## 💡 Tips Finales

✅ **Backup de datos:** MongoDB Atlas hace backups automáticos
✅ **Seguridad:** Cambia JWT_SECRET en producción
✅ **HTTPS:** Railway y Vercel dan HTTPS gratis
✅ **Dominio:** Puedes usar tu propio dominio en Vercel

## 📞 ¿Necesitas Ayuda?

Si algo no funciona:
1. Revisa la consola del navegador (F12)
2. Revisa los logs del backend
3. Compara con los ejemplos en API_EXAMPLES.md

---

**¡Listo! Ya tienes tu sistema funcionando** 🎉
