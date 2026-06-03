# ADR-0013: DICQ 85% Target Sequencing — Phases 1-2 Mandatory, Phase 3 Stretch, Phase 4+ Polish

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

v1.3 alcançou ~78–82% de conformidade DICQ (Diretrizes Integradas de Conformidade da Qualidade, SBAC), equivalente a ~456/570 requisitos. Meta é alcançar 85%+ (que alinha com RDC 978 threshold de 80% + margem de compliance premium) até v1.4 EOL (2026-09-30).

DICQ tem 10 blocos (A–J, ~570 requisitos totais):

- **Block A (Governança):** 78% (v1.3) → target 90% (v1.4)
- **Block B (SGD / Documentos):** 65% → target 92%
- **Block C (Pessoal):** 80% → target 92%
- **Block D (Qualidade / Riscos):** 60% → target 85%
- **Block E (Pré-analítico):** 64% → target 75%
- **Block F (Analítico):** 92% → target 95%
- **Block G (Pós-analítico):** 70% → target 90%
- **Block H (Recursos / Ambiente):** 75% → target 88%
- **Block I (Laudos):** 50% → target 75%
- **Block J (Continuidade):** 70% → target 75%

**Pergunta:** Qual sequência de fases (roadmap waves) maximiza progresso DICQ sem comprometer auditoria externa?

## Problema

Dois riscos conflitantes:

1. **Sequential execution (waterfalls):** DICQ gap → fase 1 → fase 2 → etc. Baixo paralelismo. Se fase 1 atrasa 3 semanas, fases 2+ herdam atraso. Resultado: v1.4 EOL sem Phase 3 polish (riscos estéticos).

2. **Parallel execution (all waves at once):** Threads A–D executam paralelo desde Week 1. Risco: DICQ gaps não resolvem coerentemente. Modulo X espera Modulo Y; deadlock.

**Decision needed:** Esclarecer dependências + sequência crítica + pontos de paralelismo.

## Decisão

**v1.4 adota wave-based phasing com 3 gates DICQ:**

### 1. Wave 1 (Weeks 1–3): Foundation (RDC 978 Art. 117 bloqueadores)

**Phase 1–3 (sequencial; critical path):**

