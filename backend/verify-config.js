#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración del proyecto...\n');

// Verificar archivo .env
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
    console.log('❌ No se encontró el archivo .env');
    console.log('');
    console.log('Solución:');
    console.log('1. Copia el archivo .env.example:');
    console.log('   cp .env.example .env');
    console.log('');
    console.log('2. O crea un nuevo archivo .env con este contenido:');
    console.log('');
    console.log('PORT=5000');
    console.log('MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/inventario-saas');
    console.log('JWT_SECRET=tu_secreto_super_seguro_123456');
    console.log('');
    process.exit(1);
}

console.log('✅ Archivo .env encontrado');

// Leer y parsear .env
require('dotenv').config();

// Verificar variables críticas
const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET'
];

let allOk = true;

requiredVars.forEach(varName => {
    if (!process.env[varName]) {
        console.log(`❌ Falta la variable: ${varName}`);
        allOk = false;
    } else {
        // Mostrar preview de la variable (ocultando datos sensibles)
        let preview = process.env[varName];
        if (varName === 'MONGODB_URI') {
            // Mostrar solo el inicio y el final
            if (preview.includes('@')) {
                const parts = preview.split('@');
                preview = parts[0].substring(0, 20) + '...' + '@' + parts[1];
            }
        } else if (varName === 'JWT_SECRET') {
            preview = preview.substring(0, 10) + '...' + preview.substring(preview.length - 5);
        }
        console.log(`✅ ${varName}: ${preview}`);
    }
});

console.log('');

if (!allOk) {
    console.log('❌ Faltan variables de entorno requeridas');
    console.log('');
    console.log('Edita el archivo .env y agrega las variables faltantes');
    console.log('');
    process.exit(1);
}

// Verificar formato de MONGODB_URI
if (!process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    console.log('❌ MONGODB_URI no tiene el formato correcto');
    console.log('   Debe empezar con mongodb:// o mongodb+srv://');
    console.log('');
    process.exit(1);
}

// Verificar si contiene placeholder
if (process.env.MONGODB_URI.includes('TU_PASSWORD') || 
    process.env.MONGODB_URI.includes('CAMBIA_ESTA_PASSWORD') ||
    process.env.MONGODB_URI.includes('<password>')) {
    console.log('⚠️  ADVERTENCIA: MONGODB_URI contiene un placeholder');
    console.log('   Asegúrate de reemplazar la password con tu password real de MongoDB Atlas');
    console.log('');
}

console.log('✅ Todas las configuraciones están correctas');
console.log('');
console.log('Puedes iniciar el servidor con: npm start');
console.log('');
