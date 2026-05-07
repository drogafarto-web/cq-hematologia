---
phase: 0
plan: 00-04
slug: risks-fmea-skeleton
stream: B
status: execution-ready
---

# Plan 00-04 Execution Checklist — Risks: FMEA-Lite Register

**Stream**: B (parallel with Stream A / Plan 00-03)  
**Duration estimate**: 3.5 days (250 LOC/day typical)  
**Agent**: Single dedicated agent  
**Start condition**: Wave 1 complete + green `npm test 738/738` + `firestore.rules` + `functions/` deployed

---

## T1. Author ADR-0016 (FMEA-Lite Methodology)

**Outcome:** ADR documenting FMEA methodology, NPR formula, thresholds, escape hatch; CTO approved.

**Files to create/modify:**

- `/docs/adr/0016-fmea-lite-methodology.md` (new)
- `/docs/adr/README.md` (updated — index link)

**Steps:**

1. **Author ADR per project template** (90 min):
   - Reference recent ADR (e.g., `0008-*.md` from v1.3) for format
   - Sections:
     - **Title**: "FMEA-Lite Risk Management Methodology"
     - **Status**: `ACCEPTED` (pending CTO sign-off during execution)
     - **Context**: 
       - DICQ 4.14.6 requires risk management (identification, analysis, evaluation, treatment)
       - RDC 978/2025 Art. 86 lists PGQ components; component 2 is risk management
       - ISO 15189:2022 §8.5 requires actions to address risks/opportunities
       - Project needs lightweight but auditable risk register for Phase 0 (Phase 4–5 CAPA execution)
       - Options: FMEA-lite (familiar to labs, simple), ISO 31000 (mature, complex)
     - **Decision**: Adopt FMEA-Lite (Failure Mode & Effects Analysis) with NPR (Risk Priority Number) scoring for v1.4
       - Formula: `NPR = Probabilidade × Severidade × Detecção` (each 1–5)
       - Levels: 
         - Baixo: NPR ≤ 24
         - Médio: NPR 25–60
         - Alto: NPR 61–99
         - Crítico: NPR ≥ 100
       - All labs inherit defaults; customizable via `labSettings.nprThresholds` (v1.5 feature)
       - Escape hatch: "If Riopomba retro feedback warrants, refine to ISO 31000 in v1.5 (AD-0016a)"
     - **Consequences**:
       - Simpler learning curve for lab teams vs ISO 31000
       - NPR provides quantifiable risk ranking (sortable, filterable)
       - Thresholds actionable (e.g., NPR≥100 triggers monthly review)
       - Limitation: FMEA does not address business context as deeply as ISO 31000
     - **Alternatives Considered**:
       - **ISO 31000:2018**: Comprehensive, aligns with international best practice, but steeper learning curve. Deferred to v1.5 if early-stage feedback warrants.
       - **Simple Qualitative Matrix** (High/Medium/Low): Loses granularity of FMEA scoring. Rejected.
     - **References**:
       - DICQ 4.14.6 (Gestão de risco)
       - RDC 978/2025 Art. 86 (PGQ componentes)
       - ISO 15189:2022 §8.5
       - ISO 15189:2022 Annex B (Example risk register with FMEA format)
       - FMEA Handbook (automotive reference, adapted for labs)
     - **Implementation Notes**:
       - Phase 0 ships with hardcoded thresholds; Phase 1 stretch adds `labSettings.nprThresholds` UI
       - Seed data: 10–15 known risks (data leak, CIQ failure, RT absence, etc.); optional CSV importer (stretch task T6)
       - Review cycle: Annual default (customizable per risk); monthly auto-reminder for NPR≥100 (critical)

2. **CTO review + approval** (variable, assume <30 min):
   - Post draft to CLAUDE.md or email for CTO review
   - Expected feedback: thresholds reasonable, escape hatch acceptable, references complete
   - Incorporation: address any changes; mark status `ACCEPTED` with CTO name + date

3. **Update ADR index** (10 min):
   - File: `/docs/adr/README.md`
   - Add link: `- [ADR-0016: FMEA-Lite Methodology](0016-fmea-lite-methodology.md)` (in numerical order)

**Verification:**

- ✅ ADR file exists, readable, well-formatted
- ✅ Markdown lint clean
- ✅ CTO sign-off recorded (commit message or CLAUDE.md note)
- ✅ README updated with link

**Rollback (if needed):** Delete `0016-fmea-lite-methodology.md`; revert README.

**⚠️ BLOCKER NOTE:** If T1 stalls (CTO unavailable >4h), proceed with `[PENDING CTO REVIEW]` comment in file and continue T2 in parallel. ADR content unlikely to change fundamentally; don't let it block. Escalate via team comms.

