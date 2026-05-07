---
phase: 0
plan: 00-03
slug: lab-apoio-contracts
stream: A
status: execution-ready
---

# Plan 00-03 Execution Checklist — Lab Apoio Contracts

**Stream**: A (parallel with Stream B / Plan 00-04)  
**Duration estimate**: 2.5 days (250 LOC/day typical)  
**Agent**: Single dedicated agent  
**Start condition**: Wave 1 complete + green `npm test 738/738` + `firestore.rules` + `functions/` deployed

---

## T1. Backfill REQ-416 + Scaffold Types + Service (Read-Only)

**Outcome:** REQ-416 documented; `Contrato` types defined; `labApoioService.ts` reads built.

**Files to create/modify:**

- `/.planning/milestones/v1.4-REQUIREMENTS.md` — add REQ-416 block
- `/src/features/lab-apoio/CLAUDE.md` — module rules (copy template from `turnos/CLAUDE.md`, adapt)
- `/src/features/lab-apoio/types/LabApoio.ts` — all types from PLAN.md §Files affected→New
- `/src/features/lab-apoio/services/labApoioService.ts` — `subscribeCon tratos`, `getContrato`, `mapSnapshotToContrato`, callable wrappers
- `/src/features/lab-apoio/services/labApoioStorageService.ts` — Storage helpers

**Steps:**

1. **REQ-416 backfill** (30 min):
   - Copy PLAN.md Goal section
   - Write user story: "As an lab admin, I want to manage outsourced lab contracts (CNPJ, AVS, exams, evaluations) so compliance with RDC 978 Art. 36–39 is auditable"
   - List acceptance criteria from PLAN.md (auditor list active contracts, expiry alerts 60/30/7d, evaluations annual, chainHash audit trail)
   - Set phase=`v1.4`, effort=40pt
   - CTO confirms wording

2. **Invoke `hcq-module-generator`** (20 min):
   - Skill: `hcq-module-generator` with `moduleName='lab-apoio'`, `readOnlyMode=true`
   - Scaffold: `src/features/lab-apoio/{types,services,hooks,components,__tests__}` directories

3. **Define types** (45 min):
   - Copy PLAN.md schema verbatim: `Contrato`, `ContratoInput`, `ExameItem`, `Certificacao`, `AvaliacaoPeriodica`, `Contato`, `Endereco`, `LabApoioFilters`, `LabApoioAuditEvent`
   - Add `LogicalSignature` reuse from `src/utils/logicalSignature.ts`
   - Export all from `types/index.ts`

4. **Implement service read-side** (45 min):
   - `subscribeContratos(labId, opts, cb, onErr)`: mirror `useColaboradores` pattern
     - Path: `/labs/{labId}/lab-apoio/{contratoId}`
     - Filter: `deletadoEm === null` client-side
     - Opts: `{ativo?: boolean, criticidade?: string, expirandoEm?: [desde, ate]}`
   - `getContrato(labId, id)`: single fetch + map
   - `mapSnapshotToContrato(snapshot)`: Timestamp → Date coercion
   - **Callable wrappers** (no mutations, just `httpsCallable` + `unwrapCallableError`):
     - `callCreateContrato(payload)`
     - `callUpdateContrato(id, payload)`
     - `callSoftDeleteContrato(id, motivo)`
     - `callRegistrarAvaliacaoPeriodica(id, avaliacao)`
     - `callUploadContratoAnexo(id, fileMeta)`

5. **Implement storage service** (30 min):
   - `uploadContratoPdf(labId, contratoId, file)`: 
     - Validate `file.type === 'application/pdf'`
     - Check `file.size < 10 * 1024 * 1024` (10MB)
     - Return `{url, size}` if success; throw user-readable error if fail
   - `getSignedUrl(labId, contratoId, fileName)`: wrapper over `ref().getDownloadURL()`

**Verification:**

- ✅ `npx tsc --noEmit` zero errors
- ✅ `import { Contrato, ... } from 'src/features/lab-apoio'` resolves in test file
- ✅ REQ-416 block in REQUIREMENTS.md human-readable

**Rollback (if needed):** Delete `src/features/lab-apoio/` directory; remove REQ-416 block from REQUIREMENTS.md.

---

## T2. Implement Callable Validators + CNPJ Checksum Unit Tests

**Outcome:** Zod validators + CNPJ checksum function implemented; unit tests passing.

**Files to create:**

- `/functions/src/modules/labApoio/validators.ts`
- `/functions/src/modules/labApoio/signatureCanonical.ts`
- `/functions/src/modules/labApoio/index.ts` (barrel)
- `/functions/test/labApoio/cnpj.test.mjs`

**Steps:**

