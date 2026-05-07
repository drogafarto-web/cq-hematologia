# Function Deploy Reconciliation — 2026-05-07

Investigation of two anomalies flagged in `post-deploy-verification-2026-05-07.md`:

1. Spot-check failure: `logAction` and `criarQualificacao` "do not exist as deployed functions in this project."
2. Only 15 functions carry the `HCQ_SIGNATURE_HMAC_KEY` secret binding — ADR-0017 expected ~25.

Both anomalies share a **single root cause**: several functions whose secret bindings ADR-0017 fixed in source were *never* re-exported through `functions/src/index.ts`. Firebase Functions v2 only deploys what is enumerated in the entry module — code that lives in `functions/src/modules/...` but is not exported by `index.ts` is silently absent from the deployed catalog. ADR-0017 fixed the binding, but the binding can only take effect on a function that is actually deployed.

---

## Summary

- **HMAC reader functions in source:** 26 (every `export const … = onCall/onSchedule/onDocumentWritten(…, { secrets: [HCQ_SIGNATURE_HMAC_KEY] }, …)`)
- **Deployed functions with HMAC binding:** 15 (matches the verification report exactly)
- **Discrepancies (source has, deploy lacks):** **11 functions across 5 unregistered files**
- **Genuine deploy failures:** 0 — every missing function is missing because it was never wired into `index.ts`, not because deploy errored. There is nothing to "redeploy"; the fix is to add `export {…} from …` lines.

---

## logAction

- **Status:** **NOT-EXPORTED** in `functions/src/index.ts` (never has been — `git log -S "auditTrail" -- functions/src/index.ts` returns no commits).
- **Source location:** `functions/src/modules/qualidade/auditTrail.ts:18` — `export const logAction = onCall({ region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] }, …)`.
- **Companion exports in same file (also missing):** `getAuditTrail` (line 73), `validateChain` (line 124), `generateComplianceReport` (line 155).
- **Evidence:** `gcloud functions describe logAction --region=southamerica-east1 --project=hmatologia2 --gen2` → 404 *Resource not found*. `index.ts` only re-exports from `./modules/qualidade/naoConformidade` (line 242) — never imports from `auditTrail.ts` or from the `qualidade/index.ts` barrel that *does* export `logAction`'s siblings.
- **Sibling barrel:** `functions/src/modules/qualidade/index.ts` re-exports `naoConformidade` + `capaWorkflow` but is itself unused by the entry module.
- **Action (operator decision):** add to `functions/src/index.ts`:
  ```ts
  export { logAction, getAuditTrail, validateChain, generateComplianceReport }
    from './modules/qualidade/auditTrail';
  export { investigarNC, executarAcaoCorretiva, verificarEficacia }
    from './modules/qualidade/capaWorkflow';
  ```
  Then `firebase deploy --only functions:logAction,functions:getAuditTrail,functions:validateChain,functions:generateComplianceReport,functions:investigarNC,functions:executarAcaoCorretiva,functions:verificarEficacia --project hmatologia2`.

## criarQualificacao

- **Status:** **NOT-EXPORTED** in `functions/src/index.ts` (never has been — `git log -S "criarQualificacao" -- functions/src/index.ts` empty).
- **Source location:** `functions/src/modules/pessoas/qualificacao.ts:10` — `export const criarQualificacao = functions.onCall({ region: 'southamerica-east1', secrets: [HCQ_SIGNATURE_HMAC_KEY] }, …)`.
- **No barrel `index.ts`** exists in `functions/src/modules/pessoas/`. Only file siblings are `qualificacao.ts` + `types.ts`.
- **Evidence:** `gcloud functions describe criarQualificacao …` → 404. No reference of "pessoas" in `functions/src/index.ts`.
- **Action (operator decision):** add to `functions/src/index.ts`:
  ```ts
  export { criarQualificacao } from './modules/pessoas/qualificacao';
  ```

## Other discrepancies (same root cause)

