# Coagulação — Análise do Sistema Legado (Engenharia Reversa)

**Data:** 25/05/2026
**Status:** CONGELADO — snapshot histórico para referência.
**Propósito:** Não é roadmap. Não é goal. É referência técnica para reaproveitamento seletivo no v2.

---

## 0. Leitura Rápida

Este documento documenta **como o módulo Coagulação está hoje em produção** para que o redesign (v2) possa:

- Reaproveitar regras regulatórias (RDC 978, CLSI H47-A2, ISTH)
- Preservar rastreabilidade (snapshots, chain-hash, logicalSignature)
- Preservar avaliação estatística (Westgard CLSI C24-A3)
- Identificar dívida técnica e acoplamentos antigos
- **NÃO herdar**: entidades, nomes, workflows, estados, abstrações

**Documento de destino do redesign:** [`coag-v2-master.md`](./coag-v2-master.md)

---

## 1. Modelo de Dados Atual (Firestore)

### 1.1 Coleções

| Path | Entidade | Status no redesign |
|------|----------|---------------------|
| `/labs/{labId}/ciq-coagulacao` | `CoagulacaoLot` | ❌ Substituída (lote vira campo, não entidade raiz) |
| `/labs/{labId}/ciq-coagulacao/{lotId}/runs` | `CoagulacaoRun` | ❌ Substituída por `Attempt` |
| `/labs/{labId}/equipment-setups/{equipamentoId}` | `EquipmentSetup` | 🔄 Simplificado (slot-model mantido) |
| `/labs/{labId}/insumos` | `Insumo` | ✅ Preservado (spine compartilhada) |

### 1.2 Entidade `CoagulacaoRun` (legado)

**Path:** `labs/{labId}/ciq-coagulacao/{lotId}/runs/{runId}`

**Campos principais:**

```
CoagulacaoRun = {
  // Identificação
  runCode: string                    // CG-YYYY-NNNN
  nivel: 'I' | 'II'                  // CLSI H47-A2
  frequencia: 'DIARIA' | 'LOTE'
  equipamento: 'Clotimer Duo'
  
  // Controle (pode virar campo do Attempt se mantivermos "controle")
  loteControle: string
  fabricanteControle: string
  aberturaControle: string
  validadeControle: string
  
  // Reagente (mesma lógica)
  loteReagente: string
  fabricanteReagente: string
  aberturaReagente: string
  validadeReagente: string
  
  // Calibração INR (opcional — derivado de TP+ISI+MNPT)
  isi?: number
  mnpt?: number
  
  // Ambiente (opcional)
  temperaturaAmbiente?: number
  umidadeAmbiente?: number
  
  // Resultados
  resultados: Record<CoagAnalyteId, number>
  
  // Conformidade
  conformidade: 'A' | 'R'
  analitosComViolacao: CoagAnalyteId[]
  westgardViolations?: WestgardViolation[]
  acaoCorretiva?: string             // obrigatória se conformidade === 'R'
  
  // NOTIVISA (tecnovigilância)
  notivisaTipo?: 'queixa_tecnica' | 'evento_adverso'
  notivisaStatus?: 'pendente' | 'notificado' | 'dispensado'
  notivisaProtocolo?: string
  notivisaDataEnvio?: string
  notivisaJustificativa?: string
  
  // Snapshot insumos (RDC 786/2023 art. 42)
  insumosSnapshot?: {
    reagente?: InsumoSnapshot
    reagenteTtpa?: InsumoSnapshot
    controle?: InsumoSnapshot
  }
  
  // Snapshot equipamento (sobrevive aposentadoria)
  equipamentoId?: string
  equipamentoSnapshot?: EquipamentoSnapshot
  
  // Assinatura regulatória
  logicalSignature: string
  signedBy?: string
  signedAt?: Timestamp
  
  // Overrides auditados
  insumoVencidoOverride?: boolean
  qcNaoValidado?: boolean
  overrideMotivo?: string
}
```

**Decisão v2:** Run é entidade pesada demais (30+ campos). Vira **Attempt** — unidade de execução operacional com menos campos, e o "lote" vira metadado invisível ao operador.

### 1.3 Entidade `CoagulacaoLot` (legado)

**Path:** `labs/{labId}/ciq-coagulacao/{lotId}`

