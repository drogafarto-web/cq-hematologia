# Módulo: CAPA Tracking

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/capa-tracking/`.
Não leia nem acesse outros módulos de `src/features/`.

## Dependências externas permitidas (só importar)

- `src/shared/services/firebase.ts` — todas as APIs Firebase do projeto
- `src/store/useAuthStore.ts` — em particular `useActiveLabId()` e `useUser()`
- `src/utils/logicalSignature.ts` — `generateLogicalSignature` / `verifySignature`

## Referências regulatórias

DICQ 4.14 | RDC 978/2025 (5.3) | ISO 15189:2022 | Phase 7 Audit Dry-Run

## Multi-tenant

Coleção raiz: `/labs/{labId}/naoConformidades/{ncId}`.
CAPAs são armazenados como subdocumento `capaPlano` dentro de cada `naoConformidade`.
Documentos também carregam `labId` redundante no payload (defense-in-depth
nas security rules).

Toda função de `capaService.ts` recebe `labId` como parâmetro posicional
obrigatório — não existe caminho de escrita sem tenant.

## Regras invioláveis

- **RN-06:** jamais invocar `deleteDoc`. Usar `softDelete*` do service.
- **Assinatura:** `LogicalSignature = { hash, operatorId, ts }` — imutável
  e auditável em todas as transições de status.
- **Status Workflow (locked):** aberto → em-andamento → evidencia-submetida → auditor-revisando → fechado
  - Transições validadas server-side em Cloud Function callable.
  - Cada transição gera entrada em `transitions[]` array (nunca mutado, só appended).
- **Padrão de hook:** seguir `useCAPAs.ts` — `useActiveLabId` como guard,
  `onSnapshot` com cleanup, mutations que lançam `Error` sem lab ativo.

## Módulos/Features dependentes (read-only)

- `auditoria-interna` — origina `achados` que mapeiam para `naoConformidades` + `capaPlano`
- `educacao-continuada` — registros de treinamento podem ser linked em `evidence`
- `equipamentos` — calibração pode referenciar equipamentos
- `controle-temperatura` — histórico de temperatura pode ser evidence

## Status atual

**Fase:** **PHASE 8 WAVE 1 (Development)** — 2026-05-06  
**Module:** CAPA Tracking Infrastructure (prerequisite para Wave 2)  
**Status:** 🟡 Implementação em progresso  
**Dependencies:** Phase 7 (Audit Dry-Run) com 12 CAPAs criados em `naoConformidades`  
**Next:** Cloud Function `updateCAPAStatus` + Firestore rules tightening

### Estrutura criada (Wave 1)

- `types/index.ts` — 7 tipos (CAPA, CAPAStatus, CAPATransition, CAPAEvidenceRef, LogicalSignature, DeadlineStatus)
- `services/capaService.ts` — CRUD thin + multi-tenant + soft-delete
- `hooks/useCAPAs.ts` — real-time subscription com deadline computation
- `hooks/useCAPADeadlineMonitor.ts` — polling 60s com meta-diff guard
- `components/CAPADashboard.tsx` — main UI (grid, sort, summary counts)
- `components/CAPAStatusBadge.tsx` — 5-state color-coded status
- `components/CAPADeadlineIndicator.tsx` — deadline visual com tabular-nums
- `components/CAPAEvidenceList.tsx` — modal de evidências
- `components/CAPAStatusTransitionModal.tsx` — form de transição

### Pendências (Phase 8 continuing)

1. **Cloud Function `updateCAPAStatus`** — callable para transições com LogicalSignature
2. **Firestore Rules** — deny direct writes, allow callable only
3. **App Router integration** — lazy-load `/capa-tracking` route
4. **Tests** (unit + integration + E2E)
5. **Production deployment** — sequence: rules → functions → hosting

### Convenções fixadas

- `readonly` em `id`, `labId`, `ncId`, `createdAt`, `createdBy`
- Input DTOs via `Omit<Entidade, 'id'|'labId'|'ncId'|'createdAt'|'createdBy'|'deletedAt'>`
- Mapping snapshot → entidade centralizado em `mapCAPAFromNC`
- LogicalSignature gerada server-side only (Phase 0b pattern)
- Status transitions são immutable history (`transitions[]` append-only)

---

## Dever de atualização do contexto raiz

Após cada milestone deste módulo (fase nova concluída, deploy estrutural), atualizar:

1. **A seção "Status atual" acima** (data + fase + próximo passo)
2. **A linha `capa-tracking` na tabela "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md)** — formato `{módulo} | {status 1 frase} | {data}`

Protocolo completo em [`.claude/CONTEXT_PROTOCOL.md`](../../../.claude/CONTEXT_PROTOCOL.md).
