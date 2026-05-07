# ADR-0023 — Critical Values Escalation: 4-State Machine + Twilio SMS/Email (Phases 5–6)

**Date:** 2026-05-07  
**Status:** PROPOSED  
**Decided by:** CTO / fundador  
**Supersedes:** —  
**Superseded by:** —

---

## Problem

RDC 978 Arts. 184–191 mandate **immediate notification of critical results** (e.g., blood glucose <50 mg/dL, K+ >6.5 mEq/L, creatinine >10 mg/dL). Portaria 204/2016 defines critical thresholds per analyte. Laboratory must:

1. Notify physician within **5 minutes** of result approval.
2. Document notification (timestamp, method, recipient).
3. Track acknowledgment (did physician read the alert?).
4. Escalate if no ACK within 15 minutes (call backup physician, alert supervisor).

Without formal state machine, risk of:
- **SLA breach:** critical result sits unnoticed for hours.
- **Audit gap:** no proof notification occurred ("we emailed, but can't show the email was received").
- **Operator confusion:** unclear whether SMS was sent to primary vs. backup physician.

**Business context:** Riopomba processes ~500 results/day; ~2–5 critical values/day. v1.4 Phases 5–6 must implement notification automation.

---

## Decision

**v1.4 Phases 5–6 implement 4-state critical-values machine with Twilio integration, enforced via Cloud Function callables and scheduled processors.**

### State Machine Definition

```
NORMAL (initial/baseline state)
  ↓ [system: detect critical threshold breach]
CRITICO
  ├→ [operator override] ↻ NORMAL
  ↓ [automatic: send SMS → Twilio]
ALERTADO (physician notified)
  ├→ [operator: escalate if no ACK] → second attempt
  ├→ [physician: ACK via reply SMS] ↓
  ↓ [automatic: 15min elapsed + ACK received]
RESOLVIDO (critical event closed)
  ↓ [soft-delete marker]
(archived, preserving history)
```

### States & SLA Requirements

#### `NORMAL` (Baseline)
- Result value is within normal/reference range (per `labSettings.criticalThresholds[analyte]`).
- No action required.
- Transition trigger: result approval (automatic, if value <= threshold).

#### `CRITICO` (Critical Value Detected)
- Result value exceeds critical threshold (e.g., glucose <40 mg/dL).
- System detects via Cloud Function trigger on `laudos/{laudo-id}` update (after RT approval).
- Lookup: `resultadosItems[].valor` vs. `laboratorioCriticalThresholds[analite]`.
- **SLA start time:** `ts = now()`.
- Transitions:
  - To `ALERTADO` (automatic): SMS queued to physician within 2 minutes.
  - To `NORMAL` (operator override): RT reviews, determines false-alarm (rare), marks resolved.
- Audit event: `{ operatorId, ts, acao: 'critico-detectado', analito, valor, threshold }`.

#### `ALERTADO` (Physician Notified / Awaiting Acknowledgment)
- Twilio SMS sent to primary physician phone (loaded from `/labs/{labId}/medicos/{medicoId}.telefone`).
- SMS content (template): `"Lab Alert: Glucose 35 mg/dL [CRITICAL]. Confirm receipt: reply ACK"`
- **SLA:** physician must ACK within 15 minutes (hard deadline: 900 seconds from CRITICO state entry).
- Fields: `smsIdPrimario` (Twilio message ID), `dataSMSEnviado`, `datasAtentatvasEscalacao[]`.
- Transitions:
  - To `RESOLVIDO` (automatic, if ACK received within SLA): transition ts = ACK ts.
  - To `ALERTADO` (escalation attempt, if no ACK): retry SMS to backup physician or call supervisor (10min mark).
  - To `CRITICO` (if operator deems stale result): unlock for manual review.
- Audit events: `{ smsId, status: 'enviado' }`, `{ smsId, status: 'ack-recebido', medicoId, tsACK }`, `{ smsId, status: 'escala-iniciada', motivo: 'sla-breach' }`.

#### `RESOLVIDO` (Critical Event Closed)
- Physician has acknowledged result (SMS reply "ACK" received) **and** SLA within 15 min elapsed time.
- OR: result rechecked + false-alarm + operator manually closed.
- Fields: `dataResolucao`, `medicoIdQuAccusou`, `tsACK`, `tempoResposta` (physician response time in seconds).
- **Immutable:** no further transitions (soft-delete only).
- Audit event: `{ operatorId, ts, acao: 'critico-resolvido', tempoResposta, mediaACK? }`.

---

