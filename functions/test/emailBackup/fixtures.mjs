/**
 * Fixtures determinísticas para o gerador de backup PDF.
 *
 * Usadas tanto pelo preview manual (scripts/preview-backup-pdf.mjs) quanto
 * pelos testes automatizados (test/emailBackup/pdfService.test.mjs).
 *
 * Timestamps, IDs e hashes são fixos por design — permite comparar output
 * entre execuções sem depender de relógio ou estado global.
 */

const FIXED_PERIOD_START = new Date('2026-03-20T00:00:00Z');
const FIXED_PERIOD_END = new Date('2026-04-19T23:59:59Z');
const FIXED_GENERATED_AT = '2026-04-19T23:25:52-03:00';

const imunoPrimary = [
  { key: 'Código', shortLabel: 'Código', weight: 1.3 },
  { key: 'Data', shortLabel: 'Data', weight: 1.3 },
  { key: 'Tipo de Teste', shortLabel: 'Tipo', weight: 1.0 },
  { key: 'Lote Controle', shortLabel: 'Lote Ctrl', weight: 1.1 },
  { key: 'Lote Reagente', shortLabel: 'Lote Reag.', weight: 1.1 },
  { key: 'Reg. ANVISA', shortLabel: 'Reg. ANVISA', weight: 1.0 },
  { key: 'Esperado', shortLabel: 'Esperado', weight: 1.1 },
  { key: 'Obtido', shortLabel: 'Obtido', weight: 1.1 },
  { key: 'Conformidade', shortLabel: 'Conform.', weight: 1.0 },
];

const imunoSecondary = [
  { key: 'Equipamento', shortLabel: 'Eq.' },
  { key: 'Operador', shortLabel: 'Op.' },
  { key: 'Registro', shortLabel: 'Reg.' },
  { key: 'Cargo', shortLabel: 'Cargo' },
  { key: 'Ação Corretiva', shortLabel: 'Ação' },
  { key: 'Alertas', shortLabel: 'Alertas' },
  { key: 'Assinatura', shortLabel: 'Sig', monospace: true },
];

const hemaPrimary = [
  { key: 'Data', shortLabel: 'Data', weight: 1.3 },
  { key: 'Lote', shortLabel: 'Lote', weight: 1.2 },
  { key: 'Nível', shortLabel: 'Nível', weight: 0.8, align: 'center' },
  { key: 'Status', shortLabel: 'Status', weight: 1.1 },
  { key: 'Westgard', shortLabel: 'Westgard', weight: 1.4 },
  { key: 'IA editado', shortLabel: 'IA', weight: 0.7, align: 'center' },
];

const hemaSecondary = [
  { key: 'Equipamento', shortLabel: 'Eq.' },
  { key: 'Operador', shortLabel: 'Op.' },
  { key: 'Registro', shortLabel: 'Reg.' },
  { key: 'Cargo', shortLabel: 'Cargo' },
  { key: 'Assinatura', shortLabel: 'Sig', monospace: true },
];

function makeImunoRow(i, { full }) {
  const code = `CI-2026-${String(i + 1).padStart(4, '0')}`;
  const types = ['Anti-HCV', 'HIV', 'HBsAg', 'Sífilis'];
  const tipo = types[i % types.length];
  const loteControle = ['0e911203', '06222025', '0e45019', '06583009'][i % 4];
  const loteReagente = ['95k001', '24H049C', '94H040C', '95L08'][i % 4];

  return {
    Código: code,
    Data: '15/04/2026 20:34',
    'Tipo de Teste': tipo,
    'Lote Controle': loteControle,
    'Lote Reagente': loteReagente,
    'Reg. ANVISA': full ? '10373480095' : '—',
    Esperado: 'Reagente',
    Obtido: 'Reagente',
    Conformidade: i % 15 === 0 && i > 0 ? 'NÃO CONFORME' : 'Conforme',
    'Ação Corretiva': '—',
    Alertas: '—',
    Equipamento: full ? 'Bio-Rad Alinity i' : '—',
    Operador: full ? 'Dra. Maria da Silva' : 'Área Técnica LabClin',
    Registro: full ? 'CRBM-MG 1234' : '—',
    Cargo: 'biomedico',
    Assinatura: `sig${String(i).padStart(2, '0')}a8c3b0375187`,
  };
}

