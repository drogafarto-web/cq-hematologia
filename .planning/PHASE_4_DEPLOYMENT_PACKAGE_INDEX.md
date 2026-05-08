# Phase 4 Deployment Package — Complete Index

**Deployment Date:** May 20, 2026 (08:30–12:30 UTC-3)  
**Project:** HC Quality (CQ Labclin)  
**Phase:** 4 (Portal Auth + NOTIVISA Queue Infrastructure)  
**Region:** `southamerica-east1`  
**Status:** Ready for Execution

---

## Package Contents

This complete deployment package includes **4 runbooks + 5 monitoring specifications + rollback procedures**.

### Core Documents

| Document | Purpose | Owner | Time to Read |
|----------|---------|-------|--------------|
| **PHASE_4_DEPLOYMENT_RUNBOOK.md** | Step-by-step deployment execution | Incident Commander | 20 min |
| **PHASE_4_FEATURE_FLAG_STRATEGY.md** | Gradual NOTIVISA rollout (0%→25%→50%→100%) | Alert Manager | 15 min |
| **PHASE_4_MONITORING_DASHBOARD_SPECS.md** | 4 dashboards + 5 alert policies + 10 log sinks | Monitoring Lead | 25 min |
| **PHASE_4_POST_DEPLOYMENT_VALIDATION.md** | Smoke tests + lab testing + auditor review | QA Lead + Lab Director | 30 min |
| **PHASE_4_ROLLBACK_PROCEDURES.md** (existing) | Complete rollback decision trees + steps | On-Call Engineer | 15 min |

**Total Reading Time:** 105 minutes (1.75 hours)

---

## How to Use This Package

### Pre-Deployment (May 19, EOD)

1. **Read** `PHASE_4_DEPLOYMENT_RUNBOOK.md` Section "Pre-Deployment"
   - Type-check, lint, tests, bundle size, secrets
   - Approx. 1–2 hours

2. **Prepare** feature flag in Firestore
   - Create `/featureFlags/notivisa-rollout` with `rolloutPercentage = 0`
   - Test Firestore read access
   - Approx. 15 minutes

3. **Verify** monitoring infrastructure
   - Cloud Logs sinks active
   - Alert policies created
   - Dashboards accessible
   - Approx. 30 minutes

4. **Team Briefing** (30 min)
   - Incident Commander reviews runbooks
   - On-call engineers review alert procedures
   - Lab director reviews compliance checklist

### Deployment Day (May 20, 08:30 UTC-3)

1. **Execute** `PHASE_4_DEPLOYMENT_RUNBOOK.md` Section "Deployment Execution"
   - Phase 4.0: Hosting (2 min)
   - Phase 4.1: Rules + Indexes (3–5 min)
   - Phase 4.2: Functions (3–5 min)
   - Phase 4.3: Feature Flag (2 min)
   - Phase 4.4: Smoke Tests (15 min)
   - **Total: ~30 minutes**

2. **Monitor** `PHASE_4_MONITORING_DASHBOARD_SPECS.md` (4 hours)
   - Hour 1: Immediate health check (dashboards)
   - Hours 2–3: Manual scenarios + Firestore analysis
   - Hour 4: Cloud Logs review + exit criteria verification

3. **Validate** `PHASE_4_POST_DEPLOYMENT_VALIDATION.md`
   - Smoke tests (automated, 15 min)
   - Lab testing (manual, 1 hour)
   - Auditor review (30 min)
   - Sign-off

### Post-Deployment (May 22 → June 10)

1. **Feature Flag Rollout** per `PHASE_4_FEATURE_FLAG_STRATEGY.md`
   - May 22: Enable internal labs (whitelist)
   - May 24: 25% rollout (automated)
   - May 29: 50% rollout (if metrics stable)
   - June 6: 100% rollout (if metrics stable)

2. **Daily Monitoring** (5 min/day)
   - Check all 4 dashboards for anomalies
   - Verify alert channels (0 unresolved P1s)
   - Review Cloud Logs for ERROR entries

3. **Incident Response** (as needed)
   - Use `.planning/runbooks/phase-4-*.md` for specific failures
   - Escalate to CTO if unresolved >30 min
   - Reference `PHASE_4_ROLLBACK_PROCEDURES.md` if rollback needed

