---
name: hcq-deploy-gates
description: Executa o gate pré-merge e pré-deploy do hc quality — typecheck, lint com baseline de 88 warnings pré-existentes, 274 testes unit baseline, build app + functions, verificadores de chain hash, scan de secrets no diff, emulator rules test. Bloqueia regressão. Use antes de abrir PR, antes de mergear, e antes de cada etapa de deploy (rules → functions → hosting). Relatório em formato checklist pronto pra colar na PR.
---

# hcq-deploy-gates — Gate pré-merge e pré-deploy

> **Versão:** 1.0 · **Última atualização:** 2026-04-20 · **Baselines:** 274 testes unit, 88 lint warnings pré-existentes, zero typecheck error, zero secrets commitados

Esta skill automatiza o gate de qualidade que o playbook [hcq-ciq-module](../hcq-ciq-module/SKILL.md) seção 14 exige. Ao invés do operador rodar um por um e lembrar dos baselines, essa skill roda tudo, compara, reporta.

Skills relacionadas: [hcq-ciq-module](../hcq-ciq-module/SKILL.md) (seção 14 é a origem), [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md) (verifier roda aqui), [hcq-module-generator](../hcq-module-generator/SKILL.md) (chama esta skill no final).

---

## 1. Quando usar

**Obrigatório** antes de:
- Abrir PR
- Marcar PR como ready-for-review
- Mergear
- Executar `firebase deploy --only <qualquer-coisa>`

**Opcional** durante:
- Desenvolvimento iterativo (rode o gate rápido — seção 4)

---

## 2. Gates em camadas

```
Gate RÁPIDO      ~30s    typecheck + lint + test:unit                     (dev loop)
Gate FULL        ~2min   RÁPIDO + build app + build functions             (PR commit)
Gate DEPLOY      ~5min   FULL + rules test + verifier + secrets scan      (antes do deploy)
Gate REGRESSÃO   ~10min  DEPLOY + smoke manual + golden PDF               (ready-for-review)
```

Escolha o gate pelo contexto. Auto mode: RÁPIDO em dev, FULL em PR, DEPLOY antes de `firebase deploy`.

---

## 3. Baselines atuais (atualizar quando mudar)

| Métrica | Baseline | Ação se exceder |
|---|---|---|
| Testes unit | 274 pass, 0 fail | Qualquer falha: bloqueia |
| Testes unit — novos adicionados | cresce com PR | PR sem teste novo em lógica de domínio: pergunta ao autor |
| Lint warnings | 88 (pré-existentes) | 89+: bloqueia **se o warning novo é de linha tocada no PR** |
| Typecheck errors | 0 | Qualquer erro: bloqueia |
| Build app | sucesso, zero warning novo | Warning novo de vite/tsc: bloqueia |
| Build functions | sucesso, zero warning novo | Idem |
| Bundle size (vite) | `dist/assets/index-*.js` ≤ **previous + 5%** | Excedeu 5%: investigar, justificar |
| Coverage em linhas novas | ≥ 80% | < 80%: bloqueia |
| `tools/verify:chains` | exit 0 contra emulator seeded | exit ≠ 0: bloqueia |
| Secrets no diff | zero | Qualquer: bloqueia **e refaz commit limpando** |

Quando atualizar um baseline (testes sobem, lint warnings caem), edite esta seção e commit no mesmo PR.

---

## 4. Gate RÁPIDO

```bash
npm run typecheck && npm run lint && npm run test:unit
```

Relatório esperado:

```
✓ typecheck: 0 errors
✓ lint: 88 warnings (baseline, no new)
✓ test:unit: 274 passing
```

Se lint subiu para 90: extrair o diff com `git diff --name-only` + `eslint <arquivos>` **só nos arquivos tocados**, comparar com `git show HEAD:<arquivo> | eslint --stdin`. Se o warning novo é de linha tocada: bloqueia. Se é pre-existente que foi contado de novo por race: log "não bloqueante".

---

## 5. Gate FULL

Gate RÁPIDO +:

```bash
npm run build && (cd functions && npm run build)
```

