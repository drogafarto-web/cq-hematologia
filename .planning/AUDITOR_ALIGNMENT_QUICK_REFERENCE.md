# Auditor Alignment — Quick Reference & Copy-Paste Guide

**Version:** 1.0  
**Date:** 2026-05-07  
**Purpose:** Fast reference sheet for CTO to execute alignment email + call  
**Format:** Copy-paste ready sections

---

## Section 1: Email (Copy-Paste Ready)

### Subject Line

```
HC Quality v1.4 Roadmap — Pre-Audit Alignment Call (90 min, Week of May 13–17)
```

### Email Body (Ready to Send)

---

Dear [AUDITOR_NAME],

**Re: HC Quality v1.4 Roadmap — Pre-Audit Alignment Call**

HC Quality v1.3 successfully deployed to production on **May 7, 2026**, achieving **78.5% DICQ compliance** and **100% RDC 978 mandatory article coverage** across 25 production modules.

We are now executing **v1.4**, a 14-week roadmap targeting **≥88% DICQ compliance** before your external audit on **October 15, 2026**. Our critical phases are:

- **Phase 4 (May 20 – Jun 2):** Patient Portal + NOTIVISA Integration
- **Phase 5 (Jun 9 – Jun 30):** Critical Values Escalation + Gemini Vision IA
- **Phase 6 (Jun 30 – Jul 14):** CAPA Closure + Auditoria (auditor evidence sign-off)
- **Phase 8 (Jul 15 – Aug 18):** NOTIVISA Edge Cases + Lab Support Contracts

**We would like to schedule a 90-minute pre-Phase 1 alignment call the week of May 13–17** to lock evidence standards, RFI SLA, and compliance matrix interpretations. This is critical to prevent rework on Phase 4 CAPA evidence format.

**Proposed Agenda (90 min):**

1. **v1.3 Status Review (20 min):** Deployment, smoke tests, production baseline
2. **v1.4 Plan Walkthrough (30 min):** 4 RDC blockers, 22-week roadmap, DICQ trajectory
3. **RFI Cadence Agreement (20 min):** SLA (target 5 business days), submission channel, escalation path
4. **Evidence Standards (15 min):** Digital signature (LogicalSignature), tamper evidence (chainHash), document retention
5. **Q&A + Action Items (5 min):** Confirm next checkpoint (Week 3)

**Pre-Call Materials (attached):**

- v1.4 Auditor Briefing (14 pages, complete roadmap)
- v1.4 DICQ Coverage Matrix (block-by-block compliance)
- v1.4 RDC Coverage Matrix (article-by-article)
- Auditor RFI Preparation (15 Q&A pairs)

**Key Questions for the Call:**

1. Is LogicalSignature (SHA-256 hash + operatorId + timestamp) acceptable as digital signature for DICQ 4.4 / RDC 978?
2. Is chainHash (event-chained audit trail with HMAC baseline reset) sufficient for tamper-evidence?
3. Firestore native + cold-archive retention (5 years per RDC 978) — acceptable?
4. CAPA closure ceremony — email + video sign-off, or in-person required?
5. If Phase 4 slips (auditor delay >7 days), can non-P0 CAPAs defer to v1.4.1 post-launch?

Looking forward to partnering for audit success. Please confirm your availability for May 13–17, and I'll send the Zoom link and briefing materials.

Best regards,

**drogafarto**  
CTO, HC Quality  
drogafarto@gmail.com  
[Phone: TBD]

---

## Section 2: Calendar Invites

### Alignment Call (Week 1)

```
Event: HC Quality v1.4 Auditor Alignment
Date: [SELECT May 13, 14, or 15, TBD after auditor response]
Time: 10:00 AM Brasília (UTC-3)
Duration: 90 minutes
Attendees: [AUDITOR_NAME], drogafarto (CTO), [QA_LEAD]
Zoom Link: [TBD]
```

### Phase 4 Weekly Reviews (8 Fridays)

```
Event: HC Quality v1.4 Phase 4 CAPA Evidence Review
Recurring: Every Friday starting May 28 through July 23
Time: 10:00 AM Brasília
Duration: 30 minutes
Attendees: [AUDITOR_NAME], [QA_LEAD], drogafarto (optional)
Zoom Link: [TBD]
Agenda: Weekly CAPA evidence package review + auditor sign-off
```

---

## Section 3: Pre-Call Checklist (1 Week Before)

### By CTO (5 days before)

