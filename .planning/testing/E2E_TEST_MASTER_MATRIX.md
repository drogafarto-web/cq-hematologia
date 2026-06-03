---
document: E2E Test Master Matrix for v1.4 (Phases 4–15)
version: 1.0
created: 2026-05-07
updated: 2026-05-07
status: active
test_orchestrator: Testing Orchestrator (Wave 2–4 coordination)
---

# E2E Test Master Matrix for v1.4

**Purpose:** Consolidate all 96 E2E scenarios across Waves 2–4 (Phases 4–15) with execution schedule, dependencies, and quality gates.

**Total E2E Scenarios:** 96 (8 per phase × 12 phases)  
**Test Framework:** Playwright 1.40+  
**Test Data Provisioning:** Wave-chained (W2 → W3 → W4)  
**Quality Gate:** 100% pass rate per wave (32/32 E2E) before phase deploy  
**Reporting:** Slack + HTML reports + JSON metrics

---

## Executive Summary

| Wave      | Phases | Duration                | E2E Count | Target Pass | Deployment Gate     |
| --------- | ------ | ----------------------- | --------- | ----------- | ------------------- |
| Wave 1    | 1–3    | 2026-05-07 → 2026-05-19 | 5         | 5/5         | v1.3 close ✓        |
| Wave 2    | 4–7    | 2026-05-20 → 2026-06-16 | 32        | 32/32       | Pre-Phase-8         |
| Wave 3    | 8–11   | 2026-06-17 → 2026-07-28 | 32        | 32/32       | Pre-Phase-12        |
| Wave 4    | 12–15  | 2026-07-29 → 2026-08-31 | 32        | 32/32       | Pre-Launch          |
| **TOTAL** | —      | —                       | **96**    | **96/96**   | **Ready for audit** |

---

## Wave 1 (Phases 1–3): Baseline — ✅ COMPLETE

> **Status:** 2026-05-07. Smoke test suite (19/19 flows) verified on Riopomba. Cloud Logs clean. No regressions from Phase 0 deploy.

| Phase | Scenario | Flow                                         | Type  | Expected        | Owner   | Status |
| ----- | -------- | -------------------------------------------- | ----- | --------------- | ------- | ------ |
| 1     | W1-S1    | **Smoke:** Login + Hub Navigation            | smoke | 100% PASS       | QA Lead | ✓      |
| 1     | W1-S2    | **Smoke:** CIQ Module Load (Imuno)           | smoke | 0 errors        | QA Lead | ✓      |
| 2     | W1-S3    | **Smoke:** REQ verification (doc link check) | smoke | All links alive | QA Lead | ✓      |
| 3     | W1-S4    | **Smoke:** Firestore index health            | smoke | <200ms query    | DevOps  | ✓      |
| 3     | W1-S5    | **Smoke:** Rules audit (deploy gate)         | smoke | 0 security gaps | SecOps  | ✓      |

---

## Wave 2 (Phases 4–7): CAPA + Portal Phase 1

**Execution Window:** 2026-05-20 → 2026-06-16 (28 days, 4 phases)  
**Parallel Streams:** Phases 4 & 5 in parallel; Phase 6 after Phase 5; Phase 7 after Phase 6  
**Test Data Chain:** Inherit v1.3 Riopomba users + add W2 test fixtures  
**Quality Gate:** All 32 E2E PASS before Phase 8 deploy (2026-06-17)

### Phase 4: CAPA Closure & Process Execution

**Duration:** 2026-05-20 → 2026-05-27 (8 days)  
**Theme:** CAPA workflow (finding → plan → execution → auditor sign-off)  
**E2E Count:** 8 scenarios

| ID        | Scenario                   | Flow                               | Precondition                           | Steps                                                                                                   | Expected                            | Owner    | Deployed   |
| --------- | -------------------------- | ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- | ---------- |
| **P4-S1** | CAPA Creation              | Finding → Root cause → Plan        | logged in; lab settings; auditor email | 1. Open CAPA form; 2. Select finding; 3. Enter RCA; 4. Create 3-step plan; 5. Submit                    | CAPA created, email sent to auditor | Eng-W2-A | 2026-05-27 |
| **P4-S2** | CAPA Plan Review           | Auditor feedback loop              | CAPA created (P4-S1)                   | 1. Login as auditor; 2. Receive email; 3. Open CAPA; 4. Review plan; 5. Add comment/request change      | Comment visible to owner            | Eng-W2-A | 2026-05-27 |
| **P4-S3** | CAPA Execution Log         | Operator records progress          | CAPA in "under review"                 | 1. Owner logs in; 2. Navigate to CAPA; 3. Record execution step 1; 4. Upload evidence (PDF/image)       | Evidence timestamped + audit trail  | Eng-W2-A | 2026-05-27 |
| **P4-S4** | CAPA Effectiveness Check   | Post-execution validation          | All 3 steps logged + evidence          | 1. Owner submits effectiveness check; 2. Select QC batch proving fix                                    | Status → "closed pending approval"  | Eng-W2-A | 2026-05-27 |
| **P4-S5** | Auditor Sign-Off           | Final approval gate                | CAPA fully executed                    | 1. Auditor receives notification; 2. Reviews execution + evidence; 3. Approves or requests rework       | CAPA → "closed" + timestamp         | Eng-W2-A | 2026-05-27 |
| **P4-S6** | CAPA Metrics Report        | Compliance dashboard               | 5+ CAPAs closed in this phase          | 1. Manager navigates to CAPA dashboard; 2. Filter by date range; 3. View avg closure time + trending    | Dashboard shows 5 closed, SLA met   | Eng-W2-A | 2026-05-27 |
| **P4-S7** | CAPA Rollback (Regression) | If auditor rejects, owner re-opens | CAPA in "closed"                       | 1. Auditor reopens CAPA; 2. Adds rejection reason; 3. Owner receives notification; 4. Re-executes steps | Status → "under review" again       | QA-W2    | 2026-05-27 |
| **P4-S8** | CAPA Data Integrity        | Soft delete + audit trail          | 5 CAPAs created + closed               | 1. Verify all records in Firestore; 2. Check soft delete flag; 3. Verify signatures match               | No hard deletes, all signed         | SecOps   | 2026-05-27 |

---

### Phase 5: Patient Portal Phase 1 (Laudo Download + Portal Access)

**Duration:** 2026-05-20 → 2026-06-02 (14 days)  
**Theme:** Patient-facing portal (laudo access, basic profile)  
**E2E Count:** 8 scenarios  
**Parallel with Phase 4**

