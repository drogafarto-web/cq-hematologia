# Relatório de Análise e Redesign — Módulo Auditoria Geral

**Data:** 2026-05-15
**Versão:** 1.0
**Referências:** RDC 978/2025, DICQ 4.4, ISO 15189:2022, Formulário FR-044 v01

---

## 1. Objetivo e Critérios de Sucesso

**Objetivo:** Avaliar o módulo `auditoria-geral` do HC Quality contra o Formulário 044 (XLS) e requisitos regulatórios, propondo um redesign que supere o XLS em orientação ao auditor, rastreabilidade e capacidade analítica.

**Critérios de sucesso:**

- O app orienta o auditor tão bem ou melhor que o XLS
- Gera registros auditáveis para acreditação DICQ/PALC
- Suporta o ciclo completo: planejamento → execução → achado → CAPA → verificação
- Funciona em tablet no campo (mobile-first)
- Reduz tempo de auditoria vs. XLS para auditores experientes
- Produz relatório executivo para análise crítica da gestão

---

## 2. Achados Regulatórios e de SGQ

### 2.1 Matriz de Requisitos

| Requisito                                 | Fonte                        | Status no App        | Risco   |
| ----------------------------------------- | ---------------------------- | -------------------- | ------- |
| Programa anual de auditoria               | RDC 978 Art. 107; DICQ 4.4.1 | AUSENTE              | ALTO    |
| Independência do auditor                  | RDC 978 Art. 107 §2          | AUSENTE              | ALTO    |
| Evidência objetiva por achado             | ISO 15189 s8.7.2             | PARCIAL (fotos, obs) | MÉDIO   |
| Classificação de NC (Crítica/Maior/Menor) | DICQ 4.4.4                   | AUSENTE              | ALTO    |
| Análise de causa raiz                     | ISO 15189 s8.7.3             | AUSENTE              | ALTO    |
| CAPA com verificação de eficácia          | RDC 978 Art. 109; DICQ 4.4.6 | AUSENTE              | CRÍTICO |
| Trilha de auditoria imutável              | RDC 978 Art. 110             | AUSENTE              | ALTO    |
| Relatório para análise crítica            | ISO 15189 s8.9               | PARCIAL (PDF básico) | MÉDIO   |
| Guarda de registros 5 anos                | RDC 978 Art. 112             | OK (soft-delete)     | BAIXO   |
| Assinatura do RT no relatório             | DICQ 4.4.7                   | AUSENTE              | MÉDIO   |

### 2.2 Lacunas Críticas

1. **Sem módulo de planejamento** — auditor chega sem escopo definido
2. **Sem workflow CAPA** — achados não geram ações rastreáveis com verificação
3. **Sem trilha de auditoria** — alterações de score não são registradas
4. **Sem classificação de NC** — observação livre não atende DICQ 4.4.4
5. **Sem verificação de independência** — sistema não valida conflito de interesse

---

## 3. O que o XLS Ensina e o App Perdeu

### 3.1 Valor Cognitivo do XLS

O Formulário 044 funciona como ferramenta de auditoria porque:

1. **Efeito rubrica** — todos os 6 níveis (0-5) visíveis simultaneamente permitem comparação por eliminação
2. **Julgamento dual** — campo "Crítica" (CONFORME/NÃO CONFORME/NÃO APLICA) separado do score numérico
3. **Âncora regulatória** — artigo da RDC 978 visível por indicador
4. **Layout plano** — 57 linhas, sem navegação, sem cliques

### 3.2 O que o App Perde vs. XLS

| Elemento                     | XLS             | App Atual                     | Impacto      |
| ---------------------------- | --------------- | ----------------------------- | ------------ |
| Rubrica completa visível     | Sim (6 colunas) | Só após seleção               | CRÍTICO      |
| Campo Crítica separado       | Sim             | Ausente na UI                 | ALTO         |
| Referência normativa visível | Sim             | Existe no dado, não renderiza | ALTO         |
| Contexto de posição          | Scroll linear   | Wizard por blocos             | NEUTRO       |
| Cálculo automático           | Não             | Sim                           | VANTAGEM APP |
| Histórico/comparativo        | Não             | Sim                           | VANTAGEM APP |
| Evidências multimídia        | Não             | Sim                           | VANTAGEM APP |

