# Secrets Coverage Gaps — 2026-05-07

**Project:** `hmatologia2` (Firebase, region `southamerica-east1`)
**Trigger:** ADR-0018 preflight gate (`bash scripts/preflight-secrets-check.sh`) flagged `GEMINI_API_KEY` and `RESEND_API_KEY` as `PENDING_SET_*` placeholders.
**Author:** Claude (Opus 4.7) on behalf of CTO.

---

## Preflight gate output (verbatim)

```
preflight-secrets-check — project hmatologia2
scanning functions/src for defineSecret() declarations...
found 8 declared secret(s):
  - GEMINI_API_KEY
  - HCQ_SIGNATURE_HMAC_KEY
  - OPENROUTER_API_KEY
  - RESEND_API_KEY
  - SMTP_HOST
  - SMTP_PASS
  - SMTP_PORT
  - SMTP_USER

BLOCKED — 2 secret(s) are unprovisioned or unreadable:
  * GEMINI_API_KEY (placeholder: PENDING_SET_GEMINI_API_KEY)
  * RESEND_API_KEY (placeholder: PENDING_SET_RESEND_API_KEY)
```

The other 6 secrets are all set with real values:

| Secret | Status | Value sample |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | OK | `sk-or-v1-…489c06` |
| `HCQ_SIGNATURE_HMAC_KEY` | OK | `d400…3538` (64-char hex, post ADR-0017) |
| `SMTP_HOST` | OK | `smtp.resend.com` |
| `SMTP_USER` | OK | `resend` |
| `SMTP_PASS` | OK | `re_jFLLpNBT_…aqX16` (Resend API key in SMTP form) |
| `SMTP_PORT` | OK | `587` |

Legacy `firebase functions:config:get` returns `{}` — nothing hiding in the deprecated config namespace.

---

## Inventory — `GEMINI_API_KEY`

| File | Function(s) impacted | Reader pattern | Has fallback? |
| --- | --- | --- | --- |
| `functions/src/index.ts:1004` | `extractFromImage`, `analyzeImmunoStrip`, `extractFromBula`, `parseUrinaTira` | `defineSecret('GEMINI_API_KEY')` → `geminiApiKey.value()` passed to `callOcrWithFallback({ geminiKey, openRouterKey })` (line 1246) | **YES** — 2-tier: Gemini direto (Level 1) → OpenRouter catálogo dinâmico (Level 2+). Gemini failure logs `⚠️ Nível 1 falhou: <msg>. Tentando Nível 2...` (line 1278) and continues with OpenRouter (which IS provisioned). |
| `functions/src/bioquimica/parseBulaBioquimica.ts:22` | `parseBulaBioquimica` (callable) | `defineSecret('GEMINI_API_KEY')` → `geminiSecret.value()` passed direct to `GoogleGenerativeAI` constructor (line 123) | **NO fallback.** Sends `PENDING_SET_GEMINI_API_KEY` as API key → Google rejects with 400/401 → `try/catch` at line 126 wraps the call but rethrows as `HttpsError('internal', …)`. Client gets `internal` error. |
| `functions/src/modules/reclamacoes/classificarReclamacaoIA.ts:133` | `classificarReclamacaoIA` (Pub/Sub or callable) | `process.env.GEMINI_API_KEY` (NOT `defineSecret` — relies on env var passed by Firebase runtime) | **NO fallback, but graceful early-return.** If `!apiKey` → `logger.error('GEMINI_API_KEY not configured'); return;` — function exits silently, classification never written. |
| `functions/test-bula-extraction.mjs:10` | n/a (local test script) | `process.env.GEMINI_API_KEY` | n/a |

**Note:** `classificarReclamacaoIA.ts` uses `process.env.GEMINI_API_KEY` rather than `defineSecret`, so it does **not** appear in the preflight scan, but in production Firebase runtime the env-var IS the value of any declared secret with the same name passed to that function. If the function declaration doesn't bind `GEMINI_API_KEY` via `secrets: [...]`, `process.env.GEMINI_API_KEY` will be undefined regardless. Worth verifying the function options in that file.

---

## Inventory — `RESEND_API_KEY`

