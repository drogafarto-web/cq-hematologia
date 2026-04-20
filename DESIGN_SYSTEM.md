# Design System — hc-quality/cqi

Guia de referência para qualquer designer ou desenvolvedor que trabalhar neste produto a partir daqui. Leia antes de tocar em qualquer interface.

---

## Identidade visual

**Produto:** `hc-quality` — sistema SaaS de Controle de Qualidade Interno para laboratórios clínicos  
**Tagline interna:** `hc-quality/cqi`  
**Público:** biomédicos, bioquímicos, técnicos de laboratório  
**Contexto de uso:** tela de desktop, ambiente clínico, modo dia

---

## Paleta de cores

### Luz (padrão)

| Token         | Hex       | Tailwind      | Uso                           |
| ------------- | --------- | ------------- | ----------------------------- |
| Primary       | `#2563EB` | `blue-600`    | CTAs, nav ativa, links        |
| Primary hover | `#1D4ED8` | `blue-700`    | Hover de botão primário       |
| Primary soft  | `#EFF4FF` | `blue-50`     | Fundo de badge, nav ativa bg  |
| Success       | `#10B981` | `emerald-500` | Aprovado, sem violações       |
| Warning       | `#F59E0B` | `amber-500`   | Alerta 1-2s (não rejeita)     |
| Danger        | `#EF4444` | `red-500`     | Rejeição Westgard, erro       |
| BG            | `#F8FAFC` | `slate-50`    | Background da página          |
| Card          | `#FFFFFF` | `white`       | Background de cards e sidebar |
| Border        | `#E2E8F0` | `slate-200`   | Bordas padrão                 |
| Border strong | `#CBD5E1` | `slate-300`   | Bordas em hover/focus         |
| Text          | `#0F172A` | `slate-900`   | Texto principal               |
| Text muted    | `#64748B` | `slate-500`   | Labels, metadados             |
| Text faint    | `#94A3B8` | `slate-400`   | Placeholders, kbd hints       |

### Escuro (dark mode via `.dark`)

O dark mode usa as mesmas primitivas Tailwind com prefixo `dark:`. Padrões:

| Elemento       | Dark class                 |
| -------------- | -------------------------- |
| BG da página   | `dark:bg-[#0B0F14]`        |
| Sidebar/topbar | `dark:bg-[#0F1318]`        |
| Card           | `dark:bg-white/[0.03]`     |
| Border         | `dark:border-white/[0.06]` |
| Texto          | `dark:text-white`          |
| Texto muted    | `dark:text-slate-400`      |
| Texto faint    | `dark:text-slate-500`      |

---

## Tipografia

| Classe        | Tamanho | Peso | Uso                           |
| ------------- | ------- | ---- | ----------------------------- |
| `.h1` / page  | 24px    | 700  | Título da página              |
| `.h2`         | 18px    | 600  | Título de seção               |
| `text-sm`     | 14px    | 400  | Corpo padrão                  |
| `text-xs`     | 12px    | —    | Metadados, labels             |
| `text-[10px]` | 10px    | 600  | Labels UPPERCASE com tracking |

**Fonte display:** Inter (Google Fonts)  
**Fonte mono:** JetBrains Mono — usada em: IDs de corrida, valores numéricos, atalhos de teclado, timestamps

`tracking-tight` em títulos. `tabular-nums` em qualquer dado numérico de laboratório (valores, z-scores).

---

## Shell — layout padrão

```
┌──────────────────────────────────────────────────────┐
│ Sidebar (232px)  │ Topbar (56px)                     │
│                  ├───────────────────────────────────┤
│ brand            │ Page content (max-w-[1400px])      │
│ nav items        │                                    │
│ config           │                                    │
│ ─────────────    │                                    │
│ user chip        │                                    │
└──────────────────────────────────────────────────────┘
```

**Arquivo:** `src/features/analyzer/AnalyzerView.tsx`

### Sidebar

- Largura: 232px fixo, `sticky top-0 h-screen`
- Brand: `brand-mark` (26×26px, monospace "hc") + `hc-quality/cqi`
- Nav operação: Dashboard (D), Nova corrida (N), Análise (A), Histórico (H)
- Nav configuração: Lotes, Importar bula, Super Admin (se isSuperAdmin)
- User chip no rodapé: iniciais + displayName + role
- Estado ativo: `bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400`
- Hover: `bg-slate-100 dark:bg-white/[0.05]`

### Topbar

- Altura: 56px, `sticky top-0 z-10`
- Breadcrumbs: `Lab · Setor / Operação / Página`
- Direita: search input (260px) + sync dot + bell + ThemeToggle + overflow menu

---

## Componentes

### Botões

```tsx
// Primário — CTA principal
<button className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">

// Secundário — ações auxiliares
<button className="... bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 ...">

// Ghost — cancelar, navegar
<button className="... text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] ...">

// Danger — exclusão
<button className="... bg-red-500 text-white hover:bg-red-600 ...">
```

