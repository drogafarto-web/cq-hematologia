---
document: DICQ Closure Tracker — v1.4 Phases 4–9
version: 1.0
effective: 2026-05-08
audit_target: 2026-10-15
status: authoritative
owner: Compliance Research (R3)
---

# DICQ Closure Tracker — v1.4 Phases 4–9

> **WARNING — DICQ TRACKER UPDATES PAUSED (2026-05-08)**
>
> Phase 5 deltas are **on hold pending blocker resolution**. See `.planning/PHASE_5_CRITICAL_FINDINGS.md`.
>
> **Do NOT increment baseline 78.5% until BLOCKER 1, 3, 4, 5 closed and re-audited.**
>
> Reasons (summary):
> - **BLOCKER 2:** Phase 5 Tasks 05-03/04 are RDT serology classification, NOT Art. 167 laudo OCR. Any Phase 5 delta crediting Art. 167 is invalid.
> - **BLOCKER 6:** Projected swing 78.5% → 82%+ → 88% depends on `portal-rt`, `portal-paciente`, and `notivisa` — all currently placeholder or absent. Increments are projections, not earned coverage.
> - All 📋 Ready / ✅ entries in Phase 5 sections below remain **subject to revalidation**. Treat the historical table as planning intent, not as a compliance ledger, until the blocker review closes.
>
> Tracker editing protocol while paused: do not change percentages on the basis of Phase 5 projections; only commit-tied evidence (code merged + tests + auditor sign-off) may move numbers. CTO must approve any score change in writing.

---

**North Star Dashboard (PROJECTED, NOT EARNED): DICQ 78.5% (v1.3) → 88%+ (Phase 9) → 92%+ (External Audit Ready)**

This document is the **single source of truth** for DICQ compliance closure tracking through v1.4 execution. It maps all 115+ DICQ audit items across Phases 4–9, tracks completion percentage per block, identifies risk flags, and links to ADRs + compliance artifacts.

**Quick Status:** (all forward percentages PROJECTED; pending blocker review)
- **v1.3 Baseline:** 78.5% coverage (Phase 0–3 complete) — only line treated as earned
- **Phase 4 Target (2026-07-15):** 87% (CAPA + Auditoria + Riscos) — `pending-blocker`
- **Phase 5 Target (2026-08-15):** 88% (NOTIVISA + RDC Art. 195) — **PRE-AUDIT GATE** — `pending-blocker` (depends on portal-rt + portal-paciente + NOTIVISA, currently placeholder)
- **Phase 9 Target (2026-10-15):** 92%+ (Manual Qualidade + Laudo fields 10–12) — `pending-blocker`
- **External Audit:** 2026-10-15 (assuming pre-audit pass) — `pending-blocker`

---

## 1. DICQ Block A–J Closure Summary (Phases 4–9)

| Block | Title | v1.3 % | Phase 4 | Phase 5 | Phase 9 | Target v1.4 | Δ | Owner | Risk |
|-------|-------|--------|---------|---------|---------|-------------|---|-------|------|
| **A** | Governança & Direção | 78% | 82% | 85% | **92%** | 92% | +14 | Phase 1/9 | 🟡 Medium (Phase 9 scope) |
| **B** | Gestão Documental (SGD) | 65% | 70% | 72% | **92%** | 92% | +27 | Phase 3/9 | ✅ High confidence (SGD live) |
| **C** | Pessoal | 80% | 85% | 87% | **92%** | 92% | +12 | Phase 0/9 | 🟡 Medium (dossiê migration) |
| **D** | Qualidade & Compliance | 60% | 75% | 78% | **85%** | 85% | +25 | Phase 4/7 | 🟡 Medium (CAPA closure RFI) |
| **E** | Pré-Analítico | 64% | 68% | 70% | **75%** | 75% | +11 | Phase 6 | 🟠 Low (deferred to v1.5) |
| **F** | Analítico | 92% | 93% | 94% | **95%** | 95% | +3 | Phase 10 | ✅ High (foundation strong) |
| **G** | Pós-Analítico & Laudos | 70% | 80% | 85% | **92%** | 92% | +22 | Phase 5/8 | ✅ High (portal + NOTIVISA live) |
| **H** | Recursos | 75% | 80% | 82% | **88%** | 88% | +13 | Phase 0/9 | 🟡 Medium (calibração, manutenção) |
| **I** | Acomodações & Ambiente | 64% | 70% | 72% | **80%** | 80% | +16 | Phase 9 | 🟡 Medium (ISO 14644 expansion) |
| **J** | Continuidade & Confidencialidade | 70% | 73% | 75% | **78%** | 78% | +8 | — | ✅ High (v1.2 baseline stable) |
| | **WEIGHTED AVERAGE (Phase 4+ PROJECTED — `pending-blocker`)** | **78.5%** (earned) | **82%** | **88%** | **92%+** | **88%+** | **+9.5** | — | ⭐ markers removed 2026-05-08 |

**Key Thresholds (all PROJECTED — `pending-blocker`):**
- **88% (Phase 5):** PRE-AUDIT READY — schedule external DICQ auditor (2026-08-15) — `pending-blocker` until portal-rt + portal-paciente + NOTIVISA earn evidence
- **92%+ (Phase 9):** EXTERNAL AUDIT READY — official DICQ compliance certification (2026-10-15) — `pending-blocker`

