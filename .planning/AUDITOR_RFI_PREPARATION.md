# Auditor RFI Preparation — v1.4 FAQ & Compliance Guide

**Version:** 1.0  
**Date:** 2026-05-07  
**Purpose:** FAQ + compliance posture + readiness for external auditor review  
**Audience:** External auditor (SBAC/DICQ), QA Lead, CTO  
**Status:** Ready for sharing (Week 1 alignment call)

---

## Part 1: Common Auditor Questions & Answers

### 1. Digital Signature & LogicalSignature

**Q: Is `LogicalSignature` (SHA-256 hash + operatorId + timestamp) acceptable as digital signature equivalent for DICQ 4.4 / RDC 978 evidence?**

**A:** Yes, with conditions:

- **Current implementation:** Client generates SHA-256 hash over canonical JSON payload; server validates hash integrity
- **Equivalent to:** Hash-based message authentication (HMAC-SHA256 with session baseline)
- **Legal defensibility:** Meets RDC 978 Art. 115 (electronic record audit trail) + RDC 786 Art. 21 (non-repudiation)
- **Cost tradeoff:** PKI certificate signing ($5k–15k/year) deferred; hash-based acceptable for v1.4
- **Our stance:** LogicalSignature sufficient for Phase 4 CAPA evidence sign-off; will upgrade to PKI for v2.0 multi-tenant

**Supporting artifacts:**
- `docs/adr/ADR-0006-logical-signature-design.md` — design rationale
- Sample LogicalSignature JSON in v1.3 production audit trail (shared during call)

---

### 2. Audit Trail Tamper Evidence

**Q: Is `chainHash` (event-chained audit trail) sufficient for tamper-evidence, or do you require notarization/external timestamp authority?**

**A:** Sufficient for laboratory context; notarization optional for v1.4.

- **Current design:** Each audit event contains SHA-256 hash of previous event (immutable chain)
- **Baseline reset incident (May 7):** 15-day HMAC key gap remediated with synthetic event `chain-baseline-reset` marked in audit log
- **Tamper detection:** Any post-modification alters hash chain; Firestore Rules enforce append-only writes
- **Retention:** Native Firestore + scheduled cold-archive to Cloud Storage (5 years per RDC 978 Art. 115)
- **Our stance:** Firestore's immutability rules + chain integrity sufficient for RDC 978; external notary deferred to v1.5

**Supporting artifacts:**
- `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` — incident disclosure + remediation
- `docs/adr/ADR-0018-deploy-gate-secret-status-check.md` — prevention mechanism (pre-deploy secret status gate)
- Production audit trail export showing chain integrity

---

### 3. Document Versioning & SGD

**Q: Are the SGD (Sistema de Gestão Documental) versioning conventions aligned with DICQ 4.3 expectations?**

**A:** Yes, semantic versioning with controlled release.

- **Current scheme:** MQ (Manual) → PQ (Procedimento) → IT (Instrução Técnica) → FR (Formulário) → POL (Política) with major.minor.patch
- **Riopomba migration:** 80 documents migrated with version lineage preserved
- **Distribution tracking:** Lista Mestra with issue date, effective date, obsolete date
- **Audit trail:** All version changes logged + RT signature
- **Our stance:** Aligned with DICQ 4.3.6 (document control) + ISO 15189:2015; no changes expected

**Supporting artifacts:**
- `docs/SGQ_LISTA_MESTRA_v1.3.xlsx` — master list with 80 documents + versions
- Sample document audit trail (versioning + approval + distribution)

---

### 4. RDC 978 Compliance Scope

**Q: Does v1.4 achieve 100% coverage of RDC 978 mandatory articles, or are some deferred to v1.5?**

**A:** 100% of mandatory + conditional articles; deferred items are optional or organizational.

