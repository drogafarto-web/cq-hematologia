---
description: Padrões obrigatórios para Firestore rules, services multi-tenant e Cloud Functions callables. Carrega quando tocar rules, service files ou functions.
paths:
  - "firestore.rules"
  - "firestore.indexes.json"
  - "src/**/*Service.ts"
  - "src/features/**/services/**"
  - "functions/src/**"
---

# Regra: Segurança Firestore + Multi-tenant

## Invariants de rules

- **Sem `allow write: if true`**. Escrita sempre restrita por `isActiveMemberOfLab(labId)` + validação de payload.
- **`validSignature(d)`** obrigatório em create de coleções regulatórias:
  ```
  d.assinatura is map
  && d.assinatura.hash is string
  && d.assinatura.hash.size() == 64
  && d.assinatura.operatorId == request.auth.uid
  && d.assinatura.ts is timestamp
  ```
- **`labIdMatches(d)`** — `d.labId == labId` do path, impede cross-tenant write
- **`keepsLabId()` + `keepsCreatedAt()`** em update — impede reescrita de metadados
- **`allow delete: if false`** em coleções regulatórias — hard delete nunca

## Migração client → callable (Fase 0b pattern)

Coleções regulatórias (FR-001, FR-013, etc) devem ter `allow create: if false` após Fase 0c. Todo write passa por Cloud Function callable que:

1. Valida claims (`isActiveMemberOfLab`)
2. Valida payload no servidor (duplicação de regras client-side)
3. Gera assinatura server-side via Admin SDK
4. Escreve com `firestore.Timestamp.now()`
5. Grava log em `auditLogs/{labId}/`

Service client-side dessas coleções fica só com `subscribe*` e `soft*`. Deprecated `create*` mantido como rollback por 1 sprint antes de remover.

## Padrão de service multi-tenant

```typescript
// Sempre: labId como parâmetro posicional obrigatório
export async function createEntity(labId: LabId, input: EntityInput): Promise<string> {
  await ensureLabRoot(labId);           // setDoc idempotente no doc raiz
  const ref = doc(entityCol(labId));
  await setDoc(ref, {
    labId,                              // redundância no payload
    ...entityPayload(input),
    criadoEm: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

// subscribe com filtro client-side de deletadoEm (padrão até ~5k docs por tenant)
export function subscribeEntities(
  labId: LabId,
  options: SubscribeOptions,
  callback: (list: Entity[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe { ... }
```

## Índices compostos

- Sempre que a query usar `where + orderBy` em campos distintos, declarar em `firestore.indexes.json`.
- Filtro composto `(ativo + nome)` ou `(status + dataPlanejada)` precisa de índice.
- Para filtro de `deletadoEm`, preferir client-side enquanto volume por tenant estiver abaixo de ~5k. Migrar para `deletadoEm == null` server-side quando passar.

## Checklist antes de deploy de rules

1. `firebase emulators:exec --only firestore "npm test"` verde
2. Rule test específico da coleção nova passa
3. Deploy ordem: `provisionModulesClaims` (com novo claim se aplicável) → grant aos users ativos → `firestore:rules,firestore:indexes` → `hosting`
4. Never deploy rules sozinho em coleção que ainda não tem claim provisionado — fail-safe intencional torna módulo inacessível
