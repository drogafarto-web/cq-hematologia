---
name: hcq-firestore-rules-generator
description: Gera bloco de rules Firestore para um módulo CIQ do hc quality — match por labId, RBAC via member doc (isActiveMemberOfLab + isAdminOrOwner), events subcoleção imutável, config doc com flag enabled, audit subcoleção append-only, bloqueio de chainHash client-side, validação de payload por isValidRun, collectionGroup rule para events. Use ao criar módulo novo, ao ampliar um existente com subcoleção nova, ou ao auditar rules pré-deploy. Complementa hcq-ciq-audit-trail (rules do events) e hcq-module-generator (bloco gerado no scaffold).
---

# hcq-firestore-rules-generator — Rules Firestore por módulo CIQ

> **Versão:** 1.0 · **Última atualização:** 2026-04-20 · **Referência canônica:** `firestore.rules` bloco `ciq-coagulacao` + `insumos`

Esta skill gera o bloco de rules Firestore para um módulo CIQ seguindo o padrão estabelecido. Rules são **defense-in-depth**: cliente valida com Zod, rule revalida; se cliente bypassar, rule pega.

Skills relacionadas: [hcq-ciq-module](../hcq-ciq-module/SKILL.md) seção 9 (origem), [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md) (rules de events), [hcq-module-generator](../hcq-module-generator/SKILL.md) (chama esta skill), [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md) (testa rules no emulator).

---

## 1. Quando usar

Use quando:
- Criar módulo CIQ novo (gera bloco novo)
- Ampliar módulo existente com subcoleção nova (rules novos dentro do `match /labs/{labId}`)
- Revisar rules pré-deploy — esta skill serve como checklist
- Adicionar feature que exige `collectionGroup` query (ex: dashboard cross-módulo)

---

## 2. Helpers globais (existem no topo de firestore.rules)

Pressupõe-se que existam (senão, criar antes):

```javascript
function isAuthenticated() {
  return request.auth != null;
}

function isSuperAdmin() {
  return isAuthenticated() && request.auth.token.isSuperAdmin == true;
}

function memberDoc(labId) {
  return get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid));
}

function isActiveMemberOfLab(labId) {
  return isAuthenticated()
    && exists(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid))
    && memberDoc(labId).data.active == true;
}

function getMemberRole(labId) {
  return memberDoc(labId).data.role;
}

function isAdminOrOwner(labId) {
  return isActiveMemberOfLab(labId)
    && (getMemberRole(labId) == 'admin' || getMemberRole(labId) == 'owner');
}

function hasModuleAccess(module) {
  return isAuthenticated()
    && request.auth.token.modules != null
    && request.auth.token.modules[module] == true;
}
```

Se algum helper não existe, criar **antes** de expandir as rules. Nunca inline.

---

## 3. Template por módulo — CIQ quantitativo

Substitua `<modulo>` por kebab-case (ex: `bioquimica`), `<ModuleClaim>` por camelCase do claim (ex: `bioquimica`).