| ID        | Scenario                      | Flow                                   | Precondition                              | Steps                                                                                                | Expected                                          | Owner     | Deployed   |
| --------- | ----------------------------- | -------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------- | ---------- |
| **P5-S1** | Patient Portal Registration   | Patient self-signup                    | email + phone + CPF valid                 | 1. Navigate to patient portal; 2. Click "Criar Conta"; 3. Enter email/CPF/phone; 4. Verify OTP       | Account created, dashboard loads                  | Eng-W2-B  | 2026-06-02 |
| **P5-S2** | Laudo Download                | Patient retrieves result               | Patient logged in; 1+ laudo available     | 1. Navigate to "Meus Laudos"; 2. Select laudo by date; 3. Click "Baixar PDF"                         | PDF downloads, signature valid                    | Eng-W2-B  | 2026-06-02 |
| **P5-S3** | Portal Branding Customization | Lab sets portal colors/logo            | portal-configuracao doc created (Phase 3) | 1. Admin navigates to Portal Settings; 2. Upload logo; 3. Set primary color; 4. Save                 | Logo appears on patient portal within 2m          | Eng-W2-B  | 2026-06-02 |
| **P5-S4** | Laudo Sharing Link            | Patient generates share-to-doctor link | Laudo available                           | 1. Patient opens laudo; 2. Click "Compartilhar"; 3. Generate link; 4. Send via email                 | Link valid for 30 days, doctor can view read-only | Eng-W2-B  | 2026-06-02 |
| **P5-S5** | Portal Access Control         | Only lab members can enable portal     | Patient portal enabled = feature flag     | 1. Lab without portal feature disabled; 2. Patient tries signup; 3. Should redirect to "unavailable" | Portal disabled shows "coming soon"               | Eng-W2-B  | 2026-06-02 |
| **P5-S6** | Laudo Search & Filter         | Patient filters laudos by date range   | 10+ laudos for test patient               | 1. Navigate to "Meus Laudos"; 2. Select date range; 3. Filter by analyte                             | Results filtered <500ms, 0 false positives        | Eng-W2-B  | 2026-06-02 |
| **P5-S7** | Mobile Responsive Portal      | Portal works on phone/tablet           | Mobile device or responsive emulation     | 1. Open portal on mobile (375px width); 2. Login; 3. Download laudo; 4. Check responsiveness         | All flows work, text readable, buttons tappable   | QA-Mobile | 2026-06-02 |
| **P5-S8** | Portal Audit Trail            | Every patient access logged            | Patient opens portal                      | 1. Patient logs in; 2. Views laudo; 3. Checks audit logs (admin view)                                | Timestamp + IP + action visible in /laudos-audit  | SecOps    | 2026-06-02 |

---

### Phase 6: Critical Values Escalation & Notifications

**Duration:** 2026-06-03 → 2026-06-09 (7 days)  
**Theme:** SMS/email alerts for critical values, SLA tracking  
**E2E Count:** 8 scenarios  
**Dependency:** Phase 5 complete (portal data available)

| ID        | Scenario                    | Flow                                             | Precondition                              | Steps                                                                                                        | Expected                                             | Owner    | Deployed   |
| --------- | --------------------------- | ------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------- | ---------- |
| **P6-S1** | Critical Value SMS Alert    | System detects critical analyte, sends SMS       | CIQ result = critical; SMS gateway active | 1. Enter CIQ result for analyte (e.g., glucose <40); 2. System detects critical; 3. Triggers callable        | SMS sent to operator within 5s                       | Eng-W2-C | 2026-06-09 |
| **P6-S2** | Critical Value Email to RT  | RT notified of critical result                   | CIQ result critical; RT on-call config    | 1. Critical result entered; 2. System queries on-call RT; 3. Sends email                                     | Email in RT inbox <10s, includes result + patient    | Eng-W2-C | 2026-06-09 |
| **P6-S3** | Escalation SLA Tracking     | System logs time-to-acknowledgment               | Critical value sent                       | 1. Escalation created; 2. RT receives email; 3. RT logs acknowledgment in app; 4. Check SLA timer            | SLA timer stops, total time <30min flagged yellow    | Eng-W2-C | 2026-06-09 |
| **P6-S4** | Multiple Escalation Levels  | If no RT response in 15m, escalate to supervisor | Critical value + no RT ack after 15m      | 1. Critical value sent; 2. Wait 15m; 3. System escalates to supervisor; 4. Check email                       | Supervisor receives email + SMS backup               | Eng-W2-C | 2026-06-09 |
| **P6-S5** | Escalation Dashboard        | Manager sees all critical values + SLA status    | 5+ critical values in criticos-escalacoes | 1. Manager opens Críticos Dashboard; 2. View 5 items; 3. Filter by SLA status                                | Dashboard loads <2s, shows SLA red/yellow/green      | Eng-W2-C | 2026-06-09 |
| **P6-S6** | Critical Value Deescalation | After RT confirms patient stable, mark resolved  | Critical value escalated                  | 1. RT logs "patient stable"; 2. Uploads confirmation (e.g., repeat glucose normal); 3. Marks resolved        | Escalation closed, marked as "resolved", audit trail | Eng-W2-C | 2026-06-09 |
| **P6-S7** | SMS Template Customization  | Lab customizes SMS text                          | Lab admin logged in                       | 1. Admin navigates to SMS templates; 2. Edits critical value message; 3. Saves; 4. System uses new template  | Next critical value uses custom SMS                  | Eng-W2-C | 2026-06-09 |
| **P6-S8** | Escalation Audit Trail      | All escalations + acks logged with signatures    | 5+ escalations created                    | 1. Query criticos-escalacoes collection; 2. Verify all docs have timestamps + operatorId; 3. Hash validation | All escalations signed, Firestore immutable          | SecOps   | 2026-06-09 |

---

### Phase 7: Satisfação/Feedback Portal Integration

**Duration:** 2026-06-10 → 2026-06-16 (7 days)  
**Theme:** NPS + feedback form collection, linked to patient portal  
**E2E Count:** 8 scenarios  
**Dependency:** Phase 5 complete (patient login works)

