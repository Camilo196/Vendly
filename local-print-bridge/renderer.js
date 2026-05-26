const FONT_5X7 = {
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['00110','01000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00010','11100'],
  'A': ['00100','01010','10001','10001','11111','10001','10001'],
  'B': ['11110','10001','10001','11110','10001','10001','11110'],
  'C': ['01111','10000','10000','10000','10000','10000','01111'],
  'D': ['11110','10001','10001','10001','10001','10001','11110'],
  'E': ['11111','10000','10000','11110','10000','10000','11111'],
  'F': ['11111','10000','10000','11110','10000','10000','10000'],
  'G': ['01111','10000','10000','10111','10001','10001','01111'],
  'H': ['10001','10001','10001','11111','10001','10001','10001'],
  'I': ['01110','00100','00100','00100','00100','00100','01110'],
  'J': ['00001','00001','00001','00001','10001','10001','01110'],
  'K': ['10001','10010','10100','11000','10100','10010','10001'],
  'L': ['10000','10000','10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10101','10001','10001','10001'],
  'N': ['10001','10001','11001','10101','10011','10001','10001'],
  'O': ['01110','10001','10001','10001','10001','10001','01110'],
  'P': ['11110','10001','10001','11110','10000','10000','10000'],
  'Q': ['01110','10001','10001','10001','10101','10010','01101'],
  'R': ['11110','10001','10001','11110','10100','10010','10001'],
  'S': ['01111','10000','10000','01110','00001','00001','11110'],
  'T': ['11111','00100','00100','00100','00100','00100','00100'],
  'U': ['10001','10001','10001','10001','10001','10001','01110'],
  'V': ['10001','10001','10001','10001','10001','01010','00100'],
  'W': ['10001','10001','10001','10101','10101','10101','01010'],
  'X': ['10001','10001','01010','00100','01010','10001','10001'],
  'Y': ['10001','10001','01010','00100','00100','00100','00100'],
  'Z': ['11111','00001','00010','00100','01000','10000','11111'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000']
};

function mmToPx(mm, dpi) {
  return Math.max(1, Math.round((mm / 25.4) * dpi));
}

function createCanvas(width, height) {
  const pixels = new Uint8Array(width * height);
  pixels.fill(255);
  return { width, height, pixels };
}

function setPixel(canvas, x, y, value = 0) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  canvas.pixels[(y * canvas.width) + x] = value;
}

function fillRect(canvas, x, y, width, height, value = 0) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(canvas, px, py, value);
    }
  }
}

function drawText(canvas, text, x, y, scale = 2, spacing = 1) {
  const chars = String(text || '').toUpperCase().split('');
  let cursorX = x;

  chars.forEach((char) => {
    const glyph = FONT_5X7[char] || FONT_5X7[' '];
    glyph.forEach((row, rowIndex) => {
      row.split('').forEach((bit, colIndex) => {
        if (bit === '1') {
          fillRect(
            canvas,
            cursorX + (colIndex * scale),
            y + (rowIndex * scale),
            scale,
            scale,
            0
          );
        }
      });
    });
    cursorX += (5 * scale) + spacing;
  });
}

function normalizeDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function resolveBarcodeSpec(product = {}) {
  const raw = String(product.barcode || '');
  const digits = normalizeDigits(raw);
  const format = String(product.barcodeFormat || '').toLowerCase();

  if (format === 'ean_13' || /^\d{13}$/.test(digits)) {
    return { format: 'ean_13', value: digits || raw };
  }
  if (format === 'ean_8' || /^\d{8}$/.test(digits)) {
    return { format: 'ean_8', value: digits || raw };
  }
  return {
    format: 'code_39',
    value: String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9\-.\ $/+%]/g, '')
  };
}