| File | Function(s) impacted | Reader pattern | Has fallback? |
| --- | --- | --- | --- |
| `functions/src/modules/emailBackup/services/emailService.ts:8` | `dailyBackupEmail`, `monthlyBackupEmail` (declared in `modules/emailBackup/index.ts:230, 310` with `secrets: [RESEND_API_KEY]`) | `defineSecret('RESEND_API_KEY')` → `RESEND_API_KEY.value()` → `new Resend(...)` (line 71) | **NO fallback.** `resend.emails.send(...)` returns `{ error }` → wrapper throws `Resend API error: ...`. Backup email skipped. PDF still generated and stored. |
| `functions/src/modules/cqiReport/email/cqiTemplate.ts:11` | `cqiDailyEmail` (declared in `modules/cqiReport/index.ts:38` with `secrets: ['RESEND_API_KEY']`) | `defineSecret('RESEND_API_KEY')` → `new Resend(RESEND_API_KEY.value())` (line 163) | **NO fallback.** Same pattern — throws on send error. |
| `functions/src/modules/educacaoContinuada/scheduledAlertasVencimento.ts:21` | `ec_scheduledAlertasVencimento` (cron 08:00 BRT) | `defineSecret('RESEND_API_KEY')` → `try { resendApiKey.value() } catch { null }` (line 41-45) | **YES — explicit graceful skip.** If secret unavailable → `resend = null` → for each alert writes `auditLogs` event `EC_ALERTA_EMAIL_SKIPPED` with `motivo: 'RESEND_API_KEY não disponível'` (line 109). Function does NOT crash. Vencimento alerts silently NOT delivered. |
| `functions/src/modules/sugestoes/transitarSugestao.ts:13` | `transitarSugestao` (callable) | `process.env.RESEND_API_KEY` via lazy `getResendClient()` factory — **throws** `Error('RESEND_API_KEY environment variable is not set')` if unset (line 15) | **NO fallback.** Lazy throw at first email attempt. The state-machine transition itself runs in the same callable, so the entire transition fails → user sees error in UI. |
| `functions/src/modules/sugestoes/criarSugestao.ts:14` | `criarSugestao` | Same pattern as above | NO. Same impact: criação da sugestão pode quebrar se email for bloqueante. |
| `functions/src/modules/satisfacao/dispararNPSRecurring.ts:13` | `dispararNPSRecurring` (cron) + `npsEmailQueueHandler` (Pub/Sub) | Same lazy throw pattern | NO. Per-message try/catch at line 77 logs error e continua — não quebra o cron, mas TODOS os NPS emails falham. |
| `functions/src/modules/satisfacao/dispararNPSPosResolucao.ts:10` | `dispararNPSPosResolucao` (Firestore trigger on reclamação → 'Resolvida') | Same lazy throw pattern | NO. Trigger fails → Firebase retries 3x → goes to dead letter. NPS pós-resolução nunca disparado. |
| `functions/src/modules/reclamacoes/transitarReclamacao.ts:13` | `transitarReclamacao` (callable) | Same lazy throw pattern | NO. Transição da reclamação quebra inteira se email for parte do fluxo. |
| `functions/src/liberacao/enviarComunicacaoEmail.ts:115` | `enviarComunicacaoEmail` | **COMENTADO** — `// const resend = new Resend(process.env.RESEND_API_KEY);` — MVP placeholder, marca `emailStatus: 'sent'` sem enviar | **No-op.** Comunicação ao médico nunca é realmente enviada. UI mostra "enviado". Esse é um bug pré-existente, não regressão de secret. |

---

## Cloud Logs evidence (last 7 days)

```
gcloud logging read "severity>=ERROR AND (textPayload:GEMINI OR textPayload:RESEND OR textPayload:Gemini OR textPayload:Resend)" \
  --project=hmatologia2 --limit=20 --freshness=7d
```

**Result: 0 hits.**

Sanity check: same query without filter returns 3 ERROR events from `2026-05-07T10:01–11:00Z`, so gcloud auth + project access work. The zero-hit result means **none of the Gemini/Resend consumer functions have been invoked since the secrets were seeded as placeholders** (or they were invoked but failed silently before any log line containing the literal strings "GEMINI"/"RESEND"/"Gemini"/"Resend" was emitted).

Practical reading: the gap exists but no real user flow has hit it yet — likely because `bioquimica` parseBulaBioquimica, NPS triggers, daily backup email, and CQI cron all run on schedule or rare on-demand. We have a window to provision before user-visible breakage.

---

## Silent-failure patterns found

