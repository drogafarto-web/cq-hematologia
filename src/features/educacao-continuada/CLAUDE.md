# Módulo: Educação Continuada

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/educacao-continuada/`.
Não leia nem acesse outros módulos de `src/features/`.

## Dependências externas permitidas (só importar)

- `src/utils/logicalSignature.ts` — `generateLogicalSignature` / `verifySignature`
- `src/shared/services/firebase.ts` — todas as APIs Firebase do projeto
- `src/store/useAuthStore.ts` — em particular `useActiveLabId()` e `useUser()`

## Referências regulatórias

PQ-035 | FR-001 | FR-013 | FR-027 | RDC 978/2025 | ISO 15189:2022 cl. 6.2

## Multi-tenant

Coleção raiz: `educacaoContinuada/{labId}/[subcoleção]`.
Documentos também carregam `labId` redundante no payload (defense-in-depth
nas security rules + habilita `collectionGroup` pelo superadmin).
Toda função de `ecFirebaseService.ts` recebe `labId` como parâmetro posicional
obrigatório — não existe caminho de escrita sem tenant.

## Regras invioláveis

- **RN-06:** jamais invocar `deleteDoc`. Usar `softDelete*` do service.
- **Assinatura:** `LogicalSignature = { hash, operatorId, ts }` — wrapper
  auditável (diverge do legado `CQRun.logicalSignature: string`).
- **Orquestrações atomic:** transições complexas (realizar, adiar) SEMPRE
  via `writeBatch` — nunca escritas sequenciais que possam falhar parcialmente.
- **Padrão de hook:** seguir `useColaboradores.ts` — `useActiveLabId` como guard,
  `onSnapshot` com cleanup, mutations que lançam `Error` sem lab ativo.

## Módulos finalizados — NÃO TOCAR

`analyzer` | `coagulacao` | `ciq-imuno` | `insumos` | `auth` | `admin` | `shared`

---

## Status atual

**Fase:** **MÓDULO EM PRODUÇÃO + ISO 15189 COMPLETO + ASSINATURA SERVER-SIDE + RULES STRICT + MATRIZ + BIBLIOTECA TEMPLATES** — 2026-04-24.
**URL:** https://hmatologia2.web.app (5 users com claim `'educacao-continuada'`)
**Functions:** 6 callables `ec_*` em `southamerica-east1` runtime Node 22 (upgrade 2026-04-24).
**Rules:** 5 coleções regulatórias com `allow create: if false` ou restrição planejado-only. Toda escrita regulatória passa por callable.
**Próximo passo prioritário:** smoke test E2E em prod (nunca foi feito com dado real); validar Matriz e Biblioteca em browser.

### Pendências restantes (ordem de prioridade)

1. **Smoke test E2E** — cronograma XLSX → import → colaborador → execução realizada → ver alerta RN-05 + Matriz semáforo + Biblioteca templates
2. **Trigger server-side** validando FK Participante→Execucao (defesa adicional além da rule já escrita no callable)
3. **Code-split do SheetJS** — dynamic `import()` reduz bundle inicial em ~400KB
4. Rastreabilidade de autor em mutations não-regulatórias (callables Fase 0b já gravam em `auditLogs/`)
5. Gerador automático de Execuções planejadas a partir de periodicidade (1 botão → cria cronograma do ano)
6. Email transacional ao vencer alerta (Cloud Function + Resend)
7. Limpeza pós-validação Fase 0c — após 1 sprint estável, deletar funções deprecated em `services/ecFirebaseService.ts` e `services/ecSignatureService.ts`
8. Fase 7 — Trilhas + Onboarding (RN-08, RN-09)
9. Fase 8 — Banco de Questões + Cloud Function de correção (RN-10 server-side)
10. Fase 9 restante — Certificados (PDF + QR) + Alertas via email + página pública verificação

✅ **Done:**
- ~~Cloud Function para assinatura~~ Fase 0b (2026-04-24)
- ~~Matriz de Treinamentos~~ (2026-04-24, recorte da Fase 9)
- ~~Fase 6 — Templates + Materiais Didáticos~~ (2026-04-24)
- ~~Node 20 → 22~~ runtime upgrade (2026-04-24)
- ~~Fase 0c — rules tightening~~ (2026-04-24)

### Deploy histórico

**2026-04-23 — Deploy inicial do módulo:**

1. `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2` ✅
2. `firebase deploy --only functions:provisionModulesClaims --project hmatologia2` ✅
3. `node functions/scripts/provision-ec-module-claim.mjs --apply` — 5/5 users ✅
4. `firebase deploy --only hosting --project hmatologia2` ✅

**2026-04-24 — Fixes + feature XLSX:**

5. Botão "← Hub" adicionado (UX — usuário ficava preso sem navegação)
6. `ECCronograma.tsx` novo — grid mês × treinamento com bolinhas coloridas
7. Refactor visual completo (topbar sticky, gradient title, toggle Grid/Cards,
   counter badge em Alertas, ícones SVG inline nas tabs, glow em bolinhas,
   avatar com inicial, fade-in animation, linha ativa com glow)
8. A11y: `role="tablist"/tab/tabpanel"`, `aria-controls="ec-tabpanel"`,
   `aria-selected` string explícita
