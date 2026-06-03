# PLANO DE IMPLEMENTAÇÃO — MÓDULO AUDITORIA INTERNA HC QUALITY

## Plataforma Profissional de Auditoria Laboratorial Assistida por IA

**Versão:** 1.0
**Data:** 2026-05-13
**Projeto:** HC Quality — Auditoria Interna (DICQ 4.14.5 + RDC 978/2025)
**Referências:** prompt_auditoria_interna_sgq.md | FR-044 | PQ-24 | Módulos 3.0/3.1 Zero à Acreditação | Manual DICQ 8ª Ed.

---

## VISÃO GERAL

### Objetivo

Transformar o módulo de auditoria interna do HC Quality em uma **plataforma enterprise mobile-first** capaz de:

- Conduzir auditorias completas em tablet/celular (campo)
- Puxar evidências automaticamente de outros módulos do sistema
- Gerar NCs, riscos e CAPAs automaticamente a partir de achados
- Produzir relatórios executivos PDF premium
- Funcionar offline com sincronização posterior
- Suportar acreditação DICQ/PALC/ISO 15189

### Conceito Central: "Auditoria Conectada"

O auditor em campo não busca evidências manualmente — o sistema **agrega comprovações** dos módulos já existentes (fornecedores, equipamentos, treinamentos, CIQ, riscos, etc.) e apresenta como evidência vinculada ao item do checklist.

### Stack Tecnológico

- **Web:** React 19 + TypeScript + Vite + Tailwind CSS 4 + Zustand
- **Mobile:** React Native 0.75 + NativeWind + Detox
- **Backend:** Firebase Cloud Functions v2 + Firestore
- **IA:** Claude API (sugestões contextuais)
- **PDF:** Cloud Function com geração server-side
- **Offline:** Firestore persistence + localStorage drafts + sync queue

---

## ESTADO ATUAL (Diagnóstico)

### O que já existe e funciona:

- ✅ Tipos completos (Auditoria → Sessão → ChecklistItem → Achado)
- ✅ Service layer com subscriptions Firestore
- ✅ Template DICQ 8ª Ed. com ~115 itens (`checklistTemplates.json`)
- ✅ UI web: SessaoExecucaoPanel, ChecklistItemCard, AchadoForm
- ✅ LogicalSignature (SHA-256 + operador + timestamp)
- ✅ Soft-delete pattern
- ✅ Audit trail com chain-hash (RDC 978 5.3)

### Gaps críticos:

- ❌ Cloud Functions Wave 3 não deployadas (callables são stubs)
- ❌ Sessão não persiste respostas (só localStorage)
- ❌ AchadoForm usa IDs placeholder
- ❌ Sem integração cross-module (Evidence Aggregator)
- ❌ Sem tela mobile de auditoria
- ❌ Sem geração de PDF/relatório
- ❌ Sem IA contextual
- ❌ Sem upload de evidências para Storage (base64 em Firestore = limite)
- ❌ FR-044 (57 indicadores RDC 978) não está no template

---

## ROTEIRO FR-044 COMPLETO (57 Indicadores)

O checklist FR-044 deve ser integralmente implementado como template auditável:

| #     | Indicador                    | Marco Regulatório    | Módulo HC Quality Vinculado          |
| ----- | ---------------------------- | -------------------- | ------------------------------------ |
| 1     | Alvará de Licenciamento      | Art. 63 RDC 978      | sgd/ (documentos)                    |
| 2     | Inscrição CNES               | Art. 63-64 RDC 978   | sgd/                                 |
| 3     | PBA e Memorial Descritivo    | Art. 63 RDC 978      | sgd/                                 |
| 4     | Responsável Técnico          | Art. 64 RDC 978      | personnel/                           |
| 5     | EAC Itinerante Tipo III      | Art. 40-42 RDC 978   | —                                    |
| 6     | Contratualização             | Art. 75 RDC 978      | fornecedores/                        |
| 7     | Conteúdo do Contrato         | Art. 54-56 RDC 978   | fornecedores/                        |
| 8     | Contrato de Supervisão       | Art. 79-81 RDC 978   | fornecedores/                        |
| 9     | Conteúdo Contrato Supervisão | Art. 82 RDC 978      | fornecedores/                        |
| 10    | Gerenciamento de Tecnologias | Art. 83 RDC 978      | equipamentos/                        |
| 11    | Notificações                 | Art. 83 RDC 978      | notivisa-portal/                     |
| 12    | Manutenções Instrumentos     | Art. 88-90 RDC 978   | equipamentos/                        |
| 13    | Verificação Conformidade     | Art. 107 RDC 978     | equipamentos/ + calibracao/          |
| 14    | Calibração Instrumentos      | Art. 92 RDC 978      | calibracao/                          |
| 15    | Gerenciamento de Risco       | Art. 93-94 RDC 978   | risks/ + risk-management/            |
| 16    | Gestão de Documentos         | Art. 95 RDC 978      | sgq/ + sgd/                          |
| 17    | Gestão de Pessoal            | Art. 84-87 RDC 978   | personnel/                           |
| 18    | Educação Permanente          | Art. 133-136 RDC 978 | treinamentos/ + educacao-continuada/ |
| 19    | Conteúdo Capacitações        | Art. 86 RDC 978      | treinamentos/                        |
| 20    | Infraestrutura               | Art. 96-100 RDC 978  | —                                    |
| 21-57 | (demais indicadores)         | RDC 978 diversos     | módulos correspondentes              |

