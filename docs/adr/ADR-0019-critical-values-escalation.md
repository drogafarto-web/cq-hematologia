# ADR-0019: Critical Values Escalation via Multi-Channel Notifications

**Status:** PROPOSED (Phase 6, v1.4 Wave 2)  
**Decided:** 2026-05-07  
**Severity:** HIGH (compliance-critical: RDC 978 Art. 128)  
**Author:** CTO · **Reviewers:** RT, QA, Compliance

---

## Context

HC Quality must escalate critical lab results to physicians and RTs within SLA (e.g., 30 minutes). RDC 978 Art. 128 requires "ação corretiva imediata" when a result deviates from expected values. Phase 5 foundation (bioquimica CIQ + critical thresholds engine) is live; Phase 6 adds notification orchestration + SLA tracking.

**Constraints:**

1. **SMS delivery must be ≥99% success rate** (Twilio SLA)
2. **Zero false negatives:** every critical must attempt escalation (never silently fail)
3. **Audit trail immutable:** every escalation attempt logged with operator ID + timestamp
4. **RDC 978 compliance:** physician contact info stored at time of escalation (for future audit)
5. **NOTIVISA integration ready:** reportable conditions auto-generate draft forms for RT review

---

## Decision

Implement **multi-channel escalation with fallback chain** and **5-minute SLA polling cron**:

### 1. Channel Strategy: SMS → Email → RT Alert

```
laudo.criticoDetectado = true
  ↓
registerCriticoDetection(laudo, thresholds)
  ├─ Create escalacao doc (append-only)
  ├─ Send SMS to physician (Twilio) ← PRIMARY
  │  └─ If SMS fails (invalid #, API error): queue EMAIL fallback
  ├─ Send email to RT: "[CRÍTICO] {paciente} {analito}"
  └─ Return escalacaoId + SLA target (from labSettings)

Every 5 minutes (cron):
  escalacaoCriticos()
    ├─ Query pending escalacoes (status='enviado')
    ├─ Poll Twilio for SMS delivery status
    ├─ If SMS delivered: mark status='entregue', stop
    ├─ If SMS failed >10 min ago: escalate to EMAIL
    ├─ If email also pending >SLA: alert RT + mark 'vencido'
    └─ Log all status changes immutably
```

### 2. Firestore Schema: 3 New Collections

| Collection             | Purpose                                                          | Key Pattern                                                 |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `criticos-thresholds`  | Lab-configurable ranges (min/max per analito)                    | RN-06 soft-delete only                                      |
| `criticos-escalacoes`  | Master log of escalation events (append-only)                    | One doc per detection; escalacoes[] array for retry history |
| `criticos-log-eventos` | Immutable audit trail (with LogicalSignature chain per ADR-0012) | RDC 978 Art. 128 compliance                                 |

**Design choice rationale:**

- Separate `criticos-escalacoes` (state machine) from `criticos-log-eventos` (immutable trail)
  - Allows RT to update status='reconhecido' without breaking audit chain
  - Events logged separately with hash chaining (tamper-evident per ADR-0012)
- `labSettings.criticos` config (not separate collection)
  - Thresholds must be mutable by RT without breaking RDC compliance
  - Use versioning for historical audit (v1, v2, v3 per threshold doc)

### 3. Cloud Functions: 7 Callables + 1 Cron

| Function                     | Role                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `registerCriticoDetection()` | Client entry point; validates, creates escalacao, sends SMS |
| `acknowledgeEscalacao()`     | Mark recognized by physician/RT; calculate SLA metrics      |
| `escalacaoCriticos()` [CRON] | Poll Twilio, retry failover, alert on SLA breach            |
| `retryEscalacao()`           | Manual RT retry via alternate channel                       |
| `cancelarEscalacao()`        | Soft-cancel (false alarm, result corrected)                 |
| `listCriticosEscalacoes()`   | Dashboard fetch (filtered, paginated)                       |
| `generateNOTIVISADraft()`    | Auto-generate reportable condition forms                    |
| `getCriticosThresholds()`    | Client-side cache of active thresholds                      |

**Why callable-based, not direct Firestore writes:**

- Server-side validation of Twilio config + secrets (TWILIO_ACCOUNT_SID)
- Atomic: SMS send + escalacao create in one transaction
- Audit: callables are implicitly logged via Cloud Logs
- Compliance: operator ID captured via `request.auth.uid`

### 4. Twilio Integration

**Decisions:**

- ✓ Use **Twilio SDK** (well-maintained, integrates with Node 22)
- ✓ **Regional number** (São Paulo +5511XXXXXXXX) stored in labSettings
- ✓ **Webhook delivery callbacks** (not polling Twilio every minute)
- ✓ **Secrets in Firebase** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)

**Why not WhatsApp / other channels:**

- RDC 978 requires documented, audit-proof notification channel
- SMS is gold standard (universal, carrier-backed delivery reports)
- WhatsApp adds legal ambiguity (persona privacy via WhatsApp Business API)
- Email is reliable fallback (already established SMTP integration)

### 5. SLA Polling Strategy: Cron Every 5 Minutes

**Decision:** Cron-based polling (not event-driven via Twilio webhook alone)

**Rationale:**

