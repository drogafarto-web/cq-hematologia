import { describe, it, expect } from 'vitest';
import {
  parseControlLotCSV,
  parseMultiLevelLotCsv,
  statsToManufacturerStats,
  type ParsedStat,
} from '../../../src/features/lots/services/csvParserService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** CSV single-level mínimo válido. */
const SINGLE_LEVEL_CSV = `
Lot Number,L2024-001
Control Name,Difftrol Normal
Expiry,12/2025
Level,1

Analyte,Mean,SD
WBC,7.5,0.3
RBC,4.8,0.2
HGB,14.2,0.5
PLT,250,20
`.trim();

/** CSV com separador decimal vírgula. */
const CSV_COMMA_DECIMAL = `
Analyte,Mean,SD
WBC,7,5,0,3
RBC,4,8,0,2
`.trim();

/** CSV com sinônimos em português para os analitos. */
const CSV_SYNONYMS = `
Analyte,Mean,SD
leucocitos,7.5,0.3
hemacias,4.8,0.2
hemoglobina,14.2,0.5
plaquetas,250,20
`.trim();

/** CSV no formato multi-level de bula (parseMultiLevelLotCsv). */
const BULA_CSV = `
// Info
level,lotNumber,controlName,equipmentName,serialNumber,expiryDate,startDate
1,L1-001,Difftrol Low,Yumizen H550,SN001,2025-12-31,2024-01-01
2,L2-001,Difftrol Normal,Yumizen H550,SN001,2025-12-31,2024-01-01
3,L3-001,Difftrol High,Yumizen H550,SN001,2025-12-31,2024-01-01

// Stats
analyteId,mean_level1,sd_level1,mean_level2,sd_level2,mean_level3,sd_level3
RBC,3.5,0.15,4.8,0.20,5.8,0.25
WBC,5.0,0.40,8.0,0.60,12.0,0.90
HGB,11.0,0.50,14.2,0.60,17.0,0.70
`.trim();

// ─── parseControlLotCSV — single-level ───────────────────────────────────────

describe('parseControlLotCSV — single-level', () => {
  it('extrai metadados do CSV', () => {
    const r = parseControlLotCSV(SINGLE_LEVEL_CSV);
    expect(r.lotNumber).toBe('L2024-001');
    expect(r.controlName).toBe('Difftrol Normal');
    expect(r.level).toBe(1);
  });

  it('extrai data de validade no formato MM/YYYY', () => {
    const r = parseControlLotCSV(SINGLE_LEVEL_CSV);
    expect(r.expiryDate).toBeInstanceOf(Date);
    // 12/2025 → último dia de dezembro 2025
    expect(r.expiryDate?.getFullYear()).toBe(2025);
    expect(r.expiryDate?.getMonth()).toBe(11); // mês 11 = dezembro (0-indexed)
  });

  it('extrai stats de todos os analitos reconhecidos', () => {
    const r = parseControlLotCSV(SINGLE_LEVEL_CSV);
    expect(r.stats.length).toBe(4);
    const ids = r.stats.map((s) => s.analyteId);
    expect(ids).toContain('WBC');
    expect(ids).toContain('RBC');
    expect(ids).toContain('HGB');
    expect(ids).toContain('PLT');
  });

  it('extrai valores corretos de mean e SD', () => {
    const r = parseControlLotCSV(SINGLE_LEVEL_CSV);
    const wbc = r.stats.find((s) => s.analyteId === 'WBC');
    expect(wbc?.mean).toBe(7.5);
    expect(wbc?.sd).toBe(0.3);
  });

  it('não gera warnings para CSV bem formado', () => {
    const r = parseControlLotCSV(SINGLE_LEVEL_CSV);
    expect(r.warnings).toHaveLength(0);
  });
});

// ─── parseControlLotCSV — sinônimos de analitos ───────────────────────────────

describe('parseControlLotCSV — resolução de sinônimos', () => {
  it('resolve nomes em português para IDs canônicos', () => {
    const r = parseControlLotCSV(CSV_SYNONYMS);
    const ids = r.stats.map((s) => s.analyteId);
    expect(ids).toContain('WBC'); // leucocitos
    expect(ids).toContain('RBC'); // hemacias
    expect(ids).toContain('HGB'); // hemoglobina
    expect(ids).toContain('PLT'); // plaquetas
  });

  it('resolve abreviações minúsculas (wbc, rbc)', () => {
    const csv = `Analyte,Mean,SD\nwbc,7.5,0.3\nrbc,4.8,0.2`;
    const r = parseControlLotCSV(csv);
    const ids = r.stats.map((s) => s.analyteId);
    expect(ids).toContain('WBC');
    expect(ids).toContain('RBC');
  });

  it('ignora analitos desconhecidos e gera warning', () => {
    const csv = `Analyte,Mean,SD\nXXX,1.0,0.1\nWBC,7.5,0.3`;
    const r = parseControlLotCSV(csv);
    expect(r.stats.length).toBe(1);
    expect(r.stats[0].analyteId).toBe('WBC');
    expect(r.warnings.some((w) => w.includes('XXX'))).toBe(true);
  });
});

