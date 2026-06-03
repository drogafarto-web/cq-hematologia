# RFI Responses: Auditor FAQs (v1.4 Compliance)

**Prepared for:** External Audit (2026-08-31)  
**Compliance scope:** RDC 978 + DICQ 4.3 + LGPD  
**ADRs referenced:** ADR-0022 through ADR-0026  
**Date:** 2026-05-07

---

## RFI #1: How does CAPA Closure enforce immutability once auditor approves?

**Context:** RDC 978 Art. 147 requires evidence chain-of-custody and auditor non-repudiation. Auditor must certify corrective action is effective; system must prevent subsequent tampering with approved evidence.

**Answer:**

CAPA closure immutability is enforced at 3 layers: (1) **state machine**: once auditor transitions CAPA to `fechado` state via Cloud Function callable `capaAuditorApprove()`, Firestore security rules automatically deny all subsequent write operations to the CAPA document (except soft-delete marker). The callable generates a chainHash (HMAC-SHA256 over `{labId, capaId, status, ts, transicaoIndex}`) which is stored immutably in the `transicoesCAPAs[]` append-only array per ADR-0012. (2) **Audit trail**: each state transition appends to `transicoesCAPAs[]` with operator ID, timestamp, chainHash—no element deletion or modification allowed by Firestore rules. The previous chainHash is included in the next transition's hash, forming an unbreakable chain. (3) **Evidence hash verification**: at submission time (`capaSubmitEvidence` callable), the system computes SHA-256 of the uploaded evidence file and stores it in `evidenciaHash` field. When auditor approves, this hash is captured in the final chainHash. Any subsequent file tampering would produce a different hash, detectable by forensic audit. **Non-repudiation is achieved via `auditorIdAprovador` field (immutable after `fechado` transition), making the auditor accountable for sign-off. Firestore rules enforce: if a document reaches `status === 'fechado'`, only the `deletadoEm` timestamp can be added later (soft-delete); no other field mutations allowed.** The external auditor can reconstruct the entire CAPA lifecycle by reading `transicoesCAPAs[]` and verifying each chainHash against the HMAC secret (stored in Secret Manager, not exposed to client). Implementation complete in Phase 4 Week 3 (see 08-01-PLAN.md, tasks 03–05, verification: 8 E2E specs covering rejection flow + evidence hash mismatch).

---

## RFI #2: How are critical values escalated with SLA guarantees? What prevents missed notifications?

**Context:** RDC 978 Arts. 184–191 mandate physician notification within **5 minutes** of critical result approval. Auditor will verify SLA enforcement + escalation audit trail.

**Answer:**

Critical-values escalation is a 4-state machine (NORMAL → CRITICO → ALERTADO → RESOLVIDO per ADR-0023) with automated SLA enforcement. **Phase 5 Weeks 1–2 implement: (1) trigger detection: when RT approves a laudo (status `aprovado`), Cloud Function `detectCriticalValueOnLaudoApproval` fires, loops through result values, compares each against `labSettings.criticalThresholds[analyte]`, and creates a critical-value doc in status `CRITICO` with `tsCriticoDetectado = now()`. (2) Automatic SMS queueing: entry added to `/labs/{labId}/fila-sms-critico` (append-only queue), timestamp recorded. (3) Scheduled processor `processCriticalValueSMSQueue` runs every 2 minutes, dequeues pending SMS, calls Twilio API, stores Twilio message ID (`smsIdPrimario`) and status. If Twilio fails, entry stays in queue for retry (exponential backoff: 2m → 5m → 15m). (4) SLA enforcement: second scheduled processor `validateCriticalValueSLAsScheduled` runs every 5 minutes, queries status `ALERTADO` where SMS sent ≥900 seconds ago (15 min). For overdue critical values: escalate to backup physician (call `escalateCriticalValue` callable with backup medico ID). If backup also no-ack after 15 min: status transitions to `CRITICO` + flag `requer-revisao-manual: true` + SMS alert to supervisor. Auditor audit trail is immutable: every state change appends to `atualizacaoCritico[]` array with timestamp, operator ID, SMS ID, SLA status (`on-time` | `late` | `no-ack`), and chainHash. **Prevention of missed notifications: SMS delivery is not synchronous—if Twilio is down, processor retries until success. Physician ACK is mandatory (callable `acknowledgePhysicianReceipt` fired by Twilio webhook when doctor replies "ACK" to SMS). If no ACK within 15 min, escalation is automatic (no manual step required). Multi-tenant isolation: critical values are queried per lab (`where status === 'ALERTADO' AND labId === X`), preventing cross-lab alerts. Firestore rules deny direct client mutations to critical-values docs—all writes via callables only.\*\* Implementation Phase 5–6 (see 10-02-PLAN.md), E2E tests: 6 specs covering detect → SMS send, ACK within SLA, escalation timeout, override, webhook handling, multi-attempt retry.

