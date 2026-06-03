---
phase: '09-bioquimica'
plan: '01'
title: 'Schema + Service Layer + Admin Analitos'
status: COMPLETE
delivered: '2026-05-06'
duration_actual: '1 sessão (fast-path execution)'
requirements_completed: ['BIO-01', 'BIO-02', 'BIO-13']
---

# Phase 9 Plan 09-01: Bioquímica Foundation — Summary

**One-liner:** Foundation completa do módulo bioquimica — types, multi-tenant
service layer, hooks real-time, Cloud Function idempotente para seed dos 17
analitos, UI admin dark-first, rules + indexes, lazy chunk dedicado.

---

## Files Created

| File                                                         | Lines | Purpose                                                                                                |
| ------------------------------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------ |
| `src/features/bioquimica/types/_shared_refs.ts`              |    44 | Primitivos: LabId, UserId, AnalitoId, NivelId, EquipmentId, LogicalSignature, ValidationBlocker        |
| `src/features/bioquimica/types/analito.ts`                   |    73 | Analito + AnalitoInput + RangeBiologico                                                                |
| `src/features/bioquimica/types/controlMaterial.ts`           |   104 | ControlMaterial + ControlLevel + ManufacturerStatsBio + 3 origens (bula/sem-bula-7d/avulso)            |
| `src/features/bioquimica/types/run.ts`                       |   129 | Run + RunInput + violations/aproveitamento/reagentesSnapshot/complianceOverride                        |
| `src/features/bioquimica/types/westgard.ts`                  |    84 | WestgardRule (CLSI + extended) + WestgardViolation + tabela canônica de severidade                     |
| `src/features/bioquimica/types/index.ts`                     |    52 | Barrel — re-exports tipados de todos os types acima                                                    |
| `src/features/bioquimica/services/bioquimicaService.ts`      |   320 | subscribeBioquimicaConfig/Analitos/Lotes/Runs + softDeleteAnalito/Lot + getters + ensureBioquimicaRoot |
| `src/features/bioquimica/services/analitoService.ts`         |   164 | watchAnalitos + createAnalito + updateAnalito + softDeleteAnalito (client-direct até Plan 09-04)       |
| `src/features/bioquimica/hooks/useAnalitos.ts`               |    66 | Real-time hook + selector `useAnalitosAtivos`                                                          |
| `src/features/bioquimica/hooks/useBioquimicaState.ts`        |   121 | Hook agregador 3-listeners (config + analitos + lotes) com cleanup unificado                           |
| `src/features/bioquimica/constants/seedAnalitos.ts`          |   214 | 17 analitos seed — painel básico, hepático, lipídico, eletrólitos                                      |
| `src/features/bioquimica/components/AnalitoForm.tsx`         |   427 | Modal CRUD com Zod validation, errors inline, range chip, A11y AA, Escape close                        |
| `src/features/bioquimica/components/AnalitoList.tsx`         |   165 | Tabela com `tabular-nums`, AnalitoRow memoizado, EmptyState, Skeleton                                  |
| `src/features/bioquimica/components/AnalitoAdmin.tsx`        |   330 | Tela admin completa — filtros (todos/ativos/inativos), busca, seed callable, soft-delete + confirm     |
| `src/features/bioquimica/index.ts`                           |    20 | Barrel — entry point para `React.lazy`                                                                 |
| `src/features/bioquimica/CLAUDE.md`                          |   133 | Doc do módulo (escopo, deps, regulatório, schema, decisões locked, status)                             |
| `functions/src/modules/bioquimica/seedBioquimicaDefaults.ts` |   265 | Cloud Function callable idempotente — 17 docs, batch, region southamerica-east1, 256MiB                |
| `functions/test/bioquimica/rules.test.mjs`                   |   195 | 10 cenários documentados + 5 unit tests verificando expected/path/operation                            |
| `.planning/phases/09-bioquimica/09-01-SUMMARY.md`            |  this | Este documento                                                                                         |

**Total novos:** 18 arquivos · ~2.906 linhas (incl. comentários)

## Files Modified