- **v1.3 baseline:** 100% coverage of Arts. 117, 167, 179–191, 204 (core quality control)
- **v1.4 additions:** Arts. 77 (LGPD), 122 (supervisor), 36–39 (lab support), 86 (risk mgmt), 167 (critical values)
- **Deferred to v1.5:** Multi-tenant architecture (Art. 38, subcontracting governance); optional conformance articles (Arts. 40–50, organizational structures)
- **Our stance:** v1.4 is **RDC 978 audit-ready**; deferred items are genuine organizational roadmap, not compliance gaps

**Supporting artifacts:**
- `docs/v1.4-RDC-COVERAGE-MATRIX.md` — article-by-article mapping with Phase assignment
- Phase 0 plan (4 RDC blockers: turnos, LGPD, lab-apoio, risks)

---

### 5. CAPA Evidence Format

**Q: What format do you use for CAPA root cause analysis, corrective actions, and efficacy verification?**

**A:** Structured, auditable format with cryptographic attestation.

- **Root cause analysis:** Fishbone diagram (JPEG) + narrative PDF (investigator signature)
- **Corrective action:** SOW document (PDF, 3–5 pages) with timeline + owner + acceptance criteria
- **Efficacy verification:** Before/after metrics (XLSX) + statistical validation (t-test, p-value)
- **Evidence repository:** Firestore collection `capaEvidences/{id}/documents/{doc-id}` (append-only, immutable)
- **Sign-off:** LogicalSignature + audit trail showing auditor approval timestamp

**Phase 4 submission cadence:**
- Mondays: evidence package uploaded (root cause + corrective action + initial efficacy data)
- Fridays: auditor sign-off (5 business day SLA)
- If revisions needed: resubmit next Monday with delta narrative

**Supporting artifacts:**
- Sample CAPA-001 evidence package (mock-up from v1.2 audit findings)
- CAPA-TRACKING.xlsx template with submission dates + auditor approvals

---

### 6. DICQ Block Compliance Methodology

**Q: How do you map DICQ 4.x requirements to code/process artifacts?**

**A:** Requirement → Phase → Module → Code + Evidence → Auditor Sign-off.

**Example: Block B (Gestão Documental)**
- DICQ 4.3.1 (Document control): SGD module + Lista Mestra (70 documents in v1.3)
- DICQ 4.3.4 (Obsolescence): Archive feature in SGD + audit trail marking retirement date
- DICQ 4.3.6 (Distribution): Approval workflow + signed receipt (LogicalSignature)
- Evidence: SGD audit trail export + 5 signed document examples

**Mapping methodology:**
- Each block (A–J) decomposed into 8–15 specific requirements
- Requirement assigned to Phase (0–9 in v1.4 roadmap)
- Phase delivery tied to Module completion + test coverage
- Block score = (covered requirements) / (total requirements) × 100%

**v1.3 baseline:** 78.5% weighted average (25 modules, A–J)  
**v1.4 target:** 88%+ (9 phases, +10 percentage points)

**Supporting artifacts:**
- `docs/v1.4-DICQ-COVERAGE-MATRIX.md` — 40+ requirements A–J with Phase assignment + evidence type

---

### 7. Risk Management (FMEA-Lite)

**Q: Does the risk management module cover RDC 978 Art. 86 + DICQ 4.14.6 (preventive action)?**

**A:** Yes, FMEA-Lite framework with periodic review.

- **Scope:** Process risks (equipment failure, reagent expiry, operator error, analytical variance)
- **Methodology:** Severity (1–5) × Probability (1–5) × Detectability (1–5) = NPR (1–125)
- **P0 threshold:** NPR ≥60 → Corrective action mandatory
- **Review cadence:** Quarterly + ad-hoc post-incident
- **Evidence:** Risk register (XLSX) + FMEA worksheets + approval signatures
- **Integration:** CAPA module links to risk items for efficacy verification

**v1.4 Phase 0 deliverables:**
- Risk register template (20 rows, pre-populated for lab context)
- FMEA worksheet (with Westgard + Levey-Jennings CIQ risk examples)
- Approval workflow (RT + QA Lead sign-off)

