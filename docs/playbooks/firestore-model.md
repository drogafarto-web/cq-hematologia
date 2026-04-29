# HC Quality — Firestore Model

Multi-tenant por `labId`. 99% dos paths sob `/labs/{labId}/...`. Helpers em [`firestore.rules`](../../firestore.rules):
- `isSuperAdmin()` — claim JWT + fallback Firestore
- `isActiveMemberOfLab(labId)` — checa member doc + `active == true`
- `getMemberRole(labId)` / `isAdminOrOwner(labId)`
- `hasModuleAccess('hematologia'|'imunologia'|'coagulacao'|'uroanalise')` — claim custom

## Root collections

| Path | Read | Write | Server-only? |
|---|---|---|---|
| `/users/{userId}` | self OR SuperAdmin (Onda 1 ✅) | self (safe fields) / SuperAdmin | Não |
| `/auditLogs/{logId}` | SuperAdmin | autenticado create | Imutável |
| `/accessRequests/{reqId}` | SuperAdmin / self-create | SuperAdmin | — |
| `/status/{docId}` | autenticado | SuperAdmin | — |
| `/pending_users/{labId}/users/{uid}` | admin/owner | self-create | — |
| `/firestore-backup-logs/{logId}` | SuperAdmin | CF apenas | ✅ |

## Subcoleções de lab (`/labs/{labId}/...`)

### Core
- `/members/{uid}` — role + active
- `/data/{dataPath}` — appState do lab

### Módulos CIQ

| Módulo | Lots | Runs | Gate |
|---|---|---|---|
| Hematologia (quantitativo) | `/lots/{lotId}` | `/lots/{lotId}/runs/{runId}` | `hasModuleAccess('hematologia')` |
| Imunologia (categórico R/NR) | `/ciq-imuno/{lotId}` | `/ciq-imuno/{lotId}/runs/{runId}` | `hasModuleAccess('imunologia')` |
| Coagulação | `/ciq-coagulacao/{lotId}` | `/ciq-coagulacao/{lotId}/runs/{runId}` | `hasModuleAccess('coagulacao')` |
| Uroanálise (híbrido) | `/ciq-uroanalise/{lotId}` | `/ciq-uroanalise/{lotId}/runs/{runId}` | `hasModuleAccess('uroanalise')` |

Cada módulo também tem `/*-meta/`, `/*-config/`, `/*-audit/` (imutável, create-only).

### Insumos + rastreabilidade

- `/produtos-insumos/{produtoId}` — catálogo (Fase C)
- `/insumos/{insumoId}` — lotes de controle/reagente/tira
- `/insumo-movimentacoes/{movId}` — **chain-hash tamper-evident** (cliente cria `pending`, CF sela `sealed`)
- `/insumo-transitions/{id}` — append-only, setups de equipamento
- `/equipamentos/{equipId}` — Fase D (ciclo ativo → manutenção → aposentado, retenção 5a)
- `/equipamentos-audit/{id}` — append-only
- `/fornecedores/{id}` — Fase E
- `/notas-fiscais/{id}` — Fase E

### Configuração + misc
- `/equipment-setups/{module}` — setup atual por módulo
- `/fr10-emissions/{hash}` — registro de exportação FR-10 (hash = docId)
- `/backup-logs/{YYYY-MM-DD}` — append-only via CF

### Novas (Onda 4 — server-only)

- `/ciq-audit/{eventId}` — audit chain tamper-evident
- `/_state/ciq-audit-chain` — último hash da cadeia (read-only via reader, write só via transaction do writer)

### Novas (Onda 2.5 — temp)
- `/temp/superadmin-grant/snapshots/{uid}` — snapshot reversível dos grants temporários

## Índices deployados (2026-04-22)

Ver [`firestore.indexes.json`](../../firestore.indexes.json). Destacar novos:

- `runs` (collection group) por `confirmedAt` ASC
- `runs` (collection group) por `createdAt` ASC
- `ciq-audit` por `timestamp` ASC
- `ciq-audit` por `severity + timestamp` ASC
- `ciq-audit` por `moduleId + timestamp` ASC

## Schemas principais (tipos frontend)

- [`src/features/insumos/types/Insumo.ts`](../../src/features/insumos/types/Insumo.ts) — `Insumo`, `InsumoMovimentacao`
- [`src/features/ciq-imuno/types/CIQImuno.ts`](../../src/features/ciq-imuno/types/CIQImuno.ts)
- [`src/types/index.ts`](../../src/types/index.ts) — umbrella
- Backend não tem schema próprio — collectors leem raw `DocumentData`

## Padrões críticos

1. **Chain hash é sagrado** — nunca delete movimentações, nunca "reset" o chain state.
2. **Audit é imutável** — rules denegam update/delete em `/auditLogs`, `/*-audit/`, `/ciq-audit`.
3. **Claims JWT são fonte de verdade** pra module access — Firestore `users/{uid}.modules` é mirror read-only pra UI.
4. **`activationsCount`, `runCount`, `lastRunAt`** em Insumo são denormalizações — atualizadas via batch em hooks, nunca editadas manualmente.
5. **Reagentes com `qcValidationRequired: true`** bloqueiam runs até passar por CQ aprovada (Fase B — soft warning hoje, hard gate futuro).
