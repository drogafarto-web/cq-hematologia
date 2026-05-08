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

**Fase:** Phase 0 / Plan 00-01 — **Em prod (2026-05-07)**. T1–T10 completos.
**Sign-off:** PHASE0-SIGN-OFF-MEMO.md (CTO + RT + DevOps, 2026-05-07 18:30 UTC).
**Próximo passo:** acompanhar Cloud Logs day-1 + planejar Plan 5 W0 (`turnos_supervisorCheckin`, ainda registrado em code mas não deployado — verificar 28aa191).

### Deployado em produção (Phase 0)

Functions live em `southamerica-east1` (verificado via `firebase functions:list --project hmatologia2`):

- `turnos_createTurno` (callable)
- `turnos_updateTurno` (callable)
- `turnos_softDeleteTurno` (callable)
- `turnos_backfill90Days` (callable)
- `onTurnoEventCreated` (Firestore v2 trigger — chainHash)

Rules + indexes deployed; React shell + hooks + componentes shippados; provision claims script executado.

### Em desenvolvimento pós-Phase-0 (não deployado)

- `turnos_supervisorCheckin` — callable registrado no code (commits dcc5cb7/3e785e1, Plan 5 W0) mas ainda **não está em `firebase functions:list`**. Aguarda deploy de Phase 5 W0.

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
