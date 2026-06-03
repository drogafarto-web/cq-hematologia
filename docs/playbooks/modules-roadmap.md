# HC Quality — Mapa de módulos da RDC 978

> **Como usar este doc:** ao começar trabalho num módulo novo, abra a seção dele aqui antes de codar. Confira:
>
> 1. Quais spines de [compliance-spines.md](compliance-spines.md) o módulo consome (não duplique).
> 2. Quais spines o módulo cria/possui.
> 3. Dependências de módulos anteriores que precisam estar minimamente prontos.
>
> **Não é cronograma.** É mapa de dependências + escopo regulatório. A ordem de execução o CTO define.
>
> **Verificar referência regulatória** contra texto vigente da ANVISA antes de citar artigos em POP/manual da qualidade.

---

## Legenda

- ✅ **deployed** — em produção
- 🟡 **parcial** — existe mas falta pedaço crítico
- 🔵 **planejado** — escopo definido, não iniciado
- ⚪ **a especificar** — só o conceito existe

---

## 1. Sistema da Qualidade (núcleo regulatório)

### 1.1 Gestão de documentos (POP, IT, manuais) — ⚪

**Spines envolvidas:** dono de **POP**.
**Dependências:** Pessoas (quem aprova).
**Escopo mínimo:** versionamento, vigência, hash do conteúdo, assinatura de aprovação RT, treinamento atrelado à versão.
**Por que importa cedo:** sem POP versionado referenciável, módulos técnicos não conseguem congelar "qual procedimento foi usado" no laudo.

### 1.2 Não-conformidades + CAPA — ⚪

**Spines:** dono de **NC**.
**Dependências:** Pessoas, audit log.
**Escopo:** abertura por qualquer módulo, fluxo investigação → ação → eficácia, gate de bloqueio para severidade crítica.

### 1.3 Auditoria interna — ⚪

**Spines:** consome NC, POP, Pessoas.
**Escopo:** checklist por área, achados viram NCs, plano anual.

### 1.4 Indicadores da qualidade — ⚪

**Spines:** consome dados de todos os módulos técnicos + NC.
**Escopo:** dashboard de KPIs (% retrabalho, tempo médio liberação, taxa NC por origem, etc).
**Por que depois:** depende de massa crítica de dados nos outros módulos.

---

## 2. Recursos Humanos / Gestão de Pessoas

### 2.1 Cadastro + RT + qualificações — 🟡

**Spines:** dono de **Pessoa/Operador**.
**Status atual:** `/users` + `/members` existem com role/active. Falta `/qualificacoes`, RT único, conselho profissional.
**Próximo passo lógico:** estender schema (ver [compliance-spines.md §1](compliance-spines.md)) e CF de validação RT-único-por-lab.
**Bloqueia:** todo módulo técnico que precise validar habilitação do operador.

### 2.2 Treinamentos + reciclagem — ⚪

**Spines:** consome Pessoa, POP.
**Escopo:** registro de treinamento por POP versionado, evidência (certificado, ata), validade, alerta de reciclagem.

---

## 3. Infraestrutura

### 3.1 Mapeamento de áreas + biossegurança — ⚪

**Status:** módulo **Controle de Temperatura (CT)** já cobre a parte de monitoramento ambiental crítico ✅ (FR-11 deployed 2026-04-24).
**Falta:** registro físico das áreas (sala, fluxo, classificação NB1/NB2), PGRSS (descarte), check de EPIs.
**Decisão pendente:** vira módulo separado ou fica dentro de Qualidade?

### 3.2 PGRSS (descarte) — ⚪

**Spines:** consome Equipamento (descarte de RSS), Pessoa, NC.
**Escopo:** registro de geração, segregação, coleta, comprovantes.

---

## 4. Equipamentos

### 4.1 Cadastro + ciclo de vida — 🔵 (Fase D no firestore-model)

**Spines:** dono de **Equipamento**.
**Coleção:** `/equipamentos` + `/equipamentos-audit` (já reservadas).
**Escopo:** ativo → manutenção → aposentado, retenção 5a, qualificação inicial, calibração periódica.
**Bloqueia:** todo módulo técnico que emite laudo precisa carimbar `equipamentoId` na corrida.

### 4.2 Calibração + manutenção — 🔵

**Spines:** consome Equipamento, Fornecedor (provedor de serviço de calibração), NC (quando reprovado).
**Escopo:** agenda de calibração, certificado anexado, gate quando atrasada.

---

## 5. Insumos / Reagentes / Estoque

### 5.1 Catálogo de produtos — ✅ parcial

**Coleção:** `/produtos-insumos`.
**Status:** existe (Fase C).

### 5.2 Lotes + movimentação rastreável — ✅

**Spines:** dono de **Lote** + **Movimentação assinada**.
**Status:** `/insumos` + `/insumo-movimentacoes` (chain-hash) live em prod.
**Falta:** vincular `notaFiscalId` + `fornecedorId` obrigatórios após Fase E (Compras).
**Bug conhecido:** crash em `diasEstabPosAbertura` no `NovoLoteModal`.

