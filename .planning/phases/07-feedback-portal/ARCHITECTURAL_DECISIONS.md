# Phase 7 — Architectural Decisions & ADR References

**Purpose:** Document key design decisions, their rationale, and alignment with existing ADRs.

---

## Decision 1: Token-Based NPS Access (No Authentication Required)

**Status:** Approved  
**Related ADR:** ADR-0001 (Audit Chain), ADR-0011 (Feedback Loop Architecture — pending Phase 11-02)

### Context

Patient NPS forms must be accessible without forcing authentication, to maximize response rates (critical for DICQ 4.14.3 compliance). However, patient data (pacienteId, lauro linkage) must remain PII-protected until 90 days post-response.

### Decision

- **NPS links are token-based (JWT)**, not UUID-based
- Token contains: `{ lauroId, pacienteId, labId, iat, exp: +7d }`
- **HMAC-signed** via `process.env.NPS_TOKEN_SECRET` (stored in Functions secrets)
- **Rate limit:** 5 NPS submissions per IP per day (via ipHash field, not user ID)
- **Firestore rules:** Public reads only if `pacienteId == null` OR token validated server-side
- **Server-side signature generation:** All writes via callable (admin SDK), not client-side

### Rationale

1. **Security:** Token HMAC prevents forgery; expiry prevents indefinite access
2. **LGPD Compliance:** PII (pacienteId) extracted server-side, never exposed in URL after decoding
3. **Privacy-by-design:** Rate limit by IP (not user ID) to avoid tracking unauthenticated patients
4. **SPA-friendly:** No redirect to login; seamless user experience for patients
5. **Auditability:** Every NPS submission logged with ipHash + operatorId in audit trail

### Tradeoffs

- ❌ Cannot re-send NPS link if patient lost email (mitigated: link valid 7 days; patient can request new via support)
- ❌ Cannot correlate NPS to authenticated user if they didn't log in (acceptable; cpfHash retained for basic analytics)

### Implementation Checklist

- [ ] `NPS_TOKEN_SECRET` configured in `functions/.env.local` (dev) + Cloud Secret Manager (prod)
- [ ] Token validation in `submitNPSResposta` callable (verify HMAC, expiry, non-repudiation)
- [ ] ipHash computed client-side as `hashEmail('${pacienteId}:${xForwardedFor}')` to prevent double-submission
- [ ] Firestore rules reject public writes without valid token OR server-side signature
- [ ] Audit log entry created on every submission (for LGPD compliance)

---

## Decision 2: Daily Anonimização Cron (90-Day Retention Window)

**Status:** Approved  
**Related ADR:** ADR-0017 (LGPD PII Anonymization Pattern — to be created Phase 11-02)

### Context

LGPD Lei 13.709/18 Art. 9 restricts processing of "special categories" of personal data (health data in NPS comentario). After DICQ compliance audit window (90 days post-response), PII can be safely deleted. However, we must retain **cpfHash** for analytics aggregation (non-identifying proxy for patient volume).

### Decision

- **Anonimização runs daily @ 03:00 BRT** via Pub/Sub cron (`onSchedule('1 3 * * *', ...)`)
- **Scope:** NPSRespostas where `criadoEm < (now - 90 days) AND anonimizadoEm == null`
- **Mutation:**
  - `pacienteId: null` (zero out patient linkage)
  - `comentario: filterPII(comentario)` (redact CPF, phone, RG patterns)
  - `anonimizadoEm: Timestamp.now()`
  - `piiMask: true` (flag for audit purposes)
  - ✅ **RETAIN:** `cpfHash` (non-identifying hash for volume analytics)
- **Batch size:** 500 per transaction (to avoid quota limits; retries for larger batches)
- **Audit trail:** Create entry in `labs/{labId}/anonimizacao-audit/{timestamp}` with count + date cutoff
- **Fallback:** If cron fails, re-runs next day (idempotent via `anonimizadoEm` check)

