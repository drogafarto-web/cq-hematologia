# Coagulação v2 — Arquitetura Oficial (Master Goal)

**Data:** 25/05/2026
**Status:** OFICIAL — fonte única de verdade.
**Referência de engenharia reversa:** [`coag-legacy-analysis.md`](./coag-legacy-analysis.md)
**Substitui:** M001-CONTEXT.md, M001-ROADMAP.md (arquivar após aprovação deste doc)

---

## 0. Princípio Zero

> **O sistema deve ser simples o suficiente para que um colaborador entenda rapidamente, sem precisar compreender arquitetura interna.**

Qualquer proposta de redesign que viole este princípio é rejeitada automaticamente, independentemente de mérito técnico.

---

## 1. Filosofia Operacional

### 1.1 O operador NÃO pensa em

| ❌ Operador NÃO pensa em                              | ✅ Em vez disso                                          |
| ----------------------------------------------------- | -------------------------------------------------------- |
| Lotes                                                 | Usa "controle" (saco físico, nome interno)               |
| Workflow / estados (pendente, em validação, aprovado) | Status é invisível; só RT vê                             |
| Nível I vs Nível II                                   | Escolhe "controle" e o sistema sabe o nível por trás     |
| Calibração de bula (mean/SD)                          | RT configura no `ControlOperacional` antes               |
| Calibração INR (ISI/MNPT)                             | Configuração do equipamento (uma vez)                    |
| NOTIVISA                                              | RTAction (RT decide se aplicar)                          |
| Regras Westgard                                       | Avaliação estatística fica invisível; só RT vê violações |
| Conformidade A/R                                      | Badge sutil — não bloqueia save                          |

### 1.2 O operador SÓ pensa em

| ✅ Operador pensa em                                           |
| -------------------------------------------------------------- |
| "Qual controle eu tô usando?" (seleciona controle de dropdown) |
| "Qual equipamento?" (seleciona equipamento)                    |
| "Resultado AP = X"                                             |
| "Resultado RNI = Y"                                            |
| "Resultado TTPA = Z"                                           |
| "Tem ação corretiva?" (só se houver violação — RT vê também)   |
| Salvar                                                         |

**Resultado:** ~6 campos operacionais. Todo o resto é contexto.

---

## 2. Entidades do Modelo Novo

> Regra: qualquer entidade nova que não seja absolutamente necessária é rejeitada. 3 entidades.

### 2.1 `ControlOperacional` (raiz)

**Conceito:** um controle físico usado no dia a dia. Representa o "saco de controle" — não o lote químico.

```
ControlOperacional = {
  // Identificação simples
  id: string
  labId: string
  nome: string                    // "Controle Normal" / "Controle Patológico"
  nivel: 'I' | 'II'                // Propriedade — operador não vê

  // Vínculo com insumo (slot do EquipmentSetup)
  insumoId: string                // Referência ao documento do insumo
  equipamentoId: string           // Clotimer Duo, etc.

  // Configuração prévia (RT faz)
  mean: Record<CoagAnalyteId, number>   // Bula do lote
  sd: Record<CoagAnalyteId, number>     // Bula do lote
  validadeControle: string
  fabricanteControle: string
  loteControle: string                  // Campo interno — operador não vê

  // Status operacional (invisível para operador)
  status: 'ativo' | 'pausado' | 'aposentado'

  // Timeline
  criadoEm: Timestamp
  criadoPor: string
  atualizadoEm: Timestamp
}
```

**Por que:** Operador vê apenas "Controle Normal" ou "Controle Patológico" no dropdown. Lote, datas, fabricante — metadados invisíveis.

### 2.2 `Attempt` (execução)

**Conceito:** uma tentativa operacional de executar uma medição de CIQ. É o que o operador "faz" quando clica em "Salvar resultado".

