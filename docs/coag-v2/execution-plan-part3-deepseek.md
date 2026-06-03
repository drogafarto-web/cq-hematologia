# Parte 3 — Estratégia Específica para DeepSeek V4 Flash

---

## 3.1 Análise do Modelo

### Especificações Conhecidas

| Aspecto         | DeepSeek V4 Flash                                                     |
| --------------- | --------------------------------------------------------------------- |
| Contexto        | 64K tokens (suficiente para prompts de ~2K linhas de código)          |
| Velocidade      | Rápido — ideal para tarefas isoladas                                  |
| Thinking mode   | Suporta (enabled/disabled) — desabilitar para execução determinística |
| Tool calls      | Suporta — útil para testes                                            |
| JSON mode       | Suporta — útil para outputs estruturados                              |
| Context caching | Suporta — economiza tokens em prompts repetidos                       |
| Custo           | Gratuito (tier free)                                                  |
| Formato API     | OpenAI/Anthropic compatível                                           |

### Limitações Reais (observadas em produção)

| Limitação                          | Impacto                                                   | Mitigação                                                     |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| **Consistência em tarefas longas** | Pode perder contexto após ~4-5k tokens de código complexo | Prompts curtos, tarefas isoladas, máximo 1 arquivo por prompt |
| **Aderência a contratos**          | Tende a "melhorar" contratos se achar que pode            | Proibição explícita + auditoria automática                    |
| **Overengineering**                | Adiciona abstrações, generics, wrappers não solicitados   | Anti-patterns proibidos + métricas de complexidade            |
| **Reescritas acidentais**          | Pode reformular código existente "pra ficar mais limpo"   | Lista explícita de arquivos proibidos                         |
| **Imports alucinados**             | Pode importar de paths que não existem                    | Auditoria automática de imports                               |
| **Estados extras**                 | Cria estados locais desnecessários "por conveniência"     | Limite de estados por componente (máximo 2)                   |
| **Hooks gigantes**                 | Combina múltiplas responsabilidades em 1 hook             | Limite de 200 linhas por hook                                 |
| **Documentação excessiva**         | JSDoc em cada função, comentário em cada linha            | Proibição de comentários (a menos que solicitado)             |

---

## 3.2 Regras de Prompt

### Tamanho Ideal

| Tipo de task           | Tamanho máximo do prompt | Output esperado        |
| ---------------------- | ------------------------ | ---------------------- |
| Criar entidade (types) | 800 tokens               | 1 arquivo < 150 linhas |
| Criar service (CRUD)   | 1000 tokens              | 1 arquivo < 200 linhas |
| Criar hook             | 1000 tokens              | 1 arquivo < 200 linhas |
| Criar componente UI    | 1200 tokens              | 1 arquivo < 300 linhas |
| Criar teste            | 800 tokens               | 1 arquivo < 200 linhas |
| Refatoração cirúrgica  | 600 tokens               | Delta cirúrgico        |

### Contexto Máximo Seguro

**Regra:** o prompt + contexto fornecido ao modelo nunca deve exceder 8K tokens total.

**O que incluir:**

1. Contrato congelado (types) — sempre
2. Interface dos serviços que o código vai consumir — sempre
3. Exemplo de código similar já existente (padrão) — quando relevante
4. Wireframe textual (para UI) — para componentes

**O que NÃO incluir:**

- ❌ Documentação do framework (React, Firebase, Zod) — modelo já sabe
- ❌ Todo o codebase — apenas os arquivos diretamente relevantes
- ❌ Filosofia/rationale — apenas o contrato e o quê fazer
- ❌ Múltiplos exemplos de padrões diferentes — usar 1 consistente

---

## 3.3 Granularidade Ideal

### Regra: 1 prompt = 1 arquivo

**Nunca:** "Crie o service e o hook e o componente"
**Sempre:**