**Conceito atual:** "1 lote físico de controle = 1 documento que agrega múltiplas runs"
**Conceito v2:** lote vira **campo** (`loteRef`) do `ControlOperacional` ou `Attempt`, não entidade raiz. O operador nunca pensa em "lote" — pensa em "controle de hoje".

```
CoagulacaoLot = {
  nivel: 'I' | 'II'
  loteControle: string
  fabricanteControle: string
  aberturaControle: string
  validadeControle: string
  
  mean?: Record<CoagAnalyteId, number>   // Alvo do fabricante
  sd?: Record<CoagAnalyteId, number>     // SD do fabricante
  
  runCount: number                        // Mantido por transação
  lotStatus: 'valido' | 'atencao' | 'reprovado' | 'sem_dados'
  
  coagDecision?: 'A' | 'NA' | 'Rejeitado'  // Decisão RT
  decisionBy?: string
  decisionAt?: Timestamp
  
  setupType?: 'principal' | 'validacao_paralela' | null
  pinnedBy?: string | null
  pinnedAt?: Timestamp | null
  pinHistory?: Array<{...}>
}
```

### 1.4 `EquipmentSetup` (mantido simplificado)

**Path:** `labs/{labId}/equipment-setups/{equipamentoId}`

Evolução histórica:
- **Fase A** (21/04/2026): `docId = module` → 1 setup por módulo
- **Fase D** (21/04/2026 2º turno): `docId = equipamentoId` → N equipamentos por módulo

**Slots:**
```
activeReagenteId: string | null        // Reagente TP
activeReagenteTtpaId?: string | null   // Reagente TTPA (coag específico)
activeControleId: string | null        // Controle de qualidade
activeTiraUroId: string | null         // Tira de uroanálise
```

**Preservação v2:** slots preservados. Simplificação: 1 documento por equipamento ativo, sem "legado" dual (Fase A→D).

---

## 2. Hooks Atuais

| Hook | Arquivo | Função | Manter? |
|------|---------|--------|---------|
| `useSaveCoagRun` | `hooks/useSaveCoagRun.ts` | Orquestra save completo de uma corrida (encontra/cria lote → Westgard → assinatura → persistência → auditoria) | ❌ Substituída por `Attempt.save()` |
| `useCoagWestgard` | `hooks/useCoagWestgard.ts` | Avalia regras CLSI sobre runs | ✅ **Preservado** (lógica estatística) |
| `useCoagLots` | `hooks/useCoagLots.ts` | Subscription por lotes (filtro opcional por nível) | ❌ Substituída (lote não é entidade) |
| `useCoagRuns` | `hooks/useCoagRuns.ts` | Subscription por runs de um lote | ❌ Substituída por `Attempt.list` |
| `useCoagSignature` | `hooks/useCoagSignature.ts` | SHA-256 + logicalSignature | ✅ **Preservado** (regulatório — não simplificar) |
| `useInsumoFlowGuard` | `insumos/hooks/useInsumoFlowGuard.ts` | Conferência obrigatória + override audited | 🔄 Simplificado (menos estados) |

### 2.1 `useSaveCoagRun` — Fluxo Detalhado

```
1. Encontra ou cria CoagulacaoLot por (nivel + loteControle)
2. Busca corridas existentes do lote (para histórico Westgard)
3. Constrói CoagulacaoRun simulado (CG-TEMP) e concatena no array de runs
4. Roda computeCoagWestgard() sobre o array → obtém conformidade/violações
5. Gera runCode sequencial (CG-YYYY-NNNN) via transação
6. Gera SHA-256 logicalSignature via Web Crypto
7. Monta CoagulacaoRun final e persiste
8. Atualiza lotStatus + runCount no documento do lote
9. Grava registro de auditoria imutável (void — não bloqueia)
```

**Decisão v2:** Fluxo de 9 passos é pesado. No v2, Attempt.save() tem 3 passos:
1. Captura dados operacionais (resultado, equipamento, controle)
2. Calcula Westgard (visível apenas para RT)
3. Persiste com snapshot + assinatura

### 2.2 `computeCoagWestgard` — Regras Preservadas

