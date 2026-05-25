# Wave A — ControlOperacional

## Objetivo Fechado

Implementar a entidade `ControlOperacional` completa: types + service + hook. RT consegue criar e gerenciar controles operacionais.

## Contrato de Entrada

- `coag-v2-master.md` §2.1 (entidade)
- `contracts/control-operacional.md` (contrato congelado)
- `coag-legacy-analysis.md` §1.4 (EquipmentSetup preservado)

## Definição de Pronto

- [ ] `types/ControlOperacional.ts` — entidade + input type exportados
- [ ] `services/controlOperacionalService.ts` — CRUD completo (create, get, list, update, delete soft)
- [ ] `hooks/useControlOperacional.ts` — assinatura em tempo real
- [ ] `controlOperacionalService.test.ts` — 5 testes passando
- [ ] Firestore rules adicionadas ao `firestore.rules`
- [ ] TypeScript compila sem erros
- [ ] Auditoria arquitetural passa

## Critérios de Rejeição (bloqueia merge)

- [ ] Campo não especificado no contrato adicionado
- [ ] Interface extra criada (IControlOperacional, ControlOperacionalDTO)
- [ ] Factory/Repository/Adapter pattern detectado
- [ ] Service > 200 linhas
- [ ] Hook > 200 linhas
- [ ] Types > 100 linhas
- [ ] `any` type detectado
- [ ] Console.log/debugger em código de produção

## Checklist Automático

```bash
./scripts/audit-coag-v2.sh wave-a
npx vitest run src/features/coagulacao-v2/
npx tsc --noEmit
```

## Testes Obrigatórios

1. `createControlOperacional` — happy path (cria com sucesso)
2. `createControlOperacional` — error path (validadeControle no passado)
3. `listControlOperacionals` — filtra por status
4. `updateControlOperacional` — muda mean/sd
5. `deleteControlOperacional` — muda status para 'aposentado' (soft delete)

## Rollback

```bash
git revert [commits-da-wave-a]
# Não afeta dados em produção (coleção nova)
```

## Arquivos Permitidos

- `src/features/coagulacao-v2/types/ControlOperacional.ts` (CRIAR)
- `src/features/coagulacao-v2/types/index.ts` (CRIAR)
- `src/features/coagulacao-v2/services/controlOperacionalService.ts` (CRIAR)
- `src/features/coagulacao-v2/services/controlOperacionalService.test.ts` (CRIAR)
- `src/features/coagulacao-v2/hooks/useControlOperacional.ts` (CRIAR)
- `firestore.rules` (MODIFICAR — adicionar match)

## Arquivos Proibidos

- Qualquer arquivo de `src/features/coagulacao/` (legado)
- Qualquer arquivo de `src/features/hematologia/`
- Qualquer arquivo de `src/features/uroanalise/`
- Qualquer arquivo de `src/features/imunologia/`
- Qualquer arquivo de `src/features/insumos/` (apenas importar types)
- `AGENTS.md`, `CLAUDE.md`, `CORRECTIONS.md`

## Tasks

### Task 1 — Types (5 min)

**Prompt:**

```
# TASK: Criar types de ControlOperacional

## CONTRATO (LEI)
[codar contrato de contracts/control-operacional.md]

## O QUE FAZER
1. Criar arquivo `src/features/coagulacao-v2/types/ControlOperacional.ts`
2. Exportar EXATAMENTE as interfaces do contrato
3. Criar `src/features/coagulacao-v2/types/index.ts` re-exportando

## ARQUIVOS PERMITIDOS
- src/features/coagulacao-v2/types/ControlOperacional.ts
- src/features/coagulacao-v2/types/index.ts

## DOD
- [ ] Interfaces exportadas
- [ ] TypeScript compila
- [ ] Zero comentários (exceto regulatórios)
```

### Task 2 — Service (15 min)

**Prompt:** usar template "Criar Service de CRUD" (`execution-plan-part5-prompts.md` §5.3)

### Task 3 — Hook (10 min)

**Prompt:** usar template "Criar Hook" (§5.4)

### Task 4 — Testes (15 min)

**Prompt:** usar template "Criar Teste Unitário" (§5.7)

### Task 5 — Firestore Rules (5 min)

**Prompt:** adicionar match block no firestore.rules