- Prompt 1: "Crie `controlOperacionalService.ts`"
- Prompt 2: "Crie `useControlOperacional.ts`"
- Prompt 3: "Crie `ControlOperacionalForm.tsx`"

### Exceção (agrupamento permitido):

- types + interfaces → 1 prompt (são naturalmente acoplados)
- service + types de retorno → 1 prompt (retorno é parte do service)
- componente + styles internos (se < 50 linhas de CSS) → 1 prompt

### Tamanho por arquivo:

| Tipo             | Máximo de linhas | Se exceder                         |
| ---------------- | ---------------- | ---------------------------------- |
| Types/Interfaces | 100              | Dividir em múltiplos arquivos      |
| Service          | 200              | Extrair operações em sub-modules   |
| Hook             | 200              | Extrair helpers em funções puras   |
| Component        | 300              | Extrair sub-componentes internos   |
| Teste            | 200              | Dividir por describe() blocks      |
| Utility          | 100              | Se > 100, provavelmente faz demais |

---

## 3.4 Como Evitar Deriva Arquitetural

### Prevenção

1. **Contrato congelado é lei.** O prompt sempre começa com:

   ```
   CONTRATO: [colar o types/interfaces do contrato]
   Você DEVE implementar EXATAMENTE este contrato.
   NÃO adicione campos. NÃO remova campos. NÃO altere tipos.
   ```

2. **Arquivos proibidos explícitos.** Toda prompt termina com:

   ```
   ARQUIVOS PROIBIDOS (não toque):
   - [lista explícita de paths]
   ```

3. **Anti-patterns no prompt.** Toda prompt inclui:

   ```
   PROIBIDO:
   - Criar nova entidade/evento/campo
   - Adicionar comentário (a menos que solicitado)
   - Refatorar código existente (a menos que no escopo)
   - Importar de paths fora dos arquivos permitidos
   - Criar abstração não especificada (wrapper, factory, adapter)
   ```

4. **Auditoria automática pós-execução.** Todo output passa por auditor antes da integração.

### Detecção (pós-facto)

- Auditor conta campos em types vs contrato
- Auditor verifica imports
- Auditor mede cyclomatic complexity
- Auditor verifica nomes (não deve aparecer "Run", "Lot" em UI)

---

## 3.5 Como Evitar Abstração Excessiva

### Sintomas que DeepSeek Flash produz:

```typescript
// ❌ Modelo cria assim:
export function createControlOperacionalFactory(labId: string) {
  return class ControlOperacionalServiceAdapter {
    private readonly repository: IControlOperacionalRepository;
    constructor(repo: IControlOperacionalRepository) {
      this.repository = repo;
    }
    async persist(dto: ControlOperacionalDTO): Promise<ControlOperacionalEntity> {
      const mapped = this.mapper.toEntity(dto);
      return this.repository.save(mapped);
    }
  };
}
```

```typescript
// ✅ Modelo deveria criar assim:
export async function createControlOperacional(
  labId: string,
  data: Omit<ControlOperacional, 'id' | 'labId' | 'criadoEm' | 'atualizadoEm'>,
): Promise<ControlOperacional> {
  const ref = await addDoc(collection(db, 'labs', labId, 'control-operacional'), {
    labId,
    ...data,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return { id: ref.id, labId, ...data };
}
```

### Como prevenir no prompt:

```
PADRÃO OBRIGATÓRIO:
- Funções exportadas nomeadas (não classes, não factory functions)
- Firestore direto no service (não repository pattern)
- TypeScript simples (sem generics desnecessários, sem interfaces redundantes)
- Máximo 1 nível de indireção por função

PROIBIDO:
- Factory functions
- Repository pattern (Firestore direto no service)
- Interfaces que duplicam types (ICoisa vs Coisa)
- Adapters, decorators, wrappers não solicitados
- Classes (usar funções puras)
```

---

## 3.6 Como Evitar Reescritas Acidentais

### Sintoma:

