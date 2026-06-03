# ADR 0007 — Equipamento Calibration + Maintenance Gating

## Objetivo

Implementar validações server-side (Cloud Functions) que bloqueiam a criação de corridas de controle qualitativo quando equipamentos têm calibração/manutenção vencida. Satisfaz RDC 978/2025 § 5.3.1 (equipment qualification). Status atual: validators criados, testes skeleton, integração com CIQ pendente.

**Output:** 7 CIQ modules (coagulacao, ciq-imuno, uroanalise, e 4 others) bloqueando run creation via `validarCalibracaoEquipamento`, testes >80%, backfill testado.

**Dependências:** ✓ ADR 0005 (HMAC), ✓ ADR 0002 (Fornecedor), ✓ ADR 0006 (Pessoa operador).

---

## Contexto

O projeto HC Quality representa um SaaS multi-tenant de controle interno de qualidade (CIQ) para laboratórios clínicos. A segurança regulatória exige que **toda corrida de controle** seja executada apenas em equipamentos com calibração válida — RDC 978/2025 5.3.1 (Equipment qualification shall be..." bloqueia geração de dados diagnósticos em instrumentos não-qualificados).

Implementação já existe:

- **Backend**: `validarCalibracaoEquipamento()` + `validarManutencaoEquipamento()` em `functions/src/modules/equipamentos/validators.ts`
- **Types**: `Equipamento`, `Calibracao`, `Manutencao` alinhados com fornecedor + audit (ADR 0005)
- **Cloud Functions**: `criarEquipamento`, `registrarCalibracacao`, `registrarManutencao` em `functions/src/modules/equipamentos/equipamentos.ts`

Faltam:

1. **Callable export**: validadores não expostos em `functions/src/index.ts`
2. **Cliente Firebase**: funções JS/TS que chamem os callables desde React hooks
3. **CIQ integration**: 7 módulos (coagulacao, ciq-imuno, uroanalise, controle-temperatura, analyzer, chart, runs) precisam checar equipId antes de criar run
4. **Firestore rules**: proteção `allow create` em `equipamentos/`, indexes compostos
5. **Tests**: 80% coverage nas regras de negócio (RN-EQU-01 a RN-EQU-05)
6. **Backfill**: equipamentos existentes em CT módulo migram pra canonical path

---

## Decisões Arquiteturais

### ADR 0007 — Escolhas Aceitas

**1. Validação Server-Side (não client-side)**

- Dois callables: `validarCalibracaoEquipamento(labId, equipId)` + `validarManutencaoEquipamento(labId, equipId)`
- Respostas: `{ allowed: bool, reason?: string, dataVencimento?: Timestamp }`
- Racional: Defense-in-depth, auditoria RDC 978, impossível bypassar com client hack

**2. Gating em CIQ Run Creation**

- Antes de qualquer `createRun()` em coagulacao, uroanalise, imuno, etc, chamar `validarCalibracaoEquipamento()`
- Se `!allowed`, throw erro específico (não silencioso)
- UX: botão create desabilitado + tooltip: "Calibração vencida em X"

**3. Schema com Divergência Aceitável**

- Frontend (`src/features/equipamentos/types.ts`) evolui independente do backend (`functions/src/.../types.ts`)
- Backend: foco em Calibracao + Manutencao + HMAC (audit)
- Frontend: foco em exibição + ciclo de vida + softDelete
- Sincronismo: callables transformam dados — não há impedância clássica de "divergência"

**4. Firestore Paths**

- Equipamentos: `/labs/{labId}/equipamentos/{equipId}`
- Calibrações: `/labs/{labId}/equipamentos/{equipId}/calibracoes/{calibId}`
- Manutenções: `/labs/{labId}/equipamentos/{equipId}/manutencoes/{mantId}`
- Audit: `/labs/{labId}/equipamentos-audit/{auditId}` (append-only, ADR 0005)

---

## Regras de Negócio (RN-EQU-\*)

**RN-EQU-01:** Hard block — equipamento com `proximaCalibracaoPrevista < now()` não pode ter run criada. Validação no callable `validarCalibracaoEquipamento`, não em rules (regra: escrita regulatória via CF).

**RN-EQU-02:** Operator qualificado — quem registra calibração (`realizadoPor`) deve ter claim `qualificacao:equipamento`. Callable valida contra `people/{uid}.qualificacoes[]`.

**RN-EQU-03:** Auto-set proximaCalibracacao — ao registrar calibração com status='ok', `proximaCalibracaoPrevista = now + 90 dias` (interval default, configurável por lab).

**RN-EQU-04:** Soft-delete only — equipamento aposentado fica `status='aposentado'` + `retencaoAte = aposentadoEm + 5 anos` (RDC 786/2023 art. 42). Hard delete bloqueado em rules. Cloud Function `cleanupEquipamentosExpirados` remove após retenção (Fase 2 future).

**RN-EQU-05:** Calibração imutável — `calibracoes/{id}` append-only. Reprovação cria novo doc com `status='reprovado'` + motivo, não sobrescreve anterior.

---

## Plano Executivo (7 Tarefas)

### Task 1: Exportar Callables em Functions Index

**Escopo:** Habilitar validadores em `functions/src/index.ts`.

**Arquivos:**

- `functions/src/index.ts`
- `functions/src/modules/equipamentos/index.ts`

**Ação:**

- Importar `validarCalibracaoEquipamento`, `validarManutencaoEquipamento` do validators
- Criar dois callables `validarCalibracaoCF` + `validarManutencaoCF` (wrapper de error handling)
- Exportar no index

```typescript
// functions/src/modules/equipamentos/index.ts
export const validarCalibracaoCF = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Não autenticado');
    const { labId, equipamentoId } = request.data;
    if (!labId || !equipamentoId)
      throw new HttpsError('invalid-argument', 'Campos obrigatórios: labId, equipamentoId');

    const result = await validarCalibracaoEquipamento(labId, equipamentoId);
    return result;
  },
);

// functions/src/index.ts
export {
  validarCalibracaoCF,
  registrarCalibracacao,
  criarEquipamento,
} from './modules/equipamentos';
```

**Verify:** `npm run build` verde, tsc sem erros.

**Done:** Callables `validarCalibracaoCF` + `validarManutencaoCF` exportados, deployáveis.

---

### Task 2: Cliente Firebase — Wrapper de Validação

**Escopo:** JS/TS que chama os callables desde React.

**Arquivos:**

- `src/features/equipamentos/services/equipamentoValidationClient.ts` (novo)

**Ação:**
Criar service cliente que:

1. Chama `validarCalibracaoCF(labId, equipId)` via `httpsCallable()`
2. Retorna `EquipamentoValidacaoResult` tipado
3. Trata erros (timeout, network, invalid equipment)
4. Integra em hook para reutilização

```typescript
// src/features/equipamentos/services/equipamentoValidationClient.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import type { Timestamp } from 'firebase/firestore';

export interface EquipamentoValidacaoResult {
  allowed: boolean;
  reason?: string;
  dataVencimento?: Timestamp;
}

export async function validarCalibracaoCliente(
  labId: string,
  equipamentoId: string,
): Promise<EquipamentoValidacaoResult> {
  const callable = httpsCallable(functions, 'validarCalibracaoCF');
  const res = await callable({ labId, equipamentoId });
  return res.data as EquipamentoValidacaoResult;
}
```

**Verify:** `npm test -- equipamentoValidationClient` passa (mock Firebase, fixtures).

**Done:** Service cliente implementado, tipado, error handling.

---

### Task 3: Hook de Validação + CIQ Integration Planner

**Escopo:** Hook React que valida antes de run creation, lista dos 7 CIQ modules impactados.

**Arquivos:**

- `src/features/equipamentos/hooks/useEquipamentoValidacao.ts` (novo)
- `.planning/ADR-0007-CIQ-INTEGRATION-MATRIX.md` (novo)

**Ação:**

1. Criar `useEquipamentoValidacao(equipId: string)` que chama client, debounce, cache local
2. Integra em forma: hook retorna `{ allowed, reason, isLoading, error }`
3. Listar 7 CIQ modules que precisam chamar hook antes de `createRun`:
   - coagulacao (via `useCoagRuns`)
   - ciq-imuno (via `useCIQRuns`)
   - uroanalise (via `useUroRuns`)
   - controle-temperatura (via `useEquipamentoValidacao` — novo módulo)
   - analyzer (OCR Gemini — precisa equipId para insumos)
   - runs (base module, centralizador)
   - chart (Levey-Jennings — lê equipId de run)

```typescript
// src/features/equipamentos/hooks/useEquipamentoValidacao.ts
import { useEffect, useState } from 'react';
import {
  validarCalibracaoCliente,
  type EquipamentoValidacaoResult,
} from '../services/equipamentoValidationClient';
import { useActiveLabId } from '../../../store/useAuthStore';

interface UseEquipamentoValidacaoResult extends EquipamentoValidacaoResult {
  isLoading: boolean;
  error: string | null;
}

export function useEquipamentoValidacao(equipId?: string): UseEquipamentoValidacaoResult {
  const labId = useActiveLabId();
  const [validacao, setValidacao] = useState<EquipamentoValidacaoResult>({ allowed: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !equipId) {
      setValidacao({ allowed: false, reason: 'Equipamento não fornecido' });
      return;
    }

    setIsLoading(true);
    validarCalibracaoCliente(labId, equipId)
      .then((res) => {
        setValidacao(res);
        setError(null);
      })
      .catch((err) => {
        setValidacao({ allowed: false, reason: 'Erro ao validar' });
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [labId, equipId]);

  return { ...validacao, isLoading, error };
}
```

**Verify:** Hook monta/unmount sem memory leaks, valida corretamente em fixtures.

**Done:** Hook exportado, Matrix com 7 modules listados.

---

### Task 4: Integração CIQ — Coagulacao (Wave 1/7)

**Escopo:** Wiring em `coagulacao` module. Padrão replicado em outras 6.

**Arquivos:**

- `src/features/coagulacao/hooks/useCoagRuns.ts`
- `src/features/coagulacao/components/CreateCoagRunModal.tsx` (existente, modificado)

**Ação:**

1. Lê `equipamentoId` da UI (dropdown/selection)
2. Chama `useEquipamentoValidacao(equipId)` para validar
3. Desabilita botão "Criar Corrida" se `!validacao.allowed`
4. Mostra tooltip/erro com motivo: "Calibração vencida em X" ou "Equipamento em manutenção"
5. Se `allowed`, permite `createRun()` normal

Pattern na modal:

```typescript
// src/features/coagulacao/components/CreateCoagRunModal.tsx
export function CreateCoagRunModal({ ... }) {
  const [equipId, setEquipId] = useState<string>('');
  const { allowed, reason, isLoading } = useEquipamentoValidacao(equipId);

  const canCreateRun = !!equipId && allowed && !isLoading;

  return (
    <Dialog>
      <Select value={equipId} onChange={(v) => setEquipId(v)}>
        {equipamentos.map(e => <Option key={e.id} value={e.id}>{e.name}</Option>)}
      </Select>
      {!allowed && reason && (
        <Alert type="error" title="Equipamento indisponível">
          {reason}
        </Alert>
      )}
      <Button disabled={!canCreateRun} onClick={handleCreateRun}>
        Criar Corrida
      </Button>
    </Dialog>
  );
}
```

**Verify:** Modal desabilita botão quando equipId.proximaCalibracaoPrevista < now (e2e ou visual).

**Done:** Coagulacao integrada, padrão documentado.

---

### Task 5: Integração CIQ — Remaining 6 Modules (Tasks 5-10 em batch)

**Escopo:** Aplicar mesmo padrão em: ciq-imuno, uroanalise, controle-temperatura, analyzer, runs, chart.

**Files (por módulo, listadas em comentário de ação):**

**Ação:** Para cada módulo:

1. Identificar component que cria run (`CreateXXXModal`, `CreateRunButton`, etc)
2. Adicionar `useEquipamentoValidacao(equipId)` ao hook existente
3. Wiring desabilita botão create se validation falha
4. Testes unitários validam disabled state

**Verify:** Cada módulo tem teste: "run creation disabled when equipment overdue".

**Done:** 6 modules integrados com padrão consistente.

---

### Task 6: Firestore Rules + Indexes

**Escopo:** Security rules + composite indexes para `equipamentos` + subcoleções.

**Arquivos:**

- `firestore.rules`
- `firestore.indexes.json`

**Ação:**

1. Rules para `/labs/{labId}/equipamentos/{equipId}`:
   - read: `isActiveMember` (qualquer membro do lab)
   - create: cloud function only (`allow create: if false` + callable)
   - update: cloud function only
   - delete: always false (soft-delete via status)

2. Rules para subcoleções `calibracoes` + `manutencoes`:
   - read: qualquer membro
   - create: cloud function only
   - update/delete: false (append-only)

3. Indexes compostos:
   - `equipamentos: (status, createdAt desc)`
   - `equipamentos: (module, status)`
   - `calibracoes: (equipamentoId, dataRealizacao desc)`

```firestore
match /labs/{labId}/equipamentos/{equipId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create, update: if false;  // Cloud Function only
  allow delete: if false;

  match /calibracoes/{calibId} {
    allow read: if isActiveMemberOfLab(labId);
    allow create: if false;  // Cloud Function only
    allow update, delete: if false;  // Append-only
  }
}
```

**Verify:** `firebase emulators:exec "npm test -- firestore.rules"` verde.

**Done:** Rules deployed, indexes created.

---

### Task 7: Tests + Backfill Script

**Escopo:** 80% coverage nos validators, backfill de equipamentos legacy em CT.

**Arquivos:**

- `functions/src/modules/equipamentos/equipamentos.test.ts` (expand from skeleton)
- `functions/scripts/backfill-equipamento.mjs` (novo)
- E2E fixtures: `.planning/fixtures/ADR-0007-e2e-scenarios.md`

**Ação:**

1. **Unit tests (validators):**
   - RN-EQU-01: overdue calibration blocks
   - RN-EQU-02: only qualificado can register
   - RN-EQU-03: auto-set interval on OK registration
   - RN-EQU-04: soft-delete + retention calc
   - RN-EQU-05: calibration immutable

2. **Backfill script:**
   - Lê equipamentos de `controle-temperatura` (legacy path)
   - Cria novo doc em canonical `/labs/{labId}/equipamentos/{equipId}`
   - Sets `proximaCalibracaoPrevista = now + 90 dias`
   - Cria audit event 'migrated'
   - Idempotente: roda 2x, sem erro

```bash
# functions/scripts/backfill-equipamento.mjs
import * as admin from 'firebase-admin';

const db = admin.firestore();

async function backfill(labId) {
  const legacySnap = await db.collection(`labs/${labId}/temperature-sensors`).get();
  const batch = db.batch();

  for (const doc of legacySnap.docs) {
    const legacy = doc.data();
    const newRef = db.collection(`labs/${labId}/equipamentos`).doc(doc.id);

    batch.set(newRef, {
      labId,
      nome: legacy.name,
      modelo: legacy.model,
      numeroSerie: legacy.serialNumber,
      proximaCalibracaoPrevista: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      ),
      status: 'ativo',
      createdAt: legacy.createdAt || admin.firestore.Timestamp.now(),
      createdBy: legacy.createdBy,
    });
  }

  await batch.commit();
  console.log(`Backfilled ${legacySnap.size} equipamentos for lab ${labId}`);
}
```

**Verify:** `npm run test -- equipamentos.test.ts` >80% coverage, backfill script idempotent.

**Done:** 80%+ coverage, backfill tested + documented.

---

## Threat Model

| Threat ID | Category               | Component             | Disposition | Mitigation                                                                                                   |
| --------- | ---------------------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| T-EQU-01  | Tampering              | equipamentos document | Mitigate    | Server-side validation in Cloud Function (not rules), HMAC signature per ADR 0005, rules block client writes |
| T-EQU-02  | Elevation of Privilege | Calibração creation   | Mitigate    | Check `realizadoPor` qualificacao claim in callable, rules allow CF only                                     |
| T-EQU-03  | Repudiation            | Audit trail gaps      | Mitigate    | Append-only audit events in `equipamentos-audit/{id}`, immutable `hmac` field per ADR 0005                   |
| T-EQU-04  | Information Disclosure | Equipamento data      | Accept      | Equipment list visible to any lab member (low sensitivity, operational necessity)                            |

---

## Verificação

**Phase completion checklist:**

- [ ] Task 1: Callables exported, `npm run build` verde
- [ ] Task 2: Cliente wrapper tipado, error handling robusto
- [ ] Task 3: Hook de validação reutilizável, Matrix com 7 modules
- [ ] Task 4: Coagulacao modal desabilita create quando equipamento indisponível
- [ ] Tasks 5: Remaining 6 CIQ modules integrados com mesmo padrão
- [ ] Task 6: Firestore rules deployed, indexes created
- [ ] Task 7: Tests >80%, backfill script idempotent
- [ ] **RDC 978 5.3.1 satisfied**: Nenhuma run criada sem calibração válida
- [ ] **E2E manual**: Criar run com equipamento vencido → bloqueado com mensagem clara
- [ ] **Deployment**: `firebase deploy --only functions,firestore:rules,firestore:indexes,hosting` sucede

---

## Sucesso

- 7 CIQ modules bloqueando run creation corretamente
- Validação determinística no backend (impossível bypass)
- 80%+ test coverage nas regras de negócio
- Backfill de CT equipamentos para canonical path, idempotent
- Auditoria RDC 978 § 5.3.1 rastreável via logs + signatures
- **Readiness:** Phase 1 validation gate (ADR 0007 complete) ✓

---

## Timeline Estimado

- **Task 1-2 (Setup)**: 1 dia
- **Task 3 (Hook + Matrix)**: 1 dia
- **Task 4 (Coagulacao)**: 1 dia
- **Tasks 5 (6 modules)**: 2 dias (batch parallelizable)
- **Task 6 (Rules)**: 0.5 dia
- **Task 7 (Tests + backfill)**: 1 dia
- **Integration testing + deploy**: 0.5 dia

**Total: 3-4 dias** (soma de esforço serial + batches paralelos em CIQ modules)
