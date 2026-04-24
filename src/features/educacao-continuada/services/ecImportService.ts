/**
 * ecImportService.ts
 *
 * Geração de modelo XLSX para planejamento de treinamentos (FR-027) e parse
 * de planilha preenchida pelo usuário. A conversão é 1:1 com `TreinamentoInput`
 * — o caller cria os docs via `createTreinamento` do service Firebase.
 *
 * Colunas do modelo (ordem importa — o header é usado como chave):
 *   - Título            (string, obrigatório, ≥ 3 chars)
 *   - Tema              (string, obrigatório, ≥ 3 chars)
 *   - Carga (h)         (number > 0 e ≤ 999)
 *   - Modalidade        (Presencial | Online | Em serviço)
 *   - Unidade           (Fixa | Itinerante | Ambas)
 *   - Responsável       (string, obrigatório)
 *   - Periodicidade     (Mensal | Bimestral | Trimestral | Semestral | Anual)
 *   - Ativo             (Sim | Não — default Sim)
 *   - Datas Planejadas  (opcional, "DD/MM/AAAA; DD/MM/AAAA" — cria execuções)
 *
 * ⚠️ Limitações: aceita só .xlsx/.xls. CSV seria banking simpler mas perde
 * o auto-preenchimento de enums via data validation no Excel/Sheets.
 */

import * as XLSX from 'xlsx';

import type {
  ColaboradorInput,
  Modalidade,
  Periodicidade,
  TreinamentoInput,
  Unidade,
} from '../types/EducacaoContinuada';

// ─── Schema de colunas ───────────────────────────────────────────────────────

const COLUNAS = {
  titulo: 'Título',
  tema: 'Tema',
  cargaHoraria: 'Carga (h)',
  modalidade: 'Modalidade',
  unidade: 'Unidade',
  responsavel: 'Responsável',
  periodicidade: 'Periodicidade',
  ativo: 'Ativo',
  datasPlanejadas: 'Datas Planejadas',
} as const;

const MODALIDADE_MAP: Record<string, Modalidade> = {
  presencial: 'presencial',
  online: 'online',
  'em servico': 'em_servico',
  'em serviço': 'em_servico',
  em_servico: 'em_servico',
};

const UNIDADE_MAP: Record<string, Unidade> = {
  fixa: 'fixa',
  itinerante: 'itinerante',
  ambas: 'ambas',
};

const PERIODICIDADE_MAP: Record<string, Periodicidade> = {
  mensal: 'mensal',
  bimestral: 'bimestral',
  trimestral: 'trimestral',
  semestral: 'semestral',
  anual: 'anual',
};

const ATIVO_TRUE = new Set(['sim', 's', 'yes', 'y', 'true', '1', 'ativo']);
const ATIVO_FALSE = new Set(['não', 'nao', 'n', 'no', 'false', '0', 'inativo']);

// ─── Template download ───────────────────────────────────────────────────────

/**
 * Constrói um XLSX com 2 abas:
 *   - "Cronograma"  — header + 3 linhas de exemplo que o usuário substitui
 *   - "Instruções"  — valores aceitos para cada coluna enumerada
 */
