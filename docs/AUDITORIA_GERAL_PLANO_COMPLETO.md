# AUDITORIA GERAL — Plano Completo de Implementação

**Data:** 2026-05-14
**Autor:** Claude (multiagente)
**Módulo:** `auditoria-geral`
**Substitui:** `auditoria-interna` (será removido após validação completa)
**Stack:** React 19 + TypeScript 5.8 + Vite 6 + Zustand 5 + Firebase 12 + Tailwind
**Region:** southamerica-east1
**Projeto Firebase:** hmatologia2

---

## 1. VISÃO GERAL

### O que é

Módulo de auditoria interna laboratorial baseado no **Formulário 044** (FR-044) com 57 indicadores da **RDC 978/2025 ANVISA**. Permite ao laboratório executar auditorias internas periódicas, pontuar cada indicador numa escala de 0 a 5, calcular scores por bloco e geral, e gerar relatório PDF executivo premium para arquivamento e envio a auditores externos.

### Por que reescrever do zero

O módulo `auditoria-interna` acumulou complexidade (callables, re-auditoria, chain de NCs, qualificação de auditores, IA) que gerou problemas de deploy irrecuperáveis em 24h. A decisão é criar um módulo novo, limpo, incremental — validando cada onda antes de avançar.

### Princípios

1. **Incremental** — cada onda funciona sozinha e deploya limpo
2. **Simples** — sem over-engineering, sem abstrações prematuras
3. **Independente** — zero import do auditoria-interna
4. **Multi-tenant** — tudo scoped a labId
5. **Dark-first** — UI world-class (Apple/Linear/Stripe reference)
6. **Regulatório** — fiel ao FR-044 e RDC 978/2025

---

## 2. FONTE DE DADOS — Formulário 044

### Estrutura de cada indicador

```
{
  numero: 1-57,
  indicador: "Nome do indicador",
  bloco: "A" | "B" | ... | "L",
  categoria: "documentacao-legal" | "contratos" | etc,
  marcoRegulatorio: "Art. XX da RDC 978/2025",
  niveis: {
    0: "Descrição do nível 0 (pior situação)",
    1: "Descrição do nível 1",
    2: "Descrição do nível 2",
    3: "Descrição do nível 3 (conformidade mínima)",
    4: "Descrição do nível 4",
    5: "Descrição do nível 5 (excelência)"
  }
}
```

### Agrupamento em 12 Blocos

| Bloco | Nome                            | Indicadores | Qtd | Módulos HC Quality relacionados                     |
| ----- | ------------------------------- | ----------- | --- | --------------------------------------------------- |
| A     | Documentação Legal e Governança | 1-5         | 5   | sgd, labSettings                                    |
| B     | Contratos e Terceirização       | 6-9         | 4   | fornecedores, lab-apoio                             |
| C     | Tecnologias e Equipamentos      | 10-14       | 5   | equipamentos, notivisa                              |
| D     | Risco e Documentos              | 15-16       | 2   | risks, sgd, sgq                                     |
| E     | Pessoal e Educação              | 17-19       | 3   | treinamentos, educacao-continuada                   |
| F     | Infraestrutura e Ambiente       | 20-28       | 9   | pgrss, controle-temperatura, insumos, biosseguranca |
| G     | Sistemas e Biossegurança        | 29-32       | 4   | biosseguranca                                       |
| H     | Procedimentos e Rastreabilidade | 33-35       | 3   | sgq, pops                                           |
| I     | Fase Pré-Analítica              | 36-42       | 7   | —                                                   |
| J     | Fase Analítica                  | 43-48       | 6   | criticos, bioquimica                                |
| K     | Fase Pós-Analítica e Laudos     | 49-51       | 3   | laudo-ocr                                           |
| L     | Controle da Qualidade (CIQ/CEQ) | 52-57       | 6   | runs, ceq, lots                                     |

---

## 3. ARQUITETURA FIRESTORE

### Coleção principal

```
/auditoria-geral/{labId}/auditorias/{auditoriaId}
```

### Documento da Auditoria