---

## ARQUITETURA — EVIDENCE AGGREGATOR SERVICE

### Conceito

Serviço central que, dado um item de checklist, consulta os módulos relevantes e retorna evidências pré-vinculadas.

```typescript
// src/features/auditoria-interna/services/evidenceAggregatorService.ts

interface EvidenciaAgregada {
  id: string;
  moduloOrigem:
    | 'fornecedores'
    | 'equipamentos'
    | 'calibracao'
    | 'treinamentos'
    | 'ciq-imuno'
    | 'risks'
    | 'nao-conformidades'
    | 'capa-tracking'
    | 'sgq'
    | 'sgd'
    | 'personnel'
    | 'notivisa-portal'
    | 'controle-temperatura'
    | 'biosseguranca'
    | 'pgrss'
    | 'lgpd'
    | 'reclamacoes';
  tipo: 'documento' | 'registro' | 'certificado' | 'relatorio' | 'indicador' | 'foto';
  titulo: string;
  descricao: string;
  dataRegistro: Timestamp;
  status: 'vigente' | 'vencido' | 'pendente';
  linkDireto: string; // rota no app para o registro original
  preview?: string; // URL thumbnail ou resumo
  score?: number; // 1-5 sugerido pela IA
}

interface MapeamentoModulo {
  indicadorFR044: number;
  modulosConsultados: string[];
  queryStrategy: 'latest' | 'all_active' | 'date_range' | 'status_filter';
  camposRelevantes: string[];
}
```

### Mapeamento Indicador → Módulo

```typescript
const MAPEAMENTO: MapeamentoModulo[] = [
  {
    indicadorFR044: 6,
    modulosConsultados: ['fornecedores'],
    queryStrategy: 'all_active',
    camposRelevantes: ['contrato', 'vigencia', 'avaliacao'],
  },
  {
    indicadorFR044: 10,
    modulosConsultados: ['equipamentos'],
    queryStrategy: 'all_active',
    camposRelevantes: ['pgt', 'regularizacao', 'rastreabilidade'],
  },
  {
    indicadorFR044: 12,
    modulosConsultados: ['equipamentos'],
    queryStrategy: 'latest',
    camposRelevantes: ['manutencaoPreventiva', 'manutencaoCorretiva', 'calendario'],
  },
  {
    indicadorFR044: 13,
    modulosConsultados: ['equipamentos', 'calibracao'],
    queryStrategy: 'all_active',
    camposRelevantes: ['testeAceitacao', 'testeDesempenho'],
  },
  {
    indicadorFR044: 14,
    modulosConsultados: ['calibracao'],
    queryStrategy: 'all_active',
    camposRelevantes: ['certificado', 'laboratorio', 'validade'],
  },
  {
    indicadorFR044: 15,
    modulosConsultados: ['risks', 'risk-management'],
    queryStrategy: 'latest',
    camposRelevantes: ['mapaFMEA', 'npr', 'acoesMitigadoras'],
  },
  {
    indicadorFR044: 17,
    modulosConsultados: ['personnel'],
    queryStrategy: 'all_active',
    camposRelevantes: ['formacao', 'qualificacao', 'supervisor'],
  },
  {
    indicadorFR044: 18,
    modulosConsultados: ['treinamentos', 'educacao-continuada'],
    queryStrategy: 'date_range',
    camposRelevantes: ['programa', 'registros', 'eficacia'],
  },
];
```

