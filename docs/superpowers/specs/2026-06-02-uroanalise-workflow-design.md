# Uroanálise — Workflow de Cadastro + Worklab ID + Picker de Insumos

**Data:** 2026-06-02
**Status:** Aprovado pelo CTO (brainstorm §1-§6)
**Módulo:** `uroanalise` (`src/features/uroanalise/`)
**Motivação:** Eliminar redigitação de tira/controle ao registrar corrida; introduzir Worklab ID sequencial do paciente para rastreabilidade cross-system (laudo paciente no Worklab ↔ CQ no app).
**Abordagem escolhida:** **A — Mínima e cirúrgica.** Estende `UroanaliseLot` com `tipo` + `worklabIdAtual` + subcoleção `aberturas/`. Picker custom lê de `ciq-uroanalise`. 3-5 arquivos modificados/criados.

---

## Sumário executivo

Hoje, ao registrar uma corrida de uroanálise, o operador digita manualmente 8 campos (lote/marca/fabricante/validade da tira + lote/nível/fabricante/abertura/validade do controle) mesmo tendo acabado de cadastrar o mesmo insumo em "Lotes CIQ → Novo lote". O form não tem integração com `InsumoPicker`, e o tipo `UroanaliseRun` já tem `insumosSnapshot` (linhas 288-291 de `types/Uroanalise.ts`) sem usar — `buildInsumoSnapshot` existe em `src/features/insumos/types/InsumoSnapshot.ts:50`.

A dor adicional é regulatória: o **Worklab ID sequencial de paciente** (gerado pelo sistema Worklab à chegada do paciente) precisa ser registrado no CQ para fechar a rastreabilidade cross-system. Hoje não existe nenhum campo de worklab em `UroanaliseRun` ou `UroanaliseLot`.

Este spec introduz:

1. `tipo: 'tira' | 'controle'` em `UroanaliseLot` (default back-compat: `controle`)
2. Subcoleção `aberturas/` em cada lote, registrando cada "faixa de uso" (abertura + worklabId)
3. Picker custom que substitui os 8 inputs de digitação por 2 dropdowns
4. Campo `worklabId` (regex `^\d{1,10}$`) na `AberturaLote` e denormalizado no `UroanaliseRun` para queries
5. Edição de cadastro via **correction events** (pattern A — append-only, padrão do SGQ)

---

## 1. Arquitetura & modelo de dados

### 1.1 Estender `UroanaliseLot`

```ts
// src/features/uroanalise/types/Uroanalise.ts (adições)
export interface UroanaliseLot {
  // ... (campos existentes preservados)

  // ── Tipo do insumo (Fase Worklab — 2026-06-02) ─────────────────────────────
  /**
   * 'controle' = material de controle (Bio-Rad, Randox, etc.).
   * 'tira'     = tira reagente (Combur, Multistix, etc.).
   * Lotes legados sem `tipo` são tratados como 'controle' por convenção.
   */
  tipo?: 'tira' | 'controle';

  /** Convenience: worklabId do paciente que abriu o lote pela última vez. */
  worklabIdAtual?: string;

  // ── Campos específicos de TIRA ─────────────────────────────────────────────
  /** Nome comercial da tira (ex: "Combur-10"). */
  tiraNome?: string;
  /** Fabricante da tira (ex: "Roche"). */
  tiraFabricante?: string;
  /** Referência/catálogo do fabricante. */
  tiraReferencia?: string;
  /** Quantidade de tiras no frasco. */
  tiraQuantidade?: number;
}
```

### 1.2 Nova subcoleção `aberturas/`

Path: `/labs/{labId}/ciq-uroanalise/{lotId}/aberturas/{aberturaId}`

```ts
export interface UroAberturaLote {
  id: string;
  labId: string;
  lotId: string;

  /**
   * Worklab ID = ID sequencial de paciente gerado pelo sistema Worklab.
   * Ex: paciente 1000 chega → lab abre lote com worklabId='1000' → examina
   * pacientes 1000-1049 → paciente 1050 chega → reabre com worklabId='1050'.
   * Regex server-enforced: ^\d{1,10}$.
   */
  worklabId: string;

  /** Quando a abertura foi registrada. */
  abertoEm: Timestamp;
  /** UID do operador. */
  abertoPor: string;
  /** Nome do operador (denormalizado p/ exibição). */
  abertoPorNome: string;

  /** Snapshot congelado do lote no momento da abertura — não muda após criar. */
  snapshotLote: {
    tipo: 'tira' | 'controle';
    lote: string;
    fabricante: string;
    validade: string; // YYYY-MM-DD
    nivel?: UroNivel; // só se tipo='controle'
    tiraNome?: string;
    tiraReferencia?: string;
  };

  /** Dispositivo físico (opcional — para Tecnovigilância RDC 67/2009 + 551/2021). */
  dispositivoFabricante?: string;
  dispositivoModelo?: string;
  dispositivoSerie?: string;

  observacoes?: string;

  /** True enquanto a abertura é a "faixa ativa". False após nova abertura do mesmo lote. */
  ativa: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 1.3 Estender `UroanaliseRun`

```ts
export interface UroanaliseRun {
  // ... (campos existentes preservados)