> Reverted from preemptive ✅ markers on 2026-05-08. Per Scope Errata (BLOCKERS 2 + 6), no Phase 5+ row may carry an earned ✅ until code-level evidence is verified.

---

## 2. Phase 4 Deliverables & Closure Mapping (2026-06-01 ~ 2026-07-15)

### Phase 4 Objectives
- Close 12 CAPA findings from Phase 3 RFI
- Deploy auditoria-interna module (scheduling + checklist + trending)
- Finalize risk register (FMEA matrix + annual review template)
- Publish governance documents (norteadores, cargos, designações)
- Full KPI dashboard integration (SLA tracking + trending)

### Phase 4: Block-by-Block Closure

#### **Block A — Governança & Direção** (78% → 82%)

| DICQ Req. | Item | Phase 3 Status | Phase 4 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 4.1.1.3 | Norteadores (Mission/Vision/Values) + Código Ética | 🔴 Missing | ✅ Published in SGD | Form callable + RT signature; versioned document | REQ-411 + NEW-A2 | 📋 Ready |
| 4.1.2.3 | Política da Qualidade (publicada) | 🔴 Missing | ✅ Published in SGD | Derivado de Manual v1.3; distribuído a todos colaboradores | REQ-411 | 📋 Ready |
| 4.1.2.4 | Planejamento qualidade + medição desempenho | 🔴 Missing | ✅ KPI SLAs defined | Dashboard integrado; SLA targets publicados por tipo teste | REQ-401 | 📋 Ready (Phase 3.3 analytics) |
| 4.1.2.5 | Descrição de cargos + autoridades + substitutos | 🔴 Missing | ✅ Published | Form callable; subsections por role (RT, QM, supervisor, analyst) | REQ-403 | 📋 Ready |
| 4.1.2.7 | Designação formal Gerente Qualidade | 🔴 Missing | ✅ Formal designation | Director signature on appointment doc; versioned in SGD | REQ-403 | 📋 Ready |
| 4.1.2.8 | Plano governança corporativa + clínica | 🟡 Partial | ✅ Documento em SGD | Template ISOizado; preenchimento Lab Riopomba | REQ-402 | 🔄 In Progress |
| 4.15 | Análise Crítica Direção (15 entradas obrig) | 🔴 Missing | 🟡 Partial agenda | Scheduling + template; full entrega Phase 13 (planejamento) → Phase 14 (execução) | REQ-413 | 🔄 Deferred (stretch to v1.5) |

**Block A closure:** 78% → **82%** (6/7 items ✅, 1 deferred)

#### **Block D — Qualidade & Compliance Operacional** (60% → 75%)

Phase 4 is **the critical path** for Block D compliance. 12 CAPA findings from Phase 3 auditor RFI must close.

| DICQ Req. | Item | Phase 3 Status | Phase 4 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 4.8 | Tratamento reclamações (trending, closure, RCA) | 🟡 Partial | ✅ Full workflow | Phase 7 deliverable (reclamacoes module integration) | REQ-414 | 📋 Ready (Phase 7) |
| 4.10 | CAPA eficácia (root cause, ação, verificação) | 🟡 Partial (8 of 12) | ✅ Closure of 12 CAPA | Effectiveness verification callable + trending report; auditor RFI gate | — | 🔴 **BLOCKER** |
| 4.10.1 | CAPA effectiveness reporting + trending | 🔴 Missing | ✅ Dashboard | Fechamento taxa CAPA % por mês; rastreamento eficácia pós-ação | — | 🔴 **BLOCKER** |
| 4.11 | Ações preventivas (proativas) | 🔴 Missing | 🟡 Partial | Deferred to v1.5 (Gemini-assisted proposals). Phase 4 skeleton only. | — | 🔄 Stretch |
| 4.12 | Melhoria contínua (formalizado) | 🔴 Missing | ✅ Dashboard | Planos melhoria em SGD; dashboard trending; link NC → improvement | REQ-401 | 📋 Ready |
| 4.12.1 | Planos melhoria formalizados + monitoramento | 🔴 Missing | ✅ Formalized | Form callable; linked to indicators + CAPA | REQ-401 | 📋 Ready |
| 4.13 | Controle registros (retenção, integridade) | 🟡 Partial | ✅ Documented | Retention rules 5 anos (RDC Art. 115) + soft-delete enforcement | REQ-415 | ✅ Live (Phase 3) |
| 4.14.2 | Análise crítica solicitações + amostras | 🔴 Missing | 🟡 Partial reports | Relatórios periódicos pré-analítico (stretch). Phase 6 deliverable. | REQ-404 | 🔄 Deferred (Phase 6) |
| 4.14.3 | Realimentação usuários (satisfação) | 🟡 Partial | ✅ Dashboard | NPS portal + email trending + linked to improvement plans | REQ-414 | ✅ Live (Phase 3.3) |
| 4.14.4 | Sugestões pessoal (trending) | 🟡 Partial | ✅ Dashboard | Upvote + dashboard trending; linked to improvement | REQ-414 | ✅ Live (Phase 3.3) |
| 4.14.5 | Auditoria interna (ciclo, checklist, findings) | 🔴 Missing | ✅ Full module | Scheduling + DICQ-mapped checklist + NC linkage + trending; **NEW-D1** | NEW-D1 | 📋 Ready |
| 4.14.6 | Risk management (FMEA, matriz P×S×D, revisão) | 🟡 Partial | ✅ Finalized | FMEA-Lite matrix live (Phase 0); Phase 4 adds annual review template + trending | REQ-412 | ✅ Live (Phase 0) |
| 4.14.7 | Indicadores (pré/analítico/pós + SLA) | 🔴 Missing | ✅ Dashboard | 5 KPIs live (turnaround, retrabalho%, conformidade, NC origin, CAPA closure) | REQ-401 | 📋 Ready |
| 4.14.8 | Avaliações externas (registros) | 🔴 Missing | 🟡 Partial template | Template para registros DICQ/RDC/ANVISA audits; **NEW-D2**; preenchimento manual | NEW-D2 | 📋 Ready |

