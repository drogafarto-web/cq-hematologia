# Phase 11: Feedback Loop — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Discuss-phase inline (4 perguntas críticas) + síntese Obsidian + roadmap v1.3

<domain>
## Phase Boundary

**O que esta phase entrega:**

Feedback loop completo para o HC Quality cobrindo 3 itens DICQ em phase combinada: reclamações com RCA estruturado + satisfação NPS + sugestões. Multi-canal de entrada (6 canais, incluindo deep link no app de laudos Worklab), classificação automática via Gemini IA com aprovação RT, integração automatizada com módulo NC existente (severity alta cria NC draft), portal cliente externo onde paciente acompanha status de reclamações e sugestões, trending dashboard com Pareto e indicadores específicos para Análise Crítica Direção (DICQ 4.15).

4 surfaces deployadas:
- `/reclamacoes` (interno — RT + Qualidade)
- `/satisfacao` (admin de pesquisas NPS)
- `/sugestoes` (interno + público)
- `/portal-paciente` (auth externa — paciente acompanha)

Plus integração externa via deep link parametrizado para Worklab LIS embed seu app.

**O que NÃO entrega (deferido):**

- Ishikawa visual (5 Whys cobre MVP; Ishikawa vira upgrade v1.4)
- WhatsApp Business para notificação (defer v1.4 + aprovação Meta)
- Integração ouvidoria/PROCON (defer v1.5+)
- Integração CFM API (validação CRM rigorosa)
- IA auto-resolução de reclamações simples (defer v1.4 quando dataset for >500 reclamações)
- Incentivo NPS via sorteio/voucher (defer; questões legais Brasil)

**Compliance alvo:**

- DICQ 4.3 — 4.8 (Reclamações), 4.14.3 (Satisfação), 4.14.4 (Sugestões), 4.14.6 (Risco), 4.15 (Análise Crítica)
- RDC 978/2025 — Arts. 86, 115, 117 (retenção 5 anos de registros)
- CDC Lei 8.078/90 — Arts. 6, 26 (prazo resposta)
- LGPD Lei 13.709/18 — Arts. 7, 8, 9, 11, 18
- ISO 15189:2015 — §4.8, §5.6.1 (feedback loop completo)

</domain>

<decisions>
## Implementation Decisions

### Locked (CTO via discuss-phase 2026-05-06)

#### 1. Canais de entrada de reclamação (6 canais)
1. **Web form interno** (`/reclamacoes/nova`) — recepção cadastra reclamação por telefone/balcão
2. **Web form público** (`/portal-paciente/reclamacao/nova`) — paciente acessa direto sem login (gera token anti-spam via reCAPTCHA)
3. **Email parser** (`reclamacoes@hmatologia2.web.app`) — Cloud Function recebe via SendGrid Inbound Parse OU Resend Inbound (preferir Resend por já estar no stack)
4. **Telefone log manual** — UI de cadastro com confirmação por SMS opcional (defer v1.4)
5. **QR no laudo** — PDF de Plan 10-04 inclui QR adicional apontando para `/portal-paciente/reclamacao/nova?examCode=XXX&laudoId=YYY`
6. **Deep link Worklab** — Worklab adiciona link no app deles: `https://hmatologia2.web.app/portal-paciente/reclamacao/nova?source=worklab&examCode=XXX&cpf=YYY&v=1`

**Identificação obrigatória:** Reclamação requer CPF + nome + email/telefone. Reclamação anônima NÃO permitida no MVP (impede LGPD compliance + dispar NC + comunicação resolução). Anonimização ocorre apenas em análise agregada após 90 dias.