## Implementation Details

### Cloud Function Callables & Scheduled Functions

#### 1. **`detectCriticalValueOnLaudoApproval` (trigger: `onDocumentWritten(laudos/{laudo-id})`)**
- Fires when RT approves laudo (status: `aprovado`).
- Loop through `resultadosItems[]`: check each `valor` vs. `labSettings.criticalThresholds[analito]`.
- For each breach:
  - Create doc in `/labs/{labId}/critical-values/{critico-id}` with status `CRITICO`.
  - Queue Twilio message to `fila-sms-critico` (Firestore collection for async processing).
  - Generate chainHash (HMAC of `{labId, criticoId, status, valor}` per ADR-0012).
  - Audit event appended.
- Returns: `{ criticoIds: string[], smsPendentes: number }`.

#### 2. **`escalateCriticalValue(labId, criticoId, medicoIdBackup, tentativaNum)` (callable)**
- Validates: critical value in state `ALERTADO` AND 10 minutes elapsed since `dataSMSEnviado`.
- Sends SMS to backup physician or calls supervisor (Twilio voice API).
- Appends escalation event: `{ operatorId, ts, acao: 'escala-iniciada', tentativa: 2, medicoIdBackup }`.
- **Constraint:** max 3 escalation attempts per critical value (then mark `CRITICO` as `MANUAL-REVIEW-NEEDED`).

#### 3. **`acknowledgePhysicianReceipt(labId, criticoId, medicoId)` (callable, from webhook)**
- Triggered by Twilio webhook (SMS reply from physician).
- Validates: critical value in state `ALERTADO`.
- Computes `tempoResposta = now() - dataSMSEnviado`.
- Transition: status → `RESOLVIDO`, set `medicoIdQuAccusou`, `tsACK`.
- Generates chainHash.
- **SLA check:** if `tempoResposta > 900` (15 min), transition still to `RESOLVIDO` but flag audit event as `sla-breach-late-ack`.
- Audit event: `{ medicoId, ts, acao: 'ack-recebido', tempoResposta, slaStatus: 'on-time' | 'late' }`.

#### 4. **`criticalValueOverride(labId, criticoId, motivo)` (callable, operator)**
- Validates: critical value in state `CRITICO` or `ALERTADO`.
- Transition: status → `RESOLVIDO` (or `NORMAL` if determined false-alarm).
- Requires RT with role `isAdminOrOwner` (not auditor).
- Audit event: `{ operatorId, ts, acao: 'override-por-operador', motivo }`.

#### 5. **`processCriticalValueSMSQueue` (scheduled, every 2 minutes)**
- Query: `/labs/{labId}/fila-sms-critico` with status `pending`.
- For each entry:
  - Call Twilio API: `twilio.messages.create({ to: phone, from: LAB_TWILIO_FROM, body })`.
  - Write Twilio response (message ID, status) to `/critical-values/{id}.smsIdPrimario`.
  - Update fila entry: status → `sent`, tsEnviado.
  - If Twilio fails: retry logic (exponential backoff: 2m → 5m → 15m, max 3 attempts).
- Generates audit events for each SMS send attempt.

#### 6. **`validateCriticalValueSLAsScheduled` (scheduled, every 5 minutes)**
- Query: `/labs/{labId}/critical-values` where `status === 'ALERTADO'` AND `dataSMSEnviado <= now() - 900s` (15 min).
- For each overdue critical:
  - Fetch backup physician from `/medicos[?isPrimaryForCritico === false]`.
  - Call `escalateCriticalValue(labId, criticoId, backupId, tentativaNum=2)`.
  - If backup also no-ack after 15 more min: transition to `CRITICO` + set flag `requer-revisao-manual: true` + page supervisor.
- Audit event: each escalation + timeout trigger.

#### 7. **`softDeleteCriticalValue(labId, criticoId)` (callable)**
- Validates: critical value in state `RESOLVIDO` (only after fully resolved).
- Sets `deletadoEm: Timestamp.now()`, `deletadoPor: request.auth.uid`.
- **Preserves:** all SMS history + ACK logs in `atualizacaoCritico[]`.
- Generates chainHash.

---

### Firestore Schema

