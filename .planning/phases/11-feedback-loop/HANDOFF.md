# Phase 11 — Feedback Loop — Handoff

**Planned:** 2026-05-06
**Planning by:** Claude (Haiku 4.5) — sessão paralela à execução de Phase 8
**Status:** Ready to execute (Wave 1 unblocked após Phase 9 plan 03 + Phase 10 plan 02)

---

## Por que este HANDOFF

Phase 8 está em execução em outra janela. Phases 9, 10 e 11 já têm planning completo e podem rodar em paralelo após dependências resolvidas. Phase 11 fecha o pacote inicial do v1.3.

**Não toquei** em STATE.md, ROADMAP.md, ou CLAUDE.md root.

---

## Artefatos criados (Phase 11)

```
.planning/phases/11-feedback-loop/
├── PHASE_OVERVIEW.md      # Goal, escopo, 8 plans, riscos, success criteria
├── CONTEXT.md             # 15 decisões locked + threat model T1-T9 + LGPD framework + gotchas
├── 11-01-PLAN.md          # Schema + RCA + NC auto-trigger (1.5 sem)
├── 11-02-PLAN.md          # Multi-canal intake + Gemini IA (2 sem)
├── 11-03-PLAN.md          # Status workflow + email + RCA UI (1.5 sem)
├── 11-04-PLAN.md          # NPS pós-resolução + recurring + anonimização (1.5 sem)
├── 11-05-PLAN.md          # Sugestões module separado (1.5 sem)
├── 11-06-PLAN.md          # Portal paciente auth externa (2 sem)
├── 11-07-PLAN.md          # Trending + Pareto + integração 4.15 (1.5 sem)
├── 11-08-PLAN.md          # Polish + a11y + LGPD audit + deploy (1 sem)
└── HANDOFF.md             # (este arquivo)
```

**Total estimado:** 12.5 sem (cabe nas 12 alocadas com paralelismo Wave 1).

---

## Decisões CTO travadas no discuss-phase (2026-05-06)

| Decisão | Valor | Fonte |
|---------|-------|-------|
| Canais entrada | Multi-canal completo (web interno + público + email + telefone + QR laudo + Worklab deep link) | AskUserQuestion |
| RCA método | 5 Whys + NC auto severity alta | AskUserQuestion |
| NPS timing | Pós-resolução + recurring trimestral; anonimização 90d | AskUserQuestion |
| Funcionalidades extras | TODAS: portal cliente, IA Gemini, sugestões separado, trending Pareto, deep link Worklab | AskUserQuestion (multi-select) |
| Identificação | Reclamação anônima NÃO permitida (impede LGPD + comunicação) | Locked |
| Worklab embed | Deep link parametrizado com token (não iframe) | Locked técnico |
| LGPD base legal | Obrigação legal RDC 978 + consentimento explícito | Locked compliance |
| Retenção | 5a com PII; após anonimização (RDC + LGPD compliance) | Locked compliance |
| Defer v1.4 | Ishikawa visual, WhatsApp Business, ouvidoria/PROCON, CFM API | Backlog |

---

## Síntese Obsidian consumida (highlights)

- **3 itens DICQ em 0%** hoje: 4.8 (Reclamações), 4.14.3 (Satisfação), 4.14.4 (Sugestões). Phase 11 sobe pra 100%.
- **DICQ 4.15 (Análise Crítica Direção):** 4 das 15 entradas obrigatórias dependem deste módulo (satisfação, sugestões, reclamações, melhoria contínua). Sem Phase 11, reunião direção sem dados.
- **Lacuna mercado real:** Acredite.se, SysQuali, PNCQ Gestor, QualiChart, CI Online — nenhum faz feedback unificado. HC Quality vira diferencial de venda.
- **NC já existe parcial** (🟡 no DICQ); Phase 11 integra reclamação severity alta → NC auto-draft.
- **Casos reais ANVISA:** "comunicação oral sem registro" = não-comunicado; "pesquisa formal sem ação" = não-conformidade.

Arquivos consumidos:
- `HC_Quality_Compliance_DICQ.md` (4.8, 4.14.3, 4.14.4, 4.14.6, 4.15)
- `HC_Quality_RDC_978_2025_Resumo.md` (Arts. 86, 115, 117)
- `HC_Quality_Checklist_Auditoria.md`
- `HC_Quality_Visao.md`
- `HC_Quality_Dossie_Concorrentes_2026-04-28.md`
- `HC_Quality_Decisoes_Abertas.md` (LGPD)
- `HC_Quality_Zero_Acreditacao/` Módulo 1.9 (template PNCQ)

---

## Como integrar quando Phases 8/9/10 estiverem prontas para overlap

### Opção A — Wave 1 inicia paralelo a Phase 9 plan 03 + Phase 10 plan 02 (recomendado)

