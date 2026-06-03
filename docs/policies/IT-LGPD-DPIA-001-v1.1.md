# Data Protection Impact Assessment (DPIA) — v1.1

## Template de Avaliação de Impacto de Proteção de Dados

**Documento:** IT-LGPD-DPIA-001 v1.1
**Data de Emissão:** 2026-05-07
**Última Revisão:** 2026-05-07 (revisão de patch — cross-link ADR-0016)
**Próxima Revisão:** 2027-05-07
**Autoridade Emitente:** RT — Direção Técnica
**Status:** Vigente
**Substitui:** IT-LGPD-DPIA-001 v1.0 (status → obsoleto)
**Substituído por:** —
**Patch motivation:** Forward-reference declarado em Plan 00-02 (`# OPEN — DPIA cross-link`) resolvido pela publicação de ADR-0016 (Plan 00-04). Esta revisão consolida o método de gestão de risco em uso na plataforma — antes vago ("riscos identificados informalmente"), agora concreto (FMEA-lite conforme ADR-0016).

> **Nota operacional:** este arquivo é o _patch v1.1_ em `docs/policies/`. A publicação no SGQ via fluxo `revisao-emitida` (RN-SGQ-03) está pendente de login do RT no módulo SGQ em produção. Quando publicado, o doc `/labs/{labId}/sgq-documentos/{id}` com `codigo='IT-LGPD-DPIA-001'` v1.0 transiciona para `status='obsoleto'`, e este v1.1 entra como `status='vigente'` com `substitui` apontando ao v1.0 e `substituidoPor` ainda nulo. Cross-link ADR-0016 declarado na Section 4 (Riscos Potenciais).

---

## Diferenças relevantes vs v1.0

A tabela abaixo lista os deltas do patch. O restante do documento permanece idêntico ao template v1.0 e deve ser preenchido caso a caso.

| Seção                     | Mudança                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabeçalho                 | Versão 1.0 → 1.1; chain `substitui` populada; data de emissão atualizada.                                                                      |
| §4 Riscos Potenciais      | Substituído por referência canônica a ADR-0016 + módulo `risks` (FMEA-lite NPR P×S×D, escala 1–125).                                           |
| §6 Medidas de Mitigação   | Cross-link com `RiskRegister` em `/risks` → cada risco pessoal-de-dado relevante deve estar registrado lá com tratamento + owner + reviewDate. |
| §10 Histórico de revisões | Linha v1.0 (vigente até 2026-05-07) e linha v1.1 (vigente desde 2026-05-07).                                                                   |

---

## 4. Riscos Potenciais à Proteção de Dados (PATCHED)

> **Nova diretriz v1.1.** A análise de riscos qualitativa anterior é substituída pela metodologia FMEA-lite formalizada em **ADR-0016 — FMEA-lite Methodology** (`docs/adr/0016-fmea-lite-methodology.md`). Toda identificação de risco que envolva dados pessoais (CPF, dados clínicos, biométricos, profissionais) **deve** resultar em entrada no módulo `risks` da plataforma, com:

| Campo                   | Origem                | Observação                                                                                             |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ | ------- | ---------- | --------- |
| `codigo`                | Auto-sugerido         | RISK-001, RISK-002, …                                                                                  |
| `descricao`             | Manual (50–500 chars) | Descrever cenário de exposição.                                                                        |
| `processo`              | Enum                  | Ex.: `coleta`, `armazenamento`, `terceirizado`.                                                        |
| `categoria`             | Enum                  | Para LGPD usar `dados-pessoais` (categoria dedicada).                                                  |
| `probabilidade (P)`     | 1..5                  | Escala canônica ADR-0016.                                                                              |
| `severidade (S)`        | 1..5                  | Severidade ao titular do dado.                                                                         |
| `deteccao (D)`          | 1..5                  | Capacidade de detectar antes da consumação (5 = baixíssima detecção).                                  |
| `npr`                   | Server-computed       | NPR = P × S × D. **Cliente não escreve este campo** (DL-1, ver ADR-0016).                              |
| `nivel`                 | Derivado              | baixo (≤24), medio (25–60), alto (61–99), critico (≥100).                                              |
| `tratamento.estrategia` | Enum                  | `evitar                                                                                                | reduzir | transferir | aceitar`. |
| `tratamento.acoes[]`    | Append-only           | Plano de ação com prazo + owner + status.                                                              |
| `reviewDate`            | Default = +365d       | Revisão automática anual; risk com `npr ≥ 100` ganha alerta mensal extra (ver `scheduledReview` cron). |

