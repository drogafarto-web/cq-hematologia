# Integration Setup Index — NOTIVISA + Twilio (Phase 4–5)

**Quick Reference:** Vendor coordination and pre-deployment validation for HC Quality v1.4  
**Phases:** Phase 4 (2026-05-20 — NOTIVISA) · Phase 5 (2026-06-09 — Twilio SMS)  
**Owner:** CTO (overall orchestration) · Agent 3 (Phase 4) · Agent 1 (Phase 5)  
**Status:** Four preparation documents ready for Phase 4–5 execution

---

## Document Roadmap

### 1. **NOTIVISA_INTEGRATION_SETUP_CHECKLIST.md** (~450 lines)

- **Purpose:** Step-by-step validation checklist for NOTIVISA sandbox + production integration
- **Sections:**
  1.  Credentials & authentication (Secrets Manager setup)
  2.  API documentation validation (Portaria 204 v3.0)
  3.  Rate limits & throttling strategy
  4.  Error handling scenarios (API down, timeouts, invalid payload)
  5.  Webhook receiver setup (signature validation, retry logic)
  6.  Firestore indexes & performance benchmarks
  7.  Testing & validation (unit + integration + E2E + load)
  8.  Audit trail & compliance (RDC 978, LGPD)
  9.  Deployment checklist (pre-Phase 4-03)
  10. Support & escalation contacts
- **Audience:** Agent 3 (execution), QA (testing), CTO (oversight)
- **Use:** Check off items as Phase 4 progresses; sign-off required before deployment

---

### 2. **TWILIO_INTEGRATION_SETUP_CHECKLIST.md** (~520 lines)

- **Purpose:** Step-by-step validation checklist for Twilio SMS + WhatsApp Business API setup
- **Sections:**
  1.  Account provisioning & security (2FA, fraud prevention, spending caps)
  2.  Phone numbers & regional allocation (Brazil x2)
  3.  SMS configuration & rate limits
  4.  WhatsApp Business API (deferred to Phase 5 expansion)
  5.  Error handling & failure scenarios (Twilio down, invalid numbers, timeouts)
  6.  Firestore integration & SMS templates
  7.  Firestore indexes & performance benchmarks
  8.  Testing & validation (unit + integration + E2E + load)
  9.  Billing & cost management (estimation, tracking, optimization)
  10. Audit trail & compliance (RDC 978, LGPD)
  11. Deployment checklist (pre-Phase 5-01)
  12. Support & escalation contacts
- **Audience:** Agent 1 (execution), QA (testing), CTO (oversight)
- **Use:** Check off items as Phase 5 progresses; sign-off required before deployment

---

### 3. **EMAIL_TEMPLATES_VENDOR_COORDINATION.md** (~400 lines)

- **Purpose:** Ready-to-send email templates for vendor communication
- **Templates:**
  1.  **NOTIVISA:** Sandbox account request + credentials + API docs + SLA
  2.  **Twilio:** Account provisioning + phone numbers + SMS service confirmation
  3.  **Internal Team:** Integration readiness gate (blockers, dependencies, timeline)
  4.  **SendGrid:** Fallback email service confirmation (optional pre-Phase 5)
  5.  **Post-Deployment:** Vendor confirmation after go-live (2026-06-30)
- **Appendices:**
  - Pre-send checklist (customize placeholders, validate recipients)
  - Response tracking log (maintain spreadsheet of sent emails + due dates)
  - Escalation matrix (action if no response by deadline)
- **Audience:** CTO (sender), Engineering Manager (CC)
- **Use:** Customize with project details, send by 2026-05-15; track responses

---

### 4. **INTEGRATION_DEPENDENCY_MATRIX.md** (~620 lines)

- **Purpose:** Map dependencies, identify blockers, define go/no-go criteria
- **Sections:**
  1.  Executive summary (vendor integrations + critical path)
  2.  Phase dependency chain (Phase 0–8 sequence + critical path)
  3.  Detailed dependency matrix (Phase 4 → Phase 5 → Phase 6–8)
  4.  Cross-phase dependencies (Firestore collections, Cloud Functions, Rules, Secrets)
  5.  Vendor readiness matrix (NOTIVISA, Twilio, SendGrid status tracking)
  6.  Go/no-go checkpoints (Phase 4 kickoff, Phase 4 deploy, Phase 5 kickoff, Phase 5 deploy)
  7.  Risk mitigation & contingencies (4 major risks + fallbacks)
  8.  Critical path summary (14 weeks, Phase 0 start → Phase 8 end)
