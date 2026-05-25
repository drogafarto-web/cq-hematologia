# Coagulação — Correção do Modelo de Corrida

**Data:** 2026-05-21
**Módulo:** `coagulacao`
**Motivação:** 1 lote de controle físico = 1 nível. O form atual renderiza analitos que o equipamento não mede e que não têm insumo configurado.

---

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Modelo de corrida | 1 run = 1 nível + 1 lote de controle |
| Seletor de nível | Dropdown/radio no topo do form, obrigatório antes de exibir resultados |
| Lotes por nível | Filtrados automaticamente pelo `nivel` selecionado |
| Analitos exibidos | Driven pelo equipamento + insumos configurados no setup |
| Fibrinogênio | Associado a equipamento específico; não aparece no Clotimer Duo |
| Schema Firestore | Sem mudanças — `CoagulacaoRun.nivel` e `CoagulacaoLot.nivel` já são `CoagNivel` |
| Forma de save | 1 save = 1 run (nível único). Nível II exige 2ª run separada |

---

## Mudanças

### 1. Schema Zod (`CoagulacaoForm.schema.ts`)

**Antes:** `resultados` valida 3 analitos fixos (atividadeProtrombinica, rni, ttpa) obrigatórios.

```
resultados: analytesBaseline  // todas obrigatórias
```

**Depois:** `resultados` vira `z.record(z.coerce.number().positive())` validado em runtime contra os analitos suportados pelo equipamento + setup.

```
resultados: z.record(z.coerce.number().positive())
  .refine((r) => Object.keys(r).length > 0, 'Pelo menos 1 analito obrigatório.')
```

### 2. Constantes de equipamento (`CoagAnalyteConfig.ts`)

Adicionar `analitosSuportados` por equipamento:

```typescript
export const EQUIP_ANALYTES: Record<CoagEquipamento, CoagAnalyteId[]> = {
  'Clotimer Duo': ['atividadeProtrombinica', 'rni', 'ttpa'],
};
```

### 3. Form (`CoagulacaoForm.tsx`)

- Nível vira **seletor obrigatório** no topo (antes de qualquer outro campo)
- Ao selecionar nível, buscar lotes de controle disponíveis para aquele nível
- `resultados` renderiza **só** os analitos do `EQUIP_ANALYTES[equipamento]`
- O campo de fibrinogênio aparece apenas se o equipamento suportar
- Se o setup de insumos não configurou TTPA, TTPA não aparece nos resultados

### 4. Lotes filtrados por nível

No `useCoagLots` / seletor de lote, filtrar por `nivel === nivelSelecionado`.

### 5. Limpeza do schema

Remover `analytesBaseline` — mean/SD passam a ser `z.record(z.coerce.number().positive()).optional()` em vez de shape fixo de 3 analitos.

---

## Arquivos modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/features/coagulacao/CoagAnalyteConfig.ts` | Adicionar `EQUIP_ANALYTES` |
| `src/features/coagulacao/components/CoagulacaoForm.schema.ts` | Resultados dinâmicos |
| `src/features/coagulacao/components/CoagulacaoForm.tsx` | Renderização condicional por equipamento + nível |
| `src/features/coagulacao/hooks/useCoagWestgard.ts` | Validar analitos contra equipamento |
| `src/features/coagulacao/hooks/useSaveCoagRun.ts` | Ajustar lookup de lote por nível |

---

## Riscos

- Runs existentes com fibrinogênio em equipamento que não suporta: ignorar (dado legado, não corromper)
- Migração retroativa de runs: não fazer — runs antigas mantêm o schema original
- UI de "criar corrida nível II" precisa ser óbvia: botão dedicado na view do lote

---

## Próximos passos

1. Implementar `EQUIP_ANALYTES` + schema dinâmico
2. Refatorar form para seletor de nível obrigatório
3. Vincular seletor de lote ao nível selecionado
4. Testar com setup que contém só TP (TTPA não deve aparecer)
5. Smoke test E2E: criar run Nível I, criar run Nível II, verificar Levey-Jennings