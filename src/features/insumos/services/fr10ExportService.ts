/**
 * fr10ExportService — agrega dados de movimentações e insumos para gerar
 * o payload do FR-10 (Rastreabilidade de Insumos, Ver.00) digital.
 *
 * Escopo: reagentes de UM módulo (hematologia/coagulacao/uroanalise/imunologia)
 * num período definido. Cada linha do FR-10 é um ciclo de vida de lote
 * (abertura → término). Lotes ainda em uso aparecem com término vazio.
 *
 * O payload é determinístico: ordenação de linhas por data de abertura asc,
 * tiebreaker por insumoId lexicográfico asc. Hash SHA-256 sobre canonical
 * permite validação externa (QR) sem acesso ao Firestore.
 *
 * Referência física: FR-10 Ver.00 Labclin MG (2024-2025). Layout reproduzido
 * em FR10Print.tsx.
 */

import {
  db,
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type {
  Insumo,
  InsumoModulo,
  InsumoMovimentacao,
  InsumoMovimentacaoTipo,
  InsumoReagente,
} from '../types/Insumo';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Dados do fornecedor resolvidos para a linha do FR-10. Precedência:
 *   1. Join por `insumo.notaFiscalId → NotaFiscal → Fornecedor` (modelo Fase E).
 *   2. Fallback pros campos legados `insumo.fornecedor` (string livre) —
 *      backward-compat com docs pré-Fase E. Nesse caso `cnpj` fica ausente.
 *   3. Se nenhuma fonte → objeto ausente.
 */
export interface FR10Fornecedor {
  razaoSocial: string;
  cnpj?: string;
  inscricaoEstadual?: string;
}

export interface FR10NotaFiscal {
  numero: string;
  serie?: string;
  chaveAcesso?: string;
  dataEmissao?: Date;
}

/**
 * Uma linha do formulário FR-10 — corresponde a um ciclo de vida de lote
 * (abertura → término). Pode ter término vazio se o lote ainda está em uso.
 */
export interface FR10Row {
  insumoId: string;
  nomeComercial: string;
  fabricante: string;
  lote: string;
  validade: Date;

  aberturaMovId: string;
  dataAbertura: Date;
  operadorAbertura: string;

  /** Preenchidos só se o lote já foi fechado/descartado. */
  terminoMovId?: string;
  dataTermino?: Date;
  operadorTermino?: string;
  motivoTermino?: Extract<InsumoMovimentacaoTipo, 'fechamento' | 'descarte'>;
  motivoDescarte?: string;

  /** Fase E (2026-04-21) — rastreabilidade fiscal RDC 786/2023 art. 42. */
  fornecedor?: FR10Fornecedor;
  notaFiscal?: FR10NotaFiscal;
}

export interface FR10Payload {
  labId: string;
  labName: string;
  labCnpj?: string;
  equipamento: string; // livre, capturado do usuário (ex: "Yumizen H550")
  modulo: InsumoModulo;
  periodoInicio: Date;
  periodoFim: Date;
  rows: FR10Row[];
  generatedAt: Date;
  generatedBy: { uid: string; displayName: string };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

interface BuildArgs {
  labId: string;
  labName: string;
  labCnpj?: string;
  equipamento: string;
  modulo: InsumoModulo;
  periodoInicio: Date;
  periodoFim: Date;
  generatedBy: { uid: string; displayName: string };
}

/**
 * Agrega reagentes do módulo + suas movimentações no período. Retorna payload
 * determinístico pronto para render/hash.
 */
export async function buildFR10Payload(args: BuildArgs): Promise<FR10Payload> {
  try {
    const reagentes = await fetchReagentesByModulo(args.labId, args.modulo);
    if (reagentes.length === 0) {
      return emptyPayload(args);
    }

    const reagenteIds = new Set(reagentes.map((r) => r.id));
    const [movs, notasById, fornecedoresById] = await Promise.all([
      fetchMovimentacoesForInsumos(args.labId, reagenteIds),
      fetchNotasFiscaisByIds(args.labId, collectNotaIds(reagentes)),
      fetchFornecedoresMap(args.labId),
    ]);

    const rows = buildRowsFromMovimentacoes(
      reagentes,
      movs,
      args.periodoInicio,
      args.periodoFim,
      notasById,
      fornecedoresById,
    );
    rows.sort(canonicalRowOrder);

    return {
      labId: args.labId,
      labName: args.labName,
      labCnpj: args.labCnpj,
      equipamento: args.equipamento,
      modulo: args.modulo,
      periodoInicio: args.periodoInicio,
      periodoFim: args.periodoFim,
      rows,
      generatedAt: new Date(),
      generatedBy: args.generatedBy,
    };
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

function emptyPayload(args: BuildArgs): FR10Payload {
  return {
    labId: args.labId,
    labName: args.labName,
    labCnpj: args.labCnpj,
    equipamento: args.equipamento,
    modulo: args.modulo,
    periodoInicio: args.periodoInicio,
    periodoFim: args.periodoFim,
    rows: [],
    generatedAt: new Date(),
    generatedBy: args.generatedBy,
  };
}

async function fetchReagentesByModulo(
  labId: string,
  modulo: InsumoModulo,
): Promise<InsumoReagente[]> {
  const col = collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMOS);
  const snap = await getDocs(
    query(col, where('tipo', '==', 'reagente'), where('modulo', '==', modulo)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Insumo, 'id'>) }) as InsumoReagente);
}

async function fetchMovimentacoesForInsumos(
  labId: string,
  insumoIds: Set<string>,
): Promise<InsumoMovimentacao[]> {
  const col = collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMO_MOVIMENTACOES);
  // Query flat — filtrar por insumoId na memória. Evita limitação do `in` (30) e
  // permite que qualquer volume escale sem lógica de chunking. Volume esperado
  // para um módulo: poucos milhares de movs por ano (piloto com 3-5 reagentes).
  const snap = await getDocs(query(col, orderBy('timestamp', 'asc')));
  return snap.docs
    .map(
      (d) => ({ id: d.id, ...(d.data() as Omit<InsumoMovimentacao, 'id'>) }) as InsumoMovimentacao,
    )
    .filter((m) => insumoIds.has(m.insumoId));
}