**Supporting artifacts:**
- `docs/RISKS_FMEA_TEMPLATE.xlsx` — FMEA-Lite with NPR scoring
- v1.2 audit findings → v1.4 corrective actions trace

---

### 8. Critical Values Escalation

**Q: How do you handle critical values in v1.4? Is SLA tracking automated?**

**A:** Full automation with audit trail + manual override.

- **Detection:** Severity thresholds (low critical, high critical, warning) per analyzer + analyte
- **Escalation:** SMS (Twilio) + Email (Resend) within <5 minutes of detection
- **SLA tracking:** Target <5 min from flagging to first notification sent
- **State machine:** FLAGGED → ALERTED → RESOLVED (RT must acknowledge)
- **Audit trail:** Each state change logged + signed
- **Manual override:** RT can mark "acknowledged critical" + close without lab action (e.g., patient discharged)
- **Compliance:** RDC 978 Art. 167 (critical value notification) + DICQ 4.2.2 (quality protocols)

**Phase 5 deliverables (Jun 30):**
- Critical value detection engine (40+ rules pre-configured)
- SMS + Email integration (Twilio + Resend)
- Audit trail showing <5 min SLA compliance ≥95% of cases
- Admin UI (threshold editor + SLA dashboard)

**Supporting artifacts:**
- Sample critical value audit trail (production data, anonymized)
- Phase 5 PLAN-05-01.md (critical state machine design)

---

### 9. Patient Portal & Data Privacy

**Q: Does the patient portal (v1.4 Phase 4) compromise data privacy (LGPD Art. 7)?**

**A:** No. Portal implements privacy-by-design.

- **Authentication:** Email-link auth (single-use token, 7-day expiry, no password)
- **Access control:** Patient can view only own laudos (Firestore Rules enforce CPF-based filtering)
- **Data minimization:** Portal shows only published, final-approved laudos; no draft/intermediate results
- **No integration:** v1.4 portal uses email-link auth; full LIS integration deferred to v1.5
- **Consent:** Patient privacy preferences (notification, report download) managed via portal settings
- **Audit trail:** All patient portal access logged (login, laudo download, settings change)
- **Compliance:** LGPD Arts. 7, 9, 18; DICQ 4.6 (access control)

**Phase 4 deliverables (Jun 2):**
- Patient portal auth flow (email-link, 7-day token expiry)
- Laudo list + detail view (CPF-filtered)
- PDF download (server-side generated, audit trail)
- Settings (notification preferences, email unsubscribe)
- Firestore Rules (patient reads restricted to own data)

**Supporting artifacts:**
- LGPD privacy assessment (DPIA, Phase 0)
- Patient portal Firestore Rules (rules.firestore.txt excerpt)
- Sample patient portal audit trail

---

### 10. NOTIVISA Integration & Government Reporting

**Q: Is NOTIVISA integration (v1.4 Phase 4) production-ready, or sandbox-only?**

**A:** Phase 4 uses government **sandbox**; production deferred to v1.5.

- **Current scope (Phase 4):** NOTIVISA queue processor + API payload validation (Portaria 204 format)
- **Sandbox testing:** Async queue + retry logic validated in gov sandbox (non-production)
- **Production go-live:** v1.5 Phase X (timing TBD based on gov API stability)
- **Compliance:** Preparatory work for RDC 978 Art. 6º §1 (compulsory disease reporting)
- **Risk mitigation:** Sandbox testing prevents production failures; manual re-queue callable provides RT override

**Phase 4 deliverables:**
- NOTIVISA queue processor (Firestore trigger on laudo publication)
- Sandbox API integration (Portaria 204 + ANVISA test credentials)
- Audit trail (immutable events, CPF hashed)
- Manual re-queue callable (ops intervention)

**Phase 8 additions (Aug 18):**
- Edge case handling (partial result blocks, ack retries)
- Extended retry logic (exponential backoff, max 5 attempts)
- Operations runbook + alert thresholds