```javascript
match /labs/{labId}/ciq-<modulo>/{runId} {
  allow read: if isSuperAdmin()
    || (isActiveMemberOfLab(labId) && hasModuleAccess('<ModuleClaim>'));

  allow create: if (isSuperAdmin() || (isActiveMemberOfLab(labId) && hasModuleAccess('<ModuleClaim>')))
    && isValid<ModuleName>Run(request.resource.data)
    && request.resource.data.operadorId == request.auth.uid;

  allow update: if (isSuperAdmin() || isAdminOrOwner(labId))
    && isValid<ModuleName>Run(request.resource.data)
    && request.resource.data.labId == resource.data.labId       // não pode reatribuir lab
    && request.resource.data.createdAt == resource.data.createdAt // imutável
    && request.resource.data.logicalSignature == resource.data.logicalSignature; // idem

  allow delete: if isSuperAdmin() || isAdminOrOwner(labId);

  // Events: imutáveis, ver hcq-ciq-audit-trail seção 6
  match /events/{eventId} {
    allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
    allow create: if isActiveMemberOfLab(labId)
      && request.resource.data.chainHash == null
      && request.resource.data.chainStatus == 'pending'
      && request.resource.data.sealedAt == null
      && request.resource.data.payloadSignature is string
      && request.resource.data.payloadSignature.size() == 64
      && request.resource.data.operadorId == request.auth.uid
      && request.resource.data.labId == labId;
    allow update, delete: if false;
  }
}

// Config doc (feature flag + configurações por lab)
match /labs/{labId}/ciq-<modulo>-config/{docId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create, update: if isSuperAdmin()
    || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
  allow delete: if isSuperAdmin();
}

// Audit lab-scoped (ações admin: aprovar, descartar, etc.)
match /labs/{labId}/ciq-<modulo>-audit/{docId} {
  allow read: if isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
  allow create: if isActiveMemberOfLab(labId)
    && request.resource.data.actorId == request.auth.uid
    && request.resource.data.labId == labId;
  allow update, delete: if false;  // append-only
}

// Validator — fora de match, no escopo global das rules
function isValid<ModuleName>Run(d) {
  return d.labId is string
    && d.operadorId is string
    && d.createdAt is timestamp
    && d.logicalSignature is string
    && d.logicalSignature.size() == 64
    && d.status in ['draft', 'confirmed', 'discarded']
    && (!('insumoControleId' in d) || d.insumoControleId is string || d.insumoControleId == null)
    && (!('insumoReagenteIds' in d) || d.insumoReagenteIds is list)
    && (!('results' in d) || d.results is list);
}
```

Regras:
- **`hasModuleAccess` obrigatório** se o módulo tem feature flag em claim — evita bypass pelo Firestore SDK direto.
- **`operadorId == request.auth.uid` no create** — impede um usuário criar doc imputando outro.
- **`labId` e `createdAt` imutáveis no update** — auditor precisa confiar que esses não foram adulterados.
- **Update permitido só a admin/owner** — operador normal cria mas não edita histórico.
- **`labId` denormalizado no event** — necessário pra collectionGroup rule (ver seção 5).

---

## 4. Template por módulo — CIQ categórico

Idêntico ao quantitativo, com `isValid<ModuleName>Run` ajustado:

```javascript
function isValid<ModuleName>Run(d) {
  return d.labId is string
    && d.operadorId is string
    && d.createdAt is timestamp
    && d.logicalSignature is string
    && d.logicalSignature.size() == 64
    && d.status in ['draft', 'confirmed', 'discarded']
    && d.tests is list
    && d.allMatch is bool                             // derivado no cliente, validado aqui
    && (!('insumoControleId' in d) || d.insumoControleId is string || d.insumoControleId == null);
}
```

Não inclua `results` numérico — categórico não tem.

---

## 5. CollectionGroup rule (obrigatória se eventos são consultados cross-módulo)

Fora de qualquer `match /labs/{labId}`, no escopo global:

```javascript
match /{path=**}/events/{eventId} {
  allow read: if isSuperAdmin()
    || (isAuthenticated() && isActiveMemberOfLab(resource.data.labId));
  allow write: if false;   // writes vão pelos match específicos acima
}
```

**Pressuposto:** todo event tem `labId` denormalizado. Se não tem, essa rule falha. Ver seção 6 de [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md).

Análogo para movimentações cross-módulo:

```javascript
match /{path=**}/insumo-movimentacoes/{movId} {
  allow read: if isSuperAdmin()
    || (isAuthenticated() && isActiveMemberOfLab(resource.data.labId));
  allow write: if false;
}
```

---

## 6. Blocos cross-module compartilhados (exemplos para referência)

### 6.1 Insumos mestres

```javascript
match /labs/{labId}/insumos/{insumoId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create, update: if (isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId)))
    && isValidInsumo(request.resource.data);
  allow delete: if isSuperAdmin() || isAdminOrOwner(labId);
}

match /labs/{labId}/insumo-movimentacoes/{movId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create: if isActiveMemberOfLab(labId)
    && request.resource.data.chainHash == null
    && request.resource.data.payloadSignature is string
    && request.resource.data.payloadSignature.size() == 64
    && request.resource.data.operadorId == request.auth.uid
    && request.resource.data.labId == labId;
  allow update, delete: if false;
}
```