9. Import XLSX: `ecImportService.ts` + `ImportTreinamentosModal.tsx` + 2 botões
   no ECDashboard ("Baixar modelo" e "Importar XLSX"). Dep nova: `xlsx@^0.18.5`.
10. `firebase deploy --only hosting --project hmatologia2` ✅

Script criado em 2026-04-23: `functions/scripts/provision-ec-module-claim.mjs`
(standalone alternativo à callable `provisionModulesClaims` — Admin SDK local,
mesma semântica: merge `modules = fullAccess()` em users com ≥1 labId).

### Entregue na FASE 1

- `types/_shared_refs.ts` — reexports + `LogicalSignature`
- `types/EducacaoContinuada.ts` — 7 entidades + unions + Input DTOs
- `services/ecFirebaseService.ts` — paths multi-tenant + CRUD de Colaborador
- `hooks/useColaboradores.ts` — subscribe reativo + mutations
- `components/ColaboradorForm.tsx` — criação e edição

### Entregue na FASE 2

- `services/ecFirebaseService.ts` — ampliado com CRUD de Treinamento
- `hooks/useTreinamentos.ts` — subscribe + mutations (espelho de useColaboradores)
- `components/TreinamentoForm.tsx` — form FR-027 com 8 campos + validação
- `components/ECDashboard.tsx` — visão agrupada por periodicidade + drawer lateral

### Entregue na FASE 3

- `services/ecFirebaseService.ts` — ampliado com Execucao + Participante + AlertaVencimento + 2 orquestrações atomic (`commitExecucaoRealizada`, `commitExecucaoAdiada`)
- `services/ecSignatureService.ts` — `generateEcSignature` / `verifyEcSignature` com payload `Record<string, string | number>`
- `hooks/useExecucoes.ts` — CRUD simples
- `hooks/useSaveExecucao.ts` — orquestrador `realizar` (RN-03 + RN-05) e `adiar` (RN-01)
- `components/ParticipantesModal.tsx` — lista de presença com checkbox e marcar-todos
- `components/ExecucaoForm.tsx` — form status-driven (planejado → realizado/adiado/cancelado)

### Entregue na FASE 4

