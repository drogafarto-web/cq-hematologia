# Design System — HC Quality v2.0

## Referência Visual

Arquivo-fonte: `Downloads/hc quality.zip` (Claude Designer, 2026-05-13)
Protótipos interativos: `prototypes/HC-Quality Prototypes.html`

Este documento é o **norte visual** para toda evolução de UI do HC Quality.
Qualquer novo componente, tela ou refatoração visual deve seguir estas diretrizes.

---

## Inspirações

- Linear (navegação, densidade, tipografia)
- Stripe Dashboard (KPIs, cards, hierarquia)
- Vercel (minimalismo, dark mode, espaçamento)
- Datadog/Grafana (analytics, heatmaps, charts)
- Notion (clareza, whitespace, legibilidade)

---

## Tipografia

| Uso           | Fonte          | Peso | Tamanho | Tracking           |
| ------------- | -------------- | ---- | ------- | ------------------ |
| h1 (página)   | Inter          | 600  | 20px    | -0.02em            |
| h2 (seção)    | Inter          | 600  | 14px    | normal             |
| body          | Inter          | 400  | 13px    | normal             |
| label         | Inter          | 600  | 10px    | 0.06em (uppercase) |
| mono/numérico | JetBrains Mono | 500  | 13px    | normal             |

Fontes substituíveis: IBM Plex Sans, Geist, Source Sans 3 (sans) / JetBrains Mono, Geist Mono, Source Code Pro (mono).

---

## Tokens de Cor

### Light Mode

```css
--surface-page: #f8fafc;
--surface-card: #ffffff;
--surface-sidebar: #ffffff;
--surface-muted: #f1f5f9;
--border-soft: #e2e8f0;
--border-hairline: #eef2f6;
--text-strong: #0f172a;
--text-body: #334155;
--text-muted: #64748b;
--text-faint: #94a3b8;
```

### Dark Mode

```css
--surface-page: #0b0f14;
--surface-card: #11161d;
--surface-sidebar: #0f1318;
--surface-muted: #161b23;
--border-soft: rgba(255, 255, 255, 0.06);
--border-hairline: rgba(255, 255, 255, 0.04);
--text-strong: #ffffff;
--text-body: rgba(255, 255, 255, 0.82);
--text-muted: #94a3b8;
--text-faint: #64748b;
```

### Accent (azul padrão, overridable)

```css
--accent-600: #2563eb;
--accent-700: #1d4ed8;
--accent-500: #3b82f6;
--accent-400: #60a5fa;
--accent-50: #eff4ff;
--accent-tint: rgba(37, 99, 235, 0.1);
```

### Status (semânticos)

```css
--success-500: #10b981;
--success-50: #ecfdf5;
--warning-500: #f59e0b;
--warning-50: #fffbeb;
--danger-500: #ef4444;
--danger-50: #fef2f2;
```

---

## Densidade

| Modo          | Row padding | Page Y | Page X |
| ------------- | ----------- | ------ | ------ |
| compact       | 8px         | 16px   | 24px   |
| cozy (padrão) | 12px        | 24px   | 32px   |
| comfortable   | 16px        | 32px   | 40px   |

---

## Forma & Espaço