  // ── Vínculo com AberturaLote (Fase Worklab — 2026-06-02) ──────────────────
  /** FK para aberturas/{aberturaId} do lote de TIRA. */
  aberturaTiraId?: string;
  /** FK para aberturas/{aberturaId} do lote de CONTROLE. */
  aberturaControleId?: string;

  /**
   * Worklab IDs denormalizados no run para queries/relatórios sem join.
   * Cópia de AberturaLote.worklabId no momento do save.
   */
  worklabIdTira?: string;
  worklabIdControle?: string;
}
```

### 1.4 Estender `InsumoSnapshot`

`InsumoSnapshot` em `src/features/insumos/types/InsumoSnapshot.ts:16` ganha 2 campos opcionais para preservar o link com a abertura no snapshot do run:

```ts
export interface InsumoSnapshot {
  // ... (campos existentes preservados)
  /** FK p/ aberturas/{aberturaId} do UroanaliseLot de origem. */
  aberturaId?: string;
  /** Worklab ID do paciente que abriu o lote (no momento da corrida). */
  worklabIdInicio?: string;
  /** Timestamp da abertura que originou este snapshot. */
  worklabIdAberturaEm?: Timestamp;
}
```

`buildInsumoSnapshot` (linha 50) é atualizado para popular esses campos quando o insumo carrega referência à abertura.

### 1.5 Rules Firestore (bloco gerado por `hcq-firestore-rules-generator`)

Adicionar em `firestore.rules` (próximo do bloco existente de `ciq-uroanalise`):

```rules
match /labs/{labId}/ciq-uroanalise/{lotId}/aberturas/{aberturaId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create: if isActiveMemberOfLab(labId)
    && isValidWorklabId(request.resource.data.worklabId)
    && request.resource.data.abertoPor == request.auth.uid;
  allow update, delete: if false;  // append-only; correções via /ciq-audit

  function isValidWorklabId(wid) {
    return wid is string && wid.matches('^\\d{1,10}$');
  }
}
```

Sem `isAdminOrOwner` estrito — qualquer membro ativo pode abrir/registrar corrida (a auditoria via chain já cobre a rastreabilidade do autor).

### 1.6 Back-compat

- Lotes sem `tipo` → tratados como `'controle'`. Hook `useUroLotes` aplica `tipo ?? 'controle'`.
- Runs antigos (sem `aberturaTiraId`/`aberturaControleId`) → continuam válidos. Badge "Dados pré-worklab" no histórico.
- Abertura retroativa: CTA inline "Vincular a uma abertura" permite escolher uma `AberturaLote` existente e popular `aberturaTiraId` no run legacy (escreve evento `URO_LEGACY_VINCULADO` no `/ciq-audit`).

---

## 2. UI/UX

**Princípio:** zero revolução visual. Preservar o layout e a estrutura atual de `UroanaliseFormRedesigned`. Substituímos 8 inputs de texto por 2 dropdowns picker que se encaixam exatamente onde estavam.

### 2.1 Antes vs. depois

| Seção               | Antes                                                                                           | Depois                           |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| **Tiras reagentes** | 4 inputs: `loteTira`, `tiraMarca`, `fabricanteTira`, `validadeTira`                             | 1 dropdown picker + linha-resumo |
| **Controle**        | 5 inputs: `loteControle`, `nivel`, `fabricanteControle`, `aberturaControle`, `validadeControle` | 1 dropdown picker + linha-resumo |

Linha-resumo abaixo de cada picker mostra:

- Tira: "Lote 04862025 · Roche Combur-10 · Válido até 12/2026 · Aberto para paciente Worklab #1000"
- Controle: "Lote 05842025 · Bio-Rad · Nível N · Válido até 03/2027 · Aberto para paciente Worklab #1000"

Link "Trocar worklabId" abaixo de cada linha-resumo abre modal de seleção de aberturas (default = atual).

### 2.2 Componentes novos

```
src/features/uroanalise/components/
├── UroInsumoPicker.tsx              ← Dropdown genérico (tira|controle)
├── UroLoteTipoSelector.tsx          ← Radio "Tira" | "Controle" (em NovoLoteModal)
├── UroAberturaModal.tsx             ← Captura worklabId ao criar lote
├── UroAberturaSelector.tsx          ← Modal "Trocar worklabId" (escolhe abertura)
├── LoteEditModal.tsx                ← Pattern A — edição com motivo
├── AbaAberturas.tsx                 ← Sub-aba "Histórico de aberturas" no LotSidebar
src/features/uroanalise/hooks/
├── useUroLotes.ts                   ← Estende para filtrar por tipo
├── useUroAberturas.ts               ← NOVO — lista aberturas de um lote
├── useUroAberturaAtiva.ts           ← NOVO — pega a abertura ativa
```

### 2.3 Comportamento do picker (`UroInsumoPicker.tsx`)

- Single-select com busca fuzzy por lote/fabricante
- Lista apenas lotes com `tipo` compatível (tira → `tipo='tira'`; controle → `tipo='controle'`)
- Lista apenas lotes com **pelo menos 1 abertura ativa**
- Filtro de validade: `lote.validade > dataRealizacao` (override `insumoVencidoOverride` continua valendo — vê `CoagulacaoRun` para semântica)
- Tooltip no item: "Aberto em DD/MM por NOME · worklabId ATUAL · abrange pacientes N..M"
- Subcomponente de busca com debounce 200ms
- Acessibilidade: `aria-activedescendant`, navegação por teclado (↑↓ Enter Esc)

### 2.4 Empty states

- **Nenhum lote cadastrado** → picker mostra "Nenhum lote de {tipo} cadastrado" + CTA "Cadastrar primeiro lote" que abre `UroAberturaModal` com campo Tipo pré-selecionado
- **Lote cadastrado mas sem nenhuma abertura** (caso legacy pré-migração) → badge "Sem worklabId — registrar abertura antes de usar" no item (visualmente desabilitado) + CTA "Registrar abertura" inline
- **Lote vencido sem override** → badge "VENCIDO" + CTA "Usar vencido (requer justificativa)" que abre prompt de motivo + flag `insumoVencidoOverride` no submit

### 2.5 `UroAberturaModal.tsx`

Acionado pelo CTA "Cadastrar novo" no picker OU ao criar um lote via `NovoLoteModal`:

```
┌────────────────────────────────────────────┐
│ Abrir lote de TIRA                         │
│                                            │
│ Lote:        [04862025         ]           │
│ Worklab ID:  [1000             ]           │
│ Aberto em:   [02/06/2026       ] (auto)    │
│ Operador:    [Joana Silva      ] (auto)    │
│                                            │
│ Snapshot do lote (read-only):              │
│   Fabricante: Roche                        │
│   Nome:       Combur-10                    │
│   Validade:   12/2026                      │
│   Tira ref:   COMBUR10-RO                  │
│                                            │
│ Observações (opcional):                    │
│ [                                          ]│
│                                            │
│ [ Cancelar ]            [ Registrar ]      │
└────────────────────────────────────────────┘
```

- Worklab ID: input texto com regex client-side `^\d{1,10}$`, placeholder "1000", tooltip explicativo "ID sequencial de paciente gerado pelo Worklab"
- Submit desabilitado se worklabId inválido
- Após criar: toast "Lote aberto para paciente Worklab #1000"

### 2.6 Migração do `NovoLoteModal` existente

Adicionar radio "Tipo" no topo (`'tira' | 'controle'`). Campos exibidos são filtrados pelo tipo escolhido. Após salvar o lote, abre `UroAberturaModal` para capturar o worklabId da primeira abertura (não pula etapa — todo lote novo precisa de pelo menos 1 abertura).

### 2.7 Fallback de 1 sprint

Se o usuário fechar o `UroAberturaModal` sem submeter, o `UroanaliseFormRedesigned` mostra inputs legacy de digitação por 1 sprint (até 2026-06-15). Banner amarelo informa: "A partir de 15/06/2026 o cadastro de tira/controle passa a ser feito via picker. Cadastre o worklabId no lote."

Após 2026-06-15: feature flag `UROANALISE_LEGACY_FALLBACK_ENABLED` é desligada. Inputs legacy somem do form.

---

## 3. Fluxo de dados + invariantes

### 3.1 Fluxo principal (UI → Firestore)

```
1. /hub/uroanalise → "Registrar corrida"
2. UroanaliseFormRedesigned monta:
   - useUroLotes({ tipo: 'tira' })      → lista de lotes de tira
   - useUroLotes({ tipo: 'controle' })  → lista de lotes de controle
   - useUroAberturas({ loteId: X })     → abertura ativa de cada lote
