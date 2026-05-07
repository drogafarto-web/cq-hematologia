# Auditor Communication Templates — v1.4 (2026-05-07)

**Purpose:** Ready-to-send templates for weekly updates, RFI responses, monthly reports, and escalations.

**Owner:** Audit Lead (executes from these templates)

---

## Template 1: Weekly Auditor Update Email (Friday 10:30 BRT)

**Subject:** HC Quality Weekly Update — Week X Phase Y [DICQ ✅ / 🟡 / 🔴]

```
Prezado Ernani,

Segue o resumo de conformidade da semana de DD–DD de maio.

HEADLINE METRICS
┌─────────────────────────────────────────────┐
│ DICQ:           78.5% → [XX%] (target 88%)   │
│ RDC 978:        17/20 → [XX/20] (target 20)  │
│ LGPD:           62% → [XX%] (target 85%)     │
│ Tests:          738/738 passing ✅             │
│ Cloud Logs:     0 errors, X warnings ✅       │
│ Status:         🟢 On track                    │
└─────────────────────────────────────────────┘

PHASE X PROGRESS
- Task 1: 50% done (on track for DD)
- Task 2: 30% done (on track for DD)
- Task 3: 0% done (starting DD)

RFI RESPONSES THIS WEEK
✅ RFI-XXX answered (sent 2026-05-DD)
✅ RFI-YYY answered (sent 2026-05-DD)
⏳ RFI-ZZZ in progress (due 2026-05-DD)

KNOWN ISSUES
🟡 [Issue description] — Remediation: [action] by [date]

AUDITOR CALL SCHEDULED
📅 Friday DD May, 10:00–10:30 BRT
📍 Google Meet: [link]
📋 Agenda: Weekly status + RFI feedback + Phase X blockers

BLOCKERS / ESCALATIONS
✅ None this week. On schedule for Phase X deploy [DATE].

NEXT WEEK FORECAST
- Phase Y kickoff (expected DD)
- DICQ trend: expect +0.7% (trend line on track for 88% by Aug 4)
- RFI resolution: 2 responses due DD

---

Qualquer dúvida ou feedback, fico à disposição.

Um abraço,
[Audit Lead name]
Compliance Lead, HC Quality
[email]

---

CC: [CTO]
Files attached: 
- weekly_scorecard_week_X.xlsx
- phase_X_status_update.md
```

---

## Template 2: RFI Response Email (Response due within 5 business days)

**Subject:** RFI Response — RFI-XXX [Topic] (HC Quality v1.4)

```
Prezado Ernani,

Re: RFI-XXX — [Auditor question topic]

Sua pergunta:
"[Restate the exact question from auditor, in quotes]"

Resposta:

[Detailed technical response, 3-5 sentences, with clear examples]

Exemplos de implementação:
- [Code file reference: `/src/features/module/file.ts` line 123]
- [Test coverage: `functions/src/__tests__/test.spec.ts` line 45]
- [ADR reference: `docs/adr/ADR-XXXX.md` Section Y]

Evidência de testes:
✅ Unit tests pass (138/138)
✅ E2E test flow "Create → Verify → Archive" passes
✅ Cloud Logs: 0 errors in production (last 24h)

Próximo passo:
[If follow-up needed: "We'll implement [action] by [date] and send you an update."]
[If complete: "This closes RFI-XXX. Please confirm if you need additional evidence."]

---

Um abraço,
[Name]
Compliance Lead, HC Quality

---

CC: CTO
Attachments:
- RFI-XXX-evidence.pdf (code snippets + test output)
- ADR-XXXX.md (if applicable)
```

---

## Template 3: Monthly Compliance Report Email (Last Friday 17:30 BRT)

**Subject:** Monthly Compliance Report — [Month] 2026 · HC Quality

