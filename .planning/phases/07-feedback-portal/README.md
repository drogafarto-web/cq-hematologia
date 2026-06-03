# Phase 7 — Satisfação/Feedback Portal Integration

**Complete Execution Plan for v1.4 Wave 2**

This directory contains the detailed specification and implementation roadmap for Phase 7: Feedback Portal Integration — a 1.5-week initiative to complete the customer satisfaction loop for HC Quality.

---

## 📋 Contents

### Core Planning Documents

1. **[PHASE_7_DETAILED_PLAN.md](PHASE_7_DETAILED_PLAN.md)** (Comprehensive)
   - Objective, context, and architecture
   - 4.1 Patient NPS portal (NPSPortalForm component)
   - 4.2 Staff suggestions intake (SuggestionsIntake component, mobile PWA)
   - 4.3 Trending dashboard (NPS chart, RCA word cloud, suggestion stats)
   - 4.4 Complaint closure integration hook
   - 4.5 Cloud Functions: callables + scheduled tasks
   - 4.6 Anonimização cron (daily PII zero-out >90d)
   - Firestore rules, indexes, and security patterns
   - 8 E2E test specifications (Detox)
   - Implementation tasks (Waves 1–4)
   - Success criteria + known risks

2. **[EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md)** (Quick Reference)
   - Deliverables checklist
   - Parallel execution waves (Days 1–6)
   - Critical integration points
   - Success criteria verification
   - Risk mitigation table

3. **[E2E_TEST_SPECS.md](E2E_TEST_SPECS.md)** (Test Coverage)
   - 8 detailed Detox test cases (iOS + Android)
   - Test 1: Public NPS submission (token-based)
   - Test 2: Authenticated NPS (post-complaint closure)
   - Test 3: Staff suggestion intake (mobile PWA)
   - Test 4: Suggestion upvoting (dedup)
   - Test 5: Trending dashboard NPS chart
   - Test 6: RCA word cloud
   - Test 7: Anonimização cron (unit test)
   - Test 8: Complaint closure → NPS email trigger
   - Test data fixtures + running instructions

---

## 🎯 Quick Start

### For CTO / Product Lead

1. Read **EXECUTION_SUMMARY.md** (3 min) for overview
2. Review **PHASE_7_DETAILED_PLAN.md** sections 1–3 (Architecture & Data Model)
3. Approve rollout plan (section 10)

### For Frontend Engineers

1. Read **PHASE_7_DETAILED_PLAN.md** sections 4.1–4.4 (Components)
2. Check **E2E_TEST_SPECS.md** for test expectations
3. Start with Wave 1: NPSPortalForm + SuggestionsIntake components

### For Backend / Cloud Functions Engineers

1. Read **PHASE_7_DETAILED_PLAN.md** sections 4.5–4.6 (Functions)
2. Review callable specs: dispatchNPSPostLaudo, submitNPSResposta, anonimizarRespostas
3. Check Firestore rules (5.1) for security patterns

### For QA / Test Engineers

1. Read **E2E_TEST_SPECS.md** in full
2. Set up Detox environment + test fixtures
3. Execute Waves 1–4 test cases in parallel

---

## 🔗 Key Dependencies

**Foundation (Phase 11 — Reclamacoes):**

- `src/features/reclamacoes/types/` — Reclamacao, Sugestao, NPSResposta types
- `src/features/reclamacoes/services/` — Firebase service layer
- `src/features/reclamacoes/CLAUDE.md` — Business logic + compliance baseline

**Design System:**

- `DESIGN_SYSTEM.md` — Dark-first tokens, typography, spacing
- References: Apple, Linear, Stripe (sophisticated, editorial)

**Compliance:**

- DICQ 4.14.3 — Customer satisfaction (NPS campaigns)
- DICQ 4.14.4 — Suggestions/improvements
- RDC 978 Art. 36–39 — Complaint handling + 30-day SLA
- LGPD Lei 13.709/18 — PII protection + anonymization >90d
- CDC Lei 8.078/90 — Consumer protection

---

## 📊 Architecture Summary

### Data Model

