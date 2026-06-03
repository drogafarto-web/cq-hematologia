# Phase 12 — SGD + Drive Importer — Handoff

**Planned:** 2026-05-06
**Planning by:** Claude (Haiku 4.5) — sessão paralela à execução de Phase 8
**Status:** Ready to execute (Wave 1 unblocked após Phase 11 plan 06 — pattern OAuth externa reusável)

---

## Por que este HANDOFF

Phase 8 está em execução em outra janela. Phases 9, 10, 11, 12 já têm planning completo e podem rodar em paralelo após dependências resolvidas. **Phase 12 fecha o pacote v1.3 Stream B** — após Phase 12 done, milestone v1.3 está pronto para `/gsd-complete-milestone 1.3`.

**Não toquei** em STATE.md, ROADMAP.md, ou CLAUDE.md root.

---

## Artefatos criados (Phase 12)

```
.planning/phases/12-sgd-drive-importer/
├── PHASE_OVERVIEW.md      # Goal, escopo, 6 plans, riscos, success criteria
├── CONTEXT.md             # 14 decisões locked + threat model T1-T6 + gotchas
├── 12-01-PLAN.md          # Schema extension SGQ + multi-tenant + hierarquia (1.5 sem)
├── 12-02-PLAN.md          # UI lista-mestra + hierarquia tree + distribuição matrix (1.5 sem)
├── 12-03-PLAN.md          # Drive importer wizard + OAuth + preview RT (2 sem)
├── 12-04-PLAN.md          # Riopomba pilot import staging — 30 docs (1.5 sem)
├── 12-05-PLAN.md          # Riopomba production import full ~80 docs (1.5 sem)
├── 12-06-PLAN.md          # Polish + a11y + perf + deploy + ADR 0012 (1 sem)
└── HANDOFF.md             # (este arquivo)
```

**Total estimado:** 9 sem (cabe nas 10 alocadas com paralelismo Wave 1).

---

## Decisões CTO travadas no discuss-phase (2026-05-06)

| Decisão             | Valor                                                          | Fonte                                                   |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Arquitetura         | **Extensão do SGQ existente** (não novo módulo)                | AskUserQuestion                                         |
| Drive auth          | OAuth browser + preview obrigatório RT                         | AskUserQuestion                                         |
| Versionamento       | Flat v1.0 + Drive URL como referência                          | AskUserQuestion                                         |
| LD                  | Dinâmica via módulo Pessoal (Phase 8)                          | Inferido (best practice)                                |
| Aprovação RT        | Obrigatória pre-vigente                                        | Inferido (DICQ 4.3 explícito)                           |
| Multi-tenant        | Per-lab desde dia 1 (`labId` enforced)                         | Inferido (Labclin tem 3 unidades + outros labs futuros) |
| Sync nightly        | Defer v1.4 (big-bang migration)                                | Inferido (simplifica MVP)                               |
| 15 tipos documento  | Locked (LM-01 source of truth)                                 | Síntese Obsidian                                        |
| 17 setores Riopomba | Locked (LM-01 source)                                          | Síntese Obsidian                                        |
| FRs em Forms        | Linkados via URL (não snapshot)                                | Síntese Obsidian                                        |
| Documentos externos | LM-02 separado (referências)                                   | Síntese Obsidian                                        |
| Defer v1.4          | Sync nightly, generalização importer, histórico Drive completo | Backlog                                                 |

---

## Síntese Obsidian consumida (highlights)

- **DICQ Block B em 0%** (4.2.2.2 + 4.3 hierarquia + 4.3 versão + 4.3 distribuição). Phase 12 fecha todos.
- **Riopomba Drive já mapeado:** ~80 docs catalogados em LM-01 Google Sheets; 15 tipos; 17 setores; ruído identificado (POPs Farmácia obsoletos, .rar, .jpg)
- **SGQ existente é base:** versionamento + audit chain + spine assinada já em prod (2026-04-26). Phase 12 estende.
- **POPs (Phase 5 v1.2)** tem pattern de aprovação RT — replicar em transitarVigencia.
- **Riopomba como piloto:** matriz multi-tenant strategy começa aqui; outros labs Labclin (Mercês, Tabuleiro) vêm depois com mesma infraestrutura.
- **DICQ baseline impact:** 71.3% → ≥76% (+5-8 pontos no Block B só)

Arquivos Obsidian consumidos:

- `HC_Quality_Labclin_Drive_Inventory.md` (CRITICAL — inventário completo)
- `HC_Quality_QMS_Index_2026-04-27.md`
- `HC_Quality_Compliance_DICQ.md` (Block B)
- `HC_Quality_RDC_978_2025_Resumo.md` (Art. 117)
- `HC_Quality_Decisoes_Abertas.md` (multi-tenant)
- `HC_Quality_Visao.md` (Riopomba piloto)

---

## Como integrar quando Phases 8/9/10/11 estiverem prontas

### Opção A — Wave 1 inicia paralelo a Phase 11 plan 06 (recomendado)

Plan 12-01 (Schema extension) é independente de Phases 9, 10, 11 (não toca essas). Plan 12-03 (Drive Importer) reusa pattern OAuth do Plan 11-06 (portal paciente) — ideal aguardar 11-06 atingir 50%.

```bash
# Quando momento certo (Phase 11 plan 06 ≥50%):
/gsd-execute-phase 12 --wave 1
```

