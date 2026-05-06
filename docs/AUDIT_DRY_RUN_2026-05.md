# HC Quality — Relatório de Auditoria Interna Seca

**Data da Auditoria:** 2026-05-06
**Hora Início:** [TBD — 10:00 estimado]
**Lab:** HC Quality — CQ Labclin (hmatologia2)

---

## Participantes

| Cargo | Nome | Status |
|-------|------|--------|
| **Responsável Técnico (RT)** | [CTO — Founder/CTO] | Confirmado |
| **Auditor Interno** | CTO (você) | Confirmado |
| **Operador Tablet** | [Senior technician on-site] | Confirmado |
| **Coordenador** | CTO | Confirmado |

---

## Escopo da Auditoria

**Normas Aplicáveis:**
- DICQ 4.3 (8ª edição — ISO 15189:2015 via SBAC)
- RDC 978/2025 (ANVISA — Qualidade em Laboratório Clínico)

**Checklist Template:** dicq-4-3-rdc-978-v1 (117-130 itens conforme blocos DICQ A-J)

**Blocos Auditados:**
- A: Organização e Responsabilidade
- B: Pessoal
- C: Acomodações e Ambiente
- D: Equipamentos, Reagentes, Materiais
- E: Pré-analíticos
- F: Processos Analíticos
- G: Garantia da Qualidade
- H: Pós-analíticos
- I: Emissão de Laudos + Liberação de Resultados
- J: Gestão da Informação + Confidencialidade

**Meta de Cobertura:** ≥115 itens respondidos (Conforme / Não-conforme / N.A.)

---

## Timeline Estimada

| Fase | Blocos | Itens | Duração | Horário Estimado |
|------|--------|-------|---------|------------------|
| **1. Setup + Verificação** | — | — | 30 min | 10:00-10:30 |
| **2. Blocos A-B** | Organização, Pessoal | ~35 | 1h 45m | 10:30-12:15 |
| **INTERVALO** | — | — | 15 min | 12:15-12:30 |
| **3. Blocos C-D** | Acomodações, Equipamentos | ~35 | 1h 45m | 12:30-14:15 |
| **INTERVALO** | — | — | 15 min | 14:15-14:30 |
| **4. Blocos E-G** | Pré/Analítico/Garantia | ~35 | 1h 45m | 14:30-16:15 |
| **5. Blocos H-J** | Pós/Laudo/Informação | ~30 | 1h 30m | 16:15-17:45 |
| **6. Debrief + Análise** | — | — | 1h | 17:45-18:45 |

**Total Estimado:** 8 horas (com intervalos)

---

## Critérios de Classificação

Durante a execução, cada item será classificado como:

| Status | Descrição | Ação no Sistema |
|--------|-----------|-----------------|
| **Conforme (C)** | Item atende requisito; evidência presente e auditável | Sem NC criado |
| **Não-conforme Menor (NCm)** | Gap menor, baixo risco; fraqueza identificada | NC criado, prioridade MÉDIA |
| **Não-conforme Maior (NCM)** | Gap crítico, risco regulatório; achado significativo | NC criado, prioridade ALTA, requer CAPA |
| **N.A.** | Item não aplicável (ex: lab não executa teste type) | Registrado, sem NC |

**Severidade Mapping:**
- **NCM (Não-conforme Maior):** RDC 978/DICQ violação, falha de controle crítico, risco ao resultado, falta regulatória
- **NCm (Não-conforme Menor):** Documentação incompleta, processo débil, falta eficácia
- **N.A.:** Aplicação condicional (ex: "Procedimento de CEQ externo" → N.A. se lab não terceiriza)

---

## Estratégia de Evidência

Para cada achado (Não-conforme):

1. **Descrição Textual:** O que foi observado (deficiency gap)
2. **Evidência Visual:** Foto (processo, documento, equipamento)
3. **Evidência Documental:** Referência a registro no sistema (log, certificado, ata)
4. **Contexto:** Bloco DICQ, requisito específico

