# Coagulação v2 — Plano de Execução Multi-Agente

**Data:** 25/05/2026
**Status:** ATIVO — plano operacional oficial
**Fonte de verdade:** [`coag-v2-master.md`](./coag-v2-master.md)
**Executor primário:** DeepSeek V4 Flash (gratuito)
**Supervisor:** Agente Arquiteto (modelo maior para decisões)

---

## 0. Sumário Executivo

Este documento define a estratégia completa de implementação do redesign do módulo Coagulação, otimizada para:

- **DeepSeek V4 Flash** como executor principal
- **Múltiplos agentes** trabalhando em ondas isoladas
- **Previsibilidade** absoluta — agentes executam, não decidem
- **Baixo custo** — 90%+ do trabalho com modelo gratuito
- **Zero retrabalho** — contratos congelados, execução determinística

### Estrutura do Plano

| Seção | Conteúdo |
|-------|----------|
| 1 | Arquitetura de execução multi-agente |
| 2 | Estratégia onda por onda |
| 3 | Estratégia específica para DeepSeek Flash |
| 4 | Sistema de proteção arquitetural |
| 5 | Template de prompts para agentes baratos |
| 6 | Estratégia de auditoria automática |
| 7 | Estratégia de integração segura |
| 8 | Estratégia de deploy noturno seguro |

### Documentos Complementares

| Documento | Conteúdo |
|-----------|----------|
| [`contracts/control-operacional.md`](./contracts/control-operacional.md) | Contrato congelado da entidade |
| [`contracts/attempt.md`](./contracts/attempt.md) | Contrato congelado da entidade |
| [`contracts/rtaction.md`](./contracts/rtaction.md) | Contrato congelado da entidade |
| [`waves/wave-a-control-operacional.md`](./waves/wave-a-control-operacional.md) | Wave spec completa |
| [`waves/wave-b-attempt.md`](./waves/wave-b-attempt.md) | Wave spec completa |
| [`waves/wave-c-rtaction.md`](./waves/wave-c-rtaction.md) | Wave spec completa |
| [`waves/wave-d-ui-operador.md`](./waves/wave-d-ui-operador.md) | Wave spec completa |
| [`waves/wave-e-ui-rt.md`](./waves/wave-e-ui-rt.md) | Wave spec completa |
| [`waves/wave-f-auditoria.md`](./waves/wave-f-auditoria.md) | Wave spec completa |
| [`waves/wave-g-deploy.md`](./waves/wave-g-deploy.md) | Wave spec completa |
