# ADR-0014: NOTIVISA Integration via Sandbox → Production Pathway (Phase 8 Sandbox, Phase 12+ Production)

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

RDC 978 Art. 66 exige notificação de eventos adversos ao Ministério da Saúde (MS) via NOTIVISA (Sistema de Notificação de Eventos Adversos). Portaria 204/2016 (MS) define lista de 99 doenças notificáveis (ex: sífilis, dengue em gestante, HIV, tuberculose).

Em laboratório clínico, resultado positivo em analito notificável dispara obrigação de report a autoridade sanitária dentro de 24h. v1.4 necessita:
- Detecção automática (resultado positivo em doença notificável).
- Draft NOTIVISA form geração.
- RT approval + submission.
- Receipt tracking + audit log.

**Questão arquitetural:** v1.4 implementa NOTIVISA com API real (Anvisa) ou sandbox/mock apenas?

**Contexto regulatório:**
- NOTIVISA API publicada: Dec 2021 (Anvisa).
- Documentação: Limitada (não oficial em português; SOAP service, status unclear em 2026).
- Sandbox disponível: Sim (Anvisa fornece test endpoint).
- Production submission requirements: e-CNPJ + digital certificate (complex legal setup).

## Problema

Pressão conflitante:

1. **Live NOTIVISA v1.4 (production API now).**
   - **Pro:** Real compliance; patients notified immediately to health authority.
   - **Con:** Requer legal setup (certificate, fiscal authority approval). 4+ weeks to resolve. May block v1.4 timeline.
   - **Risk:** API stability unknown; live submissions may fail or have latency issues → support burden.

2. **Sandbox only v1.4 (form generation, no submission).**
   - **Pro:** No legal/fiscal blockers. Form generation + RT approval workflow can be done.
   - **Con:** Não cumpre RDC 978 Art. 66 plenamente (draft não é submission).
   - **Risk:** v1.5 must retrofit API + re-test. Code written for sandbox may not translate cleanly.

3. **Hybrid: Sandbox v1.4 com production transition path v1.5.**
   - **Pro:** v1.4 does compliance (form + audit trail); v1.5 flips the switch to real API (minimal refactor).
   - **Con:** Auditor may ask "where's the submission?" → response is "v1.5 will integrate with NOTIVISA API once certificate is provisioned."

**Decision:** Path 3 (Hybrid) aligns timeline + compliance + risk.

## Decisão

**v1.4 implements NOTIVISA form generation (Sandbox mode); Phase 12+ (v1.5 or earlier if certificate ready) enables production submission.**

### 1. v1.4 Phase 8 — NOTIVISA Integration (Sandbox)

**Scope:**
- Art. 6º schema (Zod validation): 15 mandatory fields (disease code, patient anonymized, result, date, etc.).
- Notifiable disease list seed (99 MS diseases, configurable per lab).
- Draft form generation (XML or JSON matching Anvisa schema).
- RT approval gate (draft → review → approve/reject).
- Audit trail (who approved, when, response if any).

**Not in scope:**
- Live API submission to Anvisa.
- Digital certificate validation.
- Receipt acknowledgment from Anvisa.

**Implementation:**
```
Critical result detected → notivisaDraftGenerator CF → XML form created in Firestore
RT sees draft in UI → reviews (patient details, disease, test result)
RT clicks "Approve" → sealNotivisaDraft() CF → chainHash applied + sealed
PDF export: form + RT signature + timestamp (auditor-ready proof of approval)
Awaiting: v1.5 API integration to actually submit
```

**Output:** Full audit trail of who approved what when + form content. Ready for Anvisa submission (just needs API call layer).

---

### 2. Phase 12+ (v1.5 or earlier) — NOTIVISA Production Integration

**When certificate is ready** (legal/fiscal process completes):

**v1.5 refactor (minimal):**
- Replace mock `submitNotivisaToAnvisa()` with real HTTP call to NOTIVISA API endpoint.
- Unbox certificate from Secret Manager.
- Handle SOAP/REST protocol (Anvisa endpoint specifics).
- Implement retry logic (gov server may be slow).
- Tracking: receipt code from Anvisa stored in `notivisa-outbox` doc.

