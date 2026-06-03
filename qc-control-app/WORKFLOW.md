# Workflow de Execução — QC Control

Sequência completa para executar o plano do zero até produção. Cole os prompts do PROMPTS.md nesta ordem.

## Preparação (5 min, fazer acordado)

### 1. Crie o repositório Git

```bash
cd "C:\hc quality"
mkdir qc-control
cd qc-control
git init
git add .
git commit -m "chore: protótipo + documentação"
```

### 2. Crie conta/gratis:
- **DeepSeek Platform** (para API/chat)
- **Vercel** (para deploy)
- **Neon.tech** (para PostgreSQL)
- **GitHub** (se ainda não tem)

### 3. Inicie sessão no DeepSeek V4 Flash

Abra o chat do DeepSeek e cole o **System Prompt Inicial** do PROMPTS.md.

---

## Execução por Sessão

Cada sessão (~1-2h) cobre 1-2 ondas. Sessões podem ser feitas em dias diferentes.

### 📅 Sessão 1 — Fundação + Data Layer

**Ondas**: 0 + 1 (1h)

#### Passo 1.1 — Executar Onda 0
```
[cole Prompt 0.1]
[aguarda resposta DeepSeek]
[executa comandos localmente]
[valida: npm run dev funciona?]
├─ Se sim → git commit -m "chore: scaffold next.js"
└─ Se não → cole Prompt 0.2 com erro
```

#### Passo 1.2 — Executar Onda 1
```
[cole Prompt 1.1] → gera schema.prisma
[valida: npx prisma format]
[commit: feat(db): schema inicial]

[cole Prompt 1.2] → gera seed.ts
[valida: npx prisma db seed]
[commit: feat(db): seed data]

[cole Prompt 1.3] → gera audit triggers
[valida: UPDATE em Lot gera AuditLog]
[commit: feat(db): audit triggers]
```

**Checkpoint Sessão 1:**
- ✅ Projeto Next.js rodando
- ✅ DB populado com seeds
- ✅ Auditoria funcionando
- ✅ Commit: "feat: foundation + data layer"

---

### 📅 Sessão 2 — Auth + Design System

**Ondas**: 2 + 3 (1h)

#### Passo 2.1 — Executar Onda 2
```
[cole Prompt 2.1] → gera NextAuth config
[valida: login funciona em /login]
[commit: feat(auth): login functional]
```

#### Passo 2.2 — Executar Onda 3
```
[cole Prompt 3.1] → gera UI primitives
[valida: cada componente renderiza isolado]
[commit: feat(ui): primitives]

[cole Prompt 3.2] → gera layout + chart
[valida: /qc mostra chart dummy]
[commit: feat(ui): layout + chart]
```

**Checkpoint Sessão 2:**
- ✅ Login funcional
- ✅ Layout aplicado às 5 rotas
- ✅ LeveyJennings renderiza
- ✅ Commits 2.1 e 2.2

---

### 📅 Sessão 3 — QC Control (Tela Principal)

**Ondas**: 4 (1h30)

Esta onda tem 2 tarefas que podem ser paralelas. Se tiver só 1 sessão do DeepSeek, faça sequencialmente.

#### Passo 3.1 — API (prompt 4.1)
```
[cole Prompt 4.1] → gera API routes QC
[valida: POSTMAN/Thunder Client em /api/qc]
[commit: feat(api): QC runs + westgard]
```

#### Passo 3.2 — UI (prompt 4.2)
```
[cole Prompt 4.2] → gera tela /qc completa
[valida: quick add cria run, chart atualiza]
[commit: feat(ui): QC Control]
```

**Checkpoint Sessão 3:**
- ✅ Tela principal 100% funcional
- ✅ Violação Westgard força justificativa
- ✅ Commit 3.2

---

### 📅 Sessão 4 — Lot Management + Corrective Actions

**Ondas**: 5 + 6 (2h)

#### Passo 4.1 — Lot Management
```
[cole Prompt 5.1] → API lots
[cole Prompt 5.2] → UI lots (paralelo)
[valida: CRUD completo]
[commit: feat: Lot Management]
```