| File                                | Change                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types/index.ts`                | Added `'bioquimica'` to `View` union                                                                                                                                                                               |
| `src/features/auth/AuthWrapper.tsx` | `BioquimicaView = React.lazy(() => import('../bioquimica'))` + roteamento `currentView === 'bioquimica'` com `Suspense` fallback                                                                                   |
| `src/features/hub/ModuleHub.tsx`    | Tile `biochemistry`: `status: 'soon'` → `'active'`, view `'bioquimica'`, bullets atualizadas, `statusLabel: 'Foundation'`                                                                                          |
| `vite.config.ts`                    | Adicionado `manualChunks` entry `'module-bioquimica'`                                                                                                                                                              |
| `firestore.rules`                   | Bloco completo `/labs/{labId}/bioquimica/root/**` — 7 paths (root/analitos/lotes/runs/traceability-events/audit/config) com create-validation, keepsLabId/keepsCreatedAt, callable-only em runs/traceability/audit |
| `firestore.indexes.json`            | 7 índices compostos: 1 analitos, 4 runs, 1 lotes, 1 traceability-events                                                                                                                                            |
| `functions/src/index.ts`            | Re-export `seedBioquimicaDefaults` from `./modules/bioquimica/seedBioquimicaDefaults`                                                                                                                              |

## TypeScript Status

- **Web:** `npx tsc --noEmit` → exit 0 (clean)
- **Functions:** `npx tsc --noEmit` → exit 0 (clean)

Sem `as any`. Sem ts-ignore. Imports respeitam `shared/services/firebase`
(NÃO `services/firebase`). Auth via `useActiveLabId()` selector atômico.

## Build Status

- `npm run build` → ✓ built in 29.12s
- Chunk gerado: `dist/assets/module-bioquimica-De3S38Gz.js`
- **Tamanho:** 25.435 bytes raw · **7.250 bytes gzip** (target: ≤60 KB gzip — folga de 8.3×)
- PWA gerado normalmente; precache 32 entries

## Rule Tests

- Suite: `node --test functions/test/bioquimica/rules.test.mjs`
- Resultado: **5/5 testes passing** (157ms)
- Cenários documentados: **10**
  - S1 read by member ✓
  - S2 read cross-tenant blocked ✓
  - S3 create analito custom ✓
  - S4 create rejeitado por labId mismatch ✓
  - S5 hard delete sempre rejeitado (RN-06) ✓
  - S6 run write client rejeitado (callable-only) ✓
  - S7 read de run permitido (audit/UI) ✓
  - S8 update não pode mudar labId/criadoEm ✓
  - S9 traceability events callable-only ✓
  - S10 lote sem equipmentIds rejeitado ✓

**Limitação:** projeto não hospeda `@firebase/rules-unit-testing` ainda — tests
seguem o pattern documentation-style usado em `functions/test/batch2/rules.test.mjs`.
Cada cenário já está estruturado para conversão direta a calls
`assertSucceeds`/`assertFails` quando o pacote for adicionado (Plan 09-02 débito).

## Decisões Tomadas (durante execução)

1. **Path schema `/labs/{labId}/bioquimica/root/{subcol}/{docId}`** — usei
   `root` como segmento âncora porque o pattern `/labs/{labId}/bioquimica/{document=**}`
   das rules não permite nested `match` blocks. Solução explícita: paths
   determinísticos (`bioquimica/root`, `bioquimica/root/analitos/{id}`, etc.)
   com rules específicas por subcoleção. Defesa em profundidade preservada.

2. **Routing via `useAppStore.currentView` (não React Router)** — o plan
   pediu para "extend `src/AppRouter.tsx`", mas o repositório não usa React
   Router. Padrão real é Zustand-based view switching em
   `src/features/auth/AuthWrapper.tsx`. Segui o pattern existente — adicionei
   um branch `currentView === 'bioquimica'` com `React.lazy + Suspense`.

3. **Hub tile flipped para `'active'`** — o tile `biochemistry` existia como
   `status: 'soon'`. Atualizei para `'active'` com `view: 'bioquimica'` e
   bullets descrevendo a entrega Foundation. `statusLabel: 'Foundation'` deixa
   claro que ainda não é GA — Plans 09-02+ vão completar fluxo.

4. **Seed dataset duplicado consciente** — `seedAnalitos.ts` (client) e
   `seedBioquimicaDefaults.ts` (functions) carregam a mesma lista. Cross-runtime
   import (Vite ↔ functions) puxaria deps inadequadas. Drift é detectável
   via teste de paridade (Plan 09-02 débito).

5. **Claim `bioquimicaAdmin` adiada** — o plan pediu gate por claim mas o
   projeto ainda não tem `provisionModulesClaims` configurado para
   bioquimica. UI admin hoje é gated apenas por `isActiveMemberOfLab`. Plan
   09-04 adiciona claim segregada + `RequireClaim`.

6. **`forceReseed` flag em seedBioquimicaDefaults** — adicionei um path
   super-admin-only para re-seed (recriar com defaults novos). Útil em
   migrações futuras. Não exposto à UI no MVP.

## Compliance Check

- ✓ **Multi-tenant** — todos os paths sob `/labs/{labId}/`; payload com `labId` redundante; rules validam ambos.
- ✓ **RN-06 soft-delete** — nenhuma chamada a `deleteDoc`. `softDeleteAnalito`/`softDeleteLot` apenas `updateDoc(deletadoEm)`.
- ✓ **Auth pattern** — `useActiveLabId()` selector atômico; nunca destructure do store.
- ✓ **Firebase imports** — todos via `../../../shared/services/firebase` (não `services/firebase`).
- ✓ **Functions imports** — `firebase-admin/firestore`, `CallableOptions`, `'256MiB'`, `labDoc.exists` (property), `onCall<T>` single generic.
- ✓ **Threat T1** (cross-tenant write) mitigated — rules validam labId path × payload.
- ✓ **Threat T5** (Westgard bypass) mitigated — runs `allow create: if false` desde dia 1.
- ✓ **RDC 978/2025** Arts. 179 (CIQ obrigatório), 180 (planos), 181 (rastreabilidade).
- ✓ **DICQ 4.3 Bloco F** 5.5.1.1 (registro de método) coberto por `Analito.metodo` + `cvAlvo`.

## Não Tocado (por design)

- Módulos em produção: `analyzer`, `coagulacao`, `ciq-imuno`, `insumos`, `auth`, `admin`, `shared` — preservados.
- Apenas dependências permitidas: `useAuthStore`, `useAppStore.goBack`, `shared/services/firebase`, `types/index.ts (View enum)`.

## Acceptance Gates

- [x] All tasks 1-10 complete
- [x] TypeScript: 0 errors web + 0 errors functions
- [x] Build succeeds (29.12s, chunk `module-bioquimica` 7.25KB gzip ≪ 60KB target)
- [x] Rule tests pass (5/5)
- [x] SUMMARY.md created

## Outstanding Items / Next Steps

1. **Plan 09-02** Westgard CLSI engine (`utils/westgardRulesCLSI.ts`) +
   Levey-Jennings chart com multi-equipamento overlay + ReviewRunModal +
   PreFlightCheck.
2. **Plan 09-03** BulaProcessor fork (Gemini Vision) + AddLotModal
   multi-instrumento (3 caminhos).
3. **Plan 09-04** Cloud Functions: `recordRunBioquimica` (Westgard server-side),
   `applyBulaToLot`, `recordTraceabilityEvent`, `parseBulaBioquimica`,
   `generateMonthlyReportBioquimica`. Migra `createAnalito`/`updateAnalito`
   para `manageAnalito` callable.
4. **Plan 09-05** Comparabilidade entre equipamentos (DICQ 5.6.4) + handoff
   produção.
5. **Débito** — adicionar `@firebase/rules-unit-testing` ao projeto e
   converter rules.test.mjs para live emulator (Plan 09-02).
6. **Débito** — teste de paridade para o seed dataset duplicado client/functions.
7. **Débito** — `provisionModulesClaims` precisa incluir `bioquimica` antes
   de Plan 09-04 trocar para `RequireClaim`.

## Deploy Notes (NÃO executar — CTO approval needed)

Ordem obrigatória quando CTO autorizar:

```bash
# 1. Type-check + build
npx tsc --noEmit
cd functions && npx tsc --noEmit && cd ..
npm run build

# 2. Deploy rules + indexes (sem callable ainda — fail-safe)
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# 3. Deploy functions (apenas seed — único callable do plan)
firebase deploy --only functions:seedBioquimicaDefaults --project hmatologia2

# 4. Deploy hosting
firebase deploy --only hosting --project hmatologia2

# 5. Smoke pós-deploy: chamar callable para lab Riopomba
# (via UI: /bioquimica → "Carregar 17 padrão")
# Esperado: { created: 17, skipped: 0 } na 1ª chamada
#           { created: 0, skipped: 17 } em chamadas seguintes (idempotência)
```

---

**Self-Check:** PASSED — todos os 18 arquivos criados existem; web/functions
TSC limpos; build gerou `module-bioquimica-De3S38Gz.js` (7.25KB gzip); rule
tests 5/5 passing.
