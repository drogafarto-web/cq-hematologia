# Phase 9: Bioquímica — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Discuss-phase inline (4 perguntas críticas) + síntese Obsidian + roadmap v1.3

<domain>
## Phase Boundary

**O que esta phase entrega:**

Módulo `bioquimica` em produção cobrindo CIQ quantitativo para 16 analitos seed (Glicose, Ureia, Creatinina, TGO, TGP, FA, GGT, BT-D, BT-I, CT, HDL, LDL, TG, Na, K, Cl, Ca) + UI admin para o lab cadastrar/editar analitos próprios.

Suporta multi-instrumento desde o dia 1 (vínculo de bulas a múltiplos equipamentos via `/equipamentos`), parsing de bula via Gemini Vision (replicado de hematologia), Levey-Jennings com toggle bula/interna, validação Westgard subset CLSI (1-2s, 1-3s, 2-2s, R-4s), e rastreabilidade Worklab append-only (sem integração LIS externa).

**O que NÃO entrega (deferido):**

- CEQ comparison (vai pelo Importador PNCQ no v1.4)
- Comparabilidade entre equipamentos (DICQ 5.6.4 — ativa quando 2+ equipos em prod)
- Integração LIS externa (Worklab/Criasoft) — vira spike v1.4
- Westgard regras avançadas (4-1s, 10x, 6T, 6X) — ativáveis em v1.4 por analito
- OCR de strip imuno via IA — milestone separado (v1.5+)

**Compliance alvo:**

- RDC 978/2025 Arts. 179, 180, 181, 167, 183
- DICQ 4.3 — Bloco F (Analítico): 5.5.1.1, 5.5.1.3, 5.5.2, 5.6.2, 5.6.3.1, 5.6.4 (parcial — full em v1.4)
- CLSI EP15 (subset Westgard)
- ISO 15189 (rastreabilidade + validação)

</domain>

<decisions>
## Implementation Decisions

### Locked (CTO via discuss-phase 2026-05-06)

#### 1. Engine Westgard

- **Subset CLSI clássico:** 4 regras
  - `1-2s` — warning (não bloqueia run)
  - `1-3s` — reject
  - `2-2s` — reject (2 runs consecutivas mesmo lado)
  - `R-4s` — reject (range 4s entre 2 runs consecutivas)
- Implementação: novo arquivo `src/features/bioquimica/utils/westgardRulesCLSI.ts` (NÃO reaproveitar `westgardRules.ts` de hematologia diretamente — fork enxuto pra evitar regressão hema)
- Avaliação por analito por equipamento (multi-instrumento desde dia 1)
- Regras 4-1s, 10x, 6T, 6X ficam definidas em código mas com flag `enabled: false` por default — ativáveis em v1.4 por analito via UI admin

#### 2. Painel de analitos

- **16 analitos seed** carregados via Cloud Function callable `seedBioquimicaDefaults` (idempotente, escopado por labId):
  - Painel básico: Glicose, Ureia, Creatinina
  - Painel hepático: TGO, TGP, FA, GGT, BT-Direta, BT-Indireta
  - Painel lipídico: CT, HDL, LDL, TG
  - Eletrólitos: Na, K, Cl, Ca
- **UI admin obrigatória:** lab pode adicionar/editar analitos próprios
  - Campos: nome, unidade (mg/dL, U/L, mmol/L, etc), unidade SI opcional, range biológico (min/max), método (espectrofotometria, ISE, etc), CV alvo (%), ativo (bool)
  - Soft-delete only (RN-06)
  - Override: lab pode customizar o seed (ex: alterar unidade Glicose de mg/dL para mmol/L sem refazer release)

#### 3. Multi-instrumento (dia 1)

- Bula é vinculada a 1+ equipamentos via `equipmentIds: string[]`
- Cada `Run` declara `equipmentId: string` (obrigatório)
- Stats e Westgard avaliados por **par analito × equipamento**
- Levey-Jennings: chart pode sobrepor curvas de equipamentos diferentes (toggle "compare mode")
- Schema `/equipamentos` já existe — reusar diretamente; adicionar campo `analytics: { bioquimica: boolean }` se necessário

#### 4. Stats source