---

## FASES DE IMPLEMENTAÇÃO

---

### FASE 1 — FUNDAÇÃO (Semana 1-2)

**Objetivo:** Backend funcional + persistência real + template FR-044

#### Etapa 1.1 — Cloud Functions (Wave 3 Completion)

**Agente:** Backend Engineer
**Skill:** `/claude-api` (para Cloud Functions Firebase)

Tarefas:

- [ ] Deploy `installChecklistTemplate` — hidrata subcollection de checklist-items a partir do template
- [ ] Deploy `updateChecklistResponse` — persiste resposta individual (conforme/NC/NA + severidade)
- [ ] Deploy `batchSaveResponses` — flush de todas respostas do localStorage para Firestore
- [ ] Deploy `finalizeSession` — calcula counters, muda status, dispara hooks
- [ ] Deploy `deleteAuditoria` / `deleteSessao` / `deleteAchado` (soft-delete)
- [ ] Deploy `createPlanoAcao` — cria plano de ação vinculado ao achado
- [ ] Deploy `registerPresenca` — registra presença em reunião
- [ ] Deploy `createReAuditoria` — cria re-auditoria vinculada

**Verificação:**

- [ ] Testes unitários com Firebase Emulator para cada callable
- [ ] Teste de integração: criar auditoria → instalar template → responder items → finalizar
- [ ] Verificar chain-hash integrity no audit-trail

#### Etapa 1.2 — Template FR-044 (57 indicadores RDC 978/2025)

**Agente:** Domain Expert
**Skill:** `/skill-creator` (para estruturar dados)

Tarefas:

- [ ] Criar `checklistTemplates_FR044.json` com todos 57 indicadores
- [ ] Cada indicador com: numero, descricao, niveis (1-5 com texto completo), marcoRegulatorio, moduloVinculado, aplicabilidade
- [ ] Mapear cada indicador ao módulo HC Quality correspondente
- [ ] Integrar com `checklistTemplateService.ts` existente
- [ ] Manter template DICQ 8ª Ed. existente como opção separada

**Verificação:**

- [ ] Validar 57 indicadores contra Excel FR-044 original
- [ ] Verificar que todos marcos regulatórios estão corretos
- [ ] Testar carregamento do template no emulator

#### Etapa 1.3 — Evidence Aggregator Service

**Agente:** Full-Stack Engineer
**Skill:** `/claude-api`

Tarefas:

- [ ] Criar `src/features/auditoria-interna/services/evidenceAggregatorService.ts`
- [ ] Implementar interface `EvidenciaAgregada`
- [ ] Implementar mapeamento indicador → módulos
- [ ] Para cada módulo vinculado, criar query que retorna evidências relevantes
- [ ] Implementar cache local (5 min TTL) para evitar queries repetidas
- [ ] Criar hook `useEvidenciasAgregadas(indicadorId, labId)`

**Verificação:**

- [ ] Teste com dados reais: indicador 14 (Calibração) deve retornar certificados do módulo calibracao/
- [ ] Teste com módulo vazio: deve retornar array vazio + flag "sem evidências"
- [ ] Performance: < 500ms para agregar de 3 módulos simultâneos

---

### FASE 2 — MOBILE-FIRST UX (Semana 2-3)

**Objetivo:** Tela de execução de auditoria otimizada para tablet/celular em campo

#### Etapa 2.1 — Design System Mobile Audit

**Agente:** UX Designer
**Skills:** `/frontend-design` + UI/UX Pro Max

Princípios:

- Touch-first (botões mínimo 48px)
- Operável com uma mão / caminhando
- Swipe para navegar entre itens
- Bottom sheet para evidências (não sai da tela principal)
- Indicador de progresso sempre visível
- Haptic feedback em ações críticas
- Modo escuro para ambientes com pouca luz

Componentes a criar:

- [ ] `AuditExecutionScreen` — tela principal de execução
- [ ] `ChecklistItemMobile` — card com one-tap conformidade (verde/vermelho/cinza)
- [ ] `EvidenceBottomSheet` — painel deslizante com evidências agregadas
- [ ] `CameraCapture` — captura de foto/vídeo como evidência
- [ ] `AudioRecorder` — gravação de áudio (entrevista)
- [ ] `ProgressHeader` — barra de progresso + filtros rápidos
- [ ] `FindingQuickForm` — formulário rápido de achado (bottom sheet)
- [ ] `OfflineBanner` — indicador de modo offline
- [ ] `SyncStatusIndicator` — status de sincronização