#### Passo 4.2 — Corrective Actions
```
[cole Prompt 6.1] → API CA
[cole Prompt 6.2] → UI CA (paralelo)
[valida: state machine funciona]
[commit: feat: Corrective Actions]
```

**Checkpoint Sessão 4:**
- ✅ 2 telas administrativas prontas
- ✅ Commits 4.1 e 4.2

---

### 📅 Sessão 5 — Analyzer Management + Reports

**Ondas**: 7 + 8 (2h)

#### Passo 5.1 — Analyzers
```
[cole Prompt 7.1] → API analyzers
[cole Prompt 7.2] → UI analyzers (paralelo)
[valida: cal/maint logs + status deriva]
[commit: feat: Analyzer Management]
```

#### Passo 5.2 — Reports
```
[cole Prompt 8.1] → engine PDF/Excel
[cole Prompt 8.2] → UI reports (paralelo)
[valida: gera PDF real, baixa]
[commit: feat: Reports]
```

**Checkpoint Sessão 5:**
- ✅ Todas as 5 telas funcionais
- ✅ PDFs e Excel geram
- ✅ Commits 5.1 e 5.2

---

### 📅 Sessão 6 — Testing + QA

**Onda**: 9 (1h)

#### Passo 6.1 — Config + Unit tests
```
[cole Prompt 9.1] → vitest + playwright config + tests
[valida: npm test passa]
[commit: test: unit coverage]
```

#### Passo 6.2 — E2E completo
```
[cole Prompt 9.2] → e2e das 5 telas
[valida: npx playwright test passa]
[se falhar, rode: "o teste X falhou com erro Y, corrija"]
[commit: test: e2e all screens]
```

#### Passo 6.3 — Bug bash manual
```
[Rode app local manualmente]
[Walkthrough cada tela]
[Anote bugs]
[Volte ao DeepSeek com: "bug: X tela ao fazer Y mostra Z, corrija"]
[commit: fix: bug bash pass]
```

**Checkpoint Sessão 6:**
- ✅ Coverage 80%+ em /lib
- ✅ E2E verde
- ✅ Zero warnings lint
- ✅ Bug-free walkthrough

---

### 📅 Sessão 7 — Deploy + Docs

**Onda**: 10 (1h)

#### Passo 7.1 — Deploy config
```
[cole Prompt 10.1] → vercel.json + scripts + README
[commit: chore: deploy config + docs]
```

#### Passo 7.2 — NeonDB provision
```bash
# Faça manualmente:
1. Login neon.tech
2. Criar cluster free
3. Copiar DATABASE_URL
4. Adicionar como env var no Vercel
5. Push schema para prod
```

#### Passo 7.3 — Vercel deploy
```bash
npm i -g vercel
vercel
# Seguir prompts
vercel --prod
# Verificar URL público
```

#### Passo 7.4 — Seed em produção
```bash
DATABASE_URL=[neondb_url] npx prisma db seed
# Ou usar API endpoint se preferir
```

#### Passo 7.5 — Capturar screenshots
```bash
[Abra produção]
[Screenshot cada tela]
[Adicione ao README.md]
```

**Checkpoint Sessão 7:**
- ✅ Produção online
- ✅ Seed populado
- ✅ README completo

---

## Pós-Deploy

### Checklist final

```
[ ] Login funciona em produção
[ ] Quick add cria run no prod DB
[ ] PDF gera e baixa em prod
[ ] Excel também
[ ] Zero erros no Vercel console
[ ] GitHub Actions verde (se configurado)
[ ] README com screenshots reais
[ ] Tag v0.1.0 criada
```

### Próximos passos (backlog)

Estas features NÃO estão no escopo inicial mas podem ser priorizadas depois:

1. **Integração PNCQ real** — substituir mock por API real do PNCQ
2. **Alertas de email** — notifica Resend quando CA em atraso
3. **Dashboard de KPIs** — se stakeholders pedirem
4. **Mobile PWA** — wrapper sobre web responsiva
5. **Integração LIS/HIS** — se hospital exigir
6. **Multi-tenant** — se for SaaS multi-lab
7. **2FA / SSO** — se auditoria pedir