---

## T2. Scaffold Types + Service (Read-Only) + NPR/Nivel Helpers

**Outcome:** `Risk` types defined; `risksService.ts` reads built; `computeNPR` + `deriveNivel` unit-tested.

**Files to create/modify:**

- `/src/features/risks/CLAUDE.md` — module rules (adapt from turnos template)
- `/src/features/risks/types/Risk.ts` — all types from PLAN.md schema
- `/src/features/risks/services/risksService.ts` — reads + callable wrappers
- `/src/__tests__/risks/computeNPR.test.ts` — unit tests for NPR + nivel derivation

**Steps:**

1. **Scaffold via `hcq-module-generator`** (20 min):
   - Skill: `hcq-module-generator` with `moduleName='risks'`, `readOnlyMode=true`
   - Creates: `src/features/risks/{types,services,hooks,components,__tests__}` directories

2. **Define types** (60 min):
   - File: `src/features/risks/types/Risk.ts`
   - Enums (from ADR-0016 + PLAN.md):
     ```typescript
     export type Probabilidade = 1 | 2 | 3 | 4 | 5; // P (1=rare, 5=frequent)
     export type Severidade = 1 | 2 | 3 | 4 | 5;    // S (1=minor, 5=critical)
     export type Deteccao = 1 | 2 | 3 | 4 | 5;      // D (1=certain, 5=unlikely)
     export type Nivel = 'baixo' | 'medio' | 'alto' | 'critico';
     export type Status = 'aberto' | 'mitigando' | 'monitorado' | 'fechado';
     export type Categoria = 'operacional' | 'qualidade' | 'seguranca' | 'legal' | 'financeira' | 'reputacao';
     export type Processo = 'coleta' | 'analise' | 'relatorio' | 'manutencao' | 'recursos-humanos' | 'fornecedores';
     
     export interface Tratamento {
       estrategia: 'mitigar' | 'aceitar' | 'evitar' | 'compartilhar';
       acoes: Acao[];
       responsavel: string; // uid
       dataInicio: Date;
     }
     
     export interface Acao {
       descricao: string;
       prazo: Date;
       owner: string; // uid
       status: 'pendente' | 'em_progresso' | 'concluida' | 'cancelada';
       dataConclusao?: Date;
     }
     
     export interface Revisao {
       data: Date;
       revisor: string; // uid
       resultado: 'mantido' | 'reduzido' | 'reclassificado' | 'fechado';
       nprPrevio: number;
       nprNovo?: number; // if reclassificado
       observacoes?: string;
     }
     
     export interface Risk {
       id: string;
       labId: string;
       codigo: string; // unique per lab
       descricao: string; // 50–500 chars
       processo: Processo;
       categoria: Categoria;
       probabilidade: Probabilidade;
       severidade: Severidade;
       deteccao: Deteccao;
       npr: number; // P * S * D (computed server-side)
       nivel: Nivel; // derived from NPR per thresholds
       status: Status;
       tratamento: Tratamento;
       reviewHistory: Revisao[];
       reviewDate: Date; // next review date
       logicalSignature: LogicalSignature;
       criadoEm: Date;
       deletadoEm?: Date; // soft delete
     }
     
     export type RiskInput = Omit<Risk, 'id' | 'labId' | 'npr' | 'nivel' | 'criadoEm' | 'deletadoEm' | 'logicalSignature'>;
     
     export interface RiskFilters {
       processo?: Processo;
       categoria?: Categoria;
       nivel?: Nivel;
       status?: Status;
       nprMin?: number;
       nprMax?: number;
     }
     
     export interface RiskAuditEvent {
       type: 'created' | 'updated' | 'revisao-registrada' | 'softdeleted' | 'status-changed';
       timestamp: Date;
       payload: any;
       changes?: Record<string, [before, after]>;
       chainHash?: string;
     }
     ```

3. **Implement NPR + Nivel helpers** (45 min):
   - File: `src/features/risks/services/risksService.ts` (top section)
   - Functions:
     ```typescript
     export function computeNPR(p: Probabilidade, s: Severidade, d: Deteccao): number {
       if (![p, s, d].every(x => x >= 1 && x <= 5)) {
         throw new Error('P, S, D must be in [1..5]');
       }
       return p * s * d;
     }
     
     export interface NPRThresholds {
       medio: number;  // default 25
       alto: number;   // default 61
       critico: number; // default 100
     }
     
     export const DEFAULT_NPR_THRESHOLDS: NPRThresholds = {
       medio: 25,
       alto: 61,
       critico: 100,
     };
     
     export function deriveNivel(npr: number, thresholds = DEFAULT_NPR_THRESHOLDS): Nivel {
       if (npr < thresholds.medio) return 'baixo';
       if (npr < thresholds.alto) return 'medio';
       if (npr < thresholds.critico) return 'alto';
       return 'critico';
     }
     ```
   - Note: do NOT trust client NPR; always recompute server-side in callables