### 6.2 FR-* emissions (idempotente por hash)

```javascript
match /labs/{labId}/fr<nn>-emissions/{hash} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);

  // Create: docid DEVE ser o hash (idempotência natural)
  allow create: if isActiveMemberOfLab(labId)
    && request.resource.data.hash == hash
    && request.resource.data.hash is string
    && request.resource.data.hash.size() == 64
    && request.resource.data.labId == labId
    && request.resource.data.emittedBy == request.auth.uid
    && request.resource.data.reprintCount == 0;

  // Update: só lastPrintedAt e reprintCount podem mudar (reprint)
  allow update: if isActiveMemberOfLab(labId)
    && request.resource.data.hash == resource.data.hash
    && request.resource.data.labId == resource.data.labId
    && request.resource.data.payload == resource.data.payload
    && request.resource.data.firstEmittedAt == resource.data.firstEmittedAt
    && request.resource.data.emittedBy == resource.data.emittedBy
    && request.resource.data.reprintCount == resource.data.reprintCount + 1;

  allow delete: if false;   // FR emitido não se apaga
}
```

---

## 7. Teste de rules (obrigatório antes de deploy)

Arquivo: `scripts/test-rules.ts` (cria se não existe — ou estenda).

```ts
import { initializeTestEnvironment, RulesTestEnvironment }
  from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'test-hcq',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

describe('ciq-<modulo> rules', () => {
  it('membro ativo cria run', async () => {
    // seed member doc
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'labs/lab1/members/u1'),
        { active: true, role: 'member' });
    });
    const u = env.authenticatedContext('u1').firestore();
    await assertSucceeds(setDoc(doc(u, 'labs/lab1/ciq-<modulo>/r1'), validRunPayload()));
  });

  it('non-member NÃO lê', async () => {
    const u = env.authenticatedContext('outsider').firestore();
    await assertFails(getDoc(doc(u, 'labs/lab1/ciq-<modulo>/r1')));
  });

  it('operador NÃO deleta event', async () => {
    // ... seed event ...
    const u = env.authenticatedContext('u1').firestore();
    await assertFails(deleteDoc(doc(u, 'labs/lab1/ciq-<modulo>/r1/events/e1')));
  });

  it('cliente NÃO seta chainHash', async () => {
    const u = env.authenticatedContext('u1').firestore();
    await assertFails(setDoc(doc(u, 'labs/lab1/ciq-<modulo>/r1/events/e1'),
      { ...validEventPayload(), chainHash: 'a'.repeat(64) }));
  });

  it('admin deleta run', async () => {
    // seed admin member
    const u = env.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(deleteDoc(doc(u, 'labs/lab1/ciq-<modulo>/r1')));
  });
});
```

Rodado pelo gate DEPLOY de [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md).

---

## 8. Ordem no arquivo firestore.rules

O `firestore.rules` tem ~429 linhas. Organize alfabeticamente dentro do `match /labs/{labId}`:

```
1. /admin/**
2. /ciq-coagulacao/**
3. /ciq-<módulo novo — onde for alfabético>/**
4. /ciq-imuno/**
5. /ciq-uroanalise/**
6. /fr<nn>-emissions/**
7. /insumos/**
8. /insumo-movimentacoes/**
9. /members/**
10. /<módulo>-config/** (por módulo)
...
```

E os `match /{path=**}/events` ficam **fora** do `match /labs/{labId}`, no escopo global, agrupados no topo ou no rodapé.

Funções helpers (`isValid<ModuleName>Run`) ficam fora de qualquer match, no escopo global das rules. Ordene-as alfabeticamente também.

---

## 9. Checklist ao gerar rules para um módulo