**Verificação:**

- [ ] Testar em dispositivos reais (Android tablet 10", celular 6")
- [ ] Verificar acessibilidade (WCAG 2.1 AA)
- [ ] Testar com uma mão (thumb zone)
- [ ] Testar em modo offline (airplane mode)

#### Etapa 2.2 — Implementação Mobile (React Native)

**Agente:** Mobile Engineer
**Skills:** `/frontend-design`

Tarefas:

- [ ] Criar `hc-quality-mobile/src/screens/AuditScreen.tsx` — lista de auditorias
- [ ] Criar `hc-quality-mobile/src/screens/AuditExecutionScreen.tsx` — execução
- [ ] Criar `hc-quality-mobile/src/screens/AuditSummaryScreen.tsx` — resumo pós-execução
- [ ] Criar componentes mobile em `hc-quality-mobile/src/components/audit/`
- [ ] Integrar com Firestore offline persistence
- [ ] Implementar captura de evidências (câmera, áudio, assinatura)
- [ ] Upload para Firebase Storage com retry em caso de falha
- [ ] Implementar sync queue para modo offline
- [ ] Navegação: Home → Auditorias → Execução → Resumo

**Verificação:**

- [ ] E2E com Detox: fluxo completo de auditoria
- [ ] Teste offline: responder 10 itens → reconectar → verificar sync
- [ ] Teste de upload: foto + áudio + assinatura
- [ ] Performance: scroll suave com 115 itens de checklist

#### Etapa 2.3 — Implementação Web (Responsiva)

**Agente:** Frontend Engineer
**Skills:** `/frontend-design`

Tarefas:

- [ ] Refatorar `SessaoExecucaoPanel` para usar Evidence Aggregator
- [ ] Corrigir AchadoForm (remover IDs placeholder, receber context real)
- [ ] Implementar `EvidencePanel` — painel lateral com evidências agregadas
- [ ] Implementar `ConformityScale` — escala visual 1-5 (FR-044) com descrições
- [ ] Implementar `AuditProgressDashboard` — visão geral do progresso
- [ ] Implementar `CrossModuleLink` — componente que linka para módulo original
- [ ] Responsivo: funcionar em tablet landscape como tela dividida

**Verificação:**

- [ ] Teste em tablet (iPad/Android) landscape
- [ ] Verificar que links cross-module navegam corretamente
- [ ] Testar com template FR-044 completo (57 itens)
- [ ] Verificar persistência real (não mais localStorage only)

---

### FASE 3 — IA CONTEXTUAL (Semana 3-4)

**Objetivo:** Assistente inteligente que sugere conformidade, gera NCs e identifica gaps

#### Etapa 3.1 — Sugestão Automática de Conformidade

**Agente:** AI Engineer
**Skills:** `/claude-api`

Tarefas:

- [ ] Criar `src/features/auditoria-interna/services/aiSuggestionService.ts`
- [ ] Para cada item do checklist, analisar dados do módulo vinculado e sugerir nível (1-5)
- [ ] Lógica de scoring baseada em:
  - Documentos vigentes vs vencidos
  - Registros completos vs incompletos
  - Frequência de atualização
  - Histórico de NCs anteriores no mesmo item
- [ ] Apresentar sugestão como "chip" no ChecklistItemCard (auditor aceita ou rejeita)
- [ ] Cloud Function `generateAISuggestion` usando Claude API
- [ ] Prompt contextual com: item do checklist + dados do módulo + histórico

**Verificação:**

- [ ] Testar com 10 indicadores que têm dados reais nos módulos
- [ ] Verificar que sugestão é coerente (ex: calibração vencida → sugere nível 2-3)
- [ ] Testar com módulo sem dados → deve retornar "sem dados suficientes"
- [ ] Latência < 3s por sugestão

#### Etapa 3.2 — Geração Automática de NC

**Agente:** Backend Engineer
**Skills:** `/claude-api`

Tarefas:

- [ ] Cloud Function `achadoToNC` — quando achado é criado com severidade critica/grave:
  - Auto-cria NC no módulo `nao-conformidades/`
  - Vincula NC ao achado (ncId)
  - Preenche: descrição, requisito violado, evidência, data, auditor
  - Notifica responsável do setor
