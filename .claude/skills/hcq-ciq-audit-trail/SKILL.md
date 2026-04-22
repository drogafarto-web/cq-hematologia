---
name: hcq-ciq-audit-trail
description: Gera e valida audit trail tamper-evident para módulos CIQ do hc quality — logicalSignature client-side (SHA-256 canonical), event doc imutável em subcoleção, Cloud Function trigger que calcula chainHash idempotente, rules Firestore que bloqueiam mutação, verificador CLI. Use sempre que adicionar um ponto de gravação de estado (criar/abrir/fechar/descartar/anular/aprovar) em módulo CIQ ou rastreabilidade. Referência canônica da seção 8 do playbook hcq-ciq-module, expandida com scaffolds executáveis.
---

# hcq-ciq-audit-trail — Audit trail tamper-evident para CIQ

> **Versão:** 1.0 · **Última atualização:** 2026-04-20 · **Implementação de referência:** `src/features/insumos/` + `functions/src/modules/insumos/chainHash.ts` · **Verificador canônico:** `tools/verifyInsumoChain.ts`

Esta skill codifica o padrão **logicalSignature (client) + chainHash (server)** que todo módulo CIQ de hc quality precisa para sobreviver a auditoria sanitária (RDC 978/2025, ISO 15189:2022 7.3.4.3, MP 2.200-2/2001 art.4). Use-a sempre que estiver prestes a criar um `setDoc`/`updateDoc` que represente mudança de estado relevante para compliance.

Skills relacionadas: [hcq-ciq-module](../hcq-ciq-module/SKILL.md) (contexto), [hcq-module-generator](../hcq-module-generator/SKILL.md) (integra esse padrão em scaffolds), [hcq-firestore-rules-generator](../hcq-firestore-rules-generator/SKILL.md) (rules que defendem essa cadeia), [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md) (verifier roda no gate).

---

## 1. Quando usar

Invoque esta skill **toda vez** que for construir ou revisar:

- Gravação de run CIQ (quantitativa ou categórica)
- Movimentação de insumo (abrir, fechar, descartar, transferir)
- Emissão de FR-* (FR-10, FR-50, etc.)
- Aprovação/rejeição regulatória com valor legal
- Alteração de estado de um lote/lote-de-controle
- Ativação/desativação de feature flag que afete compliance

**Não use** para:
- Log de debug (use `logger.info` direto)
- Cache local de UI (use Zustand sem audit)
- Evento efêmero sem valor legal (telemetria de performance, analytics)

---

## 2. Modelo mental — três camadas

```
┌───────────────────────────────────────────────────────────────────┐
│ CLIENT (funciona offline, tolera multi-device)                    │
│   logicalSignature = SHA-256( canonical(payload) )                │
│   grava: payload + logicalSignature + chainStatus: 'pending'      │
└────────────┬──────────────────────────────────────────────────────┘
             │ onDocumentCreated trigger (idempotente)
             ▼
┌───────────────────────────────────────────────────────────────────┐
│ SERVER (Cloud Function, ordena por serverTimestamp)               │
│   prior = query anterior por serverTimestamp desc                 │
│   chainHash = SHA-256( logicalSignature + prior.chainHash )       │
│   atualiza: chainHash + chainStatus: 'sealed' + sealedAt          │
└────────────┬──────────────────────────────────────────────────────┘
             │ (offline — gate de auditoria)
             ▼
┌───────────────────────────────────────────────────────────────────┐
│ VERIFIER (CLI, recompute puro, bate 100%)                         │
│   tools/verify<Modulo>Chain.ts                                    │
│   recomputa toda a cadeia por labId e compara com Firestore       │
└───────────────────────────────────────────────────────────────────┘
```

Por que esta separação é não-negociável:

1. **Client-side hash é suficiente para tamper-evidence do payload** — qualquer adulteração quebra a assinatura local.
2. **Server-side chain resolve fork multi-device offline** — dois dispositivos offline geram eventos com `logicalSignature` válida; o trigger enfileira determinsticamente por `serverTimestamp` + tiebreaker lexicográfico, evitando fork na cadeia.
3. **Verifier CLI é a defesa contra Cloud Function buggada** — se a função escreveu `chainHash` errado, o verifier detecta no gate pré-merge e na auditoria.

---

## 3. Invariantes

