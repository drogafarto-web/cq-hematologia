# Módulo: Personnel (Cargos + Designações)

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/personnel/`.
Não leia nem acesse outros módulos de `src/features/`.

## Dependências externas permitidas

- `src/shared/services/firebase.ts` — todas as APIs Firebase do projeto
- `src/store/useAuthStore.ts` — `useActiveLabId()` e `useUser()`
- `functions/src/modules/personnel/signDesignacao.ts` — Cloud Function callable

## Referências regulatórias

**DICQ 5.1.3** — Descrição de Cargos (job descriptions formalizadas no sistema)
**DICQ 4.1.2.7** — Designação do Responsável pela Qualidade (GQ designation com autoridade)
**RDC 978/2025** — 5 anos de retenção (soft-delete, nunca deleteDoc)

## Multi-tenant

Coleção raiz: `personnel/{labId}/[subcoleção]`.
Documentos carregam `labId` redundante no payload (defense-in-depth nas rules).
Toda função de `cargoService.ts` e `designacaoService.ts` recebe `labId` como parâmetro posicional obrigatório.

## Regras invioláveis

- **RN-06:** jamais invocar `deleteDoc`. Usar `softDelete*` do service.
- **Assinatura:** `LogicalSignature = { hash, operatorId, ts }` — wrapper auditável.
  Hash é SHA-256 hex (64 chars), computado server-side na Cloud Function `signDesignacao`.
- **Escrita regulatória:** designacoes SEMPRE via Cloud Function callable.
  Cargos podem ser criados/atualizados via Cloud Function ou service direto (menos crítico).
- **Padrão de hook:** `useActiveLabId` como guard, `onSnapshot` com cleanup, mutations que lançam `Error` sem lab ativo.

## Status atual

**Fase:** 8 — CAPA Closure (Phase 8 v1.3)
**URL:** https://hmatologia2.web.app/personnel (rota pronta após deploy)
**Functions:** 1 callable `signDesignacao` em `southamerica-east1` Node 22
**Rules:** `personnel/{labId}/**` com `allow create/update/delete: if false` (callable-only)
**Status:** 🟡 Em desenvolvimento (Phase 8 — 2026-05-27 → 2026-06-10)

## Schemas

### Cargo (Job Description)

```typescript
{
  id: string;                    // slug: "tecnico", "gq", "rt", "diretor"
  labId: string;
  titulo: string;                // "Técnico de Laboratório"
  descricao: string;             // Full description
  responsabilidades: string[];   // Bullet list of duties
  autoridades: string[];         // Authority + decision limits
  certificacoes?: string[];      // Required certs (ABCLIN, ISO15189, etc)
  reportaA?: string;             // FK to Cargo.id (hierarchy)
  criadoEm: Timestamp;
  updatedAt: Timestamp;
  deletadoEm: Timestamp | null;  // RN-06: soft-delete only
}
```

### Designacao (Appointment with Signature)

```typescript
{
  id: string;                    // UUID
  labId: string;
  cargoId: string;               // FK to Cargo
  pessoaId: string;              // FK to staff (from treinamentos)
  pessoaNome: string;            // Denormalized for display
  dataInicio: Timestamp;
  dataFim: Timestamp | null;     // NULL = still in role
  descricaoAutoridade: string;   // What person is authorized to do
  successorId?: string;          // Next person in line (FK to Designacao)
  chainHash: LogicalSignature;   // { hash, operatorId, ts }
  certificadoUrl?: string;       // Download URL for signed cert PDF
  criadoEm: Timestamp;
  updatedAt: Timestamp;
  deletadoEm: Timestamp | null;  // RN-06
}
```

### OrgChartNode (Visualization)

```typescript
{
  cargoId: string;
  designacaoId?: string;         // Current occupant
  nome?: string;
  titulo: string;
  reportaA?: string;
  filhos?: OrgChartNode[];        // Children (subordinates)
}
```

## Services

### cargoService.ts

- `createCargo(labId, input) → Promise<string>` — new job description
- `getCargo(labId, cargoId) → Promise<Cargo | null>` — single read
- `getCargos(labId) → Promise<Cargo[]>` — all cargos (not deleted)
- `watchCargos(labId, callback, onError?) → Unsubscribe` — real-time subscribe
- `updateCargo(labId, cargoId, updates) → Promise<void>` — update (rarely used, prefer callable)
- `softDeleteCargo(labId, cargoId) → Promise<void>` — soft-delete only
- `getCargoHierarchy(labId) → Promise<{ roots, parents }>` — org chart hierarchy

### designacaoService.ts

- `createDesignacao(labId, input, signature) → Promise<string>` — new appointment
- `getDesignacao(labId, designacaoId) → Promise<Designacao | null>` — single read
- `getDesignacoes(labId, filterByRole?) → Promise<Designacao[]>` — all designations
- `watchDesignacoes(labId, callback, onError?) → Unsubscribe` — real-time subscribe
- `getActiveDesignacao(labId, cargoId) → Promise<Designacao | null>` — current holder of role
- `softDeleteDesignacao(labId, designacaoId) → Promise<void>` — mark as ended
- `validateChainHash(designacao) → boolean` — verify signature structure
- `getActiveDesignacoesByRole(labId) → Promise<Map<cargoId, Designacao>>` — all current roles

## Hooks

### useCargos()

```typescript
{
  cargos: Cargo[];
  hierarchy: { roots: string[]; parents: Map<string, string> };
  loading: boolean;
  error: Error | null;
}
```

Real-time subscribe to all cargos. Returns hierarchy for org chart building.

### useDesignacoes()

```typescript
{
  designacoes: Designacao[];
  currentByRole: Map<string, Designacao>;  // cargoId → active designacao
  loading: boolean;
  error: Error | null;
}
```

Real-time subscribe to all designacoes. Derives currentByRole map for quick lookup.

### useOrgChart()

```typescript
{
  tree: OrgChartNode[];
  loading: boolean;
  error: Error | null;
}
```

Combines cargos + designacoes to build full org chart tree ready for rendering.

## Cloud Function: signDesignacao

**Callable:** `signDesignacao({ labId, cargoId, pessoaId, pessoaNome, dataInicio, ... })`

**What it does:**

1. Authenticates caller (uid required)
2. Checks permission (member of labId + module claim 'personnel')
3. Validates payload schema (Zod)
4. Generates LogicalSignature server-side: `SHA-256(labId|cargoId|pessoaId|...|operatorId|ts)`
5. Creates Designacao document atomically in `/labs/{labId}/personnel/designacoes/`
6. Returns: `{ designacaoId, signature, success }`

**Security:**

- Chain-hash is server-computed; client cannot forge
- `operatorId` auto-set to `request.auth.uid` (cannot sign for someone else)
- Firestore rules deny direct writes to `designacoes` collection (callable-only)

## Firestore Rules

**Collection:** `/labs/{labId}/personnel/**`

```firestore
match /personnel/{document=**} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create: if false;  // Via signDesignacao callable only
  allow update: if false;  // Via signDesignacao callable only
  allow delete: if false;  // Soft-delete only (RN-06)
}
```

## Components (UI)

### CargoForm.tsx

Form to create/edit cargos. Fields: titulo, descricao (rich text), responsabilidades (array), autoridades (array), certificacoes, reportaA.

### CargoList.tsx

Grid/table of all cargos. Click to view full description. Edit/delete buttons.

### DesignacaoCard.tsx

Display person, role, start date, signature info. Shows chain-hash preview. Print button for signed certificate.

### OrgChart.tsx

Tree visualization: Diretor → RT → Técnicos. Each node clickable to show DesignacaoCard.

### DesignacaoCertificate.tsx

Printable certificate layout (A4): role, person, start date, chain-hash, signature section. Print-ready formatting.

## Integration Points

- **with treinamentos module:** Staff list pulls from treinamentos (via `pessoaId` FK)
- **with hub:** Personnel tile in `/hub` routes to `/personnel`

## Pendências Conhecidas

1. **Assinatura:** client-side pode ainda forjar hashes SHA-256 arbitrários via dev tools (Firestore rules verificam shape, não re-computa hash). **Fase 0c next:** `allow write: if false` aperta totalmente. Hoje, only legit signDesignacao callable gera hash válido.

2. **Re-assinatura:** se alguém editar designacao sem passar pela callable (dev tools), não há re-assinatura. Implementado em 08-04 (Management-Review module com necessidade similar).

3. **Perfis de permissão:** hoje qualquer membro do lab pode ler/criar designacoes via callable. Refinar para "apenas GQ/RT/Diretor pode assinar" em 08-05 (CAPA closure phase).

## Debitos Técnicos

1. Smoke test E2E manual — checklist em `/personnel` routes
2. Gerador automático de certificado em PDF (hoje é printable HTML)
3. Versionamento de designacoes (histórico completo com archive)
4. Auditoria de "quem assinou quando" em tab separada

## Próximas Fases

- **08-04:** Management-Review Module (aproveita designacoes para atas + signatures)
- **08-05:** CAPA Process Closure (linkage a designacoes para rastreabilidade)
- **Phase 9+:** Treinamento de RT ligado a designação (certificação de autoridade)

---

**Dever de atualização:** Após cada milestone deste módulo, atualizar seção "Status atual" acima + linha `personnel` na tabela "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md).
