# HC Quality Roadmap — Phases 1-2

**Project:** HC Quality — Sistema CIQ Laboratorial RDC 978  
**Updated:** 2026-05-02  
**Owner:** CTO

---

## 🎯 High-Level Timeline

```
Phase 1: Compliance Hardening (ADRs 0005-0007)
├─ Weeks 1-2:   ADR 0005 (crypto helper)
├─ Weeks 3-5:   ADR 0002 (Lote↔NF) + ADR 0006 (Pessoa completa) [parallel]
├─ Weeks 6-8:   ADR 0003 (NC global) + ADR 0004 (POP) [parallel]
└─ Weeks 9-10:  ADR 0007 (Equipamento) + validation

         ↓ GATE: 100% spines integrity + LGPD verified

Phase 2: Construção de Módulos (13 módulos)
├─ Modules Batch 1: POPs + NC + Auditoria (3-4 meses)
├─ Modules Batch 2: KPIs + Treinamentos + Biossegurança (2-3 meses)
└─ Modules Batch 3: Pós-analítico + Pré-analítico + CEQ (2-3 meses)
```

---

## Phase 1: Compliance Hardening

**Gate Condition:** Todas 13 violações RDC 978 resolvidas + spine integrity verified (0% divergência)

### ADR 0005 — Helper cryptoAudit (Weeks 1-2)

**Violações fechadas:** V-009  
**Bloqueador de:** 0002, 0003  

**Deliverables:**
- ✓ Helper `functions/src/modules/audit/cryptoAudit.ts`
- ✓ HMAC-SHA256 chain-hash centralizado
- ✓ `chainHashValidator` com scheduled validation
- ✓ Backfill dados legados
- ✓ Tests >90% coverage
- ✓ ADR 0005 finalized + CTO approved

**Acceptance:** Smoke test: cria entry, valida chain, sem erros

**Skills GSD:**
- `/gsd-spec-phase` — detalhar ADR 0005
- `/gsd-execute-phase` — implementar
- `/gsd-validate-phase` — testar chain integrity
- `/gsd-ship` — deploy com gate

---

### ADR 0002 — Lote ↔ NF Obrigatório (Weeks 3-5)

**Violações fechadas:** V-003, V-006, V-012  
**Bloqueador de:** Rastreabilidade fiscal  
**Dependência:** ✓ ADR 0005 completo

**Deliverables:**
- ✓ Schema `Fornecedor` completo (status, evidências, requalificação)
- ✓ Schema `NotaFiscal` com `itens[]` estruturado
- ✓ Schema `Insumo.notaFiscalId` + `fornecedorId` **obrigatórios** (novo)
- ✓ Backfill NFs legadas (data migração)
- ✓ Conferência no recebimento (gate: Fornecedor qualificado?)
- ✓ Geração automática Lote a partir item NF
- ✓ ADR 0002 finalized

**Acceptance:** Cria NF → cria Insumo com FK válido → Lote rastreado até origem

**Skills GSD:**
- `/gsd-spec-phase` — detalhar schema + backfill strategy
- `/gsd-execute-phase` — implementar
- `/gsd-validate-phase` — testar rastreabilidade
- `/gsd-ship` — deploy com migration validation

---

### ADR 0006 — Pessoa Completa (Weeks 3-5, paralelo com 0002)

**Violações fechadas:** V-002, V-005  
**Bloqueador de:** Validação habilitação operador  
**Dependência:** ✓ ADR 0005 completo

**Deliverables:**
- ✓ Schema `/qualificacoes` novo (tipo, módulos liberados, validade, hmac)
- ✓ Schema `Member` com `cpfHash` (LGPD), `cargo`, `conselhoProfissional`
- ✓ `responsavelTecnico` **único por lab** (invariante + CF rule)
- ✓ Validação: toda ação técnica carrega `operadorId` + valida `qualificacoes` ativa
- ✓ Cloud Function: bloqueia operação se `qualificacoes` expirada ou não cobre módulo
- ✓ UI: bloqueia preventivamente
- ✓ Backfill membros existentes com role → cargo + cpfHash hashed
- ✓ ADR 0006 finalized

**Acceptance:** Operador X acessa módulo Y → valida qualificação ativa (testes unitário + E2E)

**Skills GSD:**
- `/gsd-spec-phase` — detalhar spine Pessoa
- `/gsd-execute-phase` — implementar
- `/gsd-validate-phase` — testar validação habilitação
- `/gsd-ship` — deploy com zero falsos-positivos

---

### ADR 0003 — Spine NC Global (Weeks 6-8)