#### 2. Schema central — Reclamacao
```typescript
export interface Reclamacao {
  id: string;
  labId: LabId;
  // Identificação reclamante
  reclamante: {
    nome: string;
    cpf: string;
    email?: string;
    telefone?: string;
    consentimentoLgpd: { aceito: boolean; em: Timestamp; ipAddress: string; userAgent: string };
  };
  // Origem
  canalEntrada: 'web-interno' | 'web-publico' | 'email' | 'telefone' | 'qr-laudo' | 'worklab-deep-link';
  origemDados: { source: string; metadata: Record<string, any> };  // ex: examCode + laudoId
  recebidoEm: Timestamp;
  // Conteúdo
  descricao: string;             // texto livre original
  anexos: { storageUrl: string; mimeType: string; size: number }[];
  // Classificação (IA + RT)
  classificacaoAuto?: ClassificacaoAuto;  // sugestão Gemini
  classificacao: {
    tipo: 'laudo-errado' | 'demora' | 'atendimento' | 'valor-cobrado' | 'amostra-hemolisada' | 'outro';
    severidade: 'alta' | 'media' | 'baixa';
    areaResponsavel: 'analitico' | 'pre-analitico' | 'pos-analitico' | 'comercial' | 'recepcao' | 'outro';
    aprovadoPor: UserId;
    aprovadoEm: Timestamp;
  };
  // Workflow
  status: 'Nova' | 'Analisando' | 'RCA' | 'Resolvida' | 'Comunicada' | 'Fechada';
  slaPrazo: Timestamp;            // 30 dias do recebidoEm (CDC)
  responsavelId: UserId;           // RT ou Qualidade designado
  // RCA (preenchido durante Analisando → RCA)
  rcaFiveWhys?: RCAFiveWhys;
  acoesCorretivas?: AcaoCorretiva[];
  // NC vinculada (se severity alta)
  ncId?: string;                   // referência ao módulo NC existente
  ncStatus?: 'draft' | 'aprovada' | 'rejeitada';
  // Resolução
  resolucao?: {
    descricao: string;
    eficacia: { verificadaEm: Timestamp; verificadaPor: UserId; resultado: 'eficaz' | 'parcial' | 'ineficaz' };
  };
  resolvidoEm?: Timestamp;
  // Comunicação
  comunicacoes: ComunicacaoCliente[];   // emails enviados, status delivery
  // NPS pós-resolução
  npsResposta?: NPSResposta;
  // LGPD
  anonimizadoEm?: Timestamp;       // após 90d ou request
  // Audit
  signature: LogicalSignature;
  chainHash: string;
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;    // soft-delete (audit)
}

export interface RCAFiveWhys {
  problema: string;
  porques: { nivel: 1 | 2 | 3 | 4 | 5; pergunta: string; resposta: string }[];
  causaRaiz: string;
  preenchidoPor: UserId;
  preenchidoEm: Timestamp;
}

export interface ClassificacaoAuto {
  tipoSugerido: string;
  severidadeSugerida: string;
  areaSugerida: string;
  confidence: number;              // 0-1
  modeloVersao: string;            // 'gemini-2.5-flash@2026-06'
  rawResponse: string;             // raw output Gemini para audit
  geradoEm: Timestamp;
}
```

#### 3. RCA — 5 Whys integrado
- UI: 5 inputs sequenciais; cada resposta vira pergunta do próximo nível
- Validação: pelo menos 3 níveis preenchidos antes de submit
- Causa raiz: campo livre; pode-se sugerir baseado em respostas (heurística)
- Persistência: snapshot imutável após submit; edits criam nova versão

#### 4. NC auto-trigger
- Severity 'alta' → trigger Cloud Function cria NC draft no módulo `naoconformidades`
- NC inclui: link para reclamação, RCA inicial, sugestão de CAPA baseada em casos similares (heurística simples no MVP, IA em v1.4)
- RT recebe alerta no dashboard: "1 NC draft pendente de aprovação"
- Fluxo: NC draft → RT aprova/rejeita → se aprovada, segue workflow NC normal; se rejeitada, motivo registrado em audit log
- Idempotência: hash da reclamação + tipo previne duplicatas