- **Bula PDF** (oficial primário) — Gemini Vision parse via `parseBulaBioquimica` callable
  - Reuso direto do BulaProcessor de hematologia
  - Validação Zod no servidor (campos obrigatórios: lote, validade, analitos com mean/sd por nível)
  - 1-3 níveis de controle por bula (typically Normal + Patológico)
- **Stats internas** — calculadas após N=20 runs em cada par analito × equipamento × nível
  - Mean/sd via Bessel (`n-1`)
  - Toggle UI: "Estatística do fabricante" ↔ "Estatística interna"
  - Gate: interna não substitui bula até atingir N=20 (mostra "calculando..." com counter)
- **Sem bula:** lote pode ser cadastrado em modo `bulaPendente: true` com stats nulas. Westgard suspenso até `applyBulaToLot` ou atingir N=20 interno.

#### 5. Rastreabilidade Worklab

- **Append-only** em `/labs/{labId}/bioquimica/{equipmentId}/traceability-events/{eventId}`
- Cada run dispara um evento com:
  - `runId`, `equipmentId`, `analitoIds[]`, `lotId`, `operatorId`
  - `examCodeAtChange?: string` — código do exame Worklab no momento (manual entry no MVP)
  - `signature: LogicalSignature` — hash 64 + operatorId + ts
- Rules: `allow create: if validSignature(d) && labIdMatches(d)`, `allow update, delete: if false`
- Sem integração externa LIS no v1.3 — campo `examCodeAtChange` é manual (autocomplete por histórico recente)
- Cloud Function `recordTraceabilityEvent` é a única forma de write (client tem só `subscribe*`)

#### 6. Replicação direta de Hematologia (sem reinventar)

| Componente            | Origem hematologia                       | Adaptação para bioquímica                                                                      |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `subscribeToState`    | `src/shared/services/firebaseService.ts` | Reusar diretamente; adicionar layer `bioquimica`                                               |
| `BulaProcessor.tsx`   | `src/features/analyzer/components/`      | Fork em `src/features/bioquimica/components/` — schema diferente (analitos vs parâmetros hema) |
| `AddLotModal.tsx`     | `src/features/analyzer/components/`      | Fork — 3 caminhos (Bula PDF / sem bula ≤7d / avulso); adicionar `EquipamentoMultiselect`       |
| `LotManager.tsx`      | `src/features/analyzer/components/`      | Fork — estados EM USO / DISPONÍVEIS / HISTÓRICO inalterados                                    |
| `ReviewRunModal.tsx`  | `src/features/analyzer/components/`      | Fork — tabela analitos editável, violations chips, override auditado                           |
| `PreFlightCheck.tsx`  | `src/features/analyzer/components/`      | Fork — 3/3 controles + reagentes OK + equipamento ativo                                        |
| `useChartData.ts`     | `src/features/chart/hooks/`              | Fork — Levey-Jennings com multi-equipamento overlay                                            |
| `insumoValidation.ts` | `src/features/insumos/utils/`            | Reusar diretamente (`validateReagentesForRun`)                                                 |

**Princípio de fork vs reuso:**

- **Fork** (cópia adaptada): componentes UI específicos da bioquímica (BulaProcessor, AddLotModal, etc) — evita regressão em hematologia
- **Reuso** (import direto): utils puros (insumoValidation, subscribeToState) — código testado e estável

#### 7. Schema Firestore

```
/labs/{labId}/bioquimica/
  config/                     # singleton: enabled, seededAt
  analitos/{analitoId}        # 16 seed + custom labs
  equipamentos-config/{eqId}  # bind opcional (analytics flag)
  lotes/{lotId}               # ControlMaterialBioquimica
  runs/{runId}                # Run com violations[]
  traceability-events/{eventId}  # append-only
  audit/{logId}               # append-only audit trail
```

**Convenções multi-tenant aplicadas (RN-06, validSignature, labIdMatches, keepsLabId):**

- `labId` redundante no payload de cada doc
- Soft-delete only (`deletadoEm: timestamp | null`)
- LogicalSignature obrigatório em create de runs e events
- `allow delete: if false` em runs, lotes, traceability-events
- Indexes compostos: `(labId, analitoId, criadoEm)`, `(labId, equipmentId, status, criadoEm)`, `(labId, lotId, criadoEm)`

#### 8. Cloud Functions (callable, region southamerica-east1)

