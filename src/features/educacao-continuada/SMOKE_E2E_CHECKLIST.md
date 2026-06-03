# Smoke E2E — Educação Continuada (manual)

Roteiro para validar o módulo fim-a-fim em produção com dado real. Nunca foi feito.
Tempo estimado: **45–60 min** ininterruptos. Chrome/Edge com DevTools aberto.

**Por que ininterruptos:** RN-05 depende do batch atomic registrar execução realizada → participantes → alerta. Pausar entre passos fragmenta timestamps e confunde validação.

## Preparação

1. Login em https://hmatologia2.web.app com user que tenha claim `'educacao-continuada'`
2. **DevTools aberto** durante todo o teste:
   - **Network** filtrado por `cloudfunctions.net` — toda escrita regulatória deve bater em callables `ec_*`
   - **Console** — erros PT das callables aparecem aqui
3. **Prefixo em todos os dados de teste:** `SMOKE-2026-04-XX-*` (facilita cleanup manual depois)
4. Chrome-aba-anônima separada para teste de QR público ao final (passo 7)

## Sequência (7 passos)

### 1. Cadastro base via XLSX (Fases 1+2)

- Tab **Planejamento** → "Baixar modelo" treinamentos
- Preenche linha:
  - Título: `SMOKE-2026-04-XX-Biossegurança`
  - Tema: `Biossegurança`, Carga: `2`, Modalidade: `presencial`, Unidade: `fixa`, Responsável: `Tester`, Periodicidade: `anual`, Ativo: `SIM`
  - Datas Planejadas: `01/05/2026; 01/11/2026`
- Salva → "Importar XLSX" → drag&drop → confirma
- **Verifica:** 1 treinamento criado + 2 execuções planejadas aparecem no Cronograma (bolinhas azuis)
- **Network esperado:** `ec_mintSignature` em lote (1 call por linha do XLSX)

### 2. Biblioteca de template + upload PDF (Fase 6)

- Tab Planejamento → **Biblioteca** → segment "Templates" → "Novo template"
- Preenche: título, tema, objetivo, carga 2h, modalidade presencial, periodicidade anual, pauta, tags `biossegurança, rdc978`
- **Materiais didáticos** → "+ PDF" → seleciona PDF local (≤50MB)
  - **Verifica progress bar chegando a 100%**
  - **Network esperado:** upload pra `educacaoContinuada/{labId}/materiais/{template}/...` no Storage
- Salva template
- Abre o template criado → scroll até seção Materiais → confirma que PDF renderiza inline (iframe PDF nativo do browser)

### 3. Trilha + RN-08 server-side (Fase 7)

- Planejamento → **Onboarding** → "Nova trilha"
- Preenche: nome `SMOKE Onboarding Biomédico`, cargo `Biomédico-SMOKE`, adiciona 1 etapa apontando pro template criado no passo 2, prazo 30d, obrigatória
- Salva trilha
- Tab **Colaboradores** → "+ Novo" → nome `SMOKE-2026-04-XX-João`, cargo `Biomédico-SMOKE` (mesmo da trilha!), setor `Hematologia`, Ativo ✓
- **Aguarda ~3–5s** (trigger `ec_onColaboradorCreated` propagar)
- Volta pro Onboarding → seção "Progressos em andamento"
- **Verifica:** aparece "João — SMOKE Onboarding Biomédico" com 0% concluído
- **Backend esperado (Firebase Console → Firestore → `auditLogs`):** action `EC_RN08_TRIGGER_STARTED` com payload `{colaboradorId, trilhaId, progressoId}`

### 4. Execução realizada + avaliações (Fases 0b + 3 + 4)

- Tab **Execuções** → encontra `SMOKE-2026-04-XX-Biossegurança` de 01/05/2026 → "Editar"
- Muda status para **Realizado** → data de aplicação = hoje → ministrante "Tester" → pauta "Revisão RDC 978"
- Abre "Participantes" → marca João como **Presente** → salva
- **Network esperado:** 1 call a `ec_commitExecucaoRealizada`; no payload: `presencas[{colaboradorId: João, presente: true}]`
- **Verifica:** execução agora "realizado"; aparece 1 alerta de vencimento em 2027-05-01 (RN-05)
- Clique em "Avaliar eficácia" → resultado `eficaz`, evidência `teste smoke`, data hoje → salva (sem fechar) → "Fechar avaliação"
- Clique em "Avaliar competências" → escolhe João → método `observação_direta`, resultado `aprovado`, evidência `aprovado no teste smoke`
- **Verifica:** avaliação salva; abrir Prontuário do João — aparece avaliação aprovada + botão "Gerar certificado" disponível

