# Phase 10: Liberação + Críticos — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Discuss-phase inline (4 perguntas críticas) + síntese Obsidian + roadmap v1.3

<domain>
## Phase Boundary

**O que esta phase entrega:**

Primeiro módulo de laudo do HC Quality. Workflow híbrido de liberação (auto-liberar rotina, RT revisa críticos), valores críticos com thresholds parametrizáveis e comunicação por email + log imutável, geração de PDF com os 14 campos RDC 978 Art. 167, QR code de validação, e portal externo para médicos solicitantes acessarem laudos de seus pacientes.

3 surfaces deployadas:

- `/liberacao` (RT + técnico)
- `/criticos/admin` (gestão de thresholds)
- `/portal-medico` (médico solicitante externo)

**O que NÃO entrega (deferido):**

- ICP-Brasil A1/A3 (LogicalSignature suficiente; upsell v1.4)
- SMS via Twilio/Zenvia (email apenas no MVP; defer v1.4)
- WhatsApp Business (defer v1.4 + aprovação Meta)
- Worklab integração reversa (escrita "Liberado" back) — defer v1.4 (depende API Worklab)
- Portal paciente (acesso pelo paciente final ao laudo) — milestone separado
- Notificação push mobile — defer (HC Quality Mobile já em prod, mas focado em CIQ)
- Imprimir laudo direto (recepção do lab cuida) — fora de escopo

**Compliance alvo:**

- RDC 978/2025 Arts. 167 (14 campos), 184-191 (críticos + liberação)
- DICQ 4.3 — Bloco G (5.7.1, 5.7.2, 5.7.3 parcial — só log de comunicação), Bloco I (5.8.1, 5.8.2, 5.8.3, 5.9.1, 5.9.2, 5.9.3)
- ISO 15189 (papel RT na liberação)
- Portaria 204 MS — defer notificação NOTIVISA (interface manual no MVP)

</domain>

<decisions>
## Implementation Decisions

### Locked (CTO via discuss-phase 2026-05-06)

#### 1. Assinatura RT

- **LogicalSignature SHA-256** seguindo ADR 0001
- Cada liberação gera doc imutável com:
  ```typescript
  signature: {
    operatorId: UserId; // RT que liberou
    operatorRole: 'RT' | 'RT-Substituto' | 'Sistema'; // 'Sistema' só em auto-liberação
    operatorName: string;
    operatorRegistro: string; // CRBM, CRF, CRM, CRBio etc
    timestamp: Timestamp; // server-side
    hash: string; // SHA-256(canonical(payload + chainHash))
    chainHash: string; // chain do lab (ADR 0001 pattern)
  }
  ```
- Validação client-side mostra "🔒 Assinado por {operatorName} ({operatorRegistro}) em {timestamp}"
- Validação server-side: `recordRunBioquimica` pattern (chainHash recalculado server-side)
- ICP-Brasil A1/A3 fica como upgrade v1.4 (sem retrabalho de schema — apenas adiciona campo `icpSignature?: string`)

#### 2. State machine híbrida

**Estados:**

1. `Pendente` — laudo criado pelo técnico, aguardando revisão
2. `Em Revisão` — RT abriu modal de revisão (lock soft)
3. `Liberado` — RT autorizou (signature criada)
4. `Auto-Liberado` — sistema liberou automaticamente (signature operatorRole = 'Sistema')
5. `Comunicado` — críticos comunicados (se aplicável); senão pula direto
6. `Superado` — versão substituída por nova (retificação)

**Classificação de exame (exameClassifier):**

- `rotina` — auto-libera se: Westgard OK + amostra não-restrita + sem crítico detectado
- `revisao-rt` — sempre exige RT (exames hormonais, hemograma manual, citologia, PCR diagnóstico)
- `bloqueio-critico` — exames onde QUALQUER valor crítico bloqueia liberação (ex: cultura positiva, marcadores tumorais)

**Configuração:**

- UI admin `/liberacao/admin/exames` permite lab classificar cada exame
- Default: 80% rotina, 20% revisao-rt (CTO valida com RT Riopomba)
- Audit log toda mudança de classificação

**Atalho condicional auto-liberação:**

```typescript
// Pseudo-code
function shouldAutoRelease(laudo: Laudo, classification: ExamClassification): boolean {
  if (classification === 'revisao-rt') return false;
  if (classification === 'bloqueio-critico' && hasCritico(laudo)) return false;
  if (laudo.westgardViolations.some((v) => v.severity === 'reject')) return false;
  if (laudo.amostra.restricoes.length > 0) return false;
  return true;
}
```