| Function                          | Propósito                                                            | Auth + validação                        |
| --------------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| `parseBulaBioquimica`             | OCR PDF via Gemini 2.5 Flash → schema validado                       | `isActiveMemberOfLab` + Zod             |
| `seedBioquimicaDefaults`          | Carrega 16 analitos seed (idempotente por labId)                     | `isActiveMemberOfLab` + admin claim     |
| `recordRunBioquimica`             | Cria run com signature + chainHash + dispara recordTraceabilityEvent | `isActiveMemberOfLab` + Zod payload     |
| `recordTraceabilityEvent`         | Append-only event com signature                                      | Trigger interno (não exposto ao client) |
| `applyBulaToLot`                  | Vincula bula parseada a lote existente; recomputa Westgard           | `isActiveMemberOfLab` + check ownership |
| `generateMonthlyReportBioquimica` | PDF FR-001 (replicar pattern hema)                                   | `isActiveMemberOfLab`                   |

#### 9. Roteamento + AppRouter

- Rota: `/bioquimica` (lazy via `React.lazy`)
- Rota admin: `/bioquimica/admin/analitos` (gated por claim `bioquimicaAdmin`)
- Rota report: `/bioquimica/relatorio` (gated por claim ativo no lab)
- Hub tile: adicionar `bioquimica` ao `src/features/hub/` com ícone SVG inline (currentColor)
- ManualChunks: nova entry `module-bioquimica` em `vite.config.ts`

### Claude's Discretion (não ditado pelo usuário)

- **Naming:** `ControlMaterialBioquimica` vs `ControlLot` genérico — escolher por consistência com hema. Recomendação: manter `ControlLot` se a estrutura for compatível; senão criar tipo dedicado.
- **Granularidade de runs:** 1 run = 1 captura de N analitos × 1 equipamento (igual hema), ou 1 run por analito? — **Recomendação:** 1 run = N analitos × 1 equipamento (alinha com workflow Riopomba que captura todos os analitos de uma vez).
- **UI dark-first refinement:** seguir tokens em `DESIGN_SYSTEM.md` (`bg-[#141417]`, accents `violet-500`/`emerald-500`, `tabular-nums` em tabelas, transições 150-200ms).
- **Storybook:** opcional para componentes principais (LeveyJenningsChart, AddLotModal, ReviewRunModal) — só se já houver Storybook no projeto.
- **Testes:** unit em utils puros (westgardRulesCLSI, useChartData), E2E nos 5 fluxos críticos. Coverage alvo ≥95% em new code.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Estratégico (Obsidian — segundo cérebro)

- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Modulo_Hematologia_2026-04-29.md` — padrão de módulo CIQ quantitativo já em prod (replicar 1:1 onde aplicável)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md` — Arts. 179-180 (CIQ obrigatório), 181 (amostras controle), 167 (laudo), 183 (CIQ por troca de lote)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` — Bloco F: 5.5.1.1, 5.5.1.3, 5.5.2, 5.6.2, 5.6.3, 5.6.4
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Visao.md` — diretivas multi-equipamento, dark-first, breadth analítica
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Decisoes_Abertas.md` — CEQ via PNCQ (deferido), multi-tenant strategic

### Código vivo (HC Quality repo)

- `src/features/analyzer/` — pasta inteira é referência estrutural (replicar layout)
- `src/features/chart/utils/westgardRules.ts` — base conceitual do `westgardRulesCLSI.ts`
- `src/features/chart/hooks/useChartData.ts` — Levey-Jennings calc (mean/sd Bessel)
- `src/features/insumos/utils/insumoValidation.ts` — `validateReagentesForRun` reusável
- `src/shared/services/firebaseService.ts` — `subscribeToState` 5 layers + merge rules
- `firestore.rules` (blocos `analyzer/*` e `auditoria/*`) — template para bloco `bioquimica/*`
- `firestore.indexes.json` — pattern de índices compostos por module

### ADRs e specs (manter consistência)

- `docs/adr/0001-audit-chain.md` — chainHash + LogicalSignature pattern
- `docs/adr/0002-multi-tenant-firestore.md` — convenções multi-tenant
- `docs/adr/0007-*.md` — refinamentos de pattern
- `docs/PERFORMANCE_PATTERNS.md` — bundle, listeners, Web Vitals targets

### Rules condicionais (.claude/rules)

- `.claude/rules/module-protection.md` — isolamento entre módulos
- `.claude/rules/firestore-security.md` — invariantes (validSignature, labIdMatches, keepsLabId)
- `.claude/rules/performance.md` — bundle ≤50KB gzip per dep, manualChunks, listeners cleanup
- `.claude/rules/deploy-protocol.md` — ordem rules → functions → hosting

### Skills aplicáveis

- `hcq-ciq-module` — playbook canônico de módulo CIQ (referência operacional)
- `hcq-firestore-rules-generator` — geração do bloco rules para Plan 09-01
- `hcq-ciq-audit-trail` — chainHash + audit pattern para Plan 09-04
- `hcq-pdf-export-scaffold` — relatório FR-001 mensal (Plan 09-04)
- `hcq-deploy-gates` — gate pré-merge antes de Plan 09-05

</canonical_refs>

<specifics>
## Phase-Specific Constraints

### Bundle budget

- Novo chunk `module-bioquimica` ≤ 60 KB gzip (LeveyJenningsChart é o componente mais pesado — pode importar `recharts` dinamicamente se exceder)
- `vendor-charts` (recharts) já está no bundle — não conta como dep nova
- Gemini SDK já está em `vendor-firebase` — bula parser não adiciona peso

### Firestore custos

- Reads alvo: ≤3 reads/segundo por usuário ativo na rota `/bioquimica`
- Writes: 1 run = 1 doc + 1 traceability-event + 1 audit log = 3 writes (aceito)
- onSnapshot: 1 listener por seção da UI (analitos, lotes ativos, runs recentes) — total ≤ 4 listeners simultâneos por usuário

### Cloud Function quotas

- `parseBulaBioquimica`: ~5s p99 (Gemini Vision). Quota: 60 calls/min/lab (rate limit no callable)
- `recordRunBioquimica`: ≤1s p99
- `generateMonthlyReportBioquimica`: ≤30s p99 (puppeteer + PDF render)

### Web Vitals targets (rotas /bioquimica/\*)

- LCP < 2.5s
- INP < 200ms
- CLS < 0.1
- TBT < 200ms

### Threat model

- **T1: Operador adultera run após violation** — mitigação: rules `allow update: if false` em runs após signature; override via `complianceOverride.blockers` congelado
- **T2: Cross-tenant leak via equipmentId** — mitigação: rule check `equipamentos/{eqId}.labId == labId` no path
- **T3: Bula PDF maliciosa (XXE, JS injection)** — mitigação: Gemini Vision processa imagem rasterizada; Zod validation server-side antes de gravar
- **T4: Replay attack em recordRunBioquimica** — mitigação: idempotência por hash do payload; ts no signature
- **T5: Westgard bypass via UI hack** — mitigação: avaliação server-side em `recordRunBioquimica` (não confiar em client)

### Performance profile

- 16 analitos × 1-3 níveis × 2 equipamentos = até 96 cells de stats em LeveyJenningsChart simultâneo
- `useMemo` em cálculos de stats; `React.memo` em row components
- Polling? **NÃO** — usar `onSnapshot` em runs recentes (últimos 30 dias por equipamento)

### Localization

- UI em pt-BR (consistente com resto do app)
- Unidades: mg/dL default, suporte a mmol/L via campo opcional
- Datas: formato pt-BR (DD/MM/YYYY)

</specifics>

<gotchas>
## Known Pitfalls (de hematologia, evitar repetir)

1. **NÃO ler runs uma a uma** — usar `subscribeToState` agregado por equipamento
2. **`where('aproveitamento', '!=')` é caro** — filtrar in-memory após onSnapshot
3. **Dupla fonte de verdade entre `confirmedId` e `activeLotId`** — sincronizar via `useEffect` em `LotSwitcher`
4. **Westgard suspenso em lote sem bula** (`bulaPendente: true`) — UI explícita "aguardando bula" em LeveyJenningsChart
5. **Reagente vencido** — `validateReagentesForRun` retorna severidade; UI bloqueia run UNLESS override; override marca run como `informativa` (fora estatística)
6. **Compliance override** — `complianceOverride.blockers` deve ser congelado no momento do override (snapshot imutável)
7. **chainHash** — calcular server-side, nunca confiar no client
8. **Multi-tenant labId** — sempre redundante no payload + path; rule check ambos
9. **Soft-delete only** — nunca `deleteDoc`, sempre `softDelete*`

</gotchas>
