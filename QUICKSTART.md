# 🚀 GUÍA RÁPIDA - Poner en Funcionamiento en 10 Minutos

## ✅ Checklist Rápido

- [ ] Cuenta de MongoDB Atlas creada
- [ ] Node.js instalado
- [ ] Backend configurado y corriendo
- [ ] Frontend accesible

## 📝 Paso a Paso

### 1️⃣ MongoDB Atlas (2 minutos)

```
1. Ir a: https://www.mongodb.com/cloud/atlas/register
2. Crear cuenta gratuita (usa Google o email)
3. Click en "Build a Database"
4. Seleccionar "FREE" (M0 Sandbox)
5. Click "Create"
6. En "Security Quickstart":
   - Username: admin
   - Password: [Crea una contraseña segura] ⭐ GUÁRDALA
   - Click "Create User"
7. En "Where would you like to connect from?"
   - Click "Add My Current IP Address"
   - También agrega: 0.0.0.0/0 (para desarrollo)
   - Click "Finish and Close"
8. Click "Connect" → "Drivers"
9. Copiar el connection string (similar a):
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/
```

### 2️⃣ Configurar Backend (3 minutos)

```bash
# En la terminal, ve a la carpeta backend
cd inventario-saas/backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Editar .env (usa nano, vim, o tu editor favorito)
nano .env
```

**Edita estas líneas en .env:**
```
MONGODB_URI=mongodb+srv://admin:TU_PASSWORD@cluster0.xxxxx.mongodb.net/inventario-saas?retryWrites=true&w=majority
JWT_SECRET=miSuperSecreto123456789!@#
PORT=5000
```

**Reemplaza:**
- `TU_PASSWORD` → La password que creaste en MongoDB
- `cluster0.xxxxx` → Tu cluster real de MongoDB

**Guardar y cerrar** (Ctrl+X, Y, Enter en nano)

### 3️⃣ Iniciar Backend (30 segundos)

```bash
# Desde la carpeta backend
npm start
```

**Deberías ver:**
```
✅ MongoDB conectado: cluster0.xxxxx.mongodb.net
🚀 Servidor corriendo en puerto 5000
📱 Ambiente: development
```

✅ **Si ves esto, ¡FELICIDADES! El backend funciona**

❌ **Si ves error:**
- Verifica el connection string en .env
- Asegúrate de haber agregado 0.0.0.0/0 en MongoDB Network Access
- Revisa que user y password sean correctos

### 4️⃣ Probar el Backend (1 minuto)

Abre un navegador y ve a:
```
http://localhost:5000
```

Deberías ver:
```json
{
  "message": "Sistema de Inventario SaaS API",
  "version": "1.0.0",
  "status": "running"
}
```

### 5️⃣ Crear Usuario Admin (2 minutos)

**Opción A - Con Postman:**
```
POST http://localhost:5000/api/auth/register
Body (JSON):
{
  "businessName": "Admin Principal",
  "email": "admin@miempresa.com",
  "password": "admin123"
}
```

**Opción B - Con curl en terminal:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Admin Principal",
    "email": "admin@miempresa.com",
    "password": "admin123"
  }'
```

**Guardar el token** que te devuelve:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

### 6️⃣ Convertir en Admin (1 minuto)

1. Ve a MongoDB Atlas
2. Click en "Browse Collections"
3. Database: `inventario-saas` → Collection: `users`
4. Encuentra tu usuario (el que acabas de crear)
5. Click en "Edit Document"
6. Cambia `"role": "user"` a `"role": "admin"`
7. Click "Update"

### 7️⃣ Frontend (1 minuto)

**Opción Simple:**
```bash
cd ../frontend
python3 -m http.server 3000
```

O simplemente abre `frontend/index.html` en tu navegador.

## 🎯 ¡Listo para Usar!

Ahora puedes:

1. **Registrar nuevos locales:**
   ```
   POST http://localhost:5000/api/auth/register
   ```

2. **Login:**
   ```
   POST http://localhost:5000/api/auth/login
   ```

3. **Registrar compras:**
   ```
   POST http://localhost:5000/api/purchases
   Headers: Authorization: Bearer TU_TOKEN
   Body: {
     "productName": "iPhone 14",
     "quantity": 5,
     "unitCost": 3500000
   }
   ```

4. **Registrar ventas:**
   ```
   POST http://localhost:5000/api/sales
   Headers: Authorization: Bearer TU_TOKEN
   Body: {
     "productId": "ID_DEL_PRODUCTO",
     "quantity": 1,
     "unitPrice": 4200000
   }
   ```

5. **Ver estadísticas:**
   ```
   GET http://localhost:5000/api/stats/dashboard
   Headers: Authorization: Bearer TU_TOKEN
   ```

## 📱 Usando Postman (Recomendado para Pruebas)

1. Descarga Postman: https://www.postman.com/downloads/
2. Importa esta colección base:
   - New Collection → "Inventario SaaS"
   - Variables:
     - `base_url`: http://localhost:5000/api
     - `token`: (lo pegas después del login)

3. Requests básicos:
   ```
   POST {{base_url}}/auth/login
   GET {{base_url}}/stats/dashboard
   POST {{base_url}}/purchases
   POST {{base_url}}/sales
   ```

## 🔧 Comandos Útiles

```bash
# Ver logs del servidor
npm start

# Reiniciar servidor automáticamente en cambios
npm run dev  # (requiere instalar nodemon primero)

# Ver base de datos
# Ve a MongoDB Atlas → Browse Collections

# Borrar todos los datos
# MongoDB Atlas → Collections → Drop Collection
```

## ❓ Problemas Comunes

### "Cannot connect to MongoDB"
```
✅ Solución:
1. Verifica IP en Network Access (0.0.0.0/0)
2. Revisa usuario/password en .env
3. Espera 2-3 minutos (el cluster puede tardar en iniciar)
```

### "Token invalid"
```
✅ Solución:
1. Haz login de nuevo
2. Usa el nuevo token en las peticiones
```

### "Port 5000 already in use"
```
✅ Solución:
1. Cambia PORT=5001 en .env
2. O mata el proceso: sudo lsof -ti:5000 | xargs kill -9
```

## 🎉 Siguiente Nivel

Una vez que todo funcione:

1. ✅ Prueba TODAS las rutas con Postman
2. ✅ Crea 2-3 usuarios de prueba (diferentes locales)
3. ✅ Registra compras y ventas
4. ✅ Ve las estadísticas
5. ✅ Prueba el panel de admin

## 💰 Monetización

Para vender el sistema:

1. **Hosting:** Railway ($5/mes) o Render (gratis)
2. **Dominio:** Namecheap ($10/año)
3. **MongoDB:** Gratis hasta 512MB, luego $9/mes
4. **Precio sugerido:** $20-50/mes por local

**Total costos fijos:** ~$15/mes
**Ganancia por cliente:** $20-50/mes
**Con 10 clientes:** $200-500/mes de ingreso

---

¿Algún problema? Revisa el README.md principal para más detalles.