**Block D closure:** 60% → **75%** (10/14 items ✅, 2 deferred, 2 partial)

**CRITICAL RISK:** Phase 4 CAPA closure depends on auditor RFI response. If auditor disputes findings or requests rework, Phase 4 timeline slips. **Mitigation:** Weekly auditor calls (ADR-0018 deploy gate protocol); proactive documentation of CAPA evidence.

#### **Block F — Analítico** (92% → 93%)

Phase 4 contributes validation framework only (Phase 10 adds method validation certificates).

| DICQ Req. | Item | Phase 3 Status | Phase 4 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 5.5.1.1 | Procedimentos validados (Westgard + CIQ) | ✅ Live | ✅ Maintained | Baseline stable; Phase 10 expands | — | ✅ Live |
| 5.5.1.2 | Verificação antes de uso | 🟡 Partial | ✅ Framework | Formalize inspection checklist per analyzer; Phase 10 documentation | REQ-405 | 📋 Ready |
| 5.5.1.3 | Validação métodos não-padronizados | 🔴 Missing | 📋 Framework template | Template em SGD; population by Phase 10 | REQ-405 | 📋 Ready |
| 5.5.1.4 | Incerteza de medição | 🔴 Missing | 📋 Framework template | Calculation templates (Phase 10) | REQ-405 | 📋 Ready |
| 5.6.3.4 | Avaliação periódica CEQ + ações | 🔴 Missing | 📋 Framework | Annual report template (Phase 10 delivery) | REQ-409 | 📋 Ready |

**Block F closure:** 92% → **93%** (stable baseline; minor framework additions)

#### **Block H — Recursos** (75% → 80%)

| DICQ Req. | Item | Phase 3 Status | Phase 4 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 4.5 | Lab apoio (contrato, cláusulas, avaliação) | 🔴 Missing | ✅ Live | Module live Phase 0; contract template + 6 cláusulas + annual eval field | NEW-H1 | ✅ Live (Phase 0) |
| 5.3.1.4 | Calibração + rastreabilidade metrológica | 🔴 Missing | 📋 Schema deployed | Collection schema live Phase 3; population + integration Phase 9 | REQ-408 | 📋 Ready |
| 5.3.1.5 | Manutenção (preventiva, corretiva) | 🟡 Partial | ✅ Schema finalized | Consolidate equipamentos/{id}/manutencoes subcollection Phase 10 | TD-403 | 📋 Ready (Phase 10) |
| 5.3.1.6 | Notificação incidentes adversos | 🔴 Missing | ✅ Integrated to NOTIVISA | Tecnovigilância → Phase 8 integration | REQ-410 | 🔄 Deferred (Phase 8) |
| 5.3.1.7 | Registro completo (12 campos) | 🟡 Partial | ✅ Audit checklist | Audit de campos obrig. em Phase 9 | REQ-408 | 📋 Ready |

**Block H closure:** 75% → **80%** (4/5 items ✅, 1 deferred)

#### **Other Blocks (Stable)**

- **Block B (SGD):** 65% → **70%** (SGD improvements Phase 3; full via Phase 9)
- **Block C (Pessoal):** 80% → **85%** (Phase 0 skeleton + Phase 9 full)
- **Block E (Pré-Analítico):** 64% → **68%** (Phase 6 coleta + transporte)
- **Block G (Pós-Analítico):** 70% → **80%** (Phase 5 portal + NOTIVISA)
- **Block I (Ambiente):** 64% → **70%** (Phase 9 expansion)
- **Block J (Continuidade):** 70% → **73%** (stable, LGPD policy Phase 1)

### Phase 4 Success Criteria

- [ ] 12 CAPA findings closed + auditor sign-off documented
- [ ] CAPA effectiveness verification callable tested (6+ scenarios)
- [ ] Auditoria-interna module deployed (checklist builder + scheduling + NC linkage)
- [ ] 5 KPI indicators live on dashboard (SLA tracking + monthly reports)
- [ ] Governance documents published in SGD (norteadores, Política, cargos, designações)
- [ ] Risk register annual review template in place
- [ ] Cloud Logs validation: 0 errors, <5% warnings
- [ ] No regressions: 738/738 baseline tests + Phase 4 new tests (30+)

