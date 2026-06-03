# Guia de Módulo — Gestão de Equipamentos

**DICQ Bloco H · 5.3.1.1–5.3.1.7 · RDC 978/2025 Art. 42 · RDC 786/2023**
**Status atual:** Em produção (Fase D — skeleton). Gaps documentados abaixo.

---

## Objetivo

Garantir que todos os analisadores, coagulômetros, leitores de tira e equipamentos de apoio diagnóstico estejam cadastrados, rastreáveis, com histórico de calibração e manutenção documentado, e com ciclo de vida completo (ativo → manutenção → aposentado) conforme RDC 978/2025 Art. 42 e DICQ 5.3.1.

---

## Já existe no HC Quality

| Componente                                              | Path                                             | Status     |
| ------------------------------------------------------- | ------------------------------------------------ | ---------- |
| Entidade `Equipamento` (12+ campos, soft-delete)        | `src/features/equipamentos/types/Equipamento.ts` | ✅ Em prod |
| Firestore `/labs/{labId}/equipamentos`                  | `firestore.rules`                                | ✅ Em prod |
| Ciclo de vida: ativo / manutencao / aposentado          | `Equipamento.ts`                                 | ✅ Em prod |
| Destino final (venda / sucata / devolução)              | `Equipamento.ts`                                 | ✅ Em prod |
| Retenção 5 anos pós-aposentadoria                       | `RETENCAO_ANOS_POS_APOSENTADORIA = 5`            | ✅ Em prod |
| `EquipamentoAuditEvent` (chain-hash append-only)        | `Equipamento.ts`                                 | ✅ Em prod |
| UI: `EquipamentoFormModal`, `EquipamentoLifecycleModal` | `src/features/equipamentos/components/`          | ✅ Em prod |
| `ModuleEquipamentosPanel` por módulo CIQ                | `src/features/equipamentos/components/`          | ✅ Em prod |
| `EquipamentoSelector` reutilizável em forms CIQ         | `src/features/equipamentos/components/`          | ✅ Em prod |
| Callable `equipamentosCallables.ts`                     | `src/features/equipamentos/services/`            | ✅ Em prod |
| Subcoleção calibração (upload de certificado)           | `functions/src/callables/calibracao/`            | ✅ Em prod |

---

## O que é comum com outros módulos

| Padrão                                          | Onde aparece                                          | Descrição                     |
| ----------------------------------------------- | ----------------------------------------------------- | ----------------------------- |
| Soft-delete com `deletadoEm`                    | equipamentos, insumos, lab-apoio, fornecedores, risks | Nunca `deleteDoc`.            |
| `logicalSignature` (SHA-256 + operatorId + ts)  | equipamentos, lab-apoio, risks, educacao-continuada   | Server-side; Rules validam.   |
| `chainHash` em trilha de auditoria              | equipamentos-audit, risks-audit, lab-apoio-audit      | Append-only, imutável.        |
| Subcoleção `*-audit` append-only                | equipamentos, risks, insumos                          | CF trigger calcula chainHash. |
| `labId` em todos os docs                        | todos os módulos                                      | Multi-tenancy.                |
| Callable obrigatório para escritas regulatórias | equipamentos, risks, lab-apoio, educacao              | Client só lê.                 |
| Ciclo de vida (status enum)                     | equipamentos, pops, sgq-docs, insumos                 | ativo/inativo/encerrado.      |

---

## Lacunas (DICQ Gap)

| Gap                                                           | DICQ Req        | Prioridade | Observação                                                                                                  |
| ------------------------------------------------------------- | --------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| Subcoleção `manutencoes` (preventiva, corretiva, fora-de-uso) | 5.3.1.5         | Alta       | TD-403 mapeado para Phase 10. Hoje: campo `ultimaManutencao` flat.                                          |
| Calibração com rastreabilidade metrológica (RBC/INMETRO)      | 5.3.1.4         | Alta       | Certificado já uploadável, mas sem validação de acreditadora e alerta de vencimento.                        |
| Verificação dos 12 campos obrigatórios DICQ                   | 5.3.1.7         | Média      | Auditar `Equipamento.ts` vs checklist DICQ (fabricante, série, instrução, contato técnico, inspeções, etc). |
| Integração tecnovigilância → NOTIVISA                         | 5.3.1.6         | Média      | Incidente adverso com equipamento deve gerar notificação. Deferred Phase 8.                                 |
| Alerta de calibração vencida para RT                          | 5.3.1.4         | Média      | Hoje não há cron de alerta. Padrão existe em `controle-temperatura`.                                        |
| Relatório de baixa de bens (aposentadoria + destino final)    | RDC 786 Art. 42 | Baixa      | Exportar PDF do registro de aposentadoria.                                                                  |
| Tela de listagem global (cross-módulo) no hub                 | UX              | Baixa      | Hoje cada módulo CIQ exibe seus próprios equipamentos. Falta visão consolidada.                             |