- [ ] Cloud Function `suggestCAPA` — sugere ação corretiva baseada em:
  - NCs similares anteriores
  - Boas práticas do DICQ
  - Histórico de eficácia de CAPAs anteriores
- [ ] Integrar com módulo `capa-tracking/`

**Verificação:**

- [ ] Criar achado crítico → verificar NC criada automaticamente
- [ ] Verificar que NC tem todos campos obrigatórios preenchidos
- [ ] Verificar vinculação bidirecional (achado ↔ NC)
- [ ] Testar sugestão de CAPA com histórico real

#### Etapa 3.3 — Detecção de Gaps e Recorrência

**Agente:** AI Engineer
**Skills:** `/claude-api`

Tarefas:

- [ ] Cloud Function `detectGaps` — analisa módulos e identifica:
  - Fornecedores sem avaliação nos últimos 12 meses
  - Equipamentos com calibração vencida
  - Treinamentos não realizados no período
  - Documentos sem revisão anual
- [ ] Cloud Function `detectRecurrence` — compara achados atuais com auditorias anteriores:
  - Mesmo item com NC em auditorias consecutivas → flag "recorrente"
  - Sugere escalação de severidade
  - Sugere auditoria focada
- [ ] Dashboard de gaps pré-auditoria (preparação)

**Verificação:**

- [ ] Testar com dados de fornecedor sem avaliação → deve aparecer como gap
- [ ] Testar recorrência: criar 2 auditorias com NC no mesmo item → flag
- [ ] Verificar que gaps são apresentados antes da execução (preparação)

---

### FASE 4 — RELATÓRIO EXECUTIVO PREMIUM (Semana 4-5)

**Objetivo:** PDF profissional que serve como evidência para acreditação

#### Etapa 4.1 — Geração de PDF Server-Side

**Agente:** Backend Engineer
**Skills:** `/pptx` (referência de formatação)

Tarefas:

- [ ] Cloud Function `generateAuditReport` usando PDFKit ou Puppeteer
- [ ] Estrutura do relatório (conforme FR-043 + DICQ):
  1. Capa (logo, data, escopo, equipe auditora)
  2. Resumo Executivo (score geral, gráfico radar por categoria)
  3. Dados da Auditoria (objetivo, escopo, critérios, método)
  4. Reunião de Abertura (participantes, FR-045)
  5. Resultados por Módulo/Bloco (score, itens, achados)
  6. Não Conformidades (lista com severidade, evidência, requisito)
  7. Observações de Melhoria
  8. Pontos Fortes
  9. Plano de Ação (responsável, prazo, status)
  10. Conclusão do Auditor Líder
  11. Reunião de Encerramento
  12. Assinaturas (LogicalSignature)
  13. Anexos (evidências fotográficas, links)
- [ ] Gráficos: radar por categoria, barras por nível, tendência vs auditoria anterior
- [ ] Estilo: premium, cores HC Quality, tipografia profissional

**Verificação:**

- [ ] Gerar PDF com auditoria completa (57 itens) → verificar todas seções
- [ ] Verificar que gráficos renderizam corretamente
- [ ] Verificar que evidências fotográficas aparecem como thumbnails
- [ ] Tamanho do PDF < 10MB
- [ ] Validar com requisitos do FR-043 (formato padrão, descrição detalhada, NCs, prazos)

#### Etapa 4.2 — Dashboard Pós-Auditoria

**Agente:** Frontend Engineer
**Skills:** `/frontend-design`

Tarefas:

- [ ] Tela de acompanhamento pós-auditoria:
  - Status de cada NC (aberta → em tratamento → fechada)
  - Prazos de CAPA com alertas
  - Progresso do plano de ação
  - Comparativo com auditoria anterior
- [ ] Indicadores visuais:
  - Score DICQ atual vs meta (80%)
  - Score RDC 978 vs meta (100%)
  - Tendência (melhorando/piorando)
- [ ] Alertas automáticos:
  - CAPA com prazo vencendo
  - NC sem tratamento há X dias
  - Re-auditoria necessária

**Verificação:**

- [ ] Testar com dados reais de auditoria finalizada
- [ ] Verificar cálculo de scores
- [ ] Verificar alertas de prazo
- [ ] Responsividade em tablet

---

### FASE 5 — QUALIFICAÇÃO DE AUDITORES (Semana 5-6)

**Objetivo:** Controle de competência conforme DICQ/PALC/ISO