---

## Key Concepts

### Feature Flag (Gradual Rollout)

**What is it?** A Firestore document that controls which labs can submit to NOTIVISA:

```typescript
{
  "enabled": true,
  "rolloutPercentage": 0,  // 0% = disabled for all
  "rolloutBuckets": {
    "type": "percentage",
    "labIdWhitelist": ["lab-internal-test-1"]
  }
}
```

**How it works:**
1. Client-side: Portal UI checks flag; if 0%, shows "Coming Soon"
2. Server-side: `submitNotivisa` callable checks flag; returns error if not in rollout
3. No code changes needed to disable — just update Firestore document

**Timeline:**
- May 20: Deploy with flag = 0% (code live, feature off)
- May 22: Enable internal labs (whitelist)
- May 24: 25% of production labs
- May 29: 50%
- June 6: 100%

---

### Monitoring (4 Dashboards)

**Dashboard 1: Portal Auth Health** — Patient login system  
- Auth success rate, latency, email delivery, failed attempts

**Dashboard 2: NOTIVISA Queue Health** — Government submission queue  
- Queue status, processing latency, success rate, stuck entries, feature flag state

**Dashboard 3: Firestore Access** — Data access patterns & security  
- Patient read latency, laudo query latency, rule rejections, index usage

**Dashboard 4: System Health Overview** — Overall system SLOs  
- Error rate, function execution time, quota usage, error budget, uptime status

**5 Alert Policies:**
1. Portal Auth Failures (P1) — SMS page + Slack
2. NOTIVISA Queue Stuck (P1) — SMS page + Slack
3. Firestore Rule Rejections (P2) — Email + Slack
4. Email Delivery Failure (P2) — Email + Slack
5. Function Latency Degradation (P3) — Email (info)

---

### Rollback Strategy

**5 Rollback Scenarios + Procedures:**

1. **Hosting Only** (1 min) — Web bundle bug
2. **Firestore Rules Only** (2 min) — Permission/security issue
3. **Cloud Functions Only** (5 min) — Function crash
4. **Rules + Functions** (5 min) — Both have issues
5. **Full Rollback** (10 min) — Architectural issue

**Fast Rollback via Feature Flag** (<1 min):
```
// Instead of code rollback, just disable the flag:
db.collection('featureFlags').doc('notivisa-rollout').update({
  enabled: false
});
// Immediate effect: all submitNotivisa calls return "FEATURE_DISABLED"
```

---

## Rollout Timeline (May 20 → June 10)

```
May 20 (08:30 UTC-3)
├─ 08:30: Deploy Phase 4 code
├─ 09:00: Smoke tests complete
├─ 12:30: Post-deploy monitoring complete
└─ End-of-day: Feature flag = 0% (code live, feature off)

May 22 (14:00 UTC-3)
├─ Enable internal labs: ["lab-internal-test-1", "lab-internal-test-2"]
└─ Status: Internal testing active

May 24 (14:00 UTC-3)
├─ Rollout to 25% of production labs (~3 labs)
└─ Status: Quarter rollout

May 29 (10:00 UTC-3)
├─ Rollout to 50% of production labs (~6 labs)
└─ Status: Half rollout

June 6 (10:00 UTC-3)
├─ Rollout to 100% of production labs (~12 labs)
└─ Status: Full rollout complete

June 10
└─ Archive feature flag, begin stabilization
```

---

## Pre-Deployment Checklist (May 19, EOD)

**Code Quality:**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 new violations (baseline: 88)
- [ ] `npm run test` — 320+ tests passing
- [ ] `npm run test:e2e` — 6 critical flows passing
- [ ] `git status` — clean working tree

**Firebase:**
- [ ] `firebase deploy --only firestore:rules --dry-run` — would update
- [ ] `gcloud firestore indexes list` — all indexes READY
- [ ] `cd functions && npm run build && npm test` — 0 errors, 46 tests pass
- [ ] `bash scripts/preflight-secrets-check.sh` — exit code 0