- `components/_formPrimitives.tsx` — `Field` + `inputClass` + `selectClass` extraídos (dívida 3x forms resolvida); ColaboradorForm/TreinamentoForm/ExecucaoForm refatorados para importar
- `services/ecFirebaseService.ts` — ampliado com AvaliacaoEficacia + AvaliacaoCompetencia (CRUD + subscribe filtrado)
- `hooks/useParticipantes.ts` — leitura read-only (escrita é SEMPRE via `useSaveExecucao`)
- `hooks/useAvaliacaoEficacia.ts` — `registrar` com validação RN-02 (ineficaz+fechar exige ação corretiva); `fechar` separado pra revalidar RN-02 em transição
- `hooks/useAvaliacaoCompetencia.ts` — `registrar` com validação (reprovado exige `proximaAvaliacaoEm`); `avaliadorId = user.uid` auto-injetado
- `components/AvaliacaoEficaciaForm.tsx` — bloco condicional ação corretiva (ineficaz) + checkbox fechar + selector de execucão opcional
- `components/AvaliacaoCompetenciaForm.tsx` — colaboradores restritos aos **presentes** naquela execução (ISO 15189 só avalia quem recebeu o treinamento); campo próxima avaliação condicional
- `components/ProntuarioColaborador.tsx` — histórico individual (participações + avaliações) com flag RN-04 (alerta vermelho quando avaliação mais recente de qualquer treinamento for 'reprovado')

### Entregue na FASE 5

- `services/ecFirebaseService.ts` — ampliado com CRUD parcial de AlertaVencimento (status-only, não há create pq vem do batch de RN-05)
- `hooks/useAlertasVencimento.ts` — leitura + transições de status + derivações `alertasIminentes` / `alertasVencidos` (janela `diasAntecedencia` + vencidos hoje)
- `services/ecExportService.ts` — tipos `RelatorioFR001`/`FR013`/`FR027` + helper `triggerPrint()` + formatadores `formatDate`/`formatDateTime`
- `components/ECRelatorioPrint.tsx` — modal de pré-visualização com `@media print` (Tailwind `print:*`); imprimir → "Salvar como PDF" nativo
- `components/ECIndicadores.tsx` — painel agregado por ano (% realização, % eficácia, % competência, tempo médio FR-013, contagens)
- `components/_tabs/ExecucoesTab.tsx` — lista filtrável + drawers (edit/avaliar) + trigger FR-001
- `components/_tabs/ColaboradoresTab.tsx` — lista com busca + flag RN-04 no card + drawer prontuário + avaliação de competência
- `components/_tabs/AlertasTab.tsx` — agrupado por criticidade (vencidos / iminentes / agendados / resolvidos) + ações de transição
- `components/_tabs/IndicadoresTab.tsx` — ECIndicadores + seletor de ano + emissão de FR-027

### Entregue em 2026-04-24 (pós-deploy)

- `components/ECCronograma.tsx` — grid mês × treinamento com bolinhas coloridas por status (blue planejada, emerald realizada, amber adiada), mês atual destacado, glow `shadow-[0_0_8px_...]`
- `EducacaoContinuadaView.tsx` — refactor visual completo: topbar sticky (botão ← Hub + divisor + título com gradient emerald→teal + nome do lab + ID + avatar), TabBar com ícones SVG inline nas 5 tabs, counter badge vermelho em Alertas quando há críticos/iminentes, linha ativa com glow, fade-in animation ao trocar tab, `role="tablist"/tab/tabpanel"` + `aria-controls="ec-tabpanel"`
- `components/ECDashboard.tsx` — toggle `[Grid anual | Cards]` (role="tablist" com 2 botões role="tab" aria-selected string) + botões `Baixar modelo` e `Importar XLSX` no header
- `services/ecImportService.ts` — `generateTreinamentosTemplate()` monta XLSX com 2 abas (Cronograma + Instruções), `downloadTemplate()` triggera download via Blob, `parseTreinamentosXlsx()` lê+valida com enums case+accents-insensitive, retorna `{ ok: ParsedRow[], errors: ParseError[], total: number }`
- `components/ImportTreinamentosModal.tsx` — state machine (idle → parsing → preview → importing → done/error), drag&drop area, preview com stats (total/válidas/com erro) + erros inline com linha+coluna+motivo, `<progress>` nativo durante import
- `components/_tabs/ExecucoesTab.tsx` — busca inline (por título ou ministrante) + filtro status
- Dependência nova: `xlsx@^0.18.5` (via `--legacy-peer-deps` por conflito pré-existente eslint 9 vs jsx-a11y plugin)
- `EducacaoContinuadaView.tsx` — entry point com 5 tabs; subcomponentes em `_tabs/` para coesão

