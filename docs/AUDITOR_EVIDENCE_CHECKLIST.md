# Auditor Evidence Checklist — Phase 3 Compliance Verification

**Audit Date:** 2026-05-07  
**Scope:** RDC 978/2025 + DICQ 8ª Edição + LGPD  
**Auditee:** HC Quality (CQ Labclin) — https://hmatologia2.web.app  
**Auditor Instructions:** Check boxes as evidence is verified. Attach screenshots/queries as appendices.

---

## A. RDC 978 Mandatory Articles — Evidence Verification

### Art. 5 (Quality Management Definitions)

- [ ] **Verify:** Project uses standardized definitions for STIII (full-scope lab), CIQ, CEQ, rastreabilidade
- [ ] **Where:** `CLAUDE.md` § Convenções invioláveis; ADRs 0001–0018
- [ ] **Check:** Definitions align with RDC 978 Art. 5 (I–LVI)
- [ ] **Sample task:** Read CLAUDE.md lines 23–32; cross-ref RDC 978 text

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Auditor notes:**

---

### Art. 75 (Performance SLAs)

- [ ] **Verify:** Firestore rule evaluation <500ms P95, Cloud Functions <5% error rate
- [ ] **Where:** `docs/PERFORMANCE_BASELINE_2026-05.md` + Cloud Logs post-deploy monitoring
- [ ] **Check:** Metrics dashboard accessible; post-deploy report generated
- [ ] **Sample query:** `gcloud logging read "resource.type=cloud_firestore AND severity=ERROR" --project hmatologia2 --limit 100 --format=json | jq 'length' # Count errors in 24h post-deploy`

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Auditor notes:**

---

### Art. 115 (5-Year Retention + Integrity)

- [ ] **Verify:** Hard-delete is blocked; soft-delete only via service
- [ ] **Where:** `firestore.rules` § `function softDelete(...)`; `src/features/*/services/*Service.ts`
- [ ] **Check:** Rules forbid `.delete()` on audit-critical collections
- [ ] **Collections to spot-check:** `/labs/{labId}/auditoria`, `/runs`, `/liberacao`, `/lotes`

**Sample Firestore rules check:**
```
grep -n "allow delete" firestore.rules
# Expected: 0 matches (delete is forbidden; soft-delete only)
```

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Auditor notes:**

---

### Art. 122 (Supervisor Presence During Operation)

- [ ] **Verify:** `/labs/{labId}/turnos` collection exists with supervisor shift records
- [ ] **Where:** `src/features/turnos/CLAUDE.md` + schema `functions/src/types/operacional.ts`
- [ ] **Check:** Firestore doc has fields: `supervisorId`, `supervisorNome`, `supervisorRegistro`, `dataInicio`, `dataFim`, `assinatura { hash, operatorId, ts }`
- [ ] **Sample:** Query a test lab's turnos (e.g., labId = 'test-lab-001')

**Sample Firestore query:**
```
db.collection('labs/test-lab-001/turnos')
  .where('dataInicio', '>=', new Date('2026-05-01'))
  .limit(5)
  .get()
```

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Fields verified:**
- [ ] supervisorId present
- [ ] supervisorNome present
- [ ] supervisorRegistro present
- [ ] dataInicio timestamp
- [ ] dataFim timestamp
- [ ] assinatura with chainHash

**Auditor notes:**

---

### Art. 167 (Laudo 14 Fields)

- [ ] **Verify:** Sample laudo JSON contains all 14 fields per RDC 978
- [ ] **Where:** `/labs/{labId}/liberacao/{laudoId}` (Firestore doc)
- [ ] **Check:** Fields 1–9, 13–14 deployed; fields 10–12 pending Phase 9

**Field checklist:**

| # | Field | RDC 978 Ref | Status | Present? |
|---|-------|---|---|---|
| 1 | Lab name + CNES | 167, I | ✅ Done | ☐ Yes ☐ No |
| 2 | Address + phone | 167, II | ✅ Done | ☐ Yes ☐ No |
| 3 | RT name + license | 167, III | ✅ Done | ☐ Yes ☐ No |
| 4 | Signatory name + license | 167, IV | ✅ Done | ☐ Yes ☐ No |
| 5 | Patient name + ID | 167, V | ✅ Done | ☐ Yes ☐ No |
| 6 | Age or DOB | 167, VI | ✅ Done | ☐ Yes ☐ No |
| 7 | Collection date | 167, VII | ✅ Done | ☐ Yes ☐ No |
| 8 | Exam + material + method | 167, VIII | ✅ Done | ☐ Yes ☐ No |
| 9 | Result + unit | 167, IX | ✅ Done | ☐ Yes ☐ No |
| 10 | Reference + limitations | 167, X | 🟡 Phase 9 | ☐ Yes ☐ No |
| 11 | In-house methodology spec | 167, XI | 🟡 Phase 9 | ☐ Yes ☐ No |
| 12 | Restricted material note | 167, XII | 🟡 Phase 9 | ☐ Yes ☐ No |
| 13 | Emission date | 167, XIII | ✅ Done | ☐ Yes ☐ No |
| 14 | Signature (legal) | 167, XIV | ✅ Done | ☐ Yes ☐ No |

