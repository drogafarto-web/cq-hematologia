# Patient Consent Backfill Plan — ia-strip / Gemini

**Owner:** DPO + Lab RT
**Triggered by:** Wave 1 deployment of `consentGate` (functions/src/modules/ia-strip/guardrails/consentGate.ts)
**Status:** Planning — not yet executed
**Compliance:** LGPD Arts. 7º, 11; RDC 978 Art. 128; DICQ 4.4
**Last updated:** 2026-05-08

---

## TOC

1. Context
2. Phase 1 — Inventory
3. Phase 2 — Operator outreach
4. Phase 3 — Batch upload
5. Phase 4 — Cutover
6. Timeline
7. Success criteria
8. Rollback plan
9. Edge cases
10. Audit & evidence
11. Open issues

---

## 1. Context

Wave 1 added a server-side `consentGate` that refuses every Gemini call for the
ia-strip module unless `consents/{labId}/patients/{patientId}` carries
`iaProcessing === true`, a non-null `consentedAt`, and `revokedAt === null`.

For patients onboarded **before** Wave 1, no consent record exists. Once the
gate is activated in production every existing patient is treated as
"consent not captured" and ia-strip classification will throw
`failed-precondition / consent-not-captured`. This document defines the
operational plan to capture explicit, paper-trail-backed consent for the
existing roster before the gate flips on.

**In scope:** active patients in `/labs/{labId}/patients` who may be subject
to ia-strip processing.
**Out of scope:** future patients (intake flow already captures consent at
registration) and modules that do not depend on ia-strip (those keep working
regardless).

---

## 2. Phase 1 — Inventory

### Goal
Produce a per-lab CSV of every active patient with their current consent
state, so the lab knows exactly who needs to be contacted.

### Procedure

1. Lab admin opens the Consent Backfill admin console.
2. Console calls `consents_exportPatientList({ labId })` (admin/owner only).
3. The callable streams every doc in `/labs/{labId}/patients`, joins the
   current state of `/consents/{labId}/patients/{patientId}`, and uploads a
   CSV to `gs://<bucket>/exports/{labId}/consent-backfill/{ts}-{uuid}.csv`.
4. Returns a 24h v4-signed URL and `rowCount`.

### CSV columns

| Column | Notes |
|---|---|
| `patientId` | Firestore doc id |
| `name` | plaintext name |
| `email` | plaintext email |
| `cpfHash` | SHA-256 hex of CPF (no plaintext) |
| `dobIso` | ISO date of birth |
| `status` | active / inactive |
| `labPatientId`, `mrn`, `lisId` | from `identifiers.*` |
| `createdAtIso` | when the patient was registered |
| `consentExists` | `true` if a consent doc already exists |
| `consentIaProcessing` | `true` if consent active for ia-strip |
| `consentVersion` | e.g. `lgpd-v1` |
| `consentRevokedAt` | ISO if revoked |
| `consentCapturedAtIso` | ISO if captured |

CPF is hashed in the artefact. The plaintext stays in Firestore. The CSV is
working material for outreach, not a dossier.

### Acceptance
- One CSV per lab, downloaded within 24h of generation.
- `rowCount === count(active patients)` (operator spot-checks 5 random rows
  against the patient registry UI).
- Audit log `consent-backfill-export` present in `auditLogs/`.

---

## 3. Phase 2 — Operator outreach

### Goal
Reach every patient who needs to consent and obtain a signed paper TCLE.

### Channels (in priority order)

1. **In-person on next visit.** Ideal — operator hands the TCLE form, patient
   signs, operator scans it the same day.
2. **Email** (when patient has `email`).
3. **SMS** (only when no email; carries a link to the digital TCLE PDF).
4. **Phone call** (last resort for patients with no email and no SMS opt-in).

### Templates

#### Email template (pt-BR)

> **Assunto:** Atualização sobre o uso de IA nos seus exames — autorização necessária
>
> Olá, {{nome}}.
>
> Estamos atualizando nossas práticas de privacidade. Para continuar usando
> ferramentas de inteligência artificial que ajudam a interpretar imagens
> dos seus exames (como tiras imunológicas), precisamos do seu
> consentimento explícito conforme a LGPD (Art. 7º, II e Art. 11).
>
> O processamento é feito apenas a partir das imagens das tiras —
> **nenhum dado de identificação seu é enviado à IA**. Você pode revogar a
> autorização a qualquer momento.
>
> Para autorizar, basta assinar o termo na sua próxima visita ao
> laboratório. Se preferir, baixe, imprima, assine e devolva
> presencialmente: [TCLE-LGPD-IA-v1.pdf]
>
> Dúvidas? Fale com o DPO em {{dpo_email}}.

#### SMS template

> {{labName}}: precisamos da sua autorização (LGPD) p/ uso de IA nos seus
> exames. Sem custo, revogável a qualquer momento. Termo: {{shortlink}}
> Dúvidas: {{phone}}

