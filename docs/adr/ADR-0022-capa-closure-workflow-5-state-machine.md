# ADR-0022 — CAPA Closure Workflow: 5-State Machine (Phase 8)

**Date:** 2026-05-07  
**Status:** PROPOSED  
**Decided by:** CTO / fundador  
**Supersedes:** —  
**Superseded by:** —

---

## Problem

Corrective and Preventive Actions (CAPAs) are RDC 978 Art. 147 (§5.1) mandatory artifacts. Auditoria externa (2026-10-15) will examine CAPA lifecycle: opening → investigation → evidence submission → auditor review → closure. Without formalized state machine, risk of:

1. **Audit trail gaps** — transitions undocumented; auditor cannot prove RT actually reviewed evidence before closing.
2. **Premature closures** — CAPA marked closed without auditor sign-off (non-compliance to RDC 978).
3. **Evidence loss** — evidence submitted but no seal/hash proof of integrity at submission time.
4. **Operator confusion** — ambiguous state (is it "on-hold" or "waiting for auditor"?).

**Business context:** Riopomba has ~12 open CAPAs from Phase 2 audit; v1.4 Phase 4 must deliver closure workflow + migrate legacy CAPAs into new state machine.

---

## Decision

**v1.4 Phase 4 implements 5-state CAPA machine, enforced server-side via Cloud Function callables, with append-only audit trail per transition.**

### State Machine Definition

```
aberto (initial)
  ↓ [operator: iniciar investigação]
em-andamento
  ↓ [operator: submeter evidência]
evidencia-submetida
  ├→ [auditor: rejeitar] ↻ em-andamento
  ↓ [auditor: aceitar]
auditor-revisando
  ├→ [auditor: rejeitar] ↻ em-andamento
  ↓ [auditor: aprovar]
fechado (final)
  ↓ [soft-delete marker]
(soft-deleted, preserving history)
```

### States & Responsibilities

#### `aberto` (Open/Initial)
- CAPA created by quality team after Finding/NC identified.
- Fields: `titulo`, `descricao`, `dataAbertura`, `findingId` (link to audit finding), `proprietario` (operator assigned).
- Transitions: only to `em-andamento` (via `iniciarInvestigacao` callable).
- Audit event: `{ operatorId, ts, acao: 'opened', propriedadeAlterada: {proprietario} }`.

#### `em-andamento` (In Progress)
- Operator investigates root cause, develops corrective plan.
- Fields: `analiseRaizCausa` (RCA), `acaoCorretivaPlano`, `dataPrevisaoEvidencia` (target evidence date).
- Transitions: to `evidencia-submetida` (via `submeterEvidencia` callable) or back to `aberto` (if CAPA withdrawn).
- Audit event: `{ operatorId, ts, acao: 'investigacao-iniciada' }`.

#### `evidencia-submetida` (Evidence Submitted, Awaiting Review)
- Operator uploads evidence (PDF, photo, CSV export, audit log snapshot).
- Evidence file stored in Firebase Storage `/labs/{labId}/capa-evidencia/{capaId}/` with content-hash.
- Fields: `evidenciaDocumento` (Storage ref), `evidenciaHash` (SHA-256 of file), `dataSubmissao`, `submissaoChainHash` (HMAC seal per ADR-0012).
- Transitions: to `auditor-revisando` (no explicit action needed; auto-escalate to auditor queue) or back to `em-andamento` (if auditor requests more evidence).
- Audit event: `{ operatorId, ts, acao: 'evidencia-submetida', evidenciaHash }`.

#### `auditor-revisando` (Auditor Review In Progress)
- Auditor (defined by role `isAuditorMasterCIQ`) reviews evidence + RCA.
- Fields: `auditorId` (assigned reviewer), `dataRevisaoInicio`, `comentariosAuditor` (qualitative feedback).
- Transitions: to `fechado` (approve + evidence satisfactory) or back to `em-andamento` (reject + ask for rework).
- Rejection reason must be documented: `{ rejeicaoMotivo, rejeicaoData, rejeicaoAuditorId }`.
- Audit event: `{ auditorId, ts, acao: 'revisao-iniciada' }` or `{ acao: 'evidencia-rejeitada', motivo }`.

#### `fechado` (Closed/Resolved)
- CAPA approved by auditor; corrective action effective.
- Fields: `dataFechamento`, `auditorIdAprovador`, `dataEfetividadeVerificacao` (follow-up audit date).
- Transitions: none (final state). Soft-delete flag set if no longer relevant, but record persists.
- Audit event: `{ auditorId, ts, acao: 'capa-fechada', evidenciaHashFinal }`.

---

## Implementation Details

### Cloud Function Callables (Phase 4 Deliverables)

1. **`capaOpenNewCAPAWorkflow(labId, titulo, descricao, findingId)`**
   - Creates doc in `/labs/{labId}/capaWorkflow/{id}` with status `aberto`.
   - Firestore rules: only `isAdminOrOwner` role can create.
   - Returns: `{ capaId, status, chainHash }`.
   - Audit event appended to `transicoesCAPAs[]`.

