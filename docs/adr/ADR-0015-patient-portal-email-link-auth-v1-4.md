# ADR-0015: Patient Portal LIS Integration Deferral — Email-Link Auth v1.4, LIS Sync v1.4.1+

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

v1.4 roadmap inclui **Phase 5 — Patient Portal Phase 1** (read-only patient access para download laudo + NPS feedback). Pacientes precisam autenticar no portal pra acessar seus próprios resultados.

**Questão:** v1.4 requer integração com LIS (patient data sync) ou pode usar email-link auth (fallback) e defer LIS integration a v1.4.1?

**Context:**
- Riopomba usava desktop LIS antes (sistema antigo).
- HC Quality v1.3 não tem integração LIS (patient data é manual entry via RT).
- v1.4 roadmap menciona "optional: patient self-service account (email + name + CPF matching)" — not mandatory.
- LIS integration (HL7 v2.4 / FHIR middleware) é v1.5+ roadmap (REQ-505 em v1.4-REQUIREMENTS.md).

**Decision point:** Bloquear Phase 5 (portal) até LIS integration estar pronta? Ou launch portal com email-link auth apenas (fallback)?

## Problema

Two paths diverge at Week 4 (Phase 5 kickoff):

### Path A — Email-link auth only (v1.4 Phase 5)
- **Patient authenticity:** Email link (24–72h expiry) is sent to patient.
- **Patient data:** RT must pre-populate lab system com patient info (manual entry ou CSV import).
- **UX:** Pasient clicks link in email → laudo download available for 24h.
- **Scope:** ~2 weeks (email template, link gen, download UI, audit log).
- **Risk:** If RT forgets to add patient pre, pacient can't download ("patient not found").

**Impact on timeline:** Phase 5 ships Week 4-5. Portal live in production Week 6.

### Path B — LIS integration (v1.4 Phase 5)
- **Patient authentication:** LIS webhook syncs patient list → HC Quality `patients` collection.
- **Patient lookup:** Portal searches patient by CPF / name.
- **Self-service onboarding:** Patient enters email + name + CPF → system verifies against LIS → sends auth link.
- **Scope:** ~4–6 weeks (LIS protocol design, middleware CF, webhook listener, patient sync batch, testing).
- **Risk:** LIS vendor API changes, latency issues, data reconciliation errors.

**Impact on timeline:** Phase 5 blocked until LIS ready (~Week 8+). Portal launch deferred to Week 9 (later than planned).

**Decision imperative:** Path A (email-link auth) aligns v1.4 timeline. Path B deferred to v1.4.1.

## Decisão

**v1.4 Phase 5 adota email-link authentication (fallback).** LIS integration deferred to **v1.4.1 (milestone following v1.4 launch, est. 2 weeks post-launch)**.

### 1. v1.4 Patient Portal — Email-Link Auth

**Flow:**
```
Lab RT adds patient to HC Quality:
  → Manual entry: Patient name, DOB, CPF, email
  OR CSV import: 100 patients bulk-loaded
  → System generates unique patient ID + lookup table (CPF → ID)

Patient arrives at portal:
  → Enters CPF (or patient ID number)
  → System sends secure link to patient's email (72h expiry)
  → Patient clicks link → authenticated session (scope: read own laudo only)
  → Download laudo + view result + submit NPS feedback
  → Session expires after 72h OR patient explicit logout
```

**Components:**
- `src/features/patient-portal/` (public subdomain or `/patient-portal` path).
- `generatePatientAuthLink` CF callable: creates signed JWT (expiry 72h), sends email.
- `verifyPatientAuthToken` service: validates token, authorizes download.
- Patient data stored in `/labs/{labId}/patients` (manual entry or CSV seeded).

**Audit trail:**
- Email link generated: logged in `patient-portal-events`.
- Download: logged + tied to patient ID + timestamp.
- No patient PII in logs (only ID + action).

### 2. v1.4.1 (Post-Launch) — LIS Integration

**Timing:** 2–3 weeks after v1.4 launch (est. late Oct 2026).

**Refactor scope:**
- Remove manual patient entry UI.
- Add LIS webhook listener (CF + Firestore listener).
- Batch sync: `syncPatientsFromLIS` CF (runs nightly, pulls patient list from LIS API).
- Enhanced self-service: Patient self-registers (email + name + CPF) → system verifies against LIS → auto-login.

**Code changes (localized):**
- `functions/src/v1.4.1-lis/syncPatientsFromLIS.ts` (new module).
- Patient data source: `/labs/{labId}/patients` (same collection; schema extended with `lisId` + `syncedAt` fields).
- Backward-compat: Email-link auth still works (for patients not yet synced).

**No changes to Phase 5 UI** (portal download experience is unchanged; just patient lookup source changes from manual → LIS).

### 3. LIS Vendor Agnostic Design

**v1.4.1 targets Riopomba's specific LIS first** (assumed: internal custom system or Sysmex SH/D).

**Middleware design (future multi-vendor):**
```
LIS Vendor A (HL7 v2.4) ──→ Middleware CF ──→ Normalized patient DTO ──→ /patients collection
LIS Vendor B (FHIR)      ──→ Middleware CF ──→ (same DTO) ───────────→ (same collection)
LIS Vendor C (CSV export) ──→ Batch job ────→ (same DTO) ───────────→ (same collection)
```

**v1.4.1 builds Vendor A middleware; v1.5 adds Vendor B + C as needed.**

### 4. Firestore Schema (v1.4 + v1.4.1)

