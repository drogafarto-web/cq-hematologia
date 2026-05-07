# ADR-0014: Audit Trail Extensibility — Centralized vs. Decentralized (Phase 6)

- **Status:** Proposed
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

v1.4 Phase 6 implementa extensão de audit trail para todos eventos críticos (CAPA transitions, NOTIVISA submissions, calibração, treinamento, críticos escalação). ADR-0012 estabeleceu LogicalSignature (HMAC + SHA-256) como padrão para audit events.

**Questão arquitetural:** Centralizar todos events em `/labs/{labId}/audit-trail/` collection (single source of truth)? Ou deixar cada módulo manter seu próprio log (CAPA em `nao-conformidades.transitions`, Críticos em `resultados.critico.transitions`, etc)?

**Contexto regulatório:**
- LGPD Lei 13.709/2018: Direito de acesso = auditor deve poder consultar "quem fez o quê quando" pra qualquer dado sensível.
- RDC 978 Art. 5.3 (Auditoria Interna): "Deve haver evidência documentada de verificação + ação remediadora."
- ISO 15189 §8.4 (Actions): "Rastreabilidade de ações tomadas em resposta a risco/finding."
- Portaria 204/2016 (NOTIVISA): "Receipt de submission à autoridade sanitária é prova de compliance."

**Escala:**
- 25 módulos em produção → cada um gera ~5–50 audit events/dia (críticos, CAPA, liberação, etc.)
- Total: ~500–1,500 audit events/dia
- Storage: ~0.5 KB/event → 250 GB/ano (negligível).
- Queryability: Auditor quer "show me all events for result #123" ou "all events by user X in date range Y".

**Decision point:** Centralizar (global `/audit-trail`) vs. federar (cada módulo seu log) vs. híbrido (app-side aggregation)?

## Problema

Três abordagens, cada com trade-offs:

### 1. Centralizado (/labs/{labId}/audit-trail/{eventId})

**Schema:**
```
/labs/{labId}/audit-trail/{eventId}
├── type: 'capa-transition' | 'critico-escalation' | 'notivisa-submitted' | ...
├── relatedDocId: string  // FK to originating doc (capaId, resultId, etc)
├── module: 'capa-tracking' | 'criticos' | 'notivisa' | ...
├── actor: { uid, email, role }
├── action: { from, to, reason }
├── ts: Timestamp (server)
├── signature: LogicalSignature
└── metadata: { ... module-specific payload }
```

**Pros:**
- Single query: "show me all events for result #123" → 1 collection query + filter on `relatedDocId`.
- Auditor-friendly: One place to grep; doesn't need to know module internals.
- LGPD compliance: "Right to access" query is simple.
- Long-term scalability: If audit trail grows to millions of events, centralized collection benefits from Firestore indexing.

**Cons:**
- Dupla escrita: Cada CF que cria CAPA transition deve escrever BOTH naoConformidades.transitions[] E audit-trail doc. Risk de inconsistência (one write fails, other succeeds).
- Latency: Two writes = 2× slower. CAPA transition now takes 1s instead of 500ms.
- Coupling: audit-trail schema must be generic enough for all 25 modules. Schema creep (too many `metadata.*` fields = hard to understand).
- Eventual consistency: If audit-trail write fails, naoConformidades is sealed but audit-trail is missing. Recovery procedure needed.

### 2. Descentralizado (cada módulo seu log)

**Schema:**
- CAPA: `/labs/{labId}/nao-conformidades/{ncId}` has `transitions[]` (already done)
- Críticos: `/labs/{labId}/resultados/{resultId}` has `critico.transitions[]` (ADR-0013)
- NOTIVISA: `/labs/{labId}/notivisa-outbox/{docId}` has `submissionAttempts[]` (ADR-0014)
- Calibração: `/labs/{labId}/equipamentos/{equipId}` has `calibracoes.history[]`
- Etc.

