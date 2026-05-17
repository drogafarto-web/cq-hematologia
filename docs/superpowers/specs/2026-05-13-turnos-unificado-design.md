# Spec: Módulo Turnos Unificado (Escala + Registros + Cobertura)

**Data:** 2026-05-13
**Status:** Aprovado
**Decisões:** Abordagem A (absorver Escala em Turnos), 3 abas, Firestore para padrão, callables para escrita.

---

## Objetivo

Unificar o módulo Turnos (`src/features/turnos/`) com a aba Escala de Personnel (`src/features/personnel/components/EscalaTab.tsx`) num único módulo coeso. Refazer a UI seguindo o Design System v2.0 (dark-first, tokens semânticos, tipografia Inter, referência Linear/Stripe/Vercel).

## Escopo

### Inclui

- Migrar código de Escala (types, hooks, service) de `personnel/` para `turnos/`
- Remover aba Escala do PersonnelDashboard
- Reescrever UI completa do módulo Turnos com DS v2.0
- 3 abas: Escala (planejamento semanal) | Registros (turnos efetivos) | Cobertura (heatmap 90d)
- Escala padrão persistida em Firestore (`labs/{labId}/turnos-config/escala-padrao`)
- 5 callables novos para escrita de escalas
- Unificar tipo `Periodo` (eliminar duplicação `Turno` vs `Periodo`)

### Não inclui

- Migração de dados Firestore (coleção `personnel/{labId}/escalas/` continua no mesmo path)
- Mudanças no backend de turnos efetivos (callables existentes intactos)
- Mudanças em presença/checkin (SupervisorPresenca fica como está)

---

## Arquitetura de Arquivos

```
src/features/turnos/
├── components/
│   ├── TurnosShell.tsx          ← Entry point (PageHeader + 3 tabs)
│   ├── EscalaTab.tsx            ← Aba 1: calendário semanal + padrão
│   ├── RegistrosTab.tsx         ← Aba 2: lista de turnos efetivos
│   ├── CoberturaTab.tsx         ← Aba 3: heatmap 90d
│   ├── EscalaCalendar.tsx       ← Grid 7 colunas (Seg-Dom)
│   ├── EscalaDayCell.tsx        ← Célula de um dia no calendário
│   ├── EscalaFormModal.tsx      ← Modal criar/editar escala
│   ├── EscalaPadraoPanel.tsx    ← Config do template semanal
│   ├── TurnoForm.tsx            ← Form turno efetivo (refatorado DS v2.0)
│   └── SupervisorPresencaActions.tsx
├── hooks/
│   ├── useTurnos.ts             ← (mantém)
│   ├── useEscalas.ts            ← Migrado de personnel/
│   ├── useEscalaPadrao.ts       ← NOVO (subscribe Firestore)
│   ├── useCoberturaTurnos.ts    ← (mantém)
│   └── useSupervisorPresenca.ts ← (mantém)
├── services/
│   ├── turnosService.ts         ← (mantém)
│   ├── turnosCallables.ts       ← Adiciona callables de escala
│   └── escalaService.ts         ← Migrado de personnel/ (read-only)
├── types/
│   ├── Turno.ts                 ← Adiciona Periodo unificado
│   ├── Escala.ts                ← Migrado de personnel/
│   └── shared_refs.ts
└── CLAUDE.md
```

## Eliminação de Redundâncias

| Arquivo removido de personnel/ | Destino |
|---|---|
| `components/EscalaTab.tsx` | Reescrito em `turnos/components/EscalaTab.tsx` |
| `hooks/useEscalas.ts` | Movido para `turnos/hooks/useEscalas.ts` |
| `services/escalaService.ts` | Movido para `turnos/services/escalaService.ts` |
| `types/Escala.ts` | Movido para `turnos/types/Escala.ts` |
| Referência em `PersonnelDashboard.tsx` | Removida |

### Tipo unificado

```typescript
// turnos/types/Turno.ts
export type Periodo = 'manha' | 'tarde' | 'noite' | 'integral' | 'plantao';
```

O tipo `Turno` de `Escala.ts` (que era `'manha'|'tarde'|'noite'|'integral'`) passa a usar `Periodo` diretamente.

---

## Firestore

| Coleção | Uso | Mudança |
|---|---|---|
| `labs/{labId}/turnos/` | Turnos efetivos | Nenhuma |
| `personnel/{labId}/escalas/` | Escalas planejadas | Nenhuma (path mantido) |
| `labs/{labId}/turnos-config/escala-padrao` | Template semanal | NOVO |

### Schema: Escala Padrão (Firestore)

