# AGENTS.md — HC Quality

> Documento âncora para qualquer agente de IA trabalhando neste repo: Codex CLI (lê este arquivo nativamente), Cursor (incluído via `.cursor/rules/00-context.mdc`), Claude Code, Aider, Continue. **Não duplique conteúdo aqui — linke pros playbooks em [docs/playbooks/](docs/playbooks/).**

---

## 1. Quem é o dono

Fundador e CTO. Pensa em décadas, não em sprints. Dirige, arquiteta, decide. **Não escreve código — você escreve.** Mas o padrão dele é o padrão.

### Padrão inegociável: world-class em todas as camadas

- Toda escolha técnica é a melhor disponível. Não a padrão. Não a popular. **A melhor.**
- Toda decisão de arquitetura tem uma razão. "A gente geralmente faz assim" não é razão.
- Segurança é construída desde o primeiro commit. Nunca pra depois.
- Performance é restrição de design, não fase de otimização.
- Se alguém auditasse esse codebase pra comprar, não encontraria nada pra ter vergonha.

### Padrão de design

Apple, Airbnb, Linear, Stripe, Vercel. Dark-first. Tipografia editorial. Sensibilidade cinematográfica. Se parece um template, reprovou. Se poderia pertencer a qualquer produto, reprovou. Se escolheu a opção segura em vez da opção certa, reprovou.

### Como ele trabalha

- Ele descreve o que precisa ser construído. Você executa.
- Ele toma decisões técnicas. Você implementa.
- "Revisa isso" significa **todas as camadas**: segurança, arquitetura, performance, qualidade, escala.
- Não pede confirmação pra decisões óbvias. Use julgamento. Escolha a melhor opção e siga.
- Na dúvida, escolha a opção que um time de engenharia world-class escolheria.

### Regras

- Nunca shippe trabalho mediano.
- Nunca escolha ferramenta porque é popular. Escolha porque é a melhor.
- Nunca pule segurança.
- Nunca deixe testes pra depois.
- Nunca construa pro passado.

---

## 2. O que é o HC Quality

Sistema CIQ (Controle Interno de Qualidade) laboratorial em produção: **https://hmatologia2.web.app**.

| Item | Valor |
|---|---|
| Root | `c:/hc quality/` |
| Firebase | `hmatologia2` (southamerica-east1) |
| Stack | React 19 + Vite 6 + Tailwind 4 + Zustand; Functions Node 22 (migrado 2026-04-24) |
| Router | Custom via `useAppStore.currentView` (NÃO React Router) |
| Staging | **Não existe** — cada deploy em prod é canário |
| Package manager | npm |
| Compliance | RDC 978 ANVISA + DICQ + LGPD |

### 🚀 Projetos Satélites Ativos (Espaço Viva)

Gerenciados no mesmo ecossistema de desenvolvimento e publicação:

* **espacoviva-planos-experimento:** Landing page de rascunho do modelo de negócios da Musculação Premium ([Site Oficial](https://espacoviva-planos-experimento.netlify.app)).
  * *Localização:* `C:\hc quality\espacoviva-planos-experimento\`
  * *Deploy/Publicação:* Vinculado ao Netlify ID `472c3563-e745-426a-8738-fc6aeb37d036`. Para atualizar em produção, execute `netlify deploy --prod` dentro da pasta.
* **espaco-viva:** Website institucional ([meuespacoviva.com.br](https://meuespacoviva.com.br)), vinculado ao repositório GitHub `drogafarto-web/viva-espaco-flow`.
* **espacoviva:** Servidor Debian de áudio 24/7 (instalado em hardware Mac mini local na academia) e painel local, vinculado ao repositório `espacoviva-deploy`.

---

## 3. Guardrails inegociáveis

**Exigir ack explícito do CTO antes de:**

- Qualquer `firebase deploy*` (vai direto em prod)
- `firebase functions:secrets:set`
- `node functions/scripts/grant-superadmin-all.mjs --apply` (muda custom claims de todos os users)
- `git push`, `git commit`
- Qualquer `rm`, `delete`, `DROP`, reset de `/labs/*/insumo-movimentacoes` (chain-hash é sagrado)

**Ordem das Ondas não-negociável.** Onda 3 (rules strict em [firestore.rules.post-onda2](firestore.rules.post-onda2)) só depois de Onda 2 (`provisionModulesClaims`) verificada com `updated: 0` em dry-run. Detalhes em [CORRECTIONS.md](CORRECTIONS.md).

**Compliance ANVISA/LGPD.** Qualquer mudança em `/users`, `/auditLogs`, `firestore.rules`, ou campos de rastreabilidade exige revisão dupla antes de aplicar.

**Padrão senior — zero tolerância:**

- Zero `any` types, zero `bare except`, zero fire-and-forget sem handler
- Zero secrets hardcoded (nem em dev, nem em "é só teste")
- Zero queries sem limit/paginação
- Zero endpoints sem validação de input (Zod nas callables)
- Zero `console.log` em produção (logger estruturado)

Qualquer um desses = finding **CRÍTICO** automático.

---

## 4. Contexto volátil — sob demanda, nunca no boot

**Não pré-carregue estado.** Quando o CTO perguntar "o que está pendente?" / "status" / "como estão as ondas", rode:

```bash
git -C "c:/hc quality" log --oneline -5
git -C "c:/hc quality" status --short
sed -n '1,60p' "c:/hc quality/CORRECTIONS.md"
firebase functions:secrets:access HCQ_SIGNATURE_HMAC_KEY 2>&1 | head -1
```

Resuma em 5 linhas: (1) Ondas deployadas vs pendentes, (2) secret HMAC setado?, (3) rules strict aplicadas ou gated?, (4) triggers novos ativos?, (5) próximo bloco com menos dependências.

---

## 5. Mapas (lazy — leia só a seção relevante)

- [docs/playbooks/paths-map.md](docs/playbooks/paths-map.md) — arquitetura de arquivos
- [docs/playbooks/functions-map.md](docs/playbooks/functions-map.md) — Cloud Functions
- [docs/playbooks/firestore-model.md](docs/playbooks/firestore-model.md) — coleções, rules, contratos
- [docs/playbooks/compliance-spines.md](docs/playbooks/compliance-spines.md) — entidades-espinha RDC 978 (Pessoa, Lote, Fornecedor, NF, Equipamento, POP, NC, Audit). **Ler antes de criar módulo novo** ou alterar schema cross-module.
- [docs/playbooks/modules-roadmap.md](docs/playbooks/modules-roadmap.md) — mapa de módulos da RDC 978: status, dependências, escopo regulatório.

---

## 6. Comandos / modos (invocação rápida)

Em **Cursor**: digite `/` no chat e selecione. Em **Claude Code**: skill correspondente. Em **Codex CLI**: cite o playbook explicitamente.

| Comando | Cursor | Claude Code | O que faz |
|---|---|---|---|
| `/status` | ✅ `.cursor/commands/status.md` | "status" textual | Reporte 5-linhas: ondas, secret HMAC, rules strict, triggers, próximo bloco |
| `/engineer` | ✅ `.cursor/commands/engineer.md` | `/hm-engineer` | Validação code world-class — segurança, arquitetura, performance, custo, resiliência |
| `/designer` | ✅ `.cursor/commands/designer.md` | `/hm-designer` | Validação UI — sofisticação, pixel perfect, dark-first |
| `/qa` | ✅ `.cursor/commands/qa.md` | `/hm-qa` | Testes + gaps + infra + integridade dados + custo |
| `/spec-module` | ✅ `.cursor/commands/spec-module.md` | (manual) | Novo módulo/feature grande: contexto → mini-spec → plano → fatias → revisão (boas práticas Cursor) |
| `/composer-executor` | ✅ `.cursor/commands/composer-executor.md` | (manual) | Composer 2: executor de tarefas pequenas, mini-spec obrigatória, uma etapa por vez, baixo risco |

**Spec → fatias → Composer 2:** o texto para colar no Composer (prompt-base de 7 passos, versão longa e *prompt de bolso*) mora em [`.cursor/commands/composer-executor.md`](.cursor/commands/composer-executor.md); regras condicionais em `.cursor/rules/44-composer-executor.mdc` e `.cursor/rules/45-spec-module.mdc`.

Playbooks-fonte:
- [docs/playbooks/engineer-validation.md](docs/playbooks/engineer-validation.md)
- [docs/playbooks/designer-validation.md](docs/playbooks/designer-validation.md)
- [docs/playbooks/qa-validation.md](docs/playbooks/qa-validation.md)

---

## 7. Runbooks operacionais

- [CORRECTIONS.md](CORRECTIONS.md) — plano master das Ondas 1-5
- [smoke-test-openclaw/PROMPT_FOCUSED.md](smoke-test-openclaw/PROMPT_FOCUSED.md) — smoke E2E 8-12min
- [docs/adr/](docs/adr/) — Architecture Decision Records (0001+); ADR é imutável após Accepted
- [docs/backlog/spine-violations.md](docs/backlog/spine-violations.md) — tracker vivo de violações de spine. **Consultar antes de iniciar módulo novo ou propor ADR.**
- [docs/audits/](docs/audits/) — snapshots de auditoria (point-in-time, imutáveis)
- [docs/memory/baseline-2026-04-28.md](docs/memory/baseline-2026-04-28.md) — congelamento do estado do projeto na transição Claude Code → multi-tool
- [docs/manual/](docs/manual/) — manuais humanos (técnico de lab). Hoje: [hematologia](docs/manual/hematologia.md). Espelhado no Obsidian via junction.

---

## 8. Sobre esta migração

Este repo era operado primariamente via Claude Code (`~/.claude/skills/hc-quality/`, memories, hooks). Foi migrado para suportar **Cursor + Codex CLI + Claude Code** simultaneamente — sem perda de contexto institucional. Detalhes do mapeamento e como invocar equivalentes em cada ferramenta: [MIGRATION.md](MIGRATION.md).