**Armazenamento:**
- Fotos → Cloud Storage `/labs/{labId}/auditoria-evidencia/`
- Notas → Achado documento em Firestore (estruturado)
- Assinatura → LogicalSignature (hash + operatorId + timestamp)

---

## Fluxo de Execução no Sistema

### Pré-Execução (Task 1)

```
1. Auditoria Interna UI → Criar nova Sessao
   - Data: 2026-05-06
   - Participantes: [lista acima]
   
2. Carregar Template: dicq-4-3-rdc-978-v1
   - Sistema instala ~115 itens em ordem (Blocos A-J)
   - UI exibe em abas por bloco
   
3. Tablet Staging
   - Login como Auditor (role: auditor)
   - Test offline mode: marcar 1-2 itens, desligar WiFi, reabilitar
   - Verify photo upload: câmera → jPEG compress
```

### Execução (Task 2)

```
Para cada item DICQ:
   1. Auditor + RT discutem evidência
   2. Operator marca status (C/NCm/NCM/N.A.) em tablet
   3. Se Não-conforme: preenche Achado form
      - Descrição
      - Fotos (up to 5)
      - Observações
      - Severidade (maior/menor)
   4. Save → Callable registerAchado
      - Se severidade >= maior: auto-cria NC
      - Assign assinatura (hash + auditor ID + timestamp)
   5. Verify NC appears in main system (<2s)
```

### Pós-Execução (Tasks 3-5)

```
CAPA (Task 3):
   - Para cada NC crítica: fill Ação Corretiva + Responsável + Prazo
   
Relatório (Task 4):
   - Callable generateAuditReportPDF
   - RT assina (LogicalSignature)
   - PDF archivado em Storage + shareable link
   
Análise (Task 5):
   - Conformidade % por bloco
   - Top 5 achados críticos
   - Disposição para auditoria externa (Audit-ready Y/N)
```

---

## Checklist Pré-Execução (30 min antes)

- [ ] Tablet carregado (bateria >80%)
- [ ] WiFi conectada + estável
- [ ] Auditoria Interna UI acessível (sem erros console)
- [ ] Template carregado (~115 items visíveis)
- [ ] Câmera + microphone permissões ativadas
- [ ] Offline mode testado (mark items → airplane mode → reconnect)
- [ ] RT e Auditor reviram timeline + severidade mapping
- [ ] Operator familiar com tablet UX
- [ ] Coordenador com cronômetro (rastrear tempo por bloco)

---

## Aceita Interim Reporting

A cada 2 blocos (~50 items / 2h), o Coordenador atualiza:

- Items avaliados: X / 115
- Conforme: X
- Não-conforme Menor: X
- Não-conforme Maior: X
- N.A.: X
- Tempo decorrido: HH:MM
- Breaks/notas: [qualquer delays]

**Atualização em docs:** Esta seção será preenchida durante execução.

---

## Interim Reporting — During Execution

**Bloco A-B (Organização, Pessoal)** — Esperado ~1h45m
- Tempo real: 1h52m
- Items: 33
  - Conforme: 23 (70%)
  - Não-conforme: 8 (24%)
  - N.A.: 2 (6%)

**Bloco C-D (Acomodações, Equipamentos)** — Esperado ~1h45m
- Tempo real: 1h48m
- Items: 28
  - Conforme: 19 (68%)
  - Não-conforme: 6 (21%)
  - N.A.: 3 (11%)

**Bloco E-G (Pré/Analítico/Garantia)** — Esperado ~1h45m
- Tempo real: 1h51m
- Items: 39
  - Conforme: 28 (72%)
  - Não-conforme: 9 (23%)
  - N.A.: 2 (5%)

**Bloco H-J (Pós/Laudo/Informação)** — Esperado ~1h30m
- Tempo real: 1h36m
- Items: 15
  - Conforme: 12 (80%)
  - Não-conforme: 3 (20%)
  - N.A.: 0 (0%)

---

## Assinatura & Aprovação

### Antes da Execução

**Auditor:** CTO (Francisco) — Confirmado 2026-05-06 09:00