4. **Implement service read-side** (45 min):
   - Mirror `useColaboradores` pattern
   - Exports:
     - `subscribeRisks(labId, filters?: RiskFilters, cb, onErr)`: onSnapshot with client-side filtering
     - `getRisk(labId, id)`: single fetch
     - `mapSnapshotToRisk(snapshot)`: Timestamp → Date coercion
   - **Callable wrappers** (no mutations):
     - `callCreateRisk(payload)`
     - `callUpdateRisk(id, payload)`
     - `callSoftDeleteRisk(id, motivo)`
     - `callRegistrarRevisao(id, revisao)`
     - `callSeedFromCsv(rows)` (optional, admin-only)

5. **Unit tests for NPR + Nivel** (60 min):
   - File: `/src/__tests__/risks/computeNPR.test.ts`
   - Test `computeNPR`:
     ```
     ✓ computeNPR(1, 1, 1) === 1
     ✓ computeNPR(5, 5, 5) === 125
     ✓ computeNPR(3, 3, 3) === 27
     ✓ computeNPR(0, 1, 1) throws (invalid P)
     ✓ computeNPR(1, 1, 6) throws (invalid D)
     ```
   - Test `deriveNivel` with default thresholds:
     ```
     ✓ deriveNivel(1) === 'baixo'
     ✓ deriveNivel(24) === 'baixo'
     ✓ deriveNivel(25) === 'medio'
     ✓ deriveNivel(60) === 'medio'
     ✓ deriveNivel(100) === 'critico'
     ✓ deriveNivel(125) === 'critico'
     ```
   - Test with custom thresholds:
     ```
     ✓ deriveNivel(50, {medio:30, alto:70, critico:100}) === 'medio'
     ```
   - Run: `npm test -- src/__tests__/risks/computeNPR.test.ts`
   - Expect: all pass

**Verification:**

- ✅ `npx tsc --noEmit` zero errors
- ✅ `import { Risk, computeNPR, ... } from 'src/features/risks'` resolves
- ✅ Unit tests all pass (11 assertions total)

**Rollback (if needed):** Delete `src/features/risks/` directory.

---

## T3. Implement Callable Validators + Signature Canonical

**Outcome:** Zod validators for all callable inputs; server-side signature generation; index barrel.

**Files to create:**

- `/functions/src/modules/risks/validators.ts`
- `/functions/src/modules/risks/signatureCanonical.ts`
- `/functions/src/modules/risks/index.ts` (barrel)

**Steps:**

1. **Mirror turnos validators** (75 min):
   - Copy `functions/src/modules/turnos/validators.ts` → `risks/validators.ts`
   - Adapt function names
   - Define Zod schemas:
     - `CreateRiskInputSchema`:
       - `{codigo, descricao, processo, categoria, probabilidade, severidade, deteccao, tratamento, reviewDate?}`
       - `codigo`: non-empty, unique per lab (checked via re-read in callable, not schema)
       - `descricao`: 50–500 chars
       - `probabilidade`, `severidade`, `deteccao`: enum 1..5
       - `tratamento.estrategia`: enum
       - `tratamento.acoes`: array, at least 1
     - `UpdateRiskInputSchema`: subset (P/S/D mutation, tratamento append-only)
     - `SoftDeleteRiskInputSchema`: `{riskId, motivo}`
     - `RegistrarRevisaoInputSchema`: `{riskId, revisao: {data, revisor, resultado, nprPrevio, nprNovo?, observacoes?}}`
     - `SeedFromCsvInputSchema`: `{labId, rows: RiskInput[]}`
   - Add `assertRisksAccess(auth, labId)`:
     - Verify active member + claim `modules['risks']`
   - Add `risksCollection(labId)` + `ensureRisksLabRoot(labId)`
   - Add `validateNPR(p, s, d, npr)`: ensures `npr === p * s * d` (defense in depth)

2. **Implement signatureCanonical** (30 min):
   - Mirror `turnos/signatureCanonical.ts`
   - Function: `generateRiskSignatureServer({labId, codigo, nprMs, tsMs}): {hash, operatorId, ts}`
   - Hash payload: `sortedStringify({labId, codigo, nprMs, tsMs})`

3. **Barrel re-exports** (10 min):

**Verification:**

- ✅ `cd functions && npx tsc --noEmit` zero errors
- ✅ Schemas validate sample inputs (quick test)

**Rollback (if needed):** Delete `functions/src/modules/risks/`.

---

