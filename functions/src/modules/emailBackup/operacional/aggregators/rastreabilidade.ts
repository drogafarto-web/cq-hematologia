import * as admin from 'firebase-admin';
import type {
  LotAlert,
  LotLifecycleRecord,
  OperacionalStatus,
  RastreabilidadeSection,
} from '../types';

// ─── Rastreabilidade Aggregator ──────────────────────────────────────────────
//
// Fonte de dados: labs/{labId}/insumos + labs/{labId}/insumo-movimentacoes
// (chain-hash tamper-evident já implementado).
//
// Para cada lote:
//   - Timeline: entrada → abertura → fechamento → descarte
//   - Uso: runs contabilizados via insumo.runCount (field denormalizado)
//   - Alertas: gaps regulatórios (ANVISA ausente, validade expirada em uso)

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDate(date: Date | admin.firestore.Timestamp | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof admin.firestore.Timestamp ? date.toDate() : date;
  return d.toISOString().slice(0, 10);
}

function toDate(
  value: admin.firestore.Timestamp | null | undefined,
): Date | null {
  if (!value) return null;
  return value.toDate();
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY));
}

/**
 * Agrega movimentações por insumoId para lookup O(1) no pass principal.
 */
interface MovAgg {
  entrada: Date | null;
  abertura: Date | null;
  fechamento: Date | null;
  descarte: Date | null;
}

async function collectMovimentacoes(
  db: admin.firestore.Firestore,
  labId: string,
  insumoIds: Set<string>,
): Promise<Map<string, MovAgg>> {
  if (insumoIds.size === 0) return new Map();

  // Firestore `in` clause limit: 30. Chunk.
  const ids = Array.from(insumoIds);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) {
    chunks.push(ids.slice(i, i + 30));
  }

  const movsPerChunk = await Promise.all(
    chunks.map((chunk) =>
      db
        .collection(`labs/${labId}/insumo-movimentacoes`)
        .where('insumoId', 'in', chunk)
        .get(),
    ),
  );

  const byInsumo = new Map<string, MovAgg>();
  for (const snap of movsPerChunk) {
    for (const doc of snap.docs) {
      const m = doc.data();
      const insumoId: string = m['insumoId'];
      const tipo: string = m['tipo'];
      const ts = toDate(m['timestamp']);
      if (!ts) continue;

      const agg =
        byInsumo.get(insumoId) ??
        { entrada: null, abertura: null, fechamento: null, descarte: null };

      // Para cada tipo guardamos o primeiro `entrada/abertura` (marca início)
      // e o último `fechamento/descarte` (marca fim).
      if (tipo === 'entrada' && (!agg.entrada || ts < agg.entrada)) agg.entrada = ts;
      if (tipo === 'abertura' && (!agg.abertura || ts < agg.abertura)) agg.abertura = ts;
      if (tipo === 'fechamento' && (!agg.fechamento || ts > agg.fechamento))
        agg.fechamento = ts;
      if (tipo === 'descarte' && (!agg.descarte || ts > agg.descarte)) agg.descarte = ts;

      byInsumo.set(insumoId, agg);
    }
  }

  return byInsumo;
}

/**
 * Deriva alertas regulatórios a partir do doc do insumo + timeline.
 */
function computeAlerts(
  insumo: admin.firestore.DocumentData,
  mov: MovAgg,
  now: Date,
): LotAlert[] {
  const alerts: LotAlert[] = [];
  const status: string = insumo['status'] ?? 'ativo';

  const validadeReal = toDate(insumo['validadeReal']);
  const validade = toDate(insumo['validade']);
  const registroAnvisa: string | undefined = insumo['registroAnvisa'];
  const runCount: number = insumo['runCount'] ?? 0;

  if (!registroAnvisa || registroAnvisa.trim() === '') {
    alerts.push({
      code: 'MISSING_ANVISA_REG',
      severity: 'warning',
      message: 'Registro ANVISA ausente — RDC 786 exige em inspeção sanitária.',
    });
  }

  if (status === 'ativo' && validadeReal && validadeReal < now) {
    alerts.push({
      code: 'EXPIRED_IN_USE',
      severity: 'critical',
      message: `Lote ativo com validade expirada em ${validadeReal.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
    });
  }

  if (runCount > 0 && !mov.abertura) {
    alerts.push({
      code: 'OPENED_WITHOUT_DATE',
      severity: 'warning',
      message: 'Runs registrados sem movimentação de abertura formal.',
    });
  }

  const estabilidadeDias: number | undefined = insumo['diasEstabilidadeAbertura'];
  if (mov.abertura && estabilidadeDias && estabilidadeDias > 0) {
    const limitePosAbertura = new Date(mov.abertura);
    limitePosAbertura.setDate(limitePosAbertura.getDate() + estabilidadeDias);
    if (status === 'ativo' && limitePosAbertura < now) {
      alerts.push({
        code: 'POST_OPENING_EXPIRED',
        severity: 'critical',
        message: `Estabilidade pós-abertura (${estabilidadeDias} dias) expirou em ${limitePosAbertura.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
      });
    }
  }

  // `validade` é referenciada apenas no alerta EXPIRED_IN_USE via validadeReal.
  // Signal de "validade próxima" fica por conta da UX do app — evita duplicar
  // fonte de verdade no PDF.
  void validade;

  return alerts;
}