**Violações fechadas:** V-001  
**Bloqueador de:** Ponto único tratamento desvios  
**Dependência:** ✓ ADR 0002, 0005, 0006

**Deliverables:**
- ✓ Schema `NaoConformidade` canônico (descrição, severidade, status, ações)
- ✓ `NaoConformidadeTemp` em CT refatorada → referência a NC global
- ✓ Toda módulo pode abrir NC (gate: severidade crítica bloqueia operação)
- ✓ CAPA (Ação Corretiva): investigação → ação → eficácia
- ✓ Rastreabilidade: quem abriu, quando, categoria, origem
- ✓ ADR 0003 finalized

**Acceptance:** Abre NC em CT → aparece em Qualidade com FK correto → bloqueia se crítica

**Skills GSD:**
- `/gsd-spec-phase` — detalhar NC spine + CAPA workflow
- `/gsd-execute-phase` — implementar
- `/gsd-validate-phase` — testar abertura + bloqueio
- `/gsd-ship` — deploy

---

### ADR 0004 — POP / Documento Vigente (Weeks 6-8, paralelo com 0003)

**Violações fechadas:** V-004, V-011  
**Bloqueador de:** Rastreabilidade procedimento  
**Dependência:** ✓ ADR 0006 (Pessoa/RT aprovador)

**Deliverables:**
- ✓ Schema `POP` (versão, vigência, hash conteúdo, assinatura RT)
- ✓ Coleção `/labs/{labId}/pops` novo
- ✓ Versionamento automático (v1.0, v1.1, etc)
- ✓ Data próxima revisão
- ✓ Cloud Function: grava `popId` + `popVersaoId` em toda run CIQ
- ✓ Treinamento atrelado a versão POP (gate: operador treino em POP X antes usar)
- ✓ ADR 0004 finalized

**Acceptance:** Cria run CIQ → grava popId + versão → rastreável até procedimento original

**Skills GSD:**
- `/gsd-spec-phase` — detalhar POP spine
- `/gsd-execute-phase` — implementar + Wire em CIQ modules
- `/gsd-validate-phase` — testar retroativamente (popId em runs existentes?)
- `/gsd-ship` — deploy

---

### ADR 0007 — Equipamento Completo (Weeks 9-10)

**Violações fechadas:** V-008, V-010  
**Bloqueador de:** Rastreabilidade laudo (equipId)  
**Dependência:** ✓ ADR 0002 (Fornecedor/provedor calibração), 0006 (Pessoa operador)

**Deliverables:**
- ✓ Schema `Equipamento` (qualificação inicial, próxima calibração, próxima manutenção)
- ✓ Coleção `/labs/{labId}/equipamentos` + `/equipamentos-audit` novo
- ✓ Refatorar calibração de CT → módulo próprio (consome Fornecedor + Equipamento + NC)
- ✓ Cloud Function: grava `equipamentoId` em toda run CIQ
- ✓ Gate: calibração atrasada → bloqueia novo resultado
- ✓ ADR 0007 finalized

**Acceptance:** Cria run CIQ → grava equipId + validação calibração → bloqueia se atrasada

**Skills GSD:**
- `/gsd-spec-phase` — detalhar Equipamento spine
- `/gsd-execute-phase` — implementar + refatorar CT
- `/gsd-validate-phase` — testar gate calibração
- `/gsd-ship` — deploy

---

### Phase 1 Validation Gate (Week 10)

**Before Phase 2 can start:**

- [ ] ADRs 0005-0007 todos deployados
- [ ] Spine integrity report: 0% violações V-001 até V-013
- [ ] Chain-hash validation pass (scheduled CF rodou 1x sem erros)
- [ ] LGPD compliance: `/qualificacoes`, `/ciq-audit` com HMAC + assinatura
- [ ] Smoke test suite: todos CIQ modules gravando popId + equipId + operadorId
- [ ] CTO sign-off: "Phase 1 ready"

---

## Phase 2: Construção de Módulos (13 Modules)

**Gate Condition (Start):** Phase 1 100% ✓ + Spine integrity verified

**Duration:** ~6-8 meses (batches paralelas)

### Batch 1: Sistema de Qualidade (Weeks 11-22, ~12 semanas)

**3 módulos críticos — base pra tudo depois**

#### 1.1 POPs (Gestão de Documentos)
- Dependência: ADR 0004 ✓
- Escopo: versionamento, vigência, hash, treinamento atrelado
- Acceptance: POP v1.2 aprovado RT → treinamento criado → operador habilitado

