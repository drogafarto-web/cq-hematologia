# v1.4 Final Closure — Orchestration Guide (Staging / Preview Channel)

**Companion to:** `ORCHESTRATION-GUIDE.md` · `MP-8/PLAN.md`  
**Projeto Firebase:** `hmatologia2` · Hosting prod: `https://hmatologia2.web.app`

---

## 1. Contexto

No HC Quality **não existe** segundo projeto Firebase nem ambiente “staging” dedicado no `.firebaserc`. Cada deploy tradicional em Hosting **substitui** o site principal.

Para validar **frontend** sem publicar em produção, o padrão suportado pelo Firebase é **Hosting Preview Channel**: mesma GCP project, **URL isolada**, expira automaticamente.

**Referência Firebase:** [Preview channels](https://firebase.google.com/docs/hosting/test-preview-deploy)

---

## 2. O que “staging” significa aqui

| Camada | Preview Channel (`hosting:channel:deploy`) | Deploy Hosting live (`deploy --only hosting`) |
|--------|---------------------------------------------|------------------------------------------------|
| Bundle React (`dist/`) | Novo build num URL preview | Atualiza `hmatologia2.web.app` |
| Firestore / Rules | **Mesmo** backend de produção | Altera rules **globais** do projeto |
| Cloud Functions | **Mesmas** functions de produção | Altera functions **globais** |

**Conclusão:** preview channel = **staging de UI** contra **backend real**. Não isola dados nem APIs.

Para stack isolada completa: **Emulators** (`firebase emulators:start`) ou **projeto Firebase separado** (não configurado neste repo).

---

## 3. Política — corrida autónoma “até deploy staging”

### 3.1 Permitido (sem novo ACK explícito do CTO, nesta política)

- `npm run build` após gates verdes.
- Deploy **apenas** para preview channel:

```bash
cd "C:\hc quality"
npm run build
firebase hosting:channel:deploy v14-staging --expires 14d --project hmatologia2
```

- Guardar o URL emitido pelo CLI (formato típico: `https://hmatologia2--v14-staging-<hash>.web.app`).
- Smoke manual ou scriptado **só** contra esse URL (hard reload `Ctrl+Shift+R` — PWA).

### 3.2 Proibido nesta política (alteram produto partilhado ou política do `.planning/config.json`)

- `firebase deploy --only hosting` **sem** channel → atualiza **produção**.
- `firebase deploy --only functions` ou `firestore:rules` → altera backend **global** (todos os users).
- `firebase functions:secrets:set`
- `git push`, merge para `main`, tags remotos — **só** com ordem explícita do CTO.

---

## 4. MP-8 adaptado — fluxo “staging only”

1. **Executar Step 1** de `MP-8/PLAN.md` (pre-deploy gates: tsc, functions build, lint, tests, app build, bundle, preflight secrets, etc.).  
   - Adaptar comandos **bash** do PLAN para **PowerShell** quando necessário no Windows.

2. **Não executar** os Steps 2–6 do PLAN que fazem:
   - merge `v1.4-final-closure` → `main` + `git push`;
   - `firebase deploy` de rules, indexes, functions, hosting **live**;
   - smoke contra `hmatologia2.web.app` como critério de “go live”.

3. **Acrescentar Step “Staging”** (após gates OK + `npm run build`):

```bash
firebase hosting:channel:deploy v14-staging --expires 14d --project hmatologia2
```

4. Registar em **`AUTONOMOUS-RUN-SUMMARY.md`** (ou equivalente):
   - URL do preview channel;
   - commit SHA da branch;
   - data/hora;
   - limitação: “backend = prod shared”.

---

## 5. Comandos úteis

```bash
# Listar canais existentes
firebase hosting:channel:list --project hmatologia2

# Remover canal (se necessário)
firebase hosting:channel:delete v14-staging --project hmatologia2
```

**Nome do canal:** usar slug estável (`v14-staging`) ou incluir branch (`v14-final-closure-staging`) para auditoria.

---

## 6. Prompt-mãe — bloco a colar no orquestrador

Substituir no prompt principal qualquer secção que proíba **todo** deploy por esta:

```markdown
## Deploy destino: STAGING (preview channel apenas)

Após MP-6 verde e gates MP-8 Step 1 OK:
- `npm run build`
- `firebase hosting:channel:deploy v14-staging --expires 14d --project hmatologia2`
- Documentar URL em `.planning/phases/v1.4-final-closure/AUTONOMOUS-RUN-SUMMARY.md`
- NÃO executar: firebase deploy --only hosting|functions|firestore sem flags de preview;
  NÃO git push / merge main sem CTO.
```

---

## 7. Relação com tags e FINAL-REPORT

- Tag **`v1.4-PARTIAL`** / **`v1.4-FINAL`** discutidas no `FINAL-REPORT.md` referem-se a **fecho de código + eventual deploy acordado**.
- **Preview channel sozinha** não substitui sign-off regulatório (ex.: MP-7 DICQ formal).

---

**Criado:** 2026-05-10  
**Branch alvo:** `v1.4-final-closure`
