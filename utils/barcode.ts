import type { BarcodeDetector as PonyfillDetector, BarcodeFormat } from 'barcode-detector/ponyfill';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

/** Product barcodes on food packaging */
const FORMATS: BarcodeFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

type Detector = Pick<PonyfillDetector, 'detect'>;
type DetectorClass = { new (options: { formats: BarcodeFormat[] }): Detector; getSupportedFormats(): Promise<readonly string[]> };

let detector: Promise<Detector> | null = null;

/**
 * The browser's own BarcodeDetector where it reads product barcodes (Chrome on Android),
 * otherwise the zxing-wasm ponyfill (Safari, Firefox). The .wasm is served by the app rather
 * than the library's default CDN, so scanning also works offline.
 */
export const getBarcodeDetector = (): Promise<Detector> => {
  detector ??= (async () => {
    const Native = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        const formats = FORMATS.filter(f => supported.includes(f));
        if (formats.length) return new Native({ formats });
      } catch { /* fall through to the ponyfill */ }
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path) },
    });
    return new BarcodeDetector({ formats: FORMATS });
  })();
  detector.catch(() => { detector = null; });
  return detector;
};

/** Digits only, the length of an EAN-8, UPC or EAN-13 code */
export const isProductBarcode = (code: string) => /^\d{8}$|^\d{12,14}$/.test(code);