### Entregue em 2026-04-24 (sessão auditoria ISO 15189 + XLSX colaboradores + edição de treinamentos no grid)

- `services/ecImportService.ts` — generalização `ParseResult<T>` / `ParsedRow<T>` (default TreinamentoInput para BC); adicionadas `generateColaboradoresTemplate()`, `downloadColaboradoresTemplate()`, `parseColaboradoresXlsx()` (4 colunas Nome/Cargo/Setor/Ativo); coluna **"Datas Planejadas"** no template de treinamentos (opcional, DD/MM/AAAA separadas por `;` — aceita também AAAA-MM-DD e serial Excel via `excelSerialToDate`); parser `parseDatasPlanejadas` com handling de 3 formatos e validação estrita de calendar date.
- `components/ImportColaboradoresModal.tsx` — state machine paralela ao modal de treinamentos (idle → parsing → preview → importing → done/error), drag&drop, preview com stats, erros inline com linha+coluna+motivo.
- `components/ImportTreinamentosModal.tsx` — após criar treinamento, itera `datasPlanejadas` e chama `createExecucao` com status `'planejado'`, ministrante=`responsavel`, pauta=`tema`, assinatura gerada via `generateEcSignature`. Falha individual em uma execução não aborta o loop. Stats de preview mostram "Execuções" total; done-state reporta "N execução(ões) planejada(s) no cronograma".
- `components/_tabs/ColaboradoresTab.tsx` — botões "Baixar modelo" e "Importar XLSX" no header, paralelos ao ECDashboard.
- `components/ECCronograma.tsx` — ícones sempre visíveis na coluna Treinamento: ✏️ editar (abre drawer) + 🗑️ arquivar. Props opcionais `onEditTreinamento` e `onArchiveTreinamento` do ECDashboard. Decisão deliberada: hover-reveal (`opacity-0 group-hover:opacity-100`) ficou invisível demais + dependente de cache de PWA — substituído por ícones permanentes com hover tonal.
- `components/CompetenciasExecucaoPanel.tsx` (NOVO, 169 linhas) — painel de avaliação de competência por execução (ISO 15189:2022 cl. 6.2.4). State machine `list ↔ form` reusando `AvaliacaoCompetenciaForm` com `execucaoId + colaboradorId` fixos. Lista só presentes (`p.presente === true`). Badge "✓ Avaliado" derivado do subscribe em tempo real via `useAvaliacaoCompetencia({ execucaoId })`. Self-contained (resolve título via `useTreinamentos` interno). Atomic por registro — cancelar no meio não deixa state parcial.
- `components/_tabs/ExecucoesTab.tsx` — 4 changes: import do painel novo, Panel union com `'avaliar-competencia'`, botão "Avaliar competências" entre "Avaliar eficácia" e "Emitir FR-001", branch de render reusando `FormPanel`. Também: `useAvaliacaoCompetencia` adicionado ao topo + filtro por `execucaoId` em `buildRelatorioFR001` para popular o novo campo do payload.
- `services/ecExportService.ts` — `RelatorioFR001` estendido com `avaliacoesCompetencia: AvaliacaoCompetencia[]` (já filtradas pela execução no caller).
- `components/ECRelatorioPrint.tsx` — nova seção **"Avaliação de competência individual (X/Y)"** após "Avaliação de eficácia" no FR-001. Tabela Colaborador | Método | Resultado | Próxima avaliação. Para presente sem registro: "— / **Pendente** / —" em amber-700 (decisão explícita: botão "Emitir FR-001" **sem gatekeeping** — auditor vê o que está em aberto em vez do sistema bloquear). Map `COMPETENCIA_LABEL` adicionado; stub `void METODO_LABEL` removido (agora usado de fato).