---

## Recuperação de Falhas

### Se DeepSeek der erro de contexto
1. Feche a sessão
2. Abra nova sessão
3. Cole System Prompt Inicial novamente
4. Use prompt "Se DeepSeek perder contexto"
5. Continue da onda atual

### Se build quebrar persistentemente
1. `git status` — identifique arquivos mudados
2. `git diff` — veja o que mudou
3. `git log` — veja último commit bom
4. Se necessário: `git reset --hard [last-good-commit]`
5. Peça para DeepSeek refazer com prompt mais específico

### Se teste falhar
1. Rode o teste isolado: `vitest path/to/test.ts` ou `playwright test path`
2. Analise stack trace
3. Passe para DeepSeek: "O teste X falhou: [paste erro]. Corrija o [arquivo relevante]."
4. Não pule o teste — corrija

### Se deploy quebrar
1. `vercel logs [deployment-id]` — ver erro
2. Locais comuns de falha:
   - Prisma client não gerado (esqueceu postinstall)
   - Env vars faltando
   - Build falha por import errado
3. Corrija localmente com `vercel dev` (simulates prod)
4. Redeploy

---

## Timeline Estimada

| Sessão | Ondas | Tempo | Output |
|--------|-------|-------|--------|
| 1 | 0 + 1 | 1h | DB + scaffold |
| 2 | 2 + 3 | 1h | Auth + UI foundation |
| 3 | 4 | 1h30 | Tela principal |
| 4 | 5 + 6 | 2h | 2 telas admin |
| 5 | 7 + 8 | 2h | 2 telas + reports |
| 6 | 9 | 1h | QA + tests |
| 7 | 10 | 1h | Deploy + docs |
| **TOTAL** | | **~9h30** | **MVP funcional** |

Se você trabalhar 2h/dia: **5 dias úteis** para MVP completo.
Se você trabalhar 4h/dia: **3 dias úteis**.

---

## Boas Práticas Durante Execução

### 1. Commits granulares
Sempre commit após cada "checkpoint" dentro da onda:
```bash
git add .
git commit -m "feat(api): QC runs endpoint"
```

### 2. Validate incremental
Nunca pule a validação entre ondas:
- Rodar `npm run dev` após cada onda UI
- Rodar `npm run lint` após cada onda de código
- Rodar `npm run build` antes de commit

### 3. Contexto sempre completo
Sempre passe para DeepSeek:
- Schema atual (se mudou)
- Último prompt que rodou
- Arquivos criados no ultimo prompt

### 4. Não tenha medo de refazer
Se algo está muito errado:
```bash
git reset --hard [last-good-commit]
# Volte ao prompt e rode com instruções mais específicas
```

### 5. Documente decisões
Quando DeepSeek perguntar algo e você decidir:
```bash
# Adicione ao ARCHITECTURE.md:
## Decisões Técnicas
- [data] Decidimos X em vez de Y porque Z.
```

---

## Suporte durante execução

Se travar em algum ponto e não souber como resolver:

1. **Erro de build**: cole erro + tente "prompt de emergência" em PROMPTS.md
2. **Dúvida de arquitetura**: use prompt de @arch-agent
3. **DeepSeek confuso**: feche sessão, reabra, use prompt "Retome contexto"
4. **Bug complexo**: descreva passos para reproduzir + output esperado + output real

---

## Resumo Final

Este plano foi desenhado para:

✅ **Autonomia**: você só cola prompts e executa comandos
✅ **Paralelização**: ondas 4-8 podem rodar com múltiplos agentes
✅ **Recovery**: checkpoints e commits pequenos permitem rollback fácil
✅ **Simplicidade**: stack moderna, 5 telas, foco na legislação
✅ **Compliance**: PALC/DICQ/ISO 15189 atendidos em cada feature

**Quando acordar**: abra PROMPTS.md, copie os prompts na ordem, execute.

**Bom trabalho!** 🚀