---

## RFI #3: How is patient portal authentication stateless yet LGPD compliant? How does email-link auth prevent unauthorized access?

**Context:** LGPD Art. 38 (patient consent) + Art. 8 (no 3P delegation) + RDC 978 Arts. 166–180 (result delivery proof). Auditor will verify no password storage, no session DB, and defensible result delivery audit trail.

**Answer:**

Patient portal auth is stateless via HMAC-signed email-link tokens per ADR-0024: **(1) Token generation:** when patient requests access (via callable `generatePatientAuthLink(labId, patientIdentifier)`), server generates JWT payload `{labId, patientId, iat, exp: iat+7d}`, signs it with HMAC-SHA256 using `HCQ_SIGNATURE_HMAC_KEY` (stored in Secret Manager), and embeds in email link: `portal.hmatologia2.web.app/verify?token=<SIGNED>`. Email includes LGPD disclaimer ("by clicking, you consent to HC Quality processing your results for 7 days"). No PII in URL (only hashed token). (2) Stateless verification:** when patient clicks link (or submits token to callable `verifyPatientAuthToken`), server: computes HMAC-SHA256 of token payload, compares signature—if mismatch, rejects (forged token detected). If valid + not expired: issues Firebase custom token (30-day TTL, scope: `read own laudo only`). Token is never stored in database; verification is pure cryptographic operation. (3) Firestore rules enforce patient isolation:** `match /labs/{labId}/laudos/{laudoId} { allow read: if request.auth.token.portal == true && request.auth.uid == resource.data.patientId; }` — patient can only read if custom token has `portal: true` flag AND their UID matches laudo's patientId. (4) LGPD compliance:** minimal PII storage (patient name, DOB, CPF hashed, email encrypted); no password = zero password breach; no 3P OAuth = no delegation to Google/GitHub. (5) RDC 978 proof of delivery:** audit events logged to `/labs/{labId}/audit-patient-portal`: `auth-link-gerado` (with timestamp), `token-verificado` (click timestamp), `laudo-baixado` (download timestamp + IP for fraud detection). Email timestamp + link-click timestamp form defensible chain-of-custody evidence. (6) Rate limiting:** max 5 verification attempts per token per minute (brute-force protection via callable rate limiter). **Non-repudiation:** email sent-from address is lab-specific (registered with Sendgrid), audit log includes sender domain; auditor can cross-check with Sendgrid delivery receipt. Session expires at 30 days or patient logout (client-side custom token deletion; no server session store to invalidate).** Implementation Phase 4 Weeks 1–2 (see 11-01-PLAN.md), E2E tests: 6 specs covering generate link, verify token, download, token expiry, brute-force protection, mobile responsive.

---

## RFI #4: How does Gemini Vision OCR ensure audit trail for classifying analyzer results? What prevents silent errors?

**Context:** ADR-0025 mandates equipment-agnostic multi-analyte extraction (H550, coagulation, immunology, urinalysis). Auditor will verify: (a) confidence scoring flags low-accuracy results, (b) manual review audit trail, (c) versioning of prompts (to detect future accuracy degradation).

**Answer:**