- Phase 1: v1.3 stabilization + baseline DICQ audit (what's at 78–82%?).
- Phase 2: v1.4 requirements + roadmap deep-dive (which gaps block DICQ 85%?).
- Phase 3: Schema extensions + Firestore Rules v1.4 (infra ready).

**DICQ blocks advanced:** None yet (foundation work only).
**Gate:** All 4 streams unblocked by Week 3 EOD.

**Owner:** Stream A (CTO oversight).

---

### 2. Wave 2 (Weeks 4–8): Mandatory DICQ Blocks (Tier 1 ROI)

**Parallel phases (Streams B+C execute simultaneously):**

**Phase 4 — CAPA Closure (Stream A)** [sequential, depends on auditor]

- Close 12 CAPAs from Phase 7 audit (v1.3 Finding backlog).
- Blocks: Blocks A, C jump significantly (management review evidence + personnel qualifications).
- Target: **Blocks A, C → 86%** (from 78%, 80%).

**Phase 5 — Patient Portal Phase 1 (Stream B)** [parallel to Phase 4]

- Laudo download + NPS feedback form.
- Blocks: Block G (pós-analítico) → 85% (from 70%).

**Phase 6 — Critical Values Escalation (Stream B)** [parallel to Phase 4]

- SMS/email notification + SLA tracking.
- Blocks: Block G → 88% (from 70%), Block I → 65% (from 50%).

**Phase 7 — Satisfação/Feedback Portal (Stream B)** [sequential to Phase 5-6; no new DICQ impact]

- Integration with satisfacao/sugestoes.
- Blocks: Block H → 82% (from 75%).

**Checkpoint Week 8:** Verify Blocks A, C, G, H are at target percentages. If not, escalate.

**DICQ result after Wave 2:** Est. **80–82%** (intermediate). Mandatory blocks done; stretch blocks pending.

---

### 3. Wave 3 (Weeks 9–15): Stretch DICQ Blocks (Tier 2 dependencies)

**Parallel phases (all 4 streams active):**

**Phase 8 — NOTIVISA Integration (Stream A)**

- Portaria 204 compliance.
- Blocks: Block G → 92% (from 88%), Block I → 80% (from 65%).

**Phase 9 — Documentation Hardening (Stream A)**

- Manual da Qualidade, Policy documents, governance checklist.
- Blocks: Blocks A, B, D, E → 86%, 92%, 80%, 75% respectively.

**Phase 10 — Multi-Equipment CIQ + Analyte Expansion (Stream B)**

- Coagulação, Imunologia, Uroanálise analytes.
- Blocks: Block F → 98% (from 92%), Block E → 85% (from 75%).

**Phase 11 — IA Foundation (Strip OCR) (Stream C)**

- Gemini Vision integration + dataset collection.
- Blocks: Block F → 99% (IA-enhanced analytics).

**Checkpoint Week 15:** Verify overall DICQ → 85–87%. If <85%, enter Phase 14 escalation.

**DICQ result after Wave 3:** Est. **85–87%** (on track).

---

### 4. Wave 4 (Weeks 16–22): Final Audit + Launch Prep

**Sequential phases (not parallel; depends on Wave 3):**

**Phase 12 — Performance Audit (Stream D)**

- Web Vitals compliance, bundle size, runtime optimization.
- Blocks: No DICQ impact; quality assurance.

**Phase 13 — DICQ Final Audit (Stream A + external reviewer)**

- Formal gap closure on all DICQ blocks A–J.
- Target: **85%+** (should be achieved by Week 15; Phase 13 is confirmation + documentation).

**Phase 14 — Pre-Launch Security & Stability (Stream D)**

- Firestore Rules re-audit, dependency scan, smoke tests on staging.
- Blocks: No DICQ impact; release readiness.

**Phase 15 — v1.4 Launch & Monitoring (all streams)**

- Production deployment + 48h cloud logs tail.
- Blocks: No DICQ impact; operational handoff.

**DICQ result after Wave 4:** **≥85%** (locked, audit-ready).

---

### 5. Sequencing Decision Matrix

| Block                | Wave 2 Target | Wave 3 Refinement | Wave 4 Lock | Phase(s)               |
| -------------------- | ------------- | ----------------- | ----------- | ---------------------- |
| A (Governança)       | 86%           | +4% (Phase 9)     | 90%         | 4, 9                   |
| B (SGD)              | 65%           | +27% (Phase 9)    | 92%         | 9                      |
| C (Pessoal)          | 90%           | 0%                | 90%         | 4                      |
| D (Qualidade/Riscos) | 60%           | +20% (Phase 9)    | 80%         | 9                      |
| E (Pré-analítico)    | 64%           | +21% (Phase 10)   | 85%         | 10                     |
| F (Analítico)        | 92%           | +7% (Phase 10-11) | 99%         | 10, 11                 |
| G (Pós-analítico)    | 88%           | +4% (Phase 8)     | 92%         | 6, 8                   |
| H (Recursos)         | 82%           | +6% (Phase 7, 10) | 88%         | 7, 10                  |
| I (Laudos)           | 65%           | +15% (Phase 8)    | 80%         | 6, 8                   |
| J (Continuidade)     | 70%           | 0%                | 75%         | — (Phase 14 stability) |
| **Overall**          | **79–82%**    | **84–87%**        | **≥85%**    | —                      |

---

## Alternativas consideradas

### Alternativa A — All-parallel (4 streams from Week 1)

Fases 4–7 executam simultaneamente (zero sequencing).

**Pros:** Shorter timeline (parallel speedup).
**Cons:**

- DICQ gaps may not resolve coherently (Phase 5 depends on Phase 6 data; deadlock possible).
- QA overhead explodes (4 streams need constant sync).
- Risk of "false-parallel" (threads wait on shared resources anyway).

**Rejected:** Chaos. Coordination overhead outweighs parallelism gain.

### Alternativa B — Sequential waterfall (Phase 1 → 2 → 3 → ... → 15)

Each phase finishes before next starts.

**Pros:** Zero coordination overhead; clear causality.
**Cons:**

- v1.4 timeline = sum of all phases ≈ 22 weeks exactly. Any slip cascades.
- Phases 5–7 could parallelize (they don't block each other); artificial serialization wastes 2–3 weeks.

**Rejected:** Too conservative. Leaves performance on table.

### Alternativa C — Rolling wave (Phase + 1 week later Phase+1 + 1 week later Phase+2...)

Overlapping releases (Phases 4–7 are staggered starts, not hard gates).

**Pros:** Smoother integration; fewer bottlenecks.
**Cons:**

- Hard to track dependencies (which commit unblocks which downstream phase?).
- Code review + integration testing becomes continuous burden.

**Rejected:** Good for mature teams (20+ engineers). For 4–5, overhead is worse.

## Consequências

### Positivas

1. **Critical path is explicit.** Phase 4 (CAPA) is serial → blocks Blocks A, C. If Phase 4 slips, knows immediately impact is DICQ.
2. **Parallelism is safe.** Phases 5-7 have no cross-dependencies → execute truly parallel (Streams B independent).
3. **DICQ target is incremental.** Wave 2 reaches ~80%; Wave 3 reaches ~85%; Wave 4 locks. Auditor sees steady progress.
4. **Rollback is staged.** If Wave 2 fails (CAPA backlog too large), Wave 3 can be deferred → v1.4 still ships at 82% (respectable). Graceful degradation.

### Negativas

1. **Limited flexibility.** If Phase 4 (CAPA) needs 5 weeks instead of 3, Phases 5-7 can't advance without Phase 4 data. Hard constraint.
2. **Dependency on auditor availability.** Phase 4 relies on auditor to sign off on CAPAs. If auditor is slow, bottleneck.
3. **Stretch phases (Wave 3) may be rushed.** If Wave 2 eats all buffer, Wave 3 becomes aggressive → quality risk.

## Compromissos derivados

1. **Phase gates (explicit checkpoints).**
   - End of Week 3: Phase 1-3 done, all streams unblocked.
   - End of Week 8: Phase 4-7 done, DICQ ≥80%, Gates for Wave 3.
   - End of Week 15: Phase 8-11 done, DICQ ≥85%, Gate for Phase 13 audit.
   - End of Week 20: Phase 13 + 14 done, DICQ ≥85% (locked), Gate for launch.

2. **DICQ tracker (spreadsheet or Firestore).**
   - Updated weekly with each block's current %.
   - Target % vs actual % per block.
   - Owner: Stream A lead (CTO).

3. **Auditor alignment (bi-weekly calls).**
   - Week 1: Expectations + schedule.
   - Week 3: Baseline audit (where are we?).
   - Week 8: Phase 4 CAPA closure review + Phase 5-7 preview.
   - Week 15: Gap assessment (are we on track to 85%?).
   - Week 20: Pre-audit briefing.

4. **Escalation protocol (if DICQ slips).**
   - If any block drops below target by >5%, CTO is notified immediately.
   - Options: extend Wave 3, defer stretch features, or adjust DICQ target downward (if justified).

## Referências

- `v1.4-RESEARCH.md` Section 1 (DICQ gap analysis by block).
- `v1.4-ROADMAP.md` (15 phases mapped to blocks + wave grouping).
- `v1.4-REQUIREMENTS.md` (48 requirements mapped to phases + DICQ blocks).
- `DICQ_4.x_2024_SBAC.pdf` (reference; archived in Obsidian).
- Obsidian `HC_Quality_Checklist_Auditoria.md` (115-item DICQ tracker).

---

**Aplikabilnost:** Całą stukturę v1.4 (phases 1-15, Wave 1-4 grouping).

---

**ADR Status:** ACCEPTED (2026-05-07)  
**Review Date:** Week 8 (2026-06-25): Confirm Wave 2 DICQ targets achieved. If <79%, escalate.  
**Gate Review:** Week 15 (2026-07-23): Confirm Wave 3 DICQ ≥85%. If <85%, Phase 14 extension approved.
