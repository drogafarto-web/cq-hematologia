# Phase 2 Batch 1 — Execution Progress

**Session Start**: 2026-05-03 Session 2 (Post Phase 2 unblock)  
**Plan**: `C:\Users\labcl\.claude\plans\sequential-jingling-toast.md`

## ✅ Completed

### Task 1 — Export Missing Cloud Functions
- ✅ Added `recordarTreinamentoPOP` export to `functions/src/index.ts` (procedimentos/pop module)
- ✅ Added `addAcao` export to `functions/src/index.ts` (qualidade/naoConformidade module)
- ✅ Build green: `cd functions && npm run build` passes
- ✅ Commit: a689d3c

**Next step**: `firebase deploy --only functions --project hmatologia2` (awaits CTO approval)

---

## ⏳ In Progress / Pending

### Task 2 — Unify NC Schema (frontend ↔ backend) [HIGH PRIORITY]

**Schema divergence found:**

Frontend (canonical): `src/features/sgq/types/NaoConformidade.ts`
- `severidade: 'critica' | 'grave' | 'moderada' | 'leve'`
- `capaStatus: CAPAStatus` (strict enum: nao_iniciada | investigacao | acao | eficacia | fechada | reaberta)
- `criadoEm: Timestamp`, `deletadoEm: Timestamp | null`

Backend (diverges): `functions/src/modules/qualidade/types.ts`
- `NCSeveridade` enum: `leve | media | critica` (no `grave`; has `media` not `moderada`)
- `status: string` (loose typing, not enum)
- `createdAt/updatedAt` (EN instead of PT-BR)

**Fix needed:**
1. `functions/src/modules/qualidade/types.ts` — update `NCSeveridade` enum + `status` typing
2. `functions/src/modules/qualidade/naoConformidade.ts` — update field refs in callables
3. `functions/src/modules/qualidade/capaWorkflow.ts` — update state machine references
4. Firestore rules: verify `severidade` enum validation matches

**Files to edit:**
```
functions/src/modules/qualidade/
  ├── types.ts (priority)
  ├── naoConformidade.ts
  └── capaWorkflow.ts
firestore.rules (search for NC validation)
```

**Commands for next session:**
```bash
# Read divergences
grep -A 20 "interface NaoConformidade" src/features/sgq/types/NaoConformidade.ts
grep -A 20 "NCSeveridade\|status:" functions/src/modules/qualidade/types.ts

# After edits:
cd functions && npm run build
npx tsc --noEmit  # root level
```

---

### Task 3 — Wire POPs UI into SGQView + Hub

**Status**: Ready to start. Code exists, needs wiring.

**Key files:**
- `src/features/sgq/SGQView.tsx` — add `Procedimentos` tab alongside `Documentos`
- `src/features/sgq/pops/components/POPsList.tsx` — finalize list view
- `src/features/sgq/pops/components/CreatePOPModal.tsx` — wire `createPOP` callable
- `src/features/sgq/pops/components/TrainingAssignmentUI.tsx` — wire `recordarTreinamentoPOP` CF (now exported)
- `src/features/sgq/pops/usePOPs.ts` — verify hook subscribes correctly

**UX pattern to follow:**
- Dark-first, consistent with SGQ Document list
- Status chips: `ativa` (green), `em_revisao` (yellow), `obsoleta` (gray)
- Version rows collapsible (expand/collapse to show training assignments)

**Estimate**: 4-6h

---

### Task 4 — Wire Auditoria UI into SGQView + NC Auto-generation

**Status**: Ready to start. Code exists, needs wiring.

**Key files:**
- `src/features/sgq/SGQView.tsx` — add `Auditorias` tab
- `src/features/sgq/auditoria/components/AuditoriaList.tsx`
- `src/features/sgq/auditoria/components/FindingsForm.tsx` — add achado creation + `temAchadosGraves()` trigger
- `src/features/sgq/auditoria/useAuditorias.ts` — add mutations
- `src/features/sgq/naoConformidade/useNCs.ts` — verify `openNaoConformidade` callable accessible

**Critical UX flow:**
1. Create audit (client write allowed by rules)
2. Add achado with severidade selection (critica=red, grave=orange)
3. On save, if `temAchadosGraves()` → show dialog: "X critical findings detected. Create NCs now?"
4. Confirm → call `openNaoConformidade` for each grave/critica achado
5. NCs appear in NC list with `capaStatus: nao_iniciada`

**Estimate**: 5-7h

---

### Task 5 — Write ADR-0007 + Document Equipamento Schema

**Status**: Ready to start. Implementation exists, needs documentation.

**Files to create/update:**
- `docs/adr/ADR-0007-equipamento-gate.md` (new file)
- `functions/src/modules/equipamentos/types.ts` (add TODO comment about schema divergence)

**ADR should document:**
- Equipment calibration + maintenance gate decision
- Functions: `validarCalibracaoEquipamento`, `validarManutencaoEquipamento`
- Status enum definition (and note divergence with client schema)
- Field naming conventions (document client `name` vs CF `nome` mismatch)

**Estimate**: 1-2h

---

## Deployment Checklist (for next session)

**After Tasks 1-2 (functions changes):**
```bash
cd functions && npm run build              # verify clean
firebase deploy --only functions --project hmatologia2
# Wait for deployment → Firebase Console confirms all 4 CFs (createPOP, createPOPVersion, assinaturaRT, recordarTreinamentoPOP)
```

**After Tasks 3-5 (hosting changes):**
```bash
npx tsc --noEmit                           # type-check root
npm run build                              # build Vite
firebase deploy --only hosting --project hmatologia2
```

---

## Success Criteria (E2E Verification)

1. **POP flow**: Create POP → RT signs → training assigned → verify in Firestore
2. **Auditoria → NC flow**: Create audit → add critical finding → NC auto-generated → CAPA starts
3. **Smoke test**: `cd smoke-test && npm test` — `f-quality-01-nc-investigacao.spec.ts` reaches NC creation without auth error
4. **Type-check**: `npx tsc --noEmit` green at all times

---

## Notes for Next Session

- Context was at 34% when pausing. Task 2 (NC schema) is next priority — it's foundation for tasks 3-5.
- All scaffolding exists. Work is wiring + gap-closing, not greenfield.
- Revised estimate: 1.5 weeks total Batch 1 (down from original 4-5 weeks).
- Schema divergence (NC, Equipamento) is architectural debt but not blocking — document for reconciliation in Batch 2.

**Resume point**: Read `sequential-jingling-toast.md`, then start Task 2 (edit types.ts).
