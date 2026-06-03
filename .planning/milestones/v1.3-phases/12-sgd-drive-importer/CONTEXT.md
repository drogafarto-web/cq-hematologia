# Phase 12: SGD + Drive Importer — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Discuss-phase inline (4 perguntas críticas) + síntese Obsidian + roadmap v1.3 + inventário Drive Riopomba

<domain>
## Phase Boundary

**O que esta phase entrega:**

Extensão do módulo SGQ existente para Sistema de Gestão Documental completo. Adiciona:

- Lista Mestra (LM-01) — catálogo unificado de TODOS os documentos do lab (15 tipos)
- Hierarquia documental — relações MQ→PQ→IT→FR navegáveis em árvore
- Lista de Distribuição (LD) — matriz docs×setores com sync dinâmico via módulo Pessoal
- Drive Importer — wizard OAuth para migrar ~80 docs do Drive Riopomba

**Migração concreta:** Riopomba opera SGQ no Drive desde 2024 (~80 docs catalogados em LM-01 Google Sheets). Phase 12 traz tudo para HC Quality em workflow draft→RT aprova→vigente.

**O que NÃO entrega (deferido):**

- Sync nightly Drive→SGD (defer v1.4 — big-bang migration)
- Generalização do importer para outros formatos (CSV, Word, OneDrive, Sharepoint) — defer v1.4
- Histórico completo de versões Drive (revisions API) — defer v1.5+ (auditor não exige)
- Documentos externos (RDCs, FISPQs, bulas) como vigentes — ficam em LM-02 (referências apenas)
- Documentos de outros labs Labclin (Mercês, Tabuleiro) — schema permite, mas import específico vira Phase futura
- Editor inline de docs no HC Quality — defer; v1.3 mantém Drive como editor (HC Quality é repositório vigente)

**Compliance alvo:**

- DICQ Block B completo: 4.2.2.2 (Lista Mestra), 4.3 hierarquia, 4.3 controle versão, 4.3 distribuição
- RDC 978/2025 Art. 117 (documentação obrigatória)
- Riopomba DICQ baseline: 71.3% → ≥76% (+5-8 pontos)

</domain>

<decisions>
## Implementation Decisions

### Locked (CTO via discuss-phase 2026-05-06)

#### 1. Arquitetura — Extensão do SGQ existente

- **Decisão:** SGD = extensão do módulo `sgq` em produção (não novo módulo)
- **Justificativa:** reuso 100% audit chain + versionamento + spine assinada; síntese Obsidian aponta como decisão já travada (2026-04-26 — "SGQ MVP usa URL externa")
- **Schema extensions ao módulo sgq:**

  ```typescript
  // Antes (sgq atual): enum tipos = 'MQ' | 'PQ' | 'IT' | 'FR' | 'POL'
  // Depois (Phase 12): enum tipos expandido para 15
  type DocumentoTipo =
    | 'MQ' // Manual da Qualidade
    | 'PQ' // Procedimento da Qualidade
    | 'IT' // Instrução de Trabalho
    | 'FR' // Formulário/Registro
    | 'POL' // Política
    | 'DC' // Descrição de Cargo
    | 'IC' // Instrução de Coleta
    | 'ITA' // IT Analítica
    | 'ITE' // IT Equipamento
    | 'CCE' // Controle Crítico/Equipamento
    | 'FISPQ' // Ficha Segurança Produto Químico (referência LM-02)
    | 'RDC' // Resolução Diretoria Colegiada (referência LM-02)
    | 'ME' // Manual Externo (referência LM-02)
    | 'OD' // Outro Documento
    | 'TB'; // Tabela

  interface Documento extends DocumentoSGQ {
    // Campos novos Phase 12
    listaDistribuicao: SetorId[]; // setores que recebem cópia (sync via Pessoal)
    hierarquia: {
      parent?: string; // documentoId do pai (ex: PQ-15 tem MQ-001 como parent)
      derivados?: string[]; // documentoIds dos filhos (ex: PQ-15 deriva IT-15a, IT-15b, FR-23)
    };
    urlDriveOriginal?: string; // referência ao Drive Riopomba (audit/rollback)
    importedFromDrive?: {
      driveFileId: string;
      driveFileMimeType: string;
      driveFileLastModified: Timestamp;
      importedAt: Timestamp;
      importedByRtId: UserId;
    };
    statusVigencia: 'draft' | 'em-revisao' | 'vigente' | 'obsoleto';
    aprovadoPorRtId?: UserId;
    aprovadoEm?: Timestamp;
    // labId já existe (multi-tenant)
  }
  ```

