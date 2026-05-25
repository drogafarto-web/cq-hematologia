# Parte 7 — Estratégia de Integração Segura

---

## 7.1 Estratégia de Branches

### Estrutura

```
main (produção)
├── main-v2 (branch de desenvolvimento do redesign)
│   ├── wave/a-control-operacional (feature branch da onda A)
│   ├── wave/b-attempt (feature branch da onda B)
│   ├── wave/c-rtaction (feature branch da onda C)
│   ├── wave/d-ui-operador (feature branch da onda D)
│   ├── wave/e-ui-rt (feature branch da onda E)
│   ├── wave/f-auditoria (feature branch da onda F)
│   └── wave/g-deploy (feature branch da onda G)
```

### Regras

1. **`main-v2`** — branch oficial do redesign. Cada wave merge aqui.
2. **`wave/[x]-[nome]`** — branch efêmera. Criada de `main-v2`, merge de volta em `main-v2`.
3. **Nunca** merge direto em `main-v2` sem passar por wave branch.
4. **Nunca** delete `main-v2` antes de deploy final em produção.
5. **`main-v2`** só merge em `main` após wave G aprovar.

### Ciclo de vida de wave branch:

```
1. Criar: git checkout -b wave/a-control-operacional main-v2
2. Implementar: commits incrementais
3. Auditoria passa
4. Merge: PR para main-v2 (com review do Arquiteto)
5. Deletar: git branch -d wave/a-control-operacional
```

---

## 7.2 Plano de Commits

### Convenção: Conventional Commits

```
<type>(coag-v2): <description>

[optional body]

[optional footer]
```

### Types permitidos:

| Type | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade (entidade, hook, componente) |
| `fix` | Correção de bug em código já merged |
| `test` | Novos testes ou correção de testes |
| `refactor` | Mudança interna sem alterar interface pública (raro) |
| `docs` | Documentação |
| `chore` | Configuração, tooling, CI |

### Exemplos:

```
feat(coag-v2): add ControlOperacional types
feat(coag-v2): add controlOperacionalService CRUD
feat(coag-v2): add useControlOperacional hook
test(coag-v2): add controlOperacionalService unit tests
feat(coag-v2): integrate Attempt with Westgard from legacy
fix(coag-v2): correct Timestamp type in ControlOperacional
docs(coag-v2): add wave A completion report
```

### Por wave:

| Wave | Commits esperados | Prefixo |
|------|-------------------|---------|
| A | 5 | `feat(coag-v2):` + `test(coag-v2):` + `docs(coag-v2):` |
| B | 8 | `feat(coag-v2):` + `test(coag-v2):` |
| C | 5 | `feat(coag-v2):` + `test(coag-v2):` |
| D | 6 | `feat(coag-v2):` + `test(coag-v2):` |
| E | 5 | `feat(coag-v2):` + `test(coag-v2):` |
| F | 3 | `feat(coag-v2):` + `chore(coag-v2):` |
| G | 2 | `chore(coag-v2):` + `docs(coag-v2):` |

**Total: ~34 commits** em 7 waves.

---

## 7.3 Integração Entre Waves

### Dependências explícitas:

```
Wave A (ControlOperacional)
  │
  ├─→ Wave B (Attempt) — lê ControlOperacional por ID
  │    │
  │    └─→ Wave C (RTAction) — lê Attempt por ID
  │         │
  │         └─→ Wave E (UI RT) — consome RTAction
  │
  └─→ Wave D (UI Operador) — consome ControlOperacional + Attempt
       │
       └─→ Wave F (Auditoria) — valida integração de tudo
            │
            └─→ Wave G (Deploy)
```

### Regras de interface:

- **Wave N** só importa **types** de Wave N-1 (não services, não hooks)
- Se Wave N precisa de função de Wave N-1, usa interface pública do hook
- Se Wave N-1 muda interface pública → Wave N precisa revisar (break-change)
- Waves NÃO acoplam em implementação interna de outra wave

### Exemplo de contrato de interface:

```typescript
// Wave A expõe:
export interface ControlOperacional { ... }  // types
export function useControlOperacional(labId: string): {
  controls: ControlOperacional[];
  isLoading: boolean;
  error: string | null;
};

// Wave B consome:
import type { ControlOperacional } from '../types/ControlOperacional';
import { useControlOperacional } from '../hooks/useControlOperacional';
// Wave B NÃO importa implementações internas de Wave A
```

---

## 7.4 Resolução de Conflitos

### Tipos de conflito e estratégia:

#### Conflito trivial (renome, formatação)

```
Agente Integrador resolve sozinho.
Log: "Conflito trivial resolvido em [arquivo]"
```

#### Conflito semântico (mudança de interface)

```
Integrador pausa merge.
Escalona ao Arquiteto.
Arquiteto decide:
  (a) Re-escrever Wave N-1 para manter compatibilidade
  (b) Atualizar contrato da Wave N (novo prompt)
  (c) Abortar onda e replanejar
```

#### Conflito de dependência (circular imports)