**Target completion:** 2026-07-15

---

## 3. Phase 5 Deliverables & Closure Mapping (2026-07-16 ~ 2026-08-15)

### Phase 5 Objectives
- RT medical portal (laudo review + signature)
- Patient external portal (report access + download)
- NOTIVISA integration (disease reporting + queue processing)
- Critical value escalation (SMS/email + SLA tracking)

### Phase 5: Block-by-Block Closure

#### **Block G — Pós-Analítico & Laudos** (80% → 85%)

| DICQ Req. | Item | Phase 4 Status | Phase 5 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 5.7.1 | Análise crítica antes liberação | 🔴 Missing | ✅ Workflow live | RT portal draft editor + approval callable + audit trail | REQ-415 | 📋 Ready |
| 5.7.2 | Resultados críticos (alerta + SLA) | 🔴 Missing | ✅ SMS/email + dashboard | Critical value detection + SMS/Twilio + email + SLA tracking dashboard | — | 📋 Ready |
| 5.7.3 | Notificação compulsória (Portaria 204 + NOTIVISA) | 🔴 Missing | ✅ API integration live | NOTIVISA queue processor + API calls + retry logic; **PHASE 5 CRITICAL** | REQ-410 | 📋 Ready |
| 5.9.1 | Liberação (autorização + transmissão + comunicação) | 🔴 Missing | ✅ Portal + email | Patient portal download + audit log visible; email notification | REQ-415 | 📋 Ready |
| 5.9.3 | Laudos revisados (histórico imutável) | 🟡 Partial (audit chain) | ✅ Portal read-only | Medical portal shows revision history; patient portal access controlled | REQ-415 | ✅ Audit chain live |

**Block G closure (PROJECTED — `pending-blocker`):** 80% → **85%** (5/5 items planned `📋 Ready`; **none earned**). Reverted from preemptive ✅ on 2026-05-08: portal-rt + portal-paciente + NOTIVISA implementations are placeholders or absent. Re-flag to ✅ requires merged code + tests + auditor pre-alignment sign-off. See `.planning/PHASE_5_CRITICAL_FINDINGS.md` BLOCKERS 4 & 6.

#### **Block A & C (Stretch contributions)**

- **Block A 4.1.2.1:** Patient rights + consentimento (deferred Phase 6, stretch to Phase 5) → **82% maintained**
- **Block C 5.1.9:** Personnel dossiê (Phase 0 skeleton extended) → **87% (unchanged)**

### Phase 5: Critical Path — NOTIVISA Integration

NOTIVISA is the **RDC 978 Art. 195 blocker** and the **critical dependency** for Phase 5 success.

**Requirement:** Lab must report notifiable diseases to ANVISA within 7 days (Art. 195, RDC 978).

| Task | Scope | Deliverables | Risk | Mitigation |
|------|-------|---|---|---|
| **Disease code mapping** | ICD-10 ↔ TUSS → Analyte lookup | Mapping table in SGD (50+ codes); reference implementation | 🟡 Low (static data) | Validate codes with ANVISA reference + lab clinical team |
| **Outbox sync** | Automatic daily scan + queue events | Cronjob polls `/labs/{labId}/notivisa-outbox` every 1h | 🟡 Low (proven pattern) | Use exponential backoff; max 24h retry |
| **API integration** | HTTP POST to ANVISA sandbox → production | Callable + Cloud Function wrapper; cert validation | 🟠 Medium (gov API) | Monitor API status page; phase gates for prod credentials |
| **Queue processing** | Event ingestion + retry + audit trail | Append-only queue collection + immutable log + chainHash | ✅ High (pattern proven) | Unit tests for 10 scenarios (success, retry, failure, timeout) |
| **Audit trail** | Full traceability (submitted → accepted → error) | Event log includes request/response payloads + timestamps | ✅ High | No hard-delete on event records (soft-delete only) |

**Phase 5 success metric:** 100% of reportable results submitted to NOTIVISA within 7 days; 0 integration failures in 24h smoke test.

### Phase 5 Success Criteria (PRE-AUDIT GATE)

- [ ] RT medical portal loads <2s (LCP <2.0s)
- [ ] Patient external portal WCAG AA (contrast, keyboard nav, screen readers)
- [ ] NOTIVISA queue processes 100% events in 24h smoke test
- [ ] Disease code mapping: 50+ codes configured + validated
- [ ] Critical value SMS/email: <5s latency (Twilio SLA)
- [ ] E2E: Laudo review → sign → submit → NOTIVISA queue → ANVISA API call (full trace)
- [ ] Cloud Logs: 0 errors, <3% warnings
- [ ] Baseline tests: 738/738 passing + 40+ Phase 5 tests

**DICQ Coverage (PROJECTED — `pending-blocker`):** 78.5% → **88%** PRE-AUDIT READY *only if* BLOCKERS 1, 3, 4, 5 close. As of 2026-05-08 the projection is doc-driven, not code-driven. Reverted from preemptive ⭐ marker.

**Next Gate:** Schedule external DICQ auditor interview (2026-08-15) — **DO NOT schedule until blocker re-audit completes.**

**Target completion:** 2026-08-15 (`pending-blocker`)

---

