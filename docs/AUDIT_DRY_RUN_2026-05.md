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
- Tempo real: [TBD]
- Items: 35
  - Conforme: [TBD]
  - Não-conforme: [TBD]
  - N.A.: [TBD]

**Bloco C-D (Acomodações, Equipamentos)** — Esperado ~1h45m
- Tempo real: [TBD]
- Items: 35
  - Conforme: [TBD]
  - Não-conforme: [TBD]
  - N.A.: [TBD]

**Bloco E-G (Pré/Analítico/Garantia)** — Esperado ~1h45m
- Tempo real: [TBD]
- Items: 35
  - Conforme: [TBD]
  - Não-conforme: [TBD]
  - N.A.: [TBD]

**Bloco H-J (Pós/Laudo/Informação)** — Esperado ~1h30m
- Tempo real: [TBD]
- Items: 30
  - Conforme: [TBD]
  - Não-conforme: [TBD]
  - N.A.: [TBD]

---

## Assinatura & Aprovação

### Antes da Execução

**Auditor:** _________________ Data: __________

**RT:** ______________________ Data: __________

### Após Execução (a ser preenchido)

**Auditor:** _________________ Data: __________

**RT:** ______________________ Data: __________

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