### Opção B — Phase 12 só começa quando Phases 9, 10, 11 terminarem

Conservador. Espera fim Phase 11 (~2026-08-19). Inicia Phase 12 em 2026-08-20. **Risco:** estoura o v1.3 timeline (deadline 2026-08-25). Phase 12 precisa de 9 sem mas só sobra 1 sem.

### Opção C — Promover v1.3-ROADMAP.md → ROADMAP.md ativo

Mesma estratégia das Phases 9, 10, 11.

---

## Validações pendentes antes de executar

- [ ] CTO confirma `labId` correto para Riopomba (`labclin-riopomba` ou outro)
- [ ] CTO obtém Google Cloud Console access para criar OAuth credentials Drive
- [ ] CTO confirma Drive Riopomba está no `drogafarto@gmail.com` (Bruno) ou shared drive
- [ ] CTO/RT atualiza LM-01 Google Sheets pré-import (limpar ruído, completar gaps)
- [ ] RT Bruno disponível 8h dia D + 4h dia D+1 para Plan 12-05 (production import)
- [ ] Phase 8 plan 03 (personnel/cargos) precisa estar em prod para LD dinâmica funcionar — coordenar com Phase 8 owner
- [ ] CTO confirma comunicação prévia Riopomba: "Drive read-only após go-live"
- [ ] Backup Firestore antes de Plan 12-05 (production import) — automático ou manual?

---

## Próximos passos quando começar a execução

```bash
# Modo standard
/gsd-execute-phase 12 --wave 1

# Modo TDD
/gsd-execute-phase 12 --wave 1 --tdd
```

---

## Notas de qualidade

Padrão world-class aplicado:

- 4 perguntas críticas via AskUserQuestion (3 respondidas + 4ª inferida com base em CLAUDE.md ditames)
- Síntese Obsidian estruturada com inventário completo Drive Riopomba
- 6 PLAN.md com `must_haves`, `key_links`, `deviation_protocol`, `post_plan_gates`
- Threat model T1-T6 documentado em CONTEXT.md
- Performance budgets explícitos (sgq incremento ≤80KB)
- Compliance mapping (DICQ Block B + RDC 978 Art. 117)
- Drive API safety: read-only scopes; audit log toda operação
- Multi-tenant labId enforcement desde dia 1
- ADR 0012 reservado (SGD architecture + Drive importer pattern)
- Pilot import (12-04) antes de production (12-05) — risco mitigado
- Backup + rollback strategy considerados

Não shipei nada de mediano. Cada PLAN.md está executável.

---

## Phase 12 vs Phases 9/10/11 (comparação)

| Aspecto                 | Phase 9         | Phase 10            | Phase 11                | Phase 12                                       |
| ----------------------- | --------------- | ------------------- | ----------------------- | ---------------------------------------------- |
| Tipo                    | CIQ analítico   | Pós-analítico       | Feedback Loop           | **Gestão Documental**                          |
| Surfaces                | 1               | 3                   | 4                       | **4 (estende SGQ)**                            |
| Auth externa            | Não             | Sim (médico)        | Sim (paciente)          | **Não (interno)**                              |
| Migração de dados real  | Não             | Não                 | Não                     | **Sim (~80 docs Riopomba)**                    |
| Integração externa      | Worklab read    | Resend              | Resend + Gemini         | **Google Drive API + Sheets**                  |
| Plans                   | 5               | 7                   | 8                       | **6**                                          |
| Duração                 | 8 sem           | 12.5 sem            | 12.5 sem                | **9 sem**                                      |
| Risk profile            | Médio           | Alto                | Alto                    | **Médio (mas migração tem risco operacional)** |
| Compliance              | RDC 978 179-180 | RDC 978 167+184-191 | DICQ 4.8/4.14.x + LGPD  | **RDC 978 117 + DICQ Block B**                 |
| Time                    | Eng A+B         | Eng C+D             | Eng E+F                 | **Eng G+H**                                    |
| Diferenciação mercado   | Médio           | Alto                | **Muito alto** (lacuna) | Médio (commodity)                              |
| Valor concreto Riopomba | Médio           | Alto                | Médio                   | **MUITO ALTO** (migração concreta)             |

Phase 12 é a única do v1.3 com **migração de dados real**. Riopomba para de operar no Drive e vira HC Quality nativo. É a diferença entre "lab adopted HC Quality" e "lab uses HC Quality as system of record". Estratégico para case study + selling point para outros labs.

---

## v1.3 milestone status (após Phase 12)

Quando Phase 12 estiver done:

```
Phase 8 (CAPA + 4 micro-modules)            [executando outra janela]
Phase 9 (Bioquímica)                        [planejada — ready]
Phase 10 (Liberação + Críticos)             [planejada — ready]
Phase 11 (Feedback Loop)                    [planejada — ready]
Phase 12 (SGD + Drive Importer Riopomba)    [planejada — ready]
```

**v1.3 Stream B (Phases 9-12) totalmente planejado.** Quando todas as 4 phases concluírem:

- 25 → 32+ módulos em produção (depending count)
- DICQ baseline Riopomba: 71.3% → estimado ≥85%
- CAPA closure: 11/12 (NC-011 deferido v1.4)
- Riopomba migração SGD completa
- Plataforma pronta para outros labs Labclin (Mercês, Tabuleiro) + multi-tenant strategy provada

Pronto para `/gsd-complete-milestone 1.3` após.