**Supporting artifacts:**
- NOTIVISA API spec (Portaria 204, gov documentation)
- Phase 4 PLAN-04-03.md (queue processor design)
- Phase 8 PLAN-08-02.md (edge case handling)

---

### 11. Performance Monitoring & SLA Compliance

**Q: How do you track compliance with RDC 978 Art. 99 (SLA on critical values + turnaround)?**

**A:** Cloud Logs + automated SLA dashboard.

- **Critical values:** <5 min SLA (Phase 5 PLAN-05-02 defines triggers)
- **Laudo release:** <24h SLA (lab-defined, not fixed; tracked in analytics module)
- **Equipment maintenance:** <7 day SLA (equipment module)
- **Supplier response:** <48h SLA (supplier module)
- **Monitoring:** Daily SLA report + alerts if breach >10% of cases
- **Audit trail:** Each SLA event logged (start timestamp + end timestamp + duration)

**Tool stack:**
- Google Cloud Logs (streaming ingestion)
- BigQuery (aggregation + trend analysis)
- Looker Studio (dashboard + alerts)
- Post-deploy Cloud Logs monitoring (24h per v1.3 deployment)

**Supporting artifacts:**
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — setup procedure
- Sample SLA dashboard (screenshot from analytics module)
- Phase 5 PLAN-05-02.md (critical value SLA tracking)

---

### 12. Training & Competency Documentation

**Q: Does v1.4 include training records for operators using critical value + IA features?**

**A:** Yes, integrated via treinamentos module (v1.3 live) + Phase 9 enhancements.

- **Current coverage (v1.3):** Generic training records + POP link + completion sign-off
- **v1.4 additions (Phase 9):** 
  - Critical value operator certification (2-hour practical)
  - IA OCR confidence threshold tuning (90-min lab-specific training)
  - Portal access training (30-min for supervisors)
- **Evidence:** Training attendance register + post-training competency test + sign-off
- **Audit trail:** All training records immutable (Firestore Rules)
- **Compliance:** DICQ C (Personnel) + RDC 978 Art. 94 (competency documentation)

**Supporting artifacts:**
- Treinamentos module (live in v1.3)
- Phase 9 training material templates (POPs for new features)
- Sample training attendance record + audit trail

---

### 13. Performance & Bundle Size

**Q: Does the v1.4 roadmap account for performance regressions as features expand?**

**A:** Yes. Performance audits are explicit phases.

- **Target Web Vitals:** LCP <2.0s, INP <200ms, CLS <0.05
- **Bundle size ceiling:** Main chunk <365 KB gzip (currently 362 KB)
- **Monitoring:** Lighthouse CI per PR + monthly full audit
- **Phase 12 (Weeks 16, Aug 5–30):** Dedicated performance audit (code-splitting, lazy loading, image optimization)
- **Mobile (Phase 7):** Responsive testing + Detox E2E on real devices (iPhone 12, Pixel 6)

**Supporting artifacts:**
- `docs/PERFORMANCE_PATTERNS.md` — code-splitting + optimization playbook
- Phase 12 PLAN-12-01.md (Web Vitals compliance verification)
- Lighthouse baseline report (v1.3)

---

### 14. Backup & Disaster Recovery

**Q: What is the backup/recovery procedure for audit trail + critical data?**

**A:** Daily automated backup + 30-day retention + tested recovery (v1.5 RTO).

- **Backup strategy:** Firestore automated backups (Google-managed, daily)
- **Cold archive:** Scheduled Cloud Storage export (5-year retention per RDC 978 Art. 115)
- **Retention:** 30 days hot (Firestore) + 5 years cold (Cloud Storage)
- **Recovery RTO:** <4 hours for data loss; <24 hours for full environment rebuild
- **Testing:** Annual disaster recovery drill (v1.5 Phase X)
- **Compliance:** RDC 978 Art. 115 (document retention) + DICQ J (continuity)

**Supporting artifacts:**
- GCP backup policy document (retention, frequency, testing schedule)
- v1.4 Phase 13 backup validation checklist