```
Attempt = {
  // Identificação
  id: string                        // UUID
  labId: string
  controlOperacionalId: string      // Referência ao controle

  // Dados operacionais (visíveis para operador)
  equipamentoId: string             // Selecionado em UI
  resultados: Record<CoagAnalyteId, number>  // Inputs
  dataRealizacao: string            // auto

  // Avaliação estatística (invisível para operador, visível para RT)
  conformidade?: 'A' | 'R'          // derivado de Westgard
  violacoes?: WestgardViolation[]
  analitosComViolacao?: CoagAnalyteId[]

  // Ação corretiva (opcional — aparece só se não conforme)
  acaoCorretiva?: string

  // Snapshots imutáveis (preservação regulatória)
  snapshot: {
    insumo: InsumoSnapshot
    reagente: InsumoSnapshot
    reagenteTtpa?: InsumoSnapshot
    equipamento: EquipamentoSnapshot
  }

  // Overrides auditados (gate regulatório)
  overrides?: {
    insumoVencido?: boolean
    qcNaoValidado?: boolean
    motivo?: string                  // obrigatório se há override
  }

  // Assinatura (preservação lógica)
  logicalSignature: string
  signedBy: string
  signedAt: Timestamp

  // Timeline
  criadoEm: Timestamp
  criadoPor: string
}
```

**Por que apenas ~6 campos operacionais:**

- `controlOperacionalId` — dropdown
- `equipamentoId` — dropdown
- `resultados.{AP, RNI, TTPA}` — 3 inputs
- `acaoCorretiva` (opcional) — textarea

Todo o resto é derivado do `ControlOperacional` no momento do save.

### 2.3 `RTAction` (decisão do Responsável Técnico)

**Conceito:** ação executada **exclusivamente** pelo RT. Operador nunca mexe.

```
RTAction = {
  id: string
  labId: string
  tipo: 'aprovar_controle' | 'rejeitar_controle' | 'notificar_notivisa'

  // Vínculo (polimórfico por tipo)
  targetRef: {
    type: 'ControlOperacional' | 'Attempt'
    id: string
  }

  // Payload específico por tipo
  payload: {
    // aprovar_controle / rejeitar_controle
    decisao?: 'A' | 'NA' | 'Rejeitado'

    // notificar_notivisa
    notivisaTipo?: 'queixa_tecnica' | 'evento_adverso'
    notivisaProtocolo?: string
    notivisaDataEnvio?: string
    notivisaJustificativa?: string

    // Motivo (obrigatório)
    motivo: string
  }

  // Timeline
  criadoEm: Timestamp
  criadoPor: string                 // UID do RT
}
```

**Por que:** Separa claramente ação operacional (Attempt) de ação técnica (RTAction). RT vê mais; operador vê menos.

---

## 3. Timeline Narrativa (3 eventos máx)

O sistema emite 3 tipos de eventos operacionais, não mais:

```
1. attempt.criado         → Operador salvou uma tentativa
2. controle.aprovado      → RT aprovou o controle (RTAction)
3. controle.rejeitado     → RT rejeitou o controle (RTAction)
```

**NÃO há:**

- ❌ Status: "pendente", "em validação", "aprovado" (workflow states)
- ❌ Eventos: "criou lote", "vinculou equipamento", "configurou bula"
- ❌ Timeline técnica: "snapshot foi gerado", "assinatura foi calculada"

**A UI mostra:**

- Operador vê: "Tentativa X · AP 98% · RNI 1.02 · TTPA 33s · ✓"
- RT vê: "Tentativa X · conformidade A · violações: 0 · aprovar/rejeitar"

Todo o "ruído técnico" (snapshots, assinaturas, cálculos) acontece em segundo plano, em serviços internos.

---

## 4. Fluxo Operacional Completo

### 4.1 Fluxo do Operador (simples)