export function generateTreinamentosTemplate(): ArrayBuffer {
  const anoBase = new Date().getFullYear();

  const header = [
    COLUNAS.titulo,
    COLUNAS.tema,
    COLUNAS.cargaHoraria,
    COLUNAS.modalidade,
    COLUNAS.unidade,
    COLUNAS.responsavel,
    COLUNAS.periodicidade,
    COLUNAS.ativo,
    COLUNAS.datasPlanejadas,
  ];

  const exemplos: Array<Array<string | number>> = [
    [
      'Biossegurança Laboratorial Nível 2',
      'Prevenção de acidentes em laboratório',
      8,
      'Presencial',
      'Fixa',
      'João Silva',
      'Anual',
      'Sim',
      `15/06/${anoBase}`,
    ],
    [
      'Coleta de Sangue Venoso',
      'Técnica atualizada de punção',
      4,
      'Em serviço',
      'Ambas',
      'Maria Souza',
      'Semestral',
      'Sim',
      `10/03/${anoBase}; 10/09/${anoBase}`,
    ],
    [
      'Descarte de Resíduos',
      'RDC 222/2018 — segregação e descarte',
      2,
      'Online',
      'Fixa',
      'Carlos Lima',
      'Trimestral',
      'Sim',
      `05/02/${anoBase}; 05/05/${anoBase}; 05/08/${anoBase}; 05/11/${anoBase}`,
    ],
  ];

  const wsData = [header, ...exemplos];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 40 }, { wch: 40 }, { wch: 10 }, { wch: 15 },
    { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 42 },
  ];

  const instrData = [
    ['Coluna', 'Valores aceitos', 'Observação'],
    [COLUNAS.titulo, 'qualquer texto (≥ 3 caracteres)', 'obrigatório'],
    [COLUNAS.tema, 'qualquer texto (≥ 3 caracteres)', 'obrigatório'],
    [COLUNAS.cargaHoraria, 'número entre 0,1 e 999', 'obrigatório — aceita decimal (8 ou 8,5)'],
    [COLUNAS.modalidade, 'Presencial | Online | Em serviço', 'obrigatório'],
    [COLUNAS.unidade, 'Fixa | Itinerante | Ambas', 'obrigatório'],
    [COLUNAS.responsavel, 'nome do responsável', 'obrigatório'],
    [COLUNAS.periodicidade, 'Mensal | Bimestral | Trimestral | Semestral | Anual', 'obrigatório'],
    [COLUNAS.ativo, 'Sim | Não', 'opcional — default Sim'],
    [
      COLUNAS.datasPlanejadas,
      'DD/MM/AAAA separadas por ; (ex: 15/06/2026; 15/12/2026)',
      'opcional — cria execuções planejadas para cada data. Aceita também AAAA-MM-DD.',
    ],
    [],
    ['Linhas vazias são ignoradas.'],
    ['Apague as linhas de exemplo antes de preencher com os seus treinamentos.'],
    ['Se deixar "Datas Planejadas" em branco, o treinamento é criado sem execuções no cronograma.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 22 }, { wch: 55 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function downloadTemplate(filename = 'cronograma-educacao-continuada.xlsx'): void {
  const data = generateTreinamentosTemplate();
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Parse ───────────────────────────────────────────────────────────────────

export interface ParsedRow<T = TreinamentoInput> {
  /** Linha no Excel (1-indexed, incluindo header). Usado em mensagens de erro. */
  linha: number;
  input: T;
}

export interface ParseError {
  linha: number;
  coluna?: string;
  valor?: unknown;
  mensagem: string;
}

export interface ParseResult<T = TreinamentoInput> {
  ok: ParsedRow<T>[];
  errors: ParseError[];
  /** Linhas não vazias encontradas no arquivo. */
  total: number;
}

/**
 * Row de treinamento enriquecida com datas planejadas opcionais. O import
 * cria o Treinamento e, para cada Date em `datasPlanejadas`, uma Execução
 * com status 'planejado' (ministrante = responsavel, pauta = tema como
 * defaults editáveis depois).
 */
export interface TreinamentoParsedRow {
  linha: number;
  input: TreinamentoInput;
  datasPlanejadas: Date[];
}

export interface TreinamentoParseResult {
  ok: TreinamentoParsedRow[];
  errors: ParseError[];
  total: number;
}

function normalizeEnum(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip accents
}

function parseCarga(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const normalized = String(raw).trim().replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseAtivo(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === '') return true; // default Sim
  if (typeof raw === 'boolean') return raw;
  const v = normalizeEnum(raw);
  if (ATIVO_TRUE.has(v)) return true;
  if (ATIVO_FALSE.has(v)) return false;
  return null;
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every(
    (v) => v === undefined || v === null || String(v).trim() === '',
  );
}

/**
 * Converte serial Excel (dias desde 1899-12-30) para Date UTC no meio-dia —
 * meio-dia evita flip de fuso horário ao renderizar em TZ negativas.
 */
function excelSerialToDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30); // 1899-12-30
  const ms = epoch + serial * 86400000;
  const d = new Date(ms);
  // Normaliza para meio-dia UTC para evitar shifts de fuso
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

function parseSingleDate(raw: string): Date | null {
  const s = raw.trim();
  if (s.length === 0) return null;

  // DD/MM/AAAA ou DD-MM-AAAA
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    let year = Number(br[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    return d;
  }

  // AAAA-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    return d;
  }

  return null;
}

/**
 * Parseia uma célula "Datas Planejadas" — pode vir como:
 *  - Serial Excel (number) — uma única data (quando usuário digita 15/06/2026
 *    e o Excel converte para serial antes de salvar)
 *  - String com múltiplas datas separadas por `;` `,` `|` ou quebra de linha
 *  - Vazio → array vazio
 * Retorna `{ dates, invalid }`. `invalid` lista os tokens que falharam.
 */
function parseDatasPlanejadas(raw: unknown): { dates: Date[]; invalid: string[] } {
  if (raw === null || raw === undefined || raw === '') {
    return { dates: [], invalid: [] };
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { dates: [excelSerialToDate(raw)], invalid: [] };
  }

  const tokens = String(raw)
    .split(/[;,|\n\r]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const dates: Date[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    const d = parseSingleDate(t);
    if (d) dates.push(d);
    else invalid.push(t);
  }
  return { dates, invalid };
}

export async function parseTreinamentosXlsx(
  file: File,
): Promise<TreinamentoParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      ok: [],
      errors: [{ linha: 0, mensagem: 'Arquivo sem abas.' }],
      total: 0,
    };
  }

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  const ok: TreinamentoParsedRow[] = [];
  const errors: ParseError[] = [];
  let total = 0;

  rows.forEach((row, idx) => {
    const linha = idx + 2; // +1 pelo header, +1 pra 1-indexed
    if (isEmptyRow(row)) return;
    total++;

    const rowErrors: ParseError[] = [];

    const titulo = String(row[COLUNAS.titulo] ?? '').trim();
    if (titulo.length < 3) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.titulo,
        valor: row[COLUNAS.titulo],
        mensagem: 'Título deve ter ao menos 3 caracteres.',
      });
    }

    const tema = String(row[COLUNAS.tema] ?? '').trim();
    if (tema.length < 3) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.tema,
        valor: row[COLUNAS.tema],
        mensagem: 'Tema deve ter ao menos 3 caracteres.',
      });
    }

    const carga = parseCarga(row[COLUNAS.cargaHoraria]);
    if (carga === null || carga <= 0 || carga > 999) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.cargaHoraria,
        valor: row[COLUNAS.cargaHoraria],
        mensagem: 'Carga horária deve ser um número entre 0,1 e 999.',
      });
    }

    const modalidade = MODALIDADE_MAP[normalizeEnum(row[COLUNAS.modalidade])];
    if (!modalidade) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.modalidade,
        valor: row[COLUNAS.modalidade],
        mensagem: 'Modalidade inválida. Use: Presencial, Online ou Em serviço.',
      });
    }

    const unidade = UNIDADE_MAP[normalizeEnum(row[COLUNAS.unidade])];
    if (!unidade) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.unidade,
        valor: row[COLUNAS.unidade],
        mensagem: 'Unidade inválida. Use: Fixa, Itinerante ou Ambas.',
      });
    }

    const responsavel = String(row[COLUNAS.responsavel] ?? '').trim();
    if (responsavel.length < 2) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.responsavel,
        valor: row[COLUNAS.responsavel],
        mensagem: 'Responsável é obrigatório.',
      });
    }

    const periodicidade = PERIODICIDADE_MAP[normalizeEnum(row[COLUNAS.periodicidade])];
    if (!periodicidade) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.periodicidade,
        valor: row[COLUNAS.periodicidade],
        mensagem:
          'Periodicidade inválida. Use: Mensal, Bimestral, Trimestral, Semestral ou Anual.',
      });
    }

    const ativo = parseAtivo(row[COLUNAS.ativo]);
    if (ativo === null) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.ativo,
        valor: row[COLUNAS.ativo],
        mensagem: 'Ativo deve ser Sim ou Não (ou vazio = Sim).',
      });
    }

    const { dates: datasPlanejadas, invalid: datasInvalidas } = parseDatasPlanejadas(
      row[COLUNAS.datasPlanejadas],
    );
    if (datasInvalidas.length > 0) {
      rowErrors.push({
        linha,
        coluna: COLUNAS.datasPlanejadas,
        valor: row[COLUNAS.datasPlanejadas],
        mensagem: `Data(s) inválida(s): ${datasInvalidas.join(', ')}. Use DD/MM/AAAA separadas por ;`,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    // TS narrow — todos os validados não-nulos aqui
    if (!modalidade || !unidade || !periodicidade || carga === null || ativo === null) return;

    ok.push({
      linha,
      input: {
        titulo,
        tema,
        cargaHoraria: carga,
        modalidade,
        unidade,
        responsavel,
        periodicidade,
        ativo,
        // Fase 10: XLSX atual não tem coluna Tipo — default 'periodico' preserva
        // semântica anterior (toda linha importada era periódica por convenção).
        // Débito documentado: adicionar coluna Tipo ao template XLSX para permitir
        // import de outros tipos regulatórios.
        tipo: 'periodico',
      },
      datasPlanejadas,
    });
  });

  return { ok, errors, total };
}

