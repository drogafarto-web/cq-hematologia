# Pre-Deploy Verification — v1.4-final-closure (2026-05-09)

**Verifier:** automated pre-deploy gate
**Branch HEAD:** `c6103c2` (docs: MP-5a-W6 phase 9b verification gate)
**Baseline ref:** `51785dd` (TSC=0, functions build=0, captured at start of v1.4-final-closure)

## Gate Status

| Gate | Result | Detail |
|------|--------|--------|
| TSC (web) | **FAIL** | 8 errors, all in `src/features/criticos-fsm/` (MP-4 untracked code) |
| Functions build | **FAIL** | exit 2 — wrong imports in `criticos-fsm/escalacaoSLA.ts` + tsconfig pulling in `../src/` web files |
| Tests | **FAIL** | 1859 pass / 21 fail / 148 skip (13 files failed of 115) — Patient Portal regressions |
| CORS | **FAIL** | 17 callables checked across auditoria/criticos/criticos-fsm/bioquimica; **6 missing `cors:true`** in `auditoria/auditoria.ts` |
| Bundle size | **PASS (stale)** | 405 KB gzip on baseline build (commit 51785dd, 1.6 MB raw → 405 KB gz). Branch build is broken so no fresh measurement; baseline is well under 450 KB target |
| Secrets in diff | **PASS** | Only `defineSecret('NAME')` references; no key material, tokens, or service-account JSON in diff |
| Preflight secrets | **PASS** | All 15 declared secrets resolve to real values (GEMINI/HCQ_HMAC/NOTIVISA/TWILIO/SMTP/OPENROUTER) |
| Firestore rules | **PASS** | `firebase deploy --only firestore:rules --dry-run` compiled successfully (warnings about helper-function name resolution are non-blocking — helpers are defined later in the file) |
| Callable inventory | **FAIL** | 17 new callables; 6 missing CORS (see CORS gate); 3 duplicate exports (build conflict risk) |
| Monitoring scripts | **PASS** | `scripts/monitor-cloud-logs.sh` + `scripts/monitor-cloud-logs.ps1` both exist |

---

## Detailed Findings

### 1. TSC errors (web) — 8 errors, all MP-4 / criticos-fsm

```
src/features/criticos-fsm/components/CriticosFSMPanel.tsx(12,30): error TS2307: Cannot find module '../../../functions/src/modules/criticos-fsm/escalacaoSLA' or its corresponding type declarations.
src/features/criticos-fsm/components/CriticosFSMPanel.tsx(173,28): error TS2503: Cannot find namespace 'JSX'.
src/features/criticos-fsm/services/criticosFSMService.ts(103,27): error TS2554: Expected 3 arguments, but got 1.
src/features/criticos-fsm/services/criticosFSMService.ts(119,5): error TS2322: Type 'string' is not assignable to type 'LogicalSignature'.
src/features/criticos-fsm/services/criticosFSMService.ts(186,29): error TS2554: Expected 3 arguments, but got 1.
src/features/criticos-fsm/services/criticosFSMService.ts(203,7): error TS2322: Type 'string' is not assignable to type 'LogicalSignature'.
src/features/criticos-fsm/services/criticosFSMService.ts(258,11): error TS2783: 'id' is specified more than once, so this usage will be overwritten.
src/features/criticos-fsm/services/criticosFSMService.ts(293,5): error TS2783: 'id' is specified more than once, so this usage will be overwritten.
```

Root causes:
- Web component imports a Cloud Functions source file directly (architecture violation — should call via callable, never reach across boundary).
- `LogicalSignature` is being assigned a `string` instead of a `{ hash, operatorId, ts }` map (violates project invariant).
- `JSX` namespace not imported (React 19 requires explicit `import type { JSX } from 'react'` or use `React.JSX`).
- `id` duplicated in object spread.

Remediation owner: **MP-4** (criticos-fsm). Files are still untracked (`?? src/features/criticos-fsm/`) — must be fixed before staging.

### 2. Functions build break

`functions/src/modules/criticos-fsm/escalacaoSLA.ts` has bad imports:
```ts
import { onCall, onSchedule, HttpsError } from 'firebase-functions/v2';
```
Correct shape:
```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
```

