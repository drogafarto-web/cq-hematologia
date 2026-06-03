# MIGRATION.md — Operando HC Quality em Cursor / Codex / Claude Code

> Este repo era operado primariamente via Claude Code (`~/.claude/skills/hc-quality/`, hooks, memories). Em **2026-04-28** foi adaptado para suportar **as três ferramentas em paralelo, sem perda de contexto institucional**. Esta migração **não é definitiva** — você pode rodar dual-tool, voltar pro Claude Code, ou migrar 100% pra Cursor/Codex sem perder nada.

---

## TL;DR

| Antes (só Claude Code)                              | Agora (multi-tool)                                        |
| --------------------------------------------------- | --------------------------------------------------------- |
| Skill em `~/.claude/skills/hc-quality/`             | + [AGENTS.md](AGENTS.md) na raiz (lido por Codex CLI)     |
| Memories em `~/.claude/projects/.../memory/`        | + [docs/memory/](docs/memory/) versionado                 |
| Tom + skills em `~/.claude/CLAUDE.md`               | + [.cursor/rules/](.cursor/rules/) (Cursor)               |
| Reference docs em `~/.claude/skills/.../reference/` | + [docs/playbooks/](docs/playbooks/) **fonte da verdade** |

**Fonte da verdade única:** [docs/playbooks/](docs/playbooks/). Os outros dois pontos (`~/.claude/skills/hc-quality/reference/`, vault Obsidian) são **junctions Windows** que apontam pra esta pasta — qualquer edição nos três lugares atinge o mesmo arquivo no disco.

---

## Setup inicial (rodar uma vez)

```powershell
pwsh -File scripts\sync-playbooks.ps1
```

Isso cria duas junctions:

- `C:\Users\labcl\.claude\skills\hc-quality\reference\` → `C:\hc quality\docs\playbooks\`
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Playbooks\` → `C:\hc quality\docs\playbooks\`

Antes de criar, faz **backup** automático do conteúdo existente em `~/.claude/skills/hc-quality/reference.backup-YYYYMMDD-HHMMSS/`.

**Reverter:** `pwsh -File scripts\sync-playbooks.ps1 -Unsync` — remove só os links, preserva o source no repo.

**Dry run:** `pwsh -File scripts\sync-playbooks.ps1 -DryRun` — mostra o que faria sem aplicar.

### Se o vault Obsidian sincroniza via Obsidian Sync / Dropbox / iCloud

Junctions podem não ser respeitadas pela sincronização. Nesse caso:

- Use o Obsidian apenas para **LER** os playbooks.
- Edite no VSCode/Cursor abrindo o repo.
- Para ler offline em outro dispositivo, exporte snapshot manual periodicamente.

---

## Como cada ferramenta lê o contexto

### Codex CLI (OpenAI)

- Lê **[AGENTS.md](AGENTS.md)** automaticamente. Esse é o arquivo âncora.
- Sem skills/slash commands nativos. Para invocar "modo engineer/designer/qa", peça em prompt: "valida no modo engineer — segue o playbook em docs/playbooks/engineer-validation.md".
- Para status: o agente roda os comandos da seção "Contexto volátil" do AGENTS.md sob demanda.

### Cursor

- Lê **[AGENTS.md](AGENTS.md)** automaticamente (suporte nativo desde Cursor 1.x).
- Lê **[.cursor/rules/](.cursor/rules/)** automaticamente:
  - `00-context.mdc` — sempre ligado (`alwaysApply: true`).
  - `10-firestore.mdc`, `20-functions.mdc`, `30-frontend.mdc`, `40-compliance.mdc` — ativam quando você abre arquivos que casam com o `globs:`.
  - `50-engineer.mdc`, `60-designer.mdc`, `70-qa.mdc` — manuais. Invoque com `@50-engineer` etc. no chat.
- Lê **[.cursor/commands/](.cursor/commands/)** — slash commands. Digite `/` no chat:
  - `/status` — resumo de 5 linhas (ondas, HMAC, rules, triggers, próximo)
  - `/engineer` — modo validação de código
  - `/designer` — modo validação UI
  - `/qa` — modo QA
- **`.cursorignore`** corta `node_modules/`, `dist/`, `package-lock.json`, pastas legacy pt-BR e prompts soltos do indexador. Mantém o codebase indexado em range performático (~1-2k arquivos vs 11k bruto).

### Claude Code

- O skill `hc-quality` em `~/.claude/skills/hc-quality/SKILL.md` continua funcionando exatamente como antes (não foi alterado).
- Após o `sync-playbooks.ps1`, o `reference/` do skill agora **é** o `docs/playbooks/` do repo — qualquer atualização aparece nos dois lugares.
- Outras skills (`hm-engineer`, `hm-designer`, `hm-qa`) continuam em `~/.claude/skills/` — agora têm equivalente versionado no repo (`docs/playbooks/*-validation.md`) que serve outras ferramentas.

---

## Mapeamento Claude Code → equivalentes

| Claude Code                                  | Cursor                                                 | Codex CLI                                                               |
| -------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Skill `hc-quality` (auto-carrega no trigger) | `.cursor/rules/00-context.mdc` (alwaysApply)           | AGENTS.md (sempre lido)                                                 |
| Skill `/hm-engineer` (invocação manual)      | `@engineer` no chat (rule manual)                      | "valida no modo engineer — segue docs/playbooks/engineer-validation.md" |
| Skill `/hm-designer`                         | `@designer`                                            | idem com designer-validation.md                                         |
| Skill `/hm-qa`                               | `@qa`                                                  | idem com qa-validation.md                                               |
| Memories em `~/.claude/.../memory/`          | `docs/memory/baseline-YYYY-MM-DD.md`                   | mesmo                                                                   |
| `CLAUDE.md` global (tom do CTO)              | Embarcado em `00-context.mdc`                          | Embarcado em AGENTS.md §1                                               |
| Hooks (ex.: bloquear `firebase deploy`)      | **Não tem** — confiar no `00-context.mdc` "guardrails" | **Não tem** — confiar no AGENTS.md §3                                   |

⚠️ **Hooks são exclusivos do Claude Code.** Em Cursor/Codex você perde a interceptação automática — o agente conhece os guardrails (lê em todo turno) mas o sistema não bloqueia mecanicamente. **Mitigação:** mantenha `firebase functions:secrets:set` etc. exigindo confirmação manual no terminal e nunca rode `--yes`.

---

## Estratégias de uso

### Dual-tool (recomendado pra começar)

Mantenha Claude Code para sessões longas de arquitetura (Opus 4.7 quando travar). Use Cursor pro dia-a-dia (GPT-4o / Claude Sonnet) e tab autocomplete inline. Use Codex CLI quando estiver no terminal e quiser uma resposta rápida sem abrir editor.

Os três leem o **mesmo conteúdo** depois do `sync-playbooks.ps1`. Não tem divergência.

### Sair 100% do Claude Code

1. Rodar `sync-playbooks.ps1` (cria junctions).
2. Operar dual-tool por 2-4 semanas.
3. Quando confiar, deletar `~/.claude/skills/hc-quality/SKILL.md` (ou todo o skill folder, exceto a junction `reference/` que aponta pro repo).
4. Mover memórias relevantes que sobraram em `~/.claude/projects/.../memory/` pra `docs/memory/baseline-YYYY-MM-DD.md`.

Resultado: zero dependência de `~/.claude/`. Repo é portable, qualquer máquina nova precisa só do clone + setup do agente preferido.

### Voltar pro Claude Code só

Reversão é zero-fricção. Os arquivos em `docs/playbooks/` são iguais aos do skill original (foi a fonte). O skill atual continua funcionando independentemente do que aconteça nos outros tools.

---

## Onde atualizar o quê

| Mudou...                            | Atualize...                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tom do CTO / regras gerais          | [AGENTS.md](AGENTS.md) §1 + `.cursor/rules/00-context.mdc` (manualmente — não estão sincronizados)                                                                                   |
| Modelo Firestore, novo schema spine | [docs/playbooks/firestore-model.md](docs/playbooks/firestore-model.md) ou [compliance-spines.md](docs/playbooks/compliance-spines.md) — todos os 3 ferramentas pegam automaticamente |
| Cloud Function nova                 | [docs/playbooks/functions-map.md](docs/playbooks/functions-map.md)                                                                                                                   |
| Status de Onda                      | [docs/memory/baseline-YYYY-MM-DD.md](docs/memory/) — criar novo snapshot, não sobrescrever                                                                                           |
| Decisão arquitetural                | [docs/adr/](docs/adr/) — ADR formal                                                                                                                                                  |

**Não duplique.** Se a info já vive num playbook, AGENTS.md/`00-context.mdc` só linka. Duplicação = certeza de divergência.

---

## Riscos conhecidos da migração

1. **`AGENTS.md` e `.cursor/rules/00-context.mdc` têm tom do CTO duplicado** — se editar um, edite o outro. Eventualmente, mover pra um arquivo único + import (não suportado pelo Cursor hoje).
2. **Hooks não migram.** Cursor e Codex não têm equivalente. Substituído por: agente lê guardrails em todo turno + nunca rodar comandos destrutivos com `--yes` / `--auto-approve`.
3. **Skills do Claude Code (`/hm-engineer` etc.) viram playbooks `manual:` em outros tools.** Você precisa lembrar de invocar — não há trigger automático no Cursor/Codex.
4. **Vault Obsidian com sync na nuvem** pode não respeitar junction. Avaliar antes de rodar o script.

---

## Comandos úteis

```bash
# Sincronizar playbooks (rodar uma vez)
pwsh -File scripts\sync-playbooks.ps1

# Reverter sincronização
pwsh -File scripts\sync-playbooks.ps1 -Unsync

# Dry run
pwsh -File scripts\sync-playbooks.ps1 -DryRun

# Verificar se uma pasta é junction
(Get-Item "C:\Users\labcl\.claude\skills\hc-quality\reference" -Force).Attributes
# se contém "ReparsePoint", é junction
```
