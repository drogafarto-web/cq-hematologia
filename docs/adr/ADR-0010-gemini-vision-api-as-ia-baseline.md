# ADR-0010: Gemini Vision API as IA Baseline for v1.4 (Fine-Tuned Model Deferred to v1.5)

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

HC Quality tem como north-star diferenciador no mercado a leitura automática de strips de imunoteste rápido (HIV, Dengue, HCG, Sífilis, COVID) via IA. Competitors globais (Sysmex, Mindray, WinLab) não oferecem; criaria defensible moat.

v1.4 roadmap inclui **Phase 11 — IA Foundation: Strip OCR Classification Prep** com objetivo de coletar 500+ imagens de strip para fine-tuning futuro.

**Questão técnica:** v1.4 usa Google Gemini 2.5 Flash (baseline) ou investe em fine-tuned model desde o início?

**Restrições:**

- v1.4 timeline é 22 semanas (firm deadline: 2026-09-30 para auditoria 2026-10-15).
- Fine-tuning requer ~4-6 semanas de dataset curation + treinamento + validação clínica.
- Gemini 2.5 Flash é production-ready; latência <3s é factível.
- Orçamento: Gemini Vision API custa ~$4/1M tokens (2.5 Flash); fine-tuning cost é 25-50x maior.

## Problema

Dois caminhos divergem:

### Path A — Fine-tuned model v1.4 (agora)

- **Pro:** Proprietário, accuracy otimizado para Riopomba, não depende API Google.
- **Con:** 6+ semanas de investimento → Phase 11 é bloqueado até Week 12 → IA dataset coleta atrasa → v1.5 perde momentum.
- **Risk:** Fine-tuning falha (accuracy <85%) → rollback caro; pipeline criado é tech debt.

### Path B — Gemini Vision API v1.4 (baseline) + fine-tuned v1.5

- **Pro:** Gemini é production-ready; Phase 11 unblocked Week 11 → 500 imagens coletadas em v1.4 → v1.5 começa com dataset maduro. Custo baixo v1.4, payoff óbvio v1.5.
- **Con:** Depende API Google (latency, rate limits, pricing). Accuracy baseline ~85% (Gemini generic vision); margem pra melhora.

**Decisão imperativa:** Path B (Gemini baseline v1.4) alinha timeline, desrisca fine-tuning, e garante coleta de dataset antes de v1.5 engineering.

## Decisão

**v1.4 adota Gemini 2.5 Flash como IA baseline** para strip OCR classification:

### 1. Strip Classification via Gemini Vision

**Prompt strategy:**

```
Você é especialista em testes rápidos de imunodiagnóstico. Analise a imagem de um
strip de teste rápido [tipo: HIV/Dengue/HCG/Sífilis/COVID] e responda APENAS com um
JSON:
{
  "classification": "Positive" | "Negative" | "Invalid" | "Grey-Zone",
  "confidence": 0.0 to 1.0,
  "reasoning": "descricao breve (max 100 chars)"
}

Critérios de válidade:
- Válido se linhas de teste (T) e controle (C) são visíveis
- Positivo se T e C são ambas visíveis e T é cor clara
- Negativo se apenas C é visível
- Inválido se C está ausente

Não invente; se você não tem confiança alta (>0.8), responda confidence=0.XX e reasoning="imagem obscura/artefato".
```

**Latency target:** <3s p99 (Gemini typical: 0.5–2s, com 0.2s network overhead = ~2.5s regional).

**Cost model:** ~$0.004 per strip classification (10,000 strips = $40/mês @ low volume). Quota alert: $500/month (12,500 classifications) — escalate if exceeded.

### 2. Confidence Threshold + Manual Fallback

Classification flow:

```
Image → Gemini API → confidence check
  ├─ confidence ≥ 0.85 → auto-populate result + audit log (PASS)
  ├─ confidence 0.70-0.84 → flag for RT manual review + log (REVIEW)
  └─ confidence < 0.70 → reject, force manual entry (FAIL, user retakes photo)
```

**Rationale:** Medical class-I device may require supervisory override; Gemini confidence floor ensures human loop intact if model uncertain.

### 3. Dataset Collection (v1.4 Phase 11)

- Store all strip images (anonymized) in `Firebase Storage: /labs/{labId}/imuno-ia-dev/{runId}/{timestamp}.jpg` (5MB max).
- Link to manual classification (by RT) in `Firestore: /labs/{labId}/imuno-ias-dev/{docId}` collection.
- Target: 500+ diverse images (100+ per kit type) by v1.4 EOL.
- Metadata captured: kit type, lighting, camera device, RT verdict, Gemini confidence, timestamp.

**Governance:** All dataset images are de-identified (no patient PII); owned by lab and shared with HC Quality ML team monthly for fine-tuning research.

### 4. IA Performance Dashboard (v1.4 Phase 11)

Monitor Gemini accuracy in real-time:

- **Confusion matrix:** Gemini prediction vs RT manual verdict (TP, FP, TN, FN).
- **Accuracy % by kit type** (HIV, Dengue, etc.).
- **Confidence distribution histogram** (shows if Gemini is well-calibrated).
- **Monthly trend:** accuracy improving or degrading as dataset grows?
- **Export:** CSV snapshot monthly for ML team planning.

Expected v1.4 baseline: **~85% accuracy** (Gemini 2.5 Flash generic vision on rapid tests; literature range 80–92%).

### 5. Fine-Tuning Transition (v1.5 Planning)

At v1.5 kickoff (Week 1 nov/2026):

- **Dataset ready:** 1000+ images, labeled, stratified by kit type.
- **Fine-tuning plan:** 3–4 weeks engineering + 2 weeks validation (clinical + statistical).
- **Model options:**
  - Option A: Google Vertex AI fine-tuned Gemini (managed, same API contract).
  - Option B: Open-source vision model (LLaVA, BLIP) + self-hosted (higher control, higher infra cost).
- **Gate:** If Gemini fine-tuned achieves ≥95% accuracy on validation set, adopt. Otherwise, Option B evaluated.

## Alternativas consideradas

### Alternativa A — Fine-tuned model v1.4 (proprietary from start)

Train custom vision model on Riopomba's dataset + clinical validation in parallel.

**Rejeitada porque:**

- 6–8 weeks investment in v1.4 stalls IA phase entirely. Dataset collection gets pushed to v1.5 → no baseline accuracy comparative.
- Clinical validation (ANVISA may require) is separate 4-week gate; adds risk.
- Cost: $15-30k for fine-tuning infrastructure + 1 FTE research engineer = ROI unclear until v1.5 market traction.

### Alternativa B — No IA v1.4; all deferred to v1.5

v1.4 focuses pure compliance; IA is blue-sky v1.5 project.

**Rejeitada porque:**

- Leaves competitive gap open (competitors will ship something before v1.5 launch).
- v1.4 dataset collection never starts → v1.5 doesn't have the 500 images needed for credible fine-tuning.
- Market messaging: "upcoming IA in v1.5" is weaker than "IA alpha collecting data now".

## Consequências

### Positivas

1. **Unblocks Phase 11 execution.** Gemini is production-grade; no research needed. Dataset collection begins Week 12 (est).
2. **Low-risk baseline.** Gemini 2.5 Flash is proven on medical imagery (literature: ~85% on rapid tests). Confidence thresholds protect against silent failures.
3. **Clear v1.5 handoff.** 500+ labeled images = crisp starting point for fine-tuning roadmap. v1.5 engineer can plan exact timeline.
4. **Cost-effective.** v1.4 IA baseline costs <$500/month (vs $15-30k fine-tuning investment). Budget predictable.

### Negativas

1. **API dependency.** Gemini outage → strip classification unavailable. Mitigated: manual entry fallback always available (60s overhead).
2. **Accuracy plateau.** Gemini is not optimized for Riopomba's specific strips (kit brands, lighting, camera calibration). ~85% may be ceiling. Mitigated: fine-tuning roadmap addresses this v1.5.
3. **Regulatory question mark.** ANVISA may require "validation study" proving AI clinical performance (RDC 978 Art. 5, XLVI). v1.4 Gemini is baseline; validation happens v1.5 (gate before full launch).

## Compromissos derivados

1. **Circuit breaker + fallback.** All Gemini calls have timeout (3s), retry logic (exponential backoff, max 3), and silent fallback (manual entry required). Logs all API failures for monitoring.

2. **Confidence threshold versioning.** Default threshold=0.85; CTO-adjustable via Firestore config `labs/{labId}/imuno-thresholds/default`. Change logged + auditable.

3. **Monthly accuracy report.** ML team generates confusion matrix + accuracy trend → distributed to CTO + auditor. Baseline = v1.4 Week 15; tracked through v1.4 EOL.

4. **v1.5 fine-tuning pre-gate.** Before v1.5 engineering starts (estimated 2026-11-01), dataset quality reviewed (image count, stratification, label accuracy ≥95%). If dataset is insufficient, fine-tuning deferred one more sprint.

5. **ANVISA interaction.** If auditor asks "is AI validated?", response is: "Gemini 2.5 Flash is production-grade vision LLM; v1.4 is dataset collection + accuracy monitoring. v1.5 will conduct clinical validation study per RDC 978 guidelines." Document this in audit briefing material.

## Referências

- `src/features/ciq-imuno/strip-classifier/` module (Phase 11 deliverable)
- `functions/src/v1.4-base/classifyStripGemini.ts` callable
- `v1.4-ROADMAP.md` Phase 11 (dataset collection metrics)
- Google Gemini 2.5 Flash API docs (https://ai.google.dev/)
- Obsidian `HC_Quality_Decisoes_Abertas.md`: IA roadmap + fine-tuning planning doc

---

**Aplicabilidade:** v1.4 Phase 11 + any strip classification feature.

---

**ADR Status:** ACCEPTED (2026-05-07)  
**Review Date:** 2026-07-07 (Phase 11 mid-point: confirm Gemini API stability + dataset collection pace)