Conclusão regulatória da sessão: os três erros críticos reportados no briefing de auditoria foram resolvidos de forma cirúrgica — Erro #1 (eficácia individual) era falso positivo pós-diagnóstico; Erro #2 (competência ausente do fluxo) era ausência de botão na UI com service + hook + form já prontos da FASE 4; Erro #3 (FR-001 incompleto) exigia extensão de tipo + seção nova. Nenhuma refatoração estrutural, zero duplicação de validação.

### Entregue na FASE 0b — 2026-04-24 (assinatura server-side via Cloud Function)

Migração da geração de assinatura de client-side (`crypto.subtle` em `ecSignatureService.ts` — compliance theater) para server-side via 6 Cloud Functions callables. Filosofia **aditiva**: hooks passam a chamar callables; service e signature service ficam intocados como rollback de 3 linhas; `firestore.rules` NÃO mudam nesta fase (Fase 0c separada).

**Server (8 arquivos novos em `functions/src/modules/educacaoContinuada/`):**

- `signatureCanonical.ts` — espelho server-side do algoritmo do `ecSignatureService.ts`. `node:crypto.createHash('sha256')` em vez de `crypto.subtle`. Hash byte-equal ao do web (validado por unit test "formato canônico bate com algoritmo do web") — `verifyEcSignature` no front continua válido para docs históricos
- `validators.ts` — schemas Zod das 6 callables + `assertEcAccess(auth, labId)` (claim `modules['educacao-continuada']` + member ativo de `labs/{labId}/members/{uid}`; falha sempre loga `[EC_ACCESS_DENIED]` + lança `permission-denied` com mensagem PT padronizada `EC_ACCESS_DENIED_MSG = 'Sem permissão para este módulo — contate o administrador.'`) + helpers de path multi-tenant + `calcularDataVencimento` (RN-05)
- `mintSignature.ts` — `ec_mintSignature` em lote (até 500 payloads por call). Usado por `ExecucaoForm` (single) e `ImportTreinamentosModal` (1 round-trip por linha). Retorna `{signatures: [{hash, operatorId, tsMillis}]}` — cliente reconstrói `Timestamp.fromMillis(tsMillis)`
- `commitExecucaoRealizada.ts` — sign-and-write atomic. Server **re-lê** `treinamentos/{id}` (periodicidade autoritativa) + valida cada `colaboradores/{cid}` (existe + ativo). RN-03 server-side. Batch atomic: update execução + N sets em participantes + 1 set em alertaVencimento. Audit em `auditLogs/`
- `commitExecucaoAdiada.ts` — RN-01 atomic (update original status='adiado' + create nova planejada com `origemReagendamento` e dados herdados do original)
- `registrarAvaliacaoEficacia.ts` — 2 callables: `ec_registrarAvaliacaoEficacia` (cria; RN-02 ineficaz+fechar exige `acaoCorretiva`; suporta criar já-fechada) + `ec_fecharAvaliacaoEficacia` (transição; re-aplica RN-02; usa `acaoCorretiva` do input ou a já existente no doc)
- `registrarAvaliacaoCompetencia.ts` — `ec_registrarAvaliacaoCompetencia`. **Auto-injeta `avaliadorId = request.auth.uid`** (cliente não envia mais). Valida via FK que o `colaboradorId` foi `presente: true` na execução (ISO 15189 cl. 6.2.4: só avalia quem recebeu o treinamento). Reprovado exige `proximaAvaliacaoEm`
- `index.ts` — barrel das 6 callables

**Wiring (3 alterações):**