```typescript
// /labs/{labId}/critical-values/{criticoId}
interface CriticalValue {
  id: string;
  labId: string;
  
  // Result Link
  laudoId: string;
  resultado: {
    analito: string;
    valor: number;
    unidade: string;
    referenceRange: { min: number; max: number };
  };
  
  // Thresholds
  thresholdCritico: number;
  breachType: 'low' | 'high';
  
  // State Machine
  status: 'NORMAL' | 'CRITICO' | 'ALERTADO' | 'RESOLVIDO';
  
  // Notification Details
  medicoIdPrimario: string;
  medicoIdBackup?: string;
  telefoneNotifico: string;
  
  // SLA Timeline
  tsCriticoDetectado: Timestamp;
  dataSMSEnviado?: Timestamp;
  smsIdPrimario?: string; // Twilio message ID
  
  // Acknowledgment
  tsACK?: Timestamp;
  medicoIdQuAccusou?: string;
  tempoResposta?: number; // seconds
  slaStatus?: 'on-time' | 'late' | 'no-ack';
  
  // Escalation Tracking
  tentativasEscalacao: Array<{
    tentativa: number; // 1, 2, 3
    ts: Timestamp;
    medicoId: string;
    metodo: 'sms' | 'voz-call';
    resultadoSms?: { status: 'sent' | 'failed'; twilio_error?: string };
  }>;
  
  // Manual Override (if any)
  overrideMotivo?: string;
  overrideTs?: Timestamp;
  overridePor?: string; // operatorId
  
  // Audit Trail (append-only)
  atualizacaoCritico: Array<{
    ts: Timestamp;
    acao: 'detectado' | 'sms-enviado' | 'ack-recebido' | 'escala-iniciada' | 'override' | 'resolvido';
    operatorId: string;
    medicoId?: string;
    smsId?: string;
    tempoResposta?: number;
    chainHash: string;
  }>;
  
  // Soft Delete
  deletadoEm?: Timestamp;
  deletadoPor?: string;
  
  // Compliance
  criadoEm: Timestamp;
  criadoPor: string; // system trigger
}

// /labs/{labId}/fila-sms-critico/{entryId}
interface FilaSMSCritico {
  id: string;
  criticoId: string;
  status: 'pending' | 'sent' | 'failed-max-retries';
  telefoneDestino: string;
  corpoDaMensagem: string;
  tentativas: number;
  ultimaTentativaTs?: Timestamp;
  proximaTentativaTs?: Timestamp;
  respostaTwilio?: { sid: string; status: string; error?: string };
  criadoEm: Timestamp;
}
```

### Twilio Integration

