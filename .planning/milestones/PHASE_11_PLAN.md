# Phase 11 — PQ-24 Compliance Remediation

> **Modo**: Execução autônoma multi-agente (Haiku 4.5)
> **Padrão**: Orchestrator-Workers (Anthropic — Building Effective Agents)
> **Janela**: One-shot, sem intervenção humana até verificação final
> **Driver**: Gap analysis HC_Quality_vs_PQ24_FR42_Gap_Analysis.md (4 GAPs CRÍTICOS + 5 MEDIUM)

---

## 1. Meta + Critérios de Sucesso (verificáveis)

**Goal**: Levar módulo `auditoria-interna` de **55% → 90%+ cobertura PQ-24** endereçando 4 GAPs críticos + 3 MEDIUM em uma única passagem autônoma.

**Success Criteria (binários, não-ambíguos)**:

| #     | Critério                                                 | Verificação programática                                                                             |
| ----- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| SC-1  | `createPlanoAcao` callable não é mais TODO               | `grep -L "TODO" functions/src/modules/auditoria/auditoria.ts` retorna 0 matches em `createPlanoAcao` |
| SC-2  | Schema `Presenca` (FR-045) existe + persiste             | `grep -l "interface Presenca" src/features/sgq/auditoria/types.ts` retorna 1                         |
| SC-3  | `Auditoria.tipoExecucao` + `auditoriaOriginalId` existem | TSC valida; novo callable `createReAuditoria` deployado                                              |
| SC-4  | FR-043 mapping documentado em `generatePDF.ts`           | Comentários inline com cada uma das 4 tabelas oficiais                                               |
| SC-5  | `Sessao.auditorLider` + `auditoresAuxiliares[]` existem  | TSC valida                                                                                           |
| SC-6  | `npx tsc --noEmit` passa em `web/` e `functions/`        | Exit code 0                                                                                          |
| SC-7  | Todos os testes unit + E2E novos passam                  | Jest + Playwright exit 0                                                                             |
| SC-8  | Firestore rules cobrem novos paths com `validSignature`  | `firebase emulators:exec --only firestore "npm test"` exit 0                                         |
| SC-9  | ADR-0035 + ADR-0036 commitados em `docs/adr/`            | Files exist                                                                                          |
| SC-10 | CLAUDE.md raiz atualizado com linha de Phase 11          | `grep -q "Phase 11" CLAUDE.md`                                                                       |

**Quality bar**: Se qualquer SC-N falha, a wave falha e nenhuma wave subsequente inicia. Sem retry loops.

---

## 2. Arquitetura de Execução

### 2.1 Padrão: Orchestrator-Workers + Validation Gates

```
                    ┌───────────────────────────┐
                    │  Orchestrator (Sonnet 4.6) │
                    │  Lê este plano + dispatch  │
                    └─────────────┬─────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
   ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
   │ Wave 1  │──Gate-1─────▶│ Wave 2  │──Gate-2─────▶│ Wave 3  │
   │ (4 //)  │              │ (4 //)  │              │ (3 //)  │
   └─────────┘              └─────────┘              └─────────┘
                                                          │
                                                     Gate-3
                                                          │
                                                     ┌────▼────┐
                                                     │ Wave 4  │
                                                     │ (2 //)  │
                                                     └────┬────┘
                                                       Gate-4
                                                          │
                                                     ┌────▼────┐
                                                     │ Wave 5  │
                                                     │ (2 seq) │
                                                     └─────────┘
```

### 2.2 Princípios Anthropic aplicados

- **Self-contained prompts**: cada agente recebe TUDO que precisa (caminhos absolutos, comandos exatos, schemas completos). Não depende de chat history.
- **Verifiable outputs**: cada agente entrega artifact (file path) que orchestrator valida via `Read` ou `grep`.
- **Atomic commits**: cada agente faz `git commit` próprio. Wave falha → revert via `git reset --hard <pre-wave-sha>`.
- **No human-in-the-loop**: gates são puramente programáticos (`tsc`, `jest`, `firebase emulators:exec`). Falha → para.
- **Haiku-first**: prompts são imperativos, não exploratórios. Decisões já tomadas neste plano.
- **Parallel where independent**: ondas internas paralelizam onde não há shared file writes.

### 2.3 Modelo por agente

| Wave | Agentes | Modelo     | Paralelo?     | Justificativa                               |
| ---- | ------- | ---------- | ------------- | ------------------------------------------- |
| 1    | A1–A4   | Haiku 4.5  | ✅ Sim        | Files distintos, 0 race conditions          |
| 2    | B1–B4   | Haiku 4.5  | ✅ Sim        | Cada um edita callable distinto             |
| 3    | C1–C3   | Haiku 4.5  | ✅ Sim        | Components distintos                        |
| 4    | D1–D2   | Haiku 4.5  | ✅ Sim        | Tests independentes                         |
| 5    | E1–E2   | Sonnet 4.6 | ❌ Sequencial | Deploy + docs requer judgment + ack do user |

**E1 (deploy)** sobe para Sonnet por safety: deploy é hard-to-reverse e CLAUDE.md exige ack explícito. Apenas E1 e E2 quebram a regra "no human-in-the-loop" — se preferir 100% autônomo, marcar `--auto-deploy` (default: human ack).

---

## 3. Pre-flight Checks (executar UMA vez antes da Wave 1)

```bash
# 3.1 Estado git limpo
cd "C:/hc quality"
git status --porcelain && [ $? -eq 0 ] || exit 1
PRE_PHASE_SHA=$(git rev-parse HEAD)
echo "$PRE_PHASE_SHA" > .planning/milestones/PHASE_11_PRE_SHA.txt

# 3.2 TSC limpo (web + functions)
npx tsc --noEmit && cd functions && npx tsc --noEmit && cd ..
[ $? -eq 0 ] || { echo "TSC sujo — abortar"; exit 1; }

# 3.3 Branch feature
git checkout -b feature/phase-11-pq24-compliance

# 3.4 Secrets check (regra de deploy do projeto)
bash scripts/preflight-secrets-check.sh
[ $? -eq 0 ] || { echo "Secrets PENDING — resolver antes"; exit 1; }

# 3.5 Backup do estado
git tag phase-11-baseline
```

