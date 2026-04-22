---
name: hcq-module-generator
description: Gera scaffold completo de um novo módulo CIQ no hc quality (ex: bioquímica, parasitologia, microbiologia) — pasta feature, service client-direct, hooks de subscription e save, schema Zod, form com InsumoPicker, rules Firestore por módulo, Cloud Function trigger de chainHash, constantes, testes skeleton, feature flag. Use quando for criar um módulo CIQ do zero. Aplica o playbook hcq-ciq-module de forma executável, sem divergir das invariantes. Discrimina CIQ quantitativo vs. categórico (R/NR).
---

# hcq-module-generator — Scaffold executável de módulo CIQ

> **Versão:** 1.0 · **Última atualização:** 2026-04-20 · **Subsume parcialmente:** seção 3 do playbook [hcq-ciq-module](../hcq-ciq-module/SKILL.md)

Esta skill gera o esqueleto completo de um módulo CIQ novo, **fielmente** aplicando as invariantes do playbook canônico. O operador humano descreve o módulo, esta skill gera os arquivos.

Skills relacionadas: [hcq-ciq-module](../hcq-ciq-module/SKILL.md) (playbook — leitura obrigatória antes), [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md) (o scaffold de audit que essa skill incorpora), [hcq-firestore-rules-generator](../hcq-firestore-rules-generator/SKILL.md) (rules por módulo), [hcq-insumo-picker-integrator](../hcq-insumo-picker-integrator/SKILL.md) (integração InsumoPicker), [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md) (roda no final).

---

## 1. Quando usar

Use esta skill quando:

- Vai criar módulo CIQ novo (bioquímica, parasitologia, microbiologia, hormonal, hemostasia estendida, etc.)
- Vai clonar um módulo existente para outro contexto similar (ex: urina do tipo II → urina do tipo I)

**Não use** para:
- Adicionar feature a módulo existente (use edição direta + [hcq-ciq-module](../hcq-ciq-module/SKILL.md) como referência)
- Extensão de módulo quantitativo existente pra novo analyte (edite `<Modulo>AnalyteConfig.ts`)

---

## 2. Inputs obrigatórios

Antes de gerar, exija do usuário:

| Campo | Tipo | Exemplo | Notas |
|---|---|---|---|
| `moduleName` | kebab-case | `bioquimica` | usado em paths, subcoleções, CF names |
| `ModuleName` | PascalCase | `Bioquimica` | usado em tipos, componentes |
| `tipoCIQ` | `'quantitativo' \| 'categorico' \| 'hibrido'` | `quantitativo` | determina se tem Westgard/Levey-Jennings |
| `insumoTipos` | `InsumoTipo[]` | `['controle', 'reagente']` | quais tipos de insumo integram via Picker |
| `analytes` | `Array<{id, name, unit?}>` | `[{id:'GLU',name:'Glicose',unit:'mg/dL'}]` | analytes iniciais (só quantitativo/híbrido) |
| `requiresFR` | `string[]` | `['FR-20']` | formulários de compliance a gerar (opcional, ver [hcq-pdf-export-scaffold](../hcq-pdf-export-scaffold/SKILL.md)) |
| `hasChainHash` | `boolean` | `true` | se tem audit chain (padrão: `true` para CIQ) |
| `moduleClaimName` | camelCase | `bioquimica` | usado em custom claims `modules.<claim>` |

**Discriminação crítica — CIQ quantitativo vs. categórico:**

- **Quantitativo** (hematologia, coagulação, bioquímica): `value: number` + `unit`; Westgard/Levey-Jennings aplicam; `manufacturerStats` + `internalStats`; chart/timeline.
- **Categórico** (imunocromatográfico reagente/não-reagente): `esperado: 'R'|'NR'` + `obtido: 'R'|'NR'`; sem valor numérico, sem Westgard; PALC categoriza separadamente.
- **Híbrido** (uroanálise — tira reagente tem campos categóricos + densidade/pH quantitativos): discriminated union por analyte dentro do run.

Se `tipoCIQ === 'categorico'`: não gere `StatsService`, não gere `Chart`, não importe `recharts`. Gere apenas `<Modulo>CategoryEval.ts` (tabela esperado/obtido).

---

## 3. Árvore de saída

