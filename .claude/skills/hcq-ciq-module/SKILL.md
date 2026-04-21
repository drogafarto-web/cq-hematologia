---
name: hcq-ciq-module
description: Playbook do hc quality para construir ou estender módulos de CIQ laboratorial (hematologia, coagulação, uroanálise, imunologia, insumos, novos). Use sempre que adicionar um módulo, integrar rastreabilidade de insumos em forms, construir export de formulário FR-*, ou modificar audit trail. Define convenções de Firestore, tipos, rules, hooks, Cloud Functions, assinatura/chain hash e gate pré-merge. Referência canônica — se conflitar com implementação atual, o código em produção venceu e a skill deve ser atualizada.
---

# hcq-ciq-module — Playbook de módulos CIQ

> **Versão:** 1.0 · **Última atualização:** 2026-04-20 · **Piloto:** Labclin MG · **Aplicado a:** React 19 + TS 5.8 + Firebase 12

Esta skill é a referência canônica de **como construir, estender ou integrar módulos de Controle de Qualidade Interno** no projeto hc quality. Toda decisão aqui foi tomada para maximizar estabilidade, reduzir quebras e escalar pros módulos seguintes sem refactor.

---

## 1. Quando usar esta skill

Você deve invocar `/hcq-ciq-module` sempre que:

- Criar um módulo CIQ novo (ex: bioquímica, parasitologia, microbiologia)
- Estender um módulo existente com novo tipo de corrida, reagente ou fluxo
- Integrar **rastreabilidade de insumos** em um form de corrida (pattern `InsumoPicker`)
- Adicionar um export de formulário compliance (FR-10 FR-nn...) em PDF
- Modificar audit trail (eventos, movimentações, assinatura, chain hash)
- Adicionar Cloud Function scheduled ou trigger no escopo CIQ
- Validar rules Firestore de um novo recurso lab-scoped
- Ativar feature flag por lab

Se o trabalho não toca nenhum desses, essa skill não se aplica — use `hm-engineer`, `hm-designer`, `hm-qa` ou as skills do Firebase.

---

## 2. Invariantes não-negociáveis

Essas regras não são ajustáveis por módulo. Quebrá-las é motivo de rejeitar o PR.

1. **Feature-based structure** — todo módulo vive em `src/features/<nome>/` com `components/`, `hooks/`, `services/`, `types/`, `utils/`. Nunca espalhe por pastas horizontais.
2. **Multi-tenant por lab** — **zero dado cross-lab**. Todo path Firestore começa em `labs/{labId}/...`. Nenhum módulo consome ou grava em root collections.
3. **Zero `any`** — TS strict, sem `any` nem casts à força. Use discriminated union antes de casts quando o domínio tem variantes (`tipo: 'controle' | 'reagente' | ...`).
4. **Zod em toda boundary** — form, IA (OCR), payload externo. Nunca persistir dado não validado.
5. **RBAC via member doc, nunca email hardcoded** — rules usam `isActiveMemberOfLab(labId)` + `isAdminOrOwner(labId)`, padrão estabelecido em `firestore.rules` (blocos `ciq-coagulacao`, `ciq-imuno`, `ciq-uro`, `insumos`).
6. **Audit trail imutável** — toda ação de estado (criar/abrir/fechar/descartar/anular) gera doc numa subcoleção de movimentações/eventos. Rules bloqueiam `update` e `delete`.
7. **Assinatura lógica SHA-256** — toda movimentação/run carrega `logicalSignature` (hash do canonical do payload). Chain hash (link com anterior) é **server-side** via Cloud Function — nunca client-side (evita fork offline multi-device).
8. **`firestoreTimestampSchema` em vez de `z.date()` cru** — SDK retorna `Timestamp`, não `Date`. Use o helper de `src/shared/services/zodHelpers.ts` pra normalizar `Timestamp | Date | ISO string → Date`.
9. **Feature flag aditivo pra módulos novos** — ative lab-a-lab via `labs/{labId}/<modulo>-config/settings.enabled` antes de tornar visível no Hub. Rollout zero-impacto é pré-condição de deploy em produção.
10. **Gate pré-merge completo** — `typecheck && lint && test:unit && build && (cd functions && npm run build)`. CI roda o mesmo. Falha num → PR não merge.
11. **Dark-first** — todo componente tem classe dark. Padrão cromático: `bg-white dark:bg-[#151d2a]`, borda `border-slate-200 dark:border-white/[0.1]`.
12. **Referência FR-* física é a fonte de verdade visual** — export digital **replica** o formulário físico da Labclin linha-por-linha, coluna-por-coluna. Nunca inventar layout próprio pra compliance.