```javascript
const CLSI_WESTGARD_RULES = [
  '1-2s',   // 1 medição > 2SD do mean → aviso
  '1-3s',   // 1 medição > 3SD do mean → rejeição
  '2-2s',   // 2 medições consecutivas > 2SD mesmo lado → rejeição
  'R-4s',   // Range > 4SD entre 2 medições consecutivas → rejeição
  '4-1s',   // 4 medições consecutivas > 1SD mesmo lado → rejeição
  '10x',    // 10 medições consecutivas mesmo lado → rejeição
];
```

**Preservação v2:** 100%. Essas regras são lei regulatória (CLSI C24-A3, RDC 978). O que muda é **quando** aparecem ao usuário (timeline RTAction, não formulário).

---

## 3. UI Atual (Componentes)

### 3.1 Component Tree

```
CoagulacaoView (topbar + shell)
├── CoagLevelPills          ← seletor nivel I/II (paridade hematologia)
├── CoagLotSwitcher         ← dropdown "Em uso" com lote ativo
├── CoagulacaoContent       ← orquestrador: lista runs + form
│   ├── CoagulacaoForm      ← wizard 4 blocos (30+ campos)
│   ├── CoagulacaoIndicadores ← KPIs (conformidade %, últimas runs)
│   └── CoagulacaoRelatorioPrint ← impressão para arquivo físico
└── CoagAuditor             ← painel de aprovação RT (decision: A/NA/Rejeitado)
```

### 3.2 CoagulacaoForm — Blocos e Campos

**Bloco 1: Operador**
- Avatar (auto do auth)
- `cargo`: enum('biomedico', 'tecnico', 'farmaceutico')
- `operatorDocument`: CRBM-MG 12345

**Bloco 2: Corrida**
- Seletor de nível (**Nível I** | **Nível II**) → obrigatório
- Frequência (Diária | Por troca de lote)
- Coagulômetro (disabled: "Clotimer Duo")
- `RegulatoryReferencesBar` (RDC 302/2005 · RDC 978/2025 · CLSI)

**Bloco 3: Equipamento**
- `EquipamentoSelector` (Fase D — selecionar equipamento físico)

**Bloco 4: Insumos em Uso**
- `ConferenciaInsumoAtivo` (reagente + reagenteTtpa + controle)
- `OverrideModal` (abre se houver insumo vencido/qc-pendente)

**Bloco 5: Material de Controle**
- loteControle, fabricanteControle (preenchido pelo setup)
- aberturaControle, validadeControle
- ExpiryWarning (calculado por `daysToExpiry`)

**Bloco 6: Calibração do Novo Lote** (somente se `isNewLot`)
- mean/SD customizados por analito (opcional — sobrescreve COAG_ANALYTES)

**Bloco 7: Reagente**
- loteReagente, fabricanteReagente (preenchido pelo setup)
- aberturaReagente, validadeReagente

**Bloco 8: Calibração RNI (optional)**
- ISI do lote de tromboplastina
- MNPT do laboratório

**Bloco 9: Ambiente (optional)**
- temperaturaAmbiente, umidadeAmbiente

**Bloco 10: Resultados da Corrida**
- N inputs dinâmicos por analito suportado (derivado de EQUIP_ANALYTES)
- hint "esperado: low–high unit" por analito
- RangeBadge: "Resultados dentro do intervalo" | "Valores fora"

**Bloco 11: Ação Corretiva** (soft-conditional)
- aparece se `outOfRange.length > 0`
- obrigatório se não-conforme (RDC 978 Art. 128)

**Bloco 12: NOTIVISA (Tecnovigilância)** (soft-conditional)
- tipo (queixa_tecnica / evento_adverso)
- status (pendente / notificado / dispensado)
- protocolo, dataEnvio, justificativa

**Total de campos expostos ao operador: ~27**
**Total de blocos: 12**

**Decisão v2:** Reduzir para ~6 campos operacionais + 1 timeline. Todo o resto vira metadado invisível, calculado em background, ou RTAction.

---

## 4. Lógica de Negócio Preservada

### 4.1 Regras Westgard (100% preservadas)

- **1-2s**: Aviso. Não bloqueia.
- **1-3s**: Rejeição. Requer ação corretiva (RT).
- **2-2s**: Rejeição. Requer ação corretiva.
- **R-4s**: Rejeição. Requer ação corretiva.
- **4-1s**: Rejeição. Requer ação corretiva.
- **10x**: Rejeição. Requer ação corretiva.
- Conforme? → salva silenciosamente
- Rejeitado? → marca `conformidade: 'R'` + `analitosComViolacao` + RT decide