function buildLifecycleRecord(
  docId: string,
  insumo: admin.firestore.DocumentData,
  mov: MovAgg,
  now: Date,
): LotLifecycleRecord {
  const status: string = insumo['status'] ?? 'ativo';
  const dataAbertura = mov.abertura ?? toDate(insumo['dataAbertura']);
  const dataFechamento = mov.fechamento ?? toDate(insumo['closedAt']);
  const dataDescarte = mov.descarte ?? toDate(insumo['descartadoEm']);

  let diasEmUso: number | null = null;
  if (dataAbertura) {
    const endRef = dataFechamento ?? dataDescarte ?? now;
    diasEmUso = daysBetween(dataAbertura, endRef);
  }

  let validadePosAbertura: string | null = null;
  const estabilidadeDias: number | undefined = insumo['diasEstabilidadeAbertura'];
  if (dataAbertura && estabilidadeDias && estabilidadeDias > 0) {
    const d = new Date(dataAbertura);
    d.setDate(d.getDate() + estabilidadeDias);
    validadePosAbertura = isoDate(d);
  }

  const validadeFabricante = isoDate(toDate(insumo['validade']));

  // Aproximação pragmática: aprovalRate por lote não está denormalizado hoje —
  // deixamos null e o PDF mostra "—". Seção 1 (QC Decisions) tem a visão por lote.
  const alerts = computeAlerts(insumo, mov, now);

  const modulos: string[] = Array.isArray(insumo['modulos'])
    ? insumo['modulos']
    : insumo['modulo']
      ? [insumo['modulo']]
      : [];

  return {
    insumoId: docId,
    lotNumber: insumo['lote'] ?? docId,
    tipo: insumo['tipo'] ?? 'insumo',
    nomeComercial: insumo['nomeComercial'] ?? '—',
    fabricante: insumo['fabricante'] ?? '—',
    registroAnvisa: insumo['registroAnvisa'] ?? null,
    validadeFabricante,
    dataEntrada: isoDate(mov.entrada ?? toDate(insumo['createdAt'])),
    dataAbertura: isoDate(dataAbertura),
    dataFechamento: isoDate(dataFechamento),
    dataDescarte: isoDate(dataDescarte),
    diasEmUso,
    validadePosAbertura,
    runsCount: insumo['runCount'] ?? 0,
    approvalRate: null,
    modulosUsados: modulos,
    status,
    alerts,
  };
}

function classifyStatus(records: LotLifecycleRecord[]): {
  status: OperacionalStatus;
  critical: number;
  warning: number;
} {
  let critical = 0;
  let warning = 0;
  for (const r of records) {
    for (const a of r.alerts) {
      if (a.severity === 'critical') critical++;
      else warning++;
    }
  }
  if (critical > 0) return { status: 'critico', critical, warning };
  if (warning > 0) return { status: 'atencao', critical, warning };
  return { status: 'ok', critical, warning };
}

export async function aggregateRastreabilidade(
  db: admin.firestore.Firestore,
  labId: string,
  from: Date,
  to: Date,
): Promise<RastreabilidadeSection> {
  // Janela de interesse: lotes ativos hoje + lotes fechados/descartados no período.
  const insumosSnap = await db.collection(`labs/${labId}/insumos`).get();
  if (insumosSnap.empty) {
    return {
      activeLots: [],
      closedLots: [],
      alertsCount: { critical: 0, warning: 0 },
      status: 'ok',
    };
  }

  const relevant: Array<{ id: string; data: admin.firestore.DocumentData }> = [];
  for (const doc of insumosSnap.docs) {
    const d = doc.data();
    const status: string = d['status'] ?? 'ativo';
    if (status === 'ativo') {
      relevant.push({ id: doc.id, data: d });
      continue;
    }
    // Inclui se o fim-de-vida caiu no período
    const closedAt = toDate(d['closedAt']);
    const descartadoEm = toDate(d['descartadoEm']);
    const endRef = descartadoEm ?? closedAt;
    if (endRef && endRef >= from && endRef <= to) {
      relevant.push({ id: doc.id, data: d });
    }
  }

  if (relevant.length === 0) {
    return {
      activeLots: [],
      closedLots: [],
      alertsCount: { critical: 0, warning: 0 },
      status: 'ok',
    };
  }

  const movsByInsumo = await collectMovimentacoes(
    db,
    labId,
    new Set(relevant.map((r) => r.id)),
  );

  const now = new Date();
  const all: LotLifecycleRecord[] = relevant.map(({ id, data }) =>
    buildLifecycleRecord(
      id,
      data,
      movsByInsumo.get(id) ?? {
        entrada: null,
        abertura: null,
        fechamento: null,
        descarte: null,
      },
      now,
    ),
  );

  const activeLots = all.filter((r) => r.status === 'ativo');
  const closedLots = all.filter((r) => r.status !== 'ativo');
  const { status, critical, warning } = classifyStatus(all);

  // Ordena: alertas críticos primeiro, depois por dataAbertura desc
  const alertSortKey = (r: LotLifecycleRecord): number => {
    if (r.alerts.some((a) => a.severity === 'critical')) return 0;
    if (r.alerts.length > 0) return 1;
    return 2;
  };
  activeLots.sort((a, b) => {
    const k = alertSortKey(a) - alertSortKey(b);
    if (k !== 0) return k;
    return (b.dataAbertura ?? '').localeCompare(a.dataAbertura ?? '');
  });
  closedLots.sort((a, b) => (b.dataFechamento ?? '').localeCompare(a.dataFechamento ?? ''));

  return {
    activeLots,
    closedLots,
    alertsCount: { critical, warning },
    status,
  };
}