---

## 3. Anatomia de um módulo CIQ

### 3.1 Folder layout canônico

```
src/features/<modulo>/
├── <Modulo>View.tsx              # Shell/dashboard (rota)
├── components/
│   ├── <Modulo>Form.tsx          # Form de corrida (usa InsumoPicker)
│   ├── <Modulo>Form.schema.ts    # Zod schema
│   ├── <Modulo>RunsTable.tsx     # Histórico
│   ├── <Modulo>Chart.tsx         # Levey-Jennings (se quantitativo)
│   └── <Modulo>ExportFR.tsx      # Export de FR-* compliance
├── hooks/
│   ├── use<Modulo>Runs.ts        # Subscription em tempo real
│   ├── useSave<Modulo>Run.ts     # Mutation + signature + audit
│   └── use<Modulo>Signature.ts   # Wrapper de useCIQSignature
├── services/
│   ├── <modulo>FirebaseService.ts # CRUD client-direct
│   └── <modulo>StatsService.ts    # Westgard, CV, viés (se aplicável)
├── types/
│   └── <Modulo>.ts                # Discriminated union quando há variantes
└── utils/
    └── <modulo>Helpers.ts         # Funções puras testáveis
```

Regras:
- **`<Modulo>View.tsx` na raiz**, nunca dentro de `components/`. É a rota.
- **Nunca importar de outro módulo** — se precisar, extraia pra `src/shared/`. Só `src/shared/` e `src/types/` são consumíveis cross-módulo.
- **`services/` é a única camada que toca Firestore.** Componentes chamam hooks; hooks chamam services.

### 3.2 Firestore paths canônicos

```
/labs/{labId}/ciq-<modulo>/{runId}                        ← runs do módulo
/labs/{labId}/ciq-<modulo>/{runId}/events/{eventId}       ← events do run (signature chain)
/labs/{labId}/ciq-<modulo>-config/settings                ← feature flag + config do lab
/labs/{labId}/ciq-<modulo>-audit/{docId}                  ← audit lab-scoped

/labs/{labId}/insumos/{insumoId}                          ← cadastro mestre cross-module
/labs/{labId}/insumo-movimentacoes/{movId}                ← movimentações imutáveis
```

Padrão `ciq-*` é reservado pra módulos de CIQ. Coleções mestres cross-module (insumos) **não** usam prefixo `ciq-` — elas são consumidas por múltiplos módulos.

### 3.3 Constantes centralizadas

Toda subcoleção aparece em `src/constants.ts` como membro de `COLLECTIONS` ou `SUBCOLLECTIONS`. **Nunca** hardcode string de path em service. Adicionar nova subcoleção:

```ts
// src/constants.ts
export const SUBCOLLECTIONS = {
  ...
  CIQ_BIOQUIMICA: 'ciq-bioquimica',
  CIQ_BIOQUIMICA_CONFIG: 'ciq-bioquimica-config',
  CIQ_BIOQUIMICA_AUDIT: 'ciq-bioquimica-audit',
} as const;
```

---

## 4. Tipos e Zod

### 4.1 Discriminated union quando há variantes

Modelo `Insumo` em `src/features/insumos/types/Insumo.ts` é o gabarito:

```ts
interface InsumoBase { id: string; labId: string; modulo: InsumoModulo; ... }
export interface InsumoControle extends InsumoBase { tipo: 'controle'; nivel: ...; stats?: ...; }
export interface InsumoReagente extends InsumoBase { tipo: 'reagente'; }
export interface InsumoTiraUro extends InsumoBase { tipo: 'tira-uro'; ... }
export type Insumo = InsumoControle | InsumoReagente | InsumoTiraUro;

export function isControle(i: Insumo): i is InsumoControle { return i.tipo === 'controle'; }
```

