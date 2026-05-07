# Módulo: Lab-Apoio

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/lab-apoio/`.
Não leia nem acesse outros módulos de `src/features/`.

## Dependências externas permitidas (só importar)

- `src/features/educacao-continuada/hooks/useColaboradores.ts` — read-only colaboradores list (for avaliacao responsavel combobox)
- `src/shared/services/firebase.ts` — APIs Firebase do projeto
- `src/store/useAuthStore.ts` — em particular `useActiveLabId()` e `useUser()`

## Referências regulatórias

RDC 978/2025 Arts. 36–39 | DICQ 4.14.8 (Terceirização de Ensaios)

## Multi-tenant

Coleção raiz: `labs/{labId}/lab-apoio/`.
Documentos carregam `labId` redundante no payload (defense-in-depth nas security rules).
Subcoleção `events` em cada contrato para audit trail (RN-LABAPOIO-06).
Toda função de `labApoioService.ts` recebe `labId` como parâmetro posicional obrigatório.

## Regras invioláveis

- **RN-LABAPOIO-01:** (labId, cnpj) único entre não-deletados.
- **RN-LABAPOIO-02:** vigenciaInicio < vigenciaFim (validado na criação).
- **RN-LABAPOIO-03:** habilitacaoAnvisa não-vazio (min 6 chars).
- **RN-LABAPOIO-04:** deleção lógica only (RN-06 global) — nunca invocar `deleteDoc`.
- **RN-LABAPOIO-05:** assinatura server-side na criação + toda mutação.
- **RN-LABAPOIO-06:** chainHash contínuo no audit trail (trigger server-side).
- **RN-LABAPOIO-07:** avaliacaoPeriodica append-only history-preserving (nunca sobrescreve).
- **DL-1 Locked:** Todas as escritas são Cloud Function callables (não client-side). Rules declaram `allow create, update, delete: if false` para contratos e events.

## Arquitetura

- **Service layer:** `labApoioService.ts` read-only (subscribeContratos, getContrato, getContratoAuditTrail). Callables via `labApoioCallables.ts` lazy-loaded `httpsCallable`.
- **Hooks:** `useLabApoio.ts` mirrors `useColaboradores.ts` (subscribe + mutations via callables + error handling). `useExpiryAlerts.ts` derives 7d/30d/60d/expired bins.
- **Components:** `LabApoioView` (entry point), `LabApoioList` (dark table), `LabApoioForm` (4-step wizard with P0-R1 disclaimer), `LabApoioAvaliacao` (annual eval), `VencimentosWidget` (expiry countdown badges).
- **Functions:** 6 callables + 1 trigger em `functions/src/modules/labApoio/`. Server-side signature generation, atomic batches, chainHash computation.

## Status atual

**Fase:** Phase 0 / Plan 00-03 — **em desenvolvimento** (T1-T7 completo, T8-T10 pendentes).
**Deadline**: Dia 2.5 da fase (execução contínua até D2.5).
**Próximo passo:** T8 (CLAUDE.md + root update), T9 (pre-deploy + provision claims), T10 (deploy + Cloud Logs 24h).

### Entregue em T1-T7

- types/LabApoio.ts — Contrato, ContratoInput, ExameItem, Certificacao, AvaliacaoPeriodica, LabApoioFilters
- types/shared_refs.ts — LabId, UserId type brands
- services/labApoioService.ts — read-only subscribe + get + audit trail
- services/labApoioStorageService.ts — [pending T6 integration]
- functions/src/modules/labApoio/validators.ts — Zod schemas, CNPJ+AVS validators, assertLabApoioAccess
- functions/src/modules/labApoio/signatureCanonical.ts — SHA-256 server-side
- functions/src/modules/labApoio/{createContrato,updateContrato,softDeleteContrato,registrarAvaliacaoPeriodica,uploadContratoAnexo}.ts — 5 callables
- functions/src/modules/labApoio/checkExpiry.ts — scheduled cron daily 06:00 BRT
- functions/src/modules/labApoio/onContratoEventCreated.ts — Firestore v2 trigger for chainHash
- hooks/useLabApoio.ts — primary hook with mutations
- hooks/useExpiryAlerts.ts — derives expiring bins
- components/LabApoioView.tsx, LabApoioList.tsx, LabApoioForm.tsx, LabApoioAvaliacao.tsx, VencimentosWidget.tsx
- firestore.rules — lab-apoio block with DL-1 enforcement
- storage.rules — PDF upload block (<10MB, PDF-only, admin/owner write)
- firestore.indexes.json — 2 composite indexes (ativo+vigenciaFim, +criticidade)

### Pendências restantes

- T8: Este CLAUDE.md + root CLAUDE.md update + Obsidian checkbox 4.14.8
- T9: Pre-deploy (provision claims labApoio, dry-run backfill)
- T10: Deploy (rules → functions → hosting) + Cloud Logs monitor 24h

## Convenções fixadas

- `readonly` em `id`, `labId`, `criadoEm` das entidades
- Input DTO via `Omit<Contrato, 'id'|'labId'|'criadoEm'|'deletadoEm'|'logicalSignature'|'proximaAvaliacaoEm'|'avaliacaoPeriodica'>`
- Assinatura gerada server-side (callables), nunca client-side (DL-1)
- Soft-delete via flag `deletadoEm` (nunca hard-delete)
- Audit subcoleção append-only (chainHash continuity)
- Exames append-only append-only history (no override)

## Dever de atualização

Após milestone deste módulo (T10 deploy), atualizar:

1. A linha `lab-apoio` na tabela "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md) — formato `lab-apoio | Em prod · Suporte para terceirização de exames (RDC 978 Arts. 36–39) | YYYY-MM-DD`
2. O checkbox 4.14.8 (Terceirização de Ensaios) em [Obsidian HC_Quality_Checklist_Auditoria.md](../../../../C:/Users/labcl/Obsidian_Brain/01_Projetos/HC_Quality_Checklist_Auditoria.md) como completo `[x]`.
