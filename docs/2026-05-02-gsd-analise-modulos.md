# HC Quality — Análise de Módulos + Integração GSD

**Data:** 2026-05-02  
**Contexto:** Instalação GSD framework v1.39.1; Mapeamento de módulos pendentes para HC Quality

---

## Situação Atual

### Módulos em Produção ✅

| Módulo                      | Status      | Coleção/Caminho            | Notas                                |
| --------------------------- | ----------- | -------------------------- | ------------------------------------ |
| **CIQ Hematologia**         | ✅ deployed | `/lots`, `/runs`           | Quantitativo                         |
| **CIQ Imunologia**          | ✅ deployed | `/ciq-imuno`               | Qualitativo R/NR                     |
| **CIQ Coagulação**          | ✅ deployed | `/ciq-coagulacao`          | -                                    |
| **CIQ Uroanálise**          | ✅ deployed | `/ciq-uroanalise`          | Híbrido                              |
| **Controle de Temperatura** | ✅ deployed | FR-11                      | Monitoramento ambiental (2026-04-24) |
| **Insumos/Lotes**           | ✅ deployed | `/insumos`                 | Chain-hash vivo                      |
| **Movimentação Insumos**    | ✅ deployed | `/insumo-movimentacoes`    | Assinada, rastreável                 |
| **Catálogo Produtos**       | ✅ deployed | `/produtos-insumos`        | Fase C                               |
| **Audit Log**               | ✅ deployed | `/ciq-audit`, `/auditLogs` | Assinado, LGPD                       |
| **Firestore Backup**        | ✅ deployed | `/firestore-backup-logs`   | Lifecycle 5y, retention 1825d        |

---

## Módulos Parciais 🟡 (Completar)

### 2.1 Pessoas / Gestão de RH

**Status:** Fragmentado  
**Coleções:** `/users` + `/labs/{labId}/members`  
**O que existe:**

- `User` com uid, email, nome, role
- `Member` com active, role

**O que falta:**

- ❌ `/qualificacoes` coleção nova (treinamento, capacitação, reciclagem)
- ❌ `cpfHash` (LGPD) — mencionado mas não uniformizado
- ❌ `cargo` estruturado ("Biomédica RT", "Técnica em análises")
- ❌ `conselhoProfissional` (CRBM, CRF, CRM, CRBio + número + UF)
- ❌ `responsavelTecnico` — único por lab (invariante + rule)
- ❌ Treinamentos + reciclagem com validade e alerta
- ❌ Associação Pessoa ↔ Qualificação ↔ Módulo habilitado

**Bloqueador:** Módulos técnicos não conseguem validar habilitação do operador  
**ADR alvo:** 0006 (Pessoa completa — qualificações + LGPD)  
**Violações de spine:** V-002, V-005

---

### 2.2 LGPD / Privacidade

**Status:** Parcial  
**O que existe:**

- `cpfHash` mencionado no schema
- Audit log existente
- Backup estruturado

**O que falta:**

- ❌ Política de privacidade exposta (termos)
- ❌ Processo de exclusão por solicitação de titular
- ❌ Mapa de tratamento de dados pessoais
- ❌ Consentimento estruturado

**Impacto:** Audit compliance 2026, requisito legal

---

## Módulos Planejados 🔵 (Escopo definido, não iniciado)

### 4.1 Equipamentos — Cadastro + Ciclo de Vida

**Fase:** D  
**Coleções:** `/labs/{labId}/equipamentos`, `/equipamentos-audit` (reservadas)  
**Escopo:**

- ✓ Registro: ativo → manutenção → aposentado
- ✓ Retenção 5 anos
- ✓ Qualificação inicial (não é calibração)
- ✓ `equipamentoId` carimbo em cada laudo CIQ
- ✓ Próxima calibração, próxima manutenção preventiva estruturadas

**Bloqueador:** Módulos técnicos não conseguem carimbar `equipamentoId`  
**ADR alvo:** 0007 (Equipamento completo)  
**Violações de spine:** V-008, V-010

---

### 4.2 Equipamentos — Calibração + Manutenção

**Status:** Depende de 4.1  
**Consumidores:** Equipamento (próprio), Fornecedor (provedor serviço), NC (reprovado)  
**Escopo:**

- ✓ Agenda de calibração periódica
- ✓ Certificado anexado
- ✓ Gate quando atrasada (bloqueia uso)

---

### 5.3 Compras / Qualificação de Fornecedores

**Fase:** E  
**Coleções:** `/labs/{labId}/fornecedores`, `/labs/{labId}/notas-fiscais` (reservadas)  
**Escopo:**

- ✓ Qualificação com evidências
- ✓ Requalificação anual
- ✓ Cadastro de Nota Fiscal
- ✓ Conferência no recebimento
- ✓ Geração automática de Lote a partir de item NF
- ✓ Status fornecedor: pendente → qualificado → suspenso → desqualificado