1. **Mirror turnos validators** (60 min):
   - Copy `functions/src/modules/turnos/validators.ts` → `functions/src/modules/labApoio/validators.ts`
   - Adapt function names (`turnos*` → `labApoio*`)
   - Define Zod schemas:
     - `CreateContratoInputSchema`: 
       - `{nome, razaoSocial, cnpj, endereço, avsHabilitacao, vigenciaInicio, vigenciaFim, exames[], certificacoes[], criticidade, observacoes?, anexoContratoUrl?}`
       - `cnpj`: string, non-empty, length 14, must validate checksum (see T2.2)
       - `avs`: non-empty, min 6 chars
       - `vigenciaInicio < vigenciaFim`: enforce via `.refine()`
     - `UpdateContratoInputSchema`: subset (observacoes, contatos, certificacoes — no CNPJ mutation)
     - `SoftDeleteContratoInputSchema`: `{contratoId, motivo}`
     - `RegistrarAvaliacaoInputSchema`: `{contratoId, data, resultado, responsavel, observacoes?, anexo?}`
     - `UploadAnexoInputSchema`: `{contratoId, fileMeta: {name, size, contentType}}`
   - Add `assertLabApoioAccess(auth, labId)`:
     - Verify `auth.uid` is active member of `/labs/{labId}/members/{uid}`
     - Verify claim `modules['lab-apoio']` exists
   - Add `labApoioCollection(labId): string` → `/labs/{labId}/lab-apoio`
   - Add `ensureLabApoioLabRoot(labId)` (mirror turnos)

2. **Implement CNPJ validator with unit tests** (90 min):
   - Function: `validateCNPJ(cnpj: string): {valid: boolean, error?: string}`
   - Algorithm (Mod-11 dual-check):
     ```
     1. Strip non-digits from input
     2. Check length === 14
     3. Reject all-same-digit (11111111111111)
     4. First checksum: multiply digits 0-11 by weights 5,4,3,2,9,8,7,6,5,4,3,2 
        → sum → mod 11 → if <2 then check=0 else check=11-sum%11
        → digit[12] must equal check
     5. Second checksum: multiply digits 0-12 by weights 6,5,4,3,2,9,8,7,6,5,4,3,2
        → sum → mod 11 → if <2 then check=0 else check=11-sum%11
        → digit[13] must equal check
     6. Return {valid: true} or {valid: false, error: "..."}
     ```
   - Reference: CNPJ format per Receita Federal do Brasil
   - Add `validateAVS(avs: string): {valid: boolean, error?: string}`:
     - Non-empty
     - Min 6 chars (conservative, Anvisa format varies)
     - Return `{valid: true}` or error

3. **Unit tests for CNPJ** (60 min):
   - File: `/functions/test/labApoio/cnpj.test.mjs` (use `node:test`)
   - **Valid cases** (5):
     - `11222333000181` (real valid CNPJ — Brazilian format)
     - `34028316000152` (another real valid)
     - Generate 3 more using online validator as reference
   - **Invalid cases** (5):
     - `11111111111111` (all same digit)
     - `12345678901234` (wrong checksum)
     - `123456` (too short)
     - `12345678901234X` (non-digit)
     - `00000000000000` (all zeros)
   - Run: `cd functions && npm test -- test/labApoio/cnpj.test.mjs`
   - Expect: All pass

4. **Mirror signatureCanonical** (30 min):
   - Copy `functions/src/modules/turnos/signatureCanonical.ts` → `labApoio/`
   - Function: `generateContratoSignatureServer({labId, cnpj, vigenciaInicioMs, vigenciaFimMs, tsMs}): {hash, operatorId, ts}`
   - Hash payload: `sortedStringify({labId, cnpj, vigenciaInicioMs, vigenciaFimMs, tsMs})`
   - Return: `{hash: sha256Hex, operatorId: request.auth.uid, ts: serverTimestamp()}`

5. **Barrel re-exports** (10 min):
   - File: `functions/src/modules/labApoio/index.ts`
   - Export: validators, signatureCanonical, constants (collection path)

**Verification:**

- ✅ `cd functions && npx tsc --noEmit` zero errors
- ✅ `npm test -- test/labApoio/cnpj.test.mjs` — all 10 cases pass
- ✅ Schemas validate sample inputs (quick manual JSON parse)

**Rollback (if needed):** Delete `functions/src/modules/labApoio/`, remove from `functions/src/index.ts` (not yet added).

---

## T3. Implement `labApoio_createContrato` + Audit Trigger

**Outcome:** Create callable works end-to-end in emulator; chainHash trigger fires and persists.

**Files to create:**

- `/functions/src/modules/labApoio/createContrato.ts`
- `/functions/src/modules/labApoio/onContratoEventCreated.ts`
- `/functions/src/index.ts` — add re-export block

**Steps:**