- `functions/src/index.ts` — bloco `// ─── educacaoContinuada module (Fase 0b — 2026-04-24)` com re-export das 6 callables. Região herdada do `setGlobalOptions({region:'southamerica-east1'})` no topo
- `firebase.json` — bloco `emulators` adicionado (auth:9099, firestore:8080, functions:5001, storage:9199, ui:4000) para smoke local
- `src/shared/services/firebase.ts` — adicionado export de `functions` + `httpsCallable` (re-export de `firebase.config.ts`) + bloco de wiring do emulator gated por `import.meta.env.VITE_USE_EMULATOR === 'true'` (idempotente via try/catch para HMR do Vite)

**Web client (3 hooks + 2 components migrados; service e signature service INTOCADOS):**

- `hooks/useSaveExecucao.ts` — `realizar` → `httpsCallable('ec_commitExecucaoRealizada')`; `adiar` → `ec_commitExecucaoAdiada`. Contrato dos returns (`CommitExecucaoRealizadaResult`/`CommitExecucaoAdiadaResult`) preservado para callers atuais via redeclaração local. Validações RN-03 client mantidas como UX rápida (server é canônico). `unwrapCallableError` traduz `FirebaseError.message` para Error legível
- `hooks/useAvaliacaoEficacia.ts` — `registrar` → `ec_registrarAvaliacaoEficacia`; `fechar` → `ec_fecharAvaliacaoEficacia`. `update`/`softDelete`/`restore` continuam via service direto (não-regulatórios). Geração de assinatura client-side removida
- `hooks/useAvaliacaoCompetencia.ts` — `registrar` → `ec_registrarAvaliacaoCompetencia`. Removida injeção client-side de `avaliadorId` (server faz). `update`/`softDelete`/`restore` via service
- `components/ExecucaoForm.tsx` — substitui `generateEcSignature` direto (linha 213) por `callMintSignature({labId, payloads:[{...}]})` single. Adicionado `useActiveLabId` ao topo
- `components/ImportTreinamentosModal.tsx` — `ec_mintSignature` em **LOTE por linha** (1 round-trip por linha em vez de N por execução). Falha de mint não aborta o loop — gera erro inline; segue para a próxima linha

**Service layer INTOCADA (rollback path):**

- `services/ecFirebaseService.ts` — `commitExecucaoRealizada`, `commitExecucaoAdiada`, `createAvaliacaoEficacia`, `createAvaliacaoCompetencia` continuam funcionais. Sem `throw deprecated`. Ninguém chama mais (verificado por grep) mas estão lá pra rollback de 3 linhas se algo quebrar em prod
- `services/ecSignatureService.ts` — `generateEcSignature` permanece funcional como fallback; `verifyEcSignature` continua útil para auditoria UI

**Validação:**

- `functions/test/educacaoContinuada/canonical.test.mjs` — 5 testes unitários: `sortedStringify` determinístico contra ordem de chaves + aceita string|number, `sha256Hex` paridade com `node:crypto` manual, round-trip `generate`/`verify`, **paridade canônica server↔web** (replica algoritmo do web no test e compara hash → byte-equal)
- `functions/scripts/smoke-ec-callables.mjs` — script standalone Admin SDK contra Functions/Firestore/Auth Emulator. 11 cenários: sem-auth, claim-ausente, mint happy, RN-03 fail Zod, RN-03 fail server, commit realizada happy, RN-02 ineficaz+fechar sem ação, eficacia happy, ISO 15189 reprovado sem próx, colaborador ausente, competência happy, adiar happy. Seed cria fake users + lab + treinamento + 2 colaboradores; mint custom token via Admin SDK + REST exchange no Auth Emulator (`signInWithCustomToken`)

**Deploy 2026-04-24 (executado nesta sessão):**

