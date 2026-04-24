/**
 * ctXlsxService.ts
 *
 * Geração do modelo XLSX + parser + validação para import em massa de
 * equipamentos + termômetros (RN-10). Padrão replicado de ecImportService.
 *
 * Modelo gerado — 3 abas:
 *   1. "Equipamentos" — header + 3 linhas de exemplo
 *   2. "Termômetros"  — header + 2 linhas de exemplo
 *   3. "Instruções"   — valores aceitos por coluna
 *
 * Parse é 2-fase: (a) lê ambas as abas e valida tudo client-side,
 * (b) caller confirma → ctFirebaseService#importarXlsxBatch grava atômico.
 * Erros e warnings não abortam parse — todos são retornados pra UI decidir.
 */

import * as XLSX from 'xlsx';

import { Timestamp } from '../../../shared/services/firebase';
import type {
  ConfiguracaoCalendario,
  ConfiguracaoCalendarioDia,
  EquipamentoInput,
  LimitesAceitabilidade,
  TermometroInput,
  TipoEquipamento,
} from '../types/ControlTemperatura';
import type {
  ImportItemEquipamento,
  ImportItemTermometro,
} from './ctFirebaseService';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const COL_EQUIP = {
  nome: 'Nome',
  tipo: 'Tipo',
  localizacao: 'Localização',
  termometroSerie: 'Nº Série Termômetro',
  tempMin: 'Temp. Mín (°C)',
  tempMax: 'Temp. Máx (°C)',
  umidMin: 'Umidade Mín (%)',
  umidMax: 'Umidade Máx (%)',
  leiturasPorDia: 'Leituras por dia',
  hora1: 'Horário 1',
  hora2: 'Horário 2',
  hora3: 'Horário 3',
  diasUteis: 'Dias úteis',
  sabado: 'Sábado',
  domingo: 'Domingo',
  feriados: 'Feriados',
  observacoes: 'Observações',
} as const;

const COL_TERMO = {
  numeroSerie: 'Nº Série',
  modelo: 'Modelo',
  fabricante: 'Fabricante',
  incerteza: 'Incerteza (±°C)',
  dataEmissao: 'Última calibração',
  dataValidade: 'Validade do certificado',
  numeroCertificado: 'Nº do Certificado',
  labCalibrador: 'Lab. Calibrador',
} as const;

const TIPOS_VALIDOS: TipoEquipamento[] = [
  'geladeira',
  'freezer',
  'freezer_ultrabaixo',
  'sala',
  'banho_maria',
  'estufa',
  'incubadora',
  'outro',
];

const TIPO_NORMALIZADO: Record<string, TipoEquipamento> = {
  geladeira: 'geladeira',
  freezer: 'freezer',
  freezer_ultrabaixo: 'freezer_ultrabaixo',
  'freezer ultrabaixo': 'freezer_ultrabaixo',
  sala: 'sala',
  banho_maria: 'banho_maria',
  'banho maria': 'banho_maria',
  estufa: 'estufa',
  incubadora: 'incubadora',
  outro: 'outro',
};

const SIM_RE = new Set(['sim', 's', 'yes', 'y', 'true', '1']);
const NAO_RE = new Set(['não', 'nao', 'n', 'no', 'false', '0']);

// ─── Template ────────────────────────────────────────────────────────────────

/**
 * Gera o arquivo XLSX modelo. Caller faz download via blob URL.
 * 3 abas como spec. Exemplos pré-preenchidos.
 */