```
/labs/{labId}/
  satisfacao-respostas/{respostaId}
    — NPS responses (0–10 score, anonymized >90d)
  satisfacao-campanhas/{campanhaId}
    — Quarterly campaign metadata
  sugestoes/{sugestaoId}
    — Staff + public suggestions (state machine: aberta → analisada → implementada|rejeitada)
  reclamacoes/{reclamacaoId}
    — Complaint workflow integration (triggers NPS on Resolvida status)

  analytics-feedback/
    nps-trending/{ano-mes}          — Pre-computed monthly NPS aggregates
    suggestion-stats/{ano-mes}      — Implementation % by category
    rca-wordcloud/{ano-mes}         — Top 20 root-cause words (Phase 7.2+)
```

### Key Workflows

**NPS Trigger (Post-Complaint):**

```
Reclamacao status: Nova → [RT review] → Resolvida
  ↓ (automatic via callable)
  Email sent with NPS token (expires 7d)
  ↓
  Patient submits NPS (0–10)
  ↓
  Reclamacao status: Resolvida → Fechada
```

**Email Campaign (Critical Laudo):**

```
Lauro marked critical/urgente
  ↓ (Pub/Sub trigger)
  [Wait 5 days]
  ↓
  Generate NPS token (JWT, 7d expiry)
  ↓
  Send email via Resend
  ↓
  Token-based link: /portal-paciente/nps/{token}
```

**Anonimização (Daily Cron @ 03:00 BRT):**

```
Query: NPSRespostas where criadoEm < (now - 90d) AND anonimizadoEm == null
  ↓
  Batch update: pacienteId → null, PII filtered, anonimizadoEm set
  ↓
  Audit log entry created
  ↓
  cpfHash retained for analytics
```

### Components

| Component                            | Purpose                                       | Status           |
| ------------------------------------ | --------------------------------------------- | ---------------- |
| **NPSPortalForm**                    | 0–10 scale, sentiment icons, reCAPTCHA v3     | Ready to execute |
| **SuggestionsIntake**                | Web + mobile PWA, state machine, upvote dedup | Ready to execute |
| **TrendingDashboard**                | NPS chart, RCA word cloud, suggestion %       | Ready to execute |
| **useReclamacaoClosureNotification** | Listen to reclamacao status, emit NPS trigger | Ready to execute |

### Cloud Functions

| Function               | Type                                     | Purpose                                            | Status        |
| ---------------------- | ---------------------------------------- | -------------------------------------------------- | ------------- |
| `dispatchNPSPostLaudo` | Callable                                 | Generate token + send email on complaint Resolvida | Spec complete |
| `submitNPSResposta`    | Callable                                 | Server-side signature + Firestore write            | Spec complete |
| `dispatchNPSQuarterly` | Pub/Sub cron (1st of Q month, 12:00 BRT) | Batch quarterly campaign emails                    | Spec complete |
| `anonimizarRespostas`  | Pub/Sub cron (daily 03:00 BRT)           | PII zero-out >90d old                              | Spec complete |

---

## ✅ Success Criteria

| Criterion                 | Acceptance                                                               |
| ------------------------- | ------------------------------------------------------------------------ |
| **NPS Form**              | Loads in <2s; 0–10 scale; reCAPTCHA v3; token validates; 7-day expiry    |
| **Suggestions**           | 50–2000 chars; category select; upvote dedup; status transitions         |
| **Trending Dashboard**    | 3-month NPS chart; word cloud top 20; suggestion % calc                  |
| **Complaint Integration** | Resolvida → NPS email in <5 min; Fechada on response                     |
| **Anonimização**          | Daily cron @ 03:00 BRT; pacienteId null; PII filtered; audit logged      |
| **Email Delivery**        | 99%+ delivery rate; bounce handling; unsubscribe honored                 |
| **Security**              | LogicalSignature on all writes; token HMAC verified; rate limit 5/IP/day |
| **Compliance**            | DICQ 4.14.3/4.4 documented; RDC 978 5-year retention; LGPD audit trail   |
| **E2E Coverage**          | All 8 tests green (iOS + Android); no flakes                             |
| **Accessibility**         | WCAG AA pass; 4.5:1 contrast; keyboard nav; screen reader tested         |

---

## 🚀 Rollout Plan

### Phase 7.1 (Week 1–1.2): MVP Deployment

- Deploy Firestore rules + indexes
- Deploy Cloud Functions (callables + scheduled tasks)
- Launch NPSPortalForm + SuggestionsIntake
- Run E2E tests 1–4
- Monitor: email delivery, token validation, error logs