```
Prezado Ernani,

Segue o relatório consolidado de conformidade para [month] de 2026.

RESUMO EXECUTIVO

DICQ:        78.5% → [XX%] (↑ [X%] this month, target 88% by Aug 31)
RDC 978:     17/20 → [XX/20] (↑ X articles, target 20/20 by Jul 1)
LGPD:        62% → [XX%] (↑ [X%], target 85% by Aug 31)
Tests:       738/738 ✅ | Cloud Logs: Clean ✅ | Audit Trail: 100% integrity ✅

Fases completadas este mês:
✅ Phase X (expected deliverable Y, DICQ +Z%)

Fases em execução:
🟡 Phase Y (Week X/Y, on pace for deploy DD/month)

RFIs respondidas:
✅ RFI-001 → RFI-010 (X total, average response time 3 days)

Bloqueadores / Escalações:
✅ None. All artifacts and milestones on schedule.

Próximas prioridades (próximo mês):
1. Phase Z kickoff (DD)
2. DICQ target: [TBD%] by month end
3. RDC 978: Fechar articles [X, Y] (Phase Q)

---

DETALHES TÉCNICOS

DICQ Block-by-Block:
[Table with A–J blocks, coverage %, phase closure]

RDC 978 Status:
✅ 5.3, 86, 167, 204 — Complete
🟡 6, 99, 115, 117, 147 — In progress (Phase 4–5)

LGPD Checklist:
[Articles 6, 7, 9, 18, 19, 17, 34 with status]

Known Issues & Remediation:
[Issue table: severity, reported date, root cause, remediation, ETA]

Auditor Calls Summary:
- Calls held: X (all on schedule)
- Average duration: 30 min
- Feedback themes: [Key patterns from auditor feedback]
- Call recordings: [Google Drive folder link]

---

PRÓXIMOS PASSOS

1. Revisar este relatório até [date]
2. Confirmar aprovação para [Phase/Action]
3. Agendar call se feedback/questões: [calendar link]

Qualquer dúvida, fico à disposição para uma call síncrona.

Um abraço,
[Audit Lead name]
Compliance Lead, HC Quality

---

CC: CTO
Attachments:
- COMPLIANCE_REPORT_[MONTH]_2026.pdf (full report)
- COMPLIANCE_SCORECARD_[MONTH]_2026.xlsx (daily trends)
- ARTIFACTS_CHECKLIST_[MONTH]_2026.md (all evidence)
```

---

## Template 4: Phase Completion Notification (Upon Phase deploy)

**Subject:** Phase X Complete — [XX artifacts] deployed · DICQ → [XX%]

```
Prezado Ernani,

Informamos a conclusão da Phase X do HC Quality v1.4.

PHASE X SUMMARY

Deliverables:
✅ 5 Cloud Functions (portal auth, laudo list, draft fetch, signature, audit log)
✅ 8 UI components (dark-first, WCAG AA, responsive)
✅ 12 integration tests (100% pass)
✅ 8 E2E critical flows (100% pass)
✅ 24h Cloud Logs validation (0 errors, 3 benign warnings)

DICQ Impact:
Block I (Laudo Release): 75% → [XX%] (✅ +[X%])
Overall DICQ: 78.5% → [XX%] (✅ +[X%])

RDC 978 Impact:
Articles 6 (notification), 167 (laudo signature), 204 (audit trail): ✅ 100% coverage
New articles covered: [Article X, Y] (2 total)

LGPD Impact:
✅ Email link auth + explicit checkbox (Phase X)
✅ Audit trail for portal access (100% coverage)

Compliance Artifacts:
📄 Phase X PLAN.md (execution + verification)
📄 ADR-XXXX (architectural decision for draft locking)
📄 E2E Test Results (8/8 pass)
📄 Cloud Logs Analysis (24h clean)
📄 Security review (no findings)

Próximas Fases:
🟡 Phase X+1 (kickoff [date], expected deploy [date])

---

VERIFICATION CHECKLIST

Pre-production verification (completed 2026-05-DD):
✅ Type-checking (tsc --noEmit): 0 errors
✅ Unit tests: 738/738 passing (no regressions)
✅ E2E tests: 8/8 flows passing
✅ Rules validation: 23/23 scenarios passing
✅ Bundle size: 362 KB (baseline +0%)
✅ Cloud Logs: 0 errors (24h post-deploy)

---

DEPLOYMENT DETAILS

Deploy timestamp: 2026-05-DD 22:15 UTC (19:15 BRT)
Deploy order: Rules (00:05) → Functions (00:15) → Hosting (00:25) → Smoke tests
Rollback ready: ✅ Yes (previous commit: [SHA])
Signed by: [CTO name]

---

AUDITOR ALIGNMENT

✅ Phase X architecture reviewed + approved (call 2026-05-DD)
✅ RFI feedback incorporated (RFI-XXX, RFI-YYY)
✅ No blocking compliance findings

Next auditor call: [Date DD at 10:00 BRT]

---

NEXT MILESTONE

Phase X+1 kickoff: [Date]
Expected DICQ gain: +[X%] (target 88% by Aug 4)
Expected RDC articles: +X (target 20/20 by Jul 1)

---

Qualquer dúvida ou validação manual necessária, fico à disposição.

Um abraço,
[Audit Lead / CTO]
HC Quality

---

CC: [team]
Attachments:
- Phase_X_Completion_Report.pdf
- Smoke_Test_Results.txt
- Cloud_Logs_24h_Analysis.xlsx
```