#### 1.2 Não-conformidades + CAPA
- Dependência: ADR 0003 ✓
- Escopo: abertura, investigação, ação, eficácia, bloqueio crítica
- Acceptance: Abre NC → fluxo CAPA → fechamento rastreável

#### 1.3 Auditoria Interna
- Dependência: 1.1 + 1.2 ✓
- Escopo: checklist, achados → NCs, plano anual
- Acceptance: Auditoria criada → achados registrados → NCs abertas

### Batch 2: RH + Infraestrutura (Weeks 11-22, paralelo com Batch 1)

**5 módulos: Treinamentos, Biossegurança, PGRSS, KPIs, LGPDPolicy**

#### 2.1 Treinamentos + Reciclagem
- Dependência: 1.1 (POPs) + ADR 0006 ✓
- Escopo: registro por versão POP, evidência, validade, alerta

#### 2.2 Mapeamento Áreas + Biossegurança
- Dependência: ADR 0007 (Equipamento) ✓
- Escopo: sala, fluxo, NB, EPIs, check

#### 2.3 PGRSS
- Dependência: ADR 0007 (Equipamento) ✓
- Escopo: registro geração, segregação, coleta, comprovantes

#### 2.4 Indicadores KPI
- Dependência: Batch 1 ✓ (dados críticos disponíveis)
- Escopo: dashboard KPIs (retrabalho, tempo liberação, NC origem, etc)

#### 2.5 LGPD Policy + Exclusão de Dados
- Dependência: ADR 0006 ✓
- Escopo: política exposta, processo exclusão titular, DPIA

### Batch 3: Analítico + Pós-Analítico (Weeks 23-34, ~12 semanas)

**5 módulos: CIQ Bioquímica, CEQ, Validação Métodos, Liberação, Comunicação Críticos**

#### 3.1 CIQ Bioquímica
- Dependência: ADR 0004 (POPs) + ADR 0007 (Equipamento) ✓
- Escopo: padrão Hematologia (quantitativo)
- Acceptance: Rodas criadas, resultados gravados, popId + equipId + operadorId

#### 3.2 CEQ (Ensaio Proficiência)
- Dependência: 3.1 ✓
- Escopo: programa externo, envio, recebimento, análise Z-score, NC automática

#### 3.3 Validação de Métodos
- Dependência: 3.1 ✓
- Escopo: linearidade, precisão, exatidão, comparação, intervalo referência

#### 3.4 Liberação de Laudos
- Dependência: 1.2 (NC) + ADR 0006 (Pessoa habilitada) ✓
- Escopo: dupla checagem críticos, fluxo aprovação, retenção 5a

#### 3.5 Comunicação Resultados Críticos
- Dependência: 3.4 ✓
- Escopo: lista critérios, registro comunicação, rastreamento

### Batch 4: Pós + Pré-Analítico (Weeks 35-42, ~8 semanas)

**4 módulos: Arquivo + Biorrepositório, Coleta + Transporte, Reclamações, DR + Restore**

---

## Success Metrics

### Phase 1
- ✓ 100% violações RDC 978 resolvidas (V-001 até V-013)
- ✓ Spine integrity: 0% divergência entre módulos
- ✓ HMAC chain validation: 100% pass
- ✓ CTO approval: "compliant"

### Phase 2 (on Phase 1 completion)
- ✓ 26 módulos em produção (vs. 7 hoje)
- ✓ Coverage: Sistema da Qualidade, RH, Infra, Pós-analítico, CEQ
- ✓ Audit 2026-Q4: zero findings (vs. 13 hoje)

---

## Risks & Mitigations

| Risco | Sev | Mitigation |
|-------|-----|-----------|
| ADR 0002 backfill NF legadas incompleto | 🟠 | Audit legados antes → whitelist NFs com data range |
| Spine refactor em prod quebra referências | 🔴 | Todas mudanças com FK validação + scheduled verifier |
| Phase 1 extends beyond semana 10 | 🟠 | Critical path: 0005 → (0002 + 0006 paralelo) → rest. Escalate ADRs se delay |
| Equipe ausente (vacation/illness) | 🟠 | 2-person minimum per ADR; Cross-training documentado |

---

## Next: Start Phase 1

**CTO review:**
- [ ] REQUIREMENTS.md para ADR 0005 — aprovado?
- [ ] Timeline realista (6-8 dias ADR 0005)?
- [ ] Pronto pra `/gsd-plan-phase 1`?

**Upon approval:** `/gsd-plan-phase 1` inicia planejamento detalhado de ADR 0005.

---

**Tracking:** `.planning/STATE.md`
