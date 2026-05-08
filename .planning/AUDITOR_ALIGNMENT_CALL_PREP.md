---
meeting: Auditor Pre-Alignment Call — v1.3 → v1.4 Bridge
date_prepared: 2026-05-07
meeting_duration: 90 minutes
meeting_format: Screen-share + Q&A
participants: CTO (HC Quality), RT Lead, External Auditor (DICQ/RDC expert)
status: READY FOR DEPLOYMENT
---

# Auditor Alignment Call Prep — 90 Minutes

**Objective:** Bridge v1.3 deployment → v1.4 execution with auditor sign-off on Phase 4–8 scope, RFI responses, and Phase 8 CAPA closure timeline.

**Outcomes:**
- ✅ 4 critical RFI responses approved (auditor sign-off)
- ✅ Phase-by-phase talking points aligned
- ✅ Go/no-go contingency gates established
- ✅ Weekly pre-alignment cadence confirmed
- ✅ Follow-up action items + ownership documented

---

## 1. AGENDA (90 min)

| Time | Section | Speaker | Notes |
|------|---------|---------|-------|
| **0–5 min** | Welcome + Agenda review | CTO | 5-slide overview |
| **5–15 min** | v1.3 Status recap (2 min) | Eng Lead | Live demo (Bioquímica + SGD Riopomba) |
| **15–40 min** | **4 RFI Responses** (25 min) | CTO + Tech Leads | Screen-share artifacts; q&a after each |
| **40–65 min** | **Phase 4–8 Roadmap** (25 min) | CTO | Talking points + dependency chain; go/no-go gates |
| **65–85 min** | **Contingency Scenarios** (20 min) | CTO | A/B/C branches + mitigation timelines |
| **85–90 min** | **Action Items + Closing** (5 min) | CTO | Next call scheduling; owner assignment |

**Pre-call setup (15 min before):**
- [ ] Firestore emulator running (production clone)
- [ ] Cloud Logs Dashboard open (last 24h)
- [ ] Browser tabs: v1.3 screenshots (3 docs) + Phase 4 spec (1 doc) + RFI responses (4 docs)
- [ ] Screen recording armed (optional)

---

## 2. RFI RESPONSES (25 min) — 4 Critical Questions

### RFI-01: CAPA Closure Evidence Integrity (7 min)

**Auditor Question:**  
"How do you ensure CAPA closure evidence (corrective action completeness, root cause verification, effectiveness review) cannot be tampered with after auditor sign-off?"

**Evidence Artifacts:**
- `docs/CAPA_CLOSURE_FRAMEWORK.md` (3 phases, each sealed)
- Firestore rules screenshot: `capa-findings/{labId}/findings/{findingId}` immutable after `status='auditor_verified'`
- Audit trail snapshot: 5 sample CAPA records with chainHash proof
- ADR-0009 excerpt: "State machine + immutable events for CAPA lifecycle"

**Response Structure (talking points):**

1. **Firestore schema design** (120 sec)
   - CAPA findings stored in immutable subcollection: `/capa-findings/{labId}/findings/{findingId}/auditLog/{logId}`
   - Status flow: `OPEN` → `IN_PROGRESS` → `REMEDIATED` → `PENDING_AUDITOR_REVIEW` → `AUDITOR_VERIFIED` (terminal)
   - Once `AUDITOR_VERIFIED`, Firestore rules block all mutations (client + callable)
   - Example: "We cannot even soft-delete a verified CAPA record — only read is allowed"

2. **LogicalSignature enforcement** (90 sec)
   - Each state transition signed with `LogicalSignature = { hash(payload), operatorId, timestamp }`
   - Hash covers: finding ID + current status + remediation details + auditor notes
   - Signature verified on every read; mismatch triggers alert
   - Callable `verifyCapaSignatures()` runs nightly, emits Cloud Logs anomalies

3. **Audit trail + chainHash** (90 sec)
   - Every change appended to `auditLog` subcollection (never overwritten)
   - Previous hash linked to next (chainHash): `event.prevHash = previousEvent.hash`
   - Auditor can verify chain integrity: "if any link broken, audit fails"
   - Snapshot: sample 3-record chain; show hash continuity