### Rationale

1. **LGPD Compliance:** Art. 18 (right to access) satisfied for 90d; Art. 9 (special categories) respected thereafter
2. **Auditability:** Audit log proves compliance; timestamp field documents when PII was purged
3. **Analytics Retention:** cpfHash allows "how many unique patients?" without PII exposure
4. **Data Minimization:** Regex filters redact free-form PII (CPF, phone) that patients may enter in comentario
5. **Operational Safety:** Batch processing + retries prevent data loss; daily schedule is forgiving

### Tradeoffs

- ❌ Some patient names/identifiers in comentario may slip through regex (mitigated: manual RT review for high-sensitivity cases)
- ❌ Cannot link anonymized NPS to original patient after 90d (acceptable; compliance takes priority)

### Implementation Checklist

- [ ] `filterPII(text)` utility regex-tested for CPF, phone, RG patterns
- [ ] Cron syntax verified: `1 3 * * *` (not `0 3 * * *` to avoid thundering herd)
- [ ] Batch transaction size = 500 (verified against Firestore quota limits)
- [ ] Idempotency check: query filters `anonimizadoEm == null` (safe to re-run)
- [ ] Audit log schema documented (type, quantidadeAnonimizada, dataExecucao, limiteIdade)
- [ ] Error handling: if cron fails, log to Cloud Logs + alert (no silent failure)
- [ ] Monthly audit: verify anonimização completed successfully via Cloud Logs

---

## Decision 3: Suggestion State Machine (No Partial Transitions)

**Status:** Approved  
**Related ADR:** ADR-0011 (Feedback Loop Architecture)

### Context

Staff suggestions must follow a defined workflow to prevent confusion and ensure proper governance. Suggestions transition from `aberta` (new) → `analisada` (reviewed) → `implementada|rejeitada` (final). No backward transitions; no state jumps.

### Decision

- **State machine enforced server-side** (via callable `transitarSugestao`)
- **Valid transitions:**
  ```
  aberta         → analisada        (internal RT decision, no event)
  analisada      → implementada     (with dataImplementacao = now())
  analisada      → rejeitada        (with motivoRejeicao 50+ chars required)
  implementada   → (none, final)
  rejeitada      → (none, final)
  ```
- **No backward transitions:** e.g., rejeitada → analisada is forbidden (create new suggestion instead)
- **Upvote semantics:**
  - ✅ Allowed in `aberta` state (staff voting)
  - ✅ Allowed in `analisada` state (continued engagement)
  - ❌ Locked after transition to `implementada|rejeitada` (votaraisPor array frozen)
- **Firestore rule validation:** Rule function `validSuggestaoTransition(before, after)` enforces server-side

### Rationale

1. **Auditability:** Clear workflow prevents ambiguous states; compliance auditors can follow decision logic
2. **UX Clarity:** Staff knows where suggestion is in lifecycle; no surprises
3. **Soft-delete safety:** Even if suggestion is marked deleted (`deletadoEm`), state remains immutable (no resurrection)
4. **Upvote integrity:** Locking votes after decision prevents gaming (e.g., rejecting then re-opening to reset votes)

### Tradeoffs

- ❌ Cannot "revise" a rejected suggestion (must create new one — OK per DICQ 4.14.4 design)
- ❌ Requires RT decision to move `aberta → analisada` (no auto-promotion — intentional for review)

### Implementation Checklist

- [ ] `transitarSugestao` callable validates state machine in both callable + Firestore rules
- [ ] Error messages for invalid transitions (e.g., "Cannot reject implementada suggestion")
- [ ] UI: disable state transition buttons if not allowed
- [ ] Unit tests: cover all valid transitions + edge cases (deleted suggestions, etc.)
- [ ] Audit trail: log each state transition with operator + timestamp

---

## Decision 4: NPS Sentiment Classification (Optional in Phase 7.2)

