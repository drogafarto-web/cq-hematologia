# Roadmap — Refatoração Coagulação v2

## Visão

Reescrever o QC Control para o modelo de domínio real do v2 de produção, onde 1 controle agrupa 3 parâmetros de coagulação (Atividade de Protrombina, RNI, TTPA) em 1 único registro, sem regras Westgard (apenas validação por range).

## Slices

- [x] **S1: Schema v2 (Controle + Registro 3 campos)** `risk:high` `depends:[]`

  > After this: `prisma db push` sem erro, seed cria 2 controles ativos com ranges 80-120 / 0.83-1.11 / 27-39, registros agrupados com 3 valores

- [x] **S2: Tela principal v2 — grid 2 controles × 3 parâmetros** `risk:high` `depends:[S1]`

  > After this: vejo 6 inputs (3×2), preencho valor, salvo e vejo registro criado no topo da lista

- [x] **S3: Hub de controles (CRUD) com ranges por parâmetro** `risk:medium` `depends:[S1]`

  > After this: crio/ativo Controle "Normal" lote 7425 com ranges 80-120 / 0.83-1.11 / 27-39

- [x] **S4: Histórico por controle com status "no range / fora"** `risk:low` `depends:[S1,S2]`

  > After this: seleciono controle e vejo lista de registros com badges coloridos por parâmetro

- [ ] **S5: Charts opcionais (1 por parâmetro, referência visível)** `risk:low` `depends:[S1,S2]`
  > After this: 6 charts (3×2) com linhas de referência e range colorido

## Risco principal

Perder autenticação ou design system da v1 ao isolar o repo. Mitigação: copiar apenas arquivos necessários (auth + lib + ui + layout), reescrever tudo que é Lot/QcRun/Westgard.

## Strategy

- Repo novo em `qc-control-v2/`
- Copiar auth + lib (db, utils, validators parciais) + components/ui + components/layout
- Reescrever schema, tela principal, hub, histórico
- Manter v1 intacto como referência e fallback

## Proof strategy

- Build verde + testes unitários
- Seed demo com 2 controles e 5 registros recentes
- Walkthrough manual de: criar controle + registrar entrada + ver status
