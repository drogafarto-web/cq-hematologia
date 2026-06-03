# Módulo: SGD — Sistema de Gestão de Documentos Externos

**Versão:** 1.0  
**Fase:** 12-sgd-drive-importer  
**Status:** Em desenvolvimento (Plan 01 - Foundation)

---

## Escopo Exclusivo

Trabalhe SOMENTE em `src/features/sgd/`.  
Não acesse outros módulos sem autorização.

Funcionalidade MVP: **Importação e gestão de documentos externos** (Google Drive).

- Importar documentos via Drive Importer Wizard
- Armazenar metadados em Firestore (`/labs/{labId}/sgd-externos/`)
- Visualizar documentos (PDF inline)
- Categorizar por bloco DICQ (A-J)
- Sugerir e confirmar links para módulos existentes (SGQ, POP, Treinamentos, Biossegurança)

V2 expande para:

- Auto-versionamento de documentos
- Sincronização periódica com Drive
- Exportação de lista mestra (PDF + planilha)

---

## Referências Regulatórias

**DICQ 8ª Ed.** cl. 4.3 (Controle de Documentos), 4.13 (Controle de Registros)  
**RDC 978/2025** Art. 31 — "documentos que evidenciam a execução das atividades"  
**LGPD** Art. 18 — direitos do titular (acesso, exclusão, portabilidade)

Auditor pede 3 evidências em 4.3:

1. Documentos categorizados por bloco DICQ
2. Trilha de audit de importação + modificação
3. Links rastreáveis para documentos regulatórios (POP, IT, Políticas)

---

## Multi-tenant (paths Firestore)

```
/labs/{labId}/sgd-externos/{id}           Documento importado
/labs/{labId}/sgd-externos-audit/{id}     Evento de audit (append-only)
```

Payload carrega `labId` redundante (defense-in-depth).

---

## Regras Invioláveis (RN-SGD-\*)

**RN-SGD-01** — Soft-delete only

- Nunca chamar `deleteDoc` em sgd-externos
- Use `sgdService.softDeleteDocument()` que marca `deletadoEm`
- Documentos deletados seguem retenção LGPD 5a + anonimização 90d

**RN-SGD-02** — Assinatura obrigatória

- Todo documento tem `aud: { hash (SHA-256), operatorId, ts }`
- Gerada por `generateAuditHash(payload)` no service
- `operatorId === request.auth.uid` validado em rules
- Hash é imutável após criação — evidência de integridade

**RN-SGD-03** — LGPD Compliance

- Import audit log obrigatório: { event, documentId, operatorEmail, consent, ts }
- Usuário pode deletar doc anytime; hard-delete após 90 dias grace
- Anonimização automática 5a+ (remove email/ID, mantém Timestamp)
- User rights: access via SGDViewer, delete via soft-delete, portability via export

**RN-SGD-04** — Categorização e linking

- `categoriaICQ` (A-J) preenchido pós-import via Gemini (Phase 12-02)
- `linksSugeridos` auto-gerado (confidence score > 0.7)
- `linksConfirmados` só após user approval (manual)
- User pode override categoria + links via UI

**RN-SGD-05** — Versionamento

- MVP: Manual (user cria novo doc se revisão necessária)
- Código do documento mantém-se entre versões (não UUID)
- V2: Auto-version com `versao++` + documentos anteriores → `obsoleto`

---

## Componentes Principais

**SGDView** — Entry point, tabela + filtros + KPIs

- Search por titulo/descricao
- Filtro por categoria DICQ
- KPIs: total, categorizados, vinculados

**SGDViewer** — Visualizador de documento

- Inline (modal 600px) + full-screen
- PDF preview via Drive Google Viewer iframe
- Sidebar: metadata, audit trail, links
- a11y: ESC to close, aria-label, keyboard nav

**DriveImporterWizard** — 4-step wizard

- Step 1 (Auth): Select Drive folder ID
- Step 2 (Select): Checkbox list de files (max 50)
- Step 3 (Preview): Review + consent checkbox
- Step 4 (Confirm): Progress bar + completion

---

## Integração com Shell

**View enum** em `src/types/index.ts`: adicionar `'sgd-documentos'`

**AuthWrapper.tsx**: adicionar rota

