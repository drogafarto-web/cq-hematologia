# CEO Master Plan — HC Quality + Labclin SGQ

> Gerado em 2026-06-01. Plano vivo de execução para o CEO do HC Quality.
> Orquestrado via Paperclip como plataforma de comando.
> Obsidian vault (`C:\Users\labcl\Obsidian_Brain\`) = memória estratégica. Paperclip = execução.

---

## 1. Estado Atual (Snapshot)

| Indicador             | Valor                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Módulos em produção   | 35 (compliance DICQ 78.5%)                                                                        |
| Ondas deployadas      | Onda 1 (rules + indexes)                                                                          |
| Ondas pendentes       | Onda 2 (provisioning), Onda 3 (strict rules, gated), Onda 4 (ciq-audit), Onda 5 (HMAC signatures) |
| Secret HMAC           | ❌ Não setado                                                                                     |
| Rules strict          | ❌ Não aplicadas (gated atrás de Onda 2)                                                          |
| Typecheck (web)       | ✅ Passa limpo                                                                                    |
| Typecheck (functions) | ✅ Passa limpo                                                                                    |
| Paperclip server      | ✅ Rodando em localhost:3100                                                                      |
| HC Quality Firestore  | `hmatologia2` (southamerica-east1)                                                                |
| Labclin SGQ           | ~80 docs no Google Drive (25 PQs, 49 FRs, MQ-001, LM-01)                                          |

---

## 2. Arquitetura Paperclip como Plataforma CEO

```
┌─────────────────────────────────────────────┐
│  Paperclip (localhost:3100)                  │
│  ┌───────────────────────────────────────┐  │
│  │  CEO Dashboard Agent                   │  │
│  │  (status, métricas, decisões pendentes)│  │
│  └───────────────────────────────────────┘  │
│  ┌────────────────────┐ ┌────────────────┐ │
│  │ hcq-architect Agent │ │ labclin-sgq    │ │
│  │ (Ondas, deploys,   │ │ Agent          │ │
│  │  code quality)     │ │ (SGQ import,   │ │
│  │                    │ │  compliance)   │ │
│  └────────────────────┘ └────────────────┘ │
│  ┌───────────────────────────────────────┐  │
│  │  Execution Engine                      │  │
│  │  Projects: hc-quality, labclin-sgq    │  │
│  │  Routines: daily-checks, deploy-flow  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌────────┐   ┌──────────┐   ┌──────────┐
│Firebase│   │Google    │   │Obsidian  │
│  Admin │   │Drive API │   │  Vault   │
│  SDK   │   │(Labclin) │   │(memória)│
└────────┘   └──────────┘   └──────────┘
```

### 2.1 Agentes Planejados

| Agente            | Escopo                                           | Ferramentas                                 | Gatilhos                                        |
| ----------------- | ------------------------------------------------ | ------------------------------------------- | ----------------------------------------------- |
| **hcq-architect** | Ondas 2-5, code review, deploy, Firebase logs    | Firebase Admin SDK, git, npm, Cloud Logging | Novo PR, "executa onda X", "audita código"      |
| **labclin-sgq**   | SGQ documentos, LM-01, Google Drive import       | Google Drive API, Firestore                 | "importa SGQ", "atualiza LM-01", "expande enum" |
| **ceo-dashboard** | Status consolidado, métricas, decisões pendentes | Read-only Firebase, Obsidian vault reader   | "status", "/status", diário 09:00               |

---

## 3. Plano de Execução — Ondas 2-5

### Onda 2: Provisioning de Module Claims

**Status:** ✅ Código pronto. Aguarda execução.

| Passo                | Comando                                                             | Quem          | Ack?         |
| -------------------- | ------------------------------------------------------------------- | ------------- | ------------ |
| 2.1 Dry-run          | `provisionModulesClaims({ dryRun: true })`                          | hcq-architect | Não (read)   |
| 2.2 Analisar diffs   | Revisar report de scanned/updated/unchanged                         | CEO           | Sim          |
| 2.3 Aplicar          | `provisionModulesClaims({ dryRun: false })`                         | hcq-architect | Sim (write)  |
| 2.4 Verificar        | `provisionModulesClaims({ dryRun: true })` — updated deve ser 0     | hcq-architect | Não (read)   |
| 2.5 Deploy Functions | `cd functions && npm run build && firebase deploy --only functions` | hcq-architect | Sim (deploy) |

### Onda 4: ciq-audit Chain

**Status:** ✅ Código pronto. Aguarda Onda 2 ou deploy conjunto.

| Passo                 | Comando                                       | Dependência      |
| --------------------- | --------------------------------------------- | ---------------- |
| 4.1 Build + test      | `cd functions && npm run build && npm test`   | —                |
| 4.2 Deploy Functions  | `firebase deploy --only functions`            | Onda 2 concluída |
| 4.3 Verificar eventos | Smoke: criar run, verificar ciq-audit aparece | Deploy completo  |

### Onda 5: HMAC Signatures (Dual-Write)

**Status:** ✅ Código pronto. ❌ Secret não criado.

| Passo                        | Comando                                                             | Ack?                   |
| ---------------------------- | ------------------------------------------------------------------- | ---------------------- |
| 5.1 Criar secret             | `firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY`             | Sim                    |
| 5.2 Deploy Functions         | `cd functions && npm run build && firebase deploy --only functions` | Sim                    |
| 5.3 Observar 7-14 dias       | Monitorar `SIGNATURE_DIVERGENCE` em auditLogs                       | —                      |
| 5.4 Endurecer rules (Fase 2) | Atualizar firestore.rules.post-onda2                                | Após zero divergências |

### Onda 3: Strict Rules (GATED)

**Status:** ⛔ Bloqueada até Onda 2 verificada.

| Pré-condições                                                   |
| --------------------------------------------------------------- |
| Onda 2 aplicada em produção                                     |
| `provisionModulesClaims({ dryRun: true })` retorna `updated: 0` |
| 48h sem regressão em logs                                       |

---

## 4. Plano de Execução — Labclin SGQ Operations

### 4.1 Expansão do Enum de Tipos de Documento

Problema: LM-01 Lista Mestra contém 15 tipos de documento. SGQ module atual tem apenas 5.

| Tipo LM-01                     | Cobertura atual |
| ------------------------------ | --------------- |
| MQ (Manual da Qualidade)       | ✅              |
| PQ (Procedimento da Qualidade) | ✅              |
| IT (Instrução de Trabalho)     | ✅              |
| FR (Formulário/Registro)       | ✅              |
| POL (Política)                 | ✅              |
| DC (Descrição de Cargo)        | ❌              |
| CT (Contrato)                  | ❌              |
| AN (Anexo)                     | ❌              |
| LG (Legislação)                | ❌              |
| MN (Manual)                    | ❌              |
| PT (Plano de Trabalho)         | ❌              |
| RL (Relatório)                 | ❌              |
| CR (Certificado)               | ❌              |
| AT (Ata)                       | ❌              |
| OF (Ofício)                    | ❌              |

**Ação:** Expandir `DocType` enum em `src/features/sgq/types/` + atualizar todos os forms/validators.

### 4.2 Google Drive SGQ Importer

**Objetivo:** Importar ~80 documentos existentes do Google Drive para o SGQ module.

| Passo         | Descrição                                                                    |
| ------------- | ---------------------------------------------------------------------------- |
| 1. Autenticar | Service account ou OAuth para Google Drive API                               |
| 2. Mapear     | Crawl da pasta SGQ, mapear arquivos → tipos (pelo prefixo do nome)           |
| 3. Importar   | Criar docs no `/labs/{labId}/sgq/` com metadata (tipo, versão, data, status) |
| 4. Vincular   | PDF original como anexo ou link de referência                                |
| 5. LM-01      | Atualizar Lista Mestra automaticamente                                       |

### 4.3 DICQ Blind Spot: Qualidade single-person

**Risco:** Bruno é o único responsável pela qualidade. DICQ exige imparcialidade na auditoria.

**Mitigação (software):**

- Bloquear auto-assinatura de auditoria (regra: auditor != auditado)
- Sugerir rotação automática de auditor quando único qualificado
- Registrar no relatório DICQ como NC de baixa severidade com plano de ação

---

## 5. Paperclip Configuration

### 5.1 LLM Backend

- **Provider:** OpenRouter (`sk-or-v1-...`) como OpenAI-compatible
- **Model:** `openai/gpt-5.3-codex` via Codex CLI adapter (`@paperclipai/adapter-codex-local`)
- **Fallback:** QuickSilver (`deepseek-v4-pro`) para tarefas menores

### 5.2 Projects

| Projeto       | Repo                      | Prioridade |
| ------------- | ------------------------- | ---------- |
| `hc-quality`  | `C:\hc quality\`          | P0         |
| `labclin-sgq` | (sub-projeto do anterior) | P1         |

### 5.3 Routines (automações)

| Rotina              | Frequência       | O que faz                                      |
| ------------------- | ---------------- | ---------------------------------------------- |
| `daily-status`      | Diário 09:00 BRT | Report Onda status, secret status, regressões  |
| `pre-deploy-check`  | On-demand        | Typecheck + lint + test + build gate           |
| `weekly-compliance` | Segundas 08:00   | Roda provisionModuleClaims dry-run, checa logs |

---

## 6. Próximos Passos Imediatos

1. **[NOW] Configurar Paperclip** — Adicionar `OPENAI_API_KEY` ao .env
2. **[NOW] Dry-run Onda 2** — Verificar estado atual das claims
3. **[NOW] Build + test functions** — Garantir Ondas 4-5 compilam
4. **[CEO ack] Deploy Onda 2** — `provisionModulesClaims(dryRun: false)` + deploy functions
5. **[CEO ack] Deploy Ondas 4+5 conjunto** — Build, set secret (Onda 5), deploy functions
6. **[CEO ack] SGQ enum expansion** — +10 doc types
7. **[CEO ack] Deploy Onda 3** — Após 48h de verificação Onda 2

---

## 7. Métricas & Visibilidade

### Dashboard CEO (diário)

- Ondas completadas: 1/5 (20%)
- Secret HMAC: ❌ não setado
- Rules strict: ❌ gated
- CIQ audit events: 0 (triggers não deployados)
- Último deploy: `b744acc` (uroanalise Onda 1 & 2)
- Pending changes: screenshots, gstack skill

### Alvos pós-Ondas 2-5

- Ondas: 5/5 (100%)
- DICQ compliance: 78.5% → 82%+ (com HMAC + ciq-audit)
- RDC 978 critical articles: mantido 100%
- Secret HMAC: rotacionado, ativo
- Rules: strict mode ativo