**Se qualquer check falha**: Phase 11 não inicia. Output: motivo + comando de fix.

---

## 4. WAVE 1 — Schemas & Foundation (paralelo, ~30 min)

**Goal da Wave**: Estender types, rules e indexes para suportar os novos schemas. Zero código de execução ainda.

### Agent A1 — Estender types `Auditoria` + `Sessao` + criar `Presenca` + `ReAuditoria`

```yaml
subagent_type: general-purpose
model: haiku
description: Extend audit types schema
```

**Prompt** (auto-contained):

````
Você está editando o arquivo C:/hc quality/src/features/sgq/auditoria/types.ts no projeto HC Quality (Sistema CQ Labclin multi-tenant).

CONTEXTO:
- Stack: React 19 + TS 5.8 + Firebase 12. Firestore Timestamp from 'firebase-admin/firestore'.
- Padrões obrigatórios: LogicalSignature em mutations regulatórias, soft-delete (deletadoEm: Timestamp | null), labId redundante no payload.
- NÃO toque outros arquivos. NÃO edite implementações. APENAS types.

TAREFA: adicione/estenda os seguintes types em types.ts (no final do arquivo, mantendo os existentes intactos):

1. Estenda `Sessao` adicionando campos opcionais:
   ```ts
   auditorLider?: string;        // operatorId do auditor líder (FR42)
   auditoresAuxiliares?: string[]; // operatorIds adicionais
````

2. Estenda `Auditoria` adicionando campos opcionais:

   ```ts
   tipoExecucao?: 'inicial' | 'reAuditoria';
   auditoriaOriginalId?: string;  // FK quando tipoExecucao === 'reAuditoria'
   escopoSetores?: string[];      // ['Bioquímica', 'Imuno', ...] - FR42
   escopoEspecialidades?: string[];
   aprovacoes?: LogicalSignature[]; // múltiplas: Direção + QC
   ```

3. Crie novo type `Presenca` (FR-045):

   ```ts
   export type PapelPresenca =
     | 'auditor'
     | 'auditado'
     | 'observador'
     | 'rt'
     | 'gerente_qc'
     | 'direcao';

   export interface Presenca {
     readonly id: string;
     readonly sessaoId: string;
     readonly labId: string;
     readonly auditoriaId: string;
     userId: string; // operatorId
     nome: string; // snapshot at time of signing
     papel: PapelPresenca;
     reuniao: 'abertura' | 'encerramento';
     assinatura: LogicalSignature;
     readonly criadoEm: Timestamp;
     readonly criadoPor: string;
     deletadoEm: Timestamp | null;
   }

   export type PresencaInput = Omit<
     Presenca,
     'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm' | 'assinatura'
   >;
   ```

4. Crie novo type `ReuniaoAuditoria`:

   ```ts
   export interface ReuniaoAuditoria {
     readonly id: string;
     readonly sessaoId: string;
     readonly labId: string;
     readonly auditoriaId: string;
     tipo: 'abertura' | 'encerramento';
     dataHora: Timestamp;
     pauta: string; // min 10 chars
     concluidaEm: Timestamp | null;
     totalPresentes: number;
     readonly criadoEm: Timestamp;
     readonly criadoPor: string;
     deletadoEm: Timestamp | null;
   }
   ```

5. Estenda `PlanoAcao` adicionando:
   ```ts
   readonly id: string;        // tornar required (era ausente)
   readonly labId: string;     // multi-tenant
   evidenciaUrl?: string;      // link para evidência de execução
   assinatura?: LogicalSignature; // assinatura ao concluir
   deletadoEm: Timestamp | null;
   ```

ACEITAÇÃO:

- `npx tsc --noEmit` na raiz `C:/hc quality` passa (exit 0)
- Arquivo final tem todos os 5 itens acima
- Não removeu nenhum type/interface existente

ENTREGÁVEL:

1. Edite o arquivo
2. Faça `git add src/features/sgq/auditoria/types.ts && git commit -m "feat(phase-11/A1): extend audit types — Presenca + ReAuditoria + PlanoAcao + multi-auditor"`
3. Retorne: SHA do commit + lista dos 5 itens adicionados.

FALHA: se TSC falhar, NÃO commit. Reporte o erro de TSC textualmente e pare.

````

---

### Agent A2 — Atualizar Firestore Rules

```yaml
subagent_type: general-purpose
model: haiku
description: Update firestore rules
````

**Prompt**:

```
Você está editando C:/hc quality/firestore.rules no projeto HC Quality.

CONTEXTO:
- Helpers já existentes no arquivo: isActiveMemberOfLab(labId), validSignature(d), labIdMatches(d).
- Padrão: regulatórias têm `allow create: if false` (escrita só via Cloud Function callable). Reads liberados pra membros do lab.
- Multi-tenant path: /labs/{labId}/<coleção>/{docId}.

TAREFA: Adicione blocos de rules para 3 novas subcoleções da auditoria. Insira ANTES da closing brace `}` da regra match `/databases/{database}/documents`:

1. Presença (FR-045):
```

match /labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/presenca/{presencaId} {
allow read: if isActiveMemberOfLab(labId);
allow create: if false; // callable only
allow update: if false;
allow delete: if false;
}

```

2. Reuniões:
```

match /labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/reunioes/{reuniaoId} {
allow read: if isActiveMemberOfLab(labId);
allow create: if false;
allow update: if false;
allow delete: if false;
}

```

3. Planos de Ação (estender se já existir; criar se não):
```

match /labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao/{planoId} {
allow read: if isActiveMemberOfLab(labId);
allow create: if false;
allow update: if isActiveMemberOfLab(labId)
&& request.resource.data.labId == labId
&& request.resource.data.diff(resource.data).affectedKeys()
.hasOnly(['status', 'evidenciaUrl', 'assinatura', 'concluídoEm']);
allow delete: if false;
}

