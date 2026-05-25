# Contrato Congelado — RTAction

**Status:** CONGELADO — agentes não modificam
**Data:** 25/05/2026
**Wave:** C

---

## Entidade

```typescript
import type { Timestamp } from 'firebase/firestore';

/**
 * RTAction — ação executada exclusivamente pelo Responsável Técnico.
 * 
 * Conceito: decisões técnicas que operadores NÃO tomam.
 *   - aprovar_controle → RT aprova um controle operacional
 *   - rejeitar_controle → RT rejeita um controle operacional
 *   - notificar_notivisa → RT notifica tecnovigilância sobre uma tentativa
 * 
 * Operador nunca cria RTAction. UI do RT só.
 * 
 * Firestore path: labs/{labId}/rt-actions/{id}
 * Compliance: RDC 978/2025 · RDC 67/2009 + 551/2021
 */
export interface RTAction {
  // ── Identificação ──────────────────────────────────────────
  id: string;
  labId: string;
  tipo: 'aprovar_controle' | 'rejeitar_controle' | 'notificar_notivisa';

  // ── Vínculo polimórfico ───────────────────────────────────
  targetRef:
    | { type: 'ControlOperacional'; id: string }
    | { type: 'Attempt'; id: string };

  // ── Payload específico por tipo ───────────────────────────
  payload: AprovarControlePayload
    | RejeitarControlePayload
    | NotificarNotivisaPayload;

  // ── Timeline ───────────────────────────────────────────────
  criadoEm: Timestamp;
  criadoPor: string;                           // UID do RT (sempre admin/owner)
}

// ── Payloads por tipo ───────────────────────────────────────

export interface AprovarControlePayload {
  tipo: 'aprovar_controle';
  decisao: 'A' | 'NA';                        // A = aceitável, NA = não aceitável (mas não rejeitado)
  motivo: string;                              // obrigatório (mín 10 chars)
  // TargetRef: { type: 'ControlOperacional', id }
}

export interface RejeitarControlePayload {
  tipo: 'rejeitar_controle';
  motivo: string;                              // obrigatório (mín 20 chars, detalhado)
  acaoRecomendada?: string;                    // opcional: recomenda ação corretiva
  // TargetRef: { type: 'ControlOperacional', id }
}

export interface NotificarNotivisaPayload {
  tipo: 'notificar_notivisa';
  notivisaTipo: 'queixa_tecnica' | 'evento_adverso';
  notivisaProtocolo?: string;                  // obrigatório se status='notificado'
  notivisaDataEnvio?: string;                  // YYYY-MM-DD
  notivisaJustificativa?: string;              // obrigatório se dispensado (não aplicável aqui)
  motivo: string;                              // obrigatório
  // TargetRef: { type: 'Attempt', id }
}

export type RTActionInput =
  | { tipo: 'aprovar_controle'; controlOperacionalId: string; payload: Omit<AprovarControlePayload, 'tipo'> }
  | { tipo: 'rejeitar_controle'; controlOperacionalId: string; payload: Omit<RejeitarControlePayload, 'tipo'> }
  | { tipo: 'notificar_notivisa'; attemptId: string; payload: Omit<NotificarNotivisaPayload, 'tipo'> };
```

---

## Firestore Path

```
/labs/{labId}/rt-actions/{id}
```

---

## Service Interface

```typescript
// rtActionService.ts

/** Cria uma RTAction. Apenas RT (admin/owner) pode invocar. */
export async function createRTAction(
  labId: string,
  rtUid: string,
  data: RTActionInput,
): Promise<RTAction>;

/** Lista RTActions de um target específico. */
export async function listRTActionsByTarget(
  labId: string,
  targetRef: { type: 'ControlOperacional' | 'Attempt'; id: string },
): Promise<RTAction[]>;

/** Lista RTActions NOTIVISA pendentes (para relatório). */
export async function listNotivisaPendentes(
  labId: string,
): Promise<RTAction[]>;
```

**⛔ NÃO:**
- Não criar `updateRTAction()` — ações são imutáveis após criação
- Não criar `deleteRTAction()` — auditoria preservada
- Não criar "reverter RTAction" — criar nova ação de reversão se necessário

---

## Hook Interface

```typescript
// useRTAction.ts
interface UseRTActionResult {
  createRTAction: (data: RTActionInput) => Promise<RTAction>;
  isSaving: boolean;
  error: string | null;
}

/** Permite ao RT aprovar/rejeitar controle ou notificar NOTIVISA. */
export function useRTAction(labId: string): UseRTActionResult;
```

```typescript
// useRTActionsByTarget.ts
interface UseRTActionsByTargetResult {
  actions: RTAction[];
  isLoading: boolean;
  error: string | null;
}

/** Assina RTActions de um target específico (tentativa ou controle). */
export function useRTActionsByTarget(
  labId: string,
  targetRef: { type: 'ControlOperacional' | 'Attempt'; id: string },
): UseRTActionsByTargetResult;
```

---

## Efeitos Colaterais (orchestrated in service)

### `aprovar_controle` → muda status do controle

```typescript
// Em rtActionService.createRTAction():
if (data.tipo === 'aprovar_controle' || data.tipo === 'rejeitar_controle') {
  const targetId = data.controlOperacionalId;
  const newStatus = data.tipo === 'aprovar_controle' ? 'ativo' : 'pausado';
  await updateControlOperacional(labId, targetId, { status: newStatus });
}
```

### `notificar_notivisa` → adiciona flag à Attempt (audit only)

```typescript
// Não modifica Attempt (imutável).
// Apenas grava RTAction com referência.
// Timeline narrativa mostra: "NOTIVISA notificado por RT · DD/MM/YYYY"
```

---

## Validações (no service)

1. `criadoPor` deve ter role `admin` ou `owner` no lab
2. Para `aprovar_controle` / `rejeitar_controle`:
   - `controlOperacionalId` deve existir
   - `motivo` deve ter pelo menos 10 caracteres
3. Para `notificar_notivisa`:
   - `attemptId` deve existir
   - Se `notivisaProtocolo` fornecido, formato deve ser `YYYY.NNNNN`
   - `motivo` obrigatório (mín 20 chars)

---

## Firestore Rules

```
match /labs/{labId}/rt-actions/{docId} {
  allow read: if isMemberOfLab(labId);
  allow create: if isAdminOrOwner(labId)
    && request.resource.data.criadoPor == request.auth.uid
    && validarPayloadPorTipo(request.resource.data);
  allow update, delete: if false;  // imutável após criação
}
```

---

## Timeline Narrativa (como aparece na UI)

| Tipo de RTAction | Texto na timeline |
|------------------|-------------------|
| `aprovar_controle` | "Controle aprovado pelo RT · DD/MM/YYYY HH:MM" |
| `rejeitar_controle` | "Controle rejeitado pelo RT · DD/MM/YYYY HH:MM" |
| `notificar_notivisa` | "NOTIVISA notificado (queixa técnica) · DD/MM/YYYY" |

---

## Não Modificar

- ⛔ Não adicionar novos tipos de payload (apenas os 3 especificados)
- ⛔ Não adicionar `status` na RTAction (imutável após criação)
- ⛔ Não criar "workflow" de aprovações (RT aprova em 1 clique)
- ⛔ Não adicionar `decisaoHistórico` (RT cria nova ação para mudança)
- ⛔ Não permitir operadores (não-RT) criar RTActions