/**
 * Coleta os notaFiscalId únicos dos reagentes que serão lidos — evita
 * carregar coleção inteira de notas fiscais no build (pode ter milhares).
 * Retorna Set vazio se nenhum reagente aponta pra nota.
 */
function collectNotaIds(reagentes: InsumoReagente[]): Set<string> {
  const ids = new Set<string>();
  for (const r of reagentes) {
    if (r.notaFiscalId) ids.add(r.notaFiscalId);
  }
  return ids;
}

/**
 * Carrega notas fiscais por ID. Faz uma varredura das notas do lab e filtra —
 * mesmo pattern do fetch de movimentações. Volume esperado de notas num lab:
 * dezenas a baixas centenas por ano; scan flat é aceitável.
 */
async function fetchNotasFiscaisByIds(
  labId: string,
  notaIds: Set<string>,
): Promise<Map<string, { fornecedorId: string; numero: string; serie?: string; chaveAcesso?: string; dataEmissao?: Timestamp }>> {
  const result = new Map<
    string,
    { fornecedorId: string; numero: string; serie?: string; chaveAcesso?: string; dataEmissao?: Timestamp }
  >();
  if (notaIds.size === 0) return result;

  const col = collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.NOTAS_FISCAIS);
  const snap = await getDocs(col);
  for (const d of snap.docs) {
    if (!notaIds.has(d.id)) continue;
    const data = d.data() as {
      fornecedorId: string;
      numero: string;
      serie?: string;
      chaveAcesso?: string;
      dataEmissao?: Timestamp;
    };
    result.set(d.id, {
      fornecedorId: data.fornecedorId,
      numero: data.numero,
      ...(data.serie && { serie: data.serie }),
      ...(data.chaveAcesso && { chaveAcesso: data.chaveAcesso }),
      ...(data.dataEmissao && { dataEmissao: data.dataEmissao }),
    });
  }
  return result;
}

/**
 * Carrega todos os fornecedores do lab em mapa por ID. Volume esperado:
 * dezenas — carregar tudo é aceitável.
 */
async function fetchFornecedoresMap(
  labId: string,
): Promise<Map<string, { razaoSocial: string; cnpj: string; inscricaoEstadual?: string }>> {
  const result = new Map<string, { razaoSocial: string; cnpj: string; inscricaoEstadual?: string }>();
  const col = collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.FORNECEDORES);
  const snap = await getDocs(col);
  for (const d of snap.docs) {
    const data = d.data() as { razaoSocial: string; cnpj: string; inscricaoEstadual?: string };
    result.set(d.id, {
      razaoSocial: data.razaoSocial,
      cnpj: data.cnpj,
      ...(data.inscricaoEstadual && { inscricaoEstadual: data.inscricaoEstadual }),
    });
  }
  return result;
}

