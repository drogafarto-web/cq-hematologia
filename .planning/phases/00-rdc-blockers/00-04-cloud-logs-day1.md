# Plan 00-04 (Risks FMEA-lite) — Cloud Logs Day-1 Report

**Project:** hmatologia2
**Region:** southamerica-east1
**Deploy date (UTC):** 2026-05-07
**Plan:** Phase 0 / 00-04 — Risks FMEA-lite Skeleton
**Author:** Claude (executor)
**Audit window:** Day 1 baseline (post-deploy +0–60 min); 24h monitor pending operator dispatch

---

## Deploy summary

| Artifact | Status | Notes |
| --- | --- | --- |
| `firestore:rules` | DEPLOYED | Rules compiled OK (15 pre-existing warnings, all in unrelated lab-apoio block — see deferred-items). New `/labs/{labId}/risks/{riskId}` block + events sub-coleção released. |
| `firestore:indexes` | DEPLOYED | 2 composite indexes on risks (NPR DESC + reviewDate ASC) — already healthy from prior plan attempt. |
| `functions:risks_createRisk` | DEPLOYED | callable, 256 MiB, nodejs22, southamerica-east1. |
| `functions:risks_updateRisk` | DEPLOYED | callable. Server recomputes NPR + nivel. |
| `functions:risks_softDeleteRisk` | DEPLOYED | callable. Rejects if status=fechado. |
| `functions:risks_registrarRevisao` | DEPLOYED | callable. Reclassificado branch recomputes NPR. |
| `functions:onRiskEventCreated` | LIVE (pre-existing) | Firestore trigger. ChainHash idempotent. |
| `functions:scheduledReview` | LIVE (pre-existing) | cron daily 07:00 BRT. |
| `functions:provisionModulesClaims` | UPDATED | Now grants `modules.risks` + `modules['lab-apoio']`. |
| `hosting` | DEPLOYED | 36 files; PWA SW autoUpdate; 9806 KiB precache; `module-risks-BcWiE7jX.js` chunk live. |

**Stretch task `risks_seedFromCsv` deferred to v1.4.1** per PHASE-0-PLAN P0-R4 dropline (Wave 2 budget). MVP ships with empty register; Riopomba populates manually in week 2.

---

## Type-check + build gates (pre-deploy)

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` (web) | clean (0 errors) |
| `cd functions && npx tsc --noEmit` | clean (0 errors) |
| `npm run build` | clean — 32.10s, source maps uploaded to Sentry, `module-risks` chunk emitted |
| `cd functions && npm run build` | clean (predeploy hook ran during functions deploy) |

**TS errors fix lineage:** commit `824231b` (`fix(types): resolve TS errors in lab-apoio callables`) unblocked deploy after T1–T10 completion.

---

## Post-deploy baseline (UTC 04:00–04:10, +5–15 min after deploy)

### Cloud Functions cold-start probes

Sample of post-deploy startup probes (informational, severity=I):

```
[I] parsebulabioquimica   — STARTUP TCP probe succeeded after 1 attempt (port 8080)
[I] extractfrombula       — STARTUP TCP probe succeeded after 1 attempt (port 8080)
[I] extractfromimage      — STARTUP TCP probe succeeded after 1 attempt (port 8080)
[I] triggerlotsmigration  — STARTUP TCP probe succeeded after 1 attempt (port 8080)
[I] generatedashboardpdf  — Starting new instance (DEPLOYMENT_ROLLOUT)
```

All cold starts returned 0 errors. Containers booted on first probe. Healthy baseline.

### Severity=ERROR sweep

```
gcloud logging read 'resource.type="cloud_function" AND severity="ERROR" \
  AND timestamp>="2026-05-07T03:00:00Z"' --project hmatologia2 --limit 20