- **Audience:** CTO (orchestration), Engineering Manager (oversight), Agents 1 & 3 (execution)
- **Use:** Reference document for weekly sync calls; update go/no-go status; escalate blockers

---

## Timeline & Handoff

### Week of 2026-05-07 (This Week)

- [ ] Review all 4 documents
- [ ] Customize email templates with project details (CTO)
- [ ] Identify vendor contact information (CTO)

### Week of 2026-05-13 (Pre-Phase 4 Kickoff)

- [ ] Send vendor coordination emails (Template 1 + 2 + 3) — **by 2026-05-15 EOD**
- [ ] Track vendor responses (use Template in EMAIL_TEMPLATES document)
- [ ] Confirm Phase 4 blockers resolved (NOTIVISA credentials received + tested)
- [ ] Hold team sync: integration readiness (CTO + Agents 1 & 3)

### Week of 2026-05-20 (Phase 4 Kickoff)

- [ ] Agent 3 begins Phase 4-03 (NOTIVISA queue processor)
- [ ] Start filling in NOTIVISA_INTEGRATION_SETUP_CHECKLIST (sections 1–3)
- [ ] Confirm Firestore Rules deployed (Phase 3 artifact)
- [ ] Begin integration testing (sections 7–8)

### Week of 2026-05-27–06-02 (Phase 4 Execution)

- [ ] Complete NOTIVISA_INTEGRATION_SETUP_CHECKLIST (all sections)
- [ ] Phase 4 go/no-go check (INTEGRATION_DEPENDENCY_MATRIX checkpoint 2)
- [ ] Deploy Phase 4 (2026-06-02 target)

### Week of 2026-06-09 (Phase 5 Kickoff)

- [ ] Confirm Phase 5 blockers resolved (Twilio account + phone numbers confirmed)
- [ ] Agent 1 begins Phase 5-01 (critical thresholds + SMS escalation)
- [ ] Start filling in TWILIO_INTEGRATION_SETUP_CHECKLIST (sections 1–3)
- [ ] Confirm Phase 4 live + stable (0 critical issues)

### Week of 2026-06-16–06-30 (Phase 5 Execution)

- [ ] Complete TWILIO_INTEGRATION_SETUP_CHECKLIST (all sections)
- [ ] Phase 5 go/no-go check (INTEGRATION_DEPENDENCY_MATRIX checkpoint 4)
- [ ] Deploy Phase 5 (2026-06-30 target)

### Week of 2026-06-30 (Post-Deployment)

- [ ] Send post-deployment confirmation to vendors (Template 5)
- [ ] Begin Phase 8 CAPA closure (RDC 978 findings documentation)

---

## How to Use Each Document

### NOTIVISA_INTEGRATION_SETUP_CHECKLIST.md

1. **Assign to Agent 3** (Phase 4-03 owner)
2. **Print or export as PDF** (70 items, takes ~30 min to review)
3. **Check off items weekly** (update in Google Sheets or Jira)
4. **Escalate blockers immediately** (section 10: escalation path)
5. **Sign-off before deployment** (appendix B template)

**Key milestones in checklist:**

- Item 1.1 (Secrets Manager) — blocking Phase 4 start
- Item 2.1 (API docs) — blocking Phase 4 start
- Item 7.3 (E2E test) — blocking Phase 4 deploy
- Appendix B (sign-off) — required before 2026-06-02

---

### TWILIO_INTEGRATION_SETUP_CHECKLIST.md

1. **Assign to Agent 1** (Phase 5-01 owner)
2. **Print or export as PDF** (80 items, takes ~35 min to review)
3. **Check off items weekly** (update in Google Sheets or Jira)
4. **Escalate blockers immediately** (section 12: escalation path)
5. **Sign-off before deployment** (appendix B template)

**Key milestones in checklist:**

- Item 1.1 (Account provisioned) — blocking Phase 5 start
- Item 2.1 (Phone numbers) — blocking Phase 5 start
- Item 8.3 (E2E test) — blocking Phase 5 deploy
- Item 9.1 (Cost estimation) — ongoing cost tracking
- Appendix B (sign-off) — required before 2026-06-30