4. **Go-live gate** (30 sec)
   - Pre-Phase 8 Plan 05: run `verifyCapaSignatures()` on 100 test findings; must be 100% pass
   - Auditor attends verification ceremony (or review recording)
   - **Gate approval:** "Auditor signs off on signature + chain schema before Plan 05 begins"

**Contingency (if auditor pushes back):**
- "We can add manual audit export (immutable PDF) — auditor reviews offline post-ceremony"
- "We can add time-locked deletion (72h review window) instead of permanent block"

---

### RFI-02: Critical Values SLA Enforcement (7 min)

**Auditor Question:**  
"RDC 978 Art. 115–117 require critical value notification SLA (X hours). How do you prevent a lab from turning off escalation or missing an alert? What's your audit trail?"

**Evidence Artifacts:**
- `docs/CRITICAL_VALUE_SLA_ENFORCEMENT.md` (SLA matrix by critical type)
- Phase 5 spec excerpt: `escalateCriticalValue()` callable signature + mandatory fields
- Cloud Functions snippet: `criticos-escalacoes/escalationStatus/{labId}` schema
- Rules screenshot: prevents `escalationEnabled=false` without auditor approval + reason log
- Sample alert history JSON (3 records, timestamps + delivery proof)

**Response Structure:**

1. **SLA tiers + escalation mandatory** (90 sec)
   - Critical values trigger 2-tier escalation: **RT email (10 min SLA)** → **SMS physician (5 min SLA)**
   - Cannot skip email tier (callables enforce order)
   - If escalation callable fails 3× in 30 min, system flags as CRITICAL ALERT and notifies lab admin + system admin
   - Example: "Even if RT forgets to check email, SMS fires anyway at 5-min mark"

2. **Immutable escalation audit trail** (90 sec)
   - Every escalation event stored: `criticos-escalacoes/{labId}/events/{eventId}`
   - Fields: `resultId`, `analite`, `value`, `tier1_sent_at`, `tier1_delivered_at`, `tier2_sent_at`, `tier2_delivered_at`, `operatorAckTime`, `status`
   - Rules prevent modification; only read allowed after creation
   - Auditor can query "escalation success rate last 30 days" — must be 100% (or justify failures)

3. **SLA monitoring dashboard** (60 sec)
   - Real-time KPI: % escalations delivered on time (target: 100%)
   - Monthly report: escalation SLA compliance by lab
   - Red flag: if any critical value has `escalation_failed` or missing `delivered_at`, manual review triggered
   - Auditor gets email alert if SLA breached (escalation delivery >10 min)

4. **Lab cannot disable escalation** (60 sec)
   - Setting `criticalAlertConfig.enabled=false` requires:
     - Lab admin approval (RT-level)
     - Reason code (dropdown: maintenance, vendor request, clinical review, other + freetext)
     - Auto-expires in 24h (must be manually re-enabled)
     - All toggle events logged with hash + signature
   - Auditor can see: "Labs that disabled escalation, duration, reason"

5. **Go-live gate** (30 sec)
   - Phase 5 Plan 01 gate: send 10 test critical values to 3 labs; all 6 notifications (30 total) delivered on SLA
   - Auditor spot-check: review 5 random escalation records from production; verify timestamp gaps

**Contingency (if auditor wants stricter SLA):**
- "We can reduce SLA to RT email 5 min + SMS 3 min (requires Twilio upgrade)"
- "We can add 3rd tier: hospital pharmacy SMS (auto-route if physician SMS fails)"

---

### RFI-03: Portal Auth + LGPD Compliance (7 min)

**Auditor Question:**  
"Phase 4 introduces RT portal médico + patient external portal. LGPD Art. 9 (explicit consent). How do you ensure portal sessions are locked to intent, and patient PII isn't exposed across portals?"

**Evidence Artifacts:**
- Phase 4 spec: `rtPortalLogin()` + `patientPortalAccess()` callables
- Firestore schema: `portal-configuracao/{labId}/auth-config` (session intent + TTL)
- Rules screenshot: `portal-sessions/{labId}/sessions/{sessionId}` read-only after creation, scope-locked
- LGPD consent form mockup (screenshot from UI kit)
- Session isolation test case: show how cross-portal leakage is blocked