```
1. Entra no módulo Coagulação
2. Seleciona controle (dropdown: "Normal" / "Patológico")
3. Seleciona equipamento (dropdown: "Clotimer Duo")
4. Digita resultados (3 campos: AP, RNI, TTPA)
5. Se houver violação → textarea de ação corretiva aparece
6. Clica em "Salvar"
   ↳ Sistema:
     - Valida setup (reagente + controle configurados) via useInsumoFlowGuard
     - Calcula Westgard (computeCoagWestgard)
     - Gera snapshot (insumo + reagente + equipamento)
     - Gera logicalSignature
     - Persiste `Attempt`
     - Grava audit record (fire-and-forget)
7. Volta para tela de listagem
```

### 4.2 Fluxo do RT (visão técnica)

```
1. Entra no módulo Coagulação
2. Vê painel com:
   - KPIs (conformidade %, tentativas recentes)
   - Lista de tentativas com badges de conformidade (✓ / ✕)
3. Clica em uma tentativa com violação
4. Vê:
   - Resultados detalhados
   - Regras Westgard violadas (1-2s, 2-2s, etc.)
   - Snapshots do momento
   - Opções:
     - Aprovar (ação corretiva foi suficiente)
     - Rejeitar (exige investigação)
     - Notificar NOTIVISA (abre sub-modal)
5. Preenche `motivo` obrigatório
6. Clica "Confirmar"
   ↳ Sistema persiste `RTAction`
   ↳ Timeline da tentativa atualiza
```

### 4.3 Fluxo de Configuração Prévia (RT faz uma vez)

```
1. RT cria um `ControlOperacional`:
   - Nome: "Controle Normal"
   - Insumo: escolhe do estoque (slot `activeControleId`)
   - Equipamento: "Clotimer Duo"
2. Sistema extrai:
   - loteControle, validadeControle, fabricanteControle (do insumo)
   - mean/sd (da bula do fabricante — ou RT digita manualmente)
3. Salva
```

**Quando o controle mudar de lote físico:** RT atualiza o `ControlOperacional` — cria um novo com mean/SD da bula nova.

**Operador nem percebe.** Só vê "Controle Normal" no dropdown.

---

## 5. Wireframe Textual

### 5.1 Tela do Operador (principal)

```
┌─────────────────────────────────────────────────────────────┐
│  Coagulação                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Controle                                            │   │
│  │                                                      │   │
│  │  [ Normal             ▼ ]                            │   │
│  │  (Controle Normal — Clotimer Duo)                    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Resultados                                          │   │
│  │                                                      │   │
│  │  Atividade de Protrombina   [   98  ] %               │   │
│  │                              esperado: 80–120         │   │
│  │                                                      │   │
│  │  RNI                        [ 1.02  ]                 │   │
│  │                              esperado: 0.83–1.11      │   │
│  │                                                      │   │
│  │  TTPA                       [ 33.5  ] s               │   │
│  │                              esperado: 27–39          │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [ ✓ Dentro dos limites ]                                    │
│                                                              │
│                    [ Cancelar ]  [ Salvar ]                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Campos expostos: 4** (1 dropdown + 3 inputs).

### 5.2 Tela em caso de violação (mesma tela, adiciona campo)

```
[...]

  ┌─────────────────────────────────────────────────────┐
  │  ⚠ Fora dos limites                                  │   │
  │                                                      │   │
  │  RNI: 1.45 (esperado: 0.83–1.11)                     │   │
  │                                                      │   │
  │  Descreva a ação corretiva tomada:                    │   │
  │  ┌──────────────────────────────────────────────┐   │   │
  │  │                                              │   │   │
  │  │  (ex: Repetida a dosagem com nova amostra    │   │   │
  │  │   de controle; valor dentro do intervalo     │   │   │
  │  │   na segunda corrida)                        │   │   │
  │  │                                              │   │   │
  │  └──────────────────────────────────────────────┘   │   │
  └─────────────────────────────────────────────────────┘

