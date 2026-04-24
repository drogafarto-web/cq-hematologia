# HANDOFF — Módulo Educação Continuada

Prompt pronto para colar em nova sessão do Claude Code quando quiser continuar trabalhando neste módulo.
Copia tudo entre as linhas `---` abaixo.

---

Preciso continuar trabalho no módulo **Educação Continuada** do HC Quality.

Carrega o skill: `/hc-quality`

Depois lê o CLAUDE.md do módulo:
`c:/hc quality/src/features/educacao-continuada/CLAUDE.md`

## Estado resumido (atualizado 2026-04-24 — roadmap 1–9 + cleanup pós-deploy + integração UI final)

- **Módulo em produção** em https://hmatologia2.web.app
- ~55 arquivos do módulo + **12 callables `ec_*`** + **1 HTTP público** (`validarCertificadoEc`) + **1 scheduled** (`ec_scheduledAlertasVencimento` 08:00 SP) + **1 trigger `onDocumentCreated`** (`ec_onColaboradorCreated` — RN-08 server-side) em `southamerica-east1` runtime **Node 22**
- Rules **STRICT** compliance RDC 978: 5 coleções regulatórias com `allow create: if false` (escrita exclusiva via callable); gabarito (Fase 8) em coleção `allow read: if false`
- claim `'educacao-continuada'` provisionado em 5 users; integrado ao shell (tile indigo, botão "← Hub")
- Storage rules strict: `educacaoContinuada/{labId}/materiais/**` (50MB cap, MIME whitelist) + `educacaoContinuada/{labId}/certificados/**` (gerado server)
- `RESEND_API_KEY` configurada em prod — alertas email ativos

### Fluxos funcionais ponta-a-ponta

- Cadastro de colaboradores + treinamentos (CRUD + dois XLSX de import com datas planejadas)
- Execução realizada com participantes (callable `ec_commitExecucaoRealizada` atomic; RN-03 + RN-05 server-side)
- Avaliação de eficácia (callable com RN-02; FR-001 bloco inferior; FR-013)
- Avaliação de competência individual (callable com ISO 15189 cl. 6.2.4 + FK Participante.presente server-side)
- Alertas de vencimento, indicadores anuais, prontuário individual, FR-001/013/027 imprimíveis
- **Matriz de Treinamentos** — dashboard semáforo colaboradores × treinamentos (tab "Matriz")
- **Biblioteca de Templates + Kits de Integração** — reuso no TreinamentoForm ("Criar a partir de template"), Storage uploads para materiais didáticos
- **Trilhas de Aprendizado + Onboarding** (Fase 7) — RN-08 server-side via trigger `ec_onColaboradorCreated` (observer client removido 2026-04-24); RN-09 etapa auto-aprovada com AvaliacaoCompetencia
- **Banco de Questões + correção server-side** (Fase 8) — gabarito em coleção separada com `read: if false`, correção via `ec_submeterTeste` (RN-10)
- **Certificados PDF + QR** (Fase 9) — callable gera com PDFKit + qrcode, upload Storage com signed URL, HTTP público `validarCertificadoEc` retorna HTML server-rendered
- **Alertas email** (Fase 9) — scheduled CF itera `collectionGroup('configAlertas')`, envia via Resend, marca como notificado

## Callables em prod (southamerica-east1/hmatologia2)