#### Paper TCLE
- Use the canonical template `docs/lgpd/IA-STRIP-CONSENT-FLOW.md` (Wave 1).
- Patient signs two copies: one stays with the lab, one with the patient.
- Operator scans the lab copy as PDF (single file, ≤ 10 MB).

### Acceptance
- Outreach attempt logged per patient (column "outreach status" tracked in
  the operator's working CSV — not in Firestore until consent is captured).
- Signed PDFs uploaded to
  `gs://<bucket>/labs/{labId}/consent-paper-trail/{patientId}/{filename}.pdf`.

---

## 4. Phase 3 — Batch upload

### Goal
Persist captured consents in Firestore with a verifiable paper trail.

### Procedure

1. Operator collects a batch of signed PDFs (max **200 per call**).
2. Operator uploads PDFs to
   `labs/{labId}/consent-paper-trail/{patientId}/{filename}.pdf` (Storage
   rules restrict writes to lab admins/RTs).
3. Operator calls `consents_batchRecordConsent({ labId, entries })` from the
   admin console. Each entry carries:

| Field | Type | Notes |
|---|---|---|
| `patientId` | string | Firestore doc id |
| `consentedAt` | ISO-8601 string | When the patient signed the paper |
| `capturedBy` | string (UID) | Operator who collected the form |
| `signedDocPath` | string | Storage path of the scan |
| `signedDocBucket` | string? | Defaults to default bucket |
| `consentVersion` | string? | Defaults to `lgpd-v1` |
| `scope` | string[]? | Defaults to `['ia-strip']` |
| `notes` | string? | Free-text up to 500 chars |

4. Callable validates per row:
   - Patient exists and is not soft-deleted.
   - `capturedBy` is an active member of the lab.
   - `consentedAt` parses to a real date, not in the future (>5min skew).
   - `signedDocPath` actually exists in Storage.
5. Callable upserts `consents/{labId}/patients/{patientId}` with the
   identical contract enforced by `recordPatientConsent` (Wave 2 Agent 2),
   plus a `paperTrail[]` entry preserving `signedDocPath`, `capturedAt`,
   `capturedBy`, `recordedBy` (admin who ran the batch), and `recordedAt`.
6. Result is per-row `{ ok, code? }`. The callable never throws on partial
   failure — it returns the breakdown so the operator can fix and retry only
   the rejected rows.
7. Audit log `consent-batch-captured` records request id, counts, and
   per-row outcomes (no PII, only patientId + code).

### Acceptance
- ≥ 95% of attempted rows return `ok: true`.
- Failed rows route to a remediation queue (operator inspects each `code`).
- For every successful row, `consents/{labId}/patients/{patientId}` is
  readable and `consentGate` passes when called with that patientId.

---

## 5. Phase 4 — Cutover

### Goal
Activate the consent gate in production with a graceful fallback for
un-consented patients.

### Procedure

1. **Lock**: cease ia-strip use against un-consented patients in the
   training/staging emulator. Run the full ia-strip test suite; expect
   `consent-not-captured` on missing-consent fixtures.
2. **Coverage gate**: Phase 3 reports ≥ 95% of active roster has
   `consentExists: true`. Per-lab dashboard tile in admin console.
3. **Deploy** the consent gate to production functions (already deployed in
   Wave 1 — this step verifies it is in fact serving traffic).
4. **UI fallback**: when the web client receives `failed-precondition /
   consent-not-captured`, render a "Capturar consentimento" CTA inline on
   the strip-result card. CTA opens the consent capture flow
   (`recordPatientConsent` callable + paper-trail upload). The operator
   captures consent in-person and retries.
5. **Monitor**: Cloud Logs filter
   `severity>=ERROR resource.type=cloud_function jsonPayload.code="consent-not-captured"`.
   Alert when daily count > expected backfill remainder.

### Rollback (per lab)
- Toggle `labs/{labId}/configuracao/featureFlags.iaStripConsentGateEnabled`
  to `false` (the gate respects this flag — see Open issues for the change
  request to Wave 1).
- Operators continue to capture consent on next visit; ia-strip runs
  unblocked until coverage is restored.

---

## 6. Timeline

| Phase | Window | Owner |
|---|---|---|
| 1. Inventory | Day 1 | Lab admin |
| 2. Outreach | Days 2–14 | RT + reception |
| 3. Batch upload | Days 7–21 (rolling) | Lab admin |
| 4. Cutover | Day 21 | DPO + RT + on-call eng |

For labs with > 5,000 active patients, Phase 2 may run up to 30 days. Each
lab cuts over independently; there is no cross-tenant blocking.

---

## 7. Success criteria

- 100% of active patients have either:
  - a captured consent (`consentExists: true`, `iaProcessing: true`,
    `revokedAt: null`), **or**
  - a documented refusal/withdrawal (Edge cases §9).
- Audit trail completeness:
  - exactly one `consent-backfill-export` per lab per inventory run.
  - one `consent-batch-captured` per upload batch.
  - a `paperTrail[]` entry on every backfilled consent doc with a verifiable
    Storage path.
- Cloud Logs daily `consent-not-captured` count returns to zero within 7
  days of cutover.

---

## 8. Rollback plan

### Per-batch (Phase 3)
A bad batch upload is reversible: each consent doc carries the full
`paperTrail[]`, so we can identify entries with `source: 'batch-backfill'`
+ a specific `requestId` and revoke them via `revokePatientConsent`. The
existing audit trail covers the revocation.

### Per-lab (Phase 4)
Toggle the lab-level feature flag (Open issues §11.1). The consentGate
short-circuits and ia-strip runs continue without consent verification.
Document the rollback decision in `auditLogs/` with `action:
'consent-gate-rolled-back'` and a justification string.

### Global
Wave 1 already accepts `consents/{labId}/patients/{patientId}` with
server-only writes. There is no global rollback that does not also leave
the gate enforcing for new patients — by design. If the gate must be
disabled globally we redeploy `classifyStripGemini.ts` with the gate call
commented out and ship a hotfix; this is a P1 incident and requires DPO +
CTO approval.

---

## 9. Edge cases

### 9.1 Deceased patients
Active doc but no living person to consent. Operators tag these with
`status: 'inactive'` + `inactiveReason: 'deceased'` and exclude from the
backfill. Heirs may request data deletion under LGPD Art. 18. We do not
backfill ia-strip consent for the deceased — ia-strip is forward-looking
processing and does not apply post-mortem.

### 9.2 Patients who refuse consent
Captured as a `consents/{labId}/patients/{patientId}` doc with
`iaProcessing: false`, `revokedAt: serverTimestamp()`, plus a
`paperTrail[]` entry pointing at the signed refusal form. The consentGate
treats this as "not consented" and ia-strip falls back to manual analysis.
Audit log `consent-refused` distinguishes refusal from absence.

### 9.3 Patients who withdrew
Re-route through `revokePatientConsent` (Wave 2 Agent 2). Their consent
doc transitions `iaProcessing` from `true` → `false` with a `revokedAt`
timestamp. consentGate denies. No backfill action needed.

### 9.4 Patients under guardianship (minors / interdição)
Consent is signed by the **legal guardian**. The paper TCLE form must
record `guardianName`, `guardianCpfHash`, and the legal basis (parental
authority / curatorship decision). The batch upload includes this in
`notes` until v1.5 ships first-class guardian fields. capturedBy is still
the operator's UID; capturedFor (added in a follow-up schema migration —
see Open issues §11.2) names the guardian.