**Status:** Approved (Phase 7.1 MVP: no Gemini, manual only)  
**Related ADR:** ADR-0011, pending AI integration ADR (Phase 6 stream)

### Context

DICQ 4.14.3 requires measurement of patient satisfaction but does NOT mandate sentiment analysis. Trending dashboard aggregates scores (0–10) into detrator|neutro|promotor buckets. **Optional Phase 7.2 enhancement:** Gemini 2.5 Flash to extract sentiment + keywords from comentario field.

### Decision (Phase 7.1 MVP)

- **No Gemini integration in MVP** (QA/security burden deferred)
- **Manual sentiment:** Computed from score alone (`nota <= 6 → detrator`, etc.)
- **Trending dashboard:** Shows NPS score + respondent count; word cloud built from RCA root-causes (not comments)

### Decision (Phase 7.2+)

- **IF implemented:** Gemini prompt:
  ```
  "Classify sentiment in <100 chars: '{comentario}' as positivo|neutro|negativo. Confidence (0–1)?"
  ```
- **Storage:** Separate subcollection `satisfacao-respostas/{id}/sentimento-gemini/{analiseId}`
  ```typescript
  {
    sentimentoGemini: 'positivo' | 'neutro' | 'negativo',
    topicos: string[],  // extracted keywords
    confianca: number,  // 0–1
    criadoEm: Timestamp,
  }
  ```
- **Thresholds:**
  - ✅ Store sentiment if `confianca >= 0.7`
  - ❌ If `confianca < 0.7`, flag for manual RT review
- **Async processing:** Non-blocking; submitted NPS doesn't wait for Gemini response

### Rationale

1. **MVP Speed:** Phase 7.1 launches without AI overhead; can add analytics later
2. **Cost Control:** Gemini calls per NPS = cost multiplier; Phase 7.2 can measure ROI first
3. **Safety:** Low-confidence results flagged for manual review (prevents automated bias)
4. **DICQ Compatibility:** Manual sentiment fully satisfies requirement; AI is enhancement

### Tradeoffs

- ❌ Phase 7.1 trending dashboard shows no keyword extraction from comments (acceptable; RCA word cloud covers root causes)
- ❌ Manual RT review required if Phase 7.2 is wanted (resource planning needed)

### Implementation Checklist

- [ ] (Phase 7.1 only) Ensure `NPSResposta.categoria` computed from `nota` only; no Gemini dependency
- [ ] (Phase 7.2 when ready) Gemini model: `gemini-2.5-flash` (specified in v1.0 eval)
- [ ] (Phase 7.2) Threshold test: verify confidence filter works; log low-confidence cases
- [ ] (Phase 7.2) Cost monitoring: track API calls/day + billing
- [ ] (Phase 7.2) Audit: Gemini output stored for reproducibility + compliance

---

## Decision 5: Email Campaign Via Resend (Not Firebase Email)

**Status:** Approved  
**Related ADR:** ADR-0006 (Email Infrastructure — deployed Phase 0b)

### Context

Firebase Authentication doesn't include transactional email service. Phase 6 (Escalation) already integrated **Resend** (Brazilian SaaS, LGPD-compliant, 99%+ deliverability). Phase 7 reuses same infrastructure for NPS campaigns.

### Decision

- **Email provider:** Resend (not Firebase/SendGrid/Mailgun)
- **NPS templates:** 2 templates in Resend dashboard
  1. `nps-post-resolucao`: Complaint resolved → rate experience
  2. `nps-trimestral`: Quarterly campaign
- **API key:** `RESEND_API_KEY` stored in `functions/.env` + Cloud Secret Manager
- **Unsubscribe:** Resend honors `List-Unsubscribe` header; patient can opt-out via Resend portal
- **Bounce handling:** Automatic; bounced emails logged to `feedback-audit` collection
- **Rate limit:** 1000 emails/min per Resend plan (verified with account)
- **Warm-up:** SPF/DKIM records already configured (Phase 6)

