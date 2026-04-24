# Protocolo de Contexto — HC Quality

Este arquivo documenta como o contexto é organizado para minimizar tokens carregados por sessão e maximizar precisão de onboarding ao abrir nova aba.

## Camadas de contexto (do mais geral ao mais específico)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Global — ~/.claude/CLAUDE.md                                  │
│    Preferências do CTO (voz, padrões world-class, decisões).    │
│    Carrega em TODA sessão, independente de projeto.             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Projeto — c:/hc quality/CLAUDE.md                             │
│    Panorama do projeto: stack, módulos em prod, URL, como       │
│    navegar. Alvo: ≤150 linhas. Carrega em toda sessão deste    │
│    projeto.                                                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Regras condicionais — .claude/rules/*.md com `paths:` glob   │
│    Carregam SÓ quando a sessão tocar arquivos que matcham o    │
│    glob. Ex.: `module-protection.md` só aparece quando Claude  │
│    lê algo em `src/features/**`.                                │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Módulo — src/features/<módulo>/CLAUDE.md                     │
│    Regras de negócio, RN-*, pendências, histórico por fase.    │
│    Carrega quando trabalhar no módulo.                          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Handoff — src/features/<módulo>/HANDOFF.md (opcional)        │
│    Prompt pronto para colar em nova aba quando user quer reset │
│    limpo com contexto curado daquele módulo. Não é carregado   │
│    automaticamente — é um convite ao copy/paste.                │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Auto memory — ~/.claude/projects/c--hc-quality/memory/       │
│    Aprendizados automáticos (builds que funcionam, bugs        │
│    descobertos, decisões tomadas). Claude escreve sozinho;     │
│    índice MEMORY.md carrega em toda sessão.                     │
└─────────────────────────────────────────────────────────────────┘
```

## Regra central: módulos têm dever de atualizar o raiz

**Fluxo obrigatório** toda vez que um módulo completa milestone (fase nova, deploy estrutural, mudança de fluxo principal):

1. Atualizar o `CLAUDE.md` do próprio módulo (seção "Entregue em {fase}" + "Status atual")
2. **Em seguida, atualizar o `CLAUDE.md` raiz do projeto** na seção **"Módulos em produção"** com uma linha nova:
   ```
   - {módulo} — {status 1 frase} (última entrega: {data})
   ```
3. Se a mudança afeta múltiplos módulos ou introduz padrão novo, adicionar/editar um arquivo em `.claude/rules/` com `paths:` apropriado

Sem isso, o `CLAUDE.md` raiz fica defasado e próximas sessões/abas não veem o panorama.

## Quando criar um novo arquivo `.claude/rules/*.md`

- Padrão/regra que se aplica a **N+ arquivos** cruzando **mais de um módulo**
- Ex.: padrão de rules Firestore → aplica a `firestore.rules` + todos os `*Service.ts`
- Ex.: padrão de deploy → aplica a `firebase.json` + `functions/**`

**Não** coloque em `.claude/rules/` regras que cabem no CLAUDE.md do módulo (regras de negócio RN-*).

## Quando criar CLAUDE.md por módulo

- Módulo tem ≥3 arquivos E regras de negócio específicas (RN-*)
- Módulo é multi-tenant com coleção própria
- Módulo está em desenvolvimento ativo (pendências + histórico valioso)

**Não** criar CLAUDE.md para módulos de UI puros sem lógica (ex.: `hub/`, `chart/` se só é wrapper visual).

Use `.claude/templates/MODULE_CLAUDE.md.template` como base.

## Quando criar HANDOFF.md por módulo

Opcional. Crie quando:
- Há expectativa de abrir sessões novas regularmente naquele módulo
- O CLAUDE.md do módulo passou de 250 linhas e você quer um prompt de onboarding enxuto

Não crie por padrão — `claude --resume` já cobre o caso de continuar a mesma sessão.

## Quando NÃO documentar nada

- Fix trivial num módulo (bug, typo, refactor menor)
- Feature experimental não shipada
- Mudança que não afeta contrato nem fluxo principal

Auto memory cuida disso sozinho. Não polua CLAUDE.md com commits de baixo valor.

## Onboarding de nova aba — caminho ótimo

### Cenário A — continuar mesma tarefa

```bash
claude --resume
# escolher a sessão
```

Restaura conversation history + file changes + git state automaticamente. Nenhum prompt de onboarding necessário.

### Cenário B — trabalhar em módulo já conhecido

Cola esse prompt curto:
```
Trabalhar em `src/features/<módulo>/`. Lê o CLAUDE.md do módulo antes.
<task específica>
```

Claude: carrega global → carrega projeto → le CLAUDE.md módulo → carrega rules condicionais conforme tocar arquivos → pronto.

### Cenário C — reset limpo em módulo ativo

Abre o HANDOFF.md do módulo, copia bloco entre `---`, cola em nova aba. Usa quando o contexto da aba anterior ficou confuso ou muito longo.

### Cenário D — tarefa cross-módulo ou nova feature

```
<task>. Contexto do projeto em c:/hc quality/CLAUDE.md.
```

## Tamanhos-alvo

| Arquivo | Alvo | Máximo |
|---|---|---|
| `~/.claude/CLAUDE.md` (global) | 60 linhas | 100 |
| `CLAUDE.md` (projeto) | 100 linhas | 150 |
| `.claude/rules/*.md` | 80 linhas | 120 por arquivo |
| `src/features/*/CLAUDE.md` | 200 linhas | 300 |
| `HANDOFF.md` | 80 linhas | 100 |

Acima do máximo: mover seções para um dos outros escopos ou quebrar em arquivos menores com `paths:`.

## Auditoria periódica recomendada

A cada milestone ou toda ~2 semanas em desenvolvimento ativo:

1. `wc -l CLAUDE.md .claude/rules/*.md src/features/*/CLAUDE.md` — checar tamanhos
2. Revisar pendências concluídas e movê-las para "Done" no CLAUDE.md do módulo
3. Conferir se "Módulos em produção" no raiz reflete o estado real
4. Revisar `MEMORY.md` — remover entries de decisões que foram revertidas/substituídas
