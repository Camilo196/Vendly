const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { renderSheetBuffer } = require('./renderer');

const DEFAULT_PORT = 5399;

function loadConfig() {
  const baseDir = __dirname;
  const configPath = path.join(baseDir, 'config.json');
  const examplePath = path.join(baseDir, 'config.example.json');
  const sourcePath = fs.existsSync(configPath) ? configPath : examplePath;
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);

  return {
    ...parsed,
    port: Number(parsed.port) || DEFAULT_PORT,
    dpi: Number(parsed.dpi) || 203,
    pageWidthMm: Number(parsed.pageWidthMm) || 70,
    pageHeightMm: Number(parsed.pageHeightMm) || 25,
    columns: Number(parsed.columns) || 2,
    labelWidthMm: Number(parsed.labelWidthMm) || 32,
    labelHeightMm: Number(parsed.labelHeightMm) || 25,
    horizontalGapMm: Number(parsed.horizontalGapMm) || 6,
    verticalGapMm: Number(parsed.verticalGapMm) || 0,
    printerName: String(parsed.printerName || '').trim(),
    runtimeDir: path.resolve(baseDir, parsed.runtimeDir || './runtime')
  };
}

const config = loadConfig();
fs.mkdirSync(config.runtimeDir, { recursive: true });

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('La solicitud supera el tamano permitido.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('JSON invalido.'));
      }
    });

    req.on('error', reject);
  });
}

function normalizeProduct(product = {}) {
  return {
    barcode: String(product.barcode || '').trim(),
    barcodeFormat: String(product.barcodeFormat || '').trim().toLowerCase(),
    name: String(product.name || '').trim(),
    sku: String(product.sku || '').trim(),
    price: product.price ?? ''
  };
}

function printImage(imagePath, pageHeightMm) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'print-image.ps1');
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-ImagePath', imagePath,
      '-WidthMm', String(config.pageWidthMm),
      '-HeightMm', String(pageHeightMm || config.pageHeightMm)
    ];

    if (config.printerName) {
      args.push('-PrinterName', config.printerName);
    }

    const child = spawn('powershell.exe', args, {
      cwd: __dirname,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim() });
        return;
      }

      reject(new Error((stderr || stdout || `Error de impresion (${code})`).trim()));
    });
  });
}

function createJobFilePath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(config.runtimeDir, `vendly-label-${stamp}.bmp`);
}

async function handlePrint(req, res) {
  const payload = await parseJsonBody(req);
  const product = normalizeProduct(payload.product || {});
  const quantity = Math.max(1, parseInt(payload.quantity, 10) || 1);

  if (!product.barcode) {
    sendJson(res, 400, {
      success: false,
      message: 'El producto no tiene codigo para imprimir.'
    });
    return;
  }

  const outputPath = createJobFilePath();
  const { buffer, pageHeightMm } = renderSheetBuffer({
    product,
    quantity,
    config
  });

  fs.writeFileSync(outputPath, buffer);
  await printImage(outputPath, pageHeightMm);

  sendJson(res, 200, {
    success: true,
    message: 'Etiqueta enviada a la impresora local.',
    job: {
      file: outputPath,
      quantity,
      barcode: product.barcode
    }
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        success: true,
        service: 'vendly-local-print-helper',
        printerName: config.printerName || '(predeterminada de Windows)',
        pageWidthMm: config.pageWidthMm,
        pageHeightMm: config.pageHeightMm,
        columns: config.columns,
        labelWidthMm: config.labelWidthMm,
        labelHeightMm: config.labelHeightMm,
        runtimeDir: config.runtimeDir
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/print/barcode-label') {
      await handlePrint(req, res);
      return;
    }

    sendJson(res, 404, {
      success: false,
      message: 'Ruta no encontrada.'
    });
  } catch (error) {
    console.error('Print helper error:', error);
    sendJson(res, 500, {
      success: false,
      message: error.message || 'Error interno del helper local.'
    });
  }
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Vendly Print Helper corriendo en http://127.0.0.1:${config.port}`);
  console.log(`Impresora: ${config.printerName || 'predeterminada de Windows'}`);
});