#### Etapa 5.1 — Módulo de Auditores

**Agente:** Full-Stack Engineer

Tarefas:

- [ ] Criar `src/features/auditoria-interna/components/AuditorProfile.tsx`
- [ ] Dados do auditor:
  - Formação acadêmica
  - Treinamentos em auditoria (com certificados)
  - Certificações (auditor líder, auditor interno)
  - Competências por escopo (quais módulos pode auditar)
  - Experiência (nº de auditorias realizadas)
  - Validade da qualificação
  - Reciclagens realizadas
  - Avaliações de desempenho
- [ ] Regras de negócio:
  - Auditor não pode auditar área onde tem responsabilidade direta
  - Qualificação vence em 2 anos sem reciclagem
  - Mínimo 1 auditoria/ano para manter qualificação
- [ ] Integrar com módulo `personnel/` existente
- [ ] Vincular com `treinamentos/` para certificados

**Verificação:**

- [ ] Testar regra de impedimento (auditor do setor X não pode auditar setor X)
- [ ] Testar vencimento de qualificação
- [ ] Verificar integração com personnel/

---

### FASE 6 — OFFLINE-FIRST & SYNC (Semana 6-7)

**Objetivo:** Funcionamento completo sem internet

#### Etapa 6.1 — Offline Architecture

**Agente:** Mobile Engineer

Tarefas:

- [ ] Firestore offline persistence (enablePersistence)
- [ ] Queue de operações offline:
  - Respostas de checklist
  - Criação de achados
  - Upload de evidências (foto/áudio)
  - Assinaturas
- [ ] Conflict resolution strategy:
  - Last-write-wins para respostas
  - Merge para achados (não sobrescrever)
  - Retry com backoff para uploads
- [ ] UI indicators:
  - Banner "Modo Offline"
  - Contador de operações pendentes
  - Botão "Sincronizar agora" quando reconectar
- [ ] Checkpoints automáticos a cada 5 respostas

**Verificação:**

- [ ] Teste completo: iniciar auditoria online → desconectar → responder 20 itens → reconectar → verificar sync
- [ ] Teste de conflito: dois auditores editam mesmo item offline
- [ ] Teste de upload: 10 fotos offline → sync → verificar Storage
- [ ] Teste de battery: operação por 2h em modo offline

---

### FASE 7 — INTEGRAÇÃO COMPLETA & POLISH (Semana 7-8)

**Objetivo:** Fluxo end-to-end sem gaps

#### Etapa 7.1 — Fluxo Completo de Auditoria

**Agente:** QA Engineer

Fluxo a validar:

1. **Planejamento** → Criar plano anual → Definir escopo → Selecionar auditores → Comunicar (FR-042)
2. **Preparação** → Dashboard de gaps → Revisar achados anteriores → Carregar template
3. **Reunião Abertura** → Registrar presença (FR-045) → Definir agenda
4. **Execução** → Checklist item a item → Evidências agregadas → Achados → Fotos/áudio
5. **Análise** → Classificar NCs → Gerar planos de ação → IA sugere CAPA
6. **Reunião Encerramento** → Apresentar resultados → Colher assinaturas
7. **Relatório** → Gerar PDF (FR-043) → Enviar por email → Arquivar
8. **Acompanhamento** → Monitorar CAPAs → Re-auditoria se necessário

#### Etapa 7.2 — Testes Exaustivos

**Agente:** QA Engineer

- [ ] Teste E2E web: fluxo completo com 57 indicadores
- [ ] Teste E2E mobile: fluxo completo em tablet
- [ ] Teste de carga: 5 auditorias simultâneas
- [ ] Teste de segurança: verificar Firestore rules (append-only, soft-delete)
- [ ] Teste de integridade: chain-hash não quebra após edições
- [ ] Teste de regressão: módulos existentes continuam funcionando
- [ ] Teste de acessibilidade: screen reader, contraste, touch targets
- [ ] Teste cross-browser: Chrome, Safari, Firefox (web)
- [ ] Teste cross-device: Android 10"+, iOS iPad, celular 6"

#### Etapa 7.3 — Performance & Otimização

**Agente:** Performance Engineer

- [ ] Lazy loading de evidências agregadas
- [ ] Virtualização de lista (115 itens sem lag)
- [ ] Compressão de imagens antes do upload (max 1MB)
- [ ] Índices Firestore otimizados para queries de auditoria
- [ ] Bundle splitting para módulo de auditoria
- [ ] Prefetch de dados do próximo item durante scroll

