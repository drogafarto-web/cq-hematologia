# Parte 1 — Arquitetura de Execução Multi-Agente

---

## 1.1 Definição de Agentes

### Agente Arquiteto (supervisor)

**Modelo:** Claude Sonnet ou GPT-4o (ou Pro) — capacidade de decisão arquitetural
**Custo:** moderado — invocado apenas para decisões
**Frequência:** 1-2 por onda

**Responsabilidades:**

- Aprovar wave specs antes de execução
- Decidir quando há ambiguidade não resolvida no contrato
- Autorizar desvios (nunca improvisados pelo executor)
- Revisar relatórios de auditoria pós-onda
- Bloquear/autorizar integração entre ondas

**O que NÃO faz:**

- Não escreve código
- Não faz deploy
- Não modifica contratos sem documento formal

**Limites de autonomia:**

- Pode pausar onda se detectar drift
- Pode rejeitar output de executor
- NÃO pode adicionar entidade, evento ou campo sem update documentado no master goal

---

### Agente Executor (implementador)

**Modelo:** DeepSeek V4 Flash (gratuito)
**Custo:** zero (tier free)
**Frequência:** 1 por task dentro de uma onda

**Responsabilidades:**

- Implementar exatamente o especificado no contrato da entidade
- Seguir o wireframe textual do wave spec
- Produzir código com testes obrigatórios
- Reportar blockers ao Arquiteto (não resolver sozinho)

**O que NÃO faz:**

- Não decide arquitetura
- Não cria entidades novas
- Não cria eventos novos
- Não altera contratos
- Não adiciona campos não especificados
- Não reescreve serviços existentes sem autorização

**Limites de autonomia:**

- Pode renomear variáveis locais para claridade
- Pode organizar imports e formatação
- Pode criar helpers internos a um arquivo (máximo 150 linhas)
- NÃO pode criar novos arquivos sem autorização no wave spec
- NÃO pode modificar contratos, types compartilhados, ou services de outros módulos

---

### Agente Auditor (validador)

**Modelo:** DeepSeek V4 Flash (gratuito — auditoria automatizada é pattern matching)
**Custo:** zero
**Frequência:** 1 por output de executor

**Responsabilidades:**

- Validar aderência ao contrato congelado
- Contar linhas por arquivo/componente
- Detectar novas entidades/eventos/campos
- Detectar anti-patterns proibidos
- Gerar relatório de auditoria

**O que NÃO faz:**

- Não modifica código
- Não aprova merges
- Não reescreve implementações

**Limites de autonomia:**

- Reporta findings ao Arquiteto
- Não toma decisões de aceitação/rejeição
- Bloqueia merge se encontrar violações críticas (automático)

---

### Agente Integrador (merge coordinator)

**Modelo:** DeepSeek V4 Flash (gratuito) + revisão humana
**Custo:** zero
**Frequência:** 1 por onda completada

**Responsabilidades:**

- Fazer merge de branch da onda em `main-v2`
- Resolver conflitos (escalando ao Arquiteto se necessário)
- Rodar suite completa de testes
- Verificar que módulos adjacentes (hematologia, uroanálise, imuno) não foram afetados

**O que NÃO faz:**

- Não modifica código de ondas já integradas
- Não força merges com conflitos não resolvidos
- Não ignora falhas de teste

**Limites de autonomia:**

- Pode resolver conflitos triviais (renames, ordering)
- Escala ao Arquiteto para conflitos semânticos

---

### Agente Anti-Complexidade (guardian)

**Modelo:** DeepSeek V4 Flash (gratuito — análise quantitativa)
**Custo:** zero
**Frequência:** 1 por output de executor (roda junto com auditor, mas métricas diferentes)

**Responsabilidades:**

- Medir tamanho de componentes (rejeita > limite)
- Medir cyclomatic complexity
- Contar campos expostos em UI
- Verificar que nenhum termo técnico (Run, Lot, Status, Workflow) aparece em UI operacional
- Validar que ≤ 6 campos operacionais estão expostos

**O que NÃO faz:**

- Não modifica código
- Não sugere otimizações
- Apenas mede e reporta

**Limites de autonomia:**

- Rejeição automática se métricas excedem limites
- Não há "exceção pragmática" — limites são absolutos

---

## 1.2 Regras de Comunicação

```
                  ┌──────────────────┐
                  │  Agente Arquiteto │ ← Supervisor
                  │  (Claude/GPT-4o)  │
                  └────────┬─────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   Executor   │  │   Auditor    │  │ Integrador   │
  │ (DS Flash)   │  │ (DS Flash)   │  │ (DS Flash)   │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                  ┌────────▼─────────┐
                  │  Anti-Complexity │
                  │   (DS Flash)     │
                  └──────────────────┘
```

### Fluxo por task:

1. **Arquiteto** aprova wave spec e entrega ao Executor
2. **Executor** implementa → output: código + testes
3. **Auditor** valida output vs contrato → output: relatório
4. **Anti-Complexity** mede métricas → output: relatório
5. Se ambos aprovam → **Integrador** faz merge
6. Se algum rejeita → **Executor** corrige (máximo 2 tentativas, depois escala ao Arquiteto)

### Mensagens proibidas:

- Executor → Arquiteto: "sugiro mudar a arquitetura em..."
- Executor → Integrador: "merge mesmo com conflito, eu acho que..."
- Auditor → Executor: "você poderia tentar de um jeito diferente..."

### Mensagens obrigatórias:

- Executor → Arquiteto: "BLOCKER: [descrição do bloqueio]"
- Auditor → Arquiteto: "REJEITADO: [violação encontrada] no arquivo [path:linha]"
- Anti-Complexity → Arquiteto: "MÉTRICA EXCEDIDA: [métrica] = [valor] no arquivo [path]"

---

## 1.3 Limites de Autonomia por Agente

| Agente          | Pode                                                         | Não pode                                                |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Arquiteto       | Pausar onda, rejeitar output, autorizar desvios documentados | Escrever código, deploy, modificar sem documento        |
| Executor        | Implementar contrato, criar helpers internos, formatar       | Decidir arquitetura, criar entidades, alterar contratos |
| Auditor         | Validar, contar, reportar findings                           | Modificar código, aprovar merges                        |
| Integrador      | Fazer merge de ondas aprovadas, resolver conflitos triviais  | Ignorar testes falhando, modificar ondas integradas     |
| Anti-Complexity | Medir, rejeitar automaticamente                              | Sugerir otimizações, modificar código                   |