[...]
```

**Adiciona: 1 textarea.** Total: 5 campos no caso mais complexo.

### 5.3 Tela do RT (painel)

```
┌─────────────────────────────────────────────────────────────┐
│  Coagulação · Painel RT                                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  12          │  │  98%         │  │  0           │      │
│  │  tentativas  │  │  conformes   │  │  rejeitadas  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  Tentativas recentes                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  #24  Controle Normal  AP 98%  RNI 1.02  TTPA 33s  ✓  │  │
│  │  #23  Controle Normal  AP 75%  RNI 1.45  TTPA 34s  ✕  │  │
│  │      ↳ Ação: "Repetido com nova amostra — conforme"     │  │
│  │      ↳ [ Aprovar ]  [ Rejeitar ]  [ NOTIVISA ]         │  │
│  │  #22  Controle Patol.  AP 41%  RNI 1.62  TTPA 65s  ✓  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Anti-Patterns Proibidos

> Qualquer proposta que viole estes anti-patterns é rejeitada, mesmo tecnicamente correta.

### 6.1 Abstração Exposta

**❌ Proibido:** Entidade técnica com nome técnico em UI operacional

- ❌ "CoagulacaoLot" — operador não deve saber que é um "lote"
- ❌ "CoagulacaoRun" — operador não conhece "run" do inglês técnico
- ❌ "EquipmentSetup" em UI — operador vê equipamento, não setup

**✅ Permitido:** Nome conceitual ou descritivo

- ✅ "Controle Normal" (ControlOperacional)
- ✅ "Tentativa" (Attempt)
- ✅ "Clotimer Duo" (nome comercial)

### 6.2 Estado Múltiplo

**❌ Proibido:** Entidade com múltiplos status ortogonais

- ❌ `lotStatus` + `coagDecision` + `setupType` (legado)
- ❌ `pendente` / `em validação` / `aprovado` / `em revisão` / `rejeitado`

**✅ Permitido:** 1 ou 2 estados, mutuamente excludentes

- ✅ `ControlOperacional.status`: `'ativo' | 'pausado' | 'aposentado'`
- ✅ `Attempt.conformidade`: `'A' | 'R'` (calculado, não setado)

### 6.3 Campo Obrigatório com Heurística

**❌ Proibido:** Campo que depende de lógica complexa pra "descobrir" se deve aparecer

- ❌ Bloco "Calibração Bula" que aparece via `isNewLot` heurístico
- ❌ Seção NOTIVISA que aparece via `outOfRange.length > 0`

**✅ Permitido:** Campo que aparece via regra simples e previsível

- ✅ Textarea "ação corretiva" aparece se `violacoes.length > 0` (regra objetiva)
- ✅ Campo de motivo aparece sempre (em RTAction)

### 6.4 Workflow Exposto

**❌ Proibido:** Interface que expõe o ciclo de vida técnico internamente

- ❌ "Status: pendente" → "Status: em validação" → "Status: aprovado"
- ❌ Stepper no topo: "1. Insumos → 2. Resultados → 3. Validação"

**✅ Permitido:** Timeline narrativa (histórico do que aconteceu, não do que precisa acontecer)

- ✅ "Tentativa criada · 09:14"
- ✅ "Aprovada pelo RT · 09:27"

### 6.5 Input Manual de Campo Derivado

**❌ Proibido:** Campo que o sistema pode preencher automaticamente mas o operador digita

- ❌ Lote do controle (vem do insumo selecionado)
- ❌ Fabricante do controle (vem do insumo selecionado)
- ❌ Abertura/validade do controle (vem do insumo selecionado)

**✅ Permitido:** Campo que só faz sentido o operador conhecer

- ✅ Resultado da medição (única informação operacional real)
- ✅ Ação corretiva (descrição textual — subjetiva)

### 6.6 Acoplamento Temporal no Cliente

**❌ Proibido:** Lógica crítica que depende de subscription em tempo real

- ❌ `isNewLot` checa `existingLots.some(...)` no cliente durante typing
- ❌ Heurística de "controle em uso" que depende de subscription

**✅ Permitido:** Regra derivada de `ControlOperacional` já persistido

- ✅ Controle existe → usa mean/sd dele
- ✅ Controle não existe → bloqueia save, exige configuração