---

## Template 5: Blocking Issue Escalation (Immediate, if discovery)

**Subject:** 🔴 BLOCKING ISSUE — [Issue] · HC Quality v1.4 (URGENT)

```
Prezado Ernani,

Identificamos um bloqueador de conformidade que requer atenção imediata.

ISSUE SUMMARY

Issue: [Issue title]
Severity: 🔴 CRITICAL
Discovered: [Date time]
Impact: [RDC 978 Articles X, Y, Z not covered] / [DICQ Block X affected]

ROOT CAUSE
[Technical root cause explanation]

IMMEDIATE REMEDIATION
✅ Action taken: [Immediate mitigation, if any]
📋 Planned fix: [Detailed remediation plan]
⏰ ETA: [Expected resolution date]
👤 Owner: [Engineer name]

CONTINGENCY TIMELINE
If remediation delayed 1 week:
- DICQ impact: [TBD%] (target [XX%])
- RDC 978 impact: Articles X, Y at risk
- Phase X deploy: [Delayed 1 week to [DATE]] / [Unaffected]

EVIDENCE
- Code reference: [File path]
- Test results: [Link to failing test]
- Cloud Logs: [Error snippet]

---

AUDITOR DECISION NEEDED

Option A: [Proceed with remediation timeline, accept [DATE] delay]
Option B: [Implement workaround by [DATE], full fix Phase X+1]
Option C: [Other]

Sua recomendação:

---

Next status update: [Date/time]
Contact for questions: [Your email]

Um abraço,
[Audit Lead / CTO]

---

CC: [CTO, Engineering leads]
Attachments:
- Issue_Evidence.pdf (logs, code snippets)
- Remediation_Plan.md
```

---

## Template 6: Pre-Alignment Ceremony Agenda (Due 2 days before call)

**Subject:** Pre-Alignment Ceremony Agenda — May 15, 2026 · 90-min session