- [ ] Bloco `match /labs/{labId}/ciq-<modulo>/{runId}` completo
- [ ] Subcoleção `events/` imutável (`update, delete: if false`)
- [ ] Subcoleção `events/` bloqueia cliente de setar chainHash/chainStatus/sealedAt
- [ ] `operadorId == request.auth.uid` no create
- [ ] `labId` e `createdAt` e `logicalSignature` imutáveis no update
- [ ] Update só a admin/owner (não operador comum)
- [ ] Config doc (`ciq-<modulo>-config`) só admin/owner escreve
- [ ] Audit doc (`ciq-<modulo>-audit`) append-only
- [ ] Validator `isValid<ModuleName>Run` existe e cobre invariantes
- [ ] `hasModuleAccess('<claim>')` usado se módulo tem claim
- [ ] `labId` denormalizado em events e movimentações
- [ ] CollectionGroup rule `/{path=**}/events/{eventId}` existe e lê `resource.data.labId`
- [ ] Ordem alfabética respeitada no arquivo
- [ ] Teste de rules cobre: membro lê, non-member não lê, operador cria, operador não atualiza, operador não deleta event, cliente não seta chainHash, admin deleta run
- [ ] `npm run test:rules` passa contra emulator

---

## 10. Anti-patterns

| Anti-pattern | Motivo | Correção |
|---|---|---|
| `allow read, write: if isActiveMemberOfLab(labId)` genérico | Operador pode editar/apagar tudo, inclusive audit | Split por operação, com invariantes |
| Rules confiam em Zod do cliente | Invasor com SDK bypassa Zod | Validator Firestore (`isValid<ModuleName>Run`) redundante |
| `allow update: if true` no event | Audit trail fica mutável | `if false` — sem exceção, nem admin |
| Rule baseada em email (`request.auth.token.email == 'admin@...'`) | Email muda, segurança frágil | Member doc + role |
| Inline helper duplicado | Próxima rule copia errado | Função global `isActiveMemberOfLab` etc. |
| Esquecer `hasModuleAccess` | Módulo em feature flag vazou pra todos | Adicionar claim + rule |
| CollectionGroup sem `labId` denormalizado | Rule quebra silenciosamente (read fail) | Sempre denormalizar `labId` no doc |
| `get()` em path errado (falta `databases/$(database)/documents/`) | Rule compila mas sempre falha | Usar helpers globais, não reinventar |
| Validator sem check de tamanho do hash | String vazia passa como SHA-256 | `.size() == 64` explícito |
| Permitir `allow write` em vez de `create/update/delete` separados | Perde granularidade | Sempre split |
| `match /labs/{labId}/{document=**}` catch-all | Vaza para subcoleções não previstas | Match explícito por subcoleção |
| FR emissão com update livre | Operador pode mudar payload de FR emitido | Update só incrementa `reprintCount` + `lastPrintedAt` |

---

## 11. Troubleshooting comum

**`permission-denied` em collectionGroup query:** falta `labId` no doc ou rule não tem `match /{path=**}/events/{eventId}`.

**`permission-denied` em update legítimo:** algum campo imutável mudou sem você perceber. Imprima `request.resource.data` vs. `resource.data` no emulator debug.

**Rule passa no emulator, falha em prod:** custom claims demoram até 1h para propagar. Force refresh com `auth.currentUser.getIdToken(true)`.

**Rule `get()` rende infinite loop:** você fez `get()` dentro de rule que é chamada pelo próprio path. Helpers de members buscam `/labs/{labId}/members/{uid}` — se a rule é dentro de `/labs/{labId}/members/{docId}`, buscar o próprio doc é ciclo. Use `request.resource.data.role` nesses casos.

---

## 12. Referências

| Padrão | Linha em firestore.rules |
|---|---|
| Helpers globais | topo do arquivo (~1-60) |
| Bloco ciq-coagulacao | ~189+ (referência canônica) |
| Bloco insumos + movimentações | (ver pilot PR #2) |
| CollectionGroup events | escopo global, próximo ao topo |
| isValidRun validators | escopo global, após helpers |

Se a ordem/estrutura do arquivo mudar (ex: refactor em módulos), atualize esta skill.
