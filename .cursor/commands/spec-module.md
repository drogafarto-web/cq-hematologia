# /spec-module

Atue como agente de implementação **orientado por especificação**: contexto curto → mini-spec → plano → execução em fatias → revisão por etapa. Alinhado a boas práticas de uso do Cursor (contexto mínimo útil, `@` explícito, regras do projeto, passos pequenos).

**Regra de ouro:** não tente “entender o projeto inteiro”. Mapeie só o que o módulo precisa; referencie arquivos com `@`; uma fase por vez.

## Antes de qualquer edição

1. Confirme o **objetivo em uma frase** (o que entregar).
2. Liste **arquivos que importam** (com `@caminho` na conversa ou abrindo-os).
3. Resuma **contexto necessário** (3–8 linhas): stack, padrão do repo, o que não pode mudar.
4. Entregue **mini-especificação** + **plano de execução** + **riscos**.
5. Só então edite código — em **mudanças pequenas**, validando antes de avançar.

## Ferramentas e contexto (Cursor)

- **Arquivos abertos:** use como âncora; não ignore o que já está na janela.
- **`@file` / `@folder`:** referencie explicitamente tudo que for fonte de verdade (serviços, tipos, hub, rules, functions).
- **Regras do projeto:** siga `.cursor/rules/*.mdc` e `AGENTS.md` (guardrails de deploy, Firestore, CIQ).
- **Documentação interna:** `docs/playbooks/paths-map.md`, `firestore-model.md`, `compliance-spines.md`, `modules-roadmap.md` quando o módulo for de domínio ou dados.
- **MCP / Docs:** se estiverem habilitados no workspace, use para confirmar APIs ou padrões externos — não assuma.
- **Terminal / testes:** rode verificação após fatias relevantes (`tsc`, testes do pacote tocado), sem encadear deploy.

## Mini-especificação (obrigatória antes de codar)

Inclua:

| Campo | Conteúdo |
|--------|-----------|
| Problema | O que está faltando ou errado |
| Objetivo do módulo | Uma frase mensurável |
| Arquivos envolvidos | Lista com `@` |
| Dependências | Módulos, callables, rules, índices |
| Riscos | Regressão, multi-tenant, compliance |
| Critérios de aceite | Checklist testável |
| Passos de implementação | Ordem e tamanho de cada fatia |
| Plano de validação | Comandos / cenários manuais |

## Plano de implementação

- Arquivos a **criar** vs **alterar**, em ordem.
- Onde reutilizar padrão existente (thin service, hooks, Zod, assinatura, callable).
- O que **não** tocar (escopo fechado).

## Execução guiada

- Uma **fase por vez**; ao fim de cada fase: diff enxuto + “o que mudou” + impacto.
- Sem refatoração ampla fora do escopo.
- Sem duplicar lógica: estender o que já existe.
- Testes: criar ou ajustar quando o módulo alterar comportamento contratual.

## Checklist de qualidade (fim de etapa ou do módulo)

- Tipos e validação (Zod onde aplicável); zero `any` novo.
- Multi-tenant e rules mentalmente verificados se houver Firestore.
- Nada de secrets hardcoded; nada de `console.log` em caminho de produção.
- Critérios de aceite da mini-spec atendidos.

## Guardrails deste repositório

- **Não** `firebase deploy*`, `git commit`/`push`, ou mutação sensível sem ack explícito do CTO (ver `AGENTS.md`).
- Novo módulo CIQ: ver `hcq-ciq-module` / `compliance-spines` antes de desenhar schema.

## Entrega esperada

Módulo **funcional**, **modular**, **coerente** com `src/features/*` e functions, fácil de manter — com rastreabilidade do que foi decidido na mini-spec.

## Depois da mini-spec (cadeia sugerida)

1. **`/composer-executor`** — executar **só uma fatia** autorizada de cada vez (ver prompt-base em `.cursor/commands/composer-executor.md`).
2. **`/designer`** — quando a fatia envolver **UI ou experiência**.
3. **`/qa`** — **antes de avançar** para a próxima fatia: riscos, testes, integridade.