Benefício: narrowing sem cast, Zod consegue `z.discriminatedUnion`, UI renderiza por `tipo` sem `if/else` aninhado.

### 4.2 Zod + Firestore Timestamp

Sempre use o helper compartilhado (criar em `src/shared/services/zodHelpers.ts` se ainda não existir):

```ts
export const firestoreTimestampSchema = z.preprocess((v) => {
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === 'string') return new Date(v);
  return v;
}, z.date());
```

Motivo: Firestore SDK retorna `Timestamp`, não `Date`. `z.date()` cru falha. Forms HTML retornam string ISO. O helper cobre os 3.

### 4.3 Discriminated union no schema raiz

Quando o schema tem variantes, use `z.discriminatedUnion('tipo', [...])`. Refinamentos cross-branch ficam no `.refine()` do `discriminatedUnion` raiz, não nas branches.

---

## 5. Services (camada Firestore)

### 5.1 Client-direct com Rules-as-defense

O padrão do projeto é **client-direct**: React chama Firestore SDK direto, sem Cloud Function intermediária. Rules Firestore são a defesa. Cloud Functions só pra:
- Scheduled (expiração, relatórios periódicos)
- Trigger `onDocumentCreated` (chain hash, email)
- Callable com side effect server-only (claims, admin ops)

Nunca roteie CRUD por Callable só por hábito — aumenta latência, custa mais, e duplica validação.

### 5.2 Gabarito de service

```ts
// src/features/<modulo>/services/<modulo>FirebaseService.ts
import { db, collection, doc, query, where, orderBy, onSnapshot,
         setDoc, updateDoc, serverTimestamp, Timestamp,
         firestoreErrorMessage } from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';

function runsCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_MODULO);
}

export function subscribeToRuns(
  labId: string,
  onData: (runs: Run[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(runsCol(labId), orderBy('createdAt', 'desc'));
  return onSnapshot(q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Run))),
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}
```

Regras:
- **`firestoreErrorMessage`** sempre — converte código bruto em msg amigável em pt-BR.
- **`cause: err`** no Error pra preservar stack.
- **Nenhum service salva sem passar pelo hook de save** — hook é quem orquestra signature + audit.

### 5.3 Gabarito de hook de save

Toda mutação de estado segue este fluxo:

```
1. Validar payload com Zod (já feito no form)
2. Calcular logicalSignature = SHA-256(canonical(payload))
3. Transação Firestore (se atomicidade exigida):
   - setDoc/updateDoc do doc principal
   - setDoc na subcoleção de events/movimentações (imutável, com signature)
4. Retornar id
5. Se erro: toast + rethrow (nunca silenciar)
```

Audit trail é **não-negociável**. Hook de save sem gravar movimentação reprova review.

---

## 6. Hooks de subscription

Padrão `useInsumos`, `useCIQRuns`, `useCoagulacaoRuns`:

```ts
export function useRuns(labId: string | null) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) { setIsLoading(false); return; }
    const unsub = subscribeToRuns(labId,
      (data) => { setRuns(data); setIsLoading(false); },
      (err)  => { setError(err); setIsLoading(false); },
    );
    return unsub;
  }, [labId]);

  return { runs, isLoading, error };
}
```

Regras:
- **Cleanup do listener obrigatório** via return do useEffect. Memory leak em navegação é bug.
- **`labId: string | null`** — aceite null pra evitar subscription prematura.
- **Loading/error exposto** — componentes não devem inferir estado.

---

## 7. Integração de Insumos em forms de corrida

Todo form de CQ/paciente num módulo que consome reagentes/controles/tiras **deve** ter `InsumoPicker` na seção correspondente. Gabarito:

```tsx
// src/features/<modulo>/components/<Modulo>Form.tsx
import { InsumoPicker } from '@/features/insumos/components/InsumoPicker';
import type { Insumo } from '@/features/insumos/types/Insumo';

<InsumoPicker
  tipo="controle"                    // ou 'reagente' | 'tira-uro'
  modulo="bioquimica"                // o módulo que você está construindo
  value={form.insumoControleId ?? null}
  onSelect={(insumo) => {
    if (insumo) {
      setField('insumoControleId', insumo.id);
      setField('loteControle', insumo.lote);
      setField('fabricanteControle', insumo.fabricante);
      setField('validadeControle', insumo.validade);
      if (insumo.dataAbertura) setField('aberturaControle', insumo.dataAbertura);
    } else {
      setField('insumoControleId', null);
    }
  }}
  ariaLabel="Selecionar controle cadastrado"
/>
```

