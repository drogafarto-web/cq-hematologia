/**
 * QR Code generator for laudo validation
 *
 * Generates a Data URL embeddable in the laudo PDF.
 * The QR encodes a URL pointing to the public validation endpoint
 * (validarLaudoPublico HTTPS function), where third parties (auditors,
 * patients, médicos) can verify the laudo's hash + version + RT signature
 * without seeing PII.
 *
 * Error correction level 'M' chosen as the balance between density and
 * tolerance to crumpled prints (RDC 978 reports often photocopied).
 */
import * as QRCode from 'qrcode';

export interface QRCodeOptions {
  /**
   * Logical width (pixels) of the QR rendered into the PDF.
   * 120 → reads from ~25cm in normal lighting.
   */
  width?: number;
  /**
   * Margin (in modules — i.e. QR pixels). Default 1 keeps the QR compact;
   * the PDF template provides whitespace around it via CSS.
   */
  margin?: number;
}

/**
 * Default base URL used when no override is provided. Pointing to
 * `hmatologia2.web.app` is correct for the prod project; CI/staging
 * should pass an explicit override when needed.
 */
export const DEFAULT_VALIDATION_BASE = 'https://hmatologia2.web.app';

/**
 * Build the public validation URL for a given laudo + version.
 * The `h` query param carries the first 8 hex chars of the chainHash —
 * a CRC-style visual check, NOT an authentication factor.
 */
export function buildValidationUrl(params: {
  laudoId: string;
  version: number;
  chainHash: string;
  baseUrl?: string;
}): string {
  const base = params.baseUrl ?? DEFAULT_VALIDATION_BASE;
  const hashPrefix = params.chainHash.slice(0, 8);
  return `${base}/api/validar-laudo/${encodeURIComponent(params.laudoId)}/v${params.version}?h=${hashPrefix}`;
}

/**
 * Render a QR Code (PNG data-url) for the validation URL.
 * Returns `data:image/png;base64,...` ready to embed in <img src=...>.
 */
export async function generateQRCodeDataUrl(
  url: string,
  options: QRCodeOptions = {},
): Promise<string> {
  const { width = 120, margin = 1 } = options;

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width,
    margin,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