### Phase 7.2 (Week 1.3–1.5): Polish + Analytics

- Deploy Gemini sentiment classification (optional)
- Launch TrendingDashboard with monthly NPS + RCA word cloud
- Dark-mode UI refinement + accessibility audit
- Complete E2E tests 5–8
- Performance optimization (Lighthouse >85)

### Phase 7.3+ (v1.4 Wave 3): Enhancements

- Ishikawa diagram for RCA (visual upgrade)
- WhatsApp notifications (deferred, Meta approval)
- Ouvidoria/PROCON integration (deferred)
- NPS incentive raffle (deferred, legal barriers)

---

## 📖 Compliance & References

### Standards Addressed

- ✅ DICQ 4.14.3 — Customer satisfaction (NPS)
- ✅ DICQ 4.14.4 — Suggestions/improvements
- ✅ RDC 978 Art. 36–39 — Complaint handling
- ✅ LGPD Lei 13.709/18 — PII protection
- ✅ CDC Lei 8.078/90 — Consumer protection

### Related Documents

- `src/features/reclamacoes/CLAUDE.md` — Phase 11 foundation types + RCA engine
- `DESIGN_SYSTEM.md` — Dark-first tokens, typography
- `docs/adr/0001-audit-chain.md` — LogicalSignature pattern
- `docs/adr/0017-anonimizacao.md` — PII anonymization >90d
- Obsidian: `HC_Quality_Compliance_DICQ.md` — Compliance mapping

---

## 🔧 Implementation Tips

### Frontend Wave 1 (Days 1–3)

- Use Recharts for NPS trending chart (lightweight, dark-theme ready)
- Tailwind `@apply` for consistent dark-mode styling
- PWA optimization: check `vite.config.ts` for code-splitting
- reCAPTCHA v3: requires `REACT_APP_RECAPTCHA_SITE_KEY` env var

### Functions Wave 2 (Days 2–4)

- Test callables in emulator: `firebase emulators:start`
- Use `admin.firestore.Timestamp.now()` for server-side timestamps
- Resend integration: store `RESEND_API_KEY` in `functions/.env`
- Pub/Sub cron syntax: `onSchedule('1 0 1 1,4,7,10 *', ...)` (1st of Q months, 00:01 UTC)

### Integration Wave 3 (Days 4–5)

- Hook `useReclamacaoClosureNotification` listens to Reclamacao updates
- Email token generation: use `jwt.sign()` with 7-day expiry
- Anonimização safety: batch size 500 to avoid quota limits
- Audit logging: create entry in `feedback-audit/{labId}/` for compliance

### Testing Wave 4 (Days 5–6)

- Detox: build iOS sim cache first (`detox build-framework-cache`)
- Use test fixtures for consistent data (see E2E_TEST_SPECS.md appendix)
- Mock email service for E2E (Resend has test mode)
- Firestore rules testing: `firebase emulators:exec --only firestore "npm test"`

---

## 📞 Contact & Escalation

- **Architecture questions**: Review PHASE_7_DETAILED_PLAN.md section 3 (Architecture)
- **Compliance questions**: Check Obsidian `HC_Quality_Compliance_DICQ.md` + `docs/adr/`
- **UI/Design questions**: Reference `DESIGN_SYSTEM.md` + sections 4.1–4.3
- **Email delivery issues**: Monitor Resend dashboard; check bounce logs
- **Firestore rules issues**: Test in emulator; review `firestore.rules` section 5.1

---

## 📝 Document Versions

| Document                 | Version | Updated    | Status              |
| ------------------------ | ------- | ---------- | ------------------- |
| PHASE_7_DETAILED_PLAN.md | 1.0     | 2026-05-07 | Ready for execution |
| EXECUTION_SUMMARY.md     | 1.0     | 2026-05-07 | Ready for execution |
| E2E_TEST_SPECS.md        | 1.0     | 2026-05-07 | Ready for execution |
| README.md (this file)    | 1.0     | 2026-05-07 | Ready for reference |

---

**Status:** Ready for sprint planning and parallel execution  
**Approval Gate:** CTO sign-off on architecture + compliance baseline  
**Next Step:** Assign tasks to engineering teams and begin Wave 1 execution