### 5.3 Compras / Qualificação de Fornecedores — 🔵 (Fase E)

**Spines:** dono de **Fornecedor** + **Nota Fiscal**.
**Coleções:** `/fornecedores` + `/notas-fiscais` (já reservadas).
**Escopo:** qualificação com evidências, requalificação anual, cadastro de NF, conferência no recebimento, geração automática de Lote a partir de item da NF.
**Bloqueia rastreabilidade completa:** sem isso, Lote em 5.2 fica órfão (não tem origem legal).

---

## 6. Pré-analítico

### 6.1 Cadastro paciente / requisição — ⚪

**Status:** fora de escopo do CIQ atual. Possivelmente integração com LIS terceiro.
**Decisão:** confirmar se HC Quality vai cobrir ou só consumir referência externa.

### 6.2 Coleta + transporte — ⚪

**Spines:** consome Pessoa, POP, Equipamento (centrífuga, geladeira de transporte).

---

## 7. Analítico (CIQ)

### 7.1 CIQ Hematologia (quantitativo) — ✅

**Status:** prod, `/lots` + `/runs`.

### 7.2 CIQ Imunologia (qualitativo R/NR) — ✅

**Status:** prod, `/ciq-imuno`. Flag `manual:true` no Tipo de Teste destrava `ManualKitPicker`.

### 7.3 CIQ Coagulação — ✅

**Status:** prod, `/ciq-coagulacao`.

### 7.4 CIQ Uroanálise (híbrido) — ✅

**Status:** prod, `/ciq-uroanalise`.

### 7.5 CIQ Bioquímica — ⚪

**Status:** não iniciado.
**Padrão:** seguir Hematologia (quantitativo).

### 7.6 CEQ (Controle Externo / Ensaio de Proficiência) — ⚪

**Spines:** consome Lote, Equipamento, POP, Pessoa.
**Escopo:** cadastro de programa externo (ControlLab, etc), envio, recebimento de resultados, análise comparativa, NC se desvio.

### 7.7 Validação de métodos / verificação de desempenho — ⚪

**Escopo:** linearidade, precisão, exatidão, comparação, intervalo de referência.

---

## 8. Pós-analítico

### 8.1 Liberação de laudos — ⚪

**Spines:** consome Pessoa (liberador habilitado), Equipamento, Lote, POP.
**Escopo:** dupla checagem para resultados críticos, comunicação de críticos, retenção 5a.

### 8.2 Comunicação de resultados críticos — ⚪

**Spines:** consome Pessoa.
**Escopo:** lista de testes/limites críticos por módulo, registro de comunicação (quem avisou, quem recebeu, quando).

### 8.3 Arquivo + biorrepositório — ⚪

**Escopo:** retenção de amostras, soros, controles. Cruza com módulo Estoque mas é coleção própria.

---

## 9. Atendimento ao cliente

### 9.1 Reclamações + satisfação — ⚪

**Spines:** abre NC quando aplicável.

---

## 10. Continuidade e segurança da informação

### 10.1 Backup + DR — ✅ parcial

**Status:** `/firestore-backup-logs` + `/backup-logs` existem.
**Falta:** plano formal de DR documentado, teste de restore periódico.

### 10.2 LGPD — 🟡

**Status:** `cpfHash` mencionado no schema, audit log existe.
**Falta:** mapa de tratamento de dados pessoais, consentimento, política de privacidade exposta, processo de exclusão por solicitação do titular.

---

## Dependências cruzadas — ordem natural

Não é prescrição, é o "menor caminho" considerando bloqueios de spine:

```
1. Pessoas completa (RT, qualificações)        → desbloqueia validação de habilitação
2. POPs                                          → desbloqueia "qual procedimento foi usado"
3. Compras (Fornecedor + NF)                     → fecha rastreabilidade do Lote
4. Equipamentos                                  → carimba laudo com equipId
5. Não-conformidades                             → ponto único de tratamento de desvios
6. Calibração + manutenção                       → consome Equipamento + Fornecedor + NC
7. Liberação de laudos + críticos                → consome tudo acima
8. Indicadores                                   → consome dados gerados
9. Auditoria interna                             → consome processos consolidados
```

CIQ (já em prod) e CT (já em prod) são "ilhas" que vão ser puxadas para o tronco quando 1-4 estiverem prontos (refatoração para consumir spines em vez de duplicação).

---

## Princípio operacional

Antes de começar um módulo novo:

1. Abre seção correspondente aqui.
2. Confere quais spines em [compliance-spines.md](compliance-spines.md) ele consome ou cria.
3. Se cria nova spine: justifica pela regra dos 3+ consumidores.
4. Se consome: reusa schema canônico, **nunca** duplica.
5. Atualiza o status (⚪ → 🔵 → 🟡 → ✅) neste doc após deploy.

---

## 🔗 Conexões Centrais

- [[HC_Quality]]