---

## Estrutura proposta

```
Firestore
├── /labs/{labId}/equipamentos/{equipamentoId}      ← já existe
├── /labs/{labId}/equipamentos-audit/{auditId}       ← já existe (chainHash)
├── /labs/{labId}/equipamentos/{id}/manutencoes/{id} ← NOVO (Phase 10)
└── /labs/{labId}/equipamentos/{id}/calibracoes/{id} ← estender (Phase 9)

UI (src/features/equipamentos/)
├── components/
│   ├── EquipamentoFormModal.tsx       ← já existe
│   ├── EquipamentoLifecycleModal.tsx  ← já existe
│   ├── EquipamentoCard.tsx            ← já existe
│   ├── ModuleEquipamentosPanel.tsx    ← já existe
│   ├── EquipamentoGlobalList.tsx      ← NOVO
│   └── ManutencaoModal.tsx            ← NOVO (Phase 10)
├── hooks/
│   ├── useEquipamentos.ts             ← já existe
│   └── useManutencoes.ts              ← NOVO
└── services/
    ├── equipamentosCallables.ts       ← já existe
    └── manutencaoCallables.ts         ← NOVO
```

---

## Dados / Entidades

### `Equipamento` (já existe — estender)

```
Campos existentes: id, labId, module, name, modelo, fabricante, numeroSerie,
status, criadoEm, atualizadoEm, deletadoEm, aposentadoEm, retencaoAte,
destinoFinal, logicalSignature
```

**Campos a auditar/adicionar para 5.3.1.7:**

- `localInstalacao` (sala/bancada)
- `contatoTecnico` (fabricante / empresa manutenção)
- `dataAquisicao`
- `numeroPatrimonio`
- `intervaloCalibracaoDias` (base para alerta)
- `proximaCalibracao` (calculado)

### `Manutencao` (nova subcoleção)

```
tipo: 'preventiva' | 'corretiva' | 'calibracao' | 'verificacao'
data: Timestamp
realizadoPor: string (operadorId)
empresa: string?
descricao: string
resultado: 'aprovado' | 'reprovado' | 'pendente'
documentoUrl: string?
proximaManutencaoEm: Timestamp?
logicalSignature: LogicalSignature
```

### `CertificadoCalibracaoExtendido` (estender existente)

```
acreditadora: string  // RBC, INMETRO, outro
numeroCertificado: string
validadeEm: Timestamp
rastreabilidadeMetrologica: boolean
```

---

## Ações principais

| Ação                                  | Quem       | Como                        |
| ------------------------------------- | ---------- | --------------------------- |
| Cadastrar equipamento                 | Operador   | Callable server-side        |
| Alterar status (ativo ↔ manutenção)   | RT / Admin | Callable + logicalSignature |
| Aposentar equipamento + destino final | RT / Admin | Callable + audit event      |
| Registrar manutenção / calibração     | Operador   | Callable (nova)             |
| Gerar alerta de calibração vencida    | Sistema    | Cloud Function cron diário  |
| Exportar registro de aposentadoria    | RT         | PDF client-side             |

---

## Integrações

| Módulo                 | Integração                                                                        |
| ---------------------- | --------------------------------------------------------------------------------- |
| `insumos`              | `reagente/tira-uro → equipamentoId` (1:1); controles → `equipamentosPermitidos[]` |
| `runs` (CIQ)           | Corrida vincula `equipamentoId`; status `manutencao` bloqueia criação             |
| `controle-temperatura` | Padrão de alerta de vencimento reutilizável                                       |
| `notivisa`             | Incidente adverso cria draft de notificação (Phase 8)                             |
| `auditoria-interna`    | Checklist de calibração puxa status do equipamento                                |

---

## Critérios de aceite

- [ ] Todos os 12 campos obrigatórios DICQ 5.3.1.7 presentes e preenchidos.
- [ ] `proximaCalibracao` calculado automaticamente com base em `intervaloCalibracaoDias`.
- [ ] CF cron alerta RT via in-app quando calibração vence em ≤ 7 dias.
- [ ] Subcoleção `manutencoes` append-only (sem update/delete).
- [ ] Aposentadoria gera `EquipamentoAuditEvent` com `destinoFinal` e `chainHash`.
- [ ] Corrida CIQ bloqueada se `status === 'manutencao'` (validado em rules + callable).
- [ ] `deletadoEm` (soft-delete) + `retencaoAte` corretos em aposentadoria.
- [ ] PDF de aposentadoria exportável com dados completos.

---

## Fora de escopo

- Controle de inventário de estoque de peças de reposição (pertence a `insumos`).
- Validação de métodos analíticos (pertence a `bioquimica` / Fase Analítica).
- Calibração automática via IoT (out-of-scope até v1.6).
- Tecnovigilância para medicamentos (pertence a NOTIVISA Phase 8).
