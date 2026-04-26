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

- [0001 — Arquitetura de spines para rastreabilidade RDC 978](0001-arquitetura-spines-rdc-978.md)