### 6.7 Entidade Raiz por Atributo

**❌ Proibido:** Entidade cuja chave principal é um atributo técnico

- ❌ "Lote" é entidade raiz porque "lote químico precisa de múltiplas runs"
- ❌ Nível I / Nível II são entidades separadas

**✅ Permitido:** Entidade cujo conceito é operacional

- ✅ "Controle Operacional" (unifica nível + lote + bula)
- ✅ "Tentativa" (unifica run + resultados + avaliação)

### 6.8 Exposição de Estatística ao Operador

**❌ Proibido:** Mostrar regras Westgard na UI do operador

- ❌ "Violação: 1-3s" em tooltip da run
- ❌ Badge "⚠ Westgard R-4s violada"

**✅ Permitido:** Badge simples de conformidade + detalhe pra RT

- ✅ "✕ Fora dos limites" (operador — sem estatística)
- ✅ "1-3s violada" (RT — detalhe técnico)

### 6.9 Over-engineering no Save

**❌ Proibido:** Múltiplos serviços, múltiplas operações explícitas

- ❌ `findCoagLot` → `createCoagLot` → `findCoagRuns` → `computeWestgard` → `generateRunCode` → `sign` → `saveRun` → `updateLot` → `writeAudit` (9 passos no legado)

**✅ Permitido:** 1 método público com orquestração interna

- ✅ `Attempt.save(data, options)` — orquestração invisível

### 6.10 Multi-Agente com Estado Compartilhado

**❌ Proibido:** Dois agentes escrevendo no mesmo documento sem coordenação explícita

- ❌ Hook A + Hook B atualizam `lotStatus` em parallel
- ❌ Form + Subscription competindo por `form.nivel`

**✅ Permitido:** Cada agente opera em uma entidade

- ✅ Agente A escreve em `Attempt`
- ✅ Agente B lê `Attempt` + grava `RTAction`

---

## 7. Proteção da Complexidade Regulatória

> Problema **não era** falta de engenharia. Problema era excesso de engenharia exposta ao operador.

### 7.1 Preservar 100%

| Componente                                | Onde fica                                      | Quem vê                          |
| ----------------------------------------- | ---------------------------------------------- | -------------------------------- |
| Regras Westgard (6)                       | `Attempt.violacoes` (calculado em save)        | RT                               |
| Snapshots (insumo, reagente, equipamento) | `Attempt.snapshot`                             | RT + auditor                     |
| LogicalSignature (SHA-256)                | `Attempt.logicalSignature`                     | RT + auditor + rules Firestore   |
| Audit Records imutáveis                   | `/labs/{labId}/ciq-coagulacao-audit/{auditId}` | Auditoria                        |
| `ConferenciaInsumoAtivo` (gate)           | Tentativa — antes de salvar                    | Operador (sem entender "gate")   |
| `OverrideModal` (gate)                    | Tentativa — antes de salvar                    | Operador (justificativa textual) |
| `EQUIP_ANALYTES` dicionário               | Configuração interna                           | Sistema                          |
| `COAG_ANALYTES` baselines                 | Configuração interna                           | Sistema + RT                     |

### 7.2 Esconder do Operador (invisível)

| Componente            | Onde fica                     | Por quê                              |
| --------------------- | ----------------------------- | ------------------------------------ |
| Lote químico          | Campo em `ControlOperacional` | Operador não pensa em lote           |
| Nível I/II            | Campo em `ControlOperacional` | Operador vê "Normal"/"Patológico"    |
| Conformidade A/R      | Badge sutil `✓` / `✕`         | Decisão estatística, não operacional |
| Mean/SD do fabricante | `ControlOperacional`          | Configurado previamente pelo RT      |
| Status do lote        | Inexistente                   | Substituído por timeline narrativa   |
| NOTIVISA              | `RTAction` específica         | Pertence ao RT, não ao operador      |
| Calibração bula       | `RTAction` pré-tentativa      | RT faz configuração antes            |

---