---

## ESTRATÉGIA DE AGENTES (Multi-Agent Execution)

### Distribuição de Trabalho por Agente

| Agente                | Responsabilidade                            | Skills Utilizadas                 | Fases   |
| --------------------- | ------------------------------------------- | --------------------------------- | ------- |
| **Backend Engineer**  | Cloud Functions, Firestore, Security Rules  | `/claude-api`                     | 1, 3, 4 |
| **Mobile Engineer**   | React Native screens, offline, camera/audio | `/frontend-design`                | 2, 6    |
| **Frontend Engineer** | React web components, responsividade        | `/frontend-design`                | 2, 4    |
| **UX Designer**       | Design system, protótipos, acessibilidade   | `/frontend-design`, UI/UX Pro Max | 2       |
| **AI Engineer**       | Claude API integration, prompts, scoring    | `/claude-api`                     | 3       |
| **Domain Expert**     | Templates, mapeamentos, validação DICQ/RDC  | `/skill-creator`                  | 1       |
| **QA Engineer**       | Testes E2E, integração, regressão, carga    | —                                 | 7       |

### Protocolo de Verificação (Cada Etapa)

```
1. Implementar código
2. Escrever testes (unit + integration)
3. Rodar testes localmente (Firebase Emulator)
4. Code review (outro agente)
5. Testar manualmente no dispositivo alvo
6. Verificar que não quebrou módulos existentes (regression)
7. Documentar decisões arquiteturais
8. Marcar etapa como concluída
```

### Critérios de Aceite por Fase

| Fase | Critério de Aceite                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | Todas Cloud Functions deployam sem erro. Template FR-044 carrega. Evidence Aggregator retorna dados de 3+ módulos. |
| 2    | Auditor consegue executar checklist completo em tablet (57 itens) com evidências visíveis.                         |
| 3    | IA sugere conformidade para 80%+ dos itens com dados disponíveis. NC auto-criada para achados críticos.            |
| 4    | PDF gerado com todas 13 seções. Dashboard mostra scores corretos.                                                  |
| 5    | Auditor com qualificação vencida é bloqueado. Impedimento funciona.                                                |
| 6    | Auditoria completa funciona 100% offline com sync posterior sem perda de dados.                                    |
| 7    | Fluxo E2E sem bugs. Performance < 2s por tela. Zero regressões.                                                    |

---

## MAPEAMENTO CROSS-MODULE DETALHADO

### Como cada módulo HC Quality alimenta a auditoria:

#### `fornecedores/` → Indicadores 6, 7, 8, 9

```
Evidências puxadas:
- Lista de fornecedores ativos com status de qualificação
- Contratos vigentes (data início/fim, escopo)
- Última avaliação de desempenho (score, data)
- Documentos de regularidade sanitária
- Auditorias realizadas em fornecedores
```

#### `equipamentos/` → Indicadores 10, 12, 13

```
Evidências puxadas:
- Inventário completo de equipamentos
- Calendário de manutenção preventiva (próxima/última)
- Registros de manutenção corretiva
- Testes de aceitação realizados
- PGT (Plano de Gerenciamento de Tecnologias)
```

#### `calibracao/` → Indicador 14

```
Evidências puxadas:
- Certificados de calibração (vigentes/vencidos)
- Laboratório calibrador (acreditado ou não)
- Periodicidade vs recomendação do fabricante
- Histórico de calibrações
```

#### `risks/` + `risk-management/` → Indicador 15

```
Evidências puxadas:
- Mapa FMEA atual (P×S×D)
- Riscos críticos/altos identificados
- Ações mitigadoras implementadas
- Indicadores de monitoramento
- Última revisão do mapa
```

#### `treinamentos/` + `educacao-continuada/` → Indicadores 18, 19

```
Evidências puxadas:
- Programa de educação permanente vigente
- Registros de treinamento (data, carga horária, conteúdo, instrutor)
- Avaliações de eficácia
- Certificados
- Gaps de treinamento identificados
```

#### `personnel/` → Indicadores 4, 17

```
Evidências puxadas:
- Registro de RT e substituto
- Dimensionamento de equipe
- Formação e qualificação de cada profissional
- Descrição de cargos
- Supervisores por turno
```

#### `nao-conformidades/` → Indicadores transversais