1. **Implement `labApoio_createContrato` callable** (90 min):
   - Mirror `functions/src/modules/turnos/createTurno.ts`
   - Signature: `async (data, context) => {labId, contrato: ContratoInput}`
   - Logic:
     ```
     1. assertLabApoioAccess(context.auth, data.labId)
     2. validateCreateContratoInputSchema(data.contrato)
     3. validateCNPJ(data.contrato.cnpj) → throw if invalid
     4. validateAVS(data.contrato.avs) → throw if invalid
     5. Enforce: data.contrato.vigenciaInicio < vigenciaFim
     6. Re-read: check no existing contrato with same (labId, cnpj) — unique constraint (RN-LABAPOIO-01)
        → Query: WHERE labId = X AND cnpj = Y AND deletadoEm == null → throw if found
     7. Generate signature: generateContratoSignatureServer({labId, cnpj, vigenciaInicioMs, vigenciaFimMs, ts})
     8. Prepare document:
        - contrato = {...input, id: auto, labId, criadoEm: serverTimestamp(), logicalSignature}
     9. Atomic writeBatch:
        a. SET /labs/{labId}/lab-apoio/{contratoId} = contrato
        b. SET /labs/{labId}/lab-apoio/{contratoId}/events/{eventId} = {
             type: 'created',
             timestamp: serverTimestamp(),
             payload: contrato (include logicalSignature),
             chainHash: null (to be filled by trigger)
           }
     10. Return {contratoId, logicalSignature}
     ```
   - Error messages: PT-BR (use `HttpsError('failed-precondition', 'CNPJ inválido...')`)
   - Logging: `console.log('labApoio_createContrato', {labId, contratoId, cnpj})`

2. **Implement `onContratoEventCreated` trigger** (60 min):
   - Mirror `functions/src/modules/turnos/onTurnoEventCreated.ts`
   - Trigger: `onDocumentCreated('labs/{labId}/lab-apoio/{contratoId}/events/{eventId}')`
   - Logic:
     ```
     1. Get snapshot (this document)
     2. If type !== 'created' && type !== 'updated' && type !== 'softdeleted' → skip (ignore)
     3. Query previous event: /labs/{labId}/lab-apoio/{contratoId}/events
        → WHERE documentoId == this.documentoId
        → ORDER BY timestamp DESC
        → LIMIT 2
        → lastEvent = result[0] (or null if first)
     4. prevChainHash = lastEvent?.chainHash || null
     5. Canonical payload = sortedStringify(this.payload)
     6. chainHash = SHA-256(prevChainHash + canonical)
     7. Update this event: SET /labs/{labId}/lab-apoio/{contratoId}/events/{eventId} = {...snapshot.data(), chainHash}
     ```
   - Note: `documentoId` field missing in audit event schema — use `contratoId` as identifier (same ref).

3. **Wire in functions/src/index.ts** (20 min):
   - Add block:
     ```typescript
     // ─── lab-apoio module (Phase 0 — 2026-05-07)
     import { labApoio_createContrato } from './modules/labApoio/createContrato';
     import { onContratoEventCreated } from './modules/labApoio/onContratoEventCreated';
     export const create_contrato = onCall(labApoio_createContrato);
     export const on_contrato_event_created = onDocumentCreated('labs/{labId}/lab-apoio/{contratoId}/events/{eventId}', onContratoEventCreated);
     ```

4. **Smoke test script** (30 min):
   - File: `functions/scripts/smoke-labApoio-callables.mjs` (mirror `smoke-turnos-callables.mjs` from Wave 1)
   - Use: Admin SDK (`firebase-admin`) to call callable directly
   - Test payload:
     ```javascript
     {
       labId: 'test-lab-001',
       contrato: {
         nome: 'Lab Apollo',
         razaoSocial: 'Lab Apollo Ltda',
         cnpj: '34028316000152', // valid
         endereço: {rua, numero, complemento?, cep, cidade, uf},
         avsHabilitacao: 'AVS-2025-001',
         vigenciaInicio: '2025-01-01',
         vigenciaFim: '2026-01-01',
         exames: [{codigo: 'GLC', descricao: 'Glicose', tat: 2}],
         certificacoes: [{nome: 'ISO15189'}],
         criticidade: 'alta'
       }
     }
     ```
   - Expected:
     - Callable returns `{contratoId, logicalSignature}`
     - Doc created at `/labs/test-lab-001/lab-apoio/{contratoId}`
     - Audit event created at `/labs/test-lab-001/lab-apoio/{contratoId}/events/{eventId}`
     - Trigger fires within 2 seconds, adding `chainHash` to event
   - Run: `cd functions && node scripts/smoke-labApoio-callables.mjs`

**Verification:**

- ✅ `cd functions && npx tsc --noEmit` zero errors
- ✅ Smoke test: callable succeeds; event has `chainHash` populated within 2s
- ✅ Firestore emulator shows created doc + event (inspect via UI or `admin.firestore().collection(...).get()`)

**Rollback (if needed):** Delete `createContrato.ts`, `onContratoEventCreated.ts`; remove re-export from `functions/src/index.ts`.

---

## T4. Implement Update + Avaliacao + Upload Callables

**Outcome:** Three callables work in emulator; avaliacao appends to history; upload validates file size + content type.

**Files to create:**

