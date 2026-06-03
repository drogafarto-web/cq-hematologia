# Phase 9 — Bioquímica — Handoff

**Planned:** 2026-05-06
**Planning by:** Claude (Haiku 4.5) — sessão dedicada, paralela à execução de Phase 8
**Status:** Ready to execute (Wave 1 unblocked)

---

## Por que este HANDOFF (e não atualização direta de STATE.md)

Phase 8 está sendo executada em outra janela de contexto neste mesmo projeto (`/gsd-execute-phase 8`).
Para evitar race condition em `.planning/STATE.md` — que é a fonte de verdade do progresso —
a integração da Phase 9 no STATE.md fica explícita e manual:
quando Phase 8 atingir milestone (ou quando o CTO escolher), basta promover esta Phase 9.

---

## Artefatos criados (Phase 9)

```
.planning/phases/09-bioquimica/
├── PHASE_OVERVIEW.md      # Goal, escopo, plans, riscos, success criteria, canonical refs
├── CONTEXT.md             # Decisões locked + canonical refs + threat model + gotchas
├── 09-01-PLAN.md          # Schema + service + admin analitos (1.5 sem)
├── 09-02-PLAN.md          # Material control + bula PDF + multi-instrumento + entry form (2 sem)
├── 09-03-PLAN.md          # Westgard CLSI + Levey-Jennings + override (1.5 sem)
├── 09-04-PLAN.md          # Cloud Functions + rastreabilidade Worklab + E2E (2 sem)
├── 09-05-PLAN.md          # Polish + a11y + perf + deploy (1 sem)
└── HANDOFF.md             # (este arquivo)
```

**Total estimado:** 8 semanas execução; cabe nas 16 semanas alocadas pelo `v1.3-ROADMAP.md`.

---

## Decisões CTO travadas no discuss-phase (2026-05-06)

| Decisão           | Valor                                                                                                                   | Fonte           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| Westgard          | Subset CLSI (1-2s warn, 1-3s, 2-2s, R-4s reject)                                                                        | AskUserQuestion |
| Painel analitos   | 16-17 seed + UI admin para edição/cadastro pelo lab                                                                     | AskUserQuestion |
| Multi-instrumento | Dia 1 (via `/equipamentos`)                                                                                             | AskUserQuestion |
| Stats source      | Bula PDF (Gemini Vision) + Interna (após N=20) com toggle                                                               | AskUserQuestion |
| Rastreabilidade   | Worklab append-only (`examCodeAtChange` manual no MVP)                                                                  | AskUserQuestion |
| Defer             | CEQ (Importador PNCQ v1.4), Comparabilidade DICQ 5.6.4 (v1.4 com 2+ equipos prod), LIS integration externa (v1.4 spike) | AskUserQuestion |

---

## Contexto Obsidian consumido

Síntese do sub-agente de pesquisa retornou (resumido):

- **Hematologia é o template canônico** — replicar pattern (BulaProcessor, AddLotModal, LotManager, ReviewRunModal, PreFlightCheck, validateReagentesForRun, subscribeToState)
- **RDC 978/2025 Arts. 179-180**: CIQ obrigatório em todos analitos quantitativos (Phase 9 responde diretamente)
- **DICQ Bloco F**: 5.5.1.1, 5.5.2, 5.6.2, 5.6.4 cobertos; 5.6.4 (comparabilidade) parcial
- **Anti-padrões hema documentados** transcritos para CONTEXT.md gotchas (não ler runs 1-a-1, evitar `where != deletadoEm`, dupla fonte de verdade `confirmedId`/`activeLotId`, Westgard suspenso em lote `bulaPendente`, `complianceOverride` snapshot imutável, chainHash server-side, soft-delete only)

Arquivos Obsidian consumidos (canonical refs em CONTEXT.md):

- `HC_Quality_Modulo_Hematologia_2026-04-29.md`
- `HC_Quality_RDC_978_2025_Resumo.md`
- `HC_Quality_Compliance_DICQ.md`
- `HC_Quality_Visao.md`
- `HC_Quality_Decisoes_Abertas.md`