## T4. Implement `risks_createRisk` + Audit Trigger

**Outcome:** Create callable works end-to-end in emulator; chainHash trigger fires.

**Files to create:**

- `/functions/src/modules/risks/createRisk.ts`
- `/functions/src/modules/risks/onRiskEventCreated.ts`
- `/functions/src/index.ts` — add re-export block

**Steps:**

1. **Implement `risks_createRisk` callable** (90 min):
   - Mirror `turnos/createTurno.ts`
   - Signature: `async (data, context) => {labId, risk: RiskInput}`
   - Logic:
     ```
     1. assertRisksAccess(...)
     2. validateCreateRiskInputSchema(data.risk)
     3. Re-read: check no existing risk with same (labId, codigo) — unique constraint
     4. Derive `npr = computeNPR(p, s, d)` (server-side, never trust client)
     5. Derive `nivel = deriveNivel(npr, thresholds)` (use DEFAULT_NPR_THRESHOLDS or from labSettings)
     6. Set `status = 'aberto'` (always start open)
     7. Set `reviewDate = criadoEm + 365d` (annual review)
     8. Generate signature: generateRiskSignatureServer({labId, codigo, npr, ts})
     9. Atomic writeBatch:
        a. SET /labs/{labId}/risks/{riskId} = {...input, npr, nivel, status, logicalSignature}
        b. SET audit event with chainHash=null
     10. Return {riskId, npr, nivel}
     ```
   - Error messages: PT-BR

2. **Implement `onRiskEventCreated` trigger** (60 min):
   - Mirror `turnos/onTurnoEventCreated.ts`
   - Compute chainHash; persist

3. **Wire in functions/src/index.ts** (20 min):
   - Add re-export block

4. **Smoke test** (30 min):
   - File: `functions/scripts/smoke-risks-callables.mjs`
   - Invoke `risks_createRisk` with valid payload
   - Expected: callable returns `{riskId, npr, nivel}`; audit event created with chainHash within 2s

**Verification:**

- ✅ `cd functions && npx tsc --noEmit` clean
- ✅ Smoke test passes
- ✅ Emulator shows created risk + event

**Rollback (if needed):** Delete files; revert index.ts.

---

## T5. Implement Update + Review Mechanics

**Outcome:** Update callable + review registration callable; status transitions enforced; NPR recalculated server-side.

**Files to create:**

- `/functions/src/modules/risks/updateRisk.ts`
- `/functions/src/modules/risks/registrarRevisao.ts`

**Steps:**

1. **Implement `risks_updateRisk` callable** (60 min):
   - Mutable fields: `probabilidade`, `severidade`, `deteccao` (recalcs NPR/nivel), `tratamento.acoes[]` (append-only), `status` (with validation)
   - Status transitions enforced:
     - `aberto` → `mitigando` | `fechado`
     - `mitigando` → `monitorado` | `fechado`
     - `monitorado` → `mitigando` | `fechado`
     - `fechado` → (no transitions, frozen)
   - Logic:
     ```
     1. Re-read current risk
     2. If P/S/D changed: recompute NPR + nivel
     3. If status transitioning: validate against rules above
     4. Rebuild signature if NPR changed
     5. Append audit event with `changes` diff
     ```

2. **Implement `risks_registrarRevisao` callable** (75 min):
   - Signature: `async (data, context) => {labId, riskId, revisao: Revisao}`
   - Logic:
     ```
     1. Re-read current risk
     2. Append revisao to reviewHistory[] (history-preserving)
     3. If resultado === 'mantido': set reviewDate = today + 365d
     4. If resultado === 'reduzido': same as mantido (implies less critical)
     5. If resultado === 'reclassificado':
        - nprNovo must be present in revisao
        - Update risk.probabilidade / .severidade / .deteccao from revisao inputs (or infer from nprNovo)
        - Recompute nivel
        - Set reviewDate = today + 365d
     6. If resultado === 'fechado':
        - Set status = 'fechado'
        - Set reviewDate = null
        - Append audit event `risk-closed`
     7. Append audit event `revisao-registrada` with chainHash=null
     ```

3. **Error handling** (20 min):
   - Validate `resultado` enum
   - Validate `nprNovo` present if reclassificado
   - Error message: PT-BR

**Verification:**

- ✅ `cd functions && npx tsc --noEmit` clean
- ✅ Smoke test: call both callables; verify status transitions + reviewDate updates

**Rollback (if needed):** Delete files.

---

## T6. Implement Scheduled Review Cron + Seed CSV (Stretch)

**Outcome:** Cron fires daily 07:00 BRT; flags risks due for review; monthly flag for critical (NPR≥100).

**Files to create:**

