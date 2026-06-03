# ADR-0016: FMEA-Lite Risk Methodology — Phase 0 MVP

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** ADR-0016a (se refinamento ISO 31000 necessário em v1.5)

---

## Contexto

HC Quality entrou em v1.4 com necessidade urgente de **risk management system** (RDC 978 Art. 86, componente 2 obrigatório; DICQ 4.14.6). Auditoria externa marcada para 2026-10-15; laboratório Riopomba (cliente piloto) precisa demonstrar gestão de riscos documentada com:

- Identificação + análise de riscos do processo analítico
- Avaliação (severidade + probabilidade)
- Scoring numérico reproduzível
- Revisão periódica + tratamento
- Trilha de auditoria imutável

**Contexto técnico:** v1.3 tem 25 módulos em produção; v1.4 Phase 0 (5 dias) precisa entregar sistema de risco funcional + compliant. Não há tempo para ISO 31000 completo (maturity model industrial, 8-10 semanas). Risk-02 (P0-R2) explicitamente aceita iteração futura.

**Questão arquitetural:** Qual metodologia de scoring minimalista é defensível regulatoriamente, implementável em <3.5 dias, e extensível para ISO 31000 em v1.5?

## Problema

Sem decisão explícita sobre _como_ calcular NPR (número de prioridade de risco), há risco de:

1. **Rejeição regulatória:** Auditor não reconhece metodologia → retrabado em semana de CAPA closure.
2. **Inconsistência:** Cada laboratório usa fórmula diferente → impossível comparar riscos entre filiais.
3. **Desperdício técnico:** Implementar ISO 31000 completo agora (semanas) quando FMEA-lite resolveria Phase 0 (dias).
4. **Blocking de v1.4 início:** Phase 0 unblock gate não alcançado se risco não estiver documentado.

## Decisão

**v1.4 Phase 0 adota FMEA-Lite (Probabilidade × Severidade × Detecção) com escape hatch ISO 31000 em v1.5.**

### Metodologia FMEA-Lite Escolhida

**Scoring Formula:**

```
NPR (Número de Prioridade de Risco) = Probabilidade × Severidade × Detecção
Onde cada fator ∈ [1, 5]
Portanto: NPR ∈ [1, 125]
```

**Definições de Fator (client-side guidance; server-side authoritative):**

#### Probabilidade (P) — Likelihood of occurrence

1. **Muito improvável** — ocorre raramente, <1 vez por ano na prática clínica
2. **Improvável** — ocorre ocasionalmente, 1–5 vezes por ano
3. **Possível** — ocorre com frequência moderada, 5–20 vezes por ano
4. **Provável** — ocorre frequentemente, >20 vezes por ano
5. **Muito provável** — ocorre constantemente ou em cada ciclo

#### Severidade (S) — Impact on patient/process

1. **Desprezível** — sem impacto clínico; descoberto antes de resultado
2. **Menor** — impacto mínimo; paciente recuperado com intervenção simples
3. **Moderado** — impacto significativo; paciente requer hospitalization ou intervenção
4. **Maior** — impacto crítico; potencial incapacidade permanente
5. **Catastrófico** — morte ou incapacidade permanente

#### Detecção (D) — Ability to detect before it reaches patient

1. **Certeza de detecção** — controle detecta 100% das ocorrências
2. **Muito provável** — controle detecta >80% (boa capacidade)
3. **Provável** — controle detecta 50–80%
4. **Improvável** — controle detecta <50%
5. **Improvável/Impossível** — controle detecta <10% (ou não existe)

**Classificação de Nivel por NPR:**

| Nivel       | NPR Range | Ação                                 | Revisão        |
| ----------- | --------- | ------------------------------------ | -------------- |
| **Baixo**   | 1–24      | Aceitar risco; monitorar anualmente  | Anual          |
| **Médio**   | 25–60     | Mitigação planejada; revisão 6 meses | Semestral      |
| **Alto**    | 61–99     | Mitigação urgente; revisão 3 meses   | Trimestral     |
| **Crítico** | 100–125   | Ação imediata; revisão mensal        | Mensal + Top-5 |