- `/functions/src/modules/labApoio/updateContrato.ts`
- `/functions/src/modules/labApoio/registrarAvaliacaoPeriodica.ts`
- `/functions/src/modules/labApoio/uploadContratoAnexo.ts`

**Steps:**

1. **Implement `labApoio_updateContrato`** (60 min):
   - Mirror update from `turnos/updateTurno.ts`
   - Signature: `async (data, context) => {labId, contratoId, updates: Partial<ContratoInput>}`
   - Logic:
     ```
     1. assertLabApoioAccess(...)
     2. validateUpdateContratoInputSchema(updates)
     3. Re-read current contrato (must exist, not deleted)
     4. Compute changes = diff(current, updates)
     5. Rebuild signature (if vigencia changed): generateContratoSignatureServer({...})
     6. Write contrato with updates + new signature (if changed)
     7. Append audit event: {type: 'updated', timestamp, payload: updates, changes diff, chainHash: null}
     ```
   - Allowed fields: `observacoes`, `contatos[]` (append-only), `certificacoes[]` (append-only)
   - Forbidden: `cnpj`, `avsHabilitacao` (once set, immutable per RDC 978 best practice)

2. **Implement `labApoio_registrarAvaliacaoPeriodica`** (60 min):
   - Signature: `async (data, context) => {labId, contratoId, avaliacao: AvaliacaoPeriodica}`
   - Logic:
     ```
     1. assertLabApoioAccess(...)
     2. validateRegistrarAvaliacaoInputSchema(avaliacao)
     3. Re-read current contrato
     4. Append to history: contrato.avaliacaoPeriodica.push(avaliacao)
     5. Compute proximaAvaliacaoEm = avaliacao.data + 365d
     6. Update /labs/{labId}/lab-apoio/{contratoId} with new avaliacaoPeriodica[] + proximaAvaliacaoEm
     7. Append audit event: {type: 'avaliacao-registrada', timestamp, payload: avaliacao, chainHash: null}
     ```
   - Schema (per PLAN.md):
     ```
     AvaliacaoPeriodica = {
       data: Date,
       resultado: 'aprovado' | 'aprovado_com_ressalva' | 'reprovado',
       responsavel: string (uid or name),
       observacoes?: string,
       anexo?: {url, fileName, size}
     }
     ```

3. **Implement `labApoio_uploadContratoAnexo`** (60 min):
   - Signature: `async (data, context) => {labId, contratoId, fileMeta}`
   - fileMeta includes: pre-signed Storage upload path (path already created by client-side upload)
   - Logic:
     ```
     1. assertLabApoioAccess(...)
     2. Validate path format: /labs/{labId}/lab-apoio/{contratoId}/contrato.pdf
     3. Re-fetch file metadata from Storage: bucket.file(path).getMetadata()
     4. Validate: size < 10MB, contentType = 'application/pdf'
     5. Generate signed download URL
     6. Update /labs/{labId}/lab-apoio/{contratoId}: {anexoContratoUrl, anexoContratoSize, anexoContratoUploadedAt}
     7. Append audit event: {type: 'anexo-uploaded', timestamp, payload: {fileName, size, url}, chainHash: null}
     ```
   - Error if path tampered or file missing.

4. **Smoke test expansion** (20 min):
   - Extend `smoke-labApoio-callables.mjs` to call all three:
     - `labApoio_updateContrato({labId, contratoId, updates: {observacoes: 'novo obs'}})`
     - `labApoio_registrarAvaliacaoPeriodica({labId, contratoId, avaliacao: {...}})`
     - `labApoio_uploadContratoAnexo({labId, contratoId, fileMeta: {path, size, contentType}})` (mock Storage)
   - Run smoke test; verify audit events chain.

**Verification:**

- ✅ `cd functions && npx tsc --noEmit` zero errors
- ✅ Smoke test: all three callables execute without error
- ✅ Audit events chain correctly (chainHash from T3 trigger persists)

**Rollback (if needed):** Delete three `.ts` files; revert `functions/src/index.ts` exports.

---

## T5. Implement Expiry Cron + Email/Notifications

**Outcome:** Cron fires daily 06:00 BRT; identifies contracts expiring in 60/30/7/0 days; writes notifications; sends emails (or logs if email service unavailable).

**Files to create:**

- `/functions/src/modules/labApoio/checkExpiry.ts`
- (Optional: extend email service if not present)

**Steps:**