export function generateCtTemplate(): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Aba 1 — Equipamentos
  const equipHeader = [
    COL_EQUIP.nome,
    COL_EQUIP.tipo,
    COL_EQUIP.localizacao,
    COL_EQUIP.termometroSerie,
    COL_EQUIP.tempMin,
    COL_EQUIP.tempMax,
    COL_EQUIP.umidMin,
    COL_EQUIP.umidMax,
    COL_EQUIP.leiturasPorDia,
    COL_EQUIP.hora1,
    COL_EQUIP.hora2,
    COL_EQUIP.hora3,
    COL_EQUIP.diasUteis,
    COL_EQUIP.sabado,
    COL_EQUIP.domingo,
    COL_EQUIP.feriados,
    COL_EQUIP.observacoes,
  ];
  const equipExemplos: Array<Array<string | number>> = [
    [
      'Geladeira Reagentes — Bioquímica',
      'geladeira',
      'Setor Bioquímica',
      'TM-0012',
      2,
      8,
      '',
      '',
      2,
      '08:00',
      '14:00',
      '',
      'Sim',
      'Sim',
      'Não',
      'Não',
      'Verificar porta ao fechar.',
    ],
    [
      'Freezer Plasma — Banco de Sangue',
      'freezer',
      'Banco de Sangue',
      'TM-0013',
      -30,
      -20,
      '',
      '',
      3,
      '08:00',
      '14:00',
      '20:00',
      'Sim',
      'Sim',
      'Sim',
      'Sim',
      '',
    ],
    [
      'Estufa Cultura — Microbiologia',
      'estufa',
      'Microbiologia',
      'TM-0014',
      36.5,
      37.5,
      50,
      80,
      1,
      '10:00',
      '',
      '',
      'Sim',
      'Não',
      'Não',
      'Não',
      '',
    ],
  ];
  const wsEquip = XLSX.utils.aoa_to_sheet([equipHeader, ...equipExemplos]);
  XLSX.utils.book_append_sheet(wb, wsEquip, 'Equipamentos');

  // Aba 2 — Termômetros
  const termoHeader = [
    COL_TERMO.numeroSerie,
    COL_TERMO.modelo,
    COL_TERMO.fabricante,
    COL_TERMO.incerteza,
    COL_TERMO.dataEmissao,
    COL_TERMO.dataValidade,
    COL_TERMO.numeroCertificado,
    COL_TERMO.labCalibrador,
  ];
  const termoExemplos: Array<Array<string | number>> = [
    ['TM-0012', 'Incoterm Digital', 'Incoterm', 0.5, '15/01/2026', '15/01/2027', 'CERT-2026-TM0012', 'LabMetro SP'],
    ['TM-0013', 'Testo 174', 'Testo', 0.3, '20/03/2026', '20/03/2027', 'CERT-2026-TM0013', 'LabMetro SP'],
  ];
  const wsTermo = XLSX.utils.aoa_to_sheet([termoHeader, ...termoExemplos]);
  XLSX.utils.book_append_sheet(wb, wsTermo, 'Termômetros');

  // Aba 3 — Instruções (read-only)
  const instrucoes = [
    ['CONTROLE DE TEMPERATURA — Instruções de preenchimento'],
    [''],
    ['Regras gerais:'],
    ['  • Não renomeie as abas.'],
    ['  • Não altere os cabeçalhos.'],
    ['  • Preencha primeiro a aba "Termômetros", depois "Equipamentos".'],
    ['  • Cada equipamento aponta para um "Nº Série Termômetro" que DEVE existir na Aba 2.'],
    [''],
    ['Colunas da aba "Equipamentos":'],
    ['  Tipo:               geladeira | freezer | freezer_ultrabaixo | sala | banho_maria | estufa | incubadora | outro'],
    ['  Temp. Mín/Máx:      números em °C. Temp. Mín DEVE ser menor que Temp. Máx.'],
    ['  Umidade Mín/Máx:    opcionais. Se preenchidos, 0-100.'],
    ['  Leituras por dia:   1, 2 ou 3. Deve bater com a quantidade de horários preenchidos.'],
    ['  Horário 1/2/3:      formato HH:MM (24h). Ex: 08:00, 14:30, 20:00.'],
    ['  Dias úteis/Sábado/Domingo/Feriados:  Sim | Não (obrigatoriedade de leitura nesses dias).'],
    [''],
    ['Colunas da aba "Termômetros":'],
    ['  Incerteza:          valor em °C, ex: 0.5 = ±0.5°C.'],
    ['  Última calibração:  data DD/MM/AAAA. Será a "data de emissão" do certificado inicial.'],
    ['  Validade do certificado: data DD/MM/AAAA. Deve ser posterior à Última calibração.'],
    ['  Nº do Certificado:  identificador único emitido pelo lab calibrador.'],
    [''],
    ['Após importar:'],
    ['  • Anexe os PDFs dos certificados manualmente em Configurações > Termômetros.'],
    ['  • Previsões de leitura serão criadas automaticamente para os próximos 7 dias.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

export interface ErroLinha {
  aba: 'Equipamentos' | 'Termômetros';
  linha: number;
  mensagem: string;
}

export interface WarningLinha {
  aba: 'Equipamentos' | 'Termômetros';
  linha: number;
  mensagem: string;
}

export interface ImportParseResult {
  termometros: ImportItemTermometro[];
  equipamentos: ImportItemEquipamento[];
  erros: ErroLinha[];
  warnings: WarningLinha[];
}

function parseNumero(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).replace(',', '.').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseSimNao(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (SIM_RE.has(s)) return true;
  if (NAO_RE.has(s)) return false;
  return null;
}

function parseHorario(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim();
  // Aceita HH:MM ou formato serial Excel (fração do dia).
  const match = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (match) {
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  const frac = parseNumero(raw);
  if (frac !== null && frac >= 0 && frac < 1) {
    const totalMin = Math.round(frac * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return null;
}

function parseDataBR(raw: unknown): Timestamp | null {
  if (raw === null || raw === undefined || raw === '') return null;
  // Se já é Date (XLSX pode entregar assim com cellDates: true).
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return Timestamp.fromDate(raw);
  }
  if (typeof raw === 'number') {
    // Serial Excel: dias desde 1899-12-30.
    const base = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(base.getTime() + raw * 24 * 60 * 60 * 1000);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  const s = String(raw).trim();
  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(s);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  return null;
}

const CALENDARIO_VAZIO: ConfiguracaoCalendarioDia = { obrigatorio: false, horarios: [] };

/**
 * Parser principal. Não escreve no Firestore — apenas valida e devolve o
 * resultado estruturado para a UI decidir se confirma.
 */
export async function parseImportXlsx(file: File): Promise<ImportParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const erros: ErroLinha[] = [];
  const warnings: WarningLinha[] = [];
  const termometros: ImportItemTermometro[] = [];
  const equipamentos: ImportItemEquipamento[] = [];

  const termosSheet = wb.Sheets['Termômetros'] ?? wb.Sheets['Termometros'];
  const equipsSheet = wb.Sheets['Equipamentos'];

  if (!termosSheet || !equipsSheet) {
    erros.push({
      aba: 'Equipamentos',
      linha: 0,
      mensagem: 'XLSX não contém as abas "Equipamentos" e "Termômetros" — baixe o modelo.',
    });
    return { termometros, equipamentos, erros, warnings };
  }

  // ── Termômetros ──────────────────────────────────────────────────────────
  const termosRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(termosSheet, {
    defval: null,
    raw: false,
  });
  const seriesVistas = new Set<string>();

  termosRaw.forEach((row, idx) => {
    const linha = idx + 2; // header + 1-indexed
    const numeroSerie = String(row[COL_TERMO.numeroSerie] ?? '').trim();
    if (!numeroSerie) {
      erros.push({ aba: 'Termômetros', linha, mensagem: 'Nº Série obrigatório.' });
      return;
    }
    if (seriesVistas.has(numeroSerie)) {
      erros.push({ aba: 'Termômetros', linha, mensagem: `Nº Série "${numeroSerie}" duplicado na planilha.` });
      return;
    }
    seriesVistas.add(numeroSerie);

    const modelo = String(row[COL_TERMO.modelo] ?? '').trim();
    const fabricante = String(row[COL_TERMO.fabricante] ?? '').trim();
    const incerteza = parseNumero(row[COL_TERMO.incerteza]);
    const dataEmissao = parseDataBR(row[COL_TERMO.dataEmissao]);
    const dataValidade = parseDataBR(row[COL_TERMO.dataValidade]);
    const numeroCertificado = String(row[COL_TERMO.numeroCertificado] ?? '').trim();
    const lab = String(row[COL_TERMO.labCalibrador] ?? '').trim();

    if (!modelo) erros.push({ aba: 'Termômetros', linha, mensagem: 'Modelo obrigatório.' });
    if (!fabricante) erros.push({ aba: 'Termômetros', linha, mensagem: 'Fabricante obrigatório.' });
    if (incerteza === null || incerteza <= 0)
      erros.push({ aba: 'Termômetros', linha, mensagem: 'Incerteza inválida.' });
    if (!dataEmissao)
      erros.push({ aba: 'Termômetros', linha, mensagem: 'Data de última calibração inválida (use DD/MM/AAAA).' });
    if (!dataValidade)
      erros.push({ aba: 'Termômetros', linha, mensagem: 'Validade do certificado inválida (use DD/MM/AAAA).' });
    if (dataEmissao && dataValidade && dataValidade.toMillis() <= dataEmissao.toMillis())
      erros.push({ aba: 'Termômetros', linha, mensagem: 'Validade deve ser posterior à última calibração.' });
    if (!numeroCertificado) erros.push({ aba: 'Termômetros', linha, mensagem: 'Nº do Certificado obrigatório.' });
    if (!lab) erros.push({ aba: 'Termômetros', linha, mensagem: 'Lab. Calibrador obrigatório.' });

    if (
      modelo &&
      fabricante &&
      incerteza !== null &&
      dataEmissao &&
      dataValidade &&
      numeroCertificado &&
      lab
    ) {
      const input: TermometroInput = {
        numeroSerie,
        modelo,
        fabricante,
        incertezaMedicao: incerteza,
        calibracaoAtual: {
          dataEmissao,
          dataValidade,
          numeroCertificado,
          laboratorioCalibrador: lab,
        },
        ativo: true,
      };
      termometros.push({ chaveDeImport: numeroSerie, input });
    }
  });

  // ── Equipamentos ────────────────────────────────────────────────────────
  const equipsRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(equipsSheet, {
    defval: null,
    raw: false,
  });

  equipsRaw.forEach((row, idx) => {
    const linha = idx + 2;
    const nome = String(row[COL_EQUIP.nome] ?? '').trim();
    if (!nome) {
      erros.push({ aba: 'Equipamentos', linha, mensagem: 'Nome obrigatório.' });
      return;
    }

    const tipoRaw = String(row[COL_EQUIP.tipo] ?? '').trim().toLowerCase();
    const tipo = TIPO_NORMALIZADO[tipoRaw];
    if (!tipo) {
      erros.push({
        aba: 'Equipamentos',
        linha,
        mensagem: `Tipo "${tipoRaw}" inválido. Aceitos: ${TIPOS_VALIDOS.join(', ')}.`,
      });
      return;
    }

    const localizacao = String(row[COL_EQUIP.localizacao] ?? '').trim();
    if (!localizacao) erros.push({ aba: 'Equipamentos', linha, mensagem: 'Localização obrigatória.' });

    const termometroSerie = String(row[COL_EQUIP.termometroSerie] ?? '').trim();
    if (!termometroSerie) {
      erros.push({ aba: 'Equipamentos', linha, mensagem: 'Nº Série Termômetro obrigatório.' });
      return;
    }
    if (!termometros.some((t) => t.chaveDeImport === termometroSerie)) {
      erros.push({
        aba: 'Equipamentos',
        linha,
        mensagem: `Termômetro "${termometroSerie}" não encontrado na aba "Termômetros".`,
      });
      return;
    }

    const tempMin = parseNumero(row[COL_EQUIP.tempMin]);
    const tempMax = parseNumero(row[COL_EQUIP.tempMax]);
    if (tempMin === null || tempMax === null) {
      erros.push({ aba: 'Equipamentos', linha, mensagem: 'Temp. Mín/Máx obrigatórios.' });
      return;
    }
    if (tempMin >= tempMax) {
      erros.push({
        aba: 'Equipamentos',
        linha,
        mensagem: `Temp. Mín (${tempMin}) deve ser menor que Temp. Máx (${tempMax}).`,
      });
      return;
    }

    const umidMin = parseNumero(row[COL_EQUIP.umidMin]);
    const umidMax = parseNumero(row[COL_EQUIP.umidMax]);
    if (umidMin !== null && umidMax !== null && umidMin >= umidMax) {
      erros.push({ aba: 'Equipamentos', linha, mensagem: 'Umidade Mín deve ser menor que Máx.' });
      return;
    }

    const leiturasPorDia = parseNumero(row[COL_EQUIP.leiturasPorDia]);
    if (leiturasPorDia === null || ![1, 2, 3].includes(leiturasPorDia)) {
      erros.push({ aba: 'Equipamentos', linha, mensagem: 'Leituras por dia deve ser 1, 2 ou 3.' });
      return;
    }

    const horarios: string[] = [];
    const h1 = parseHorario(row[COL_EQUIP.hora1]);
    const h2 = parseHorario(row[COL_EQUIP.hora2]);
    const h3 = parseHorario(row[COL_EQUIP.hora3]);
    if (h1) horarios.push(h1);
    if (h2) horarios.push(h2);
    if (h3) horarios.push(h3);
    if (horarios.length !== leiturasPorDia) {
      erros.push({
        aba: 'Equipamentos',
        linha,
        mensagem: `Horários preenchidos (${horarios.length}) não batem com Leituras por dia (${leiturasPorDia}).`,
      });
      return;
    }

    const diasUteis = parseSimNao(row[COL_EQUIP.diasUteis]);
    const sabado = parseSimNao(row[COL_EQUIP.sabado]);
    const domingo = parseSimNao(row[COL_EQUIP.domingo]);
    const feriados = parseSimNao(row[COL_EQUIP.feriados]);
    if (diasUteis === null || sabado === null || domingo === null || feriados === null) {
      erros.push({ aba: 'Equipamentos', linha, mensagem: 'Dias úteis/Sábado/Domingo/Feriados: use Sim ou Não.' });
      return;
    }
    if (!diasUteis && !sabado && !domingo && !feriados) {
      warnings.push({
        aba: 'Equipamentos',
        linha,
        mensagem: 'Nenhum dia marcado como obrigatório — equipamento sem previsões.',
      });
    }

    const limites: LimitesAceitabilidade = {
      temperaturaMin: tempMin,
      temperaturaMax: tempMax,
      umidadeMin: umidMin ?? undefined,
      umidadeMax: umidMax ?? undefined,
    };
    const bucketCom: ConfiguracaoCalendarioDia = { obrigatorio: true, horarios };
    const calendario: ConfiguracaoCalendario = {
      diasUteis: diasUteis ? bucketCom : { ...CALENDARIO_VAZIO },
      sabado: sabado ? bucketCom : { ...CALENDARIO_VAZIO },
      domingo: domingo ? bucketCom : { ...CALENDARIO_VAZIO },
      feriados: feriados ? bucketCom : { ...CALENDARIO_VAZIO },
    };

    const observacoes = String(row[COL_EQUIP.observacoes] ?? '').trim();
    const input: EquipamentoInput = {
      nome,
      tipo,
      localizacao,
      termometroId: '', // resolvido no batch; placeholder pra satisfazer o tipo
      limites,
      calendario,
      status: 'ativo',
      observacoes: observacoes || undefined,
    };
    equipamentos.push({ input, termometroChaveDeImport: termometroSerie });
  });

  return { termometros, equipamentos, erros, warnings };
}

/** Dispara o download do modelo no browser. */
export function downloadCtTemplate(): void {
  const buf = generateCtTemplate();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modelo-controle-temperatura.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
