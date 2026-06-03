# Audit de compatibilidade — entidades existentes vs spines RDC 978

- **Data:** 2026-04-25
- **Escopo:** todos os módulos em produção + Fases C/D/E parciais
- **Modelo de referência:** [ADR 0001](../adr/0001-arquitetura-spines-rdc-978.md) e [compliance-spines.md (skill)](../../../Users/labcl/.claude/skills/hc-quality/reference/compliance-spines.md)
- **Snapshot:** captura do estado em commit `cbe1081` (visualizado pela auditoria)

---

## 1. Resumo executivo

| Spine                   | Status        | Nota                                                                                   |
| ----------------------- | ------------- | -------------------------------------------------------------------------------------- |
| Pessoa/Operador         | 🟡 Parcial    | falta cpfHash, conselhoProfissional, cargo estruturado, RT único, qualificacoes        |
| Fornecedor              | 🟡 Parcial    | falta status de qualificação, evidências, requalificação, categorias                   |
| Nota Fiscal             | 🟡 Parcial    | falta itens[] estruturado, conferenciaOk, ncId                                         |
| Lote (Insumo)           | 🟡 Parcial    | notaFiscalId/fornecedorId existem mas opcionais; falta nfItemIndex                     |
| Movimentação assinada   | ✅ Aderente   | chain-hash + pending→sealed completo                                                   |
| Equipamento             | 🟡 Parcial    | falta qualificacaoInicial, proximaCalibracao, proximaManutencao                        |
| POP / documento vigente | ⚪ Ausente    | não existe                                                                             |
| NC                      | 🔴 Divergente | CT tem `NaoConformidadeTemp` próprio; CIQ não tem nada — fragmentado                   |
| Audit log assinado      | 🟡 Parcial    | `/insumo-movimentacoes` e `/ciq-audit` ✅; equipamentos/fornecedores/NF sem assinatura |

**Top violações críticas:**

1. 🔴 **NC fragmentada** — cada módulo inventa seu modelo. Quebra ponto único de tratamento exigido pela RDC.
2. 🔴 **Pessoa sem qualificações** — User/Member não têm `qualificacoes[]`. Educação Continuada tem `treinamentos` desconectado.
3. 🔴 **Lote sem vínculo NF/Fornecedor obrigatório** — `notaFiscalId` é opcional. Lotes legados sem rastreabilidade fiscal.
4. 🟠 **POP totalmente ausente** — nenhum módulo grava `popId` em runs.
5. 🟠 **HMAC duplicado** — `chainHash` implementado 2x sem helper compartilhado.

---

## 2. Spine-by-spine

### Pessoa/Operador — 🟡

**Schema atual (`/users/{uid}`, `authService.ts:17-35`):**

- `email`, `displayName`, `labIds`, `roles`, `isSuperAdmin`, `createdAt`

**Member (`/labs/{labId}/members/{uid}`):** `role`, `active` (denormalizado em `users.roles`).

**Gaps vs canônico:**

- ❌ `cpfHash` (LGPD)
- ❌ `conselhoProfissional` (CRBM/CRF/CRM/CRBio)
- ❌ `cargo` estruturado em Member
- ❌ `responsavelTecnico: boolean` único por lab
- ❌ `/labs/{labId}/qualificacoes` não existe
- ✅ `operatorId`/`createdBy` referenciado em runs

**Nota:** Educação Continuada (`/labs/{labId}/treinamentos`) existe mas desconectado de Member — não vincula `uid → modulosLiberados`.

**Arquivos:** [src/features/auth/services/authService.ts:77-155](../../src/features/auth/services/authService.ts), [src/types/index.ts:293-301](../../src/types/index.ts), [src/features/educacao-continuada/services/ecFirebaseService.ts](../../src/features/educacao-continuada/services/ecFirebaseService.ts).

---

### Fornecedor — 🟡

**Schema atual (`Fornecedor.ts:19-57`):** `razaoSocial`, `nomeFantasia`, `cnpj` (validado módulo 11), `inscricaoEstadual`, `telefone`, `email`, `endereco`, `observacoes`, `ativo`, timestamps.