**Configuration:**
- Account SID + Auth Token stored in Firebase Secret Manager (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`).
- Phone number for SMS sender (`TWILIO_FROM_PHONE`) defined in `labSettings.{labId}.notificacoes.smsFromNumber`.
- Webhook URL for SMS replies: `https://{region}-{project}.cloudfunctions.net/handleTwilioSMSReply?labId={labId}` (registered in Twilio console).

**SMS Template:**
```
Lab Alert: {ANALITO} = {VALOR} {UNIDADE} [CRITICAL - Normal: {RANGE}]
Patient: {PATIENT_NAME} | Time: {TS_LOCAL}
Confirm receipt: reply with ACK
---
Reply within 15 min or system escalates.
```

**Webhook (incoming SMS):**
- Twilio POSTs to `handleTwilioSMSReply` with: `From`, `Body`, `MessageSid`, `SmsMessageSid`.
- Parse: `criticoId` from message link (encoded in SMS or stored in `fila-sms-critico.criticoId`).
- Call `acknowledgePhysicianReceipt(labId, criticoId, medicoId)` via internal callable (not exposed to client).

---

## Rationale

1. **RDC 978 Arts. 184–191 compliance:** 4-state machine + SLA timers directly map to regulatory requirement (notify within 5 min, track acknowledgment).
2. **Physician accountability:** SMS audit trail (sent, ACK received, timestamp) proves notification occurred.
3. **Escalation automation:** no manual oversight loop (operator doesn't need to check "did physician respond?"; system escalates automatically).
4. **Multi-channel flexibility:** Twilio supports SMS + voice calls + WhatsApp (future phases); current implementation SMS only.
5. **False-alarm handling:** operator override for edge cases (e.g., test result misrouted, corrected after initial alert).

---

## Alternatives Considered

### A. Email-only notification (no SMS)
**Pros:** no Twilio cost; simpler integration.  
**Cons:** RDC 978 requires 5-minute SLA; email is not reliable (may sit in inbox 30+ min). Unacceptable for critical values.  
**Rejected:** Does not meet regulatory timeline.

### B. SMS + no escalation (fire-and-forget)
**Pros:** simpler state machine (3 states: CRITICO, ALERTADO, RESOLVIDO).  
**Cons:** no enforcement of physician response; auditor sees alert sent but no proof read/understood.  
**Rejected:** Violates RDC 978 intent (acknowledgment required).

### C. Custom escalation tree (hardcoded per lab, no dynamic config)
**Pros:** simple implementation; no labSettings extension.  
**Cons:** not multi-tenant friendly; each lab requires code change if physician roster changes.  
**Rejected:** Violates multi-tenant principle (CLAUDE.md convention RN-01).

---

## Consequences

### Positive

1. **Regulatory compliance:** SLA-enforced notification + ACK audit trail satisfy RDC 978 Arts. 184–191.
2. **Operator relief:** escalation is automatic (no manual intervention needed after SMS fails).
3. **Physician adoption:** SMS + voice are familiar channels; no new app required.
4. **Audit trail:** every state transition hashed + chainHashed; immutable proof of notifications.

### Negative

1. **Twilio dependency:** monthly cost + API reliability (if Twilio down, critical alerts may delay).
2. **SMS limit:** Twilio has regional rate limits (~1,000 SMS/min for US); if 100 labs × 10 critics/hour = 1,000/hour (OK), but burst scenario (lab network alert → 50 labs critical) may trigger rate limit.
3. **False positives:** occasionally legitimate results (e.g., dialysis patient high K+) trigger cascading alerts; operator must override frequently → clinical team friction.
4. **Physician inbox friction:** 1–2 critical alerts/day per physician is OK; if labs start sending alerts for soft-critical (e.g., glucose 120 mg/dL), alert fatigue → dismissal.

### Mitigation

- **SMS cost:** negotiate Twilio volume discount (unlikely, but discuss).
- **Rate limit:** implement backoff queue (`fila-sms-critico`) with exponential delays.
- **False positives:** Phase 5 UI includes "mark as false-alarm" button for RT; trains algorithm (future phase: ML-based threshold tuning).
- **Alert fatigue:** `labSettings.criticalThresholds` should be reviewed quarterly with clinical director; conservative thresholds only (true critical values).

---

## Derived Commitments

1. **Phase 5 deliverables (Weeks 1–2):**
   - Cloud Function callables: 3 callables (detect on trigger, escalate, acknowledge).
   - Twilio SMS queue processor + webhook handler.
   - Firestore schema + rules (critical-values collection protected).
   - E2E tests: 6 specs (detect → SMS send, ACK within SLA, escalation timeout, override, webhook handling).

2. **Phase 5 Configuration (Week 2):**
   - `labSettings.{labId}.criticalThresholds` extended with analyte-wise thresholds.
   - `labSettings.{labId}.notificacoes.smsFromNumber` and `smsEnabledForCriticals` flag.
   - Twilio account setup (SID, token, webhook URL registration).

3. **Phase 6 deliverable (Weeks 3–4):**
   - RT UI: dashboard of current critical values (status, SLA countdown, physician name, SMS status).
   - Auditor UI: historical report of all critical values (status, response time, trend analysis).
   - E2E test: full flow (result approval → SMS sent → ACK received → SLA met).

4. **Clinical team onboarding (Phase 6 Week 4):**
   - 30-min training: how to receive SMS + ACK (reply "ACK" or "1").
   - Runbook: what if you don't get SMS? (call lab supervisor).
   - Feedback loop: monthly review of critical threshold accuracy.

5. **Firestore Rules & Multi-tenant:**
   - `/labs/{labId}/critical-values/*`: readable only by members of that lab + auditors.
   - `/medicos/{medicoId}`: accessible by lab owner only (phone number is PII).
   - Audit events (append-only) + chainHash validation in Rules.

---

## Links to Related ADRs & Phases

- **ADR-0012** — RDC 978 audit trail logical signature (chainHash implementation).
- **ADR-0014** — NOTIVISA integration (critical values → notifiable diseases bridge in Phase 6).
- **Phase 5** — Patient Portal Phase 1 + Critical Values Escalation (v1.4 roadmap).
- **Phase 6** — Critical Values Phase 2 + LIS integration (v1.4 roadmap).
- **RDC 978 Arts. 184–191** — Comunicação de Resultados Críticos (statutory reference).
- **DICQ 4.1.2.6** — Comunicação de Resultados (DICQ mapping).

---

**ADR Status:** PROPOSED (2026-05-07)  
**Gate Review:** End of Phase 5 Week 2 (confirm Twilio integration working, SMS queue processing ≥99% delivery).  
**SLA Monitoring:** Starting Phase 5 Week 3 (track physician response time; target median <3 min, p99 <10 min).