1. **Implement `labApoio_checkExpiry` Cloud Scheduler function** (90 min):
   - Trigger: Cloud Scheduler cron `0 6 * * *` BRT (daily 06:00)
   - Logic:
     ```
     1. Query all labs (or loop over known labIds from config)
     2. For each lab, query /labs/{labId}/lab-apoio WHERE ativo = true AND deletadoEm = null
     3. For each contrato:
        a. daysUntil = Math.floor((contrato.vigenciaFim - today) / 86400000)
        b. If daysUntil in [60, 30, 7, 0]:
           - Notification key = `${contratoId}-${daysUntil}-day` (idempotency)
           - Check if notification already written (via lastNotified timestamp)
           - Write /labs/{labId}/notifications/{notificationId}:
             {
               type: 'lab-apoio-expiry',
               severity: daysUntil <= 7 ? 'high' : 'medium',
               title: `Contrato com ${contrato.nome} vence em ${daysUntil} dias`,
               message: `Ação recomendada: renégociar ou arquivar antes de ${contrato.vigenciaFim.toISO()}`,
               read: false,
               createdAt: serverTimestamp()
             }
           - Call email service (or log if unavailable):
             sendEmail({
               to: labAdmin@lab.com,
               subject: `Aviso: Contrato ${contrato.nome} vence em ${daysUntil} dias`,
               body: pt-BR message
             })
           - Mark notification as sent: update contrato {notificacoes: [{daysUntil, sentAt: ts}]}
     4. Return {processed: N, notified: M}
     ```
   - Email service integration:
     - If `sendEmail` function exists (from another module, e.g., educacao-continuada), reuse it.
     - If not, implement minimal version (SMTP via Nodemailer or SendGrid).
     - **Fallback**: If email service unreachable, log warning + continue (notifications still written in Firestore).

2. **Schedule Cloud Scheduler** (20 min):
   - Command: `gcloud scheduler jobs create pubsub lab-apoio-check-expiry --schedule="0 6 * * *" --time-zone="America/Sao_Paulo" --topic=functions --message-body='{"function":"labApoio_checkExpiry"}' --location=southamerica-east1`
   - Or configure via `firebase` CLI if supported.
   - **Note**: Requires "Cloud Scheduler API" enabled in GCP project.

3. **Callable-wrap for testing** (20 min):
   - Expose `checkExpiry` as a callable for manual testing (not public):
     ```typescript
     export const labApoio_checkExpiryManual = onCall(checkExpiry);
     ```
   - Use in smoke test: invoke manually to verify without waiting 24h.

**Verification:**

- ✅ `cd functions && npx tsc --noEmit` zero errors
- ✅ Manual invoke via callable: returns `{processed, notified}` without error
- ✅ Firestore shows created notifications (emulator or test project)
- ✅ Email log (if SMTP enabled) or console log shows email attempt

**Rollback (if needed):** Delete `checkExpiry.ts`; delete Cloud Scheduler job (`gcloud scheduler jobs delete ...`).

---

## T6. Implement Hooks + UI Components (5 components)

**Outcome:** `useLabApoio`, `useExpiryAlerts` hooks work; 5 UI components render and respond to user actions.

**Files to create:**

- `/src/features/lab-apoio/hooks/useLabApoio.ts`
- `/src/features/lab-apoio/hooks/useExpiryAlerts.ts`
- `/src/features/lab-apoio/components/LabApoioView.tsx`
- `/src/features/lab-apoio/components/LabApoioList.tsx`
- `/src/features/lab-apoio/components/LabApoioForm.tsx`
- `/src/features/lab-apoio/components/LabApoioAvaliacao.tsx`
- `/src/features/lab-apoio/components/VencimentosWidget.tsx`

**Steps:**

1. **Implement `useLabApoio` hook** (45 min):
   - Mirror `useColaboradores.ts` (Wave 1 canonical reference)
   - Exports:
     - `contratos: Contrato[]`, `loading: boolean`, `error?: Error`
     - `createContrato(input)`: call `callCreateContrato`, handle response, refresh subscription
     - `updateContrato(id, updates)`: call `callUpdateContrato`, refresh
     - `softDeleteContrato(id, motivo)`: call `callSoftDeleteContrato`
     - `confirmAvaliacaoPeriodica(id, avaliacao)`: call `callRegistrarAvaliacaoPeriodica`
     - `uploadAnexo(id, file)`: upload to Storage (pre-signed path) → call `callUploadContratoAnexo`
   - Error handling: `unwrapCallableError` + user-friendly messages
   - Validation: no missing `labId` (throw early)

2. **Implement `useExpiryAlerts` hook** (30 min):
   - Depends on `contratos` from `useLabApoio`
   - Returns: `{expiring7d: [], expiring30d: [], expiring60d: [], expired: [], total: N}`
   - Logic: filter by `vigenciaFim`, bin into buckets, sort by `vigenciaFim ASC`
   - Pure function (no side effects).

3. **Implement `LabApoioView` component** (45 min):
   - Entry point (lazy-loaded from `AppRouter`)
   - Structure:
     - Topbar: `← Hub` button, title "Contratos de Apoio", lab badge (via `useActiveLabId`)
     - KPI strip (4 cards): `Total ativos | Vencendo 60d | Vencidos | Sem avaliação anual`
     - Tabs: `[Contratos | Avaliações | Vencimentos]`
     - Tab 1: `<LabApoioList />`
     - Tab 2: Evaluations list (view mode) or empty state
     - Tab 3: `<VencimentosWidget />`
   - Dark-first design (reference: Apple, Linear)

