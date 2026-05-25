# Parte 5 — Templates de Prompts para Agentes Baratos

---

## 5.1 Estrutura Universal do Prompt

Todo prompt para DeepSeek Flash segue esta estrutura:

```markdown
# TASK: [Nome curto]

## CONTRATO (LEI — não modificar)
[Colar types/interfaces congeladas do contrato]

## CONTEXTO
[Colar apenas o que o agente precisa saber]

## O QUE FAZER
[Instruções específicas, imperativas]

## O QUE NÃO FAZER
[Lista de proibições explícitas]

## ARQUIVOS PERMITIDOS
- path/to/file1.ts
- path/to/file2.ts

## ARQUIVOS PROIBIDOS
- path/to/file3.ts
- [lista de tudo o resto]

## OUTPUT ESPERADO
[Descrição do que deve ser entregue]

## DEFINITION OF DONE
- [ ] Item 1
- [ ] Item 2
```

---

## 5.2 Template: Criar Types de Entidade

```markdown
# TASK: Criar types de [NomeEntidade]

## CONTRATO (LEI — não modificar)
```typescript
// [colar contrato completo aqui]
```

## O QUE FAZER
1. Criar arquivo `src/features/coagulacao-v2/types/[NomeEntidade].ts`
2. Exportar EXATAMENTE as interfaces do contrato
3. Adicionar imports necessários (Timestamp do firestore)
4. Exportar union types se especificado

## O QUE NÃO FAZER
- Não adicionar campos ao contrato
- Não remover campos do contrato
- Não criar interfaces extras (I[Nome], [Nome]DTO, etc)
- Não adicionar JSDoc em campos óbvios
- Não criar validators (isso vem em outro prompt)

## ARQUIVOS PERMITIDOS
- `src/features/coagulacao-v2/types/[NomeEntidade].ts`
- `src/features/coagulacao-v2/types/index.ts` (adicionar re-export)

## ARQUIVOS PROIBIDOS
- Qualquer outro arquivo

## OUTPUT ESPERADO
1 arquivo .ts com as interfaces exportadas, pronto para import.

## DEFINITION OF DONE
- [ ] File criado no path correto
- [ ] Todas as interfaces do contrato exportadas
- [ ] TypeScript compila sem erros
- [ ] Zero comentários (exceto regulatório)
- [ ] Zero `any` types
```

---

## 5.3 Template: Criar Service de CRUD

```markdown
# TASK: Criar [nomeEntidade]Service

## CONTRATO (LEI — tipos de entrada e saída)
```typescript
// [colar relevant types]
```

## CONTEXTO (padrão dos services existentes)
```typescript
// [colar exemplo de 1 service existente como referência de padrão]
// ex: src/features/insumos/services/insumosFirebaseService.ts (primeiros 80 linhas)
```

## O QUE FAZER
1. Criar `src/features/coagulacao-v2/services/[nomeEntidade]Service.ts`
2. Implementar funções:
   - `create[Entidade](labId, data)` → addDoc
   - `get[Entidade](labId, id)` → getDoc
   - `list[Entidades](labId, options)` → getDocs com query + orderBy + limit
   - `update[Entidade](labId, id, changes)` → updateDoc
   - `delete[Entidade](labId, id)` → NÃO. Entidades usam soft-delete se aplicável
3. Usar Firestore direto (sem repository pattern)
4. Usar `serverTimestamp()` para `criadoEm` / `atualizadoEm`
5. Retornar dados com `id` do documento incluído

## O QUE NÃO FAZER
- Não criar interface de Repository
- Não criar adapter/mapper
- Não criar factory function
- Não adicionar comentários (exceto regulatório)
- Não usar `console.log` em vez de logger
- Não usar `any` type

## ARQUIVOS PERMITIDOS
- `src/features/coagulacao-v2/services/[nomeEntidade]Service.ts`

## ARQUIVOS PROIBIDOS
- Qualquer outro arquivo

## OUTPUT ESPERADO
1 arquivo .ts com o service, seguindo padrão dos services existentes.

## DEFINITION OF DONE
- [ ] CRUD completo (create, get, list, update)
- [ ] `serverTimestamp()` em timestamps
- [ ] `id` incluído no retorno
- [ ] `limit(50)` em listagens
- [ ] TypeScript compila sem erros
- [ ] Zero `any`
- [ ] Zero padrão repository/adapter/factory
```

---

## 5.4 Template: Criar Hook