```

**Result:** 0 application errors. Returned entries are `cloudaudit.googleapis.com%2Factivity` admin-write audit records (function update events for `provisionModulesClaims`, `risks_*`) — these are the deploy itself, not runtime errors.

### Firestore rules compilation warnings

15 pre-existing warnings emitted at compile (unused validators / invalid var names) inherited from prior plans in the lab-apoio + reclamacao blocks. **All unrelated to risks**. Logged to `deferred-items.md` for cleanup in v1.4.

---

## Smoke verification (manual / pending operator)

Smoke flows below MUST be exercised by RT/manager on prod hard-reload (Ctrl+Shift+R). Each item ticked once verified live.

- [ ] `provisionModulesClaims({ dryRun: true })` returns updated diff with `modules.risks: true` for active users.
- [ ] `provisionModulesClaims({ dryRun: false })` applies; second dry-run prints `0 updates`.
- [ ] `/hub` shows `Riscos` tile after login.
- [ ] Click `Riscos` → `RisksView` mounts; KPI strip + tabs render.
- [ ] Tab `Registro` → click "Novo risco" → form 4 steps.
- [ ] Submit risk with `P=3 S=4 D=2` → server returns `npr=24`, `nivel='baixo'` (default thresholds: ≤24 baixo).
- [ ] Switch to tab `Matriz` → 5×5 SVG renders; cell `(P=3,S=4)` shows count=1.
- [ ] Click cell `(3,4)` → register filters to that risk only.
- [ ] Open risk → register revisão `mantido` → reviewHistory[] grows by 1; reviewDate = today + 365d.
- [ ] Try register revisão `reclassificado` with new `P=5 S=5 D=5` → server recomputes `npr=125`, `nivel='critico'`.
- [ ] Audit chain: `verifyChain` script returns OK across the 3 events (created, revisao-mantido, revisao-reclassificado).

**Operator handoff:** smoke checklist queued for RT login. Result will be appended to this file once executed.

---

## 24h Cloud Logs monitor

**Status:** Pending operator dispatch.

**Reason:** Long-running detached process (24h × 30min interval ≈ 48 polling cycles) cannot be initiated from the executor sandbox. The agent was permitted only foreground bash invocations within the 2-minute tool ceiling.

**Operator command (run in separate terminal — laptop must stay on or use VM):**

```bash
# WSL / Linux / macOS
bash scripts/monitor-cloud-logs.sh 24 30

# Windows native
pwsh -File scripts/monitor-cloud-logs.ps1 -DurationHours 24 -CheckIntervalMinutes 30
```

Output:
- Real-time console feed (timestamped checks)
- `scripts/cloud-logs-export-<TS>.json` (full error JSON dump)
- `docs/MONITORING_REPORT_<TS>.md` (final summary)

**Sign-off criteria (per CLOUD_LOGS_MONITORING_GUIDE.md):**
- 0 sustained errors (>5 occurrences of same signature)
- 0 OOM / cold-start timeouts on `risks_*` callables
- 0 chainHash compute failures in `onRiskEventCreated`
- Cron `scheduledReview` fires at 07:00 BRT day-1 with 0 errors

When the 24h cycle closes, paste the path to the generated MONITORING_REPORT here and flip the gate to GREEN.

---

## Deferred items (out of scope for Plan 00-04)

| Item | Origin | Disposition |
| --- | --- | --- |
| 15 firestore.rules compile warnings | Pre-existing (lab-apoio + reclamacao + nps + sugestao + lgpd + laudo + turnos + contrato + aceites + otp blocks) | Track for v1.4 cleanup. None affect runtime. |
| `risks_seedFromCsv` callable | Plan 00-04 T5 stretch | P0-R4 dropline → v1.4.1. Empty register acceptable for MVP. |
| `labSettings.nprThresholds` per-lab tuning | Plan 00-04 OPEN | Hardcoded thresholds in `risksService.ts` (baixo ≤24, medio 25–60, alto 61–99, critico ≥100). v1.4 Phase 1 settings UI follow-up. |

---

## Status

**Deploy: GREEN** (rules + indexes + functions + hosting all complete; 0 runtime errors in baseline).
**Smoke: PENDING** (RT login required).
**24h Monitor: PENDING** (operator dispatch required).
**Next gate:** Plan 00-04 `Definition of done` flips green when smoke + 24h sign-off both archived.
