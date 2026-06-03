# QC Control — Coagulação

Sistema de Controle de Qualidade para laboratório de coagulação, atendendo RDC 302, PALC, DICQ e ISO 15189.

## Filosofia

- **Simplicidade**: cada tela tem um propósito claro
- **Operador-friendly**: 30-90 segundos por sessão típica
- **Legislação atendida**: chart + registro + Westgard + ação corretiva + rastreabilidade
- **Fluxo real**: 1 lote = 1 corrida = 1 registro

## Estrutura de Telas

| # | Arquivo | Propósito | Frequência de uso |
|---|---------|-----------|-------------------|
| 1 | `01-qc-control.html` | Registro diário + chart + quick add | 5-10×/dia |
| 2 | `02-lot-management.html` | Cadastro de lotes de controle | 1-2×/mês |
| 3 | `03-corrective-actions.html` | Gestão de não conformidades | 1-2×/semana |
| 4 | `04-analyzer-management.html` | Equipamentos + calibração + manutenção | 1-3×/semana |
| 5 | `05-reports.html` | Relatórios para auditoria/acreditação | 2-4×/mês |

## Fluxo do Operador (Tela 1)

1. Operador roda controle no analyzer (fora do sistema)
2. Vê o resultado no equipamento
3. Abre o QC Control
4. Seleciona o lote → chips mostram reagente + analyzer automaticamente
5. Digita valor
6. Clica "Save"
7. Se violou regra Westgard → aparece campo obrigatório de justificativa
8. Salva com justificativa → resultado liberado

## Design System

Ver `DESIGN-SYSTEM.md` para:
- Tokens de cor (primary: `#004787`)
- Tipografia (Geist Sans + Geist Mono)
- Espaçamento, radius, border
- Terminologia unificada
- Anti-patterns

## Legislação Atendida

### RDC 302 / PALC
- ✅ Registro diário de controles com data, lote, resultado
- ✅ Justificativa obrigatória para liberação com violação
- ✅ L1 (normal) + L2 (anormal/terapêutico) para coagulação

### DICQ (Manual de Acreditação)
- ✅ Rastreabilidade: lote → reagente → analyzer → operador
- ✅ Regras Westgard aplicadas (1-2S, 1-3S, 2-2S, R-4S, 4-1S, 10X)
- ✅ Histórico de edições visível (quem alterou o quê)
- ✅ Ações corretivas formais para não conformidades não resolvidas
- ✅ Calibração e manutenção de equipamentos documentadas
- ✅ Relatórios imutáveis gerados para auditoria

### ISO 15189
- ✅ Gestão de não conformidades estruturada (investigation + action + verification)
- ✅ Importação PNCQ de ranges-alvo
- ✅ Registros preservados (archive, nunca delete)
- ✅ Retention policy de 5 anos

## Como visualizar

Abra qualquer `.html` no navegador. Todos independentes usando Tailwind CDN + Geist fonts.

## Nomenclatura

- **QC Control**: nome oficial do produto (todas as telas)
- **Lot [number]**: identificador
- **Level 1 / Level 2** (forms), **L1 / L2** (tabelas)
- **Analyzer**: equipamento (não "Unit", "Equipment", "Device")
- **Save**: botão de registro (não "Save Run", "Save Changes")
- **Archive**: remover (não "Delete")

## Coagulação: 2 níveis apenas

Diferente de bioquímica (3 níveis), coagulação usa:
- **Level 1**: normal (within reference range)
- **Level 2**: anormal / terapêutico (prolongado, ex: INR 2.0-3.0)

Analitos cobertos: PT-INR, APTT, Fibrinogen, D-Dimer, TT.