**Performance:**
- [ ] `npm run build` — dist/index.js <365 KB
- [ ] Lighthouse audit — score ≥87, LCP <2.0s
- [ ] Deployment window reserved — 08:30–12:30 UTC-3

**Team:**
- [ ] CTO available — confirmed
- [ ] On-call rotation — SMS pager tested
- [ ] Slack channels — `#production-alerts` created
- [ ] Runbooks — printed or link pinned in Slack

---

## Deployment Execution Checklist (May 20, 08:30 UTC-3)

**Phase 4.0: Hosting** (2 min)
- [ ] `firebase deploy --only hosting --project hmatologia2` — success
- [ ] `curl -I https://hmatologia2.web.app/portal/auth` — HTTP 200

**Phase 4.1: Rules + Indexes** (3–5 min)
- [ ] `firebase deploy --only firestore:rules --project hmatologia2` — rules published
- [ ] Wait for indexes to build — verify all 6 READY
- [ ] No rule syntax errors

**Phase 4.2: Functions** (3–5 min)
- [ ] `cd functions && npm run build` — 0 errors
- [ ] `npm test` — 46 tests passing
- [ ] `firebase deploy --only functions --project hmatologia2` — functions deployed
- [ ] `gcloud functions list` — all notivisa functions ACTIVE

**Phase 4.3: Feature Flag** (2 min)
- [ ] Create `/featureFlags/notivisa-rollout` in Firestore
- [ ] Set: `enabled = true`, `rolloutPercentage = 0`
- [ ] Verify: Firestore document readable

**Phase 4.4: Smoke Tests** (15 min)
- [ ] `bash .planning/scripts/phase-4-smoke-test.sh` — 10/10 pass
- [ ] No failing checks (Anvisa credentials WARN is expected)

---

## Post-Deployment Checklist (May 20, 08:45–12:30 UTC-3)

**Monitoring (4 hours):**
- [ ] Hour 1: Dashboard review (4 dashboards healthy)
- [ ] Hours 2–3: Manual scenarios (6 test cases)
- [ ] Hour 4: Cloud Logs analysis (0 unhandled exceptions)

**Validation (1.75 hours):**
- [ ] Smoke tests: 7/7 automated checks pass
- [ ] Lab testing: 5/5 manual scenarios pass (note any issues)
- [ ] Auditor review: Compliance sign-off

**Sign-Off:**
- [ ] Incident Commander: GO-LIVE APPROVED
- [ ] Lab Director: COMPLIANT FOR PHASE 4
- [ ] Post-mortem template prepared (if needed)

---

## Emergency Contacts

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| Incident Commander | [CTO] | +55 11 xxxxxx | @cto | cto@hc-quality.local |
| On-Call Engineer #1 | [Name] | +55 11 xxxxxx | @oncall-1 | oncall1@hc-quality.local |
| On-Call Engineer #2 | [Name] | +55 11 xxxxxx | @oncall-2 | oncall2@hc-quality.local |
| Lab Director | [Name] | +55 11 xxxxxx | @lab-dir | labdir@hc-quality.local |
| Alert Manager | [Name] | +55 11 xxxxxx | @alerts | alerts@hc-quality.local |

**Escalation:** If P1 alert unresolved >15 min, page CTO. If CTO unavailable, escalate to Tech Lead.

---

## Critical Thresholds (Alert Triggers)

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| Auth success rate | <95% | P1 | Page on-call engineer |
| Auth failures | >5 in 5 min | P1 | SMS alert + Slack |
| Queue stuck entries | >0 | P1 | SMS alert + Slack |
| Rule rejections | >10 in 5 min | P2 | Email + Slack |
| Error rate | >0.5% | P2 | Email + Slack |
| Function latency p95 | >3s | P3 | Email (informational) |

---

## Quick Links

### Documentation
- [Deployment Runbook](PHASE_4_DEPLOYMENT_RUNBOOK.md)
- [Feature Flag Strategy](PHASE_4_FEATURE_FLAG_STRATEGY.md)
- [Monitoring Dashboards](PHASE_4_MONITORING_DASHBOARD_SPECS.md)
- [Post-Deployment Validation](PHASE_4_POST_DEPLOYMENT_VALIDATION.md)
- [Rollback Procedures](PHASE_4_ROLLBACK_PROCEDURES.md)