(Thresholds configuráveis por laboratório via `labSettings` em v1.4 Phase 1; Phase 0 hardcoded.)

### Características Implementadas (Phase 0)

1. **Servidor recomputa NPR:** Mesmo que cliente envie `npr: 999`, servidor valida `npr === p × s × d`. Defense-in-depth contra tamper.
2. **Assinatura lógica (LogicalSignature):** Cada risco carrega `{ hash, operatorId, ts }` com `hash = SHA-256(canonical{labId, risco-id, p, s, d})`. Auditável via `verifyChain` script (herança de Plan 00-01/turnos).
3. **Histórico imutável:** `reviewHistory[]` e `tratamento.acoes[]` são append-only. Reclassificação cria nova entry em `reviewHistory`; campo `nprPrevio` + `nprNovo` documentam transição.
4. **Revisão periódica automática:** Cron diário (07:00 BRT) identifica riscos vencendo revisão (`reviewDate <= today`); notificação idempotente. Cron mensal (1º do mês) para top-5 críticos (`npr >= 100`).
5. **Soft-delete preserva evidência:** Riscos fechados (`status === 'fechado'`) não podem ser deletados. Soft-delete rejeita se `status === 'fechado'`; histórico inteiro permanece para auditoria RDC 978.
6. **Callable from day 1 (DL-1):** Todas as escritas via Cloud Function callables (`risks_createRisk`, `risks_updateRisk`, `risks_softDeleteRisk`, `risks_registrarRevisao`). Firestore rules negam escrita direta do cliente.

### Justificativa FMEA-Lite (não ISO 31000)

**Por que FMEA-Lite agora:**

1. **Familiaridade clínica:** Laboratórios já usam Failure Mode & Effect Analysis em CIQ (Levey-Jennings, control charts). NPR é extensão natural.
2. **Implementação rápida:** 3 sliders (P/S/D) + fórmula simples. Horas, não semanas.
3. **Regulatório defensável:** RDC 978 Art. 86 + DICQ 4.14.6 não prescrevem ISO 31000; FMEA é método reconhecido em ISO 13849 (segurança).
4. **Sem breaking de v1.4:** NPR hardcoded; extensibilidade não bloqueada.

**Por que ISO 31000 em v1.5:**

ISO 31000 é **framework de gestão de risco integrado** (análise qualitativa + quantitativa, matriz de risco + apetite empresarial, governance loops). Requer:

- Entrevistar C-suite (diretor clínico, diretor administrativo) → apetite de risco por categoria
- Mapear 50+ processos clínicos × risco (2-3 semanas)
- Estruturar matriz 5×5 com limiares de decisão por categoria
- Treinar staff (8h/mês de governance)

**Impossível em 3.5 dias. Viável em v1.5 Weeks 3–6 (Post-Phase-0) se Riopomba feedback validar demanda.**

## Alternativas Consideradas

### Alternativa A — ISO 31000 Completo (Phase 0)

Implementar risk framework completo: RACI roles, risk appetite matrix, governance committee.

**Rejeitada porque:**

- Não cabe em 3.5 dias (minimo 6 semanas de design + client interviews + training).
- v1.3 é medida de baseline; Phase 0 unblock gate crítico → não há tempo.
- Riopomba não pediu; Lab Manager pediu "alguma forma de rastrear riscos antes da auditoria".

### Alternativa B — Risk Matrix Qualitativa (No Scoring)

Apenas categorizar por heatmap (alto/médio/baixo) sem fórmula numérica.

**Rejeitada porque:**

- Auditor pergunta "como vocês priorizaram este risco vs aquele?" → sem NPR, é subjetivo.
- RDC 978 Art. 86 implica **análise + avaliação** (objetivo); qualitativa pura é insuficiente.
- Benchmarking entre labs impossível.

### Alternativa C — Probabilidade × Severidade (sem Detecção)