```
Prezado Ernani,

Confirmo nosso alinhamento de conformidade agendado para:

📅 Quarta, 15 de maio de 2026
⏰ [TIME] – [TIME+90min] BRT
📍 Google Meet: [link]

AGENDA (90 MINUTOS EXATOS)

0:00–0:10 (10 min) — v1.3 Recap + v1.4 Overview
├─ v1.3 completion: 25 modules, 78.5% DICQ, RDC critical articles 100%
├─ v1.4 roadmap: 15 phases, 4 months, DICQ target 88%+
└─ Critical path: Phase 4 (May 20) → Phase 8 CAPA ceremony (Aug 5) → External audit (Oct 2026)

0:10–0:35 (25 min) — Architecture Deep Dive
├─ Portal auth pattern (ADR-0015): email-link + session + LGPD consent
├─ NOTIVISA queue pattern (ADR-0021): async append-only + exponential backoff
├─ Draft laudo locking (ADR-0020): pessimistic locking via callable
├─ Firestore rules governance: match by labId, RBAC via member doc
├─ Audit trail + LogicalSignature (ADR-0012): HMAC + chain-hash + synthetic events
└─ [LIVE CODE WALKTHROUGH: Show rules in IDE, audit trail Firestore doc, CloudFunction callable]

0:35–0:55 (20 min) — Compliance Mapping
├─ RDC 978: 9 critical articles, 7/9 complete (Arts. 5.3, 86, 167, 204 done; 6, 115, 117 Phase 4–5)
├─ DICQ 4.3: Block A–J mapping, 78.5% baseline, +1-2%/week target, Phase 6 critical (Blocks H, I)
├─ LGPD: Articles 6, 7, 9 Phase 5; Articles 18, 19, 17, 34 Phase 7–13
└─ Q&A: Any compliance ambiguities?

0:55–1:15 (20 min) — Phase 4–7 Execution Plans
├─ Phase 4: Portal + NOTIVISA (May 20 → Jun 2) — 4 agents, 2.5 weeks
├─ Phase 5: Critical escalation + IA (Jun 9 → Jun 30) — 4 agents, 3 weeks
├─ Phase 6–7: Portal completions (Jul 1 → Jul 28)
├─ Phase 8: CAPA closure (Jun 15–Aug 5) — CTO-owned, auditor-dependent
└─ Resource allocation: Approved?

1:15–1:25 (10 min) — RFI Feedback Loop + Contingencies
├─ Weekly call structure (Fridays 10:00 BRT) confirmed?
├─ RFI response SLA (5 business days) acceptable?
├─ Contingency: If Phase X + X+1 delay 2 weeks, DICQ target becomes 86% → Still acceptable? Auditor concern?
└─ Escalation matrix: Who do we contact if critical blocker?

1:25–1:30 (5 min) — Go/No-Go Decision for Phase 4
├─ 🟢 Go: Phase 4 kicks off May 20 (unless auditor flags blocking concern)
├─ 🟡 Conditional: Phase 4 on hold pending [specific action] by [date]
└─ 🔴 No-Go: Phase 4 delayed to [date] due to [reason]

---

PRE-CALL PREP FOR YOU

Materials to review (sent separately):
✅ v1.4_AUDITOR_BRIEFING.pdf (14 pages)
✅ ADR-0015, ADR-0020, ADR-0021, ADR-0012 (4 formal decisions)
✅ Phase 4 PLAN.md (execution + tasks)
✅ DICQ block mapping (spreadsheet)

Pre-call questions (optional):
If you have specific questions before the call, please send them by [DATE] and we'll prepare focused answers.

---

RECORDING + FOLLOW-UP

- Call will be recorded (with your consent) for internal documentation
- Post-call summary emailed within 2h with:
  * Agenda recap
  * Key decisions + confirmations
  * Action items + owners + due dates
  * RFI feedback (if any)

---

Link de confirmação: [Google Calendar link]

Qualquer dúvida antes da sessão, fico à disposição.

Um abraço,
[CTO name]
CTO, HC Quality

---

CC: [Audit Lead]
Attachments:
- v1.4_AUDITOR_BRIEFING.pdf
- ADR-0015-0021-0012.zip
- Phase_4_PLAN.md
- DICQ_Block_Mapping.xlsx
```

---

## Template 7: Post-Call Summary Email (Send within 2 hours of call end)

**Subject:** Resumo — Alinhamento de Conformidade v1.4 · 15 maio 2026

