# M001-CONTEXT (LEGADO)

**Status:** ARQUIVADO — substituído por [`docs/coag-v2/coag-v2-master.md`](../../docs/coag-v2/coag-v2-master.md)
**Data de arquivamento:** 25/05/2026

---

## Por que arquivado

O redesign do módulo Coagulação (v2) convergiu para arquitetura radicalmente diferente:

- **Legado (este doc):** `CoagulacaoRun` + `CoagulacaoLot` + form 12-blocos
- **v2:** `ControlOperacional` + `Attempt` + `RTAction` (3 entidades, 3 eventos, ≤6 campos)

A engenharia legada tem mérito técnico (Westgard, snapshots, auditoria preservados), mas a arquitetura expunha complexidade em excesso ao operador.

A nova arquitetura preserva **100% do valor regulatório** e esconde **100% da complexidade técnica** do operador.

## O que permanece válido

- Regras Westgard (6 CLSI C24-A3)
- Snapshots imutáveis (insumo + reagente + equipamento)
- LogicalSignature (SHA-256)
- Audit Records imutáveis
- Compatibilidade com RDC 978, CLSI H47-A2, DICQ sec. 2.4

## O que foi descartado

- `CoagulacaoLot` como entidade raiz
- `CoagulacaoRun` como entidade (30+ campos)
- Form de 12 blocos (~27 campos)
- Nível I/II como seletor explícito no topo
- Seção NOTIVISA no form
- Calibração de bula heurística (isNewLot)
- Calibração INR (ISI/MNPT) no form

## Referência

[`docs/coag-v2/coag-legacy-analysis.md`](../../docs/coag-v2/coag-legacy-analysis.md) documenta em detalhe o sistema legado para reaproveitamento seletivo no v2.