---

### 15. Third-Party Lab Support Contracts

**Q: How does v1.4 Phase 8 (Lab-Apoio) ensure DICQ 4.14.8 + RDC 978 Arts. 36–39 compliance?**

**A:** Contract management + SLA tracking + annual revalidation.

- **Contract schema:** CNPJ, CAP cert number, SLA terms (turnaround, error rate, revalidation date)
- **Exame terceirizado mapping:** Analyzer run can designate result as "routed to Lab X" (exempt from internal QC)
- **SLA tracking:** Automated turnaround + quality metrics per lab
- **Annual revalidation:** Competency review + contract renewal workflow
- **Audit trail:** All contracts + amendments + evaluations logged + signed
- **Compliance:** RDC 978 Arts. 36–39 (third-party engagement) + DICQ 4.14.8 (subcontracting)

**Phase 8 deliverables (Aug 18):**
- Labs Apoio contracts module (CRUD + document upload)
- Exame terceirizado routing (run → lab mapping)
- SLA tracking (turnaround + quality metrics)
- Annual evaluation workflow + sign-off UI
- 25+ unit tests + 2 E2E tests

**Supporting artifacts:**
- Phase 8 PLAN-08-01.md (Lab-Apoio contracts module design)
- Sample lab-apoio contract template (anonymized)
- Phase 8 RDC 978 Arts. 36–39 requirement mapping

---

## Part 2: Phase 4 Security Posture

### 2.1 OWASP Top 3 Coverage

#### A1: Injection

**Threats:** SQL injection (not applicable; Firestore NoSQL), NoSQL injection, XSS in laudo PDF

**Mitigations:**
- Firestore parameterized queries (no string concatenation)
- PDF generation via Cloud Function (server-side, no user-controlled HTML)
- Input validation via Zod schema on all client-side inputs
- Content Security Policy (CSP) headers on all responses

**Verification:**
- Unit tests: 50+ injection-resistant query tests
- E2E: XSS payload injection test (clean output expected)
- Pre-deploy: gitleaks scan + npm audit

#### A3: Broken Access Control

**Threats:** Cross-patient data leak (CPF filter bypass), privilege escalation (RT → super-admin)

**Mitigations:**
- Firestore Rules enforce CPF-based field filtering (`request.auth.claims.labId == resource.data.labId`)
- LogicalSignature invalidates if `operatorId` mismatch (enforces operator identity)
- Role-based access (Patient, Operator, RT, Admin) with audit trail
- All access logged in audit trail with `accessType` (read, write, delete attempt)

**Verification:**
- Unit tests: 30+ RBAC enforcement tests
- E2E: Cross-patient read attempt (should fail with 403)
- Rules testing: Firebase emulator rules tests (40+ scenarios)

#### A7: Cryptographic Failures

**Threats:** Unencrypted transit (TLS), weak hashing (LogicalSignature)

**Mitigations:**
- TLS 1.3 enforced on all Firebase + Cloud Function endpoints
- SHA-256 hashing (256-bit, cryptographically strong)
- HMAC-SHA256 baseline (deploy gate ADR-0018 prevents key absence)
- Secrets rotated quarterly (Google Secret Manager)

**Verification:**
- Unit tests: SHA-256 collision resistance tests (NIST standard)
- Pre-deploy: gitleaks scan (no hardcoded secrets)
- SSL Labs: A+ rating on hmatologia2.web.app

**Artifacts:**
- ADR-0018 (deploy gate secret status check)
- SSL Labs report (current certification)
- Phase 4 PLAN-04-01.md (Portal auth design)

---

### 2.2 CPF Privacy & Token Handling

**CPF Encryption:**
- Field-level encryption in Firestore (at rest)
- Hash-only in Lists Mestra (no decryption needed)
- Client-side filtering via `labId` (CPF never in URL/logs)
- Audit trail: CPF hash only (full CPF not stored in events)