| ID        | Scenario                         | Flow                                         | Precondition                        | Steps                                                                                                     | Expected                                         | Owner    | Deployed   |
| --------- | -------------------------------- | -------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------- | ---------- |
| **P7-S1** | NPS Survey on Patient Portal     | Patient sees NPS prompt after laudo download | Patient logged in, laudo downloaded | 1. Patient downloads laudo; 2. Modal "How satisfied? 0-10"; 3. Selects 8; 4. Submits                      | Score saved to reclamacoes collection            | Eng-W2-D | 2026-06-16 |
| **P7-S2** | Feedback Form Submission         | Patient adds comment if NPS ≤6               | Patient selected NPS ≤6             | 1. After score, form expands; 2. Enter text "results unclear"; 3. Submit                                  | Comment + score + timestamp saved                | Eng-W2-D | 2026-06-16 |
| **P7-S3** | Feedback Dashboard for Lab       | Lab manager reviews all feedback             | 10+ feedback entries created        | 1. Manager navigates to Feedback Dashboard; 2. View table of NPS + comments; 3. Filter by date/score      | Dashboard shows 10 entries, sortable, <500ms     | Eng-W2-D | 2026-06-16 |
| **P7-S4** | Feedback-to-NC Workflow          | Score ≤4 auto-creates NC                     | Patient submits NPS = 3 + comment   | 1. Feedback submitted; 2. System detects NPS ≤4; 3. Creates NC (origin: "satisfacao")                     | NC visible in quality module, linked to feedback | Eng-W2-D | 2026-06-16 |
| **P7-S5** | NPS Trend Report                 | Monthly NPS graph shown                      | 30+ feedback entries over 4 weeks   | 1. Manager opens Analytics → NPS; 2. View monthly trend; 3. Export to PDF                                 | Trend line drawn, current month avg calculated   | Eng-W2-D | 2026-06-16 |
| **P7-S6** | Feedback Anonymity Option        | Patient can submit feedback anonymously      | Patient logged in                   | 1. Uncheck "show my name"; 2. Submit feedback; 3. Admin views feedback                                    | Feedback visible, but "Patient ID" hidden        | Eng-W2-D | 2026-06-16 |
| **P7-S7** | Satisfaction Survey Link (Email) | Lab sends standalone NPS link to patients    | Lab admin config complete           | 1. Admin generates NPS link; 2. Sends via email to patient list; 3. Patient clicks link; 4. Submits score | Score recorded, linked to patient by phone/CPF   | Eng-W2-D | 2026-06-16 |
| **P7-S8** | Feedback Data Integrity          | All feedback signed + immutable              | 10+ feedback entries                | 1. Verify all reclamacoes docs have signatures; 2. Attempt to edit past feedback; 3. System blocks        | No edits allowed, soft-delete only, audit trail  | SecOps   | 2026-06-16 |

---

## Wave 2 Summary

| Phase        | E2E Count | Pass Rate Target | Owner    | Deploy Date | Gate Status          |
| ------------ | --------- | ---------------- | -------- | ----------- | -------------------- |
| **Phase 4**  | 8         | 8/8 (100%)       | Stream A | 2026-05-27  | Pre-Phase-8          |
| **Phase 5**  | 8         | 8/8 (100%)       | Stream B | 2026-06-02  | Pre-Phase-8          |
| **Phase 6**  | 8         | 8/8 (100%)       | Stream C | 2026-06-09  | Pre-Phase-8          |
| **Phase 7**  | 8         | 8/8 (100%)       | Stream D | 2026-06-16  | Pre-Phase-8          |
| **TOTAL W2** | **32**    | **32/32**        | —        | —           | **Pre-Phase-8 gate** |

**Quality Gate Trigger:** Phase 8 (NOTIVISA) cannot start until all 32 E2E PASS on production-like staging (Riopomba).

---

## Wave 3 (Phases 8–11): NOTIVISA + Documentation + IA Foundation

**Execution Window:** 2026-06-17 → 2026-07-28 (42 days, 4 phases)  
**Test Data Chain:** Inherit W2 + add NOTIVISA test sandbox credentials + IA dataset fixtures  
**Quality Gate:** All 32 E2E PASS before Phase 12 deploy (2026-07-29)  
**Parallel Streams:** Phases 8 & 9 in parallel; Phases 10 & 11 parallel after 8

### Phase 8: NOTIVISA Integration & Portaria 204 Compliance

**Duration:** 2026-06-17 → 2026-06-30 (14 days)  
**Theme:** NOTIVISA Art. 6º §1 outbound queue, mock government response  
**E2E Count:** 8 scenarios  
**Dependencies:** Phase 3 (schema ready), Phase 4 (CAPA flow working)

| ID        | Scenario                         | Flow                                                        | Precondition                                | Steps                                                                                                | Expected                                                            | Owner    | Deployed   |
| --------- | -------------------------------- | ----------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- | ---------- |
| **P8-S1** | NOTIVISA Payload Formatting      | System formats CIQ result → NOTIVISA structure              | CIQ result created (bioquímica module)      | 1. Enter CIQ glucose result (150 mg/dL); 2. System formats XML per Art. 6º §1; 3. Validate structure | XML matches NOTIVISA schema, no validation errors                   | Eng-W3-A | 2026-06-30 |
| **P8-S2** | NOTIVISA Queue Creation          | Payload staged in notivisa-outbox                           | CIQ result analyzed                         | 1. Check Firestore notivisa-outbox collection; 2. Find entry for test result                         | Queue entry created, status = "pending"                             | Eng-W3-A | 2026-06-30 |
| **P8-S3** | NOTIVISA Delivery (Mock Gov API) | Mock government response, success path                      | notivisa-outbox entry ready                 | 1. Run callable `notivisaSubmit()`; 2. Mock API returns 200 + receipt ID; 3. Check queue             | Queue entry → status = "delivered", receipt saved                   | Eng-W3-A | 2026-06-30 |
| **P8-S4** | NOTIVISA Retry on Failure        | Gov API timeout → automatic retry (3x)                      | Mock API returns 500                        | 1. Call `notivisaSubmit()`; 2. First attempt fails; 3. System retries after 5m; 4. Check retry count | retry_count increments, eventual delivery (mock succeeds)           | Eng-W3-A | 2026-06-30 |
| **P8-S5** | NOTIVISA Rollback                | Operator can unsubmit if needed (retract alert)             | notivisa-outbox delivered, result incorrect | 1. Admin navigates to submitted entry; 2. Clicks "Retract"; 3. System calls NOTIVISA retract API     | Status → "retracted", audit log created                             | Eng-W3-A | 2026-06-30 |
| **P8-S6** | NOTIVISA Compliance Report       | Lab generates monthly NOTIVISA submission report            | 50+ submissions in NOTIVISA                 | 1. Manager navigates to Reports → NOTIVISA; 2. Select June; 3. Export PDF                            | Report shows 50 entries, all with status + timestamp, RDC compliant | Eng-W3-A | 2026-06-30 |
| **P8-S7** | NOTIVISA Schema Evolution        | New analyte added, system auto-includes in NOTIVISA payload | New analyte "troponina" registered          | 1. Admin adds troponina to analytes; 2. Enter CIQ result; 3. Check NOTIVISA XML                      | troponina field included in payload, validates                      | Eng-W3-A | 2026-06-30 |
| **P8-S8** | NOTIVISA Audit Trail             | Every submission + retraction signed + immutable            | 50+ notivisa-outbox entries                 | 1. Sample 5 entries; 2. Verify signatures (hash + operatorId + ts); 3. Attempt to edit               | All signed, no edits possible, soft delete only                     | SecOps   | 2026-06-30 |

---

### Phase 9: Documentation Hardening (DICQ Blocks A, D, E)

**Duration:** 2026-06-17 → 2026-07-07 (21 days)  
**Theme:** Expand SGD module (list master, document versioning, distribution)  
**E2E Count:** 8 scenarios  
**Parallel with Phase 8**

