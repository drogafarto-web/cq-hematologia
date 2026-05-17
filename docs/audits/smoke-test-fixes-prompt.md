# Prompt de Implementação — Correções Auditoria Geral (Multi-Agente)

> **Formato:** Claude Code multi-agent  
> **Contexto:** Smoke test E2E revelou 6 blocos de melhoria no módulo Auditoria Geral  
> **Estratégia:** Paralelizar ondas independentes, verificar em sequência  
> **Documentação de referência:** `docs/audits/smoke-test-fixes-prompt.md`, `docs/audits/smoke-test-auditoria-geral-2026-05-15.md`

---

## Fase 0 — Exploração (Leia primeiro)

Antes de qualquer alteração, execute:

```bash
# 1. Leia o código fonte do módulo
claude -p "Leia src/features/auditoria-geral/services/auditoriaGeralService.ts e me dê um resumo das funções CRUD e seus contratos"
claude -p "Leia src/features/auditoria-geral/types/index.ts e extraia o tipo StatusAuditoria"
claude -p "Leia storage.rules e firestore.rules e identifique se existem regras para o path auditoria-geral/"

# 2. Leia os achados do smoke test
cat docs/audits/smoke-test-auditoria-geral-2026-05-15.md

# 3. Verifique o estado atual do Firestore (se tiver acesso)
# firebase firestore:export --collection-ids auditoria-geral
```

---

## Onda 1 — Paralela (3 agentes simultâneos)

Execute os 3 agentes abaixo **em paralelo**. Cada um é independente e pode ser verificado separadamente.

### Agente 1.1 — Fluxo de Conclusão

```
Arquivos:
  - src/features/auditoria-geral/types/index.ts
  - src/features/auditoria-geral/services/auditoriaGeralService.ts
  - src/features/auditoria-geral/components/WizardAuditoria.tsx
  - src/features/auditoria-geral/components/AuditoriasDashboard.tsx
  - src/features/auditoria-geral/hooks/useScoreCalculator.ts

Implementação:

1. Em types/index.ts, adicione 'finalizada' ao union type StatusAuditoria

2. Em auditoriaGeralService.ts, crie a função:
   async function finalizarAuditoria(labId: string, auditoriaId: string): Promise<{ scoreFinal: number }>
   - Verificar se respostas = 57/57 (use subscribeRespostas ou query direta)
   - Se incompleto, lance erro "Auditoria incompleta: X indicadores pendentes"
   - Calcular scoreFinal usando useScoreCalculator ou lógica inline
   - Atualizar doc: { status: 'finalizada', dataFim: Timestamp.now(), scoreFinal }
   - Se já finalizada, lance erro "Auditoria já finalizada"

3. Em WizardAuditoria.tsx:
   - Quando progresso === 57/57, renderize banner verde:
     "Todos os 57 indicadores foram respondidos. Deseja finalizar?"
   - Botão "Finalizar Auditoria" (primário, bg-emerald-600)
   - Modal de confirmação: "Após finalizada, não será possível editar"
   - On confirm: chama finalizarAuditoria, mostra toast, redireciona ao painel

4. Em AuditoriasDashboard.tsx:
   - Card: badge azul "Em andamento" / badge verde "Finalizada"
   - Auditorias finalizadas: botão "Ver relatório PDF"
   - Score médio do dashboard agora inclui apenas finalizadas

Verificação:
  npx vitest run src/__tests__/auditoria/reportPDF.test.ts
  cd e2e && npx playwright test auditoria.spec.ts --grep "fluxo de conclusão"
```

### Agente 1.2 — Firebase Storage Rules

```
Arquivos:
  - storage.rules (raiz do projeto)
  - src/features/auditoria-geral/components/IndicadorCard.tsx
  - src/features/auditoria-geral/services/auditoriaGeralService.ts

Problema: Upload de arquivos retorna HTTP 403. Path:
  auditoria-geral/{labId}/{auditoriaId}/{indicadorId}/{uuid}.pdf

Implementação:

1. Em storage.rules, adicione ou corrija:
   ```
   match /auditoria-geral/{labId}/{auditoriaId}/{indicadorId}/{fileName} {
     allow read: if request.auth != null;
     allow create: if request.auth != null
       && request.resource.size < 10 * 1024 * 1024;
     allow delete: if request.auth != null;
   }
   ```

2. Em IndicadorCard.tsx:
   - Capture erro 403 no upload e exiba toast "Sem permissão para upload"

3. Em auditoriaGeralService.ts (função uploadFotoEvidencia):
   - Adicione try/catch com log estruturado
   - Se upload falhar, propague erro para o componente

Verificação:
  # Teste manual: subir PDF de 2KB no indicador 1, verificar console
  npx firebase emulators:start --only storage
  # Verificar se regra permite upload autenticado
```

