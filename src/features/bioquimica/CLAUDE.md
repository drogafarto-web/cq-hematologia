# Módulo: Bioquímica (CIQ Quantitativo)

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/bioquimica/`.
Não leia nem escreva em outros módulos de `src/features/`.

## Dependências externas permitidas

- `src/shared/services/firebase.ts` — APIs Firebase do projeto
- `src/store/useAuthStore.ts` — `useActiveLabId()` e `useUser()` (selectors atômicos)
- `src/store/useAppStore.ts` — `useAppStore.getState().goBack()` para navegação
- `src/types/index.ts` — entrada `'bioquimica'` na union `View`
- `functions/src/modules/bioquimica/*` — Cloud Functions do módulo

NÃO importar de outros módulos `src/features/*` — fork de `analyzer/chart`
em utils dedicados é parte do design (CONTEXT.md decisão #6).

## Referências regulatórias

- **RDC 978/2025** Arts. 179 (CIQ obrigatório), 180 (planos de controle), 181
  (rastreabilidade de amostras controle), 167 (laudo), 183 (CIQ por troca de lote)
- **DICQ 4.3** Bloco F (Analítico): 5.5.1.1, 5.5.1.3, 5.5.2, 5.6.2, 5.6.3.1, 5.6.4
- **CLSI EP15** — subset Westgard implementado
- **ISO 15189** — rastreabilidade + validação

## Schema Firestore (multi-tenant)

```
/labs/{labId}/bioquimica/
  root/                              âncora ({labId, module, seededAt?, seededBy?})
  root/analitos/{analitoId}          17 seed + custom labs
  root/lotes/{lotId}                 ControlMaterial multi-instrumento
  root/runs/{runId}                  Run callable-only (Plan 09-04)
  root/traceability-events/{eventId} append-only Worklab log
  root/audit/{logId}                 append-only audit chainHash
  root/config/{singleton}            singleton de configuração
```

Documentos carregam `labId` redundante no payload (defense-in-depth nas rules).
Toda função de service recebe `labId` como parâmetro posicional obrigatório.

## Decisões locked (CONTEXT.md, CTO 2026-05-06)

1. **Engine Westgard** — subset CLSI: `1-2s` (warn), `1-3s`, `2-2s`, `R-4s`
   (reject). Regras estendidas (4-1s, 10x, 6T, 6X) definidas em código mas
   `enabled: false` por default — ativáveis em v1.4 por analito.
2. **Multi-instrumento dia 1** — bula → `equipmentIds[]`; runs → `equipmentId`;
   stats avaliadas por par `(analitoId, equipmentId, nivelId)`.
3. **Granularidade run** — 1 run = N analitos × 1 nível × 1 equipamento.
   Alinha com workflow Riopomba.
4. **Stats source** — bula PDF primária; estatística interna após N=20 runs
   por par. Toggle UI sem substituir bula até atingir N=20.
5. **Rastreabilidade Worklab** — append-only via Cloud Function. `examCodeAtChange`
   manual entry no MVP (sem integração LIS externa em v1.3).
6. **Replicação direta de hematologia** — fork de UI components + utils via
   reuso direto (insumoValidation, subscribeToState).

## Regras invioláveis

- **RN-06** soft-delete only — nunca `deleteDoc`. Sempre `softDelete*` do service.
- **Westgard server-side** — engine roda em Cloud Function `recordRunBioquimica`
  (Plan 09-04). Client NUNCA decide status final. (Threat T5)
- **chainHash server-only** — calculado no server, nunca confiar no client.
- **labId redundante** — todos os docs carregam payload + path. Rules validam ambos.
- **LogicalSignature** em runs e traceability events — `hash.size() == 64`
  - `operatorId == request.auth.uid` + `ts is timestamp`.
- **Compliance override** — `complianceOverride.blockers` congelado no momento
  do override (snapshot imutável).

## Conventions específicas

- **1 run agrega todos os analitos** medidos numa única captura — não criar
  uma run por analito.
- **Westgard suspenso em lote sem bula** (`bulaPendente: true`) — UI explícita
  "aguardando bula" em LeveyJenningsChart.
- **Aproveitamento** (`oficial` vs `informativa`) decidido server-side a partir
  de `complianceOverride.blockers`. Operador NÃO escolhe diretamente.
- **Bundle target** ≤ 60 KB gzip no chunk `module-bioquimica` (vite.config.ts).

## Status atual

**Fase:** 9 — Plan 09-01 (Foundation) entregue **2026-05-06**
**Wave:** 1 (Schema + Service Layer + Admin Analitos)
**URL:** https://hmatologia2.web.app/bioquimica (após deploy)
**Functions:** 1 callable `seedBioquimicaDefaults` em `southamerica-east1` Node 22, 256MiB
**Rules:** `/labs/{labId}/bioquimica/root/**` com analitos/lotes client-direct
e runs/traceability/audit callable-only desde dia 1.
**Status:** 🟡 Foundation entregue · Plans 09-02 a 09-05 em desenvolvimento

## Próximos plans

- **09-02** Westgard engine + Levey-Jennings + ReviewRunModal + PreFlightCheck
- **09-03** Bula PDF parse (Gemini Vision) + AddLotModal multi-instrumento
- **09-04** Cloud Functions (recordRunBioquimica, applyBulaToLot, recordTraceabilityEvent, generateMonthlyReportBioquimica)
- **09-05** Comparabilidade entre equipamentos + relatórios FR-001 + handoff

## Pendências conhecidas

1. **Callable de write para analitos** — Plan 09-04 introduz `manageAnalito`;
   serviço atual (`createAnalito`/`updateAnalito`) fica deprecated por 1 sprint.
2. **Engine Westgard** — implementação concreta vive em
   `utils/westgardRulesCLSI.ts` (a ser criado em Plan 09-02). Tipos já em
   `types/westgard.ts`.
3. **Subscribe layer agregada** — `subscribeToState` shared (em
   `src/shared/services/firebaseService.ts`) ainda não tem layer `bioquimica`
   merged; hook `useBioquimicaState` cobre o caso atual com 3 listeners
   diretos no service. Layer compartilhada vira refactor em Plan 09-02
   quando runs entrarem em jogo.
4. **Rule tests live em emulator** — Plan 09-01 ships scenarios documentados
   em `functions/test/bioquimica/rules.test.mjs`; conversão para
   `@firebase/rules-unit-testing` é débito separado quando o pacote for
   adicionado ao projeto.

## Débitos técnicos

- **Stub:** rota `/bioquimica` MVP renderiza diretamente o `AnalitoAdmin`.
  Plans 09-02+ vão introduzir um shell com tabs (Analitos / Lotes / Runs /
  Relatórios). Quando houver mais que admin, refatorar `index.ts` para
  exportar o shell e mover `AnalitoAdmin` para `/bioquimica/admin/analitos`.
- **Claim de admin** — Plan 09-01 não criou claim `bioquimicaAdmin`; UI admin
  hoje é acessível por qualquer membro ativo. Plan 09-04 introduz claim
  segregada e gate por `RequireClaim`.
- **Seed dataset duplicado** — `constants/seedAnalitos.ts` (client) e
  `functions/src/modules/bioquimica/seedBioquimicaDefaults.ts` (functions)
  carregam a mesma lista. Drift detectável; teste de paridade pendente
  (Plan 09-02).

---

**Dever de atualização:** Após cada milestone deste módulo, atualizar a seção
"Status atual" acima + linha `bioquimica` na tabela "Módulos em produção"
do [root CLAUDE.md](../../../CLAUDE.md).