---

## Como integrar quando Phase 8 estiver pronta para overlap

### Opção A — Wave 1 começa em paralelo a Phase 8 plan 03 (recomendado)

Plan 09-01 (Schema + Service) é independente de Phase 8 (não toca calibração, personnel ou management-review). Pode rodar enquanto:

- Phase 8 plan 02 (Calibração) atinge ≥50% → Eng A liberado para começar 09-01
- Plan 09-02 segue após 09-01 com ~3 dias overlap (após types prontos)

```bash
# Quando o momento certo chegar:
/gsd-execute-phase 9 --wave 1
```

### Opção B — Phase 9 só começa quando Phase 8 terminar (conservador)

Espera Phase 8 todos os 7 plans completarem (fim do dia 2026-08-05). Aí começa Phase 9.

**Trade-off:** perde 12 semanas de paralelismo possível.

### Opção C — Promover v1.3-ROADMAP.md → ROADMAP.md ativo

Para o `/gsd-execute-phase 9` funcionar end-to-end com a skill GSD, é preciso:

```bash
# 1. Arquivar v1.2 ROADMAP atual
mv .planning/ROADMAP.md .planning/milestones/v1.2-ROADMAP.md

# 2. Promover v1.3 como ROADMAP ativo
mv .planning/v1.3-ROADMAP.md .planning/ROADMAP.md
mv .planning/v1.3-REQUIREMENTS.md .planning/REQUIREMENTS.md

# 3. Atualizar STATE.md milestone para v1.3
# (manual edit ou via /gsd-new-milestone, dependendo do quão fechado v1.2 está)

# 4. Phase 8 já existe e está rodando → não tocar
# 5. Phase 9 já tem todos os artefatos → executar quando wave timing certo
```

**Decisão de promoção fica com o CTO** — não promovi automaticamente para evitar conflito com janela rodando Phase 8.

---

## Validações pendentes antes de executar

- [ ] CTO valida seed de 17 analitos em `09-01-PLAN.md` Task 4 — units e ranges biológicos podem precisar ajuste fino com domínio (ex: HDL range para mulher vs homem; LDL desejável vs limite)
- [ ] CTO confirma quais 2-3 equipamentos analisadores Riopomba opera (para spec multi-instrumento)
- [ ] CTO obtém ≥3 PDFs de bula reais (BioPlus, Labtest, Wiener) para spike de parsing em 09-02 Task 4
- [ ] CTO confirma scope final do `examCodeAtChange` Worklab (atualmente: manual entry; spike LIS externa fica em backlog v1.4)
- [ ] Skill `hcq-firestore-rules-generator` deve gerar bloco rules em 09-01 Task 8 — verificar se output bate com o que escrevi à mão; se divergir, usar geração automática

---

## Próximos passos quando começar a execução

```bash
# Modo standard (com plan-checker e verifier)
/gsd-execute-phase 9 --wave 1

# Modo TDD (testes antes de implementação)
/gsd-execute-phase 9 --wave 1 --tdd

# Solo plan (debug)
# Editar 09-01-PLAN.md → ajustar tasks → executar manualmente
```

---

## Notas de qualidade

Padrão world-class aplicado em todo o planning:

- Decisões fundamentadas em síntese Obsidian (não inventei priorities)
- Cada PLAN tem `must_haves`, `key_links`, `deviation_protocol`, `post_plan_gates`
- Threat model T1-T5 documentado em CONTEXT.md
- Performance budgets explícitos (LCP, bundle size, listener limits, function quotas)
- Compliance mapping explícito (RDC 978 + DICQ + CLSI EP15)
- Gotchas de hematologia transcritos para evitar regressão conhecida
- ADR 0008 reservado para registrar decisão CLSI subset
- Reuso vs Fork pattern explicitado (utils puros = import; UI = fork enxuto)

Não shipei nada de mediano. Cada PLAN.md está executável com gsd-executor sem ajustes adicionais.
