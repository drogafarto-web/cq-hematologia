# NOTIVISA Integration — Critical Path Card (1-Pager)

**Print & Bookmark** — Quick reference for Phase 4 execution  
**Generated:** 2026-05-07 | **Phase 4 Kickoff:** 2026-05-20

---

## Blocker Status

| Item | Status | Owner | ETA | Action |
|------|--------|-------|-----|--------|
| **Anvisa Credentials** | 🔴 CRITICAL | Government | 2026-05-15 | Await provisioning. Set calendar reminder. |
| **Firestore Rules** | ✅ LIVE | Deployed | ✓ 2026-05-07 | Rules active. Tested in emulator. |
| **Cloud Functions** | ✅ LIVE | Deployed | ✓ 2026-05-07 | All 4 functions active + tested. |
| **Firestore Indexes** | ✅ LIVE | Deployed | ✓ 2026-05-07 | 3 indexes created + enabled. |

---

## Timeline (Critical Path)

```
Mon 2026-05-15 (T-5)     └─ Credentials Arrive ← BLOCKER RELEASES HERE
└─ Morning: Receive API key + endpoint from Anvisa
└─ Lunch: Verify in Secrets Manager + test connectivity
└─ ETA: 2 hours

Tue 2026-05-16 (T-4)     └─ Unblock All 33 Items
└─ Morning: E2E sandbox tests (8 error scenarios)
   ├─ Invalid credentials (401)
   ├─ Network timeout (15s)
   ├─ Invalid payload (422)
   ├─ Service unavailable (503)
   ├─ Webhook callback delivery
   ├─ Queue state transitions
   ├─ Circuit breaker activation
   └─ Audit trail completeness
└─ Afternoon: Rate limit config + threshold update
└─ ETA: 6 hours total

Wed 2026-05-17 (T-3)     └─ Load Test
└─ Morning: JMeter setup (500 submissions/day profile)
└─ Midday: Simulate 10-hour business hours (8am–6pm BRT)
└─ Afternoon: Verify queue depth <100 pending + no errors
└─ ETA: 4 hours

Thu 2026-05-18 (T-2)     └─ Smoke Tests + Final Validation
└─ Morning: 5 critical user flows
   ├─ Create NOTIVISA draft
   ├─ Submit to queue
   ├─ Webhook callback received
   ├─ Status updated in Firestore
   └─ Audit trail logged
└─ Afternoon: Review all 70 items (should be 70/70 ✅)
└─ ETA: 3 hours

Fri 2026-05-19 (T-1)     └─ Go/No-Go Sign-Off
└─ Morning: CTO review + sign-off template
└─ Sign-offs: Agent + Engineering Manager + CTO
└─ Decision: APPROVED for Phase 4 kickoff
└─ ETA: 1 hour

Mon 2026-05-20 (KICKOFF) └─ Phase 4 Live 🎉
└─ Go: NOTIVISA integration active in production
└─ Monitor: Cloud Logs + Slack alerts + dashboard
```

---

## Go/No-Go Criteria

**All 3 must be ✅:**

1. **All 70 checklist items ✅ or 🟡 READY**
   - Current: 28 ✅ + 9 🟡 ready + 33 🔴 blocked → **41/70 ready to execute**
   - Post-credentials: **70/70 by 2026-05-18**

2. **No blocking risks**
   - Only risk: Anvisa credentials late → triggers contingency (Phase 4 with 50% scope, mock only)
   - Mitigation: Pre-staged mock submitter active

3. **Stakeholder sign-offs**
   - Agent 3 (implementation)
   - Engineering Manager (resource + timeline)
   - CTO (compliance + architecture)

---

## Pre-Deploy Gate Commands

**Must run before any Phase 4 merge/deploy:**

```bash
# 1. Type-check (0 errors required)
npx tsc --noEmit

# 2. Secret preflight (blocks if notivisa_sandbox_key missing)
bash scripts/preflight-secrets-check.sh

# 3. Test credentials (once Anvisa delivers)
curl -X POST https://sandbox.notivisa.gov.br/api/v3/authenticate \
  -H "Authorization: Bearer <API_KEY>"

# 4. Test local (unit tests must pass)
npm run test -- notivisaService

# 5. Deploy order (never skip steps)
firebase deploy --only firestore:rules --project hmatologia2
firebase deploy --only firestore:indexes --project hmatologia2
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2
```

---

## Implementation Maturity

| Layer | Status | Details |
|-------|--------|---------|
| **Firestore Rules** | ✅ PRODUCTION | Client-side writes blocked. Server callable only. Audit logs immutable. |
| **Cloud Functions** | ✅ PRODUCTION | 4 functions deployed: draft create + queue processor + webhook handler + failure reporter. |
| **Database Schema** | ✅ PRODUCTION | Collections (notivisa-outbox, notivisa-drafts) + audit subcollection. Indexes created. |
| **Error Handling** | ✅ PRODUCTION | Exponential backoff, circuit breaker, timeout recovery, retry strategy. |
| **Audit Trail** | ✅ PRODUCTION | Immutable logs (append-only) + signature validation. 5-year retention. |
| **Rate Limiting** | ✅ PRODUCTION | Firestore counter (10/min per lab). Queue processor batching (10 at a time). |
| **Testing** | 🟡 READY | Unit tests pass. Integration harness ready. E2E blocked on credentials. |
| **Compliance** | ✅ AUDIT READY | RDC 978 + DICQ + LGPD mapped + verified. |

