# HC Quality Roadmap — Milestone v1.2 (Audit Readiness)

**Milestone:** v1.2 — Audit Readiness
**Period:** 2026-05-06 → 2026-06-05 (30 dias)
**Updated:** 2026-05-06
**Owner:** CTO

> **Histórico:** Roadmaps anteriores (v1.0 Phase 1-2, v1.1 Phase 3.x) arquivados em `.planning/phases/` + `MILESTONES.md`.

---

## High-Level Timeline

```
v1.2 Audit Readiness (30 dias)

Phase 4 (3-4 dias):  Cleanup v1.1 ────────┐
                                          │  (paralelo possível com P5 a partir do dia 3)
Phase 5 (10-12 dias): Auditoria Interna ──┼──┐
                                          │  │
Phase 6 (5-7 dias):   LGPD + DR ──────────┴──┼──┐
                                             │  │
Phase 7 (3-5 dias):   Dry-Run ───────────────┴──┴──→ EXIT GATE: relatório RT
```

**Entregue:** sistema endurecido + módulo Auditoria Interna em prod + LGPD operacional + DR formal + 1 sessão de auditoria interna real documentada.

---

## Phase 4 — Cleanup v1.1 (Days 1-3)

**Goal:** Fechar resíduos não-bloqueantes do v1.1 antes de auditor olhar o sistema.

**Duration:** 3-4 dias

**Requirements coberto:** CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04

**Deliverables:**
- Firestore rules sem `// TEMP-IMPLANTACAO` em coleções analytics + export-jobs (membership real, testes verde)
- `docs/PERFORMANCE_PATTERNS.md` escrito com padrões de bundle, listeners, polling, Web Vitals
- Firebase Performance Monitoring com budget alerts configurados (LCP <2.5s, INP <200ms, CLS <0.1)
- `docs/PERFORMANCE_BASELINE_2026-05.md` com Lighthouse runtime das 3 rotas críticas

**Success criteria:**
1. Auditor revisando `firestore.rules` não vê regra `isAuthenticated()` sem membership em coleção sensível
2. `.claude/rules/performance.md` aponta para doc real (não-quebrado)
3. Alertas Firebase Perf disparam em ambiente de teste quando budget é violado
4. Baseline Lighthouse documentado e CI alerta regressão >10%

**Plans:**
- [x] `04-01-PLAN.md` — Replace TEMP-IMPLANTACAO rules + write tests (Wave 1, depends on none) ✅ COMPLETE
- [x] `04-02-PLAN.md` — Performance patterns docs + Lighthouse baseline + Firebase alerts (Wave 1, depends on none) ✅ COMPLETE

**Execution notes:**
- Both plans run in parallel (Wave 1). No blocking dependencies.
- Plan 01 has 1 checkpoint (human review of rules changes before deploy).
- Plan 02 is fully autonomous (docs + Firebase console config).

**Skills GSD:**
- `/gsd-discuss-phase 4` — clarificar membership rules (qual claim/role usar?)
- `/gsd-plan-phase 4` ✅ COMPLETE — 2 plans created
- `/gsd-execute-phase 4` ✅ COMPLETE
- `/gsd-validate-phase 4` ✅ COMPLETE

---

## Phase 5 — Módulo Auditoria Interna (Days 3-14)

**Goal:** Construir o módulo `auditoria-interna` (DICQ 1.3) e fazer deploy em produção.

**Duration:** 10-12 dias

**Requirements coberto:** AUDI-01, AUDI-02, AUDI-03, AUDI-04, AUDI-05, AUDI-06

**Deliverables:**
- `src/features/auditoria-interna/` completo (types, service, hooks, components, tests)
- Firestore rules + indices + Cloud Functions (`generateAuditReportPDF`, `installChecklistTemplate`, `mapAchadoToNC`)
- Template `dicq-4-3-rdc-978-v1` com ~115 itens carregados a partir do checklist Obsidian
- UI dark-first com modo tablet ergonômico para auditor in-loco (foto evidence, checkboxes grandes, offline-friendly)
- Integração bidirecional com NC global (achado maior → cria NC automaticamente)
- Tile no `/hub` exposto para `auditor` e `responsavelTecnico`

**Success criteria:**
1. Auditor consegue criar plano anual + sessão + executar 115 itens em iPad sem fricção
2. Achado classificado "maior" gera NC global em <2s (E2E test verde)
3. PDF de relatório gerado <10MB com assinatura RT registrada (logical signature)
4. Smoke test manual: criar auditoria → executar → fechar → exportar PDF → arquivar