```typescript
{
  id: string; // auto-generated
  labId: string; // multi-tenant (redundante)
  titulo: string; // ex: "Auditoria Interna 2026-S1"
  status: 'rascunho' | 'em_andamento' | 'finalizada';
  auditor: {
    uid: string;
    nome: string;
  }
  dataInicio: Timestamp;
  dataFim: Timestamp | null;
  blocoAtual: string; // último bloco visitado (para retomar)
  scoreTotal: number; // 0-100 (percentual)
  scoresPorBloco: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
    G: number;
    H: number;
    I: number;
    J: number;
    K: number;
    L: number;
  }
  totalRespondidos: number; // 0-57
  totalNaoAplica: number; // quantos marcados N/A
  criadoEm: Timestamp;
  criadoPor: string;
  deletadoEm: Timestamp | null; // soft-delete (RN-06)
}
```

### Subcoleção de Respostas

```
/auditoria-geral/{labId}/auditorias/{auditoriaId}/respostas/{indicadorId}
```

```typescript
{
  id: string; // "ind-01" a "ind-57"
  numero: number; // 1-57
  indicador: string; // nome do indicador
  bloco: string; // "A"-"L"
  score: number | null; // 0-5 ou null (não respondido)
  naoAplica: boolean; // true = não conta no cálculo
  observacoes: string; // campo livre
  respondidoEm: Timestamp | null;
  respondidoPor: string | null;
}
```

### Firestore Rules

```javascript
match /auditoria-geral/{labId}/auditorias/{auditoriaId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create: if isActiveMemberOfLab(labId) &&
                   request.resource.data.labId == labId &&
                   request.resource.data.status == 'rascunho';
  allow update: if isActiveMemberOfLab(labId) &&
                   resource.data.labId == labId &&
                   request.resource.data.deletadoEm == resource.data.deletadoEm;
  allow delete: if false; // soft-delete only

  match /respostas/{respostaId} {
    allow read: if isActiveMemberOfLab(labId);
    allow create, update: if isActiveMemberOfLab(labId);
    allow delete: if false;
  }
}
```

---

## 4. TIPOS TYPESCRIPT

### types/index.ts

```typescript
import type { Timestamp } from 'firebase/firestore';

// Status da auditoria
export type StatusAuditoria = 'rascunho' | 'em_andamento' | 'finalizada';

// Blocos do wizard
export type BlocoId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

// Auditor
export interface Auditor {
  uid: string;
  nome: string;
}

// Scores por bloco
export type ScoresPorBloco = Record<BlocoId, number>;

// Entidade principal
export interface AuditoriaGeral {
  readonly id: string;
  readonly labId: string;
  titulo: string;
  status: StatusAuditoria;
  auditor: Auditor;
  dataInicio: Timestamp;
  dataFim: Timestamp | null;
  blocoAtual: BlocoId;
  scoreTotal: number;
  scoresPorBloco: ScoresPorBloco;
  totalRespondidos: number;
  totalNaoAplica: number;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

// Input para criação (sem campos auto-gerados)
export type AuditoriaGeralInput = Omit<
  AuditoriaGeral,
  | 'id'
  | 'labId'
  | 'criadoEm'
  | 'criadoPor'
  | 'deletadoEm'
  | 'scoreTotal'
  | 'scoresPorBloco'
  | 'totalRespondidos'
  | 'totalNaoAplica'
  | 'blocoAtual'
  | 'dataFim'
>;

// Resposta individual
export interface RespostaIndicador {
  readonly id: string;
  numero: number;
  indicador: string;
  bloco: BlocoId;
  score: number | null;
  naoAplica: boolean;
  observacoes: string;
  respondidoEm: Timestamp | null;
  respondidoPor: string | null;
}

// Indicador estático (data file)
export interface Indicador {
  id: string;
  numero: number;
  indicador: string;
  bloco: BlocoId;
  categoria: string;
  marcoRegulatorio: string;
  moduloVinculado: string | null;
  niveis: Record<number, string>; // 0-5
}

// Bloco metadata
export interface BlocoMeta {
  id: BlocoId;
  nome: string;
  indicadores: number[]; // números dos indicadores neste bloco
}
```

---

## 5. ESTRUTURA DE ARQUIVOS

