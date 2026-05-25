# Wave B — Attempt

## Objetivo Fechado

Implementar a entidade `Attempt` completa: types + service + save-hook orquestrado (Westgard + snapshot + assinatura). Operador consegue salvar tentativa.

## Contrato de Entrada

- Wave A aprovada ✅
- `contracts/attempt.md` (contrato congelado)
- `coag-legacy-analysis.md` §2.2 (`computeCoagWestgard` preservado)

## Definição de Pronto

- [ ] `types/Attempt.ts` — entidade + input type
- [ ] `services/attemptService.ts` — saveAttempt + get + list (SEM update/delete)
- [ ] `hooks/useAttempts.ts` — assinatura em tempo real
- [ ] `hooks/useAttemptSave.ts` — orquestração completa (≤ 4 etapas visíveis)
- [ ] `internal/buildSignaturePayload.ts` — função pura
- [ ] `attemptService.test.ts` + `useAttemptSave.test.ts` — 8 testes passando
- [ ] Firestore rules adicionadas
- [ ] TypeScript compila
- [ ] Auditoria passa

## Critérios de Rejeição

- [ ] `updateAttempt()` ou `deleteAttempt()` adicionados — tentativas imutáveis
- [ ] Campo `notivisaTipo/Status` adicionado — vai em RTAction (wave C)
- [ ] Campo `isi/mnpt` adicionado — simplificado
- [ ] Fluxo de save > 4 etapas visíveis
- [ ] Tentativa sem `logicalSignature`
- [ ] Tentativa sem `snapshot`
- [ ] Snapshot editável após save

## Rollback

```bash
git revert [commits-wave-b]
# Dados persistidos em /attempts podem ficar órfãos. OK — auditoria só.
```

## Arquivos Permitidos

- `src/features/coagulacao-v2/types/Attempt.ts` (CRIAR)
- `src/features/coagulacao-v2/services/attemptService.ts` (CRIAR)
- `src/features/coagulacao-v2/services/attemptService.test.ts` (CRIAR)
- `src/features/coagulacao-v2/hooks/useAttempts.ts` (CRIAR)
- `src/features/coagulacao-v2/hooks/useAttemptSave.ts` (CRIAR)
- `src/features/coagulacao-v2/hooks/useAttemptSave.test.ts` (CRIAR)
- `src/features/coagulacao-v2/hooks/internal/buildSignaturePayload.ts` (CRIAR)
- `firestore.rules` (MODIFICAR)

## Arquivos Proibidos

- Tudo em `src/features/coagulacao/` EXCEPTO:
  - `import { computeCoagWestgard } from '../../coagulacao/hooks/useCoagWestgard'`
  - `import { useCoagSignature } from '../../coagulacao/hooks/useCoagSignature'`
  - `import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs'`
- Qualquer outro módulo (hematologia, uroanálise, imuno)

## Tasks

### Task 1 — Types (8 min)

Template §5.2 com contrato de Attempt.

### Task 2 — buildSignaturePayload (5 min)

Função pura. Input: (operatorDoc, controlOperacionalId, resultados, dataRealizacao). Output: string canonical para SHA-256.

### Task 3 — attemptService (15 min)

Apenas `saveAttempt`, `getAttempt`, `listAttempts`. SEM update/delete.

### Task 4 — useAttempts hook (8 min)

Simple subscription. Filtro opcional por `controlOperacionalId`.

### Task 5 — useAttemptSave hook (25 min)

**Prompt:** usar template §5.6 (Orquestração de Save). Este é o mais complexo da wave.

### Task 6 — Testes unitários (20 min)

- saveAttempt happy path
- saveAttempt com violação (conformidade 'R')
- saveAttempt sem acaoCorretiva quando 'R' (error)
- LogicalSignature é SHA-256 válido
- Snapshot contém os 3 insumos + equipamento
- computeCoagWestgard é chamado com histórico + tentativa simulada

### Task 7 — Firestore rules (5 min)

Add match block. Imutável após create.