**Gaps:**

- ❌ `status: 'pendente'|'qualificado'|'suspenso'|'desqualificado'`
- ❌ `qualificadoEm`, `qualificadoPor`, `proximaRequalificacao`
- ❌ `evidencias[]` (alvará, licença sanitária, ISO, certificado de fabricante)
- ❌ `categoriasFornecidas[]`
- ⚠️ `contato.responsavel` ausente

**Arquivo:** [src/features/fornecedores/types/Fornecedor.ts:19-57](../../src/features/fornecedores/types/Fornecedor.ts).

---

### Nota Fiscal — 🟡

**Schema atual (`NotaFiscal.ts:14-52`):** `fornecedorId`, `numero`, `serie`, `chaveAcesso`, `dataEmissao`, `dataRecebimento`, `valorTotal`, `arquivoPdfUrl`, `observacoes`.

**Gaps críticos:**

- ❌ `conferenciaOk`, `desviosObservados`, `ncId`
- ❌ `itens: NFItem[]` estruturado — sem isso é impossível "qual produto veio em qual NF e gerou qual lote"
- ✅ `recebidoPor` implícito via `createdBy`

**Arquivo:** [src/features/fornecedores/types/NotaFiscal.ts:14-52](../../src/features/fornecedores/types/NotaFiscal.ts).

---

### Lote (Insumo) — 🟡

**Schema atual (`Insumo.ts:1-512`):** discriminated union completa por `tipo` (controle/reagente/tira-uro). Já tem:

- ✅ `notaFiscalId` (opcional, Fase E)
- ✅ `fornecedorId` (opcional)
- ✅ `produtoId` (opcional, Fase C)
- ✅ `status` ('ativo'|'fechado'|'vencido'|'descartado')
- ✅ `abertoEm`, `abertoPor`, `esgotadoEm`
- ✅ `modulos[]`

**Gaps:**

- ❌ `notaFiscalId`/`fornecedorId` **opcionais** — devem ser obrigatórios após cutover Fase E
- ❌ `nfItemIndex` ausente
- ⚠️ Campos legados de TiraUro (`notaFiscal: string`, `fornecedor: string`) coexistem com FK

**Arquivos:** [src/features/insumos/types/Insumo.ts](../../src/features/insumos/types/Insumo.ts), [functions/src/modules/insumos/chainHash.ts](../../functions/src/modules/insumos/chainHash.ts).

---

### Movimentação assinada — ✅

**Schema (`Insumo.ts:384-416` + `chainHash.ts`):** `tipo` ('entrada'|'abertura'|'fechamento'|'descarte'), `operadorId`, `operadorName`, `timestamp`, `motivo?`, `payloadSignature`, `chainHash`, `status` ('pending'|'sealed').

**Implementação:** HMAC + chain-hash via CF onCreate. Genesis hash `INSUMO_CHAIN_GENESIS_HASH`. Teste em `test/unit/insumos/chainGenesis.test.ts`.

**Status:** padrão de referência. **Replicar em todas as outras spines sensíveis.**

---

### Equipamento — 🟡

**Schema (`Equipamento.ts:63-147`):** `module`, `name`, `modelo`, `fabricante`, `numeroSerie`, `status` ('ativo'|'manutencao'|'aposentado'), `manutencaoDesde`, `aposentadoEm`, `retencaoAte`. Audit em `/equipamentos-audit` (append-only mas **sem chain-hash**).

**Gaps:**

- ❌ `qualificacaoInicial: { data, evidenciaUrl, responsavelUid }`
- ❌ `proximaCalibracao`, `proximaManutencaoPreventiva`
- ⚠️ Calibração/manutenção rastreadas apenas em CT (controle-temperatura), não em equipamentos-audit

**Arquivo:** [src/features/equipamentos/types/Equipamento.ts](../../src/features/equipamentos/types/Equipamento.ts).

---

### POP / documento vigente — ⚪

**Status:** não existe. Nenhum módulo CIQ grava `popId` ou `popVersaoId` em runs. Violação direta da RDC para rastreabilidade de procedimento vigente.

---

### NC — 🔴 Divergente