/**
 * Constrói linhas FR-10 a partir das movimentações.
 *
 * Regras:
 *  - Uma linha = 1 abertura + (opcional) 1 término (fechamento ou descarte).
 *  - Aberturas órfãs (lote ainda em uso) viram linha com término vazio.
 *  - Entrada não gera linha (FR-10 é sobre uso, não estoque).
 *  - Filtro de período: linha entra se (abertura OU término) cai no período.
 *    Lotes abertos antes do período mas fechados dentro aparecem.
 */
function buildRowsFromMovimentacoes(
  reagentes: InsumoReagente[],
  movs: InsumoMovimentacao[],
  from: Date,
  to: Date,
  notasById: Map<string, { fornecedorId: string; numero: string; serie?: string; chaveAcesso?: string; dataEmissao?: Timestamp }>,
  fornecedoresById: Map<string, { razaoSocial: string; cnpj: string; inscricaoEstadual?: string }>,
): FR10Row[] {
  const byId = new Map(reagentes.map((r) => [r.id, r]));
  const movsByInsumo = new Map<string, InsumoMovimentacao[]>();
  for (const m of movs) {
    const list = movsByInsumo.get(m.insumoId) ?? [];
    list.push(m);
    movsByInsumo.set(m.insumoId, list);
  }

  const rows: FR10Row[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const [insumoId, insumoMovs] of movsByInsumo.entries()) {
    const reagente = byId.get(insumoId);
    if (!reagente) continue;

    // Resolve fornecedor/nota uma vez por insumo. Precedência: notaFiscalId (joins)
    // → fallback string legado (só em tira-uro, mas deixamos genérico).
    const { fornecedor, notaFiscal } = resolveRastreabilidadeFiscal(
      reagente,
      notasById,
      fornecedoresById,
    );

    // Já ordenado por timestamp asc (query fez orderBy).
    // Reconstroi pares abertura→término cronologicamente. Se aparecer outra
    // abertura sem término intermediário, a primeira entra como órfã.
    let pendingAbertura: InsumoMovimentacao | null = null;

    const pushRow = (
      abertura: InsumoMovimentacao,
      termino: InsumoMovimentacao | null,
    ): void => {
      const aMs = abertura.timestamp.toMillis();
      const tMs = termino?.timestamp.toMillis();
      const touchesPeriod =
        (aMs >= fromMs && aMs <= toMs) ||
        (tMs !== undefined && tMs >= fromMs && tMs <= toMs) ||
        // caso: abertura antes, término depois (ou ainda aberto) — período cai dentro
        (aMs < fromMs && (tMs === undefined || tMs > toMs));
      if (!touchesPeriod) return;

      rows.push({
        insumoId,
        nomeComercial: reagente.nomeComercial,
        fabricante: reagente.fabricante,
        lote: reagente.lote,
        validade: reagente.validade.toDate(),
        aberturaMovId: abertura.id,
        dataAbertura: abertura.timestamp.toDate(),
        operadorAbertura: abertura.operadorName,
        ...(termino && {
          terminoMovId: termino.id,
          dataTermino: termino.timestamp.toDate(),
          operadorTermino: termino.operadorName,
          motivoTermino:
            termino.tipo === 'descarte' ? ('descarte' as const) : ('fechamento' as const),
          ...(termino.motivo && { motivoDescarte: termino.motivo }),
        }),
        ...(fornecedor && { fornecedor }),
        ...(notaFiscal && { notaFiscal }),
      });
    };

    for (const m of insumoMovs) {
      if (m.tipo === 'entrada') continue;
      if (m.tipo === 'abertura') {
        if (pendingAbertura) {
          // Abertura anterior ficou órfã — registra sem término.
          pushRow(pendingAbertura, null);
        }
        pendingAbertura = m;
      } else if (m.tipo === 'fechamento' || m.tipo === 'descarte') {
        if (pendingAbertura) {
          pushRow(pendingAbertura, m);
          pendingAbertura = null;
        }
        // Fechamento/descarte sem abertura prévia → inconsistência de dados.
        // Ignorado silenciosamente — não emite linha artificial.
      }
    }

    // Abertura ainda pendente (lote em uso) — registra com término vazio.
    if (pendingAbertura) {
      pushRow(pendingAbertura, null);
    }
  }

  return rows;
}

