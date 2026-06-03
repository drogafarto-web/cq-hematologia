# Parte 2 — Estratégia Onda por Onda

---

## 2.1 Overview das Ondas

```
Onda A ──→ Onda B ──→ Onda C ──→ Onda D ──→ Onda E ──→ Onda F ──→ Onda G
│          │          │          │          │          │          │
Control   Attempt    RTAction   UI         UI RT      Auditoria  Deploy
Operac.                        Operador              + Integr.
```

**Dependências:**

- A → nenhuma (pode começar imediatamente)
- B → depende de A (precisa ler `ControlOperacional`)
- C → depende de B (precisa ler `Attempt`)
- D → depende de A + B (UI consome ambos)
- E → depende de B + C (painel RT lê attempts e actions)
- F → depende de todas (auditoria + integração)
- G → depende de F (deploy só se tudo aprovado)

**Total estimado:** 7 ondas × 1-3 dias = 2-3 semanas

---

## 2.2 Template de Definição por Onda

Para cada onda, o spec contém:

### Estrutura obrigatória:

```markdown
# Wave [X] — [Nome]

## Objetivo Fechado

Uma frase. O que esta onda entrega. Nada mais.

## Contrato de Entrada

O que deve existir ANTES desta onda começar.

## Definição de Pronto

- [ ] Item 1
- [ ] Item 2
- ...

## Critérios de Rejeição (bloqueia merge)

- [ ] Violação crítica 1
- [ ] Violação crítica 2
- ...

## Checklist Automático

Scripts que rodam e devem passar com exit code 0.

## Testes Obrigatórios

Lista específica de testes que devem ser escritos e passar.

## Rollback

Como reverter com mínimo impacto.

## Arquivos Permitidos

Lista exata de paths que o Executor PODE tocar.

## Arquivos Proibidos

Lista de paths que o Executor NÃO PODE tocar.

## Prompt para Executor

Prompt pronto para colar em DeepSeek Flash.
```

---

## 2.3 Ondas Detalhadas (Índice)

| Onda  | Objetivo                                            | Spec                                                                     |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| **A** | `ControlOperacional` — entidade + service + hook    | [`wave-a-control-operacional.md`](./waves/wave-a-control-operacional.md) |
| **B** | `Attempt` — entidade + save orquestrado             | [`wave-b-attempt.md`](./waves/wave-b-attempt.md)                         |
| **C** | `RTAction` — entidade + aprovação/rejeição/NOTIVISA | [`wave-c-rtaction.md`](./waves/wave-c-rtaction.md)                       |
| **D** | UI Operador — tela simples + form                   | [`wave-d-ui-operador.md`](./waves/wave-d-ui-operador.md)                 |
| **E** | UI RT — painel técnico + lista de tentativas        | [`wave-e-ui-rt.md`](./waves/wave-e-ui-rt.md)                             |
| **F** | Auditoria + Integração cross-onda                   | [`wave-f-auditoria.md`](./waves/wave-f-auditoria.md)                     |
| **G** | Deploy noturno + rollback                           | [`wave-g-deploy.md`](./waves/wave-g-deploy.md)                           |

---

## 2.4 Gate entre Ondas

**Entre cada onda, o gate é:**

1. ✅ Todos testes obrigatórios passam
2. ✅ Auditor aprova aderência ao contrato
3. ✅ Anti-Complexity aprova métricas
4. ✅ Módulos adjacentes não quebrados (hematologia, uroanálise, imuno)
5. ✅ Arquiteto dá sign-off (pode ser via emoji em PR: ✅ = aprovado)

**Se qualquer gate falhar:**

- Executor tem 2 tentativas para corrigir
- Se ainda falhar → escala ao Arquiteto
- Arquiteto pode: (a) autorizar desvio documentado, (b) reescrever spec, (c) abortar onda

---

## 2.5 Autorização Explícita por Onda

Cada onda requer um check de autorização antes de começar:

```
┌────────────────────────────────────────────────────────────┐
│ WAVE [X] AUTHORIZATION                                      │
│                                                              │
│ Spec aprovado: [ ]                                          │
│ Contrato congelado: [ ]                                     │
│ Wave anterior aprovada: [ ]                                 │
│ Branch criada: [ ]                                          │
│                                                              │
│ Assinatura: _____________________ Data: ___/___/___         │
└────────────────────────────────────────────────────────────┘
```

**Nota:** Autorizações estão previamente autorizadas para as 7 ondas (per solicitação do CTO). Gate entre ondas continua ativo — autorização automática só para onda iniciar, não para pular gates.