**Bloqueador:** Sem isso, Lote em 5.2 fica órfão (não tem origem legal)  
**ADR alvo:** 0002 (Lote ↔ NF obrigatório + backfill)  
**Violações de spine:** V-003, V-006, V-007, V-012

**Bug conhecido:** Crash em `diasEstabPosAbertura` no `NovoLoteModal`

---

## Módulos a Construir ⚪ (Apenas conceito — 18 módulos)

### Sistema de Qualidade (Núcleo regulatório)

#### 1.1 Gestão de Documentos (POPs, ITPs, manuais)

- **Spines:** Dono de **POP**
- **Dependências:** Pessoas (quem aprova)
- **Escopo mínimo:**
  - Versionamento (v1.0, v1.1, etc)
  - Data de vigência / data de próxima revisão
  - Hash do conteúdo (rastreabilidade)
  - Assinatura de aprovação por RT
  - Qual treinamento é atrelado a qual versão do POP
  - Coleção: `/labs/{labId}/pops` (novo)
- **Por que importa cedo:** Sem POP versionado referenciável, módulos técnicos não conseguem congelar "qual procedimento foi usado" no laudo

#### 1.2 Não-conformidades (NC) + CAPA

- **Spines:** Dono de **NC**
- **Dependências:** Pessoas, audit log
- **Escopo:**
  - Abertura por qualquer módulo (CIQ ou manual)
  - Fluxo: descrição → investigação → ação corretiva → eficácia → fechamento
  - Gate de bloqueio para severidade crítica (bloqueia operação)
  - Rastreabilidade: quem abriu, quando, categoria, módulo origem
  - Coleção: `/labs/{labId}/nao-conformidades` (novo)
- **Violações spine:** V-001 (NC fragmentada — CT tem própria)

#### 1.3 Auditoria Interna

- **Spines:** Consome NC, POP, Pessoas
- **Escopo:**
  - Checklist por área
  - Achados viram NCs automaticamente
  - Plano anual
  - Registros históricos (5 anos)

#### 1.4 Indicadores de Qualidade (KPI Dashboard)

- **Spines:** Consome dados de todos os módulos técnicos + NC
- **Escopo:**
  - % retrabalho por módulo CIQ
  - Tempo médio de liberação
  - Taxa de NC por origem
  - Taxa de aceitação CEQ
  - Disponibilidade equipamento (manutenção)
- **Por que depois:** Depende de massa crítica de dados nos outros módulos

---

### Recursos Humanos (Continuação)

#### 2.2 Treinamentos + Reciclagem

- **Spines:** Consome Pessoa, POP
- **Escopo:**
  - Registro de treinamento por versão do POP
  - Evidência (certificado, ata)
  - Validade (datas de, até, com alerta de reciclagem)
  - Associação: pessoa X treinado em POP Y, válido até Z
  - Bloqueia operação se reciclagem vencida para módulo X

---

### Infraestrutura

#### 3.1 Mapeamento de Áreas + Biossegurança

- **Status:** CT já cobre monitoramento ambiental ✅
- **Falta:**
  - Registro físico das áreas (sala, setor, fluxo)
  - Classificação nível biossegurança (NB1, NB2, etc)
  - Check de EPIs por área
  - Higiene de mãos / controle acesso
- **Decisão pendente:** Módulo separado ou dentro de Qualidade?

#### 3.2 PGRSS (Gerenciamento de Resíduos)

- **Spines:** Consome Equipamento (descarte RSS), Pessoa, NC
- **Escopo:**
  - Registro de geração (soro, resíduo, material perfurocortante)
  - Segregação conforme RDC 306
  - Coleta externa (agendamento, comprovante)
  - Rastreabilidade até destino final

---

### Equipamentos (Continuação)

#### 4.1 Equipamentos — Cadastro + Ciclo de Vida

**→ Ver seção "Planejados" acima (🔵)**

#### 4.2 Equipamentos — Calibração + Manutenção

**→ Ver seção "Planejados" acima (🔵)**

---

### Pré-analítico

#### 6.1 Cadastro Paciente / Requisição

- **Status:** Fora de escopo do CIQ atual
- **Decisão:** HC Quality vai cobrir ou só consumir referência externa (ex: LIS terceiro)?
- **Impacto:** Define se tem coleção própria ou integração API

#### 6.2 Coleta + Transporte

- **Spines:** Consome Pessoa, POP, Equipamento (centrífuga, geladeira transporte)
- **Escopo:**
  - Protocolo de coleta por tipo amostra
  - Transporte rastreado
  - Recebimento validado

---

### Analítico — Expansão CIQ

