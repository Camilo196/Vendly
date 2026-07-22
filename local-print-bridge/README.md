# Vendly Print Helper

Helper local liviano para imprimir etiquetas desde Vendly sin depender del navegador ni de BarTender.

## Que hace

- Recibe desde Vendly el codigo del producto y la cantidad.
- Genera una hoja de etiquetas con medidas fijas:
  - papel: `70 x 25 mm`
  - `2` columnas
  - sticker util: `32 x 25 mm`
- Dibuja solo:
  - codigo de barras
  - numero visible
- Envia la impresion a la impresora configurada en Windows.

## Configuracion

1. Copia `config.example.json` como `config.json`.
2. Ajusta si hace falta:

- `printerName`: nombre exacto de la impresora. Si lo dejas vacio, usa la predeterminada.
- `dpi`: normalmente `203`
- `pageWidthMm`: `72`
- `pageHeightMm`: `25`
- `columns`: `2`
- `maxLabelsPerJob`: `2`
- `labelWidthMm`: `35`
- `labelHeightMm`: `25`
- `horizontalGapMm`: `2`
- `barcodeXOffsetMm`: `0.8`
- `barcodeYOffsetMm`: `2.1`
- `barcodeWidthMm`: `33.4`
- `barcodeHeightMm`: `15.2`

## Ejecucion

### Opcion facil para clientes

1. Instala Node.js LTS si el computador no lo tiene: https://nodejs.org/
2. Abre `iniciar-helper.bat` con doble clic.
3. Deja esa ventana abierta mientras imprimes etiquetas.
4. En Vendly entra a `Impresora` y presiona `Probar conexion`.

### Opcion tecnica

```powershell
cd D:\inventario-saas-FINAL-COMPLETO\inventario-saas-final\local-print-bridge
node server.js
```

Queda escuchando en:

- `http://127.0.0.1:5399`

## Rutas

- `GET /health`
- `GET /config`
- `POST /config`
- `POST /print/barcode-label`
- `POST /print/test-label`

## Calibracion desde Vendly

En Vendly entra a `Impresora`:

1. Presiona `Probar conexion`.
2. Presiona `Imprimir prueba`.
3. Si la etiqueta sale corrida, usa `Mover izquierda`, `Mover derecha`, `Subir` o `Bajar`.
4. Si el codigo sale pequeno o grande, usa `Agrandar codigo`, `Reducir codigo`, `Mas alto` o `Mas bajo`.
5. Presiona `Guardar configuracion`.

La configuracion queda guardada en `config.json` en ese computador. Cada cliente calibra su propia impresora una sola vez.

## Datos que recibe

Vendly envia algo como esto:

```json
{
  "product": {
    "barcode": "2001234567890",
    "barcodeFormat": "ean_13"
  },
  "quantity": 1
}
```

## Flujo recomendado

1. Deja el helper abierto en segundo plano.
2. Imprime desde Vendly.
3. Si el helper esta disponible, Vendly lo usa primero.
4. Solo si el helper falla, Vendly cae a la impresion del navegador.

## Nota sobre cantidades grandes

Cuando pides muchas etiquetas, el helper las divide en tandas cortas para evitar que la impresora se descalibre en una sola hoja muy larga.