1. **`logicalSignature` é calculado no cliente.** Sempre. Nunca no server.
2. **`chainHash` é calculado no server.** Sempre. Nunca no client. Rules Firestore **bloqueiam** write client de `chainHash`, `chainStatus`, `sealedAt`.
3. **Canonical é determinístico** — chaves ordenadas alfabeticamente, sem `Timestamp` do servidor, sem campos voláteis (`undefined`, `null`, ordem de inserção de array que não seja semanticamente ordenada).
4. **Trigger é idempotente** — se `chainHash` já existe, early return. Função pode ser reentregue pelo Pub/Sub; não pode reprocessar.
5. **Subcoleção `events/` é imutável** — rules `allow update, delete: if false`.
6. **Genesis fixo por módulo** — primeiro evento usa `SHA256('<modulo>-v1')`. Nunca o hash do próprio evento.
7. **Verificador bate 100% em cada gate pré-merge** — não é opcional.

---

## 4. Scaffold — logicalSignature client-side

### 4.1 Helper compartilhado (uma vez por projeto)

Arquivo: `src/shared/utils/signature.ts`

```ts
/**
 * SHA-256 hex do canonical JSON de um payload.
 * Chaves ordenadas alfabeticamente em todo nível.
 * NÃO inclui serverTimestamp nem campos voláteis (undefined/null).
 */
export async function logicalSignature(payload: unknown): Promise<string> {
  const canonical = canonicalize(payload);
  const enc = new TextEncoder().encode(canonical);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function canonicalize(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  const keys = Object.keys(v as object).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize((v as Record<string, unknown>)[k])).join(',') + '}';
}
```

### 4.2 Uso no hook de save

```ts
// src/features/<modulo>/hooks/useSave<Modulo>Run.ts
import { logicalSignature } from '@/shared/utils/signature';

export function useSave<Modulo>Run(labId: string) {
  return async (payload: <Modulo>RunInput) => {
    const parsed = runSchema.parse(payload); // Zod first
    const canonicalPayload = toCanonicalPayload(parsed); // remove Timestamp
    const signature = await logicalSignature(canonicalPayload);

    const runRef = doc(collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_<MODULO>));
    const eventRef = doc(collection(runRef, 'events'));

    await runTransaction(db, async (tx) => {
      tx.set(runRef, {
        ...parsed,
        logicalSignature: signature,
        operadorId: auth.currentUser!.uid,
        createdAt: serverTimestamp(),
      });
      tx.set(eventRef, {
        type: 'run.created',
        payloadSignature: signature,
        operadorId: auth.currentUser!.uid,
        serverTimestamp: serverTimestamp(),
        chainStatus: 'pending',
        // chainHash NÃO — rule bloqueia
      });
    });

    return runRef.id;
  };
}
```

### 4.3 `toCanonicalPayload` — critérios

- Remove todos os `serverTimestamp()` e `FieldValue.*`
- Converte `Date`/`Timestamp` de cliente pra ISO string
- Remove campos gerados pelo server (`chainHash`, `chainStatus`, `sealedAt`)
- Mantém arrays em ordem semântica (se não houver, ordene)
- Não inclua o próprio `logicalSignature` (óbvio, mas já vi bug)

---

## 5. Scaffold — Cloud Function trigger

Arquivo: `functions/src/modules/<modulo>/chainHash.ts`

```ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

const GENESIS = sha256('<modulo>-v1'); // ex: sha256('coagulacao-v1')

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export const on<Modulo>EventCreate = onDocumentCreated(
  {
    document: 'labs/{labId}/ciq-<modulo>/{runId}/events/{eventId}',
    region: 'southamerica-east1',
    retry: true,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();

    // 4. Idempotência: já selado → skip
    if (data.chainHash) return;

    const db = getFirestore();
    const eventsCol = db.collection(
      `labs/${event.params.labId}/ciq-<modulo>/${event.params.runId}/events`
    );

    // Busca evento anterior por serverTimestamp (tiebreaker: eventId lexicográfico)
    const prior = await eventsCol
      .where('serverTimestamp', '<', data.serverTimestamp)
      .orderBy('serverTimestamp', 'desc')
      .orderBy('__name__', 'desc')
      .limit(1)
      .get();

    let prevHash = GENESIS;
    if (!prior.empty) {
      const p = prior.docs[0].data();
      if (!p.chainHash) {
        // Caso raro: anterior ainda não foi selado. Retry (Pub/Sub re-entrega).
        throw new Error(`prior event ${prior.docs[0].id} not sealed yet`);
      }
      prevHash = p.chainHash;
    }

    const chainHash = sha256(data.payloadSignature + prevHash);

    await snap.ref.update({
      chainHash,
      chainStatus: 'sealed',
      sealedAt: FieldValue.serverTimestamp(),
    });

    logger.info('chain/sealed', {
      labId: event.params.labId,
      runId: event.params.runId,
      eventId: event.params.eventId,
      prevHash: prevHash.slice(0, 8),
      chainHash: chainHash.slice(0, 8),
    });
  }
);
```