| ID        | Scenario                          | Flow                                                     | Precondition                              | Steps                                                                                    | Expected                                                 | Owner    | Deployed   |
| --------- | --------------------------------- | -------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------- | ---------- |
| **P9-S1** | Import List Master from Excel     | Lab uploads document registry (DICQ 4.3)                 | Excel file with 80 rows (MQ/PQ/IT/FR/POL) | 1. Navigate to SGD → List Master; 2. Click "Import"; 3. Upload Excel; 4. Confirm mapping | 80 documents imported, all indexed, no duplicates        | Eng-W3-B | 2026-07-07 |
| **P9-S2** | Document Versioning Workflow      | Draft → Review → Approved → Obsolete                     | MQ-01 document created                    | 1. Create draft doc; 2. Submit for review; 3. Reviewer approves; 4. Check version = 1.0  | Status "vigente", signature visible, version immutable   | Eng-W3-B | 2026-07-07 |
| **P9-S3** | Document Distribution List        | Assign doc to departments/roles                          | MQ-01 approved                            | 1. Edit distribution; 2. Select "Bancada", "RH", "Diretoria"; 3. Save                    | 3 recipients assigned, can generate distribution proof   | Eng-W3-B | 2026-07-07 |
| **P9-S4** | Document Obsolescence Workflow    | Mark old version obsolete when new approved              | MQ-01 v1.0 live, v2.0 submitted           | 1. Approve v2.0; 2. System auto-marks v1.0 obsolete; 3. Check v1.0 status                | v1.0 → "obsoleto", no longer downloadable (archive only) | Eng-W3-B | 2026-07-07 |
| **P9-S5** | Distribution Proof PDF            | Generate proof that doc was distributed to recipients    | MQ-01 distributed to 3 depts              | 1. Select MQ-01; 2. Click "Comprovante de Distribuição"; 3. Download PDF                 | PDF shows recipients, dates received, signatures         | Eng-W3-B | 2026-07-07 |
| **P9-S6** | List Master Hierarchy Rendering   | Visual tree of document structure (DICQ 4.3 requirement) | 80 docs imported with category codes      | 1. Open List Master view; 2. Expand MQ section; 3. Check tree structure                  | Hierarchy renders 4+ levels, collapsible, sorted         | Eng-W3-B | 2026-07-07 |
| **P9-S7** | Document Access Audit             | Every download/view logged with user + timestamp         | Operator downloads MQ-01                  | 1. Operator opens MQ-01; 2. Checks audit logs (admin view); 3. Verify timestamp          | Download logged in /sgd/{docId}/audit, signed            | Eng-W3-B | 2026-07-07 |
| **P9-S8** | Document Immutability Enforcement | Approved/Obsolete docs read-only, no edits               | MQ-01 approved (v1.0)                     | 1. Attempt to edit text field; 2. System blocks; 3. Try to delete                        | "Document is approved - no edits allowed" message        | SecOps   | 2026-07-07 |

---

### Phase 10: Multi-Equipment CIQ + Analyte Expansion

**Duration:** 2026-07-08 → 2026-07-21 (14 days)  
**Theme:** Support for multiple analytical equipments running same/different analytes  
**E2E Count:** 8 scenarios  
**Dependency:** Phase 8 (NOTIVISA ready), Phase 3 (schema supports)

| ID         | Scenario                                     | Flow                                                      | Precondition                                       | Steps                                                                                                           | Expected                                                   | Owner    | Deployed   |
| ---------- | -------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- | ---------- |
| **P10-S1** | Equipment Registry with Analytes             | Add Analyzer B (Roche Cobas), link analytes               | Analyzer A (Siemens) already exists                | 1. Navigate to Equipamentos; 2. Click "Novo Equipamento"; 3. Enter "Cobas"; 4. Assign glucose, creatinine, ALT  | Equipment created, 3 analytes linked                       | Eng-W3-C | 2026-07-21 |
| **P10-S2** | CIQ Result by Equipment                      | Operator logs CIQ for Analyzer B                          | Analyzer B registered + analytes assigned          | 1. Select equipment = Cobas; 2. Enter CIQ glucose result (180); 3. Submit                                       | Result tagged equipment_id, appears in equipment dashboard | Eng-W3-C | 2026-07-21 |
| **P10-S3** | Equipment-Specific QC Rules                  | Analyzer A uses CLSI, Analyzer B uses Westgard            | Both equipped registered                           | 1. Admin assigns QC rule: Analyzer A → CLSI, Analyzer B → Westgard; 2. Enter results                            | Analyzer A evaluated vs CLSI, Analyzer B vs Westgard rules | Eng-W3-C | 2026-07-21 |
| **P10-S4** | Equipment Performance Comparison             | Dashboard shows drift per equipment                       | 20+ CIQ results per equipment                      | 1. Manager opens Equipment Dashboard; 2. Select metric "drift %"; 3. Compare A vs B                             | Sparkline shows trend per equipment, <500ms                | Eng-W3-C | 2026-07-21 |
| **P10-S5** | Cross-Equipment Analyte Averaging            | When same analyte on 2 equipments, show parallel results  | Glucose on Analyzer A + Analyzer B, same QC batch  | 1. Enter glucose CIQ for A; 2. Enter glucose CIQ for B; 3. View results                                         | Both visible, can compare % difference, flag if >5%        | Eng-W3-C | 2026-07-21 |
| **P10-S6** | Equipment Maintenance Alert                  | Calibration overdue → equipment quarantine                | Analyzer B calibration 35d old                     | 1. System detects overdue; 2. Sends alert; 3. Flags equipment "out of service"; 4. Operator acks                | Equipment marked out-of-service, new CIQ blocked           | Eng-W3-C | 2026-07-21 |
| **P10-S7** | Analyte Expansion (New Analyte Registration) | Add "testosterone" as new analyte to Analyzer B           | Analyzer B exists, testosterone not yet registered | 1. Navigate to Analytes; 2. Click "Novo Analito"; 3. Enter testosterone, units (ng/dL); 4. Assign to Analyzer B | New analyte searchable, CIQ form includes testosterone     | Eng-W3-C | 2026-07-21 |
| **P10-S8** | Equipment Data Integrity                     | All equipment records + CIQ linked to equipment immutable | 50+ equipment records, 200+ CIQ entries            | 1. Sample 10 CIQ by equipment; 2. Verify equipment_id immutable; 3. Check signatures                            | All equipment CIQ signed, equipment refs immutable         | SecOps   | 2026-07-21 |

---

### Phase 11: IA Foundation — Strip OCR Classification Prep

**Duration:** 2026-07-22 → 2026-07-28 (7 days)  
**Theme:** IA dataset collection, image upload, Gemini Vision integration setup (no live classification yet)  
**E2E Count:** 8 scenarios  
**Parallel with Phase 10**

