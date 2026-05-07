# Phase 7 — Satisfação/Feedback Portal Integration · Execution Summary

**Duration:** 1.5 weeks (Wave 2, v1.4)  
**Scope:** Patient NPS + Staff suggestions + Trending dashboard + Complaint integration  
**Compliance:** DICQ 4.14.3/4.4, RDC 978, LGPD, CDC  

---

## Deliverables at a Glance

| Item | Owner | Status |
|------|-------|--------|
| NPSPortalForm component | Frontend | Ready to execute |
| SuggestionsIntake component | Frontend | Ready to execute |
| TrendingDashboard component | Frontend | Ready to execute |
| dispatchNPSPostLaudo callable | Functions | Spec complete |
| submitNPSResposta callable | Functions | Spec complete |
| dispatchNPSQuarterly Pub/Sub | Functions | Spec complete |
| anonimizarRespostas cron | Functions | Spec complete |
| Firestore rules + indexes | Security | Ready to execute |
| useReclamacaoClosureNotification hook | Frontend | Ready to execute |
| E2E test suite (8 tests) | QA | Spec complete |

---

## Parallel Execution Waves

### Wave 1: Core UI + Firestore (Days 1–3)
- NPSPortalForm (public + authenticated, reCAPTCHA v3)
- SuggestionsIntake (web + mobile PWA)
- TrendingDashboard (NPS chart + word cloud)
- Firestore rules + indexes
- **Gate:** Rules deployed, all reads/writes via callables validated

### Wave 2: Cloud Functions (Days 2–4)
- dispatchNPSPostLaudo (token gen + email)
- submitNPSResposta (server-side sig + write)
- dispatchNPSQuarterly (recurring campaign)
- anonimizarRespostas (daily cron)
- **Gate:** All functions tested in emulator; E2E tests 1–4 green

### Wave 3: Integrations (Days 4–5)
- useReclamacaoClosureNotification hook
- Portal `/portal-paciente/nps/{token}` page
- Email triggers on critical laudo (5-day delay)
- Suggestion state machine transitions
- **Gate:** E2E tests 5–8 green; email delivery confirmed

### Wave 4: Polish + Deploy (Days 5–6)
- Dark-mode UI refinement
- WCAG AA accessibility audit
- Performance optimization (Lighthouse)
- Rollout: Firestore rules → Functions → Hosting

---

## Critical Integration Points

1. **Complaint → NPS Trigger**
   - Reclamacao status → Resolvida
   - Callable dispatchNPSPostLaudo invoked (async)
   - Email sent with token (5-min delay)
   - Patient submits NPS → reclamacao status → Fechada

2. **Email Campaign Flow**
   - Lauro marked critical/urgente → trigger function
   - Wait 5 days (via scheduled task or function delay)
   - Generate NPS token (JWT, 7d expiry)
   - Send email via Resend
   - Track in feedback-audit collection

3. **Anonimização Safety**
   - Daily 03:00 BRT cron
   - Query NPSRespostas: criadoEm < (now - 90d) AND anonimizadoEm == null
   - Batch update: pacienteId → null, comentario PII filtered, anonimizadoEm set
   - Audit log entry created
   - cpfHash retained for analytics (not PII)

---

## Success Criteria (Verification Checklist)

- [ ] NPSPortalForm accepts 0–10 score, optional comment, reCAPTCHA v3 validates
- [ ] Token-based link expires after 7 days
- [ ] SuggestionsIntake prevents duplicate upvotes (dedup working)
- [ ] TrendingDashboard renders 3-month NPS trend + suggestion %
- [ ] Complaint Resolvida → NPS email sent within 5 mins
- [ ] Anonimização cron runs daily 03:00 BRT; PII zeroed for >90d old
- [ ] All 8 E2E tests green (iOS + Android emulator)
- [ ] Firestore rules block unauthorized access; soft-delete only
- [ ] WCAG AA compliance pass
- [ ] Lighthouse performance score >85

---

## Risk Flags

| Risk | Mitigation |
|------|-----------|
| Email spam filter | Use Resend + SPF/DKIM warmup |
| Token expiry confusion | Clear error + resend button |
| Gemini hallucination (Phase 7.2) | Manual RT review fallback |
| PII in comentario | Regex filter + audit trail |
| Quarterly campaign saturation | Batch 1000/min; Pub/Sub queue |

---

## Next Steps

1. **Pre-execution (Day 0):**
   - Review PHASE_7_DETAILED_PLAN.md in full
   - Confirm Firestore project access + deploy permissions
   - Set up NPS_TOKEN_SECRET in functions/.env

2. **Execute Waves 1–4 in parallel (Days 1–6)**
   - Assign tasks to frontend + functions teams
   - Daily standups to track integration points
   - Gate checks after each wave

3. **Launch Criteria (Day 7):**
   - All unit tests + E2E tests green
   - Firestore rules + functions deployed
   - Email delivery tested (5 sample emails)
   - Dark-mode UI approved
   - Accessibility audit pass (WCAG AA)

4. **Monitor (Week 2+):**
   - Email delivery logs (Resend dashboard)
   - Cloud Logs for function errors
   - Firestore audit trail (feedback-audit collection)
   - NPS response rate + trending metrics

---

**Status:** Ready for sprint planning  
**Approval Gate:** CTO sign-off on architecture + compliance baseline