Regras críticas:

- **`retry: true`** — Pub/Sub re-entrega em caso de falha. Trigger **deve** ser idempotente (check `data.chainHash` na entrada).
- **Tiebreaker por `__name__`** — quando dois eventos têm `serverTimestamp` idêntico (batch), ordena pelo documentId. Determinístico.
- **`throw` quando anterior não selou** — Pub/Sub re-entrega. Não silencie.
- **Log com `prevHash.slice(0,8)`** — curto, pesquisável, não polui logs.

---

## 6. Scaffold — rules Firestore

Bloco obrigatório no `firestore.rules`:

```javascript
match /labs/{labId}/ciq-<modulo>/{runId}/events/{eventId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);

  allow create: if isActiveMemberOfLab(labId)
    && request.resource.data.chainHash == null       // cliente nunca seta
    && request.resource.data.chainStatus == 'pending'
    && request.resource.data.sealedAt == null
    && request.resource.data.payloadSignature is string
    && request.resource.data.payloadSignature.size() == 64
    && request.resource.data.operadorId == request.auth.uid;

  allow update, delete: if false; // imutável — nem super admin
}

// Cross-module collectionGroup (obrigatória se algum dashboard consulta events)
match /{path=**}/events/{eventId} {
  allow read: if isSuperAdmin()
    || (request.auth != null && isActiveMemberOfLab(resource.data.labId));
  allow write: if false;
}
```

Nota: `labId` precisa estar **denormalizado** no doc do event para a collectionGroup rule funcionar. Sempre escreva `labId` no payload do event, mesmo sendo redundante com o path.

Para detalhes do resto das rules por módulo, ver [hcq-firestore-rules-generator](../hcq-firestore-rules-generator/SKILL.md).

---

## 7. Scaffold — verificador CLI

Template de `tools/verify<Modulo>Chain.ts` (inspirado em `tools/verifyInsumoChain.ts`):

```ts
#!/usr/bin/env tsx
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

const GENESIS = sha256('<modulo>-v1');
function sha256(s: string) { return createHash('sha256').update(s).digest('hex'); }

initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
const db = getFirestore();

async function verifyLab(labId: string): Promise<{ ok: boolean; broken: string[] }> {
  const broken: string[] = [];
  const runs = await db.collection(`labs/${labId}/ciq-<modulo>`).listDocuments();

  for (const runRef of runs) {
    const events = await runRef.collection('events')
      .orderBy('serverTimestamp', 'asc').orderBy('__name__', 'asc').get();

    let prev = GENESIS;
    for (const ev of events.docs) {
      const d = ev.data();
      if (d.chainStatus !== 'sealed') { broken.push(`${ev.ref.path}: not sealed`); break; }
      const expected = sha256(d.payloadSignature + prev);
      if (d.chainHash !== expected) {
        broken.push(`${ev.ref.path}: expected ${expected.slice(0,8)}, got ${String(d.chainHash).slice(0,8)}`);
        break;
      }
      prev = d.chainHash;
    }
  }
  return { ok: broken.length === 0, broken };
}

(async () => {
  const labId = process.argv[2];
  if (!labId) { console.error('usage: verify<Modulo>Chain.ts <labId>'); process.exit(1); }
  const result = await verifyLab(labId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 2);
})();
```

Adicione no `package.json` (raiz):

```json
"scripts": {
  "verify:chains": "tsx tools/verifyInsumoChain.ts && tsx tools/verify<Modulo>Chain.ts"
}
```

E no gate pré-merge (ver [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md)), `verify:chains` roda contra emulator após seed, bloqueia merge se quebrar.