```typescript
interface EscalaPadrao {
  labId: string;
  diasAtivos: number[];  // 0=Seg..6=Dom
  turnos: {
    periodo: Periodo;
    colaboradores: { id: string; nome: string; cargo: string }[];
    rtPresente: boolean;
    rtSubstitutoPresente: boolean;
  }[];
  updatedAt: Timestamp;
  updatedBy: string;  // uid
}
```

---

## Cloud Functions (novos callables)

| Callable | Input | Ação |
|---|---|---|
| `turnos_createEscala` | `{ labId, data, periodo, colaboradores, rtPresente, rtSubstitutoPresente, observacoes? }` | Cria doc em `personnel/{labId}/escalas/` |
| `turnos_updateEscala` | `{ labId, escalaId, ...fields }` | Atualiza escala existente |
| `turnos_softDeleteEscala` | `{ labId, escalaId }` | Marca `deletadoEm` |
| `turnos_saveEscalaPadrao` | `{ labId, diasAtivos, turnos }` | Upsert em `turnos-config/escala-padrao` |
| `turnos_applyEscalaPadrao` | `{ labId, weekStartISO }` | Batch create escalas para dias sem cobertura |

Todas validam: auth, membership, payload (Zod).

---

## UI — Design System v2.0

### TurnosShell

- PageHeader: "Turnos e Supervisão" (20px, Inter 600, --text-strong)
- Subtitle: "RDC 978 Art. 122 · Planejamento e registro de cobertura RT" (13px, --text-muted)
- 3 tabs estilo Segmented Control com contadores
- Alert banner (--danger-500 bg tint) quando diasSemCobertura > 0

### EscalaTab (Aba 1)

- Navegação semanal: botões ghost ← → com label "11/05 — 17/05"
- Toolbar: "Aplicar padrão" (btn primary) + "Configurar" (btn ghost)
- EscalaCalendar: grid 7 colunas, gap 8px
- EscalaDayCell: card (--surface-card, border --border-soft, radius 8px)
  - Header: dia da semana (10px uppercase --text-faint) + número (14px --text-strong)
  - Body: badges de período (4px radius, --accent-tint ou --success-50)
  - Dot indicator: verde (RT ok) ou vermelho (sem RT)
  - Footer: botão "+" ghost para adicionar
- EscalaFormModal: overlay --black/60, card centralizado max-w-md

### RegistrosTab (Aba 2)

- Table com sticky header (DS v2.0 Table pattern)
- Colunas: Data | Período | Supervisor | CRBM | Status | Ações
- Row hover: --accent-tint
- Botão "+ Novo Turno" (btn primary)
- Empty state com ilustração minimalista

### CoberturaTab (Aba 3)

- Heatmap 90 dias (grid de células coloridas)
- Legenda: registered (--success-500), inferred (--warning-500), missing (--danger-500)
- KPI cards no topo: Total | Registrados | Inferidos | % Cobertura

### Tokens aplicados

- Background page: `--surface-page` (#0B0F14)
- Cards: `--surface-card` (#11161D), border `--border-soft` (rgba 255,255,255,0.06)
- Texto: `--text-strong` (#FFF), `--text-body` (rgba 255,255,255,0.82), `--text-muted` (#94A3B8), `--text-faint` (#64748B)
- Accent: `--accent-600` (#2563EB) para primary actions
- Status: `--success-500` (#10B981), `--danger-500` (#EF4444), `--warning-500` (#F59E0B)
- Tipografia: Inter 600/20px (h1), 600/14px (h2), 400/13px (body), 600/10px uppercase tracking-wider (labels)
- Mono: JetBrains Mono 500/13px (hashes, datas ISO)
- Radius: 8px (cards), 6px (inputs/buttons), 4px (badges)
- Transitions: 150ms ease, spring easing para hover scale

---

## Critérios de Aceite

1. Módulo Turnos renderiza com 3 abas funcionais
2. Aba Escala mostra calendário semanal com navegação e CRUD via callable
3. Escala padrão persiste em Firestore e aplica na semana com um clique
4. Aba Registros lista turnos efetivos com sorting e empty state
5. Aba Cobertura mostra heatmap 90d com KPIs
6. Aba Escala removida de Personnel sem quebrar o módulo
7. Tipo `Periodo` unificado — sem duplicação
8. UI 100% DS v2.0 (tokens, tipografia, componentes)
9. WCAG AA: contraste, foco visível, aria-labels
10. TypeScript sem erros (`npx tsc --noEmit`)
11. Alert de cobertura RT funcional (RDC 978 Art. 122)