Relatório:

```
✓ vite build: X KB (was Y KB, delta Z%)
✓ functions build: 0 errors
```

Se bundle subiu mais de 5%: rode `npx vite-bundle-visualizer` e reporte top 5 módulos novos. Pergunte se é justificado (ex: nova biblioteca para módulo X).

---

## 6. Gate DEPLOY

Gate FULL +:

### 6.1 Rules emulator test

```bash
# Pressupõe firebase emulator rodando OU script que sobe e derruba
npm run test:rules   # tsx scripts/test-rules.ts com @firebase/rules-unit-testing
```

Testa para cada módulo CIQ:
- Membro ativo lê suas próprias runs
- Non-member não lê
- Operador não deleta events (imutabilidade)
- Admin deleta run master, mas não event
- Cliente não seta `chainHash` (defense-in-depth)

Se esse script não existe no repo, crie-o. Pattern: testar toda rule que você escreveu manualmente em [hcq-firestore-rules-generator](../hcq-firestore-rules-generator/SKILL.md).

### 6.2 Chain verifier

```bash
# Seed emulator com 3 eventos concorrentes em 2 labs
npm run seed:emulator
npm run verify:chains
```

Exit 0: cadeia consistente.
Exit 2: cadeia quebrada — reporte qual event, qual hash esperado vs. atual. **Bloqueia deploy.**

Detalhes em [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md) seção 7.

### 6.3 Secrets scan

```bash
git diff --cached --unified=0 | grep -E "(GEMINI_API_KEY|OPENROUTER_API_KEY|firebase-adminsdk|service-account|BEGIN PRIVATE KEY|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z-_]{35})" || echo "✓ no secrets"
```

E check arquivos suspeitos:
```bash
git diff --cached --name-only | grep -E "\.(env|key|pem)$|firebase.*key.*json|service.*account.*json" && echo "✗ suspicious files" || echo "✓ no suspicious files"
```

Qualquer match: **bloqueia**. Não apenas reverter commit — checar histórico com `git log --all --full-history -- <arquivo>`; se o secret já foi pushado, avisar explicitamente que precisa rotacionar.

### 6.4 CORS callables check

Bug conhecido (ver memória `project_known_bugs`): callables Gen2 em `southamerica-east1` sem `cors: true` falham em prod.

```bash
grep -n "onCall" functions/src/ -r | grep -v "cors: true" | grep -v "test" && echo "✗ callable sem cors" || echo "✓ todas callables com cors:true"
```

Match: bloqueia.

---

## 7. Gate REGRESSÃO (pré-ready-for-review)

Gate DEPLOY +:

### 7.1 Smoke manual

Lista gerada automaticamente. Para cada módulo CIQ tocado no PR, gere checklist:

```
- [ ] Golden path: criar run, confirmar, ver no histórico, assinatura presente
- [ ] Edge: network flaky — desligar rede mid-save, ver toast, retry
- [ ] Edge: operador deslogado — save redireciona
- [ ] Audit: ver event na subcoleção, chainHash eventualmente preenchido
- [ ] Rules: acessar de outro lab (trocar labId na URL) → permission-denied
```

Se mudou PDF: ver [hcq-pdf-export-scaffold](../hcq-pdf-export-scaffold/SKILL.md) para smoke específico (preview, render, golden diff).

### 7.2 Golden PDFs

```bash
(cd functions && node scripts/preview-backup-pdf.mjs > /tmp/backup-preview.pdf)
# comparar visualmente com reference/backup-golden.pdf (operador humano)
```

Se mexeu em qualquer PDF: regenerar golden e commitar junto.

---

## 8. Ordem de deploy (nunca inverter)

```bash
# 1. Rules primeiro — reforça permissões antes de qualquer código novo confiar
firebase deploy --only firestore:rules
# aguardar OK do CTO

# 2. Indexes se mudaram
firebase deploy --only firestore:indexes
# aguardar OK

# 3. Functions — dependem das rules já ativas
firebase deploy --only functions
# aguardar OK — validar via Logs que scheduled não explodiu

# 4. Hosting — consome tanto rules quanto functions
firebase deploy --only hosting
# aguardar OK — smoke manual em produção nos 3 fluxos críticos
```