**Code changes (localized):**
```typescript
// v1.4: mock submission
async function submitNotivisaToAnvisa(form: NotivisaForm): Promise<{status: 'mocked'}> {
  return {status: 'mocked', reason: 'v1.5 will integrate with real Anvisa API'};
}

// v1.5: real submission
async function submitNotivisaToAnvisa(form: NotivisaForm): Promise<{status: 'success' | 'error', receiptCode?: string}> {
  const cert = await secretManager.getSecret('NOTIVISA_CERTIFICATE');
  const response = await soapClient.call('Anvisa.NOTIVISA.submit', {form, cert});
  return {status: response.status === 200 ? 'success' : 'error', receiptCode: response.transactionId};
}
```

---

### 3. Firestore Schema (v1.4, future-proof)

```
/labs/{labId}/notivisa-outbox
├── {docId}
│   ├── status: 'draft' | 'approved' | 'submitted' | 'acknowledged' | 'rejected'
│   ├── diseaseCode: string (MS Portaria code, e.g., '99078' = syphilis)
│   ├── patientData: {name_anon, date_birth, sex} (no PII)
│   ├── resultValue: string
│   ├── resultDate: Timestamp
│   ├── chartHash: string (HMAC seal v1.4, adresa ADR-0012)
│   ├── submissionAttempts: [{ts, status, error?}] (audit trail)
│   ├── receiptCodeFromAnvisa?: string (v1.5+)
│   └── notificationDeadline: Timestamp
```

### 4. Regulatory Alignment (RDC 978 Art. 66)

**v1.4 status:** Art. 66 is addressed (form generation + approval process documented + audit trail).  
**Claim to auditor:** "HC Quality generates NOTIVISA forms for all notifiable results, sealed with RT approval. v1.5 will integrate with Anvisa API for direct submission (certificate provisioning in progress)."

**Risk mitigation:** If auditor says "you must submit now", escalation path is:
1. Manually export PDF from HC Quality.
2. Import manually into Anvisa portal (labor-intensive but compliant).
3. Commit to v1.5 automation (timeline + responsibility assigned).

### 5. Staging & Testing (v1.4)

**What's tested:**
- Draft form generation (XML schema validation against Anvisa spec).
- RT approval workflow (sealing + audit).
- Export to PDF (inspector-ready).
- Error handling (disease code lookup, missing fields).

**What's NOT tested:**
- Live Anvisa API (endpoint not called).
- Receipt handling (no response processing).
- Retry logic under SOAP protocol (no soap client).

**Mock library used:** `functions/src/__mocks__/notivisa.ts` contains fake Anvisa responses for E2E testing.

---

### 6. Certificate Provisioning (Parallel, Legal Track)

**v1.4 execution:** Engineering focus is form generation.  
**Parallel track (legal/ops):** Start certificate provisioning request to ICP-Brasil authority (4–6 weeks lead time). Target: ready by late v1.4 or early v1.5.

**Dependency:** Certificate MUST be provisioned before v1.5 Phase 1 (production API integration). If certificate is late, v1.5 production submission is deferred.

---

## Alternativas consideradas

### Alternativa A — Full production NOTIVISA v1.4 (now)

Integrate real API, provision certificate, submit to Anvisa from Day 1.

**Pros:**
- Full Art. 66 compliance (submissions happening in real-time).
- Auditor has zero questions.
- Market positioning ("first mover with NOTIVISA automation").

**Cons:**
- Certificate provisioning blocks v1.4 (4+ weeks legal/fiscal work). Timeline risk too high.
- API stability unknown; if Anvisa API has issues, we're responsible for triage.
- If API changes in v1.5, refactor burden falls on v1.5 team.

**Rejected:** Timeline risk is unacceptable for v1.4 (auditoria 2026-10-15 deadline).