```
src/features/<module-name>/
├── <ModuleName>View.tsx
├── components/
│   ├── <ModuleName>Form.tsx
│   ├── <ModuleName>Form.schema.ts
│   ├── <ModuleName>RunsTable.tsx
│   └── <ModuleName>Chart.tsx                       [só quantitativo/híbrido]
├── hooks/
│   ├── use<ModuleName>Runs.ts
│   ├── useSave<ModuleName>Run.ts
│   └── use<ModuleName>Signature.ts
├── services/
│   ├── <moduleName>FirebaseService.ts
│   ├── <moduleName>StatsService.ts                 [só quantitativo/híbrido]
│   └── <moduleName>CategoryEval.ts                 [só categorico/híbrido]
├── types/
│   └── <ModuleName>.ts
├── utils/
│   └── <moduleName>Helpers.ts
└── __tests__/
    ├── <moduleName>Helpers.test.ts
    ├── useSave<ModuleName>Run.test.ts
    └── rules.<moduleName>.test.ts

functions/src/modules/<module-name>/
├── index.ts
└── chainHash.ts                                    [se hasChainHash]

tools/
└── verify<ModuleName>Chain.ts                      [se hasChainHash]

# MUTAÇÕES em arquivos existentes (Edit, não Write):
src/constants.ts                                    [SUBCOLLECTIONS + MODULE_CLAIMS]
firestore.rules                                     [bloco match novo]
functions/src/index.ts                              [export * novo]
src/features/hub/ModuleHub.tsx                      [card novo, gated por flag]
package.json                                        [script verify:chains estendido, se chain]
```

---

## 4. Templates de arquivos

### 4.1 `src/features/<module-name>/types/<ModuleName>.ts`

**Quantitativo:**
```ts
import type { Timestamp } from 'firebase/firestore';

export type ModuleRunStatus = 'draft' | 'confirmed' | 'discarded';

export interface <ModuleName>AnalyteResult {
  analyteId: string;
  value: number;
  unit: string;
  status: 'in-range' | 'warn' | 'out-of-range';
  westgardFlags: string[]; // ['1-2s', '2-2s', ...]
}

export interface <ModuleName>Run {
  id: string;
  labId: string;
  operadorId: string;
  equipamentoId: string;
  insumoControleId: string | null;
  insumoReagenteIds: string[];
  results: <ModuleName>AnalyteResult[];
  status: ModuleRunStatus;
  logicalSignature: string;
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
}
```

**Categórico:**
```ts
export type CategoryOutcome = 'R' | 'NR';

export interface <ModuleName>TestResult {
  testId: string;
  esperado: CategoryOutcome;
  obtido: CategoryOutcome;
  match: boolean;
}

export interface <ModuleName>Run {
  id: string;
  labId: string;
  operadorId: string;
  insumoControleId: string | null;
  insumoReagenteIds: string[];
  tests: <ModuleName>TestResult[];
  allMatch: boolean; // derived: tests.every(t => t.match)
  status: ModuleRunStatus;
  logicalSignature: string;
  createdAt: Timestamp;
}
```

Nunca misture numérico com categórico na mesma struct sem `type` discriminator. Se o módulo é híbrido, modele analyte-a-analyte com discriminated union.

### 4.2 `src/features/<module-name>/components/<ModuleName>Form.schema.ts`

```ts
import { z } from 'zod';
import { firestoreTimestampSchema } from '@/shared/services/zodHelpers';

export const <ModuleName>RunInputSchema = z.object({
  equipamentoId: z.string().min(1),
  insumoControleId: z.string().nullable(),
  insumoReagenteIds: z.array(z.string()).default([]),
  // ... campos por tipoCIQ
}).refine(
  (d) => d.insumoControleId !== null || d.equipamentoId !== '',
  { message: 'Selecione um controle cadastrado ou preencha equipamento manualmente' }
);

export type <ModuleName>RunInput = z.infer<typeof <ModuleName>RunInputSchema>;
```

Regra: sempre use `firestoreTimestampSchema` de `@/shared/services/zodHelpers` para campos de data. Crie o helper se ainda não existir (ver seção 4.2 do [hcq-ciq-module](../hcq-ciq-module/SKILL.md)).

### 4.3 `src/features/<module-name>/services/<moduleName>FirebaseService.ts`

```ts
import {
  collection, doc, query, orderBy, onSnapshot,
  serverTimestamp, runTransaction,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { firestoreErrorMessage } from '@/shared/services/firebaseErrors';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/constants';
import type { <ModuleName>Run } from '../types/<ModuleName>';

export function runsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_<MODULE_NAME_UPPER>);
}

export function subscribeTo<ModuleName>Runs(
  labId: string,
  onData: (runs: <ModuleName>Run[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(runsCol(labId), orderBy('createdAt', 'desc'));
  return onSnapshot(q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as <ModuleName>Run))),
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}
```

### 4.4 `src/features/<module-name>/hooks/useSave<ModuleName>Run.ts`

**Esse é o arquivo mais crítico.** Ele implementa o pattern de [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md). Não desvie.