#### 5. Classificação automática Gemini
- Modelo: `gemini-2.5-flash` (já no stack via `@google/genai`)
- Prompt estruturado:
  ```
  Você é assistente de qualidade laboratorial. Classifique a reclamação abaixo:

  Texto: "{descricao}"

  Retorne JSON:
  {
    "tipo": "laudo-errado" | "demora" | "atendimento" | "valor-cobrado" | "amostra-hemolisada" | "outro",
    "severidade": "alta" | "media" | "baixa",
    "areaResponsavel": "analitico" | "pre-analitico" | "pos-analitico" | "comercial" | "recepcao" | "outro",
    "confidence": 0.0-1.0,
    "justificativa": "{texto curto explicando}"
  }

  Severidade alta: laudo errado, dano clínico potencial, atendimento agressivo.
  Severidade média: demora >7 dias, valor cobrado errado.
  Severidade baixa: sugestões de melhoria, comentários gerais.
  ```
- RT vê sugestão + edit → aprovação cria classificação final
- Métrica: % aceite (target ≥80%); rejeições alimentam fine-tuning futuro
- Fallback: se Gemini falha (timeout, erro), reclamação fica `Nova` sem classificação automática (RT classifica manual)

#### 6. NPS — Pós-resolução + recurring trimestral
**Pós-resolução:**
- Trigger: quando reclamação muda para `Resolvida`
- Email automático via Resend: "Sua reclamação foi resolvida. Como ficou sua experiência?"
- Link único (token) → `/portal-paciente/nps/{token}`
- 1 pergunta: NPS 0-10 + comentário opcional
- Token expira em 14 dias

**Recurring trimestral:**
- Cron Pub/Sub Scheduler: trimestral (15 de jan, abr, jul, out)
- Segmenta: pacientes que tiveram pelo menos 1 laudo nos últimos 12 meses
- Email batch via Resend: 1000 emails/min rate limit
- Mesmo formato: NPS 0-10 + comentário
- Anonimização automática: respostas atribuídas a `respostaId` (uuid), não a CPF

**Schema NPSResposta:**
```typescript
export interface NPSResposta {
  id: string;
  labId: LabId;
  pacienteId?: string;              // null após anonimização (90d)
  origem: 'pos-resolucao' | 'recurring-trimestral';
  reclamacaoId?: string;            // se pós-resolução
  trimestreRecurring?: string;      // '2026-Q1' se recurring
  nota: number;                     // 0-10
  categoria: 'detrator' | 'neutro' | 'promotor';   // 0-6 / 7-8 / 9-10
  comentario?: string;
  respondidoEm: Timestamp;
  ipHash: string;                   // anti-spam, não-PII
  anonimizadoEm?: Timestamp;
}
```

#### 7. Sugestões — módulo separado
- Surface `/sugestoes`:
  - Interno (colaboradores autenticados): web form + lista
  - Público (paciente via portal): web form simples
- Schema `Sugestao`:
  ```typescript
  {
    id, labId, autorId?, autorTipo: 'colaborador' | 'paciente' | 'externo',
    titulo, descricao, categoria: 'produto' | 'processo' | 'ambiente' | 'atendimento' | 'outro',
    status: 'aberta' | 'analisada' | 'implementada' | 'rejeitada',
    motivoRejeicao?, dataImplementacao?,
    votos: number,           // colaboradores podem upvote
    comentarios: { autorId, texto, em }[],
    auditoria...
  }
  ```
- Workflow simples (sem RCA): aberta → analisada (qualidade triagem) → implementada/rejeitada
- Notificação ao autor por email a cada status change

#### 8. Portal cliente — `/portal-paciente`
- Auth externa: CPF + senha
- Onboarding: paciente cadastra senha após primeiro contato (lab convida via email após cadastro de exame, OU paciente se cadastra direto via portal público)
- Custom claim: `paciente: true` + `cpf: string`
- Multi-tenant transversal: paciente atende múltiplos labs; LabSwitcher
- 2FA opcional (Firebase Auth phone)
- Dashboard:
  - Reclamações suas (status, prazos, resolução)
  - Sugestões enviadas
  - Histórico de laudos (read-only via Plan 10-05 pattern)
  - Pesquisa NPS pendentes
  - Notificações