Nunca faça `firebase deploy` pelado (deploya tudo em paralelo). Uma rule quebrada + function nova que depende dela = race condition.

Antes de cada passo: rode o Gate DEPLOY. Aguarde o OK do CTO entre passos (CLAUDE.md global é explícito: "sempre aguardar OK do CTO entre etapas").

---

## 9. Relatório padrão (para colar na PR)

```markdown
## Gate pré-merge

- [x] Typecheck: 0 erros
- [x] Lint: 88 warnings (baseline, sem regressão)
- [x] Testes unit: 274 passing (+N novos)
- [x] Coverage linhas novas: XX%
- [x] Build app: YYY KB (delta +Z% vs. main)
- [x] Build functions: OK
- [x] Rules emulator test: OK
- [x] verify:chains: OK contra seed
- [x] Secrets scan: limpo
- [x] Callables com cors:true: todas

## Smoke manual
- [x] <módulo X>: golden path + 2 edges
- [x] <módulo Y>: (se tocado)

## Deploy checklist
- [ ] rules (aguardando OK CTO)
- [ ] indexes (se aplicável)
- [ ] functions
- [ ] hosting + smoke prod
```

Sempre termine com essa caixa. CTO approva marcando os últimos quatro.

---

## 10. Anti-patterns

| Anti-pattern | Motivo | Correção |
|---|---|---|
| Rodar apenas typecheck, pular testes | Regressão passa silenciosa | Sempre gate FULL antes de PR |
| Ignorar warning novo "mas é pré-existente" | Baseline sobe invisivelmente | Diff arquivo-por-arquivo; se warning é de linha tocada, corrige |
| Commit do baseline subindo sem justificativa | Próxima PR não sabe o "correto" | Atualizar seção 3 desta skill no mesmo PR |
| Deploy paralelo (`firebase deploy`) | Race rules/functions | Ordem seção 8, obrigatório |
| Pular `verify:chains` porque "passou local" | Produção pode ter quebrado a cadeia | Rodar contra emulator seeded no gate DEPLOY |
| `--no-verify` no commit | Bypassa hook que roda este gate | Nunca. Se hook falha, corrige |
| Deploy sem smoke prod depois | Regressão silenciosa chega no usuário | Smoke é parte do deploy, não bônus |
| Esquecer scan de secrets em PRs grandes | `.env.local` vazando | Gate DEPLOY sempre scaneia |

---

## 11. Automação recomendada

Se esta skill é rodada manualmente sempre, codifique em `scripts/gate.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
mode=${1:-full}  # rapid | full | deploy | regression

case "$mode" in
  rapid) npm run typecheck && npm run lint && npm run test:unit ;;
  full)  "$0" rapid && npm run build && (cd functions && npm run build) ;;
  deploy) "$0" full && npm run test:rules && npm run verify:chains && bash scripts/scan-secrets.sh ;;
  regression) "$0" deploy && echo "Smoke manual: ver hcq-deploy-gates seção 7" ;;
  *) echo "usage: $0 [rapid|full|deploy|regression]"; exit 1 ;;
esac
```

E `husky` pre-commit:
```bash
npx husky add .husky/pre-commit "bash scripts/gate.sh rapid"
```

Husky **nunca** bloqueia urgência justificada — operador pode `--no-verify` **se e somente se** fizer PR separado corrigindo logo em seguida.

---

## 12. Referências

| Arquivo | Uso |
|---|---|
| `package.json` scripts | `typecheck`, `lint`, `test:unit`, `build`, `test:coverage` |
| `functions/package.json` scripts | `build` |
| `tools/verifyInsumoChain.ts` | verificador canônico |
| `firebase.json` | ordem de deploy targets |
| `DEPLOY.md` (raiz do projeto) | ordem humana aprovada |
| `CLAUDE.md` global do usuário | "sempre aguardar OK do CTO entre etapas" |