```typescript
case 'sgd-documentos':
  return <SGDView />
```

**Hub (ModuleHub.tsx)**: adicionar tile

```typescript
{
  id: 'documentos-externos',
  title: 'Documentos Externos',
  description: 'Gerencie documentos importados do Google Drive',
  status: 'active',
  view: 'sgd-documentos',
  icon: 'DocumentIcon'
}
```

---

## Pendências Conhecidas (Roadmap)

**SGD-01** — Drive backup + resync

- Phase 13: Implementar `sync-drive-backup.ts` (Cloud Function scheduled)
- Backup automático de documentos a HC Quality Drive account
- Mensal: resync + health check (links quebrados)

**SGD-02** — Dashboard de compliance

- Phase 13: Exportar lista mestra (PDF + Excel)
- Mapa DICQ (quantos docs por bloco)
- Auditor pode gerar relatório "Controle de Documentos 4.3"

**SGD-03** — Auto-versionamento

- Phase 2: Detecção automática de revisão (user carrega novo PDF com mesmo código)
- Versão anterior → `obsoleto` (soft-deleted)
- Cadeia: `substitui` ↔ `substituidoPor`

**SGD-04** — Integração calendário

- Phase 2: Alertas de revisão próxima (proximaRevisao campo)
- Notificações para usuários responsáveis

**SGD-05** — Deep linking

- Phase 2: URLs compartilháveis — `/sgd/{labId}/{docId}?view=full`
- Rastreamento: audit log registra "shared_link_accessed"

---

## Dever de Atualização do Contexto Raiz

Após primeira ida em prod do módulo SGD:

1. Atualizar a linha em "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md):

   ```text
   sgd | Em prod · Documentos Externos (DICQ 4.3) + Drive Importer | YYYY-MM-DD
   ```

2. Marcar checklist DICQ em Obsidian:
   `01_Projetos/HC_Quality_Checklist_Auditoria.md` — item 4.3 vai de `[ ]` para `[x]`

3. Criar ADR — "DICQ Document Linking Strategy" (ADR-000X)

---

## Firestore Rules Addition (firestore.rules)

```
match /labs/{labId}/sgd-externos/{docId} {
  allow read: if request.auth.uid != null
    && request.auth.customClaims.labs[labId] exists
  allow create: if request.auth.uid != null
    && request.resource.data.labId == labId
    && request.resource.data.aud.operatorId == request.auth.uid
    && request.resource.data.aud.hash.size() == 64
    && request.resource.data.aud.ts is timestamp
  allow update: if request.auth.uid != null
    && resource.data.labId == request.resource.data.labId
    && request.resource.data.aud.operatorId == request.auth.uid
}

match /labs/{labId}/sgd-externos-audit/{eventId} {
  allow read: if request.auth.customClaims.labs[labId] exists
  allow create: if request.auth.uid != null
}
```

---

## Performance Targets

| Metric                   | Target | Hard Limit |
| ------------------------ | ------ | ---------- |
| Listar documentos        | <1.5s  | 2.0s       |
| Renderizar tabela        | <500ms | 1.0s       |
| Abrir visualizador       | <800ms | 1.5s       |
| Importar batch (20 docs) | <5s    | 10s        |

---

## Testes Obrigatórios

- [ ] Unit: sgdService (CRUD, soft-delete, audit hash)
- [ ] Unit: hooks (useSGDDocumentos listener + cleanup)
- [ ] Component: SGDViewer renders PDF + metadata
- [ ] Component: DriveImporterWizard all 4 steps navigate
- [ ] Integration: import → Firestore write → listener update
- [ ] a11y: keyboard nav (ESC, Tab), contrast, ARIA labels

---

## Contatos & Guardrails

**CTO**: Decisões arquiteturais, Drive API setup, LGPD compliance  
**Gemini Integration (Phase 12-02)**: Classification prompt tuning, confidence thresholding  
**Firestore Rules**: Validar antes de deploy — security impact alto

---

## Histórico

| Data       | Evento                                            | Status      |
| ---------- | ------------------------------------------------- | ----------- |
| 2026-05-06 | Phase 12 planning started                         | Planning    |
| 2026-05-06 | Plan 01 scaffolding (components, services, types) | In Progress |