**Response Structure:**

1. **Portal separation + intent scoping** (90 sec)
   - RT Portal: `portal-medical/{labId}/sessions/{rtId}_session` — access `laudos` collection only
   - Patient Portal: `portal-patient/{labId}/sessions/{patientId}_session` — access own `feedback` + `resultados` only
   - **Critical:** Sessions scoped to intent — RT cannot access patient feedback, patient cannot see laudo drafts
   - Firestore rules enforce: `request.auth.token.portalType == 'RT'` for RT portal, etc.
   - Example rule: `match /laudos/{doc=**} { allow read: if request.auth.token.portalType == 'RT'; }`

2. **LGPD consent capture** (90 sec)
   - Patient portal login triggers consent form: "I consent to feedback data collection per LGPD Art. 7"
   - Form fields: (1) checkbox, (2) timestamp, (3) Gemini-generated form hash (proof of version)
   - Consent stored immutable: `portal-patient-consents/{labId}/consents/{patientId}_consent`
   - Rules: patient feedback cannot be created without matching consent record + valid timestamp (<30 days old)
   - Auditor sees: consent acceptance rate, dates, hash chain

3. **Session timeout + revocation** (75 sec)
   - RT portal: 2h timeout (configurable per lab, min 30 min)
   - Patient portal: 1h timeout (auto-logout)
   - Auditor can revoke any session instantly via callable `revokePortalSession(sessionId)`
   - Session revocation logged + notified to user (email)
   - PII fields redacted in session logs (no patient phone/email stored in plain text)

4. **PII isolation across portals** (75 sec)
   - Patient data stored in separate collections: `patients/{labId}/patients/{patientId}` (RT only)
   - Patient feedback: `feedback/{labId}/feedback/{feedbackId}` (patient PII stripped before patient sees)
   - Example: feedback form shows "Submitted 2026-05-07" but never shows "email@example.com" in patient view
   - Callable `stripPiiFromFeedback()` removes operator email, notes before returning to patient
   - Auditor: review 5 feedback records (RT view vs patient view); verify PII absent in patient version

5. **Go-live gate** (30 sec)
   - Phase 4 gate: pen-test (external consultant) + LGPD compliance audit
   - Test matrix: (1) RT cannot access patient feedback (2) Patient cannot view laudo drafts (3) Session timeout enforced
   - Auditor review: 5 sample portal sessions + consent records

**Contingency (if auditor wants stricter isolation):**
- "We can use separate Firebase projects for RT + patient portals (higher cost, max isolation)"
- "We can add 3rd-party identity provider (OAuth Keycloak) instead of custom auth"

---

### RFI-04: NOTIVISA Queue Idempotency + Retry Logic (7 min)

**Auditor Question:**  
"Phase 4 integrates NOTIVISA queue (Art. 6º §1 notifications). How do you ensure a laudo is never sent twice? What happens if the government API times out?"

**Evidence Artifacts:**
- Phase 4 spec: `notivisa-queue/{labId}/events/{eventId}` schema
- Callable signature: `submitToNotivisa(laudoId, labId)` — idempotency key handling
- Rules screenshot: event status flow (PENDING → SUBMITTED → ACK_RECEIVED → ARCHIVED)
- Cloud Functions code: retry logic with exponential backoff (3 retries, 5-30 min intervals)
- Incident response plan: "what if NOTIVISA is down for 24h"

**Response Structure:**

1. **Idempotency key enforcement** (90 sec)
   - Every NOTIVISA submission created with `idempotencyKey = hash(laudoId + labId + timestamp)`
   - Before submitting, callable checks: "Is there a recent (within 24h) NOTIVISA event for this laudo?"
   - If yes, return existing `eventId` (duplicate submission blocked)
   - Schema field: `notivisa-queue/{labId}/events/{eventId}.idempotencyKey` — indexed for fast lookup
   - Database trigger detects duplicate keys: raises alert if collision detected (could indicate malicious resubmission)

