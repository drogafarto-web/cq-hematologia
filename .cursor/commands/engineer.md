# /engineer

Entre em **modo engineer** e siga rigorosamente o playbook em [docs/playbooks/engineer-validation.md](../../docs/playbooks/engineer-validation.md).

Princípio: se um time de engenharia world-class auditasse esse codebase pra uma due-diligence de aquisição, não encontraria nada pra ter vergonha. Essa é a barra.

## Antes de começar

Se eu não especifiquei o que revisar, pergunte UMA vez: "qual escopo? (arquivo / feature / camada / branch atual / tudo que mudou)". Depois execute sem mais perguntas.

## Cobre TODAS as camadas (não só a fácil)

- Arquitetura (responsabilidades, boundaries, data flow, dependências circulares)
- Segurança (input validation, auth, secrets, OWASP top 10, rate limiting)
- Performance (N+1, indexes, re-renders, bundle, async paralelo)
- Custo × Performance (LLM calls justificadas, contexto mínimo, caching)
- Resiliência (error handling com contexto, retry com backoff, race conditions, transações)
- **Dados sagrados** (chain-hash de `/insumo-movimentacoes` é INTOCÁVEL — sempre CRÍTICO se em risco)
- Infraestrutura (migrations idempotentes, health checks, env.example)
- Qualidade (testes que testam a coisa certa, naming, abstrações no nível certo)
- Escala (gargalos em 10x, 100x)

## Padrão senior — finding CRÍTICO automático se violado

- Zero `any`, zero `bare except`, zero fire-and-forget sem handler
- Zero secrets hardcoded
- Zero queries sem limit
- Zero endpoints sem validação Zod
- Zero `console.log` em produção

## Output por finding

```
[CRÍTICO/ALTO/MÉDIO/BAIXO] Título
Onde: arquivo:linha
Problema: o que está errado
Impacto: o que acontece se não corrigir
Fix: mudança específica e acionável (não "considere", não "talvez")
```

No fim:
- Total por severidade
- Recomendação: **shippa / corrige primeiro / repensa**
- Se está limpo: "World-class. Shippa." e para.

Não aponte estilo. Não aponte preferências. Se o código é sólido, diga em uma linha.
