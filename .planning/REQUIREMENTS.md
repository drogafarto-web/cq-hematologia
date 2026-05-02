# ADR 0005 — Helper cryptoAudit Compartilhado

**Fase 1 — Semana 1-2**  
**Status:** `in planning`  
**Sponsor:** CTO  
**ADR:** [ADR 0005](../../docs/adr/0005-helper-cryptoaudit.md) (a criar)

---

## Problema

**Violação V-009:** HMAC + chainHash **duplicado** em 2 arquivos:
- `functions/src/modules/insumos/chainHash.ts`
- `functions/src/modules/ciqAudit/writer.ts`

**Risco:** Duas implementações divergentes = bugs de rastreabilidade + falha na auditoria.  
**Impacto:** Bloqueia ADR 0002 (Lote↔NF) + ADR 0003 (NC global) — sem crypto helper unificado, nova spine viola compliance.

---

## Solução

Criar **helper `cryptoAudit`** centralizado (Cloud Function + SDK):

```
functions/src/modules/audit/cryptoAudit.ts
  ├── hmacChainHash(data, secret, previousHash?) → string (HMAC-SHA256)
  ├── verifyChainHash(data, hmac, secret, previousHash?) → boolean
  └── signAuditEntry(docRef, operadorId, operation) → { hash, hmac, timestamp }

functions/src/modules/audit/chainHashValidator.ts
  └── validateChainIntegrity(coleção) → { valid, violations[] }
```

**Amostra de uso:**
```typescript
// Antes (duplicado):
import chainHash from '../insumos/chainHash';  // Cópia 1
import writer from '../ciqAudit/writer';       // Cópia 2 — divergente?

// Depois (centralizado):
import { cryptoAudit } from '../audit/cryptoAudit';

const entry = await cryptoAudit.signAuditEntry(
  docRef,
  operadorId,
  'insumo.recebido'  // operation type
);
// → { hash, hmac, timestamp, chainPreviousHash }
```

---

## Requisitos Técnicos

### 1. Algoritmo criptográfico
- ✓ **HMAC-SHA256** (NIST FIPS 198-1 approved)
- ✓ **Chain-hash linear** — cada entrada refencia hash anterior
- ✓ **Secret management** — via `process.env.HCQ_SIGNATURE_HMAC_KEY` (Firebase secret)
- ✓ **Timestamp server** — `serverTimestamp()` canonicalizado (não client time)

### 2. Schema de audit entry
```typescript
type AuditEntry = {
  id: string;                    // doc id
  timestamp: Timestamp;          // server-generated
  operadorId: string;            // FK users
  operation: string;             // 'insumo.recebido', 'laudo.liberado', etc
  payload: Record<string, any>;  // o que foi modificado
  hmac: string;                  // HMAC-SHA256 do entry
  previousHash: string;          // hash do entry anterior na coleção
  hash: string;                  // SHA-256(entire entry) — para next
};
```

### 3. Validação de integridade
- ✓ Toda escrita em `/ciq-audit`, `/labs/{labId}/audit-log` passa por `cryptoAudit.sign()`
- ✓ Validação periódica: `chainHashValidator.validateChainIntegrity()` (rodado em scheduled Cloud Function)
- ✓ Alert se chain quebrada: abrir NC automática (severidade crítica)

### 4. Integração com firestore.rules
```
match /ciq-audit/{auditId} {
  allow create: if request.auth.uid != null 
             && request.resource.data.hmac != null
             && request.resource.data.hash != null
             && request.resource.data.timestamp == request.time;
  // (impedir escrita direta, só via Cloud Function)
}
```

### 5. Migração de dados existentes
- Importar chain-hash existentes de `/insumo-movimentacoes`
- Re-computar HMAC para dados legados (uma vez)
- Criar audit entry retroativo com timestamp original

---

## Critério de Aceitação

- [ ] Helper `cryptoAudit.ts` criado em `functions/src/modules/audit/`
- [ ] Testes unitários: `cryptoAudit.test.ts` (>90% coverage)
  - [ ] Sign entry com previousHash válido
  - [ ] Verify falha se HMAC modificado
  - [ ] Verify falha se previousHash quebrado
- [ ] `chainHash.ts` e `ciqAudit/writer.ts` **refatorados** pra consumir helper (não deletar, apenas delegate)
- [ ] Cloud Function `validateChainIntegrity()` deployada
- [ ] `firestore.rules` exigindo HMAC + hash (gate write)
- [ ] Backfill dados legados em `/insumo-movimentacoes` (100% reconhecido)
- [ ] ADR 0005 escrita + aprovada (CTO)
- [ ] Smoke test: audit entry criado, chain validada, sem erros

---

## Dependências

- `crypto` Node.js built-in (HMAC-SHA256)
- `firebase-admin` (serverTimestamp)
- `process.env.HCQ_SIGNATURE_HMAC_KEY` disponível
- Cloud Functions Node 22+ (já migrado 2026-04-24)

---

## Estimativa

- **Design:** 1 dia (ADR 0005 draft)
- **Implementação:** 3-4 dias (helper + Cloud Function + testes)
- **Backfill:** 1-2 dias (dados legados)
- **Review + Deploy:** 1 dia

**Total:** ~6-8 dias (semana 1-2)

---

## Risk Analysis

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Secret key leak | 🔴 crítica | Usar Firebase Secrets Manager, never log |
| Performance (chain validate em massa) | 🟠 média | Batch validate em scheduled function, incremental validation |
| Backfill incomplete | 🟠 média | Audit trail pré-ADR 0005 fica sem HMAC (aceitável, novo padrão daqui em diante) |

---

## Next: ADR 0005 Draft

CTO to review requirements + approve ADR scope before `/gsd-execute-phase`.

**Após approval:** `/gsd-execute-phase` inicia implementação.

---

**Tracking:** `.planning/STATE.md`