- [ ] Confirm auditor email + name
- [ ] Send email draft (customize + proofread)
- [ ] Attach briefing + RFI prep
- [ ] Await auditor response (target: within 2 days)

### By QA Lead (3 days before)

- [ ] Prepare live demo walkthrough (30 min):
  - [ ] Auth flow (email-link portal access)
  - [ ] Audit trail chainHash verification
  - [ ] Signed laudo PDF + LogicalSignature payload
  - [ ] CAPA-001 evidence mock-up
- [ ] Export 3 anonymized audit trail samples
- [ ] Export 2 sample signed laudos
- [ ] Prepare printed CAPA state machine diagram

### By CTO (1 day before)

- [ ] Test Zoom screen-share + audio
- [ ] Prepare 90-min agenda printout
- [ ] Confirm CTO + QA Lead both available + on-time
- [ ] Send auditor Zoom link + materials reminder

---

## Section 4: Call Notes Template

### Meeting Minutes (copy-paste after call)

---

**Meeting:** HC Quality v1.4 Auditor Alignment  
**Date:** [DATE]  
**Attendees:** [AUDITOR_NAME], drogafarto (CTO), [QA_LEAD]  
**Duration:** 90 minutes  
**Next Meeting:** Phase 4 weekly review, Friday May 28

**Part 1 — v1.3 Status Review**

- ✅ v1.3 deployed May 7 (25 modules, 78.5% DICQ, 100% RDC 978)
- ✅ 19/19 smoke tests passing, 0 errors 24h
- ✅ HMAC incident (ADR-0017) + deploy gate (ADR-0018) explained
- ✅ Live demo: audit trail chainHash + signed laudo + LogicalSignature

**Part 2 — v1.4 Roadmap Walkthrough**

- ✅ Phase 0 (RDC blockers): turnos, LGPD, lab-apoio, risks
- ✅ Phases 4–6 (critical gates): portal, critical values, CAPA
- ✅ DICQ trajectory: 78.5% → 88.5% (May → Aug)
- ✅ Deferred: multi-tenant, NOTIVISA prod, Gemini fine-tuning

**Part 3 — RFI Cadence Agreement**

- **RFI SLA: 5 business days** (auditor confirms: YES / NO / CONDITIONAL)
- **Submission channel:** Shared SGD folder + email notification
- **Escalation:** CTO direct call if >5 days delayed
- **Phase 4 weekly reviews:** Fridays 10:00 AM Brasília, 30 min

**Part 4 — Evidence Standards Confirmation**

- **LogicalSignature acceptable?** Auditor response: ******\_\_\_******
- **chainHash + HMAC baseline sufficient?** Auditor response: ******\_\_\_******
- **Firestore retention + cold-archive?** Auditor response: ******\_\_\_******
- **Any adjustments needed?** YES / NO — If YES, describe: ******\_\_\_******

**Part 5 — Action Items**
| Item | Owner | Due | Status |
|------|-------|-----|--------|
| RFI SLA document (email) | Auditor | 2026-05-10 | **\_** |
| Evidence format confirmation | Auditor | 2026-05-10 | **\_** |
| Phase 4 calendar lock | QA Lead | 2026-05-11 | **\_** |
| STATE.md update | CTO | 2026-05-11 | **\_** |

**Risks / Open Questions**

- (none captured during call) / List any concerns here

**Next Checkpoint**

- **Date:** Friday, May 28 (Phase 4 Week 1)
- **Format:** 30-min Zoom, CAPA evidence review
- **Preparation:** QA Lead uploads CAPA-001 to CAPA-TRACKING.xlsx + SGQ folder

---

## Section 5: One-Pagers

### DICQ Compliance Snapshot

```
v1.3 Baseline (2026-05-07):
- Block A (Governança): 78%
- Block B (Gestão Documental): 65%
- Block C (Pessoal): 80%
- Block D (Ambiente): 65%
- Block E (Pré-analítico): 72%
- Block F (Analítico): 85%
- Block G (Pós-analítico): 78%
- Block H (Garantia QA): 75%
- Block I (Laudos/Liberação): 80%
- Block J (Continuidade): 70%
WEIGHTED AVERAGE: 78.5%

v1.4 Target (2026-08-31):
- All blocks ≥75% (except E/D at +10% base)
WEIGHTED AVERAGE TARGET: 88.5% (range 85–92% actual)
```

### RDC 978 Mandatory Articles

```
v1.3: 100% coverage of Arts. 117, 167, 179–191, 204
v1.4: 100% of above + Arts. 77, 122, 36–39, 86
Status: AUDIT-READY before Phase 1 (May 14)
```