#### 3. Comunicação críticos

- **Email apenas no MVP** (sem SMS/WhatsApp). Provedor: Resend (já no stack via `resend@4.5.2`).
- **Thresholds parametrizáveis** por lab via `/criticos/admin`:
  - Por analito (ex: Glicose < 50 mg/dL OU > 400 mg/dL)
  - Opcionalmente condicional por idade/sexo (ex: Hb < 7 g/dL em adulto, < 5 em pediatria)
  - Severidade: 'alta' (vermelho) | 'baixa' (amarelo)
- **Detecção em tempo real:** ao criar/aprovar Run, função server-side roda `detectCriticos(resultados, thresholds)` e flagga laudo
- **SLA configurável por lab:**
  - Default: alerta 30 min, bloqueador 60 min, escalação supervisor 90 min
  - SLA_MAX = 120 min (after which laudo fica "retido" até comunicação confirmada)
- **UI registro verbal:**
  - Modal com timestamp + nome receptor (médico ou enfermeira) + nome RT comunicador + observação
  - LogicalSignature do RT comunicador
  - Audit log imutável `/labs/{labId}/comunicacoes/{comunicacaoId}`
- **Cron escalação:** function `escalarCritico` roda a cada 5 min, alerta se SLA extrapolado

#### 4. Saída do laudo (multi-canal)

- **PDF com 14 campos RDC 978 Art. 167** — Puppeteer + template HTML pixel-perfect
- **QR code de validação** — canto inferior direito; aponta para `/api/validar-laudo/{laudoId}/v{version}` (endpoint público, rate-limited 60req/h por IP)
  - Endpoint retorna metadata sem PII: `{ hash, rt: { name, registro }, timestamp, version, isCurrent: bool, lab: { name, cnes } }`
  - Permite auditor verificar "este PDF é o original" sem expor dados sensíveis
- **Email transacional via Resend** com PDF anexo
  - Tracking opcional (opened/clicked) via Resend webhook
  - SPF + DKIM + DMARC configurados
  - Fallback inbox: alerta visual no dashboard se quarantena/bounce
- **Portal médico** (`/portal-medico`):
  - Auth externa Firebase Auth com claim `medicoSolicitante: true` + `crm: string` + `crmUf: string`
  - Médico vê apenas laudos onde `medicoSolicitanteId === request.auth.uid`
  - Multi-tenant transversal: médico atende vários labs (filtro por lab no dashboard)
  - Onboarding: lab convida médico via email → médico cadastra senha → CRM validado contra Worklab
  - Dark-first design (consistente)

#### 5. Histórico de versões (mandatório RDC 978 Art. 167 + DICQ 5.9.3)

- **Retificação cria nova versão imutável** — v1 não é editado
- Schema: `/labs/{labId}/laudos/{laudoId}` (master) + `/labs/{labId}/laudo-versions/{versionId}`
- Cada versão tem:
  - `version: number` (1, 2, 3...)
  - `supersededBy: string | null` (versionId da versão que substituiu)
  - `motivoRetificacao: string` (obrigatório a partir de v2)
  - LogicalSignature
  - chainHash
- UI:
  - LaudoDetail mostra versão corrente + dropdown "Ver histórico"
  - Versões antigas marcadas como "Superado" (badge cinza)
  - Download de versão antiga é permitido mas com banner "ATENÇÃO: existe versão mais recente"
- Storage: `gs://hmatologia2.appspot.com/laudos/{labId}/{laudoId}/v{version}.pdf` (cada versão em arquivo separado)
- Limite: 20 versões por laudo (UI bloqueia v21; caso real: nunca atingido em prática)

#### 6. Médico solicitante (master = Worklab)

- Sync nightly de `/api/worklab/medicos` → cache local em `/labs/{labId}/medicos-solicitantes/{medicoId}`
- Campos: `id, name, crm, crmUf, ativo, ultimoSync`
- HC Quality não permite cadastro/edição local (master = Worklab)
- Se médico inativado no Worklab: cache flagga `ativo: false`, mas histórico permanece (não deletar)
- Portal médico: permite "claim" de cadastro — médico digita CRM, sistema valida contra cache, envia email de confirmação

#### 7. Schema Firestore