## 8. Definition of Done

O redesign está completo quando, e somente quando:

### 8.1 Funcional

- [ ] Operador consegue criar uma tentativa com **≤ 6 campos operacionais**
- [ ] Sistema calcula Westgard em segundo plano e persiste em `Attempt.violacoes`
- [ ] Sistema gera snapshot imutável e persiste em `Attempt.snapshot`
- [ ] Sistema gera logicalSignature e persiste em `Attempt.logicalSignature`
- [ ] Sistema grava audit record imutável em subcoleção
- [ ] RT consegue aprovar/rejeitar uma tentativa com motivo obrigatório
- [ ] RT consegue aplicar NOTIVISA como ação específica
- [ ] Tentativas listadas em timeline narrativa (3 tipos de evento)
- [ ] `ControlOperacional` é configurado uma única vez por RT
- [ ] Operador nunca vê campo `loteControle`, `nivel`, ou `mean` em UI

### 8.2 Regulatório

- [ ] 100% compliance com RDC 978/2025 Art. 128 (rastreabilidade + ação corretiva)
- [ ] 100% compliance com RDC 786/2023 Art. 42 (snapshot sobrevive deleção)
- [ ] 100% compliance com CLSI H47-A2 (dois níveis de controle)
- [ ] 100% compliance com CLSI C24-A3 (6 regras Westgard)
- [ ] 100% coverage de DICQ sec. 2.4 (CIQ quantitativo)
- [ ] 100% preservado o audit trail imutável com chain-hash
- [ ] LogicalSignature validada em rules Firestore
- [ ] Rastreabilidade de equipamento preservada (snapshot sobrevivente)

### 8.3 Simplicidade

- [ ] Operador não vê > 6 campos em nenhuma tela operacional
- [ ] UI primária renderiza em < 50ms (medido em devtools)
- [ ] Bundle do módulo coagulação < 20KB gzipped
- [ ] Nenhum termo técnico (Run, Lot, Status, Workflow) em UI operacional
- [ ] Teste de usuário: colaborador consegue completar tentativa em < 90s do zero

### 8.4 Multi-Agente

- [ ] Cada agente é capaz de operar em entidades isoladas
- [ ] Agente A (implementação de Attempt) não depende de Agente B (implementação de RTAction)
- [ ] Documentação por agente é auto-contida (não precisa ler todo este doc)
- [ ] Implementação possível com DeepSeek Flash V4 (sem dependência de modelo grande)

### 8.5 Teste

- [ ] Smoke test E2E cobrindo: criar tentativa → aprovar → rejeitar → aprovar com NOTIVISA
- [ ] Teste de Westgard sobre múltiplas tentativas (cenário 1-3s + 2-2s + R-4s)
- [ ] Teste de snapshot imutável (deletar insumo → snapshot sobrevive no Attempt)
- [ ] Teste de logicalSignature (tentativa modificada → hash inválida)
- [ ] Teste de RTAction (RT aprova tentativa com motivo obrigatório)
- [ ] Teste unit para cada regra Westgard preservada
- [ ] Performance test: 100 tentativas em paralelo → todas persistidas com sucesso

---

## 9. Compatibilidade com Legado

### 9.1 Migração de Dados

- **Runs existentes** → permanecem em `/labs/{labId}/ciq-coagulacao/{lotId}/runs`
- **Cria-se** `/labs/{labId}/ciq-coagulacao-v2/{attemptId}` com tentativas novas
- **Não há migração retroativa** — dados legados preservados, acessíveis via painel histórico para auditoria
- **Lote legado** → convertido para `ControlOperacional` via script de migração (RT executa)

### 9.2 Coexistência Temporária

- Módulos de Hematologia, Uroanálise, Imunologia → continuam com arquitetura legado
- Apenas Coagulação migra para v2 (pode ser gradual)
- Componentes compartilhados (`ConferenciaInsumoAtivo`, `OverrideModal`, `EquipmentSetupPanel`) continuam funcionando

