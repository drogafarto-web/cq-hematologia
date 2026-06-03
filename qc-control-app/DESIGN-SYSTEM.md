# QC Control — Design System

**Versão única para todas as 5 telas do sistema.**

## 1. Identidade

- **Nome do produto**: `QC Control` (sempre exatamente assim)
- **Público**: Analista de Controle de Qualidade (coagulação)
- **Uso**: Abrir 5-10×/dia, 30-90 segundos por sessão
- **Filosofia**: Calmo, preciso, generoso em whitespace. Instrumento médico, não SaaS.

## 2. Tokens de Cor

| Token              | Hex       | Uso                                             |
| ------------------ | --------- | ----------------------------------------------- |
| Primary            | `#004787` | Botões primários, links, destaques              |
| Primary Hover      | `#003160` | Hover state                                     |
| Background         | `#FFFFFF` | Fundo padrão                                    |
| Surface            | `#F9F9FF` | Superfícies secundárias                         |
| Surface Variant    | `#F3F3F9` | Inputs desabilitados                            |
| Border             | `#E5E7EB` | Bordas padrão (1px solid)                       |
| Border Variant     | `#C2C6D2` | Bordas secundárias                              |
| On Surface         | `#191C20` | Texto principal                                 |
| On Surface Variant | `#424750` | Texto secundário                                |
| Outline            | `#727781` | Texto tertiary, ícones                          |
| Error              | `#BA1A1A` | Violação rejeição (2-2S, 1-3S, R-4S, 4-1S, 10X) |
| Error Container    | `#FFDAD6` | Fundo erro sutil                                |
| Warning            | `#D97706` | Aviso (1-2S)                                    |
| Warning Container  | `#FEF3C7` | Fundo warning sutil                             |
| Success            | `#059669` | Status operacional                              |
| Success Container  | `#D1FAE5` | Fundo success sutil                             |

**Regra absoluta**: SEM `#003160` como primary. Apenas em hover.

## 3. Tipografia

| Role               | Família    | Size / Line-height / Weight                    |
| ------------------ | ---------- | ---------------------------------------------- |
| Headline Large     | Geist      | 24px / 32 / 600                                |
| Headline Medium    | Geist      | 18px / 24 / 600                                |
| Title Small        | Geist      | 16px / 24 / 600                                |
| Body               | Geist      | 14px / 20 / 400                                |
| Body Large         | Geist      | 16px / 24 / 400                                |
| Label Caps         | Geist      | 12px / 16 / 600, letter-spacing +5%, UPPERCASE |
| Data Mono          | Geist Mono | 14px / 20 / 400 (tabular)                      |
| Data Mono Emphasis | Geist Mono | 14px / 20 / 600                                |
| Data Mono Display  | Geist Mono | 18px / 24 / 500                                |

**Regras**:

- Sempre tabular-nums em valores numéricos (alinhar decimal)
- Nunca itálico em labels (apenas em notas de leitura auxiliar)
- Nunca UPPERCASE em dados (apenas em labels)

## 4. Espaçamento

Base unit: **4px**. Múltiplos usados: 8 / 12 / 16 / 24 / 32 / 40 / 48.

| Token            | Valor       | Uso                          |
| ---------------- | ----------- | ---------------------------- |
| Input height     | 48px        | Touch-friendly               |
| Row height       | 48-56px     | Tabelas                      |
| Touch target min | 44px        | Qualquer elemento interativo |
| Header           | 48px        | Top nav                      |
| Footer           | 32px        | Status bar                   |
| Gutter           | 24px        | Padding lateral              |
| Max width        | 1100-1200px | Conteúdo centralizado        |

## 5. Border Radius

| Token   | Valor  | Uso                            |
| ------- | ------ | ------------------------------ |
| Default | 4px    | Cards, botões, inputs, painéis |
| Full    | 9999px | Status pills apenas            |

**PROIBIDOS**: Pill-shaped inputs, botões redondos, cards 8px+.

## 6. Elevation / Sombra

**NENHUMA sombra** em nenhum elemento, exceto `shadow-2xl` no painel slide-out (separação do canvas).

## 7. Navegação

**Header topo, 48px, sticky**:

- Left: `< QC Control` (backlink) + separador + nome da tela atual
- Right: nome usuário + avatar (apenas quando aplicável)

**PADRÃO FIXO**: sem sidebar, sem bottom nav (desktop), sem navegação dupla.

- A única exceção: tela principal tem tabs quando existir (ex: "Open / Closed / All")

## 8. Slide-out Panel (Pattern Único)

- Largura fixa: `480px`
- Entra pela direita com transição `200ms ease`
- Header: título + botão X
- Content: form ou dados, scrollável
- Footer: botões Save + Cancel, fixos na base
- Backdrop: `bg-black/30` (sem blur)

## 9. Tabelas