```
src/features/auditoria-geral/
│
├── index.ts                          # Barrel export
│
├── types/
│   └── index.ts                      # Tipos acima
│
├── data/
│   ├── indicadores.ts                # Array com 57 indicadores + níveis 0-5
│   └── blocos.ts                     # Metadata dos 12 blocos
│
├── services/
│   └── auditoriaGeralService.ts      # CRUD Firestore
│
├── hooks/
│   ├── useAuditoriaGeral.ts          # onSnapshot single auditoria + respostas
│   ├── useAuditoriasGeral.ts         # onSnapshot lista de auditorias
│   └── useScoreCalculator.ts         # Cálculo reativo de scores
│
├── components/
│   ├── AuditoriaGeralPage.tsx        # Entry point (route)
│   ├── AuditoriasDashboard.tsx       # Lista + KPIs + botão criar
│   ├── NovaAuditoriaDialog.tsx       # Modal criar nova auditoria
│   ├── WizardAuditoria.tsx           # Container wizard (state machine)
│   ├── WizardBlocoStep.tsx           # Step individual (lista indicadores do bloco)
│   ├── IndicadorCard.tsx             # Card de cada indicador
│   ├── ScoreSelector.tsx             # Seletor visual 0-5
│   ├── ProgressBar.tsx               # Barra de progresso do wizard
│   ├── ResumoAuditoria.tsx           # Tela final com scores
│   └── ScoreBlocoChart.tsx           # Gráfico radar/bar por bloco
│
└── utils/
    └── scoreUtils.ts                 # Funções de cálculo

functions/src/callables/auditoriaGeral/
└── generateAuditoriaGeralPDF.ts      # Cloud Function PDF premium
```

---

## 6. SERVICE — CRUD DETALHADO

### auditoriaGeralService.ts

```typescript
// Métodos:

createAuditoria(labId, input: AuditoriaGeralInput): Promise<string>
  - Cria doc em /auditoria-geral/{labId}/auditorias/
  - Inicializa 57 respostas na subcoleção (batch write)
  - Status inicial: 'rascunho'
  - Retorna auditoriaId

getAuditoria(labId, auditoriaId): Promise<AuditoriaGeral | null>
  - Leitura single doc

listAuditorias(labId): Query
  - Query ordenada por criadoEm DESC
  - Filtro: deletadoEm == null

saveResposta(labId, auditoriaId, indicadorId, data): Promise<void>
  - Atualiza doc na subcoleção respostas
  - Atualiza respondidoEm + respondidoPor

saveBlocoRespostas(labId, auditoriaId, respostas[]): Promise<void>
  - Batch write de todas respostas do bloco atual
  - Atualiza blocoAtual no doc pai
  - Recalcula scores

finalizarAuditoria(labId, auditoriaId): Promise<void>
  - Valida: todos indicadores respondidos (ou N/A)
  - Calcula scoreTotal e scoresPorBloco final
  - Seta status = 'finalizada', dataFim = now

softDeleteAuditoria(labId, auditoriaId): Promise<void>
  - Seta deletadoEm = now (RN-06)
```

---

## 7. HOOKS DETALHADOS

### useAuditoriaGeral(labId, auditoriaId)

```typescript
// Retorna:
{
  auditoria: AuditoriaGeral | null;
  respostas: RespostaIndicador[];
  loading: boolean;
  error: string | null;
}
// Implementação: onSnapshot no doc + onSnapshot na subcoleção respostas
// Cleanup: unsubscribe em useEffect return
```

### useAuditoriasGeral(labId)

```typescript
// Retorna:
{
  auditorias: AuditoriaGeral[];
  loading: boolean;
  error: string | null;
}
// Implementação: onSnapshot com where('deletadoEm', '==', null)
// Ordenação: criadoEm DESC
```

### useScoreCalculator(respostas: RespostaIndicador[])

```typescript
// Retorna:
{
  scoreTotal: number;           // 0-100%
  scoresPorBloco: ScoresPorBloco;
  totalRespondidos: number;
  totalNaoAplica: number;
  indicadoresAbaixo3: number[]; // números dos indicadores com score < 3
}
// Cálculo:
// - Ignora N/A no denominador
// - scoreBloco = (soma scores do bloco) / (qtd indicadores respondidos * 5) * 100
// - scoreTotal = média ponderada dos blocos (peso = qtd indicadores)
```

---

## 8. COMPONENTES UI — DETALHAMENTO

### AuditoriaGeralPage.tsx

- Entry point da rota `/auditoria-geral`
- Verifica auth + labId
- Renderiza Dashboard ou Wizard dependendo do state
- Botão voltar ao Hub

### AuditoriasDashboard.tsx

- Header com título + botão "Nova Auditoria"
- KPIs: total auditorias, finalizadas, em andamento, score médio
- Lista de auditorias em cards:
  - Título, auditor, data, status (badge colorido)
  - Score total (progress ring)
  - Ações: continuar (se rascunho/em_andamento), ver resumo (se finalizada), gerar PDF