function renderEan13Pattern(value) {
  const L = {
    '0': '0001101','1': '0011001','2': '0010011','3': '0111101','4': '0100011',
    '5': '0110001','6': '0101111','7': '0111011','8': '0110111','9': '0001011'
  };
  const G = {
    '0': '0100111','1': '0110011','2': '0011011','3': '0100001','4': '0011101',
    '5': '0111001','6': '0000101','7': '0010001','8': '0001001','9': '0010111'
  };
  const R = {
    '0': '1110010','1': '1100110','2': '1101100','3': '1000010','4': '1011100',
    '5': '1001110','6': '1010000','7': '1000100','8': '1001000','9': '1110100'
  };
  const P = {
    '0': 'LLLLLL','1': 'LLGLGG','2': 'LLGGLG','3': 'LLGGGL','4': 'LGLLGG',
    '5': 'LGGLLG','6': 'LGGGLL','7': 'LGLGLG','8': 'LGLGGL','9': 'LGGLGL'
  };

  const first = value[0];
  const leftDigits = value.slice(1, 7).split('');
  const rightDigits = value.slice(7).split('');
  const parity = P[first] || P['0'];
  const left = leftDigits.map((digit, index) => (parity[index] === 'G' ? G[digit] : L[digit])).join('');
  const right = rightDigits.map((digit) => R[digit]).join('');
  return `101${left}01010${right}101`;
}

function renderEan8Pattern(value) {
  const L = {
    '0': '0001101','1': '0011001','2': '0010011','3': '0111101','4': '0100011',
    '5': '0110001','6': '0101111','7': '0111011','8': '0110111','9': '0001011'
  };
  const R = {
    '0': '1110010','1': '1100110','2': '1101100','3': '1000010','4': '1011100',
    '5': '1001110','6': '1010000','7': '1000100','8': '1001000','9': '1110100'
  };

  const left = value.slice(0, 4).split('').map((digit) => L[digit]).join('');
  const right = value.slice(4).split('').map((digit) => R[digit]).join('');
  return `101${left}01010${right}101`;
}

function renderCode39Pattern(value) {
  const patterns = {
    '0': 'nnnwwnwnn','1': 'wnnwnnnnw','2': 'nnwwnnnnw','3': 'wnwwnnnnn','4': 'nnnwwnnnw',
    '5': 'wnnwwnnnn','6': 'nnwwwnnnn','7': 'nnnwnnwnw','8': 'wnnwnnwnn','9': 'nnwwnnwnn',
    'A': 'wnnnnwnnw','B': 'nnwnnwnnw','C': 'wnwnnwnnn','D': 'nnnnwwnnw','E': 'wnnnwwnnn',
    'F': 'nnwnwwnnn','G': 'nnnnnwwnw','H': 'wnnnnwwnn','I': 'nnwnnwwnn','J': 'nnnnwwwnn',
    'K': 'wnnnnnnww','L': 'nnwnnnnww','M': 'wnwnnnnwn','N': 'nnnnwnnww','O': 'wnnnwnnwn',
    'P': 'nnwnwnnwn','Q': 'nnnnnnwww','R': 'wnnnnnwwn','S': 'nnwnnnwwn','T': 'nnnnwnwwn',
    'U': 'wwnnnnnnw','V': 'nwwnnnnnw','W': 'wwwnnnnnn','X': 'nwnnwnnnw','Y': 'wwnnwnnnn',
    'Z': 'nwwnwnnnn','-': 'nwnnnnwnw','.': 'wwnnnnwnn',' ': 'nwwnnnwnn','$': 'nwnwnwnnn',
    '/': 'nwnwnnnwn','+': 'nwnnnwnwn','%': 'nnnwnwnwn','*': 'nwnnwnwnn'
  };

  const encoded = `*${value}*`;
  let pattern = '';
  encoded.split('').forEach((char) => {
    const symbol = patterns[char] || patterns[' '];
    symbol.split('').forEach((unit, index) => {
      const bar = index % 2 === 0;
      const width = unit === 'w' ? '111' : '1';
      pattern += bar ? width : '0'.repeat(width.length);
    });
    pattern += '0';
  });
  return pattern;
}

function drawBarcode(canvas, pattern, x, y, maxWidth, barHeight) {
  const activeModules = pattern.length;
  const scale = maxWidth / activeModules;
  const originX = x;

  pattern.split('').forEach((bit, index) => {
    const startX = originX + Math.round(index * scale);
    const endX = originX + Math.round((index + 1) * scale);
    const segmentWidth = Math.max(1, endX - startX);

    if (bit === '1') {
      fillRect(canvas, startX, y, segmentWidth, barHeight, 0);
    }
  });
}

