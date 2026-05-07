# Architecture Decision Records (ADRs)

Decisões arquiteturais relevantes do HC Quality. Cada ADR é imutável após `Accepted` — mudanças viram **um novo ADR** que substitui o anterior (campo `Substituído por`).

## Quando criar um ADR

- Mudança que afeta múltiplos módulos.
- Decisão com trade-off não-óbvio que vai ser questionada depois ("por que assim e não daquele outro jeito?").
- Compromisso regulatório, de segurança ou de retenção que precisa ser defensável.
- Escolha de tecnologia ou padrão que define como o time trabalha.

**Não** crie ADR para:
- Refatoração interna de um módulo só.
- Mudança de naming, formatação, lint.
- Bug fix.
- Feature nova que segue padrões já decididos em ADRs anteriores.

## Formato

Numeração sequencial: `0001`, `0002`, `0003`. Nome curto descritivo: `0042-foo-bar.md`.

Seções obrigatórias:
- **Status:** Proposed / Accepted / Deprecated / Superseded
- **Data, Decisor, Substitui, Substituído por**
- **Contexto** — o estado do mundo quando a decisão foi tomada
- **Problema** — o que dói se a decisão não for tomada
- **Decisão** — o que foi decidido, sem ambiguidade
- **Alternativas consideradas** — pelo menos 2, com motivo de rejeição
- **Consequências** — positivas e negativas, honestas
- **Compromissos derivados** (opcional) — regras operacionais que decorrem da decisão
- **Referências** — links pra docs/código relevante

## Índice

### v1.3 ADRs (Completed)
- [0001 — Arquitetura de spines para rastreabilidade RDC 978](0001-arquitetura-spines-rdc-978.md)
- [0002–0008] (Voir référence docs/adr/ pour historique complet)

### v1.4 ADRs (Current Planning, 2026-05-07)
- [ADR-0009 — React 19 + TypeScript 5.8 Version Lock Strategy](ADR-0009-react-19-typescript-58-version-lock-strategy.md)
- [ADR-0010 — Gemini Vision API as IA Baseline](ADR-0010-gemini-vision-api-as-ia-baseline.md)
- [ADR-0011 — Single-Lab Deployment Model (v1.4)](ADR-0011-single-lab-deployment-model-v1-4.md)
- [ADR-0012 — RDC 978 Audit Trail via LogicalSignature](ADR-0012-rdc-978-audit-trail-logical-signature.md)
- [ADR-0013 — DICQ 85% Target Sequencing](ADR-0013-dicq-85-percent-target-sequencing.md)
- [ADR-0014 — NOTIVISA Integration Sandbox → Production](ADR-0014-notivisa-integration-sandbox-to-production.md)
- [ADR-0015 — Patient Portal Email-Link Auth (LIS Deferred)](ADR-0015-patient-portal-email-link-auth-v1-4.md)
- [ADR-0016 — FMEA-Lite Risk Methodology (Phase 0 MVP)](ADR-0016-fmea-lite-risk-methodology-phase-0.md)
- [ADR-0017 — HMAC Signature Baseline Reset (Incident Response)](ADR-0017-hmac-baseline-reset-2026-05-07.md)
- [ADR-0018 — Deploy Gate: Secret-Status Check](ADR-0018-deploy-gate-secret-status-check.md)

### Phase 3 ADRs (2026-05-07, Schema + Architecture)
- [ADR-0019 — Phase 3 Schema Design: 5 New Collections + Indices](ADR-0019-phase-3-schema-design.md)
- [ADR-0020 — Pessimistic Locking for Concurrent Draft Editing](ADR-0020-pessimistic-locking-draft-editing.md)
- [ADR-0021 — NOTIVISA Queue & Retry Pattern](ADR-0021-notivisa-queue-pattern.md)