```ts
import { runTransaction, serverTimestamp, doc, collection } from 'firebase/firestore';
import { db, auth } from '@/shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/constants';
import { logicalSignature } from '@/shared/utils/signature';
import { <ModuleName>RunInputSchema, type <ModuleName>RunInput } from '../components/<ModuleName>Form.schema';

export function useSave<ModuleName>Run(labId: string) {
  return async (input: <ModuleName>RunInput): Promise<string> => {
    const parsed = <ModuleName>RunInputSchema.parse(input);
    if (!auth.currentUser) throw new Error('Operador não autenticado');
    const operadorId = auth.currentUser.uid;

    const canonicalPayload = { ...parsed, labId, operadorId };
    const signature = await logicalSignature(canonicalPayload);

    const runRef = doc(collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_<MODULE_NAME_UPPER>));
    const eventRef = doc(collection(runRef, 'events'));

    await runTransaction(db, async (tx) => {
      tx.set(runRef, {
        ...parsed,
        labId,
        operadorId,
        logicalSignature: signature,
        status: 'confirmed',
        createdAt: serverTimestamp(),
      });
      tx.set(eventRef, {
        type: '<module-name>.run.created',
        labId,                         // denormalizado p/ collectionGroup rule
        operadorId,
        payloadSignature: signature,
        serverTimestamp: serverTimestamp(),
        chainStatus: 'pending',        // chainHash virá do trigger
      });
    });

    return runRef.id;
  };
}
```

### 4.5 Mutação em `src/constants.ts`

```ts
export const SUBCOLLECTIONS = {
  // ... existentes
  CIQ_<MODULE_NAME_UPPER>: 'ciq-<module-name>',
  CIQ_<MODULE_NAME_UPPER>_CONFIG: 'ciq-<module-name>-config',
  CIQ_<MODULE_NAME_UPPER>_AUDIT: 'ciq-<module-name>-audit',
} as const;

export const MODULE_CLAIMS = {
  // ... existentes
  <MODULE_CLAIM_NAME>: '<moduleClaimName>',
} as const;
```

### 4.6 Mutação em `firestore.rules`

Ver template completo em [hcq-firestore-rules-generator](../hcq-firestore-rules-generator/SKILL.md). Bloco mínimo:

```javascript
match /labs/{labId}/ciq-<module-name>/{runId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create, update: if (isSuperAdmin() || isActiveMemberOfLab(labId))
    && isValid<ModuleName>Run(request.resource.data);
  allow delete: if isSuperAdmin() || isAdminOrOwner(labId);

  match /events/{eventId} {
    // ver hcq-ciq-audit-trail seção 6
  }
}

match /labs/{labId}/ciq-<module-name>-config/{docId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow write: if isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}

function isValid<ModuleName>Run(d) {
  return d.labId is string
    && d.operadorId is string
    && d.createdAt is timestamp
    && d.logicalSignature is string
    && d.logicalSignature.size() == 64;
  // adicione invariantes específicos do módulo
}
```

### 4.7 Cloud Function — `functions/src/modules/<module-name>/chainHash.ts`

Copie o template de [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md) seção 5. Substitua `<modulo>` por `<module-name>` e `GENESIS = sha256('<module-name>-v1')`.

### 4.8 `src/features/hub/ModuleHub.tsx` — card novo

```tsx
{flags.<moduleClaimName> && (
  <ModuleCard
    module="<module-name>"
    label="<ModuleName>"
    status="beta"                          // S3-S4; promover a 'ga' em S5
    onClick={() => navigate('/<module-name>')}
  />
)}
```

---

## 5. Ordem de execução do scaffold

Gere os arquivos nesta ordem (evita dependências não-resolvidas durante geração):