### Critical Phases (Auditor Gates)

```
Phase 0: RDC blockers (turnos, LGPD, lab-apoio, risks)
→ Gate: Day 10 hard stop (May 17) + bridge docs if slip

Phase 4: Portal + NOTIVISA (auditor evidence review)
→ Gate: 12 CAPAs + weekly sign-off (Fridays)
→ SLA: 5 business days per submission

Phase 6: CAPA closure ceremony
→ Gate: Auditor formal sign-off (email OK)
→ Evidence: root cause + corrective action + efficacy

Phase 13: Pre-audit matrix review
→ Gate: Auditor confirms "audit-ready" status
→ Deadline: Aug 19 (12 days before Oct 15 audit)
```

---

## Section 6: Risk Mitigation Scripts

### If Auditor Unavailable May 13–17

```
EMAIL:
Subject: Backup Plan — HC Quality v1.4 Auditor Alignment

Dear [AUDITOR_NAME],

I understand May 13–17 is not available. No problem — let's execute via written RFI instead.

I'll send you the full artifact bundle (briefing, coverage matrices, CAPA template, ADRs).
Please review and respond within 7 business days with:

1. RFI SLA agreement (5 business days acceptable? Y/N)
2. Evidence format sign-off (LogicalSignature + chainHash acceptable? Y/N)
3. Any interpretation conflicts on RDC articles (if any)

Meantime, we'll proceed with Phase 0 (RDC blockers) but freeze Phase 1 entry until we have written confirmation.

If needed, we'll also engage an external regulatory consultant for a 2-day compliance review ($5k cost).

Looking forward to your response.

Best,
drogafarto
```

### If Auditor Rejects LogicalSignature

```
EMAIL:
Subject: LogicalSignature Technical Discussion — PKI Alternative

Dear [AUDITOR_NAME],

Thank you for the feedback on LogicalSignature format. I understand your concern about PKI-grade signing.

Here are our options:

1. **Current approach (v1.4):** LogicalSignature (SHA-256 + operatorId + ts) — meets RDC 978 Art. 115 + RDC 786 Art. 21 for audit trail; acceptable for lab internal evidence
2. **PKI approach (v2.0):** Cloud HSM + certificate signing — ~$15k/year, full non-repudiation, preferred for regulatory reporting
3. **Compromise:** Use LogicalSignature v1.4; add PKI layer v2.0 (6-month post-launch timeline)

I'd like to discuss this with you + external legal counsel. Can we schedule a 30-min call this week?

Best,
drogafarto
```

### If CAPA Backlog (Auditor Delayed >5 Days)

```
EMAIL:
Subject: ESCALATION — Phase 4 CAPA Evidence Review Delayed

Dear [AUDITOR_NAME],

I noticed CAPA-[N] evidence review is now [X] days past the 5-business-day SLA.

To keep Phase 4 on track, I'd like to:
1. Check if you need additional information on the submission
2. Propose a catch-up call Friday [DATE] 10:00 AM to clear the backlog
3. Defer any non-P0 CAPAs to v1.4.1 post-launch (if needed to stay on critical path)

Can you confirm your availability this Friday?

Best,
drogafarto (CTO)
Phone: [PHONE]
```

---

## Section 7: Key Dates & Reminders

### Timeline

```
May 7:      v1.3 live + v1.4 package ready
May 7–11:   Send email draft to auditor + briefing materials
May 13–17:  90-min alignment call (target 5/13 or 5/14)
May 17:     Post-call actions due (RFI SLA doc, evidence sign-off, calendar lock)
May 28:     Phase 4 Week 1 review (CAPA-001 evidence due Mon 5/27)
Jun 2:      Phase 4 deploy (portal + NOTIVISA queue go-live)
Jun 9:      Phase 5 kickoff (critical values + IA)
Jun 30:     Phase 5 deploy (critical values live, 92% OCR accuracy baseline)
Jul 14:     Phase 6 deploy (CAPA closure module live)
Aug 15:     Phase 13 pre-audit matrix review (target 85%+ DICQ confirmed)
Aug 31:     v1.4 production launch (all phases complete)
Sep 15:     Buffer (v1.4.1 hotfixes, monitoring)
Oct 15:     External audit execution (DICQ accreditation)
```

### Recurring Reminders