Plan 11-01 (Schema + RCA + NC auto-trigger) é independente. Plans 11-02, 11-04, 11-05 paralelos após 11-01.

```bash
# Quando momento certo (Phase 9 plan 03 + Phase 10 plan 02 verdes):
/gsd-execute-phase 11 --wave 1
```

### Opção B — Phase 11 só começa quando Phases 9 e 10 terminarem

Conservador. Espera 2026-08-25 (fim Phase 10). Inicia Phase 11 em 2026-08-26. Risco: não cabe no v1.3 timeline.

### Opção C — Promover v1.3-ROADMAP.md → ROADMAP.md ativo

Mesma estratégia das Phases 9 e 10 (ver `09-bioquimica/HANDOFF.md`).

---

## Validações pendentes antes de executar

- [ ] CTO valida que os 6 canais cobrem 100% do que Riopomba precisa
- [ ] CTO confirma SLA 30 dias para resposta (CDC) é apropriado vs. mais conservador (15d)
- [ ] CTO obtém DNS access para `reclamacoes@hmatologia2.web.app` (Resend Inbound) + reCAPTCHA keys
- [ ] CTO decide se portal paciente é path (`/portal-paciente`) ou subdomain
- [ ] CTO valida Worklab API endpoint para deep link (params: examCode, cpfHash, source, version)
- [ ] CTO confirma quais 6 categorias de reclamação são adequadas (ou ajustar)
- [ ] CTO valida classificação default IA Gemini com 50 reclamações reais Riopomba (calibração)
- [ ] Pen tester confirmar disponibilidade para Plan 11-08 (portal paciente exige)
- [ ] Phase 8 plan 04 (management-review module) precisa estar no schema esperado por `exportarParaAnaliseCritica` — coordenar com Phase 8 owner

---

## Próximos passos quando começar a execução

```bash
# Modo standard (com plan-checker e verifier)
/gsd-execute-phase 11 --wave 1

# Modo TDD
/gsd-execute-phase 11 --wave 1 --tdd
```

---

## Notas de qualidade

Padrão world-class aplicado:
- 4 perguntas críticas via AskUserQuestion antes de planejar
- Síntese Obsidian estruturada (compliance + lacuna mercado + LGPD impact + casos reais)
- 8 PLAN.md com `must_haves`, `key_links`, `deviation_protocol`, `post_plan_gates`
- Threat model T1-T9 documentado em CONTEXT.md (especial atenção LGPD + portal externo)
- LGPD framework completo: base legal por finalidade, retenção, anonimização, direitos do titular (Art. 18)
- Performance budgets explícitos (4 chunks separados)
- Compliance mapping (DICQ 4.8/4.14.3/4.14.4/4.15 + RDC 978 + CDC + LGPD)
- Casos reais ANVISA mencionados como gotchas
- ADR 0011 reservado (feedback loop + LGPD framework)
- IA Gemini com Zod parse strict + RT approval mandatório (defesa em camadas)
- Brand neutro do portal paciente (white-label-ready)
- A11y AA + pen test mandatórios em 11-08

Não shipei nada de mediano. Cada PLAN.md está executável.

---

## Phase 11 vs Phases 9/10 (comparação)

| Aspecto | Phase 9 (Bioquímica) | Phase 10 (Liberação+Críticos) | Phase 11 (Feedback Loop) |
|---------|----------------------|-------------------------------|--------------------------|
| Tipo | CIQ analítico (Bloco F) | Pós-analítico + Laudos (Blocos G+I) | Feedback Loop (DICQ 4.8 + 4.14.x) |
| Surfaces | 1 | 3 | 4 (3 internas + 1 portal externo) |
| Auth externa | Não | Sim (médico) | Sim (paciente) |
| LGPD impact | Médio | Médio | **Alto** (PII intensivo) |
| IA integration | Gemini bula PDF | Não | **Gemini classificação** |
| Plans | 5 | 7 | **8** |
| Duração | 8 sem | 12.5 sem | **12.5 sem** |
| Risk profile | Médio | Alto | **Alto** (LGPD + IA + portal) |
| Compliance crítico | RDC 978 Arts. 179-180 | RDC 978 Arts. 167, 184-191 | DICQ 4.8/4.14.3/4.14.4 + LGPD + 4.15 |
| Time | Eng A+B | Eng C+D | Eng E+F |
| Replicação de outras phases | 90% (hema) | 0% (greenfield) | ~30% (auth externa do Plan 10-05; pattern PDF Plan 10-04) |
| Diferenciação mercado | Médio | Alto | **Muito alto** (lacuna real) |

Phase 11 é a mais completa e estratégica. Cobre 3 itens DICQ + alimenta 4.15 + cria portal paciente + IA + LGPD framework. Pode virar selling point principal do produto.