**Implementação fragmentada:**

- CT: `NaoConformidadeTemp` em [ControlTemperatura.ts:161-177](../../src/features/controle-temperatura/types/ControlTemperatura.ts) — específico de temperatura.
- CIQ-Imuno/Coagulação/Uro/Lots: nenhuma referência a NC.
- Insumos: `descarte` com `motivo` em movimentação, mas não vincula a NC.

**Impacto:** RDC exige ponto único de abertura/tratamento. Sistema atual não consegue listar "todas as NCs do lab".

**Próximo passo formal:** ADR 0003.

---

### Audit log assinado — 🟡

**Consolidado:** `/insumo-movimentacoes` ([chainHash.ts](../../functions/src/modules/insumos/chainHash.ts)) e `/ciq-audit` ([writer.ts](../../functions/src/modules/ciqAudit/writer.ts) + triggers.ts).

**Não consolidado:**

- `/equipamentos-audit` — append-only sem chain-hash
- CT: `LogicalSignature` (HMAC string sem encadeamento)
- Fornecedor, NF, runs CIQ: sem auditoria assinada

**Duplicação:** SHA-256 + chainHash implementado 2x sem helper compartilhado.

---

## 3. Consumidores (módulos CIQ que escrevem `runs`)

| Módulo                      | operadorId      | loteId                       | equipamentoId                   | popId | snapshots                                                             |
| --------------------------- | --------------- | ---------------------------- | ------------------------------- | ----- | --------------------------------------------------------------------- |
| **CIQ-Imuno**               | ✅ `operatorId` | ✅ `lotId` + snapshot string | 🟡 string `equipamento`, não FK | ❌    | ✅ `insumosSnapshot`, `equipamentoSnapshot` (Fase B1/D, intencionais) |
| **Coagulação**              | ✅ herda CQRun  | ✅ `lotId`                   | 🟡 string `equipamento`         | ❌    | ⚠️ snapshots não documentados                                         |
| **Uroanálise**              | ✅ herda CQRun  | ✅ `lotId`                   | ⚠️ pode estar ausente (manual)  | ❌    | ⚠️ snapshot não documentado                                           |
| **Hematologia (lots/runs)** | ✅ `createdBy`  | ✅ `lotId`                   | ❌ não existe                   | ❌    | ✅ `reagentesSnapshot[]` (FR-10 audit)                                |

**Observação:** snapshots intencionais documentados (CIQ-Imuno, Hematologia) seguem o padrão da spine. Coagulação e Uroanálise precisam **documentar** os snapshots ou migrar pra FK.

---

## 4. Padrão de audit chain — duplicação e gaps

**Implementações de HMAC + chainHash existentes:**

1. [functions/src/modules/insumos/chainHash.ts](../../functions/src/modules/insumos/chainHash.ts)
2. [functions/src/modules/ciqAudit/writer.ts](../../functions/src/modules/ciqAudit/writer.ts) + triggers.ts

**Helper compartilhado:** ❌ não existe. Refatoração proposta: `functions/src/helpers/cryptoAudit.ts` exportando `sha256Hex(payload)` e `chainHashFor(prevHash, payload)`.

**Módulos sem auditoria que precisam adotar (com prioridade):**

- Fornecedor (qualificação, requalificação, suspensão)
- Nota Fiscal (recebimento, conferência)
- Equipamento (qualificacao inicial, calibração, manutenção, aposentadoria)
- POP (aprovação, vigência, obsolescência)
- NC (abertura, transição, resolução, eficácia)

---

## 5. Violações priorizadas

