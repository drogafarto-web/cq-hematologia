# Cloud Run Write Quota Increase Request — Pre-filled

**Date:** 2026-05-07
**Operator action:** Paste the fields in section "Form fields" into Google Cloud Console → IAM & Admin → Quotas & System Limits → filter by `Cloud Run Admin API`.

---

## Background

- **Project:** `hmatologia2`
- **Region:** `southamerica-east1`
- **Affected API:** `run.googleapis.com` (Cloud Run Admin API, write operations)
- **Current quota:** 60 writes/min (Google default)
- **Requested quota:** 600 writes/min (10× headroom)
- **Total deployed Gen-2 functions in region:** ~80 (each = one Cloud Run service revision per deploy)

### Justification (concrete observed event)

On **2026-05-07 between 04:00 and 04:10 UTC**, the operator deployed the post-`ADR-0017` HMAC-rebinding batch (~25 functions in a single `firebase deploy --only functions:fn1,fn2,...`). Cloud Run admin API rate-limited the burst: deploys serialized into ~3 minutes of stalled `Service.replaceService` calls and one transient 429 surfaced in the `gcloud` deploy log. The deploy ultimately succeeded (Firebase CLI auto-retries on Cloud Run admin throttling), but the burst was logged and is documented in `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` (operational checklist, item: *"redeploy affected functions in batches of ≤20 (avoid Cloud Run write-quota burst observed at 04:00 UTC same day)"*).

The 60 writes/min default ceiling is a soft floor for any Gen-2-Functions-on-Cloud-Run project past ~30 functions. Each `firebase deploy --only functions` performs 1 `Service.replaceService` write per function plus auxiliary IAM and traffic-split writes — practically 1.3–1.5 writes per function. At our current 80-function footprint, a full functions deploy issues ~110 writes; even staggered over ~2 minutes by Firebase CLI internals, this is right at the ceiling and degrades the longer the deploy runs (every retry costs additional quota credit because the prior failed attempt is also counted).