4. **Implement `LabApoioList` component** (60 min):
   - Dark-first table:
     - Columns: `Nome | CNPJ | AVS | Vigência | Exames (count) | Criticidade | Avaliação | Ações`
     - Row actions: Edit, Evaluate, Download PDF, Archive
     - Filters: ativo toggle, criticidade dropdown, dateRange picker (vigência)
     - Sorting: by CNPJ, Vigência (default), Criticidade
     - `tabular-nums` on dates and CNPJ
     - Empty state: "Nenhum contrato registrado. Crie o primeiro → <button>"
     - Loading skeleton (mirror EC pattern)

5. **Implement `LabApoioForm` component** (90 min):
   - Multi-step form (4 steps) — wizard pattern:
     - **Step 1: Dados gerais**
       - nome (text, required)
       - razaoSocial (text, required)
       - CNPJ (text with mask, required, validates via `validateCNPJ` on blur)
       - Endereço (expandable / collapsible): rua, numero, complemento, cep, cidade, uf
       - AVS (text, required, min 6 chars)
       - Vigência: data início + data fim (date pickers, inline validation: início < fim)
       - Criticidade: select (alta, media, baixa)
       - Disclaimer banner (amber): "Template de contrato baseado em RDC 978 Arts. 36–39. Não substitui revisão jurídica. Revisão prevista para Phase 1 semana 2."
     - **Step 2: Exames terceirizados**
       - Repeater rows: `[Codigo | Descricao | TAT (dias)]`
       - Add row button, remove row (X icon per row)
       - Validation: at least 1 exam required
     - **Step 3: Certificações + Contatos**
       - Certificações repeater: `[Nome | Órgão Emissor | Data válida até]`
       - Contatos repeater: `[Nome | Cargo | Email | Telefone]`
       - Both optional
     - **Step 4: Upload contrato PDF** (optional but recommended)
       - File picker (accept PDF only)
       - Drag-and-drop area
       - File size preview (< 10MB check client-side)
       - Progress bar (during upload)
   - Step navigation: `Próximo | Anterior | Salvar` buttons
   - Draft preservation in component state (localStorage if time permits)
   - On submit: call `useLabApoio.createContrato(...)` → success toast → navigate back to list

6. **Implement `LabApoioAvaliacao` component** (45 min):
   - Annual evaluation form (modal or inline):
     - Data avaliação (date picker, default=today)
     - Resultado: radio buttons (aprovado | aprovado_com_ressalva | reprovado)
     - Responsável: combobox (filter from `useColaboradores`)
     - Observações: textarea (max 500 chars)
     - Anexo opcional: file picker (any type, <10MB)
     - Submit: call `useLabApoio.confirmAvaliacaoPeriodica(...)` → success toast

7. **Implement `VencimentosWidget` component** (45 min):
   - Compact list view (dashboard widget, reusable):
     - `useExpiryAlerts` to get expiry buckets
     - Render buckets (or merged if compact):
       - Red badge: `< 7d` (crítico)
       - Amber badge: `7–30d` (atenção)
       - Yellow badge: `30–60d` (monitorar)
       - Green: `> 60d` (ok)
     - Row: `Contrato name | Vigência até [DATE] | [ACTION: renew / archive]`
     - Sort by vigência ASC (soonest first)
     - Empty state: "Nenhum contrato com vigência próxima"

**Verification:**

- ✅ `npm run build` succeeds (no TypeScript errors)
- ✅ `<LabApoioView />` lazy-loads (React.lazy works)
- ✅ Form submits data without error (emulator or test project)
- ✅ Table renders sample data (mock or real from emulator)
- ✅ Hooks don't leak listeners (useEffect cleanup present)

**Rollback (if needed):** Delete `src/features/lab-apoio/hooks/` and `components/` subdirectories.

---

## T7. Rules + Storage Rules + Indexes + Emulator Tests

**Outcome:** Firestore rules validated in emulator; Storage rules allow PDF upload; composite indexes defined.

**Files to modify:**

- `/firestore.rules`
- `/storage.rules`
- `/firestore.indexes.json`
- `/functions/test/labApoio/rules.test.mjs` (new)

**Steps:**

1. **Update `firestore.rules`** (45 min):
   - Invoke `Skill hcq-firestore-rules-generator` with scope=`labApoio`
   - Expected output: rules block for `/labs/{labId}/lab-apoio/{contratoId}` + subcollection `/events/{eventId}`
   - Rules:
     ```
     match /labs/{labId}/lab-apoio/{contratoId} {
       allow read: if isActiveMemberOfLab(labId);
       allow create, update, delete: if false; // all writes via callable
       
       match /events/{eventId} {
         allow read: if isActiveMemberOfLab(labId);
         allow create, update, delete: if false;
       }
     }
     ```
   - Merge with existing rules (no breaking changes to other modules)