- LGPD: tela "Meus Dados" — exportar registro completo, solicitar exclusão (anonimização)

#### 9. Trending dashboard — `/reclamacoes/insights`
- KPIs principais:
  - **NPS evolução** (line chart trimestral; alvo industria saúde: ≥40)
  - **Taxa reclamações/mês** (bar chart, segmentada por tipo)
  - **RCA closure rate** (% reclamações com RCA finalizado dentro do SLA 30d)
  - **Pareto top 5 tipos** (gráfico Pareto cumulativo)
  - **Heatmap por área responsável** (color-coded; verde→vermelho)
  - **NPS score breakdown:** % detratores / neutros / promotores
- Filtros: período, tipo, severidade, área, status
- Exportação: PDF (via Puppeteer, replica pattern auditoria) + JSON (para Management-Review module Phase 8)

#### 10. Integração 4.15 Análise Crítica Direção (Phase 8 module)
- Phase 8 cria módulo `management-review` com 15 entradas obrigatórias
- Phase 11 alimenta 4 dessas entradas:
  - Satisfação cliente (NPS evolução + comentários relevantes)
  - Sugestões (status, implementadas, rejeitadas)
  - Reclamações (volume, RCA closure, eficácia)
  - Melhoria contínua (ações decorrentes)
- Integração: callable `exportarParaAnaliseCritica(labId, periodoInicio, periodoFim)` retorna JSON estruturado

#### 11. LGPD framework
- **Base legal:**
  - Reclamações: obrigação legal (RDC 978 retenção 5a) + consentimento explícito para coleta
  - NPS: legítimo interesse (melhoria do serviço) + opt-out claro
  - Sugestões: consentimento explícito (autor decide se identifica)
- **Consentimento UI:** checkbox obrigatório em web forms; copy claro em pt-BR
- **Retenção:** 5 anos com PII (RDC 978); após, anonimização automática preserva dados estatísticos
- **Anonimização após 90d (NPS):** respostas perdem `pacienteId`, mantém apenas `respostaId` uuid
- **Direito de acesso (Art. 18):** `/portal-paciente/meus-dados` permite export JSON + PDF de todos os registros do paciente
- **Direito de exclusão:** botão "Solicitar exclusão" → cria task em `/labs/{labId}/lgpd-requests/{requestId}`; admin processa em ≤15 dias úteis (LGPD Art. 19)
- **Logs LGPD:** toda operação sobre dados pessoais cria entry em `lgpd-audit` (quem acessou, quando, motivo)
- **Anonimização de comentários NPS livres:** se contém PII (nome próprio, telefone), passa por filtro Gemini que sugere redação; RT aprova

#### 12. Schema Firestore

```
/labs/{labId}/
  reclamacoes/{reclamacaoId}                 # master
  reclamacoes-versions/{versionId}            # versões imutáveis (retificação)
  sugestoes/{sugestaoId}
  satisfacao-respostas/{respostaId}
  satisfacao-campanhas/{campanhaId}           # cron trimestral metadata
  rca-templates/{templateId}                  # 5 Whys + Ishikawa templates
  comunicacoes-cliente/{comunicacaoId}        # email log imutável
  lgpd-requests/{requestId}                   # exports + exclusões
  lgpd-audit/{logId}                          # operações sobre PII
  feedback-classificacao-auto/{logId}         # IA logs (audit)

/global-portal-paciente/                       # workspace top-level
  invitations/{invitationId}
  pacientes/{uid}                             # claim paciente
  audit/{logId}
```

**Indexes principais:**
- reclamacoes: `(labId, status, criadoEm DESC)`
- reclamacoes: `(labId, severidade, status, criadoEm DESC)`
- reclamacoes: `(labId, pacienteId, criadoEm DESC)`
- sugestoes: `(labId, status, criadoEm DESC)`
- satisfacao-respostas: `(labId, origem, respondidoEm DESC)`

