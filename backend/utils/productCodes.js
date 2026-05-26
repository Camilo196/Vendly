const CODE_39_SAFE = /[^A-Z0-9\-\.\ $\/\+%]/g;

function normalizeCode(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(CODE_39_SAFE, '');
}

function normalizeSku(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-_./]/g, '');
}

function detectBarcodeFormat(code = '') {
  if (/^\d{13}$/.test(code)) return 'ean_13';
  if (/^\d{12}$/.test(code)) return 'upc_a';
  if (/^\d{8}$/.test(code)) return 'ean_8';
  return 'code_39';
}

function normalizeDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function computeEan13CheckDigit(value = '') {
  const digits = normalizeDigits(value);
  if (!/^\d{12}$/.test(digits)) {
    return null;
  }

  const sum = digits
    .split('')
    .map(Number)
    .reduce((acc, digit, index) => acc + (index % 2 === 0 ? digit : digit * 3), 0);

  return String((10 - (sum % 10)) % 10);
}

function buildInternalNumericBase() {
  const timestampPart = String(Date.now()).slice(-7);
  const randomPart = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  return `200${timestampPart}${randomPart}`.slice(0, 12);
}

function buildInternalEan13() {
  const base = buildInternalNumericBase();
  const checkDigit = computeEan13CheckDigit(base);
  return checkDigit === null ? '' : `${base}${checkDigit}`;
}

function buildSeed(name = '', productType = '', brand = '') {
  const base = [brand, name, productType]
    .filter(Boolean)
    .join('-')
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-+|\-+$/g, '');

  return base.slice(0, 10) || 'PRODUCTO';
}

function buildInternalBarcode(seed = 'PRODUCTO') {
  return buildInternalEan13();
}

function buildInternalSku(seed = 'PRODUCTO') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return normalizeSku(`SKU-${seed}-${timestamp}-${random}`.slice(0, 32));
}

async function ensureUniqueField(Product, {
  userId,
  field,
  value,
  excludeId = null,
  fallbackFactory
}) {
  let candidate = value;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!candidate) {
      candidate = fallbackFactory();
    }

    const existing = await Product.findOne({
      userId,
      [field]: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {})
    }).select('_id');

    if (!existing) {
      return candidate;
    }

    candidate = fallbackFactory();
  }

  throw new Error(`No fue posible generar un ${field} único para este producto`);
}

async function prepareProductCodes(Product, {
  userId,
  existingProduct = null,
  name = '',
  brand = '',
  productType = 'otro',
  barcode = '',
  sku = '',
  barcodeFormat = ''
}) {
  const excludeId = existingProduct?._id || null;
  const seed = buildSeed(name || existingProduct?.name, productType || existingProduct?.productType, brand || existingProduct?.brand);

  const normalizedBarcode = normalizeCode(barcode || existingProduct?.barcode || '');
  const normalizedSku = normalizeSku(sku || existingProduct?.sku || '');

  const finalBarcode = await ensureUniqueField(Product, {
    userId,
    field: 'barcode',
    value: normalizedBarcode,
    excludeId,
    fallbackFactory: () => buildInternalBarcode(seed)
  });

  const finalSku = await ensureUniqueField(Product, {
    userId,
    field: 'sku',
    value: normalizedSku,
    excludeId,
    fallbackFactory: () => buildInternalSku(seed)
  });

  const resolvedFormat = barcodeFormat
    || existingProduct?.barcodeFormat
    || detectBarcodeFormat(finalBarcode);

  return {
    barcode: finalBarcode,
    sku: finalSku,
    barcodeFormat: resolvedFormat,
    barcodeSource: normalizedBarcode ? 'supplier' : 'internal'
  };
}

module.exports = {
  normalizeCode,
  normalizeSku,
  detectBarcodeFormat,
  normalizeDigits,
  computeEan13CheckDigit,
  prepareProductCodes
};
