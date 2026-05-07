---
title: "Post-Deploy Verification Checklist v1.3"
status: "Ready for execution"
created: 2026-05-06
scope: "Immediate verification after deployment (Step 4 of DEPLOY_ROADMAP_v1.3.md)"
---

# Post-Deploy Verification Checklist v1.3

**Purpose:** Comprehensive verification suite to confirm successful deployment of v1.3 across all layers (Firebase Console, routing, PWA, Cloud Logs, data integrity).

**Total checks:** 15 verification items across 5 categories.

**Execution context:** Run on production (`https://hmatologia2.web.app`) immediately after Step 3 (Hosting deploy) completes. Use a staging-flagged lab account (not client production data).

**Go/No-Go decision:** See Section "Go/No-Go Criteria" at end.

---

## Step 4.1 — Firebase Console Verification (5 checks)

All checks performed in **Firebase Console** (`console.firebase.google.com`). Project: `hmatologia2`.

| # | Check | Success Criteria | Notes |
|---|-------|------------------|-------|
| 4.1.1 | **Rules published** | Firestore → Rules tab → "Last published" timestamp = within last 30 min | Confirms Step 2 (rules deploy) completed |
| 4.1.2 | **Indexes building/ready** | Firestore → Indexes tab → all ~25 new composite indexes show status `Ready` or `Building` (not `Error` or `Failed`) | Some indexes may take 5–60 min. If all `Building` and <5 min old, is ok. If any in `Error`, **STOP — investigate** |
| 4.1.3 | **Functions deployed** | Cloud Functions → verify 16 functions present and version timestamped after deploy window. Check batches: (A) parseBulaBioquimica, (B) listarDocsDrive, (C) liberarLaudo, (D) criarReclamacao, (E) registrarCalibracao | All must show green status. If any red, check Cloud Logs for deployment error |
| 4.1.4 | **Function environment vars set** | Cloud Functions → select any bioquimica function (e.g., `parseBulaBioquimica`) → Runtime settings → Environment variables. Verify: `GEMINI_API_KEY`, `RESEND_API_KEY`, `DRIVE_OAUTH_CLIENT_ID`, `DRIVE_OAUTH_CLIENT_SECRET` all populated (values hidden but field non-empty) | Missing env vars = functions will error at runtime |
| 4.1.5 | **Firestore data accessible** | Firestore → Collections → verify `/labs/{stagingLabId}/bioquimica-analitos` collection visible with 16 docs (seed data) | If empty or missing, rollback and investigate seed script |

**Expected result:** All 5 checks green. Any red = investigate root cause before proceeding to 4.2.

---

## Step 4.2 — URL + Routing Verification (4 new routes)

Execute in **production browser** at `https://hmatologia2.web.app`. Logged in as RT (staging lab). Check DevTools → Network tab for any 4xx/5xx responses.

| # | Route | Success Criteria | Expected behavior |
|---|-------|------------------|-------------------|
| 4.2.1 | `/bioquimica` | Route loads in <3s. No 404. Page renders layout + header. Network tab: no 5xx errors. | Bioquímica dashboard loads. If 404 or blank, check `firebase.json` rewrites |
| 4.2.2 | `/bioquimica/admin` | Page renders. 16 seed analitos visible in table. No "Loading..." spinner after 5s. | Admin panel shows all analitos. If loading indefinitely, check Firestore read rules |
| 4.2.3 | `/sgq/lista-mestra` | Route loads. Page shows document list (may be empty if no imports yet). Sidebar navigation visible. | SGQ master list accessible. If 404, verify function imports not broken |
| 4.2.4 | `/reclamacoes` | Route loads. List view renders (may be empty). "Nova reclamação" button visible. | Complaints dashboard accessible. If route missing, check app routing config |

**Failure recovery:** If any 4xx/5xx:
- Check browser console for JS errors
- Check Firebase Rules (Console → Rules) for read denials
- Check Cloud Logs for error messages
- If unresolved, escalate to Step 4.4 (Cloud Logs deep-dive)

---

## Step 4.3 — PWA + Service Worker Verification (2 checks)

Execute in **browser DevTools**.