2. **Status state machine + immutable flow** (90 sec)
   - Event statuses: `PENDING` → `SUBMITTED` → `AWAITING_ACK` → `ACK_RECEIVED` → `ARCHIVED` (+ `FAILED` branch)
   - Cannot go backwards or skip steps (Firestore rules enforce)
   - Example: "Once ACK_RECEIVED, event becomes read-only"
   - Each transition signed with LogicalSignature (auditor can verify state chain integrity)

3. **Retry logic + exponential backoff** (90 sec)
   - Cloud Function `notivisaQueueProcessor` polls queue every 30s
   - For `PENDING` events, attempt submit:
     - Retry 1: 5 min delay (if initial submit fails)
     - Retry 2: 15 min delay (if retry 1 fails)
     - Retry 3: 30 min delay (if retry 2 fails)
     - After 3 retries: escalate to `FAILED_ESCALATION` (email lab admin + system admin)
   - Max retry window: 1h per laudo (then manual intervention required)
   - All retry attempts logged immutably

4. **NOTIVISA timeout / outage scenarios** (90 sec)
   - Network timeout: if NOTIVISA API doesn't respond in 30s, treat as transient failure (auto-retry)
   - HTTP 5xx: transient (retry)
   - HTTP 4xx (400, 403, 422): permanent failure (escalate without retry)
   - If NOTIVISA is down >1h: stop retrying, escalate to manual queue
   - Auditor dashboard shows: "Laudos in PENDING state >1h" — red flag for monitoring

5. **Auditor oversight + manual intervention** (60 sec)
   - Auditor can query: "show all NOTIVISA events for lab X in last 30 days"
   - Auditor can trigger manual resubmit for failed events (with audit trail entry)
   - Auditor can archive events (soft-delete only, never hard-delete)
   - Incident log: "if NOTIVISA down, manual outage declaration recorded + reason"

6. **Go-live gate** (30 sec)
   - Phase 4 gate: simulate NOTIVISA timeout for 30 min; verify queue processor retries correctly
   - Test: submit 20 laudos, toggle NOTIVISA mock API on/off; all should eventually succeed
   - Auditor review: verify idempotency (no duplicate government submissions) + retry logs

**Contingency (if auditor wants manual approval before NOTIVISA submit):**
- "We can add Phase 4 Plan 02 step: RT approval flow (laudo → ready → RT approves → NOTIVISA submit)"
- "We can require auditor pre-approval for first 100 submissions"

---

## 3. PHASE 4–8 ROADMAP — Talking Points (25 min)

### Phase 4: Portal Auth + NOTIVISA (2.5 weeks, May 20–Jun 2)

**Headline:** RT medical portal + patient feedback portal gates. NOTIVISA integration live.

**Talking Points (per slide):**

| Slide | Section | Key Point | Auditor Checkpoint |
|-------|---------|-----------|-------------------|
| **4.1** | Portal Tech Stack | Dark-first UI (WCAG AA), session-scoped auth, Redis caching for speed | Compliance: Auth callables ONLY (no direct client write) |
| **4.2** | RDC Coverage | Arts. 6 (notification), 167 (laudo access), 204 (audit trail) | All 3 articles covered? YES → deploy; NO → defer |
| **4.3** | NOTIVISA Queue | Idempotency key + retry logic (exponential backoff 5-30 min) | Simulated outage test: 20 laudos, mock NOTIVISA offline 30 min → all eventually submitted? |
| **4.4** | Success Criteria | 3 callables tested (unit + integration); portal LCP <2s; NOTIVISA 100% of events processed | Gate: baseline tests 738/738 still passing? Cloud Logs: <5% warnings? |
| **4.5** | Risk Mitigation | Pen-test phase 10 runs parallel; auditor weekly sync starts week 1 | Decision: if pen-test finds critical auth bug, Phase 4 pauses until fixed |

**Discussion points:**
- "Auditor, which portal flows would you like us to walkthrough live after deploy?"
- "NOTIVISA: are you comfortable with 3-retry exponential backoff, or prefer more aggressive?"
- "RDC Art. 6 notification SLA — is 10-min RT email + 5-min SMS acceptable?"

**Auditor approval trigger:** "Does Phase 4 scope cover your compliance concerns for Arts. 6, 167, 204?"

---