```
/labs/{labId}/
  laudos/{laudoId}                    # master de laudos
  laudo-versions/{versionId}          # versões imutáveis
  comunicacoes/{comunicacaoId}        # log imutável de comunicação crítica
  criticos-thresholds/{thresholdId}   # config de thresholds por analito
  exames-config/{exameId}             # classificação rotina/revisao-rt/bloqueio-critico
  medicos-solicitantes/{medicoId}     # cache do Worklab

/global-portal-medico/                # workspace do portal médico (top-level)
  invitations/{invitationId}          # convites pendentes
  audit/{logId}                       # audit do portal
```

**Convenções multi-tenant aplicadas:**

- `labId` redundante em todos os payloads
- Soft-delete only (LaudoDelete = soft, mantém histórico para auditoria)
- LogicalSignature obrigatório em create de laudo-versions e comunicacoes
- `allow delete: if false` em laudos, laudo-versions, comunicacoes
- Indexes:
  - `(labId, status, criadoEm)` em laudos
  - `(labId, criticoFlag, comunicado, criadoEm)` em laudos
  - `(labId, laudoId, version)` em laudo-versions
  - `(medicoSolicitanteId, criadoEm)` em laudos (para portal médico)

#### 8. Cloud Functions (callable, region southamerica-east1)

| Function                     | Propósito                                                         | Auth + validação                       |
| ---------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `criarLaudo`                 | Cria laudo a partir de runs aprovadas (chama auto-release engine) | `isActiveMemberOfLab` + Zod payload    |
| `liberarLaudo`               | RT libera manualmente; cria versão + signature + chainHash        | `isActiveMemberOfLab` + claim RT       |
| `retificarLaudo`             | Cria nova versão; v anterior fica supersededBy                    | `isActiveMemberOfLab` + claim RT       |
| `detectarCriticos`           | Trigger onCreate em laudos: roda thresholds + flag                | Internal (não exposto)                 |
| `enviarComunicacaoEmail`     | Email via Resend para médico solicitante (PDF anexo)              | `isActiveMemberOfLab` + claim RT       |
| `registrarComunicacaoVerbal` | Cria doc imutável de comunicação verbal                           | `isActiveMemberOfLab` + signature      |
| `escalarCritico`             | Cron 5min: alerta supervisor se SLA extrapolado                   | Scheduler                              |
| `generateLaudoPDF`           | Puppeteer render + Storage upload + return signed URL             | `isActiveMemberOfLab`                  |
| `validarLaudoPublico`        | Endpoint público; retorna metadata sem PII                        | Rate-limited (60req/h/IP)              |
| `convidarMedicoPortal`       | RT convida médico via email                                       | `isActiveMemberOfLab` + claim RT/admin |
| `aceitarConvitePortal`       | Médico aceita convite; cadastra senha; CRM validado               | Auth flow                              |
| `syncMedicosWorklab`         | Cron nightly: sync /api/worklab/medicos → cache                   | Scheduler                              |

#### 9. Roteamento

- `/liberacao` — dashboard de RT/técnico (lazy)
- `/liberacao/admin/exames` — classificação de exames (claim adminLab)
- `/criticos/admin` — gestão de thresholds (claim adminLab ou RT)
- `/portal-medico` — portal externo (claim medicoSolicitante)
- `/portal-medico/convite/{token}` — onboarding via convite
- `/api/validar-laudo/{laudoId}/v{version}` — endpoint público (sem auth)

#### 10. Bundle/manualChunks

```typescript
manualChunks: {
  'module-liberacao': ['./src/features/liberacao'],
  'module-criticos': ['./src/features/criticos'],
  'module-portal-medico': ['./src/features/portal-medico'],
}
```

### Claude's Discretion (não ditado pelo usuário)

- **Domain naming:** `Laudo` vs `Report` — usar `Laudo` (português, alinhado com domínio)
- **Subdomain do portal médico:** path `/portal-medico` (vs subdomínio `medico.hmatologia2.web.app`) — recomendação: path no MVP (sem complicação DNS); subdomínio quando white-label v1.4
- **Layout do PDF:** A4 retrato, 1 página por padrão; fallback 2 páginas para laudos com >12 analitos
- **Cor do laudo PDF:** preto-em-branco (impressão); QR code preto puro; logo lab em branco/cinza
- **Idioma do PDF:** pt-BR (consistente com domínio)
- **Tracking email:** opcional (Resend webhook); default off; ativável por lab
- **CRM validation:** soft-validation (formato CRM/UF) no MVP; integração CFM API só se cliente exigir
- **Tests:** unit em utils puros (stateMachine, exameClassifier, criticoDetector), E2E nos 8 fluxos críticos. Coverage alvo ≥95% em new code

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Estratégico (Obsidian)

- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` — Bloco G + Bloco I + 5.7-5.9
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md` — Arts. 167, 184-191
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_vs_786_vs_DICQ.md` — divergências entre normas
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Checklist_Auditoria.md` — itens 5.7-5.9 + 5.8.3 (14 campos)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Visao.md` — RT papel, brand neutro
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Dossie_Concorrentes_2026-04-28.md` — lacuna mercado
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Decisoes_Abertas.md` — multi-tenant, ICP-Brasil

### Código vivo (HC Quality repo)

- `src/features/auditoria/` — pattern de chainHash + LogicalSignature em sub-coleção (replicar)
- `functions/src/auditoria/generatePDF.ts` — Puppeteer + 10MB limit (replicar)
- `src/features/educacao-continuada/` — assinatura RT + certificados PDF (referência)
- `src/features/analyzer/components/ReviewRunModal.tsx` — pattern RT review + override
- `src/features/insumos/utils/insumoValidation.ts` — validação de amostra restrita reusable
- `src/shared/services/firebaseService.ts` — `subscribeToState` 5 layers
- `firestore.rules` (bloco `auditoria/*`) — template para `liberacao/*`

### ADRs

- `docs/adr/0001-audit-chain.md` — chainHash + LogicalSignature (BASE)
- `docs/adr/0002-multi-tenant-firestore.md` — convenções multi-tenant
- `docs/adr/0007-*.md` — refinamentos pattern
- ADR 0009 (a criar): state machine híbrida + classificação de exame

### Specs/Rules

- `.claude/rules/firestore-security.md` — invariantes
- `.claude/rules/performance.md` — Web Vitals + manualChunks
- `.claude/rules/deploy-protocol.md` — ordem deploy
- `.claude/rules/module-protection.md` — isolamento módulos

### Skills aplicáveis

- `hcq-firestore-rules-generator` — bloco rules para liberacao + criticos + portal
- `hcq-ciq-audit-trail` — chainHash pattern para liberação
- `hcq-pdf-export-scaffold` — geração de laudo PDF
- `hcq-deploy-gates` — gate pré-merge
- `hm-a11y` — audit AA do portal médico (auth externa exige rigor extra)

</canonical_refs>

<specifics>
## Phase-Specific Constraints

### Bundle budget

- `module-liberacao` ≤ 180KB gzip (lots of UI: ReviewLaudoModal, state machine UI, signature gate)
- `module-criticos` ≤ 80KB gzip (admin focus)
- `module-portal-medico` ≤ 120KB gzip (separado app shell mínimo)
- `vendor-charts` (recharts) — não usado neste módulo (sem charts)

### Firestore custos

- Reads alvo: ≤5 reads/segundo por usuário ativo
- Writes: 1 laudo = 1 doc + 1 audit log + (1 comunicação se crítico) = 2-3 writes
- Volume Riopomba: ~500 laudos/dia = 2500 reads + 1500 writes — confortável
- onSnapshot: máx 4 listeners por usuário (laudos pendentes, em revisão, comunicações pendentes, dashboard)

### Cloud Function quotas

- `liberarLaudo`: ≤2s p99
- `generateLaudoPDF`: ≤15s p99 (Puppeteer)
- `enviarComunicacaoEmail`: ≤5s p99 (Resend API)
- `validarLaudoPublico`: ≤500ms p99 (cache CDN se possível)
- Rate limit `validarLaudoPublico`: 60 req/h/IP (anti-abuse)

### Web Vitals targets (rotas críticas)

- `/liberacao` (RT dashboard): LCP <2.5s, INP <200ms, CLS <0.1
- `/liberacao/laudo/{id}`: LCP <2.5s, INP <150ms (interação rápida com modal)
- `/portal-medico`: LCP <2.5s, INP <200ms (médico tem expectativa de rapidez)
- `/portal-medico/laudo/{id}`: LCP <3s aceitável (PDF preview pode ser pesado)

### Threat model

- **T1: Médico vê laudos de outro médico** — mitigação: rule `medicoSolicitanteId == request.auth.uid` em todas as queries
- **T2: Operador adultera laudo após signature** — mitigação: rules `allow update: if false` em laudo-versions; retificação cria nova versão
- **T3: Endpoint público `validarLaudoPublico` vaza PII** — mitigação: retorna apenas metadata (hash, RT, timestamp, version) sem dados do paciente
- **T4: Brute-force em endpoint público** — mitigação: rate limit 60 req/h/IP + Cloudflare CDN
- **T5: Email phishing impersonando lab** — mitigação: SPF + DKIM + DMARC; subject template fixo; link sempre via QR/portal
- **T6: Médico convidado por engenharia social (fake email)** — mitigação: 2FA opcional; aprovação manual do RT antes de ativar
- **T7: Auto-liberação aprova laudo crítico não detectado** — mitigação: defesa em camadas (classificação + Westgard + thresholds + RT review por exceção); audit log persistente; alerta para RT em todos os auto-liberados
- **T8: Race condition em retificação simultânea (2 RTs)** — mitigação: Firestore transaction garante apenas 1 sucesso; UI mostra "outra versão foi criada" e força refresh
- **T9: Worklab cache desatualizado (médico CRM antigo)** — mitigação: sync nightly + manual refresh button; UI mostra `ultimoSync`

### Performance profile

- Volumes Riopomba: ~500 laudos/dia, ~50 críticos/dia, ~150 médicos solicitantes ativos
- Picos: 9h-12h (manhã coletas), 16h-18h (resultados saindo)
- Caching agressivo: lista de médicos, classificações de exames (cached 1h)
- `useMemo` em filtros do dashboard; `React.memo` em row components

### Localization

- pt-BR em toda UI
- PDF em pt-BR
- Email subject + body em pt-BR (templates Resend)
- Datas: DD/MM/YYYY HH:mm

### Email transacional

- Provedor: Resend (já em `package.json` de functions)
- Domínio: `notificacoes@hmatologia2.web.app` (configurar SPF + DKIM + DMARC)
- Templates HTML simples, brand neutro (white-label-ready)
- Subject patterns:
  - Laudo: `[HC Quality] Laudo de {paciente_iniciais} disponível`
  - Crítico: `[HC Quality] ATENÇÃO: Valor crítico em laudo de {paciente_iniciais}`
- Tracking: opcional, default off
- Bounce/complaint: webhook → flag médico em "email problemático"

</specifics>

<gotchas>
## Known Pitfalls (de RDC + casos reais documentados)

1. **Comunicação crítica oral sem registro:** caso ANVISA — lab disse "comunicou de viva voz" sem documentar → considerado não-comunicado. Mitigação: UI registro verbal obrigatório com timestamp + receptor + RT comunicador.
2. **Laudo impresso sem assinatura legível:** auditor pode considerar laudo inválido. Mitigação: 14 campos RDC SEMPRE no PDF; QR code adicional pra prova de origem.
3. **Retificação confusa:** paciente recebeu v1, depois lab emitiu v2 → lide judicial. Mitigação: v1 marca "Superado"; UI bloqueia download de v1 sem warning explícito.
4. **Crítico tentou comunicar mas falhou:** médico não atendeu, RT não documentou tentativa. Mitigação: log de tentativas (email entregue/bounce, comunicação verbal) com timestamp; fallback escalação automática.
5. **Auto-liberação desavisada:** RT não percebe que sistema liberou laudos automaticamente. Mitigação: dashboard RT mostra "Auto-liberados últimas 24h" + alerta visual; auditor logger.
6. **Email em spam:** lab perde comunicação. Mitigação: SPF + DKIM + DMARC; alerta visual de quarentena; warm-up domain.
7. **Volume de versões cresce sem limite:** storage custo. Mitigação: máx 20 versões por laudo (UI bloqueia v21); Glacier após 1 ano.
8. **Multi-tenant labId leak:** médico vê laudo de outro lab. Mitigação: rule check `labId` em path + payload; testes E2E cross-tenant.
9. **CRM validation soft:** sistema aceita CRM falso. Mitigação: V1 = soft validation (formato); v1.4 = integração CFM API (Phase 11+).
10. **Race condition em comunicação dupla:** RT comunica e técnico também → 2 docs de comunicação. Mitigação: idempotência por `signature.hash`; UI mostra status real-time.
11. **Worklab API offline:** sync de médicos falha. Mitigação: cache local persistente; UI "última sync há X horas"; manual refresh button.
12. **PDF gerado em horário pico:** 500 laudos batendo Puppeteer simultaneamente → timeout. Mitigação: queue assíncrona (Pub/Sub); status "Gerando..." no UI; limite 100 PDFs/min/lab.

</gotchas>