### 9.3 Serviços Preservados

- `writeCoagAuditRecord` → 100% preservado
- `useCoagSignature` → 100% preservado
- `computeCoagWestgard` → 100% preservado (função pura)
- `InsumoSnapshot` builder → 100% preservado
- `EquipamentoSnapshot` builder → 100% preservado

---

## 10. Filosofia de Implementação

### 10.1 Alvos

| Aspecto         | Alvo                                                            |
| --------------- | --------------------------------------------------------------- |
| Público         | Laboratório pequeno (1-5 operadores, 1 equipamento)             |
| Implementação   | DeepSeek Flash V4 gratuito (sem dependência de modelo grande)   |
| Agentes         | Múltiplos agentes trabalhando em paralelo em entidades isoladas |
| Carga cognitiva | Baixa — qualquer pessoa consegue operar em 5 minutos            |
| Previsibilidade | Alta — 3 estados, 3 eventos, regras claras                      |

### 10.2 Regras de Design

1. **Entidades mínimas:** 3 é o máximo. Qualquer proposta de 4ª entidade é rejeitada.
2. **Eventos mínimos:** 3 é o máximo. Qualquer proposta de 4º evento é rejeitada.
3. **Campos operacionais mínimos:** 6 no pior caso. Qualquer proposta de 7º campo é rejeitada.
4. **Zero heurística temporal:** nada que dependa de subscription para decidir o que renderizar.
5. **Zero acoplamento inter-agentes:** cada agente opera em entidades isoladas.
6. **Zero workflow explícito:** timeline narrativa substitui estados.

### 10.3 Prioridade Absoluta

> **Simplicidade operacional > Complexidade regulatória > Flexibilidade futura**

---

## 11. Próximos Passos

### 11.1 Após Aprovação

1. Criar `docs/coag-v2/attempt-spec.md` — spec detalhada da entidade Attempt
2. Criar `docs/coag-v2/control-operacional-spec.md` — spec do ControlOperacional
3. Criar `docs/coag-v2/rtaction-spec.md` — spec do RTAction
4. Criar `docs/coag-v2/ui-wireframes.md` — wireframes detalhados (Figma ou HTML)
5. Criar `docs/coag-v2/migration-plan.md` — plano de migração de legado para v2
6. Arquivar M001-CONTEXT.md + M001-ROADMAP.md

### 11.2 Execução

- **Onda A:** Implementar `ControlOperacional` (RT configura)
- **Onda B:** Implementar `Attempt` (operador cria)
- **Onda C:** Implementar `RTAction` (RT aprova/rejeita/NOTIVISA)
- **Onda D:** UI v2 + smoke E2E
- **Onda E:** Migração de legado + coexistência

---

## 12. Referência Rápida

| Pergunta                      | Resposta                                                         |
| ----------------------------- | ---------------------------------------------------------------- |
| O que o operador vê?          | "Qual controle + 3 resultados + ação corretiva se houver"        |
| O que o RT vê?                | KPIs, tentativas, violações, opções de aprovar/rejeitar/NOTIVISA |
| Quantas entidades?            | 3: ControlOperacional, Attempt, RTAction                         |
| Quantos eventos?              | 3: attempt.criado, controle.aprovado, controle.rejeitado         |
| Quantos campos operacionais?  | ≤ 6 no pior caso                                                 |
| Quantos estados por entidade? | 1-2 (ex: status + conformidade)                                  |
| Regras Westgard preservadas?  | 100% (6 regras CLSI)                                             |
| Snapshots preservados?        | 100% (insumo + reagente + equipamento)                           |
| Signature preservada?         | 100% (SHA-256 + canonical results)                               |
| Auditoria preservada?         | 100% (subcoleção imutável)                                       |

---

**Principio zero novamente:**

> O sistema deve ser simples o suficiente para que um colaborador entenda rapidamente, sem precisar compreender arquitetura interna.

Qualquer violação deste princípio derruba a proposta, independentemente do mérito técnico.