**Threshold semântica (default — configurável por lab):**

| Nivel   | NPR range | Ação requerida pelo RT                                                  |
| ------- | --------- | ----------------------------------------------------------------------- |
| baixo   | 1–24      | Monitorar; revisão anual obrigatória.                                   |
| medio   | 25–60     | Plano de ação documentado em `tratamento.acoes[]`.                      |
| alto    | 61–99     | Mitigação ativa; revisão semestral recomendada.                         |
| critico | ≥100      | Topo da fila; revisão mensal automática + plano de mitigação executivo. |

**Escape hatch (ADR-0016).** Se a metodologia FMEA-lite mostrar-se insuficiente após uso real (Riopomba V1.4 retro), refinar para ISO 31000 numa ADR-0016a versionada — o módulo `risks` está desenhado para evoluir P/S/D em fields opcionais sem migração destrutiva.

---

## 6. Medidas de Mitigação (PATCHED)

> **Nova diretriz v1.1.** Cada medida de mitigação registrada nesta DPIA **deve** ter espelho no módulo `risks` da plataforma, em `tratamento.acoes[]`. O ciclo de vida da ação (`pendente → em-andamento → concluida`) é rastreado lá; o histórico é preservado (append-only por server callable `risks_updateRisk`).

**Cross-link operacional:**

- DPIA seção 6.X "Medida M-001 — Encriptação at rest do storage de PDFs" ↔ `RISK-014.tratamento.acoes[idx]` em `/risks`.
- Auditor (RT ou DICQ) acessa: `/risks` → filtra por `categoria='dados-pessoais'` → exporta `reviewHistory` para evidenciar follow-through.

**Trilha de evidência (RDC 978 Art. 86 + DICQ 4.14.6):**

1. Toda mutation em risco LGPD passa por callable server-side (`risks_createRisk`, `risks_updateRisk`, `risks_registrarRevisao`) — assinatura lógica + chainHash garantidos por `onRiskEventCreated` trigger.
2. `verifyChain(riskId)` script (em `functions/scripts/`) reproduz a cadeia para auditoria externa.

---

## 10. Histórico de Revisões

| Versão | Data       | Status   | Mudança                                                                               |
| ------ | ---------- | -------- | ------------------------------------------------------------------------------------- |
| 1.0    | 2026-04    | obsoleto | Versão inicial — gestão de risco qualitativa.                                         |
| 1.1    | 2026-05-07 | vigente  | Patch para cross-link com ADR-0016 (FMEA-lite). Operacionalização via módulo `risks`. |

---

## Referências cruzadas

- **ADR-0016** — FMEA-lite Methodology (`docs/adr/0016-fmea-lite-methodology.md`)
- **Plan 00-04** — Risks FMEA-lite Skeleton (`.planning/phases/00-rdc-blockers/00-04-risks-fmea-skeleton-PLAN.md`)
- **Módulo `risks`** — `src/features/risks/` (entry: `RisksView.tsx`)
- **Callables** — `functions/src/modules/risks/{createRisk,updateRisk,softDeleteRisk,registrarRevisao}.ts`
- **DICQ 4.14.6** — Gestão de risco (identificação, análise, avaliação, tratamento, monitoramento)
- **ISO 15189:2022 §8.5** — Actions to address risks and opportunities
- **RDC 978/2025 Art. 86** — PGQ componente 2 (gerenciamento de risco)
- **LGPD Art. 32** — DPIA obrigatória para tratamentos de alto risco