```

ACEITAÇÃO:
- Arquivo `firestore.rules` válido (sem erros de sintaxe)
- Rule emulator pode parsear (se houver suite de testes, rodar)
- Linhas adicionadas no escopo `match /databases/{database}/documents`

ENTREGÁVEL:
1. Edite o arquivo
2. Validate: `firebase firestore:rules:lint firestore.rules` (se disponível) OR confira manualmente sintaxe
3. Commit: `git add firestore.rules && git commit -m "feat(phase-11/A2): firestore rules for FR-045 + reunioes + planos-acao"`
4. Retorne: SHA + linhas adicionadas (count)

FALHA: parse error → NÃO commit, reporte stderr exato.
```

---

### Agent A3 — Atualizar Firestore Indexes

```yaml
subagent_type: general-purpose
model: haiku
description: Update firestore indexes
```

**Prompt**:

```
Você está editando C:/hc quality/firestore.indexes.json no projeto HC Quality.

TAREFA: Adicione 4 índices compostos no array `indexes`:

1. Presença por sessão (queries: list por sessão):
```

{
"collectionGroup": "presenca",
"queryScope": "COLLECTION",
"fields": [
{ "fieldPath": "sessaoId", "order": "ASCENDING" },
{ "fieldPath": "criadoEm", "order": "DESCENDING" }
]
}

```

2. Reuniões por auditoria + tipo:
```

{
"collectionGroup": "reunioes",
"queryScope": "COLLECTION",
"fields": [
{ "fieldPath": "auditoriaId", "order": "ASCENDING" },
{ "fieldPath": "tipo", "order": "ASCENDING" },
{ "fieldPath": "dataHora", "order": "DESCENDING" }
]
}

```

3. Planos de ação por status + prazo:
```

{
"collectionGroup": "planos-acao",
"queryScope": "COLLECTION",
"fields": [
{ "fieldPath": "status", "order": "ASCENDING" },
{ "fieldPath": "prazo", "order": "ASCENDING" }
]
}

```

4. Auditorias por tipoExecucao + ano:
```

{
"collectionGroup": "auditorias-internas",
"queryScope": "COLLECTION",
"fields": [
{ "fieldPath": "tipoExecucao", "order": "ASCENDING" },
{ "fieldPath": "ano", "order": "DESCENDING" }
]
}

```

ACEITAÇÃO:
- JSON válido (`node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json'))"` passa)
- 4 novos índices presentes
- Não removeu índices existentes

ENTREGÁVEL: Edit + commit "feat(phase-11/A3): firestore indexes for new audit subcollections" + SHA.
```

---

### Agent A4 — Criar Seed Template FR-045

```yaml
subagent_type: general-purpose
model: haiku
description: Create FR-045 seed template
```

**Prompt**:

````
Você está criando um novo arquivo: C:/hc quality/functions/src/seeds/presencaTemplate.json

TAREFA: Crie um JSON com o template padrão de papéis esperados em uma auditoria, conforme PQ-24 §6.3 e FR-045.

Conteúdo (copiar exato):
```json
{
  "version": "1.0",
  "updatedAt": "2026-05-09",
  "papeis_obrigatorios_abertura": [
    {
      "papel": "auditor",
      "descricao": "Auditor Líder responsável pela condução",
      "obrigatorio": true,
      "minimo": 1
    },
    {
      "papel": "rt",
      "descricao": "Responsável Técnico do laboratório",
      "obrigatorio": true,
      "minimo": 1
    },
    {
      "papel": "gerente_qc",
      "descricao": "Gerente da Qualidade",
      "obrigatorio": true,
      "minimo": 1
    },
    {
      "papel": "auditado",
      "descricao": "Representante do(s) setor(es) auditado(s)",
      "obrigatorio": true,
      "minimo": 1
    }
  ],
  "papeis_obrigatorios_encerramento": [
    {
      "papel": "auditor",
      "obrigatorio": true,
      "minimo": 1
    },
    {
      "papel": "rt",
      "obrigatorio": true,
      "minimo": 1
    },
    {
      "papel": "gerente_qc",
      "obrigatorio": true,
      "minimo": 1
    }
  ],
  "papeis_opcionais": [
    {
      "papel": "observador",
      "descricao": "Observadores externos ou estagiários",
      "obrigatorio": false
    },
    {
      "papel": "direcao",
      "descricao": "Direção do Laboratório",
      "obrigatorio": false
    }
  ]
}
````

ACEITAÇÃO: arquivo criado, JSON válido.

ENTREGÁVEL: criar + `git add functions/src/seeds/presencaTemplate.json && git commit -m "feat(phase-11/A4): seed template for FR-045 presença papéis"` + SHA.

````

---

### **Validation Gate 1** (programático, sem human-ack)

```bash
# Ordem: A1 → A2 → A3 → A4 commits presentes
git log --oneline | head -4 | grep -c "phase-11/A[1-4]" | grep -q "^4$" || { echo "GATE-1 FAIL: faltam commits A1-A4"; exit 1; }

# TSC limpo
npx tsc --noEmit || { echo "GATE-1 FAIL: TSC web"; exit 1; }
cd functions && npx tsc --noEmit && cd .. || { echo "GATE-1 FAIL: TSC functions"; exit 1; }

# JSON válido
node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json'))" || { echo "GATE-1 FAIL: indexes JSON"; exit 1; }
node -e "JSON.parse(require('fs').readFileSync('functions/src/seeds/presencaTemplate.json'))" || { echo "GATE-1 FAIL: presença JSON"; exit 1; }

echo "GATE-1 PASS"
````

**Falha**: `git reset --hard phase-11-baseline && exit 1`. Phase 11 abortada.

---

## 5. WAVE 2 — Backend Callables (paralelo, ~1h)

**Goal**: Implementar 4 callables Cloud Functions. Cada agente toca arquivo distinto.

### Agent B1 — Implementar `createPlanoAcao` (substituir TODO)

```yaml
subagent_type: general-purpose
model: haiku
description: Implement createPlanoAcao callable
```

**Prompt**:

````
Você está editando C:/hc quality/functions/src/modules/auditoria/auditoria.ts.

CONTEXTO:
- Linhas 510–542 contêm `createPlanoAcao` com `// TODO: Implement plano de ação creation`
- O arquivo já tem padrões: import zod, helper isActiveMemberOfLab(labId, uid), Firestore admin, LogicalSignature canonical JSON.
- Path: labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao/{planoId}
- Schema PlanoAcao em src/features/sgq/auditoria/types.ts (já estendido pela Wave 1).

