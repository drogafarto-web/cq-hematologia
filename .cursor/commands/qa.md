# /qa

Entre em **modo QA** e siga rigorosamente o playbook em [docs/playbooks/qa-validation.md](../../docs/playbooks/qa-validation.md).

Princípio: código que não é testado não existe. Features não verificadas são suposições. Você transforma suposições em certeza. **Padrão: você deployaria isso com confiança numa sexta à noite.**

## Antes de começar

Se eu não especifiquei o escopo, pergunte UMA vez: "qual feature / fluxo / branch / pré-deploy completo?". Depois execute.

## O que você faz (na ordem)

1. **Roda os testes existentes.** Reporte total / passing / failing / skipped / cobertura. Identifique flaky.
2. **Identifica gaps.** O que NÃO está testado importa mais do que o que está. Lógica de negócio, endpoints, fluxos críticos, edge cases, estados de erro.
3. **Escreve os testes que faltam** — não só descreve. Ordem de prioridade:
   - Fluxos críticos (auth, criar lote, registrar corrida CIQ, chain-hash)
   - Operações sensíveis de segurança
   - Edge cases (estados vazios, valores limite, concorrência)
   - Estados de erro (o que o usuário vê quando falha?)
4. **Infraestrutura** — migrations, ports, .env.example, health checks.
5. **IA / LLM** (Gemini + OpenRouter): tools retornam? erro não quebra fluxo? token usage controlado? fallback funciona?
6. **Integridade de dados**:
   - Backups rodando (23:45 BRT email, 03:00 BRT GCS)?
   - **Chain-hash íntegra** — testar `/insumo-movimentacoes` mantém prev_hash correto.
   - Operações destrutivas pedem confirmação?
7. **Verificação manual** — navegue como usuário. Toda página, todo form, viewport mobile, loading shimmer (não spinner), empty states.
8. **Performance** — page load <2s, bundle, requests desnecessários, memory leaks, API calls Gemini desnecessárias.
9. **Custo** — quantas calls Gemini por fluxo? contexto mínimo? cache? estimativa $/usuário/mês?
10. **A11y** — contraste WCAG AA, teclado, focus, alt, labels.

## Output

```
SUITE DE TESTES
Rodou: X / Passando: X / Falhando: X / Skipped: X / Coverage: X%

GAPS ENCONTRADOS
1. [Prioridade] Descrição — teste escrito: sim/não
2. ...

INFRAESTRUTURA
[Check]: passou/falhou (detalhes)

INTEGRIDADE DE DADOS
[Check]: passou/falhou (detalhes)

VERIFICAÇÃO MANUAL
[Página/Fluxo]: passou/falhou

PERFORMANCE
[Métrica]: valor (aceitável / atenção)

CUSTO
[Operação]: X calls, ~$Y por execução

VEREDICTO
Pronto pra shippar / X issues pra corrigir primeiro
```

## Regras

- Não só rode testes. Pense no que DEVERIA ser testado.
- Não reporte "tudo passando" sem checar se os testes testam a coisa certa.
- Todo gap encontrado: escreva o teste, não só descreva.
- Se algo está quebrado, forneça o fix.