1. `firebase deploy --only "functions:ec_*" --project hmatologia2 --non-interactive` ✅
   - 6 funções criadas em southamerica-east1, ~3min, pacote 495.86 KB
   - Aviso: runtime Node 20 será deprecated 2026-04-30 (urgente upgrade para 22)
2. Sanity remoto: `curl POST https://southamerica-east1-hmatologia2.cloudfunctions.net/ec_mintSignature` sem auth → `{"error":{"message":"Autenticação necessária.","status":"UNAUTHENTICATED"}}` ✅ (prova roteamento + Zod + assertEcAccess + serialização de erro)
3. `firebase deploy --only hosting --project hmatologia2 --non-interactive` ✅
   - Build prod: 919 modules, 15.63s. 3 arquivos novos enviados, restante reutilizado
   - https://hmatologia2.web.app servindo bundle novo

**O que NÃO cobre (Fase 0c — sessão separada):**

- `firestore.rules` permanece com `validSignature()` shape-only check + `allow create/update` permitidas client-side. Cliente determinado ainda forja `hash` arbitrário (qualquer string SHA-256 hex de 64 chars passa) e burla as callables. **Fase 0b sozinha NÃO fecha o gap real** — só move geração legítima para o server. O fechamento de fato vem da Fase 0c apertando para `allow write: if false` nas 5 coleções regulatórias após validação em prod do caminho novo
- Smoke E2E em prod com dado real (fluxo completo via UI)
- Migrar `generateLogicalSignature` global (sem callers em `src/`, baixa prioridade)
- Rollback rápido se algo quebrar: `firebase hosting:rollback --project hmatologia2` (volta bundle anterior; callables ficam idle)

### Convenções fixadas nas fases 1-3 (aplicar em todas as fases seguintes)

- `readonly` em `id`, `labId`, `criadoEm` e FKs imutáveis das entidades
- Input DTOs via `Omit<Entidade, 'id'|'labId'|'criadoEm'|'deletadoEm'>` —
  service é a única fonte de audit fields
- Mapping snapshot → entidade em função dedicada (centraliza divergência)
- Filtro de `deletadoEm` aplicado client-side por omissão (ver ⚠️ em
  `subscribeColaboradores`/`subscribeExecucoes` sobre limites de escala)
- Return types de componentes React omitidos (inferência TS) — React 19 não
  expõe `JSX` global namespace
- Inputs com `id` + `htmlFor` do label **e** `aria-label` redundante —
  `jsx-a11y/label-has-associated-control` não atravessa componentes wrapper
- Transições complexas de estado (realizar/adiar) ficam em hooks separados
  (`useSaveExecucao`) para evitar bypass das validações via `update` direto
- Assinaturas são geradas no momento do commit — nunca no render nem em estado
  intermediário da UI (evita rehash em re-render)

### Pendências conhecidas

- **Assinatura: parcial.** Geração legítima do módulo migrada para Cloud
  Functions na Fase 0b (2026-04-24). PORÉM, `firestore.rules` ainda permite
  escritas client-side com `validSignature()` shape-only — cliente determinado
  ainda forja `hash` SHA-256 arbitrário e grava direto, burlando as callables.
  **Fase 0c (sessão separada):** `allow write: if false` nas 5 coleções
  regulatórias (`execucoes`, `participantes`, `avaliacoesEficacia`,
  `avaliacoesCompetencia`, `alertasVencimento`). Esse é o passo que fecha o
  gap real. `generateLogicalSignature` global (`src/utils/logicalSignature.ts`)
  continua client-side — sem callers em `src/`, baixa prioridade.