- Border radius: 4px (badges), 6px (inputs), 8px (cards), 12px (modals), 16px (panels)
- Shadows: minimal, usar border-soft em vez de box-shadow quando possível
- Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring), `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (spring-soft)

---

## Componentes-Chave

### Shell (Layout)

- Sidebar fixa à esquerda (ícones + labels, colapsável)
- Topbar com busca, notificações, toggle dark/light, avatar
- Main content com scroll independente

### KPI Card

- Accent line lateral (3px, cor semântica)
- Valor grande (20px, font-semibold)
- Label (10px, uppercase, tracking-wider, text-faint)
- Sublabel com tendência (11px, text-muted)
- Sparkline opcional (barras ou linha)

### Card

- Background: surface-card
- Border: border-soft (1px)
- Radius: 8px
- Padding: 16-20px
- Header: título + actions (botões ghost)

### Badge

- Dot indicator (4px circle) + label
- Tones: neutral, info, success, warning, danger
- Font: 11px, font-medium
- Padding: 2px 8px
- Radius: 4px (rounded-sm)

### Button (Btn)

- Kinds: primary (accent bg), secondary (border), ghost (no border)
- Sizes: sm (h-7), md (h-8), lg (h-9)
- Font: 12px, font-medium
- Radius: 6px
- Icon + label pattern

### Table

- Sticky header com background surface-card
- Header: 10px, uppercase, tracking-wider, font-semibold, text-faint
- Rows: 12.5px, border-hairline entre linhas
- Hover: background accent-tint (sutil)
- Selected row: background accent-tint

### PageHeader

- Título (20px, font-semibold, tracking-tight)
- Subtitle (13px, text-muted)
- Actions (botões à direita)
- Tabs abaixo (com contadores opcionais)

### Segmented Control (Seg)

- Inline toggle entre opções
- Active: accent background, text-strong
- Inactive: text-muted, hover text-body

---

## Padrões de Tela

### Dashboard/Hub

1. PageHeader (título + subtitle + actions + tabs)
2. KPI row (4 cards, grid)
3. Content grid (2/3 + 1/3 ou 3 colunas)
4. Cards com tabelas, charts, alertas

### Lista/Registro

1. PageHeader com tabs (contadores)
2. Toolbar: Segmented filters + search + "Mais filtros"
3. Table com sticky header
4. Detail drawer lateral (opcional)
5. Paginação no rodapé

### Formulário/Modal

1. Overlay backdrop (black/60)
2. Card centralizado (max-w-2xl)
3. Header: título + close button
4. Form fields com labels acima
5. Actions: Cancelar (ghost) + Submit (primary)

---

## Heatmap de Riscos (Específico)

- Grid 5×5 com gap de 4-6px
- Células com border-radius 8px
- Gradação por zona: verde → lime → amarelo → laranja → vermelho
- Hover: scale(1.04) com spring easing
- Contagem centralizada (font-semibold, 14-16px)
- Labels nos eixos (descritivos: "Rara", "Catastrófica")
- Tooltip contextual no hover (lista de riscos)
- Indicador pulsante em células críticas

---

## PDF Executivo

- Capa escura (#0f1115) com branding
- Tipografia: Helvetica (built-in pdfkit)
- Seções numeradas (1. Sumário, 2. Matriz, 3. Pareto, 4. Registro, 5. Conclusão)
- Rodapé com paginação e identificação
- Cores de NPR: vermelho (≥100), laranja (61-99), amarelo (25-60), preto (<25)
- Referências normativas no apêndice

---

## Regras de Aplicação

1. **Dark-first**: o app roda em dark mode por padrão. Light mode é secundário.
2. **Tokens semânticos**: nunca usar cores hardcoded. Sempre via variáveis CSS.
3. **Consistência**: mesmo componente = mesma aparência em todos os módulos.
4. **Densidade cozy**: padrão para desktop. Compact para tabelas densas. Comfortable para mobile.
5. **Migração gradual**: novos componentes seguem este design system. Módulos existentes migram quando tocados.
6. **Acessibilidade**: WCAG AA mínimo. Contraste verificado em ambos os modos.
7. **Responsividade**: mobile-first para layout, mas otimizado para desktop (uso principal).

---

## Arquivos de Referência

- `prototypes/tokens.css` — variáveis CSS completas
- `prototypes/shell.jsx` — Shell + Sidebar + Topbar + componentes base
- `prototypes/foundation.jsx` — Design system showcase (tipografia, cores, componentes)
- `prototypes/screens-core.jsx` — Hub/Dashboard
- `prototypes/screens-quality.jsx` — NCs, CQI
- `prototypes/screens-ops.jsx` — Operações, Calibrações
- `prototypes/screens-adaptive.jsx` — Responsividade (mobile, tablet)
- `prototypes/design-canvas.jsx` — Canvas de apresentação
- `prototypes/tweaks-panel.jsx` — Painel de customização (fonte, accent, densidade)
