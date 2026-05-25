# M001 (LEGADO)

**Status:** ARQUIVADO — substituído por [`docs/coag-v2/coag-v2-master.md`](../../docs/coag-v2/coag-v2-master.md)
**Data de arquivamento:** 25/05/2026

---

## Por que arquivado

A arquitetura do redesign (v2) é fundamentalmente diferente. Ver [`docs/coag-v2/coag-v2-master.md`](../../docs/coag-v2/coag-v2-master.md) para a fonte única de verdade atual.

## Slices legadas (não mais ativas)

- S01 — EQUIP_ANALYTES + schema dinâmico → parcialmente implementado, preservado
- S02 — Form nível obrigatório + filtro de lotes → substituído por ControlOperacional
- S03 — Renderização condicional por equipamento → preservado (EQUIP_ANALYTES continua)
- S04 — Smoke test E2E → a fazer em nova arquitetura

## Preservados do legado

- [`src/features/coagulacao/CoagAnalyteConfig.ts`](../../src/features/coagulacao/CoagAnalyteConfig.ts) — baselines + EQUIP_ANALYTES
- [`src/features/coagulacao/hooks/useCoagWestgard.ts`](../../src/features/coagulacao/hooks/useCoagWestgard.ts) — regras CLSI
- [`src/features/coagulacao/hooks/useCoagSignature.ts`](../../src/features/coagulacao/hooks/useCoagSignature.ts) — logicalSignature
- [`src/features/insumos/components/ConferenciaInsumoAtivo.tsx`](../../src/features/insumos/components/ConferenciaInsumoAtivo.tsx) — gate regulatório

## Para referência futura

Consultar [`docs/coag-v2/coag-legacy-analysis.md`](../../docs/coag-v2/coag-legacy-analysis.md) para engenharia reversa completa.