3. Picker exibe listas filtradas (validade > dataRealizacao)
4. Usuário seleciona LoteX (tira) + LoteY (controle)
5. Linha-resumo renderiza com worklabId da abertura ativa
   (ou "Trocar worklabId" para escolher outra abertura)
6. useSaveUroRun submit:
   a) Resolve aberturaTiraId + aberturaControleId
   b) Constrói InsumoSnapshot com aberturaId + worklabIdInicio
   c) Valida Zod schema
   d) Cria doc em /labs/{labId}/ciq-uroanalise/{lotId}/runs/{runId}:
      - labId (redundante)
      - insumosSnapshot.tira + insumosSnapshot.controle
      - aberturaTiraId + aberturaControleId
      - worklabIdTira + worklabIdControle (denormalizado)
      - logicalSignature + createdAt serverTimestamp
   e) Trigger Onda 4 (ciq-audit) escreve evento URO_RUN_CRIADO
7. Toast: "Corrida registrada. worklabId TRA: 1000 | CTR: 1000"
```

### 3.2 Invariantes

| #   | Invariante               | Garantia                                                                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | Snapshot imutável        | `insumosSnapshot` no run é cópia congelada de `buildInsumoSnapshot`                          |
| 2   | Abertura vinculada       | Cada run aponta para `aberturaId` específico (não muda após save)                            |
| 3   | Worklab ID obrigatório   | Zod refinement falha se `aberturaTiraId` ausente E `requerControlePorCorrida=true`           |
| 4   | Validade > realização    | Refinement Zod `dataRealizacao <= validadeLote`                                              |
| 5   | Coerência de tipo        | Picker de tira filtra `tipo='tira'`; picker de controle filtra `tipo='controle'`             |
| 6   | Multi-tenant             | `labId` no path + redundante no payload (validation: `request.resource.data.labId == labId`) |
| 7   | Operador ativo           | Rules: `isActiveMemberOfLab(labId)`                                                          |
| 8   | Audit chain append-only  | Trigger Onda 4 valida `prev_hash`                                                            |
| 9   | Retrocompat              | Runs antigos (sem `aberturaTiraId`) seguem válidos                                           |
| 10  | Worklab ID sem duplicata | Hook `useUroAberturas` filtra duplicatas; UI avisa se conflito                               |

---

## 4. Migração legacy → Redesigned

### 4.1 Estratégia de 3 fases

**Fase 1 — Big-bang atômico (D-day, ~2026-06-05):**

- Corta `UroanaliseView.tsx` (legado). `UroanaliseRedesignedShell.tsx` vira entry point oficial.
- Picker integrado ao `UroanaliseFormRedesigned.tsx` (substitui 8 inputs).
- `UroanaliseForm.tsx` permanece no repo como referência histórica, sem ser importado.
- Feature flag `UROANALISE_REDESIGNED_ENABLED` removida.

**Fase 2 — Sweep de digitação livre (1 sprint depois, ~2026-06-15):**

- `UroanaliseForm.tsx` deletado.
- `UroanaliseFormSchema` legacy removido; Zod refinado consome apenas `aberturaTiraId`/`aberturaControleId`.
- `useSaveUroRun` consolidado — sem `legacyMode` branch.
- `featureFlag.ts` limpo.
- Fallback de digitação livre desabilitado (`UROANALISE_LEGACY_FALLBACK_ENABLED=false`).

**Fase 3 — Auditoria retroativa (read-only, agendada após UAT):**

Script `functions/scripts/backfill-uroanalise-tipo.ts` (one-shot, idempotente):

- Lê `labs/{labId}/ciq-uroanalise` onde `tipo` ausente
- Grava `tipo='controle'` (default back-compat)
- Log: `{ total: N, updated: M, skipped: K }` em `auditLogs`
- Requer ack explícito do CTO (AGENTS.md §3)

### 4.2 Compatibilidade de dados

- **Lotes legados (sem `tipo`):** tratados como controle por convenção; badge "Lote legado — classificar como tira/controle" no `UroLotSidebar` + CTA inline que abre `LoteEditModal` para setar `tipo`
- **Runs legados (sem `aberturaTiraId`):** continuam válidos; badge "Dados pré-worklab" no histórico do run + CTA retroativo "Vincular a uma abertura"
- **Abertura retroativa:** CTA inline em runs legacy abre `UroAberturaSelector` para escolher uma `AberturaLote` existente do mesmo lote; após escolher, atualiza `aberturaTiraId`/`aberturaControleId` no run + escreve evento `URO_LEGACY_VINCULADO` no `/ciq-audit`

### 4.3 Critério de go-live

- **Smoke E2E** via `smoke-test-openclaw/PROMPT_FOCUSED.md` (4 fluxos, 8-12 min)
- **UAT manual** com Labclin principal por 3 dias
- **Rollback (emergência):** se algo crítico quebrar nos 7 dias pós-D-day, reabilitar `UROANALISE_LEGACY_FALLBACK_ENABLED=true` (volta inputs legacy no form); após 7 dias, fallback é removido permanentemente conforme Fase 2
- **Backfill Fase 3 só roda após:** D-day + UAT aprovado + janela de 7 dias de rollback expirada

---

## 5. Compliance + auditoria

### 5.1 Mapeamento regulatório

| Norma                   | Requisito                                          | Como atende                                                         |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| RDC 302/2005 Art. 5.4.3 | Registros CIQ identificam lote/fabricante/validade | `InsumoSnapshot` + `aberturaId` congela tudo                        |
| RDC 978/2025 Art. 167   | Rastreabilidade por corrida                        | `aberturaTiraId`/`aberturaControleId` + `worklabId*` no run         |
| RDC 67/2009 + 551/2021  | Tecnovigilância                                    | `notivisa*` preservados + `AberturaLote` vincula dispositivo físico |
| CLSI GP16-A3            | Identificação de lote aberto/uso                   | `AberturaLote` é unidade de "faixa de uso"                          |
| LGPD Art. 9             | Operador identificado                              | `abertoPor` + `abertoPorNome` + `operadorId` no run                 |
| LGPD Art. 37            | Logs de acesso imutáveis                           | Chain-hash Onda 4 + `auditLogs` append-only                         |

### 5.2 Audit chain (Onda 4) — eventos novos

| Ação                           | Evento                 | Trigger                           |
| ------------------------------ | ---------------------- | --------------------------------- |
| Criar AberturaLote             | `URO_LOTE_ABERTO`      | `onCreate` em `aberturas/`        |
| Criar UroanaliseRun            | `URO_RUN_CRIADO`       | `onCreate` em `runs/`             |
| Reabrir run (status)           | `URO_RUN_REABERTO`     | `onUpdate` com mudança de status  |
| Backfill `tipo='controle'`     | `URO_LOTE_BACKFILLED`  | `onUpdate` durante script         |
| Vincular abertura a run legacy | `URO_LEGACY_VINCULADO` | `onUpdate` no run legacy          |
| Editar cadastro (correction)   | `URO_LOTE_CORRIGIDO`   | `onUpdate` no lote OU na abertura |

Cada evento: `{ hash, prevHash, operatorId, timestamp, motivo? }`.

- `motivo` obrigatório em: `URO_RUN_REABERTO`, `URO_LEGACY_VINCULADO`, `URO_LOTE_CORRIGIDO` (qualquer campo da whitelist editável)
- Em `URO_LOTE_CORRIGIDO`: `{ field, oldValue, newValue, motivo, operatorId, ts }`

### 5.3 Notivisa

Sem mudança nos fields `notivisa*`. Ganho colateral: `AberturaLote` é evidência de "qual dispositivo físico estava em uso" — campos opcionais `dispositivoFabricante` + `dispositivoModelo` + `dispositivoSerie` na abertura, exibidos no relatório quando presentes.

### 5.4 Compliance checklist (Fase 0a)

`UroComplianceChecklist.tsx` ganha 2 itens:

- Abertura registrada por worklabId (≥1 abertura ativa por lote usado em corrida)
- Snapshot congelado (verifica `insumosSnapshot.aberturaId` presente)

### 5.5 Retenção (RDC 978 Art. 86)

- `UroanaliseLot`: 5 anos após `validadeControle` (ou `validadeTira` se `tipo='tira'`)
- `AberturaLote`: 5 anos após `abertoEm`
- `UroanaliseRun`: 5 anos após `createdAt`

---

## 5b. Edição de cadastro (Pattern A — correction events)

**Pattern A — Correction events (append-only, padrão do SGQ):**

- Cada edição gera evento `URO_LOTE_CORRIGIDO` no audit chain com `{ field, oldValue, newValue, motivo, operatorId, ts }`
- Read API retorna doc + correção mais recente aplicada (composição de read-model)
- Runs antigos preservam snapshot original (imutável por design)
- Whitelist de campos editáveis:
  - `UroanaliseLot.observacoes` (sem motivo)
  - `UroanaliseLot.nivel` (se controle, com motivo)
  - `AberturaLote.worklabId` (com motivo)
  - `AberturaLote.observacoes` (sem motivo)
  - `UroanaliseLot.tipo` (com motivo — para corrigir classif. errada de lote legado)
- Imutáveis (proteção de auditoria):
  - `UroanaliseLot.lote`, `.fabricante`, `.validade`, `.loteControle`, `.fabricanteControle`
  - `AberturaLote.abertoEm`, `.abertoPor`, `.snapshotLote`, `.abertoPorNome`
  - Qualquer campo de `UroanaliseRun`

**Justificativa:** SGQ já usa esse modelo (POP versões em `sgq/`), audit chain Onda 4 já tem infra (`functions/src/ciqAudit/`), mantém integridade do snapshot do run. Mais simples e auditável que mutação in-place.

**UI:** `LoteEditModal.tsx` (componente novo) renderiza apenas campos editáveis. Para cada campo alterado, prompt de motivo. Submit desabilitado se algum campo alterado não tiver motivo ≥10 chars. Ao salvar, evento no chain + read-model atualizado.

---

## 6. Erros, edge cases, testes

### 6.1 Edge cases

| #   | Cenário                                                 | Tratamento                                                                                                     |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| E1  | Worklab ID duplicado no mesmo lote                      | Picker bloqueia; toast "Já existe abertura com este worklabId"                                                 |
| E2  | Lote vencido + sem `insumoVencidoOverride`              | Badge "VENCIDO" + CTA "Usar vencido (requer justificativa)"                                                    |
| E3  | Abertura criada por op A, run por op B                  | Permitido — auditoria registra ambos no chain                                                                  |
| E4  | OCR pós-registro falha                                  | `resultados.ocrOrigem='manual'` + badge                                                                        |
| E5  | 2 aberturas ativas simultâneas (mesmo lote)             | UI avisa "Abertura anterior ainda sem fechamento" + força nova abertura a marcar a anterior como `ativa=false` |
| E6  | Worklab ID com caracteres inválidos                     | Reject no client (regex) + server (rules)                                                                      |
| E7  | Lab migra de Firebase project                           | Sem efeito (dados não migram)                                                                                  |
| E8  | Operador inativo tenta criar run                        | Bloqueado em rules (`isActiveMemberOfLab` falha)                                                               |
| E9  | Corrida sem controle (`requerControlePorCorrida=false`) | Picker controle desabilitado com tooltip "Lote configurado sem controle por corrida"                           |
| E10 | Lote sem nenhuma abertura (legado)                      | Picker mostra "Sem worklabId — registrar abertura antes de usar" + CTA inline                                  |
| E11 | Edição de `worklabId` na abertura                       | Permitido se motivo ≥10 chars; evento `URO_LOTE_CORRIGIDO` registrado                                          |
| E12 | Conflito de edição concorrente                          | Firestore transaction + `updatedAt` + toast "Atualizado por outro operador"                                    |
| E13 | Worklab ID com zeros à esquerda                         | Aceito (ex: `'0001'` = paciente 1); regex não rejeita                                                          |
| E14 | Worklab ID muito grande                                 | Bloqueado: regex `^\d{1,10}$` rejeita > 10 dígitos (~10 bi)                                                    |

### 6.2 Estratégia de testes

**Unit tests (Vitest, mínimo 12 casos):**

1. `useUroLotes` filtra por tipo corretamente
2. `useUroAberturas` retorna apenas aberturas com `ativa=true`
3. Schema valida worklabId (regex) — aceita `"1000"`, rejeita `"abc"`, `"10000"`, `""`
4. Schema aceita `insumoVencidoOverride=true` COM motivo ≥10 chars
5. Schema rejeita `insumoVencidoOverride=true` SEM motivo
6. Schema exige `aberturaTiraId` quando `requerControlePorCorrida=true`
7. Schema rejeita `dataRealizacao > validadeTira`
8. `buildInsumoSnapshot` preserva `aberturaId` + `worklabIdInicio` quando presentes
9. Correction event `URO_LOTE_CORRIGIDO` é criado com `oldValue`, `newValue`, `motivo`
10. Read-model aplica correção mais recente do chain
11. Picker desabilita lote sem aberturas ativas (E10)
12. `LoteEditModal` renderiza campos imutáveis como read-only

**Integration tests (Vitest + Firestore emulator):**

- Criar lote tira → criar abertura → criar run → validar snapshot imutável
- Editar `worklabId` → validar chain event + read-model atualizado
- Tentar editar `loteControle` (imutável) → bloqueado pela UI
- Tentar criar run sem `aberturaTiraId` quando `requerControlePorCorrida=true` → Zod falha
- Backfill script: idempotente (segunda execução não muda nada)

**E2E (smoke-test-openclaw, 4 fluxos):**

1. Criar tira PNCQ (lote `04862025`) → abrir com `worklabId=1000`
2. Criar controle PNCQ (lote `05842025`) → abrir com `worklabId=1000`
3. Registrar corrida com picker → confirmar `aberturaTiraId` + `aberturaControleId` + `worklabIdTira` + `worklabIdControle` no Firestore
4. Editar `worklabId` da abertura com motivo → confirmar `URO_LOTE_CORRIGIDO` no `/ciq-audit`

**Compliance test (1 vez por release):**

- Audit chain completo: 5 ações críticas → 5 eventos com `prevHash` válido
- `verifier.test.mjs` (existente em `functions/test/signatures/`) roda contra o chain

### 6.3 Riscos

| Risco                               | Mitigação                                                |
| ----------------------------------- | -------------------------------------------------------- |
| Operador esquece de abrir lote      | E10 — picker bloqueia + CTA inline                       |
| Worklab ID digitado errado          | E11 — edição com motivo ≥10 chars auditada               |
| Migração legacy quebra runs antigos | §4 Fase 3 — backfill idempotente + feature flag rollback |
| OCR Gemini alucina resultados       | Já mitigado por `UroFieldAuditado`                       |
| Chain hash drift entre labs         | Genesis determinístico por `labId`                       |
| Picker performance com muitos lotes | Cache local no hook (1 refetch por sessão)               |

### 6.4 Critérios de aceite (DoD)

- Picker <500ms (cache local)
- Submit corrida <2s (1 write + 1 chain event + 1 audit log)
- Zero `console.log` em prod
- Zero `any` em types (TS strict)
- 12+ unit tests passando
- 4 fluxos E2E passando
- `hcq-deploy-gates` retorna 0 erros
- Compliance test: 5/5 events válidos
- Acessibilidade AA: foco visível, navegação por teclado funcional no picker

---

## 7. Clarificação sobre Worklab ID

> "lembrando que o worrklab id é sequencial paciente 1 chega no lab e recebe worklab id 1000, logo apos chega paciente 2 o worklab gera 1001 para ele e assim por diante" — CTO, 2026-06-02

**Implicações integradas neste spec:**

- `worklabId` = **ID sequencial de paciente gerado pelo Worklab** (não texto livre)
- **Regex ajustada:** `^\d{1,10}$` (apenas dígitos, até 10 chars; alinha com semântica numérica sequencial)
- **Semântica da `AberturaLote`:** `worklabId` = o ID do paciente que **disparou** a abertura (primeiro paciente examinado na faixa)
- **Range implícito:** entre `Abertura(N)` e próxima `Abertura(M)`, todos os exames com worklabId `N..M-1` usaram o CQ daquela faixa
- **Cross-system traceability:** laudo do paciente 1023 no Worklab ↔ CQ registrado no app entre aberturas 1000 e 1050
- **Modelo de dados:** inalterado (`worklabId` já era `string`, regex é o único ajuste)
- **UI:** tooltip do picker explica "Aberto para paciente Worklab #N — abrange pacientes N..M"
- **Migração legacy:** runs antigos (sem `aberturaTiraId`) ficam com badge "Sem worklabId vinculado" + CTA retroativo `URO_LEGACY_VINCULADO`

---

## 8. Arquivos modificados

| Arquivo                                                                | Tipo de Mudança                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/features/uroanalise/types/Uroanalise.ts`                          | Estender `UroanaliseLot` (tipo, worklabIdAtual, tira\*), `UroanaliseRun` (aberturaTiraId, aberturaControleId, worklabIdTira, worklabIdControle); adicionar export `UroAberturaLote` |
| `src/features/uroanalise/components/UroanaliseForm.schema.ts`          | Remover inputs legacy; adicionar campos `aberturaTiraId`, `aberturaControleId`; refinements worklabId                                                                               |
| `src/features/uroanalise/components/UroanaliseFormRedesigned.tsx`      | Trocar 8 inputs por 2 dropdowns `UroInsumoPicker`; linha-resumo com worklabId                                                                                                       |
| `src/features/uroanalise/hooks/useUroLots.ts`                          | Filtrar por `tipo`; flag `somenteComAberturaAtiva`                                                                                                                                  |
| `src/features/uroanalise/hooks/useSaveUroRun.ts`                       | Resolver `aberturaTiraId`/`aberturaControleId`; popular `worklabIdTira`/`worklabIdControle`; passar `aberturaId` para `buildInsumoSnapshot`                                         |
| `src/features/uroanalise/components/NovoLoteModal.tsx`                 | Radio "Tipo" (tira                                                                                                                                                                  | controle); após salvar, abrir `UroAberturaModal` |
| `src/features/uroanalise/components/UroLotSidebar.tsx`                 | Sub-aba "Histórico de aberturas"; badge "Lote legado" para `tipo` ausente                                                                                                           |
| `src/features/uroanalise/components/UroComplianceChecklist.tsx`        | +2 itens (abertura registrada, snapshot congelado)                                                                                                                                  |
| `src/features/uroanalise/components/UroRedesignedShell.tsx`            | Adicionar handler "Vincular abertura" em runs legacy                                                                                                                                |
| **NOVOS** `src/features/uroanalise/components/UroInsumoPicker.tsx`     | Dropdown genérico (tira\|controle)                                                                                                                                                  |
| **NOVOS** `src/features/uroanalise/components/UroLoteTipoSelector.tsx` | Radio "Tira" \| "Controle"                                                                                                                                                          |
| **NOVOS** `src/features/uroanalise/components/UroAberturaModal.tsx`    | Captura worklabId ao criar lote                                                                                                                                                     |
| **NOVOS** `src/features/uroanalise/components/UroAberturaSelector.tsx` | Modal "Trocar worklabId"                                                                                                                                                            |
| **NOVOS** `src/features/uroanalise/components/LoteEditModal.tsx`       | Edição de cadastro (Pattern A)                                                                                                                                                      |
| **NOVOS** `src/features/uroanalise/hooks/useUroAberturas.ts`           | Lista aberturas de um lote                                                                                                                                                          |
| **NOVOS** `src/features/uroanalise/hooks/useUroAberturaAtiva.ts`       | Pega a abertura ativa                                                                                                                                                               |
| `src/features/insumos/types/InsumoSnapshot.ts`                         | Adicionar `aberturaId?`, `worklabIdInicio?`, `worklabIdAberturaEm?`                                                                                                                 |
| `firestore.rules`                                                      | Adicionar match para `aberturas/` com `isValidWorklabId`                                                                                                                            |
| `src/shared/featureFlag.ts`                                            | Adicionar `UROANALISE_LEGACY_FALLBACK_ENABLED` (7 dias)                                                                                                                             |
| **NOVOS** `functions/scripts/backfill-uroanalise-tipo.ts`              | Script idempotente de backfill `tipo='controle'`                                                                                                                                    |

