# Auditoria Geral — Design Spec (Onda 1 MVP)

**Data:** 2026-05-14
**Módulo:** `auditoria-geral`
**Substitui:** `auditoria-interna` (será removido após validação)
**Objetivo:** Execução de auditoria interna laboratorial com 57 indicadores RDC 978/2025, escala 0-5, wizard step-by-step, dashboard, PDF executivo premium.

---

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Escopo MVP (Onda 1) | Checklist + Score + PDF + Dashboard básico |
| Navegação | Wizard step-by-step por blocos |
| Escala | 0-5 com descrições por nível (original FR-044) |
| PDF | Server-side via Cloud Function (premium, arquivável) |
| Persistência | Coleção nova: `/auditoria-geral/{labId}/auditorias/{id}` |
| Independência | Zero dependência do módulo auditoria-interna |

---

## Blocos do Wizard (agrupamento dos 57 indicadores)

| Bloco | Nome | Indicadores | Qtd |
|-------|------|-------------|-----|
| A | Documentação Legal e Governança | 1-5 | 5 |
| B | Contratos e Terceirização | 6-9 | 4 |
| C | Tecnologias e Equipamentos | 10-14 | 5 |
| D | Risco e Documentos | 15-16 | 2 |
| E | Pessoal e Educação | 17-19 | 3 |
| F | Infraestrutura e Ambiente | 20-28 | 9 |
| G | Sistemas e Biossegurança | 29-32 | 4 |
| H | Procedimentos e Rastreabilidade | 33-35 | 3 |
| I | Fase Pré-Analítica | 36-42 | 7 |
| J | Fase Analítica | 43-48 | 6 |
| K | Fase Pós-Analítica e Laudos | 49-51 | 3 |
| L | Controle da Qualidade (CIQ/CEQ) | 52-57 | 6 |

---

## Arquitetura

### Firestore Collections

```
/auditoria-geral/{labId}/auditorias/{auditoriaId}
  ├── status: 'rascunho' | 'em_andamento' | 'finalizada'
  ├── auditor: { uid, nome }
  ├── dataInicio: Timestamp
  ├── dataFim: Timestamp | null
  ├── scoreTotal: number (0-100%)
  ├── scoresPorBloco: { A: number, B: number, ... }
  ├── criadoEm: Timestamp
  ├── criadoPor: string
  ├── labId: string
  ├── deletadoEm: Timestamp | null
  └── respostas (subcollection)
        └── {indicadorId}
              ├── numero: number
              ├── indicador: string
              ├── bloco: string
              ├── score: number | null (0-5)
              ├── naoAplica: boolean
              ├── observacoes: string
              └── respondidoEm: Timestamp
```

### File Structure

```
src/features/auditoria-geral/
├── index.ts
├── types/
│   └── index.ts
├── data/
│   └── indicadores.ts
├── services/
│   └── auditoriaGeralService.ts
├── hooks/
│   ├── useAuditoriaGeral.ts
│   ├── useAuditoriasGeral.ts
│   └── useScoreCalculator.ts
├── components/
│   ├── AuditoriaGeralPage.tsx
│   ├── AuditoriasDashboard.tsx
│   ├── NovaAuditoriaDialog.tsx
│   ├── WizardAuditoria.tsx
│   ├── WizardBlocoStep.tsx
│   ├── IndicadorCard.tsx
│   ├── ScoreSelector.tsx
│   ├── ProgressBar.tsx
│   ├── ResumoAuditoria.tsx
│   └── ScoreBlocoChart.tsx
└── utils/
    └── scoreUtils.ts

functions/src/callables/auditoriaGeral/
└── generateAuditoriaGeralPDF.ts
```

---

## Ondas de Implementação

### Onda 1 — MVP Funcional (ESTA SPEC)
1. Types + data estática dos 57 indicadores
2. Service CRUD (criar, salvar respostas, finalizar)
3. Hooks (listener, score calculator)
4. UI: Dashboard + Wizard + Score + Resumo
5. Cloud Function: PDF executivo
6. Firestore Rules
7. Rota no AppRouter
8. Deploy completo

### Onda 1b — Link com Não Conformidades (pós-validação Onda 1)
- Botão "Abrir NC" em indicadores com score ≤ 2
- Cria NC no módulo existente (`/labs/{labId}/naoConformidades/`) com:
  - `origem: 'auditoria'`
  - `auditoriaId: <id da auditoria-geral>`
  - `moduloOrigem: 'auditoria-geral'`
  - `severidade` mapeada do score (0-1 = crítica, 2 = grave)
- Badge no IndicadorCard mostrando "NC aberta" quando vinculada
- No dashboard: contador de NCs abertas por auditoria