// ─── parseControlLotCSV — formatos de data ───────────────────────────────────

describe('parseControlLotCSV — formatos de data (expiryDate)', () => {
  it('parseia MM/YYYY → último dia do mês', () => {
    const csv = `Expiry,06/2025\nAnalyte,Mean,SD\nWBC,7.5,0.3`;
    const r = parseControlLotCSV(csv);
    expect(r.expiryDate?.getFullYear()).toBe(2025);
    expect(r.expiryDate?.getMonth()).toBe(5); // junho = 5
  });

  it('parseia YYYY-MM-DD', () => {
    // O parser usa `new Date('YYYY-MM-DD')` que cria UTC midnight.
    // Usar getUTC* para testar o valor armazenado, independente do fuso local.
    const csv = `Expiry,2025-12-15\nAnalyte,Mean,SD\nWBC,7.5,0.3`;
    const r = parseControlLotCSV(csv);
    expect(r.expiryDate?.getUTCFullYear()).toBe(2025);
    expect(r.expiryDate?.getUTCMonth()).toBe(11); // dezembro
    expect(r.expiryDate?.getUTCDate()).toBe(15);
  });

  it('parseia DD/MM/YYYY (formato brasileiro)', () => {
    const csv = `Expiry,31/12/2025\nAnalyte,Mean,SD\nWBC,7.5,0.3`;
    const r = parseControlLotCSV(csv);
    expect(r.expiryDate?.getFullYear()).toBe(2025);
    expect(r.expiryDate?.getMonth()).toBe(11);
    expect(r.expiryDate?.getDate()).toBe(31);
  });

  it('retorna expiryDate null para data inválida', () => {
    const csv = `Expiry,invalid-date\nAnalyte,Mean,SD\nWBC,7.5,0.3`;
    const r = parseControlLotCSV(csv);
    expect(r.expiryDate).toBeNull();
  });
});

// ─── parseControlLotCSV — CSV mal formado ────────────────────────────────────