### Phase 5: Critical Escalation + IA Training (3 weeks, Jun 9–Jun 30)

**Headline:** Critical value SMS/email SLA enforced. IA strip upload + Gemini Vision model versioning.

**Talking Points:**

| Slide | Section | Key Point | Auditor Checkpoint |
|-------|---------|-----------|-------------------|
| **5.1** | Critical Detection | Real-time rule engine (result arrives → 0.5s detection) | SLA: RT email 10 min, SMS 5 min. Measurable? YES (Cloud Logs timestamp gap) |
| **5.2** | RDC Art. 115–117 | Escalation mandatory; lab cannot disable without auditor approval + reason log | Lab tries to set `enabled=false` → field requires reason code + auto-expires 24h |
| **5.3** | IA Training Dataset | 1,000+ strip images uploaded, annotated, versioned | Model v1.0 locked (production); v1.1 A/B test (staging) |
| **5.4** | KPI Dashboards | Escalation SLA compliance %; critical value trending | Auditor sees: % on-time delivery; red flags for breaches |
| **5.5** | Success Criteria | SMS delivered <5 min (measured on 100 test alerts); 1,000+ strips uploaded; model versioning live | Gate: if SMS delivery ever >5 min, escalation fails; must investigate |

**Discussion points:**
- "Critical thresholds — are you comfortable with labs configuring their own, or prefer centralized?"
- "IA strips — do you want random auditor sampling (e.g., 1% of uploads) for quality verification?"

**Auditor approval trigger:** "Does Phase 5 close RDC Arts. 115–117 completely?"

---

### Phase 6: Liberação Completion (2 weeks, Jul 1–Jul 14)

**Headline:** PDF generation + QR codes + portal médico completion (Phase 10 deferred items).

**Talking Points:**

| Slide | Section | Key Point | Auditor Checkpoint |
|-------|---------|-----------|-------------------|
| **6.1** | PDF Generation | CloudFunction + puppeteer (server-side); QR encodes laudo hash + signature | PDF immutable (hash verified on download) |
| **6.2** | Portal Médico | External physician access (SSO); can view owned laudos only | Session isolation: physician cannot access other doctors' patients |
| **6.3** | RDC Art. 167 | Laudo signature (RT only), portal access (RT + physician), audit trail (all changes) | All 3 covered? YES → close RDC Art. 167 |
| **6.4** | E2E Suite | 8 critical flows: create → review → sign → PDF export → email physician → archive | All 8 passing? YES → deploy; <8 passing? Investigate failures |
| **6.5** | Success Criteria | PDF export <5s; portal médico LCP <2s; zero PDF corruption (100 spot-check) | Auditor samples: 5 random PDFs; verify hash matches signature on file |

**Discussion points:**
- "Portal médico external access — do you want mandatory MFA for physicians?"
- "PDF retention — how long should signed PDFs be kept?"

**Auditor approval trigger:** "Can we close RDC Arts. 167 + DICQ Block I after Phase 6?"

---

### Phase 7: Reclamações/Satisfação/Sugestões Polish (3 weeks, Jul 8–Jul 28)

**Headline:** Portal paciente (patient feedback submission). Trending dashboard. LGPD polish.

**Talking Points:**

| Slide | Section | Key Point | Auditor Checkpoint |
|-------|---------|-----------|-------------------|
| **7.1** | Portal Paciente | External patient access; feedback form (NPS + free text); consent capture | Consent immutable; auditor can audit 100% of submissions |
| **7.2** | Trending Dashboard | DICQ 4.15 integration — satisfaction trends by operator, test, period | Auditor runs query: "avg NPS last 30 days by operator"; must tie to KPIs |
| **7.3** | LGPD Compliance | PII stripping (patient never sees operator email); anonymization cron (90-day TTL); right-to-delete | Auditor can trigger manual anonymization for 1 patient; verify PII removed |
| **7.4** | RDC Art. 115 | Feedback loop captured; improvement actions logged | Auditor links feedback → CAPA finding → corrective action → closure |
| **7.5** | Success Criteria | Portal paciente <2s LCP; 100% consent capture; anonymization cron working (verify on test patient) | Gate: 10 test patients submit feedback; all consents captured? All anonymized after 90 days? |