---

## 9. Não-objetivos (YAGNI)

- **Chain-hash dedicado para AberturaLote** — eventos vão no `/ciq-audit` genérico, sem chain próprio. Justificativa: `insumo-movimentacoes` tem chain porque é **alta frequência** e vida regulatória independente. Aberturas têm baixa cardinalidade (dezenas por lote) e vivem sob o audit chain da corrida.
- **Import automática de worklabId do Worklab** — fora de escopo. Operador copia do Worklab por enquanto. Integração automática fica para fase futura (RDC 978 + 36/2015 não exigem).
- **Histórico de transferências entre equipamentos na abertura** — `dispositivoFabricante/Modelo/Serie` cobrem a evidência mínima. Histórico separado é YAGNI até virar demanda real.
- **QR code na etiqueta do frasco** — fora de escopo. Fica para fase 2 se auditoria pedir.
- **Sync entre labs** (multi-lab) — fora de escopo. Modelo já é multi-tenant; cross-lab sync não é requisito regulatório atual.

---

## 10. Conformidade com guards do AGENTS.md

- **AGENTS.md §3 — Ondas não-negociável:** este spec não toca `firestore.rules.post-onda2` (rules strict). Só adiciona match em `firestore.rules` (Onda 1, já aplicada). Adição é backward-compat: não bloqueia nenhum read/write existente.
- **AGENTS.md §3 — Compliance ANVISA/LGPD:** mudanças em `/ciq-uroanalise` e `/ciq-audit` exigem revisão dupla. Lista de pré-merge:
  1. Code review por 1 senior antes de merge
  2. Smoke E2E em prod (canário — Labclin principal) por 3 dias
  3. UAT manual com RT responsável
- **AGENTS.md §3 — Zero `any` types / zero `console.log` / zero secrets hardcoded:** garantido pelo `hcq-deploy-gates` no PR.
- **AGENTS.md §3 — Zero queries sem limit/paginação:** `useUroLotes` e `useUroAberturas` aplicam `limit(50)` e ordenam por `validade DESC` (tira próxima do vencimento primeiro).

---

## 11. Critério de "pronto para plan"

- [x] Decisão de abordagem registrada (A)
- [x] Todas as 6 seções do brainstorm revisadas
- [x] Clarificação Worklab ID integrada
- [x] Whitelist de campos editáveis + pattern A definidos
- [x] Edge cases mapeados
- [x] Estratégia de testes com DoD
- [x] Lista de arquivos modificados exaustiva
- [x] Não-objetivos listados (YAGNI)
- [x] Guards AGENTS.md conferidos

**Próximo passo:** revisão do CTO sobre este spec → `writing-plans` skill para decompor em fatias executáveis.