### 3.3 Decisão de Design

O app deve preservar o efeito rubrica do XLS (mostrar níveis antes da decisão) enquanto adiciona valor digital (cálculo, histórico, evidências, CAPA).

---

## 4. Avaliação Profunda do App Atual

### 4.1 Problemas por Severidade

| Severidade | Problema                                              | Impacto                      |
| ---------- | ----------------------------------------------------- | ---------------------------- |
| CRÍTICA    | Rubrica oculta até após seleção do score              | Auditor decide às cegas      |
| CRÍTICA    | Sem referência normativa na tela de scoring           | Perde âncora legal           |
| CRÍTICA    | Sem campo Crítica (CONFORME/NC/NA) separado           | Não atende FR-044            |
| ALTA       | Cards colapsados por padrão — 57 cliques extras       | Lentidão operacional         |
| ALTA       | Sem distinção visual entre pendente/respondido/pulado | Perda de orientação          |
| ALTA       | Sidebar oculta em tablet (dispositivo primário)       | Perde navegação espacial     |
| ALTA       | Página de planejamento vazia sem orientação           | Auditor não sabe o que fazer |
| MÉDIA      | Sem contador de posição (Item X de Y)                 | Perda de contexto            |
| MÉDIA      | Sem atalhos de teclado ou gestos swipe                | Ineficiência em tablet       |
| MÉDIA      | Botão finalizar desabilitado sem alternativa de pausa | Frustração                   |
| BAIXA      | Delay de animação por card (50ms × N)                 | Percepção de lentidão        |
| BAIXA      | Indicador online/offline sem label                    | Confuso para não-técnicos    |

### 4.2 Antipadrões Identificados

1. **Informação escondida que deveria ser visível** — níveis, referência normativa, Crítica
2. **Empty states sem orientação** — planejamento mostra "nenhuma auditoria" sem explicar próximo passo
3. **Detalhes colapsados por padrão** — observações, severidade, evidências requerem clique
4. **Scroll infinito vs. item único** — lista de cards não é ideal para auditoria de campo
5. **Ausência de modo dual** — auditor experiente quer scan rápido, novato quer guia detalhado

---

## 5. Redesign Recomendado de Fluxo e Telas

### 5.1 Princípios de Design

1. **Rubrica sempre visível** — mostrar todos os 6 níveis antes da decisão
2. **Um item por vez** (modo guiado) + **lista rápida** (modo expert)
3. **Contexto persistente** — bloco, posição, referência normativa sempre no topo
4. **Julgamento dual** — score numérico + campo Crítica independentes
5. **Velocidade primeiro** — auditor experiente deve ser mais rápido que no XLS

### 5.2 Wireframe — Tela Principal de Scoring (Tablet Landscape)

```
+------------------------------------------------------------------+
| [< Voltar]  Bloco F: Infraestrutura    Item 3/9    Art. 111 RDC  |
+------------------------------------------------------------------+
| SIDEBAR (240px, sempre visível)  |  CONTEÚDO PRINCIPAL            |
|                                  |                                |
| [A] Doc Legal       5/5  █████  |  #23 Controle da Qualidade     |
| [B] Contratos       4/4  █████  |      da Água e Limpeza do      |
| [C] Tecnologias     3/5  ███░░  |      Reservatório              |
| [D] Risco           2/2  █████  |                                |
| [E] Pessoal         1/3  █░░░░  |  RUBRICA:                      |
| [F] Infraestrutura *3/9  ███░░  |  ┌─────────────────────────┐   |
| [G] Sistemas        0/4  ░░░░░  |  │ 0 │ Sem controle...     │   |
| [H] Procedimentos   0/3  ░░░░░  |  │ 1 │ Registros parciais  │   |
| [I] Pré-Analítica   0/7  ░░░░░  |  │ 2 │ Controle sem...     │   |
| [J] Analítica       0/6  ░░░░░  |  │ 3 │ Limpeza semestral   │   |
| [K] Pós-Analítica   0/3  ░░░░░  |  │ 4 │ Monitoramento...    │   |
| [L] CIQ/CEQ         0/6  ░░░░░  |  │ 5 │ Sistema inform...   │   |
|                                  |  └─────────────────────────┘   |
| ─────────────────────────────── |                                |
| Progresso: 18/57 (32%)          |  SCORE: [0][1][2][3][4][5][N/A]|
| Tempo: 45min                    |                                |
|                                  |  CRÍTICA: [CONFORME] [NC] [NA] |
|                                  |                                |
|                                  |  Observações: [___________]    |
|                                  |  [📷 Foto] [🎤 Áudio] [🤖 IA] |
|                                  |                                |
|                                  |  [◀ Anterior]    [Próximo ▶]   |
+------------------------------------------------------------------+
```