#### 7.5 CIQ Bioquímica

- **Status:** ⚪ não iniciado
- **Padrão:** Seguir Hematologia (quantitativo)
- **Dependências:** Equipamento ativo, Lote + validade, POP vigente, Operador qualificado

#### 7.6 CEQ (Controle Externo / Ensaio de Proficiência)

- **Spines:** Consome Lote, Equipamento, POP, Pessoa
- **Escopo:**
  - Cadastro de programa externo (ControlLab, Qualitrol, etc)
  - Envio de amostras
  - Recebimento de resultados
  - Análise comparativa (Z-score, etc)
  - NC automática se desvio > 2σ
  - Rastreamento de participação obrigatória

#### 7.7 Validação de Métodos / Verificação de Desempenho

- **Escopo:**
  - Linearidade, precisão, exatidão
  - Comparação com método referência
  - Intervalo de referência (população local vs fornecedor)
  - Documentação sistemática

---

### Pós-analítico

#### 8.1 Liberação de Laudos

- **Spines:** Consome Pessoa (liberador habilitado), Equipamento, Lote, POP
- **Escopo:**
  - Dupla checagem para resultados críticos
  - Fluxo: análise → revisão → aprovação → liberação
  - Bloqueio se resultado crítico sem liberador qualificado
  - Retenção 5 anos (Firestore)

#### 8.2 Comunicação de Resultados Críticos

- **Spines:** Consome Pessoa
- **Escopo:**
  - Lista de testes/limites críticos por módulo CIQ
  - Registro de comunicação (quem avisou, quem recebeu, timestamp, meio)
  - Rastreamento compulsório para RDC

#### 8.3 Arquivo + Biorrepositório

- **Escopo:**
  - Retenção de amostras (soro, plasma, células)
  - Retenção de controles e reagentes
  - Retenção de meios de cultura
  - Localização física (geladeira, freezer -20/-80)
  - Data de destruição

---

### Atendimento ao Cliente

#### 9.1 Reclamações + Satisfação

- **Spines:** Abre NC quando aplicável
- **Escopo:**
  - Canal de reclamação (email, telefone, form)
  - Registro e rastreamento
  - Análise de causa raiz
  - Ação corretiva se necessário
  - Comunicação de resolução

---

### Continuidade e Segurança da Informação

#### 10.1 Backup + DR

- **Status:** `/firestore-backup-logs` + `/backup-logs` existem (Lifecycle 5y, retention 1825d)
- **Falta:**
  - Plano formal de DR documentado
  - Teste de restore periódico (a cada 6 meses)
  - Runbook de recuperação (RTO, RPO)
  - Validação de integridade (checksum)

#### 10.2 LGPD

**→ Ver seção "Parciais" acima (🟡)**

---

## Bloqueadores Técnicos — Violações de Spine RDC 978

**13 violações identificadas no audit 2026-04-25**  
**Precisam de 7 ADRs para fechar gaps**

| #         | Sev | Spine       | Descrição                                                    | ADR alvo | Status  |
| --------- | --- | ----------- | ------------------------------------------------------------ | -------- | ------- |
| **V-001** | 🔴  | NC          | Fragmentada — CT tem própria                                 | 0003     | ⬜ Open |
| **V-002** | 🔴  | Pessoa      | Sem qualificacoes[], cpfHash, cargo estruturado              | 0006     | ⬜ Open |
| **V-003** | 🔴  | Lote        | notaFiscalId, fornecedorId opcionais                         | 0002     | ⬜ Open |
| **V-004** | 🟠  | POP         | Não gravado em runs CIQ                                      | 0004     | ⬜ Open |
| **V-005** | 🟠  | Pessoa      | Sem cpfHash, conselhoProfissional, cargo                     | 0006     | ⬜ Open |
| **V-006** | 🟠  | NF          | Sem itens[], conferenciaOk, desviosObservados                | 0002     | ⬜ Open |
| **V-007** | 🟠  | Fornecedor  | Sem status qualificação, evidencias[], proximaRequalificacao | 0002     | ⬜ Open |
| **V-008** | 🟡  | Equipamento | Falta qualificacaoInicial, proximaCalibracao                 | 0007     | ⬜ Open |
| **V-009** | 🟡  | Audit       | HMAC + chainHash duplicado em 2 arquivos                     | 0005     | ⬜ Open |
| **V-010** | 🟡  | Equipamento | CIQ-Imuno usa string, não FK equipamentoId                   | 0007     | ⬜ Open |
| **V-011** | 🟡  | POP         | Coagulação não grava popId                                   | 0004     | ⬜ Open |
| **V-012** | 🟡  | NF          | Sem NFItem[] estruturado                                     | 0002     | ⬜ Open |
| **V-013** | ⚪  | Naming      | Inconsistência operatorId vs createdBy                       | —        | ⬜ Open |

