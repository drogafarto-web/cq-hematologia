# M001-CONTEXT — Coagulação: Correção do Modelo de Corrida

**Data:** 2026-05-21
**Spec:** `docs/superpowers/specs/2026-05-21-coagulacao-run-model.md`

---

## Decisões do CTO

1. **1 run = 1 nivel + 1 lote.** Usuário cria runs separadas para nível I e II.
2. **Analitos por equipamento.** `EQUIP_ANALYTES` mapeia `CoagEquipamento → CoagAnalyteId[]`. Clotimer Duo = TP + RNI + TTPA (sem fibrinogênio).
3. **Insumo como gate.** Se o setup não tem TTPA configurado, TTPA não aparece no form.
4. **Schema dinâmico.** `resultados` muda de `analytesBaseline` fixo para `z.record(z.coerce.number().positive())`.
5. **Sem migração retroativa.** Runs antigas mantêm a estrutura atual.

## Referências

- `src/features/coagulacao/CoagAnalyteConfig.ts` — adicionar `EQUIP_ANALYTES`
- `src/features/coagulacao/components/CoagulacaoForm.schema.ts` — resultados dinâmicos
- `src/features/coagulacao/components/CoagulacaoForm.tsx` — nível obrigatório + filtro
- `src/features/coagulacao/hooks/useCoagLots.ts` — filtrar por nível
- `src/features/coagulacao/hooks/useSaveCoagRun.ts` — ajustar lookup de lote

## Bloqueadores
- Nenhum