# Runbook — Restauração do Firestore

> **Alvo de tempo:** RTO (Recovery Time Objective) de 4h · RPO (Recovery Point Objective) de 24h em pior caso, <2min com PITR.
>
> **Quem pode executar:** apenas SuperAdmin com acesso ao projeto GCP `hmatologia2` (Owner ou Editor).
>
> **Quando ler:** antes de incidente (leitura regular recomendada), no momento de incidente (siga os passos em ordem).

---

## Contexto — duas camadas de defesa

| Camada | Ferramenta                        | Janela                                               | Granularidade     | Uso                                                       |
| ------ | --------------------------------- | ---------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| **1**  | **PITR** (Point-in-Time Recovery) | **7 dias**                                           | Segundos          | Rollback rápido (delete/overwrite acidental, bug recente) |
| **2**  | **Scheduled export** (GCS)        | **5 anos** (Nearline 30d → Coldline 1y → Archive 4y) | Diário, 03:00 BRT | Incidente antigo, catástrofe, auditoria, RDC 786          |

Bucket `gs://hmatologia2-firestore-backups` tem **retention policy de 1825 dias** — exclusão de objetos rejeitada mesmo por Owner do projeto até cumprir o prazo. Verificação semanal via `scheduledVerifyBackupIntegrity` (segundas 04:00 BRT) que escreve em `firestore-backup-alerts` se algum backup faltar ou falhar.

PITR é **sempre** a primeira escolha se o incidente for das últimas 168h (7 dias). O export é fallback para incidentes mais antigos ou para reconstrução total em outro projeto.

---

## Cenário 1 — Rollback via PITR (janela ≤ 7 dias)

**Caso típico:** admin deletou lote errado às 14h32. São 14h40 agora. Queremos voltar pro estado 14h30.

### 1.1 — Identificar o ponto-no-tempo

Use o RFC 3339 alinhado a **minuto exato** (Firestore rejeita sub-minuto).

```bash
# Exemplo: 2026-04-20 14:30:00 BRT = 17:30:00 UTC
SNAPSHOT="2026-04-20T17:30:00Z"
```

### 1.2 — Export com PITR (pra bucket separado)

**Não sobrescreva o banco em uso.** Export pra bucket de recovery primeiro, inspeciona, aí decide.

```bash
gcloud firestore export \
  gs://hmatologia2-firestore-backups/recovery/$(date -u +%Y%m%dT%H%M%SZ) \
  --database='(default)' \
  --project=hmatologia2 \
  --snapshot-time="$SNAPSHOT"
```

O comando retorna um `operation name`. Acompanhe:

```bash
gcloud firestore operations list --database='(default)' --project=hmatologia2 \
  --format='table(name.basename(),metadata.state,metadata.operationType,metadata.progressDocuments.completedWork,metadata.progressDocuments.estimatedWork)'
```

Espere `STATE = SUCCESSFUL`. Em banco pequeno (<100MB), leva 2-10min.

### 1.3 — Opção A: Restore parcial (recomendado)

Importe apenas as coleções afetadas para **um projeto de staging** pra validar, aí reimporte pro projeto de produção:

```bash
# Para cada collectionId específico
gcloud firestore import \
  gs://hmatologia2-firestore-backups/recovery/<pasta-criada-acima> \
  --collection-ids='labs,users' \
  --database='(default)' \
  --project=hmatologia2-staging   # ou outro projeto sandbox
```

Valida os dados no staging. Se OK, reimporte pro produção — ver Cenário 2.

### 1.4 — Opção B: Restore total inline (apenas se não houver alternativa)

**Risco:** import preserva IDs, mas **faz MERGE** — escritas posteriores ao snapshot NÃO são desfeitas. Se desde o incidente houve dados legítimos novos, eles convivem com o snapshot (pode gerar inconsistências).

```bash
gcloud firestore import \
  gs://hmatologia2-firestore-backups/recovery/<pasta> \
  --database='(default)' \
  --project=hmatologia2
```

---

## Cenário 2 — Restore de export diário (incidente antigo, >7 dias)

**Caso típico:** bug lento corrompeu dados há 20 dias. PITR não cobre. Usamos o snapshot diário.

### 2.1 — Localizar o snapshot desejado

```bash
gcloud storage ls gs://hmatologia2-firestore-backups/daily/
# Saída: daily/2026-04-19/, daily/2026-04-20/, ...
```

Pick the last known good date (ex: `2026-04-01`):

```bash
SNAPSHOT_PATH="gs://hmatologia2-firestore-backups/daily/2026-04-01"
gcloud storage ls -r "$SNAPSHOT_PATH" | head -20
# Deve listar <date>.overall_export_metadata e all_namespaces/all_kinds/output-N
```