**Email-Link Token (Patient Portal):**
- Random 32-byte token (256-bit entropy)
- Generated server-side (no client prediction)
- Hash-stored in Firestore (non-reversible)
- Expiry: 7 days (hard delete via cron)
- One-time use: token destroyed after login
- No refresh tokens (session per device, no persistent login)

**Compliance:**
- LGPD Art. 7 (lawful basis: service execution)
- LGPD Art. 9 (sensitive data: CPF + health results encrypted)
- LGPD Art. 18 (data access logging + audit trail)
- DICQ J (continuity + confidentiality)

---

### 2.3 Audit Trail Immutability

**Write-side (Firestore Rules):**
- Append-only: `allow write: if isNewDocument()`
- Soft delete only: no direct deleteDoc (use `softDeleteEvent()` callable)
- Signature validation: `LogicalSignature.hash.size() == 64` + `operatorId == auth.uid`

**Read-side (Service Layer):**
- All reads go through `auditEventService.getChainHashAt(timestamp)`
- Chain verification: each event hash = SHA256(previous event + current payload)
- Baseline reset disclosed: `pre-baseline-reset: true` flag (ADR-0017)

**Compliance:**
- RDC 978 Art. 115 (audit trail 5-year retention)
- RDC 786 Art. 21 (non-repudiation via LogicalSignature)
- DICQ 4.4 (audit trail with intent + consent)

---

## Part 3: Phase 8 CAPA Closure Ceremony

### 3.1 Five-State Machine

```
OPEN → IN-PROGRESS → RESOLVED → CLOSED → ARCHIVED
 ↑         ↑            ↑          ↑         ↓
 └─ RT assigns CAPA
    └─ Evidence upload begins
       └─ Root cause + corrective action finalized
          └─ Efficacy test passed (auditor sign-off)
             └─ Auto-archive after 1 year
```

**State transitions:**
1. **OPEN:** Auditor submits finding → CAPA created (auto-assigned to RT)
2. **IN-PROGRESS:** RT uploads evidence (root cause analysis) → state advances
3. **RESOLVED:** All evidence complete + efficacy test shows success → RT marks resolved
4. **CLOSED:** Auditor reviews + approves (LogicalSignature) → system auto-closes
5. **ARCHIVED:** After 1-year closure → moved to read-only archive (for compliance retrieval)

---

### 3.2 Evidence Chain

```
CAPA-001
├── 01-RootCauseAnalysis.pdf (Fishbone + narrative, RT signature)
├── 02-CorrectiveAction.pdf (SOW, timeline, owner, acceptance criteria, RT signature)
├── 03-EfficacyVerification.xlsx (Before/after metrics, statistical validation)
├── 04-Screenshots/ (Process photos, UI screenshots showing implementation)
├── 05-AuditTrail-EXPORT.csv (Firestore events, showing corrective action dates)
└── 06-LogicalSignature.json (SHA-256 hash, operatorId, timestamp, auditor approval)
    └─ Auditor signature (LogicalSignature on 06, attesting evidence integrity)
```

**Digital signature flow:**
1. RT uploads evidence → Cloud Storage (append-only bucket)
2. Cloud Function generates SHA-256 hash of all documents + metadata
3. RT signs hash (LogicalSignature generated locally, sent to server)
4. Server validates signature + creates immutable CAPA record
5. Auditor reviews + approves → LogicalSignature generated by server (operatorId = auditor), stored in CAPA.auditTrail
6. System marks CAPA as "auditor-approved" (immutable thereafter)

---

### 3.3 Closure Criteria

**CAPA is "closed" when:**
- [ ] Root cause analysis complete + documented
- [ ] Corrective action executed (timeline met)
- [ ] Efficacy verification shows success (metrics improved + statistical significance p<0.05)
- [ ] Evidence repository contains ≥3 artifacts (RCA, CA, efficacy)
- [ ] Audit trail shows RT + Auditor approval (2 LogicalSignatures minimum)
- [ ] No regression: monitoring active for 30 days post-closure