**Evidence found:** ☐ 9/14 ☐ 12/14 ☐ 14/14

**Auditor notes:**

---

### Art. 179 (CIQ Mandatory — All Equipment, All Analytes)

- [ ] **Verify:** CIQ runs exist for all active equipment + analytes
- [ ] **Where:** `/labs/{labId}/bioquimica`, `/coagulacao`, `/ciq-imuno`, `/uroanalise`, `/analyzer`
- [ ] **Check:** Spot-sample each module; verify run records + Westgard rules applied

**Sample query (Bioquimica):**
```
db.collection('labs/test-lab-001/bioquimica')
  .where('createdAt', '>=', new Date('2026-04-22'))  // post-Phase 3 deploy
  .limit(10)
  .get()
  .then(qs => console.log(qs.docs.map(d => ({ analyte: d.data().analyte, equipment: d.data().equipmentId, runDate: d.data().createdAt }))));
```

**Equipment/Analyte pairs verified:**
- [ ] Bioquimica: glucose, protein, electrolytes (3+ analytes)
- [ ] Coagulacao: PT, aPTT, fibrinogen (3+ analytes)
- [ ] CIQ-Imuno: HCV, HBsAg, syphilis (3+ analytes)
- [ ] Uroanalise: specific gravity, pH, nitrites (3+ analytes)
- [ ] Analyzer: Yumizen H550 (OCR verified)

**Evidence found:** ☐ All 5 modules ☐ 3–4 modules ☐ <3 modules

**Auditor notes:**

---

### Art. 183 (Critical Values + Blocking)

- [ ] **Verify:** Lab-defined critical value thresholds prevent auto-release
- [ ] **Where:** `/labs/{labId}/configuracoes/criticos` (config doc) + `/labs/{labId}/liberacao/{laudoId}` (sample laudo with criticoFlag)
- [ ] **Check:** Sample laudo with result ≥ threshold has `criticoFlag: true`; observe RT override required

**Configuration check:**
```
db.doc('labs/test-lab-001/configuracoes/criticos').get()
  .then(d => console.log(d.data()));
// Expected output: { glicose: { min: 40, max: 500 }, potassio: { min: 2.5, max: 7.5 }, ... }
```

**Sample laudo check:**
```
db.collection('labs/test-lab-001/liberacao')
  .where('criticoFlag', '==', true)
  .limit(1)
  .get()
  .then(qs => console.log(qs.docs[0].data()));
// Expected: criticoFlag: true, resultado: 35 (below glicose min), status: NOT released until RT override
```

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Critical threshold count:** _____ analytes configured

**Auditor notes:**

---

### Art. 184–191 (NC + CAPA + Escalation)

- [ ] **Verify:** Non-conformance (NC) detected + logged; CAPA assigned + tracked to closure
- [ ] **Where:** `/labs/{labId}/naoConformidades`, `/capa-tracking`
- [ ] **Check:** Sample NC linked to CAPA with root cause + effectiveness verification

**Sample query:**
```
db.collection('labs/test-lab-001/naoConformidades')
  .where('createdAt', '>=', new Date('2026-04-22'))
  .limit(5)
  .get()
  .then(qs => qs.docs.forEach(d => {
    const nc = d.data();
    console.log(`NC: ${nc.id}, Severity: ${nc.severity}, Linked CAPA: ${nc.capaId}, Status: ${nc.status}`);
  }));
```

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**NC samples reviewed:** _____ (recommend ≥3)

**CAPA linkage verified:** ☐ Yes ☐ No ☐ Partial

**Auditor notes:**

---

### Art. 195 (NOTIVISA Reporting — Disease Surveillance)

- [ ] **Verify:** Schema exists; integration timeline documented
- [ ] **Where:** `firestore.indexes.json` (notivisa-outbox index) + `firestore.rules` (notivisa-outbox permission block) + `functions/src/types/notivisa.ts` (DTO)
- [ ] **Check:** Collection `/labs/{labId}/notivisa-outbox` declared; callable signature `submitNotivisaReport()` exists