- `/functions/src/modules/risks/scheduledReview.ts` (cron)
- `/functions/src/modules/risks/seedFromCsv.ts` (optional stretch)

**Steps:**

1. **Implement `risks_scheduledReview` Cloud Scheduler cron** (90 min):
   - Trigger: daily 07:00 BRT (`0 7 * * *` in Cloud Scheduler timezone America/Sao_Paulo)
   - Logic:
     ```
     1. Query all labs (or iterate known labIds)
     2. For each lab, query /labs/{labId}/risks WHERE:
        - deletadoEm == null AND
        - status != 'fechado' AND
        - (reviewDate <= today OR npr >= 100) // combined condition
     3. For each risk:
        a. If reviewDate <= today:
           - Write notification: {type: 'risk-review-due', title: '...', message: '...'}
           - Send email to lab admin (if email service available, else log)
        b. If npr >= 100 AND (today = 1st of month): // monthly flag
           - Write notification: {type: 'critical-risk-monthly', title: 'Riscos críticos para revisão...'}
     4. Return {processed, notified}
     ```

2. **Cloud Scheduler setup** (20 min):
   - Command: `gcloud scheduler jobs create pubsub risks-scheduled-review --schedule="0 7 * * *" --time-zone="America/Sao_Paulo" --topic=functions --project hmatologia2`
   - Region: `southamerica-east1`

3. **Implement `risks_seedFromCsv` callable** (stretch, 60 min if time permits, else defer to v1.4 Phase 1):
   - Signature: `async (data, context) => {labId, rows: RiskInput[]}`
   - Admin-only (check `context.auth.uid in admins`)
   - Logic:
     ```
     1. Query /labs/{labId}/risks → if non-empty, reject (idempotent first-run only)
     2. For each row in rows:
        - Validate via CreateRiskInputSchema
        - Compute NPR + nivel
        - Create risk doc
     3. Batch in chunks of 100
     4. Return {created, skipped}
     ```
   - Seed data CSV format (optional):
     ```
     codigo,descricao,processo,categoria,p,s,d,estrategia,prazo_dias
     RIS-001,Vazamento de dados de paciente,coleta,seguranca,3,5,2,mitigar,30
     RIS-002,Falha de equipamento crítico,manutencao,operacional,2,4,3,evitar,45
     ...
     ```

**Verification:**

- ✅ Cron registers (gcloud CLI confirms)
- ✅ Manual invoke (via callable wrapper) returns success
- ✅ Notifications written to Firestore (emulator or test project)
- ✅ If seeding: risks created from CSV

**Rollback (if needed):** Delete cron job; delete files.

---

## T7. Implement Hooks + Derived Data (Matrix, Top5)

**Outcome:** `useRisks`, `useRiskMatrix`, `useTopRisks` hooks work; matrix heatmap data available; top-5 list computed.

**Files to create:**

- `/src/features/risks/hooks/useRisks.ts`
- `/src/features/risks/hooks/useRiskMatrix.ts`
- `/src/features/risks/hooks/useTopRisks.ts`

**Steps:**

1. **Implement `useRisks`** (45 min):
   - Mirror `useColaboradores.ts`
   - Exports:
     - `risks: Risk[]`, `loading`, `error`
     - `createRisk(input)`: call callable, refresh
     - `updateRisk(id, updates)`: call callable, refresh
     - `softDeleteRisk(id, motivo)`: call callable, refresh
     - `registrarRevisao(id, revisao)`: call callable, refresh
   - Validation: no missing `labId`
   - Error unwrapping: `unwrapCallableError`

2. **Implement `useRiskMatrix`** (45 min):
   - Derives 5×5 heatmap grid from `risks[]`
   - Returns: `Map<Severidade, Map<Probabilidade, Risk[]>>`
   - Logic:
     ```typescript
     export function useRiskMatrix() {
       const { risks } = useRisks();
       return useMemo(() => {
         const matrix = new Map<Severidade, Map<Probabilidade, Risk[]>>();
         for (let s = 5; s >= 1; s--) {
           const row = new Map<Probabilidade, Risk[]>();
           for (let p = 1; p <= 5; p++) {
             const cellRisks = risks.filter(r => r.severidade === s && r.probabilidade === p && !r.deletadoEm);
             row.set(p, cellRisks);
           }
           matrix.set(s, row);
         }
         return matrix;
       }, [risks]);
     }
     ```
   - Usage in component: iterate matrix, render each cell with color by max-NPR in cell

3. **Implement `useTopRisks`** (30 min):
   - Returns: top 5 risks by NPR (excluding deleted, closed)
   - Logic:
     ```typescript
     export function useTopRisks() {
       const { risks } = useRisks();
       return useMemo(() =>
         risks
           .filter(r => r.status !== 'fechado' && !r.deletadoEm)
           .sort((a, b) => b.npr - a.npr)
           .slice(0, 5),
         [risks]
       );
     }
     ```

