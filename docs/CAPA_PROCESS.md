# CAPA Process Documentation — Complete Reference

**Version:** 1.0  
**Status:** ACTIVE (Phase 8 Wave 1+)  
**Effective Date:** 2026-05-07  
**Last Updated:** 2026-05-07  
**Compliance:** RDC 978/2025 Art. 86, 147 | DICQ 4.1.2.4 | ISO 15189:2022 §8.5

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Process Flow Overview](#process-flow-overview)
3. [Detailed Process Phases](#detailed-process-phases)
4. [RDC 978 Art. 105 Mapping](#rdc-978-art-105-mapping)
5. [Audit Trail Specifications](#audit-trail-specifications)
6. [Sign-Off Procedures](#sign-off-procedures)
7. [System Implementation](#system-implementation)
8. [Roles & Permissions](#roles--permissions)
9. [Error Handling & Escalation](#error-handling--escalation)
10. [Regulatory Compliance](#regulatory-compliance)

---

## Executive Summary

**CAPA** (Corrective Action / Preventive Action) is the systematic process for responding to non-conformities (NCs) and risks identified during quality operations or audits. Every CAPA lifecycle flows through five mandatory states, each requiring immutable audit trail documentation and role-based sign-offs.

**Key Facts:**
- **Trigger:** Non-conformity detection (NC created with severity critica/alta) OR Risk identified (via FMEA-Lite, RDC 978 Art. 86)
- **Deadline:** 30–90 days target (per RDC 978 Art. 147 §2); configurable per lab
- **Actors:** 
  - **Quality Operator** — initiates investigation, proposes corrective action
  - **RT (Technical Responsible)** — validates RCA, approves action plan
  - **Auditor Master CIQ** — reviews evidence, verifies efficacy, signs closure
- **Artifact:** `/labs/{labId}/capaWorkflow/{capaId}` (Firestore top-level collection)
- **Evidence:** Immutable chain of audit events (`transicoesCAPAs[]` array); no post-closure edits

**Regulatory Context:**
- **RDC 978 Art. 86:** Risk Management (identification → assessment → treatment via CAPA)
- **RDC 978 Art. 147:** CAPA as mandatory control measure (§5.1: "Ações de correção e preventivas")
- **DICQ 4.1.2.4:** Ações de correção (formal workflow, evidence retention)
- **ISO 15189:2022 §8.5:** Nonconformities and corrective actions (investigation → verification → closure)

---

## Process Flow Overview

```
ENTRY POINT
    ↓
[1. ABERTO — Initial State]
    ├─ Trigger: NC created OR Risk identified
    ├─ Fields: titulo, descricao, findingId, proprietario
    ├─ Status: CAPAs cannot be edited until "em-andamento"
    ├─ Audit Event: { acao: 'capa-aberta', operatorId, ts, chainHash }
    └─ Decision: Auto-escalate to assigned proprietario (notify via email)
    ↓
[2. EM-ANDAMENTO — Investigation & Action Planning]
    ├─ Operator initiates: `capaStartInvestigation()`
    ├─ RCA (Root Cause Analysis): min 100 chars, substantive
    ├─ Action Plan: descriptive action + responsible party + deadline
    ├─ Status: CAPAs editable by proprietario + RT
    ├─ Audit Event: { acao: 'investigacao-iniciada', operatorId, ts, chainHash }
    └─ Duration target: 5–15 days (configurable)
    ↓
[3. EVIDENCIA-SUBMETIDA — Evidence Submission & Auditor Queue]
    ├─ Operator submits evidence: `capaSubmitEvidence()`
    ├─ Evidence types: foto, documento, certificado, pop, treinamento
    ├─ Storage path: gs://bucket/labs/{labId}/auditoria-evidencia/capa-{capaId}/{filename}
    ├─ Integrity: SHA-256 hash captured at submission (chain-sealed)
    ├─ Status: CAPA now read-only to proprietario; awaiting auditor review
    ├─ Auto-escalate: Evidence added to auditor review queue (filtered by status='evidencia-submetida')
    ├─ Audit Event: { acao: 'evidencia-submetida', operatorId, ts, evidenciaHash, chainHash }
    └─ Duration target: N/A (awaiting auditor pickup)
    ↓
[4. AUDITOR-REVISANDO — Auditor Review]
    ├─ Auditor (role: isAuditorMasterCIQ) claims CAPA: `capaAuditorReviewStart()`
    ├─ Review scope: 
    │   ├─ RCA completeness (is root cause substantive?)
    │   ├─ Action adequacy (does plan address RCA?)
    │   ├─ Evidence sufficiency (do artifacts prove action taken?)
    │   └─ Effectiveness criteria met (per capa.effectivenessCriteria field)
    ├─ Decision paths:
    │   ├─ APPROVE: `capaAuditorApprove()` → transition to "fechado"
    │   ├─ REJECT: `capaAuditorReject()` → transition back to "em-andamento" (request rework)
    │   └─ HOLD: No direct hold state; use comment field for "pending clarification"
    ├─ Audit Event (approve): { acao: 'capa-fechada', auditorId, ts, comentarios, chainHash }
    ├─ Audit Event (reject): { acao: 'evidencia-rejeitada', auditorId, motivo, ts, chainHash }
    └─ Duration target: 3–7 days
    ↓
[5. FECHADO — Closure & Sign-Off]
    ├─ All fields locked (Firestore rules deny further writes except soft-delete)
    ├─ Fields set:
    │   ├─ dataFechamento: Timestamp.now()
    │   ├─ auditorIdAprovador: request.auth.uid
    │   ├─ closureSignature: LogicalSignature { hash, operatorId, ts }
    │   └─ effectivenessVerified: boolean (true = action effective; false = ineffective but approved anyway)
    ├─ Post-closure: CAPA records archived for audit trail (RDC 978 Art. 105: 5-year retention)
    ├─ Soft-delete option: `capaSoftDelete()` marks deletadoEm (records not removed; RN-06 pattern)
    ├─ Audit Event: { acao: 'capa-fechada', auditorId, auditorIdAprovador, ts, chainHash }
    └─ Duration target: Final (no further transitions)

OPTIONAL REJECTION LOOP (Step 4 → Step 2)
    ├─ If auditor rejects evidence: transition back to "em-andamento"
    ├─ Proprietario notified (email): "CAPA rejected, reason: {motivo}"
    ├─ Rework required: Update RCA, action plan, or resubmit evidence
    ├─ Resubmit: `capaSubmitEvidence()` again → back to "evidencia-submetida"
    └─ Loop count: Tracked in transicoesCAPAs[] (no limit, but auditor log shows effort)
```

### Process Flow Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAPA LIFECYCLE                               │
│                     (RDC 978 Art. 147)                              │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────┐
    │  NC/Finding Detected                 │
    │  (auditor, operator, system alert)   │
    └────────────┬─────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ [1] ABERTO                           │
    │ • Create CAPA doc                    │
    │ • Assign proprietario                │
    │ • Set deadline                       │
    │ • Audit: capa-aberta                 │
    └────────────┬─────────────────────────┘
                 │
                 │ proprietario: iniciarInvestigacao()
                 │ [callable validates status = aberto]
                 ▼
    ┌──────────────────────────────────────┐
    │ [2] EM-ANDAMENTO                     │
    │ • Input RCA (min 100 chars)          │
    │ • Plan corrective action             │
    │ • Set action deadline                │
    │ • Editable by proprietario + RT      │
    │ • Audit: investigacao-iniciada      │
    └────────────┬─────────────────────────┘
                 │
                 │ proprietario: submeterEvidencia()
                 │ [callable validates evidence hash]
                 ▼
    ┌──────────────────────────────────────┐
    │ [3] EVIDENCIA-SUBMETIDA              │
    │ • Evidence uploaded to Storage       │
    │ • Hash sealed (immutable)            │
    │ • Auto-escalate to auditor queue     │
    │ • Audit: evidencia-submetida         │
    └────────────┬─────────────────────────┘
                 │
          ┌──────┴────────────┐
          │                   │
          │ auditor:          │ auditor:
          │ capaAuditorReview │ capaAuditorReject()
          │ Start()           │ [back to EM-ANDAMENTO]
          ▼                   │
    ┌──────────────────┐      │
    │ [4]              │      │
    │ AUDITOR-REVISANDO│──────┘
    │ • Review RCA     │
    │ • Check evidence │
    │ • Verify action  │
    │ • Audit:         │
    │   revisao-iniciada
    └────────────┬─────┘
                 │
                 │ auditor: capaAuditorApprove()
                 │ [callable validates effectivenessCriteria]
                 ▼
    ┌──────────────────────────────────────┐
    │ [5] FECHADO (FINAL)                  │
    │ • All fields locked                  │
    │ • closureSignature set               │
    │ • Soft-delete option available       │
    │ • Audit: capa-fechada                │
    │ • Records: 5-year retention          │
    └──────────────────────────────────────┘

    Audit Trail (transicoesCAPAs array):
    ├─ transição 1: { acao: 'capa-aberta', ... }
    ├─ transição 2: { acao: 'investigacao-iniciada', ... }
    ├─ transição 3: { acao: 'evidencia-submetida', ... }
    ├─ transição 4: { acao: 'revisao-iniciada', ... }
    └─ transição 5: { acao: 'capa-fechada', ... }
```

---

## Detailed Process Phases

### Phase 1: ABERTO (Open/Initial)

**Triggered By:**
- Non-Conformidade created with `severidade = 'critica'` or `'alta'`
- OR Risk identified with `npr >= 20` (FMEA scoring)
- OR Auditor manually creates CAPA via callable

**System Action:**
```typescript
// Cloud Function: capaOpenNewCAPAWorkflow
{
  id: capaId,
  labId: labId,
  titulo: string,           // e.g., "Falta em analisadores de coagulação"
  descricao: string,        // e.g., "Equipamento X offline 8h; impacto: atraso de 12 laudos"
  findingId: string,        // Link to audit finding (optional)
  ncId?: string,            // Link to parent NC (optional, from ADR-0015)
  linkedRiskIds?: [string], // Link to risks (optional)
  
  proprietarioId: string,   // UID assigned operator
  proprietarioNome: string, // Denormalized for display
  
  deadline: Timestamp,      // 30–90 days from now
  status: 'aberto',
  
  transicoesCAPAs: [{
    acao: 'capa-aberta',
    operatorId: system,
    ts: Timestamp.now(),
    chainHash: sha256(...),
  }],
  
  // Immutability markers
  createdAt: Timestamp.now(),
  createdBy: system,
  deletadoEm: null,
}
```

**Responsibilities:**
- **Quality Manager** — creates CAPA with clear, actionable titulo/descricao
- **System** — assigns proprietario based on role or configuration
- **Email Notification** — proprietario receives email with CAPA #, deadline, NC link

**Validation Rules:**
- `titulo.length >= 10 && <= 150` (concise, not empty)
- `descricao.length >= 50 && <= 2000` (substantive context)
- `deadline > now()` (future date)
- `proprietarioId` must be active member of lab

**Audit Trail Entry:**
```json
{
  "acao": "capa-aberta",
  "capaId": "capa-2026-0042",
  "numero": "CAPA-2026-0042",
  "operatorId": "system",
  "ts": "2026-05-07T10:00:00Z",
  "chainHash": "abc123...",
  "payload": {
    "titulo": "...",
    "descricao": "...",
    "deadline": "2026-07-05T23:59:59Z"
  }
}
```

**Exit Criteria:**
- Document created in Firestore (`/labs/{labId}/capaWorkflow/{capaId}`)
- Audit trail entry appended
- Proprietario notified (email sent)
- Status = `aberto`

---

### Phase 2: EM-ANDAMENTO (In Progress — Investigation & Action Planning)

**Initiated By:**
```typescript
// Cloud Function: capaStartInvestigation
// Called by: proprietario or RT
await capaStartInvestigation(labId, capaId, {
  analiseRaizCausa: string,     // RCA (min 100 chars, substantive)
  acaoCorretivaPlano: string,   // Corrective action description
  dataPrevisaoEvidencia: Timestamp, // When evidence will be ready
  investigadorId: string,       // UID of investigator (usually proprietario)
})
```

**System Action:**
- Validates: CAPA in state `aberto`
- Validates: RCA length >= 100 chars (quality gate: not boilerplate)
- Validates: `dataPrevisaoEvidencia > now()` (future date)
- Generates chainHash over `{ labId, capaId, 'em-andamento', ts, transicaoIndex }`
- Appends transition to `transicoesCAPAs[]`
- Updates status → `em-andamento`

**Operator Responsibilities:**
1. **Root Cause Analysis (RCA):**
   - Investigate the NC or risk condition
   - Interview relevant personnel (operators, supervisors, RT)
   - Review equipment maintenance records, calibration certs, training docs
   - Document findings: Why did the NC occur? (Not just "equipment broke" but "scheduled maintenance interval was 6 months, but shift supervisor didn't reschedule after handoff")
   - Minimum 100 characters; aim for 500–1000 chars for complex issues

2. **Corrective Action Plan:**
   - Propose specific, measurable action
   - Assign responsible party (usually proprietario or supervisor)
   - Set realistic deadline (5–30 days typical)
   - Examples:
     - NC: "Reagent B expired in stock" → Action: "Implement 2-week FIFO audit cycle; document in lab ledger; train 2 operators on FIFO protocol"
     - NC: "Calibration missed for analyzer X" → Action: "Implement automated calibration scheduling in equipment module; set monthly alert; train RT on override procedure"
     - Risk: "Equipment downtime > 4h/month" → Action: "Contract preventive maintenance with vendor every 3 months; implement IoT sensor monitoring for early detection"

3. **Effectiveness Criteria:**
   - Define how closure will be verified
   - Examples:
     - "No reagent expiration in stock for 3 consecutive audits"
     - "Equipment uptime >= 99% over 30 days"
     - "All 8 lab technicians retrained on POP-001 and signed acknowledgment"

**Field Updates (Firestore):**
```typescript
{
  status: 'em-andamento',
  
  analiseRaizCausa: string,      // RCA text (immutable after submission)
  acaoCorretivaPlano: string,    // Action plan text
  dataPrevisaoEvidencia: Timestamp,
  effectivenessCriteria: string, // How to verify closure
  
  investigadorId: string,        // UID
  investigadorNome: string,      // Denormalized
  
  transicoesCAPAs: [
    // ... previous transitions
    {
      acao: 'investigacao-iniciada',
      operatorId: investigadorId,
      ts: Timestamp.now(),
      chainHash: sha256(...),
    }
  ],
}
```

**Permissions:**
- **Proprietario** — can create/edit investigation until submit
- **RT** — can view, comment, but not edit without escalation
- **Auditor** — read-only until evidence submitted

**Exit Criteria:**
- RCA documented (>= 100 chars, substantive)
- Action plan defined (description + responsible + deadline)
- Effectiveness criteria clear
- Status = `em-andamento`

**Duration Target:** 5–15 days (depends on complexity)

---

### Phase 3: EVIDENCIA-SUBMETIDA (Evidence Submitted, Awaiting Review)

**Initiated By:**
```typescript
// Cloud Function: capaSubmitEvidence
// Called by: proprietario or operator
await capaSubmitEvidence(labId, capaId, {
  evidenceFile: File,           // PDF, image, CSV, etc.
  evidenceType: 'foto' | 'documento' | 'certificado' | 'pop' | 'treinamento',
  description: string,           // What this evidence proves
})
```

**System Action:**
1. Validates: CAPA in state `em-andamento`
2. Uploads evidence to Firebase Storage:
   - Path: `gs://bucket/labs/{labId}/auditoria-evidencia/capa-{capaId}/{filename}`
   - Computes SHA-256 hash of file contents
3. Validates: Hash matches client-side calculation (integrity check)
4. Stores evidence reference:
   ```typescript
   {
     type: 'foto' | 'documento' | ...,
     storagePath: string,
     uploadedAt: Timestamp,
     uploadedBy: string,
     hash: string,       // SHA-256 (64 hex chars)
     filename: string,
   }
   ```
5. Appends to `evidence[]` array (immutable)
6. Updates status → `evidencia-submetida`
7. Generates chainHash (seals evidence submission)
8. **Auto-escalates to auditor review queue** (visible to users with `isAuditorMasterCIQ` role)

**Evidence Types & Examples:**

| Type | Purpose | Format | Example |
|------|---------|--------|---------|
| `foto` | Visual proof of corrective action | JPG/PNG | "Before/after equipment repair photos" |
| `documento` | Records, logs, certifications | PDF, TXT | "RCA report, root cause determination worksheet" |
| `certificado` | Training completion, certification | PDF | "Technician training certificate for POP-001" |
| `pop` | Updated procedure | PDF | "POP-001 v2 (updated with new calibration interval)" |
| `treinamento` | Training records | Excel, PDF | "Training log: 8 technicians retrained 2026-05-05" |

**Operator Responsibilities (Pre-Submission):**
- Gather all evidence supporting action completion
- Ensure evidence clearly demonstrates corrective action taken
- Quality check: Is evidence sufficient for auditor to verify effectiveness criteria?
- Bundle evidence (multiple files OK; one per evidence entry)

**Storage & Retention:**
- Evidence files stored in Firebase Storage (separate from Firestore docs)
- Linked via hash + path reference
- RDC 978 Art. 105: 5-year retention (delete only after retention period + audit approval)
- Soft-delete pattern: CAPA doc marked `deletadoEm`, but evidence files remain (no Cloud Storage soft-delete)

**Field Updates:**
```typescript
{
  status: 'evidencia-submetida',
  
  evidence: [
    {
      type: 'documento',
      storagePath: 'gs://hmatologia2.appspot.com/labs/lab-123/auditoria-evidencia/capa-2026-0042/RCA_Report.pdf',
      uploadedAt: Timestamp.now(),
      uploadedBy: 'proprietario-456',
      hash: 'abc123def456... (SHA-256, 64 hex chars)',
      filename: 'RCA_Report.pdf',
    },
    // ... more evidence entries
  ],
  
  dataSubmissao: Timestamp.now(),
  submissaoChainHash: sha256(...),  // Seals submission (ADR-0012 pattern)
  
  transicoesCAPAs: [
    // ... previous transitions
    {
      acao: 'evidencia-submetida',
      operatorId: proprietario,
      ts: Timestamp.now(),
      evidenciaHash: submissaoChainHash,
      chainHash: sha256(...),
    }
  ],
}
```

**Audit Trail Entry:**
```json
{
  "acao": "evidencia-submetida",
  "capaId": "capa-2026-0042",
  "operatorId": "proprietario-456",
  "ts": "2026-05-15T14:30:00Z",
  "evidenceCount": 3,
  "evidenceHashes": [
    "abc123...",
    "def456...",
    "ghi789..."
  ],
  "chainHash": "xyz789...",
  "dataProvisao": "2026-05-15T14:30:00Z"
}
```

**Auditor Queue (Automated):**
- Firestore query: `where status == 'evidencia-submetida' AND deletedAt == null`
- Dashboard: "Awaiting Your Review" tile shows count + list
- Sorting: by deadline (ascending), then by submittedAt (descending)
- Notification: Auditor receives email: "CAPA [número] evidence submitted, review required"

**Permissions:**
- **Proprietario** — can upload evidence (read-only after submit)
- **Auditor** — can view + download evidence, but cannot edit
- **RT** — can view evidence (read-only)

**Exit Criteria:**
- Evidence uploaded to Storage (hash validated)
- Evidence references stored in Firestore
- Status = `evidencia-submetida`
- Auditor notified

**Duration Target:** N/A (depends on auditor pickup; target: reviewed within 3–5 days)

---

### Phase 4: AUDITOR-REVISANDO (Auditor Review In Progress)

**Initiated By:**
```typescript
// Cloud Function: capaAuditorReviewStart
// Called by: user with role isAuditorMasterCIQ
await capaAuditorReviewStart(labId, capaId, {
  auditorId: string,  // request.auth.uid (must have isAuditorMasterCIQ)
})
```

**Auditor Responsibilities:**

1. **Download & Review Evidence**
   - Access evidence files from Storage (links in CAPA doc)
   - Verify file integrity (hash match)
   - Review visual evidence (photos, certificates, logs)

2. **Assess RCA Completeness**
   - Is root cause substantive (not just "equipment failed")?
   - Does investigation appear thorough (interviews, records reviewed)?
   - Are underlying systemic issues identified (process, training, procedure)?

3. **Verify Action Adequacy**
   - Does action directly address root cause?
   - Is action reasonable + achievable + measurable?
   - Is responsible party identified + deadline realistic?

4. **Check Effectiveness Criteria**
   - Are criteria clear + verifiable?
   - Has action been completed by deadline?
   - Does evidence prove action taken + effective?

5. **Decision:**
   - **APPROVE** (evidence sufficient, effectiveness verified) → transition to `fechado`
   - **REJECT** (evidence gaps, action incomplete, or efficacy unproven) → transition back to `em-andamento`, request rework

**Approval Path:**
```typescript
// Cloud Function: capaAuditorApprove
await capaAuditorApprove(labId, capaId, {
  auditorId: string,
  comentarios: string,
  dataEfetividadeVerificacao?: Timestamp, // Optional: date of follow-up
})
```

**System Action (Approve):**
- Validates: CAPA in state `auditor-revisando`
- Validates: `auditorId == request.auth.uid` (caller must be the assigned auditor)
- Locks all fields (Firestore rules deny further writes except soft-delete)
- Sets:
  ```typescript
  {
    status: 'fechado',
    dataFechamento: Timestamp.now(),
    auditorIdAprovador: auditorId,
    comentariosAuditor: comentarios,
    closureSignature: LogicalSignature {
      hash: sha256(canonicalJson({...})),
      operatorId: auditorId,
      ts: Timestamp.now(),
    },
  }
  ```
- Generates final chainHash
- Appends transition to `transicoesCAPAs[]`

**Rejection Path:**
```typescript
// Cloud Function: capaAuditorReject
await capaAuditorReject(labId, capaId, {
  auditorId: string,
  motivo: string,  // e.g., "Evidence incomplete: missing training sign-offs for 3 technicians"
})
```

**System Action (Reject):**
- Validates: CAPA in state `auditor-revisando` OR `evidencia-submetida`
- Transitions status back to `em-andamento`
- Appends transition:
  ```typescript
  {
    acao: 'evidencia-rejeitada',
    auditorId: auditorId,
    ts: Timestamp.now(),
    rejeicaoMotivo: motivo,
    chainHash: sha256(...),
  }
  ```
- Sends email to proprietario: "CAPA [número] rejected. Reason: {motivo}. Please resubmit evidence."

**Field Updates (Approval):**
```typescript
{
  status: 'fechado',
  
  auditorId: auditorId,         // Auditor claimed this CAPA
  auditorIdAprovador: auditorId,// Auditor approved closure
  dataRevisaoInicio: Timestamp, // When review started
  dataFechamento: Timestamp,    // When approved
  
  comentariosAuditor: string,   // Feedback from auditor
  effectivenessVerified: true,  // Action effective + verified
  
  closureSignature: {
    hash: sha256(...),          // Immutable proof
    operatorId: auditorId,
    ts: Timestamp.now(),
  },
  
  transicoesCAPAs: [
    // ... previous transitions
    {
      acao: 'revisao-iniciada',
      auditorId: auditorId,
      ts: Timestamp.now(),
      chainHash: sha256(...),
    },
    {
      acao: 'capa-fechada',
      auditorId: auditorId,
      ts: Timestamp.now(),
      comentarios: comentariosAuditor,
      chainHash: sha256(...),  // Final seal
    }
  ],
}
```

**Audit Trail Entry (Approval):**
```json
{
  "acao": "capa-fechada",
  "capaId": "capa-2026-0042",
  "auditorId": "auditor-789",
  "auditorIdAprovador": "auditor-789",
  "ts": "2026-05-20T16:45:00Z",
  "comentariosAuditor": "RCA thorough, action implemented, effectiveness verified via training records. All 8 technicians retrained. EFICAZ.",
  "effectivenessVerified": true,
  "closureSignature": {
    "hash": "sha256(canonical)",
    "operatorId": "auditor-789",
    "ts": "2026-05-20T16:45:00Z"
  },
  "chainHash": "final-seal-hash"
}
```

**Permissions:**
- **Auditor (isAuditorMasterCIQ)** — can approve/reject + lock CAPA
- **Proprietario** — read-only
- **RT** — read-only

**Exit Criteria (Approval):**
- Status = `fechado`
- All fields locked
- Closure signature set
- Audit trail complete

**Exit Criteria (Rejection):**
- Status = `em-andamento`
- Proprietario notified
- Loop back to Phase 2 (rework required)

**Duration Target:** 3–7 days (per auditor workload)

---

### Phase 5: FECHADO (Closed/Final)

**Triggered By:**
- `capaAuditorApprove()` completes successfully

**System State:**
```typescript
{
  status: 'fechado',        // IMMUTABLE (final state)
  
  // Locked fields (Firestore rules enforce)
  titulo: string,
  descricao: string,
  analiseRaizCausa: string,
  acaoCorretivaPlano: string,
  evidence: [...],
  
  // Closure proof
  dataFechamento: Timestamp,
  auditorIdAprovador: string,
  closureSignature: LogicalSignature,
  
  // Audit trail
  transicoesCAPAs: [
    // ... all transitions from aberto → fechado
  ],
  
  // Retention
  deletadoEm: null,  // Can be soft-deleted later, but records preserved
}
```

**Post-Closure Actions:**

1. **Notification:**
   - Email to proprietario: "CAPA [número] closed by [auditor name]. Action: [action summary]"
   - Email to RT: "CAPA [número] closure approved."

2. **Records Retention (RDC 978 Art. 105):**
   - Firestore doc retained for 5 years minimum
   - Evidence files in Cloud Storage retained for 5 years
   - Soft-delete only (no hard delete)
   - Audit trail immutable (no post-closure edits)

3. **Risk Status Update (if linked to Risk, per ADR-0015):**
   - If CAPA linked to Risk: update Risk status
   - Risk transitions: `mitigando` → `fechado`
   - Risk also receives audit trail entry linking to closed CAPA

4. **NC Status Update (if linked to NC, per ADR-0015):**
   - If CAPA linked to NC: update NC status
   - NC transitions: appropriate state → `fechada`
   - NC also marked resolved (no blocking operations)

**Soft-Delete Option:**
```typescript
// Cloud Function: capaSoftDelete
// Called by: admin, QM (after closure)
// Precondition: status == 'fechado' AND retentionPeriod not expired
await capaSoftDelete(labId, capaId, {
  auditorId: string,  // Who authorized soft-delete
  motivo?: string,    // Why being marked deleted (e.g., "Superseded by CAPA-2026-0050")
})
```

**System Action (Soft-Delete):**
- Sets: `deletadoEm: Timestamp.now()`, `deletadoPor: auditorId`
- Appends audit trail entry:
  ```typescript
  {
    acao: 'capa-soft-deleted',
    auditorId: auditorId,
    ts: Timestamp.now(),
    motivo: motivo,
    chainHash: sha256(...),
  }
  ```
- Records NOT removed from Firestore or Cloud Storage
- Query filters automatically exclude soft-deleted CAPAs (`WHERE deletadoEm == null`)

**Archival & Audit Retrieval:**
- Closed CAPAs (last 2 years) visible in dashboard
- Soft-deleted CAPAs hidden by default (available via admin audit trail query)
- External auditors can request full CAPA dossier (including soft-deleted) via audit report export

**Compliance Checklist (Closure):**
- [ ] RCA substantive (>100 chars, investigative depth)
- [ ] Action plan clear (description + responsible + deadline)
- [ ] Evidence sufficient (photos, logs, training records, etc.)
- [ ] Effectiveness criteria met (per capa.effectivenessCriteria)
- [ ] Auditor signature captured (closureSignature)
- [ ] Audit trail complete (5 transitions + 7 audit events minimum)
- [ ] RDC 978 Art. 147 compliance confirmed

**Duration Target:** Final (no further transitions)

---

## RDC 978 Art. 105 Mapping

**RDC 978 Art. 105 (Gestão de Documentos):**
> "A empresa responsável pela realização de ensaios deverá manter sob sua guarda a documentação técnica necessária à comprovação da conformidade dos resultados de ensaios com os critérios estabelecidos. A documentação deverá ser mantida por período não inferior a cinco anos."

**CAPA Documentation Retention (Art. 105 Compliance):**

| Artifact | RDC 105 Category | Storage Location | Retention | Searchable By |
|----------|------------------|------------------|-----------|--------------|
| **CAPA Root Doc** | Registros Técnicos | Firestore: `/labs/{labId}/capaWorkflow/{capaId}` | 5 years | labId, capaId, status |
| **RCA Report** | Registros Técnicos | Included in CAPA doc (analiseRaizCausa field) | 5 years | labId, capaId |
| **Action Plan** | Registros Técnicos | Included in CAPA doc (acaoCorretivaPlano field) | 5 years | labId, capaId |
| **Audit Trail** | Registros Técnicos | Firestore: CAPA.transicoesCAPAs[] (append-only array) | 5 years | labId, capaId |
| **Evidence Files** | Registros Técnicos | Cloud Storage: `/labs/{labId}/auditoria-evidencia/capa-{capaId}/{filename}` | 5 years | labId, capaId (via hash) |
| **Closure Signature** | Assinatura Digital | Included in CAPA doc (closureSignature field) | 5 years | labId, capaId |
| **Soft-Delete Log** | Registros Técnicos | Audit trail entry (acao: 'capa-soft-deleted') | 5 years | labId, capaId |

**Art. 105 Compliance Implementation:**

1. **Immutability (5-year guarantee):**
   - CAPA Firestore rules: `allow delete: if false` (permanent)
   - Evidence files: versioned in Cloud Storage (no overwrite, only append)
   - Audit trail: append-only array (no deletion or reordering)
   - Soft-delete only: `deletadoEm` flag, records preserved

2. **Searchability (auditor must access):**
   - Firestore indexes: `labId`, `status`, `deadline` (for queries)
   - Cloud Storage: path structure enables systematic retrieval
   - Audit trail: searchable by `acao` type (capa-aberta, evidencia-submetida, capa-fechada, etc.)
   - Report export: admin can export all CAPAs for a date range (PDF/CSV)

3. **Data Integrity (no tampering):**
   - LogicalSignature: `hash (SHA-256), operatorId, ts` on every transition
   - Chain hash: each transition includes hash of previous (forming immutable chain)
   - Rules validation: `hash.size() == 64` (SHA-256 hex), `operatorId == request.auth.uid`, `ts is timestamp`
   - Auditor verification: can recalculate hashes to confirm no edits

4. **Retention Schedule:**
   - Closed CAPA: retained for 5 years from `dataFechamento`
   - Soft-delete: `deletadoEm` flag set; records not removed
   - Automatic archival: after 5 years, CAPA eligible for secure destruction (requires admin + audit approval)
   - Alert: 90 days before retention expires, send notification to QM (option to extend or archive)

**RDC 978 Art. 105 Audit Trail Export (for External Auditor):**

```typescript
// Cloud Function: exportCAPADossier
// Called by: auditor, QM, admin
// Returns: PDF or JSON containing full CAPA history
{
  capaId: string,
  numero: string,
  status: string,
  dataAbertura: Timestamp,
  dataFechamento?: Timestamp,
  
  // Full audit trail
  transicoesCAPAs: [
    {
      acao: string,
      operatorId: string,
      ts: Timestamp,
      chainHash: string,
      // ... payload varies by acao
    }
  ],
  
  // Evidence manifest
  evidence: [
    {
      filename: string,
      hash: string,
      uploadedAt: Timestamp,
      uploadedBy: string,
      type: string,
    }
  ],
  
  // Closure proof
  closureSignature?: {
    hash: string,
    operatorId: string,
    ts: Timestamp,
  },
  
  // Retention status
  retentionExpiresAt: Timestamp,
  deletedAt?: Timestamp,
}
```

---

## Audit Trail Specifications

### Audit Trail Architecture

**Collection Path:**
- CAPA transitions stored in-line: `/labs/{labId}/capaWorkflow/{capaId}` (field: `transicoesCAPAs[]`)
- Pattern: append-only array (Firestore `ArrayUnion`), never mutated or deleted
- Immutability enforced: Firestore rules deny array reordering/deletion

**Audit Event Schema:**

```typescript
interface CAPATransition {
  // Identification
  acao: 'capa-aberta' | 'investigacao-iniciada' | 'evidencia-submetida' 
      | 'revisao-iniciada' | 'evidencia-rejeitada' | 'capa-fechada' | 'capa-soft-deleted';
  
  // Operator
  operatorId: string;        // request.auth.uid (who made change)
  operatorNome?: string;     // Denormalized for display
  
  // Auditor (if applicable)
  auditorId?: string;        // If acao = 'revisao-iniciada' or 'capa-fechada'
  
  // Timestamp (server-side)
  ts: Timestamp;             // Timestamp.serverTimestamp()
  
  // Signature (immutable proof)
  signature: LogicalSignature {
    hash: string;            // SHA-256 hex (64 chars)
    operatorId: string;      // == operator.id (validation)
    ts: Timestamp;           // == transition.ts (validation)
  };
  
  // Chain (prevents reordering)
  chainHash: string;         // HMAC over {labId, capaId, status, ts, index}
  
  // Metadata (varies by acao)
  notes?: string;            // Additional context
  motivo?: string;           // Reason (rejection, soft-delete)
  comentarios?: string;      // Auditor feedback (approval)
  evidenciaHash?: string;    // Hash of submitted evidence
  effectivenessVerified?: boolean; // Was action effective?
  
  // Payload (canonical JSON of change)
  payload?: {
    oldStatus?: string,
    newStatus?: string,
    fieldChanges?: { [key: string]: any },
  };
}
```

### Audit Trail Lifecycle

**Entry 1: capa-aberta**
```typescript
{
  acao: 'capa-aberta',
  operatorId: 'system',
  ts: Timestamp('2026-05-07T10:00:00Z'),
  signature: {
    hash: 'abc123...',
    operatorId: 'system',
    ts: Timestamp('2026-05-07T10:00:00Z'),
  },
  chainHash: 'hash-1',
  payload: {
    titulo: "Falta em analisadores de coagulação",
    descricao: "Equipamento X offline 8h...",
    deadline: Timestamp('2026-07-05'),
  },
}
```

**Entry 2: investigacao-iniciada**
```typescript
{
  acao: 'investigacao-iniciada',
  operatorId: 'proprietario-456',
  ts: Timestamp('2026-05-10T14:00:00Z'),
  signature: {
    hash: 'def456...',
    operatorId: 'proprietario-456',
    ts: Timestamp('2026-05-10T14:00:00Z'),
  },
  chainHash: 'hash-2',  // Includes hash-1 (chain)
  payload: {
    analiseRaizCausa: "Maintenance interval was 6 months, but supervisor...",
    acaoCorretivaPlano: "Implement 2-week FIFO audit cycle...",
    dataPrevisaoEvidencia: Timestamp('2026-05-15'),
  },
}
```

**Entry 3: evidencia-submetida**
```typescript
{
  acao: 'evidencia-submetida',
  operatorId: 'proprietario-456',
  ts: Timestamp('2026-05-15T14:30:00Z'),
  signature: {
    hash: 'ghi789...',
    operatorId: 'proprietario-456',
    ts: Timestamp('2026-05-15T14:30:00Z'),
  },
  chainHash: 'hash-3',  // Includes hash-2 (chain)
  evidenciaHash: 'sha256-of-evidence',
  payload: {
    evidenceFiles: [
      { filename: 'RCA_Report.pdf', hash: '...' },
      { filename: 'training_log.xlsx', hash: '...' },
    ],
  },
}
```

**Entry 4: revisao-iniciada**
```typescript
{
  acao: 'revisao-iniciada',
  operatorId: 'auditor-789',
  auditorId: 'auditor-789',
  ts: Timestamp('2026-05-18T10:00:00Z'),
  signature: {
    hash: 'jkl012...',
    operatorId: 'auditor-789',
    ts: Timestamp('2026-05-18T10:00:00Z'),
  },
  chainHash: 'hash-4',  // Includes hash-3 (chain)
  payload: {
    auditorId: 'auditor-789',
    dataRevisaoInicio: Timestamp('2026-05-18T10:00:00Z'),
  },
}
```

**Entry 5: capa-fechada**
```typescript
{
  acao: 'capa-fechada',
  operatorId: 'auditor-789',
  auditorId: 'auditor-789',
  ts: Timestamp('2026-05-20T16:45:00Z'),
  signature: {
    hash: 'mno345...',
    operatorId: 'auditor-789',
    ts: Timestamp('2026-05-20T16:45:00Z'),
  },
  chainHash: 'hash-5',  // Includes hash-4 (chain) — FINAL SEAL
  effectivenessVerified: true,
  comentarios: "RCA thorough, action implemented, effectiveness verified via training records. All 8 technicians retrained. EFICAZ.",
  payload: {
    status: 'fechado',
    dataFechamento: Timestamp('2026-05-20T16:45:00Z'),
    auditorIdAprovador: 'auditor-789',
    closureSignature: {
      hash: 'sha256-final',
      operatorId: 'auditor-789',
      ts: Timestamp('2026-05-20T16:45:00Z'),
    },
  },
}
```

### Hash Verification (for Auditor)

**Pseudocode: Verify Chain Integrity**
```
function verifyCAPAChain(capa):
  prev_hash = null
  for each transition in capa.transicoesCAPAs:
    // Verify signature
    computed_hash = sha256(canonical_json({
      acao: transition.acao,
      operatorId: transition.operatorId,
      ts: transition.ts,
      payload: transition.payload,
    }))
    assert computed_hash == transition.signature.hash, "Signature mismatch"
    
    // Verify chain
    computed_chain = hmac_sha256(
      key=labId,
      message={
        status: capa.status,
        ts: transition.ts,
        index: transitions.indexOf(transition),
        prev_chain: prev_hash,
      }
    )
    assert computed_chain == transition.chainHash, "Chain broken at index {index}"
    
    prev_hash = transition.chainHash
  
  return {valid: true, finalHash: prev_hash}
```

### Audit Trail Export

**Function: Export CAPA Audit Trail**
```typescript
// Cloud Function: exportCAPAAuditTrail
// Called by: auditor, QM, admin
// Returns: PDF or JSON
await exportCAPAAuditTrail(labId, capaId)
```

**Export Format (JSON):**
```json
{
  "capaId": "capa-2026-0042",
  "numero": "CAPA-2026-0042",
  "labId": "lab-123",
  "exportedAt": "2026-05-20T20:00:00Z",
  "exportedBy": "auditor-789",
  
  "auditTrail": [
    {
      "index": 1,
      "acao": "capa-aberta",
      "operatorId": "system",
      "ts": "2026-05-07T10:00:00Z",
      "signature": {...},
      "chainHash": "hash-1"
    },
    // ... more transitions
  ],
  
  "evidenceManifest": [
    {
      "filename": "RCA_Report.pdf",
      "hash": "abc123...",
      "uploadedAt": "2026-05-15T14:30:00Z",
      "uploadedBy": "proprietario-456",
      "type": "documento",
      "storagePath": "gs://bucket/labs/lab-123/auditoria-evidencia/capa-2026-0042/RCA_Report.pdf"
    }
  ],
  
  "verificationStatus": {
    "chainValid": true,
    "finalHash": "hash-5",
    "allSignaturesValid": true,
    "noTamperingDetected": true
  }
}
```

**Export Format (PDF):**
- Title: "CAPA Audit Trail — [numero]"
- Sections:
  1. CAPA Summary (titulo, descricao, dates, status)
  2. RCA & Action Plan (full text)
  3. Audit Trail (table with acao, operatorId, ts, notes)
  4. Evidence Manifest (table with filenames, hashes, dates)
  5. Verification Certificate (chain valid, no tampering, date/signature)

---

## Sign-Off Procedures

### Sign-Off 1: Proprietario Acknowledges CAPA

**When:** CAPA created (status: `aberto`)

**System Action:**
- Email sent to proprietario with CAPA #, titulo, deadline, NC/Risk link
- Email includes link to CAPA detail view (requires authentication)

**Proprietario Responsibility:**
- Click "I Acknowledge" button (records `proprietario.acknowledgedAt: Timestamp`)
- Review CAPA details
- Confirm assignment (if incorrect, raise escalation to QM)

**Audit Trail Entry:**
```json
{
  "acao": "proprietario-acknowledged",
  "operatorId": "proprietario-456",
  "ts": "2026-05-07T11:00:00Z",
  "signature": {...},
  "chainHash": "...",
  "payload": {
    "acknowledgedAt": "2026-05-07T11:00:00Z",
    "proprietarioId": "proprietario-456"
  }
}
```

### Sign-Off 2: RT Approves RCA & Action Plan

**When:** CAPA transitions to `em-andamento` (proprietario initiates `capaStartInvestigation()`)

**System Action:**
- Email sent to RT: "CAPA [número] — RCA submitted, awaiting RT review"
- RT can view RCA + action plan in UI
- RT approves or requests changes (comment system)

**RT Responsibility:**
1. Review RCA (is it substantive + thorough?)
2. Review action plan (is it adequate + measurable?)
3. Approve or request revision
4. **Approval sign-off:** Click "Approve RCA & Plan" button
   ```typescript
   await capaRTApproveRCA(labId, capaId, {
     rtId: string,
     comentarios: string,
   })
   ```

**System Action (RT Approval):**
- Appends audit trail entry: `{ acao: 'rt-approved-rca', rtId, comentarios, ... }`
- Sends email to proprietario: "RT approved your RCA & plan. Proceed with action."
- CAPA remains in `em-andamento` (no status change; just approval marker)

**Audit Trail Entry (RT Approval):**
```json
{
  "acao": "rt-approved-rca",
  "operatorId": "rt-789",
  "ts": "2026-05-12T15:00:00Z",
  "signature": {...},
  "chainHash": "...",
  "payload": {
    "rtId": "rt-789",
    "rtNome": "João Silva",
    "comentarios": "RCA thorough, action plan addresses root cause. Proceed."
  }
}
```

### Sign-Off 3: Proprietario Certifies Action Completion

**When:** Proprietario ready to submit evidence (calls `capaSubmitEvidence()`)

**System Action:**
- Proprietario uploads evidence file(s)
- Selects evidence type (foto, documento, certificado, pop, treinamento)
- Adds description of what evidence proves

**Proprietario Certification:**
- Checkbox: "I certify that the corrective action described in this CAPA has been completed and that the evidence provided demonstrates effective implementation."
- Signature: Digital signature via Cloud Function callable
- Timestamp: Recorded in Cloud Function (server-side)

**Audit Trail Entry:**
```json
{
  "acao": "evidencia-submetida",
  "operatorId": "proprietario-456",
  "ts": "2026-05-15T14:30:00Z",
  "signature": {
    "hash": "proprietario-sig-hash",
    "operatorId": "proprietario-456",
    "ts": "2026-05-15T14:30:00Z"
  },
  "chainHash": "...",
  "evidenciaHash": "...",
  "payload": {
    "certificationText": "I certify that the corrective action described in this CAPA has been completed...",
    "evidenceFiles": [...]
  }
}
```

### Sign-Off 4: Auditor Approves & Signs Closure

**When:** Auditor transitions CAPA to `fechado` (calls `capaAuditorApprove()`)

**Auditor Responsibility:**
1. Review evidence (download, verify hash, examine contents)
2. Verify action completion (is evidence sufficient?)
3. Verify effectiveness (do criteria in `effectivenessCriteria` field apply?)
4. Sign-off: Click "Approve & Close" button
   ```typescript
   await capaAuditorApprove(labId, capaId, {
     auditorId: string,
     comentarios: string,
     dataEfetividadeVerificacao?: Timestamp,
   })
   ```

**Auditor Certification:**
- Checkbox: "I certify that I have reviewed the evidence submitted for CAPA [número] and that it demonstrates effective implementation of the corrective action. The action adequately addresses the root cause and will prevent recurrence."
- Signature: Digital signature via Cloud Function callable
- Timestamp: Recorded in Cloud Function (server-side)

**System Action (Auditor Signature):**
- Generates LogicalSignature:
  ```typescript
  closureSignature: {
    hash: sha256(canonical_json({
      capaId,
      auditorId,
      status: 'fechado',
      dataFechamento: Timestamp.now(),
      commentários: comentarios,
    })),
    operatorId: auditorId,
    ts: Timestamp.now(),
  }
  ```
- Locks CAPA (Firestore rules deny further writes)
- Appends final audit trail entry (chain sealed)

**Audit Trail Entry (Auditor Closure):**
```json
{
  "acao": "capa-fechada",
  "operatorId": "auditor-789",
  "auditorId": "auditor-789",
  "ts": "2026-05-20T16:45:00Z",
  "signature": {
    "hash": "auditor-sig-hash",
    "operatorId": "auditor-789",
    "ts": "2026-05-20T16:45:00Z"
  },
  "chainHash": "final-chain-hash",
  "effectivenessVerified": true,
  "comentarios": "RCA thorough, action implemented, effectiveness verified via training records. All 8 technicians retrained. EFICAC.",
  "closureSignature": {
    "hash": "sha256-final-proof",
    "operatorId": "auditor-789",
    "ts": "2026-05-20T16:45:00Z"
  },
  "payload": {
    "status": "fechado",
    "dataFechamento": "2026-05-20T16:45:00Z",
    "auditorIdAprovador": "auditor-789",
    "effectivenessVerified": true
  }
}
```

### Sign-Off 5 (Optional): External Auditor Sign-Off on Dossier

**When:** External auditor (DICQ accreditation) requests CAPA dossier for verification

**System Action:**
- Admin/QM exports full CAPA dossier: `exportCAPAAuditTrail(labId, capaId)`
- Dossier includes: RCA, action plan, evidence manifest, audit trail, closure signature

**External Auditor Responsibility:**
- Review dossier (RCA, action, evidence, signatures)
- Verify chain integrity (recalculate hashes)
- Sign off: Add external auditor certification to dossier
  ```
  External Auditor Certification:
  DICQ Accreditation Audit — 2026-10-15
  Reviewed CAPA [número] and verified:
  ✓ RCA substantive and thorough
  ✓ Action adequately addresses root cause
  ✓ Evidence demonstrates effective implementation
  ✓ Audit trail complete and tamper-proof
  ✓ Signatures valid (operatorId, hash, timestamp match)
  
  Auditor: [name, credential], Date: 2026-10-15, Signature: [digital sig]
  ```

**Audit Trail Entry (External Audit):**
```json
{
  "acao": "external-auditor-verified",
  "operatorId": "external-auditor-2026-10-15",
  "ts": "2026-10-15T14:30:00Z",
  "signature": {...},
  "chainHash": "...",
  "payload": {
    "auditorName": "Dr. João da Silva",
    "auditorCredential": "DICQ-2026-001",
    "verificationDate": "2026-10-15",
    "chainIntegrityValid": true,
    "signatureCertification": {
      "rca_substantive": true,
      "action_adequate": true,
      "evidence_sufficient": true,
      "audit_trail_complete": true
    }
  }
}
```

---

## System Implementation

### Firestore Schema

**Collection: `/labs/{labId}/capaWorkflow/{capaId}`**

```typescript
interface CAPAWorkflow {
  // Identification
  id: string;                           // Firestore doc ID (matches capaId)
  labId: string;                        // Multi-tenant (RN-01)
  numero: string;                       // Sequential: CAPA-YYYY-SEQ (generated server-side)
  
  // Title & Description
  titulo: string;                       // Max 150 chars, min 10 chars
  descricao: string;                    // Max 2000 chars, min 50 chars
  
  // Linkage (ADR-0015: Hybrid CAPA/Risk/NCQ integration)
  findingId?: string;                   // Link to audit finding
  ncId?: string;                        // Link to non-conformidade (optional)
  linkedRiskIds?: string[];             // Link to risks (optional)
  validLinksPolicy?: () => boolean;     // Server-side: must link to at least 1 Risk or NCQ
  
  // Assignment
  proprietarioId: string;               // UID (quality operator assigned)
  proprietarioNome: string;             // Denormalized (display)
  proprietarioAcknowledgedAt?: Timestamp; // When proprietario acknowledged assignment
  
  // Status & Workflow (5-state machine)
  status: 'aberto' | 'em-andamento' | 'evidencia-submetida' | 'auditor-revisando' | 'fechado';
  
  // Timeline
  deadline: Timestamp;                  // Target closure (30-90 days)
  dataAbertura: Timestamp;              // When CAPA created (== createdAt)
  dataInvestigacaoInicio?: Timestamp;   // When "em-andamento"
  dataPrevisaoEvidencia?: Timestamp;    // When proprietario expects evidence ready
  dataSubmissao?: Timestamp;            // When evidencia-submetida
  dataRevisaoInicio?: Timestamp;        // When auditor starts review
  dataFechamento?: Timestamp;           // When closed (== closedAt)
  
  // Investigation Phase (em-andamento)
  analiseRaizCausa?: string;            // RCA text (min 100 chars)
  investigadorId?: string;              // UID of RCA author (usually proprietario)
  investigadorNome?: string;            // Denormalized (display)
  
  // Corrective Action Phase (em-andamento)
  acaoCorretivaPlano?: string;          // Action description
  responsavelExecucao?: string;         // UID of responsible (may differ from proprietario)
  responsavelNome?: string;             // Denormalized (display)
  dataExecutionTarget?: Timestamp;      // When action should be complete
  
  // Effectiveness Criteria (em-andamento)
  effectivenessCriteria?: string;       // How to verify closure (e.g., "No NC reoccurrence in 30 days")
  
  // Evidence Phase (evidencia-submetida)
  evidence: CAPAEvidenceRef[];          // Array of evidence files
  dataSubmissao?: Timestamp;            // When evidence submitted
  submissaoChainHash?: string;          // Hash seal at submission
  
  // Auditor Review Phase (auditor-revisando)
  auditorId?: string;                   // UID of assigned auditor
  auditorNome?: string;                 // Denormalized (display)
  dataRevisaoInicio?: Timestamp;        // When auditor started review
  comentariosAuditor?: string;          // Feedback (approve/reject)
  
  // Closure Phase (fechado)
  auditorIdAprovador?: string;          // UID of auditor who approved
  dataFechamento?: Timestamp;           // When status changed to fechado
  effectivenessVerified?: boolean;      // Was action effective?
  dataEfetividadeVerificacao?: Timestamp; // Optional: date of follow-up audit
  closureSignature?: LogicalSignature;  // { hash, operatorId, ts } immutable proof
  
  // Rejection History (if rejected)
  rejectionHistory?: Array<{
    auditorId: string;
    motivo: string;
    dataRejeicao: Timestamp;
    reworkAttempt?: number;
  }>;
  
  // Audit Trail (immutable)
  transicoesCAPAs: CAPATransition[];    // Array of state transitions (append-only, never mutated)
  
  // Soft Delete (RN-06)
  deletadoEm?: Timestamp | null;        // Soft-delete marker (null = active)
  deletadoPor?: string;                 // UID who soft-deleted
  
  // Metadata
  createdAt: Timestamp;                 // When doc created (== dataAbertura)
  createdBy?: string;                   // UID (usually system or QM)
  updatedAt: Timestamp;                 // Last modification
  version?: number;                     // Optimistic concurrency control (optional)
}

interface CAPAEvidenceRef {
  type: 'foto' | 'documento' | 'certificado' | 'pop' | 'treinamento';
  storagePath: string;                  // gs://bucket/labs/{labId}/auditoria-evidencia/capa-{capaId}/{filename}
  uploadedAt: Timestamp;
  uploadedBy: string;                   // UID
  hash: string;                         // SHA-256 hex (64 chars), integrity verification
  filename?: string;                    // Original filename (metadata)
  description?: string;                 // What this evidence proves
}

interface LogicalSignature {
  readonly hash: string;                // SHA-256 hex (64 chars)
  readonly operatorId: string;          // request.auth.uid
  readonly ts: Timestamp;               // when signed
}

interface CAPATransition {
  acao: 'capa-aberta' | 'investigacao-iniciada' | 'evidencia-submetida' 
      | 'revisao-iniciada' | 'evidencia-rejeitada' | 'capa-fechada' | 'capa-soft-deleted';
  operatorId: string;
  operatorNome?: string;
  auditorId?: string;
  auditorNome?: string;
  ts: Timestamp;
  signature: LogicalSignature;
  chainHash: string;
  
  // Metadata (varies by acao)
  notes?: string;
  motivo?: string;                      // Rejection reason
  comentarios?: string;                 // Auditor feedback
  evidenciaHash?: string;               // Hash of submitted evidence
  effectivenessVerified?: boolean;
  closureSignature?: LogicalSignature;  // Final seal (acao='capa-fechada' only)
  
  // Payload (canonical JSON of change)
  payload?: Record<string, any>;
}
```

### Firestore Rules

**CAPA Collection Rules:**
```firestore
// /labs/{labId}/capaWorkflow/{capaId}
match /labs/{labId}/capaWorkflow/{capaId} {
  
  // READ: Active lab members can read CAPAs scoped to their lab
  allow read: if isActiveMemberOfLab(labId);
  
  // CREATE: Cloud Function only (no client-side creation)
  allow create: if false;
  
  // UPDATE: Cloud Function only (no client-side updates)
  allow update: if false;
  
  // DELETE: Never (Firestore rules deny hard delete; soft-delete only)
  allow delete: if false;
}

// /labs/{labId}/auditoria-evidencia/capa-{capaId}/{filename}
match /labs/{labId}/auditoria-evidencia/capa-{capaId}/{filename} {
  
  // READ: Lab members + auditor can read evidence files
  allow read: if isActiveMemberOfLab(labId);
  
  // CREATE: Cloud Function only (via capaSubmitEvidence callable)
  allow create: if false;
  
  // DELETE: Never (5-year retention, soft-delete only)
  allow delete: if false;
}

// Helper functions (add to firestore.rules header)
function isActiveMemberOfLab(labId) {
  return exists(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.status == 'active';
}

function isAuditorMasterCIQ(labId) {
  return isActiveMemberOfLab(labId) && 
         get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.role == 'auditor-master-ciq';
}
```

### Cloud Functions Callables

**Callable 1: capaOpenNewCAPAWorkflow (Cloud Function)**
```typescript
export const capaOpenNewCAPAWorkflow = functions.https.onCall(async (data, context) => {
  const { labId, titulo, descricao, findingId, ncId, linkedRiskIds, proprietarioId } = data;
  
  // 1. Validate auth
  if (!context.auth) throw new Error('Unauthenticated');
  if (!isActiveMemberOfLab(labId)) throw new Error('Unauthorized');
  
  // 2. Validate input
  if (!titulo || titulo.length < 10 || titulo.length > 150) {
    throw new Error('Titulo invalid');
  }
  if (!descricao || descricao.length < 50 || descricao.length > 2000) {
    throw new Error('Descricao invalid');
  }
  
  // 3. Link validation (ADR-0015)
  if (!linkedRiskIds?.length && !ncId) {
    throw new Error('CAPA must link to at least 1 Risk or NCQ');
  }
  
  // 4. Generate CAPA ID + numero
  const capaId = db.collection(`labs/${labId}/capaWorkflow`).doc().id;
  const numero = await generateCAPANumero(labId); // CAPA-2026-0042
  
  // 5. Compute first signature
  const payload = { titulo, descricao, labId, proprietarioId };
  const signature = generateLogicalSignature(payload, context.auth.uid);
  const chainHash = computeChainHash(labId, capaId, 'aberto', admin.firestore.Timestamp.now(), payload);
  
  // 6. Write CAPA doc
  const deadline = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days default
  );
  
  await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).set({
    id: capaId,
    labId,
    numero,
    titulo,
    descricao,
    findingId,
    ncId,
    linkedRiskIds: linkedRiskIds || [],
    proprietarioId,
    proprietarioNome: await getOperatorName(labId, proprietarioId),
    deadline,
    status: 'aberto',
    
    transicoesCAPAs: [{
      acao: 'capa-aberta',
      operatorId: 'system',
      ts: admin.firestore.Timestamp.now(),
      signature: {
        hash: 'system-signature',
        operatorId: 'system',
        ts: admin.firestore.Timestamp.now(),
      },
      chainHash,
      payload,
    }],
    
    evidence: [],
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: context.auth.uid,
    updatedAt: admin.firestore.Timestamp.now(),
    deletadoEm: null,
  });
  
  // 7. Send notification email
  await sendEmail(proprietarioId, {
    subject: `CAPA ${numero} assigned to you`,
    body: `CAPA: ${titulo}\nDeadline: ${deadline}\n\nPlease review and acknowledge.`,
  });
  
  return {
    success: true,
    capaId,
    numero,
    status: 'aberto',
    chainHash,
  };
});
```

**Callable 2: capaStartInvestigation (Cloud Function)**
```typescript
export const capaStartInvestigation = functions.https.onCall(async (data, context) => {
  const { labId, capaId, analiseRaizCausa, acaoCorretivaPlano, dataPrevisaoEvidencia, effectivenessCriteria } = data;
  
  // 1. Validate auth
  if (!context.auth) throw new Error('Unauthenticated');
  if (!isActiveMemberOfLab(labId)) throw new Error('Unauthorized');
  
  // 2. Get CAPA doc
  const capaDoc = await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).get();
  if (!capaDoc.exists) throw new Error('CAPA not found');
  
  const capa = capaDoc.data();
  if (capa.status !== 'aberto') {
    throw new Error(`Cannot start investigation: CAPA status is ${capa.status}`);
  }
  
  // 3. Validate RCA
  if (!analiseRaizCausa || analiseRaizCausa.length < 100) {
    throw new Error('RCA must be at least 100 characters');
  }
  
  // 4. Validate action plan
  if (!acaoCorretivaPlano || acaoCorretivaPlano.length < 50) {
    throw new Error('Action plan required');
  }
  
  // 5. Validate dates
  if (new Date(dataPrevisaoEvidencia) <= new Date()) {
    throw new Error('Evidence target date must be in future');
  }
  
  // 6. Compute signature + chain
  const payload = {
    analiseRaizCausa,
    acaoCorretivaPlano,
    dataPrevisaoEvidencia,
    effectivenessCriteria,
  };
  const signature = generateLogicalSignature(payload, context.auth.uid);
  const prevChainHash = capa.transicoesCAPAs[capa.transicoesCAPAs.length - 1].chainHash;
  const chainHash = computeChainHash(labId, capaId, 'em-andamento', admin.firestore.Timestamp.now(), payload, prevChainHash);
  
  // 7. Update CAPA
  await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).update({
    status: 'em-andamento',
    analiseRaizCausa,
    acaoCorretivaPlano,
    dataPrevisaoEvidencia: admin.firestore.Timestamp.fromDate(new Date(dataPrevisaoEvidencia)),
    effectivenessCriteria,
    investigadorId: context.auth.uid,
    investigadorNome: await getOperatorName(labId, context.auth.uid),
    dataInvestigacaoInicio: admin.firestore.Timestamp.now(),
    
    transicoesCAPAs: admin.firestore.FieldValue.arrayUnion({
      acao: 'investigacao-iniciada',
      operatorId: context.auth.uid,
      operatorNome: await getOperatorName(labId, context.auth.uid),
      ts: admin.firestore.Timestamp.now(),
      signature,
      chainHash,
      payload,
    }),
    
    updatedAt: admin.firestore.Timestamp.now(),
  });
  
  // 8. Send notification
  await sendEmail(capa.proprietarioId, {
    subject: `RCA approved for CAPA ${capa.numero}`,
    body: `Investigation started. Proceed with corrective action.`,
  });
  
  return {
    success: true,
    status: 'em-andamento',
    chainHash,
  };
});
```

**Callable 3: capaSubmitEvidence (Cloud Function)**
```typescript
export const capaSubmitEvidence = functions.https.onCall(async (data, context) => {
  const { labId, capaId, evidenceFile, evidenceType, description } = data;
  
  // 1. Validate auth
  if (!context.auth) throw new Error('Unauthenticated');
  
  // 2. Get CAPA doc
  const capaDoc = await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).get();
  if (!capaDoc.exists) throw new Error('CAPA not found');
  
  const capa = capaDoc.data();
  if (capa.status !== 'em-andamento') {
    throw new Error(`Cannot submit evidence: CAPA status is ${capa.status}`);
  }
  
  // 3. Validate file
  if (!evidenceFile || !evidenceFile.data) throw new Error('File required');
  
  // 4. Compute file hash
  const fileHash = computeSHA256(evidenceFile.data);
  
  // 5. Upload to Cloud Storage
  const filename = `${evidenceType}-${Date.now()}.pdf`;
  const storagePath = `labs/${labId}/auditoria-evidencia/capa-${capaId}/${filename}`;
  const bucket = admin.storage().bucket();
  
  await bucket.file(storagePath).save(evidenceFile.data);
  
  // 6. Add evidence reference
  const evidenceRef: CAPAEvidenceRef = {
    type: evidenceType,
    storagePath: `gs://bucket/${storagePath}`,
    uploadedAt: admin.firestore.Timestamp.now(),
    uploadedBy: context.auth.uid,
    hash: fileHash,
    filename,
    description,
  };
  
  // 7. Compute signature + chain
  const payload = { evidenceRef };
  const signature = generateLogicalSignature(payload, context.auth.uid);
  const prevChainHash = capa.transicoesCAPAs[capa.transicoesCAPAs.length - 1].chainHash;
  const chainHash = computeChainHash(labId, capaId, 'evidencia-submetida', admin.firestore.Timestamp.now(), payload, prevChainHash);
  
  // 8. Update CAPA
  await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).update({
    status: 'evidencia-submetida',
    evidence: admin.firestore.FieldValue.arrayUnion(evidenceRef),
    dataSubmissao: admin.firestore.Timestamp.now(),
    submissaoChainHash: chainHash,
    
    transicoesCAPAs: admin.firestore.FieldValue.arrayUnion({
      acao: 'evidencia-submetida',
      operatorId: context.auth.uid,
      ts: admin.firestore.Timestamp.now(),
      signature,
      chainHash,
      evidenciaHash: fileHash,
      payload,
    }),
    
    updatedAt: admin.firestore.Timestamp.now(),
  });
  
  // 9. Trigger auditor notification
  await notifyAuditorQueue(labId, capaId, capa.numero);
  
  return {
    success: true,
    status: 'evidencia-submetida',
    fileHash,
    chainHash,
  };
});
```

**Callable 4: capaAuditorApprove (Cloud Function)**
```typescript
export const capaAuditorApprove = functions.https.onCall(async (data, context) => {
  const { labId, capaId, comentarios, dataEfetividadeVerificacao } = data;
  
  // 1. Validate auth (must be auditor)
  if (!context.auth) throw new Error('Unauthenticated');
  if (!isAuditorMasterCIQ(labId, context.auth.uid)) {
    throw new Error('Only auditor can approve CAPA');
  }
  
  // 2. Get CAPA doc
  const capaDoc = await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).get();
  if (!capaDoc.exists) throw new Error('CAPA not found');
  
  const capa = capaDoc.data();
  if (capa.status !== 'auditor-revisando' && capa.status !== 'evidencia-submetida') {
    throw new Error(`Cannot approve: CAPA status is ${capa.status}`);
  }
  
  // 3. Compute closure signature
  const closurePayload = {
    capaId,
    status: 'fechado',
    dataFechamento: admin.firestore.Timestamp.now(),
    auditorIdAprovador: context.auth.uid,
    comentarios,
  };
  const closureSignature = generateLogicalSignature(closurePayload, context.auth.uid);
  
  // 4. Compute final chain hash
  const payload = { closureSignature, efectivenessVerified: true };
  const prevChainHash = capa.transicoesCAPAs[capa.transicoesCAPAs.length - 1].chainHash;
  const chainHash = computeChainHash(labId, capaId, 'fechado', admin.firestore.Timestamp.now(), payload, prevChainHash);
  
  // 5. Update CAPA (locked)
  const db = admin.firestore();
  await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).update({
    status: 'fechado',
    dataFechamento: admin.firestore.Timestamp.now(),
    auditorIdAprovador: context.auth.uid,
    comentariosAuditor: comentarios,
    effectivenessVerified: true,
    dataEfetividadeVerificacao: dataEfetividadeVerificacao ? 
      admin.firestore.Timestamp.fromDate(new Date(dataEfetividadeVerificacao)) : null,
    closureSignature,
    
    transicoesCAPAs: admin.firestore.FieldValue.arrayUnion({
      acao: 'capa-fechada',
      operatorId: context.auth.uid,
      auditorId: context.auth.uid,
      ts: admin.firestore.Timestamp.now(),
      signature: closureSignature,
      chainHash,          // FINAL SEAL
      effectivenessVerified: true,
      comentarios,
      closureSignature,
      payload,
    }),
    
    updatedAt: admin.firestore.Timestamp.now(),
  });
  
  // 6. Update linked Risk (if applicable)
  if (capa.linkedRiskIds?.length) {
    for (const riskId of capa.linkedRiskIds) {
      await updateRiskStatus(labId, riskId, 'fechado', capaId);
    }
  }
  
  // 7. Send notifications
  await sendEmail(capa.proprietarioId, {
    subject: `CAPA ${capa.numero} closed`,
    body: `Your CAPA has been approved and closed. Auditor feedback: ${comentarios}`,
  });
  
  return {
    success: true,
    status: 'fechado',
    chainHash,
    closureSignature,
  };
});
```

**Callable 5: capaAuditorReject (Cloud Function)**
```typescript
export const capaAuditorReject = functions.https.onCall(async (data, context) => {
  const { labId, capaId, motivo } = data;
  
  // 1. Validate auth (must be auditor)
  if (!context.auth) throw new Error('Unauthenticated');
  if (!isAuditorMasterCIQ(labId, context.auth.uid)) {
    throw new Error('Only auditor can reject CAPA');
  }
  
  // 2. Get CAPA doc
  const capaDoc = await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).get();
  if (!capaDoc.exists) throw new Error('CAPA not found');
  
  const capa = capaDoc.data();
  if (capa.status !== 'auditor-revisando' && capa.status !== 'evidencia-submetida') {
    throw new Error(`Cannot reject: CAPA status is ${capa.status}`);
  }
  
  // 3. Compute signature + chain
  const payload = { rejeicaoMotivo: motivo };
  const signature = generateLogicalSignature(payload, context.auth.uid);
  const prevChainHash = capa.transicoesCAPAs[capa.transicoesCAPAs.length - 1].chainHash;
  const chainHash = computeChainHash(labId, capaId, 'em-andamento', admin.firestore.Timestamp.now(), payload, prevChainHash);
  
  // 4. Update CAPA (back to em-andamento)
  await db.doc(`labs/${labId}/capaWorkflow/${capaId}`).update({
    status: 'em-andamento',
    
    transicoesCAPAs: admin.firestore.FieldValue.arrayUnion({
      acao: 'evidencia-rejeitada',
      operatorId: context.auth.uid,
      auditorId: context.auth.uid,
      ts: admin.firestore.Timestamp.now(),
      signature,
      chainHash,
      motivo,
      payload,
    }),
    
    updatedAt: admin.firestore.Timestamp.now(),
  });
  
  // 5. Send notification
  await sendEmail(capa.proprietarioId, {
    subject: `CAPA ${capa.numero} rejected - rework required`,
    body: `Auditor feedback: ${motivo}\n\nPlease address the issues and resubmit evidence.`,
  });
  
  return {
    success: true,
    status: 'em-andamento',
    chainHash,
  };
});
```

---

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Proprietario (Quality Operator)** | • Acknowledge CAPA creation<br/>• Start investigation (transition aberto → em-andamento)<br/>• Edit RCA, action plan, effectiveness criteria<br/>• Upload evidence (transition em-andamento → evidencia-submetida)<br/>• View own CAPA (read-only after evidence submitted)<br/>• Cannot approve/close CAPA |
| **RT (Technical Responsible)** | • View all CAPAs (read-only)<br/>• Comment on RCA/action plan (review gate)<br/>• Approve RCA completeness (audit trail, but no status change)<br/>• View evidence (read-only)<br/>• Cannot submit evidence or close CAPA |
| **Auditor Master CIQ** | • View all CAPAs + evidence (read-only until review starts)<br/>• Download evidence files + verify hash<br/>• Claim CAPA for review (transition evidencia-submetida → auditor-revisando)<br/>• Approve closure (transition auditor-revisando → fechado)<br/>• Reject + request rework (transition back to em-andamento)<br/>• Sign closure with LogicalSignature |
| **QM (Quality Manager)** | • Create CAPA (call capaOpenNewCAPAWorkflow)<br/>• View all CAPAs + audit trails<br/>• Assign proprietario<br/>• Soft-delete closed CAPAs (after 5-year retention)<br/>• Export CAPA dossiers for external audit |
| **Admin / Lab Director** | • All QM permissions<br/>• Modify CAPA deadlines<br/>• Override auditor decisions (audit trail recorded)<br/>• Configure CAPA workflow rules<br/>• Access full audit trail (including soft-deleted CAPAs) |

**Firestore Custom Claims (for Rules):**
```json
{
  "labId": "lab-123",
  "role": "owner|admin|rt|auditor-master-ciq|quality-manager|quality-operator|member",
  "isActiveMemberOfLab": true,
  "isAdminOrOwner": boolean,
  "isAuditorMasterCIQ": boolean,
}
```

---

## Error Handling & Escalation

### Error: CAPA Not in Correct Status

**Scenario:** Proprietario tries to submit evidence when CAPA is in `aberto` state (investigation not started).

**System Response:**
```json
{
  "error": true,
  "code": "INVALID_STATUS_TRANSITION",
  "message": "Cannot submit evidence: CAPA status is 'aberto'. Start investigation first.",
  "currentStatus": "aberto",
  "requiredStatus": "em-andamento",
  "suggestedActions": [
    "capaStartInvestigation(labId, capaId)",
    "Contact auditor if you need help"
  ]
}
```

### Error: RCA Too Short

**Scenario:** Proprietario submits RCA with only 50 characters (minimum is 100).

**System Response:**
```json
{
  "error": true,
  "code": "VALIDATION_FAILED",
  "message": "RCA must be at least 100 characters (received 50).",
  "field": "analiseRaizCausa",
  "validation": {
    "minChars": 100,
    "receivedChars": 50,
    "feedback": "RCA is too brief. Include: root cause, contributing factors, and investigation findings."
  }
}
```

### Error: Evidence File Hash Mismatch

**Scenario:** Evidence file uploaded, but SHA-256 hash doesn't match client-side calculation.

**System Response:**
```json
{
  "error": true,
  "code": "INTEGRITY_CHECK_FAILED",
  "message": "Evidence file integrity check failed. File may have been corrupted.",
  "clientHash": "abc123...",
  "serverHash": "xyz789...",
  "suggestedActions": [
    "Re-upload the evidence file",
    "Verify file contents are correct",
    "Contact system admin if error persists"
  ]
}
```

### Error: Auditor Not Assigned

**Scenario:** Proprietario submits evidence, but no auditor is available to review.

**System Response:**
- Evidence accepted (status: `evidencia-submetida`)
- Alert email sent to QM: "CAPA [número] awaiting auditor review for 7+ days"
- Escalation: QM manually assigns auditor via capaAuditorAssign callable

### Error: Deadline Exceeded

**Scenario:** CAPA deadline passed, but still in `em-andamento` state.

**System Response:**
- CAPA marked as "overdue" (visual indicator in dashboard)
- Daily reminder email to proprietario: "CAPA [número] overdue by X days"
- Daily escalation to RT: "Overdue CAPA [número] requires immediate action"
- Escalation to QM after 7 days overdue: "Escalate or extend deadline"

### Escalation Path

```
CAPA Issue Detected
    ↓
1. Alert Proprietario (email) — 24h response window
    ↓
2. If no response: Alert RT (email) — 24h response window
    ↓
3. If no response: Alert QM (email) + Dashboard alert — 48h response window
    ↓
4. If still unresolved: Alert Lab Director (email) + Escalation meeting scheduled
```

---

## Regulatory Compliance

### RDC 978 Art. 86 (Risk Management)

**Requirement:**
> "A empresa responsável pela realização de ensaios deverá implantar e manter um sistema de gestão de risco que inclua identificação, avaliação e tratamento de riscos... As ações de tratamento de risco deverão ser documentadas e verificadas."

**CAPA Compliance:**
1. ✅ Risk identification (Risk register, FMEA-Lite, ADR-0016)
2. ✅ Risk assessment (P×S×D scoring)
3. ✅ Risk treatment via CAPA (investigation → action → verification)
4. ✅ Documentation (transicoesCAPAs audit trail, evidence manifest)
5. ✅ Verification (auditor effectiveness check, closureSignature)

**Evidence for External Auditor:**
- CAPA linked to Risk (riskId in CAPA doc)
- RCA addresses risk root cause
- Action plan mitigates risk (P/S/D reduction)
- Evidence proves effectiveness
- Audit trail shows workflow completion

### RDC 978 Art. 147 (CAPA)

**Requirement:**
> "Quando não-conformidades ou desvios forem identificados, a empresa responsável pela realização de ensaios deverá estabelecer um sistema de avaliação do impacto na qualidade dos resultados de ensaios... A empresa deverá implementar ações de correção ou ações preventivas apropriadas e verificar sua efetividade."

**CAPA Compliance:**
1. ✅ NC detection (auditor, operator, system alert)
2. ✅ Impact evaluation (RCA analysis)
3. ✅ Corrective action (acaoCorretivaPlano)
4. ✅ Verification (auditor review, effectivenessCriteria)

**Timeline Requirement (Art. 147 §2):**
- **Deadline:** 30–90 days from NC detection (configurable per lab)
- **Monitoring:** Dashboard shows "at-risk" CAPAs (deadline < 7 days), "overdue" CAPAs
- **Escalation:** RT/QM notified daily for overdue

### DICQ 4.1.2.4 (Ações de Correção)

**Requirement:**
> "As ações de correção deverão ser documentadas, implementadas, avaliadas quanto à sua efetividade e registradas de forma a permitir rastreabilidade."

**CAPA Compliance:**
1. ✅ Documented (RCA, action plan, effectiveness criteria stored in Firestore)
2. ✅ Implemented (evidence uploaded, auditor verifies)
3. ✅ Evaluated for efficacy (auditor effectiveness check, effectivenessVerified flag)
4. ✅ Traceable (audit trail with operatorId, ts, chainHash for every transition)

**Retention (DICQ 4.1.2.4):**
- Records retained for 5 years minimum (RDC 978 Art. 105)
- Soft-delete only; no hard delete
- Audit trail immutable

### ISO 15189:2022 §8.5 (Nonconformities and Corrective Actions)

**Requirement:**
> "When nonconformities are detected, the laboratory shall investigate the cause and determine whether a corrective action is needed... The laboratory shall verify the effectiveness of corrective actions."

**CAPA Compliance:**
1. ✅ Detection & documentation (CAPA created, logged)
2. ✅ Investigation (RCA analysis, min 100 chars)
3. ✅ Corrective action (action plan, responsible party, deadline)
4. ✅ Effectiveness verification (auditor review, evidence evaluation)
5. ✅ Closure with signature (closureSignature, immutable)

---

## Appendix: Glossary

| Term | Definition |
|------|-----------|
| **CAPA** | Corrective Action / Preventive Action. Systematic process for addressing NC or Risk via investigation → action → verification. |
| **NC (Non-Conformidade)** | Deviation from established procedures, quality standards, or regulatory requirements. Source of CAPA. |
| **Risk** | Potential for harm (FMEA-Lite: P×S×D scoring). Trigger for preventive CAPA (ADR-0016). |
| **RCA (Root Cause Analysis)** | Investigation to determine underlying cause of NC or Risk. Minimum 100 chars. |
| **Effectiveness Criteria** | Measurable standard for verifying CAPA effectiveness (e.g., "No recurrence in 30 days"). |
| **Audit Trail** | Immutable record of CAPA state transitions + signatures. Append-only `transicoesCAPAs[]` array. |
| **Soft-Delete** | Logical deletion (RN-06): `deletadoEm` flag set, records preserved for 5 years. No hard delete. |
| **LogicalSignature** | Immutable signature: `{ hash: SHA-256, operatorId, ts }`. Proof of authority + integrity. |
| **ChainHash** | HMAC linking successive transitions. Prevents tampering + reordering. |
| **Proprietario** | Quality operator assigned to investigate + execute corrective action. |
| **Auditor Master CIQ** | Role authorized to review evidence + approve/reject CAPA closure. |

---

**Document Version:** 1.0  
**Status:** ACTIVE  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-08-07 (post-Phase 4 launch)  
**Maintainer:** CTO / Quality Management

---

*This document is part of the HC Quality v1.4 regulatory compliance suite. For RDC 978 Art. 105 (5-year retention), this document and all referenced CAPA records must be preserved for the retention period.*