| ID         | Scenario                              | Flow                                                                | Precondition                         | Steps                                                                                                         | Expected                                                                        | Owner    | Deployed   |
| ---------- | ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------- |
| **P11-S1** | Strip Image Upload                    | Operator uploads immunology strip photo to imuno-ias-dev            | Operator logged in; camera available | 1. Navigate to IA Dashboard; 2. Click "Upload Strip Image"; 3. Take/select photo; 4. Submit                   | Image stored in imuno-ias-dev, metadata saved (date, operator)                  | Eng-W3-D | 2026-07-28 |
| **P11-S2** | Gemini Vision Mock Integration        | System calls Gemini API (mocked), returns classification            | Strip image uploaded                 | 1. Trigger callable `geminiClassifyStrip(imageUrl)`; 2. Mock API returns {analyte: "hCG", result: "positive"} | Response logged, no actual classification stored yet                            | Eng-W3-D | 2026-07-28 |
| **P11-S3** | IA Dataset Aggregation                | View all uploaded images grouped by analyte/operator                | 20+ images uploaded over 2 weeks     | 1. Admin navigates to IA → Dataset; 2. Filter by analyte; 3. View grid of thumbnails                          | 20 images visible, filterable by analyte + operator                             | Eng-W3-D | 2026-07-28 |
| **P11-S4** | Strip Classification Confidence Score | Gemini returns confidence (0-1), store for training                 | Mock Gemini response received        | 1. Upload strip; 2. Gemini returns {result: "positive", confidence: 0.94}; 3. Check storage                   | Confidence logged in imuno-ias-dev record                                       | Eng-W3-D | 2026-07-28 |
| **P11-S5** | Human Verification UI                 | Operator can confirm/correct Gemini classification (feedback loop)  | Gemini classification received       | 1. Operator reviews Gemini's "positive" result; 2. Corrects to "negative"; 3. Submits correction              | Correction stored as training label (not impacting live results)                | Eng-W3-D | 2026-07-28 |
| **P11-S6** | IA Training Dataset Export            | Generate labeled dataset for model training (for v1.5)              | 50+ images with confirmations        | 1. Admin navigates to IA → Export; 2. Select date range; 3. Export as JSON + image ZIP                        | JSON contains {imageId, url, label, confidence, correction}, ready for training | Eng-W3-D | 2026-07-28 |
| **P11-S7** | Strip Metadata Capture                | Extraction of technical specs (reagent lot, expiry, operator notes) | Strip image uploaded                 | 1. Operator optionally enters: reagent lot, batch code, operator notes; 2. System stores with image           | Metadata queried alongside image, filterable                                    | Eng-W3-D | 2026-07-28 |
| **P11-S8** | IA Data Integrity                     | All IA dataset entries immutable, signed with operator              | 50+ IA entries created               | 1. Sample 5 entries; 2. Verify operatorId + timestamp; 3. Attempt to edit                                     | All IA entries signed, immutable, audit trail complete                          | SecOps   | 2026-07-28 |

---

## Wave 3 Summary

| Phase        | E2E Count | Pass Rate Target | Owner    | Deploy Date | Gate Status           |
| ------------ | --------- | ---------------- | -------- | ----------- | --------------------- |
| **Phase 8**  | 8         | 8/8 (100%)       | Stream A | 2026-06-30  | Pre-Phase-12          |
| **Phase 9**  | 8         | 8/8 (100%)       | Stream B | 2026-07-07  | Pre-Phase-12          |
| **Phase 10** | 8         | 8/8 (100%)       | Stream C | 2026-07-21  | Pre-Phase-12          |
| **Phase 11** | 8         | 8/8 (100%)       | Stream D | 2026-07-28  | Pre-Phase-12          |
| **TOTAL W3** | **32**    | **32/32**        | —        | —           | **Pre-Phase-12 gate** |

**Quality Gate Trigger:** Phase 12 (Performance Audit) cannot start until all 32 E2E PASS.

---

## Wave 4 (Phases 12–15): Performance + Security + Launch

**Execution Window:** 2026-07-29 → 2026-08-31 (34 days, 4 phases)  
**Test Data Chain:** Inherit W3 + add production-like load (500+ CIQ records, 100+ patients)  
**Quality Gate:** All 32 E2E PASS + smoke tests (19/19) + NO P0 security findings before launch  
**Parallel Streams:** Phases 12–13 parallel; Phase 14–15 sequential (14 → 15)

### Phase 12: Performance Audit & Web Vitals Compliance

**Duration:** 2026-07-29 → 2026-08-10 (13 days)  
**Theme:** Load testing, bundle analysis, Lighthouse audits, LCP/INP/CLS optimization  
**E2E Count:** 8 scenarios (performance-focused)

| ID         | Scenario                       | Flow                                                                      | Precondition                                    | Steps                                                                           | Expected                                             | Owner     | Deployed   |
| ---------- | ------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- | --------- | ---------- |
| **P12-S1** | Dashboard Load Performance     | CIQ Dashboard loads <2s on 4G                                             | 500+ CIQ records in DB, Firestore indexes ready | 1. Open CIQ Dashboard on 4G (simulated); 2. Measure LCP; 3. Check Web Vitals    | LCP <2.5s, INP <200ms, CLS <0.1                      | Eng-W4-A  | 2026-08-10 |
| **P12-S2** | Analytics Export (500 records) | Export 500 CIQ results to Excel <15s                                      | 500 CIQ records, xlsx library ready             | 1. Select all 500 records; 2. Click "Export"; 3. Time download                  | Excel downloaded <15s, file valid                    | Eng-W4-A  | 2026-08-10 |
| **P12-S3** | Firestore Query Optimization   | Multi-filter query (equipment + analyte + date) <500ms                    | 500+ CIQ records, indexes deployed              | 1. Filter dashboard by 3 dimensions; 2. Measure query time                      | Query returns <500ms (indexed path validated)        | Eng-W4-A  | 2026-08-10 |
| **P12-S4** | Bundle Size Audit              | Main bundle.js ≤380 KB gzip                                               | Latest build completed                          | 1. Run `npm run build`; 2. Check dist/assets/main-\*.js size                    | Main bundle ≤380 KB gzip, no regressions vs Phase 3  | Eng-W4-A  | 2026-08-10 |
| **P12-S5** | Code Splitting by Route        | Each route chunk ≤100 KB gzip                                             | All routes use React.lazy                       | 1. Run build; 2. Inspect dist/assets chunks; 3. Verify largest <100 KB          | Largest route chunk <100 KB, all lazy-loaded         | Eng-W4-A  | 2026-08-10 |
| **P12-S6** | Mobile Performance (Phone)     | Performance on iPhone 12 (WiFi + 4G)                                      | Mobile device available                         | 1. Open app on iPhone 12 WiFi; 2. Measure LCP + INP; 3. Repeat on 4G            | LCP <2.5s WiFi, <3.5s 4G; INP <200ms                 | QA-Mobile | 2026-08-10 |
| **P12-S7** | Lighthouse Audit               | Lighthouse score ≥90 (Performance + Accessibility + SEO + Best Practices) | Production build                                | 1. Run `lighthouse https://hmatologia2.web.app --view`; 2. Check scores         | All ≥90, report PDF exported                         | QA-Perf   | 2026-08-10 |
| **P12-S8** | Web Vitals Baseline Capture    | Document current LCP/INP/CLS for audit trail                              | Staging environment                             | 1. Run synthetic monitoring; 2. Capture 100 pageloads; 3. Calculate P50/P95/P99 | Baseline logged: LCP P95 <2.5s, INP <200ms, CLS <0.1 | Eng-W4-A  | 2026-08-10 |

