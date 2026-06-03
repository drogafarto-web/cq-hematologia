# ADR-0013: Critical Results State Machine — NORMAL → CRITICO → ALERTADO → RESOLVIDO

- **Status:** Proposed
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

v1.4 Phase 5 implementa notificação de resultados críticos (valores fora do range de referência que requerem ação imediata). RDC 978 Art. 184–191 exige rastreabilidade completa: qual resultado é crítico, quem foi notificado, quando, por qual meio, e qual ação foi tomada.

Laboratório clínico define limites críticos por analito (ex: glicose < 40 mg/dL, K > 6.5 mEq/L). Quando resultado ultrapassa limite, 4 estados sequenciais devem ser rastreados:

1. **NORMAL** — resultado dentro de range; nenhuma notificação necessária
2. **CRITICO** — resultado ultrapassa limite; notificação gerada (SMS/email/push)
3. **ALERTADO** — operador recebeu notificação e confirmou recebimento
4. **RESOLVIDO** — ação clínica foi tomada (clínico interveio, paciente contactado)

**Questão arquitetural:** Implementar como state machine enum (CRITICO status único) vs. flat flags (`isCritico`, `hasBeenAlerted`, `isResolved` independentes)?

**Contexto regulatório:**

- RDC 978 Art. 184: "Resultados críticos devem ser comunicados imediatamente ao clínico solicitante ou responsável."
- DICQ 4.7: "Rastreabilidade de críticos: documentar notificação + recepção + ação."

## Problema

Três pressões conflitantes:

1. **Simplicidade (flat flags):** `isCritico`, `hasBeenAlerted`, `isResolved` são 3 booleans. Implementação rápida (2 dias). Problema: invalid state combos podem ocorrer (ex: `isResolved=true` mas `hasBeenAlerted=false`). Auditor vê inconsistência.

2. **Correção (state machine):** Estados exclusivos + transições validadas server-side. Impossível chegar estado inválido (ex: RESOLVIDO sem passar por ALERTADO). Problema: implementação mais complexa (Cloud Function triggers, Firestore Rules restrições). 4–5 dias.

3. **Extensibilidade (future):** Phase 6 (Audit Trail Extensibility) pode precisar rastrear cada transição de estado com LogicalSignature (HMAC). Se flat flags, retrofit é árduo (que booleans mudaram? ordem importa?). Se state machine desde Day 1, transições são explícitas (fácil audit).

**Decision point:** CAPA-style state machine (como em ADR-0003, naoConformidades) é padrão HC Quality; estender para críticos?

## Decisão

**v1.4 Phase 5 adota state machine enum (`CriticoStatus`) com transições validadas server-side.**

### 1. CriticoStatus State Machine

```typescript
type CriticoStatus = 'normal' | 'critico' | 'alertado' | 'resolvido';

// Transições válidas (enforced server-side CF)
const validTransitions: Record<CriticoStatus, CriticoStatus[]> = {
  normal: ['critico'], // valor muda (dentro range → fora range)
  critico: ['alertado'], // operador confirma recebimento
  alertado: ['resolvido'], // ação clínica tomada
  resolvido: ['normal'], // follow-up (novo resultado normal)
};
```

### 2. Firestore Schema (Resultado doc with embedded crítico tracking)