Tamanhos: `h-9` padrão, `h-8 text-xs` small, `h-10` large.  
Radius: `rounded-lg` (8px) padrão, `rounded-md` (6px) em contextos densos.

### Cards

```tsx
<div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl shadow-sm dark:shadow-none">
  {/* Header */}
  <div className="flex items-center px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
    <span className="text-sm font-semibold text-slate-700 dark:text-white/80">Título</span>
  </div>
  {/* Body */}
  <div className="p-5">...</div>
</div>
```

Radius sempre `rounded-xl` (12px). Nunca `rounded-2xl` em cards de dados.

### Badges de status

```tsx
// Aprovada
<span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 ...">

// Rejeitada
<span className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 ...">

// Alerta (1-2s)
<span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 ...">
```

Sempre com dot (1.5px, rounded-full) + texto. Estrutura:

```tsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border">
  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
  Aprovada
</span>
```

### KPI Cards (Dashboard)

```tsx
<div className="relative bg-white dark:bg-white/[0.03] border ... rounded-xl p-5 overflow-hidden">
  {/* Barra vertical de acento — 3px, cor semântica */}
  <div
    className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
    style={{ background: accent }}
  />
  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Label</div>
  <div className="text-[28px] font-semibold tracking-tight tabular-nums">Valor</div>
  <div className="mt-2.5 text-xs text-slate-500">Tendência</div>
</div>
```

Grid: `grid grid-cols-4 gap-4` no Dashboard.

### Tabelas

```tsx
<table className="w-full text-sm border-collapse">
  <thead>
    <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 py-2.5">
        Coluna
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-t border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">...</td>
    </tr>
  </tbody>
</table>
```

Padding de célula: `px-4 py-3`. Valores numéricos: `tabular-nums text-right`.

### Segmented controls (filtros)

```tsx
<div className="inline-flex bg-slate-100 dark:bg-white/[0.06] rounded-lg p-0.5 gap-0.5">
  <button
    className={`px-3 h-7 rounded-md text-xs font-medium transition-colors ${
      active
        ? 'bg-white dark:bg-white/10 text-slate-800 dark:text-white shadow-sm'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
    }`}
  >
    Label
  </button>
</div>
```

### Westgard chips

```tsx
// Regra violada
<span className="font-mono text-[11px] px-1.5 py-0.5 rounded border bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20">
  1-3s
</span>

// Regra inativa
<span className="font-mono text-[11px] px-1.5 py-0.5 rounded border bg-white dark:bg-transparent text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/[0.08]">
  4-1s
</span>
```

### Step indicator (fluxo de 3 etapas)