---

## Key Contacts & Escalation

| Role | Name | Phone | Email | On-Call |
|------|------|-------|-------|---------|
| **CTO** | — | — | — | Yes (final approval) |
| **Engineering Lead** | — | — | — | Yes (resources) |
| **Agent 3 (Phase 4-03)** | — | — | — | Yes (implementation) |
| **Anvisa Support** | — | +55-XX-XXXX-XXXX | support@notivisa.gov.br | Business hours BRT |
| **Ops On-Call** | — | — | — | Yes (incident response) |

---

## Contingency Plan (Credential Delay)

**IF Anvisa credentials arrive LATE (after 2026-05-18):**

1. ✅ **Phase 4 PARTIAL LAUNCH** (2026-05-20 with 50% scope)
   - Mock submitter active (returns success without real API)
   - E2E tests skipped → integration tests only
   - Real API integration deferred to Phase 4.5 (2 weeks later)

2. ✅ **Rollback Path** (if needed)
   - Revert 3 commits (rules + functions + hosting)
   - All data persists (soft-delete only)
   - Client requests fail gracefully (cached previous state)

3. ✅ **Communication** 
   - Notify stakeholders by 2026-05-17 (48h notice)
   - Post-mortem on credential delay + process improvement

---

## Daily Standup Checklist

**Each morning (2026-05-15 onwards):**

- [ ] Credentials received? (Anvisa status check)
- [ ] All tests still passing? (`npm run test -- notivisaService`)
- [ ] No secrets missing? (`bash scripts/preflight-secrets-check.sh`)
- [ ] Cloud Logs clean? (no error spikes)
- [ ] PR status? (all checks passing)
- [ ] On-call ops alert? (any escalations?)

---

## Success Metrics (Post-Launch)

**First 48 hours live (2026-05-20 to 2026-05-22):**

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Queue processor success rate | >95% | — | To measure |
| Webhook delivery rate | >99% | — | To measure |
| Average latency (queue → NOTIVISA send) | <30s | — | To measure |
| Error rate (failures / submissions) | <5% | — | To measure |
| Audit trail completeness | 100% | — | To measure |
| Cloud Function uptime | >99.9% | — | To measure |

---

## Deployment Sequence (Do Not Deviate)

```
STEP 1: Provision Secrets (if not already set)
└─ firebase functions:secrets:set notivisa_sandbox_key <VALUE>

STEP 2: Type-check
└─ npx tsc --noEmit  (must be 0 errors)

STEP 3: Build
└─ npm run build

STEP 4: Pre-deploy gate
└─ bash scripts/preflight-secrets-check.sh  (must PASS)

STEP 5: Deploy Firestore Rules
└─ firebase deploy --only firestore:rules,firestore:indexes

STEP 6: Deploy Cloud Functions
└─ firebase deploy --only functions

STEP 7: Deploy Hosting (PWA)
└─ firebase deploy --only hosting

STEP 8: Verify
└─ Check Cloud Logs for errors
└─ Run smoke tests
└─ Manual test: create draft → submit → check audit trail

STEP 9: Monitor
└─ 24h continuous Cloud Logs monitoring
└─ Alert escalation if >5% error rate
```

---

## PR Template (Copy-Paste)

```markdown
## NOTIVISA Integration (Phase 4-03)

**Status:** Ready for Anvisa credentials (2026-05-15)

**Checklist:**
- [x] Firestore rules deployed + tested
- [x] Cloud Functions deployed + tested
- [x] Firestore indexes created + enabled
- [ ] E2E sandbox tests (awaiting credentials)
- [ ] Load test (awaiting credentials)
- [ ] Smoke tests (awaiting credentials)

**Files Changed:**
- `firestore.rules` — NOTIVISA collections rules
- `functions/src/modules/notivisa/**` — All 4 functions
- `functions/src/types/notivisa.ts` — Schema definitions
- `functions/src/__tests__/**` — Unit + integration tests
- `.planning/NOTIVISA_*.md` — Pre-deploy documentation

**Deployment Order:**
1. Rules (already live)
2. Functions (already live)
3. Indexes (already live)
4. E2E tests (2026-05-16)
5. Phase 4 Go (2026-05-20)

**Sign-Off:**
- Agent 3: Implementation ✅
- Engineering Lead: (pending)
- CTO: (pending)
```

---

## Quick Facts

- **Total checklist items:** 70
- **Currently complete:** 28 (40%)
- **Ready to execute:** 9 additional (13%)
- **Blocked on credentials:** 33 (47%)
- **Unblock date:** 2026-05-15 (Anvisa provisioning)
- **Time to full readiness:** 3 days (2026-05-16 to 2026-05-18)
- **Go/No-Go decision:** 2026-05-19
- **Phase 4 kickoff:** 2026-05-20
- **Risk level:** LOW (all code complete; awaiting credentials only)
- **Contingency plan:** Partial launch with mock if credentials delayed

---

**Last Updated:** 2026-05-07  
**Next Update:** 2026-05-15 (upon credential arrival)  
**Owner:** Agent 3 (Phase 4-03)  
**Stakeholder:** CTO + Engineering Manager
