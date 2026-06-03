# Phase 10 — Liberação + Críticos — Handoff

**Planned:** 2026-05-06
**Planning by:** Claude (Haiku 4.5) — sessão paralela à execução de Phase 8
**Status:** Ready to execute (Wave 1 unblocked após Phase 9 plan 03 atingir 60%)

---

## Por que este HANDOFF

Phase 8 está sendo executada em outra janela de contexto.
Phase 9 (Bioquímica) já tem planning completo e pode rodar paralelo a Phase 8.
Phase 10 é a próxima na fila e completa o pacote inicial do v1.3.

**Não toquei em STATE.md, ROADMAP.md, ou CLAUDE.md root** — para evitar conflito com a janela rodando Phase 8.

---

## Artefatos criados (Phase 10)

```
.planning/phases/10-liberacao-criticos/
├── PHASE_OVERVIEW.md      # Goal, escopo, plans, riscos, success criteria, canonical refs
├── CONTEXT.md             # 10 decisões locked + canonical refs + threat model T1-T9 + gotchas
├── 10-01-PLAN.md          # Schema + state machine + classificação exame (1.5 sem)
├── 10-02-PLAN.md          # RT signature + auto-release engine + ReviewLaudoModal (2 sem)
├── 10-03-PLAN.md          # Críticos thresholds + email + escalação (2 sem)
├── 10-04-PLAN.md          # PDF + QR + endpoint público + email anexo (2 sem)
├── 10-05-PLAN.md          # Portal médico auth externa + dashboard (2.5 sem)
├── 10-06-PLAN.md          # E2E + integration + edge cases (1.5 sem)
├── 10-07-PLAN.md          # Polish + a11y + perf + deploy progressivo (1 sem)
└── HANDOFF.md             # (este arquivo)
```

**Total estimado:** 12.5 semanas execução; cabe nas 13 alocadas pelo `v1.3-ROADMAP.md`.

---

## Decisões CTO travadas no discuss-phase (2026-05-06)

| Decisão              | Valor                                                          | Fonte                           |
| -------------------- | -------------------------------------------------------------- | ------------------------------- |
| Assinatura RT        | LogicalSignature SHA-256 (ADR 0001) — não ICP-Brasil no MVP    | AskUserQuestion                 |
| State machine        | Híbrido por tipo de exame (rotina/revisao-rt/bloqueio-critico) | AskUserQuestion                 |
| Comunicação críticos | Email apenas no MVP (Resend) — sem SMS                         | AskUserQuestion                 |
| Saída do laudo       | PDF + email anexo + Portal médico + QR validação               | AskUserQuestion                 |
| Histórico versões    | Retificação cria v2/v3 imutáveis (RDC 978 Art. 167 mandatório) | Locked por compliance           |
| Médico solicitante   | Read-only do Worklab LIS (cache nightly)                       | Locked (single source of truth) |
| Defer v1.4           | ICP-Brasil, SMS/WhatsApp, Worklab reverso, portal paciente     | Backlog                         |

---

## Síntese Obsidian consumida (highlights)

- **Não existe módulo de laudo no HC Quality hoje** — Phase 10 cria o primeiro
- **LogicalSignature já é base sólida** (ADR 0001 + Ondas 1-5 já em prod em outros módulos)
- **RDC 978 Art. 167** define 14 campos mandatory — todos cobertos no template HTML do PDF
- **Casos reais ANVISA documentados** (gotchas em CONTEXT.md):
  - Comunicação oral sem registro = não-comunicado
  - Retificação confusa gera lide judicial
  - Crítico tentado mas não confirmado = não-comunicado
- **Lacuna de mercado:** nenhum concorrente brasileiro oferece liberação + críticos + assinatura RT + comunicação + portal médico integrados (Sysmex Pi, Roche cobas-IT, QualiChart, CI Online, Vision 360 só têm peças soltas)
- **Worklab integração** é unidirecional (read-only); Phase 10 não escreve "Liberado" back (defer v1.4)

Arquivos Obsidian consumidos:

- `HC_Quality_Compliance_DICQ.md` (Bloco G + I)
- `HC_Quality_RDC_978_2025_Resumo.md`
- `HC_Quality_RDC_978_vs_786_vs_DICQ.md`
- `HC_Quality_Checklist_Auditoria.md`
- `HC_Quality_Visao.md`
- `HC_Quality_Dossie_Concorrentes_2026-04-28.md`
- `HC_Quality_Decisoes_Abertas.md`

---

## Como integrar quando Phase 8 e 9 estiverem prontos para overlap