### Agente 1.3 — Observação Obrigatória p/ NC

```
Arquivos:
  - src/features/auditoria-geral/components/IndicadorCard.tsx

Problema: Selecionar "Não Conforme" não exige justificativa.

Implementação:

1. Em IndicadorCard.tsx:
   - Quando julgamento === 'nao_conforme':
     - Abra campo de observação (se colapsado) via setShowObservacao(true)
     - Adicione required: observacao.trim().length > 0
     - Renderize aviso vermelho: "Justifique a não conformidade" se vazio
   - Bloqueie navegação (Próximo indicador) se NC sem observação
   - Se trocar para Conforme/Não Aplica, campo volta a ser opcional

Verificação:
  cd e2e && npx playwright test auditoria.spec.ts --grep "observação obrigatória"
```

---

## Onda 2 — Dependente (executar após Onda 1)

### Agente 2.1 — Renderização Modo Guiado (BUG)

```
Depende de: Onda 1 ter sido concluída (especialmente o fluxo de finalização)

Arquivos:
  - src/features/auditoria-geral/components/WizardGuidedMode.tsx
  - src/features/auditoria-geral/components/WizardBlocoStep.tsx
  - src/features/auditoria-geral/components/SidebarBlocos.tsx
  - src/features/auditoria-geral/hooks/useAuditoriaGeral.ts

Problema: Blocos B, D, E, G-L não renderizam no modo Guiado ao navegar via sidebar.

Implementação:

1. Em useAuditoriaGeral.ts:
   - Exponha isRespostasReady: boolean
   - Só defina como true após subscribeRespostas emitir primeiro snapshot
     E blocoAtivo estar definido

2. Em SidebarBlocos.tsx:
   - Estado isNavigating: boolean
   - OnClick bloco: set isNavigating = true
   - isRespostasReady ? set isNavigating = false
   - Botão desabilitado + opacidade 50% durante navegação

3. Em WizardGuidedMode.tsx:
   - Se isNavigating && !isRespostasReady:
     Renderize 4x skeleton com animate-pulse (w-full h-16 bg-slate-100 rounded)
   - Quando ready: fade in com opacity transition 200ms

4. Em WizardBlocoStep.tsx:
   - Adicione console.debug em DEV: '[WizardBlocoStep] bloco:', blocoId, 'respostas:', length

Verificação:
  Teste manual: navegar 12 blocos A→L e L→A, 3 ciclos
  cd e2e && npx playwright test auditoria.spec.ts --grep "renderização guiado"
```

### Agente 2.2 — Salvamento Explícito (UX)

```
Depende de: Nenhuma

Arquivos:
  - src/features/auditoria-geral/components/WizardAuditoria.tsx
  - src/features/auditoria-geral/components/WizardGuidedMode.tsx
  - src/shared/components/ui/Toast.tsx

Implementação:

1. Em WizardAuditoria.tsx e WizardGuidedMode.tsx:
   - Estado savingStatus: 'idle' | 'saving' | 'saved' | 'error'
   - Envolva saveResposta com try/catch + savingStatus
   - Indicador canto superior direito:
     - 'saving': SVG spinner 16px + "Salvando..."
     - 'saved': check verde + "Salvo" (fade out 2s)
     - 'error': alerta + "Erro ao salvar"
   - role="status", aria-live="polite"

2. Botão "Salvar tudo" no topo do Expert mode:
   - Percorre respostas modificadas localmente
   - Promise.allSettled com cada saveResposta
   - Toast "X respostas salvas, Y falhas"

Verificação:
  cd e2e && npx playwright test auditoria.spec.ts --grep "salvamento explícito"
```

