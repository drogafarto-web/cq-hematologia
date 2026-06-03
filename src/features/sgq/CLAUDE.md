# Módulo: SGQ — Sistema de Gestão da Qualidade

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/sgq/`.
Não leia nem acesse outros módulos de `src/features/` sem autorização.

Escopo funcional do MVP: **Documentos da Qualidade** (DICQ 4.3 + ISO 15189 cl. 4.3).
Manual da Qualidade, Procedimentos, Instruções de Trabalho (POPs), Formulários,
Políticas. Hierarquia documental + controle de versão + segregação de obsoletos.

V2 expande o módulo para NCs cross-domain, indicadores agregados, plano de
riscos e análise crítica da direção. Cada um vai ter seu próprio sub-pasta
(`src/features/sgq/<área>/`) com tipos, service e hook isolados.

## Referências regulatórias

DICQ 8ª Ed. cl. 4.3 (Controle de Documentos), 4.13 (Controle de Registros) ·
ISO 15189:2015 cl. 4.3 · RDC 786/2023 · RDC 978/2025.

O auditor pede 3 evidências quando chega em 4.3:

1. **Hierarquia documental** — MQ → PQ → IT → FR + Política. A view mostra a
   pirâmide via filtro por tipo.
2. **Controle de versão** — toda revisão sobe versão (+1) e gera doc novo
   apontando para o anterior. Reconstrução da cadeia: `substitui` ↔ `substituidoPor`.
3. **Obsoletos segregados** — documentos `obsoleto` ficam ocultos por default
   na lista mestra (toggle "incluir obsoletos") e não podem ser editados nem
   reativados — apenas substituídos por nova revisão da próxima versão.

## Multi-tenant (paths Firestore)

```
labs/{labId}/
├── sgq-documentos/{id}            Documento (entidade principal)
└── sgq-documentos-audit/{id}      DocumentoAuditEvent (append-only)
```

## Regras invioláveis (RN-SGQ-\*)

- **RN-SGQ-01** — Código único por lab (entre não-deletados). Validado no hook
  via `existeCodigoDuplicado` antes de cada criar/atualizar.
- **RN-SGQ-02** — Transições de status válidas:
  - `em_revisao → vigente | obsoleto`
  - `vigente → em_revisao | obsoleto` (com motivo ≥10 chars)
  - `obsoleto → ∅` (terminal)
- **RN-SGQ-03** — Emissão de revisão exige doc anterior em `vigente`. Sobe
  versão em +1, anterior vai para `obsoleto` em batch atomic. Código mantém-se.
- **RN-SGQ-04** — Soft-delete (`deletadoEm`) só em `em_revisao`. Documentos
  publicados ou obsoletos NUNCA são deletados — auditor exige trilha.
- **RN-SGQ-05** — Versão monotônica: `versao` é imutável após criação. Nova
  versão = novo doc.
- **RN-SGQ-06** — Toda escrita gera entrada em `sgq-documentos-audit`
  (created/updated/status-changed/revisao-emitida) via batch atomic com a
  escrita principal. Entrada tem `operadorId == request.auth.uid` validado em
  rules — usuário não pode forjar audit em nome de outro.
- **RN-SGQ-07** — `proximaRevisao > dataRevisao`. Validado client-side; rules
  permite qualquer timestamp para preservar simplicidade — futuras revisões
  podem endurecer.

## Componentes principais

- `SGQView` — entry point. Topbar + KPIs + filtros + tabela + modais.
- `DocumentosListView` — tabela densa dark-first com filtros (tipo/status),
  sort por status (vigentes primeiro), badges contextuais (vencido/próximo).
- `DocumentoFormModal` — modal único com 3 modos: criar / editar / revisar.
- KPIs no header: total · vigentes · em revisão · próximos do prazo · vencidos.

## Integração com shell

- `View` enum em `src/types/index.ts` inclui `'sgq-documentos'`.
- `AuthWrapper.tsx` roteia `currentView === 'sgq-documentos'` → `<SGQView />`.
- `hub/ModuleHub.tsx` tile `gestao-documental` (status: active, view:
  sgq-documentos) e item correspondente no sidebar.

## Pendências conhecidas / roadmap

- **SGQ-01** — Upload direto ao Firebase Storage. MVP aceita URL externa
  (Drive). v2: path `labs/{labId}/sgq/documentos/{docId}/v{N}.pdf` imutável,
  signed URL com expiração curta para auditor externo.
- **SGQ-02** — Vinculação a outros módulos (ex: IT-005 "Coleta venosa" ↔
  treinamento periódico em educacao-continuada · Templates · Trilhas).
  Permite auditor pular do POP para o registro de treinamento associado.
- **SGQ-03** — Lista mestra exportável (PDF + planilha) com SHA-256 do
  payload. Já existe padrão em `fr10-emissions` e `report-emissions`.
- **SGQ-04** — Notificação automática de revisões próximas do prazo. Reaproveitar
  estrutura de `alertasVencimento` do EC.
- **SGQ-05** — Migrar escritas regulatórias para Cloud Function callable
  (Fase 0b+) — alinhar com EC e CT. MVP atual usa rules + audit em writeBatch
  client-side, suficiente mas não tão hermetic quanto callable Admin SDK.

## Dever de atualização do contexto raiz

Após primeira ida em prod do módulo SGQ:

1. Atualizar a linha em "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md):

   ```text
   sgq | Em prod · Documentos da Qualidade (DICQ 4.3) | YYYY-MM-DD
   ```

2. Marcar checklist DICQ em Obsidian:
   `01_Projetos/HC_Quality_Checklist_Auditoria.md` — itens 4.3 vão de `[ ]`/`[~]`
   para `[x]`.