```
/labs/{labId}/resultados/{resultId}
├── status: 'pending' | 'released'      // Clinical status (existing)
├── critico: {                          // NEW: Crítico lifecycle
│   ├── status: CriticoStatus           // Current state (enum)
│   ├── transitions: Array<{            // Immutable history (append-only)
│   │   ├── from: CriticoStatus
│   │   ├── to: CriticoStatus
│   │   ├── ts: Timestamp               // Server timestamp
│   │   ├── operatorId: string          // request.auth.uid
│   │   ├── reason?: string             // Why transition (e.g., "paciente contactado")
│   │   └── signature: LogicalSignature // Hash chain (Phase 6 linkage)
│   │
│   ├── notification: {                 // Tracking of alert sent
│   │   ├── sentTs: Timestamp           // When notification was sent
│   │   ├── method: 'sms' | 'email' | 'push'
│   │   ├── recipient: string           // Phone or email
│   │   ├── confirmReceivedTs?: Timestamp
│   │   ├── confirmReceivedBy?: string  // operatorId who confirmed
│   │   └── deliveryStatus: 'pending' | 'delivered' | 'failed'
│   │
│   └── resolution: {                   // Action taken
│       ├── takenAt?: Timestamp
│       ├── takenBy?: string            // operatorId (clinician/supervisor)
│       ├── actionDescription?: string  // What action was taken
│       └── resultFollowUp?: string     // e.g., "novo valor 105 (normal)"
│
└── ... (analito, valor, range, etc — existing fields)
```

### 3. Cloud Function: transitionCriticoStatus Callable

**Enforces valid transitions + generates notification:**

```typescript
// functions/src/v1.4-criticos/transitionCriticoStatus.ts
async function transitionCriticoStatus(
  request: functions.https.CallableRequest,
  data: {
    labId: string;
    resultId: string;
    newStatus: CriticoStatus;
    reason?: string;
  },
): Promise<{ success: boolean; newTransition: CriticoTransition }> {
  const { labId, resultId, newStatus, reason } = data;

  // 1. Validate auth + labId
  const uid = request.auth?.uid;
  if (!uid) throw new Error('Not authenticated');

  // 2. Read current state
  const docRef = db.collection('labs').doc(labId).collection('resultados').doc(resultId);
  const doc = await docRef.get();
  const { critico } = doc.data();
  const currentStatus = critico?.status || 'normal';

  // 3. Validate transition
  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`);
  }

  // 4. Generate transition + LogicalSignature
  const transition: CriticoTransition = {
    from: currentStatus,
    to: newStatus,
    ts: admin.firestore.Timestamp.now(),
    operatorId: uid,
    reason,
    signature: await generateLogicalSignature({
      labId,
      resultId,
      currentStatus,
      newStatus,
      uid,
    }),
  };

  // 5. Trigger notification (if normal → critico)
  if (currentStatus === 'normal' && newStatus === 'critico') {
    await notificaCritico(labId, resultId, doc.data());
  }

  // 6. Update Firestore (append transition to history)
  await docRef.update({
    'critico.status': newStatus,
    'critico.transitions': admin.firestore.FieldValue.arrayUnion(transition),
  });

  return { success: true, newTransition: transition };
}
```

### 4. Firestore Rules — State Machine Validation

```javascript
// firestore.rules (excerpt)
match /labs/{labId}/resultados/{resultId} {
  // Client can update resultado.status only
  allow update: if request.resource.data.status in ['pending', 'released'];

  // Cloud Function (via service context) updates critico
  // Client CANNOT directly update critico.status
  allow update: if request.auth.uid == null  // service context only
    && 'critico' in request.resource.data.diff(resource.data).affectedKeys()
    && validateCriticoTransition(
        resource.data.critico.status,
        request.resource.data.critico.status
      );

  // Helper function
  function validateCriticoTransition(fromStatus, toStatus) {
    return (
      (fromStatus == 'normal' && toStatus == 'critico') ||
      (fromStatus == 'critico' && toStatus == 'alertado') ||
      (fromStatus == 'alertado' && toStatus == 'resolvido') ||
      (fromStatus == 'resolvido' && toStatus == 'normal')
    );
  }

  // Read allowed for lab members
  allow read: if isActiveMember();
}
```

### 5. Notification Trigger (SLA Enforcement)

**Cloud Function triggers when resultado transitions normal → critico:**

```typescript
// functions/src/v1.4-criticos/notificaCritico.ts
async function notificaCritico(labId: string, resultId: string, resultData: Resultado) {
  const { analito, valor, range, pacienteEmail, clinicoPhone } = resultData;

  // Send SMS + Email (idempotent; check if already sent)
  const notification = {
    sentTs: admin.firestore.Timestamp.now(),
    method: 'sms' | 'email',
    recipient: clinicoPhone || pacienteEmail,
    deliveryStatus: 'pending',
  };

  // Queue async: send SMS via Twilio + email via Resend
  await sendNotification({
    to: clinicoPhone,
    message: `CRÍTICO: ${analito} = ${valor} (range ${range}) - Resultado ${resultId}`,
  });

  // Update notification field (track sent)
  await db.collection('labs').doc(labId).collection('resultados').doc(resultId).update({
    'critico.notification': notification,
  });
}
```

### 6. Regulatory Alignment (RDC 978 Art. 184–191)

**Art. 184–191 exigências:**

- ✅ Resultado crítico identificado (via limites configuráveis em `labSettings`)
- ✅ Notificação imediata documentada (Field: `critico.notification.sentTs`)
- ✅ Recepção confirmada (Field: `critico.notification.confirmReceivedTs`)
- ✅ Ação tomada documentada (Field: `critico.resolution.actionDescription`)
- ✅ Rastreabilidade: quem? quando? (Fields: `operatorId`, `ts`)
- ✅ Audit trail imutável (Field: `transitions[]` append-only)

Auditor export:

```
Select all resultados where critico.status != 'normal'
  → PDF report: analito, valor, notificação, recepção, ação, timestamps