```
Integrador NÃO resolve sozinho.
Arquiteto identifica a dependência cíclica.
Decisão:
  (a) Extrair shared types para um arquivo `_shared_types.ts`
  (b) Usar dependency inversion (interface em wave anterior)
  (c) Reorganizar waves (se dependência é invertida)
```

#### Conflito cross-módulo (outra feature afetada)

```
Integrador NUNCA resolve sozinho.
Arquiteto:
  (a) Avaliar se impacto é real ou falso-positivo
  (b) Se real: pausar wave e investigar root cause
  (c) Se falso-positivo: documentar e prosseguir
```

---

## 7.5 Prevenção de Divergência Arquitetural

### Daily sync (entre ondas):

**Arquiteto revisa:**
1. Output de cada wave vs contrato
2. Métricas de complexidade
3. Anti-patterns detectados
4. Interface pública exposta

**Se detectar drift:**
- Reverter wave inteira (git revert)
- Re-escrever contrato (se drift é legítima evolução)
- Abortar onda e replanejar

### Anti-drift automático:

```bash
# Script que roda após cada merge:
./scripts/check-architectural-drift.sh
```

**O que verifica:**
- Número de entidades (sempre 3)
- Número de eventos (sempre 3)
- Nomes de entidades (sempre `ControlOperacional`, `Attempt`, `RTAction`)
- Interface pública de cada wave (diff vs contrato)
- Acoplamento entre waves (grafo de imports)

---

## 7.6 Estratégia de Retomada

### Se um agente falhar no meio da wave:

1. **Ver `context.yaml`** — ver última task completada
2. **Criar novo agente** (ou mesmo, em nova sessão)
3. **Fornecer contexto:**
   ```
   Você está retomando Wave A do redesign de Coagulação v2.
   Contexto atual: docs/coag-v2/waves/wave-a-control-operacional.md#context.yaml
   Última task completada: Task 2 (controlOperacionalService)
   Próxima task: Task 3 (useControlOperacional hook)
   Contrato: docs/coag-v2/contracts/control-operacional.md
   ```
4. **Novo agente continua** — não reinicia wave

### Se wave precisa ser totalmente re-feita:

1. `git revert` dos commits da wave
2. Marcar wave como `failed` no `context.yaml`
3. Arquiteto decide:
   - (a) Re-escrever spec da wave
   - (b) Abortar onda
   - (c) Tentar novamente com executor diferente

### Se contexto se perde (perda de `context.yaml`):

1. Arquiteto reconstrói estado a partir de git log + auditoria
2. Gerar novo `context.yaml` com base em:
   - Commits merged em `main-v2`
   - Testes passando
   - Auditoria mais recente

---

## 7.7 Convenções Obrigatórias

### Nomenclatura de arquivos:

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Types | `EntidadeName.ts` | `ControlOperacional.ts` |
| Service | `entidadeNameService.ts` | `controlOperacionalService.ts` |
| Hook | `useEntidadeName.ts` | `useControlOperacional.ts` |
| Component | `EntidadeNameForm.tsx` | `ControlOperacionalForm.tsx` |
| Test | `[arquivo].test.ts` | `controlOperacionalService.test.ts` |

### Nomenclatura de funções:

| Ação | Padrão | Exemplo |
|------|--------|---------|
| Criar | `createEntidade` | `createControlOperacional` |
| Buscar | `getEntidade` | `getControlOperacional` |
| Listar | `listEntidades` | `listControlOperacionals` |
| Atualizar | `updateEntidade` | `updateControlOperacional` |
| Deletar (soft) | `deleteEntidade` | `deleteControlOperacional` |

### Nomenclatura de hooks:

| Função | Padrão |
|--------|--------|
| Ler entidade | `useEntidade` |
| Listar entidades | `useEntidades` |
| Salvar entidade | `useEntidadeSave` |
| Avaliação de entidade | `useEntidadeEvaluation` |

---

## 7.8 Estratégia Anti-Deriva

### Drift de especificação

**Sintoma:** Agente começa a "melhorar" spec sem autorização.

**Prevenção:**
- Toda spec está em `docs/coag-v2/contracts/[entidade].md`
- Agente recebe link para contrato, não para rationale
- Auditor valida aderência literal ao contrato

### Drift de padrão

**Sintoma:** Agente usa padrão diferente das waves anteriores (ex: Factory em vez de funções).

**Prevenção:**
- Prompt inclui exemplo de padrão existente
- Auditor detecta padrões proibidos (Repository, Factory, Adapter)
- Se detectado → rejeição automática

### Drift de nomenclatura

**Sintoma:** Agente usa nomes diferentes (ex: `CoagOperationalControl` em vez de `ControlOperacional`).

**Prevenção:**
- Contrato congela nomes
- Auditor valida nomes exatos em types, services, hooks
- Rejeição automática se nome divergir do contrato

### Drift de escopo

**Sintoma:** Agente adiciona features não solicitadas.

**Prevenção:**
- Wave spec define escopo fechado
- Auditor conta campos, eventos, states
- Se detectar campo extra → rejeição