2. **`capaStartInvestigation(labId, capaId, analiseRaizCausa, acaoCorretivaPlano, dataPrevisao)`**
   - Validates: CAPA in state `aberto`.
   - Validates: `analiseRaizCausa.length > 100` (RCA must be substantive).
   - Validates: `dataPrevisao > now()` (future date).
   - Transition: status → `em-andamento`.
   - Generates chainHash (HMAC of `{labId, capaId, status, ts}`).
   - Audit event: appended + hashed.

3. **`capaSubmitEvidence(labId, capaId, evidenciaDocumentoPath, evidenciaHash)`**
   - Validates: CAPA in state `em-andamento`.
   - Validates: file exists in Firebase Storage path.
   - Validates: SHA-256 hash of file matches `evidenciaHash` (immutability check).
   - Transition: status → `evidencia-submetida`.
   - Generates chainHash.
   - Auto-escalates to auditor queue (query: `status === 'evidencia-submetida' AND createdAt > now() - 24h`).
   - Audit event: appended + hashed.

4. **`capaAuditorReviewStart(labId, capaId, auditorId)`**
   - Validates: CAPA in state `evidencia-submetida` AND caller is `auditorId` with role `isAuditorMasterCIQ`.
   - Transition: status → `auditor-revisando`, set `auditorId` + `dataRevisaoInicio`.
   - Generates chainHash.

5. **`capaAuditorApprove(labId, capaId, comentarios)`**
   - Validates: CAPA in state `auditor-revisando` AND caller has `isAuditorMasterCIQ`.
   - Transition: status → `fechado`, set `dataFechamento` + `auditorIdAprovador`.
   - Generates chainHash.
   - **Immutable:** all fields locked after transition (Firestore rules deny further writes to this doc, except soft-delete).

6. **`capaAuditorReject(labId, capaId, motivo)`**
   - Validates: CAPA in state `evidencia-submetida` OR `auditor-revisando`.
   - Transition: status → `em-andamento` (rework requested).
   - Appends rejection event: `{ auditorId, rejeicaoMotivo, rejeicaoData, acao: 'evidencia-rejeitada' }`.
   - Generates chainHash.

7. **`capaSoftDelete(labId, capaId)`**
   - Validates: CAPA in state `fechado` (only after auditor approval can be marked deleted).
   - Sets `deletadoEm: Timestamp.now()`, `deletadoPor: request.auth.uid`.
   - **Preserves:** all history in `transicoesCAPAs[]` and evidence storage.
   - Generates final chainHash.

### Firestore Schema

```typescript
// /labs/{labId}/capaWorkflow/{capaId}
interface CAPAWorkflow {
  id: string;
  labId: string;
  
  // Identification
  titulo: string;
  descricao: string;
  findingId?: string; // link to audit finding
  
  // Lifecycle
  status: 'aberto' | 'em-andamento' | 'evidencia-submetida' | 'auditor-revisando' | 'fechado';
  proprietarioId: string; // operator assigned to investigation
  
  // Timeline
  dataAbertura: Timestamp;
  dataInvestigacaoInicio?: Timestamp;
  dataPrevisaoEvidencia?: Timestamp;
  dataSubmissao?: Timestamp;
  dataRevisaoInicio?: Timestamp;
  dataFechamento?: Timestamp;
  
  // Investigation (em-andamento)
  analiseRaizCausa?: string; // RCA (min 100 chars)
  acaoCorretivaPlano?: string;
  
  // Evidence (evidencia-submetida)
  evidenciaDocumento?: string; // Firebase Storage path
  evidenciaHash?: string; // SHA-256 of file
  submissaoChainHash?: string; // HMAC seal at submission
  
  // Auditor Review
  auditorId?: string;
  auditorIdAprovador?: string;
  comentariosAuditor?: string;
  rejeicaoMotivo?: string;
  dataEfetividadeVerificacao?: Timestamp;
  
  // Audit Trail (append-only)
  transicoesCAPAs: Array<{
    acao: 'aberto' | 'investigacao-iniciada' | 'evidencia-submetida' | 'revisao-iniciada' | 'capa-fechada' | 'evidencia-rejeitada';
    operatorId: string;
    auditorId?: string;
    ts: Timestamp;
    chainHash: string;
    motivo?: string; // if rejection
    evidenciaHash?: string;
  }>;
  
  // Soft Delete
  deletadoEm?: Timestamp;
  deletadoPor?: string;
  
  // Compliance
  criadoEm: Timestamp;
  criadoPor: string;
}
```

### Audit Trail & Immutability

- **Append-only:** each transition appends to `transicoesCAPAs[]`; no element deletion.
- **Chain hash:** each transition computes HMAC over `{ labId, capaId, status, ts, transicaoIndex }`. Hash of previous transition included in next (forming chain).
- **No direct writes:** Firestore rules deny client-side mutations to CAPA docs. All writes via callables.
- **Evidence integrity:** file hash verified at submission time; mismatch = rejection.