2. **Update `storage.rules`** (30 min):
   - Add block:
     ```
     match /labs/{labId}/lab-apoio/{contratoId}/{file} {
       allow read: if isActiveMemberOfLab(labId);
       allow write: if isAdminOrOwner(labId) 
                     && request.resource.size < 10 * 1024 * 1024 
                     && request.resource.contentType == 'application/pdf';
     }
     ```

3. **Update `firestore.indexes.json`** (20 min):
   - Add two composite indexes:
     - Collection: `labs/{labId}/lab-apoio`, fields: `(ativo, vigenciaFim ASC)` for expiry query
     - Collection: `labs/{labId}/lab-apoio`, fields: `(ativo, criticidade, vigenciaFim ASC)` for filtered list with criticality sort

4. **Emulator test suite** (90 min):
   - File: `/functions/test/labApoio/rules.test.mjs`
   - Use `firebase-rules-test-library` or custom Admin SDK + Emulator.
   - Test cases:
     - ✅ Lab member can read contratos
     - ❌ Lab member cannot directly create (callable-only)
     - ❌ Non-member cannot read
     - ✅ Admin can read + upload PDF to Storage
     - ❌ Non-PDF file rejected by Storage rules
     - ✅ Callable can write (trigger test via `callableContext`)
   - Run: `firebase emulator:start --only firestore,storage` (in background) → `npm test -- test/labApoio/rules.test.mjs`

**Verification:**

- ✅ `firebase deploy --only firestore:rules` succeeds (no syntax errors)
- ✅ `firebase deploy --only firestore:indexes` shows indexes pending/deployed
- ✅ Emulator test suite: all cases pass

**Rollback (if needed):** Revert `firestore.rules`, `storage.rules`, `firestore.indexes.json` to pre-T7 state.

---

## T8. Shell Integration (Lazy Route + Hub Tile)

**Outcome:** `LabApoioView` accessible via `/app/lab-apoio` route; Hub tile clickable; module added to `View` union.

**Files to modify:**

- `/src/AppRouter.tsx` (or `src/auth/AuthWrapper.tsx` depending on structure)
- `/src/types/index.ts`
- `/src/features/hub/ModuleHub.tsx`

**Steps:**

1. **Register lazy route** (15 min):
   - File: `AppRouter.tsx` (or equivalent)
   - Add:
     ```typescript
     const LabApoioView = React.lazy(() => import('../features/lab-apoio/components/LabApoioView'));
     
     // In routes config:
     case 'lab-apoio':
       return <Suspense fallback={<Skeleton />}><LabApoioView /></Suspense>;
     ```
   - Verify import path resolves.

2. **Extend `View` union** (5 min):
   - File: `src/types/index.ts`
   - Add: `'lab-apoio'` to `type View = '...' | 'lab-apoio' | ...`

3. **Add Hub tile** (20 min):
   - File: `src/features/hub/ModuleHub.tsx`
   - New tile object:
     ```typescript
     {
       id: 'lab-apoio',
       title: 'Contratos de Apoio',
       description: 'Gestão de terceirizações e RDC 978 Art. 36–39',
       icon: <svg>...</svg>, // SVG inline with currentColor (handshake icon or building+arrow)
       status: 'active',
       view: 'lab-apoio',
       enabled: true
     }
     ```
   - Test: click tile → navigate to `LabApoioView`

4. **Update vite.config** (10 min):
   - File: `vite.config.ts`
   - Add manualChunks entry:
     ```javascript
     'feature-lab-apoio': [/src\/features\/lab-apoio\//]
     ```

**Verification:**

- ✅ `npm run build` succeeds
- ✅ Route `/app/lab-apoio` loads without error (dev server)
- ✅ Hub tile renders and navigates

**Rollback (if needed):** Revert all four files.

---

## T9. Documentation + CLAUDE.md + Obsidian

**Outcome:** Module rules documented; root CLAUDE.md updated; Obsidian checklist marked done.

**Files to modify:**