- Empty state quando não há auditorias

### NovaAuditoriaDialog.tsx

- Modal com campos:
  - Título (sugestão automática: "Auditoria Interna YYYY-SN")
  - Auditor (dropdown com membros do lab)
- Botão criar → chama createAuditoria → navega para wizard

### WizardAuditoria.tsx

- Container principal do wizard
- State: blocoAtual, respostas locais (otimistic)
- Header fixo: título da auditoria + ProgressBar
- Navegação: Anterior / Próximo / Finalizar (último bloco)
- Auto-save ao trocar de bloco (saveBlocoRespostas)
- Botão "Salvar e Sair" (volta ao dashboard)

### WizardBlocoStep.tsx

- Recebe: bloco metadata + indicadores do bloco + respostas
- Header do bloco: nome, descrição, progresso (X/Y respondidos)
- Lista de IndicadorCards
- Scroll vertical

### IndicadorCard.tsx

- Card dark com:
  - Número + nome do indicador
  - Marco regulatório (badge pequeno)
  - ScoreSelector (0-5)
  - Toggle "Não se Aplica"
  - Campo observações (textarea colapsável)
  - Indicador visual de status (respondido/pendente)

### ScoreSelector.tsx

- 6 botões (0-5) em linha horizontal
- Cores graduais: 0=vermelho, 1=laranja, 2=amarelo, 3=azul, 4=verde-claro, 5=verde
- Ao selecionar: expande descrição do nível escolhido
- Hover: tooltip com descrição do nível
- Estado selecionado: botão preenchido + borda accent

### ProgressBar.tsx

- Barra horizontal com 12 segmentos (blocos A-L)
- Cada segmento: cinza (não visitado), amarelo (parcial), verde (completo)
- Label: "Bloco X de 12 — Nome do Bloco"
- Clicável para navegar direto a um bloco

### ResumoAuditoria.tsx

- Tela final após responder todos os blocos
- Score total grande (circular, animado)
- ScoreBlocoChart (gráfico)
- Lista de indicadores com score < 3 (atenção)
- Botões: "Finalizar Auditoria" / "Revisar" / "Gerar PDF"

### ScoreBlocoChart.tsx

- Gráfico de barras horizontais (um por bloco)
- Cores: vermelho (<50%), amarelo (50-70%), verde (>70%)
- Labels: nome do bloco + percentual
- Alternativa: gráfico radar (12 eixos)

---

## 9. CLOUD FUNCTION — PDF EXECUTIVO PREMIUM

### generateAuditoriaGeralPDF.ts

**Trigger:** Callable (httpsCallable)
**Input:** `{ labId: string, auditoriaId: string }`
**Output:** `{ url: string }` (signed URL do PDF no Storage)

### Layout do PDF (A4, portrait)

