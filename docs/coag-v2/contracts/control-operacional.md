# Contrato Congelado — ControlOperacional

**Status:** CONGELADO — agentes não modificam
**Data:** 25/05/2026
**Wave:** A

---

## Entidade

```typescript
import type { Timestamp } from 'firebase/firestore';
import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs';

/**
 * ControlOperacional — controle físico usado no dia a dia.
 * 
 * Conceito: "saco de controle" — não é o lote químico.
 * Operador vê apenas o nome (ex: "Controle Normal").
 * Nível, lote, fabricante — metadados invisíveis ao operador.
 * 
 * Firestore path: labs/{labId}/control-operacional/{id}
 * Compliance: RDC 978/2025 · RDC 302/2005 · CLSI H47-A2
 */
export interface ControlOperacional {
  // ── Identificação simples ──────────────────────────────────
  id: string;
  labId: string;
  nome: string;                                // "Controle Normal" | "Controle Patológico"
  nivel: 'I' | 'II';                           // Propriedade — operador não vê

  // ── Vínculo com insumo e equipamento ───────────────────────
  insumoId: string;                            // referência ao Insumo
  equipamentoId: string;                       // ex: "clotimer-duo-001"

  // ── Configuração prévia (RT faz) ───────────────────────────
  mean: Record<CoagAnalyteId, number>;         // média da bula
  sd: Record<CoagAnalyteId, number>;           // SD da bula
  loteControle: string;                        // número do lote — operador não vê
  fabricanteControle: string;                  // operador não vê
  validadeControle: string;                    // YYYY-MM-DD — operador não vê

  // ── Status operacional (invisível para operador) ───────────
  status: 'ativo' | 'pausado' | 'aposentado';

  // ── Timeline ───────────────────────────────────────────────
  criadoEm: Timestamp;
  criadoPor: string;
  atualizadoEm: Timestamp;
}

export type ControlOperacionalInput = Omit<
  ControlOperacional,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'atualizadoEm'
>;
```

---

## Firestore Path

```
/labs/{labId}/control-operacional/{id}
```

## Rules (adicionar ao firestore.rules)

```
match /labs/{labId}/control-operacional/{docId} {
  allow read: if isMemberOfLab(labId);
  allow create: if isAdminOrOwner(labId)
    && request.resource.data.keys() == expectedKeys()
    && request.resource.data.status == 'ativo';
  allow update: if isAdminOrOwner(labId)
    && request.resource.data.criadoPor == resource.data.criadoPor;  // imutável
  allow delete: if false;  // soft-delete apenas (status: 'aposentado')
}
```

---

## Service Interface

```typescript
// controlOperacionalService.ts

/** Cria um Controle Operacional (RT faz — 1x por controle físico). */
export async function createControlOperacional(
  labId: string,
  data: ControlOperacionalInput,
): Promise<ControlOperacional>;

/** Busca um Controle Operacional por ID. */
export async function getControlOperacional(
  labId: string,
  id: string,
): Promise<ControlOperacional | null>;

/** Lista todos os Controles Operacionais do lab, filtrados por status opcional. */
export async function listControlOperacionals(
  labId: string,
  options?: { status?: ControlOperacional['status'] },
): Promise<ControlOperacional[]>;

/** Atualiza campos do Controle Operacional (ex: mean/sd ao trocar de lote). */
export async function updateControlOperacional(
  labId: string,
  id: string,
  changes: Partial<Omit<ControlOperacionalInput, 'criadoEm' | 'criadoPor'>>,
): Promise<void>;

/** Soft-delete: marca como 'aposentado'. */
export async function deleteControlOperacional(
  labId: string,
  id: string,
): Promise<void>;
```

---

## Hook Interface

```typescript
// useControlOperacional.ts

interface UseControlOperacionalResult {
  controls: ControlOperacional[];
  isLoading: boolean;
  error: string | null;
}

/** Assina controles operacionais ativos do lab. */
export function useControlOperacional(labId: string): UseControlOperacionalResult;
```

---

## Campos Obrigatórios no Firestore

| Campo | Tipo | Obrigatório | Default | Imutável |
|-------|------|-------------|---------|----------|
| `id` | string | ✅ | `doc().id` | ✅ |
| `labId` | string | ✅ | passado | ✅ |
| `nome` | string | ✅ | — | ❌ |
| `nivel` | `'I' \| 'II'` | ✅ | — | ❌ |
| `insumoId` | string | ✅ | — | ❌ |
| `equipamentoId` | string | ✅ | — | ❌ |
| `mean` | `Record<CoagAnalyteId, number>` | ✅ | — | ❌ |
| `sd` | `Record<CoagAnalyteId, number>` | ✅ | — | ❌ |
| `loteControle` | string | ✅ | — | ❌ |
| `fabricanteControle` | string | ✅ | — | ❌ |
| `validadeControle` | string | ✅ | — | ❌ |
| `status` | `'ativo' \| 'pausado' \| 'aposentado'` | ✅ | `'ativo'` | ❌ |
| `criadoEm` | Timestamp | ✅ | `serverTimestamp()` | ✅ |
| `criadoPor` | string | ✅ | `request.auth.uid` | ✅ |
| `atualizadoEm` | Timestamp | ✅ | `serverTimestamp()` | ❌ |

---

## Validações (no service)

1. `nome` não pode ser vazio (máx 50 chars)
2. `nivel` deve ser `'I'` ou `'II'`
3. `mean` e `sd` devem ter as chaves dos analitos suportados pelo equipamento (via `EQUIP_ANALYTES`)
4. `validadeControle` deve ser futuro (ou hoje) no momento de criação
5. `insumoId` deve existir em `/labs/{labId}/insumos/{insumoId}`
6. `equipamentoId` deve existir em `/labs/{labId}/equipamentos/{equipamentoId}`

---

## Não Modificar

- ⛔ Não adicionar campos ao contrato
- ⛔ Não remover campos do contrato
- ⛔ Não criar interface extra (IControlOperacional, ControlOperacionalDTO)
- ⛔ Não criar classe (usar funções puras no service)
- ⛔ Não criar factory function
- ⛔ Não criar adapter/mapper
- ⛔ Não adicionar `coagDecision` legado (usar RTAction separado)
- ⛔ Não adicionar `pinHistory` legado (timeline narrativa substitui)