---

### Phase 13: DICQ Final Audit + Compliance Closure

**Duration:** 2026-08-11 → 2026-08-20 (10 days)  
**Theme:** Comprehensive DICQ block validation, RDC 978 coverage gap closure  
**E2E Count:** 8 scenarios (compliance-focused)  
**Parallel with Phase 12**

| ID         | Scenario                            | Flow                                                 | Precondition                                | Steps                                                                                                | Expected                                           | Owner   | Deployed   |
| ---------- | ----------------------------------- | ---------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------- | ---------- |
| **P13-S1** | DICQ Block A Validation             | Review Requirements traceability (Blocks A1–A6)      | All requirements documented                 | 1. Auditor cross-references REQUIREMENTS.md with code; 2. Spot-check 5 key reqs                      | 100% traced, evidence links valid                  | Auditor | 2026-08-20 |
| **P13-S2** | DICQ Block B Validation             | Organization + Management (Blocks B1–B9)             | Org chart + delegation docs finalized       | 1. Auditor reviews sgq/MQ + pops + role assignments; 2. Verify delegation                            | 100% evidence of management commitment             | Auditor | 2026-08-20 |
| **P13-S3** | DICQ Block C Validation             | Personnel (Blocks C1–C10)                            | Dossiê module complete (Phase 2 equivalent) | 1. Auditor reviews 3 staff dossiês; 2. Check training + competency; 3. Verify qualifications         | 100% personnel have evidenced training + signature | Auditor | 2026-08-20 |
| **P13-S4** | DICQ Block D Validation             | Infrastructure + Facilities (Blocks D1–D8)           | Biossegurança + equipment records complete  | 1. Auditor walks through facilities; 2. Verifies equipment registration; 3. Checks ISO 14644 records | 100% equipment calibrated, areas classified        | Auditor | 2026-08-20 |
| **P13-S5** | DICQ Block E Validation             | Quality System (Blocks E1–E15)                       | KPI dashboard + CIQ + CEQ modules live      | 1. Auditor reviews dashboard + trend reports; 2. Checks control rules (Westgard, Levey-Jennings)     | 100% KPI monitored, CIQ/CEQ evidence complete      | Auditor | 2026-08-20 |
| **P13-S6** | RDC 978 Critical Articles Checklist | Validate 25+ critical RDC articles fully implemented | All Phase 4–12 features deployed            | 1. Auditor cross-checks Arts. 117, 167, 179-191, 204; 2. Verify evidence in system                   | 100% critical articles covered, signed-off         | Auditor | 2026-08-20 |
| **P13-S7** | CAPA Closure Verification           | All 12 Phase 0 findings closed + auditor approved    | CAPAs complete via Phase 4                  | 1. Auditor reviews CAPA register; 2. Spot-check 5 closed CAPAs; 3. Verify effectiveness              | 12/12 closed, evidence of effectiveness, signed    | Auditor | 2026-08-20 |
| **P13-S8** | Compliance Certification Sign-Off   | Auditor pre-signs "ready for external audit" memo    | All prior 7 checks pass                     | 1. Auditor completes checklist; 2. Generates pre-audit memo; 3. CTO signs acknowledgment             | Memo filed, v1.4 "audit ready" declared            | Auditor | 2026-08-20 |

---

### Phase 14: Pre-Launch Security & Stability

**Duration:** 2026-08-21 → 2026-08-25 (5 days)  
**Theme:** Security audit, penetration test prep, final regression suite  
**E2E Count:** 8 scenarios (security/stability-focused)  
**Dependency:** Phase 13 compliance sign-off

| ID         | Scenario                               | Flow                                                     | Precondition                   | Steps                                                                                                  | Expected                                            | Owner    | Deployed   |
| ---------- | -------------------------------------- | -------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------- | ---------- |
| **P14-S1** | SQL Injection Resistance               | Test payloads against all input fields                   | All input fields available     | 1. Attempt SQL injection in search fields; 2. Verify parameterized queries; 3. Check Firestore rules   | 0 injections possible, all inputs sanitized         | SecOps   | 2026-08-25 |
| **P14-S2** | XSS Vulnerability Scan                 | Test DOM sanitization + CSP headers                      | Staging app deployed           | 1. Run OWASP ZAP scanner; 2. Check CSP headers; 3. Verify no reflected XSS                             | 0 XSS vulnerabilities, CSP header set               | SecOps   | 2026-08-25 |
| **P14-S3** | CSRF Token Validation                  | Verify all state-changing requests require CSRF token    | POST/PUT/DELETE endpoints      | 1. Attempt state-change without token; 2. Verify Firebase Auth guards                                  | All state-changing requests blocked, token enforced | SecOps   | 2026-08-25 |
| **P14-S4** | Firestore Rules Penetration Test       | Attempt unauthorized reads/writes across all collections | Firestore rules deployed       | 1. Try to read patient laudo as unauthenticated user; 2. Try cross-lab access; 3. Try write to audit   | All attempts blocked by rules, 0 breaches           | SecOps   | 2026-08-25 |
| **P14-S5** | API Rate Limiting                      | Callable functions reject >100 req/min per user          | Cloud Functions deployed       | 1. Spam callable with 200 requests/min; 2. Check rate limit response                                   | Requests >100/min blocked, 429 response             | Eng-W4-B | 2026-08-25 |
| **P14-S6** | Full Regression Suite (19 smoke tests) | All critical flows pass on staging                       | v1.3 base + v1.4 changes       | 1. Run full smoke test suite (Phase 1 + Phase 5 + Phase 6 + Phase 7 + new P14); 2. Check 0 regressions | 19/19 smoke tests PASS, 0 failures                  | QA-Lead  | 2026-08-25 |
| **P14-S7** | Cloud Logs Review (48h tail)           | 0 P0 errors in logs, escalate any warnings               | 48h of production staging logs | 1. Export Cloud Logs; 2. Filter for errors/warnings; 3. Classify severity                              | 0 P0 errors, <5 P1 warnings (known), all documented | DevOps   | 2026-08-25 |
| **P14-S8** | Deployment Rehearsal                   | Dry-run deploy sequence (rules → functions → hosting)    | All code ready                 | 1. Run deploy to staging; 2. Verify rules deploy; 3. Verify functions deploy; 4. Verify hosting deploy | All deploys succeed, 0 timeouts, rollback tested    | DevOps   | 2026-08-25 |