**Evidence found:** ☐ Schema deployed ☐ Integration Phase 5 ☐ Not yet started

**Note:** *Full integration deferred Phase 5 (2026-07-15). Current status is acceptable for RDC 978 compliance pre-audit if roadmap documented.*

**Auditor notes:**

---

### RDC 978 Summary

**Total Articles Verified:** _____ / 28

**Fully Compliant:** _____ articles

**Substantially Compliant:** _____ articles

**Deferred (Documented):** _____ articles

**Non-Compliant:** _____ articles

**Auditor conclusion:** ☐ PASS ☐ CONDITIONAL PASS (document Phase X completion) ☐ FAIL

---

## B. DICQ 8ª Edição — Block-by-Block Evidence

### Block A: Governança & Direção

- [ ] **4.1.1.3 — Norteadores (Mission/Vision/Values):** Located in SGD or `/governance/norteadores`
- [ ] **4.1.1.4 — Director qualification:** Personnel dossier + registry
- [ ] **4.1.2.3 — Política da Qualidade:** Document in SGD (Phase 9 target)
- [ ] **4.1.2.5 — Job descriptions:** `/personnel/cargos` collection exists
- [ ] **4.1.2.7 — QM designation:** Formal document signed by Director (Phase 9 target)

**Evidence found:** ☐ 5/5 ☐ 3–4/5 ☐ <3/5

**Auditor notes:**

---

### Block B: Gestão Documental (SGD)

- [ ] **4.3 — Hierarquia MQ/PQ/IT/FR:** `/labs/{labId}/sgd/documentos` categorized
- [ ] **4.3 — Versioning:** Document has `versao`, `dataEmissao`, `dataRevisao` fields
- [ ] **4.3 — Approval workflow:** Status enum includes draft → review → approved → obsolete
- [ ] **4.3 — Riopomba migration:** 80+ docs migrated from legacy system (verify 3–5 samples)

**Sample query:**
```
db.collection('labs/test-lab-001/sgd/documentos')
  .where('tipo', '==', 'PQ')  // Procedimento da Qualidade
  .limit(3)
  .get()
  .then(qs => qs.docs.forEach(d => {
    const doc = d.data();
    console.log(`Document: ${doc.titulo}, Version: ${doc.versao}, Status: ${doc.status}, LastReview: ${doc.dataRevisao}`);
  }));
```

**Evidence found:** ☐ 4/4 ☐ 2–3/4 ☐ <2/4

**Total SGD documents:** _____ (target: 80+)

**Auditor notes:**

---

### Block C: Gestão de Pessoas (Personnel)

- [ ] **5.1.2 — Qualifications:** Personnel dossier includes CV, certs, license registration
- [ ] **5.1.5 — Training:** EC records linked to personnel (educacao-continuada module)
- [ ] **5.1.6 — Competency assessment:** Post-training assessment form signed
- [ ] **5.1.8 — EC program:** Annual plan + effectiveness metrics

**Personnel sample:**
```
db.collection('labs/test-lab-001/personnel/dossiê')
  .limit(3)
  .get()
  .then(qs => qs.docs.forEach(d => {
    const p = d.data();
    console.log(`Person: ${p.nome}, Qual: ${p.qualificacoes?.length || 0}, EC Records: ${p.educacaoContinuada?.length || 0}`);
  }));
```

**Evidence found:** ☐ 4/4 ☐ 2–3/4 ☐ <2/4

**Auditor notes:**

---

### Block D: Qualidade & Compliance (Highest Impact)

- [ ] **4.9 — NC identification:** Logged in `/naoConformidades`
- [ ] **4.10 — CAPA closure:** Actions assigned + effectiveness verified
- [ ] **4.12 — Continuous improvement:** KPI dashboard accessible (`analytics` module)
- [ ] **4.14.5 — Internal audit:** `/auditoria-interna` collection with checklist (Phase 0 skeleton)
- [ ] **4.14.6 — Risk management:** `/risks` FMEA matrix (Phase 0 skeleton)

**Evidence found:** ☐ 5/5 ☐ 3–4/5 ☐ <3/5

**Risk register entries:** _____ (Phase 0 baseline: ≥5 sample risks)

**Auditor notes:**

---

### Block G: Pós-Analítico & Laudos

- [ ] **4.15 — Critical values:** Detected + blocking (Art. 183 verified above)
- [ ] **4.16 — Laudo accuracy:** 14-field checklist (Art. 167 verified above)
- [ ] **4.17 — Lab Apoio linkage:** Laudo identifies third-party exams (Phase 0 skeleton)

