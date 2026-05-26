const BarcodeTools = (() => {
    const DEFAULT_LABEL_LAYOUT = {
        columns: 2,
        labelWidthMm: 32,
        labelHeightMm: 25,
        gapMm: 1.5,
        pagePaddingMm: 1.5
    };

    const CODE39_PATTERNS = {
        '0': 'nnnwwnwnn',
        '1': 'wnnwnnnnw',
        '2': 'nnwwnnnnw',
        '3': 'wnwwnnnnn',
        '4': 'nnnwwnnnw',
        '5': 'wnnwwnnnn',
        '6': 'nnwwwnnnn',
        '7': 'nnnwnnwnw',
        '8': 'wnnwnnwnn',
        '9': 'nnwwnnwnn',
        'A': 'wnnnnwnnw',
        'B': 'nnwnnwnnw',
        'C': 'wnwnnwnnn',
        'D': 'nnnnwwnnw',
        'E': 'wnnnwwnnn',
        'F': 'nnwnwwnnn',
        'G': 'nnnnnwwnw',
        'H': 'wnnnnwwnn',
        'I': 'nnwnnwwnn',
        'J': 'nnnnwwwnn',
        'K': 'wnnnnnnww',
        'L': 'nnwnnnnww',
        'M': 'wnwnnnnwn',
        'N': 'nnnnwnnww',
        'O': 'wnnnwnnwn',
        'P': 'nnwnwnnwn',
        'Q': 'nnnnnnwww',
        'R': 'wnnnnnwwn',
        'S': 'nnwnnnwwn',
        'T': 'nnnnwnwwn',
        'U': 'wwnnnnnnw',
        'V': 'nwwnnnnnw',
        'W': 'wwwnnnnnn',
        'X': 'nwnnwnnnw',
        'Y': 'wwnnwnnnn',
        'Z': 'nwwnwnnnn',
        '-': 'nwnnnnwnw',
        '.': 'wwnnnnwnn',
        ' ': 'nwwnnnwnn',
        '$': 'nwnwnwnnn',
        '/': 'nwnwnnnwn',
        '+': 'nwnnnwnwn',
        '%': 'nnnwnwnwn',
        '*': 'nwnnwnwnn'
    };

    const scannerState = {
        stream: null,
        interval: null,
        onDetected: null
    };

    function escapeHtml(text) {
        return String(text || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function normalizeCode(value = '') {
        return String(value || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/[^A-Z0-9\-\.\ $\/\+%]/g, '');
    }

    function normalizeDigits(value = '') {
        return String(value || '').replace(/\D/g, '');
    }

    function computeEan8CheckDigit(value = '') {
        const digits = normalizeDigits(value);
        if (!/^\d{7}$/.test(digits)) {
            return null;
        }

        const sum = digits
            .split('')
            .map(Number)
            .reduce((acc, digit, index) => acc + (index % 2 === 0 ? digit * 3 : digit), 0);

        return String((10 - (sum % 10)) % 10);
    }

    function resolveEan8Value(value = '') {
        const digits = normalizeDigits(value);
        if (/^\d{8}$/.test(digits)) {
            return digits;
        }

        if (/^\d{7}$/.test(digits)) {
            const checkDigit = computeEan8CheckDigit(digits);
            return checkDigit === null ? '' : `${digits}${checkDigit}`;
        }

        return '';
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

    function resolveEan13Value(value = '') {
        const digits = normalizeDigits(value);
        if (/^\d{13}$/.test(digits)) {
            return digits;
        }

        if (/^\d{12}$/.test(digits)) {
            const checkDigit = computeEan13CheckDigit(digits);
            return checkDigit === null ? '' : `${digits}${checkDigit}`;
        }

        return '';
    }

    function renderCode39Svg(value, options = {}) {
        const normalized = normalizeCode(value);
        if (!normalized) return '';

        const encoded = `*${normalized}*`;
        const narrow = options.narrow || 3;
        const wide = options.wide || 8;
        const barHeight = options.height || 72;
        const gap = options.gap || 3;
        const quietZone = options.quietZone || 16;

        let width = quietZone * 2;
        for (const char of encoded) {
            const pattern = CODE39_PATTERNS[char];
            if (!pattern) continue;
            for (const symbol of pattern) {
                width += symbol === 'w' ? wide : narrow;
            }
            width += gap;
        }

        let x = quietZone;
        const bars = [];
        for (const char of encoded) {
            const pattern = CODE39_PATTERNS[char];
            if (!pattern) continue;

            pattern.split('').forEach((symbol, index) => {
                const segmentWidth = symbol === 'w' ? wide : narrow;
                if (index % 2 === 0) {
                    bars.push(`<rect x="${x}" y="0" width="${segmentWidth}" height="${barHeight}" fill="#111827" />`);
                }
                x += segmentWidth;
            });
            x += gap;
        }

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight}" viewBox="0 0 ${width} ${barHeight}" role="img" aria-label="Código ${escapeHtml(normalized)}">
                <rect width="${width}" height="${barHeight}" fill="#ffffff"></rect>
                ${bars.join('')}
            </svg>
        `;
    }

    function renderEan8Svg(value, options = {}) {
        const encodedValue = resolveEan8Value(value);
        if (!encodedValue) {
            return '';
        }

        const L_CODES = {
            '0': '0001101',
            '1': '0011001',
            '2': '0010011',
            '3': '0111101',
            '4': '0100011',
            '5': '0110001',
            '6': '0101111',
            '7': '0111011',
            '8': '0110111',
            '9': '0001011'
        };

        const R_CODES = {
            '0': '1110010',
            '1': '1100110',
            '2': '1101100',
            '3': '1000010',
            '4': '1011100',
            '5': '1001110',
            '6': '1010000',
            '7': '1000100',
            '8': '1001000',
            '9': '1110100'
        };

        const moduleWidth = options.moduleWidth || 2.1;
        const barHeight = options.height || 68;
        const quietZone = options.quietZone || 12;

        const leftDigits = encodedValue.slice(0, 4).split('');
        const rightDigits = encodedValue.slice(4).split('');
        const leftPattern = leftDigits.map(digit => L_CODES[digit]).join('');
        const rightPattern = rightDigits.map(digit => R_CODES[digit]).join('');
        const pattern = `101${leftPattern}01010${rightPattern}101`;
        const width = (pattern.length * moduleWidth) + (quietZone * 2);

        let x = quietZone;
        const bars = [];
        pattern.split('').forEach(bit => {
            if (bit === '1') {
                bars.push(`<rect x="${x}" y="0" width="${moduleWidth}" height="${barHeight}" fill="#111827" />`);
            }
            x += moduleWidth;
        });

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight}" viewBox="0 0 ${width} ${barHeight}" role="img" aria-label="Código EAN-8 ${escapeHtml(encodedValue)}">
                <rect width="${width}" height="${barHeight}" fill="#ffffff"></rect>
                ${bars.join('')}
            </svg>
        `;
    }

    function renderEan13Svg(value, options = {}) {
        const encodedValue = resolveEan13Value(value);
        if (!encodedValue) {
            return '';
        }

        const L_CODES = {
            '0': '0001101',
            '1': '0011001',
            '2': '0010011',
            '3': '0111101',
            '4': '0100011',
            '5': '0110001',
            '6': '0101111',
            '7': '0111011',
            '8': '0110111',
            '9': '0001011'
        };

        const G_CODES = {
            '0': '0100111',
            '1': '0110011',
            '2': '0011011',
            '3': '0100001',
            '4': '0011101',
            '5': '0111001',
            '6': '0000101',
            '7': '0010001',
            '8': '0001001',
            '9': '0010111'
        };

        const R_CODES = {
            '0': '1110010',
            '1': '1100110',
            '2': '1101100',
            '3': '1000010',
            '4': '1011100',
            '5': '1001110',
            '6': '1010000',
            '7': '1000100',
            '8': '1001000',
            '9': '1110100'
        };

        const PARITY = {
            '0': 'LLLLLL',
            '1': 'LLGLGG',
            '2': 'LLGGLG',
            '3': 'LLGGGL',
            '4': 'LGLLGG',
            '5': 'LGGLLG',
            '6': 'LGGGLL',
            '7': 'LGLGLG',
            '8': 'LGLGGL',
            '9': 'LGGLGL'
        };

        const moduleWidth = options.moduleWidth || 1.35;
        const barHeight = options.height || 70;
        const quietZone = options.quietZone || 11;

        const firstDigit = encodedValue[0];
        const leftDigits = encodedValue.slice(1, 7).split('');
        const rightDigits = encodedValue.slice(7).split('');
        const parityPattern = PARITY[firstDigit] || PARITY['0'];
        const leftPattern = leftDigits.map((digit, index) => {
            const parity = parityPattern[index];
            return parity === 'G' ? G_CODES[digit] : L_CODES[digit];
        }).join('');
        const rightPattern = rightDigits.map(digit => R_CODES[digit]).join('');
        const pattern = `101${leftPattern}01010${rightPattern}101`;
        const width = (pattern.length * moduleWidth) + (quietZone * 2);

        let x = quietZone;
        const bars = [];
        pattern.split('').forEach(bit => {
            if (bit === '1') {
                bars.push(`<rect x="${x}" y="0" width="${moduleWidth}" height="${barHeight}" fill="#111827" />`);
            }
            x += moduleWidth;
        });

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight}" viewBox="0 0 ${width} ${barHeight}" role="img" aria-label="Código EAN-13 ${escapeHtml(encodedValue)}">
                <rect width="${width}" height="${barHeight}" fill="#ffffff"></rect>
                ${bars.join('')}
            </svg>
        `;
    }

    function resolveBarcodeForPrint(product = {}) {
        const rawValue = String(product.barcode || '');
        const format = String(product.barcodeFormat || '').toLowerCase();
        const digits = normalizeDigits(rawValue);

        if (format === 'ean_13' || (/^\d{12,13}$/.test(digits) && !format)) {
            const ean13 = resolveEan13Value(rawValue);
            return {
                svg: renderEan13Svg(ean13),
                displayValue: ean13 || rawValue,
                formatLabel: 'EAN-13'
            };
        }

        if (format === 'ean_8' || (/^\d{7,8}$/.test(digits) && !format)) {
            const ean8 = resolveEan8Value(rawValue);
            return {
                svg: renderEan8Svg(ean8),
                displayValue: ean8 || rawValue,
                formatLabel: 'EAN-8'
            };
        }

        return {
            svg: renderCode39Svg(rawValue),
            displayValue: normalizeCode(rawValue),
            formatLabel: (product.barcodeFormat || 'CODE_39').toUpperCase()
        };
    }

    function buildLabelsMarkup(product, quantity = 1, layoutOptions = {}) {
        const safeQuantity = Math.max(1, parseInt(quantity, 10) || 1);
        const layout = {
            ...DEFAULT_LABEL_LAYOUT,
            ...(layoutOptions || {})
        };
        const barcode = resolveBarcodeForPrint(product);
        const pageWidthMm = (layout.columns * layout.labelWidthMm)
            + ((layout.columns - 1) * layout.gapMm)
            + (layout.pagePaddingMm * 2);
        const labels = Array.from({ length: safeQuantity }, () => `
            <div class="barcode-label">
                <div class="barcode-svg">${barcode.svg}</div>
                <div class="barcode-code">${escapeHtml(barcode.displayValue || product.barcode || '')}</div>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Etiquetas - ${escapeHtml(product.name || 'Producto')}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: ${layout.pagePaddingMm}mm;
                        background: #fff;
                        color: #111827;
                    }
                    .labels-grid {
                        display: grid;
                        grid-template-columns: repeat(${layout.columns}, ${layout.labelWidthMm}mm);
                        gap: ${layout.gapMm}mm;
                        width: ${pageWidthMm}mm;
                    }
                    .barcode-label {
                        width: ${layout.labelWidthMm}mm;
                        height: ${layout.labelHeightMm}mm;
                        box-sizing: border-box;
                        padding: 1.4mm 1.8mm 1.2mm;
                        break-inside: avoid;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        overflow: hidden;
                    }
                    .barcode-svg {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        margin: 0;
                        min-height: 11.5mm;
                        width: 100%;
                    }
                    .barcode-svg svg {
                        width: 100%;
                        height: auto;
                        max-height: 11.5mm;
                    }
                    .barcode-code {
                        text-align: center;
                        font-size: 8pt;
                        font-weight: 700;
                        letter-spacing: 0.3px;
                        margin-top: 1.2mm;
                        line-height: 1.1;
                    }
                    @media print {
                        @page {
                            size: ${pageWidthMm}mm auto;
                            margin: 0;
                        }
                        body {
                            padding: ${layout.pagePaddingMm}mm;
                        }
                        .barcode-label {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="labels-grid">${labels}</div>
                <script>
                    window.onload = function () {
                        setTimeout(function () {
                            window.print();
                        }, 200);
                    };
                <\/script>
            </body>
            </html>
        `;
    }

    function printLabels(product, quantity = 1, targetWindow = null, layoutOptions = {}) {
        const win = targetWindow || window.open('', '_blank', 'width=960,height=720');
        if (!win) {
            throw new Error('El navegador bloqueó la ventana de impresión');
        }

        win.document.open();
        win.document.write(buildLabelsMarkup(product, quantity, layoutOptions));
        win.document.close();
        return win;
    }

    function ensureScannerModal() {
        let modal = document.getElementById('barcodeScannerModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'barcodeScannerModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content barcode-scanner-modal">
                <span class="close" onclick="BarcodeTools.closeScanner()">&times;</span>
                <h2 id="barcodeScannerTitle">Escanear código</h2>
                <div class="barcode-scanner-box">
                    <video id="barcodeScannerVideo" autoplay playsinline muted></video>
                    <div class="barcode-scan-line"></div>
                </div>
                <p class="barcode-scanner-help">Apunta la cámara al código de barras.</p>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="BarcodeTools.closeScanner()">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    async function openScanner({ title = 'Escanear código', onDetected }) {
        if (!('BarcodeDetector' in window)) {
            throw new Error('Tu navegador no soporta escáner por cámara. Usa Chrome actualizado.');
        }

        const modal = ensureScannerModal();
        const titleEl = document.getElementById('barcodeScannerTitle');
        const video = document.getElementById('barcodeScannerVideo');
        titleEl.textContent = title;
        modal.classList.add('show');

        scannerState.onDetected = onDetected;
        scannerState.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = scannerState.stream;

        const detector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
        });

        scannerState.interval = setInterval(async () => {
            if (video.readyState < 2) return;
            try {
                const matches = await detector.detect(video);
                if (!matches.length) return;

                const code = matches[0].rawValue;
                closeScanner();
                if (typeof scannerState.onDetected === 'function') {
                    await scannerState.onDetected(code);
                }
            } catch (error) {
                console.error('Error leyendo código de barras:', error);
            }
        }, 350);
    }

    function closeScanner() {
        if (scannerState.interval) {
            clearInterval(scannerState.interval);
            scannerState.interval = null;
        }

        if (scannerState.stream) {
            scannerState.stream.getTracks().forEach(track => track.stop());
            scannerState.stream = null;
        }

        const video = document.getElementById('barcodeScannerVideo');
        if (video) video.srcObject = null;

        const modal = document.getElementById('barcodeScannerModal');
        if (modal) modal.classList.remove('show');
    }

    return {
        normalizeCode,
        renderCode39Svg,
        printLabels,
        openScanner,
        closeScanner
    };
})();

window.BarcodeTools = BarcodeTools;