TAREFA: substitua o corpo do `createPlanoAcao` callable (preserve a function signature `export const createPlanoAcao = onCall(...)`) com implementação real.

INPUT esperado (extrair com Zod):
```ts
const CreatePlanoAcaoInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  achadoId: z.string().min(1),
  descricao: z.string().min(20).max(500),
  responsavel: z.string().min(1),
  prazo: z.string().refine((s) => !isNaN(Date.parse(s)), 'prazo inválido (ISO 8601)'),
});
````

LÓGICA:

1. Validar auth (HttpsError 'unauthenticated' se !request.auth).
2. Parse input com zod, throw 'invalid-argument' em fail.
3. isActiveMemberOfLab(labId, uid) — 'permission-denied' se false.
4. Validar que `achadoId` existe e pertence ao `auditoriaId` informado:
   - Query: collectionGroup('achados').where('id', '==', achadoId).where('labId', '==', labId).limit(1)
   - Se vazio: 'not-found' achado.
5. Gerar LogicalSignature (canonical JSON, SHA-256) com chaves ordenadas: achadoId, auditoriaId, descricao, prazo, responsavel.
6. Criar doc em labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao com:
   - id (auto-gen), labId, auditoriaId, achadoId, descricao, responsavel, prazo: Timestamp.fromDate(new Date(input.prazo)), status: 'nao_iniciado', assinatura, criadoEm: now, criadoPor: uid, deletadoEm: null
7. Em transaction, atualizar achado correspondente com `planoAcaoId: planoRef.id`.
8. Retornar `{ success: true, planoId: planoRef.id, status: 'nao_iniciado' }`.

ACEITAÇÃO:

- TSC functions limpo
- Sem strings "TODO" no método
- Mantém pattern dos outros callables (estilo `registerAchado`)

ENTREGÁVEL: edit + commit "feat(phase-11/B1): implement createPlanoAcao real (replaces TODO stub)" + SHA.

FALHA: TSC error → NÃO commit, reporte stderr.

````

---

### Agent B2 — Criar `registerPresenca` callable

```yaml
subagent_type: general-purpose
model: haiku
description: Create registerPresenca callable
````

**Prompt**:

````
Você está editando C:/hc quality/functions/src/modules/auditoria/auditoria.ts.

CONTEXTO: arquivo já tem N callables (createAuditoria, registerAchado, etc). Adicione 1 callable novo no final do arquivo (antes de qualquer linha que pareça `// END OF FILE` se houver, OU no final mesmo).

TAREFA: implementar `registerPresenca` que persiste assinatura digital de participantes em reunião de auditoria (FR-045).

INPUT (Zod):
```ts
const RegisterPresencaInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  sessaoId: z.string().min(1),
  reuniao: z.enum(['abertura', 'encerramento']),
  participantes: z.array(z.object({
    userId: z.string().min(1),
    nome: z.string().min(2).max(120),
    papel: z.enum(['auditor', 'auditado', 'observador', 'rt', 'gerente_qc', 'direcao']),
  })).min(1).max(50),
});
````

LÓGICA:

1. Auth check + member check (igual outros callables).
2. Para cada participante, gerar LogicalSignature (canonical: auditoriaId, sessaoId, reuniao, userId, papel).
3. Em batch (`db.batch()`), criar 1 doc por participante em:
   labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/presenca/{auto}
4. Atualizar contador na reunião (ver B3 — pode não existir ainda; se a reunião do tipo informado não existe, criar com `pauta: 'Auto-criada via registerPresenca'`, `dataHora: now`).
5. Retornar `{ success: true, totalRegistrados: N, reuniaoId }`.

ACEITAÇÃO: TSC limpo, padrão consistente com createAuditoria.

ENTREGÁVEL: edit + commit "feat(phase-11/B2): registerPresenca callable (FR-045)" + SHA.

````

---

### Agent B3 — Criar `createReAuditoria` callable

```yaml
subagent_type: general-purpose
model: haiku
description: Create reAuditoria callable
````

**Prompt**:

````
Você está editando C:/hc quality/functions/src/modules/auditoria/auditoria.ts.

TAREFA: adicionar callable `createReAuditoria` que cria nova auditoria do tipo `reAuditoria` linkada a uma original (PQ-24 §6.6 — verificação de eficácia).

INPUT (Zod):
```ts
const CreateReAuditoriaInput = z.object({
  labId: z.string().min(1),
  auditoriaOriginalId: z.string().min(1),
  proximaAuditoriaPlanejada: z.string().refine((s) => !isNaN(Date.parse(s))),
  responsavelTecnico: z.string().min(1),
  motivacao: z.string().min(20).max(500), // por que está reauditando
});
````

LÓGICA:

1. Auth + member.
2. Buscar auditoriaOriginal: `labs/{labId}/auditorias-internas/{auditoriaOriginalId}`. Se !exists OR deletadoEm: throw 'not-found'.
3. Validar que original tem status 'finalizada' (não pode reauditar uma em execução): se não, 'failed-precondition'.
4. Validar que pelo menos 1 NC da auditoria original tem status 'fechada' (re-auditoria valida fechamento): query collectionGroup('naoConformidades').where('auditoriaId','==', original.id).where('status','==','fechada'). Se 0: 'failed-precondition' "Sem NCs fechadas para validar".
5. Criar nova auditoria com:
   - tipoExecucao: 'reAuditoria'
   - auditoriaOriginalId: original.id
   - ano: new Date().getFullYear()
   - frequencia: original.frequencia
   - status: 'planejada'
   - escopoSetores: original.escopoSetores ?? []
   - responsavelTecnico, proximaAuditoriaPlanejada
6. Retornar `{ success: true, reAuditoriaId, auditoriaOriginalId }`.

ACEITAÇÃO: TSC limpo, lógica de pré-condições explícita.

ENTREGÁVEL: edit + commit "feat(phase-11/B3): createReAuditoria callable (PQ-24 §6.6)" + SHA.

````

---

### Agent B4 — Atualizar `generatePDF` com mapping FR-043

```yaml
subagent_type: general-purpose
model: haiku
description: Map FR-043 4 tables to PDF
````