### Incident Response
- [Runbook: Auth Failures](runbooks/phase-4-auth-failures.md)
- [Runbook: Queue Stuck](runbooks/phase-4-notivisa-queue.md)
- [Runbook: Rule Rejections](runbooks/phase-4-firestore-rules.md)
- [Runbook: Email Delivery](runbooks/phase-4-email-delivery.md)
- [Runbook: Function Latency](runbooks/phase-4-function-latency.md)

### Related Phase 4 Documents
- [Cloud Logs Setup](PHASE_4_CLOUD_LOGS_SETUP.md)
- [Incident Response Contacts](v1.4-INCIDENT_RESPONSE_CONTACTS.md)
- [Smoke Test Script](scripts/phase-4-smoke-test.sh)

---

## Success Criteria

**Deployment is successful if:**

1. ✅ Smoke tests: 10/10 pass
2. ✅ Manual lab tests: 5/5 scenarios pass
3. ✅ Auditor review: Compliance sign-off
4. ✅ P0 alerts: 0 fired during 4-hour window
5. ✅ Unhandled exceptions: 0 in Cloud Logs
6. ✅ Auth success rate: >99%
7. ✅ Portal load time: <2s LCP
8. ✅ Queue health: 0 stuck entries
9. ✅ Error rate: <0.1%
10. ✅ Bundle size: <365 KB

**If ANY criterion fails → INITIATE ROLLBACK (see PHASE_4_ROLLBACK_PROCEDURES.md)**

---

## Related Architecture Decisions

- **ADR-0026:** NOTIVISA Queue Processing (Async, Append-Only)
- **ADR-0021:** NOTIVISA Security (Gov API Auth, Secret Management)
- **ADR-0029:** Feature Flags (Flag Strategy, Decision Trees)
- **ADR-0017:** Secret Management (Baseline Reset, Deploy Gate)

---

## FAQ

**Q: What if smoke test fails?**  
A: STOP. Do not proceed. Investigate failure, fix code/infra, redeploy component, rerun smoke test.

**Q: Can we deploy in pieces (hosting, then functions later)?**  
A: No. Deploy all 4 phases (hosting, rules, functions, feature flag) as a unit. Partial deployment leaves system in undefined state.

**Q: What if an index is still building at 12:30 pm?**  
A: This is normal. Indexes can take 5–15 min. Do NOT rollback. Wait for index creation to complete (monitor via GCP Console). System works without index (just slower on queries).

**Q: How long should we wait before advancing feature flag to 25%?**  
A: At least 48 hours of stability. Check: 0 unhandled exceptions, auth success >99%, queue latency <100ms p95.

**Q: Can we skip the 4-hour post-deployment monitoring window?**  
A: No. Many production issues surface 2–4 hours post-deploy. Monitor the full 4 hours.

**Q: What if Anvisa API is unreachable?**  
A: Phase 4 uses **sandbox** API. Real API (production) comes in Phase 12. If sandbox is down, this is expected during gov maintenance. Functions will fail gracefully with "retryable" error, retry automatically.

---

## Document Status

**Status:** ✅ READY FOR DEPLOYMENT  
**Last Updated:** 2026-05-07  
**Version:** 1.0 (Phase 4 RTM)  
**Owner:** CTO / Incident Commander  
**Approval:** Pending CTO sign-off (May 19 EOD)

---

## Next Steps

1. **Immediate (by May 18):** Review all documents with team
2. **May 19 EOD:** Complete pre-deployment checklist
3. **May 20 08:30:** Begin deployment execution
4. **May 20 12:30:** Complete post-deployment validation & sign-off
5. **May 22:** Enable internal labs (whitelist)
6. **May 24:** Advance to 25% rollout
7. **June 10:** Archive feature flag, complete Phase 4

---

**Ready to deploy?** Start with `PHASE_4_DEPLOYMENT_RUNBOOK.md` Section "Pre-Deployment".  
**Need to rollback?** See `PHASE_4_ROLLBACK_PROCEDURES.md`.  
**Have questions?** Escalate to CTO via `#production-alerts` Slack channel.
