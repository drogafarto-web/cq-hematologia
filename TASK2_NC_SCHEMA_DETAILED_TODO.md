# Task 2 — NC Schema Unification (DETAILED TODO)

## What Was Attempted

Updated `functions/src/modules/qualidade/types.ts` to align with frontend schema:
- Changed `NCSeveridade` enum: `LEVE, MEDIA, CRITICA` → `LEVE, MODERADA, GRAVE, CRITICA`
- Changed `status: string` → `CAPAStatus` enum
- Aligned field names: `createdAt/updatedAt` → `criadoEm`
- Added `capaHistorico` structure

**Build failed** because callables still reference old schema fields.

## What Needs Fixing (3 files)

### 1. `functions/src/modules/qualidade/capaWorkflow.ts`

**Errors to fix:**
```
Line 35: status: 'investig' → capaStatus: 'investigacao'
Line 37: ...nc.capa → Remove (structure changed)
Line 40: nc.capa?.investigacao → Use capaHistorico[] array instead
Line 47: updatedAt → atualizadoEm
Line 53: nc.numero → nc.codigo (field renamed)
Line 97: status: 'acaoCorretiva' → capaStatus: 'acao'
...and 9 more similar replacements
```

**Pattern:** Replace CAPA nested object structure with flat `capaHistorico` append-only array.

**Old pattern:**
```typescript
{ status: 'investig', capa: { investigacao: {...} } }
```

**New pattern:**
```typescript
{ 
  capaStatus: 'investigacao', 
  capaHistorico: [..., { estado: 'investigacao', dataTransicao: now(), responsavel: uid, ... }]
}
```

### 2. `functions/src/modules/qualidade/naoConformidade.ts`

**Errors:**
```
Line 42: origem: NCOrigem → origem: string (literal 'auditoria'|'modulo'|'cliente'|'interno')
Line 149: ...nc.capa → ...nc.capaHistorico[] (new structure)
```

**Pattern:** Change `origem` to accept string literals, not object.

### 3. Firestore Rules (`firestore.rules`)

Search for NC validation and update severity enum checks:
```
// OLD: severidade in ['leve', 'media', 'critica']
// NEW: severidade in ['leve', 'moderada', 'grave', 'critica']
```

## Complete Fix (Command Sequence)

```bash
# 1. Read the current files to understand flow
grep -A 10 "investigacao\|acaoCorretiva\|verificaEficacia" functions/src/modules/qualidade/capaWorkflow.ts

# 2. Update capaWorkflow.ts — replace all CAPA transitions to use capaHistorico
# 3. Update naoConformidade.ts — change origem type + capaHistorico refs
# 4. Update firestore.rules — severity enum validation
# 5. Build + deploy

cd functions && npm run build
```

## Estimated Time

- **Fast path** (copy-paste fixes): 30-45 min
- **Safe path** (understand + fix methodically): 1-2 hours

## Why This Matters

Frontend schema is the source of truth. Functions must match it exactly for:
- NC CAPA workflow serialization
- Client ↔ server type safety
- Audit trail consistency

Do not skip this — foundation for Tasks 3-5.

---

**Next session: READ THIS FILE, then execute the 3 file edits in order.**