NPR = P × S (fórmula FMEA padrão). Detecção deixa para Phase 1.

**Considerada, mas rejeitada:**

- Detecção é crítica em CIQ: se o controle interno é _detecta tudo_, risco real é menor.
- Laboratório clínico = ambiente altamente controlado; ignorar detecção subestima capabilidade.
- Implementar depois cria refactor desnecessário; fazendo certo agora é negligenciável.

## Consequências

### Positivas

1. **Phase 0 unblock alcançado:** Risk register funcional + auditável em produção para Riopomba Week 2.
2. **Extensibilidade clara:** ADR-0016a (v1.5) mapeia transição FMEA-Lite → ISO 31000 sem breaking de Phase 0 schema.
3. **Compliance imediato:** RDC 978 Art. 86 demonstrável com registro + histórico + revisão periódica.
4. **Auditoria defensável:** Fórmula documentada, não ad-hoc. Auditor vê metodologia reconhecida (FMEA).
5. **Preparação para v1.4 Phase 4 (CAPA):** Risk register é fonte de CAPAs; vínculo bidirecional (`linkedCAPAs[]`) já no schema.

### Negativas

1. **Não é ISO 31000:** Se cliente exigir governance loop completo antes de v1.5, retrabado necessário. Mitigado: contrato v1.4 explicita "FMEA-Lite MVP + ISO 31000 refinement planned for v1.5".
2. **Threshold hardcoded Phase 0:** Não há UI para customizar `nprThresholds` (medio: 25, alto: 61, critico: 100). Adicionado em v1.4 Phase 1 (labSettings extension). Não bloqueia Phase 0 (baseline suficiente).
3. **Top-5 mensal heurístico:** Critério "npr >= 100" é simples; ISO 31000 teria "aprovação de apetite de risco". Phase 0 aceitável; Phase 1 refina.

## Compromissos Derivados

1. **ADR-0016a (v1.5 kickoff, Weeks 1–2):** Mapeamento de transição FMEA-Lite → ISO 31000; entrevistas de apetite de risco; design de governance loop.
2. **Module CLAUDE.md (src/features/risks/):** Documenta RN-RISK-01..08 (unicidade, validações, soft-delete-only, chainHash continuity).
3. **DPIA v1.1 patch (Plan 00-02 forward-ref):** Após ADR-0016 published, republish DPIA como v1.1 em SGQ com referência concreta a metodologia NPR + risk management (transição RDC 978 Art. 86 de OPEN para MITIGATED).
4. **Audit trail verifyChain:** Estender script de Plan 00-01 (turnos) para risks; auditor executa, confirma chainHash intacto após reclassificações.
5. **Weekly risk review cadence (v1.4 Phase 4+):** CTO/Lab Manager meeting à sexta para revisar top-5 + analisar CPAs em aberto (parte de governance Phase 1).

## Referências

- **RDC 978/2025 Art. 86:** "Programa de Garantia da Qualidade — gerenciamento dos riscos é componente 2 obrigatório."
- **DICQ 4.14.6:** "Gestão de Risco — identificação, análise, avaliação, tratamento, monitoramento."
- **ISO 15189:2022 §8.5:** "Actions to address risks and opportunities."
- **ISO 13849-1:** FMEA para segurança funcional (método reconhecido).
- **ISO 31000:2018:** Risk management framework (reference para v1.5 refinement).
- **Levey-Jennings (v1.3):** Controle estatístico de CIQ; NPR estende princípio a riscos.
- **Plan 00-04 FMEA-Skeleton:** Implementação executiva (11 tasks, 3.5 dias).

---

**Aplicabilidade:** Todos os commits do módulo `risks` em v1.4 Phase 0 (Plan 00-04); herança de decisão para Phases 1–3.

**Próxima Revisão:** 2026-06-07 (1 month checkpoint: feedback Riopomba + viabilidade ISO 31000 assessment).

---

**ADR Status:** ACCEPTED (2026-05-07)  
**CTO Sign-Off:** Implicit (executor authorization)