#### 2. Drive Auth — OAuth browser + preview RT

- **Fluxo:** RT acessa `/sgq/importar-drive` → autoriza OAuth Google (consent screen) → sistema lista 80 docs Drive → RT visualiza preview de cada doc + valida classificação automática + aprova batch
- **Auditável:** cada import gera audit log com `importedByRtId` + chain hash
- **OAuth scopes:** `drive.readonly` + `drive.metadata.readonly` (sem write — proteção contra modificação acidental Drive)
- **Token refresh:** automático até 6 meses; após, RT precisa reauthorizar
- **Preview includes:**
  - Nome arquivo Drive vs nome em LM-01 (mostra diferenças)
  - Tipo classificado automaticamente (MQ, PQ, IT...) com confidence
  - Setores LD sugeridos (baseado em LM-01)
  - Versão atual no Drive
  - Última modificação
- **RT actions:** aprovar (vai para vigente após import) | aprovar como draft (precisa revisão depois) | rejeitar (não importa)

#### 3. Versionamento — Flat v1.0 + Drive URL como referência

- **Decisão:** Import cria todos os docs como **v1.0 'on HC Quality'**; histórico Drive antigo fica em `urlDriveOriginal`
- **Justificativa:** auditor quer "o que vale agora"; histórico antigo via Drive link (1 click)
- **Após import:** mudanças subsequentes em SGD seguem versionamento normal (v1.1, v2.0, etc.)
- **Drive não atualiza mais:** após go-live, Drive Riopomba fica read-only (lab edita em HC Quality); decisão CTO + comunicação clara

#### 4. Lista de Distribuição (LD) — Dinâmica via módulo Pessoal (Phase 8)

- **Schema LD por documento:**
  ```typescript
  listaDistribuicao: SetorId[];   // ['bioquimica', 'hematologia', 'recepcao']
  ```
- **Resolução dinâmica:**
  - Quando UI mostra "quem recebeu cópia de PQ-15": query `/personnel/cargos` where `setor in [...listaDistribuicao]`
  - Quando colaborador muda de setor (Phase 8 personnel/cargos update): LD propaga automaticamente
- **17 setores Riopomba:**
  - Analíticos (9): Bioquímica, Hematologia, Coagulação, Uroanálise, Imunologia, Microbiologia, Parasitologia, Toxicologia, Hormônios
  - Administrativos (8): Administração, RH, Direção, VISA, Diretoria, Auditoria, Fornecedores, Recepção
- **Sync detection:** quando colaborador adicionado a setor X, sistema notifica via UI "Você tem 12 docs novos no setor Bioquímica para conhecer"
- **Audit log:** toda mudança de LD registra histórico (quem alterou, quando)

#### 5. Aprovação RT obrigatória pre-vigente

- **Workflow:** import → status `draft` → RT clica "Aprovar" → status `em-revisao` (24h pra colegas comentarem) → RT confirma → `vigente`
- **Atalho batch:** RT pode aprovar 80 docs em batch (após preview); ainda passa por audit log
- **DICQ 4.3 explicitamente exige autorização RT;** Phase 12 cumpre.
- **Backup:** RT-Substituto pode aprovar se RT férias/ausência (configurável); ambos audit log

#### 6. Multi-tenant SGD — Per-lab desde dia 1

- **Schema:** `labId` enforced em todas as queries; cross-tenant impossível por rules
- **Labclin grupo:** Riopomba (matriz) + Mercês + Tabuleiro tratados como **labs separados** (`labId: 'riopomba'`, `'merces'`, `'tabuleiro'`)
- **Catálogo compartilhado v1.4:** schema permite futuramente "templates globais" (MQ template) que cada lab clona; defer v1.4
- **Decisão CTO necessária:** Riopomba é "labclin-riopomba" no labId atual? Confirmar antes de execução.