```

## Alternativas consideradas

### Alternativa A — Flat flags (boolean approach)

```typescript
interface CriticoTracking {
  isCritico: boolean;
  hasBeenAlerted: boolean;
  isResolved: boolean;
  alertSentAt?: Timestamp;
  resolvedAt?: Timestamp;
}
```

**Pros:**

- Simples de implementar (2 dias)
- Client pode atualizar (menos CF triggers)

**Cons:**

- Invalid combos possíveis: `isCritico=false` + `hasBeenAlerted=true`? Inconsistência.
- Auditor vê "foi alertado?" sem contexto de ordem.
- Sem transições explícitas, Phase 6 audit trail retrofit é árduo.
- Não segue padrão CAPA (estado machine) estabelecido em ADR-0003.

**Rejected:** Violates consistency + audit trail design. Flat flags só funcionam para features sem auditoria crítica.

### Alternativa B — Separate collection (`criticos-escalacoes`)

Cada resultado crítico cria doc em `/labs/{labId}/criticos-escalacoes/{docId}` (linked via `resultId`).

**Pros:**

- Separate concern (críticos são "eventos", não parte de resultado).
- Indexação separada (query críticos é rápida).

**Cons:**

- Dupla escrita (result.critico + criticos-escalacoes doc). Risco de inconsistência.
- Quando resultado é soft-deleted, must cascade delete/soft-delete criticos-escalacoes.
- Mais complexo (3 Cloud Function triggers em vez de 1).

**Rejected:** Dupla-escrita é anti-pattern em Firestore. Monolithic document (resultado com criticio nested) é mais ACID.

### Alternativa C — Generic event log (event sourcing)

```
/labs/{labId}/eventos/{docId}
├── tipo: 'resultado-critico-detectado' | 'resultado-alertado' | ...
├── resultId: string
├── ts: Timestamp
└── payload: {}
```

**Pros:**

- Ultra-extensível (qualquer tipo de evento cabe)
- Imutável por design (append-only events)

**Cons:**

- Overkill para Phase 5 (evento sourcing é Fase 6+ scope).
- Mais complexo (state reconstruction from events adds latency).
- CAPA pattern (resultado com estado nested) is already proven in v1.3.

**Rejected:** Defer event sourcing full pattern to Phase 6. Phase 5 apenas precisa "critical results state machine" simples; resultados doc é exatamente isso.

## Consequências

### Positivas

1. **Auditória defensável.** RDC 978 Art. 184–191: cada crítico é rastreável (notificação, recepção, ação, timestamps).
2. **Impossível invalid state.** State machine + server-side validation = zero inconsistência. Auditor não vê "foi alertado sem ser crítico".
3. **Phase 6 audit trail simples.** Quando Phase 6 adiciona LogicalSignature, cada transição já é explícita (transitions[] array). Retrofit é nenhum (assinatura já está no schema).
4. **SLA enforcement.** "Crítico deve ser alertado <15 min de detecção" pode ser medido (sentTs vs createdAt).
5. **Padrão consistente.** CAPA (ADR-0003) usa state machine. Críticos usa state machine. Não há inconsistência visual/conceptual.

### Negativas

1. **Cloud Function overhead.** Cada transição de estado invoca CF callable (latency ~500ms). UX shows "sealing..." spinner. Mitigado: aceitável para infrequent critical events.
2. **Manual transition burden.** Operador deve clicar "confirmar recepção" → "marcar resolvido". Sem automação, workflow é labor-intensive. Mitigado: Phase 5.1 (stretch) pode auto-resolver se novo resultado normal chega.
3. **Debugging complexity.** Se operador fica preso em estado (ex: CF falha durante critico→alertado), doc fica inconsistente. Recovery procedure documentado em operational manual.

## Compromissos derivados

1. **v1.4 Phase 5 deliverables (Critical Results State Machine).**
   - `src/features/criticos/types/index.ts` — tipos (CriticoStatus, CriticoTransition, CriticoTracking)
   - `src/features/criticos/services/criticoService.ts` — CRUD + transition validation
   - `functions/src/v1.4-criticos/transitionCriticoStatus.ts` — CF callable
   - `functions/src/v1.4-criticos/notificaCritico.ts` — notification trigger
   - Firestore Rules pattern documented in `.claude/rules/firestore-security.md`
   - E2E tests: 8 specs (normal→critico, critico→alertado, alertado→resolvido, invalid transition rejection, notification sent, SLA check)

2. **v1.4 Phase 5.1 (stretch) — Auto-Resolution.**
   - If new resultado comes in after critico escalation, and novo valor is normal → auto-transition alertado→resolvido.
   - Conditional on timeline availability.

3. **SLA monitoring (KPI dashboard integration).**
   - Metric: "% críticos com recepção confirmada <15 min" (RDC 978 Art. 185)
   - Dashboard shows: # críticos por dia, avg time to alert, avg time to resolve
   - Part of v1.4 Phase 3.3 (analytics module expansion)

4. **Manual transition fallback (operational).**
   - If CF fails to transition, operator can click manual "force transition" button in UI
   - Requires supervisor approval (RBAC gate)
   - Logged as "manual override" in transitions[] for audit purposes

5. **Testing + validation (v1.4 Phase 5 completion).**
   - Unit tests: computeNivel (FMEA-style P×S×D scoring) + validateTransition logic
   - Firestore Rules emulator tests: ensure server-side state machine enforcement
   - E2E tests: full flow (resultado detectado → crítico → alertado → resolvido) on staging
   - Pre-launch: manual testing on staging with 500+ synthetic críticos (load test SLA enforcement)

## Referências

- ADR-0003 (nao-conformidades state machine pattern)
- ADR-0009 (React 19 state management via Zustand)
- ADR-0012 (LogicalSignature audit trail)
- RDC 978/2025 Art. 184–191 (critical value notification requirements)
- DICQ 4.7 (Pós-analítico: rastreabilidade de críticos)
- v1.4-ROADMAP Phase 5 (Critical Results Escalation)

---

**Aplicabilidade:** v1.4 Phase 5 (Critical Results State Machine) + Phase 6 (Audit Trail integration).

---

**ADR Status:** PROPOSED (pending CTO review)  
**Review Date:** 2026-05-14 (1 week checkpoint: confirm state machine design + CF pattern aligns with ADR-0012)  
**Acceptance Gate:** Phase 5 implementation ready (CF callable tested, Rules updated)