function makeHemaRow(i, { full }) {
  return {
    Data: `${String(i + 1).padStart(2, '0')}/04/2026 09:${String(10 + i).padStart(2, '0')}`,
    Lote: 'L9934',
    Nível: String((i % 3) + 1),
    Equipamento: full ? 'Sysmex XN-1000' : '—',
    Status: i === 5 ? 'Rejeitada' : 'Aprovada',
    Westgard: i === 5 ? '1-3s' : '—',
    'IA editado': 'Não',
    Operador: full ? 'Dra. Maria da Silva' : '—',
    Registro: full ? 'CRBM-MG 1234' : '—',
    Cargo: 'biomedico',
    Assinatura: `hem${String(i).padStart(2, '0')}3f8a2c1b9d7e`,
  };
}

function makeImunoSection({ full, runCount }) {
  const rows = Array.from({ length: runCount }, (_, i) => makeImunoRow(i, { full }));
  const nonConforming = rows.filter((r) => r.Conformidade === 'NÃO CONFORME').length;
  return {
    moduleId: 'imunologia',
    moduleName: 'Imunologia — CIQ-Imuno (RDC 978/2025)',
    lastRunDate: '2026-04-15',
    totalRuns: rows.length,
    nonConformingRuns: nonConforming,
    columns: imunoPrimary.map((c) => c.key).concat(imunoSecondary.map((c) => c.key)),
    rows,
    summary: {
      'Total de corridas': String(rows.length),
      Conformes: String(rows.length - nonConforming),
      'Não conformes': String(nonConforming),
      'Taxa de conformidade': `${(((rows.length - nonConforming) / rows.length) * 100).toFixed(1)}%`,
      'Tipos de teste': 'Anti-HCV, HIV, HBsAg, Sífilis',
      'Operadores distintos': '1',
      'Lotes cobertos': '4',
    },
    tableLayout: { primary: imunoPrimary, secondary: imunoSecondary },
  };
}

function makeHemaSection({ full, runCount }) {
  const rows = Array.from({ length: runCount }, (_, i) => makeHemaRow(i, { full }));
  const rejected = rows.filter((r) => r.Status === 'Rejeitada').length;
  return {
    moduleId: 'hematologia',
    moduleName: 'Hematologia (CIQ Quantitativo)',
    lastRunDate: '2026-04-18',
    totalRuns: rows.length,
    nonConformingRuns: rejected,
    columns: hemaPrimary.map((c) => c.key).concat(hemaSecondary.map((c) => c.key)),
    rows,
    summary: {
      'Total de corridas': String(rows.length),
      Aprovadas: String(rows.length - rejected),
      Rejeitadas: String(rejected),
      Pendentes: '0',
      'Taxa de aprovação': `${(((rows.length - rejected) / rows.length) * 100).toFixed(1)}%`,
      'Operadores distintos': '1',
      'Lotes cobertos': '1',
    },
    tableLayout: { primary: hemaPrimary, secondary: hemaSecondary },
  };
}

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

/**
 * Constrói um BackupReport parametrizado.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.full=false]   Popula campos regulatórios do lab e do operador.
 * @param {boolean} [opts.multi=false]  Inclui módulo Hematologia além do Imunologia.
 * @param {number}  [opts.runCount=10]  Quantas corridas por módulo.
 * @param {boolean} [opts.alerts=true]  Inclui alertas de staleness.
 * @param {boolean} [opts.empty=false]  Nenhuma section, nenhum alerta — caso degenerado.
 */
export function makeReport(opts = {}) {
  const { full = false, multi = false, runCount = 10, alerts = true, empty = false } = opts;

  if (empty) {
    return {
      labId: 'labclin-riopomba',
      labName: 'LabClin Rio Pomba MG',
      periodStart: FIXED_PERIOD_START,
      periodEnd: FIXED_PERIOD_END,
      sections: [],
      stalenessAlerts: [],
      generatedAt: FIXED_GENERATED_AT,
      contentHash: 'empty-hash-placeholder',
    };
  }

  const sections = [
    ...(multi ? [makeHemaSection({ full, runCount: Math.max(1, Math.floor(runCount * 1.8)) })] : []),
    makeImunoSection({ full, runCount }),
  ];

  return {
    labId: 'labclin-riopomba',
    labName: 'LabClin Rio Pomba MG',
    labCnpj: full ? '12.345.678/0001-90' : undefined,
    labAddress: full
      ? 'Rua São Sebastião, 123 — Centro — Rio Pomba/MG — CEP 36180-000'
      : undefined,
    responsibleTech: full
      ? { name: 'Dra. Maria da Silva', registration: 'CRBM-MG 1234' }
      : undefined,
    sanitaryLicense: full ? { number: '012345/2026', validUntil: '31/12/2026' } : undefined,
    periodStart: FIXED_PERIOD_START,
    periodEnd: FIXED_PERIOD_END,
    sections,
    stalenessAlerts: alerts ? stalenessAlerts : [],
    generatedAt: FIXED_GENERATED_AT,
  };
}