```markdown
# TASK: Criar use[NomeEntidade] hook

## CONTRATO (LEI — tipos retornados)
```typescript
// [colar relevant types]
```

## CONTEXTO (padrão de hooks existentes)
```typescript
// [colar exemplo de 1 hook existente curto]
// ex: src/features/coagulacao/hooks/useCoagLots.ts (primeiros 60 linhas)
```

## O QUE FAZER
1. Criar `src/features/coagulacao-v2/hooks/use[NomeEntidade].ts`
2. Hook deve:
   - Assinar coleção em tempo real (`onSnapshot`)
   - Retornar `{ items, isLoading, error }`
   - Tratar unsub corretamente em `useEffect` cleanup
3. Máximo 2 `useState` no hook
4. Máximo 200 linhas total

## O QUE NÃO FAZER
- Não adicionar estados extras "por conveniência"
- Não calcular métricas/derivados no hook (usar useMemo se necessário)
- Não orquestrar múltiplas subscriptions em 1 hook
- Não criar "manager hook" que coordene tudo
- Não adicionar comentários em useEffect padrão

## ARQUIVOS PERMITIDOS
- `src/features/coagulacao-v2/hooks/use[NomeEntidade].ts`

## ARQUIVOS PROIBIDOS
- Qualquer outro arquivo

## OUTPUT ESPERADO
1 arquivo .ts com hook, < 200 linhas, retornando dados em tempo real.

## DEFINITION OF DONE
- [ ] Hook criado e tipado
- [ ] Subscription em tempo real com cleanup
- [ ] Retorno: `{ items, isLoading, error }`
- [ ] Máximo 2 useState
- [ ] Máximo 200 linhas
- [ ] TypeScript compila
```

---

## 5.5 Template: Criar Componente UI

```markdown
# TASK: Criar componente [NomeComponente]

## WIREFRAME (visual)
```
[colar wireframe textual do master goal]
```

## CONTRATO (LEI — props do componente)
```typescript
interface [NomeComponente]Props {
  // [campos específicos]
  onSave: (data: FormData) => Promise<void>;
  onCancel?: () => void;
  isSaving?: boolean;
}
```

## CONTEXTO (padrão de componentes existentes)
```typescript
// [colar snippet de componente existente com estilo similar]
```

## O QUE FAZER
1. Criar `src/features/coagulacao-v2/components/[NomeComponente].tsx`
2. Renderizar EXATAMENTE o wireframe
3. Usar Tailwind para estilos (seguir padrões existentes)
4. Máximo 2 estados por componente
5. Máximo 300 linhas total
6. Validar input com Zod schema

## O QUE NÃO FAZER
- Não adicionar campos não especificados no wireframe
- Não criar "convenience features" (atalhos, auto-save, etc)
- Não adicionar loading states extras
- Não adicionar tooltips extensivos
- Não criar sub-componentes preemptivamente
- Não criar "smart component" — UI apenas recebe dados e dispara callbacks

## ARQUIVOS PERMITIDOS
- `src/features/coagulacao-v2/components/[NomeComponente].tsx`
- `src/features/coagulacao-v2/components/[NomeComponente].schema.ts` (se Zod)

## ARQUIVOS PROIBIDOS
- Qualquer outro arquivo

## OUTPUT ESPERADO
1 componente React seguindo wireframe, < 300 linhas, tipado, com Zod validation.

## DEFINITION OF DONE
- [ ] Componente renderiza wireframe fielmente
- [ ] Props tipadas
- [ ] Máximo 2 useState
- [ ] Máximo 300 linhas
- [ ] Zod schema para form (se aplicável)
- [ ] Tailwind só (sem CSS-in-JS)
- [ ] Zero termos técnicos em labels (R4)
- [ ] TypeScript compila
```

---

## 5.6 Template: Criar Orquestração de Save