1. `src/constants.ts` — adicionar SUBCOLLECTIONS + MODULE_CLAIMS
2. `src/features/<module-name>/types/<ModuleName>.ts`
3. `src/features/<module-name>/components/<ModuleName>Form.schema.ts`
4. `src/features/<module-name>/services/<moduleName>FirebaseService.ts`
5. `src/features/<module-name>/services/<moduleName>StatsService.ts` *ou* `CategoryEval.ts`
6. `src/features/<module-name>/hooks/use<ModuleName>Runs.ts`
7. `src/features/<module-name>/hooks/useSave<ModuleName>Run.ts`  ← incorpora audit trail
8. `src/features/<module-name>/utils/<moduleName>Helpers.ts`
9. `src/features/<module-name>/components/<ModuleName>Form.tsx`  ← incorpora InsumoPicker (ver [hcq-insumo-picker-integrator](../hcq-insumo-picker-integrator/SKILL.md))
10. `src/features/<module-name>/components/<ModuleName>RunsTable.tsx`
11. `src/features/<module-name>/components/<ModuleName>Chart.tsx` *(só quantitativo/híbrido)*
12. `src/features/<module-name>/<ModuleName>View.tsx`
13. `src/features/<module-name>/__tests__/<moduleName>Helpers.test.ts`
14. `src/features/<module-name>/__tests__/useSave<ModuleName>Run.test.ts` (mock emulator)
15. `functions/src/modules/<module-name>/chainHash.ts`
16. `functions/src/modules/<module-name>/index.ts`  (`export * from './chainHash'`)
17. Mutação `functions/src/index.ts`  (`export * from './modules/<module-name>'`)
18. `tools/verify<ModuleName>Chain.ts`  *(se hasChainHash)*
19. Mutação `firestore.rules`  (bloco match novo)
20. Mutação `src/features/hub/ModuleHub.tsx`  (card novo gated por flag)
21. Mutação `package.json`  (script `verify:chains` estendido)

---

## 6. Validação após scaffold

Após gerar, rode nesta ordem e pare no primeiro erro:

```bash
npm run typecheck   # TS strict, zero erro
npm run lint        # zero warning novo (baseline 88)
npm run test:unit   # 274 baseline + novos testes
npm run build
(cd functions && npm run build)
```

Se passar, rode o gate completo de [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md).

Se o scaffold deixou `TODO:` ou `throw new Error('não implementado')` em pontos de lógica de domínio (não em infraestrutura), o usuário deve implementar antes do PR. Scaffold sem corpo de negócio é esqueleto — não merece merge.

---

## 7. Anti-patterns do scaffold

| Anti-pattern | Motivo | Correção |
|---|---|---|
| Copiar `coagulacao/` inteiro com sed | Lock-in de decisões específicas de coagulação (Westgard quantitativo) em módulo categórico | Use este template, não clone |
| Criar pasta sem `__tests__/` | Testes "depois" não existem | Gere ao menos 2 testes skeleton |
| Esquecer `labId` denormalizado no event | CollectionGroup rule quebra | Checklist seção 4.4 |
| Pular feature flag | Rollout sem controle, lab piloto não consegue isolar | Sempre gere config doc + card gated |
| Scaffold sem `MODULE_CLAIMS` | Hub mostra pra todos, bypass de RBAC | Gere claim e verifique no Hub |
| Gerar `<Modulo>Chart.tsx` em módulo categórico | Recharts desnecessário, bundle inchado | Gere só se quantitativo/híbrido |
| `chainHash` na CF em região errada | Deploy em us-central1 por default | Sempre `region: 'southamerica-east1'` |
| `SUBCOLLECTIONS` sem sufixo `_CONFIG` e `_AUDIT` | Próxima extensão do módulo fica inconsistente | Gere os 3 de uma vez |
| Hook sem auth check (`auth.currentUser`) | Runtime error se operador deslogou mid-flight | `if (!auth.currentUser) throw` no topo do save |

---

## 8. Exemplo completo — invocação típica

```
Usuário: "Cria módulo bioquímica, quantitativo, integra com controles e reagentes, tem chain hash, 6 analytes: GLU Glicose mg/dL, CRE Creatinina mg/dL, URE Ureia mg/dL, COL Colesterol mg/dL, TGL Triglicérides mg/dL, ALT ALT U/L"

Claude (esta skill):
1. Infere moduleName='bioquimica', ModuleName='Bioquimica', moduleClaimName='bioquimica'
2. Confirma inputs faltantes (requiresFR? [] → ok, só o essencial)
3. Lê constants.ts atual pra não quebrar ordem
4. Gera 21 arquivos na ordem da seção 5
5. Rode validação seção 6
6. Reporta: "Scaffold gerado. Falta implementar: <ModuleName>Chart axis config, <moduleName>StatsService.westgardEvaluate(). Abra PR feat(bioquimica): scaffold inicial (s0)."
```

---

## 9. Evolução

Quando a arquitetura base mudar (novo padrão compartilhado, helper novo em `shared/`, mudança de biblioteca), **atualize esta skill e bumpe versão**. Scaffolds antigos geram código desatualizado se a skill não evolui.

Checklist de evolução:
- [ ] Templates da seção 4 refletem última decisão do [hcq-ciq-module](../hcq-ciq-module/SKILL.md)
- [ ] Ordem da seção 5 cobre todos os arquivos gerados
- [ ] Anti-patterns da seção 7 absorveram bugs encontrados em PRs recentes
- [ ] Links cruzados com outras skills ainda válidos (paths não renomeados)