---

## Onda 3 — Testes E2E (executar após Ondas 1 e 2)

### Agente 3.1 — Atualizar Testes

```
Arquivos:
  - e2e/auditoria.spec.ts
  - src/__tests__/auditoria/reportPDF.test.ts

Implementação:

Em e2e/auditoria.spec.ts, adicione 5 casos:

1. "Renderização Guiado — navega 12 blocos com sucesso"
   - Login → abrir auditoria → modo Guiado
   - Para cada bloco A-L: clicar sidebar, verificar data-testid="indicador-card"
   - Timeout 5s por bloco

2. "Salvamento explícito — botão Salvar tudo com toast"
   - Preencher 3 indicadores no Expert mode
   - Clicar "Salvar tudo"
   - Verificar toast "Salvo"

3. "Fluxo de conclusão — finalizar auditoria completa"
   - Preencher 57/57
   - Clicar "Finalizar Auditoria"
   - Confirmar modal
   - Verificar status "Finalizada" no painel

4. "Observação obrigatória para Não Conforme"
   - Selecionar "Não Conforme"
   - Tentar navegar sem observação
   - Verificar bloqueio (botão disabled + aviso visível)

5. "Edição negada após finalização"
   - Auditoria finalizada não pode ser editada
   - Verificar botões de score disabled

Verificação:
  npx vitest run src/__tests__/auditoria/reportPDF.test.ts
  npx playwright test e2e/auditoria.spec.ts
  Expect: 5/5 verdes
```

---

## Checklist de Verificação Final

Execute APENAS após todas as ondas acima terem passado.

### 🔲 Funcional

- [ ] Auditoria 57/57 pode ser finalizada via botão "Finalizar Auditoria"
- [ ] Status muda para "Finalizada" com score calculado
- [ ] Auditoria finalizada NÃO pode ser editada
- [ ] Upload de PDF retorna 200 (não 403)
- [ ] "Não Conforme" exige observação obrigatória
- [ ] "Não Conforme" sem observação bloqueia navegação

### 🔲 UX

- [ ] Toast "Salvo" aparece após cada resposta
- [ ] Botão "Salvar tudo" no Expert mode
- [ ] Badge verde "Finalizada" vs badge azul "Em andamento"
- [ ] Banner verde "Deseja finalizar?" ao atingir 57/57
- [ ] Skeleton loader no modo Guiado durante navegação

### 🔲 Navegação

- [ ] 12 blocos A-L renderizam SEMPRE na primeira tentativa (modo Guiado)
- [ ] 3 ciclos completos A→L e L→A sem tela branca

### 🔲 Persistência

- [ ] Respostas mantidas após reabertura
- [ ] Score mantido após reabertura
- [ ] Edição pós-finalização bloqueada no Firestore rules

### 🔲 Testes

- [ ] `npx vitest run src/__tests__/auditoria/reportPDF.test.ts` = pass
- [ ] `npx playwright test e2e/auditoria.spec.ts` = 5/5 pass
- [ ] `npm run typecheck` = 0 errors
- [ ] `npm run lint` = sem novas warnings (baseline 88)

### 🔲 Storage

- [ ] `firebase deploy --only storage` = sem erro
- [ ] Upload via UI = 200, arquivo no console Firebase Storage
- [ ] Arquivo aparece vinculado ao indicador na UI

---

## Comandos de Verificação Contínua

```bash
# Após cada agente
npm run typecheck
npm run lint

# Após Onda 1 completa
npx vitest run src/__tests__/auditoria/reportPDF.test.ts
npx playwright test e2e/auditoria.spec.ts --grep "fluxo de conclusão|observação"

# Após Onda 2 completa
npx playwright test e2e/auditoria.spec.ts --grep "renderização guiado|salvamento explícito"

# Final
npx playwright test e2e/auditoria.spec.ts
npm run typecheck && npm run lint
```

---

## Rollback

Se qualquer verificação falhar:

```bash
git checkout -- src/features/auditoria-geral/
git checkout -- e2e/auditoria.spec.ts
git checkout -- storage.rules
```

Cada agente produziu mudanças isoladas. Reverta apenas o agente com falha, não o conjunto inteiro.