### ADRs Pendentes (Ordem sugerida)

1. **ADR 0005** — Helper `cryptoAudit` compartilhado (V-009)
   - Objetivo: Eliminar duplicação HMAC + chainHash
   - Risco: Baixíssimo
2. **ADR 0002** — Lote ↔ NF obrigatório + backfill (V-003, V-006, V-007, V-012)
   - Objetivo: Rastreabilidade fiscal
   - Escopo: Schema + dados legados
3. **ADR 0003** — Spine NC global (V-001)
   - Objetivo: Unificar NC entre módulos
   - Escopo: Refatoração do `NaoConformidadeTemp` em CT
4. **ADR 0006** — Pessoa completa (V-002, V-005)
   - Objetivo: Qualificações + LGPD
   - Escopo: Schema novo + migrações
5. **ADR 0004** — POP / documento vigente (V-004, V-011)
   - Objetivo: POP versionado referenciável
   - Escopo: Integração ampla (todos módulos CIQ)
6. **ADR 0007** — Equipamento completo (V-008, V-010)
   - Objetivo: Qualificação + calibração + audit chain
   - Escopo: Refatoração calibração (CT → Equipamento)

---

## Ordem Natural de Execução (Grafo de Dependências)

```
1. Pessoas completa (RT, qualificações)          → desbloqueia validação habilitação
2. POPs                                          → desbloqueia "qual POP foi usado"
3. Compras (Fornecedor + NF)                     → fecha rastreabilidade Lote
4. Equipamentos                                  → carimba laudo com equipId
5. Não-conformidades                             → ponto único tratamento desvios
6. Calibração + manutenção                       → consome Equipamento + Fornecedor
7. Liberação de laudos + críticos                → consome tudo acima
8. Indicadores                                   → consome dados gerados
9. Auditoria interna                             → consome processos consolidados
```

---

## Integração com GSD Framework

**GSD installado:** v1.39.1 em `~/.claude/` (2026-05-02)  
**Stack GSD:** 65 skills + hooks de segurança (prompt injection guard, read-before-edit, workflow guard)  
**Plano:** Estruturar HC Quality em GSD usando milestones + specs de compliance

### Workflow recomendado por módulo novo

Para cada módulo (ex: POPs):

1. **`/gsd-new-milestone`** — Criar milestone dentro do HC Quality
2. **`/gsd-spec-phase`** — Especificar exatamente o escopo + spines + ADR associada
3. **`/gsd-execute-phase`** — Implementar com specs validadas
4. **`/gsd-validate-phase`** — Testar compliance + spine integrity
5. **`/gsd-ship`** — Deploy com rastreamento

### Guardrails GSD + HC Quality

- ✓ Exigir ack CTO antes de `firebase deploy*`
- ✓ Exigir ack CTO antes de `node functions/scripts/grant-superadmin-all.mjs --apply`
- ✓ Exigir ack CTO antes de mudanças em firestore.rules
- ✓ Revisar dupla qualquer mudança em `/users`, `/auditLogs`, campos rastreabilidade (LGPD)
- ✓ Validar compliance RDC 978 antes de ship (ADR stage)

---

## Métricas de Completude

| Área               | Módulos | Em Prod | Parcial | Planejado | A Construir | % Completo |
| ------------------ | ------- | ------- | ------- | --------- | ----------- | ---------- |
| **Núcleo CIQ**     | 4       | 4       | —       | —         | 1           | 80%        |
| **RH/Pessoas**     | 2       | —       | 1       | —         | 1           | 25%        |
| **Infraestrutura** | 5       | 2       | 1       | —         | 2           | 50%        |
| **Qualidade**      | 4       | —       | —       | —         | 4           | 0%         |
| **Compras**        | 2       | —       | —       | 1         | 1           | 25%        |
| **Equipamentos**   | 2       | —       | —       | 2         | —           | 0%         |
| **Pós-analítico**  | 3       | —       | —       | —         | 3           | 0%         |
| **Pré-analítico**  | 2       | —       | —       | —         | 2           | 0%         |
| **Continuidade**   | 2       | 1       | 1       | —         | —           | 75%        |
| **TOTAL**          | 26      | 7       | 3       | 3         | 13          | **42%**    |

---

## Próximos Passos

1. **CTO review** dessa análise + roadmap de priorização
2. **Criar projeto GSD** para HC Quality com esses milestones
3. **ADR 0005** (helper técnico) como first step — baixo risco, abre caminho
4. **Paralelizar** onde grafo permitir (0002 + 0006 podem rodar juntas após 0005)

---

**Gerado por:** Claude Code + GSD Framework  
**Skill:** hc-quality v1.0  
**Última atualização:** 2026-05-02