### `compras/notaFiscal.ts` and `compras/fornecedor.ts` — entire module unwired

- **Functions affected:** `criarNotaFiscal` (notaFiscal.ts:14), `confirmarRecebimento` (notaFiscal.ts:101), `upsertFornecedor` (fornecedor.ts:11).
- The two with HMAC bindings (`criarNotaFiscal`, `confirmarRecebimento`) are listed in ADR-0017's fix scope.
- **Status:** NOT-EXPORTED. There is no `functions/src/modules/compras/index.ts` barrel and `functions/src/index.ts` has zero references to `compras` or `notaFiscal`. There is, however, an active scheduled function `scheduledMigrateNotaFiscalDates` deployed from a different file (`scheduledMigrateNotaFiscalDates.ts`) that operates on the schema these callables would write — strongly suggesting the callables were intended to be live.
- **Action:** add a barrel + export, or import directly:
  ```ts
  export { criarNotaFiscal, confirmarRecebimento } from './modules/compras/notaFiscal';
  export { upsertFornecedor } from './modules/compras/fornecedor';
  ```

### `equipamentos/equipamentos.ts` — `registrarManutencao` omitted from destructure

- **Source:** line 163, has HMAC binding.
- **Barrel `modules/equipamentos/index.ts`:** does export `registrarManutencao` (line 1).
- **`functions/src/index.ts:328-331`:** the destructure pulls only `criarEquipamento` and `registrarCalibracacao`, dropping `registrarManutencao`.
- **Status:** NOT-EXPORTED via the entry module despite being in the barrel.
- **Action:** extend the existing destructure on line 328-331 of `index.ts`:
  ```ts
  export {
    criarEquipamento,
    registrarCalibracacao,
    registrarManutencao,    // ADD
  } from './modules/equipamentos/index';
  ```

### Full miss list (HMAC reader in source × deploy status)

| Function | Source file | Deployed? | Reason |
|---|---|---|---|
| `onHematologiaRunSignature` | signatures/triggers.ts | OK | exported via `signatures/index.ts` |
| `onImunoRunSignature` | signatures/triggers.ts | OK | " |
| `onMovimentacaoSignature` | signatures/triggers.ts | OK | " |
| `validateChainIntegrityScheduled` | audit/chainHashValidator.ts | OK | " |
| `validateChainIntegrityOnDemand` | audit/chainHashValidator.ts | OK | " |
| `openNaoConformidade` | qualidade/naoConformidade.ts | OK | direct re-export at index.ts:238 |
| `updateNaoConformidade` | qualidade/naoConformidade.ts | OK | " |
| `addAcao` | qualidade/naoConformidade.ts | OK | " |
| `createPOP` | procedimentos/pop.ts | OK | re-exported at index.ts:250 |
| `createPOPVersion` | procedimentos/pop.ts | OK | " |
| `assinaturaRT` | procedimentos/pop.ts | OK | " |
| `recordarTreinamentoPOP` | procedimentos/pop.ts | OK | " |
| `criarEquipamento` | equipamentos/equipamentos.ts | OK | re-exported at index.ts:328 |
| `registrarCalibracacao` | equipamentos/equipamentos.ts | OK | " |
| `submitReview` | management-review/submitReview.ts | OK | re-exported at index.ts:434 block |
| **`registrarManutencao`** | equipamentos/equipamentos.ts | **MISS** | omitted from destructure at index.ts:328-331 |
| **`logAction`** | qualidade/auditTrail.ts | **MISS** | file never imported in index.ts |
| **`getAuditTrail`** | qualidade/auditTrail.ts | **MISS** | " |
| **`validateChain`** | qualidade/auditTrail.ts | **MISS** | " |
| **`generateComplianceReport`** | qualidade/auditTrail.ts | **MISS** | " |
| **`investigarNC`** | qualidade/capaWorkflow.ts | **MISS** | file never imported in index.ts |
| **`executarAcaoCorretiva`** | qualidade/capaWorkflow.ts | **MISS** | " |
| **`verificarEficacia`** | qualidade/capaWorkflow.ts | **MISS** | " |
| **`criarQualificacao`** | pessoas/qualificacao.ts | **MISS** | file never imported in index.ts |
| **`criarNotaFiscal`** | compras/notaFiscal.ts | **MISS** | file never imported in index.ts |
| **`confirmarRecebimento`** | compras/notaFiscal.ts | **MISS** | " |