```tsx
<div className="flex items-center gap-0 mb-6">
  {steps.map((label, i) => (
    <React.Fragment key={label}>
      <div className="flex items-center gap-2.5">
        <div
          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-semibold ${
            done
              ? 'bg-emerald-500 text-white'
              : active
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-400'
          }`}
        >
          {done ? <CheckIcon /> : i + 1}
        </div>
        <span className={active ? 'text-slate-800' : 'text-slate-400'}>{label}</span>
      </div>
      {i < steps.length - 1 && (
        <div className={`flex-1 h-px mx-3 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
      )}
    </React.Fragment>
  ))}
</div>
```

---

## Ícones

Todos os ícones são SVG inline customizados. **Não usar bibliotecas externas de ícones.**

Tamanho padrão: `16×16px` na sidebar, `14×14px` em botões, `13×13px` em contextos densos.

Padrão de componente:

```tsx
function NomeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="..." />
    </svg>
  );
}
```

`aria-hidden` sempre presente (ícones são decorativos; texto adjacente descreve a ação).  
`stroke="currentColor"` para herdar a cor do contexto.  
`strokeWidth="1.8"` padrão nav/ações, `strokeWidth="2"` em ícones menores (14px).

---

## Spacing & layout

| Espaço        | Valor               | Uso                        |
| ------------- | ------------------- | -------------------------- |
| Page padding  | `px-8 py-6`         | Padding padrão do conteúdo |
| Card gap      | `gap-4`             | Entre cards em grids       |
| Section gap   | `gap-6` / `mb-6`    | Entre seções da página     |
| Inline gap    | `gap-2` / `gap-2.5` | Ícone + texto em botão     |
| Table padding | `px-4 py-3`         | Células de tabela          |

Grid de KPI: `grid-cols-4 gap-4`  
Grid hero + sidebar: `grid-cols-[2fr_1fr] gap-4`  
Grid 2 colunas: `grid-cols-2 gap-4`

---

## Navegação e roteamento

O `AnalyzerView` controla a navegação por estado local `page: Page`.

| Page      | Kbd | Componente            |
| --------- | --- | --------------------- |
| dashboard | D   | `DashboardScreen`     |
| nova      | N   | `NovaCorridaScreen`   |
| analise   | A   | `AnaliseScreen`       |
| historico | H   | `HistoricoScreen`     |
| lotes     | —   | `LotManager` (inline) |

Adicionar uma nova tela:

1. Criar `src/features/analyzer/screens/NovaTela.tsx`
2. Adicionar `'novatela'` ao tipo `Page` em `AnalyzerView.tsx`
3. Adicionar entry no `PAGE_META`
4. Adicionar nav item no `Sidebar`
5. Adicionar `{page === 'novatela' && <NovaTela />}` no render

---

## Regras de domínio (Westgard)

| Regra | Tipo     | Critério                                               |
| ----- | -------- | ------------------------------------------------------ |
| 1-2s  | Aviso    | 1 valor além de ±2 SD — não rejeita                    |
| 1-3s  | Rejeição | 1 valor além de ±3 SD                                  |
| 2-2s  | Rejeição | 2 consecutivos além de ±2 SD no mesmo lado             |
| R-4s  | Rejeição | 2 consecutivos spanning >4 SD (lados opostos)          |
| 4-1s  | Rejeição | 4 consecutivos além de ±1 SD no mesmo lado             |
| 10x   | Rejeição | 10 consecutivos do mesmo lado da média                 |
| 6T    | Rejeição | 6 consecutivos monotonicamente crescentes/decrescentes |
| 6X    | Rejeição | 6 consecutivos do mesmo lado da média (shift)          |

**Regra de ouro:** `'1-2s'` é o único aviso. Todos os outros são rejeição.  
Em código: `const isRejection = violations.some(v => v !== '1-2s')`.

O gráfico Levey-Jennings usa bandas coloridas:

- Verde `#ECFDF5`: ±1 SD (zona normal)
- Âmbar `#FFFBEB`: entre ±2 SD e ±3 SD (zona de aviso)
- Vermelho `#FEF2F2`: além de ±3 SD (zona de rejeição)

---

## Dados e estado

**Estado global:** Zustand (2 stores)

- `useAuthStore` — usuário, lab ativo, role, isSuperAdmin
- `useAppStore` — lots, activeLotId, selectedAnalyteId, syncStatus, currentView

**Seletores atômicos** (evitar re-renders desnecessários):

```ts
const activeLab = useActiveLab(); // não: useAuthStore(s => s.appProfile)
const isSuperAdmin = useIsSuperAdmin(); // não: useAuthStore(s => s.appProfile?.isSuperAdmin)
```

**Persistência:** Firebase Firestore (realtime) + Firebase Storage (imagens).  
**OCR:** Gemini 2.5 Flash via `@google/genai` — sempre validado com Zod antes de salvar.

---

## Antipadrões — o que nunca fazer

- **Nunca** usar gradientes decorativos. Zero `bg-gradient-to-*` em cards de dados.
- **Nunca** usar bibliotecas de ícones externas (lucide, heroicons, etc.) — todos são SVG inline.
- **Nunca** hardcodar cores em `style={{color: '#2563EB'}}` — usar classes Tailwind.
- **Nunca** usar `rounded-2xl` em cards de dados ou tabelas.
- **Nunca** adicionar animações que não sejam `transition-colors` ou `transition-all` com duração < 200ms.
- **Nunca** usar `text-purple-*` ou `text-violet-*` — paleta é azul/slate/status semântico.
- **Nunca** deixar um ícone sem `aria-hidden` quando é decorativo.
- **Nunca** usar `flex gap-*` quando o layout correto é uma tabela com dados tabulares.
- **Nunca** colocar lógica de negócio em componentes de UI — pertence nos hooks (`useLots`, `useRuns`, etc.).

---

## Referências de design

Barra de qualidade: **Apple · Linear · Stripe · Vercel**  
Sensibilidade: técnica e clínica — não startup, não SaaS genérico.  
Se parece um template Tailwind, reprovou. Se poderia ser qualquer produto, reprovou.

---

## Estrutura de arquivos relevante

```
src/
├── features/
│   └── analyzer/
│       ├── AnalyzerView.tsx          ← shell: sidebar + topbar + roteamento
│       └── screens/
│           ├── DashboardScreen.tsx   ← KPIs, hero run, tabela de analitos
│           ├── NovaCorridaScreen.tsx ← fluxo 3 steps + NewRunForm
│           ├── AnaliseScreen.tsx     ← gráfico LJ + Westgard
│           └── HistoricoScreen.tsx   ← tabela histórica agrupada por data
├── shared/
│   └── components/ui/
│       ├── ThemeToggle.tsx           ← toggle dark/light
│       └── ToastContainer.tsx        ← notificações
└── index.css                         ← variáveis CSS, spring easings, utilitários
```

---

_Última atualização: abril 2026 — após implementação do novo shell com navegação lateral (UX Claude Design)._