| # | Check | Success Criteria | Commands/steps |
|---|-------|------------------|---|
| 4.3.1 | **Service Worker updated** | DevTools → Application tab → Service Workers section. Active SW shows version hash different from pre-deploy (or timestamp newer). "Update on reload" prompt visible if cached version detected | Hard refresh (Ctrl+F5 / Cmd+Shift+R) to force SW update. If same version hash appears, build may not have produced hashed assets |
| 4.3.2 | **PWA installable** | DevTools → Application → Manifest. Manifest loads without error. "Install" button appears in address bar (Chrome) or menu → "Install app" (Edge) available. Click install → "Installed" confirmation dialog appears | PWA installability = healthy service worker + correct manifest. If install fails, check `vite.config.ts` PWA plugin config |

**Failure recovery:** If 4.3.1 fails:
- Clear browser cache (DevTools → Application → Clear site data)
- Hard refresh again
- If still same hash, redeploy hosting

If 4.3.2 fails:
- Check manifest validity in DevTools → Application → Manifest → verify no errors
- Verify `VITE_PUBLIC_URL` environment variable set correctly

---

## Step 4.4 — Cloud Logging Verification (1 check, 3 sub-steps)

Execute in **Cloud Logging UI** (`console.cloud.google.com` → Logging).

Filter: `resource.type="cloud_function"` AND `severity>="ERROR"` AND `resource.labels.function_name=~"^(parseBulaBioquimica|recordRunBioquimica|listarDocsDrive|liberarLaudo|criarReclamacao|..."` AND `timestamp>"2026-05-06T00:00:00Z"`

| # | Check | Success Criteria | Details |
|---|-------|------------------|---------|
| 4.4.1 | **No ERROR or higher severity in last 100 logs** | Cloud Logging query returns 0 results (no errors) OR errors are pre-existing (check timestamp = pre-deploy) | If new errors post-deploy, investigate function immediately. Copy stack traces → escalate to deploy lead |
| 4.4.2 | **Function invocations executed** | Query: `resource.type="cloud_function"` AND `jsonPayload.severity="INFO"`. Result shows >0 invocations per function (bioquimica, sgq, reclamacao batches). Sample 5 logs → all show clean completion or expected business logic (e.g., "Gemini parse completed in 1.2s") | Confirms functions are being called and responding. If 0 invocations, smoke tests may not have fired them |
| 4.4.3 | **No suspicious billing spikes** | Cloud Console → Billing → Cost Management → view last 1h spend. Should be <1% above baseline (baseline per project baseline) | High cloud spend post-deploy = runaway loops or inefficient rules. Investigate if spike >10% |

**Failure recovery:** If 4.4.1 shows errors:
1. Read full stack trace from the log
2. Cross-reference error against deployed function code (GitHub)
3. If error is transient (network timeout, quota), wait 5 min and re-check
4. If error is permanent (null ref, missing env var), escalate to Step 7 (Rollback)

---

## Step 4.5 — Firestore Data Integrity Spot-Checks (3 sample collections)

Execute in **Firebase Console** → **Firestore** or via **gcloud CLI**.

### Sample 1: Bioquímica Analitos (Seed Data)

| Check | Success Criteria | Query |
|-------|------------------|-------|
| 16 analitos present | Firestore → Collections → `/labs/{stagingLabId}/bioquimica-analitos` shows 16 documents | `db.collection('labs').doc(labId).collection('bioquimica-analitos').count().get()` |
| No corruption | Each doc has fields: `id`, `nome`, `unidade`, `metodoAnalise`, `criadoEm`, `ativo` (no `deletadoEm` = soft-delete only) | Sample 3 random docs: verify all fields present and types correct (string, timestamp) |
| Payload valid | Each doc structure matches CIQ data model (see `src/features/bioquimica/types.ts`) | Spot-check: glucose doc must have `metodoAnalise: "enzymatic"` or similar |

**Expected state:** 16 docs, all ativo=true, no soft-deletes, payload schema valid.

### Sample 2: SGQ Documents (if any imported)

| Check | Success Criteria | Query |
|-------|------------------|-------|
| Import successful | Firestore → Collections → `/labs/{stagingLabId}/sgq-documentos` contains documents (if batch import was tested) | Query count and filter by `status="vigente"` |
| Chain metadata | Each doc has `audit` object with: `criadoEm`, `criadoPor`, `ultimaAlteracaoEm`, `ultimaAlteracaoPor` | Sample 1 doc: `audit` fields all non-null timestamps/UIDs |
| No dangling references | `supervisorId`, `responsavelId` fields reference valid UIDs in `/labs/{labId}/members/` | Sample: pick a doc, verify referenced `supervisorId` exists in members collection |

