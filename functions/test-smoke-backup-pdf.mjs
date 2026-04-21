/**
 * Smoke render do backup PDF — Sprint 1.
 * Não é um teste automatizado; gera um arquivo para inspeção visual.
 *
 *   node test-smoke-backup-pdf.mjs           (ambiente = production, sem watermark)
 *   HCQ_ENVIRONMENT=staging node ...         (watermark HOMOLOGAÇÃO)
 *   HCQ_ENVIRONMENT=development node ...     (watermark DESENVOLVIMENTO)
 */

import { writeFileSync } from 'fs';
import path from 'path';

const { generateBackupPdf, computeContentHash } = await import(
  './lib/modules/emailBackup/services/pdfService.js'
);

const periodStart = new Date('2026-03-20T00:00:00Z');
const periodEnd = new Date('2026-04-19T23:59:59Z');
const generatedAt = '2026-04-19T23:25:52-03:00';

const FULL = process.env.FULL === '1';

const row = (code, tipo, loteControle, loteReagente, operador, assinatura) => ({
  Código: code,
  Data: '15/04/2026 20:34',
  'Tipo de Teste': tipo,
  'Lote Controle': loteControle,
  'Lote Reagente': loteReagente,
  'Reg. ANVISA': FULL ? '10373480095' : '—',
  Esperado: 'Reagente',
  Obtido: 'Reagente',
  Conformidade: 'Conforme',
  'Ação Corretiva': '—',
  Alertas: '—',
  Equipamento: FULL ? 'Bio-Rad Alinity i' : '—',
  Operador: FULL ? 'Dra. Maria da Silva' : 'Área Técnica LabClin',
  Registro: FULL ? 'CRBM-MG 1234' : '—',
  Cargo: 'biomedico',
  Assinatura: assinatura,
});

const LARGE = process.env.LARGE === '1';
const baseRows = [
  row('CI-2026-0005', 'Anti-HCV', '0e911203', '95k001', 'Área Técnica LabClin', 'a8c3b0375187…'),
  row('CI-2026-0002', 'HIV', '06222025', '24H049C', 'Área Técnica LabClin', '0273695e0fe1…'),
  row('CI-2026-0003', 'HBsAg', '0e45019', '94H040C', 'Área Técnica LabClin', 'be47bfcbef71…'),
  row('CI-2026-0006', 'Anti-HCV', '04112034', '95k001', 'Área Técnica LabClin', '36bcd14cdbe2…'),
  row('CI-2026-0007', 'Anti-HCV', '04112034', '95k001', 'Área Técnica LabClin', 'd14d6e138965…'),
  row('CI-2026-0001', 'HIV', '06482891', '24H049C', 'Área Técnica LabClin', 'a7d4b6771d44…'),
  row('CI-2026-0004', 'HBsAg', '0e2b022', '94H040C', 'Área Técnica LabClin', '1984e69d23ea…'),
  row('CI-2026-0008', 'Sífilis', '06583009', '95L08', 'Área Técnica LabClin', 'b1c4e87cb193…'),
  row('CI-2026-0009', 'Sífilis', '06583009', '95L08', 'Área Técnica LabClin', '53bbc7857baa…'),
  row('CI-2026-0010', 'Sífilis', '06583009', '95L08', 'Área Técnica LabClin', '219553613387…'),
];

const expandedRows = LARGE
  ? Array.from({ length: 40 }, (_, i) => {
      const src = baseRows[i % baseRows.length];
      return {
        ...src,
        Código: `CI-2026-${String(i + 1).padStart(4, '0')}`,
        Conformidade: i % 15 === 0 ? 'NÃO CONFORME' : 'Conforme',
      };
    })
  : baseRows;

// MULTI=1 adiciona um segundo módulo (Hematologia sintético) para validar
// o sumário da capa e navegação entre múltiplos módulos.
const MULTI = process.env.MULTI === '1';

const hematologiaSection = {
  moduleId: 'hematologia',
  moduleName: 'Hematologia (CIQ Quantitativo)',
  lastRunDate: '2026-04-18',
  totalRuns: 18,
  nonConformingRuns: 1,
  columns: [
    'Data',
    'Lote',
    'Nível',
    'Equipamento',
    'Status',
    'Westgard',
    'IA editado',
    'Operador',
    'Registro',
    'Cargo',
    'Assinatura',
  ],
  rows: Array.from({ length: 18 }, (_, i) => ({
    Data: `${String(i + 1).padStart(2, '0')}/04/2026 09:${String(10 + i).padStart(2, '0')}`,
    Lote: 'L9934',
    Nível: String((i % 3) + 1),
    Equipamento: FULL ? 'Sysmex XN-1000' : '—',
    Status: i === 5 ? 'Rejeitada' : 'Aprovada',
    Westgard: i === 5 ? '1-3s' : '—',
    'IA editado': 'Não',
    Operador: FULL ? 'Dra. Maria da Silva' : '—',
    Registro: FULL ? 'CRBM-MG 1234' : '—',
    Cargo: 'biomedico',
    Assinatura: `h${String(i).padStart(2, '0')}3f8a2c1b9d7e`,
  })),
  summary: {
    'Total de corridas': '18',
    Aprovadas: '17',
    Rejeitadas: '1',
    Pendentes: '0',
    'Taxa de aprovação': '94.4%',
    'Operadores distintos': '1',
    'Lotes cobertos': '1',
  },
  tableLayout: {
    primary: [
      { key: 'Data', shortLabel: 'Data', weight: 1.3 },
      { key: 'Lote', shortLabel: 'Lote', weight: 1.2 },
      { key: 'Nível', shortLabel: 'Nível', weight: 0.8, align: 'center' },
      { key: 'Status', shortLabel: 'Status', weight: 1.1 },
      { key: 'Westgard', shortLabel: 'Westgard', weight: 1.4 },
      { key: 'IA editado', shortLabel: 'IA', weight: 0.7, align: 'center' },
    ],
    secondary: [
      { key: 'Equipamento', shortLabel: 'Eq.' },
      { key: 'Operador', shortLabel: 'Op.' },
      { key: 'Registro', shortLabel: 'Reg.' },
      { key: 'Cargo', shortLabel: 'Cargo' },
      { key: 'Assinatura', shortLabel: 'Sig', monospace: true },
    ],
  },
};