**Discussion points:**
- "Patient feedback — do you want automated sentiment analysis (Gemini) or manual review only?"
- "Anonymization — is 90-day TTL acceptable, or prefer 30-day?"

**Auditor approval trigger:** "Does Phase 7 close DICQ Blocks H + I + LGPD Art. 17?"

---

### Phase 8: CAPA Closure (4 weeks, Jun 15–Aug 5) — **CRITICAL PATH**

**Headline:** 7 findings → Phase-by-phase remediation → auditor sign-off ceremony (Aug 5).

**Talking Points:**

| Slide | Section | Key Point | Auditor Checkpoint |
|-------|---------|-----------|-------------------|
| **8.0** | CAPA Findings Summary | F-01 through F-07 (turnos audit, DPIA, lab-apoio, risks FMEA, mgmt review, doc distribution, rastreabilidade) | Auditor reviews findings list; any missing? |
| **8.1** | F-01: Turnos Auditável | Phase 0 delivered; callables + queries working; auditor test: "can you query supervisor turnover by date range?" | Test query live; show 3-month sample; verify accuracy |
| **8.2** | F-02: DPIA Incompleto | Phase 0 delivered; DPIA form filled (data flows, risk matrix, mitigation); auditor review offline | Auditor takes DPIA doc; provides feedback by Jun 26 |
| **8.3** | F-03: Lab-apoio Sem Contrato | Phase 0 delivered; contract workflow (upload → approval → signed); auditor verify 5 contracts in system | Query live: "show me 5 signed lab-apoio contracts"; verify dates + signatures |
| **8.4** | F-04: Risks FMEA Formal | Phase 0 delivered; FMEA-lite (probability, severity, detectability, NPR 1–125); auditor reviews 3 risk records | Show sample FMEA records; verify P×S×D formula correct |
| **8.5** | F-05: Management-review | Plan 05 (Phase 8 weeks 3–4); monthly review cycle scheduled; auditor attends 1 review session | Scheduled for 2026-06-20; auditor invited; send calendar + prep doc by Jun 13 |
| **8.6** | F-06: Doc Distribution Approval | Plan 06 (Phase 8 weeks 3–4); distribuição records + approval audit trail; auditor verifies chain | Live query: "show all documents distributed in May"; verify RT approval recorded |
| **8.7** | F-07: Rastreabilidade Incompleta | Plan 07 (Phase 8 weeks 4); TraceabilityEvent append-only logs + chainHash verification ceremony | Scheduled for Aug 5; auditor runs `verifyTraceabilityChain()` callable; must be 100% pass |
| **8.8** | Closure Ceremony | Aug 5 meeting; auditor signs off F-01–F-07; CAPA process documented; next audit date set | All findings closed? Auditor signature on CAPA Closure Report |

**Critical dates:**
- **Jun 15:** Phase 8 starts (Eng-owned findings)
- **Jun 22:** F-01 + F-02 + F-03 + F-04 verification due
- **Jul 6:** CTO + Auditor review starts (F-05 → F-07)
- **Aug 5:** CAPA Closure Ceremony (auditor sign-off)
- **Aug 31:** External audit (contingency 2-week buffer)

**Discussion points:**
- "Auditor, can you commit to weekly Phase 8 progress calls (Jun 15 → Aug 5)?"
- "Do you want to attend F-01–F-04 verifications live, or review recorded evidence?"
- "Aug 5 ceremony — do you need any prep documents by Jul 29?"

**Auditor approval trigger:** "Auditor commits to Aug 5 ceremony date?" → If YES, Phase 8 unblocked; if NO, escalate to director

---

## 4. CONTINGENCY SCENARIOS — Go/No-Go Gates (20 min)

### Scenario A: Auditor RFI → Deferred Phase

**Situation:** During call, auditor says "I need to see Phase 4 spec in writing before approving portal auth." Spec not ready.

**Go/No-Go Decision Matrix:**

