import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import type {
  AuditLogSection,
  CIQAuditEvent,
  ChainBreak,
  OperacionalStatus,
} from '../types';

// ─── Audit Log Aggregator ────────────────────────────────────────────────────
//
// Lê `/labs/{labId}/ciq-audit` no período. Verifica integridade do hash chain
// e destaca eventos críticos.
//
// Estado de coleta:
//   - Writer (triggers onDocumentWritten) é um rollout separado (Fase 1 do doc).
//   - Quando a coleção está vazia (ainda não começou a popular), retornamos
//     `collectionActive=false` e o PDF renderiza um banner "Coleta iniciada em
//     {data-do-deploy}" em vez de fingir que existem 0 eventos reais.
//
// Performance: cap em MAX_EVENTS — eventos mais antigos ficam na UI web.

const MAX_EVENTS = 2000;
const MAX_RECENT_TIMELINE = 120;
const GENESIS_PREFIX = 'hcq-audit-genesis:';

function genesisHash(labId: string): string {
  return createHash('sha256').update(GENESIS_PREFIX + labId).digest('hex');
}

function severityOrder(s: CIQAuditEvent['severity']): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : 2;
}

function verifyChain(
  labId: string,
  events: CIQAuditEvent[],
): { valid: boolean; breaks: ChainBreak[] } {
  const breaks: ChainBreak[] = [];
  let previousChainHash = genesisHash(labId);

  // Verificação respeita a ordem cronológica já aplicada pelo caller.
  for (const e of events) {
    const expectedChainHash = createHash('sha256')
      .update(previousChainHash + e.contentHash)
      .digest('hex');

    // previousHash gravado no doc também deve bater — sinal de integridade dupla.
    if (e.previousHash !== previousChainHash || e.chainHash !== expectedChainHash) {
      breaks.push({
        eventId: e.id,
        expectedChainHash,
        foundChainHash: e.chainHash,
      });
    }
    previousChainHash = e.chainHash;
  }

  return { valid: breaks.length === 0, breaks };
}

function coerceEvent(
  id: string,
  data: admin.firestore.DocumentData,
): CIQAuditEvent | null {
  const ts = data['timestamp'];
  if (!(ts instanceof admin.firestore.Timestamp)) return null;
  const action = data['action'];
  const severity = data['severity'] ?? 'info';

  return {
    id,
    labId: data['labId'] ?? '',
    moduleId: data['moduleId'] ?? 'unknown',
    timestamp: ts,
    action,
    entityType: data['entityType'] ?? 'run',
    entityId: data['entityId'] ?? '',
    actorUid: data['actorUid'] ?? '',
    actorName: data['actorName'] ?? 'Actor desconhecido',
    actorRole: data['actorRole'] ?? 'desconhecido',
    reason: data['reason'],
    severity,
    previousHash: data['previousHash'] ?? '',
    contentHash: data['contentHash'] ?? '',
    chainHash: data['chainHash'] ?? '',
  };
}

export async function aggregateAuditLog(
  db: admin.firestore.Firestore,
  labId: string,
  from: Date,
  to: Date,
): Promise<AuditLogSection> {
  // 1 probe para saber se a coleção existe / tem dados históricos
  const anySnap = await db
    .collection(`labs/${labId}/ciq-audit`)
    .limit(1)
    .get();

  if (anySnap.empty) {
    return {
      collectionActive: false,
      totalEvents: 0,
      byAction: {},
      bySeverity: { info: 0, warning: 0, critical: 0 },
      byActor: [],
      criticalEvents: [],
      recentEvents: [],
      chain: { eventsVerified: 0, valid: true, breaks: [] },
      truncated: false,
      status: 'ok',
    };
  }

  // Coleta ordenada por timestamp asc — necessário para validar chain
  const snap = await db
    .collection(`labs/${labId}/ciq-audit`)
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(from))
    .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(to))
    .orderBy('timestamp', 'asc')
    .limit(MAX_EVENTS + 1)
    .get();

  const events: CIQAuditEvent[] = [];
  for (const doc of snap.docs) {
    const e = coerceEvent(doc.id, doc.data());
    if (e) events.push(e);
  }

  const truncated = events.length > MAX_EVENTS;
  if (truncated) events.length = MAX_EVENTS;

  const byAction: Record<string, number> = {};
  const bySeverity = { info: 0, warning: 0, critical: 0 };
  type ActorAgg = { actorName: string; actorRole: string; count: number };
  const byActorMap = new Map<string, ActorAgg>();
  const criticalEvents: CIQAuditEvent[] = [];

  for (const e of events) {
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    bySeverity[e.severity]++;
    const key = `${e.actorUid}::${e.actorRole}`;
    const existing = byActorMap.get(key) ?? {
      actorName: e.actorName,
      actorRole: e.actorRole,
      count: 0,
    };
    existing.count++;
    byActorMap.set(key, existing);
    if (e.severity === 'critical') criticalEvents.push(e);
  }

  const byActor = Array.from(byActorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const chain = verifyChain(labId, events);

  // Timeline: últimos N eventos, preferindo severidade alta na vizinhança
  const recentEvents = events
    .slice()
    .sort((a, b) => {
      const t = b.timestamp.toMillis() - a.timestamp.toMillis();
      if (t !== 0) return t;
      return severityOrder(a.severity) - severityOrder(b.severity);
    })
    .slice(0, MAX_RECENT_TIMELINE);

  let status: OperacionalStatus = 'ok';
  if (!chain.valid) status = 'critico';
  else if (bySeverity.critical > 0) status = 'critico';
  else if (bySeverity.warning > 0) status = 'atencao';

  return {
    collectionActive: true,
    totalEvents: events.length,
    byAction,
    bySeverity,
    byActor,
    criticalEvents,
    recentEvents,
    chain: {
      eventsVerified: events.length,
      valid: chain.valid,
      breaks: chain.breaks,
    },
    truncated,
    status,
  };
}