```
┌─────────────────────────────────────────────────┐
│  [LOGO]    RELATÓRIO DE AUDITORIA INTERNA       │
│            Laboratório: {nome}                   │
│            Data: {dataInicio} - {dataFim}        │
│            Auditor: {nome}                       │
│            Status: FINALIZADA                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  SCORE GERAL: ██████████░░ 78%                  │
│                                                  │
│  SCORES POR BLOCO:                              │
│  A - Doc. Legal ........... ████████░░ 80%      │
│  B - Contratos ............ ██████░░░░ 60%      │
│  C - Tecnologias .......... █████████░ 90%      │
│  ...                                            │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  DETALHAMENTO POR INDICADOR                     │
│                                                  │
│  BLOCO A — Documentação Legal e Governança      │
│  ┌───┬──────────────────────┬───────┬────────┐  │
│  │ # │ Indicador            │ Score │ Status │  │
│  ├───┼──────────────────────┼───────┼────────┤  │
│  │ 1 │ Alvará Licenciamento │  4/5  │   ✓    │  │
│  │ 2 │ Inscrição CNES       │  5/5  │   ✓    │  │
│  │ 3 │ PBA e Memorial       │  3/5  │   ✓    │  │
│  │ 4 │ Responsável Técnico  │  2/5  │   ⚠    │  │
│  │ 5 │ EAC Itinerante       │  N/A  │   —    │  │
│  └───┴──────────────────────┴───────┴────────┘  │
│                                                  │
│  BLOCO B — Contratos e Terceirização            │
│  ...                                            │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  INDICADORES COM ATENÇÃO (Score ≤ 2)            │
│  • #4 Responsável Técnico — Score 2/5           │
│    Marco: Art. 64 RDC 978/2025                  │
│    Obs: "RT sem substituto designado"           │
│  • #15 Gerenciamento de Risco — Score 1/5       │
│    ...                                          │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  CONFORMIDADE REGULATÓRIA                       │
│  Base: RDC 978/2025 ANVISA                      │
│  Indicadores conformes (≥3): 48/57 (84%)        │
│  Indicadores não-conformes (<3): 7/57           │
│  Não aplicáveis: 2/57                           │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ASSINATURAS                                    │
│                                                  │
│  Auditor: ________________  Data: ___/___/___   │
│  RT:      ________________  Data: ___/___/___   │
│                                                  │
│  Documento gerado em: {timestamp}               │
│  Hash: {sha256 do conteúdo}                     │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Implementação técnica

- Usa **PDFKit** (já disponível no projeto functions)
- Fontes: Helvetica (padrão PDFKit) ou Inter (embed)
- Cores: dark header (#1a1a2e), accent violet (#7c3aed), green (#10b981), red (#ef4444)
- Gráfico de barras: renderizado com primitivas PDFKit (rect + text)
- Storage path: `labs/{labId}/auditoria-geral/pdfs/{auditoriaId}.pdf`
- Signed URL: 7 dias de validade

---

## 10. INTEGRAÇÃO COM NÃO CONFORMIDADES (Onda 1b)

### Fluxo

```
Indicador score ≤ 2
    ↓
Botão "Abrir NC" aparece no IndicadorCard
    ↓
Usuário clica → cria NC em /labs/{labId}/naoConformidades/
    ↓
NC criada com:
  - origem: 'auditoria'
  - auditoriaId: id da auditoria-geral
  - moduloOrigem: 'auditoria-geral'
  - titulo: "NC — {nome do indicador}"
  - descricao: "Indicador #{numero} com score {score}/5. {observacoes}"
  - severidade: score 0-1 → 'critica', score 2 → 'grave'
    ↓
