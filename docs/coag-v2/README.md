# Coagulação v2 — Índice

Este diretório contém a **fonte única de verdade** para o redesign do módulo Coagulação.

---

## Documentos Oficiais

| Documento                                              | Propósito                                | Status    |
| ------------------------------------------------------ | ---------------------------------------- | --------- |
| [`coag-v2-master.md`](./coag-v2-master.md)             | Arquitetura oficial do v2 (goal)         | ATIVO     |
| [`coag-legacy-analysis.md`](./coag-legacy-analysis.md) | Engenharia reversa do legado             | CONGELADO |
| [`execution-plan.md`](./execution-plan.md)             | Plano de execução multi-agente — sumário | ATIVO     |

## Plano de Execução (8 partes)

| Parte | Conteúdo                  | Arquivo                                                                          |
| ----- | ------------------------- | -------------------------------------------------------------------------------- |
| 1     | Arquitetura de agentes    | [`execution-plan-part1-architecture.md`](./execution-plan-part1-architecture.md) |
| 2     | Estratégia onda por onda  | [`execution-plan-part2-waves.md`](./execution-plan-part2-waves.md)               |
| 3     | Estratégia DeepSeek Flash | [`execution-plan-part3-deepseek.md`](./execution-plan-part3-deepseek.md)         |
| 4     | Proteção arquitetural     | [`execution-plan-part4-protection.md`](./execution-plan-part4-protection.md)     |
| 5     | Templates de prompts      | [`execution-plan-part5-prompts.md`](./execution-plan-part5-prompts.md)           |
| 6     | Auditoria automática      | [`execution-plan-part6-audit.md`](./execution-plan-part6-audit.md)               |
| 7     | Integração segura         | [`execution-plan-part7-integration.md`](./execution-plan-part7-integration.md)   |
| 8     | Deploy noturno            | [`execution-plan-part8-deploy.md`](./execution-plan-part8-deploy.md)             |

## Contratos Congelados

| Entidade             | Contrato                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| `ControlOperacional` | [`contracts/control-operacional.md`](./contracts/control-operacional.md) |
| `Attempt`            | [`contracts/attempt.md`](./contracts/attempt.md)                         |
| `RTAction`           | [`contracts/rtaction.md`](./contracts/rtaction.md)                       |

## Wave Specs

| Wave | Onda                                                                           | Status   |
| ---- | ------------------------------------------------------------------------------ | -------- |
| A    | [`waves/wave-a-control-operacional.md`](./waves/wave-a-control-operacional.md) | Pendente |
| B    | [`waves/wave-b-attempt.md`](./waves/wave-b-attempt.md)                         | Pendente |
| C    | [`waves/wave-c-rtaction.md`](./waves/wave-c-rtaction.md)                       | Pendente |
| D    | [`waves/wave-d-ui-operador.md`](./waves/wave-d-ui-operador.md)                 | Pendente |
| E    | [`waves/wave-e-ui-rt.md`](./waves/wave-e-ui-rt.md)                             | Pendente |
| F    | [`waves/wave-f-auditoria.md`](./waves/wave-f-auditoria.md)                     | Pendente |
| G    | [`waves/wave-g-deploy.md`](./waves/wave-g-deploy.md)                           | Pendente |

---

## Fluxo de Trabalho

1. **Arquiteto** aprova wave spec
2. **Executor** (DeepSeek Flash) implementa via prompt curto
3. **Auditor** valida vs contrato
4. **Anti-Complexity** mede métricas
5. **Integrador** faz merge em `main-v2`
6. Repetir até 7 waves completas
7. Deploy automático noturno se todos gates passam

## Regras Invioláveis

- 3 entidades. Nem mais.
- 3 eventos. Nem mais.
- ≤ 6 campos operacionais expostos.
- Zero termos técnicos em UI operacional.
- Snapshots imutáveis.
- LogicalSignature imutável.
- DeepSeek Flash como executor primário.