---

### Phase 15: v1.4 Launch & Post-Deploy Monitoring

**Duration:** 2026-08-26 → 2026-08-31 (6 days)  
**Theme:** Production deployment, 24h Cloud Logs tail, incident response  
**E2E Count:** 8 scenarios (production validation + smoke tests)  
**Dependency:** Phase 14 complete

| ID         | Scenario                         | Flow                                                       | Precondition                            | Steps                                                                                                    | Expected                                                 | Owner    | Deployed   |
| ---------- | -------------------------------- | ---------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------- | ---------- |
| **P15-S1** | Deploy Rules to Prod             | Firestore rules v1.4 deployed, 0 errors                    | Rules tested on staging                 | 1. Run `firebase deploy --only firestore:rules`; 2. Verify no timeout; 3. Check Cloud Logs               | Rules deployed <5m, 0 errors in logs                     | DevOps   | 2026-08-31 |
| **P15-S2** | Deploy Functions to Prod         | 50+ Cloud Functions deployed, all cold-start <10s          | Functions tested on staging             | 1. Run `firebase deploy --only functions`; 2. Monitor deployment; 3. Check first invocation time         | Functions deployed <15m, all cold-starts <10s            | DevOps   | 2026-08-31 |
| **P15-S3** | Deploy Hosting to Prod           | Web app + PWA deployed, hard reload triggers update        | Hosting tested on staging               | 1. Run `firebase deploy --only hosting`; 2. Verify CDN cache; 3. Test SW update                          | Hosting deployed <3m, users see PWA update prompt        | DevOps   | 2026-08-31 |
| **P15-S4** | 24h Cloud Logs Monitoring        | Monitor prod logs, 0 P0 errors, <5 P1 warnings             | Prod deployed                           | 1. Run monitoring script (24h window); 2. Export JSON; 3. Flag any P0s or P1 patterns                    | 0 P0 errors, <5 P1 warnings, all documented              | DevOps   | 2026-08-31 |
| **P15-S5** | Smoke Test Suite on Prod (19/19) | Run full smoke test against production                     | Prod stable after 24h                   | 1. Run smoke-test/specs on hmatologia2.web.app; 2. Check all 19 flows                                    | 19/19 PASS, 0 regressions vs v1.3                        | QA-Lead  | 2026-08-31 |
| **P15-S6** | Post-Launch Performance Check    | Verify Web Vitals on prod (LCP/INP/CLS targets maintained) | 100+ prod users active                  | 1. Monitor Real User Metrics (RUM) in Firebase Analytics; 2. Compare vs baseline from Phase 12           | LCP P95 <2.5s, INP <200ms, CLS <0.1 maintained           | Eng-W4-B | 2026-08-31 |
| **P15-S7** | Incident Response Drill          | If any P0/P1 triggered, follow runbook                     | P0/P1 detected OR scheduled drill       | 1. Severity matrix applied; 2. On-call notified; 3. Incident commander takes charge; 4. Runbook executed | IR response <30min (P0) / <2h (P1), mitigated            | IR Lead  | 2026-08-31 |
| **P15-S8** | v1.4 Launch Sign-Off Memo        | Auditor + CTO co-sign "ready for external audit"           | All prior checks pass, no critical gaps | 1. Collect sign-offs from all leads; 2. Auditor final review; 3. Sign memo; 4. Archive in docs/          | Memo filed, external audit scheduled (target 2026-10-15) | CTO      | 2026-08-31 |

---

## Wave 4 Summary

| Phase        | E2E Count | Pass Rate Target | Owner    | Deploy Date | Gate Status                  |
| ------------ | --------- | ---------------- | -------- | ----------- | ---------------------------- |
| **Phase 12** | 8         | 8/8 (100%)       | Stream A | 2026-08-10  | Pre-Phase-15                 |
| **Phase 13** | 8         | 8/8 (100%)       | Auditor  | 2026-08-20  | Pre-Phase-15                 |
| **Phase 14** | 8         | 8/8 (100%)       | Stream B | 2026-08-25  | Phase-15                     |
| **Phase 15** | 8         | 8/8 (100%)       | DevOps   | 2026-08-31  | **LAUNCH**                   |
| **TOTAL W4** | **32**    | **32/32**        | —        | —           | **Ready for external audit** |

**Final Quality Gate Trigger:** External audit readiness (all 96 E2E + 19 smoke tests PASS, 0 P0 security findings, DICQ ≥88%, RDC 978 100%).

---

## Test Infrastructure Setup Checklist

### CI/CD Integration

- [ ] **GitHub Actions Workflow** for E2E runs (Phase 4 onward)
  - Trigger: PR merge to `main` + nightly @2am UTC
  - Matrix: Chromium only (single worker)
  - Timeout: 30min per E2E batch
  - Retry: 2 attempts on failure

- [ ] **Slack Notifications**
  - Pass: ✅ `[Phase X] E2E Batch: 8/8 PASS`
  - Fail: 🔴 `[Phase X] E2E Batch: 7/8 FAIL — see report: <link>`
  - Channel: `#hc-quality-testing`

- [ ] **HTML Report Generation**
  - Location: `smoke-test/playwright-report/`
  - Artifacts: screenshots + videos (on-failure)
  - Retention: 30 days

- [ ] **JSON Metrics Export**
  - `test-results.json` per phase
  - Fields: phase, duration_ms, pass_count, fail_count, flaky_tests, timeout_tests
  - Aggregated into `E2E_METRICS_DASHBOARD.json` (weekly rollup)

### Test Data Provisioning

- [ ] **Wave 2 Fixtures** (2026-05-20)
  - Inherit v1.3 Riopomba users (10 test accounts)
  - Add auditor test account (for CAPA Phase 4)
  - Add patient portal test accounts (for Phase 5)

- [ ] **Wave 3 Fixtures** (2026-06-17)
  - NOTIVISA sandbox credentials from ANVISA (gov provisioning 3–5 days)
  - 50+ pre-seeded CIQ records for Phase 8–10 tests
  - 20 strip images for Phase 11 IA dataset

- [ ] **Wave 4 Fixtures** (2026-07-29)
  - 500+ CIQ records for Phase 12 performance tests
  - 100+ patient portal accounts for smoke test load
  - Prod-like equipment registry (10+ analyzers)

### Quality Gate Automation