| Gate | Condition | Decision | Action |
|------|-----------|----------|--------|
| **Phase 4 Kickoff** | Spec ready? | ❌ NO-GO | Phase 4 pauses; spec due 2026-05-17; reschedule auditor alignment 2026-05-20 |
| **Phase 4 Kickoff** | Spec + approval? | ✅ GO | Phase 4 starts May 20; send CTO + Auditor weekly standup link |
| **Phase 5 Start** | Phase 4 issues found in testing? | ⚠️ CONDITIONAL | If critical: pause Phase 5, fix Phase 4 (2-day buffer); if minor: Phase 5 proceeds, Phase 4 hot-fix in parallel |
| **Phase 8 Start** | Auditor unavailable for weekly calls? | ❌ NO-GO | Phase 8 paused until auditor availability confirmed (backup auditor or reschedule) |

**Talking points (proactive):**
- "We're prepared to provide detailed specs for any phase. If you need anything in writing, ask now."
- "Phase 4 kickoff is May 20. For us to stay on schedule, auditor sign-off needed by May 17."
- "If a blocker arises, we have 5-day slip buffer in Phase 5 to absorb Phase 4 delays."

**Escalation path:**
1. Auditor + CTO call (same day)
2. If unresolved in 24h → escalate to lab director + CTO for decision
3. Document decision in CAPA log (with reason)

---

### Scenario B: Production Bug Found in Phase 4–5

**Situation:** Week 2 of Phase 5, a critical auth bug found in portal (session token leakage). Phase 6 + 7 at risk.

**Risk Severity Matrix:**

| Severity | Example | Gate | Decision |
|----------|---------|------|----------|
| **🔴 CRITICAL** | Session can access other labs' data | Phase 4 ROLLS BACK | Revert deploy; fix + retest (4 days); re-deploy; skip Phase 5 Week 1 |
| **🟠 HIGH** | Patient can see other patients' feedback | Phase 5 PAUSES | Hot-fix (2 days); Phase 5 resumes; defer non-critical features to v1.4.1 |
| **🟡 MEDIUM** | Audit trail missing operator ID in 1% of records | CONTINUE | Hot-fix asap; Phase 5 proceeds; auditor reviews fix + test results |
| **🟢 LOW** | UI typo in portal form | CONTINUE | Fix in Phase 6 polish; no phase impact |

**Talking points (proactive):**
- "We have a 2-week buffer (Phase 5 vs Phase 6 start: Jun 9 vs Jul 1). If a P1 bug emerges, we pause and fix."
- "Auditor, what's your SLA for security incident review? 24h OK?"
- "We'll report all Phase 4–5 bugs to you weekly, with severity + fix status."

**Post-incident:**
- Create incident report (template: `docs/INCIDENT_REPORT_TEMPLATE.md`)
- Auditor reviews fix + test results within 48h
- Document in CAPA log (traceability)

---

### Scenario C: CAPA Closure Delayed (Phase 8)

**Situation:** By Jul 12 (Phase 8 Week 4), F-07 (rastreabilidade) has 5 outstanding remediation items. Aug 5 ceremony at risk.

**Timeline Contingency:**

| Contingency | Timeline | Action | Gate |
|-------------|----------|--------|------|
| **Plan C1: Aggressive Fix** | Jul 13–Aug 2 (20 days) | Dedicate 2 engineers full-time to F-07; daily standups; auditor daily reviews | If fixed by Aug 2: ceremony on Aug 5 ✅ |
| **Plan C2: Partial Closure** | Aug 5 ceremony | Close F-01–F-06; defer F-07 to "extended remediation" (due Sep 5) | Auditor approves 6 findings; F-07 "in progress" status documented |
| **Plan C3: External Audit Slip** | Aug 31 → Sep 15 | Request 2-week slip to external audit; continue Phase 8 through Aug 31 | Auditor + lab director approval required |
| **Plan C4: Escalate to Director** | Jul 19 (if C1 unlikely) | Escalate to lab director + CTO for go/no-go decision on external audit timing | Director decides: proceed with partial closure, or defer audit |

**Talking points (proactive):**
- "Phase 8 is the critical path. If we detect slippage by Jul 12, we'll inform you immediately."
- "Auditor, would you accept 6 of 7 findings closed for Aug 5, with F-07 due Sep 5?"
- "If external audit must slip, we'll give 2-week notice by late Jul."