Plus 12 errors from `../src/config/firebase.config.ts` and `../src/shared/services/firebase.ts` — `functions/tsconfig.json` is including the parent `src/` directory. This pre-dates MP-4 and should be confirmed against baseline (BASELINE-2026-05-09.md says functions build was 0 errors at 51785dd, so the tsconfig leak is being triggered specifically by `escalacaoSLA.ts`'s broken imports). Fixing the import will likely resolve the cascade.

Other untracked-file issue: `functions/src/modules/criticos-fsm/` is still `??` in git status.

### 3. Test failures — 21 of 2028

13 test files failed. Concentrated in patient-portal:

- `src/features/patient-portal/__tests__/usePatientAuthStore.test.ts` — session restore + expiry test failing (localStorage handling).
- `src/features/portal-paciente/__tests__/portal-paciente.test.tsx` — `FirebaseError: Expected first argument to collection() to be a CollectionReference...` — Firebase mock not set up.

Baseline (BASELINE-2026-05-09.md) does not give a hard pre-MP test count — it says "baseline to be determined in first verification gate". Cannot prove regression vs. pre-branch state without that number, but the failures look like genuine breakage (not flakes): localStorage state pollution between tests + missing Firestore mocks. **Recommend treating as a blocker** until MP-5b/MP-5c owner confirms these tests passed before the branch.

### 4. CORS gate — 6 missing `cors:true`

| File | Callable | Region | cors:true | Status |
|---|---|---|---|---|
| auditoria/auditoria.ts:76 | createAuditoria | yes | **NO** | FAIL |
| auditoria/auditoria.ts:141 | registerAchado | yes | **NO** | FAIL |
| auditoria/auditoria.ts:309 | installChecklistTemplate | yes | **NO** | FAIL |
| auditoria/auditoria.ts:433 | updateChecklistResponses | yes | **NO** | FAIL |
| auditoria/auditoria.ts:510 | createPlanoAcao | yes | **NO** | FAIL |
| auditoria/auditoria.ts:547 | closeAuditoria | yes | **NO** | FAIL |
| auditoria/archiveAuditReport.ts:135 | archiveAuditReport | yes | yes | PASS |
| auditoria/archiveAuditReport.ts:182 | archiveAuditReportsMonthly (onSchedule) | yes | n/a | PASS |
| auditoria/createReAuditoria.ts:32 | createReAuditoria | yes | yes | PASS |
| auditoria/createPlanoAcao.ts:34 | createPlanoAcao (DUPLICATE) | yes | yes | PASS |
| auditoria/emailAuditReport.ts:103 | emailAuditReport | yes | yes | PASS |
| auditoria/generatePDF.ts:699 | generateAuditReportPDF (DUPLICATE) | yes | **NO** | FAIL-ish (also duplicate) |
| auditoria/generateReportPDF.ts:399 | generateAuditReportPDF (DUPLICATE) | yes | yes | PASS |
| auditoria/registerPresenca.ts:38 | registerPresenca | yes | yes | PASS |
| criticos/escalateCritico.ts:157 | escalateCritico | yes | yes | PASS |
| criticos/criticoDetector.ts:120 | onResultWriteDetectCritico (Firestore trigger, not callable) | yes | n/a | PASS |
| criticos-fsm/escalacaoSLA.ts:219 | fsmEscalacao | yes | yes | PASS (but file doesn't compile) |
| criticos-fsm/escalacaoSLA.ts:259 | fsmEscalacaoSweep (onSchedule) | yes | n/a | PASS |
| bioquimica/geminiOCRParser.ts:22 | submitBioquimicaRunWithOCR | yes | yes | PASS |
| bioquimica/geminiVisionService.ts:22 | parseAnalyteStripImage | yes | yes | PASS |

Net: **6 callables missing `cors:true`** in `auditoria/auditoria.ts`. Hard blocker.

### 5. Duplicate callable exports — build/deploy collision risk

Three callables are exported from two source files:
- `createPlanoAcao` — `auditoria/auditoria.ts:510` AND `auditoria/createPlanoAcao.ts:34`
- `generateAuditReportPDF` — `auditoria/generatePDF.ts:699` AND `auditoria/generateReportPDF.ts:399`
- `registerCriticoDetection` — `criticos/index.ts:141` AND `criticos/registerDetection.ts:201`

Whichever is wired in the functions index file wins; the other dead-code costs build time and confuses ownership. Worse: if both end up re-exported, deploy will fail with "duplicate function name". MP-1 (auditoria) and MP-3 (criticos) owners need to pick one and delete the other.

### 6. Bundle size

405 KB gzip on `index-Bd1r6lVW.js` (baseline build at 51785dd). Under both targets (≤450 target / ≤460 hard). Note: this is **stale** — branch HEAD cannot be built right now because of the TSC errors above. Once TSC + functions build are fixed, re-run `npm run build` and recompute.

### 7. Firestore rules

```
+  cloud.firestore: rules file firestore.rules compiled successfully
+ Dry run complete!
```
PASS. The "Invalid function name" warnings are forward-reference noise (rule compiler warns when a function calls another defined later in the file) — not a failure.

### 8. Secrets / preflight

- All 15 secrets provisioned in `hmatologia2`. Safe to deploy functions from a credentials standpoint.
- Diff scan against tight pattern set (BEGIN PRIVATE KEY, AKIA, AIza+35chars, ghp_, sk-, firebase-adminsdk@) returned zero matches.

---

## Blockers (MUST fix before MP-8 deploy)

1. **TSC errors in `src/features/criticos-fsm/` (8)** — owner: MP-4. Stage the directory, fix imports + LogicalSignature shape + JSX import + duplicate `id` keys. Until then web build is dead.
2. **Functions build broken** — owner: MP-4. Fix `escalacaoSLA.ts` imports (`firebase-functions/v2/https` + `firebase-functions/v2/scheduler`). Re-run `cd functions && npm run build` to confirm 0 errors.
3. **6 callables missing `cors:true` in `auditoria/auditoria.ts`** — owner: MP-1 (auditoria). Add `cors: true` to all six options objects (lines 77, 142, 310, 434, 511, 548).
4. **Duplicate callable exports (3)** — owners: MP-1 (auditoria, 2 dups) + MP-3 (criticos, 1 dup). Pick canonical file, delete the other or remove the duplicate `export const`.
5. **21 unit tests failing** — owners: MP-5b/MP-5c or whoever owns patient-portal/portal-paciente. Either fix or, if the failures predate this branch, document with a baseline note in BASELINE-2026-05-09.md and confirm no regression beyond pre-existing.

## Non-blockers / advisories

- Bundle size cannot be re-measured until TSC is green. Baseline at 405 KB gzip is well under target, so this is informational.
- `firestore.rules` "Invalid function name" warnings are forward-reference noise, not a failure.

## Ready for MP-8 deploy: **NO**

5 blockers above must be cleared. Recommended order:
1. MP-4 fixes TSC + functions build (unblocks everything else).
2. MP-1 fixes 6 missing CORS + drops auditoria duplicates.
3. MP-3 drops criticos duplicate.
4. Patient-portal owner triages 21 test failures (fix or document as pre-existing).
5. Re-run this verifier; once all gates green, MP-8 may proceed in the canonical order: rules → functions → hosting.
