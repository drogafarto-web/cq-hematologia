# Wave D — UI Operador

## Objetivo Fechado

Implementar a UI operacional para criação de tentativa. Operador vê apenas ~6 campos e salva.

## Contrato de Entrada

- Waves A + B aprovadas ✅
- `coag-v2-master.md` §5.1-5.2 (wireframes textuais)
- `contracts/attempt.md` (contrato congelado)

## Definição de Pronto

- [ ] `components/AttemptForm.tsx` — form operacional (≤ 6 campos)
- [ ] `components/internal/ResultInput.tsx` — sub-componente de input
- [ ] `components/internal/ConformityBadge.tsx` — badge ✓/✕
- [ ] `components/CoagulacaoV2View.tsx` — view principal (shell)
- [ ] `AttemptForm.tsx` com Zod schema
- [ ] Smoke test local: operador cria tentativa em < 90s
- [ ] Nenhum termo técnico em labels (R4)
- [ ] Auditoria passa

## Critérios de Rejeição

- [ ] > 6 campos expostos
- [ ] Termo técnico em label ("run", "corrida", "lote", "workflow", "status:")
- [ ] Section NOTIVISA aparece (vai em wave E)
- [ ] Section de calibração ISI/MNPT aparece
- [ ] Lógica de Westgard no componente (vai no hook)
- [ ] Componente > 300 linhas

## Wireframe de Referência

```
┌─────────────────────────────────────────────────────────────┐
│  Coagulação                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Controle: [ Normal            ▼ ]                          │
│                                                              │
│  Resultados:                                                 │
│  Atividade de Protrombina   [   98  ] %                      │
│                              esperado: 80–120                │
│  RNI                        [ 1.02  ]                        │
│                              esperado: 0.83–1.11             │
│  TTPA                       [ 33.5  ] s                      │
│                              esperado: 27–39                 │
│                                                              │
│  [ ✓ Dentro dos limites ]                                    │
│                                                              │
│                    [ Cancelar ]  [ Salvar ]                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos Permitidos

- `src/features/coagulacao-v2/components/AttemptForm.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/AttemptForm.schema.ts` (CRIAR)
- `src/features/coagulacao-v2/components/internal/ResultInput.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/internal/ConformityBadge.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/CoagulacaoV2View.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/AttemptForm.test.tsx` (CRIAR)
- `src/store/useAppStore.ts` (MODIFICAR — adicionar rota `/coagulacao-v2`)

## Arquivos Proibidos

- Modificar componentes do legado (`CoagulacaoForm.tsx`, `CoagulacaoView.tsx`, etc.)

## Tasks

1. `AttemptForm.schema.ts` — Zod schema (5 min)
2. `ResultInput.tsx` — sub-componente (8 min)
3. `ConformityBadge.tsx` — sub-componente (5 min)
4. `AttemptForm.tsx` — form principal com wireframe (25 min)
5. `CoagulacaoV2View.tsx` — view shell (15 min)
6. Registrar rota em useAppStore (5 min)
7. Tests (15 min)
