@echo off
title Vendly Print Helper
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js en este computador.
  echo Instala Node.js LTS desde:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando Vendly Print Helper...
echo Deja esta ventana abierta mientras imprimes etiquetas desde Vendly.
echo.
node server.js

echo.
echo El helper se detuvo.
pause