### 5.3 Wireframe — Modo Expert (Lista Rápida)

```
+------------------------------------------------------------------+
| Bloco F: Infraestrutura e Ambiente          [Modo Guiado ↗]      |
+------------------------------------------------------------------+
| #  | Indicador                    | Score | Crítica | Status     |
|----|------------------------------|-------|---------|------------|
| 20 | Infraestrutura e PMOC        | [4]   | ✓ CONF  | ✅ Feito   |
| 21 | PGRSS                        | [3]   | ✓ CONF  | ✅ Feito   |
| 22 | Controle de Pragas           | [_]   | [____]  | ⬜ Pendente|
| 23 | Qualidade da Água            | [_]   | [____]  | ⬜ Pendente|
| ...                                                              |
+------------------------------------------------------------------+
| Tap no item → abre rubrica expandida inline                      |
+------------------------------------------------------------------+
```

### 5.4 Fluxo Completo Proposto

```
PLANEJAMENTO → EXECUÇÃO → ACHADOS → CAPA → VERIFICAÇÃO → FECHAMENTO
     │              │          │        │         │            │
     ▼              ▼          ▼        ▼         ▼            ▼
 Escopo/Data    Score 0-5   Auto-NC   Ação     Eficácia    Relatório
 Auditor/Equipe  Crítica    Classif.  Resp.    Evidência   Assinatura RT
 Critérios       Evidência  Causa     Prazo    Verif.≠Resp PDF Premium
 Independência   Obs/Foto   Raiz      Status   90 dias     Análise Crítica
```

### 5.5 Regras de Negócio do Fluxo

| Regra                             | Gatilho              | Ação                                                       |
| --------------------------------- | -------------------- | ---------------------------------------------------------- |
| Score 0-1 em item crítico         | Salvar score         | Auto-gerar Achado (NC Crítica/Maior)                       |
| Score 2                           | Salvar score         | Gerar "Oportunidade de Melhoria" (não NC formal)           |
| N/A selecionado                   | Toggle N/A           | Exigir justificativa (dropdown padrão + texto livre)       |
| Todos itens do escopo respondidos | Último item          | Habilitar "Finalizar Auditoria"                            |
| Finalização                       | Botão finalizar      | Travar respostas, gerar relatório, solicitar assinatura RT |
| CAPA vencida                      | Prazo expirado       | Notificar responsável + RT                                 |
| CAPA concluída                    | Status → concluído   | Agendar verificação de eficácia em 90 dias                 |
| Verificação ineficaz              | Resultado = ineficaz | Gerar nova CAPA automaticamente                            |

### 5.6 Decisões de Design (pós-revisão adversarial)