### 2.2 — Import (collection-filtered)

```bash
gcloud firestore import "$SNAPSHOT_PATH" \
  --collection-ids='labs,users,accessRequests' \
  --database='(default)' \
  --project=hmatologia2
```

**IMPORTANTE:** omita `--collection-ids` apenas se quiser restaurar **tudo**. Em produção quase nunca é o caso — restaure só o mínimo necessário pra não sobrescrever dados legítimos criados após o snapshot.

### 2.3 — Import pra projeto sandbox (recomendado antes de prod)

```bash
# Crie ou use um projeto de sandbox
gcloud firestore import "$SNAPSHOT_PATH" \
  --database='(default)' \
  --project=hmatologia2-sandbox
```

Valide via console/queries. Aí refaça pro projeto real.

---

## Cenário 3 — Projeto completamente perdido (DR)

**Caso extremo:** conta GCP comprometida, projeto deletado, ransomware.

### 3.1 — Provisionar novo projeto

```bash
NEW_PROJECT="hmatologia2-dr"
gcloud projects create $NEW_PROJECT
gcloud alpha billing projects link $NEW_PROJECT --billing-account=<BILLING_ACCOUNT>
gcloud services enable firestore.googleapis.com firebase.googleapis.com \
  cloudfunctions.googleapis.com storage.googleapis.com \
  --project=$NEW_PROJECT
```

### 3.2 — Criar database Firestore na mesma região

```bash
gcloud firestore databases create \
  --location=southamerica-east1 \
  --type=firestore-native \
  --project=$NEW_PROJECT
```

### 3.3 — Copiar bucket de backups pra novo projeto

O bucket `hmatologia2-firestore-backups` está com **retention policy de 5 anos** (UNLOCKED — pode ser aumentada mas não diminuída sem intervenção). Para LOCK irreversível (proteção máxima contra ransomware/conta comprometida), executar `gsutil retention lock gs://hmatologia2-firestore-backups` — após o lock o bucket não pode mais ser deletado nem ter retention reduzida pelos próximos 1825 dias.

**Roadmap:** replicação periódica pra bucket em conta Google separada (defense in depth contra account takeover).

### 3.4 — Import pros new project

```bash
gcloud firestore import gs://<bucket-com-acesso>/daily/<data> \
  --database='(default)' \
  --project=$NEW_PROJECT
```

---

## Verificação periódica (recomendado)

Faça **teste de restore trimestral** pra garantir que o pipeline realmente funciona. Um backup não testado não é backup.

### Checklist trimestral

- [ ] Pegar o snapshot mais recente no bucket
- [ ] Import pra projeto sandbox (`hmatologia2-sandbox`)
- [ ] Abrir Firestore Console do sandbox, verificar contagem de documentos em `labs/`, `users/`, `labs/*/lots/`
- [ ] Query de amostra: últimas 5 corridas em `labs/labclin-riopomba/lots/*/runs/` batem com produção?
- [ ] Deletar dados do sandbox

Registre o resultado em `docs/runbooks/restore-drill-log.md` (criar se não existir).

---

## Monitoramento

Logs de export diário ficam em:

```bash
firebase functions:log --only scheduledFirestoreExport --project hmatologia2
```

Registro auditável no Firestore: coleção `firestore-backup-logs` (SuperAdmin-only).

**Alerta desejado (Fase 2):** se a function falhar 2 dias consecutivos, disparar alert via Cloud Monitoring → PagerDuty / email.

---

## Custos estimados

| Item                                    | Estimativa mensal (banco <1GB)            |
| --------------------------------------- | ----------------------------------------- |
| PITR (7 dias retenção)                  | ~$0.10/GB/mês → **~$0.10**                |
| Export Nearline (0-30d)                 | ~$0.026/GB/mês → **~$0.03**               |
| Coldline (30-365d)                      | ~$0.007/GB/mês × ~11 cópias → **~$0.08**  |
| Archive (365-1825d)                     | ~$0.0025/GB/mês × ~48 cópias → **~$0.12** |
| Operações de import (apenas em restore) | $0.18/GB importado — pago só quando usar  |
| **Total**                               | **~$0.35/mês**                            |

Escala linear com o tamanho do banco. Custo irrelevante comparado ao risco mitigado.

---

## Referências

- [Firestore PITR](https://cloud.google.com/firestore/docs/use-pitr)
- [Firestore Export/Import](https://cloud.google.com/firestore/docs/manage-data/export-import)
- [Firestore Admin REST API](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases/exportDocuments)