### Alternativa B — No NOTIVISA v1.4; all deferred to v2

v1.4 ignores Art. 66; implement in v2 as premium feature.

**Pros:**
- Zero timeline risk; v1.4 focused on DICQ core.

**Cons:**
- Auditor asks "where's NOTIVISA?" → no credible answer. Major compliance gap.
- v1.5 can't launch without it (Art. 66 is mandatory RDC).
- Competitive disadvantage (no competitor has NOTIVISA either, but first-mover wins).

**Rejected:** Leaves compliance hole that's hard to close later.

## Consequências

### Positivas

1. **v1.4 timeline safe.** Form generation doesn't block anything; no certificate dependency.
2. **Compliance path clear.** Auditor sees "Art. 66 addressed (form + approval + audit trail); API integration follows in v1.5" (documented plan).
3. **Code quality.** Form generation is well-designed (can be reused v1.5); API layer is isolated (easy swap v1.5).
4. **Market messaging.** "NOTIVISA automation (form generation) ready now; submissions in v1.5" is compelling (shows forward momentum).

### Negativas

1. **Not fully compliant.** Art. 66 technically requires submission; form-only is preparatory compliance (strong auditor may object).
2. **Operational friction.** If NOTIVISA submission is urgent, RT must export PDF + manually submit to Anvisa (slow, error-prone).
3. **v1.5 integration risk.** If certificate is unavailable, Anvisa API changes, or refactor is more complex than expected, v1.5 is delayed.

## Compromissos derivados

1. **v1.4 Phase 8 deliverable (NOTIVISA form generation).**
   - `notivisaDraft` CF callable: generates XML + validates schema.
   - `notivisaSerializer.ts`: Zod schema + mapper (Art. 6º fields).
   - `functions/src/__mocks__/notivisa.ts`: Mock Anvisa responses.
   - E2E test: 6 specs (draft creation, RT approval, export to PDF, schema validation, error cases, audit log).

2. **Certificate provisioning tracking.**
   - Parallel workstream (not engineering, but ops/legal).
   - Milestone: Certificate in hand by 2026-08-31 (v1.5 kickoff).
   - If delayed, v1.5 production submission is deferred (still compliant with form + approval log).

3. **v1.5 planning gate (Nov 2026).**
   - Assess certificate status (ready? delayed?).
   - If ready: allocate 1–2 weeks to API integration + testing.
   - If delayed: document reason + updated timeline.

4. **Auditor briefing (v1.4 closure).**
   - Describe NOTIVISA form generation + approval workflow.
   - Show audit export (export-notivisa PDF).
   - Acknowledge Art. 66 full compliance will occur v1.5 (submission layer).
   - Present certificate provisioning timeline (CTO-signed commitment).

5. **Manual submission fallback (operational procedure).**
   - If v1.5 is delayed, RT can export NOTIVISA form → manually submit to Anvisa portal.
   - Procedure documented in `OPERATIONS_MANUAL_v1.4.md`.
   - Not ideal, but sufficient for audit (shows Art. 66 intent).

## Referências

- `v1.4-ROADMAP.md` Phase 8 (NOTIVISA Integration).
- `functions/src/v1.4-base/notivisaIntegration.ts` (v1.4 form generation).
- `src/shared/notivisaDraft.ts` (Zod schema + validation).
- Anvisa NOTIVISA documentation (2021 API spec; URL: https://notivisa.saude.gov.br/docs/ — if available).
- Portaria 204/2016 MS (99 doenças notificáveis; reference list).
- Obsidian `HC_Quality_Decisoes_Abertas.md`: NOTIVISA automation roadmap.

---

**Aplikabilnost:** v1.4 Phase 8 + v1.5 Phase X (NOTIVISA production).

---

**ADR Status:** ACCEPTED (2026-05-07)  
**Review Date:** 2026-07-23 (Phase 8 mid-point: confirm form generation working + audit export clean)  
**v1.5 Gate:** 2026-11-01 (assess certificate + plan API integration sprint)