```
Prezado Ernani,

Segue o resumo da nossa sessão de 90 minutos de hoje.

ATTENDANCE
✅ Ernani (auditor)
✅ [CTO name] (HC Quality CTO)
✅ [Audit Lead] (Compliance Lead)

AGENDA RECAP

[0:00–0:10] v1.3 Recap + v1.4 Overview ✅
→ Confirmado: v1.3 78.5% DICQ, 100% critical RDC articles, ready for v1.4

[0:10–0:35] Architecture Deep Dive ✅
→ Confirmado: Portal auth, NOTIVISA queue, draft locking, audit trail patterns
→ Question: [if any] → Answer: [response given]

[0:35–0:55] Compliance Mapping ✅
→ Confirmado: RDC 978 roadmap, DICQ blocks A–J mapping
→ Concern: [if any] → Mitigation: [discussed]

[0:55–1:15] Phase 4–7 Plans ✅
→ Confirmado: Resource allocation approved, Phase 4 kickoff May 20
→ Flag: [if any] → Remediation: [discussed]

[1:15–1:25] RFI Feedback Loop + Contingencies ✅
→ Confirmado: Weekly calls Fridays 10:00 BRT, RFI SLA 5 days, escalation contacts

[1:25–1:30] Go/No-Go Decision ✅
→ ✅ **GO**: Phase 4 kickoff approved for May 20

---

KEY DECISIONS

1. ✅ Phase 4 launch: May 20, 2026 (no blockers)
2. ✅ CAPA ceremony: Aug 5, 2026 (Phase 8 closeout)
3. ✅ External audit target: Oct 31, 2026
4. ✅ Weekly auditor calls: Every Friday 10:00 BRT (starting May 24)
5. ✅ RFI response SLA: 5 business days (escalate CTO if at risk)

---

ACTION ITEMS

| Item | Owner | Due Date | Status |
|---|---|---|---|
| Send Phase 4 kickoff email to team | CTO | 2026-05-16 | Assigned |
| Confirm Ernani's calendar for Friday weekly calls | Audit Lead | 2026-05-16 | Assigned |
| Deploy Phase 4 artifacts + CI/CD setup | Engineering | 2026-05-20 | On track |
| [If additional RFI] | [Owner] | [Date] | [Status] |

---

AUDITOR FEEDBACK (HIGH-LEVEL)

**Positive feedback:**
✅ [Theme 1: e.g., "Portal design is solid, LGPD consent flow is clear"]
✅ [Theme 2: e.g., "Firestore rules governance well-structured"]

**Questions/Concerns (if any):**
🟡 [Concern 1] → [Our response] → ✅ Resolved / ⏳ Follow-up action [assigned to X, due Y]
🟡 [Concern 2] → [Our response] → ✅ Resolved / ⏳ Follow-up action [assigned to X, due Y]

**Overall Assessment:**
✅ Ernani approved v1.4 roadmap, no blocking findings. Ready to proceed.

---

NEXT STEPS

1. **May 20:** Phase 4 begins (portal auth + NOTIVISA queue)
2. **May 24:** First weekly auditor call (Fri 10:00 BRT) with Phase 1 status
3. **Jun 2:** Phase 4 deploy target
4. **Jun 9:** Phase 5 kickoff (critical escalation + IA training)

---

CALL RECORDING

Recording saved to: [Google Drive link] (available to you + internal team)
Duration: 90 min
Transcript: [Auto-generated via Google Meet, available in Drive]

---

Muito obrigado pela sua atenção e feedback construtivo. Sua revisão arquitetural foi essencial para validar nossa abordagem antes da execução.

Um abraço,
[CTO name]
CTO, HC Quality

---

CC: [Audit Lead, internal team]
Attachments:
- Call_Summary_Notes.pdf
- Action_Items_Tracker.md
```

---

## Template 8: Escalation for Delayed RFI (If response >5 business days)

**Subject:** Escalation — RFI-XXX Response Delayed · ETA [Date]

```
Prezado Ernani,

Esta é uma notificação de escalação: RFI-XXX está com resposta atrasada.

ISSUE

RFI-XXX: [Topic]  
Opening date: [Date]  
Original due date: [Date + 5 business days]  
Current status: ⏳ In progress (delayed by [X] days)  
Updated ETA: [New date]  

ROOT CAUSE
[Explanation: engineering capacity, dependency on other work, etc.]

REMEDIATION
✅ Action: [What we're doing to accelerate]
✅ Timeline: Response by [NEW ETA DATE] at [TIME] BRT
✅ Owner: [Engineer name]
✅ Backup owner: [If primary unavailable]

IMPACT
🟡 [Describe any compliance impact if response further delayed]

CONTINGENCY
If we can't meet [NEW ETA DATE]:
→ We will escalate to CTO immediately
→ Escalation path: [Your contact] → CTO → [Board/decision-maker]

---

I apologize for the delay. We take RFI response SLA seriously and are prioritizing this to get you an answer by [DATE].

Um abraço,
[Audit Lead / CTO]

---

CC: CTO
```

---

**Usage Notes:**

1. **Friday Weekly Updates** — Send every Friday 10:30 BRT (right after call ends)
2. **RFI Responses** — Send within 5 business days of RFI opening (escalate if at risk)
3. **Monthly Reports** — Send last Friday of month 17:30 BRT
4. **Phase Completions** — Send immediately upon deploy verification (typically next morning)
5. **Escalations** — Send immediately when discovered (no delays)

**Always include:**
- Compliance metrics (DICQ %, RDC articles, LGPD %)
- Evidence links (code, tests, ADRs)
- Clear action items + owners + due dates
- CTO sign-off (for critical items)

**Store all templates in:** `.planning/templates/`  
**Archive all sent emails in:** `.planning/email-archive/[YEAR-MONTH]/`