- ~~Rules Firestore~~ ✅ escritas. Bloco `/educacaoContinuada/{labId}/**`
  adicionado em `firestore.rules` na raiz do projeto. Índices compostos
  adicionados em `firestore.indexes.json` (colaboradores/treinamentos com
  `ativo + nome/titulo`). **Ordem obrigatória de deploy** (documentada
  no próprio arquivo de rules):

  1. Estender `provisionModulesClaims` para incluir o claim `'educacao-continuada'`
  2. Rodar com `dryRun: false` em prod — grant do claim a todos os users ativos
  3. Query de verificação: `users ativos 30d sem claim 'educacao-continuada' = 0`
  4. Deploy das rules (`firebase deploy --only firestore:rules,firestore:indexes`)

  Sem os passos 1-2, `hasModuleAccess('educacao-continuada')` retorna false
  para 100% dos users e o módulo fica inacessível — fail-safe intencional,
  alinhado ao padrão Onda 3 dos módulos legados.
- ~~Integração com o shell~~ ✅ aplicada. Mudanças fora do módulo:
  - `src/types/index.ts` — `'educacao-continuada'` adicionado ao union `View`
  - `src/features/auth/AuthWrapper.tsx` — import + case no `AppRouter`
  - `src/features/hub/ModuleHub.tsx` — tile com ícone de formatura (cor indigo,
    não colidindo com os outros 5 módulos)
- **Exportação PDF via `window.print()`** — o projeto tem padrão em
  `uroExportService.ts` que não foi acessado neste escopo. Migrar quando
  alinhar é tarefa de baixo risco: os tipos `RelatorioPayload` já estão estáveis
  e sobrevivem à troca da camada de render.
- ~~Primitives de form duplicados~~ — resolvido na FASE 4.
  `components/_formPrimitives.tsx` é o único ponto de definição de
  `Field`/`inputClass`/`selectClass` e agora é importado por 5 forms.
- **Confirmação de arquivamento** usa `window.confirm` nativo no ECDashboard.
  Substituir por toast com undo quando o sistema de notificações do projeto
  estiver disponível.
- **Assinatura de participante feita pelo operador, não pelo colaborador.**
  Fluxo digital simplificado: o operador que registra a execução assina em
  nome de cada participante. RDC 978 real exige que cada pessoa assine a
  própria participação — requer biometria/login próprio. Fora do escopo.
- **`datetime-local` vs `date`.** Execuções hoje usam `type=date` (resolução
  de dia). Se ISO 15189 auditar resolução de hora, trocar para `datetime-local`
  e ajustar `dateInputToTs` em `ExecucaoForm.tsx`.
- **Índices compostos de execucoes.** Filtro por `treinamentoId`/`status` é
  client-side hoje. Migrar para query server-side com índice composto se
  volume por tenant passar de ~5k execuções.
- **Re-avaliação de competência não acessível via ExecucoesTab.** O
  `CompetenciasExecucaoPanel` mostra badge "✓ Avaliado" sem botão de
  reavaliação — 1 registro por `(execucaoId, colaboradorId)` no fluxo
  direto. Para reavaliar, usuário vai pela ColaboradoresTab → prontuário
  → "Registrar avaliação de competência" e escolhe a execução manualmente.
  Listar histórico e permitir reavaliação in-place é melhoria de UX futura.
- **Soft-delete sem cascade entre `Execucao` e suas avaliações.** Arquivar
  uma execução deixa `AvaliacaoEficacia` e `AvaliacaoCompetencia` vinculadas
  com `deletadoEm: null`. Histórico preservado por intenção (RDC 978), mas
  queries de prontuário podem mostrar avaliações órfãs se o filtro de
  execuções deletadas não for aplicado. Resolver quando o volume de
  execuções arquivadas passar a gerar ruído visível no prontuário.

---

## Dever de atualização do contexto raiz

Após cada milestone deste módulo (fase nova concluída, deploy estrutural, novo fluxo em prod), atualizar:

1. **A seção "Status atual" acima** (data + fase + próximo passo)
2. **A linha `educacao-continuada` na tabela "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md)** — formato `{módulo} | {status 1 frase} | {data}`

Protocolo completo em [`.claude/CONTEXT_PROTOCOL.md`](../../../.claude/CONTEXT_PROTOCOL.md).