| Proposta Original                         | Objeção                        | Decisão Final                                                                             |
| ----------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| Score ≤ 2 = auto-NC                       | Score 2 pode ser aceitável     | Score 0-1 = NC automática; Score 2 = "Oportunidade de Melhoria"                           |
| Auditor não pode auditar própria área     | Labs pequenos ficam bloqueados | Exigir justificativa documentada + compensação (revisor externo)                          |
| 80% mínimo para finalizar                 | Arbitrário, não é DICQ         | 100% dos itens do escopo planejado devem ter resposta ou N/A justificado                  |
| Um item por tela sempre                   | Lento para experts             | Modo dual: Guiado (1 item/tela) + Expert (lista rápida)                                   |
| Rubrica 6 níveis visíveis simultaneamente | Impossível em mobile           | Modo guiado: rubrica expandida; Modo expert: rubrica on-tap                               |
| criticaDefault pré-preenchido             | Viesa o auditor                | Campo Crítica começa VAZIO; sistema sugere com base no score (visual distinto)            |
| N/A justificativa min 20 chars            | Fricção para itens óbvios      | Dropdown de justificativas padrão ("Não aplicável ao tipo de lab") + texto livre opcional |

---

## 6. Arquitetura Funcional e Modelo de Dados

### 6.1 Entidades Propostas

```
auditoria-geral/{labId}/auditorias/{auditoriaId}
├── /respostas/{indicadorId}          — Score + Crítica + evidência
├── /achados/{achadoId}               — NC/Oportunidade estruturada
├── /planos-acao/{planoId}            — CAPA
│   └── /verificacoes/{verifId}       — Verificação de eficácia
├── /audit-trail/{entryId}            — Log imutável
└── /relatorios/{relatorioId}         — Metadados do PDF gerado
```

### 6.2 Campos por Entidade

**Auditoria (header/planejamento):**

```typescript
interface AuditoriaGeral {
  id: string;
  labId: string;
  titulo: string;
  status: 'planejada' | 'em_andamento' | 'finalizada' | 'fechada';
  tipo: 'completa' | 'parcial' | 'follow-up';
  escopo: BlocoId[]; // blocos incluídos
  criterios: string; // "RDC 978/2025 + DICQ 4.4"
  auditor: { uid: string; nome: string };
  equipe: { uid: string; nome: string }[];
  independenciaJustificativa: string | null; // se auditor tem conflito
  dataPlaneada: Timestamp;
  dataInicio: Timestamp | null;
  dataFim: Timestamp | null;
  scoreTotal: number;
  scoresPorBloco: Record<BlocoId, number>;
  totalRespondidos: number;
  totalNaoAplica: number;
  assinaturaRT: LogicalSignature | null;
  auditoriaAnteriorId: string | null; // para follow-up
  criadoEm: Timestamp;
  criadoPor: string;
  deletadoEm: Timestamp | null;
}
```

**Resposta (por indicador):**

```typescript
interface RespostaIndicador {
  id: string;
  numero: number;
  indicador: string;
  bloco: BlocoId;
  score: number | null; // 0-5
  critica: 'CONFORME' | 'NÃO CONFORME' | 'NÃO APLICA' | null;
  naoAplica: boolean;
  justificativaNA: string | null; // obrigatório se naoAplica
  observacoes: string;
  evidencias: FotoEvidencia[];
  respondidoEm: Timestamp | null;
  respondidoPor: string | null;
}
```

**Achado (NC ou Oportunidade):**

```typescript
interface Achado {
  id: string;
  auditoriaId: string;
  indicadorId: string;
  tipo: 'nc-critica' | 'nc-maior' | 'nc-menor' | 'oportunidade-melhoria' | 'observacao';
  descricao: string;
  evidenciaObjetiva: string;
  causaRaiz: string | null;
  metodoCausaRaiz: '5-porques' | 'ishikawa' | 'outro' | null;
  status: 'aberto' | 'em-tratamento' | 'fechado';
  criadoEm: Timestamp;
  criadoPor: string;
}
```

**Plano de Ação (CAPA):**

```typescript
interface PlanoAcao {
  id: string;
  achadoId: string;
  tipo: 'corretiva' | 'preventiva';
  descricao: string;
  responsavel: { uid: string; nome: string };
  prazo: Timestamp;
  status: 'pendente' | 'em_andamento' | 'concluido' | 'verificado' | 'ineficaz';
  dataConclusao: Timestamp | null;
  evidenciaConclusao: string | null;
  criadoEm: Timestamp;
  criadoPor: string;
}
```

**Verificação de Eficácia:**