Modelo reescreve um arquivo existente para "melhorar" mesmo quando a tarefa era adicionar 1 função.

### Prevenção:

No prompt, ser explicit sobre escopo:

```
ESCOPO:
- Adicionar função `calculateWestgard()` ao arquivo `useCoagWestgard.ts`
- NÃO modificar nenhuma outra função existente no arquivo
- NÃO reordenar imports
- NÃO alterar formatação
- Adicionar APENAS a função especificada e sua exportação

Se precisar modificar outra coisa no arquivo, PARE e reporte BLOCKER.
```

---

## 3.7 Como Evitar Criação de Estados Extras

### Sintoma:

```typescript
// Modelo adiciona estados "por conveniência":
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const [retryCount, setRetryCount] = useState(0);
const [lastAttemptedAt, setLastAttemptedAt] = useState<Date | null>(null);
```

### Regra:

- **Máximo 2 estados por hook** (1 para loading, 1 para error OU 1 para dado)
- **Máximo 1 estado por componente** (a menos que wireframe especifique mais)
- Se precisar de mais, extrair em hook separado ou usar reducer

### Prevenção no prompt:

```
ESTADOS:
- Máximo 2 states (useState) por hook
- Máximo 2 states por componente
- Use useMemo para valores derivados (não state)
- Use useCallback para funções (não state)
- NENHUM estado extra "por conveniência" ou "pra otimização"
```

---

## 3.8 Como Evitar Hooks Gigantes

### Sintoma:

Modelo coloca tudo em 1 hook de 500 linhas.

### Regra:

- **Hook ≤ 200 linhas** (absoluto — auditor rejeita acima disso)
- Se passar de 150 linhas, já considerar dividir

### Como dividir:

```
hooks/
├── useControlOperacional.ts        ← hook público (interface)
├── useControlOperacionalList.ts    ← listagem (sub-hook)
├── useControlOperacionalSave.ts    ← save (sub-hook)
└── internal/
    ├── buildPayload.ts             ← função pura (não hook)
    └── validateInput.ts            ← função pura (não hook)
```

### Prevenção no prompt:

```
TAMANHO:
- Hook máximo: 200 linhas
- Se o hook precisa fazer muito, divida em sub-hooks
- Funções puras NÃO são hooks — não precisam seguir useState/useEffect
- Extraia para /internal/ toda lógica que não precisa de React
```

---

## 3.9 Como Dividir Arquivos

### Regra por tipo:

```
src/features/coagulacao-v2/
├── types/
│   ├── ControlOperacional.ts          ← types de 1 entidade
│   ├── Attempt.ts                     ← types de 1 entidade
│   └── RTAction.ts                    ← types de 1 entidade
├── services/
│   ├── controlOperacionalService.ts   ← CRUD de 1 entidade
│   ├── attemptService.ts              ← CRUD + orquestração de 1 entidade
│   └── rtActionService.ts             ← CRUD de 1 entidade
├── hooks/
│   ├── useControlOperacional.ts       ← hook público
│   ├── useAttempts.ts                 ← hook público
│   ├── useRTAction.ts                 ← hook público
│   ├── useAttemptSave.ts              ← sub-hook (orquestração)
│   └── internal/
│       ├── buildAttemptPayload.ts     ← função pura
│       └── evaluateWestgard.ts        ← wrapper do computeCoagWestgard legado
└── components/
    ├── ControlOperacionalForm.tsx     ← form RT (criação)
    ├── AttemptForm.tsx                ← form operador (simples)
    ├── AttemptList.tsx                ← timeline de tentativas
    ├── RTPanel.tsx                    ← painel técnico do RT
    └── internal/
        ├── ResultInput.tsx            ← sub-componente (input de resultado)
        └── ConformityBadge.tsx        ← badge ✓/✕
```

### Quando criar arquivo novo:

- **Sim:** quando extrair lógica > 50 linhas de um arquivo existente
- **Sim:** quando criar sub-componente reutilizável (≥ 2 usos)
- **Não:** quando "preemptivamente organizar" código que funciona
- **Não:** quando criar "utils genéricos" que só 1 arquivo usa

---

## 3.10 Como Estruturar Commits

### Regra: 1 commit = 1 arquivo (ou grupo coeso)

**Nunca:**

- "feat: implement wave B" (commit gigante)
- "refactor" (vago demais)

**Sempre:**

```
feat(coag-v2): add ControlOperacional types
feat(coag-v2): add controlOperacionalService CRUD
feat(coag-v2): add useControlOperacional hook
fix(coag-v2): correct timestamp type in ControlOperacional
test(coag-v2): add controlOperacionalService unit tests
```

### Commit por wave:

| Wave                   | Commits esperados                                                          |
| ---------------------- | -------------------------------------------------------------------------- |
| A (ControlOperacional) | ~5 (types, service, hook, teste, wire)                                     |
| B (Attempt)            | ~8 (types, service, save-hook, snapshot, westgard, signature, teste, wire) |
| C (RTAction)           | ~5 (types, service, hook, teste, wire)                                     |
| D (UI Operador)        | ~6 (AttemptForm, ResultInput, ConformityBadge, view, teste, wire)          |
| E (UI RT)              | ~5 (RTPanel, AttemptList, ActionModal, view-test, wire)                    |
| F (Auditoria)          | ~3 (integration-test, firestore rules, audit-check)                        |
| G (Deploy)             | ~2 (smoke E2E, deploy config)                                              |

**Total: ~34 commits** distribuídos em 7 ondas.

---

## 3.11 Como Estruturar TODOs

### Regra: TODOs são temporários e específicos

**Nunca:**

```typescript
// TODO: implementar lógica de Westgard
```

**Sempre:**

```typescript
// TODO(wave-B): integrar computeCoagWestgard do legado após wave B aprovar
// See: docs/coag-v2/contracts/attempt.md campo violacoes
```

### Convenção:

```typescript
// TODO(wave-[X]): [descrição específica]
// See: [path do documento relevante]
// Owner: [arquiteto|executor|integrador]
```

### Limite:

- Máximo 3 TODOs por arquivo (se mais, provavelmente escopo errado)
- TODOs devem ser resolvidos na onda seguinte que os referencia
- Se um TODO sobrevive 2 ondas, arquiteto deve decidir se: (a) remover, (b) criar wave específica, (c) aceitar como tech debt documentada

---

## 3.12 Estratégia de Retomada de Contexto

### Problema:

DeepSeek Flash não tem memória entre sessões. Se a sessão cair midway, o próximo agente precisa retomar.

### Solução:

**Arquivo `context.yaml` por wave:**

```yaml
wave: A
status: em-progress
current_task: 3/5
completed_tasks:
  - task: 'Criar types de ControlOperacional'
    file: 'src/features/coagulacao-v2/types/ControlOperacional.ts'
    commit: 'abc1234'
    auditor_status: approved
  - task: 'Criar controlOperacionalService'
    file: 'src/features/coagulacao-v2/services/controlOperacionalService.ts'
    commit: 'def5678'
    auditor_status: approved
pending_tasks:
  - task: 'Criar useControlOperacional hook'
    prompt: 'docs/coag-v2/waves/wave-a-control-operacional.md#task-3'
  - task: 'Criar testes unitários'
    prompt: 'docs/coag-v2/waves/wave-a-control-operacional.md#task-4'
blockers: []
```

**Próximo agente:**

1. Lê `context.yaml` da wave
2. Verifica commits concluídos
3. Pega a próxima task pendente
4. Executa com o prompt referenciado
5. Atualiza `context.yaml`

### Checkpoints:

- **Início de cada task:** atualizar `current_task` e `status: in-progress`
- **Fim de cada task:** adicionar commit hash + auditor status
- **Bloqueio:** adicionar descrição em `blockers[]` e pausar