**Dependências:**
- Phase 4 não bloqueia início (pode rodar em paralelo a partir do dia 3)
- Consome spines existentes: `/users` (Pessoa), `/pops` (POP), `/naoConformidades` (NC)

**Plans:**
- [ ] `05-01-PLAN.md` — Foundation: types, service, hooks, rules, checklist template (Wave 1, depends on none) ✅ PLAN CREATED
- [ ] `05-02-PLAN.md` — UI components: AuditoriaView, SessaoExecucaoPanel, AchadoForm, tablet UX (Wave 2, depends on 05-01)
- [ ] `05-03-PLAN.md` — Cloud Functions: registerAchado, installChecklistTemplate, updateChecklistResponses, auto-NC (Wave 2, depends on 05-01)
- [ ] `05-04-PLAN.md` — PDF generation + E2E tests: generateAuditReportPDF, export button, full workflow test (Wave 3, depends on 05-02/03)

**Execution notes:**
- Plan 05-01 already executed (Foundation complete)
- Plans 05-02 and 05-03 can run in parallel (Wave 2)
- Plan 05-04 depends on both (Wave 3)
- Critical path: 05-01 → (05-02 + 05-03 parallel) → 05-04

**Skills GSD:**
- `/gsd-discuss-phase 5` — clarificar UX tablet, modo offline, severity mapping
- `/gsd-ui-phase 5` — design contract do módulo (frontend novo, dark-first)
- `/gsd-plan-phase 5` ✅ COMPLETE
- `/gsd-execute-phase 5` (in progress: 05-01 done, 05-02/03/04 pending)
- `/gsd-secure-phase 5` — rules + audit trail revisados antes de deploy

---

## Phase 6 — Compliance Operacional (Days 10-20)

**Goal:** Endurecer LGPD + formalizar Disaster Recovery. Pré-requisitos não-bloqueantes para auditoria.

**Duration:** 5-7 dias

**Requirements coberto:** LGPD-01, LGPD-02, LGPD-03, DR-01, DR-02

**Deliverables:**
- DPIA preenchida em `/labs/{labId}/lgpd/dpia` com versionamento; UI admin renderiza
- Fluxo `/exclusao-titular` E2E: CPF → OTP/email → CF `deleteTitularData` (zera PII, mantém audit chain-hash)
- Página `/privacidade` com versionamento + registro de aceite por usuário
- `docs/DR_PLAN.md` cobrindo 4 cenários (corruption, outage, credentials, ransomware)
- `docs/DR_RESTORE_TEST_2026-05.md` documentando restore real em staging com verificação de integridade

**Success criteria:**
1. Admin pode imprimir DPIA como PDF (auditor pede)
2. Titular consegue solicitar exclusão; CF zera PII e mantém chain-hash íntegro (teste E2E verde)
3. Política de privacidade tem registro de aceite armazenado por usuário
4. Plano de DR existe e é executável (referenciado em SGQ)
5. Restore real comprovado: snapshot prod restaurado em staging, integridade verificada

**Dependências:**
- Pode rodar em paralelo com Phase 5 (independências)
- Phase 4 (CLEAN-01 rules tightening) deve estar terminado antes de DR test (não restaurar dados em staging com rules abertas)

**Plans:**
- [ ] TBD (planning pending)

**Skills GSD:**
- `/gsd-discuss-phase 6` — clarificar fluxo OTP exclusão, janela de manutenção do restore
- `/gsd-plan-phase 6` (pending)
- `/gsd-execute-phase 6` (pending)
- `/gsd-secure-phase 6` — revisar deleteTitularData (chain-hash não pode quebrar)

---

## Phase 7 — Audit Dry-Run (Days 20-25)

**Goal:** Executar auditoria interna real usando o sistema construído. Output é evidência viva.

**Duration:** 3-5 dias

**Requirements coberto:** DRYRUN-01, DRYRUN-02, DRYRUN-03, DRYRUN-04

**Deliverables:**
- Sessão de auditoria criada e executada contra os ~115 itens do template DICQ + RDC 978
- Achados documentados como NCs reais no sistema (não em planilha externa)
- CAPA preenchido para cada NC crítica
- Plano de remediação consolidado em PDF
- Relatório final assinado RT armazenado em Storage

**Success criteria:**
1. 100% dos itens do checklist respondidos (conforme/não-conforme/N.A.)
2. Todos os achados "maior" geraram NC com CAPA iniciado
3. Plano de remediação tem prazo + responsável + critério de eficácia para cada NC crítica
4. PDF final assinado pelo RT está em Storage com link compartilhável (preparado para auditor externo no futuro)

