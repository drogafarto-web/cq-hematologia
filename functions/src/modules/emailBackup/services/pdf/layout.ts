/**
 * Design tokens e helpers de layout A4 para o backup PDF.
 * Centraliza constantes e primitivas visuais reutilizáveis
 * (badges vetoriais, detecção de overflow, watermark de ambiente).
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Mapeamento de nomes de fontes — mutável por design.
 * `initPdfFonts(doc)` reatribui `regular`/`bold` para "HCQ-Regular"/"HCQ-Bold"
 * se os TTFs de Inter (ou equivalente) estiverem em `assets/fonts/`.
 * Caso contrário, mantém fallback para fontes embutidas do pdfkit (Helvetica).
 *
 * Consumidores devem usar `Fonts.regular`/`Fonts.bold`/`Fonts.mono` em vez
 * de strings literais — a referência do objeto é estável entre chamadas.
 */
export const Fonts: {
  regular: string;
  bold: string;
  mono: string;
  usingCustom: boolean;
} = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  mono: 'Courier',
  usingCustom: false,
};


/**
 * Resolve o caminho absoluto para um arquivo em `functions/assets/fonts/`.
 * Funciona tanto em dev (rodando de `src/` via ts-node) quanto em prod
 * (rodando de `lib/` compilado).
 */
function resolveFontPath(fileName: string): string {
  // __dirname em compilação: .../functions/lib/modules/emailBackup/services/pdf/
  // destino: .../functions/assets/fonts/<fileName>
  // Subir 5 níveis (pdf → services → emailBackup → modules → lib) = functions/
  return path.resolve(__dirname, '..', '..', '..', '..', '..', 'assets', 'fonts', fileName);
}

/**
 * Registra fontes custom no PDFDocument. Se os TTFs esperados estiverem
 * presentes em `functions/assets/fonts/`, usa Inter (ou equivalente);
 * senão, mantém Helvetica embutida. Idempotente por documento.
 *
 * Drop-in para upgrade: coloque Inter-Regular.ttf + Inter-Bold.ttf em
 * `functions/assets/fonts/` — e este gerador passa a usá-los sem
 * mudança de código.
 */
export function initPdfFonts(doc: PDFKit.PDFDocument): void {
  const candidates: Array<{ role: 'regular' | 'bold'; file: string; name: string }> = [
    { role: 'regular', file: 'Inter-Regular.ttf', name: 'HCQ-Regular' },
    { role: 'bold', file: 'Inter-Bold.ttf', name: 'HCQ-Bold' },
  ];

  let loadedAll = true;

  for (const c of candidates) {
    const full = resolveFontPath(c.file);
    if (!fs.existsSync(full)) {
      loadedAll = false;
      break;
    }
  }

  if (!loadedAll) {
    // Sem fontes custom — mantém fallback Helvetica
    Fonts.regular = 'Helvetica';
    Fonts.bold = 'Helvetica-Bold';
    Fonts.mono = 'Courier';
    Fonts.usingCustom = false;
    return;
  }

  for (const c of candidates) {
    const full = resolveFontPath(c.file);
    doc.registerFont(c.name, full);
    if (c.role === 'regular') Fonts.regular = c.name;
    else Fonts.bold = c.name;
  }
  Fonts.mono = 'Courier';
  Fonts.usingCustom = true;
}

export const COLOR = {
  bg: '#0d0d0d',
  surface: '#161616',
  border: '#2a2a2a',
  accent: '#3b82f6',
  accentWarm: '#f59e0b',
  danger: '#ef4444',
  success: '#22c55e',
  textPrimary: '#f4f4f5',
  textMuted: '#71717a',
  white: '#ffffff',
  rowAlt: '#1c1c1c',
  warningBg: '#3b2c0a',
  dangerBg: '#3b0f0f',
} as const;