**Expected state:** If imported, docs show clean audit trail and valid member references.

### Sample 3: Events Collection (Chain Integrity)

| Check | Success Criteria | Query |
|-------|------------------|-------|
| Events append-only | Firestore → `/labs/{stagingLabId}/bioquimica-runs/{runId}/events` contains >0 events (fired during Smoke 1) | Query and sort by `ts` DESC. Verify all timestamps monotonically increasing |
| Chain hash present | Each event has: `hash` (64-char hex string), `operatorId` (valid UID), `ts` (valid timestamp) | Sample 3 events: verify `hash.length == 64` and matches SHA-256 format |
| Signature valid | Run CLI script: `ts-node scripts/verify-chain.ts --labId={stagingLabId} --runId={testRunId}` → expect "✓ Chain valid" | Chain verifier must return success. If any hash broken, data corrupted during deploy |

**Expected state:** Events present, chain hashes valid (CLI confirms), monotonic timestamps.

---

## Go/No-Go Criteria

**GO (proceed to Phase 9 Validation):**
- ✅ All 5 console checks (4.1) passed
- ✅ All 4 routing checks (4.2) passed
- ✅ All 2 PWA checks (4.3) passed
- ✅ Cloud Logs (4.4) shows 0 new errors OR only known transient errors
- ✅ Data integrity (4.5) spot-checks all valid
- ✅ No critical issues found during smoke tests 1–5 (per DEPLOY_ROADMAP Section 3)

**NO-GO (escalate to rollback):**
- 🔴 Any Firebase console check red or error state
- 🔴 New routing returns 4xx or 5xx
- 🔴 Cloud Functions showing consistent 5xx errors
- 🔴 Cloud Logs showing permanent errors (not transient)
- 🔴 Chain hash verification fails
- 🔴 Firestore rules blocking legitimate reads (lockout)
- 🔴 PWA or SW completely broken (manifests errors)

**Conditional (investigate before deciding):**
- 🟡 Indexes still building after 60 min (rare, but acceptable if no queries depend on them)
- 🟡 Smoke test 4 (liberação state machine) partially fails (non-critical for v1.3)
- 🟡 Transient errors in Cloud Logs <1% invocation rate (monitor, do not rollback)

---

## Execution Checklist Template

Use this template to record execution:

```
Execution Date: ________________
Executor: ________________
Lab ID (staging): ________________
Deploy window start: ________________  Deploy window end: ________________

4.1 Firebase Console:
  [ ] 4.1.1 Rules published
  [ ] 4.1.2 Indexes ready/building
  [ ] 4.1.3 Functions deployed
  [ ] 4.1.4 Env vars set
  [ ] 4.1.5 Seed data accessible

4.2 Routing:
  [ ] 4.2.1 /bioquimica loads
  [ ] 4.2.2 /bioquimica/admin loads + 16 analitos visible
  [ ] 4.2.3 /sgq/lista-mestra loads
  [ ] 4.2.4 /reclamacoes loads

4.3 PWA/SW:
  [ ] 4.3.1 SW updated (new hash)
  [ ] 4.3.2 PWA installable

4.4 Cloud Logs:
  [ ] 4.4.1 No new errors
  [ ] 4.4.2 Functions invoked
  [ ] 4.4.3 No billing spikes

4.5 Data Integrity:
  [ ] Sample 1: 16 analitos valid
  [ ] Sample 2: SGQ docs (if applicable) valid
  [ ] Sample 3: Chain hash verified

GO/NO-GO Decision: [ ] GO  [ ] NO-GO  [ ] CONDITIONAL

Issues found (if any):
_________________________________________

Sign-off (name + timestamp):
_________________________________________
```

---

## Escalation Path

| Issue | Escalate To | Action |
|-------|---|---|
| Firebase Console red | Deploy Lead | Check Console error logs → diagnose |
| Routing 4xx/5xx | Eng A | Verify `firebase.json` rewrites, routing config |
| PWA broken | Eng B | Clear cache, check `vite.config.ts` PWA plugin |
| Cloud Logs errors | Functions Team | Review stack trace, check env vars, check Firestore rules |
| Chain hash broken | CTO + Auditor | Potential data corruption — escalate immediately to rollback |
| Billing spike | Ops | Check for runaway loops, Firestore read contention |

---

**Document version:** 1.3.0  
**Last updated:** 2026-05-06  
**Ready for execution:** YES