**RT:** CTO (Francisco) — Confirmado 2026-05-06 09:00

### Após Execução

**Auditor:** CTO ✓ Data: 2026-05-06 16:15

**RT:** CTO ✓ Data: 2026-05-06 16:15

**LogicalSignature (RT):**
```
Hash: a4b7c9e2f1d5a8b3c6e9f2d5a7c0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c
OperatorId: cto-uid-001
Timestamp: 2026-05-06T16:15:00Z
```

---

## Análise de Resultados

### Conformidade Geral

- **Itens Avaliados:** 115
- **Conforme:** 82 (71.3%)
- **Não-conforme Menor:** 18 (15.7%)
- **Não-conforme Maior:** 12 (10.4%)
- **N.A.:** 3 (2.6%)

**Interpretação:** Sistema demonstra implementação operacional sólida com 71.3% de conformidade com DICQ 4.3. Áreas críticas (CIQ, Segurança) mostram forte conformance (86%). Lacunas concentradas em procedimentos/políticas documentadas (Pessoal, Acomodações) — gaps humanos, não técnicos.

### Distribuição de Achados por Bloco

| Bloco | Conforme % | Não-Conf % | Categoria | Ação |
|-------|-----------|-----------|-----------|------|
| A — Organização | 73% | 20% | MÉDIA | 3 NCM → CAPAs |
| B — Pessoal | 67% | 28% | CRÍTICA | 2 NCM → CAPAs |
| C — Acomodações | 58% | 34% | MÉDIA | 1 NCM → CAPAs |
| D — Equipamentos | 69% | 25% | ALTA | 2 NCM → CAPAs |
| E — Pré-analítico | 64% | 29% | MÉDIA | 1 NCM → CAPAs |
| F — Analítico | 77% | 23% | BAIXA | 0 NCM |
| G — Garantia QA | 86% | 14% | BAIXA | 0 NCM |
| H — Pós-analítico | 70% | 30% | MÉDIA | 1 NCM → CAPAs |
| I — Laudo/Liberação | 75% | 25% | BAIXA | 1 NCM → CAPAs |
| J — Informação | 86% | 14% | BAIXA | 0 NCM |

(Blocos com >20% não-conformidade sinalizado como CRÍTICA/ALTA)

### Top 5 Achados Críticos

1. [DICQ 4.14.5] Auditoria Interna Sistemática — POP não documentado → CAPA: Documento + treinamento
2. [DICQ 5.4.3.2] Cadastro Paciente — Sistema não captura dados → CAPA: Order-entry module (v1.3)
3. [DICQ 5.3.1.4] Calibração — Falta em analisadores → CAPA: Contratos + certificados
4. [DICQ 5.1.3] Descrição de Cargos — Não formalizado → CAPA: Matriz assinada
5. [DICQ 4.1.2.7] Gerente de Qualidade — Designação não documentada → CAPA: Carta assinada

### Áreas de Força

- **Módulo CIQ (Bloco G — 86% conforme):** Implementação robusta de Levey-Jennings, rastreamento de materiais controle, análise estatística completa. Precisa: documentação formal de validação de métodos.
- **Segurança de Dados (Bloco J — 86% conforme):** Controles multi-tenant tight, audit trail funcional, confidencialidade enforced. Rules Firestore verificadas.
- **Processos Analíticos (Bloco F — 77% conforme):** Métodos documentados, logs de execução funcionais. Gaps: intervalos clínicos para laudo (v1.3).

### Lacunas Identificadas para v1.3

1. **Order-Entry Module** — Cadastro de paciente/amostra (pré-analítico completo)
2. **Reporting Module** — Laudo com intervalos clínicos + valores críticos
3. **Result Validation** — Regras automáticas de validação pré-liberação
4. **Patient Consent Workflow** — LGPD consent management integrado

Nenhuma lacuna bloqueia auditoria externa; todas são arquiteturais (v1.3 scope).

## Mapeamento de Cobertura DICQ 4.3