**Prompt**:

````
Você está editando C:/hc quality/functions/src/modules/auditoria/generatePDF.ts.

CONTEXTO: documento oficial FR-043 (Relatório de Auditoria) extraído tem 4 tabelas estruturadas. Mapping necessário entre dados HC Quality e essas 4 tabelas.

TAREFA: adicione no topo do arquivo um bloco de comentário documentando o mapping E refatore (apenas se necessário) a função geradora pra populá-las.

DOCUMENTAÇÃO obrigatória inline (no início do arquivo, após imports):

```ts
/**
 * FR-043 (Relatório de Auditoria Interna) — Mapping HC Quality → 4 tabelas oficiais
 *
 * TABELA 1 — Identificação:
 *   Campos: data, auditor_lider, auditor(es), setores_auditados
 *   Source: Auditoria.criadoEm, Sessao.auditorLider, Sessao.auditoresAuxiliares,
 *           Auditoria.escopoSetores
 *
 * TABELA 2 — Sumário Conformidades:
 *   Campos: total_itens, conformes, não_conformes, na, %_conformidade
 *   Source: Sessao.totalItens, itensConforme, itensNãoConforme, itensNA
 *
 * TABELA 3 — Achados (1 linha por achado, severidade ≥ leve):
 *   Campos: descricao, severidade, evidencia, ncId (se criada)
 *   Source: Achado collection (subcollection da Sessao)
 *
 * TABELA 4 — Plano de Ação (1 linha por achado com plano):
 *   Campos: achado_descricao, acao, responsavel, prazo, status
 *   Source: PlanoAcao collection (labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao)
 *
 * Última revisão: 2026-05-09 (Phase 11)
 */
````

E garantir que o gerador real popula as 4 tabelas (se não popular alguma, criar TODO com numeração explícita).

ACEITAÇÃO:

- Comment block presente
- Se a função geradora já popula as 4 tabelas: OK
- Se falta alguma, marcar `// FR-043-T<n>: populate from <source>` e logar console.warn.

ENTREGÁVEL: edit + commit "feat(phase-11/B4): document FR-043 4-table mapping in generatePDF" + SHA.

````

---

### Validation Gate 2

```bash
# Commits B1-B4 presentes
git log --oneline | head -8 | grep -c "phase-11/B[1-4]" | grep -q "^4$" || { echo "GATE-2 FAIL"; exit 1; }

# TSC functions
cd functions && npx tsc --noEmit && cd .. || { echo "GATE-2 FAIL: TSC functions"; exit 1; }

# Não pode mais existir TODO em createPlanoAcao
grep -A 30 "createPlanoAcao = onCall" functions/src/modules/auditoria/auditoria.ts | grep -q "TODO" && { echo "GATE-2 FAIL: createPlanoAcao still has TODO"; exit 1; }

# Novos callables presentes
grep -q "registerPresenca = onCall" functions/src/modules/auditoria/auditoria.ts || { echo "GATE-2 FAIL: registerPresenca missing"; exit 1; }
grep -q "createReAuditoria = onCall" functions/src/modules/auditoria/auditoria.ts || { echo "GATE-2 FAIL: createReAuditoria missing"; exit 1; }

# FR-043 mapping doc presente
grep -q "FR-043.*4 tabelas oficiais" functions/src/modules/auditoria/generatePDF.ts || { echo "GATE-2 FAIL: FR-043 mapping doc missing"; exit 1; }

echo "GATE-2 PASS"
````

**Falha**: `git reset --hard phase-11-baseline`. Abortar.

---

## 6. WAVE 3 — Frontend Components (paralelo, ~1h)

**Goal**: 3 componentes React + hooks, cada um isolado.

### Agent C1 — `PlanoAcaoForm` + `PlanoAcaoList`

```yaml
subagent_type: general-purpose
model: haiku
description: Build PlanoAcao UI components
```

**Prompt**:

```
Você está criando 2 arquivos novos:
- C:/hc quality/src/features/auditoria-interna/components/PlanoAcaoForm.tsx
- C:/hc quality/src/features/auditoria-interna/components/PlanoAcaoList.tsx