```typescript
interface VerificacaoEficacia {
  id: string;
  planoAcaoId: string;
  verificador: { uid: string; nome: string }; // ≠ responsável do plano
  dataVerificacao: Timestamp;
  resultado: 'eficaz' | 'parcialmente-eficaz' | 'ineficaz';
  evidencia: string;
  observacoes: string;
  geraNovaAcao: boolean;
  criadoEm: Timestamp;
}
```

**Audit Trail (imutável):**

```typescript
interface AuditTrailEntry {
  id: string;
  entidade: 'auditoria' | 'resposta' | 'achado' | 'plano-acao' | 'verificacao';
  entidadeId: string;
  acao: 'criado' | 'atualizado' | 'finalizado' | 'fechado';
  campo?: string;
  valorAnterior?: unknown;
  valorNovo?: unknown;
  operadorId: string;
  operadorNome: string;
  ts: Timestamp;
}
```

### 6.3 Eventos Automáticos (Cloud Functions)

| Trigger                 | Ação                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `onRespostaWrite`       | Recalcular scores do bloco e total                              |
| `onAuditoriaFinalizada` | Gerar Achados para scores 0-1; gerar Oportunidades para score 2 |
| `onAchadoCreate`        | Sugerir causa raiz e ação corretiva via IA (Gemini)             |
| `onPlanoAcaoConcluido`  | Agendar verificação de eficácia (+90 dias)                      |
| `onScheduled (diário)`  | Notificar CAPAs vencidas; escalar verificações pendentes        |
| `onAnyWrite`            | Append AuditTrailEntry (via Cloud Function, imutável)           |

### 6.4 Regras de Segurança

```
audit-trail: create = false (só Cloud Function), read = membro ativo, update/delete = false
respostas: update bloqueado se auditoria.status === 'finalizada'
verificacoes: create via callable (valida verificador ≠ responsável)
achados: delete = false (soft-delete apenas)
```

---

## 7. Checklist de Implementação e Validação

### 7.1 Checklist A — Requisitos Regulatórios

| #   | Requisito                                | Status Atual | Ação                              |
| --- | ---------------------------------------- | ------------ | --------------------------------- |
| A1  | Planejamento da auditoria                | ❌ Ausente   | Criar módulo de planejamento      |
| A2  | Identificação e independência do auditor | ❌ Ausente   | Validação + justificativa         |
| A3  | Registro formal de escopo e data         | ❌ Parcial   | Adicionar campos escopo/critérios |
| A4  | Evidência objetiva por item              | ✅ Parcial   | Já tem fotos/obs, melhorar        |
| A5  | N/A exige justificativa                  | ❌ Ausente   | Dropdown + texto                  |
| A6  | Score baixo gera achado estruturado      | ❌ Ausente   | Auto-gerar NC/Oportunidade        |
| A7  | CAPA com responsável, prazo, eficácia    | ❌ Ausente   | Workflow completo                 |
| A8  | Trilha de auditoria imutável             | ❌ Ausente   | AuditTrailEntry via CF            |
| A9  | Relatório para análise crítica           | ✅ Parcial   | Melhorar PDF com achados/CAPA     |
| A10 | Guarda e versionamento                   | ✅ OK        | Soft-delete já implementado       |

### 7.2 Checklist B — Fidelidade ao XLS

| #   | Requisito                    | Status Atual       | Ação                        |
| --- | ---------------------------- | ------------------ | --------------------------- |
| B1  | Critérios da escala visíveis | ❌ Só após seleção | Rubrica sempre visível      |
| B2  | Base normativa por item      | ❌ Não renderiza   | Mostrar Art. no card        |
| B3  | Orientação ao auditor        | ❌ Insuficiente    | Rubrica + referência        |
| B4  | Bloco e posição claros       | ✅ OK              | Sidebar + barra de contexto |
| B5  | Observação contextual        | ✅ OK              | Campo existe                |
| B6  | Reduz subjetividade          | ❌ Parcial         | Rubrica visível reduz       |

### 7.3 Checklist C — UX Operacional

