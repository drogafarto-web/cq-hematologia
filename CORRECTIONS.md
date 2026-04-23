# Plano de Correção HC Quality — Implementação 2026-04-22

Implementação completa das 5 ondas do plano de auditoria fullstack.
**Código está pronto. Deploy é sequenciado por segurança.**

---

## Ordem de deploy obrigatória

```
Hoje          Onda 1  →  Onda 4 + Onda 5 (shadow / dual-write)
D+3 a D+5     Onda 2  (provisioning) — dry-run, aplica, verifica
D+7 a D+10    Onda 3  (bypass removal) — só depois de Onda 2 verificada
D+14 a D+21   Onda 5 fase 2  (endurecer rules após janela de divergências = 0)
```

**Nunca aplique `firestore.rules.post-onda2` antes de Onda 2 estar 100%.**

---

## Onda 1 — Segurança imediata (aplicável hoje)

### Mudanças já nos arquivos principais

- [firestore.rules:55-57](firestore.rules#L55-L57) — fechado leak LGPD: `/users/{userId}` agora exige `request.auth.uid == userId || isSuperAdmin()` para get.
- [firestore.indexes.json](firestore.indexes.json) — adicionados 6 índices:
  - `runs` (collection group) por `confirmedAt` e `createdAt`
  - `ciq-audit` por `timestamp`, por `severity + timestamp`, por `moduleId + timestamp`

### Deploy
```
firebase deploy --only firestore:rules,firestore:indexes
```

### Rollback
```
git revert <sha> && firebase deploy --only firestore:rules,firestore:indexes
```

---

## Onda 2 — Provisionamento de module claims

### Entregas
- [functions/src/modules/admin/provisionModulesClaims.ts](functions/src/modules/admin/provisionModulesClaims.ts) — callable SuperAdmin, dry-run por padrão, idempotente
- [functions/src/modules/admin/temporarySuperAdmin.ts](functions/src/modules/admin/temporarySuperAdmin.ts) — **autorizado explicitamente pelo CTO** para período de testes; par grant/revoke com snapshot reversível
- Wiring em [functions/src/index.ts](functions/src/index.ts)

### Uso — provisionamento normal
```
# 1. Dry-run
provisionModulesClaims({ dryRun: true })
# → retorna { scanned, updated, unchanged, skipped, diffs }

# 2. Aplicar
provisionModulesClaims({ dryRun: false })

# 3. Verificar (dry-run de novo)
provisionModulesClaims({ dryRun: true })
# → updated deve ser 0
```

### Uso — SuperAdmin temporário (período de testes)
```
# 1. Dry-run — inspeciona quem seria promovido
grantTemporarySuperAdminToAll({ dryRun: true })

# 2. Aplicar (token literal obrigatório)
grantTemporarySuperAdminToAll({
  dryRun: false,
  confirmationToken: 'EU-ENTENDO-OS-RISCOS-LGPD',
  reason: 'Período de testes pré-lançamento 2026-04-22 a 2026-05-05'
})

# 3. Revogar ao final do período
revokeTemporarySuperAdmin({ dryRun: true })
revokeTemporarySuperAdmin({ dryRun: false, confirmationToken: 'REVOGAR' })
```

**Garantias do revoke**: só demove usuários que o snapshot registrou como
`wasSuperAdminBefore: false`. SuperAdmins legítimos preexistentes permanecem
intactos.

### Deploy
```
cd functions && npm run build && firebase deploy --only functions
```

---

## Onda 3 — Remoção dos bypasses (GATED)

### Arquivo separado — não aplicar automaticamente
- [firestore.rules.post-onda2](firestore.rules.post-onda2) — versão strict sem `!('modules' in request.auth.token)`

### Pré-condições obrigatórias
1. Onda 2 aplicada em produção
2. `provisionModulesClaims({ dryRun: true })` retorna `updated: 0, skipped: 0`
3. 48h sem regressão em logs

### Deploy (manual, após condições)
```
# Backup do rules atual
cp firestore.rules firestore.rules.pre-onda3
# Aplicar versão strict
cp firestore.rules.post-onda2 firestore.rules
git commit -am "onda 3: remove module claim bypass"
firebase deploy --only firestore:rules --project hcquality-staging
# valida 24-48h em staging
firebase deploy --only firestore:rules
```

### Rollback
```
cp firestore.rules.pre-onda3 firestore.rules
firebase deploy --only firestore:rules
```

---

## Onda 4 — Writer de ciq-audit

### Entregas
- [functions/src/modules/ciqAudit/genesis.ts](functions/src/modules/ciqAudit/genesis.ts) — genesis hash por lab
- [functions/src/modules/ciqAudit/writer.ts](functions/src/modules/ciqAudit/writer.ts) — escrita transacional com chain hash + idempotência
- [functions/src/modules/ciqAudit/triggers.ts](functions/src/modules/ciqAudit/triggers.ts) — 3 triggers onDocumentWritten (hemato, imuno, insumos)
- [functions/src/modules/ciqAudit/index.ts](functions/src/modules/ciqAudit/index.ts) — exports
- [functions/test/ciqAudit/chainHash.test.mjs](functions/test/ciqAudit/chainHash.test.mjs) — 7 testes de chain (gênese, cadeia de 20, idempotência, ação crítica, isolamento por lab)

### Ações cobertas
- Runs: `CREATE_RUN`, `APPROVE_RUN`, `REJECT_RUN`, `REOPEN_RUN`, `EDIT_RUN_VALUE`, `ATTACH_CORRECTIVE_ACTION`
- Insumos: `OPEN_LOT`, `CLOSE_LOT`, `DISCARD_LOT`, `SEGREGATE_LOT`

### Ações críticas (reason obrigatória)
`REOPEN_RUN`, `EDIT_RUN_VALUE`, `DISCARD_LOT`, `SEGREGATE_LOT` — RDC 978/2025 Art.128.

### Efeito imediato em produção
Seção 3 do relatório operacional (`hcquality_operacional_*.pdf`) passa de
"Coleta em deploy" para mostrar eventos reais em 1-2 semanas.

### Deploy
```
cd functions && npm run build && firebase deploy --only functions
```

### Rollback
Remover os exports de `onHematologiaRunAudit`, `onImunoRunAudit`,
`onInsumoLifecycleAudit` em `functions/src/index.ts` e redeploy. Eventos
já escritos permanecem (coleção imutável por design).

---

## Onda 5 — HMAC server-side (dual-write)

### Entregas
- [functions/src/modules/signatures/canonical.ts](functions/src/modules/signatures/canonical.ts) — builder determinístico de payload
- [functions/src/modules/signatures/verifier.ts](functions/src/modules/signatures/verifier.ts) — HMAC-SHA256 + verify
- [functions/src/modules/signatures/triggers.ts](functions/src/modules/signatures/triggers.ts) — 3 triggers dual-write
- [functions/test/signatures/verifier.test.mjs](functions/test/signatures/verifier.test.mjs) — 8 testes de canonicalize + HMAC

### Pré-requisito — criar o secret antes do deploy
```
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY
# gera chave aleatória de 256+ bits e cola quando pedir
openssl rand -hex 32  # exemplo de chave
```

### Fase 1 — dual-write (observação, 7-14 dias)
- Trigger calcula HMAC server-side e grava `serverHmac` + `serverHmacComputedAt`
- Divergência contra `logicalSignature`/`payloadSignature` (cliente) → grava em `auditLogs` como `SIGNATURE_DIVERGENCE`
- **Não rejeita** escritas

### Fase 2 — endurecer rules (após divergências = 0)
Atualizar `firestore.rules.post-onda2` para exigir `serverHmac` presente em
reads críticos. Esta mudança não está incluída no arquivo — produzir em PR
separado após observação.

### Deploy (Fase 1)
```
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY
cd functions && npm run build && firebase deploy --only functions
```

---

## Verificação end-to-end

### Typecheck
```
cd functions && npx tsc --noEmit
# exit 0 esperado
```

### Testes
```
cd functions && npm test
# esperados: 22 (baseline) + 7 (ciq-audit chain) + 8 (HMAC) = 37 testes verdes
```

### Smoke em staging
1. Criar 1 run em cada módulo → verificar evento em `ciq-audit`
2. Editar um run manualmente → verificar `EDIT_RUN_VALUE` com `severity=critical`
3. Forçar divergência: gravar `logicalSignature` errada via Admin SDK → verificar `SIGNATURE_DIVERGENCE` em `auditLogs`
4. Rodar `grantTemporarySuperAdminToAll({ dryRun: true })` → retorna lista sem escrever

---

## Arquivos tocados

**Modificados**
- `firestore.rules` — fix `/users/{userId}` leak
- `firestore.indexes.json` — 6 novos índices
- `functions/src/index.ts` — re-exports de 8 novas funções

**Novos**
- `firestore.rules.post-onda2`
- `functions/src/modules/admin/provisionModulesClaims.ts`
- `functions/src/modules/admin/temporarySuperAdmin.ts`
- `functions/src/modules/ciqAudit/{genesis,writer,triggers,index}.ts`
- `functions/src/modules/signatures/{canonical,verifier,triggers,index}.ts`
- `functions/test/ciqAudit/chainHash.test.mjs`
- `functions/test/signatures/verifier.test.mjs`
- `CORRECTIONS.md` (este arquivo)

---

## Telemetria durante os deploys

Monitorar em Cloud Logging, filtrado por severity ≥ WARNING:

- **Onda 1**: `permission-denied` em `/users/*` reads — esperado zero depois de `getIdToken(true)` ser chamado no cliente
- **Onda 2**: `auditLogs` com action `PROVISION_MODULES_APPLY` — checar `updated` no payload
- **Onda 3**: `permission-denied` em `/labs/*/lots` e `/labs/*/ciq-imuno` — se aparecer, users não foram provisionados; rollback imediato
- **Onda 4**: contagem de docs em `ciq-audit` por lab; errors de trigger
- **Onda 5**: `auditLogs` com action `SIGNATURE_DIVERGENCE` — alvo: zero; investigar cada ocorrência