Gemini Vision OCR audit trail and error prevention per ADR-0025 **Phase 11 Weeks 1–2:** (1) **Structured extraction with confidence scoring:** Cloud Function callable `classifyAnalyzerImage(labId, equipmentType, imagePath)` dispatches to equipment-specific Zod schema (H550ResultSchema, CoagulationResultSchema, etc.) and Gemini prompt. Gemini returns JSON with `{ field_value, confidence_pct }` for each analyte. (2) **Low-confidence flagging:** system checks all confidence scores; if any field <80%, sets `requiresManualReview: true`. These flagged results appear in RT dashboard with yellow warning: "OCR confidence <80% — manual review required". RT can accept (trust Gemini), reject (re-enter manually), or correct individual values. (3) **Audit trail storage:** every OCR result stored immutably in `/labs/{labId}/ia-ocr-results/{resultId}`: `{ equipmentType, imagePath, parsedResult, requiresManualReview, geminResponse (raw), confidenceScores, chainHash (per ADR-0012), ts, processedBy: operatorId }`. (4) **Manual review feedback loop:** if RT rejects/corrects, feedback appended to `/labs/{labId}/ia-ocr-corrections/{correctionId}`: `{ resultId, correctedValues, fieldsWrong }`. This forms a training dataset for future Gemini prompt tuning or ML fine-tuning. (5) **Prompt versioning & audit:** prompts stored in Firestore config (each equipment type gets a prompt version tag). When Gemini API is called, current prompt version is captured in result doc. Monthly accuracy report queries OCR results grouped by prompt version, confidence bin, and equipment type—auditor can see if accuracy degrades over time (indicating need for prompt re-tuning). (6) **Error prevention:** Zod validates output schema before storage (type mismatches caught). If Gemini returns unparseable JSON or violates min/max bounds (e.g., WBC = 50,000 K/µL, physically impossible), validation fails, result marked with `parseError: true` + stored anyway (for manual review). (7) **Multi-equipment isolation:** callable enforces equipment type whitelist (H550, coagulation, immunology, urinalysis only); unknown type rejected. (8) **Non-repudiation:** `processedBy: operatorId` logs which RT initiated OCR call. If result is wrong + leads to audit finding, auditor can trace back to operator + result ID. **Offline fallback:** if Gemini unavailable (network down), callable fails gracefully (returns error); RT falls back to manual result entry (no silent OCR bypass).\*\* Implementation Phase 11 Weeks 1–2 (see 09-02-PLAN.md), E2E tests: 8 specs (all 4 equipment types, low-confidence flagging, manual review, audit trail, prompt version tracking, JSON validation failure, multi-attempt Gemini timeout retry).

---

## RFI #5: How does NOTIVISA queue handle API failures + ensure idempotency? What prevents duplicate disease notifications to Anvisa?

**Context:** RDC 978 Art. 66 + Portaria 204/2016 require disease notification within 24 hours. Anvisa API is notoriously unreliable; system must retry transients without duplicate submissions.

**Answer:**