Projected growth: v1.5 roadmap adds 7-9 callables (per `.planning/reports/orphan-callables-triage-2026-05-07.md` — auditor console, qualificação, manutenção structured forms, plus the WIRE-FIRST wave). v1.6 mobile back-end adds 4-6 functions. Within 6 months the project will exceed 100 functions, at which point a single full deploy will durably exceed the 60 writes/min default and force operator-side batching (which we'd rather not encode as a permanent workaround). Requesting 600 writes/min (10× current) covers this trajectory through the next 18 months and removes the need for batch scripting.

### Business impact if not granted

Deploys remain functional but require manual batching (≤20 functions per deploy invocation, with 60-second sleeps between batches) — operationally fragile, easy to break under incident pressure when an operator wants to roll back the full surface in one command. Firebase CLI's auto-retry handles isolated 429s gracefully, but a sustained burst (full surface deploy) can stretch from <60 s to >5 min, widening the window where the production surface holds mixed function versions. That mixed-version window is the exact failure mode that motivated `ADR-0018` (deploy-gate hardening): the longer it lasts, the higher the chance of a misordered claim/rules/functions sequence reaching live traffic. Removing the quota ceiling shortens the window mechanically without requiring any code change.

---

## Form fields (Cloud Console → IAM & Admin → Quotas & System Limits → Cloud Run Admin API)

| Field | Value |
|---|---|
| **Service** | `run.googleapis.com` |
| **Quota name** | "Write requests per minute per region" (filter by `Write requests per region`) |
| **Metric** | `run.googleapis.com/admin_write_requests` |
| **Region (dimension)** | `southamerica-east1` |
| **Current limit** | `60` |
| **Requested new limit** | `600` |
| **Project ID** | `hmatologia2` |
| **Project number** | (operator: read from Console → IAM → Settings → Project number) |
| **Contact email** | drogafarto@gmail.com |
| **Contact name** | (operator full name as on Google Cloud billing) |

### Justification (paste verbatim into the form's "Justification" textarea)

> Project hmatologia2 is a multi-tenant SaaS for clinical-laboratory quality control deployed on Firebase Functions Gen 2, region southamerica-east1. Current footprint is ~80 Gen-2 callable / scheduled / trigger functions, each materialized as one Cloud Run service. A typical full functions deploy (`firebase deploy --only functions`) issues ~110 Cloud Run admin write operations (Service.replaceService + IAM bind + traffic split). On 2026-05-07 04:00–04:10 UTC, a 25-function rebind deploy was observably rate-limited at the 60 writes/min default; the deploy completed via Firebase CLI auto-retry but stalled for ~3 minutes. Roadmap adds 7-9 callables in v1.5 and 4-6 in v1.6, projecting to ~100 functions by 2026-Q4. We request an increase to 600 writes/min (10× headroom) to (a) eliminate the need for operator-side manual batching scripts; (b) shorten the mixed-version production window during full deploys; (c) keep a single project-level quota appropriate for the function footprint trajectory. The increase has no Firestore/Cloud SQL/network cost dimension — Cloud Run admin writes are free of metered charge; the quota is purely a rate-limit ceiling for the control plane.

### Business impact if not granted (paste verbatim)

> Without the increase, deploys remain functional but require operator-side batching (≤20 functions per `firebase deploy --only functions:list`, with paced invocations). This is fragile under incident pressure (e.g., emergency rollback of the full surface), encodes a permanent workaround into our operational runbooks, and lengthens the mixed-version production window — the same failure surface that motivated our ADR-0018 deploy gate. We are not requesting any other quota change; just this one ceiling.

---

## Pre-paste checklist (operator)

- [ ] Confirm the 04:00–04:10 UTC 2026-05-07 deploy event in `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` (operational checklist line: *"avoid Cloud Run write-quota burst observed at 04:00 UTC same day"*) — this is the cited evidence.
- [ ] Confirm logged-in to Cloud Console as `drogafarto@gmail.com` (project Owner role required to file quota requests).
- [ ] Confirm correct project selector: `hmatologia2` (project number visible in Console → Home → Dashboard).
- [ ] Confirm region filter is set to `southamerica-east1` before submitting (the form may default to `us-central1`).
- [ ] Take screenshot of the "current usage vs limit" graph for the last 7 days before submitting — Google reviewers ask for it ~50% of the time as a follow-up.
- [ ] Save the form's tracking number (Case ID) in `.planning/reports/cloud-run-quota-request-2026-05-07.md` after submit.

---

## Approval timeline

- **Standard SLA:** 24-72 hours for tier-1 quota changes (≤10× default).
- **Likely outcome:** approved without back-and-forth — a 10× bump is well inside the auto-approve range for projects with billing in good standing and no quota-abuse history. If Google asks for clarification, the most common questions are "what is the projected sustained rate?" (answer: deploys are bursty, ~110 writes within 2-3 minutes, ~3-5× per week) and "is this a one-time event or steady state?" (answer: steady state — function count grows monotonically with feature roadmap).
- **After approval:** **no additional code change required.** The new ceiling applies to the next `firebase deploy --only functions` invocation. The operator-side batch workaround (≤20 functions per deploy invocation) referenced in `ADR-0017` operational checklist becomes obsolete and can be deleted from the deploy runbook.
- **Post-approval cleanup tasks:**
  - [ ] Delete the "batches of ≤20" instruction from `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` operational checklist (replace with reference to the granted quota).
  - [ ] Update `.claude/rules/deploy-protocol.md` — current text doesn't mention batching, but if a future ADR cites it, link the granted quota case ID.
  - [ ] Sanity-test: run a full functions deploy and confirm wall-clock time drops from ~3 min to <60 s.

---

## References

- `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` — original observation of the 04:00 UTC burst (operational checklist line about "≤20 functions per batch")
- `docs/adr/ADR-0018-deploy-gate-secret-status-check.md` — related deploy-hardening ADR; the mixed-version window argument cites this
- `.planning/reports/cloud-logs-sweep-2026-05-07.md` — does not directly contain the 04:00 burst (focuses on runtime errors, not deploy throttling), but documents the same-day deploy that triggered it
- `.planning/reports/orphan-callables-triage-2026-05-07.md` — projected v1.5 callable additions cited in the growth justification
- Google Cloud docs: [Cloud Run quotas and limits](https://cloud.google.com/run/quotas) — confirms 60 writes/min default and 10× as standard tier-1 increase