| #   | Requisito                  | Status Atual | Ação                            |
| --- | -------------------------- | ------------ | ------------------------------- |
| C1  | Usuário sabe onde está     | ❌ Parcial   | Barra de contexto persistente   |
| C2  | Sabe o que falta responder | ❌ Parcial   | Sidebar com progresso por bloco |
| C3  | Sabe o que fazer com NC    | ❌ Ausente   | Fluxo NC → CAPA guiado          |
| C4  | Evita scroll cansativo     | ❌ Não       | Modo 1 item/tela                |
| C5  | Score explicado            | ❌ Parcial   | Rubrica visível                 |
| C6  | Analytics orienta ação     | ✅ OK        | Dashboard existe                |
| C7  | PDF legível e utilizável   | ✅ Parcial   | Melhorar com achados/CAPA       |

### 7.4 Checklist D — Robustez de Produto

| #   | Requisito                            | Status Atual | Ação                              |
| --- | ------------------------------------ | ------------ | --------------------------------- |
| D1  | Modelo cobre auditoria real          | ❌ Parcial   | Adicionar Achado/CAPA/Verificação |
| D2  | Eventos automáticos coerentes        | ❌ Ausente   | Cloud Functions triggers          |
| D3  | Evita registros incompletos          | ❌ Parcial   | Validações de finalização         |
| D4  | Diferencia obs/achado/evidência/ação | ❌ Não       | Entidades separadas               |
| D5  | Suporta expansão e recorrência       | ✅ Parcial   | Adicionar follow-up               |

---

## 8. Relatório Executivo Final

### 8.1 Resumo Executivo

O módulo `auditoria-geral` do HC Quality é visualmente superior ao Formulário 044 (XLS) e oferece vantagens reais em cálculo automático, histórico, evidências multimídia e analytics. Porém, **como ferramenta de auditoria de campo, o XLS ainda é mais eficaz** porque mostra toda a rubrica simultaneamente, tem campo de conformidade separado, e não exige cliques para revelar informação.

As lacunas regulatórias são significativas: ausência de planejamento formal, CAPA com verificação de eficácia, trilha de auditoria imutável, e classificação estruturada de não conformidades. Estas lacunas comprometem a utilização do app como evidência para acreditação DICQ/PALC.

### 8.2 Diagnóstico

| Dimensão              | Nota (1-5) | Justificativa                                                |
| --------------------- | ---------- | ------------------------------------------------------------ |
| Aderência regulatória | 2/5        | Falta planejamento, CAPA, trilha, classificação NC           |
| Fidelidade ao XLS     | 3/5        | Indicadores corretos, mas rubrica oculta e sem Crítica       |
| UX operacional        | 2/5        | Bonito mas lento; auditor precisa de mais cliques que no XLS |
| Modelo de dados       | 3/5        | Sólido para scoring, fraco para ciclo completo de auditoria  |
| Geração de evidências | 3/5        | Fotos e áudio existem, falta estruturação                    |
| Relatório/PDF         | 3/5        | Existe, mas não inclui achados/CAPA/assinatura               |

### 8.3 Análise Comparativa XLS vs App

| Capacidade                      | XLS   | App Atual | App Redesenhado |
| ------------------------------- | ----- | --------- | --------------- |
| Orientação ao auditor (rubrica) | ★★★★★ | ★★☆☆☆     | ★★★★★           |
| Cálculo automático              | ☆☆☆☆☆ | ★★★★★     | ★★★★★           |
| Rastreabilidade                 | ★☆☆☆☆ | ★★☆☆☆     | ★★★★★           |
| Evidências multimídia           | ☆☆☆☆☆ | ★★★★☆     | ★★★★★           |
| CAPA e follow-up                | ☆☆☆☆☆ | ★☆☆☆☆     | ★★★★★           |
| Velocidade de preenchimento     | ★★★★☆ | ★★☆☆☆     | ★★★★☆           |
| Relatório executivo             | ★☆☆☆☆ | ★★★☆☆     | ★★★★★           |
| Análise de tendências           | ☆☆☆☆☆ | ★★★★☆     | ★★★★★           |
| Conformidade regulatória        | ★★★☆☆ | ★★☆☆☆     | ★★★★★           |