#### 13. Cloud Functions (callable, region southamerica-east1)

| Function | Propósito |
|----------|-----------|
| `criarReclamacao` | Callable: paciente/recepção cria reclamação; dispara classificação Gemini + NC auto |
| `classificarReclamacaoIA` | Internal: Gemini classifica + retorna sugestão |
| `aprovarClassificacao` | Callable RT: aprova/edita sugestão Gemini |
| `criarNCDraft` | Internal trigger: severity alta → NC draft em `naoconformidades` |
| `transitarReclamacao` | Callable: muda status com signature; valida transição |
| `enviarComunicacaoReclamante` | Callable: email Resend a cada status change |
| `dispararNPSPosResolucao` | Trigger onUpdate: status → Resolvida → email NPS |
| `dispararNPSRecurring` | Cron trimestral: batch email |
| `submitNPSResposta` | Callable público (token-based): paciente responde |
| `anonimizarRespostas` | Cron daily: anonimiza respostas >90d |
| `criarSugestao` | Callable: cria sugestão (interno ou público) |
| `transitarSugestao` | Callable: aberta → analisada → implementada/rejeitada |
| `parseEmailReclamacao` | HTTPS endpoint: Resend Inbound parser |
| `convidarPaciente` | Callable: lab convida paciente para portal |
| `aceitarConvitePaciente` | Callable: paciente cria senha + custom claim |
| `exportarMeusDadosLgpd` | Callable: gera JSON + PDF dos dados do paciente |
| `solicitarExclusaoLgpd` | Callable: cria request de exclusão |
| `exportarParaAnaliseCritica` | Callable: JSON para Management-Review (Phase 8) |
| `gerarRelatorioInsightsPDF` | Callable: PDF do dashboard trending |

#### 14. Roteamento
- `/reclamacoes` — dashboard interno (RT + Qualidade)
- `/reclamacoes/nova` — recepção cadastra (interno)
- `/reclamacoes/{id}` — detalhe + RCA + ações
- `/reclamacoes/insights` — trending dashboard
- `/satisfacao` — admin de pesquisas NPS
- `/sugestoes` — surface combinada (interno + público leitura)
- `/sugestoes/nova` — submit (auth required, mesmo workspace)
- `/portal-paciente` — dashboard paciente (auth externa)
- `/portal-paciente/reclamacao/nova` — form público (com reCAPTCHA)
- `/portal-paciente/nps/{token}` — pesquisa NPS via token
- `/portal-paciente/meus-dados` — LGPD direito de acesso

#### 15. Bundles
```typescript
manualChunks: {
  'module-reclamacoes': ['./src/features/reclamacoes'],
  'module-satisfacao': ['./src/features/satisfacao'],
  'module-sugestoes': ['./src/features/sugestoes'],
  'module-portal-paciente': ['./src/features/portal-paciente'],
}
```

### Claude's Discretion (não ditado pelo usuário)

- **Tipo de reclamação predefinidos:** 6 categorias (laudo-errado, demora, atendimento, valor-cobrado, amostra-hemolisada, outro). Lab pode adicionar custom em v1.4.
- **NPS escala 0-10** (padrão Net Promoter Score original; categoria detrator 0-6, neutro 7-8, promotor 9-10).
- **reCAPTCHA v3 invisível** em web forms públicos (paciente não vê mas anti-spam funciona).
- **SLA tracker visual:** chip colorido na lista (verde se >7d restantes, amarelo se 1-7d, vermelho se atrasado).
- **Email templates:** brand neutro (white-label-ready), tom empático ("Lamentamos o ocorrido..."), CTA primário "Acompanhar reclamação".
- **Responsividade:** mobile-first em surfaces públicas (paciente provavelmente usa celular); desktop em surfaces internas (RT/Qualidade).

</decisions>

<canonical_refs>
## Canonical References

