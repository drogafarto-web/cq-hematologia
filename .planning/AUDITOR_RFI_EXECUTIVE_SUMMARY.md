# Phase 4 Auditor RFI — Executive Summary

**To:** External Auditors (DICQ accreditation body)  
**From:** CTO (drogafarto@gmail.com)  
**Date:** 2026-05-07  
**Re:** Preemptive responses to anticipated compliance questions ahead of Phase 4 (Portal + NOTIVISA) launch

---

## What's in Phase 4 (2026-06-01 ~ 2026-07-15)

| Feature                                                  | Regulatory Article               | Status                   | Notes                                                   |
| -------------------------------------------------------- | -------------------------------- | ------------------------ | ------------------------------------------------------- |
| **Patient Portal** (email-link auth, laudo download)     | RDC 978 Art. 36–39, LGPD Art. 17 | ✅ Spec complete         | One-time-use tokens, CPF hashing, immutable audit trail |
| **NOTIVISA Integration** (form generation + RT approval) | RDC 978 Art. 66                  | ✅ Sandbox mode          | Production API (v1.5+) deferred pending certificate     |
| **CAPA Closure** (effectiveness tracking)                | RDC 978 Art. 29–30               | ✅ Planned               | Integration with NC workflow                            |
| **Internal Audit** (auditoria-interna module)            | RDC 978 Art. 31                  | ✅ Planned               | Audit scheduling + report generation                    |
| **Risk Management** (FMEA-Lite)                          | RDC 978 Art. 86–87               | ✅ Phase 0 (pre-Phase 4) | 5×5 risk matrix, 8 mitigations documented               |

---

## 7 Common Auditor Questions & Quick Answers

### 1. How do you prevent email auth token reuse? → **One-time use + server-side binding**

- Token marked used immediately upon redemption (atomic Firestore transaction).
- Reuse attempt rejected: "link already used" error.
- Firestore Rules forbid client-side tampering.
- **Evidence:** `functions/src/modules/patient-portal/verifyPatientAuthToken.ts` + 6 unit tests.

### 2. Can patients see other patients' results? → **No. Firestore Rules + Firestore Rules testing**

- Patient JWT contains `scope: ['read:own-laudo']` + patient ID binding.
- Cross-patient read rejected at Rules layer (before data returned).
- **Evidence:** 45-spec Firestore Rules test suite (all passing). Unit test: "patient cannot read other patient's laudo" ✅.

### 3. NOTIVISA: How do you prove Anvisa received the form? → **Audit trail + chain-hash sealing**

- v1.4: Form generation + RT approval + HMAC sealing (RDC 786 Art. 21).
- Immutable audit trail logs all actions (creation, approval, export).
- v1.5: Production API integration (pending certificate) + receipt code storage.
- **Evidence:** ADR-0014, `notivisaDraftGenerator.ts`, `sealNotivisaDraft.ts`, immutable audit collection.

### 4. Penetration testing? → **Phase 3 security audit done, Phase 8 third-party pen-test planned**

- Phase 3: Internal security audit (2026-05-07) → 2 medium-risk, 5 low-risk findings. Go decision.
- Phase 4: Manual pen-test of portal + NOTIVISA (Week 1–2, CTO + contractor).
- Phase 8: Third-party pen-test (Deloitte/EY level, 2–3 weeks starting 2026-07-01).
- **Evidence:** `docs/SECURITY_AUDIT_Phase3.md` (24 KB findings + remediation plan).

### 5. Where are your ADRs? Risk matrix? → **All documented in `docs/adr/` + risk matrix + threat model**

- 18 ADRs covering architecture + compliance decisions (checked into git, immutable).
- FMEA-Lite risk matrix (Phase 0): 5×5 Probability × Severity, 8 mitigations.
- STRIDE threat model (Phase 4): Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation.
- **Evidence:** `docs/adr/`, `docs/FMEA_PHASE0_MATRIX.md`, `docs/STRIDE_THREAT_MODEL_PHASE4.md`.

### 6. What did you defer? Are those regulatory mandates? → **NOTIVISA API (v1.5, not blocker), LIS integration (v1.4.1, not regulatory)**

- NOTIVISA: v1.4 generates forms ✅; v1.5 adds live API (certificate pending, manual fallback available).
- LIS: v1.4 uses email-link auth ✅; v1.4.1 adds LIS sync (not regulatory mandate per RDC 978 Art. 10).
- **Evidence:** ADR-0014, ADR-0015, operational fallback procedures documented.

### 7. If Phase 4 breaks in production, can you roll back? → **Yes. Three-layer rollback: Rules (15 min), Functions (30 min), Hosting (5 min)**

- Firestore Rules: redeploy previous version from git.
- Cloud Functions: redeploy previous build (via gcloud builds submit).
- Hosting: instant rollback to previous release (Firebase manages versions).
- **Evidence:** `docs/INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md` (comprehensive runbook), automated backups (daily Firestore + audit-trail exports).

---

## Compliance Snapshot

| Standard         | Baseline       | Phase 0                       | Phase 4                                    | Phase 9                               | Target                      |
| ---------------- | -------------- | ----------------------------- | ------------------------------------------ | ------------------------------------- | --------------------------- |
| **RDC 978/2025** | 85% (v1.3)     | 82% → Arts. 122, 36–39, 86–87 | 87% + Arts. 31, 66 portal                  | 92%+                                  | 100% by audit (Oct 2026)    |
| **DICQ 8ª Ed.**  | 78.5% (v1.3)   | 82% (Phase 0)                 | 87% (Phase 4)                              | 92%+ (Phase 9)                        | ✅ Pre-audit ready Aug 2026 |
| **LGPD**         | Partial (v1.3) | ✅ Consent form (Phase 1)     | ✅ Portal reads + privacy policy (Phase 4) | ✅ Portal deletion requests (Phase 5) | Full compliance Phase 5     |

---

## Key Artifacts Ready for Auditor

1. **Full RFI Response Document:** `.planning/AUDITOR_RFI_PHASE4_RESPONSES.md` (48 KB, 7 RFIs + evidence)
2. **Compliance Matrix:** `docs/RDC_978_COMPLIANCE_MATRIX_v1.4_ROADMAP.md` (all 200+ articles mapped to phases)
3. **Security Audit Report:** `docs/SECURITY_AUDIT_Phase3.md` (OWASP Top 10 mapping + findings)
4. **Evidence Checklist:** `docs/AUDITOR_EVIDENCE_CHECKLIST.md` (field-by-field verification guide)
5. **ADR Directory:** `docs/adr/` (18 decision records, all reviewed + accepted)

---

## Next Steps

1. **CTO Review:** 2026-05-08 (sign-off on RFI responses)
2. **QM Review:** 2026-05-09 (compliance validation)
3. **Auditor Distribution:** 2026-05-10 (send package to DICQ accreditation body)
4. **Phase 4 Kickoff:** 2026-05-20 (auditor questions addressed before engineering starts)

---

**Questions?** Contact drogafarto@gmail.com