## 4. Phase 9 Deliverables & Closure Mapping (2026-09-01 ~ 2026-10-15)

### Phase 9 Objectives
- Manual da Qualidade v1.0 (50–80 pages, ISO 15189 template)
- Laudo fields 10–12 finalization (reference ranges, limitations, in-house methodology)
- Environmental monitoring expansion (temperature, humidity, air quality, pressure)
- Complete governance documentation (dossiè unification, EC eficácia, biossegurança)

### Phase 9: Block-by-Block Closure

#### **Block A — Governança & Direção** (82% → 92%)

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 4.1.1.2 | Pessoa jurídica (CNES, Alvará, Conselho) | 🟡 Partial | ✅ Complete with alerts | labSettings/legal-docs upload + auto-alert 30/7d expiry | NEW-A1 | 📋 Ready |
| 4.1.1.3 | Norteadores + Código Ética | 🟡 Published (Phase 1) | ✅ Finalized + distributed | Departmental distribution + acknowledgment forms | NEW-A2 | ✅ Live (Phase 1) |
| 4.1.1.4 | Diretor designação | ✅ Formal | ✅ Maintained | No change | REQ-403 | ✅ Live |
| 4.1.2.3 | Política da Qualidade | ✅ Published (Phase 1) | ✅ Maintained in Manual | Integrated as Manual Section 3 | REQ-411 | ✅ Live (Phase 1) |
| 4.1.2.4 | Planejamento qualidade + medição | ✅ KPI SLAs (Phase 4) | ✅ Dashboard trending | Dashboard extended to show annual trends | REQ-401 | ✅ Live (Phase 4) |
| 4.1.2.5 | Descrição de cargos | ✅ Published (Phase 1) | ✅ Integrated to Manual | Section 2 (Estrutura Organizacional) + dossiê linkage | REQ-403 | ✅ Live (Phase 1) |
| 4.1.2.7 | Designação Gerente QA | ✅ Formal | ✅ Integrated to Manual | Dossiê consolidation + historical tracking | REQ-403 | ✅ Live (Phase 1) |
| 4.1.2.8 | Plano governança corporativa | ✅ Template (Phase 1) | ✅ Lab version | Específico Lab Riopomba; preenchimento anual | REQ-402 | 📋 Ready |
| 4.15 | Análise Crítica Direção (15 entradas) | 🔄 Skeleton (Phase 13 planned) | 🟡 Agenda + template | Scheduling template published; execution Phase 14 | REQ-413 | 📋 Ready |

**Block A closure:** 82% → **92%** (8/9 items ✅, 1 partial)

#### **Block B — Gestão Documental (SGD)** (70% → 92%)

Phase 9 is **the major documentation sprint** for DICQ compliance.

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 4.2.2.2 | Manual da Qualidade documentado | 🔴 Missing | ✅ v1.0 signed | 50–80 pages ISO 15189 template; Director + QM signatures; published in SGD | REQ-402 | 📋 Ready |
| 4.3 | Hierarquia (MQ→PQ→IT→FR→LM) | 🟡 Partial (SGD v1.3) | ✅ Complete hierarquia | Phase 9 finalizes Lista Mestra navigation + compliance mapping | REQ-402 | 📋 Ready |
| 4.3.1 | Controle versão, aprovação, distribuição | ✅ Live (Phase 3) | ✅ Maintained | Workflow draft→review→approved→obsolete; audit trail + distribution log | REQ-402 | ✅ Live |
| 4.3.2 | Documento eletrônico + cópia física | 🟡 Partial | ✅ Complete | PDF export + versionamento seal + distribuição comprovada | REQ-402 | ✅ Live (Phase 3) |
| 5.5.3 | Documentação procedimento analítico (20 itens) | 🔴 Missing | ✅ Template + sample | Template DICQ-mapped em SGD; per-analyte documentation Phase 10 | REQ-402 + REQ-405 | 📋 Ready |

**Block B closure:** 70% → **92%** (5/5 items ✅)

#### **Block C — Pessoal** (85% → 92%)

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 5.1.1 | Documento gestão de pessoal | 🟡 Policy skeleton | ✅ Complete policy | Policy documento em SGD; versionado + publicado | REQ-403 | 📋 Ready |
| 5.1.2 | Qualificação (CV, certificado, registro) | 🟡 Partial | ✅ Complete dossiê | Unified employee dossier: CV + certificates + council registration | REQ-403 | 📋 Ready |
| 5.1.3 | Descrição de cargos | ✅ Published | ✅ Maintained | No change | REQ-403 | ✅ Live |
| 5.1.4 | Integração novos funcionários | 🟡 Partial | ✅ Checklist formalized | Onboarding checklist in SGD; document completion per hire | REQ-403 | 📋 Ready |
| 5.1.5 | Treinamento | ✅ EC module live | ✅ Maintained | No change | — | ✅ Live |
| 5.1.6 | Avaliação competência pós-treinamento | 🔴 Missing | ✅ Form deployed | Competency assessment form callable; linked to EC completion | REQ-403 | 📋 Ready |
| 5.1.7 | Análise crítica desempenho periódica | 🔴 Missing | ✅ Template + schedule | Annual performance review template; linked to dossiê | REQ-403 | 📋 Ready |
| 5.1.8 | Programa EC eficácia anual | 🟡 Partial (training) | ✅ Eficácia medida | Post-training assessment + trending dashboard | REQ-403 + EC ext. | 📋 Ready |
| 5.1.9 | Dossiê unificado (qualificação+treinamento+competência+perf) | 🟡 Skeleton (Phase 0) | ✅ Complete unified | Single source of truth: all fields consolidated per employee | REQ-403 | 📋 Ready |
| 5.1.10 | Biossegurança (vacinação, EPI, NR-32) | 🔴 Missing | ✅ Health & safety form | Integration with biosseguranca module + vaccine tracking | REQ-403 + REQ-406 | 📋 Ready |
| 5.1.11 | Bem-estar, gestão estresse | 🔴 Missing | 🟡 Partial (questionnaires) | Stress/wellness survey + indicator dashboard (stretch goal; defer full to v1.5) | REQ-403 | 🔄 Partial |