**Evidence found:** ☐ 3/3 ☐ 2/3 ☐ <2/3

**Auditor notes:**

---

### DICQ Summary

**Total blocks verified:** _____ / 10

**Compliant blocks:** _____ 

**Partially compliant blocks:** _____

**Non-compliant blocks:** _____

**Overall DICQ score estimate:** _____ % (v1.3 baseline 78.5%, Phase 0 target 82%)

**Auditor conclusion:** ☐ ON TRACK for 88%+ target ☐ BELOW TARGET (document catch-up plan)

---

## C. LGPD Compliance — Articles 12, 18, 34

### Art. 12 (Privacy Notice)

- [ ] **Verify:** Privacy policy published and accessible
- [ ] **Where:** `docs/policies/POL-LGPD-001-v1.0.md`
- [ ] **Check:** Policy includes data types, purposes, retention, rights, contact info

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Auditor notes:**

---

### Art. 18 (Data Subject Rights)

- [ ] **Verify:** Data access/deletion/portability requests can be filed
- [ ] **Where:** `/labs/{labId}/lgpd-solicitacoes` collection
- [ ] **Check:** Test filing a data-access request; verify response within 15 days

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Test request filed:** ☐ Yes (date: _____) ☐ No

**Response received within 15d:** ☐ Yes ☐ No ☐ Pending

**Auditor notes:**

---

### Art. 34 (DPIA — Data Protection Impact Assessment)

- [ ] **Verify:** DPIA completed for high-risk processing
- [ ] **Where:** `docs/policies/IT-LGPD-DPIA-001-v1.1.md`
- [ ] **Check:** Risk matrix includes OCR (Gemini Vision), biometric auth, data retention
- [ ] **Verify:** Mitigations in place (e.g., encryption, access controls)

**DPIA risk assessment:**
- [ ] OCR processing risk analyzed
- [ ] Biometric auth risk analyzed
- [ ] Data retention risk analyzed
- [ ] Mitigations documented

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Auditor notes:**

---

### LGPD Summary

**Total LGPD articles verified:** _____ / 3

**Compliant:** _____

**Partially compliant:** _____

**Non-compliant:** _____

**Auditor conclusion:** ☐ PASS ☐ CONDITIONAL PASS ☐ FAIL

---

## D. Incident Disclosures & Preventive Controls

### ADR-0017: HMAC Baseline Reset (2026-05-07)

- [ ] **Verify:** ADR document exists and is disclosed
- [ ] **Where:** `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md`
- [ ] **Check:** Pre-rotation window (2026-04-22 → 2026-05-07) described; remediation documented
- [ ] **Verify:** Synthetic violation event exists in `audit-violations.chain-baseline-reset`
- [ ] **Check:** Post-rotation HMAC validator operational (scheduled job next 12h success)

**Query to verify synthetic event:**
```
db.collection('labs/test-lab-001/audit-violations')
  .where('type', '==', 'chain-baseline-reset')
  .limit(1)
  .get()
  .then(qs => console.log(qs.docs[0]?.data() || 'Not found'));
```

**Evidence found:** ☐ ADR disclosed ☐ Synthetic event logged ☐ Validator operational post-rotation

**Auditor assessment:** ☐ Acceptable disclosure + remediation ☐ Requires follow-up ☐ Non-conformance

**Auditor notes:**

---

### ADR-0018: Deploy Gate (Secret-Status Check)

- [ ] **Verify:** Preflight script exists and blocks unprovisioned secrets
- [ ] **Where:** `scripts/preflight-secrets-check.sh`
- [ ] **Check:** Script runs before `firebase deploy --only functions`
- [ ] **Run test:** Execute script against hmatologia2 project

**Test command:**
```bash
bash scripts/preflight-secrets-check.sh hmatologia2
# Expected: "✓ All 8 secrets provisioned" (or list of unprovisioned)
```

**Evidence found:** ☐ Script deployed ☐ Integrated into CI/CD ☐ Documentation in deploy-protocol.md

**Auditor assessment:** ☐ Preventive control adequate ☐ Needs improvement

**Auditor notes:**

---

## E. Testing & Operational Readiness

### Unit Tests

- [ ] **Verify:** 738/738 tests passing
- [ ] **Command:** `cd c:/hc quality && npm run test`
- [ ] **Check:** All modules represented

**Test summary:**
```
npm run test 2>&1 | tail -20
# Look for "738 passed" or similar count
```

**Result:** _____ tests passed / _____ failed

**Evidence found:** ☐ All passing ☐ Minor failures (<5) ☐ Major failures

**Auditor notes:**

---

### Smoke Tests (Post-Deploy)