### 9.5 Patients with multiple records (duplicates)
The lab admin merges duplicates **before** running the inventory. A merge
operation copies `consents/{labId}/patients/{primaryId}` from the survivor
record. We do not de-duplicate during backfill — that is a separate
data-quality workstream.

### 9.6 Lab on extended freeze (no operations)
Skip Phase 4 cutover for that lab until operations resume. Per-lab feature
flag stays off. ia-strip will not be used so the gate is irrelevant.

---

## 10. Audit & evidence

Every step is auditable:

| Step | Evidence |
|---|---|
| Inventory export | `auditLogs` action `consent-backfill-export` + Storage CSV |
| Outreach | Operator's working CSV (off-system) — minimum evidence |
| Paper consent | Signed PDF in `labs/{labId}/consent-paper-trail/...` |
| Backfill write | `auditLogs` action `consent-batch-captured` + `paperTrail[]` on the consent doc |
| Cutover decision | `auditLogs` action `consent-gate-cutover` (manual entry by DPO) |
| Rollback | `auditLogs` action `consent-gate-rolled-back` with justification |

DPO retains all artefacts ≥ 5 years (RDC 978 Art. 48 retention floor).

---

## 11. Open issues

### 11.1 Lab-level feature flag for the consent gate
The current `consentGate` enforces unconditionally. To make Phase 4
rollback frictionless we propose adding
`labs/{labId}/configuracao/featureFlags.iaStripConsentGateEnabled` as a
short-circuit. Tracked in Wave 1 follow-up; not a Wave 2 Agent 6
deliverable.

### 11.2 First-class guardian fields
`consents/{labId}/patients/{patientId}` should carry optional
`guardian: { name, cpfHash, legalBasis }`. Until then, guardian metadata
lives in `paperTrail[].notes` (free text). Schema bump scheduled for v1.5.

### 11.3 Storage rules for `consent-paper-trail/`
Rules must restrict writes to active lab members and reads to admin/RT/DPO.
Proposed in `.planning/proposed-changes/wave2-6-consent-backfill.md`. Not
deployed by Wave 2 Agent 6.

### 11.4 Wiring in functions/src/index.ts
The two new callables (`consents_exportPatientList`,
`consents_batchRecordConsent`) need to be exported from the top-level
functions index so the deploy picks them up. Wave 2 Agent 6 does NOT edit
that file per task constraints — wiring is captured in
`.planning/proposed-changes/wave2-6-consent-backfill.md`.
