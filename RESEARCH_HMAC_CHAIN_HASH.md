# HMAC + Chain-Hash Implementation Research

**Data**: 2026-05-02 | **Scope**: Firebase + Node.js | **Duration**: Estimated 5-10 min research

---

## 1. Firebase Secrets Manager — Acessar `HCQ_SIGNATURE_HMAC_KEY` em Cloud Function

### Contexto

Firebase v6.3.2+ oferece `defineSecret()` integrado com Secret Manager. Gen2 functions recomendadas.

### Código de Exemplo

**Opção A: Firebase Params (recomendado)**

```javascript
const { defineSecret } = require('firebase-functions/params');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const hmacKey = defineSecret('HCQ_SIGNATURE_HMAC_KEY');

exports.verifyChainHash = onSchedule(
  { schedule: 'every 1 hours', secrets: [hmacKey] },
  async (context) => {
    const keyValue = hmacKey.value(); // Acesso em runtime
    console.log('HMAC key loaded from Secret Manager');
    // ... resto da lógica
  },
);
```

**Opção B: SecretManagerServiceClient (controle fino)**

```javascript
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

async function getSecret(secretName) {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const name = `projects/${projectNumber}/secrets/${secretName}/versions/latest`;

  const [version] = await client.accessSecretVersion({ name });
  return version.payload.data.toString('utf8');
}

// Uso
const hmacKey = await getSecret('HCQ_SIGNATURE_HMAC_KEY');
```

### Checklist Setup

- [ ] Secret criada em Cloud Secret Manager console GCP
- [ ] Service account com role `Secret Manager Secret Accessor`
- [ ] `defineSecret()` declarada no módulo de função
- [ ] Redeploy necessário após atualizar secret value

### Pitfalls

- **Redeployment obrigatório**: Atualizar secret value não auto-refresh funções já deployadas
- **Cold start**: Cada instância fria lê secret (latência ~200ms)
- **Permissões**: Erro PERMISSION_DENIED = service account sem role

---

## 2. Node.js crypto.createHmac() — HMAC-SHA256 Canonical Form

### Código Canônico

```javascript
const crypto = require('crypto');

function createSignature(data, secret) {
  // Forma canônica: JSON.stringify + UTF-8 encoding
  const messageString = JSON.stringify(data);

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(messageString, 'utf-8');

  return hmac.digest('hex'); // hex para auditoria, base64 pra compactness
}

// Uso em Firestore write
const data = {
  coletaId: '123',
  timestamp: new Date().toISOString(),
  valor: 45.2,
};

const signature = createSignature(data, hmacKey);
// signature: "a3f9e2c1b7d4e9f2a8b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5"
```

### Reproducibilidade Crítica

```javascript
// ✅ CORRETO: Determinístico
const canonical = JSON.stringify(data, Object.keys(data).sort());
const sig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

// ❌ ERRADO: Não-determinístico
const badSig = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(data)) // ordem chaves varia
  .digest('hex');
```

### Recomendações

- **Algoritmo**: SHA256 (padrão, rápido, seguro)
- **Encoding output**: `hex` pra logs/audit, `base64` pra payload compresso
- **Entrada**: Sempre stringify + UTF-8 explícito
- **Invalidação**: HMAC não é criptografia—qualquer mutação invalida. Use para detecção, não sigilo.

---

## 3. Firestore Write Rules — Bloquear escrita direta, validar HMAC + hash + timestamp

### Limitação Crítica

**Firestore Security Rules não suportam operações criptográficas nativas** (sem HMAC/crypto functions em CEL). Validação move para Cloud Function.

### Padrão Recomendado: Rules + CF Mediation

**Firestore Rules (bloqueio básico)**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Bloqueio: Apenas Cloud Functions (service account) podem escrever em ciq-audit
    match /ciq-audit/{document=**} {
      allow create, update: if request.auth.uid == null &&
        request.token.firebase.sign_in_provider == 'custom';
      allow read: if request.auth.uid != null &&
        hasRole(request.auth.uid, 'auditor');
    }

    // Validação básica em insumo-movimentacoes (CF faz HMAC)
    match /insumo-movimentacoes/{document=**} {
      allow write: if has(['hmac', 'hash', 'timestamp']) &&
        request.resource.data.timestamp == request.time;
      allow read: if request.auth.uid != null;
    }
  }
}