**Block C closure:** 85% → **92%** (10/11 items ✅, 1 partial)

#### **Block D — Qualidade & Compliance** (75% → 85%)

Phase 9 consolidates Phase 4 CAPA closure + adds final governance items.

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 4.8–4.14.4 | (Phase 4 items) | ✅ Consolidated | ✅ Maintained | Dashboard updates, trending extended to annual | — | ✅ Live |
| 4.14.5 | Auditoria interna | ✅ Module live (Phase 4) | ✅ Trending + results | Historical audit findings linked to NC/CAPA; trending dashboard | NEW-D1 | ✅ Live (Phase 4) |
| 4.14.8 | Avaliações externas (registros) | 🟡 Template (Phase 4) | ✅ Registry active | Template preenchimento anual; historical records archived | NEW-D2 | 📋 Ready |

**Block D closure:** 75% → **85%** (all items maintained/extended)

#### **Block G — Pós-Analítico & Laudos** (85% → 92%)

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 5.8 | Emissão laudos (14 campos RDC 978) | 🟡 Partial (11/14) | ✅ Complete (14/14) | Fields 10–12 finalized: reference ranges, limitations, in-house methodology | REQ-415 | 📋 Ready |
| 5.8.10 | Reference ranges | 🔴 Missing | ✅ Auto-populated | Bula parser → CIQ plan → laudo field 10 | REQ-415 + REQ-409 | 📋 Ready |
| 5.8.11 | In-house methodology specification | 🔴 Missing | ✅ Link to SGD docs | If aplicável, link to metodologia própria document in SGD | REQ-415 | 📋 Ready |
| 5.8.12 | Restricted material notation | 🔴 Missing | ✅ Conditional display | If material flagged, display restriction; audit trail logs flag origin | REQ-415 | 📋 Ready |

**Block G closure:** 85% → **92%** (4/4 new items ✅)

#### **Block H — Recursos** (80% → 88%)

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 5.3.1.4 | Calibração + rastreabilidade | 📋 Schema (Phase 4) | ✅ Population + integration | Certificate upload + alert system + integração a runs | REQ-408 | 📋 Ready |
| 5.3.1.5 | Manutenção (preventiva, corretiva, fora-de-uso) | 🟡 Partial | ✅ Consolidation | Unificar equipamentos/{id}/manutencoes subcollection; deferred final to Phase 10 | TD-403 | 📋 Ready |
| 5.3.1.7 | Registro completo (12 campos) | 🟡 Partial | ✅ Audit checklist | Auditar presença dos 12 campos; conformidade report | REQ-408 | 📋 Ready |

**Block H closure:** 80% → **88%** (3/3 items ready)

#### **Block I — Acomodações & Ambiente** (70% → 80%)

**Phase 9 Environmental Monitoring Expansion:** Deploy full 4-parameter monitoring system.

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 5.2.6 | Monitoramento ambiental | 🟡 Temperature only | ✅ 4 parameters | Expand: Temperature + Humidity + CO₂ + Pressure; IoT ESP32 + probes | REQ-406 | 📋 Ready |
| 5.2.7 | Acessibilidade, segurança | ⚪ Document | ⚪ Document | No software component (operational checklist) | — | — |
| 5.2.8 | Prevenção infecções (higienização, treinamento) | 🔴 Missing | ✅ POPs + indicators | POPs em SGD + treinamento mandatory + indicator dashboard | REQ-406 | 📋 Ready |

**Block I closure:** 70% → **80%** (2/2 technical items ✅)

#### **Block J — Continuidade & Confidencialidade** (73% → 78%)

| DICQ Req. | Item | Phase 5 Status | Phase 9 Target | Closure Strategy | REQ-ID | Status |
|-----------|------|---|---|---|---|---|
| 5.10.1 | Confidencialidade | ✅ Rules + audit chain | ✅ Policy formal | Formalizar LGPD policy; reforço rules + retraining | REQ-411 | ✅ Live |
| 5.10.3 | Plano Recuperação Desastres | ✅ v1.2 baseline | ✅ Maintained | No change; periodical testing SOP | — | ✅ Live |

**Block J closure:** 73% → **78%** (stable)

### Phase 9 Success Criteria (EXTERNAL AUDIT READY)