function canonicalRowOrder(a: FR10Row, b: FR10Row): number {
  const diff = a.dataAbertura.getTime() - b.dataAbertura.getTime();
  if (diff !== 0) return diff;
  return a.insumoId.localeCompare(b.insumoId);
}

/**
 * Resolve fornecedor/nota pra uma linha. Ordem de precedência:
 *   1. `insumo.notaFiscalId` → lookup em notas + fornecedores (modelo Fase E).
 *   2. Campos legados string (`insumo.fornecedor`, `insumo.notaFiscal`) —
 *      só em tira-uro historicamente, mas o helper é tipo-agnóstico. Sem CNPJ
 *      nesse caminho — FR-10 sai com razão social só.
 *   3. Nenhum dos dois → retorna { undefined, undefined }.
 */
function resolveRastreabilidadeFiscal(
  insumo: InsumoReagente,
  notasById: Map<string, { fornecedorId: string; numero: string; serie?: string; chaveAcesso?: string; dataEmissao?: Timestamp }>,
  fornecedoresById: Map<string, { razaoSocial: string; cnpj: string; inscricaoEstadual?: string }>,
): { fornecedor?: FR10Fornecedor; notaFiscal?: FR10NotaFiscal } {
  if (insumo.notaFiscalId) {
    const nota = notasById.get(insumo.notaFiscalId);
    if (nota) {
      const forn = fornecedoresById.get(nota.fornecedorId);
      return {
        ...(forn && {
          fornecedor: {
            razaoSocial: forn.razaoSocial,
            cnpj: forn.cnpj,
            ...(forn.inscricaoEstadual && { inscricaoEstadual: forn.inscricaoEstadual }),
          },
        }),
        notaFiscal: {
          numero: nota.numero,
          ...(nota.serie && { serie: nota.serie }),
          ...(nota.chaveAcesso && { chaveAcesso: nota.chaveAcesso }),
          ...(nota.dataEmissao && { dataEmissao: nota.dataEmissao.toDate() }),
        },
      };
    }
  }

  // Fallback legado — só tira-uro tem essas strings hoje. Lemos com cast
  // seguro porque o shape não está no tipo InsumoReagente.
  const legacy = insumo as unknown as { fornecedor?: string; notaFiscal?: string };
  const out: { fornecedor?: FR10Fornecedor; notaFiscal?: FR10NotaFiscal } = {};
  if (legacy.fornecedor && legacy.fornecedor.trim()) {
    out.fornecedor = { razaoSocial: legacy.fornecedor.trim() };
  }
  if (legacy.notaFiscal && legacy.notaFiscal.trim()) {
    out.notaFiscal = { numero: legacy.notaFiscal.trim() };
  }
  return out;
}

// ─── Canonical + Hash ────────────────────────────────────────────────────────

/**
 * Produz string JSON canônica do payload — ordem de chaves fixa, datas em
 * ISO8601 UTC. Mesma entrada sempre produz mesma saída.
 * Exportado para testes e para o endpoint de validação.
 */
export function canonicalFR10(payload: FR10Payload): string {
  return JSON.stringify({
    labId: payload.labId,
    labName: payload.labName,
    cnpj: payload.labCnpj ?? '',
    modulo: payload.modulo,
    equipamento: payload.equipamento,
    periodoInicio: payload.periodoInicio.toISOString(),
    periodoFim: payload.periodoFim.toISOString(),
    generatedAt: payload.generatedAt.toISOString(),
    generatedByUid: payload.generatedBy.uid,
    rows: payload.rows.map((r) => ({
      insumoId: r.insumoId,
      lote: r.lote,
      validade: r.validade.toISOString(),
      aberturaMovId: r.aberturaMovId,
      dataAbertura: r.dataAbertura.toISOString(),
      operadorAbertura: r.operadorAbertura,
      ...(r.terminoMovId && {
        terminoMovId: r.terminoMovId,
        dataTermino: r.dataTermino?.toISOString() ?? '',
        operadorTermino: r.operadorTermino ?? '',
        motivoTermino: r.motivoTermino ?? '',
        ...(r.motivoDescarte && { motivoDescarte: r.motivoDescarte }),
      }),
      // Fase E — rastreabilidade fiscal embarcada no canonical. Alterar o
      // shape aqui invalida hashes antigos (aceitável — Fase E começa o
      // reloop de emissões). Campos opcionais só entram quando presentes
      // pra que docs sem nota mantenham canonical curto.
      ...(r.fornecedor && {
        fornecedor: {
          razaoSocial: r.fornecedor.razaoSocial,
          ...(r.fornecedor.cnpj && { cnpj: r.fornecedor.cnpj }),
          ...(r.fornecedor.inscricaoEstadual && {
            inscricaoEstadual: r.fornecedor.inscricaoEstadual,
          }),
        },
      }),
      ...(r.notaFiscal && {
        notaFiscal: {
          numero: r.notaFiscal.numero,
          ...(r.notaFiscal.serie && { serie: r.notaFiscal.serie }),
          ...(r.notaFiscal.chaveAcesso && { chaveAcesso: r.notaFiscal.chaveAcesso }),
          ...(r.notaFiscal.dataEmissao && {
            dataEmissao: r.notaFiscal.dataEmissao.toISOString(),
          }),
        },
      }),
    })),
  });
}