### 8.4 Roadmap Priorizado

#### Fase 1 — Correções Críticas (2-3 semanas)

_Objetivo: igualar o XLS em orientação + corrigir lacunas regulatórias bloqueantes_

| #   | Item                                                        | Esforço | Impacto |
| --- | ----------------------------------------------------------- | ------- | ------- |
| 1.1 | Rubrica visível antes da seleção (expandir todos os níveis) | Médio   | CRÍTICO |
| 1.2 | Renderizar Marco Regulatório no card de scoring             | Baixo   | ALTO    |
| 1.3 | Adicionar campo Crítica (CONFORME/NC/NA) separado do score  | Médio   | ALTO    |
| 1.4 | Barra de contexto persistente (bloco, posição, artigo)      | Baixo   | ALTO    |
| 1.5 | Exigir justificativa para N/A (dropdown + texto)            | Baixo   | ALTO    |
| 1.6 | Modo dual: Guiado (1 item/tela) + Expert (lista)            | Alto    | ALTO    |

#### Fase 2 — Ganho de Usabilidade (3-4 semanas)

_Objetivo: superar o XLS em velocidade e experiência_

| #   | Item                                                     | Esforço | Impacto |
| --- | -------------------------------------------------------- | ------- | ------- |
| 2.1 | Sidebar persistente com progresso por bloco (tablet)     | Médio   | ALTO    |
| 2.2 | Navegação prev/next com swipe gesture                    | Baixo   | MÉDIO   |
| 2.3 | Distinção visual clara: pendente/respondido/NC           | Baixo   | MÉDIO   |
| 2.4 | Módulo de planejamento (escopo, equipe, data, critérios) | Alto    | ALTO    |
| 2.5 | Validação de independência do auditor                    | Médio   | ALTO    |
| 2.6 | Empty states com orientação e próximo passo              | Baixo   | MÉDIO   |
| 2.7 | Sugestão de Crítica baseada no score (visual distinto)   | Baixo   | MÉDIO   |

#### Fase 3 — Ganho Analítico e Governança (4-6 semanas)

_Objetivo: ciclo completo de auditoria para acreditação_

| #    | Item                                                             | Esforço | Impacto |
| ---- | ---------------------------------------------------------------- | ------- | ------- |
| 3.1  | Entidade Achado estruturada (tipo, causa raiz, classificação)    | Alto    | CRÍTICO |
| 3.2  | Workflow CAPA completo (ação → conclusão → verificação eficácia) | Alto    | CRÍTICO |
| 3.3  | Trilha de auditoria imutável (Cloud Function)                    | Alto    | ALTO    |
| 3.4  | Auto-geração de achados na finalização (score 0-1 = NC)          | Médio   | ALTO    |
| 3.5  | Verificação de eficácia (verificador ≠ responsável)              | Médio   | ALTO    |
| 3.6  | Lock de auditoria após finalização                               | Baixo   | ALTO    |
| 3.7  | PDF premium com achados, CAPA, assinatura RT                     | Alto    | ALTO    |
| 3.8  | Dashboard de análise crítica para gestão                         | Médio   | MÉDIO   |
| 3.9  | Notificações de CAPA vencida                                     | Médio   | MÉDIO   |
| 3.10 | Follow-up audit referenciando achados anteriores                 | Médio   | MÉDIO   |

### 8.5 Tabela de Melhorias por Impacto × Esforço