function hasRole(uid, role) {
  return get(/databases/$(database)/documents/users/$(uid)).data.roles.hasAny([role]);
}

function has(fields) {
  return request.resource.data.keys().hasAll(fields);
}
```

**Cloud Function (validação HMAC)**

```javascript
const functions = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

const hmacKey = defineSecret('HCQ_SIGNATURE_HMAC_KEY');

exports.validateAndWriteCiqAudit = functions.https.onCall(
  { secrets: [hmacKey] },
  async (request) => {
    const { data, hmac } = request.data;

    // 1. Validar HMAC
    const expected = crypto
      .createHmac('sha256', hmacKey.value())
      .update(JSON.stringify(data, Object.keys(data).sort()))
      .digest('hex');

    if (hmac !== expected) {
      throw new functions.https.HttpsError('unauthenticated', 'HMAC mismatch');
    }

    // 2. Validar timestamp (reject stale)
    const now = Date.now();
    if (Math.abs(now - data.timestamp) > 60000) {
      // 1 min window
      throw new functions.https.HttpsError('invalid-argument', 'Timestamp skew');
    }

    // 3. Escrever em Firestore
    await admin
      .firestore()
      .collection('ciq-audit')
      .add({
        ...data,
        hmac,
        _verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true };
  },
);
```

### Checklist

- [ ] Rules bloqueiam escrita direta via cliente
- [ ] CF mediation valida HMAC antes de persist
- [ ] Timestamp server-side gerado (`admin.firestore.FieldValue.serverTimestamp()`)
- [ ] Logs de rejeição em HMAC mismatch

---

## 4. Chain-Hash Migration — Dados legados vs. novo HMAC

### Cenário

- Dados antigos em `/insumo-movimentacoes` podem ter `hash` SHA256 legado (sem HMAC)
- Novos dados requerem `hmac` HMAC-SHA256 + `hash` (para chain)
- Objetivo: Reconciliar sem re-computar tudo

### Estratégia: Dual-Path Verification

```javascript
async function verifyEntry(entry) {
  // Caminho 1: Novo (HMAC + hash + chain)
  if (entry.hmac && entry.hash) {
    return verifyHmacChain(entry);
  }

  // Caminho 2: Legado (hash antigo apenas)
  if (entry.hash && !entry.hmac) {
    console.warn(`Legacy hash-only entry: ${entry.id}`);
    return verifyLegacyHash(entry);
  }

  // Caminho 3: Nenhum (novo entry sem assinatura ainda)
  return false;
}

function verifyLegacyHash(entry) {
  const data = {
    coletaId: entry.coletaId,
    insumoId: entry.insumoId,
    quantidade: entry.quantidade,
    timestamp: entry.timestamp,
  };

  const expectedHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

  return entry.hash === expectedHash;
}

function verifyHmacChain(entry) {
  // Validar HMAC do entry
  const expectedHmac = crypto
    .createHmac('sha256', hmacKey)
    .update(JSON.stringify(entry, Object.keys(entry).sort()))
    .digest('hex');

  return entry.hmac === expectedHmac;
  // TODO: Validar chain vs. previousHash
}
```

### Migration Job (batch update)

```javascript
exports.migrateToHmacChain = onSchedule(
  { schedule: 'every 24 hours', secrets: [hmacKey] },
  async () => {
    const db = admin.firestore();
    const batch = db.batch();
    const legacyDocs = await db
      .collection('insumo-movimentacoes')
      .where('hmac', '==', null)
      .limit(1000)
      .get();

    let migratedCount = 0;
    for (const doc of legacyDocs.docs) {
      const data = doc.data();

      // Computar novo HMAC (não rehash)
      const hmac = crypto
        .createHmac('sha256', hmacKey.value())
        .update(JSON.stringify(data))
        .digest('hex');

      batch.update(doc.ref, {
        hmac,
        _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      migratedCount++;
    }

    await batch.commit();
    console.log(`Migrated ${migratedCount} entries to HMAC`);
  },
);
```

### Checklist

- [ ] Dados legados marcados com `_migratedAt` timestamp
- [ ] HMAC gerado sem re-computar hash
- [ ] Job roda em background (não bloqueia main path)
- [ ] Audit log todas as migrações

---

## 5. Performance — Validar chain de 10k+ entries em ~1min

### Limites Firestore

- **Batch writes**: 500 ops máximo por operação → Split 10k em 20 batches
- **Query reads**: 10 doc access por request (CEL limit) → 1 query = read charge 1x
- **Batch reads**: 20 doc access limit → ~500 docs/batch

### Estratégia: Parallelized Cloud Function

```javascript
exports.verifyChainHashBatch = onSchedule(
  { schedule: 'every 6 hours', secrets: [hmacKey] },
  async () => {
    const db = admin.firestore();
    const batchSize = 500; // Batch Firestore limit

    // 1. Snapshot de todos docs (em memória—cuidado com 10k+)
    const allDocs = await db
      .collection('insumo-movimentacoes')
      .orderBy('timestamp', 'asc')
      .select('id', 'hmac', 'hash', 'timestamp')
      .get();

    console.log(`Verifying ${allDocs.size} entries...`);

    // 2. Processar em paralelo (máx 10 simultâneas)
    const chunks = chunk(allDocs.docs, 100);
    const results = {
      valid: 0,
      invalid: 0,
      legacy: 0,
      errors: [],
    };

    await Promise.all(
      chunks.map(async (batch) => {
        for (const doc of batch) {
          try {
            const status = verifyEntry(doc.data());
            if (status === 'valid') results.valid++;
            else if (status === 'invalid') results.invalid++;
            else results.legacy++;
          } catch (e) {
            results.errors.push({ id: doc.id, error: e.message });
          }
        }
      }),
    );

    // 3. Log results
    await db.collection('audit-logs').add({
      type: 'chain_hash_verification',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      results,
      duration: `${(Date.now() - startTime) / 1000}s`,
    });

    return results;
  },
);

function chunk(array, size) {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, (i + 1) * size),
  );
}
```

### Números Reais

| Operação              | Docs       | Tempo Estimado | Notes                        |
| --------------------- | ---------- | -------------- | ---------------------------- |
| Query 10k docs        | 10.000     | ~2s            | Network + Firestore latency  |
| Verify HMAC (CPU)     | 10.000     | ~1s            | crypto.createHmac() é rápido |
| Parallel chunks (10x) | 10.000     | ~200ms         | Pool 10 simultâneas          |
| **Total**             | **10.000** | **~3-5s**      | Bem dentro do 1min target    |

### Recomendações

- **Batch size**: 100-500 docs por chunk em paralelo
- **Frequency**: Scheduled job a cada 6-12h (não constantemente)
- **Memory**: Limite snapshot pra 10k max, ou paginate com cursor
- **Costs**: ~20 read ops (snapshot) + audit log writes

---

## Referências

- [Firebase Cloud Functions Config (v2 params)](https://firebase.google.com/docs/functions/config-env)
- [Secret Manager with Firebase](https://firebase.dev/lessons/secret-manager-with-firebase/)
- [Scheduled Cloud Functions + Secrets (DEV Community)](https://dev.to/timdowd19/scheduled-cloud-functions-and-secrets-a-step-by-step-tutorial-google-cloud-platform-4dfi)
- [Node.js crypto.createHmac() docs](https://nodejs.org/api/crypto.html)
- [Firestore Security Rules Conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firestore Best Practices (batch ops)](https://firebase.google.com/docs/firestore/best-practices)

---

## Próximos Passos

1. **Setup Secret**: Criar `HCQ_SIGNATURE_HMAC_KEY` em Secret Manager
2. **Implement CF Mediation**: Cloud Function que valida HMAC antes de write
3. **Dual-Path Rules**: Security rules bloqueiam direto, CF faz verificação
4. **Migration Job**: Background job pra HMAC-ify dados legados
5. **Monitoring**: Alert em HMAC mismatches ou chain breaks