- [ ] Manual da Qualidade v1.0: 50–80 pages, signed by Director + QM, published in SGD
- [ ] Laudo fields 10–12: All 14 fields present in sample laudos, PDF formatting correct
- [ ] Environmental monitoring: 24h baseline data collected; alert thresholds defined; trending dashboard live
- [ ] Personnel dossiè: All 5 components (qualif + training + competency + performance + health) consolidated per employee
- [ ] Governance documents: norteadores, Política Qualidade, cargos, designações all distributed + documented
- [ ] SGD completeness audit: 100% DICQ-mapped documents present + versioned + approved
- [ ] Cloud Logs: 0 errors, <2% warnings
- [ ] Baseline tests: 738/738 + 60+ Phase 9 tests

**DICQ Coverage (PROJECTED — `pending-blocker`):** 88% → **92%+** EXTERNAL AUDIT READY *only if* all upstream blockers close and Phase 5 + Phase 9 earn code-level evidence. Reverted from preemptive ⭐ marker on 2026-05-08.

**Target completion:** 2026-10-15 (`pending-blocker`)

---

## 5. Orphan Resolution & Risk Flags

### Orphans Resolved (13 items identified in v1.4 DICQ matrix)

| # | DICQ Item | Phase Resolved | Closure Strategy | Status |
|---|-----------|---|---|---|
| 1 | 4.1.1.2 Pessoa jurídica | Phase 9 (Phase 0 skeleton) | Legal-docs upload + expiry alert | ✅ Resolved |
| 2 | 4.1.1.3 Norteadores + Ética | Phase 1 | Form + publication in SGD | ✅ Resolved |
| 3 | 4.1.2.7 Designação QA | Phase 1 | Personnel designações subsection | ✅ Resolved |
| 4 | 4.14.5 Auditoria interna | Phase 4 | NEW-D1 module (checklist + scheduling) | ✅ Resolved |
| 5 | 4.14.8 Avaliações externas | Phase 9 | NEW-D2 template (audit records) | ✅ Resolved |
| 6 | 4.5 Lab apoio | Phase 0 | NEW-H1 (contract template + 6 cláusulas) | ✅ Resolved |
| 7 | 5.1.7 Análise desempenho | Phase 9 | Personnel avaliação-desempenho template | ✅ Resolved |
| 8 | 5.1.8 EC eficácia | Phase 9 | Post-training competency assessment | 🟡 Partial (stretch goal) |
| 9 | 5.1.11 Bem-estar | Phase 9 | Wellness questionnaires + indicators | 🟡 Partial (defer to v1.5) |
| 10 | 5.4.6 Recebimento SOP | Phase 6 | Rejection SOP em SGD + rejection criteria UI | ✅ Resolved |
| 11 | 5.5.2 Intervalos referência | Phase 10 | Per-analyte + multi-instrumento | ✅ Resolved |
| 12 | 5.6.1 CEQ | Phase 10 (v1.3 foundation) | ControlLab/SBAC interface (maintenance) | ✅ Resolved |
| 13 | 4.14.2 Análise solicitações | Phase 6 | Pré-analítico reports (stretch; defer v1.5) | 🟡 Partial |

**Orphan Resolution:** 10/13 fully resolved; 3/13 partial/deferred (documented fallback to v1.5)

### Risk Flags & Mitigation

| Risk | Phase(s) | Severity | Impact | Mitigation |
|------|----------|----------|--------|-----------|
| **Phase 4 CAPA auditor RFI delays** | 4 | 🔴 HIGH | Cascades to Phase 5, 9; jeopardizes pre-audit gate (88%) | Weekly auditor calls + proactive CAPA documentation + parallel Phase 5 prep |
| **Phase 5 NOTIVISA API sandbox delays (gov)** | 5 | 🟠 MEDIUM | Phase 5 integration deferred to Phase 8; v1.4 launch slips 2–3 weeks | Early ANVISA API access provisioning (Phase 3); parallel mock API for tests |
| **Phase 9 Manual Qualidade scope creep (50–80 pages)** | 9 | 🟠 MEDIUM | Writing sprint overruns; Phase 9 delivery pushed to Phase 10 | Strict scope: DICQ-mapped sections only; template-driven; 2-week dedicated sprint |
| **Personnel dossiè data migration** (5.1.9) | 0–9 | 🟠 MEDIUM | Records scattered across legacy systems; completeness gap | Backfill job Phase 0 + audit script Phase 9 (verify all fields present) |
| **Multi-instrument comparability** (Bloco F) | 10 | 🟡 LOW | Stretch goal; deferred if no capacity → affects 92% upper bound | Document as "Phase 10+ scope"; baseline 95% still DICQ-compliant |
| **LGPD anonymization verification** (Bloco J) | 11 | 🟡 LOW | Cron job runs; manual test recommended | Phase 11 smoke test (run anonymization on test data) |

---

## 6. Pre-Audit Checkpoint (Phase 5, 2026-08-15)

**Gate Criteria (DICQ ≥88% required):**

- [ ] Blocks A, B, D, G, H: ≥85% closure each
- [ ] Cloud Logs: 0 RDC-related errors, <3% warnings
- [ ] All 5 KPI indicators live + SLA tracking
- [ ] NOTIVISA queue: 100% event processing in 24h
- [ ] E2E smoke test: All 8 critical flows PASS
- [ ] Compliance artifacts ready: ADRs 0017–0021, deployment gates, audit briefs
- [ ] Auditor pre-alignment call scheduled