Regras:
- **Campos manuais permanecem** — seleção do Picker **preenche**, não substitui. Backwards compat com forms legados.
- **`insumoControleId` é o único campo novo obrigatório** no schema (nullable — null = entrada manual).
- **Pré-preenchimento nunca sobrescreve edit** do usuário — se usuário já digitou e depois seleciona, avisar via confirm (UX). MVP: sobrescreve mas loga.

---

## 8. Assinatura lógica + Chain hash

### 8.1 `logicalSignature` (client-side, funciona offline)

```ts
// src/shared/utils/signature.ts
export async function logicalSignature(payload: object): Promise<string> {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const enc = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

Canonical deve ser determinístico: **chaves ordenadas**, sem campos `Timestamp` do servidor (use `dataCriacao` do cliente se precisar no canonical). Isto garante que assinatura ≡ payload um-pra-um.

### 8.2 `chainHash` (server-side, via Cloud Function trigger)

**Decisão arquitetural:** chain hash é **sempre** server-side. Multi-device offline gera fork se linkado client-side. Padrão:

```ts
// functions/src/modules/<modulo>/chainHash.ts
export const on<Modulo>EventCreate = onDocumentCreated(
  { document: 'labs/{labId}/ciq-<modulo>/{runId}/events/{eventId}',
    region: 'southamerica-east1' },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.chainHash) return; // idempotência

    const prior = await db.collection(`labs/${event.params.labId}/ciq-<modulo>/${event.params.runId}/events`)
      .where('serverTimestamp', '<', data.serverTimestamp)
      .orderBy('serverTimestamp', 'desc')
      .limit(1)
      .get();

    const prev = prior.empty ? GENESIS_HASH : prior.docs[0].data().chainHash;
    const chainHash = sha256(data.payloadSignature + prev);

    await event.data.ref.update({
      chainHash,
      chainStatus: 'sealed',
      sealedAt: FieldValue.serverTimestamp(),
    });
  }
);
```

Regras:
- **Idempotente** — check `chainHash` already set → early return.
- **Tiebreaker determinístico** — se `serverTimestamp` coincidir, ordenar por `eventId` lexicográfico.
- **Genesis hash fixo** — primeiro evento usa `SHA256('<modulo>-v1')`.
- **Rules bloqueiam write client-side** em `chainHash`, `chainStatus`, `sealedAt`. Só Admin SDK escreve.
- **Verificador CLI** em `tools/verifyChain.ts` (exemplo: `tools/verifyInsumoChain.ts` para insumos) — re-calcula toda a cadeia e compara. Deve bater 100%. Nota: `scripts/` no repo é gitignored (pasta de ops locais); verificadores versionados vão em `tools/`.

### 8.3 Quando adicionar chain hash

Adicione chain hash quando:
- Audit trail é mostrado ao auditor (RDC/PALC) — tamper-evidence é exigido
- Múltiplos devices escrevem eventos do mesmo recurso em paralelo
- Valor legal (assinatura eletrônica MP 2.200-2/2001)

**Não** adicione quando:
- Log interno de desenvolvimento
- Volume muito alto (milhões de eventos/mês) — avalie custo de função
- Recurso é single-writer (só um server-side escreve)

---

## 9. Rules Firestore

### 9.1 Gabarito por módulo

Replicar o padrão `ciq-coagulacao` (ver `firestore.rules` linhas ~189+):

```javascript
match /labs/{labId} {
  match /ciq-<modulo>/{runId} {
    allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
    allow create, update: if (isSuperAdmin() || isActiveMemberOfLab(labId))
                          && isValidRun(request.resource.data);
    allow delete: if isSuperAdmin() || isAdminOrOwner(labId);

    match /events/{eventId} {
      allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
      allow create: if isActiveMemberOfLab(labId)
                    && request.resource.data.chainHash == null      // cliente nunca escreve chain
                    && request.resource.data.chainStatus == 'pending';
      allow update, delete: if false;                                // imutável
    }
  }

  match /ciq-<modulo>-config/{docId} {
    allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
    allow write: if isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
  }

  match /ciq-<modulo>-audit/{docId} {
    allow read: if isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
    allow create: if isActiveMemberOfLab(labId);
    allow update, delete: if false;
  }
}
```

### 9.2 Collection group rule obrigatória

Quando houver subcoleção `events/` ou `movimentações/` que possa ser consultada cross-módulo, adicionar:

```javascript
match /{path=**}/events/{eventId} {
  allow read: if isSuperAdmin() || (request.auth != null
              && isActiveMemberOfLab(resource.data.labId));
  allow write: if false;
}
```

Motivo: sem isso, `collectionGroup('events')` é bloqueado. Adicionar antes vira custoso (toda audit existente precisa ganhar `labId` denormalizado).

### 9.3 Defense-in-depth: validação de payload

Rules devem validar tipos primitivos e invariantes críticos:

```javascript
function isValidRun(d) {
  return d.labId is string
      && d.operadorId is string
      && d.createdAt is timestamp
      && d.logicalSignature is string
      && d.logicalSignature.size() == 64  // SHA-256 hex
      && (!('reagentLotsUsed' in d) || d.reagentLotsUsed is list);
}
```

Não dependa de Zod do cliente — um invasor com Firestore SDK bypassa Zod.

---

## 10. Cloud Functions — padrão

### 10.1 Estrutura modular em `functions/src/modules/`

Cada módulo CIQ ganha pasta própria:

```
functions/src/modules/<modulo>/
├── index.ts           # exports públicos (triggers, callables)
├── chainHash.ts       # trigger onDocumentCreated
├── scheduled.ts       # tarefas periódicas
└── callables.ts       # callable functions (admin, claims)
```

`functions/src/index.ts` faz `export * from './modules/<modulo>'`.

### 10.2 Scheduled function (gabarito)

```ts
// functions/src/modules/<modulo>/scheduled.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';