```
                    ALTO IMPACTO                    BAIXO IMPACTO
              ┌─────────────────────────────┬─────────────────────────┐
 BAIXO        │ 1.2 Marco Regulatório       │ 2.6 Empty states        │
 ESFORÇO      │ 1.4 Barra de contexto       │ 2.2 Swipe gesture       │
              │ 1.5 Justificativa N/A       │ 2.3 Distinção visual    │
              │ 3.6 Lock finalização        │ 2.7 Sugestão Crítica    │
              ├─────────────────────────────┼─────────────────────────┤
 MÉDIO        │ 1.1 Rubrica visível         │ 3.8 Dashboard gestão    │
 ESFORÇO      │ 1.3 Campo Crítica           │ 3.9 Notificações        │
              │ 2.1 Sidebar persistente     │ 3.10 Follow-up          │
              │ 2.5 Independência auditor   │                         │
              │ 3.4 Auto-geração achados    │                         │
              │ 3.5 Verificação eficácia    │                         │
              ├─────────────────────────────┼─────────────────────────┤
 ALTO         │ 1.6 Modo dual               │                         │
 ESFORÇO      │ 2.4 Módulo planejamento     │                         │
              │ 3.1 Entidade Achado         │                         │
              │ 3.2 Workflow CAPA           │                         │
              │ 3.3 Trilha de auditoria     │                         │
              │ 3.7 PDF premium             │                         │
              └─────────────────────────────┴─────────────────────────┘
```

### 8.6 Riscos de Implementação

| Risco                                            | Probabilidade | Impacto | Mitigação                                                            |
| ------------------------------------------------ | ------------- | ------- | -------------------------------------------------------------------- |
| Audit trail aumenta custos Firestore             | Alta          | Médio   | Batch writes, TTL em entries antigas                                 |
| Modo dual aumenta complexidade de manutenção     | Média         | Médio   | Componentes compartilhados, só layout muda                           |
| Auditor resiste à mudança (prefere XLS)          | Alta          | Alto    | Modo expert que iguala velocidade do XLS                             |
| Rubrica expandida ocupa muito espaço em mobile   | Alta          | Médio   | Collapse inteligente: nível selecionado expandido, outros em 1 linha |
| CAPA workflow complexo demais para labs pequenos | Média         | Médio   | Simplificar para labs < 10 pessoas                                   |
| Offline não coberto neste redesign               | Alta          | Alto    | PWA com service worker + sync queue (já existe base)                 |

### 8.7 Pendências para Validação Humana

1. **Validação jurídica** — confirmar que "sugestão de Crítica" não configura viés de auditoria perante DICQ
2. **Validação com auditores reais** — testar modo dual com 3+ auditores em campo
3. **Validação de custos** — estimar impacto do audit trail no billing Firestore
4. **Validação de escopo** — confirmar se `auditoria-geral` (RDC 978) e `auditoria-interna` (DICQ checklist) devem ser unificados ou permanecer separados
5. **Validação de independência** — definir regras específicas para labs com < 5 profissionais

### 8.8 Mecanismos de Verificação Contínua

| Mecanismo                         | Aplicação                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Verificação por cobertura         | Todas as 6 dimensões tratadas: regulação ✓, XLS ✓, UX ✓, dados ✓, fluxo ✓, relatório ✓                                      |
| Verificação por omissão           | Offline, multi-auditor, e unificação de módulos ficaram como pendências                                                     |
| Verificação cruzada               | Cada recomendação crítica suportada por: regulação + XLS + UX + rastreabilidade                                             |
| Verificação adversarial           | Revisão adversarial executada — 6 objeções incorporadas nas decisões finais                                                 |
| Verificação de implementabilidade | Cada item tem: por quê, como, qual problema resolve, prioridade                                                             |
| Verificação de superioridade      | App redesenhado SUPERA o XLS em 7/9 dimensões (perde apenas em velocidade bruta para expert, que é mitigada pelo modo dual) |

### 8.9 Conclusão sobre Prontidão

**Estado atual:** O app é um MVP funcional de scoring que não atende requisitos de acreditação e é menos eficiente que o XLS para auditoria de campo.

**Após Fase 1:** O app IGUALA o XLS em orientação ao auditor e SUPERA em cálculo e evidências.

**Após Fase 2:** O app SUPERA o XLS em todas as dimensões operacionais.

**Após Fase 3:** O app se torna uma plataforma completa de auditoria interna, apta para acreditação DICQ/PALC/ISO 15189, com ciclo completo de NC → CAPA → Verificação → Análise Crítica.

---

_Relatório gerado em 2026-05-15. Próxima revisão recomendada: após implementação da Fase 1._