function canvasToBmpBuffer(canvas) {
  const rowSize = Math.ceil((canvas.width * 3) / 4) * 4;
  const imageSize = rowSize * canvas.height;
  const fileSize = 54 + imageSize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write('BM', 0, 2, 'ascii');
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(canvas.width, 18);
  buffer.writeInt32LE(canvas.height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(imageSize, 34);

  let offset = 54;
  for (let y = canvas.height - 1; y >= 0; y -= 1) {
    const rowStart = y * canvas.width;
    for (let x = 0; x < canvas.width; x += 1) {
      const value = canvas.pixels[rowStart + x];
      buffer[offset++] = value;
      buffer[offset++] = value;
      buffer[offset++] = value;
    }
    while ((offset - 54) % rowSize !== 0) {
      buffer[offset++] = 0;
    }
  }

  return buffer;
}

function renderSheetBuffer({ product, quantity, config }) {
  const dpi = config.dpi || 203;
  const columns = config.columns || 2;
  const labelWidthPx = mmToPx(config.labelWidthMm, dpi);
  const labelHeightPx = mmToPx(config.labelHeightMm, dpi);
  const horizontalGapPx = mmToPx(config.horizontalGapMm || 0, dpi);
  const verticalGapPx = mmToPx(config.verticalGapMm || 0, dpi);
  const pageWidthPx = mmToPx(config.pageWidthMm, dpi);
  const rows = Math.max(1, Math.ceil(quantity / columns));
  const pageHeightPx = (rows * labelHeightPx) + ((rows - 1) * verticalGapPx);
  const barcodeXOffsetPx = mmToPx(config.barcodeXOffsetMm || 4.2, dpi);
  const barcodeYOffsetPx = mmToPx(config.barcodeYOffsetMm || 3.9, dpi);
  const barcodeWidthPx = mmToPx(config.barcodeWidthMm || 25.3, dpi);
  const barcodeHeightPx = mmToPx(config.barcodeHeightMm || 11.2, dpi);
  const textTopGapPx = mmToPx(config.textTopGapMm || 1.6, dpi);

  const canvas = createCanvas(pageWidthPx, pageHeightPx);
  const barcode = resolveBarcodeSpec(product);
  const displayText = barcode.value || product.barcode || '';
  const pattern = barcode.format === 'ean_13'
    ? renderEan13Pattern(displayText)
    : barcode.format === 'ean_8'
      ? renderEan8Pattern(displayText)
      : renderCode39Pattern(displayText);

  for (let index = 0; index < quantity; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const originX = col * (labelWidthPx + horizontalGapPx);
    const originY = row * (labelHeightPx + verticalGapPx);
    drawBarcode(
      canvas,
      pattern,
      originX + barcodeXOffsetPx,
      originY + barcodeYOffsetPx,
      barcodeWidthPx,
      barcodeHeightPx
    );

    const maxChars = barcode.format === 'ean_13' ? 13 : barcode.format === 'ean_8' ? 8 : 18;
    const text = displayText.slice(0, maxChars);
    const scale = text.length >= 12 ? 1 : 2;
    const charSpacing = text.length >= 12 ? 0 : 1;
    const textWidth = (text.length * ((5 * scale) + charSpacing)) - charSpacing;
    const textBlockWidthPx = Math.max(textWidth, barcodeWidthPx);
    const textX = originX + barcodeXOffsetPx + Math.max(0, Math.floor((textBlockWidthPx - textWidth) / 2));
    const textY = originY + barcodeYOffsetPx + barcodeHeightPx + textTopGapPx;
    drawText(canvas, text, textX, textY, scale, charSpacing);
  }

  return {
    buffer: canvasToBmpBuffer(canvas),
    pageHeightMm: (pageHeightPx / dpi) * 25.4
  };
}

module.exports = {
  renderSheetBuffer
};