---

## Rationale

1. **RDC 978 Art. 147 compliance:** 5-state machine maps directly to audit expectations: open → investigate → submit → review → close.
2. **Evidence chain-of-custody:** evidence hash captured at submission; auditor hash captured at approval. No evidence tampering possible post-submission.
3. **Auditor accountability:** `auditorIdAprovador` field makes approval non-repudiable.
4. **Regulatory audit readiness:** state machine + audit trail form comprehensive dossier for external auditor.
5. **Extensibility:** state machine extensible to future RDC requirements (e.g., follow-up effectiveness checks) without breaking Phase 4 schema.

---

## Alternatives Considered

### A. Flat status flags (no state machine)
**Pros:** simpler schema (fewer validations).  
**Cons:** no enforcement of transitions (can jump from `aberto` → `fechado` directly); auditor cannot verify workflow integrity.  
**Rejected:** Violates audit trail requirements.

### B. Asyncio event sourcing (every action is an event, replay to compute state)
**Pros:** perfect audit trail; immutable event log.  
**Cons:** complex implementation; requires event replay on every read (higher latency); overkill for CAPA (state transitions are rare).  
**Rejected:** Over-engineered for v1.4 scope. Use simple state field + append-only transitions array.

### C. Transition gates via Firestore rules alone (no Cloud Functions)
**Pros:** no callable overhead.  
**Cons:** Firestore rules are hard to test; cannot validate business logic (e.g., RCA length > 100 chars); cannot auto-escalate to auditor queue.  
**Rejected:** Thin service, fat hooks pattern (per CLAUDE.md) requires business logic in callables.

---

## Consequences

### Positive

1. **Auditability:** transitions + evidence hashes form complete trail; auditor can verify no shortcuts taken.
2. **Operator clarity:** state machine removes ambiguity ("where is this CAPA?").
3. **Phase 4 timeline:** state machine + callables deliverable in ~2–3 weeks (core implementation straightforward).
4. **Backward-compatible:** legacy CAPAs (from Riopomba audit) can be migrated into `fechado` state with synthetic history (one-time import).

### Negative

1. **Callable dependency:** all CAPA operations go through Cloud Functions (no offline CAPA creation possible).
2. **Evidence storage management:** uploaded evidence files must be managed separately (Firebase Storage quota); large evidence PDFs may hit quota.
3. **Auditor workflow design needed:** Phase 4 must also design auditor UI (list of `evidencia-submetida` CAPAs, review form, approve/reject buttons). Not in scope of this ADR but blocks Phase 4 delivery.

---

## Derived Commitments

1. **Phase 4 deliverables (Weeks 1–3):**
   - Cloud Function callables: 7 callables (create, start, submit, approve, reject, soft-delete).
   - Firestore rules: CAPA collection protected (only callables can write).
   - E2E tests: 8 specs covering all state transitions + rejection flow + evidence hash mismatch.
   - UI: auditor review dashboard (list pending CAPAs, download evidence, approve/reject form).

2. **Legacy CAPA migration (Week 4, parallel):**
   - Script: `scripts/migrate-legacy-capa-to-5-state.sh` reads ~12 Riopomba CAPAs from v1.3, maps to `fechado` state.
   - Synthetic history: single entry in `transicoesCAPAs[]` with `acao: 'migrado'` + timestamp of migration.
   - Manual auditor review: CTO/Lab Manager spot-check 2–3 migrated CAPAs to confirm evidence is present + coherent.

3. **Auditor training (Week 3):**
   - Runbook: `OPERATIONS_MANUAL_v1.4_CAPA_WORKFLOW.md` describing state machine + UI navigation.
   - 30-min training call with Riopomba audit team.

4. **Firestore Rules (Phases 4–5 combined):**
   - CAPA `/{labId}/capaWorkflow/{capaId}`: only callables can write.
   - Audit events `/{labId}/capaWorkflow/{capaId}/transicoesCAPAs`: append-only (client-side write denied).
   - Evidence `/{labId}/capa-evidencia/{capaId}/*`: world-readable (evidence cannot be deleted by operator once approved).

---

## Links to Related ADRs & Phases

- **ADR-0012** — RDC 978 audit trail logical signature (chainHash implementation).
- **ADR-0016** — FMEA-Lite risk methodology (CAPA links to risk register via `linkedRisks[]` bidirectional).
- **Phase 4** — CAPA Closure (v1.4 roadmap).
- **RDC 978 Art. 147** — CAPA requirements (statutory reference).
- **DICQ 4.1.2.4** — Ações de correção (DICQ mapping).

---

**ADR Status:** PROPOSED (2026-05-07)  
**Gate Review:** End of Phase 4 Week 2 (confirm callables deployed + 2 CAPAs successfully transitioned through full cycle).  
**Auditor Briefing:** Phase 4 Week 3 (describe state machine + show audit trail dossier).