```
- **Every Monday (during Phase 4):** Remind auditor CAPA evidence due Friday
- **Every Thursday (during Phase 4):** Check inbox for auditor response
- **Every Friday (Phase 4–6):** 30-min review call + sign-off target
- **Weekly (all phases):** Cloud Logs monitoring report + SLA dashboard
- **Every 2 weeks (Phase 0–9):** Risk register review (escalate any prob×impact >6/10)
```

---

## Section 8: Document Cross-References

### Briefing Components

| Document              | Location                                         | Audience              | Purpose                      |
| --------------------- | ------------------------------------------------ | --------------------- | ---------------------------- |
| **Email Draft**       | `.planning/AUDITOR_ALIGNMENT_EMAIL_DRAFT.md`     | CTO                   | Invitation + key facts       |
| **RFI Prep (15 Q&A)** | `.planning/AUDITOR_RFI_PREPARATION.md`           | Auditor + internal    | FAQ + security posture       |
| **v1.4 Briefing**     | `docs/v1.4_AUDITOR_BRIEFING.md`                  | Auditor + CTO + board | Complete roadmap (14 pages)  |
| **Alignment Package** | `.planning/v1.4_AUDITOR_ALIGNMENT_PACKAGE.md`    | CTO                   | Overview of all 3 docs       |
| **Quick Reference**   | `.planning/AUDITOR_ALIGNMENT_QUICK_REFERENCE.md` | CTO                   | This file — copy-paste ready |

### Related Artifacts (Shared during Call)

- `docs/v1.4-DICQ-COVERAGE-MATRIX.md` (40+ blocks A–J)
- `docs/v1.4-RDC-COVERAGE-MATRIX.md` (200+ articles)
- `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` (incident + remediation)
- `docs/adr/ADR-0018-deploy-gate-secret-status-check.md` (prevention mechanism)
- `docs/v1.4-RISK-REGISTER.md` (19 active risks, all mitigated)

---

## Section 9: Post-Call Follow-Up Script

### Email (send within 24 hours of call)

---

**Subject:** HC Quality v1.4 — Alignment Call Summary & Next Steps

Dear [AUDITOR_NAME],

Thank you for the productive 90-minute alignment call on [DATE]. Here's a summary of decisions made:

**Confirmed Points:**

- ✅ Phase 0 scope (4 RDC blockers) sufficient for May 14 Phase 1 kickoff
- ✅ RFI SLA: 5 business days (Mondays submit, Fridays respond)
- ✅ Evidence standards: LogicalSignature + chainHash + Firestore retention **approved**
- ✅ Phase 4 weekly reviews: Fridays 10:00 AM Brasília, starting May 28

**Action Items:**

| Item                                  | Owner   | Due    | Status |
| ------------------------------------- | ------- | ------ | ------ |
| RFI SLA document (email confirmation) | You     | May 10 | **\_** |
| Evidence format sign-off (email)      | You     | May 10 | **\_** |
| CAPA-001 mock-up submission           | QA Lead | May 27 | **\_** |
| Phase 4 calendar lock (8 Fridays)     | QA Lead | May 11 | **\_** |

**Next Milestone:**

- **Phase 4 Week 1 Review:** Friday, May 28, 10:00 AM Brasília
- **Deliverable:** CAPA-001 evidence package (root cause + corrective action + efficacy)
- **Zoom link:** [Link in calendar invite]

**Open Questions** (if any):
(List here if auditor raised unresolved issues)

Looking forward to continuing the partnership. Please confirm receipt of this email + RFI SLA document by end of business Friday, May 10.

Best regards,

**drogafarto**  
CTO, HC Quality  
drogafarto@gmail.com

---

## Section 10: Success Metrics

### Alignment Call is Successful If:

- [ ] Auditor confirms Phase 0 scope sufficient
- [ ] RFI SLA documented in writing (5 business days)
- [ ] Evidence standards confirmed (no post-Phase-2 rework)
- [ ] Next checkpoint scheduled (Week 3, May 28)
- [ ] Phase 4 weekly reviews calendar locked
- [ ] No show-stopper gaps identified

### v1.4 Stays On Track If:

- [ ] Phase 0 completes by May 17 (Day 10 + 1-day buffer)
- [ ] Phase 4 CAPA evidence reviewed within SLA each week
- [ ] No major interpretation conflicts surface post-Week 1
- [ ] DICQ tracking toward 85%+ by Aug 15
- [ ] External audit scheduled for Oct 15 (no date slip)

---

**Status:** ✅ Ready to use  
**Last Updated:** 2026-05-07  
**Owner:** CTO  
**Next Step:** Customize email + send to auditor by end of business Day 1