### 5. Banco de questões + teste (Fase 8, RN-10)

- Planejamento → **Questões** → escolhe o template criado no passo 2
- "Nova questão" — tipo `múltipla_escolha`, enunciado `Qual a principal norma de biossegurança em laboratório clínico?`, pontuação 1
  - Opções: marca "RDC 978/2025" como correta, "RDC 100" e "NR 32" como erradas
- Salva
- **Backend verifica (Firestore Console):** coleção `/educacaoContinuada/{labId}/questoes/{id}` doc **SEM** campo `correta`; coleção `/educacaoContinuada/{labId}/questoesGabarito/{mesmoId}` doc **COM** `opcoesCorretas: [optId]`. **Tentar `read` em `questoesGabarito` no console JS do browser deve falhar com permission-denied**
- (Opcional — requer UI mais evoluída para TesteForm) Submeter teste via callable manual no console:
  ```js
  const fn = firebase.functions('southamerica-east1').httpsCallable('ec_submeterTeste');
  await fn({
    labId: 'SEU_LAB',
    execucaoId: '...',
    colaboradorId: '...',
    respostas: [{ questaoId: '...', opcaoId: 'opt-1' }],
  });
  ```

### 6. Certificado + QR público (Fase 9)

- Prontuário do João → "Gerar certificado" ao lado da avaliação aprovada
- **Aguarda ~3–5s** (callable gera PDF + QR + upload)
- Botão troca para "Certificado emitido" com links "Baixar PDF" e "Verificar QR"
- Click "Baixar PDF" → abre em nova aba → confere:
  - Nome do colaborador, treinamento, carga horária, data
  - QR code canto inferior esquerdo
  - Rodapé personalizado
- **Abre aba anônima** (sem auth) → cola URL do "Verificar QR" → confere: página HTML "Certificado válido" com dados básicos. Zero auth necessária.

### 7. Config alertas email (Fase 9)

- Planejamento → **Config**
- Alertas: dias de antecedência `30`, emailResponsavel ✓, horaEnvio `08:00`, emailsCopia `seu-email@test.com`
- Certificado: nomeDoLab, textoRodape
- Salva
- **Verifica:** no Firestore Console aparecem docs em `educacaoContinuada/{labId}/configAlertas/config` e `.../certificadoConfig/config`
- Alertas reais são enviados diariamente às 08:00 SP pela scheduled CF `ec_scheduledAlertasVencimento`. Pode forçar imediato via Firebase Console → Functions → triggera manual o scheduled (ou aguarda 24h e confere inbox)

## Cleanup pós-smoke

Dados ficam no tenant. Para limpar tudo prefixado `SMOKE-2026-04-XX-*`:

1. Arquivar via UI: Tab Colaboradores arquiva João; Planejamento arquiva Biossegurança; Biblioteca arquiva template; Onboarding arquiva trilha
2. Cancelar execução planejada restante (01/11/2026) via ExecucaoForm status → cancelado
3. Certificado PDF fica no Storage — deletar manualmente via Firebase Console se desejar

## Critérios de aceite

- ✅ Todos os 7 passos sem erros vermelhos no console
- ✅ Cada ação regulatória bate em callable `ec_*` (não escreve direto no Firestore)
- ✅ QR code gera página válida em aba anônima
- ✅ `questoesGabarito` bloqueia leitura client (RN-10)
- ✅ RN-08 trigger dispara em <10s da criação do colaborador

Se algum falhar, reportar: passo #, mensagem exata do console, URL da callable no Network.

## Log de execução

Quando rodar, anotar abaixo:

```
Data: ____/____/_____
Executor: _______________
Lab: _______________
Resultado: PASS / FAIL
Observações:
```