```
Evidências puxadas:
- NCs abertas (pendentes de tratamento)
- NCs fechadas no período
- Tempo médio de resolução
- Recorrência por categoria
- Eficácia das ações corretivas
```

#### `capa-tracking/` → Indicadores transversais

```
Evidências puxadas:
- CAPAs em andamento
- CAPAs concluídas com verificação de eficácia
- Prazos cumpridos vs atrasados
- Vinculação com NCs de origem
```

#### `sgq/` + `sgd/` → Indicador 16

```
Evidências puxadas:
- Lista mestra de documentos
- Documentos com revisão pendente
- Controle de versões
- Documentos obsoletos identificados
- Backup e controle eletrônico
```

#### `notivisa-portal/` → Indicador 11

```
Evidências puxadas:
- Notificações enviadas ao Notivisa
- Investigações realizadas
- Medidas preventivas adotadas
- Avaliação de efetividade
```

#### `controle-temperatura/` → Indicadores de infraestrutura

```
Evidências puxadas:
- Registros de temperatura (geladeiras, ambiente)
- Alertas de desvio
- Ações corretivas para desvios
- Calibração de termômetros
```

#### `ciq-imuno/` + `bioquimica/` + `coagulacao/` → Indicadores analíticos

```
Evidências puxadas:
- Gráficos Levey-Jennings
- Regras de Westgard aplicadas
- Ações corretivas para CIQ fora
- Participação em ensaios de proficiência
- Resultados de controle externo
```

---

## CRONOGRAMA RESUMIDO

| Semana | Fase               | Entregável Principal                                    |
| ------ | ------------------ | ------------------------------------------------------- |
| 1-2    | Fase 1 — Fundação  | Cloud Functions + Template FR-044 + Evidence Aggregator |
| 2-3    | Fase 2 — Mobile UX | Telas mobile + web responsiva funcionais                |
| 3-4    | Fase 3 — IA        | Sugestões automáticas + auto-NC + detecção de gaps      |
| 4-5    | Fase 4 — Relatório | PDF premium + dashboard pós-auditoria                   |
| 5-6    | Fase 5 — Auditores | Qualificação + impedimentos + competências              |
| 6-7    | Fase 6 — Offline   | Sync completo + conflict resolution                     |
| 7-8    | Fase 7 — Polish    | Testes exaustivos + performance + deploy                |

---

## REFERÊNCIAS

- **prompt_auditoria_interna_sgq.md** — Especificação completa do módulo
- **Formulário 044 - Auditoria Interna.xlsx** — 57 indicadores RDC 978/2025
- **PQ-24 Auditoria Interna** — Procedimento operacional do laboratório
- **FR-042 Programação de Auditoria Interna** — Modelo de comunicado
- **FR-043 Relatório de Auditoria Interna** — Estrutura do relatório
- **Módulo 3.0 Zero à Acreditação (Slides 1-4)** — Conceitos, planejamento, metodologia
- **Módulo 3.1 Zero à Acreditação (Slides 1-2)** — Condutas, competências, técnicas
- **HC_Quality_Checklist_Auditoria.md** — Checklist DICQ 8ª Ed. (~115 itens)
- **Manual DICQ 8ª Edição** — Requisitos seções 4 e 5
- **RDC 978/2025 ANVISA** — 57 artigos auditáveis
- **ISO 15189:2022** — Requisitos para laboratórios clínicos

---

## NOTAS DE IMPLEMENTAÇÃO

### Prioridade absoluta:

1. **Fase 1** (sem backend funcional, nada mais funciona)
2. **Fase 2** (sem UX mobile, auditor não usa em campo)
3. **Fase 4** (sem relatório, auditoria não tem valor documental)

### Pode ser paralelo:

- Fase 3 (IA) pode rodar em paralelo com Fase 2 (Mobile)
- Fase 5 (Auditores) pode rodar em paralelo com Fase 4 (Relatório)

### Dependências:

- Fase 6 (Offline) depende de Fase 1 + 2 estarem completas
- Fase 7 (Polish) depende de todas as outras

### Meta DICQ:

- Auditoria interna funcional é **Tier-1 Blocker** para acreditação
- Deadline: sistema operacional antes de 2026-08-15 (pré-auditoria interna)
- Auditoria externa DICQ/SBAC: 2026-10-15

---

_Documento gerado em 2026-05-13 | HC Quality v1.4 | Módulo Auditoria Interna_