- Webhook might fail (network blip, function crash) → polling is safety net
- Cron is deterministic (runs at T+0, T+5, T+10, ... every day)
- 5-minute interval balances: freshness vs. cost (3 runs/min = 4,320/day → ~$1.30/month)
- Twilio webhook used for **confirmation** (SMS delivered) → cron uses it to update status
- If webhook never arrives: cron still escalates via email at T+10min

---

## Rationale

### Why append-only escalacao arrays instead of subcollections?

**Option A (Chosen):** Single `escalacoes[]` array in escalacao doc

```typescript
escalacao.escalacoes = [
  { canalId: 'uuid1', canal: 'SMS', status: 'falha', ...},
  { canalId: 'uuid2', canal: 'EMAIL', status: 'enviado', ... }
]
```

**Option B:** Subcollection `criticos-escalacoes/{escalacaoId}/tentativas/{tentativaId}`

| Aspect     | Option A                  | Option B                     |
| ---------- | ------------------------- | ---------------------------- |
| Query cost | 1 doc read                | 1 parent + N child reads     |
| Index size | Smaller (array in doc)    | Larger (subcollection)       |
| UI perf    | Faster (data in parent)   | Slower (join)                |
| Compliance | Simpler (one audit chain) | Fragmented (chain per child) |

**Chosen A** because escalation attempts rarely exceed 3 (SMS → email → manual RT retry), and array makes audit chain simpler.

---

### Why SMS is primary, email is fallback (not vice versa)?

**Rationale:**

1. **Speed:** SMS delivery ~30s (Twilio), email ~1-5min
2. **Acknowledgment:** Twilio provides delivery report callback; email is "fire and forget"
3. **Severity:** Critical results = life-threatening → fastest channel wins
4. **Compliance:** RDC 978 prefers synchronous notification (SMS is closer to synchronous than email)

**Exception:** If SMS number missing/invalid → skip SMS, go directly to email (no 10-min delay).

---

### Why NOTIVISA draft auto-generation, not auto-submission?

**Phase 6 scope:** Auto-generate form for RT review (rascunho)
**Phase 8 scope:** ANVISA API integration for auto-submission (v1.5)

**Rationale:**

- NOTIVISA submissions have strict deadlines + legal implications
- RT must review thresholds (is this truly reportable under this lab's criteria?)
- Form pre-population saves time but human judgment is non-negotiable (RDC 978 Art. 58)

---

## Consequences

### Positive

1. ✓ **Compliance:** Every escalation logged immutably (RDC 978 Art. 128)
2. ✓ **Reliability:** Multi-channel fallback (SMS → email) reduces false negatives
3. ✓ **SLA visibility:** RT dashboard shows exact timing + status
4. ✓ **NOTIVISA ready:** Foundation for Phase 8 API integration
5. ✓ **Audit trail:** Full operator context (who/what/when/where/why)

### Negative / Costs

1. **New infrastructure:** Twilio account + secrets management (CTO setup cost ~1h)
2. **Data storage:** 3 new collections + indexes (negligible: <1MB/day for typical lab)
3. **SMS cost:** ~BRL 0.10/SMS (~$0.02 USD); assume 10 críticos/day → ~BRL 30/month
4. **Operational:** RT learns new dashboard + config interface (training: 30 min)

---

## Alternatives Considered

### Alt 1: Email-only escalation

**Pros:** No external dependency (Twilio), simpler
**Cons:** Email delivery = 1-5 min (too slow for life-threatening results)
**Decision:** Rejected ❌

### Alt 2: Push notifications (mobile app)

**Pros:** Direct to physician device
**Cons:** Requires physician to install HC Quality mobile app (not all have)
**Decision:** Deferred to Phase 7 (optional channel) ✓

### Alt 3: In-app notification only (no SMS/email)

**Pros:** Zero cost, no external deps
**Cons:** Physician might not see notification for hours (critical missed)
**Decision:** Rejected ❌ (violates RDC 978)

---

## Implementation Checklist

- [ ] Twilio account created + number provisioned
- [ ] Secrets set in Firebase (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
- [ ] Schema implemented: 3 collections + indexes
- [ ] 7 callables + 1 cron implemented + tested
- [ ] Email templates created + tested (fallback + SLA breach + NOTIVISA)
- [ ] Firestore rules updated (rules for 3 new collections)
- [ ] E2E tests pass (5+ scenarios)
- [ ] RT operational guide published
- [ ] Thresholds seeded for bioquimica analitos
- [ ] Smoke tests pass (critical detected → SMS queued → delivered → recognized)

---

## Related ADRs

- **ADR-0012:** LogicalSignature chain for audit immutability
- **ADR-0008:** Bioquimica CIQ module (v1.3, foundation for Phase 6)
- **ADR-0014:** NOTIVISA integration (Phase 8, uses Phase 6 draft generation)

---

## References

- RDC 978/2025 Art. 128 — Ações corretivas (ANVISA)
- DICQ 4.3 — Documentação de Qualidade (versioning + audit)
- Twilio SMS API: https://www.twilio.com/docs/sms/api
- PHASE_6_DETAILED_PLAN.md — Complete execution specification

---

**Status:** PROPOSED  
**Next Steps:** CTO approval on Twilio contract + schema review → READY FOR EXECUTION