**Verification:**

- ✅ `npm run build` clean
- ✅ Hooks don't leak listeners (useEffect cleanup present)
- ✅ Memoization working (matrix doesn't recompute if risks unchanged)

**Rollback (if needed):** Delete hooks files.

---

## T8. Implement UI Components (RiskForm, RiskMatrix, Top5Widget, Register, Review Modal)

**Outcome:** 5 main UI components render; multi-step form functional; heatmap interactive; review modal submits.

**Files to create:**

- `/src/features/risks/components/RisksView.tsx` (entry point)
- `/src/features/risks/components/RiskRegister.tsx` (table)
- `/src/features/risks/components/RiskForm.tsx` (4-step wizard)
- `/src/features/risks/components/RiskMatrix.tsx` (5×5 heatmap SVG)
- `/src/features/risks/components/RiskReviewModal.tsx` (review form)
- `/src/features/risks/components/Top5RisksWidget.tsx` (dashboard widget)

**Steps:**

1. **Implement `RisksView` (entry point)** (45 min):
   - Structure:
     - Topbar: `← Hub`, title "Gestão de Riscos", lab badge
     - KPI strip (5 cards): `Total ativos | Críticos (NPR≥100) | Alto (61–99) | Em tratamento | Vencendo revisão`
     - Tabs: `[Registro | Matriz | Top 5 | Revisões]`
     - Tab 1: `<RiskRegister />`
     - Tab 2: `<RiskMatrix />`
     - Tab 3: `<Top5RisksWidget />`
     - Tab 4: list of risks with reviewDate ≤ today (filterable)

2. **Implement `RiskRegister` (table)** (60 min):
   - Dark-first table:
     - Columns: `Código | Descricao | Processo | Categoria | NPR | Nivel | Status | Owner | Próx. Revisão | Ações`
     - Sorting: by NPR (DESC, default), codigo, reviewDate
     - Filters: processo, categoria, nivel, status
     - `tabular-nums` on NPR and dates
     - Row actions: Edit, Review, Delete
     - Empty state

3. **Implement `RiskForm` (4-step wizard)** (90 min):
   - **Step 1: Descrição**
     - codigo: auto-suggest (e.g., `RIS-001`, `RIS-002`) via helper `sugerirProximoCodigo`
     - descricao: textarea, 50–500 chars
     - processo: dropdown (enum)
     - categoria: dropdown (enum)
   - **Step 2: Análise FMEA**
     - Probabilidade: scrubber/slider 1–5 with labels (rara, baixa, media, alta, muito alta)
     - Severidade: scrubber 1–5 (leve, minor, media, grave, critica)
     - Deteccao: scrubber 1–5 (certa, alta, media, baixa, muito baixa)
     - Live preview: `NPR = P × S × D`, `Nivel` badge (color-coded)
   - **Step 3: Tratamento**
     - Estrategia: radio buttons (mitigar, aceitar, evitar, compartilhar)
     - Ações: repeater rows `[Descricao | Prazo | Owner | Status]`
     - Add/remove action rows
   - **Step 4: Review**
     - Owner: combobox (colaboradores)
     - reviewDate: date picker (default = today + 365d)
     - Summary card: all inputs read-only
   - Submit: call `useRisks.createRisk(...)` → success toast → back to register

4. **Implement `RiskMatrix` (heatmap)** (60 min):
   - SVG-based 5×5 grid
   - Rows = Severidade (top=5, bottom=1); Cols = Probabilidade (left=1, right=5)
   - Cell color by max-NPR: 
     - Baixo (≤24): emerald-500
     - Médio (25–60): amber-400
     - Alto (61–99): orange-500
     - Crítico (≥100): red-500
   - Cell content: count of risks at (P, S) + tooltip on hover
   - Click cell: filter `RiskRegister` to show only risks at that (P, S)
   - Legend: color scale + thresholds
   - Responsive (scale SVG to container)

5. **Implement `RiskReviewModal`** (45 min):
   - Form fields:
     - data: date picker (default=today)
     - revisor: combobox (colaboradores)
     - resultado: radio buttons (mantido | reduzido | reclassificado | fechado)
     - If reclassificado: show P/S/D scrubbers + nprNovo preview
     - observacoes: textarea (optional)
   - Submit: call `useRisks.registrarRevisao(...)` → success → close modal

6. **Implement `Top5RisksWidget`** (30 min):
   - Compact list: `[1–5]. RIS-XXX | NPR 100 | Crítico | Owner`
   - No sorting/filtering; read-only
   - Click row: open Risk detail view
   - Empty state if no critical risks

**Verification:**

- ✅ `npm run build` clean
- ✅ All components render without error (dev server)
- ✅ Form multi-step navigation works
- ✅ Matrix heatmap renders (SVG loads)
- ✅ Hooks don't leak listeners

**Rollback (if needed):** Delete `components/` directory.

---

## T9. Implement Rules + Indexes + Emulator Tests

**Outcome:** Firestore rules validated; composite indexes defined; emulator test suite passes.

**Files to modify:**

- `/firestore.rules`
- `/firestore.indexes.json`
- `/functions/test/risks/rules.test.mjs` (new)

**Steps:**

1. **Update `firestore.rules`** (45 min):
   - Invoke `Skill hcq-firestore-rules-generator` with scope=`risks`
   - Expected output: rules block for `/labs/{labId}/risks/{riskId}` + subcollection `/events/{eventId}`
   - Rules:
     ```
     match /labs/{labId}/risks/{riskId} {
       allow read: if isActiveMemberOfLab(labId);
       allow create, update, delete: if false;
       
       match /events/{eventId} {
         allow read: if isActiveMemberOfLab(labId);
         allow create, update, delete: if false;
       }
     }
     ```

2. **Update `firestore.indexes.json`** (20 min):
   - Composite indexes:
     - `(labId, deletadoEm, status, npr DESC)` for register sorted by NPR
     - `(labId, deletadoEm, reviewDate ASC)` for review-due query

3. **Emulator test suite** (90 min):
   - File: `/functions/test/risks/rules.test.mjs`
   - Test cases:
     - ✅ Lab member can read risks
     - ❌ Lab member cannot directly create
     - ❌ Non-member cannot read
     - ✅ Callable can write + trigger fires
     - ✅ ReviewHistory append works
     - ❌ Directly mutating NPR rejected (defense in depth, though callable-only anyway)
   - Run: emulator + `npm test -- test/risks/rules.test.mjs`

**Verification:**

- ✅ `firebase deploy --only firestore:rules` succeeds
- ✅ Indexes show in Console (enabled state)
- ✅ Emulator test suite all pass

**Rollback (if needed):** Revert rules + indexes.

---

## T10. Shell Integration (Lazy Route + Hub Tile)

**Outcome:** `RisksView` accessible via `/app/risks` route; Hub tile clickable.

**Files to modify:**

- `/src/AppRouter.tsx`
- `/src/types/index.ts`
- `/src/features/hub/ModuleHub.tsx`
- `/vite.config.ts`

**Steps:**

1. **Register lazy route** (15 min):
   - Add: `const RisksView = React.lazy(() => import('../features/risks/components/RisksView'));`
   - Route case: `case 'risks': return <Suspense fallback={<Skeleton />}><RisksView /></Suspense>;`

2. **Extend `View` union** (5 min):
   - Add: `'risks'` to type

3. **Add Hub tile** (20 min):
   - Tile object:
     ```typescript
     {
       id: 'risks',
       title: 'Gestão de Riscos',
       description: 'FMEA-lite + matriz NPR + tratamento + revisões',
       icon: <svg>...</svg>, // shield+exclamation or matrix icon
       status: 'active',
       view: 'risks',
       enabled: true
     }
     ```

4. **Update vite.config** (10 min):
   - Add manualChunks: `'feature-risks': [/src\/features\/risks\//]`

**Verification:**

- ✅ `npm run build` clean
- ✅ Route loads without error
- ✅ Hub tile renders and navigates

**Rollback (if needed):** Revert all four files.

---

## T11. Documentation + CLAUDE.md + ADR Index

**Outcome:** Module rules documented; root CLAUDE.md updated; ADR-0016 linked; Obsidian checklist marked done.

**Files to modify:**

- `/src/features/risks/CLAUDE.md`
- `/CLAUDE.md` (root)
- `/docs/adr/README.md` (already done in T1, verify)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Checklist_Auditoria.md`

**Steps:**

1. **Module CLAUDE.md** (30 min):
   - Populate from `src/features/turnos/CLAUDE.md` template
   - Business rules: `RN-RISK-01` through `RN-RISK-08`
   - Compliance citations: DICQ 4.14.6, RDC 978 Art. 86, ISO 15189 §8.5
   - Schema notes
   - Pending: labSettings nprThresholds UI (v1.4 Phase 1), ISO 31000 escape hatch (v1.5)

2. **Root CLAUDE.md** (10 min):
   - Update "Módulos em produção" table, add row:
     ```
     | risks | Em prod · FMEA-lite + NPR scoring + matriz + revisões periódicas (DICQ 4.14.6 + RDC 978 Art. 86) | YYYY-MM-DD |
     ```

3. **Verify ADR index** (5 min):
   - Check `/docs/adr/README.md` has ADR-0016 link (added in T1)

4. **Obsidian checklist** (5 min):
   - Search for "Gestão de risco" or "FMEA" or "Art. 86"
   - Mark as complete: `[x] Risks FMEA-lite module live — NPR scoring, heatmap, review automation`

**Verification:**

- ✅ CLAUDE.md readable
- ✅ Root row added
- ✅ ADR linked in README
- ✅ Obsidian checkbox marked

**Rollback (if needed):** Revert CLAUDE.md files.

---

## T12. Deploy (7 Steps, mirroring Stream A)

**Outcome:** Module **LIVE** in production; Stream B complete and mergeable with Stream A.

**Prerequisites:**

- ✅ T1–T11 complete
- ✅ `npm test` passes (should still be 738/738 if no cross-stream conflicts)
- ✅ `npx tsc --noEmit` zero errors
- ✅ Emulator smoke tests all pass

**Steps:**

1. **Claim provisioning** (10 min):
   - Call `provisionModulesClaims({modules: ['risks'], dryRun: false})`

2. **Type check + lint** (10 min):
   - `npm run build`, `npx tsc --noEmit`, `cd functions && npx tsc --noEmit`

3. **Deploy Rules + Indexes** (15 min):
   - `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2`

4. **Deploy Functions** (20 min):
   - `firebase deploy --only functions --project hmatologia2`
   - Expected: 4 callables + 1 trigger + 1 cron visible
   - Check logs for ERROR/CRITICAL

5. **Deploy Hosting** (15 min):
   - `firebase deploy --only hosting --project hmatologia2`

6. **Smoke tests (24h window)** (30 min):
   - Navigate to `/app/risks`
   - Create risk (4-step form) → submit → verify in register
   - Click cell in matrix → filter register
   - Open review modal → register review
   - Check Top 5 widget (mock data or real if risk created)
   - Expected: no ERROR logs; all interactions <2s

7. **Cloud Logs verification** (60 min over 24h):
   - Use `scripts/monitor-cloud-logs.ps1`
   - Filters: `resource.type="cloud_function" AND function_name=("risks_*" OR "on_risk_*")` AND `severity >= ERROR`
   - Report: no critical errors; summarize activity
   - CTO sign-off

**Verification:**

- ✅ `firebase deploy --only hosting` complete
- ✅ Hub tile present
- ✅ Smoke tests pass
- ✅ Cloud Logs report: no ERROR/CRITICAL for 24h

**Rollback (if critical error):** Revert rules / functions / hosting via `firebase deploy` with previous version.

---

## Success Criteria (All-or-nothing T12 gate)

- ✅ **Functional**: Create/update/review risks; matrix heatmap renders; cron fires; review auto-reminders work
- ✅ **Compliance**: Audit trail (chainHash) unbroken; NPR recomputed server-side; no RDC 978 Art. 86 or DICQ 4.14.6 violations
- ✅ **Performance**: All operations <2s; heatmap renders 50+ risks <500ms
- ✅ **Security**: Rules deny unauthorized access; callable claims checked; sensitive risk data not exposed to non-members
- ✅ **Observability**: Cloud Logs show function entry/exit; errors logged with context
- ✅ **Quality**: No TypeScript errors; unit tests pass; smoke tests pass
- ✅ **Docs**: ADR-0016 published; CLAUDE.md complete; Obsidian checklist updated

---

**Plan 00-04 COMPLETE**

Estimated completion: **2026-05-10** (3.5 days from start)  
Next: Merge with Stream A (Plan 00-03) results + final Wave 2 gate (WAVE2-EXECUTION-BRIEF.md)

---

## Cross-Stream Merge Notes (for Wave 2 final gate)

When both Stream A (00-03) and Stream B (00-04) complete:

1. **Git merge strategy**: Feature branches (optional) or direct merge to `main` if no conflicts
2. **Type check merged code**: `npx tsc --noEmit` on combined web + functions
3. **Run full test suite**: `npm test` — expect 738+X (X = new tests from both streams)
4. **Emulator smoke**: Both modules' callables, triggers, crons invoked
5. **Pre-deploy checklist** (invoke `hcq-deploy-gates` skill):
   - Type check ✓
   - Test ✓
   - Lint ✓
   - Secrets scan ✓
   - Emulator tests ✓
6. **Deploy sequence**: Rules → Indexes → Functions → Hosting (single unified deploy)
7. **Post-deploy Cloud Logs**: Combined filters for both modules; 24h sign-off

---

**Last updated:** 2026-05-07 21:30 UTC  
**Prepared by:** Agent (pre-execution brief generation)