### Rationale

1. **Consistency:** Reuses existing email infrastructure (Phase 6); no new vendor onboarding
2. **Compliance:** Resend certified LGPD/GDPR; audit trail available for inspections
3. **Deliverability:** 99%+ rate proven in Phase 6 escalation emails
4. **Cost:** Pay-as-you-go (no fixed cost for quarterly campaigns)

### Tradeoffs

- ❌ Resend API required (not built-in Firebase); adds small dependency
- ❌ Email templates must be pre-designed in Resend dashboard (cannot dynamically generate)

### Implementation Checklist

- [ ] Resend API key configured in `functions/.env.local` (dev) + Cloud Secret Manager (prod)
- [ ] 2 email templates created in Resend dashboard (`nps-post-resolucao`, `nps-trimestral`)
- [ ] SPF/DKIM records verified (verify in Resend domain settings)
- [ ] Bounce webhook configured (Resend → Cloud Function to log bounces)
- [ ] Rate limit verified: 1000/min \* 4 weeks = 280k/month (within quota)
- [ ] Test: send 5 sample emails; verify delivery + unsubscribe link
- [ ] Monitoring: Resend dashboard + Cloud Logs for delivery metrics

---

## Decision 6: Firestore Soft-Delete Only (No Hard Deletes)

**Status:** Approved (Phase 0, applies all features)  
**Related ADR:** ADR-0001 (Audit Chain)

### Context

LGPD + RDC 978 require 5-year retention of complaint/feedback data. Hard deletes are irreversible and untraceable. Soft-delete (timestamp `deletadoEm` field) is audit-trail-friendly.

### Decision

- **All feedback entities (Reclamacao, Sugestao, NPSResposta) use soft-delete only**
- **Hard delete forbidden:** Firestore rule `allow delete: if false`
- **Soft-delete pattern:**
  ```typescript
  {
    id: string,
    deletadoEm: Timestamp | null,  // null = active, Timestamp = soft-deleted
    // ... other fields
  }
  ```
- **Queries auto-filter:** Service methods add `where('deletadoEm', '==', null)` where appropriate
- **Audit compliance:** Deletion logged in `feedback-audit` with operator + reason (if provided)

### Rationale

1. **Auditability:** Deletion history preserved; compliance auditors can verify retention
2. **Accidental recovery:** Data can be marked "undeleted" if mistake detected
3. **Legal holds:** If litigation arises, data remains recoverable
4. **LGPD compliance:** Demonstrates intent to retain for 5-year window

### Tradeoffs

- ❌ Queries must filter `deletadoEm` (client-side or via index)
- ❌ Storage cost slightly higher (soft-deleted docs still occupy space until 5y expiry)

### Implementation Checklist

- [ ] Firestore rule blocks `allow delete: if false` on all feedback collections
- [ ] Service methods default to filtering `deletadoEm == null`
- [ ] UI: soft-delete triggered via callable (not direct write)
- [ ] Audit log: deletion logged with operator + timestamp

---

## Decision 7: LogicalSignature on All Writes (ADR-0001 Pattern)

**Status:** Approved (Phase 0, applies all features)  
**Related ADR:** ADR-0001 (Audit Chain)

### Context

Every write to feedback entities must be cryptographically signed to prove non-repudiation (operator cannot deny creating a record). Phase 0 established the `LogicalSignature` pattern: `{ hash, operatorId, ts }`.

### Decision

- **All creates/updates** to feedback entities include `signature` field
- **Signature schema:**
  ```typescript
  interface LogicalSignature {
    hash: string; // SHA-256 of deterministic JSON, 64 chars
    operatorId: string; // request.auth.uid (who wrote this)
    ts: Timestamp; // when written (server timestamp)
  }
  ```