---

### EMAIL_TEMPLATES_VENDOR_COORDINATION.md

1. **Copy Template 1 (NOTIVISA)** → customize placeholders → send 2026-05-15
2. **Copy Template 2 (Twilio)** → customize placeholders → send 2026-05-15
3. **Copy Template 3 (Internal)** → send to team 2026-05-15
4. **Optional: Copy Template 4 (SendGrid)** → send if fallback email service needs confirmation
5. **Track responses** in appendix B log (due dates, escalation triggers)
6. **After deployment:** Send Template 5 (post-go-live confirmation)

**Best practices:**

- Send templates during business hours (8am–10am BRT)
- CC engineering manager + CTO
- Set follow-up reminder (48 hours) if no response
- Document all responses in spreadsheet (appendix B)

---

### INTEGRATION_DEPENDENCY_MATRIX.md

1. **Review executive summary** (2-min read) to understand vendor integrations + critical path
2. **Check current phase** in "Phase Dependency Chain" (section 1)
3. **Before Phase 4 kickoff:** Review Phase 4 blockers (section A) + checkpoint 1 (section 8)
4. **Before Phase 5 kickoff:** Review Phase 5 blockers (section B) + checkpoint 3 (section 8)
5. **Weekly sync:** Update go/no-go status (section 8) + escalate any risks (section 7)
6. **Reference for escalation:** Section 7 (contingency plans for common failures)

**Key checkpoints (sign-offs required):**

- Checkpoint 1 (Phase 4 kickoff, 2026-05-19)
- Checkpoint 2 (Phase 4 deploy, 2026-06-01)
- Checkpoint 3 (Phase 5 kickoff, 2026-06-08)
- Checkpoint 4 (Phase 5 deploy, 2026-06-29)

---

## Integration Summary (for Stakeholders)

### What We're Building (Phase 4–5)

**Phase 4: NOTIVISA Integration (RDC 978 Art. 6º §1)**

- Notification of results to healthcare professionals via NOTIVISA portal
- Queue processor: Firestore event → NOTIVISA API → Webhook callback → Audit log
- Timeline: 2.5 weeks (2026-05-20 — 2026-06-02)
- Team: 4 agents (portal auth, UI, queue processor, E2E testing)

**Phase 5: Twilio SMS Escalation (RDC 978 Arts. 115–117)**

- Critical value alerts to operators via SMS (with email fallback)
- Threshold config + detection + escalation routing + SLA tracking
- Timeline: 3 weeks (2026-06-09 — 2026-06-30)
- Team: 4 agents (threshold config, SMS integration, IA training dataset, E2E testing)

### Dependencies & Risks

**Critical dependencies:**

- NOTIVISA sandbox credentials (vendor-controlled, ETA 2026-05-15)
- Twilio account + Brazil phone numbers (vendor-controlled, ETA 2026-05-20)
- Firestore schema (internal, Phase 3 complete ✅)
- Cloud Functions scaffolding (internal, Phase 3 complete ✅)

**Major risks:**

1. Vendor credential delays → Phase kickoff blocked (mitigation: escalate day 1 if delayed)
2. API integration mismatch → E2E test fails (mitigation: test with vendor support)
3. Twilio SMS service unavailable → Fallback to email (mitigation: SendGrid pre-tested ✅)
4. Firestore quota exceeded → System stops writing (mitigation: quota monitoring alerts)

### Success Criteria

**Phase 4 (NOTIVISA):**

- ✅ 3 callables deployed (RT login, laudo list, draft fetch)
- ✅ Portal UI responsive + WCAG AA (dark-first)
- ✅ NOTIVISA queue 100% event transmission
- ✅ E2E: 8 critical flows PASS
- ✅ Cloud Logs: 0 errors, <5% warnings
- ✅ Unit tests: 738/738 passing (zero regressions)

**Phase 5 (Twilio SMS):**

- ✅ SMS delivered <2 minutes after critical value
- ✅ SLA dashboard 100% uptime
- ✅ SMS + email fallback both operational
- ✅ E2E: 8 critical flows PASS
- ✅ Cloud Logs: 0 errors, <5% warnings
- ✅ Unit tests: 738/738 passing (zero regressions)

---

## Document Relationships