export const scheduled<Modulo>Task = onSchedule(
  {
    schedule: '15 3 * * *',              // 03:15 BRT diário
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 540,
    retryCount: 3,
  },
  async () => {
    const start = Date.now();
    try {
      // ... lógica ...
      logger.info('<modulo>/scheduled: ok', { durationMs: Date.now() - start });
    } catch (err) {
      logger.error('<modulo>/scheduled: fail', { err });
      throw err;
    }
  }
);
```

Regras:
- **Região `southamerica-east1`** — consistência com dados.
- **Timezone BRT** — relatórios fazem sentido localmente.
- **Batch de 500 writes** — limite Firestore. Loop com chunking.
- **Log estruturado** — nunca `console.log`. Use `logger` de `firebase-functions/v2`.

### 10.3 Callable function (gabarito)

```ts
export const triggerSomething = onCall({ region: 'southamerica-east1' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login obrigatório');

  const { labId, ...data } = req.data as { labId: string };
  await assertMemberRole(req.auth.uid, labId, ['admin', 'owner']); // ou SuperAdmin

  // ... lógica ...
  return { ok: true };
});
```

CORS: sempre `cors: true` (workaround do bug Gen2 SP — ver memória `project_known_bugs`).

---

## 11. Feature flag por lab

### 11.1 Estrutura

```
/labs/{labId}/<modulo>-config/settings
  - enabled: boolean        (default: false)
  - enabledBy?: { uid, timestamp }
  - <outros settings>