```
/labs/{labId}/patients
├── {patientId}
│   ├── name: string
│   ├── dateOfBirth: Timestamp
│   ├── cpf: string (hashed for privacy)
│   ├── email: string
│   ├── -- v1.4.1 additions:
│   ├── lisId?: string (LIS system ID, e.g., MRN)
│   ├── lisVendor?: 'sysmex' | 'mindray' | 'internal'
│   ├── syncedAt?: Timestamp (when last synced from LIS)
│   └── status: 'manual' | 'synced' (tracking source)
```

### 5. Regulatory Alignment

**LGPD + RDC 978:**
- Patient email is PII; stored encrypted in Firestore (at-rest via Firebase encryption).
- Email-link auth doesn't require patient password storage (zero password = lower attack surface).
- Download audit log ties patient ID + timestamp → auditor can verify "patient X downloaded on date Y".
- LIS sync (v1.4.1) respects patient consent (assumed: LIS already has consent from patient registration; HC Quality doesn't re-ask).

---

## Alternativas consideradas

### Alternativa A — LIS integration v1.4 (full build now)

Invest 4–6 weeks in LIS middleware + patient sync + self-service in v1.4.

**Pros:**
- Portal is complete (self-service + LIS sync).
- Better UX (patient self-registers, no RT manual add).

**Cons:**
- Phase 5 blocked until LIS integration ready (~Week 8–10).
- Portal launch deferred (later than Week 6 target).
- Risk: LIS API changes, integration bugs → Phase 5 slip cascades to other phases.
- DICQ compliance (primary v1.4 goal) is compromised by portal engineering focus.

**Rejected:** Timeline risk > UX gain. v1.4.1 delivers same UX 2 weeks later, less risk.

### Alternativa B — No patient portal v1.4; all deferred to v1.5

Focus v1.4 purely on compliance (DICQ + RDC 978); patient portal is v1.5+ feature.

**Pros:**
- Zero timeline risk; pure compliance focus.

**Cons:**
- Patient experience gap (no self-service laudo access; RT must email PDF manually).
- Market positioning: "patients can't download own results yet" is weak.
- v1.4.1 (post-launch) is good "quick win" roadmap; deferring to v1.5 loses momentum.

**Rejected:** Patient portal is high-value low-risk feature; deferring is over-conservative.

## Consequências

### Positivas

1. **Phase 5 unblocked.** Portal launches Week 4-5 without LIS dependency.
2. **Timeline safe.** Email-link auth is simple + proven (Firebase Auth + Twilio-style email link patterns).
3. **Graceful upgrade path.** v1.4.1 replaces manual patient entry with LIS sync; no portal refactor needed.
4. **DICQ focus maintained.** v1.4 engineering effort stays on compliance; portal is supporting feature.

### Negativas

1. **Manual patient seeding burden.** RT must manually add patients to HC Quality (or import CSV). Labor-intensive for large patient volume.
2. **Email-link UX friction.** Patients must check email + click link each time (72h expiry). Less polished than persistent login.
3. **v1.4.1 execution risk.** LIS integration is deferred; if v1.4.1 slips, email-link auth remains longest-term. Mitigated: v1.4.1 is low priority (no blocker).

## Compromissos derivados

1. **v1.4 Phase 5 deliverables (email-link auth).**
   - `src/features/patient-portal/` module (public UI).
   - `generatePatientAuthLink` CF callable (JWT + email send).
   - Patient CSV import script (bulk-load for Riopomba).
   - E2E tests: 6 specs (email link send, link expiry, download, NPS form, mobile responsive, audit log).

2. **v1.4.1 planning (scheduled 2–3 weeks post-v1.4 launch).**
   - Week 1: LIS architecture design (which vendor? which API?).
   - Week 2: Middleware CF implementation + testing.
   - Week 3: Batch sync + self-service login → production.
   - **Gate:** LIS API docs available + sandbox endpoint ready by Week 1.

3. **Patient data governance (v1.4).**
   - Email + CPF stored encrypted (Firebase at-rest encryption).
   - Email link contains no PII (just random token).
   - Patient list exportable (audit trail of who accessed what laudo when).
   - LGPD disclaimer on portal ("your data is private; see policy X").

4. **Riopomba-specific onboarding (v1.4).**
   - CSV template: name, CPF, email, DOB (rows = patients).
   - Import script: `scripts/import-patients-from-csv.sh`.
   - Validation: CPF format, email format; duplicate check.
   - Success: 2,000+ patients imported for Riopomba by Phase 5 end.

5. **Backward-compatibility (v1.4.1).**
   - Email-link auth continues to work even after LIS sync enabled.
   - Fallback: If patient not found in LIS, offer email-link as alternative.
   - Zero breaking changes (Phase 5 portal UX unchanged).

## Referências

- `v1.4-ROADMAP.md` Phase 5 (Patient Portal Phase 1).
- `v1.4-REQUIREMENTS.md` REQ-505 (LIS Integration — v2 parking lot).
- `src/features/patient-portal/` (v1.4 implementation).
- Firebase Auth + email link patterns (Google documentation).
- Obsidian `HC_Quality_Roadmap.md`: v1.4.1 + v1.5 roadmap (multi-vendor LIS support).

---

**Aplikabilnost:** v1.4 Phase 5 (patient portal) + v1.4.1 (LIS integration).

---

**ADR Status:** ACCEPTED (2026-05-07)  
**Review Date:** 2026-06-18 (Phase 5 mid-point: confirm email-link auth working + patient CSV imported)  
**v1.4.1 Planning Gate:** 2026-10-15 (Phase 5 launch + 1 week; confirm LIS vendor + API docs available)