1. **`scheduledAlertasVencimento.ts:41-45`** — explicit `try { secret.value() } catch { null }`. By design: ED-CON alertas are best-effort. **Documented in module CLAUDE.md.** Not a bug, but masks misconfiguration → operator never learns email is broken until user complains. Recommendation: log a single `WARN` at function startup when `apiKey === null`, and emit a once-per-day audit event (we already do per-alert).

2. **`classificarReclamacaoIA.ts:133-137`** — `if (!apiKey) { logger.error('GEMINI_API_KEY not configured'); return; }`. Logs but returns void → caller (Pub/Sub event) sees success, message ack'd, classification never persisted. Reclamation lives forever unclassified.

3. **`extractFromImage` / `analyzeImmunoStrip` / `extractFromBula` / `parseUrinaTira` (index.ts:1252-1279)** — Level 1 Gemini failure is caught + warned, falls through to OpenRouter. **Working as intended** (this is the explicit fallback chain), but with `GEMINI_API_KEY=PENDING_SET_*` we are **always** running on the slower/costlier Level 2 fallback. Operator might not notice until OpenRouter bill spikes.

4. **`enviarComunicacaoEmail.ts:113-125`** — Resend call is **commented out**. `emailStatus: 'sent'` is hardcoded. This is a known MVP placeholder predating the secrets work but worth flagging — provisioning RESEND_API_KEY does NOT fix this; the code needs to be uncommented.

5. **NPS / sugestoes / reclamacoes lazy throw pattern** — `if (!apiKey) throw new Error(...)`. Throws inside a cached factory means the FIRST call throws, but the next call re-throws the same error (factory never assigns `resend`). Each invocation pays full cold-start cost re-trying. Acceptable but noisy.

---

## User-facing feature impact summary

| Feature | Impact today (PENDING) | Severity |
| --- | --- | --- |
| OCR de hemograma (Yumizen H550) — `extractFromImage` | Functional via OpenRouter fallback. Slower (~1-2s extra per call), higher cost per call. | LOW (degraded perf/cost only) |
| Tira reagente uroanálise — `parseUrinaTira` | Same as above — OpenRouter fallback OK. | LOW |
| Imuno strip qualitativa — `analyzeImmunoStrip` | Same — fallback OK. | LOW |
| Bula parser (genérico) — `extractFromBula` | Same — fallback OK. | LOW |
| **Bioquímica bula parser — `parseBulaBioquimica`** | **BROKEN.** Returns `HttpsError('internal')` on every call. New control material cannot be cadastrado via PDF. Operator must manual-entry. | **HIGH** — blocks bioquímica module setup |
| Classificação automática de reclamações via IA — `classificarReclamacaoIA` | Silently no-op. Reclamations stay unclassified. Manual triagem needed. | MEDIUM |
| **Backup diário regulatório por email — `dailyBackupEmail`** | Throws → backup PDF gerado mas não enviado. Lab admin não recebe redundância regulatória diária (RDC 978). | **HIGH** — compliance gap |
| Backup mensal regulatório — `monthlyBackupEmail` | Same as daily. | HIGH (when 1º do mês chegar) |
| Email CQI diário — `cqiDailyEmail` | Throws → email com PDF de CQI nunca chega ao RT. RT não recebe relatório operacional. | MEDIUM |
| Alertas educação continuada (vencimento) — `ec_scheduledAlertasVencimento` | Graceful skip. Audit log mostra `EC_ALERTA_EMAIL_SKIPPED`. Treinamentos vencem sem aviso. | MEDIUM |
| NPS pós-resolução de reclamação — `dispararNPSPosResolucao` | Trigger throws, retry 3x, dead-letter. Pesquisa NPS nunca enviada. | LOW (feature opcional) |
| NPS recorrente trimestral — `dispararNPSRecurring` + `npsEmailQueueHandler` | Per-message catch — cron survives, todos os emails falham. | LOW |
| Sugestões — `criarSugestao` / `transitarSugestao` | Callable error. Usuário vê "erro ao criar sugestão" se email for parte do fluxo. | MEDIUM |
| Reclamações — `transitarReclamacao` | Callable error. Transição de status quebra. | MEDIUM |
| Comunicação ao médico — `enviarComunicacaoEmail` | Pre-existing MVP no-op (Resend code commented). NÃO afetado por secrets. | n/a |

---

## Recommended provisioning order (operator action required)