### 4.2 Insumo como Gate (preservado, simplificado)

- Operador seleciona equipamento → busca setup → slot `activeReagenteId` tem reagente?
- ✅ Sim: preenche form automaticamente (lote, fabricante, datas) via useEffect
- ❌ Não: bloqueia save + exige configurar (Fase B1-etapa2)

### 4.3 Snapshot Imutável (100% preservado)

Cada save congela:
- `reagenteSnapshot`: lote, fabricante, abertura, validade, qtdRestante
- `reagenteTtpaSnapshot`: idem
- `controleSnapshot`: idem
- `equipamentoSnapshot`: id, nome, modelo, númeroSérie

Sobrevive a:
- Edição do documento mestre do insumo
- Descarte do insumo
- Aposentadoria do equipamento (soft-delete + retenção 5a)
- Eventual cleanup pós-retenção (snapshot nunca deletado por regra audit)

### 4.4 Assinatura Lógica (100% preservada)

```
logicalSignature = SHA-256(
  operatorDocument ‖ lotId ‖ nivel ‖ loteControle ‖
  resultadosCanonical ‖ dataRealizacao
)
```

Onde `resultadosCanonical = JSON.stringify(resultados)` com chaves ordenadas alfabeticamente.

Rules Firestore validam:
- `hash.size() == 64` (hex string = 256 bits)
- `ts is timestamp` (signedAt é Timestamp do servidor)
- `operatorId === request.auth.uid` (quem assinou == quem está autenticado)

### 4.5 Auditoria Imutável (100% preservada)

Cada save dispara `writeCoagAuditRecord` (fire-and-forget):

```
Path: /labs/{labId}/ciq-coagulacao-audit/{auditId}
Fields: {
  runId, lotId, logicalSignature, signedBy, signedAt,
  nivel, loteControle, resultados, analitosComViolacao,
  westgardViolations, conformidade, lotStatus, dataRealizacao
}
```

---

## 5. Dívida Técnica Identificada

### 5.1 Acoplamento com Lote (alto)

**Problema:** Lote é entidade raiz. Runs vivem dentro dele. Query forçada por `(labId × loteId)`, não por operador/data/controle.
**Impacto:** Operador precisa "saber qual lote está ativo" para criar uma run simples.
**Decisão v2:** Lote vira campo (`loteRef`) no Attempt ou `ControlOperacional`.

### 5.2 Níveis I/II como Pill Separadas (médio)

**Problema:** Operador escolhe explicitamente "Nível I" ou "Nível II" no topo do form.
**Impacto:** Cognição de decisão desnecessária. Na prática, operador sabe "é o controle normal" ou "é o anticoagulado".
**Decisão v2:** Nível vira propriedade do `ControlOperacional` (setup do insumo). Operador só executa.

### 5.3 12 Blocos no Formulário (alto)

**Problema:** Wizard de 12 blocos com ~27 campos. Cada bloco parece "passo" mas na verdade muitos são readonly (alimentados pelo setup).
**Impacto:** Ilusão de input manual, mas na prática operador confirma 30% dos campos.
**Decisão v2:** Tentativa (Attempt) tem ~6 campos reais. Resto é contexto (snapshot).

### 5.4 NOTIVISA no Formulário (médio)

**Problema:** Seção de tecnovigilância aparece no mesmo form da corrida, mas só é preenchida em ~1% dos casos (quando há defeito de produto).
**Impacto:** 99% dos cases veem campos irrelevantes.
**Decisão v2:** NOTIVISA vira **RTAction** — técnico responsável preenche quando pertinente, não o operador da corrida.

### 5.5 Calibração INR Opcional (baixo)

**Problema:** ISI + MNPT opcional no form. Em 80% dos labs, RNI vem pronto do equipamento.
**Impacto:** Operador vê campos que raramente preenche.
**Decisão v2:** Move para configuração do equipamento (EquipmentSetup raro). Tentativa só grava RNI final.

### 5.6 `isNewLot` como Heurística (médio)