```
INTEGRATION_SETUP_INDEX.md (this file)
├─ Overview & timeline
├─ Links to 4 detailed documents
└─ How-to guide for each document

├─ NOTIVISA_INTEGRATION_SETUP_CHECKLIST.md
│  └─ 10 sections + 70 items
│  └─ For: Agent 3 + Phase 4 execution
│  └─ Sign-off: Required before 2026-06-02 deploy

├─ TWILIO_INTEGRATION_SETUP_CHECKLIST.md
│  └─ 12 sections + 80 items
│  └─ For: Agent 1 + Phase 5 execution
│  └─ Sign-off: Required before 2026-06-30 deploy

├─ EMAIL_TEMPLATES_VENDOR_COORDINATION.md
│  └─ 5 email templates + 2 appendices
│  └─ For: CTO + vendor communication
│  └─ Action: Send by 2026-05-15 EOD

└─ INTEGRATION_DEPENDENCY_MATRIX.md
   └─ Phase dependencies + go/no-go checkpoints
   └─ For: CTO + weekly sync orchestration
   └─ Action: Track blockers + escalate risks
```

---

## Quick Reference (One-Page Summary)

### Vendor Credentials (Blocking Milestones)

| Vendor   | Credential                    | ETA        | Owner      | Blocker          |
| -------- | ----------------------------- | ---------- | ---------- | ---------------- |
| NOTIVISA | Sandbox API key + docs        | 2026-05-15 | NOTIVISA   | Phase 4 kickoff  |
| Twilio   | Account SID + 2 phone numbers | 2026-05-20 | Twilio     | Phase 5 kickoff  |
| SendGrid | Confirm email fallback ready  | 2026-05-20 | HC Quality | Phase 5 optional |

### Key Dates

| Date       | Event                              | Blocker? | Owner    | Document           |
| ---------- | ---------------------------------- | -------- | -------- | ------------------ |
| 2026-05-15 | Send vendor emails (Templates 1–3) | No       | CTO      | EMAIL_TEMPLATES    |
| 2026-05-16 | Receive NOTIVISA credentials       | **YES**  | NOTIVISA | NOTIVISA_CHECKLIST |
| 2026-05-19 | Phase 4 go/no-go gate              | **YES**  | CTO      | DEPENDENCY_MATRIX  |
| 2026-05-20 | Phase 4 kickoff                    | **YES**  | Agent 3  | NOTIVISA_CHECKLIST |
| 2026-06-02 | Phase 4 deploy                     | —        | Agent 3  | NOTIVISA_CHECKLIST |
| 2026-06-08 | Phase 5 go/no-go gate              | **YES**  | CTO      | DEPENDENCY_MATRIX  |
| 2026-06-09 | Phase 5 kickoff                    | **YES**  | Agent 1  | TWILIO_CHECKLIST   |
| 2026-06-30 | Phase 5 deploy                     | —        | Agent 1  | TWILIO_CHECKLIST   |

### Escalation Contacts

**L1 (Agent):**

- Agent 3 (Phase 4-03, NOTIVISA): [email] | [phone]
- Agent 1 (Phase 5-01, Twilio): [email] | [phone]

**L2 (Manager):**

- Engineering Manager: [email] | [phone]

**L3 (CTO):**

- CTO (vendor coordination, architectural decisions): [email] | [phone]

---

## File Locations (Absolute Paths)

All documents stored in `C:\hc quality\docs\`:

1. `NOTIVISA_INTEGRATION_SETUP_CHECKLIST.md`
2. `TWILIO_INTEGRATION_SETUP_CHECKLIST.md`
3. `EMAIL_TEMPLATES_VENDOR_COORDINATION.md`
4. `INTEGRATION_DEPENDENCY_MATRIX.md`
5. `INTEGRATION_SETUP_INDEX.md` (this file)

---

## Status & Next Steps

**Current status:** All 4 documents + index ready for Phase 4–5 execution  
**Next action:** CTO reviews + customizes email templates (2026-05-13)  
**Send date:** 2026-05-15 (5 days before Phase 4 kickoff)  
**Target:** NOTIVISA credentials received by 2026-05-16; Twilio by 2026-05-20

---

**Last Updated:** 2026-05-07  
**Owner:** CTO  
**Status:** Ready for distribution to Phase 4–5 teams