**Total: 26 source / 15 deployed / 11 missing — exactly matches the 15-function HMAC binding count from `gcloud functions describe`.** ADR-0017's "~25 functions" estimate referred to source declarations; the actual deployed surface is and always has been 15.

---

## Causes ruled out

- **Renamed:** No — exact-name greps confirm declarations under the original names.
- **Group-export aliasing:** No — `qualidade/index.ts` and `equipamentos/index.ts` barrels do export the missing names, but `functions/src/index.ts` either bypasses those barrels (qualidade) or destructures incompletely (equipamentos), and `pessoas/` + `compras/` have no barrels at all.
- **Partial deploy failure:** No — `gcloud describe` returns 404 (resource never created), not an errored revision. The 26 May 2026-05-07 deploy succeeded for everything that was *enumerated*; nothing failed silently.
- **Test files mistakenly imported:** No — none of the 11 missing functions live in `*.test.ts`.

---

## Risk assessment

These 11 functions back **regulatory and audit features** that the web client almost certainly invokes. Likely production impact (to be confirmed by client-side grep):

- `logAction` — generic audit trail writer; if `auditService.ts` calls it via `httpsCallable`, every UI write that triggers a log silently fails.
- `getAuditTrail`, `validateChain`, `generateComplianceReport` — RDC 978 Art. 5.3 + DICQ 4.4 reads. Compliance dashboards return empty / 404.
- `investigarNC`, `executarAcaoCorretiva`, `verificarEficacia` — CAPA workflow transitions. NC investigation UI cannot progress past "aberta" if these are wired in the client.
- `criarQualificacao` — RDC 978 Art. 122 (personnel qualifications). New qualification submissions error.
- `criarNotaFiscal`, `confirmarRecebimento` — purchase-order intake. If any UI calls these, supplier receipts cannot be recorded.
- `registrarManutencao` — equipment maintenance log. ADR-0007 calibration gate may degrade.

**Note:** absence of deploy ≠ absence of UI usage — the client may already be soft-failing. A client-side grep for `httpsCallable\((auth|functions), '(logAction|criarQualificacao|investigarNC|executarAcaoCorretiva|verificarEficacia|getAuditTrail|validateChain|generateComplianceReport|criarNotaFiscal|confirmarRecebimento|upsertFornecedor|registrarManutencao)'\)` will quantify the blast radius. *Not performed in this report — operator decision.*

---

## Recommendation (operator-only — no auto-deploy)

1. **Decide intent.** For each of the 11 functions, confirm the function is actually wanted in production. If `auditTrail.ts` and `capaWorkflow.ts` were experimental/superseded, mark the files as `.skip` or delete and update ADR-0017's scope claim from "~25" to "15".
2. **If wanted (likely):** add the missing exports to `functions/src/index.ts` in one PR, run `bash scripts/preflight-secrets-check.sh`, then `firebase deploy --only functions:<comma-separated-11-names> --project hmatologia2`.
3. **Update post-deploy verification spot-check** to assert the count of HMAC-bound functions matches the count of HMAC-reader source declarations (currently 15 vs 26 — the gap is the bug detector).
4. **Add lint rule / CI gate** that fails the build if a `*.ts` file under `functions/src/modules/` exports an `onCall|onSchedule|onDocument*` symbol that is not transitively re-exported by `functions/src/index.ts`. Same class of bug otherwise resurfaces every time someone authors a callable in a new file.