| Callable | Fase | Papel |
|---|---|---|
| `ec_mintSignature` | 0b | Assinatura server-side em lote (ExecucaoForm, Import XLSX) |
| `ec_commitExecucaoRealizada` | 0b | RN-03 + RN-05 batch atomic |
| `ec_commitExecucaoAdiada` | 0b | RN-01 atomic |
| `ec_registrarAvaliacaoEficacia` | 0b | RN-02 server |
| `ec_fecharAvaliacaoEficacia` | 0b | Re-aplica RN-02 na transição |
| `ec_registrarAvaliacaoCompetencia` | 0b | ISO 15189 + FK Participante.presente + auto-injeta avaliadorId |
| `ec_criarQuestao` | 8 | Separa opções públicas de gabarito (RN-10) |
| `ec_arquivarQuestao` | 8 | ativo=false preservando gabarito |
| `ec_submeterTeste` | 8 | Lê gabarito server + corrige objetivas + dissertativas → null |
| `ec_gerarCertificado` | 9 | PDF (PDFKit) + QR + Storage signed URL + doc |
| `validarCertificadoEc` | 9 | **HTTP público** — página de validação server-rendered (QR payload aponta aqui) |
| `ec_scheduledAlertasVencimento` | 9 | Scheduled 08:00 SP, Resend, collectionGroup |

## Caminhos que valem ler primeiro

- `c:/hc quality/src/features/educacao-continuada/CLAUDE.md` — contexto + status + convenções + dívidas
- `c:/hc quality/src/features/educacao-continuada/EducacaoContinuadaView.tsx` — entry point, tab "Matriz" adicionada
- `c:/hc quality/src/features/educacao-continuada/components/ECDashboard.tsx` — header com 4 botões novos: Biblioteca, Onboarding, Questões, Config (Fases 6, 7, 8, 9)
- `c:/hc quality/src/features/educacao-continuada/services/ecFirebaseService.ts` — service multi-tenant (CRUD Fases 1–9; deprecated do 0b preservado pra rollback)
- `c:/hc quality/src/features/educacao-continuada/hooks/useAutoStartTrilhasRN08.ts` — RN-08 observer client-side
- `c:/hc quality/functions/src/modules/educacaoContinuada/` — 12 callables + HTTP + scheduled
- `c:/hc quality/firestore.rules` linha 582+ — bloco de rules do módulo (strict pós-Fase 0c)
- `c:/hc quality/storage.rules` linha 164+ — bloco materiais didáticos

## Regras invioláveis

- Multi-tenant: coleção raiz `educacaoContinuada/{labId}/**`, `labId` no payload também
- RN-06: JAMAIS invocar `deleteDoc` — só `softDelete*` do service
- Assinatura `LogicalSignature = { hash, operatorId, ts }` — geração server-side via callables (Fase 0b). Client não forja mais — rules bloqueiam (Fase 0c)
- **RN-10** (Fase 8): gabarito NUNCA sai do servidor. Coleção `questoesGabarito` com `read: if false`. Correção exclusiva via `ec_submeterTeste`
- Escrita regulatória 100% via callables; rules de `/execucoes`, `/participantes`, `/avaliacoesEficacia`, `/avaliacoesCompetencia`, `/alertasVencimento` têm `allow create: if false` ou restrição planejado-only
- Orquestrações complexas (realizar/adiar/submeter) sempre via callable server-side — nunca escritas sequenciais client
- Padrão de hook: `useActiveLabId` guard + `onSnapshot` + mutations throw sem lab ativo
- Auto mode ativo: executar, minimizar interrupções, ack granular só para `firebase deploy*`, `--apply`, `git push`
- Não ler módulos proibidos (`analyzer` | `coagulacao` | `ciq-imuno` | `insumos` | `auth` | `admin`) sem autorização

## Separação regulatória (três avaliações distintas agora)

- **AvaliacaoEficacia** — COLETIVA por execução (RDC 978 Art. 126, FR-001). 1 por execução. Ineficaz + fechar → `acaoCorretiva` (RN-02 → FR-013)
- **AvaliacaoCompetencia** — INDIVIDUAL por participante presente (ISO 15189 cl. 6.2.4). N por execução. Reprovado → `proximaAvaliacaoEm`
- **AvaliacaoTeste** (Fase 8) — teste com banco de questões por template. Server corrige objetivas; dissertativas ficam pendentes para revisão manual. `aprovado` = percentual ≥ 70%

Coleções separadas, forms separados, hooks separados. Erros comuns: misturar esses três tipos — anti-padrão e quebra compliance.

