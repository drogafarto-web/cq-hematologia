/**
 * Preview manual do backup PDF para inspeção visual antes de release.
 *
 * Uso:
 *   node scripts/preview-backup-pdf.mjs                         (produção, sem watermark)
 *   HCQ_ENVIRONMENT=staging node scripts/preview-backup-pdf.mjs (watermark HOMOLOGAÇÃO)
 *   FULL=1 MULTI=1 node scripts/preview-backup-pdf.mjs          (cenário completo)
 *   LARGE=1 node scripts/preview-backup-pdf.mjs                 (40 corridas p/ paginação)
 *   OPEN=1 node scripts/preview-backup-pdf.mjs                  (abre no visualizador)
 *
 * Requer que `functions/lib/` esteja compilado (rode `npm run build` antes).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { makeReport } from '../test/emailBackup/fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, '..');

const { generateBackupPdf, computeContentHash } = await import(
  pathToFileURL(path.join(FUNCTIONS_DIR, 'lib/modules/emailBackup/services/pdfService.js')).href
);

const opts = {
  full: process.env.FULL === '1',
  multi: process.env.MULTI === '1',
  runCount: process.env.LARGE === '1' ? 40 : 10,
};

const baseReport = makeReport(opts);
const report = { ...baseReport, contentHash: computeContentHash(baseReport) };

const buffer = await generateBackupPdf(report);

const tmpDir = path.join(FUNCTIONS_DIR, 'tmp');
mkdirSync(tmpDir, { recursive: true });
const outPath = path.join(tmpDir, `backup-${process.env.HCQ_ENVIRONMENT ?? 'prod'}.pdf`);
writeFileSync(outPath, buffer);

console.log(`Gerado: ${outPath} (${buffer.length.toLocaleString('pt-BR')} bytes)`);
console.log(`  Hash:  ${report.contentHash}`);
console.log(
  `  Cenário: full=${opts.full} · multi=${opts.multi} · runs=${opts.runCount} · env=${process.env.HCQ_ENVIRONMENT ?? 'prod'}`,
);

if (process.env.OPEN === '1') {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', outPath], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [outPath], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [outPath], { detached: true, stdio: 'ignore' }).unref();
  }
}