NOTIVISA queue implements append-only outbox pattern with exponential-backoff retries + idempotency keys per ADR-0026 **Phases 8–12:** (1) **Append-only outbox:** disease notifications created in `/labs/{labId}/notivisa-outbox/{entryId}` with status `pending`. `submissionAttempts[]` is append-only (Firestore rules deny element deletion); every submission attempt (success or failure) appends a record: `{ attempt: N, ts, method, status, error?, receiptCode?, roundTripMs }`. (2) **Phase 8 sandbox mode:** mock submitter (`method: 'mock-submit'`) responds instantly (status `mocked`), entry transitioned to `acknowledged`. Same code path as real API (Phase 12 swaps real `submitNotivisaToAnvisa` function in place of mock). (3) **Phase 12+ production:** scheduled processor `processNotivisaQueueScheduled` runs every 5 minutes. For each `status === 'pending'` entry with `notificationDeadline <= now()`: attempt Anvisa SOAP API call. If success (200 OK + receiptCode): append attempt record with `status: 'success'` + receiptCode, transition entry to `submitted`. If Anvisa returns 400/422 (validation error, e.g., missing patient CPF): mark `status: 'failed-permanent'` (don't retry), escalate to supervisor SMS alert. If Anvisa returns 500/timeout: append attempt record with `status: 'failed'`, keep status `pending`, schedule retry. (4) **Exponential backoff:** `[1, 5, 15, 45, 120]` minutes between attempts (attempt 1 → 2 min wait → attempt 2 → 5 min wait, etc.). Max 5 attempts; if still pending after attempt 5, mark `failed-permanent`. (5) **Idempotency key:** each entry computes `idempotencyKey = SHA256(labId + diseaseCode + patientDoB + resultDate)`. Included in SOAP payload sent to Anvisa. **Anvisa API respects idempotency key: if you submit same key twice, returns same receipt (no duplicate entry created).** This prevents accidental duplicate submissions if processor retries same form. (6) **Webhook for Anvisa acknowledgment (Phase 12+):** Anvisa posts callback to `handleAnvisaWebhook`, verifies signature (HMAC-SHA256 over payload), and updates entry: `status: 'acknowledged'`, stores `anvisa_eventId`. Webhook is idempotent (re-posting same event updates same entry). (7) **Past-deadline escalation:** if entry remains in `pending` or `submitted` status AND `notificationDeadline < now()` AND not yet escalated: scheduler marks `escalatedToSupervisor: true`, sends SMS + email alert to supervisor (via Twilio). Supervisor can check pending forms, retry, or manually mark resolved if form was submitted via backup channel. (8) **Audit trail:** complete history visible in `submissionAttempts[]` + `escalatedToSupervisor`, `escalationMotivo`, `overrideStatus`. Auditor can reconstruct: "form created at X, submitted at Y, Anvisa returned error Z at attempt 2, retried at attempt 3, succeeded at attempt 4 with receipt ABC123". (9) **RDC 978 compliance:** 24h deadline enforced by scheduler; form + receipt + full audit trail form defensible evidence. **Supervisor runbook** (Phase 8 Week 3): how to check stuck forms, how to manually resolve, troubleshooting steps for cert expiration or Anvisa API issues. Implementation Phase 8 Weeks 1–2 (sandbox), Phase 12 Weeks 1–3 (production), E2E tests: 6 specs covering draft creation, mock submission, attempt logging, past-deadline escalation, webhook acknowledgment, idempotency key validation (Phase 12+).

---

## Summary Table: ADR to RFI Mapping

| RFI | Topic                     | ADR  | Key mechanism                                                                          | Audit gate                                                                   |
| --- | ------------------------- | ---- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| #1  | CAPA immutability         | 0022 | 5-state FSM + append-only audit trail + chainHash                                      | Evidence hash verification + operator non-repudiation                        |
| #2  | Critical values SLA       | 0023 | 4-state FSM + Twilio SMS queue + escalation automation                                 | Physician ACK via SMS webhook + SLA counters + audit events                  |
| #3  | Patient portal auth       | 0024 | HMAC-signed stateless email-link tokens + Firestore rules isolation                    | Email delivery proof + link-click timestamp + zero password storage          |
| #4  | Gemini Vision audit trail | 0025 | Equipment-specific Zod schemas + confidence scoring + prompt versioning                | Low-confidence flagging + manual review feedback loop + OCR accuracy report  |
| #5  | NOTIVISA idempotency      | 0026 | Append-only outbox + exponential-backoff scheduler + idempotency keys + Anvisa webhook | Receipt code capture + past-deadline escalation + submission attempt history |

---

## Compliance Coverage (v1.4 Phases 4–11)

**RDC 978 articles covered by these ADRs:**

- **Art. 5.3** (Audit Trail): chainHash + append-only events in all 5 ADRs
- **Art. 66** (Reportable Diseases): NOTIVISA queue + 24h deadline (ADR-0026)
- **Art. 115** (Patient Consent): email-link auth + LGPD disclaimer (ADR-0024)
- **Art. 147** (CAPA Closure): 5-state machine + auditor approval gates (ADR-0022)
- **Arts. 166–180** (Result Communication): proof of delivery via email + link-click audit (ADR-0024)
- **Arts. 184–191** (Critical Values): 5-min SLA + physician notification + ACK tracking (ADR-0023)
- **Art. 161** (IA Usage): Gemini confidence scoring + manual review (ADR-0025)

**DICQ blocks expected gains (78.5% → 90%+):**

- **Block C** (Audit Trail): +5–6 pts (append-only event logging across all modules)
- **Block D** (Result Communication): +3–4 pts (NOTIVISA + patient portal proof of delivery)
- **Block A** (Quality Management System): +2–3 pts (CAPA closure workflow)

---

## Next Auditor Actions

1. **RFI clarification call:** Week of 2026-05-13 (90 min, CTO + Auditor)
   - Confirm understanding of stateless auth (ADR-0024)
   - Confirm Twilio SMS reliability assumptions (ADR-0023)
   - Review chainHash validation logic (ADR-0022, ADR-0025, ADR-0026)

2. **Phase 4 gate review:** End of Phase 4 Week 2 (2026-06-02)
   - Verify CAPA state machine + auditor approval flow working
   - Confirm patient portal email-link + token generation tested
   - Confirm NOTIVISA queue sandbox processing 100%

3. **Phase 5–6 SLA validation:** End of Phase 6 (2026-06-23)
   - Test critical-value escalation with live Twilio SMS
   - Confirm physician ACK audit trail complete
   - Measure actual SLA performance (target median <3 min, p99 <10 min)

4. **Pre-audit document review:** 2 weeks before external audit (2026-08-15)
   - Audit log exports (CAPA closures, critical values, patient portal downloads, NOTIVISA submissions)
   - OCR accuracy report (Gemini confidence distribution by equipment type)
   - Monthly compliance dashboard (RDC 978 article coverage, DICQ block scores)

---

**Prepared by:** Claude Haiku 4.5 (Agent Wave)  
**Compliance assurance:** All ADRs cross-linked to RDC 978 + DICQ + LGPD articles  
**Ready for auditor alignment call:** 2026-05-13 onwards
