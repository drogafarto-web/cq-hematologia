# ADR 0002 — Lote ↔ NF Obrigatório + Backfill

**Status:** In Progress (ADR 0005 completed — unblocked)  
**Date:** 2026-05-02  
**Author:** CTO + Team  
**Related Issues:** V-003, V-006, V-012 (spine violations)  
**Depends on:** ADR 0005 ✓

---

## Problem

**Violation V-003:** `Insumo.notaFiscalId` e `fornecedorId` são **opcionais**.

Consequence:

- Lotes de reagentes aparecem sem origem fiscal
- Não conformidade rastreável: qual fornecedor vendeu este reagente?
- RDC 978 exige rastreabilidade ponta-a-ponta (origem → consumo)
- Auditoria impossível: "de onde saiu este reagente?"

**V-006:** NotaFiscal sem `itens[]` estruturado — não consigo vincular Lote → Item → NF.

**V-012:** NotaFiscal sem `NFItem[]` — rastreabilidade do preço/quantidade não existe.

---

## Solution

Make rastreabilidade **mandatory**:

1. **Fornecedor** — completo com qualificação, evidências, requalificação anual
2. **NotaFiscal** — com itens[] estruturado, validação no recebimento
3. **Insumo** — `notaFiscalId` + `fornecedorId` obrigatórios (exceto legados com backfill)
4. **Gate** — Só aceita NF se Fornecedor está qualificado

---

## Detailed Design

### 1. Schema Updates

#### Fornecedor (novo)

```typescript
interface Fornecedor {
  id: string;
  razaoSocial: string;
  cnpj: string;
  status: 'pendente' | 'qualificado' | 'suspenso' | 'desqualificado';
  qualificadoEm?: Timestamp;
  proximaRequalificacao?: Timestamp;
  evidencias: Array<{ tipo; url; dataUpload }>;
  categoriasFornecidas: string[];
}
```

#### NotaFiscal (novo + estendido)

```typescript
interface NotaFiscal {
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedorId: string; // FK Fornecedor (validates qualificado)
  itens: Array<{
    descricao: string;
    quantidade: number;
    precoUnitario: number;
    loteNumber?: string;
    validadeAte?: string;
  }>;
  conferenciaOk: boolean;
  desviosObservados?: string[];
  conferidoPor: string; // operadorId
}
```

#### Insumo (estendido)

```typescript
interface Insumo {
  // ... existing fields
  notaFiscalId: string; // Obrigatório (novo)
  fornecedorId: string; // Obrigatório (novo)
  nfItemIndex: number; // Qual item da NF gerou este Lote
}
```

### 2. Workflow: Recebimento de NF

```
1. Criar NotaFiscal (numero, serie, dataEmissao, fornecedorId, itens)
   ↓ Validação: Fornecedor.status === 'qualificado'?
   ↓ Se não → error "Fornecedor não qualificado"

2. Conferência (validar quantidade, lote, validade)
   ↓ Registrar desvios (se houver)

3. Confirmar recebimento
   ↓ Para cada item da NF:
     ├─ Criar Insumo Lote
     ├─ Set notaFiscalId (FK obrigatório)
     ├─ Set fornecedorId (FK obrigatório)
     └─ Set nfItemIndex (rastreabilidade)

4. Se desvios encontrados:
   ↓ Abrir NC automaticamente (depois de ADR 0003)
```

### 3. Firestore Rules

```
match /labs/{labId}/notas-fiscais/{nfId} {
  allow create: if request.auth.uid != null
             && request.resource.data.fornecedorId != null
             && request.resource.data.itens != null;

  allow read: if request.auth.uid != null;
}

match /labs/{labId}/insumos/{loteId} {
  // NEW: Require notaFiscalId + fornecedorId for writes after migration
  allow create: if request.auth.uid != null
             && (request.resource.data.notaFiscalId != null ||
                 request.resource.data._legacyMigrated == true);
}
```

### 4. Cloud Functions

#### `criarNotaFiscal()`

- Input: labId, numero, serie, dataEmissao, fornecedorId, itens, valorTotal
- Validates: Fornecedor.status === 'qualificado'
- Creates: NotaFiscal doc
- Audit: logs criação via ADR 0005 chain

#### `confirmarRecebimento()`

- Input: labId, nfId, desviosObservados?
- Reads: NotaFiscal
- For each item: creates Insumo Lote (notaFiscalId + fornecedorId mandatory)
- Deviations: stored; will trigger NC after ADR 0003

#### `upsertFornecedor()`

- Input: labId, razaoSocial, cnpj, status, evidencias, categories
- Creates/updates Fornecedor doc
- Validates: CNPJ format, qualificação date logic

---

## Migration (Backfill)

### Legado Problem

- Existing Insumos have no notaFiscalId / fornecedorId
- Can't delete them (data loss)
- Solution: dual-mode for N weeks → hard requirement after

### Backfill Strategy

1. **Audit existing Insumos:** count without notaFiscalId
2. **Create catch-all Fornecedor:** "Fornecedor Legado (Sem Rastreabilidade)"
3. **For each Insumo without notaFiscalId:**
   - Create synthetic NotaFiscal (numero = "LEGADO-BATCH-{date}")
   - Link Insumo.notaFiscalId → synthetic NF
   - Set Insumo.\_legacyMigrated = true
   - Set Insumo.fornecedorId = "fornecedor-legado"
4. **Firestore rules:** allow writes to insumos if `_legacyMigrated === true`
5. **Deprecate:** after 4 weeks, rules enforce notaFiscalId obrigatório

### Script

```bash
node functions/scripts/backfill-notaFiscal.mjs --labId=<lab-id>
```

---

## Acceptance Criteria

✓ Fornecedor schema + CF implemented  
✓ NotaFiscal schema + CF implemented  
✓ Insumo schema extended (notaFiscalId, fornecedorId, nfItemIndex)  
✓ Gate: NF creation validates Fornecedor qualificado  
✓ Gate: Insumo creation requires notaFiscalId (post-migration)  
✓ Backfill: 100% legacy Insumos migrated + synthetic NF created  
✓ Firestore rules updated (dual-mode → strict)  
✓ Tests: E2E NF → Lote workflow  
✓ Audit: all operations logged via ADR 0005 chain

---

## Timeline

**Week 3-5 (parallel with ADR 0006):**

- Day 10-12: Schema + CF implementation
- Day 13-14: Firestore rules + backfill script
- Day 15: Testing + security audit
- Day 16: Deploy

---

## Rollback

If critical issue:

1. Revert Firestore rules to `notaFiscalId` optional
2. Keep NF + Fornecedor docs (immutable)
3. Revert CF (stop creating new Lotes with FK)

---

**Next:** Implement after ADR 0005 deployed + secret verified.