// ─── Colaboradores ───────────────────────────────────────────────────────────
//
// Planilha separada para cadastro em massa de colaboradores (FR-001).
// Colunas:
//   - Nome    (string, obrigatório, ≥ 2 chars)
//   - Cargo   (string, obrigatório)
//   - Setor   (string, obrigatório)
//   - Ativo   (Sim | Não — default Sim)

const COLUNAS_COLAB = {
  nome: 'Nome',
  cargo: 'Cargo',
  setor: 'Setor',
  ativo: 'Ativo',
} as const;

export function generateColaboradoresTemplate(): ArrayBuffer {
  const header = [
    COLUNAS_COLAB.nome,
    COLUNAS_COLAB.cargo,
    COLUNAS_COLAB.setor,
    COLUNAS_COLAB.ativo,
  ];

  const exemplos: Array<Array<string | number>> = [
    ['Ana Paula Ferreira', 'Biomédica', 'Hematologia', 'Sim'],
    ['Ricardo Monteiro', 'Técnico de Laboratório', 'Coleta', 'Sim'],
    ['Juliana Rocha', 'Farmacêutica', 'Bioquímica', 'Sim'],
  ];

  const wsData = [header, ...exemplos];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 36 }, { wch: 28 }, { wch: 24 }, { wch: 8 }];

  const instrData = [
    ['Coluna', 'Valores aceitos', 'Observação'],
    [COLUNAS_COLAB.nome, 'qualquer texto (≥ 2 caracteres)', 'obrigatório'],
    [COLUNAS_COLAB.cargo, 'qualquer texto', 'obrigatório'],
    [COLUNAS_COLAB.setor, 'qualquer texto', 'obrigatório'],
    [COLUNAS_COLAB.ativo, 'Sim | Não', 'opcional — default Sim'],
    [],
    ['Linhas vazias são ignoradas.'],
    ['Apague as linhas de exemplo antes de preencher com os seus colaboradores.'],
    ['Duplicatas por nome não são detectadas — revise antes de importar.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 48 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function downloadColaboradoresTemplate(
  filename = 'colaboradores-educacao-continuada.xlsx',
): void {
  const data = generateColaboradoresTemplate();
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function parseColaboradoresXlsx(
  file: File,
): Promise<ParseResult<ColaboradorInput>> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      ok: [],
      errors: [{ linha: 0, mensagem: 'Arquivo sem abas.' }],
      total: 0,
    };
  }

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  const ok: ParsedRow<ColaboradorInput>[] = [];
  const errors: ParseError[] = [];
  let total = 0;

  rows.forEach((row, idx) => {
    const linha = idx + 2;
    if (isEmptyRow(row)) return;
    total++;

    const rowErrors: ParseError[] = [];

    const nome = String(row[COLUNAS_COLAB.nome] ?? '').trim();
    if (nome.length < 2) {
      rowErrors.push({
        linha,
        coluna: COLUNAS_COLAB.nome,
        valor: row[COLUNAS_COLAB.nome],
        mensagem: 'Nome deve ter ao menos 2 caracteres.',
      });
    }

    const cargo = String(row[COLUNAS_COLAB.cargo] ?? '').trim();
    if (cargo.length === 0) {
      rowErrors.push({
        linha,
        coluna: COLUNAS_COLAB.cargo,
        valor: row[COLUNAS_COLAB.cargo],
        mensagem: 'Cargo é obrigatório.',
      });
    }

    const setor = String(row[COLUNAS_COLAB.setor] ?? '').trim();
    if (setor.length === 0) {
      rowErrors.push({
        linha,
        coluna: COLUNAS_COLAB.setor,
        valor: row[COLUNAS_COLAB.setor],
        mensagem: 'Setor é obrigatório.',
      });
    }

    const ativo = parseAtivo(row[COLUNAS_COLAB.ativo]);
    if (ativo === null) {
      rowErrors.push({
        linha,
        coluna: COLUNAS_COLAB.ativo,
        valor: row[COLUNAS_COLAB.ativo],
        mensagem: 'Ativo deve ser Sim ou Não (ou vazio = Sim).',
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    if (ativo === null) return;

    ok.push({
      linha,
      input: { nome, cargo, setor, ativo },
    });
  });

  return { ok, errors, total };
}