---

## 8. Checklist ao integrar esta skill num módulo

- [ ] `logicalSignature()` helper existe em `src/shared/utils/signature.ts`
- [ ] Hook `useSave<Modulo>Run` calcula signature antes de escrever
- [ ] Transação escreve doc principal + event na mesma operação
- [ ] Event doc tem: `payloadSignature`, `operadorId`, `serverTimestamp`, `chainStatus: 'pending'`, `labId` (denormalizado)
- [ ] Cloud Function `on<Modulo>EventCreate` deployed em `southamerica-east1`
- [ ] Trigger checa `data.chainHash` na entrada (idempotência)
- [ ] Rules bloqueiam write client-side de `chainHash`, `chainStatus`, `sealedAt`
- [ ] Rules collectionGroup `events` existe e lê `resource.data.labId`
- [ ] `labId` é denormalizado no event doc
- [ ] `tools/verify<Modulo>Chain.ts` existe e roda standalone
- [ ] `npm run verify:chains` inclui o novo verifier
- [ ] Teste unitário: `logicalSignature(payload)` é determinístico (mesma entrada → mesma saída)
- [ ] Teste integration (emulator): 3 events concorrentes → cadeia sela corretamente, verifier bate
- [ ] Teste rules: cliente tenta setar `chainHash` → permission-denied

---

## 9. Anti-patterns

| Anti-pattern | Por que é bug | Correção |
|---|---|---|
| `canonical = JSON.stringify(payload)` sem sort | Assinatura varia com ordem de chave | `canonicalize()` helper com sort recursivo |
| Incluir `serverTimestamp()` no canonical | Cliente envia `FieldValue`, server substitui — hash quebra | Remover antes de hashear; se precisar de data no canonical, use `Date.now()` do cliente |
| chainHash client-side | Fork offline multi-device | Cloud Function trigger server-side |
| Trigger sem check de idempotência | Pub/Sub re-entrega gera chainHash duplicado/errado | `if (data.chainHash) return;` na entrada |
| `orderBy('serverTimestamp')` sem tiebreaker | Dois eventos no mesmo ms → ordem não-determinística | Segundo `orderBy('__name__')` |
| `allow update: if isAdminOrOwner(labId)` no event | Admin pode adulterar audit | `allow update, delete: if false` — sem exceção |
| Verifier só no CI, não no gate local | Regressão silenciosa em dev | `npm run verify:chains` no gate pré-merge |
| `labId` só no path (sem denormalizar) | CollectionGroup rule não consegue ler → toda query cross-lab falha | Sempre escreva `labId` no doc |
| Silenciar erro `prior not sealed` no trigger | Cadeia fica com buraco, verifier detecta tarde | `throw` — Pub/Sub re-entrega |
| Genesis calculado por config externa | Hash muda se config muda → cadeia inválida | `sha256('<modulo>-v1')` hardcoded |

---

## 10. Quando há dúvida sobre o modelo

Três perguntas de bolso antes de aplicar audit trail:

1. **"Um auditor sanitário vai olhar isso?"** Sim → precisa chain. Não → `logger.info` basta.
2. **"Dois dispositivos offline podem gerar este evento em paralelo?"** Sim → server-side chain obrigatório. Não → client-side signature basta (mas prefira server).
3. **"Se alguém editar esse doc depois, eu preciso detectar?"** Sim → event imutável + rules `if false`. Não → reconsidere se é mesmo audit.

Se qualquer resposta for "talvez", trate como "sim". Compliance é assimétrico: custo de ter é baixo, custo de não ter é catastrófico.

---

## 11. Referências no código

| Padrão | Arquivo |
|---|---|
| Helper canonical + SHA-256 | `src/shared/utils/signature.ts` (criar se ausente) |
| Hook de save com signature | `src/features/insumos/hooks/useSaveInsumoMovimentacao.ts` |
| Trigger chainHash | `functions/src/modules/insumos/chainHash.ts` |
| Verificador CLI | `tools/verifyInsumoChain.ts` |
| Rules events + collectionGroup | `firestore.rules` bloco `insumo-movimentacoes` |

Se algum destes for renomeado, atualize esta skill e a seção 16 de [hcq-ciq-module](../hcq-ciq-module/SKILL.md).