```

### 11.2 Consumo no Hub

```tsx
// src/features/hub/ModuleHub.tsx
const { enabled } = useModuleEnabled(labId, 'bioquimica');
{enabled && <ModuleCard module="bioquimica" status="beta" ... />}
```

### 11.3 Rollout

| Estágio | Labs | Condição |
|---|---|---|
| S0 | — (local) | emulator verde |
| S1 | super-admin preview channel | smoke manual |
| S2 | produção, flag off todos | CI verde |
| S3 | produção, flag on lab piloto | 1 semana sem incidente |
| S4 | produção, flag on +1 lab beta | idem |
| S5 | GA progressivo | idem |

Ativar flag requer toggle manual via painel super-admin (evita rollout acidental).

### 11.4 Quando o flag é dispensável

Módulo aditivo que **não** afeta rota nem Firestore existente pode shipar sem flag — ex: novo componente interno, novo helper. Rule: se diff toca **rota do Hub** OU **schema de módulo legado**, flag obrigatório.

---

## 12. Export FR-* (PDF de compliance)

### 12.1 Princípio

O PDF **replica** o formulário físico da Labclin pixel-a-pixel (header, grade, rodapé, assinatura). Auditor deve olhar digital e físico lado a lado e ver o mesmo layout.

### 12.2 Stack

- **react-to-print** — impressão preserva CSS complexo (Tailwind).
- **Componente `<FRnnPrint />`** dedicado por formulário — nunca reusar layout genérico.
- **QR de validação** no rodapé — linka pra endpoint público read-only que valida o hash contra Firestore.

### 12.3 Gabarito

```tsx
// src/features/<modulo>/components/FR10Print.tsx
export const FR10Print = forwardRef<HTMLDivElement, FR10PrintProps>(function FR10Print(
  { equipamento, periodo, lotes, hash }, ref
) {
  return (
    <div ref={ref} className="print-container">
      <header>
        <img src={logoLabclin} alt="" />
        <h1>FR-10 — Rastreabilidade de Insumos — Ver.00</h1>
        <div>Material: Reagentes {equipamento.nome} · Equipamento: {equipamento.modelo}</div>
      </header>
      <table>
        <thead>
          <tr>{COLUNAS_FR10.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {lotes.map(l => <FR10Row key={l.id} lote={l} />)}
        </tbody>
      </table>
      <footer>
        <div>Hash: {hash}</div>
        <QRCode value={`https://<projeto>.web.app/validate/${hash}`} />
        <div>Gerência da Qualidade — Data: {fmtDate(new Date())}</div>
      </footer>
    </div>
  );
});
```

### 12.4 Metadata de compliance obrigatória

Todo PDF tem:
- Hash SHA-256 do payload agregado
- Timestamp servidor
- User claim + uid do gerador
- CNPJ lab + período
- QR de validação

Sem isso, o export não vale pra auditor.

### 12.5 Um PDF por contexto lógico

Padrão confirmado em `FR-10 preenchido 2024-2025` da Labclin: **um PDF por equipamento por período**, não por reagente. Intercalar linhas de reagentes diferentes no mesmo PDF se compartilham equipamento.

---

## 13. Testes

### 13.1 Obrigatórios por fase

- **Unit (Vitest)** — funções puras (`validadeReal`, `westgardRules`, `canonical`), 100% de branches dos refines Zod.
- **Integration** — hook de save em ambiente `@firebase/rules-unit-testing` ou emulador. Cobre: criar run → verifica doc + movimentação + signature.
- **Rules (emulator)** — membros certos leem, não-membros não leem, operador não deleta, admin deleta, movimentação não atualiza.
- **Chain hash verifier** — `scripts/verifyChain.ts` bate 100% após 3 eventos concorrentes simulados.

### 13.2 Fixtures determinísticas

Use `test/fixtures/` com builder functions (`makeRun(overrides?)`) em vez de JSON literal. Permite evolução de schema sem reescrever fixtures.

### 13.3 Coverage mínimo

Novas linhas ≥ 80%. Lint + typecheck zero-warning. Se coverage < 80%, falta teste ou código não é testável (refatorar).

---

## 14. Gate pré-merge (checklist)

Rode antes de cada commit (CI roda o mesmo):

```bash
npm run typecheck && \
npm run lint && \
npm run test:unit && \
npm run build && \
(cd functions && npm run build)
```

Checklist do PR:

- [ ] Typecheck zero erro
- [ ] Lint zero warning novo
- [ ] Testes passam com coverage ≥ 80% nas linhas novas
- [ ] Build (app + functions) passa sem warning novo
- [ ] Smoke manual no dev server (golden path + 1 edge case)
- [ ] Rules validados no emulator
- [ ] Feature flag default `false` em produção (se aplicável)
- [ ] Nenhum secret no diff (`.env`, chaves, tokens)
- [ ] Commit message: `feat(<modulo>): ...` / `fix(<modulo>): ...`
- [ ] Memória `MEMORY.md` atualizada se decisão arquitetural nova

---

## 15. Anti-patterns — rejeite no review

| Anti-pattern | Por que é ruim | O que fazer |
|---|---|---|
| Path Firestore hardcoded em service | Refactor caro, inconsistência entre módulos | Use `COLLECTIONS`/`SUBCOLLECTIONS` de `constants.ts` |
| `z.date()` cru no schema | Falha com Timestamp do SDK | `firestoreTimestampSchema` |
| Módulo importa de outro módulo | Acoplamento transitivo | Extraia pra `src/shared/` |
| Chain hash client-side | Fork offline multi-device | Cloud Function trigger server-side |
| Audit opcional | Compliance gap | Rule bloqueia create sem signature |
| Rule baseada em email hardcoded | Segurança frágil | Member doc + role |
| Cloud Function sem região explícita | Deploy em us-central1 por acaso | `region: 'southamerica-east1'` |
| Lançar string no erro | Perde stack | `throw new Error(msg, { cause: err })` |
| Subscription sem cleanup | Memory leak em navegação | Retorno do `useEffect` retorna unsub |
| Form sem Zod em boundary | Grava lixo no Firestore | `schema.safeParse` antes de submit |
| Feature flag client-side only | Bypass trivial via DevTools | Rule Firestore também checa |
| Export PDF layout próprio ignorando FR físico | Auditor rejeita | Pixel-match com referência física |
| Commit bundle multi-tema | Revisor perde contexto, rollback custoso | `git add -p` por tema |
| `any` / `as any` | Silencia bug que TS pegaria | Discriminated union ou generic |

---

## 16. Referências canônicas no código

Use estes arquivos como template ao construir um módulo novo:

| Padrão | Arquivo de referência |
|---|---|
| Discriminated union + Zod | `src/features/insumos/types/Insumo.ts` + `.schema.ts` |
| Service client-direct | `src/features/insumos/services/insumosFirebaseService.ts` |
| Hook real-time + filtros | `src/features/insumos/hooks/useInsumos.ts` |
| Picker de integração | `src/features/insumos/components/InsumoPicker.tsx` |
| Form com Picker + pré-preenchimento | `src/features/coagulacao/components/CoagulacaoForm.tsx` |
| Rules RBAC + audit imutável | `firestore.rules` blocos `ciq-coagulacao`, `insumos` |
| Scheduled function | `functions/src/modules/insumos/index.ts` (`scheduledExpireInsumos`) |
| Discriminated union narrowing helpers | `isControle`, `isReagente`, `isTiraUro` |

Se um desses arquivos for renomeado/movido, atualize esta skill.

---

## 17. Evolução da skill

Esta skill é **versionada** com o projeto. Toda decisão arquitetural nova que se aplique a módulos deve:

1. Ser discutida no PR
2. Ser refletida aqui (seção correspondente)
3. Bumpar a versão no topo
4. Ser comunicada em `memory/` se afeta sessões futuras do Claude Code

Skill desatualizada é pior que skill inexistente — o Claude vai seguir conselho errado com confiança.

---

## 18. Ordem de construção recomendada (um módulo novo do zero)

1. **Foundation** — tipos (`Insumo.ts`), constantes (`SUBCOLLECTIONS`), rules (bloco `ciq-<modulo>`)
2. **Service** — `<modulo>FirebaseService.ts`
3. **Hooks** — subscription + save
4. **Zod schemas** — form + validação de negócio (com `firestoreTimestampSchema`)
5. **Audit trail** — movimentações imutáveis + signature
6. **Chain hash** (se aplicável) — Cloud Function trigger
7. **UI base** — Form, RunsTable, View root
8. **Integração com Insumos** — InsumoPicker nos forms
9. **Feature flag** — config doc + consumo no Hub
10. **Export FR-*** — PDF compliance
11. **Scheduled tasks** (se aplicável) — expiração, relatórios
12. **Testes** — unit + integration + rules + chain verifier
13. **Rollout** — S0 → S1 → S2 → S3 → ...

Cada passo é um PR separado. **Nunca** bundle múltiplos passos num commit só.

---

**Fim do playbook.** Em caso de dúvida não coberta aqui: perguntar antes de inventar. Convenção nova vira anti-pattern quando não é comunicada.