CONTEXTO:
- Stack: React 19 + TS 5.8 + Tailwind dark-first.
- Design tokens: bg-[#141417], texto white/X, accent violet-500/emerald-500.
- Padrões existentes: AuditoriasList.tsx, AchadoForm.tsx no mesmo diretório (use como referência de estilo).
- Callable já existe: createPlanoAcao em functions, callable client em src/features/sgq/auditoria/auditoriaService.ts (signature: createPlanoAcao(labId, auditoriaId, achadoId, descricao, responsavel, prazo)).

TAREFA C1.1 — PlanoAcaoForm.tsx:
Component receives `{ achadoId, auditoriaId, onSuccess?: (planoId: string) => void }`.
- Form com 3 campos: descrição (textarea, min 20, max 500), responsável (select de operadores OR text), prazo (date picker).
- Submit chama callable, mostra loading, error inline.
- Estilo: card dark `bg-[#141417]` border `border-white/8`, padding `p-6`, typography editorial.
- Botão primary: `bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg`.

TAREFA C1.2 — PlanoAcaoList.tsx:
Component receives `{ auditoriaId, labId }`.
- Hook: subscribe a `labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao` com onSnapshot (filter deletadoEm == null).
- Render tabela densa: descrição (truncate 80 chars), responsável, prazo (formato relative + absolute), status (badge colorida por status).
- Linhas de status:
  - nao_iniciado: text-white/60 + bg-white/4
  - em_execucao: text-violet-400 + bg-violet-500/12
  - fechado: text-emerald-400 + bg-emerald-500/12
  - vencido: text-rose-400 + bg-rose-500/12 (calcular client: prazo < now AND status !== 'fechado')

ACEITAÇÃO:
- TSC web limpo
- Componentes compilam (pode ter mock se hook não tiver tipo certo, mas type signature correta)
- Sem any explícito
- Sem libs de ícones (usar SVG inline com currentColor)

ENTREGÁVEL:
1. Crie os 2 arquivos
2. Commit: "feat(phase-11/C1): PlanoAcaoForm + PlanoAcaoList components" + SHA
```

---

### Agent C2 — `PresencaPanel`

```yaml
subagent_type: general-purpose
model: haiku
description: Build PresencaPanel
```

**Prompt**:

````
Crie C:/hc quality/src/features/auditoria-interna/components/PresencaPanel.tsx.

CONTEXTO: idêntico a C1 (mesmo diretório, mesmos padrões dark-first, mesmo estilo).

TAREFA: Component `PresencaPanel` que captura assinatura digital de presentes em reunião.

Props:
```ts
interface PresencaPanelProps {
  auditoriaId: string;
  sessaoId: string;
  reuniao: 'abertura' | 'encerramento';
  onSuccess?: (totalRegistrados: number) => void;
}
````

Layout:

- Header: "Lista de Presença — {Reunião de Abertura | Encerramento}" com data/hora.
- Lista dinâmica de participantes (add/remove rows).
- Cada row: nome (text), papel (select com 6 opções: auditor, auditado, observador, rt, gerente_qc, direcao).
- Validação client: mínimo 1 auditor + 1 RT + 1 gerente_qc + 1 auditado (ler papeis_obrigatorios_abertura/encerramento de functions/src/seeds/presencaTemplate.json — pode hardcoded como const local pois é seed estável).
- Botão "Confirmar e assinar": chama callable registerPresenca via httpsCallable.
- Estilo: card dark, typography editorial, espaçamento grid 4px.

Pseudo-código:

```tsx
const callable = httpsCallable(functions, 'registerPresenca');
const result = await callable({ labId, auditoriaId, sessaoId, reuniao, participantes });
```

ACEITAÇÃO: TSC limpo, validação client funcional, mensagens de erro inline.

ENTREGÁVEL: 1 arquivo + commit "feat(phase-11/C2): PresencaPanel (FR-045 capture)" + SHA.

````

---

### Agent C3 — `ReAuditoriaCard` + `ReAuditoriaChain`

```yaml
subagent_type: general-purpose
model: haiku
description: Build ReAuditoria UI
````

**Prompt**:

```
Crie 2 arquivos:
- C:/hc quality/src/features/auditoria-interna/components/ReAuditoriaCard.tsx
- C:/hc quality/src/features/auditoria-interna/components/ReAuditoriaChain.tsx

C3.1 ReAuditoriaCard.tsx:
- Props: `{ auditoria: Auditoria; onCreateReAuditoria: () => void }`
- Render: card que mostra status da auditoria + botão "Criar Re-auditoria" (visível apenas se status === 'finalizada' AND tipoExecucao !== 'reAuditoria' AND existem NCs fechadas — assume helper `hasClosedNCs(auditoriaId)` em hook; mock se não existir).
- Botão chama callable createReAuditoria (via service).

C3.2 ReAuditoriaChain.tsx:
- Props: `{ auditoriaId: string; labId: string }`
- Render: árvore visual mostrando original → reAuditoria_1 → reAuditoria_2 (etc).
- Visual: cards conectados por linhas (`border-l-2 border-violet-500/30`), cada um com status badge.
- Hook: subscribe `labs/{labId}/auditorias-internas` filter `auditoriaOriginalId == X`, recursivo.

ACEITAÇÃO: TSC limpo, sem libs externas além das já usadas.

ENTREGÁVEL: 2 arquivos + commit "feat(phase-11/C3): ReAuditoria UI (Card + Chain)" + SHA.
```

---

### Validation Gate 3

```bash
git log --oneline | head -12 | grep -c "phase-11/C[1-3]" | grep -q "^3$" || { echo "GATE-3 FAIL"; exit 1; }
npx tsc --noEmit || { echo "GATE-3 FAIL: TSC web"; exit 1; }

# Componentes existem
[ -f "src/features/auditoria-interna/components/PlanoAcaoForm.tsx" ] || { echo "GATE-3 FAIL: PlanoAcaoForm"; exit 1; }
[ -f "src/features/auditoria-interna/components/PlanoAcaoList.tsx" ] || { echo "GATE-3 FAIL: PlanoAcaoList"; exit 1; }
[ -f "src/features/auditoria-interna/components/PresencaPanel.tsx" ] || { echo "GATE-3 FAIL: PresencaPanel"; exit 1; }
[ -f "src/features/auditoria-interna/components/ReAuditoriaCard.tsx" ] || { echo "GATE-3 FAIL: ReAuditoriaCard"; exit 1; }
[ -f "src/features/auditoria-interna/components/ReAuditoriaChain.tsx" ] || { echo "GATE-3 FAIL: ReAuditoriaChain"; exit 1; }

echo "GATE-3 PASS"
```

---

## 7. WAVE 4 — Tests (paralelo, ~30 min)

### Agent D1 — Unit Tests (Jest, functions side)

```yaml
subagent_type: general-purpose
model: haiku
description: Write callable unit tests
```

**Prompt**:

```
Crie C:/hc quality/functions/src/modules/auditoria/__tests__/phase11.test.ts.

CONTEXTO: padrão de teste em functions/__tests__ usa firebase-functions-test em offline mode.

TAREFA: 4 test suites cobrindo os 4 callables novos/atualizados:

1. `createPlanoAcao`:
   - rejeita sem auth
   - rejeita se descricao < 20 chars
   - rejeita se achado não pertence ao auditoriaId
   - cria doc + atualiza achado.planoAcaoId em tx

2. `registerPresenca`:
   - rejeita reuniao !== abertura/encerramento
   - rejeita 0 participantes
   - cria N docs em batch com signatures distintas (hash diferente)

3. `createReAuditoria`:
   - rejeita se original não existe
   - rejeita se original.status !== 'finalizada'
   - rejeita se 0 NCs fechadas
   - cria com tipoExecucao='reAuditoria' + auditoriaOriginalId set

4. `generatePDF` mapping comment:
   - test simples: assert que arquivo contém comment block "FR-043 ... 4 tabelas oficiais"

ACEITAÇÃO:
- `cd functions && npm test -- phase11.test` exit 0
- Mínimo 12 expects total (3 por callable)

ENTREGÁVEL: 1 arquivo + commit "test(phase-11/D1): unit tests for new callables" + SHA.
```

---

### Agent D2 — E2E Tests (Playwright)

```yaml
subagent_type: general-purpose
model: haiku
description: Write E2E audit tests
```

**Prompt**:

```
Crie C:/hc quality/web/e2e/phase-11-audit-workflow.spec.ts.

CONTEXTO: padrão Playwright já em web/e2e/. Use config existente `playwright.config.ts`.

TAREFA: 1 spec com 4 scenarios cobrindo:

1. "should register presença na reunião de abertura"
   - login → navega para auditoria existente → clica "Reunião abertura" → adiciona 4 participantes (auditor, RT, gerente_qc, auditado) → confirma → vê toast "4 registrados".

2. "should create plano de ação para achado"
   - navega para achado existente → clica "Criar plano" → preenche → submit → vê plano na lista com status nao_iniciado.

3. "should create reauditoria de auditoria finalizada com NC fechada"
   - navega para auditoria finalizada → clica "Re-auditoria" → preenche motivação + prazo → submit → vê toast "ReAuditoria criada" + redireciona.

4. "should display reAuditoriaChain mostrando original → reAud"
   - navega para auditoria com reAud filha → vê chain visual (2 cards conectados).

Use mocks/seeds se base de dados E2E não tiver os pré-requisitos. Marcar `test.skip` se infra não está pronta — orchestrator considera skip = pass para esta wave.

ACEITAÇÃO:
- `cd web && npx playwright test phase-11-audit-workflow` exit 0 OR 4 skipped
- Spec sintaticamente válido

ENTREGÁVEL: 1 arquivo + commit "test(phase-11/D2): E2E audit workflow specs" + SHA.
```

---

### Validation Gate 4

```bash
git log --oneline | head -16 | grep -c "phase-11/D[1-2]" | grep -q "^2$" || { echo "GATE-4 FAIL"; exit 1; }

# Functions tests
cd functions && npm test -- phase11.test 2>&1 | tee /tmp/phase11-jest.log
grep -q "Tests:.*passed" /tmp/phase11-jest.log || { echo "GATE-4 FAIL: jest"; cd ..; exit 1; }
cd ..

# Playwright (allow skip)
cd web && npx playwright test phase-11-audit-workflow 2>&1 | tee /tmp/phase11-pw.log
grep -qE "passed|skipped" /tmp/phase11-pw.log || { echo "GATE-4 FAIL: playwright crashed"; cd ..; exit 1; }
cd ..

echo "GATE-4 PASS"
```

---

## 8. WAVE 5 — Deploy + Docs (sequencial)

### Agent E1 — Deploy (Sonnet, com ack)

```yaml
subagent_type: gsd-executor
model: sonnet
description: Deploy phase 10 artifacts
```

**Prompt**:

```
Execute deploy do Phase 11 ao projeto Firebase 'hmatologia2', seguindo o protocolo de deploy do CLAUDE.md raiz. Você TEM autorização explícita do usuário (registrada na sessão Phase 11).

ORDEM OBRIGATÓRIA (não pular nenhum):
1. `npx tsc --noEmit` (raiz) — exit 0
2. `cd functions && npx tsc --noEmit && cd ..` — exit 0
3. `npm run build` (raiz) — exit 0
4. `bash scripts/preflight-secrets-check.sh` — exit 0 (ou abortar)
5. Deploy ordem (em sequência, nunca paralelo):
   a. `firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2`
   b. `firebase deploy --only functions:createPlanoAcao,functions:registerPresenca,functions:createReAuditoria --project hmatologia2`
   c. `firebase deploy --only hosting --project hmatologia2`
6. Após cada deploy: aguardar "Deploy complete!" antes de próximo
7. Cloud Logs monitor: `bash scripts/monitor-cloud-logs.sh 1 5 > /tmp/phase11-cloud-logs.json` (5 min smoke)

ACEITAÇÃO: 3 deploys sucedidos + cloud logs sem error rate > 1%.

ENTREGÁVEL:
- commit "deploy(phase-11/E1): rules + functions + hosting"
- summary com SHAs e cloud log report.

FALHA: rollback via `firebase deploy --only functions:rollback ...` (gh actions handle); reportar exato motivo.
```

---

### Agent E2 — Docs Update (Sonnet)

```yaml
subagent_type: general-purpose
model: sonnet
description: Update phase 10 docs and ADRs
```

**Prompt**:

```
Atualize 5 arquivos com Phase 11 documentação:

1. C:/hc quality/CLAUDE.md (raiz):
   Na seção "Módulos em produção", localize linha do módulo `auditoria` e atualize última coluna para `2026-05-09`.
   Após o bloco "**Phase 9 — COMPLETE...**", adicionar bloco novo:
```

**Phase 11 — COMPLETE (2026-05-09):** PQ-24 + FR42 compliance remediation. createPlanoAcao implementado (substitui TODO de Phase 7). FR-045 (Presença) callable + UI. createReAuditoria callable + ReAuditoriaChain UI. FR-043 4-table mapping documentado. ADRs 0035 + 0036 registrados. Score PQ-24 cobertura: 55% → 90%+.

```

2. Crie C:/hc quality/docs/adr/ADR-0035-audit-schema-extensions.md:
Frontmatter com title, date 2026-05-09, status accepted, context (gap analysis HC_Quality_vs_PQ24_FR42), decision (estender Auditoria + criar Presenca + Reuniao + estender PlanoAcao), consequences (3-4 bullets).

3. Crie C:/hc quality/docs/adr/ADR-0036-plano-acao-callable-implementation.md:
Documentar substituição do TODO stub por implementação real, validação cross-collection (achado pertence à auditoria), trigger automático de update achado.planoAcaoId em transaction.

4. Crie C:/hc quality/docs/PHASE_11_COMPLETION_SUMMARY.md:
Executive summary (~100 linhas): 4 GAPs críticos endereçados, 5 callables novos/atualizados, 5 componentes UI, 8 testes, deploy SHAs, cloud logs status.

5. Atualize C:/hc quality/.planning/milestones/PHASE_11_PLAN.md:
No final do arquivo, adicionar seção `## Execution Log` com:
- Pre-phase SHA
- Post-phase SHA
- Wave 1-5 commits SHAs
- Cloud Logs report path
- Final score (target: 90%+)

ACEITAÇÃO: 5 arquivos OK, ADRs com formato consistente com docs/adr/ADR-0034*.md.

ENTREGÁVEL: edits + commit "docs(phase-11/E2): ADRs 0035+0036 + completion summary + CLAUDE.md update" + SHA.
```

---

### Validation Gate 5 (final)

```bash
# Tudo da phase commitado
git log --oneline | head -20 | grep -c "phase-11/" | grep -q "^[1-9][0-9]*$" || { echo "GATE-5 FAIL"; exit 1; }

# CLAUDE.md atualizado
grep -q "Phase 11 — COMPLETE" CLAUDE.md || { echo "GATE-5 FAIL: CLAUDE.md missing"; exit 1; }

# ADRs presentes
[ -f "docs/adr/ADR-0035-audit-schema-extensions.md" ] || { echo "GATE-5 FAIL: ADR-0035"; exit 1; }
[ -f "docs/adr/ADR-0036-plano-acao-callable-implementation.md" ] || { echo "GATE-5 FAIL: ADR-0036"; exit 1; }
[ -f "docs/PHASE_11_COMPLETION_SUMMARY.md" ] || { echo "GATE-5 FAIL: completion"; exit 1; }

# Smoke test final
curl -sf https://hmatologia2.web.app | grep -q "<!DOCTYPE html" || { echo "GATE-5 FAIL: site down"; exit 1; }

echo "GATE-5 PASS — Phase 11 complete"
```

---

## 9. Rollback Plan

**Se qualquer gate falha**:

```bash
PRE_SHA=$(cat .planning/milestones/PHASE_11_PRE_SHA.txt)
git reset --hard "$PRE_SHA"
git tag -d phase-11-baseline 2>/dev/null
git branch -D feature/phase-11-pq24-compliance 2>/dev/null

# Se já deployed (gate 5 falha após E1):
# - Functions: firebase functions:rollback createPlanoAcao,registerPresenca,createReAuditoria --project hmatologia2
# - Hosting: firebase hosting:clone hmatologia2:live hmatologia2:live --version <pre-version>
# - Rules: redeploy from PRE_SHA: git checkout "$PRE_SHA" -- firestore.rules && firebase deploy --only firestore:rules
```

**Notify channel**: log incidente em `docs/INCIDENTS_2026.md` com timeline + RCA inicial.

---

## 10. Comando de Disparo (one-shot, sem intervenção)

```bash
# Abrir nova sessão Claude Code
claude --model sonnet-4-6 \
       --workdir "C:/hc quality" \
       --prompt "Execute o plano em .planning/milestones/PHASE_11_PLAN.md como orchestrator. Para cada Wave, dispatch agentes Haiku via Task tool com os prompts exatos do plano (paralelo onde marcado paralelo). Após cada Wave, rode o Validation Gate via Bash. Se qualquer gate falha, execute o Rollback Plan e pare. Sem confirmações intermediárias. Reportar progresso em uma linha por agente."
```

**Modo 100% autônomo (skip ack do E1 deploy)**: adicionar `--auto-deploy` no prompt do orchestrator. Caveat: deploy não-autorizado quebra a regra do CLAUDE.md raiz. Default: E1 pede ack.

---

## 11. Estimativas

| Wave      | Agentes | Modo | Tempo (haiku) | Tempo (humano review) |
| --------- | ------- | ---- | ------------- | --------------------- |
| 1         | 4       | //   | ~10 min       | 5 min                 |
| 2         | 4       | //   | ~25 min       | 10 min                |
| 3         | 3       | //   | ~25 min       | 10 min                |
| 4         | 2       | //   | ~15 min       | 5 min                 |
| 5         | 2       | seq  | ~15 min       | 10 min (deploy ack)   |
| **Total** | **15**  |      | **~90 min**   | **~40 min**           |

**Custo estimado**: ~$3-5 (Haiku 4.5 input + output médios) + ~$1 (Sonnet para E1+E2).

---

## 12. Execution Log

_(Preenchido pelo Agent E2 ao final)_

- Pre-phase SHA: `_TBD_`
- Post-phase SHA: `_TBD_`
- Wave 1 commits: `_TBD_`
- Wave 2 commits: `_TBD_`
- Wave 3 commits: `_TBD_`
- Wave 4 commits: `_TBD_`
- Wave 5 commits: `_TBD_`
- Cloud Logs report: `_TBD_`
- Final PQ-24 coverage score: `_TBD_` (target ≥ 90%)