- Header bg: `surface-variant` (#F3F3F9)
- Row height: 48-56px
- Cells: 16px horizontal padding, 12px vertical
- Hover row: `bg-surface-variant` sutil
- Selected row: `border-left 4px primary` + bg sutil
- Font header: Label Caps
- Font cells: Body / Data Mono
- Divisores: `border-b border-outline-variant`

## 10. Status Pills

| Status                          | Fundo    | Texto             |
| ------------------------------- | -------- | ----------------- |
| Operational / Resolved / Closed | `D1FAE5` | `065F46`          |
| Warning / Acknowledged          | `FEF3C7` | `92400E`          |
| Overdue / Rejected / Open       | `FEE2E2` | `991B1B`          |
| Out of Service / Expired        | `F3F4F6` | `6B7280` (italic) |

## 11. Formulários

- Label: Label Caps, on-surface-variant, acima do input
- Input: 48px altura, 16px padding, border `#C2C6D2`, radius 4px
- Input focus: `border 2px #004787`, sem ring, sem shadow
- Input disabled: `bg-surface-variant`, cursor not-allowed
- Input erro: `border #BA1A1A`, texto de erro abaixo em label caps

## 12. Botões

| Tipo              | Estilos                                        | Altura |
| ----------------- | ---------------------------------------------- | ------ |
| Primary           | bg `#004787`, text white                       | 48px   |
| Primary hover     | bg `#003160`                                   | 48px   |
| Secondary/Outline | bg transparent, border `#C2C6D2`, text primary | 48px   |
| Text              | bg transparent, no border, text primary        | 40px   |
| Danger text       | text `#BA1A1A`, text-only (archives)           | 40px   |

**Regras**: todos os botões font-weight 600, radius 4px, padding 0 24px.

## 13. Terminologia Única

| Contexto                  | Termo                                                   |
| ------------------------- | ------------------------------------------------------- |
| Identificador do material | `Lot [number]`                                          |
| Nível controle (label)    | `Level 1` / `Level 2`                                   |
| Nível controle (tabela)   | `L1` / `L2`                                             |
| Equipamento               | `Analyzer` (não "Equipment", "Unit", "Device")          |
| Registrar nova corrida    | `Save` (não "Save Run", "Save Changes")                 |
| Criar entidade            | `Add Analyzer` / `Add Lot` / `New Action` (verb + noun) |
| Remover                   | `Archive` (nunca "Delete")                              |
| Exportar                  | `Export PDF` / `Export Excel`                           |

## 14. Empty States

Sem ilustrações. Texto direto:

- Tela 1 (sem dados): "No control runs recorded yet."
- Tela 2 (sem lotes): "No lots registered. Add your first above."
- Tela 3 (sem CA selecionada): "No action selected. Select from the list or create a new one."
- Tela 4 (sem analyzers): "No analyzers registered."
- Tela 5 (sem relatório): "No reports generated yet."

## 15. Footer

**32px**, minimal:

- Left: contagem ou status (ex: "12 active · 3 archived")
- Right: `Export PDF` · `Export Excel` (text links)
- Sem copyright, sem versão, sem "All data encrypted"

## 16. Anti-patterns (PROIBIDOS)

- ❌ Dark mode
- ❌ Neon / gradient / glassmorphism
- ❌ Sombras em cards ou botões
- ❌ Border-radius `rounded-full` em inputs
- ❌ Sidebar navigation
- ❌ Bottom nav em desktop
- ❌ KPI strip com métricas decorativas
- ❌ Sigma metric gauge decorativo
- ❌ Charts decorativos (barras de distribuição, pizza)
- ❌ Ilustrações em empty states
- ❌ Texto de marketing (versions, "compliance document") em footer
- ❌ Nomes de produto diferentes entre telas
- ❌ Fonts diferentes de Geist Sans + Geist Mono
- ❌ Primary color diferente de `#004787`

## 17. Legislação Atendida

- ✅ **RDC 302 / PALC**: registro de controles diários com data, lote, resultado, ação corretiva
- ✅ **DICQ**: rastreabilidade lote → reagente → analyzer → operador (via chips auto-preenchidos)
- ✅ **ISO 15189**: ação corretiva estruturada (root cause, action, verification) para não conformidades não resolvidas
- ✅ **Controle coagulação**: 2 níveis (L1 normal, L2 anormal/terapêutico)
- ✅ **PNCQ**: campo de importação de lotes e ranges-alvo
- ✅ **Auditoria**: registros imutáveis (archive, não delete), histórico de edições visível

## 18. Fluxo do Operador (Tela Principal)

1. Operador roda controle no analyzer (fora do sistema)
2. Vê resultado no equipamento
3. Abre tela QC Control
4. Seleciona lote (dropdown) → chips mostram reagente + analyzer
5. Digita valor
6. Clica "Save"
7. Se violou regra → aparece textarea "Justification (required)"
8. Salva com justificativa → libera resultado

**1 lote = 1 corrida = 1 registro. Simples assim.**
