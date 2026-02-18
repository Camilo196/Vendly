# 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

## ❌ Error: "The `uri` parameter to `openUri()` must be a string, got undefined"

### Causa:
El archivo `.env` no existe o no está siendo leído correctamente.

### Solución:

#### **Opción 1: Crear el archivo .env manualmente**

1. Ve a la carpeta `backend`
2. Crea un archivo llamado `.env` (CON EL PUNTO al inicio)
3. Copia este contenido:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://admin:TU_PASSWORD@cluster0.xxxxx.mongodb.net/inventario-saas?retryWrites=true&w=majority
JWT_SECRET=miSuperSecreto123456789
JWT_EXPIRE=30d
FRONTEND_URL=http://localhost:3000
```

4. Reemplaza `TU_PASSWORD` y `cluster0.xxxxx` con tus datos reales

#### **Opción 2: Copiar desde .env.example**

```bash
# En Mac/Linux
cd backend
cp .env.example .env
nano .env  # Editar y guardar

# En Windows
cd backend
copy .env.example .env
notepad .env
```

#### **Opción 3: Verificar configuración**

```bash
# Ejecutar el script de verificación
npm run verify
```

### **Verificar que funciona:**

```bash
# Deberías ver esto al ejecutar:
npm run verify

# ✅ Salida esperada:
# ✅ Archivo .env encontrado
# ✅ MONGODB_URI: mongodb+srv://admin...
# ✅ JWT_SECRET: miSuperSecr...
# ✅ Todas las configuraciones están correctas
```

---

## ❌ Error: "MongoServerError: bad auth: Authentication failed"

### Causa:
Usuario o password incorrectos en MongoDB Atlas.

### Solución:

1. **Ve a MongoDB Atlas:** https://cloud.mongodb.com
2. **Database Access** → Encuentra tu usuario
3. **Edit** → **Edit Password** → Crea nueva password
4. **Copia la password**
5. **Actualiza .env:**

```env
MONGODB_URI=mongodb+srv://admin:NUEVA_PASSWORD@cluster0.xxxxx.mongodb.net/inventario-saas
```

6. **Reinicia el servidor**

---

## ❌ Error: "MongooseServerSelectionError: getaddrinfo ENOTFOUND"

### Causa:
No se puede conectar a MongoDB Atlas (problema de red o IP bloqueada).

### Solución:

1. **Ve a MongoDB Atlas**
2. **Network Access**
3. **Add IP Address**
4. **Selecciona:** "Allow Access from Anywhere"
5. **Confirma:** IP = `0.0.0.0/0`
6. **Espera 2-3 minutos** para que se aplique
7. **Reinicia el servidor**

---

## ❌ Error: "Cannot find module 'express'"

### Causa:
No se instalaron las dependencias de Node.js.

### Solución:

```bash
cd backend
npm install
```

**Deberías ver:**
```
added 50+ packages
```

---

## ❌ Puerto 5000 ya está en uso

### Causa:
Otro programa está usando el puerto 5000.

### Solución:

#### **Opción 1: Cambiar el puerto**

Edita `.env`:
```env
PORT=5001
```

Y también actualiza `frontend/js/api.js` línea 2:
```javascript
baseURL: 'http://localhost:5001/api'
```

#### **Opción 2: Matar el proceso**

**Windows:**
```cmd
netstat -ano | findstr :5000
taskkill /PID [NUMERO] /F
```

**Mac/Linux:**
```bash
lsof -ti:5000 | xargs kill -9
```

---

## ❌ Frontend muestra "Network Error" o no se conecta

### Causa:
El backend no está corriendo o la URL es incorrecta.

### Solución:

1. **Verifica que el backend esté corriendo:**
```bash
# Deberías ver esto en la terminal del backend:
✅ MongoDB conectado: cluster0.xxxxx.mongodb.net
🚀 Servidor corriendo en puerto 5000
```

2. **Prueba en el navegador:**
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

3. **Verifica la URL en el frontend:**

Archivo: `frontend/js/api.js`, línea 2:
```javascript
const API_CONFIG = {
  baseURL: 'http://localhost:5000/api',  // ← Debe coincidir con el puerto del backend
  timeout: 10000
};
```

---

## ❌ Error: "Token invalid" después de login

### Causa:
El token JWT expiró o el JWT_SECRET cambió.

### Solución:

1. **Borra el localStorage del navegador:**
   - Presiona F12
   - Ve a **Application** (Chrome) o **Storage** (Firefox)
   - **Local Storage** → Tu dominio
   - Click derecho → **Clear**

2. **Recarga la página** (F5)

3. **Haz login de nuevo**

---

## ❌ "CORS Error" en la consola del navegador

### Causa:
El backend no permite peticiones desde tu frontend.

### Solución:

1. **Verifica .env:**
```env
FRONTEND_URL=http://localhost:3000
```

2. **Si usas otro puerto, cámbialo:**
```env
FRONTEND_URL=http://localhost:8000
```

3. **Reinicia el backend**

---

## ❌ No se ven los archivos .env en Windows

### Causa:
Windows oculta archivos que empiezan con punto.

### Solución:

#### **Método 1: Desde el Explorador**
1. Abre **Explorador de Archivos**
2. Click en **Vista**
3. Marca **Elementos ocultos**

#### **Método 2: Crear con CMD**
```cmd
cd backend
echo PORT=5000 > .env
echo MONGODB_URI=tu_uri >> .env
notepad .env
```

---

## ❌ El servidor se cae con "Error: listen EADDRINUSE"

### Causa:
Ya hay una instancia del servidor corriendo.

### Solución:

1. **Cierra todas las terminales**
2. **Mata todos los procesos de Node:**

**Windows:**
```cmd
taskkill /F /IM node.exe
```

**Mac/Linux:**
```bash
killall node
```

3. **Inicia de nuevo:**
```bash
npm start
```

---

## 📝 Checklist de Verificación

Antes de pedir ayuda, verifica:

- [ ] El archivo `.env` existe en la carpeta `backend`
- [ ] `MONGODB_URI` está configurada correctamente
- [ ] `JWT_SECRET` está configurada
- [ ] Las dependencias están instaladas (`node_modules` existe)
- [ ] El backend está corriendo (muestra "Servidor corriendo")
- [ ] Puedes acceder a `http://localhost:5000`
- [ ] No hay errores en la consola del backend
- [ ] No hay errores en la consola del navegador (F12)

---

## 🆘 Script de Diagnóstico

Ejecuta esto para ver toda la info:

```bash
cd backend

echo "=== Verificando Node.js ==="
node --version

echo "=== Verificando npm ==="
npm --version

echo "=== Verificando archivo .env ==="
ls -la | grep .env

echo "=== Verificando dependencias ==="
ls -la node_modules | head -5

echo "=== Verificando configuración ==="
npm run verify
```

---

## 💡 Tips Adicionales

### Resetear todo desde cero:

```bash
# 1. Borrar dependencias
cd backend
rm -rf node_modules
rm package-lock.json

# 2. Reinstalar
npm install

# 3. Verificar configuración
npm run verify

# 4. Iniciar
npm start
```

### Ver logs detallados:

```bash
# Agregar esto al inicio de server.js (después de dotenv.config())
console.log('Environment variables:', {
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI ? 'SET ✓' : 'NOT SET ✗',
  JWT_SECRET: process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ✗'
});
```

---

**Si el problema persiste**, copia el error completo y revisa la documentación de MongoDB Atlas o Node.js.