#### 7. Sync ongoing Drive — Defer v1.4 (big-bang migration)

- **Decisão:** após go-live Phase 12, Drive Riopomba fica read-only; lab edita só em HC Quality
- **Não há sync nightly** no MVP
- **Futuro v1.4:** considerar sync bidirectional para outros labs que querem manter Drive como editor (caso de uso opcional)

#### 8. FRs em Google Forms — Linkados via URL

- **FRs Google Forms (FR-23, FR-41, FR-04, etc.):** importer trata como **template anexado** (link Drive Forms)
- **Não snapshot HTML;** preserva fluxo Forms→Sheets nativo
- **Schema Documento:** campo `urlForm: string` quando aplicável
- **Renderização UI:** "Para preencher este formulário, [clique aqui no Google Forms]"

#### 9. Documentos externos (LM-02)

- **LM-02 (Google Sheets Riopomba) lista:** RDCs ANVISA, FISPQs reagentes, bulas equipamentos, manual DICQ 8ª ed
- **Importer trata como referências:** cria entries em `lm02-referencias` separado (não no SGD principal)
- **Não passam por aprovação RT** (não são documentos da qualidade do lab; são externos)

#### 10. Ruído Drive — Ignorado

- POPs Farmácia obsoletos (5 arquivos com prefix "(POP-)" antigo)
- `.rar` desconhecido, `.jpg` solta
- Versões duplicadas (MQ docx + Google Doc — Google Doc é canônico)
- **Importer ignora silenciosamente;** logs marcados como "skipped: ruido"

#### 11. Schema Firestore (extensão)

```
/labs/{labId}/sgq/  (já existe — extender)
  documentos/{documentoId}                   # Documento expandido com novos campos
  documentos-versions/{versionId}             # já existe
  audit/{logId}                               # já existe

/labs/{labId}/sgd/  (NOVO — Phase 12)
  hierarquia-cache/{cacheKey}                 # cache da árvore para performance
  drive-import-jobs/{jobId}                   # tracking de imports
  drive-import-previews/{previewId}           # docs em preview pre-aprovação
  lm02-referencias/{refId}                    # documentos externos (RDCs, bulas, FISPQs)

/labs/{labId}/personnel/  (já existe Phase 8)
  cargos/{cargoId}                            # leitura cross-module para LD dinâmica
```

**Indexes principais:**

- documentos: `(labId, tipo, statusVigencia, criadoEm DESC)`
- documentos: `(labId, listaDistribuicao, statusVigencia)` (collection group)
- drive-import-jobs: `(labId, status, criadoEm DESC)`

#### 12. Cloud Functions

| Function                    | Propósito                                                               |
| --------------------------- | ----------------------------------------------------------------------- |
| `iniciarDriveImport`        | Callable: RT inicia OAuth flow; gera job                                |
| `oauthCallbackDrive`        | HTTPS endpoint: recebe OAuth callback Google                            |
| `listarDocsDrive`           | Internal: usa OAuth token para listar arquivos Drive (filtra por LM-01) |
| `previewDocDrive`           | Callable: gera preview de 1 doc (download + parse + classify)           |
| `classificarDocAuto`        | Internal: heurística para sugerir tipo + LD baseado em código LM-01     |
| `aprovarBatchImport`        | Callable RT: aprova batch após preview; cria docs `draft`               |
| `transitarVigencia`         | Callable RT: draft → em-revisao → vigente                               |
| `gerarHierarquiaCache`      | Internal: rebuilds tree cache quando docs mudam                         |
| `sincronizarLDPessoal`      | Trigger onUpdate em /personnel/cargos: propaga LD changes               |
| `gerarRelatorioMigracaoPDF` | Callable: PDF de auditoria pós-migração                                 |

#### 13. Roteamento