- **Server-side generation:** All writes via callable (admin SDK); client cannot forge signature
- **Hash computation:** `sha256(deterministic(docState))` where deterministic = sorted JSON keys
- **Firestore rule validation:**
  ```firestore
  d.signature.hash.size() == 64 &&
  d.signature.operatorId == request.auth.uid &&
  d.signature.ts is timestamp
  ```

### Rationale

1. **Non-repudiation:** Operator cannot deny creating/modifying a record
2. **Integrity:** Hash detects tampering (though Firestore rules are primary protection)
3. **LGPD + DICQ audit:** Proves who made each decision, when
4. **Compliance:** Supports RDC 978 Art. 117 (traceability requirement)

### Tradeoffs

- ❌ All callables must compute hash (small CPU cost per write)
- ❌ Verification logic duplicated across rules + service (mitigated: unit tests)

### Implementation Checklist

- [ ] `computeLogicalSignature(docState, uid, ts)` utility implemented in Functions
- [ ] All `submitNPSResposta` / `criarSugestao` / etc. callables compute signature server-side
- [ ] Firestore rules validate signature presence + format
- [ ] Unit test: signature hash matches expected value
- [ ] Audit: spot-check random signatures for validity

---

## Decision 8: Multi-tenant Isolation (labId in Paths + Payload)

**Status:** Approved (Phase 0, applies all features)  
**Related ADR:** RN-MULTI-01 (Multi-tenant rule)

### Context

HC Quality is multi-tenant (multiple lab customers). Feedback data must be strictly isolated by labId (compliance + security).

### Decision

- **Path-level isolation:** All feedback lives in `/labs/{labId}/` prefix
  ```
  /labs/{labId}/satisfacao-respostas/{id}
  /labs/{labId}/sugestoes/{id}
  /labs/{satisfacao-campanhas}/{id}
  ```
- **Payload redundancy:** Every doc includes `labId` field (defense-in-depth)
- **Firestore rule:** `labIdMatches(d)` validates `d.labId == path.labId`
- **Service layer:** `labId` is positional parameter (required on every call)
  ```typescript
  export async function submitNPS(labId: string, input: NPSInput) { ... }
  ```

### Rationale

1. **Security:** Impossible to read/write another lab's feedback (even with auth bypass)
2. **Compliance:** Each lab's audit trail is separate + verifiable
3. **Cost isolation:** Labs can analyze own data independently

### Tradeoffs

- ❌ All queries must filter by `labId` (required; no shortcut)

### Implementation Checklist

- [ ] All service methods accept `labId` as first parameter
- [ ] Firestore rules include `labIdMatches` validation
- [ ] Unit test: verify cross-lab read is denied

---

## Summary: Decision Inventory

| #   | Decision                                | Phase           | Status   | Risk Level |
| --- | --------------------------------------- | --------------- | -------- | ---------- |
| 1   | Token-based NPS access (no auth)        | 7.1             | Approved | Low        |
| 2   | Daily anonimização cron (90d window)    | 7.1             | Approved | Low        |
| 3   | Suggestion state machine (no backtrack) | 7.1             | Approved | Low        |
| 4   | NPS sentiment optional (Phase 7.2+)     | 7.2             | Approved | Low        |
| 5   | Resend email provider (not Firebase)    | 7.1             | Approved | Low        |
| 6   | Soft-delete only (no hard deletes)      | 0 (applies all) | Approved | Low        |
| 7   | LogicalSignature on all writes          | 0 (applies all) | Approved | Low        |
| 8   | Multi-tenant isolation (labId paths)    | 0 (applies all) | Approved | Low        |

---

## Pending ADRs to Create (Phase 11-02+)

- **ADR-0011:** Feedback Loop Architecture (state machines, email triggers, anonimização)
- **ADR-0017:** LGPD PII Anonymization Pattern (90-day retention, regex filters)
- **ADR-0018:** Email Campaign Infrastructure (Resend, templates, bounce handling)

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Approval Status:** Ready for implementation