**Pros:**
- Single write: Each module writes to its own collection. No dupla escrita, no eventual consistency issue.
- Low latency: CAPA transition stays ~500ms (no second write).
- Modularity: Each module owns its log. No cross-module coupling.
- Schema clarity: Each log is module-specific (don't need generic `metadata` blob).

**Cons:**
- Fragmented querying: Auditor wants "all events for patient X" → must query 7+ collections (nao-conformidades, resultados, equipamentos, etc.) and merge in app. Complexity.
- Discoverability: New auditor asks "where's the audit trail?" Answer: "distributed across modules". Less obvious.
- No global ordering: Cross-module timeline is hard (e.g., "on 2026-05-07 14:22, CAPA was created, then equipment calibrated?" → different collections, hard to correlate).
- LGPD "right of access" is burdensome: exporting all events for deletion requires scanning 7+ collections.

### 3. Híbrido (centralized log + module-specific history)

**Schema:**
- `/labs/{labId}/audit-trail/` stores ALL events (centralized, read-only, immutable).
- Each module also stores transitions locally (CAPA.transitions[], Críticos.transitions[], etc.)
- CF writes to BOTH: `auditTrailRef.add(event)` + module-specific update.

**Pros:**
- Best of both: Modules have fast single write (local log). Auditor has unified query point (audit-trail).
- Decoupling: Module logic doesn't know about audit-trail schema; CF layer handles mapping.

**Cons:**
- Still dupla escrita risk (one of two writes fails → inconsistency).
- Storage 2×: Each event stored twice (module log + audit-trail).
- Complexity: Two-source-of-truth is harder to debug (which log is canonical?).

---

**Análise de viabilidade:**

| Approach | Write Latency | Query Simplicity | LGPD Compliance | Consistency Risk |
|----------|---|---|---|---|
| Centralized | +500ms (dupla) | High (1 query) | Easy | Dupla-escrita |
| Decentralized | 0 (single) | Low (7+ queries) | Hard | None |
| Hybrid | +500ms (dupla) | High (1 query) | Easy | Dupla-escrita |

**Decision:** Favor decentralized IF auditor querying burden is low. Auditor queries are infrequent (monthly, not daily) → accept complexity. Favor centralized IF auditor queries are frequent. But realistically, intra-module transitions are more common than cross-module correlation.

## Decisão

**v1.4 Phase 6 adota DECENTRALIZED audit trail pattern.** Cada módulo mantém sua própria transição/evento log (append-only). **Phase 6.1 (post-launch) considera centralizado se auditor feedback exigir.**

### 1. Decentralized Pattern (Phase 6)

**Each module stores transitions locally (append-only):**

```typescript
// CAPA (existing, from ADR-0003)
nao-conformidades/{ncId}
├── transitions: Array<{ from, to, ts, operatorId, signature }>

// Críticos (from ADR-0013)
resultados/{resultId}
├── critico.transitions: Array<{ from, to, ts, operatorId, signature }>

// NOTIVISA (new in Phase 6)
notivisa-outbox/{docId}
├── submissionAttempts: Array<{ ts, status, error?, signature }>

// Equipamentos Calibração
equipamentos/{equipId}
├── calibracoes.history: Array<{ ts, supplier, cert, validated, signature }>

// Treinamentos
treinamentos/{docId}
├── completedAt: Timestamp
├── signature: LogicalSignature

// Personnel Qualificações
members/{userId}
├── qualifications: Array<{ cv_added, supervisor_verified, rt_approved, signatures }>

// Etc. (25 modules, each with append-only transitions/history)
```

**Characteristics:**
- ✅ Immutable (append-only, server-side sealing).
- ✅ Signed (LogicalSignature on each transition).
- ✅ Timestamped (server-side ts, no clock-skew).
- ✅ Chainable (prev_hash field, if audit chain is needed).

### 2. App-Side Aggregation (Auditor Helper)

**Cloud Function `exportAuditTrail` for auditor convenience:**

```typescript
// functions/src/v1.4-audit/exportAuditTrail.ts
async function exportAuditTrail(
  request: functions.https.CallableRequest,
  data: {
    labId: string;
    dateRange: { from: Timestamp, to: Timestamp };
    filters?: { module?: string, userId?: string, type?: string }
  }
): Promise<Array<UnifiedAuditEvent>> {
  // Queries 7+ collections in parallel
  const capaEvents = await queryCAPATransitions(labId, dateRange, filters);
  const criticoEvents = await queryCriticoTransitions(labId, dateRange, filters);
  const notivisaEvents = await queryNotivisaSubmissions(labId, dateRange, filters);
  const equipmentEvents = await queryEquipmentCalibrations(labId, dateRange, filters);
  // ... etc for all modules

  // Merge + sort by ts
  const allEvents: UnifiedAuditEvent[] = [
    ...capaEvents.map(e => ({ type: 'capa-transition', ...e })),
    ...criticoEvents.map(e => ({ type: 'critico-escalation', ...e })),
    ...notivisaEvents.map(e => ({ type: 'notivisa-submission', ...e })),
    ...equipmentEvents.map(e => ({ type: 'equipment-calibration', ...e }))
  ];

  allEvents.sort((a, b) => a.ts.toDate() - b.ts.toDate());
  return allEvents;
}

// Export to PDF/CSV for inspector
async function exportAuditTrailPDF(
  events: UnifiedAuditEvent[],
  labId: string
): Promise<Buffer> {
  // Generate inspector-friendly PDF with:
  // - Event timeline (ts, type, actor, action)
  // - Signature integrity check (verify each hash)
  // - Summary stats (# events by module, # events by user, etc.)
}
```

**Characteristics:**
- ✅ App runs query-aggregation logic (not Firestore burden).
- ✅ Result is unified timeline (auditor sees chronological order).
- ✅ PDF export is inspector-ready (no technical knowledge needed).
- ✅ Inexpensive (CF execution cost, no extra indexing).

### 3. LGPD "Right of Access" Implementation

**Centralized access control (per patient/person):**

```typescript
// functions/src/v1.4-audit/exportEventsForPerson.ts
async function exportEventsForPerson(
  request: functions.https.CallableRequest,
  data: { labId: string; personId: string; personType: 'paciente' | 'operador' }
): Promise<UnifiedAuditEvent[]> {
  // LGPD Article 18: Right to access all data about you

  if (personType === 'paciente') {
    // Return all events related to this patient's results + laudo liberação
    const criticoEvents = await queryCriticoEvents(labId, { pacienteId: personId });
    const laudoEvents = await queryLaudoReleaseEvents(labId, { pacienteId: personId });
    return [...criticoEvents, ...laudoEvents].sort(byTs);
  }

  if (personType === 'operador') {
    // Return all events WHERE operatorId == personId (actions taken by this operator)
    const capaEvents = await queryCAPAEvents(labId, { operatorId: personId });
    const criticoEvents = await queryCriticoEvents(labId, { operatorId: personId });
    // ... etc
    return [...capaEvents, ...criticoEvents, ...].sort(byTs);
  }
}
```

### 4. Cross-Module Correlation (Manual, if needed)

**Example: Auditor wants timeline of single patient's critical result:**

```
2026-05-07 14:15 — Resultado criado (module: analise, analyzer)
2026-05-07 14:22 — Valor crítico detectado (module: criticos)
2026-05-07 14:23 — Notificação enviada SMS (module: criticos)
2026-05-07 14:28 — Operador confirmou recebimento (module: criticos, operatorId: OP-001)
2026-05-07 15:05 — Clínico solicitante marcou "resolvido" (module: criticos)
2026-05-07 16:00 — Laudo liberado por RT (module: liberacao)
```

**How to construct this timeline:**
1. Auditor exports all events for date 2026-05-07
2. Filters by `resultId` across criticos, liberacao, notivisa modules
3. Manually correlates (or script does it) chronologically
4. Result: clear timeline of actions for this critical result

**Auditor burden:** Medium (requires understanding module-specific schemas). But infrequent (quarterly audit). Acceptable.

### 5. Firestore Rules — Audit Trail Protection

```javascript
// firestore.rules — each module protects its transitions/history
match /labs/{labId}/nao-conformidades/{ncId} {
  // transitions[] is append-only (no update, no delete)
  allow update: if !('transitions' in request.resource.data.diff(resource.data).affectedKeys());
  // OR: if transitions array exists, validate it only grew (new items appended)
  allow update: if (
    'transitions' in request.resource.data.diff(resource.data).affectedKeys()
    && request.resource.data.transitions.size() >= resource.data.transitions.size()
  );
}

// Same pattern for criticos.transitions, notivisa.submissionAttempts, etc.
```

## Alternativas consideradas

### Alternativa A — Fully Centralized (/labs/{labId}/audit-trail/)

Write every event to centralized collection + module-specific local (dupla-escrita).

**Pros:**
- Auditor queries are trivial (single collection).
- Timeline is server-side ordered (Firestore handles consistency).

**Cons:**
- Dupla-escrita risk (inconsistency if one write fails).
- Latency penalty (2 writes = slower transactions).
- Schema bloat (audit-trail must be generic for 25 modules).
- Operational burden: if audit-trail collection gets corrupted, recovery is cross-module coordination.

**Rejected:** Dupla-escrita is an anti-pattern in Firestore (eventual consistency issues). Latency penalty is unacceptable for frequently-updated collections (criticos).

### Alternativa B — Event Sourcing (Full rebuild from events)

Every state change is an immutable event. State is reconstructed by replaying events (CQRS pattern).

**Pros:**
- Perfect audit trail (events are source of truth).
- Timestamped causality (event A happened before B).
- Temporal queries ("what was the state on 2026-05-01?").

**Cons:**
- Overkill for Phase 6 scope (event sourcing is architectural, not module-level).
- Latency (replaying events to compute current state is slow).
- Complexity (requires event store + projections).
- Not justified by use case (auditor doesn't ask "what was state on date X?" — they ask "what happened on date X?").

**Rejected:** Defer to v2.0 if long-term temporal queries are needed. Phase 6 only needs "what happened" audit trail, not "what was state" reconstruction.

### Alternativa C — Third-party audit log (Datadog, Sumo Logic, etc.)

Stream all module events to SaaS audit log service (decrypt via CF, stream via API).

**Pros:**
- Professional SaaS backend (retention, querying, alerting included).
- Segregation: audit logs are outside HC Quality (can't be tampered internally).
- SIEM-ready (Datadog integrates with security workflows).

**Cons:**
- Cost (~$50–$200/month depending on volume).
- Latency (async stream to external service, potential data loss if stream fails).
- Privacy concern (PII flows to external service; LGPD implications).
- Overkill for Riopomba single-lab deployment (third-party audit log is v2.0+ feature for multi-tenant SaaS).

**Rejected (v1.4):** Too expensive + too much scope for single-lab deployment. Defer to v2.0+ if multi-tenant SaaS market demands it.

## Consequências

### Positivas

1. **No dupla-escrita risk.** Each module writes once (to itself). Zero eventual consistency issues.
2. **Low latency.** CAPA transition is still ~500ms (single write). No penalty.
3. **Modularity preserved.** CAPA code doesn't know about audit-trail; audit-trail is application concern (CF layer).
4. **LGPD-ready.** `exportEventsForPerson` CF can gather all events about person X across all modules in one call.
5. **Phase 6.1 escape hatch.** If auditor feedback says "I need centralized querying", Phase 6.1 can build `audit-trail` collection as read-only mirror (no more dupla-escrita risk; async mirror via Pub/Sub).

### Negativas

1. **Auditor querying burden.** Without centralized collection, auditor (or script) must know which modules to query. Training needed.
2. **Manual aggregation.** Cross-module timeline requires application-side merge-sort (not server-side).
3. **Module coupling at query time.** Adding a new module means updating `exportAuditTrail` CF to include new module's events.
4. **Discoverability.** New auditor/inspector may not realize audit trails are distributed. Documentation is critical.

### Mitigations

1. **Auditor documentation.** Create `AUDIT_TRAIL_QUERYING.md` guide (which modules to check, how to construct cross-module timeline).
2. **Automation.** `exportAuditTrail` CF is THE tool auditors use (hides complexity). Export to PDF is inspector-friendly.
3. **v1.4 Phase 6.1 (Post-launch):** If auditor says "I need one place to query", Phase 6.1 builds async `audit-trail` mirror (Pub/Sub to write centralized copy; read-only, no dupla-escrita).

## Compromissos derivados

1. **v1.4 Phase 6 deliverables (Decentralized Audit Trail).**
   - Each module ensures `transitions[]` or `history[]` field is append-only (Firestore Rules enforce).
   - LogicalSignature on each transition (ADR-0012 pattern reused).
   - Tests: 6 specs per module (append-only enforcement, signature validation, soft-delete doesn't remove history).

2. **Cloud Function `exportAuditTrail` (auditor helper).**
   - `functions/src/v1.4-audit/exportAuditTrail.ts` — queries all modules, merges, sorts by ts.
   - `functions/src/v1.4-audit/exportAuditTrailPDF.ts` — PDF export (timeline + signature integrity check + summary).
   - E2E test: create 10 events across 5 modules, export PDF, verify timeline correct.

3. **Cloud Function `exportEventsForPerson` (LGPD right of access).**
   - Query all events related to patient X or operator X.
   - Supports "export for deletion" (LGPD Article 17).
   - Tested: 4 specs (patient timeline, operator timeline, deletion request).

4. **Documentation.**
   - `docs/AUDIT_TRAIL_DECENTRALIZED_ARCHITECTURE.md` — explains where audit trails live (per-module).
   - `docs/AUDIT_TRAIL_QUERYING.md` — guide for auditors/inspectors (how to query, how to correlate).
   - `docs/LGPD_AUDIT_TRAIL_PROCEDURES.md` — procedures for "right of access" + "right to deletion".

5. **Monitoring + alerting (operational).**
   - Monitor for "transitions[] array is not growing" (potential data loss).
   - Alert if any module's history field is mutated/deleted (should never happen).
   - Weekly audit trail integrity check: run verifyChainIntegrity across all modules.

6. **Phase 6.1 contingency (post-launch).**
   - If auditor feedback says "I need centralized collection", Phase 6.1 builds `/labs/{labId}/audit-trail/` as async read-only mirror.
   - Pub/Sub Topic `audit-trail-events` (each module publishes after write).
   - Cloud Function subscribes, writes to centralized audit-trail collection.
   - No dupla-escrita risk (write succeeds to module first; mirror is best-effort async).
   - Timeline: 1–2 weeks post-v1.4 launch if needed.

## Referências

- ADR-0003 (nao-conformidades transitions pattern)
- ADR-0012 (LogicalSignature audit trail)
- ADR-0013 (criticos.transitions state machine)
- LGPD Lei 13.709/2018 (direito de acesso, direito ao esquecimento)
- RDC 978/2025 Art. 5.3 (auditoria interna, rastreabilidade)
- ISO 15189:2022 §8.4 (ações tomadas em resposta a riscos)
- v1.4-ROADMAP Phase 6 (Audit Trail Extensibility)

---

**Aplicabilidade:** v1.4 Phase 6 (all modules with audit trail requirements) + Phase 6.1+ (possible centralization).

---

**ADR Status:** PROPOSED (pending CTO review)  
**Review Date:** 2026-05-21 (Phase 6 mid-point: confirm decentralized pattern works + auditor queries are feasible)  
**Phase 6.1 Contingency Gate:** 2026-10-22 (post-launch: assess auditor feedback, decide if centralized mirror needed)