- `/src/features/lab-apoio/CLAUDE.md` (if not done in T1)
- `/CLAUDE.md` (root)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Checklist_Auditoria.md`

**Steps:**

1. **Module CLAUDE.md** (30 min):
   - Populate `src/features/lab-apoio/CLAUDE.md` (template from turnos):
     - Business rules: `RN-LABAPOIO-01` through `RN-LABAPOIO-07`
     - Compliance: Arts. 36–39 citations
     - Schema notes (CNPJ format, AVS format, exams repeater)
     - Pending items (DPIA cross-link to Plan 00-02, contract template review in Phase 1 week 2)

2. **Root CLAUDE.md** (10 min):
   - File: `/CLAUDE.md`
   - Update "Módulos em produção" table, add row:
     ```
     | lab-apoio | Em prod · Contratos de apoio com CNPJ + AVS + avaliações anuais (RDC 978 Art. 36–39) | YYYY-MM-DD |
     ```
     (Use actual date of T10 deploy)

3. **Obsidian checklist** (5 min):
   - File: `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Checklist_Auditoria.md`
   - Search for sections related to "Laboratórios de apoio" or "Art. 36–39"
   - Mark as complete: `[x] Lab apoio contracts module live — CNPJ validation, AVS tracking, annual evaluations, expiry alerts`

**Verification:**

- ✅ CLAUDE.md readable and complete
- ✅ Root row added to "Módulos em produção"
- ✅ Obsidian checkbox marked

**Rollback (if needed):** Revert CLAUDE.md files.

---

## T10. Deploy (7 Steps)

**Outcome:** Module **LIVE** in production (`hmatologia2.web.app`); all functions + rules + indexes deployed.

**Prerequisites:**

- ✅ T1–T9 complete
- ✅ `npm test` passes 738/738
- ✅ `npx tsc --noEmit` zero errors
- ✅ Emulator smoke tests all pass
- ✅ Code review pass (peer or CTO)

**Steps:**

1. **Claim provisioning** (10 min):
   - Command: `firebase functions:shell` → `provisionModulesClaims({modules: ['lab-apoio'], dryRun: false})`
   - Or: call callable `provisionModulesClaims` with CLI or test script
   - Expected: users in `labs/{labId}/members/{uid}` get claim `modules['lab-apoio'] = fullAccess()` added

2. **Type check + lint** (10 min):
   ```bash
   npm run build  # full build
   npx tsc --noEmit
   cd functions && npx tsc --noEmit
   ```

3. **Deploy Rules + Indexes** (15 min):
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
   ```
   - Monitor: `firebase deploy` logs should show "Deployment complete"
   - Verify via Console: `Firestore > Indexes` shows new composite indexes in "Enabled" state (may take 1–2 min)

4. **Deploy Functions** (20 min):
   ```bash
   firebase deploy --only functions --project hmatologia2
   ```
   - Monitor: `Cloud Functions > Functions` in Console
   - Expect: 5 callables (`labApoio_createContrato`, ..., `labApoio_uploadContratoAnexo`) + 1 trigger + 1 cron visible
   - Region: `southamerica-east1`
   - Check logs: `Cloud Functions > Logs` for any ERROR/CRITICAL

5. **Deploy Hosting** (15 min):
   ```bash
   firebase deploy --only hosting --project hmatologia2
   ```
   - URL: `hmatologia2.web.app`
   - Verify hard reload in incognito (PWA cache invalidation)

6. **Smoke tests (24h window)** (30 min):
   - Test user: labadmin@riopomba.lab.com (or Riopomba test account)
   - Steps:
     - Login to `hmatologia2.web.app`
     - Navigate Hub → "Contratos de Apoio" tile → `/app/lab-apoio`
     - Create contract (form 4 steps) → submit → verify in list
     - Edit → update observacoes → save
     - Register evaluation (annual) → success
     - Check expiry alerts in "Vencimentos" tab
   - Expected: no ERROR logs in Cloud Logs; all interactions respond within <2s

7. **Cloud Logs verification** (60 min over next 24h):
   - Use existing `scripts/monitor-cloud-logs.ps1` (or `.sh` on Linux)
   - Filters: `resource.type="cloud_function" AND function_name=("labApoio_*" OR "on_contrato_*")` AND `severity >= ERROR`
   - Report: Generate via script; no critical errors; summarize user activity (calls/errors/latency)
   - Sign-off: CTO reviews logs; marks Phase 0 Plan 00-03 as LIVE

**Verification:**

- ✅ `firebase deploy --only hosting` shows "Deployment complete"
- ✅ Hub tile present; route loads
- ✅ Smoke test: create/edit/evaluate flows work
- ✅ Cloud Logs report: no ERROR/CRITICAL for 24h post-deploy

**Rollback (if critical error):**

- If rules block legitimate reads:
  - `firebase deploy --only firestore:rules` with reverted rules block
  - Propagation: ~1 min
- If callable crashes on certain input:
  - Function auto-rollback via `firebase functions:shell` → select previous version
  - Or: hot-fix code, redeploy functions only
- If widespread failure:
  - Revert all via `git revert <commit>` → redeploy (plan B)

---

## Success Criteria (All-or-nothing T10 gate)

- ✅ **Functional**: Create/read/update contracts; evaluations append; expiry alerts fire; upload PDF works
- ✅ **Compliance**: Audit trail (chainHash) unbroken; signatures server-signed; no RDC 978 Art. 36–39 violations
- ✅ **Performance**: All operations < 2s; no memory leaks in emulator
- ✅ **Security**: Rules deny unauthorized access; callable claims checked; PDF size <10MB enforced
- ✅ **Observability**: Cloud Logs show function entry/exit; errors logged with context
- ✅ **Quality**: No TypeScript errors; unit tests pass; smoke tests pass
- ✅ **Docs**: CLAUDE.md complete; Obsidian checklist updated; ADRs referenced

---

**Plan 00-03 COMPLETE**

Estimated completion: **2026-05-09** (2.5 days from start)  
Next: Merge with Stream B (Plan 00-04) results + Wave 2 final gate (T8 in WAVE2-EXECUTION-BRIEF.md)