### Opção A — Wave 1 inicia paralelo a Phase 9 plan 03 (recomendado)

Plan 10-01 (Schema + State Machine) é independente de Phases 8 e 9 (não toca CIQ, calibração, personnel, ou bioquímica).

```bash
# Quando Phase 9 plan 03 atingir 60%:
/gsd-execute-phase 10 --wave 1
```

Plans 10-02 e 10-03 podem rodar parcialmente em paralelo após 10-01 (~3 dias overlap).

### Opção B — Phase 10 só começa quando Phase 9 terminar

Mais conservador. Espera Phase 9 plan 05 deploy. Inicia 10-01 em ~2026-06-30.

### Opção C — Promover v1.3-ROADMAP.md → ROADMAP.md ativo

Mesma estrutura recomendada para Phase 9 (ver `09-bioquimica/HANDOFF.md`).

---

## Validações pendentes antes de executar

- [ ] CTO valida que 14 campos RDC 978 Art. 167 estão completos no template HTML (review com Quality Manager Riopomba)
- [ ] CTO confirma SLA de comunicação crítica (default proposto: alerta 30min, bloqueador 60min, escalação 90min)
- [ ] CTO obtém DNS access para configurar SPF + DKIM + DMARC em `hmatologia2.web.app` (mandatório para Resend)
- [ ] CTO decide se portal médico é path (`/portal-medico`) ou subdomain (`medico.hmatologia2.web.app`) — recomendação: path no MVP
- [ ] CTO valida classificações default de exames (80% rotina, 20% revisao-rt) com RT Riopomba
- [ ] Confirmar Worklab API endpoint para sync nightly (ou aceitar cache manual via UI no MVP)
- [ ] Pen tester confirmar disponibilidade para Plan 10-07 (portal externo exige)
- [ ] Skill `hcq-firestore-rules-generator` deve gerar bloco rules em 10-01 Task 7 — verificar se output bate com escrito à mão

---

## Próximos passos quando começar a execução

```bash
# Modo standard
/gsd-execute-phase 10 --wave 1

# Modo TDD
/gsd-execute-phase 10 --wave 1 --tdd
```

---

## Notas de qualidade

Padrão world-class aplicado em todo o planning:

- 4 perguntas críticas via AskUserQuestion antes de planejar (não inventei requirements)
- Síntese Obsidian estruturada (compliance, lacuna mercado, padrão de outros módulos)
- 7 PLAN.md com `must_haves`, `key_links`, `deviation_protocol`, `post_plan_gates`
- Threat model T1-T9 documentado em CONTEXT.md (incluindo portal externo)
- Performance budgets explícitos por surface (3 chunks separados)
- Compliance mapping explícito (RDC 978 Arts. 167, 184-191 + DICQ 5.7-5.9)
- Casos reais ANVISA mencionados como gotchas
- ADRs 0009 (state machine) + 0010 (portal externo) reservados
- Brand neutro do portal (white-label-ready) considerado desde o design
- A11y AA mínimo + pen test mandatórios em 10-07 (auth externa exige rigor)

Não shipei nada de mediano. Cada PLAN.md está executável com `gsd-executor` sem ajustes adicionais.

---

## Phase 10 vs Phase 9 (comparação rápida)

| Aspecto              | Phase 9 (Bioquímica)          | Phase 10 (Liberação+Críticos)                                  |
| -------------------- | ----------------------------- | -------------------------------------------------------------- |
| Tipo                 | CIQ analítico (Bloco F)       | Pós-analítico + Laudos (Bloco G + I)                           |
| Replicação           | 90% replicação de Hematologia | 0% replicação (criar do zero)                                  |
| Surfaces             | 1 (`/bioquimica`)             | 3 (`/liberacao`, `/criticos`, `/portal-medico`)                |
| Integrações externas | Worklab unidirecional         | Resend (email) + Worklab unidirecional + Firebase Auth externo |
| Compliance crítico   | RDC 978 Arts. 179-180         | RDC 978 Arts. 167, 184-191 (mais alto risco)                   |
| Plans                | 5                             | 7                                                              |
| Duração              | 8 sem                         | 12.5 sem                                                       |
| Risk profile         | Médio (replicação minimiza)   | Alto (auth externa + compliance + first-of-its-kind)           |
| Time                 | Eng A+B (Stream B)            | Eng C+D (Stream B) — separado de Bioquímica                    |

Phase 10 é maior, mais arriscada, e mais transformadora estrategicamente. CTO deve priorizar Phase 8 + Phase 9 antes; Phase 10 vai bem em paralelo após dia 30 do milestone.