**If criteria met:** Schedule external DICQ auditor interview (tentative 2026-08-15; audit 2026-09-15 ~ 2026-10-15)

**If criteria NOT met:** Activate Phase 5 extension protocol (2-week buffer built into timeline)

---

## 7. External Audit Readiness (Phase 9, 2026-10-15)

**Gate Criteria (DICQ ≥92% required):**

- [ ] All 10 blocks: ≥80% closure
- [ ] Blocks A, B, D, G: ≥92% closure (critical blocks)
- [ ] Manual da Qualidade v1.0: signed + published
- [ ] Laudo fields 10–12: all samples audit-pass
- [ ] Environmental monitoring: 30d historical data + alert logs
- [ ] No hard-deletes in any compliance collection (soft-delete enforcement verified)
- [ ] Audit trail: 100% of RDC-critical operations logged + HMAC-signed
- [ ] Orphan resolution: 10/13+ items closed
- [ ] RDC 978: 100% critical articles (12/12) + secondary articles (11/11)
- [ ] Risk mitigation: Top 5 risks documented + controls in place

**If criteria met:** Ready for external DICQ auditor; target official certification 2026-12-31

**If criteria NOT met:** Activate Phase 9 extension protocol (auditor engagement pushed to 2026-11)

---

## 8. DICQ Closure Tracker — Summary Dashboard

> **NOTE:** Dashboard arrows below are PROJECTED (`pending-blocker`). Only the v1.3 78.5% baseline is earned. See top-of-document banner.

```
DICQ 78.5% (v1.3, EARNED) ────────PROJECTED────────────────────────→ 92%+ (v1.4 External Audit)
  │
  Phase 0–3 complete ✅
  │
  Phase 4: CAPA + Auditoria + Riscos
  │    A: 78% → 82%  │  D: 60% → 75%  │  H: 75% → 80%
  │    ├─ Target: 82% avg
  │    └─ By 2026-07-15
  │
  Phase 5: Portal + NOTIVISA ⭐ PRE-AUDIT GATE
  │    A: 82% → 85%  │  D: 75% → 78%  │  G: 80% → 85%
  │    ├─ Target: 88% avg (PRE-AUDIT READY)
  │    └─ By 2026-08-15 ← SCHEDULE AUDITOR HERE
  │
  Phase 9: Manual + Laudo + Environment ⭐ EXTERNAL AUDIT READY
  │    A: 85% → 92%  │  B: 70% → 92%  │  C: 85% → 92%
  │    D: 78% → 85%  │  G: 85% → 92%  │  I: 70% → 80%
  │    ├─ Target: 92%+ avg
  │    └─ By 2026-10-15 ← OFFICIAL DICQ CERTIFICATION 2026-12-31
  │
  External Audit (Oct 2026)
  │
  DICQ Accreditation (Dec 2026)
```

---

## 9. Reference & Cross-Links

### Authoritative Sources (Source of Truth)

- **DICQ Coverage Matrix:** `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md` (56 sub-requisitos mapeados)
- **RDC 978 Compliance Matrix:** `.planning/milestones/v1.4-RDC-978-COMPLIANCE-MATRIX.md` (85+ artigos)
- **Compliance Roadmap:** `docs/COMPLIANCE_ROADMAP_Phase4to9.md` (phase-by-phase tasks)
- **Obsidian Compliance Index:** `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` (115 audit items)

### Related ADRs

- **ADR-0013:** DICQ 85% target sequencing (Phase 0–4)
- **ADR-0014:** NOTIVISA integration sandbox → production
- **ADR-0015:** Patient portal email link auth
- **ADR-0017:** HMAC baseline reset (Phase 0 deployment gate)
- **ADR-0018:** Deploy gate secret status check
- **ADR-0021:** NOTIVISA queue processing pattern

### Module Documentation

- Phase 4 modules: `src/features/auditoria-interna/CLAUDE.md`, `src/features/capa/CLAUDE.md`, `src/features/risks/CLAUDE.md`
- Phase 5 modules: `src/features/portal-rt/CLAUDE.md`, `src/features/portal-paciente/CLAUDE.md`, `src/features/notivisa/CLAUDE.md`
- Phase 9 modules: `src/features/sgd/CLAUDE.md`, `src/features/personnel/CLAUDE.md`

---

## 10. Document Control

| Attribute | Value |
|-----------|-------|
| **Document Title** | DICQ Closure Tracker — v1.4 Phases 4–9 |
| **Version** | 1.0 (authoritative) |
| **Effective Date** | 2026-05-08 |
| **Next Review** | 2026-07-15 (Phase 4 completion) |
| **Audit Target** | 2026-10-15 (external DICQ audit) |
| **Owner** | Compliance Research (R3) |
| **Status** | ACTIVE (executing phases 4–9) |
| **Supersedes** | Ad-hoc DICQ claims in prior artifacts |

**Sign-off:** CTO (pending phase execution)

---

**End of DICQ_CLOSURE_TRACKER_v1.4.md**