- [ ] **Pre-Merge Gate** (hcq-deploy-gates skill)
  - Runs: typecheck + lint + 274 unit tests + build + E2E smoke (5 flows)
  - Blocks merge if <95% pass

- [ ] **Pre-Deploy Gate** (per phase)
  - Runs: full E2E batch (8 scenarios per phase)
  - Blocks phase deploy if <100% pass
  - Requires manual approval if >2 flaky tests detected

- [ ] **Performance Gate** (Phase 12+)
  - Blocks deploy if LCP > 2.5s OR INP > 200ms OR CLS > 0.1
  - Requires bundle analysis justification if new dependency >50 KB

### Monitoring & Dashboards

- [ ] **E2E Metrics Dashboard** (weekly)
  - Chart: pass rate trend (target: 100%)
  - Chart: flaky test rate (flag if >2%)
  - Chart: timeout count (flag if >1)
  - Chart: duration trend (flag if >30% slower)

- [ ] **Slack Summary Bot**
  - Posts every Monday: `[v1.4 Testing] W2/W3/W4 status — X/32 PASS, Y flaky, Z warnings`
  - Real-time alerts: `🔴 P0 failure detected: <phase> <scenario>`

- [ ] **Cloud Logs Integration**
  - Query: `resource.type="cloud_function" AND severity="ERROR"` (last 24h)
  - Linked from E2E failure report (context for debugging)

---

## Flaky Test Mitigation Strategy

**Threshold:** If a test fails >2 times per scenario across all waves, mark as "high-flakiness" and investigate.

| Root Cause                   | Mitigation                                                                            | Owner    |
| ---------------------------- | ------------------------------------------------------------------------------------- | -------- |
| **Timing (waitFor timeout)** | Increase timeout tolerance by 50% (5000ms → 7500ms); use conditional waits            | QA-Lead  |
| **Stale Firestore data**     | Add meta-diff guard before state check; clear test data between runs                  | QA-Lead  |
| **Modal/UI rendering**       | Add explicit visibility check before interaction; use `waitFor({ state: 'visible' })` | QA-Lead  |
| **Network flakiness**        | Retry callable on 5xx; add circuit-breaker for external APIs (NOTIVISA)               | Eng-W2–4 |
| **Test isolation**           | Reset Firebase emulator between test batches; use unique test IDs per run             | QA-Lead  |

---

## Risk Monitoring & Escalation

| Risk               | Indicator                               | Threshold    | Escalation                                         |
| ------------------ | --------------------------------------- | ------------ | -------------------------------------------------- |
| **High flakiness** | >2 failures per scenario                | Detected     | Pause wave, investigate root cause                 |
| **Timeout surge**  | >1 test timing out per batch            | Detected     | Review performance baseline; check for regressions |
| **Coverage gaps**  | <80% code coverage in new modules       | Phase deploy | Block until covered; add unit test                 |
| **Regression**     | Smoke test fails that previously passed | Detected     | Rollback phase; file bug; re-plan                  |
| **Compliance gap** | DICQ block validation fails             | Phase 13     | Re-execute phase; auditor re-review                |

---

## Sign-Off & Handoff Protocol

### Per-Wave Sign-Off

**After all 32 E2E PASS:**

1. ✅ Test execution complete
2. ✅ All 8 scenarios (8 tests × 4 phases) pass
3. ✅ 0 flaky tests detected (or documented exceptions)
4. ✅ Cloud Logs clean (0 P0 errors related to E2E)
5. ✅ HTML report generated + archived
6. ✅ Slack notification posted: "Wave X: 32/32 PASS ✅"

**Wave Coordinator sign-off:** `✅ Wave X ready for Phase Y+4 execution`

### Final Launch Sign-Off (Phase 15)

**Before v1.4 goes live:**

1. ✅ 96/96 E2E PASS across all phases
2. ✅ 19/19 smoke tests PASS on production
3. ✅ 0 P0 security findings in Phase 14 audit
4. ✅ DICQ ≥88% verified by auditor
5. ✅ RDC 978 100% critical articles covered
6. ✅ Web Vitals baseline captured (LCP <2.5s, INP <200ms, CLS <0.1)
7. ✅ 24h Cloud Logs tail clean
8. ✅ Incident response runbook tested

**Auditor sign-off:** "v1.4 audit-ready, external audit can proceed"  
**CTO sign-off:** "Launch approved, production deploy scheduled"

---

## Appendix A: Test Scenario Naming Convention

Each scenario follows the pattern: `P{PHASE}-S{SCENARIO_NUMBER}`

- **P4-S1** = Phase 4, Scenario 1 (CAPA Creation)
- **P15-S8** = Phase 15, Scenario 8 (v1.4 Launch Sign-Off)

Queries:

- All Phase 8 scenarios: `P8-S[1-8]`
- All Wave 2 scenarios: `P[4-7]-S[1-8]`
- All deployment gates: `P15-S[1-3]` (rules/functions/hosting)

---

## Appendix B: Test Execution Timeline (Gantt View)

```
Week 1 (2026-05-07):  [Phase 0–3 close] ✅
Week 2–3 (2026-05-20): [Phase 4–5 E2E] |====| (parallel)
Week 3 (2026-06-03):   [Phase 6 E2E] |===| (sequential)
Week 4 (2026-06-10):   [Phase 7 E2E] |===|
Week 5 (2026-06-17):   [Phase 8–9 E2E] |======| (parallel)
Week 6–8 (2026-06-17): [Phase 10–11 E2E continues]
Week 9 (2026-07-29):   [Phase 12 E2E] |====|
Week 10 (2026-08-11):  [Phase 13–14 E2E] |====|
Week 11 (2026-08-26):  [Phase 15 E2E + LAUNCH] |======|
Week 12 (2026-08-31):  [Post-deploy monitoring] ✅
```

---

## Appendix C: Test Data Cleanup & Archival

**Retention Policy:**

- Test data: 7 days post-phase (then soft-delete)
- Test reports: 30 days (then archive to Cloud Storage)
- Metrics JSON: Forever (historical trend analysis)
- Screenshots/videos: 7 days on-failure (auto-delete)

**Archive Location:** `gs://hmatologia2-test-reports/v1.4-testing/`

---

## Appendix D: Known Issues & Exceptions

| Issue                                                          | Phase    | Status        | Workaround                                               |
| -------------------------------------------------------------- | -------- | ------------- | -------------------------------------------------------- |
| NOTIVISA sandbox unstable (gov API 50% uptime)                 | Phase 8  | Known         | Mock API for E2E, real sandbox pre-deploy only           |
| Mobile Playwright/Chrome DevTools timeout on 4G                | Phase 12 | Investigating | Use 8s explicit timeout for mobile tests                 |
| Gemini Vision response inconsistent (high/low confidence swap) | Phase 11 | Expected      | Human verification layer required; training dataset loop |

---

**Document Status:** APPROVED  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-05-20 (Phase 4 start)