Badge "NC Aberta" aparece no IndicadorCard
Dashboard mostra contador de NCs
```

### Tipo NaoConformidade existente (já suporta)

```typescript
// Em /labs/{labId}/naoConformidades/{ncId}
{
  origem: 'auditoria',        // ← já existe no tipo
  auditoriaId: string,        // ← já existe no tipo
  moduloOrigem: 'auditoria-geral',
  severidade: 'critica' | 'grave',
  capaStatus: 'nao_iniciada', // workflow CAPA já funciona
}
```

---

## 11. DESIGN SYSTEM — UI SPECS

### Paleta (dark-first)

```
Background:     #0c0c0c (page), #141417 (cards), #1c1c21 (elevated)
Text:           white/90 (primary), white/60 (secondary), white/40 (muted)
Accent:         violet-500 (#8b5cf6) — ações primárias
Success:        emerald-500 (#10b981) — scores altos
Warning:        amber-500 (#f59e0b) — scores médios
Danger:         red-500 (#ef4444) — scores baixos
Border:         white/10 (subtle), white/20 (hover)
```

### Score Colors (0-5)

```
0: #ef4444 (red-500)     — Crítico
1: #f97316 (orange-500)  — Muito baixo
2: #f59e0b (amber-500)   — Baixo
3: #3b82f6 (blue-500)    — Conforme mínimo
4: #10b981 (emerald-500) — Bom
5: #059669 (emerald-600) — Excelente
```

### Componentes visuais

- Cards: `bg-[#141417] border border-white/10 rounded-xl p-4`
- Botões primários: `bg-violet-600 hover:bg-violet-500 text-white rounded-lg`
- Badges: `px-2 py-0.5 rounded-full text-xs font-medium`
- Progress rings: SVG circular com stroke-dasharray animado
- Transições: `transition-all duration-150`

---

## 12. FLUXO DE USUÁRIO (UX)

### Fluxo principal

```
Hub → Tile "Auditoria Geral"
  ↓
Dashboard (lista de auditorias)
  ↓ [botão "Nova Auditoria"]
Modal: título + auditor
  ↓ [criar]
Wizard Step 1 (Bloco A)
  ↓ [responde indicadores 1-5]
Wizard Step 2 (Bloco B)
  ↓ [responde indicadores 6-9]
  ... (12 steps total)
  ↓
Wizard Step 12 (Bloco L)
  ↓ [próximo]
Resumo Final
  ↓ [Finalizar]
Auditoria finalizada → Dashboard atualizado
  ↓ [Gerar PDF]
PDF baixa / abre em nova aba
```

### Fluxo de retomada

```
Dashboard → card "Em andamento"
  ↓ [botão "Continuar"]
Wizard abre no último bloco visitado (blocoAtual)
  ↓ [respostas anteriores já preenchidas]
Continua de onde parou
```

---

## 13. PLANO DE EXECUÇÃO MULTIAGENTE

### Fase 1: Foundation (paralelo — 3 agentes)

| Agente | Responsabilidade     | Arquivos                                                                           | Verificação            |
| ------ | -------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| 1A     | Types + Data + Utils | types/index.ts, data/indicadores.ts, data/blocos.ts, utils/scoreUtils.ts, index.ts | tsc --noEmit           |
| 1B     | Service CRUD         | services/auditoriaGeralService.ts                                                  | tsc --noEmit           |
| 1C     | Firestore Rules      | firestore.rules (adicionar bloco)                                                  | firebase rules compile |

**Gate:** `npx tsc --noEmit` passa sem erros

### Fase 2: Hooks (sequencial — depende da Fase 1)

| Agente | Responsabilidade | Arquivos                                                                             | Verificação  |
| ------ | ---------------- | ------------------------------------------------------------------------------------ | ------------ |
| 2A     | Todos os hooks   | hooks/useAuditoriaGeral.ts, hooks/useAuditoriasGeral.ts, hooks/useScoreCalculator.ts | tsc --noEmit |

**Gate:** `npx tsc --noEmit` passa sem erros

### Fase 3: UI (paralelo — 3 agentes)

| Agente | Responsabilidade                     | Arquivos                                                                       | Verificação  |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------ | ------------ |
| 3A     | Page + Dashboard + Dialog            | AuditoriaGeralPage.tsx, AuditoriasDashboard.tsx, NovaAuditoriaDialog.tsx       | tsc --noEmit |
| 3B     | Wizard (container + step + progress) | WizardAuditoria.tsx, WizardBlocoStep.tsx, ProgressBar.tsx                      | tsc --noEmit |
| 3C     | Indicador + Score + Resumo + Chart   | IndicadorCard.tsx, ScoreSelector.tsx, ResumoAuditoria.tsx, ScoreBlocoChart.tsx | tsc --noEmit |

**Gate:** `npm run build` passa sem erros

### Fase 4: Routing (sequencial)

| Agente | Responsabilidade          | Arquivos                                            | Verificação                 |
| ------ | ------------------------- | --------------------------------------------------- | --------------------------- |
| 4A     | Rota + Hub tile + exports | AppRouter/AuthWrapper, constants.ts, barrel exports | npm run build + app carrega |

**Gate:** `npm run build` passa + app renderiza no browser

### Fase 5: Cloud Function PDF (independente)

| Agente | Responsabilidade       | Arquivos                                                                                    | Verificação                      |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| 5A     | PDF Generator callable | functions/src/callables/auditoriaGeral/generateAuditoriaGeralPDF.ts, functions/src/index.ts | cd functions && npx tsc --noEmit |

**Gate:** Functions compila sem erros

### Fase 6: Deploy (sequencial, com autorização)

```
1. npx tsc --noEmit                                          ← client type-check
2. npm run build                                             ← client build
3. cd functions && npx tsc --noEmit                          ← functions type-check
4. firebase deploy --only firestore:rules --project hmatologia2
5. firebase deploy --only functions:generateAuditoriaGeralPDF --project hmatologia2
6. firebase deploy --only hosting --project hmatologia2
```

**Gate Final:** App em produção, fluxo completo funciona.

---

## 14. PERMISSÕES CONCEDIDAS (execução autônoma)

| Ação                                                      | Permitido |
| --------------------------------------------------------- | --------- |
| Criar/editar em `src/features/auditoria-geral/`           | SIM       |
| Criar/editar em `functions/src/callables/auditoriaGeral/` | SIM       |
| Editar `functions/src/index.ts`                           | SIM       |
| Editar `firestore.rules`                                  | SIM       |
| Editar router/AuthWrapper                                 | SIM       |
| Editar `src/constants.ts`                                 | SIM       |
| Rodar `npx tsc --noEmit`                                  | SIM       |
| Rodar `npm run build`                                     | SIM       |
| Rodar `firebase deploy`                                   | SIM       |
| Instalar dependências                                     | SIM       |
| Tocar módulo `auditoria-interna`                          | NAO       |
| Tocar módulos protegidos (auth, admin, shared)            | NAO       |

---

## 15. CRITÉRIOS DE ACEITE

### Onda 1 — MVP

| #   | Critério                                         | Como verificar                                |
| --- | ------------------------------------------------ | --------------------------------------------- |
| 1   | Wizard funcional com 57 indicadores em 12 blocos | Navegar todos os blocos                       |
| 2   | Escala 0-5 com descrições visíveis               | Clicar em cada nível, ver descrição           |
| 3   | Salvar progresso (sair e voltar)                 | Sair no bloco 5, reabrir, verificar respostas |
| 4   | Score calculado por bloco e total                | Responder tudo, verificar cálculo             |
| 5   | Dashboard com lista e status                     | Ver cards com status correto                  |
| 6   | PDF executivo premium                            | Gerar PDF, verificar layout                   |
| 7   | Design dark-first world-class                    | Inspeção visual                               |
| 8   | Zero dependência auditoria-interna               | grep import auditoria-interna = 0             |
| 9   | Deploy sem erros                                 | Acessar hmatologia2.web.app                   |
| 10  | Multi-tenant                                     | Testar com 2 labs diferentes                  |

### Onda 1b — NCs

| #   | Critério                      | Como verificar         |
| --- | ----------------------------- | ---------------------- |
| 11  | Botão "Abrir NC" em score ≤ 2 | Dar score 1, ver botão |
| 12  | NC criada com origem correta  | Verificar no Firestore |
| 13  | Badge "NC Aberta" no card     | Verificar visual       |
| 14  | Contador NCs no dashboard     | Verificar número       |

---

## 16. RISCOS E MITIGAÇÕES

| Risco                                               | Probabilidade | Impacto | Mitigação                          |
| --------------------------------------------------- | ------------- | ------- | ---------------------------------- |
| Arquivo indicadores.ts muito grande (57 × 6 níveis) | Alta          | Baixo   | Lazy load por bloco no wizard      |
| PDF timeout em functions (muitos dados)             | Média         | Médio   | Timeout 120s, otimizar rendering   |
| Conflito de rules com regras existentes             | Baixa         | Alto    | Bloco isolado, testar com emulator |
| Bundle size increase                                | Baixa         | Baixo   | React.lazy na rota                 |
| Perda de dados ao trocar bloco                      | Média         | Alto    | Auto-save a cada resposta          |

---

## 17. CRONOGRAMA ESTIMADO

| Fase                | Duração estimada | Dependência |
| ------------------- | ---------------- | ----------- |
| Fase 1 (Foundation) | ~30 min          | Nenhuma     |
| Fase 2 (Hooks)      | ~15 min          | Fase 1      |
| Fase 3 (UI)         | ~45 min          | Fase 2      |
| Fase 4 (Routing)    | ~10 min          | Fase 3      |
| Fase 5 (PDF)        | ~30 min          | Fase 1      |
| Fase 6 (Deploy)     | ~15 min          | Fases 4+5   |
| **Total Onda 1**    | **~2.5h**        | —           |
| Onda 1b (NCs)       | ~30 min          | Onda 1      |

---

## 18. REFERÊNCIAS REGULATÓRIAS

- **RDC 978/2025 ANVISA** — Requisitos técnico-sanitários para EAC
- **DICQ/SBAC 8a Ed.** — Acreditação voluntária (ISO 15189)
- **Formulário 044** — Checklist de auditoria interna (57 indicadores)
- **PQ-038** — Procedimento de Qualidade: Auditoria Interna

---

## 19. DECISÕES FUTURAS (não implementar agora)

- Qualificação de auditores (Onda 4)
- Gravação de áudio + transcrição Gemini (Onda 3)
- Links de comprovação com módulos (Onda 3)
- Comparativo entre auditorias (Onda 3)
- Plano de ação CAPA integrado (Onda 4)
- IA summary executivo (Onda 4)
- Offline-first (Onda futura)
- Mobile nativo (Onda futura)

```

```