export const PAGE = {
  margin: 40,
  width: 595.28,
  height: 841.89,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

export const FONT_SIZES = {
  h1: 22,
  h2: 16,
  h3: 13,
  h4: 11,
  body: 10,
  small: 9,
  micro: 7.5,
  table: 7,
  tableHead: 6.5,
} as const;

export const FOOTER_RESERVE = 45;

export function safeBottomY(): number {
  return PAGE.height - PAGE.margin - FOOTER_RESERVE;
}

export type AlertLevel = 'critical' | 'warning' | 'info';

/**
 * Desenha um badge circular vetorial (substitui emojis coloridos
 * que quebram com fonte Helvetica padrão do pdfkit / WinAnsi).
 * Retorna a largura total consumida (diâmetro + padding direito).
 */
export function drawAlertBadge(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  level: AlertLevel,
  radius = 4,
): number {
  const fill =
    level === 'critical' ? COLOR.danger : level === 'warning' ? COLOR.accentWarm : COLOR.accent;

  doc.save();
  doc.circle(x + radius, y + radius, radius).fill(fill);
  doc.restore();

  return radius * 2 + 6;
}

/**
 * Desenha um triângulo de aviso (⚠) vetorial, em posição (x, y),
 * com altura informada. Retorna largura consumida.
 */
export function drawWarningTriangle(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size = 10,
): number {
  const half = size / 2;
  doc.save();
  doc
    .moveTo(x + half, y)
    .lineTo(x + size, y + size)
    .lineTo(x, y + size)
    .closePath()
    .fill(COLOR.accentWarm);

  // "!" interior em branco para contraste
  doc
    .font(Fonts.bold)
    .fontSize(size * 0.7)
    .fillColor(COLOR.white)
    .text('!', x, y + size * 0.25, { width: size, align: 'center', lineBreak: false });
  doc.restore();

  return size + 4;
}

// ─── Environment detection ────────────────────────────────────────────────────

export type PdfEnvironment = 'production' | 'staging' | 'development' | 'test';

export function detectEnvironment(): PdfEnvironment {
  if (process.env.FUNCTIONS_EMULATOR === 'true') return 'development';
  if (process.env.NODE_ENV === 'test') return 'test';

  const explicit = (process.env.HCQ_ENVIRONMENT ?? process.env.ENVIRONMENT ?? '').toLowerCase();
  if (explicit === 'production' || explicit === 'prod') return 'production';
  if (explicit === 'staging' || explicit === 'stage') return 'staging';
  if (explicit === 'development' || explicit === 'dev') return 'development';
  if (explicit === 'test') return 'test';

  const projectId = (process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? '').toLowerCase();
  if (projectId.includes('staging') || projectId.includes('stage')) return 'staging';
  if (projectId.includes('dev')) return 'development';

  return 'production';
}

export function isNonProduction(env: PdfEnvironment = detectEnvironment()): boolean {
  return env !== 'production';
}

/**
 * Texto visível no watermark conforme ambiente.
 */
function watermarkLabel(env: PdfEnvironment): string {
  switch (env) {
    case 'staging':
      return 'HOMOLOGAÇÃO';
    case 'development':
      return 'DESENVOLVIMENTO';
    case 'test':
      return 'TESTE';
    default:
      return 'NÃO VÁLIDO';
  }
}

/**
 * Renderiza watermark diagonal "AMBIENTE DE TESTE" em páginas não-produtivas.
 * Idempotente: chame em cada página (via pageAdded listener) sem efeito colateral.
 */
export function renderEnvironmentWatermark(
  doc: PDFKit.PDFDocument,
  env: PdfEnvironment = detectEnvironment(),
): void {
  if (env === 'production') return;

  const label = watermarkLabel(env);
  const cx = PAGE.width / 2;
  const cy = PAGE.height / 2;

  doc.save();
  doc
    .fillOpacity(0.07)
    .fillColor(COLOR.danger)
    .font(Fonts.bold)
    .fontSize(68)
    .rotate(-30, { origin: [cx, cy] })
    .text(label, 0, cy - 40, {
      width: PAGE.width,
      align: 'center',
      lineBreak: false,
    });
  doc.restore();
}

/**
 * Banner horizontal de topo para a capa, indicando ambiente não-produtivo.
 * Retorna a altura consumida (0 se ambiente for produção).
 */
export function renderEnvironmentBanner(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  env: PdfEnvironment = detectEnvironment(),
): number {
  if (env === 'production') return 0;

  const height = 24;
  const label = watermarkLabel(env);

  doc.save();
  doc.rect(x, y, width, height).fill(COLOR.danger);
  doc
    .font(Fonts.bold)
    .fontSize(9)
    .fillColor(COLOR.white)
    .text(
      `DOCUMENTO DE ${label} — Dados não válidos para auditoria sanitária`,
      x,
      y + 8,
      { width, align: 'center', lineBreak: false },
    );
  doc.restore();

  return height + 8;
}

/**
 * Sufixo visual a anexar ao hash SHA-256 em ambientes não-produtivos.
 * Em produção retorna string vazia.
 */
export function environmentHashPrefix(env: PdfEnvironment = detectEnvironment()): string {
  return env === 'production' ? '' : `[${watermarkLabel(env)}] `;
}