1. **`RESEND_API_KEY`** — **HIGHEST priority.** 4 modules depend on it (backup diário regulatório RDC 978, CQI diário, NPS, sugestões/reclamações). Backup diário é compliance-critical.
   - Fonte: <https://resend.com/api-keys> → "Create API Key" → escopo "Full access" (precisa enviar com domínio próprio `app.labclinmg.com.br`).
   - Verificar primeiro que o domínio `app.labclinmg.com.br` está verificado em <https://resend.com/domains> (DKIM + SPF). Se ainda não estiver, provisionar agora trava em "Domain not verified" no primeiro send.
   - Comando: `firebase functions:secrets:set RESEND_API_KEY --project hmatologia2`
   - Após set: redeploy das functions consumidoras (`dailyBackupEmail`, `monthlyBackupEmail`, `cqiDailyEmail`, `ec_scheduledAlertasVencimento`, `dispararNPSPosResolucao`, `npsEmailQueueHandler`, `dispararNPSRecurring`, `transitarSugestao`, `criarSugestao`, `transitarReclamacao`).
   - **Importante:** `SMTP_PASS` já contém `re_jFLLpNBT_4vjW6RDZLaDgJJxBG1EaqX16` — pode ser a mesma chave Resend reutilizada (verificar com operator antes de gerar nova).

2. **`GEMINI_API_KEY`** — **MEDIUM priority** (OpenRouter cobre 4 das 5 callables; só `parseBulaBioquimica` está realmente quebrada).
   - Fonte: <https://aistudio.google.com/app/apikey> → "Create API key in new project" ou usar projeto GCP existente `hmatologia2`.
   - Plano sugerido: usar paid tier (não free) para evitar rate-limit de 60 RPM em pico.
   - Comando: `firebase functions:secrets:set GEMINI_API_KEY --project hmatologia2`
   - Após set: redeploy `parseBulaBioquimica`, `extractFromImage`, `analyzeImmunoStrip`, `extractFromBula`, `parseUrinaTira`, `classificarReclamacaoIA`.
   - **Side benefit:** restaura Level 1 (Gemini direto) na chain de OCR — corta latência ~1s por call e reduz dependência do OpenRouter como single point of failure.

3. **Verificação pós-provisionamento:** rodar `bash scripts/preflight-secrets-check.sh` novamente — deve retornar exit 0 ("OK — all 8 declared secret(s) have real values. Safe to deploy.").

4. **Smoke test:** disparar manualmente `dailyBackupEmail` (ou aguardar próxima execução agendada) e tentar parse de bula bioquímica via UI. Conferir Cloud Logs por mensagens de sucesso.

---

## Other PENDING secrets found

**Nenhuma além das duas reportadas.** As outras 6 declarações (`HCQ_SIGNATURE_HMAC_KEY`, `OPENROUTER_API_KEY`, `SMTP_HOST/PASS/PORT/USER`) têm valores reais. O preflight script confirmou.

Observação: existe redundância entre `RESEND_API_KEY` e `SMTP_PASS` (ambos parecem ser chaves Resend, sendo `SMTP_PASS` em modo SMTP relay). Decidir qual canal vai para frente — atualmente o código usa **somente** `RESEND_API_KEY` via SDK; os secrets `SMTP_*` parecem ser carry-over de plano alternativo nunca usado em código (`grep -rn "SMTP_HOST\|SMTP_USER" functions/src/` retorna apenas o `defineSecret`, sem consumer). Vale auditoria separada para limpar dead secrets.

---

## Suggested code-quality follow-ups (não bloqueante)

- **`parseBulaBioquimica.ts`**: adicionar fallback OpenRouter equivalente ao padrão de `index.ts` (callOcrWithFallback). Hoje é o único Gemini-consumer single-point-of-failure.
- **`classificarReclamacaoIA.ts`**: declarar `secrets: [geminiApiKey]` na options da function se ainda não estiver (verificar arquivo completo). Sem isso, `process.env.GEMINI_API_KEY` virá undefined mesmo após provisionamento.
- **`enviarComunicacaoEmail.ts`**: descomentar bloco Resend (linhas 115-125) e adicionar `secrets: [RESEND_API_KEY]` na declaração da function. `emailStatus: 'sent'` mentindo é debt regulatório.
- **Audit dead secrets**: `SMTP_*` parecem não ter consumer no código fonte — confirmar e remover do `defineSecret` para simplificar o preflight.