**Problema:** UI detecta "lote novo" via comparação `existingLots.some(...)` no cliente e mostra bloco de calibração customizável.
**Impacto:** Heurística frágil — depende de subscription em tempo real, race conditions.
**Decisão v2:** Calibração de bula vira **RTAction** pré-attempt (RT configura mean/SD do novo lote antes do operador executar).

---

## 6. O Que Preservar Integralmente

Esses componentes são **regulatórios** — redesign NÃO simplifica:

| Item | Por quê |
|------|---------|
| **Regras Westgard (6 regras)** | CLSI C24-A3, RDC 978 Art. 128 |
| **Snapshots imutáveis** | RDC 786/2023 art. 42 (sobrevive deletar doc mestre) |
| **LogicalSignature** | ADR-0012, chain-hash regulatório |
| **Audit Records (fire-and-forget)** | ADR-0012, LGPD Art. 37 |
| **`daysToExpiry` check** | Bloqueio de reagente/controle vencido |
| **`ConferenciaInsumoAtivo`** (core) | Gate regulatório — sem simplificar |
| **`OverrideModal`** com `overrideMotivo` | Auditoria obrigatória (RDC 978) |
| **`EQUIP_ANALYTES`** por equipamento | Gate técnico (analito sem suporte não aparece) |
| **`COAG_ANALYTES` baselines** | Bula do fabricante — fonte única de mean/SD |
| **`computeCoagWestgard`** (core) | Lógica estatística — 100% preservada |

---

## 7. O Que Redesenhar Radicalmente

| Item legado | Por quê redesenhar | Substituição v2 |
|------------|-------------------|-----------------|
| `CoagulacaoLot` (entidade) | Operador pensa em "controle de hoje", não em "lote" | Campo em `Attempt` |
| `CoagulacaoRun` (30+ campos) | Complexidade excessiva, 27 campos expostos | `Attempt` (~6 campos) |
| `CoagulacaoForm` (12 blocos) | UI wizard pesada | 1 tela simples + timeline |
| LevelPills + LotSwitcher | Operador decide coisas (nível, lote) que já estão no setup | Invisível — derivado de `ControlOperacional` |
| NOTIVISA section no form | Pertence ao RT, não ao operador | RTAction |
| Calibração bula (isNewLot) | Heurística frágil + acoplamento de subscription | RTAction pré-attempt |
| Calibração INR (ISI/MNPT) | Campo opcional raramente preenchido | Configuração do equipamento (uma vez) |

---

## 8. Compatibilidade Regulatória Preservada

| Regulação | Aplicação no Legado | Aplicação no v2 |
|-----------|---------------------|-----------------|
| RDC 978/2025 Art. 128 | Rastreabilidade + ação corretiva | Same |
| RDC 786/2023 Art. 42 | Snapshot sobrevive deleção | Same |
| RDC 302/2005 | Dois níveis de controle | Same |
| RDC 67/2009 + 551/2021 | NOTIVISA tecnovigilância | Same, movida para RTAction |
| CLSI H47-A2 | Dois níveis obrigatórios | Same |
| CLSI C24-A3 | Regras Westgard | Same |
| LGPD Art. 37 | Auditoria imutável | Same |
| DICQ sec. 2.4 | CIQ quantitativo (coag) | Same |

---

## 9. Resumo para Referência Rápida

**Preservar:**
- `COAG_ANALYTES` baselines (3 analitos × 2 níveis × 5 campos)
- `EQUIP_ANALYTES` dicionário de analitos por equipamento
- `computeCoagWestgard` função (6 regras)
- `useCoagSignature` (SHA-256 + canonical results)
- `InsumoSnapshot` + `EquipamentoSnapshot` builders
- `ConferenciaInsumoAtivo` + `OverrideModal` gates
- `writeCoagAuditRecord` serviço

**Redesenhar:**
- `CoagulacaoRun` → `Attempt`
- `CoagulacaoLot` → `ControlOperacional` (lote vira campo)
- `CoagulacaoForm` (12 blocos) → tela de Attempt (simples)
- Nível I/II explícito → implícito (via insumo)
- NOTIVISA no form → RTAction
- Calibração de bula (isNewLot) → RTAction pré-attempt

---

**Próximo passo:** [`coag-v2-master.md`](./coag-v2-master.md) — fonte oficial da nova arquitetura.
