# ADR 0001 — Arquitetura de espinhas (spines) para rastreabilidade RDC 978

- **Status:** Accepted
- **Data:** 2026-04-25
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

HC Quality (CQ Labclin) é um sistema de Controle Interno de Qualidade laboratorial em produção (https://hmatologia2.web.app). O escopo regulatório é ANVISA — laboratório de análises clínicas — e a meta é cobrir o ciclo completo exigido pela RDC vigente (referenciada internamente como RDC 978; texto exato a ser conferido no Diário Oficial antes de citação em manual da qualidade).

Hoje o app cobre quatro módulos CIQ (Hematologia, Imunologia, Coagulação, Uroanálise), Insumos com `chain-hash` em `/insumo-movimentacoes`, e Controle de Temperatura. A próxima onda de módulos previsível inclui:

- Compras / Qualificação de Fornecedores (Fase E)
- Equipamentos com calibração e manutenção (Fase D)
- Gestão de Pessoas com qualificações e RT
- Gestão de POPs / documentos vigentes
- Não-conformidades + CAPA
- Auditoria interna
- Indicadores da qualidade
- CIQ Bioquímica (5º módulo CIQ)
- CEQ / Ensaio de Proficiência
- Liberação de laudos + comunicação de resultados críticos
- LGPD / mapa de tratamento de dados pessoais

A RDC exige rastreabilidade ponta-a-ponta: dado um resultado emitido, o lab tem que provar **quem** fez **quando**, com **qual reagente/lote**, originado em **qual NF de qual fornecedor qualificado**, em **qual equipamento calibrado**, sob **qual versão de POP**. Auditor pode exigir reproduzir a cadeia de qualquer evento dos últimos 5 anos.

## Problema

Sem decisão arquitetural explícita, cada módulo novo tende a:

1. **Inventar a sua noção de "operador"** — copia campos do user (nome, cargo) no doc do resultado em vez de referenciar `uid`. Em 12 meses, "Maria Silva" vira "M Silva", "Maria S.", "Mª Silva" em diferentes coleções; relatório consolidado vira impossível.
2. **Inventar a sua noção de "lote"** — cada módulo guarda string livre `numeroLote`. Fornecedor não aparece. Auditor pergunta "todos os ensaios feitos com o lote X" e não há query possível.
3. **Inventar o seu audit log** — cada módulo loga do seu jeito. Cadeia única de imutabilidade exigida pela RDC fica fragmentada e refutável.

Em produtos médios (~100 mil docs/mês), esse débito vira inviável de refatorar depois sem migração custosa e janela de risco regulatório.

## Decisão

Adotar **monolito modular** com três princípios não-negociáveis:

### 1. Entidades-espinha (spines) compartilhadas

Existe um conjunto reduzido de entidades canônicas com **dono único** e **referência por id** em todos os módulos consumidores. As 8 spines, suas coleções e seus donos estão definidas em [reference/compliance-spines.md (skill)](../../../Users/labcl/.claude/skills/hc-quality/reference/compliance-spines.md):

| Spine | Dono | Coleção |
|---|---|---|
| Pessoa/Operador | Gestão de Pessoas | `/users` + `/labs/{labId}/members` + `/labs/{labId}/qualificacoes` |
| Fornecedor | Compras | `/labs/{labId}/fornecedores` |
| Nota Fiscal | Compras | `/labs/{labId}/notas-fiscais` |
| Lote rastreável | Estoque | `/labs/{labId}/insumos` |
| Movimentação assinada | infra | `/labs/{labId}/insumo-movimentacoes` |
| Equipamento | Equipamentos | `/labs/{labId}/equipamentos` |
| POP / documento vigente | Documentos | `/labs/{labId}/pops` |
| Não-conformidade (NC) | Qualidade | `/labs/{labId}/nao-conformidades` |
| Audit log assinado | infra | `/labs/{labId}/ciq-audit` + `/auditLogs` |

**Regra:** consumidor referencia spine por `id`. Snapshot de campos só com justificativa explícita de invariância histórica (ex: nome do reagente no laudo do passado deve permanecer mesmo após renomeação do produto). Snapshot sem justificativa documentada é bug.

**Critério para criar nova spine:** 3+ módulos vão consumir, ou a entidade tem regulamentação própria de retenção/auditoria. Caso contrário, fica encapsulada no módulo dono.

### 2. Padrão único de audit chain (HMAC + chain-hash)

A `chain-hash tamper-evident` que já protege `/insumo-movimentacoes` é o padrão **universal** para todo log sensível: qualificações de operador, calibrações de equipamento, transições de NC, aprovações de POP, liberação de laudos.

Implementação canônica:
1. Cliente cria doc com `status: 'pending'` + payload.
2. Cloud Function trigger calcula `prev_hash` da chain, aplica HMAC com secret rotativo, sela como `status: 'sealed'` + `chainHash`.
3. Rules permitem `pending → sealed` apenas via service (sem usuário direto).
4. Doc selado é imutável: nunca update, nunca delete.

Implementação de referência: [functions/src/insumos/](../../functions/src/insumos/) e [functions/src/audit/](../../functions/src/audit/).

### 3. Monolito modular, não micro-services

Um único deploy, uma única base Firestore, um único conjunto de Cloud Functions (organizadas por módulo dentro de `functions/src/`). Frontend continua single-bundle Vite + roteamento custom via Zustand.

## Alternativas consideradas

### Alternativa A — Micro-services (rejeitada)

Cada módulo como serviço independente com seu Firestore/banco e API própria.

**Por que rejeitada:**
- Lab de pequeno-médio porte não comporta o overhead operacional (cada serviço precisa de monitoring, deploy pipeline, secrets, oncall).
- Auditoria regulatória precisa ver **uma cadeia única** de eventos — distribuir entre serviços fragmenta a chain HMAC e enfraquece a evidência de imutabilidade.
- Time de 1 pessoa não escala para N serviços.

### Alternativa B — Cada módulo com schema próprio (status quo implícito)

Cada módulo define suas estruturas; integração via cópia de campos.

**Por que rejeitada:**
- Não atende RDC §rastreabilidade — não consegue responder "todos os ensaios com lote X em 2026".
- Diverge naming/casing entre módulos; relatórios consolidados ficam impossíveis sem ETL.
- Custo de refatoração cresce super-linearmente com o número de módulos. Adiar a decisão a torna inviável.

### Alternativa C — Spines + event sourcing puro (não escolhida agora, reavaliar futuramente)

Estado derivado 100% de eventos imutáveis; nenhuma "tabela de estado" mutável.

**Por que não agora:**
- Curva de implementação alta vs benefício marginal sobre o padrão "pending → sealed + estado projetado" já validado.
- Reavaliar quando entrar módulo de Indicadores: se a complexidade analítica exigir replay completo, vale subir o nível.

## Consequências

### Positivas

- Rastreabilidade ponta-a-ponta consultável por query (Firestore composto).
- Evidência regulatória defensável: chain única + HMAC + retenção.
- Reuso real de schema entre módulos — mudança em Pessoa propaga sem migração nos consumidores.
- Onboarding de módulo novo cai pra escopo bem-definido (consome spines X/Y, cria Z, segue padrão de audit).
- Auditoria de código fica viável: revisor vê o doc do schema canônico e checa que o módulo consome corretamente.

### Negativas

- Acoplamento de schema: mudança em spine afeta todos os consumidores. Mitigação: versionar schema da spine, evitar breaking changes (apenas aditivos sem migração; breaking exige migration plan + dual-write window).
- Dono da spine vira gargalo: PR em Compras pode bloquear time de outro módulo. Mitigação: conjunto de spines é fechado e pequeno, mudanças são raras após estabilização.
- Custo cognitivo: contribuidor precisa ler `compliance-spines.md` antes de criar coleção nova. Mitigação: SKILL.md aponta pra esse doc no boot; checklist de PR força revisão.

## Compromissos derivados (operacionais)

1. **Toda PR que cria coleção Firestore nova** referencia este ADR ou justifica por que o caso é estritamente interno ao módulo.
2. **Toda escrita sensível** (resultado clínico, transição de status auditável, aprovação) registra evento na chain antes ou em transaction com a escrita do estado.
3. **Nenhum schema canônico** muda sem PR explícita citando este ADR e listando consumidores afetados.
4. **Snapshots denormalizados** são marcados com comentário `// SNAPSHOT INTENCIONAL: <razão>`. Sem comentário, é considerado bug em code review.
5. **Migração de coleções existentes** para vincular spines (ex: Insumo passa a exigir `notaFiscalId` após Fase E) tem ADR próprio com plano de dual-write + cutover.

## Referências

- [reference/compliance-spines.md (skill)](../../../Users/labcl/.claude/skills/hc-quality/reference/compliance-spines.md) — schemas canônicos, donos, invariantes, padrões de cross-module reference
- [reference/modules-roadmap.md (skill)](../../../Users/labcl/.claude/skills/hc-quality/reference/modules-roadmap.md) — mapa RDC 978, status por módulo, dependências cruzadas
- [reference/firestore-model.md (skill)](../../../Users/labcl/.claude/skills/hc-quality/reference/firestore-model.md) — coleções deployadas, rules, índices
- [docs/plans/RASTREABILIDADE_INSUMOS_PLAN.md](../plans/RASTREABILIDADE_INSUMOS_PLAN.md) — plano original de rastreabilidade de insumos
- [CORRECTIONS.md](../../CORRECTIONS.md) — Ondas 1-5 (audit chain + rules strict)