### Onda 2 — Enriquecimento
- Anexar foto (Firebase Storage)
- Timestamps detalhados
- PDF com fotos anexadas

### Onda 3 — Inteligência
- Links de comprovação com módulos HC Quality
- Gravação de áudio + transcrição Gemini
- Comparativo entre auditorias (evolução)

### Onda 4 — Avançado
- Dashboard completo (NCs, evolução, auditores)
- Plano de ação (CAPA)
- IA summary (Gemini)
- Qualificação de auditores

---

## Plano de Execução Multiagente — Onda 1

### Fase 1: Foundation (Types + Data + Service + Rules)

**Agente 1A — Types e Data**
- `src/features/auditoria-geral/types/index.ts`
- `src/features/auditoria-geral/data/indicadores.ts` (57 indicadores, 6 níveis cada)
- `src/features/auditoria-geral/utils/scoreUtils.ts`
- `src/features/auditoria-geral/index.ts`

**Agente 1B — Service**
- `src/features/auditoria-geral/services/auditoriaGeralService.ts`
- CRUD: createAuditoria, getAuditoria, saveResposta, finalizarAuditoria, listAuditorias
- Multi-tenant: todas as ops scoped a labId

**Agente 1C — Firestore Rules**
- Adicionar rules para `/auditoria-geral/{labId}/auditorias/{auditoriaId}`
- Subcoleção `respostas`
- Validações: isActiveMemberOfLab, soft-delete only

**Gate Fase 1:** `npx tsc --noEmit` passa

### Fase 2: Hooks

**Agente 2A — Hooks**
- `useAuditoriaGeral.ts` — listener single doc
- `useAuditoriasGeral.ts` — listener lista (filtro status)
- `useScoreCalculator.ts` — scores por bloco e total

**Gate Fase 2:** `npx tsc --noEmit` passa

### Fase 3: UI Components

**Agente 3A — Shell e Dashboard**
- `AuditoriaGeralPage.tsx` — page wrapper
- `AuditoriasDashboard.tsx` — lista + stats + botão criar
- `NovaAuditoriaDialog.tsx`

**Agente 3B — Wizard**
- `WizardAuditoria.tsx` — container com state (bloco atual)
- `WizardBlocoStep.tsx` — renderiza indicadores do bloco
- `ProgressBar.tsx`

**Agente 3C — Indicador e Score**
- `IndicadorCard.tsx`
- `ScoreSelector.tsx` — seletor visual 0-5 com descrições
- `ResumoAuditoria.tsx` — tela final
- `ScoreBlocoChart.tsx` — gráfico de scores

**Gate Fase 3:** `npm run build` passa

### Fase 4: Routing e Integration

**Agente 4A — Routing**
- Rota `/auditoria-geral` no AppRouter
- Tile no Hub
- Barrel exports

**Gate Fase 4:** `npm run build` passa + app carrega

### Fase 5: Cloud Function PDF

**Agente 5A — PDF Generator**
- `functions/src/callables/auditoriaGeral/generateAuditoriaGeralPDF.ts`
- Layout premium: header, scores, tabela, gráfico, assinaturas
- Registrar no `functions/src/index.ts`

**Gate Fase 5:** `cd functions && npx tsc --noEmit` passa

### Fase 6: Deploy

1. `npx tsc --noEmit` (client)
2. `npm run build` (client)
3. `cd functions && npx tsc --noEmit` (functions)
4. `firebase deploy --only firestore:rules --project hmatologia2`
5. `firebase deploy --only functions:generateAuditoriaGeralPDF --project hmatologia2`
6. `firebase deploy --only hosting --project hmatologia2`

**Gate Final:** App abre, criar auditoria, responder, finalizar, PDF baixa.

---

## Permissões Concedidas

- Criar/editar arquivos em `src/features/auditoria-geral/`
- Criar/editar arquivos em `functions/src/callables/auditoriaGeral/`
- Editar `functions/src/index.ts` (registrar callable)
- Editar `firestore.rules` (adicionar regras)
- Editar router/App (adicionar rota)
- Editar `src/constants.ts` (hub tile)
- Rodar `npx tsc --noEmit`
- Rodar `npm run build`
- Rodar `firebase deploy` (rules, functions, hosting)
- Instalar dependências se necessário

---

## Critérios de Aceite — Onda 1

1. Wizard funcional com 57 indicadores em 12 blocos
2. Escala 0-5 com descrições visíveis por indicador
3. Salvar progresso (sair e voltar)
4. Score calculado por bloco e total (%)
5. Dashboard com lista de auditorias e status
6. PDF executivo premium gerado via Cloud Function
7. Design dark-first, world-class (Apple/Linear reference)
8. Zero dependência do módulo auditoria-interna
9. Deploy completo sem erros
10. Multi-tenant (labId scoped)