- `/sgq/lista-mestra` — catálogo unificado LM-01 (já listado em sgq atual; UI rebrand)
- `/sgq/hierarquia` — visualização tree MQ→PQ→IT→FR
- `/sgq/distribuicao` — matriz docs × setores
- `/sgq/importar-drive` — wizard OAuth (claim RT)
- `/sgq/importar-drive/preview/{jobId}` — preview pre-aprovação
- `/sgq/importar-drive/historico` — jobs anteriores

#### 14. Bundles

```typescript
manualChunks: {
  // sgq já existe (módulo). Phase 12 não cria novo chunk; estende.
  // Apenas adiciona componentes em src/features/sgq/components/lm/, /hierarquia/, /distribuicao/, /importer/
}
```

### Claude's Discretion

- **Hierarquia visualização:** árvore vertical (MQ no topo) com colapsar/expandir; ou horizontal se >5 níveis. Decisão Plan 12-02.
- **Drive preview:** Markdown preview convertido de Google Doc; PDF embed se conversão falha.
- **Batch approve UX:** UI mostra grid de cards (1 por doc) com ✓/✗/edit; "Aprovar todos visíveis" como atalho.
- **Naming convention enforcement:** importer força código LM-01 (PQ-01, FR-23) como ID; nome arquivo Drive vai como `nomeOriginal` field.
- **Rollback:** se import falha mid-batch, sistema desfaz docs criados (pendentes de aprovação RT); commits via transaction.
- **Audit retention:** import jobs mantidos por 5 anos (RDC 978); previews descartados após 30 dias.

</decisions>

<canonical_refs>

## Canonical References

### Estratégico (Obsidian)

- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Labclin_Drive_Inventory.md` — inventário completo Drive Riopomba (CRITICAL — consultar antes de qualquer task de import)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_QMS_Index_2026-04-27.md` — índice atual QMS
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` — Block B (4.2.2.2, 4.3.x)
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md` — Art. 117
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Decisoes_Abertas.md` — multi-tenant strategy
- `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Visao.md` — Riopomba como piloto

### Código vivo (HC Quality repo — extender, não substituir)

- `src/features/sgq/` — base (extensão Phase 12)
- `src/features/pops/` — pattern aprovação RT
- `src/features/auditoria/` — chainHash + LogicalSignature
- `src/features/treinamentos/` — vínculo doc → treinamento (FR-27/FR-28)
- `src/features/personnel/` (Phase 8) — sync LD via /personnel/cargos
- `src/features/portal-medico/` (Plan 10-05) — pattern OAuth externa para reusar

### ADRs

- ADR 0001 (audit chain) — base para chainHash
- ADR 0002 (multi-tenant) — labId enforcement
- ADR 0012 (a criar): SGD architecture extension + Drive importer pattern + LD dinâmica

### Drive API references

- Google Drive API v3 (drive.readonly + drive.metadata.readonly)
- Google Sheets API v4 (para parsing LM-01)
- OAuth 2.0 flow para web apps (Firebase Auth + Google provider)

### Skills

- `hcq-firestore-rules-generator` — bloco rules SGD
- `hcq-deploy-gates` — gate pré-merge
- `firebase-security-rules-auditor` — rules review

</canonical_refs>

<specifics>
## Phase-Specific Constraints

### Bundle budget

- `module-sgq` (já existe) — incremento ≤ 80KB gzip com componentes Phase 12 (lista-mestra dashboard, hierarquia tree, distribuicao matrix, importer wizard)

### Firestore custos

- Riopomba: 80 docs × ~3 reads = 240 reads inicial
- LD dinâmica: cada visualização /sgq/distribuicao = N docs × M setores reads (otimizar com cache)
- Hierarquia tree: cache em `hierarquia-cache` (rebuild on doc change via trigger)

### Cloud Function quotas

- `previewDocDrive`: ≤10s p99 (Drive API + parse Markdown)
- `aprovarBatchImport`: ≤60s p99 para 80 docs (transaction batch)
- `listarDocsDrive`: ≤5s p99
- Drive API rate limit: 1000 calls/dia/user (Riopomba ~80 docs = OK; refresh diária)

### Web Vitals targets

- `/sgq/lista-mestra`: LCP <2.5s, INP <200ms, CLS <0.1
- `/sgq/hierarquia`: LCP <3s aceitável (tree render pesado); CLS <0.1
- `/sgq/distribuicao`: LCP <2.5s; matriz virtualizada se >50 setores
- `/sgq/importar-drive`: LCP <2.5s

### Threat model

- **T1: Drive token leakage** — mitigação: token armazenado server-side only (Firestore encrypted); nunca client; audit log uso
- **T2: Cross-tenant import (Riopomba aprova doc para Mercês acidentalmente)** — mitigação: UI exige seleção labId explícita; rules check
- **T3: RT aprova doc malicioso (XSS via doc Drive comprometido)** — mitigação: HTML sanitization no parse; audit log RT
- **T4: Drive API quota exhaustion ataca lab** — mitigação: rate limit per labId 100 calls/h
- **T5: Importer cria duplicatas (idempotência falha)** — mitigação: hash payload + driveFileId como chave única
- **T6: Histórico audit perdido em rollback** — mitigação: audit log nunca apagado; rollback marca docs como `revertedAt` (soft)

### Performance profile

- Volumes Riopomba: 80 docs total
- Picos: durante batch import (1 RT aprovando 80 docs em <2h)
- Caching: hierarquia tree (1h), LM-01 catálogo (15min), LD por setor (1h)

### Localization

- pt-BR em toda UI (consistente com domínio)
- Códigos de tipo de doc (MQ, PQ, IT) preservados em pt-BR
- Datas: DD/MM/YYYY HH:mm

### Drive integration safety

- Read-only scopes (`drive.readonly` + `drive.metadata.readonly`) — proteção contra modificação acidental
- Audit log toda chamada Drive API (quem, quando, qual file, qual ação)
- Token refresh logged
- Permissions check: importer só acessa Drive Riopomba (autorizado pelo RT)

</specifics>

<gotchas>
## Known Pitfalls

1. **Naming convention Drive ≠ LM-01:** PQ-15 no Drive pode estar como "Procedimento PQ-15 v2.0 revisado.gdoc". Importer força match por código LM-01 ("PQ-15"), não nome arquivo.
2. **Versões Drive obsoletas no mesmo arquivo:** Google Docs tem histórico nativo. Importer pega só "current revision"; histórico fica em Drive (link em `urlDriveOriginal`).
3. **POPs Farmácia (herança profissional):** 5 arquivos com prefix "(POP-)" antigo. Importer ignora silenciosamente; logs `skipped: ruido`.
4. **MQ duplicado (docx + Google Doc):** Google Doc é canônico (LM-01 confirma). Importer ignora docx; nome similar não confunde.
5. **FRs em Google Forms vs Docs:** alguns FRs são templates Google Forms, outros são Google Docs. Importer detecta pelo mimeType e trata diferente (link vs import).
6. **17 setores não-padronizados:** Riopomba pode ter "Bioquímica" e outros labs "Bioquimica" (sem acento). Schema normalizes setor para slug ASCII (`bioquimica`).
7. **LD vazio:** alguns docs não têm "locais distribuição" preenchidos em LM-01. Importer marca `listaDistribuicao: []`; RT preenche manualmente depois.
8. **Hierarquia incompleta em LM-01:** alguns PQs não têm `parent: MQ-001` declarado. Importer usa heurística (todos os PQs herdam MQ se não especificado); RT corrige.
9. **Multi-tenant labId errado:** Riopomba aprova doc com labId='merces' por engano. UI exige seleção explícita labId; audit log captura.
10. **OAuth token expirado mid-import:** sistema tenta refresh; se falha, pausa job + alerta RT (não corrompe partial).
11. **Drive permissions revogadas:** se Riopomba revoga acesso ao Drive durante import, sistema pausa + alerta. Não corrompe.
12. **Drive API quota:** 1000 calls/dia/user; 80 docs ~ 320 calls (4x por doc: list, get, content, revisions). OK; sequential batch noturno se quota apertar.

</gotchas>