**Contingency gate:** If Phase 8 slips >5 days by Jul 12 → escalate to director.

---

## 5. FOLLOW-UP ACTION TEMPLATE

**To be filled in during call, owned by CTO.**

### Actions from Auditor

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| **(example) Review Phase 4 spec in writing** | Auditor | 2026-05-17 | PENDING |
| | | | |
| | | | |

### Actions for HC Quality Team

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| **(example) Deliver Phase 4 spec** | CTO | 2026-05-17 | PENDING |
| **(example) Set up weekly auditor standup link** | Eng Lead | 2026-05-10 | PENDING |
| **(example) Provide CAPA Closure Framework doc** | CTO | 2026-05-10 | PENDING |
| | | | |

### Next Meetings

| Meeting | Date | Participants | Agenda |
|---------|------|-------------|--------|
| Phase 4 Auditor Sync | 2026-05-27 (Mon 10:00 BRT) | CTO, Auditor | Portal + NOTIVISA post-deployment review |
| Phase 5 Auditor Sync | 2026-06-10 (Mon 10:00 BRT) | CTO, Auditor | Critical escalation + IA dataset demo |
| Phase 8 Kickoff | 2026-06-16 (Mon 10:00 BRT) | CTO, Auditor, Eng A–D | CAPA closure plan review |
| CAPA Closure Ceremony | 2026-08-05 (Tue 14:00 BRT) | CTO, Auditor, Lab Director | F-01–F-07 sign-off |

---

## APPENDIX: Screen-Share Assets (5 items ready to click)

### Pre-Call Checklist

- [ ] **Doc 1:** `docs/CAPA_CLOSURE_FRAMEWORK.md` (2 min read) — 3-phase closure lifecycle
- [ ] **Doc 2:** Phase 4 spec excerpt (firestore schema + NOTIVISA queue logic) — 3 min read
- [ ] **Doc 3:** `docs/CRITICAL_VALUE_SLA_ENFORCEMENT.md` (2 min read) — SLA matrix + escalation tiers
- [ ] **Doc 4:** v1.3 compliance summary (`COMPLIANCE_SUMMARY_v1.3.md`) — baseline metrics
- [ ] **Screenshot 1:** Firestore rules for `capa-findings` (immutable after AUDITOR_VERIFIED)
- [ ] **Screenshot 2:** Audit trail sample (5 CAPA records with chainHash continuity)
- [ ] **Screenshot 3:** Cloud Logs filter (last 24h, 0 critical errors)
- [ ] **Live Demo:** Riopomba SGD migration (80 docs, show 3 sample documents)
- [ ] **Live Demo:** Bioquímica control run + Levey-Jennings chart (show 2 analitos)

### Quick Reference Cards (1-pager PDFs)

- **Card 1:** RDC 978 Articles → v1.3/v1.4 Coverage (Arts. 6, 115–117, 167, 179–191, 204)
- **Card 2:** Phase 4–8 Timeline + Dependency Chain (visual Gantt)
- **Card 3:** Contingency Go/No-Go Decision Tree (A/B/C scenarios)
- **Card 4:** CAPA Closure Ceremony Checklist (pre-meeting, day-of, post-ceremony)

---

## CLOSING NOTES

**Call tone:** Collaborative, transparent, audit-ready. Position auditor as partner (not adversary).

**Key messages:**
1. ✅ v1.3 production-ready (78% DICQ, all critical RDC articles covered)
2. ✅ v1.4 roadmap locked (Phase 0–3 complete, Phase 4 starts May 20)
3. ✅ 4 RFI responses written + ready (CAPA integrity, critical SLA, portal auth, NOTIVISA idempotency)
4. ✅ Contingency scenarios mapped (go/no-go gates + escalation paths)
5. ✅ Weekly pre-alignment cadence starts May 20

**Auditor's role:** Approve phases, sign off findings, attend ceremonies.

**Timeline:** CAPA ceremony Aug 5 → External audit Aug 31 (achievable with contingency buffers).

---

**Document prepared by:** CTO  
**Date prepared:** 2026-05-07  
**Status:** READY FOR SCREEN-SHARE  
**Last updated:** 2026-05-07