### Estratégico (Obsidian)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` — 4.8, 4.14.3, 4.14.4, 4.14.6, 4.15
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md` — Arts. 86, 115, 117
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Checklist_Auditoria.md` — 4.8, 4.14.x, 4.15
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Visao.md` — diferenciação produto
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Dossie_Concorrentes_2026-04-28.md` — lacuna
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Decisoes_Abertas.md` — LGPD
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Zero_Acreditacao\` — Módulo 1.9 (template PNCQ)

### LGPD/Lei
- LGPD Lei 13.709/18 — Arts. 7, 8, 9, 11, 18
- CDC Lei 8.078/90 — Arts. 6, 26
- ANPD Guia Orientativo

### Código vivo
- `src/features/auditoria/` — pattern checklist + achados + status workflow
- `src/features/educacao-continuada/` — pesquisa de satisfação (referência NPS)
- `src/features/portal-medico/` (Plan 10-05) — pattern auth externa (REPLICAR)
- `src/features/sgq/` — pattern documental
- `src/features/naoconformidades/` (já existente parcial) — workflow NC + RCA
- `src/features/management-review/` (Phase 8 plan 04) — destino de exportarParaAnaliseCritica

### ADRs
- ADR 0001 (audit chain)
- ADR 0002 (multi-tenant)
- ADR 0010 (portal externo Plan 10) — replicar pattern para portal-paciente
- ADR 0011 (a criar): feedback loop architecture + LGPD framework

### Skills
- `hcq-firestore-rules-generator` — bloco rules
- `hcq-deploy-gates` — gate pré-merge
- `hm-a11y` — audit AA portal externo
- `firebase-auth-basics` — auth flow paciente
- `firebase-security-rules-auditor` — rules review LGPD
- `claude-api` (Gemini integration) — classificação IA

</canonical_refs>

<specifics>
## Phase-Specific Constraints

### Bundle budget
- `module-reclamacoes`: ≤180KB gzip (RCA UI + dashboard)
- `module-satisfacao`: ≤80KB gzip
- `module-sugestoes`: ≤80KB gzip
- `module-portal-paciente`: ≤140KB gzip (auth + 4 surfaces internas)

### Firestore custos
- Riopomba volume: ~50 reclamações/mês + ~200 NPS/trimestre + ~30 sugestões/mês
- Reads alvo: ≤4 reads/segundo por usuário ativo
- Writes: 1 reclamação = ~5 docs (reclamação + version + audit + comunicação + NC draft se alta)
- onSnapshot: máx 4 listeners por usuário ativo

### Cloud Function quotas
- `classificarReclamacaoIA`: ≤5s p99 (Gemini)
- `dispararNPSRecurring`: até 5min p99 (batch ~5000 emails); usa Pub/Sub para fan-out
- `enviarComunicacaoReclamante`: ≤3s p99
- Rate limit `parseEmailReclamacao`: validação Resend signature + 100 emails/h por domain

### Web Vitals targets
- `/reclamacoes`: LCP <2.5s, INP <200ms, CLS <0.1
- `/reclamacoes/insights`: LCP <3s aceitável (charts Pareto pesados)
- `/portal-paciente`: LCP <2.5s, INP <200ms (paciente espera rapidez)
- `/portal-paciente/reclamacao/nova`: LCP <2s (form público crítico)

### Threat model
- **T1: Reclamação spam via web público** — mitigação: reCAPTCHA v3 + rate limit por IP (5/h) + email confirmation
- **T2: Cross-tenant leak (paciente vê reclamação de outro paciente)** — mitigação: rule `pacienteId == request.auth.uid`
- **T3: Worklab deep link com CPF leaked em URL** — mitigação: token-based em vez de CPF claro; `?token=XXX` resolve para CPF server-side
- **T4: Email parser vira surface de injection** — mitigação: Resend signature verification + parsing strict (não eval); HTML stripping
- **T5: Gemini classificação manipulada via prompt injection no descricao** — mitigação: structured output com Zod parse + RT aprovação obrigatória
- **T6: PII de comentário NPS livre vaza em trending public** — mitigação: filtro Gemini sugere redação; trending agregado (não mostra comments brutos no public)
- **T7: LGPD: dados de paciente excluído ainda aparecem em backups** — mitigação: política de exclusão de backups >5 anos; documentar em ADR 0011
- **T8: Portal paciente CSRF** — mitigação: SameSite=strict cookies; Firebase Auth ID token; CORS strict
- **T9: NC auto-criação spam (atacante cria 1000 reclamações severity alta)** — mitigação: rate limit 10 reclamações/h por reclamante; severity alta requer >100 chars descricao

### LGPD compliance enforcement
- Toda escrita em PII cria entry em `lgpd-audit/{logId}`: `{ uid, action: 'read'|'write'|'delete', resource, motivo, em }`
- Cron `anonimizarRespostas` daily às 03:00 BRT
- Cron `processarLgpdRequests` daily: notifica admin de requests pendentes >7d
- Hard limit retenção 5a: cron `deletarReclamacoesAntigas` mensal (audit log preservado, PII removido)

### Performance profile
- Volumes Riopomba: ~50 reclamações/mês manageable
- Picos: trimestral com NPS recurring (até 5000 emails em batch — usa Pub/Sub queue)
- Caching: lista de tipos/categorias (cached 1h)

### Localization
- pt-BR em toda UI
- Templates email em pt-BR
- Datas: DD/MM/YYYY HH:mm
- Tempo SLA: contado em dias úteis (CDC interpretado conservadoramente)

### Email transacional (Resend, já no stack)
- Templates novos:
  - `reclamacao-recebida` — confirmação ao reclamante
  - `reclamacao-status-update` — a cada transição
  - `reclamacao-resolvida` — inclui CTA NPS
  - `nps-recurring` — pesquisa trimestral
  - `sugestao-recebida` — confirmação ao autor
  - `sugestao-implementada` — quando implementada
  - `convite-portal-paciente` — onboarding

</specifics>

<gotchas>
## Known Pitfalls

1. **Reclamação anônima:** se permitida, impede notificação resolução; se obrigatória, alguns clientes não vão registrar. Mitigação MVP: identificação obrigatória; comunicar copy claro.
2. **PII em descrição livre:** paciente pode escrever CPF/dados sensíveis. Mitigação: filtro Gemini sugere redação antes de RT processar.
3. **NPS recurring saturação:** 5000 emails em 1min satura Resend. Mitigação: Pub/Sub queue + rate limit 1000/min.
4. **Worklab deep link versionado:** se Worklab muda params sem aviso, link quebra. Mitigação: param `v=1` no link; documentar contrato; fallback "link expirado, contate lab".
5. **Gemini hallucina classificação:** Mitigação: confidence <0.6 → flag manual; RT sempre aprova/edita.
6. **NC auto-trigger spam:** atacante cria 100 reclamações severity alta = 100 NCs draft. Mitigação: rate limit reclamações/h por CPF + severity alta requer descricao mínima.
7. **LGPD anonimização parcial:** comentários NPS podem ter PII inline (ex: "Dr. João do CRM 1234 foi grosseiro"). Mitigação: cron analisa comentários >90d e sugere redação; trending dashboard mostra agregado.
8. **Cron trimestral conflita com janelas de manutenção:** Mitigação: agendar 03:00 BRT em dias específicos; configurável por lab.
9. **Email parser cabeçalho fake:** Mitigação: Resend signature verification rigorosa; rejeitar se não validado.
10. **Reclamação com anexo malicioso (vírus):** Mitigação: scan via VirusTotal API antes de Storage upload; quarentena 24h se suspeita.
11. **Portal paciente: tentativa de login brute-force:** Mitigação: rate limit 5 tentativas/15min por IP; lockout temporário.
12. **Análise crítica direção depende de 4 inputs deste módulo:** se Phase 8 management-review não estiver pronto, Phase 11 fica órfã. Mitigação: Phase 8 plan 04 (management-review) é dependency upstream; coordenar com Phase 8 owner.

</gotchas>