```markdown
# TASK: Criar useAttemptSave hook (orquestração)

## CONTRATO DO ATTEMPT (LEI)
```typescript
// [colar contrato de Attempt]
```

## FLUXO DE SAVE (3 passos — não mais)
1. Captura dados operacionais (controle, equipamento, resultados)
2. Calcula Westgard (computeCoagWestgard do legado)
3. Persiste com snapshot + assinatura + audit

## CONTEXTO (serviços a consumir)
```typescript
// Interfaces dos services existentes:
import { saveAttempt } from '../services/attemptService';
import { computeCoagWestgard } from '../../coagulacao/hooks/useCoagWestgard';
import { useCoagSignature } from '../../coagulacao/hooks/useCoagSignature';
import { buildInsumoSnapshot } from '../../insumos/types/InsumoSnapshot';
import { buildEquipamentoSnapshot } from '../../equipamentos/types/Equipamento';
```

## O QUE FAZER
1. Criar `src/features/coagulacao-v2/hooks/useAttemptSave.ts`
2. Hook deve:
   - Aceitar `{ controlOperacionalId, equipamentoId, resultados, acaoCorretiva? }`
   - Orquestrar: validar → Westgard → snapshot → signature → save
   - Retornar `{ saveAttempt, isSaving, error }`
3. Máximo 200 linhas
4. Fire-and-forget para audit record (com `.catch(logger)`)

## O QUE NÃO FAZER
- Não adicionar passos ao fluxo de save (máximo 4 etapas)
- Não criar "pre-save validation" complexa
- Não criar eventos de "before-save" / "after-save"
- Não criar middleware / interceptor pattern
- Não modificar services existentes
- Não adicionar lógica de retry (falhas propagam ao UI)

## ARQUIVOS PERMITIDOS
- `src/features/coagulacao-v2/hooks/useAttemptSave.ts`

## ARQUIVOS PROIBIDOS
- Qualquer serviço de outro módulo
- Hooks de outras waves
- Arquivos de `src/features/coagulacao/` (apenas importar)

## OUTPUT ESPERADO
1 hook que orquestra o save em ≤ 4 passos, < 200 linhas.

## DEFINITION OF DONE
- [ ] Hook aceita input do wireframe
- [ ] Fluxo: validar → Westgard → snapshot → signature → save
- [ ] Audit record fire-and-forget com catch
- [ ] Retorno: `{ saveAttempt, isSaving, error }`
- [ ] Máximo 200 linhas
- [ ] Sem lógica de retry
- [ ] TypeScript compila
```

---

## 5.7 Template: Criar Teste Unitário

```markdown
# TASK: Criar testes de [NomeArquivo testado]

## O QUE TESTAR
- [Listar cenários específicos de teste]

## CONTEXTO (código a ser testado)
```typescript
// [colar o arquivo a ser testado]
```

## PATTERN DE TESTE (seguir)
```typescript
// [colar exemplo de teste existente que passa]
```

## O QUE FAZER
1. Criar `src/features/coagulacao-v2/[mirrored-path]/[NomeArquivo].test.ts`
2. Cobrir:
   - Caso feliz (happy path)
   - Caso de erro (error path)
   - Edge case relevante (se especificado)
3. Usar vitest (padrão do projeto)
4. Mock de Firestore com `firebase/firestore` (se aplicável)

## O QUE NÃO FAZER
- Não criar testes "óbvios" (ex: testar que `1 + 1 = 2`)
- Não mockar o próprio código (testar comportamento real)
- Não criar test factories complexas (usar objetos literais)
- Não escrever descrições de teste em inglês (usar pt-BR)
- Não testar implementação (testar interface)

## ARQUIVOS PERMITIDOS
- `src/features/coagulacao-v2/[mirrored-path]/[NomeArquivo].test.ts`

## ARQUIVOS PROIBIDOS
- Qualquer outro arquivo

## OUTPUT ESPERADO
1 arquivo de teste com 3-5 cenários, todos passando.

## DEFINITION OF DONE
- [ ] Testes passam (`vitest run`)
- [ ] 3-5 cenários cobertos
- [ ] Mocks apropriados (Firestore se necessário)
- [ ] Descrições em pt-BR
- [ ] Sem test factories complexas
```

---

## 5.8 Regras Globais para TODOS os Prompts

```markdown
## REGRAS GLOBAIS (incluir em TODO prompt)

### IDIOMA
- Código: inglês (nomes, variáveis, funções)
- Comentários regulatórios: português ou inglês
- Descrições de teste: pt-BR

### ESTILO
- Prettier config existente (não formatar manualmente)
- ESLint config existente (respeitar regras)
- Imports agrupados: react/hooks primeiro, depois services, depois types

### FIRESTORE
- Sempre `serverTimestamp()` para timestamps de create/update
- Sempre incluir `labId` no payload
- Sempre usar `limit()` em queries de listagem
- Sempre incluir `id` do documento no retorno

### TYPESCRIPT
- Zero `any` (absoluto)
- Usar `unknown` + type guard se necessário
- Tipar explicitamente retornos de funções públicas
- Tipar parâmetros de callbacks

### REACT
- Máximo 2 useState por hook
- Máximo 2 useState por componente
- Usar useMemo para derivados caros
- Usar useCallback para callbacks estáveis

### COMPLIANCE
- Manter snapshot congelado (não modificar depois)
- Manter logicalSignature imutável
- Usar `useCoagSignature` e `computeCoagWestgard` do legado (não reimplementar)
```