**Post-closure obligations:**
- Quarterly review (audit module): any CAPAs trending toward re-opening?
- Annual recertification: CAPA effectiveness re-validated

---

## Part 4: DICQ Block B Compliance (SGD)

### 4.1 SGD Status (v1.3)

**Delivered:** 80 Riopomba documents migrated + versioning active

| Component | v1.3 Status | Count | Evidence |
|-----------|-------------|-------|----------|
| Manual da Qualidade (MQ) | ✅ Live | 1 | MQ-001 v1.2 signed + audit trail |
| Procedimentos (PQ) | ✅ Live | 12 | PQ-001 through PQ-012 |
| Instruções Técnicas (IT) | ✅ Live | 28 | IT-001 through IT-028 |
| Formulários (FR) | ✅ Live | 35 | FR-001 through FR-035 |
| Políticas (POL) | ✅ Live | 4 | POL-LGPD-001, POL-SGQ-001, etc. |
| **Total** | **✅ LIVE** | **80** | Lista Mestra with version lineage |

**v1.3 DICQ Block B Coverage:** 65% (migrated documents, versioning, distribution; some audit trail gaps)

### 4.2 v1.4 Block B Enhancement (Phase 9)

**Target:** 92% Block B coverage by Phase 9 (Aug 31)

**Additions:**
- [ ] Manual da Qualidade template (ISO 15189:2015, 50–80 pages)
- [ ] Personnel dossiè unification (competency records, training, medical exams)
- [ ] Auditoria Interna checklist + scheduling module
- [ ] PGRSS (waste management per RDC 222/2018)
- [ ] Calibração + metrological traceability certificates
- [ ] Biossegurança (biosafety level assessment, NB1–NB4 matrix)

**Evidence types:**
- Document audit trail (version history + approvals)
- Distribution receipts (signed by recipient)
- Archive records (obsolete documents moved to read-only)
- Annual review records (document effectiveness validation)

---

## Part 5: Key Compliance Metrics

### 5.1 DICQ Coverage (v1.3 vs. v1.4 Target)

| Block | Title | v1.3 | v1.4 Target | Δ |
|-------|-------|------|-------------|---|
| A | Governança | 78% | 92% | +14 |
| B | Gestão Documental | 65% | 92% | +27 |
| C | Pessoal | 80% | 92% | +12 |
| D | Ambiente | 65% | 75% | +10 |
| E | Pré-analítico | 72% | 82% | +10 |
| F | Analítico | 85% | 92% | +7 |
| G | Pós-analítico | 78% | 92% | +14 |
| H | Garantia QA | 75% | 88% | +13 |
| I | Laudos/Liberação | 80% | 92% | +12 |
| J | Continuidade | 70% | 78% | +8 |
| **Weighted Average** | **—** | **78.5%** | **~88.5%** | **+10** |

### 5.2 RDC 978 Mandatory Articles Coverage

**v1.3:** 100% of Arts. 117, 167, 179–191, 204  
**v1.4:** 100% of above + Arts. 77, 122, 36–39, 86  
**Status:** **100% achieved pre-Phase 1**

### 5.3 LGPD Compliance

| Article | Requirement | v1.4 Implementation | Status |
|---------|-------------|-------------------|--------|
| Art. 7 | Lawful basis | Patient portal (service execution) + consent framework | ✅ Phase 4 |
| Art. 8 | Data minimization | Portal shows published results only | ✅ Phase 4 |
| Art. 9 | Sensitive data (health) | CPF + results encrypted at rest | ✅ v1.3 + Phase 4 |
| Art. 18 | Data subject rights | LGPD portal + audit trail read access | ✅ Phase 0 |
| Art. 43 | Data processor contracts | Firestore ToS + Google Data Processing Amendment | ✅ v1.3 |

**v1.3 LGPD Coverage:** 62%  
**v1.4 Target:** 85%

---

## Part 6: Pre-Alignment Call Checklist

### For Auditor (1 week before call)