- [ ] **Verify:** Critical workflows validated
- [ ] **Where:** `docs/SMOKE_TESTS_v1.3.md`
- [ ] **Check:** 5+ critical paths (login, CIQ run, laudo release, CAPA closure, EC enrollment)

**Evidence found:** ☐ Yes ☐ No ☐ Partial

**Auditor notes:**

---

### Cloud Logs Monitoring

- [ ] **Verify:** Post-deploy 24h monitoring active
- [ ] **Where:** Cloud Logs dashboard + `docs/CLOUD_LOGS_QUICK_REFERENCE.md`
- [ ] **Check:** Error rate <5%, no critical exceptions since 2026-05-07

**Sample query:**
```bash
gcloud logging read "severity=ERROR" --project hmatologia2 --limit 100 \
  --format="table(timestamp, labels.function_name, jsonPayload.message)" \
  --filter='timestamp>="2026-05-07T00:00:00Z"'
```

**Error count (24h post-deploy):** _____

**Critical errors:** ☐ None ☐ <5 ☐ ≥5 (document root causes)

**Auditor notes:**

---

## F. Auditor Sign-Off

### Audit Findings Summary

**Total items verified:** _____ / 115 (approx. 60% of DICQ 4.3 granular checklist)

**Compliant items:** _____

**Partially compliant items:** _____

**Non-compliant items:** _____

**Compliance percentage:** _____ % (benchmark: ≥80% for DICQ pre-audit, ≥100% for RDC 978 mandatory)

### Audit Conclusion

**Overall assessment:**
- ☐ **PASS** — Ready for DICQ pre-audit (2026-08-15)
- ☐ **CONDITIONAL PASS** — Pass with documented Phase X completion plan
- ☐ **FAIL** — Recommend rework before audit scheduling

### Corrective Actions Required (if any)

| Finding # | Standard | Description | Owner | Due Date | Evidence |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

### Auditor Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Lead Auditor** | _________________ | _________________ | _________ |
| **QMS Representative** | _________________ | _________________ | _________ |

---

## Appendices

### A. Key File Locations Reference

| Item | Path | Version |
|------|------|---------|
| Project CLAUDE.md | `c:/hc quality/CLAUDE.md` | Current |
| Full compliance audit | `docs/PHASE_3_COMPLIANCE_AUDIT.md` | 2026-05-07 |
| Executive summary | `docs/PHASE_3_COMPLIANCE_SUMMARY.md` | 2026-05-07 |
| RDC 978 map | `c:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md` | Current |
| DICQ map | `c:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` | 2026-05-07 |
| Checklist | `c:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Checklist_Auditoria.md` | Current |
| ADR-0017 | `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` | 2026-05-07 |
| ADR-0018 | `docs/adr/ADR-0018-deploy-gate-secret-status-check.md` | 2026-05-07 |
| Deploy gate script | `scripts/preflight-secrets-check.sh` | Current |
| LGPD Policy | `docs/policies/POL-LGPD-001-v1.0.md` | 2026-05-04 |
| LGPD DPIA | `docs/policies/IT-LGPD-DPIA-001-v1.1.md` | 2026-05-07 |

### B. Firestore Query Templates

```javascript
// List all CIQ runs (bioquimica)
db.collectionGroup('bioquimica')
  .where('createdAt', '>=', new Date('2026-05-01'))
  .limit(10)
  .get()

// Find non-conformances with linked CAPAs
db.collectionGroup('naoConformidades')
  .where('capaId', '!=', null)
  .limit(10)
  .get()

// Verify soft-delete (deleted records are hidden)
db.collectionGroup('documentos')
  .where('deletedAt', '!=', null)
  .limit(10)
  .get()
  .then(qs => console.log(`Soft-deleted docs: ${qs.size}`))

// Check shift supervisor presence
db.collectionGroup('turnos')
  .where('supervisorId', '!=', null)
  .limit(10)
  .get()
```

### C. Cloud Logs Commands

```bash
# Error rate past 24h
gcloud logging read "severity=ERROR" --project hmatologia2 --limit 1000 \
  --format="value(timestamp)" --filter='timestamp>="2026-05-06T00:00:00Z"' | wc -l

# Function performance
gcloud logging read "resource.type=cloud_function" --project hmatologia2 \
  --format="table(labels.function_name, jsonPayload.executionTime)" --limit 50

# Signature validation failures
gcloud logging read "jsonPayload.message=~'HMAC validation failed'" \
  --project hmatologia2 --limit 10
```

---

**Audit conducted:** ___________ (date)  
**Auditor:** ___________ (name/org)  
**Report finalized:** ___________ (date)