**Dependências:**
- Phase 5 (módulo) DEVE estar em produção
- Phase 6 não bloqueia (mas auditoria vai gerar achados sobre LGPD/DR, então melhor ter prontas)

**Plans:**
- [ ] `07-01-PLAN.md` — Audit coordination, execution, CAPA consolidation, report generation (Wave 1, depends on Phase 5 deployment) ✅ PLAN CREATED

**Execution notes:**
- Single plan: sequential audit execution workflow
- 5 major tasks: briefing/go-no-go, environment prep, in-loco execution, CAPA consolidation, report generation + sign-off
- 2 checkpoints: (a) pre-execution go-no-go decision, (b) post-execution environment verification
- Fully autonomous after checkpoints (all data entry via Phase 5 UI, Cloud Functions handle NC auto-creation)

**Skills GSD:**
- `/gsd-discuss-phase 7` — quem conduz, qual data, RT disponível
- `/gsd-plan-phase 7` ✅ COMPLETE
- `/gsd-execute-phase 7` (pending)
- `/gsd-validate-phase 7` — verificar que evidências geradas são auditáveis

---

## Exit Gate (Fim do Milestone v1.2)

Antes de fechar v1.2 e iniciar v1.3:

- [x] Phase 4: Resíduos do v1.1 fechados ✅ COMPLETE
- [ ] Phase 5: Módulo Auditoria Interna em produção, smoke test verde (05-01 done, 05-02/03/04 pending)
- [ ] Phase 6: DPIA + exclusão titular + DR plan + restore test todos comprovados (planning pending)
- [ ] Phase 7: 1 auditoria interna real executada e documentada (plan ready, execution pending)
- [ ] CTO sign-off: "v1.2 done, ready for v1.3 planning"
- [ ] `/gsd-complete-milestone` — arquivar phases + atualizar MILESTONES.md

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| Phase 5 sub-estimado (módulo + 115 itens checklist) | 🔴 | Médio | Template carregado via callable (não manual); reusar `auditoria-trail` como base de service |
| Phase 6 LGPD trava em aprovação jurídica DPIA | 🟠 | Médio | Começar Phase 6 em paralelo com Phase 5 desde dia 10 |
| Restore test corrompe staging | 🟠 | Baixo | Snapshot dedicado, projeto staging isolado, dry-run antes do test real |
| Auditoria dry-run gera muito achado crítico | 🟠 | Alto | Esperado — propósito é descobrir gaps. Plano de remediação vai pra v1.3. |
| Dia 30 chega com Phase 7 incompleta | 🟠 | Médio | Phase 7 pode ser executada com checklist parcial (blocos prioritários A-E primeiro); resto vira primeiro plano de v1.3 |

---

## Cross-Phase Parallelization

| Day | P4 | P5 | P6 | P7 |
|-----|----|----|----|-----|
| 1-3 | ████ | | | |
| 3-10 | █ (overlap) | ████ | | |
| 10-14 | | ████ | ████ | |
| 14-20 | | █ (validate) | ████ | |
| 20-25 | | | █ (validate) | ████ |
| 25-30 | | | | █ (buffer/remediation) |

**Critical path:** P4 → P5 deploy → P7 dry-run.
**Parallel slack:** P6 pode atrasar 5 dias sem afetar P7.

---

## Success Metrics (v1.2)

| Metric | Baseline (v1.1 end) | Target (v1.2 end) |
|--------|---------------------|-------------------|
| Módulos em produção | 24 | 25 (+ auditoria-interna) |
| TEMP-IMPLANTACAO em rules | 2 (analytics + export-jobs) | 0 |
| LGPD operacional | 🟡 parcial | ✅ DPIA + exclusão + política |
| DR formal | ✅ parcial (logs + backups) | ✅ plan + restore test comprovado |
| Auditoria interna executada | 0 | 1 (dry-run, evidência arquivada) |
| Cobertura DICQ 4.3 / RDC 978 | ~85% (estimativa) | 100% mapeada (achados documentados, não 100% conforme — esse é o ponto) |
| Tests | 738/738 ✓ | 738+N ✓ (módulo novo cobrindo) |

---

## Tracking

`.planning/STATE.md` é a fonte de verdade do status atual. Phase artifacts vão pra `.planning/phases/04-cleanup/`, `05-auditoria-interna/`, `06-compliance/`, `07-dry-run/`.

---

**Next:** Phase 5 execution (Plans 05-02/03 can start in parallel after 05-01 deployment)