| #   | Sev | Código            | Descrição                                                     | Localização                                    | Ação                                                                                |
| --- | --- | ----------------- | ------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | 🔴  | V-001-NC          | Spine NC fragmentada                                          | `ControlTemperatura.ts:161`                    | Criar `/labs/{labId}/nao-conformidades` global; migrar CT                           |
| 2   | 🔴  | V-002-QUAL        | Pessoa sem qualificações                                      | `authService.ts:17-35`, `ecFirebaseService.ts` | Criar `/labs/{labId}/qualificacoes/{qualId}` + vincular a Member                    |
| 3   | 🔴  | V-003-LOTE-NF     | Lote sem NF obrigatória                                       | `Insumo.ts:103`, `NotaFiscal.ts`               | Tornar `notaFiscalId` obrigatório pós-cutover Fase E + backfill                     |
| 4   | 🟠  | V-004-POP         | POP ausente globalmente                                       | (todo o app)                                   | Criar `/labs/{labId}/pops` + versões; runs gravam `popId, popVersaoId, popHash`     |
| 5   | 🟠  | V-005-PERSON      | User sem cpfHash/conselho/cargo                               | `authService.ts:17`, `types/index.ts:293`      | Adicionar campos a UserDocument + Member                                            |
| 6   | 🟠  | V-006-NF-COMPLETO | NF sem itens estruturados                                     | `NotaFiscal.ts:14-52`                          | Adicionar `itens: NFItem[]` + `conferenciaOk` + `ncId`                              |
| 7   | 🟠  | V-007-FORNECEDOR  | Fornecedor sem qualificação                                   | `Fornecedor.ts:19-57`                          | Adicionar `status` + `evidencias[]` + requalificação                                |
| 8   | 🟡  | V-008-EQUIP-QUAL  | Equipamento sem qualificação inicial                          | `Equipamento.ts:63-147`                        | Adicionar `qualificacaoInicial`, `proximaCalibracao`, `proximaManutencaoPreventiva` |
| 9   | 🟡  | V-009-AUDIT-DUP   | HMAC duplicado                                                | `chainHash.ts`, `writer.ts`                    | Extrair `helpers/cryptoAudit.ts`                                                    |
| 10  | 🟡  | V-010-IMUNO-REF   | Equipamento como string em runs CIQ                           | `CIQImuno.ts:105`                              | Adicionar `equipamentoId` opcional + validar                                        |
| 11  | 🟡  | V-011-COAG-POP    | Coagulação sem POP nas runs                                   | `Coagulacao.ts:32+`                            | Adicionar `popId` + `popVersaoId` + `popHash`                                       |
| 12  | 🟡  | V-012-NF-ITENS    | NF não estrutura itens                                        | `NotaFiscal.ts:14-52`                          | Estruturar `NFItem[]`                                                               |
| 13  | ⚪  | V-013-NAMING      | `operatorId` vs `createdBy`, `equipamentoId` vs `equipamento` | múltiplos                                      | Padronizar FK por `id`; snapshot em campo separado                                  |

---

## 6. Próximos ADRs sugeridos

1. **ADR 0002 — Migração de Lote para vínculo obrigatório NF/Fornecedor**
   Plano dual-write + cutover, backfill de docs legados (matching `lote+fabricante` contra NF), invalidação/override auditado de Insumos órfãos.

2. **ADR 0003 — Spine NC global**
   `/labs/{labId}/nao-conformidades` como ponto único; migra `NaoConformidadeTemp` (CT-específico) por referência; chain-hash em audit; integração CIQ + Equipamento + Fornecedor + NF.

3. **ADR 0004 — POP / documento vigente**
   `/labs/{labId}/pops/{popId}/versoes/{versaoId}` com `hashConteudo`; runs em todos os módulos CIQ carregam `popId, popVersaoId, popHash` (congelado); CF atualiza `vigenteAte` ao ativar nova versão.

4. **ADR 0005 — Helper de audit chain compartilhado** (técnico, não-regulatório)
   `functions/src/helpers/cryptoAudit.ts` consolidando `sha256Hex` + `chainHashFor` + padrão `pending → sealed`. Pré-requisito para 0002, 0003, 0004 sem duplicação.

---

## 7. Conclusão

A fundação está sólida: chain-hash em insumo-movimentacoes é o gold standard e prova que o time consegue executar o padrão. O débito está na **expansão do padrão** para outras spines e na **completude dos schemas** (qualificações, NC global, POP, vínculos NF/Fornecedor obrigatórios).

Não há violação que exija ação **imediata** em prod — sistema está funcional. A prioridade é: **fechar V-001 a V-003 antes de iniciar Compras (Fase E)** para evitar refator depois.