const sections = [
  ...(MULTI ? [hematologiaSection] : []),
  {
    moduleId: 'imunologia',
    moduleName: 'Imunologia — CIQ-Imuno (RDC 978/2025)',
    lastRunDate: '2026-04-15',
    totalRuns: expandedRows.length,
    nonConformingRuns: expandedRows.filter((r) => r.Conformidade === 'NÃO CONFORME').length,
    columns: [
      'Código',
      'Data',
      'Tipo de Teste',
      'Lote Controle',
      'Lote Reagente',
      'Reg. ANVISA',
      'Esperado',
      'Obtido',
      'Conformidade',
      'Ação Corretiva',
      'Alertas',
      'Equipamento',
      'Operador',
      'Cargo',
      'Assinatura',
    ],
    rows: expandedRows,
    summary: {
      'Total de corridas': '10',
      Conformes: '10',
      'Não conformes': '0',
      'Taxa de conformidade': '100.0%',
      'Tipos de teste': 'Anti-HCV, HIV, HBsAg, Sífilis',
      'Operadores distintos': '1',
      'Lotes cobertos': '7',
    },
    tableLayout: {
      primary: [
        { key: 'Código', shortLabel: 'Código', weight: 1.3 },
        { key: 'Data', shortLabel: 'Data', weight: 1.3 },
        { key: 'Tipo de Teste', shortLabel: 'Tipo', weight: 1.0 },
        { key: 'Lote Controle', shortLabel: 'Lote Ctrl', weight: 1.1 },
        { key: 'Lote Reagente', shortLabel: 'Lote Reag.', weight: 1.1 },
        { key: 'Reg. ANVISA', shortLabel: 'Reg. ANVISA', weight: 1.0 },
        { key: 'Esperado', shortLabel: 'Esperado', weight: 1.1 },
        { key: 'Obtido', shortLabel: 'Obtido', weight: 1.1 },
        { key: 'Conformidade', shortLabel: 'Conform.', weight: 1.0 },
      ],
      secondary: [
        { key: 'Equipamento', shortLabel: 'Eq.' },
        { key: 'Operador', shortLabel: 'Op.' },
        { key: 'Registro', shortLabel: 'Reg.' },
        { key: 'Cargo', shortLabel: 'Cargo' },
        { key: 'Ação Corretiva', shortLabel: 'Ação' },
        { key: 'Alertas', shortLabel: 'Alertas' },
        { key: 'Assinatura', shortLabel: 'Sig', monospace: true },
      ],
    },
  },
];

const stalenessAlerts = [
  {
    moduleId: 'hematologia',
    moduleName: 'Hematologia (CIQ Quantitativo)',
    daysSinceLastRun: Infinity,
    level: 'critical',
    lastRunAt: null,
  },
  {
    moduleId: 'imunologia',
    moduleName: 'Imunologia — CIQ-Imuno (RDC 978/2025)',
    daysSinceLastRun: 4,
    level: 'warning',
    lastRunAt: '2026-04-15T20:34:00-03:00',
  },
];

const baseReport = {
  labId: 'labclin-riopomba',
  labName: 'LabClin Rio Pomba MG',
  // FULL=1 povoa todos os campos regulatórios; default deixa vazios para
  // demonstrar o destaque de gaps (danger em vermelho) no PDF.
  labCnpj: FULL ? '12.345.678/0001-90' : undefined,
  labAddress: FULL
    ? 'Rua São Sebastião, 123 — Centro — Rio Pomba/MG — CEP 36180-000'
    : undefined,
  responsibleTech: FULL
    ? { name: 'Dra. Maria da Silva', registration: 'CRBM-MG 1234' }
    : undefined,
  sanitaryLicense: FULL
    ? { number: '012345/2026', validUntil: '31/12/2026' }
    : undefined,
  periodStart,
  periodEnd,
  sections,
  stalenessAlerts,
  generatedAt,
};

const report = {
  ...baseReport,
  contentHash: computeContentHash(baseReport),
};

const buffer = await generateBackupPdf(report);
const out = path.resolve(`./smoke-backup-${process.env.HCQ_ENVIRONMENT ?? 'prod'}.pdf`);
writeFileSync(out, buffer);
console.log(`Gerado: ${out} (${buffer.length} bytes)`);