/**
 * SHA-256 hex do canonical. Via Web Crypto — mesmo padrão do
 * movimentacaoSignature para consistência com auditor offline.
 */
export async function computeFR10Hash(payload: FR10Payload): Promise<string> {
  const canonical = canonicalFR10(payload);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Emissão persistida (habilita QR / validateFR10) ─────────────────────────

/**
 * Registro persistente de uma emissão de FR-10. A Cloud Function pública
 * `validateFR10` lê este doc para responder ao QR: "sim, este hash foi emitido
 * pelo lab X em Y por usuário Z, cobre período W, tem N linhas."
 *
 * O doc é indexado pelo próprio hash — garante unicidade e permite lookup
 * sem query. Se o mesmo hash for re-emitido (ex: PDF reimpresso sem mudanças),
 * `setDoc` com merge:true atualiza `lastPrintedAt` mantendo `emittedAt` do
 * primeiro registro.
 */
export interface FR10EmissionRecord {
  hash: string;
  labId: string;
  labName: string;
  labCnpj?: string;
  modulo: string;
  equipamento: string;
  periodoInicio: Timestamp;
  periodoFim: Timestamp;
  emittedAt: Timestamp;
  lastPrintedAt: Timestamp;
  emittedByUid: string;
  emittedByName: string;
  rowCount: number;
}

function emissionsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.FR10_EMISSIONS);
}

function emissionRef(labId: string, hash: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.FR10_EMISSIONS, hash);
}

/**
 * Persiste o registro da emissão. Idempotente: se o hash já existe, só atualiza
 * `lastPrintedAt`. Rules obrigam presença dos campos e que `hash` (no path)
 * bata com `hash` (no doc) — evita colisão forçada por cliente adversarial.
 */
export async function saveFR10Emission(
  payload: FR10Payload,
  hash: string,
): Promise<void> {
  try {
    const periodoInicio = Timestamp.fromDate(payload.periodoInicio);
    const periodoFim = Timestamp.fromDate(payload.periodoFim);
    const emittedAt = Timestamp.fromDate(payload.generatedAt);

    // setDoc com merge — se já existe (re-print), atualiza só lastPrintedAt
    // sem apagar o emittedAt original.
    await setDoc(
      emissionRef(payload.labId, hash),
      {
        hash,
        labId: payload.labId,
        labName: payload.labName,
        ...(payload.labCnpj !== undefined && { labCnpj: payload.labCnpj }),
        modulo: payload.modulo,
        equipamento: payload.equipamento,
        periodoInicio,
        periodoFim,
        emittedAt,
        lastPrintedAt: serverTimestamp(),
        emittedByUid: payload.generatedBy.uid,
        emittedByName: payload.generatedBy.displayName,
        rowCount: payload.rows.length,
      },
      { merge: true },
    );
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Busca emissões de FR-10 de um lab. Usado em audit view / timeline.
 * Não usado em hot paths — fine para múltiplos reads.
 */
export async function listFR10Emissions(labId: string, limit = 50): Promise<FR10EmissionRecord[]> {
  try {
    const snap = await getDocs(query(emissionsCol(labId), orderBy('lastPrintedAt', 'desc')));
    return snap.docs
      .slice(0, limit)
      .map((d) => ({ ...(d.data() as Omit<FR10EmissionRecord, 'hash'>), hash: d.id }));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