## Pendências em ordem de prioridade

1. **Smoke test E2E** em prod — nunca foi feito com dado real. **Checklist completo** em `SMOKE_E2E_CHECKLIST.md` (7 passos, 45-60 min). Item exclusivamente humano — Claude só pode fornecer o roteiro.

2. **Trigger server-side FK** validando Participante→Execucao (defesa extra além da validação no callable)

3. **Code-split do SheetJS** — dynamic `import()` reduz bundle inicial (~3.2MB raw / ~860KB gzip hoje)

4. **Rastreabilidade de autor** em mutations não-regulatórias (callables Fases 0b/8/9 gravam em `auditLogs/`; cadastros de colaborador/treinamento/template/trilha/kit ainda não)

5. **Re-avaliação de competência via ExecucoesTab** — hoje só prontuário

6. **Soft-delete com cascade** entre `Execucao` e suas avaliações — avaliações ficam órfãs se a execução for arquivada

7. **UX do banco de questões** — TesteForm é MVP sem timer, save parcial ou revisão manual de dissertativas. Adicionar conforme uso real revelar.

8. **Limpeza de dead code residual** — `avaliacaoEficaciaPayload`/`avaliacaoCompetenciaPayload` helpers privados foram removidos junto com seus callers no cleanup 2026-04-24. Se a auditoria de ESLint revelar outras funções órfãs, remover.

## ✅ Feito nesta sequência (2026-04-24)

- **Fase 0b** — assinatura server-side (6 callables iniciais)
- **Matriz de Treinamentos** — dashboard semáforo (recorte da Fase 9)
- **Fase 6** — Templates + Materiais Didáticos + Kits + Storage rules
- **Node 20 → 22** runtime upgrade — ~30 functions migradas atomic
- **Fase 0c** — rules tightening (compliance RDC 978 formal fechado)
- **Fase 7** — Trilhas de Aprendizado + Onboarding (RN-08 server trigger, RN-09)
- **Fase 8** — Banco de Questões + correção server-side (RN-10 com 2 coleções)
- **Fase 9** — Certificados (PDF + QR + Storage) + HTTP público validação + Alertas email (Resend)
- **Integração UI final** no `ProntuarioColaborador.tsx` — seções TrilhaProgressoView + CertificadoViewer + botão "Gerar certificado" ao lado de avaliações aprovadas
- **RN-08 → trigger `ec_onColaboradorCreated`** — migrado de observer client para `onDocumentCreated` server-side (elimina race window + cobre colaboradores criados offline). Observer removido.
- **Cleanup pós-validação** do service — deletadas: `commitExecucaoRealizada`, `commitExecucaoAdiada`, `createAvaliacaoEficacia`, `updateAvaliacaoEficacia`, `createAvaliacaoCompetencia`, `updateAvaliacaoCompetencia` (service) + `generateEcSignature` (ecSignatureService). Hooks `useAvaliacaoEficacia.update` e `useAvaliacaoCompetencia.update` também removidos (sem callers)
- **SMOKE_E2E_CHECKLIST.md** criado — roteiro 7 passos detalhado

## Desvios declarados do plano original (mantidos)

- **Rota pública do QR** foi implementada como **Cloud Function HTTP pública** (`validarCertificadoEc`) em vez de rota `/cert/{id}` no SPA. Motivo: evita tocar em `App.tsx` (fora do escopo do módulo). URL do QR: `https://southamerica-east1-hmatologia2.cloudfunctions.net/validarCertificadoEc?lab=X&cert=Y`

## O que quero fazer nesta sessão

[DESCREVA AQUI O PRÓXIMO PASSO]

---

## Como usar esse arquivo

1. Abre nova aba/sessão do Claude Code
2. Cola o bloco entre os `---` acima
3. Preenche a última linha com o que você quer fazer
4. O Claude carrega o skill, lê o CLAUDE.md e entra em contexto em 2 tool calls