describe('parseControlLotCSV — CSV mal formado', () => {
  it('retorna warning quando CSV não tem cabeçalho reconhecível', () => {
    const r = parseControlLotCSV('col1,col2\n1,2\n3,4');
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.stats).toHaveLength(0);
  });

  it('retorna warning para string vazia', () => {
    const r = parseControlLotCSV('');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('ignora linha com mean/sd não numéricos e gera warning', () => {
    const csv = `Analyte,Mean,SD\nWBC,N/A,0.3\nRBC,4.8,0.2`;
    const r = parseControlLotCSV(csv);
    // WBC ignorado (mean inválido), RBC extraído
    expect(r.stats.length).toBe(1);
    expect(r.stats[0].analyteId).toBe('RBC');
    expect(r.warnings.some((w) => w.includes('WBC'))).toBe(true);
  });

  it('retorna metadados nulos quando ausentes', () => {
    const csv = `Analyte,Mean,SD\nWBC,7.5,0.3`;
    const r = parseControlLotCSV(csv);
    expect(r.lotNumber).toBeNull();
    expect(r.controlName).toBeNull();
    expect(r.level).toBeNull();
    expect(r.expiryDate).toBeNull();
  });
});

// ─── parseControlLotCSV — multi-level ────────────────────────────────────────

/** CSV multi-level com formato "Level N Mean" / "Level N SD". */
const MULTI_LEVEL_CSV = `
Analyte,Level 1 Mean,Level 1 SD,Level 2 Mean,Level 2 SD,Level 3 Mean,Level 3 SD
WBC,7.5,0.3,12.0,0.5,18.0,0.8
RBC,4.8,0.2,5.5,0.25,6.2,0.3
HGB,14.2,0.6,17.0,0.7,19.5,0.9
`.trim();

describe('parseControlLotCSV — multi-level (Level N Mean/SD)', () => {
  it('extrai nível 1 por padrão', () => {
    const r = parseControlLotCSV(MULTI_LEVEL_CSV);
    const wbc = r.stats.find((s) => s.analyteId === 'WBC');
    expect(wbc?.mean).toBe(7.5);
    expect(wbc?.sd).toBe(0.3);
  });

  it('extrai nível 2 quando targetLevel=2', () => {
    const r = parseControlLotCSV(MULTI_LEVEL_CSV, 2);
    const wbc = r.stats.find((s) => s.analyteId === 'WBC');
    expect(wbc?.mean).toBe(12.0);
    expect(wbc?.sd).toBe(0.5);
  });

  it('extrai nível 3 quando targetLevel=3', () => {
    const r = parseControlLotCSV(MULTI_LEVEL_CSV, 3);
    const wbc = r.stats.find((s) => s.analyteId === 'WBC');
    expect(wbc?.mean).toBe(18.0);
    expect(wbc?.sd).toBe(0.8);
  });

  it('extrai todos os analitos presentes', () => {
    const r = parseControlLotCSV(MULTI_LEVEL_CSV);
    expect(r.stats.length).toBe(3);
  });

  it('não gera warnings para CSV multi-level bem formado', () => {
    const r = parseControlLotCSV(MULTI_LEVEL_CSV);
    expect(r.warnings).toHaveLength(0);
  });
});

// ─── parseMultiLevelLotCsv ────────────────────────────────────────────────────

describe('parseMultiLevelLotCsv — formato bula', () => {
  it('parseia os três níveis de info corretamente', () => {
    const r = parseMultiLevelLotCsv(BULA_CSV);
    expect(r.levels).toHaveLength(3);
    const lvl1 = r.levels.find((l) => l.level === 1);
    expect(lvl1?.lotNumber).toBe('L1-001');
    expect(lvl1?.controlName).toBe('Difftrol Low');
    expect(lvl1?.equipmentName).toBe('Yumizen H550');
  });

  it('parseia datas de expiryDate e startDate', () => {
    const r = parseMultiLevelLotCsv(BULA_CSV);
    const lvl1 = r.levels.find((l) => l.level === 1);
    expect(lvl1?.expiryDate).toBeInstanceOf(Date);
    expect(lvl1?.startDate).toBeInstanceOf(Date);
    expect(lvl1?.expiryDate?.getFullYear()).toBe(2025);
  });

  it('parseia stats dos três níveis para cada analito', () => {
    const r = parseMultiLevelLotCsv(BULA_CSV);
    const rbc = r.stats.find((s) => s.analyteId === 'RBC');
    expect(rbc?.byLevel[1]).toEqual({ mean: 3.5, sd: 0.15 });
    expect(rbc?.byLevel[2]).toEqual({ mean: 4.8, sd: 0.2 });
    expect(rbc?.byLevel[3]).toEqual({ mean: 5.8, sd: 0.25 });
  });

  it('extrai todos os analitos do bloco Stats', () => {
    const r = parseMultiLevelLotCsv(BULA_CSV);
    expect(r.stats.length).toBe(3);
    const ids = r.stats.map((s) => s.analyteId);
    expect(ids).toContain('RBC');
    expect(ids).toContain('WBC');
    expect(ids).toContain('HGB');
  });

  it('não gera warnings para CSV bem formado', () => {
    const r = parseMultiLevelLotCsv(BULA_CSV);
    expect(r.warnings).toHaveLength(0);
  });

  // ── Erros esperados ────────────────────────────────────────────────────────

  it('lança erro quando bloco "// Info" está ausente', () => {
    const csv = `// Stats\nanalyteId,mean_level1,sd_level1\nRBC,3.5,0.15`;
    expect(() => parseMultiLevelLotCsv(csv)).toThrow();
  });

  it('lança erro quando bloco "// Stats" está ausente', () => {
    const csv = `// Info\nlevel,lotNumber\n1,L1-001`;
    expect(() => parseMultiLevelLotCsv(csv)).toThrow();
  });

  it('lança erro quando "// Stats" aparece antes de "// Info"', () => {
    const csv = `// Stats\nanalyteId\nRBC\n// Info\nlevel\n1`;
    expect(() => parseMultiLevelLotCsv(csv)).toThrow();
  });

  it('lança erro quando algum nível (1, 2 ou 3) está ausente', () => {
    // Apenas níveis 1 e 2
    const csv = `
// Info
level,lotNumber,controlName,equipmentName,serialNumber,expiryDate,startDate
1,L1,Ctrl,Equip,SN,2025-12-31,2024-01-01
2,L2,Ctrl,Equip,SN,2025-12-31,2024-01-01

// Stats
analyteId,mean_level1,sd_level1,mean_level2,sd_level2
RBC,3.5,0.15,4.8,0.20
`.trim();
    expect(() => parseMultiLevelLotCsv(csv)).toThrow(/nível/i);
  });
});

// ─── statsToManufacturerStats ─────────────────────────────────────────────────

describe('statsToManufacturerStats', () => {
  it('converte ParsedStat[] para ManufacturerStats indexado por analyteId', () => {
    const stats: ParsedStat[] = [
      { analyteId: 'WBC', mean: 7.5, sd: 0.3 },
      { analyteId: 'RBC', mean: 4.8, sd: 0.2 },
    ];
    const result = statsToManufacturerStats(stats);
    expect(result['WBC']).toEqual({ mean: 7.5, sd: 0.3 });
    expect(result['RBC']).toEqual({ mean: 4.8, sd: 0.2 });
  });

  it('retorna objeto vazio para array vazio', () => {
    expect(statsToManufacturerStats([])).toEqual({});
  });

  it('último analito vence em caso de analyteId duplicado', () => {
    const stats: ParsedStat[] = [
      { analyteId: 'WBC', mean: 7.5, sd: 0.3 },
      { analyteId: 'WBC', mean: 8.0, sd: 0.4 }, // duplicado
    ];
    const result = statsToManufacturerStats(stats);
    expect(result['WBC']).toEqual({ mean: 8.0, sd: 0.4 });
  });
});