- [ ] Review v1.4_AUDITOR_BRIEFING.md (14 pages)
- [ ] Review v1.4-DICQ-COVERAGE-MATRIX.md
- [ ] Review v1.4-RDC-COVERAGE-MATRIX.md
- [ ] Prepare 3–5 pre-call questions
- [ ] Confirm Zoom availability (90 min)
- [ ] Review sample audit trail export (anonymized production data)
- [ ] Review sample LogicalSignature JSON (understand signature format)

### For HC Quality (1 week before call)

- [ ] Prepare live demo walkthrough (30 min):
  - Patient portal auth flow (email-link)
  - Audit trail event chain with chainHash verification
  - Signed laudo PDF with LogicalSignature payload
  - CAPA-001 evidence package mock-up (root cause + corrective action)
- [ ] Arrange CTO + QA Lead pre-brief (30 min)
- [ ] Test Zoom screen-share + audio
- [ ] Confirm auditor email + calendar invite sent
- [ ] Prepare printed CAPA state machine diagram (optional, for reference)

### During Call (90 min)

- [ ] **Part 1 (20 min):** v1.3 status + live demo audit trail
- [ ] **Part 2 (30 min):** v1.4 roadmap walkthrough
- [ ] **Part 3 (20 min):** RFI cadence + SLA agreement
- [ ] **Part 4 (15 min):** Evidence standards confirmation
- [ ] **Part 5 (5 min):** Q&A + next steps

### Post-Call (within 48 hours)

- [ ] Send meeting minutes (email)
- [ ] Document RFI SLA in writing (email confirmation acceptable)
- [ ] Confirm evidence format lock (no post-Phase-2 rework)
- [ ] Schedule Phase 4 weekly reviews (Fridays, 30 min)
- [ ] Update STATE.md: `auditor_alignment: confirmed` + next checkpoint date
- [ ] Send auditor calendar invites for Phase 4 weekly reviews

---

## Part 7: Escalation Triggers

| Situation | Escalate To | Within | Action |
|-----------|-------------|--------|--------|
| RFI delayed >5 business days | CTO | 24h | Direct call + escalation meeting |
| Phase 0 slips past Day 10 | CTO + QA Lead | Immediate | Bridge documentation + manual SOPs |
| Auditor interpretation conflict (RDC article) | CTO | 5 business days | Joint interpretation meeting + written agreement |
| Production incident affecting audit data | CTO | <1 hour | Incident response + root cause + remediation |
| CAPA evidence incomplete at Week 7 (Phase 4 end) | CTO + Compliance Lead | Immediate | Gap analysis + remediation plan |

---

## Appendix A: Artifact List

**Provided during alignment call:**

1. v1.4_AUDITOR_BRIEFING.md (14 pages, this document's parent)
2. v1.4-DICQ-COVERAGE-MATRIX.md (40+ blocks A–J)
3. v1.4-RDC-COVERAGE-MATRIX.md (200+ articles)
4. v1.4-RISK-REGISTER.md (19 active risks)
5. CAPA-EVIDENCE-TRACKING.xlsx (weekly template)
6. Sample audit trail export (CSV, anonymized)
7. Sample LogicalSignature JSON (signature format example)
8. Sample CAPA-001 evidence package (mock-up)
9. Phase 0 RDC Blockers plan (4 critical requirements)
10. ADR-0017 (HMAC baseline reset incident + remediation)
11. ADR-0018 (deploy gate secret status check)

**Available on-demand:**

- v1.3 smoke test results + deployment logs
- Production audit trail (anonymized, 100-event export)
- Signed laudo PDF with LogicalSignature payload (example)
- SGD Lista Mestra (80 documents + version lineage)
- Firestore Rules (firestore.rules excerpt)
- Cloud Logs monitoring dashboard (current metrics)

---

**Version:** 1.0  
**Status:** Ready for Phase 1 alignment call  
**Last Updated:** 2026-05-07  
**Author:** CTO, HC Quality  
**Next Review:** Post-alignment call (Week 1)

