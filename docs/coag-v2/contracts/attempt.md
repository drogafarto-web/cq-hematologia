# Contrato Congelado — Attempt

**Status:** CONGELADO — agentes não modificam
**Data:** 25/05/2026
**Wave:** B

---

## Entidade

```typescript
import type { Timestamp } from 'firebase/firestore';
import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs';
import type { WestgardViolation } from '../../../types';
import type { InsumoSnapshot } from '../../insumos/types/InsumoSnapshot';
import type { EquipamentoSnapshot } from '../../equipamentos/types/Equipamento';

/**
 * Attempt — tentativa operacional de executar uma medição de CIQ.
 *
 * Conceito: o que o operador "faz" quando salva resultados.
 * Exposição operacional: ~6 campos (controle, equipamento, 3 resultados, ação corretiva).
 * Resto: snapshots imutáveis + avaliação estatística invisível ao operador.
 *
 * Firestore path: labs/{labId}/attempts/{id}
 * Compliance: RDC 978/2025 Art. 128 · RDC 786/2023 Art. 42 · CLSI C24-A3
 */
export interface Attempt {
  // ── Identificação ──────────────────────────────────────────
  id: string;
  labId: string;
  controlOperacionalId: string; // referência (lote implícito via controle)

  // ── Dados operacionais (visíveis para operador) ────────────
  equipamentoId: string;
  resultados: Record<CoagAnalyteId, number>; // AP, RNI, TTPA
  dataRealizacao: string; // YYYY-MM-DD (auto)

  // ── Avaliação estatística (INVISÍVEL para operador, visível RT) ──
  conformidade: 'A' | 'R'; // calculado, não setado
  violacoes: WestgardViolation[]; // vazio se A
  analitosComViolacao: CoagAnalyteId[]; // vazio se A

  // ── Ação corretiva (opcional — aparece só se R) ───────────
  acaoCorretiva: string | null;

  // ── Snapshots imutáveis (RDC 786/2023 art. 42) ────────────
  snapshot: {
    controle: InsumoSnapshot;
    reagente: InsumoSnapshot;
    reagenteTtpa: InsumoSnapshot | null; // null se equipamento não usa TTPA
    equipamento: EquipamentoSnapshot;
  };

  // ── Overrides auditados ────────────────────────────────────
  overrides: {
    insumoVencido: boolean;
    qcNaoValidado: boolean;
    motivo: string | null; // obrigatório se algum override=true
  };

  // ── Assinatura imutável ────────────────────────────────────
  logicalSignature: string; // SHA-256 hex (64 chars)
  signedBy: string; // UID do operador
  signedAt: Timestamp;

  // ── Timeline ───────────────────────────────────────────────
  criadoEm: Timestamp;
  criadoPor: string;
}

export interface AttemptInput {
  controlOperacionalId: string;
  equipamentoId: string;
  resultados: Record<CoagAnalyteId, number>;
  acaoCorretiva?: string;
}
```

---

## Firestore Path

```
/labs/{labId}/attempts/{id}
```

---

## Service Interface

```typescript
// attemptService.ts

/** Cria uma tentativa (orquestração completa — não chama direto). */
export async function saveAttempt(
  labId: string,
  operatorId: string,
  operatorDoc: string,
  data: AttemptInput,
): Promise<Attempt>;

/** Busca uma tentativa por ID. */
export async function getAttempt(labId: string, id: string): Promise<Attempt | null>;

/** Lista as últimas tentativas do lab (limit 50 por default). */
export async function listAttempts(
  labId: string,
  options?: {
    limit?: number;
    controlOperacionalId?: string;
    conformidade?: 'A' | 'R';
  },
): Promise<Attempt[]>;
```

**⛔ NÃO:**

- Não criar `updateAttempt()` — tentativas são imutáveis após save
- Não criar `deleteAttempt()` — auditoria preservada para sempre
- Não criar `listAttemptsByStatus()` — não há status

---

## Hook Interfaces

```typescript
// useAttempts.ts
interface UseAttemptsResult {
  attempts: Attempt[];
  isLoading: boolean;
  error: string | null;
}

/** Assina tentativas recentes do lab. */
export function useAttempts(
  labId: string,
  options?: { controlOperacionalId?: string },
): UseAttemptsResult;
```

```typescript
// useAttemptSave.ts
interface UseAttemptSaveResult {
  saveAttempt: (data: AttemptInput) => Promise<Attempt>;
  isSaving: boolean;
  error: string | null;
}

/** Orquestra o save completo (validar → Westgard → snapshot → signature → save). */
export function useAttemptSave(labId: string): UseAttemptSaveResult;
```

---

## Fluxo de Save (orquestração interna)

```
useAttemptSave.saveAttempt(input):
  1. Ler ControlOperacional por controlOperacionalId
  2. Validar input (Zod schema)
  3. Ler EquipmentSetup para snapshot de insumos
  4. Listar últimas N tentativas do mesmo controle (para Westgard histórico)
  5. Rodar computeCoagWestgard([...historicalAttempts, simulatedCurrent])
  6. Derivar conformidade + violacoes + analitosComViolacao
  7. Se conformidade='R' e acaoCorretiva=null → throw Error
  8. Build snapshot { controle, reagente, reagenteTtpa, equipamento }
  9. Build logicalSignature (SHA-256 de canonical payload)
  10. Persistir Attempt via attemptService.saveAttempt()
  11. Fire-and-forget: writeCoagAuditRecord(attempt)
  12. Retornar Attempt persistido
```

**Regra:** máximo 4 etapas visíveis (o resto é detalhe interno do hook).

---

## LogicalSignature Payload

```typescript
export function buildAttemptSignaturePayload(
  operatorDoc: string,
  controlOperacionalId: string,
  resultados: Record<CoagAnalyteId, number>,
  dataRealizacao: string,
): string {
  const canonicalResults = JSON.stringify(
    Object.fromEntries(Object.entries(resultados).sort(([a], [b]) => a.localeCompare(b))),
  );
  return `${operatorDoc}|${controlOperacionalId}|${canonicalResults}|${dataRealizacao}`;
}

// Hash: SHA-256 do payload acima (via Web Crypto, igual legado)
```

---

## Validações (no hook de save)

1. `controlOperacionalId` deve referenciar Controle com `status === 'ativo'`
2. `equipamentoId` deve existir no `/equipamentos` do lab
3. `resultados` deve conter apenas analitos em `EQUIP_ANALYTES[equipamentoId]`
4. Todo valor em `resultados` deve ser número positivo
5. Se `conformidade === 'R'`, `acaoCorretiva` é obrigatória (mín 10 chars)
6. Snapshot só pode ter insumo com `dataAbertura <= hoje`

---

## Não Modificar

- ⛔ Não adicionar `attemptCode` (CG-YYYY-NNNN) legado — usar `id` UUID
- ⛔ Não adicionar `runStatus` / `status` — usar `conformidade` calculada
- ⛔ Não adicionar `notivisaTipo/Status` — isso é RTAction separado
- ⛔ Não adicionar `isi` / `mnpt` — equipamento já calcula RNI
- ⛔ Não adicionar `temperaturaAmbiente` / `umidadeAmbiente` — simplificação
- ⛔ Não tornar snapshot editável após save
- ⛔ Não tornar logicalSignature recalculável