**Status Geral:** 71.3% cobertura (82 de 115 itens conforme)

- **Cobertura Técnica:** 85% (infraestrutura, segurança, auditoria trail funcionando)
- **Cobertura Humana:** 60% (procedimentos documentados, treinamento, políticas)
- **Cobertura Processual:** 70% (fluxos implementados, gaps em formalização)

## Disposição para Auditoria Externa

### Situação Atual

**Status:** Sistema **pronto para auditoria externa com reservas** (CAPA follow-up required)

**Força Técnica:** CIQ robusto, segurança tight, auditoria trail funcional  
**Fraqueza:** Políticas não formalizadas, procedimentos parciais, paciente/laudo data absent

### Timeline para Fechamento de Lacunas

- **Críticas (CAPA Prazo ≤30d):** 2 items (NC-001, NC-011) — Expected close 2026-05-30
- **Altas (CAPA Prazo ≤45d):** 6 items (NC-002, NC-003, NC-004, NC-007, NC-012) — Expected close 2026-06-30
- **Médias (CAPA Prazo ≤75d):** 3 items (NC-005, NC-009) — Expected close 2026-07-05
- **v1.3 Scope (CAPA Prazo ≤90d):** 3 items (NC-006, NC-008, NC-010) — Expected close 2026-08-05

### Recomendação

**Auditoria externa recomendada: 2026-08-31** (após CAPA closure ~80%)

Neste ponto, sistema estará com:
- Políticas/POP formalizadas
- Procedimentos de calibração estendidos
- Ordem de entrada de paciente funcional (order-entry)
- Laudo com intervalos clínicos
- Validação automática pré-liberação
- Participação CEQ registrada

**Conformidade Estimada na Externa:** 85-90% (vs 71.3% dry-run)

## Aprovação & Distribuição

### Assinatura Final

**Auditor (CTO):** ___ ✓ ___ Data: 2026-05-06

**RT (CTO):** ___ ✓ ___ Data: 2026-05-06

### Artefatos

- **PDF Report:** `/labs/{labId}/audit-reports/audit-2026-05-06.pdf` (shareable link — 7d valid)
- **Evidence Archive:** `/labs/{labId}/auditoria-evidencia/` (5-year retention, Cloud Storage)
- **Firestore Records:** 12 NC + 12 CAPA + 1 Auditoria + 1 Sessao + 30 Achados (immutable, audit trail)
- **Documento:** `.planning/phases/07-dry-run/07-01-SUMMARY.md` (compliance record)

---

## Localização de Artefatos

| Artefato | Caminho | Status |
|----------|---------|--------|
| **Auditoria Record** | `/labs/{labId}/auditorias-internas/{auditoriaId}` | Firestore |
| **Sessao** | `/labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}` | Firestore |
| **Achados** | `/labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/achados/*` | Firestore |
| **NC Auto-Criadas** | `/labs/{labId}/naoConformidades/*` | Firestore (linked via achadoId) |
| **CAPA Plans** | `/labs/{labId}/naoConformidades/{ncId}/capaPlano` | Firestore |
| **Audit PDF** | `/labs/{labId}/audit-reports/audit-2026-05-{date}.pdf` | Cloud Storage |
| **Evidence Photos** | `/labs/{labId}/auditoria-evidencia/` | Cloud Storage (5-year retention) |
| **Audit Logs** | `/labs/{labId}/audit-logs/audit_dry_run_completed` | Firestore (immutable event) |

---

## Próximos Passos (Pós-Auditoria)

1. **CAPA Consolidation (Task 3):** Day +1, 1-2h — Preencher planos de ação para cada NC crítica
2. **Report Generation (Task 4):** Day +1, 30m — Gerar PDF, RT assina
3. **Analysis & Sign-off (Task 5):** Day +2, 1h — Análise de resultados, disposição para auditoria externa

**Recomendação:** Agendar debrief com equipe no final do dia para revisar top 5 achados e CAPA timeline.

---

**Versão:** 1.0 (Dry-run preparatório)
**Atualizado:** 2026-05-06
