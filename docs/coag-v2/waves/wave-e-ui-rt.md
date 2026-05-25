# Wave E — UI RT

## Objetivo Fechado

Implementar o painel técnico do RT: KPIs, lista de tentativas com badges, modais para aprovar/rejeitar/NOTIVISA.

## Contrato de Entrada

- Waves A + B + C aprovadas ✅
- `coag-v2-master.md` §5.3 (wireframe do RT)
- `contracts/rtaction.md` (contrato congelado)

## Definição de Pronto

- [ ] `components/RTPanel.tsx` — painel técnico com KPIs e lista
- [ ] `components/AttemptList.tsx` — lista de tentativas com timeline
- [ ] `components/internal/ActionModal.tsx` — modal reutilizável
- [ ] `components/internal/NotivisaModal.tsx` — modal específico
- [ ] `components/RTPanel.test.tsx` — smoke passing
- [ ] Timeline narrativa mostra 3 tipos de evento
- [ ] Auditoria passa

## Critérios de Rejeição

- [ ] Painel RT expõe lógica de Westgard ao operador (painel RT só!)
- [ ] RT pode criar tentativa (não — só operador)
- [ ] NOTIVISA aparece na UI do operador (não — só RT)
- [ ] Componente > 300 linhas
- [ ] Mais de 2 useState por componente

## Arquivos Permitidos

- `src/features/coagulacao-v2/components/RTPanel.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/AttemptList.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/internal/ActionModal.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/internal/NotivisaModal.tsx` (CRIAR)
- `src/features/coagulacao-v2/components/RTPanel.test.tsx` (CRIAR)
- `src/store/useAppStore.ts` (MODIFICAR — adicionar rota `/coagulacao-v2/rt`)

## Arquivos Proibidos

- Modificar `AttemptForm.tsx` (UI operador)
- Modificar services/hooks de waves A-C

## Tasks

1. `ActionModal.tsx` — modal reutilizável (10 min)
2. `NotivisaModal.tsx` — modal específico (12 min)
3. `AttemptList.tsx` — lista com timeline (15 min)
4. `RTPanel.tsx` — painel principal (25 min)
5. Registrar rota (5 min)
6. Tests (15 min)
