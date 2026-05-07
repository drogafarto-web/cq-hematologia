# Módulo: Turnos

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/turnos/`.
Não leia nem acesse outros módulos de `src/features/`.

## Dependências externas permitidas (só importar)

- `src/features/educacao-continuada/hooks/useColaboradores.ts` — read-only supervisor list
- `src/shared/services/firebase.ts` — APIs Firebase do projeto
- `src/store/useAuthStore.ts` — em particular `useActiveLabId()` e `useUser()`

## Referências regulatórias

RDC 978/2025 Art. 122 | RDC 786/2023 | DICQ 4.1.2.7

## Multi-tenant

Coleção raiz: `labs/{labId}/turnos/`.
Documentos carregam `labId` redundante no payload (defense-in-depth nas security rules).
Subcoleção `events` em cada turno para audit trail (RN-TURNO-05).
Toda função de `turnosService.ts` recebe `labId` como parâmetro posicional obrigatório.

## Regras invioláveis

- **RN-TURNO-01:** turno único por (labId, data, periodo) entre não-deletados.
- **RN-TURNO-02:** supervisor ativo (ativo === true no momento da criação).
- **RN-TURNO-03:** certificatesActive[] é snapshot imutável da habilitação do supervisor.
- **RN-TURNO-04:** deleção lógica only (RN-06 global) — nunca invocar `deleteDoc`.
- **RN-TURNO-05:** chainHash contínuo no audit trail (trigger server-side).
- **DL-1 Locked:** Todas as escritas são Cloud Function callables (não client-side). Rules declaram `allow create, update, delete: if false` para turnos e events.

## Arquitetura

- **Service layer:** `turnosService.ts` read-only (subscribeTurnos, getTurno, getTurnoAuditTrail). Callables via `turnosCallables.ts` lazy-loaded `httpsCallable`.
- **Hooks:** `useTurnos.ts` mirrors `useColaboradores.ts` (subscribe + mutations via callables + error handling). `useCoberturaTurnos.ts` derives 90-day heatmap.
- **Components:** `TurnoForm` (create/edit), `TurnosList` (sortable table), `CoberturaReport` (heatmap + inline confirmation), `TurnosView` (entry point).
- **Functions:** 5 callables + 1 trigger em `functions/src/modules/turnos/`. Server-side signature generation, atomic batches, chainHash computation.

## Status atual

**Fase:** Phase 0 / Plan 00-01 — **em desenvolvimento** (T1-T4 completo, T5-T10 pendentes).
**Deadlin**: Dia 1.5 da fase (execução contínua até D1.5).
**Próximo passo:** T5 (rules + indexes), T6 (hooks + UI), T7 (shell wiring), T8 (este CLAUDE.md + root update), T9 (pre-deploy), T10 (deploy + logs).

### Entregue em T1-T4

- types/Turno.ts — Turno, TurnoInput, Periodo, TurnoAuditEvent
- services/turnosService.ts — read-only subscibe + get
- services/turnosCallables.ts — lazy callable wrappers
- functions/src/modules/turnos/validators.ts — Zod schemas, assertTurnosAccess
- functions/src/modules/turnos/signatureCanonical.ts — SHA-256 server-side
- functions/src/modules/turnos/createTurno.ts — turnos_createTurno callable
- functions/src/modules/turnos/updateTurno.ts — turnos_updateTurno callable
- functions/src/modules/turnos/softDeleteTurno.ts — turnos_softDeleteTurno callable
- functions/src/modules/turnos/backfill90Days.ts — turnos_backfill90Days callable
- functions/src/modules/turnos/onTurnoEventCreated.ts — Firestore v2 trigger for chainHash

### Pendências restantes

- T5: Firestore rules block (`/labs/{labId}/turnos/` + events subcollection), 2 composite indexes, rules emulator test
- T6: Hooks + components (useTurnos, useCoberturaTurnos, TurnoForm, TurnosList, CoberturaReport, TurnosView)
- T7: Shell wiring (AppRouter lazy route, View union, Hub tile, manualChunks)
- T8: Root CLAUDE.md update
- T9: Pre-deploy (claim provisioning, dry-run backfill)
- T10: Deploy (rules → functions → hosting) + Cloud Logs monitor 24h

## Convenções fixadas

- `readonly` em `id`, `labId`, `criadoEm` das entidades
- Input DTO via `Omit<Turno, 'id'|'labId'|'criadoEm'|'deletadoEm'|'logicalSignature'|'inferred'>`
- Assinatura gerada server-side (callables), nunca client-side (DL-1)
- Soft-delete via flag `deletadoEm` (nunca hard-delete)
- Audit subcoleção append-only (chainHash continuity)
- Certificados snapshot imutável após criação (RN-TURNO-03)

## Dever de atualização

Após milestone deste módulo (T10 deploy), atualizar:

1. A linha `turnos` na tabela "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md) — formato `turnos | Em prod · Supervisor shift registry (RDC 978 Art. 122) | YYYY-MM-DD`
