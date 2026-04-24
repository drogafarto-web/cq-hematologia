---
name: hc-quality-smoke
description: Teste de fumaça end-to-end do HC Quality (sistema de CIQ laboratorial em produção). Navega todos os módulos (Hematologia, CIQ-Imuno, Coagulação, Uroanálise, Insumos, Equipamentos, BulaParser, Reports, Admin), executa fluxos críticos com imagens reais de corridas + mocks, e entrega relatório por critério de aceite com evidência em screenshot. Requer Playwright.
location: workspace
---

# HC Quality — Smoke Test End-to-End

> **Role**: QA engineer senior com 10+ anos de experiência em apps React/Firebase.
> **Missão**: validar que o HC Quality em produção não quebrou após a última rodada de mudanças (Ondas 1-5 de correção + anexo operacional do email diário).
> **Princípio**: cada asserção tem evidência. Nada se "assume". Se um fluxo depende de IA (OCR), valida apenas que a chamada foi feita e que uma resposta chegou — não valores exatos.

---

## 0. Configuração (o usuário preenche antes de rodar)

```
BASE_URL               = https://hmatologia2.web.app
TEST_USER_EMAIL        = [preencha — conta já cadastrada no lab de teste]
TEST_USER_PASSWORD     = [preencha]
TEST_LAB_NAME          = [preencha — ex: "LabClin Rio Pomba MG"]
WHATSAPP_IMAGES_DIR    = [preencha — ex: C:\Users\labcl\Downloads\WhatsApp\2026-04-18]
OUTPUT_DIR             = ./smoke-results/$(date +%Y-%m-%d_%H-%M)
```

> **Importante**: durante o período de testes, o CTO pode ter rodado `grantTemporarySuperAdminToAll`. Nesse caso qualquer user cadastrado é SuperAdmin — simplifica o teste (você vê menus extras). Se a tela tiver o badge "Super Admin" no canto, está na conta certa.

---

## 1. Pré-requisitos e ambiente

1. Instale o browser driver:
   ```bash
   npx playwright install chromium
   ```

2. Crie o diretório de output:
   ```bash
   mkdir -p "$OUTPUT_DIR/screenshots" "$OUTPUT_DIR/videos"
   ```

3. Abra o Chromium em modo NÃO-headless na primeira execução pra confirmar visualmente que o app carrega. Nas próximas pode ser headless.

4. **Regra de ouro**: **nunca delete** nenhum registro criado pelo teste. Deixa pra limpeza manual do CTO. Você só CRIA com prefix `SMOKE_` no nome pra facilitar filtragem depois.

---

## 2. Estrutura do relatório de saída

Ao final, grava `$OUTPUT_DIR/REPORT.md` com:

```
# Smoke Test HC Quality — {data}

## Sumário
- Total de fluxos: N
- Passou: X
- Falhou: Y
- Bloqueado (dependência externa): Z

## Resultado por fluxo
### ✅ [F01] Login e seleção de lab
- Duração: 3.2s
- Evidência: screenshots/f01-ready.png
- Assertions: 4/4

### ❌ [F05] CIQ-Imuno — registrar run com strip
- Duração: 8.1s
- Falha: botão "Confirmar" não ficou habilitado após upload
- Evidência: screenshots/f05-fail.png
- Stack: ...

[...]

## Detalhes por módulo
[logs + screenshots]
```

---

## 3. Fluxos de teste (ordenados por criticidade)

### F01 — Login e seleção de lab (BLOQUEADOR — se falhar, aborta tudo)

**Steps**:
1. `page.goto(BASE_URL)` — espera document ready
2. Screenshot: `f01-01-landing.png`
3. Se aparecer LoginScreen:
   - Preenche input com label "E-mail" → `TEST_USER_EMAIL`
   - Preenche input com label "Senha" → `TEST_USER_PASSWORD`
   - Clica botão com texto "Entrar"
4. Espera até um dos estados:
   - EmailVerificationScreen (fail — mandar email)
   - FirstLabSetupScreen (fail — user sem lab)
   - PendingLabAccessScreen (fail — access pending)
   - LabSelectorScreen (clica no lab `TEST_LAB_NAME`)
   - ModuleHub (ready ✅)
5. Screenshot: `f01-02-ready.png`

**Assertions**:
- [ ] Status HTTP do `BASE_URL` é 200
- [ ] Após login, URL contém `hmatologia2.web.app` (não redirecionou pra auth provider externa)
- [ ] ModuleHub visível (existe texto "Hematologia" + "Coagulação" + "Uroanálise" + "CIQ-Imuno")
- [ ] Nome do usuário aparece no canto superior direito

**Se falhar**: aborta tudo com `REPORT.md` só com F01. Sem login não tem smoke.

---

### F02 — Navegação ampla (sanity check de roteamento)

**Steps**:
1. No ModuleHub, itera pelas views e clica em cada uma, tira screenshot, volta pro hub.
2. Views a visitar (clica no botão com o texto exato):
   - "Hematologia" → `f02-01-hematologia.png`
   - "Coagulação" → `f02-02-coagulacao.png`
   - "Uroanálise" → `f02-03-uroanalise.png`
   - "CIQ-Imuno" → `f02-04-ciq-imuno.png`
   - "Importar bula PDF" → `f02-05-bulaparser.png`
   - "Relatórios" → `f02-06-reports.png`
   - "Insumos" → `f02-07-insumos.png`
   - "Configurações" → `f02-08-settings.png` (pode não aparecer se não for admin/owner)
   - "Super Admin" / "Painel Super Admin" → `f02-09-superadmin.png` (só SuperAdmin)

**Assertions por view**:
- [ ] Nenhum erro runtime no console (`console.error` count == 0)
- [ ] Nenhuma mensagem "Something went wrong" / "Erro inesperado" visível
- [ ] Página renderizou algum conteúdo não-vazio (body tem > 500 chars de texto)
- [ ] Toast de erro NÃO apareceu automaticamente

**Reporte**: lista das views que abriram OK e quais falharam.

---

### F03 — Hematologia: registrar corrida via OCR (USA SUAS IMAGENS)

**Setup**:
1. Clica "Hematologia" na Hub.
2. Se dropdown LotSwitcher mostrar "Selecione um lote", escolhe qualquer lote existente. Se nenhum existir → marca fluxo como BLOQUEADO com nota "nenhum lote cadastrado pra testar run".

**Steps (usa imagem real do WhatsApp)**:
1. Clica botão "Nova Corrida" (ou "Registrar corrida" / "+ Corrida" — qualquer variante visível)
2. Screenshot: `f03-01-form.png`
3. Upload: pega a primeira imagem de `$WHATSAPP_IMAGES_DIR/*.jpg|*.jpeg|*.png` — deve ser um screen do Yumizen H550
4. Espera o toast "Processando imagem…" ou equivalente aparecer e sumir (timeout 60s)
5. Screenshot: `f03-02-extracted.png` — deve mostrar os 17 analitos preenchidos (RBC, HGB, HCT, MCV, MCH, MCHC, RDW, PLT, MPV, PDW, PCT, WBC, NEU#, LYM#, MON#, EOS#, BAS#)
6. NÃO clica "Confirmar" (pra não poluir os dados reais). Clica "Cancelar" ou fecha o modal.

**Assertions**:
- [ ] Toast de erro NÃO apareceu durante upload
- [ ] Pelo menos 10 dos 17 analitos ficaram preenchidos com valores numéricos
- [ ] Gráfico Levey-Jennings aparece em algum lugar da tela (div com classe contendo "recharts" ou canvas)
- [ ] Nenhum valor extraído é `NaN`, `null` ou string "undefined"

**Se todas imagens WhatsApp falharem**: marca como FAIL (OCR quebrado) e inclui stack do console. Se apenas algumas falharem (ex: imagens borradas): marca como PASSOU com warning.

---

### F04 — Hematologia: visualizar Levey-Jennings e Westgard

**Steps**:
1. Na view Hematologia, toggle "Gráfico" se estiver escondido.
2. Seleciona um analito com mais de 5 corridas históricas (ex: "HGB").
3. Screenshot: `f04-01-lj-chart.png`
4. Alterna entre "Fabricante" e "Interna" nas estatísticas (toggle visível).
5. Screenshot: `f04-02-stats-toggle.png`

**Assertions**:
- [ ] Gráfico Levey-Jennings renderizou linhas de controle (±1SD, ±2SD, ±3SD visíveis)
- [ ] Toggle de stats muda os valores-alvo na tabela lateral
- [ ] Não há regressão visual grosseira (comparar contra `fixtures/lj-chart-reference.png` se existir — se não, pula)

---

### F05 — CIQ-Imuno: registrar corrida com strip mockado

**Mock**: como você não tem foto real de strip de imunoensaio, **gera uma imagem sintética antes de rodar**:

```python
# Pré-step — opcional, pode usar qualquer JPG placeholder
# Cria strip.jpg 400x800px com duas linhas horizontais (controle + teste)
# Simula um resultado "Reagente"
```

Se não tiver como gerar sintético, **usa a mesma imagem do WhatsApp** (o OCR do strip vai falhar ou retornar low confidence — é esperado, apenas valida o pipeline de upload+chamada).

**Steps**:
1. Hub → "CIQ-Imuno"
2. Seleciona um lote existente (se não houver, BLOQUEADO)
3. Clica "Nova Corrida"
4. Seleciona tipo de teste: "HIV" (dropdown)
5. Upload da imagem mock
6. Espera resposta do OCR (timeout 30s)
7. Screenshot: `f05-01-imuno-result.png`
8. Clica "Cancelar" — não confirma

**Assertions**:
- [ ] Upload não causou crash
- [ ] Cloud Function `analyzeImmunoStrip` foi chamada (ver Network tab: POST pra `/southamerica-east1-hmatologia2.cloudfunctions.net/analyzeImmunoStrip`)
- [ ] Resposta contém `resultadoObtido` e `confidence`
- [ ] Toast de erro NÃO apareceu (confidence "low" não é erro)

---

### F06 — Uroanálise: OCR de tira

Mesma lógica de F05 — usa mock ou reaproveita uma imagem do WhatsApp.

**Steps**:
1. Hub → "Uroanálise"
2. Seleciona lote existente (se não houver, BLOQUEADO)
3. "Nova Corrida" → upload da imagem
4. Espera OCR. Screenshot: `f06-01-uro-result.png`
5. Cancelar.

**Assertions**:
- [ ] Cloud Function `parseUrinaTira` foi chamada
- [ ] Resposta tem os 7 analitos (glicose, cetonas, proteína, nitrito, sangue, leucócitos, pH)
- [ ] Cada analito tem `confidence` 0..1

---

### F07 — Coagulação: visualização (read-only)

**Steps**:
1. Hub → "Coagulação"
2. Screenshot da view inteira.
3. Se houver lote cadastrado: abre, lista corridas, fecha.
4. Se tiver botão "FR-10" / "Gerar relatório regulatório": clica e verifica se abre modal (mas NÃO confirma geração).

**Assertions**:
- [ ] View renderizou sem erro
- [ ] Sem regressão visual (comparar contra fixture, se houver)

---

### F08 — Insumos: criar produto mock + lote mock

**Cuidado**: esse fluxo CRIA dados. Prefix tudo com `SMOKE_` pra o CTO limpar depois.

**Steps**:
1. Hub → "Insumos" → aba "Produtos"
2. Clica "Novo Produto" (ou "+ Produto")
3. Preenche:
   - Módulo: "hematologia"
   - Tipo: "controle"
   - Fabricante: `SMOKE_Bio-Rad`
   - Nome Comercial: `SMOKE_Multiqual Test`
   - Equipamentos Compatíveis: seleciona qualquer um
   - Estabilidade Default: 30 dias
   - Nível Default: 2
4. Salva. Screenshot: `f08-01-produto-ok.png`
5. Espera toast de sucesso.
6. Verifica que o produto aparece na lista com o prefix `SMOKE_`.

7. Aba "Lotes" → "+ Lote"
8. Preenche:
   - Produto: seleciona o `SMOKE_Multiqual Test` criado
   - Lote: `SMOKE-LOT-${timestamp}`
   - Data Vencimento: +180 dias a partir de hoje
9. Salva. Screenshot: `f08-02-lote-ok.png`

**Assertions**:
- [ ] Toast "Produto criado" (ou "salvo com sucesso") apareceu
- [ ] Produto aparece na lista da aba
- [ ] Lote aparece na aba "Lotes" vinculado ao produto
- [ ] Nenhum erro de validação de CNPJ/campo obrigatório bloqueou

---

### F09 — Insumos: movimentação (abertura) — testa chain hash

**Steps**:
1. No lote `SMOKE-LOT-*` criado em F08, clica "Abrir frasco" (ou "Movimentação → Abertura")
2. Preenche motivo se pedido. Confirma.
3. Screenshot: `f09-01-movimentacao.png`
4. Aguarda 3s — Cloud Function `onInsumoMovimentacaoCreate` deve selar o doc assincronamente.
5. Abre timeline do lote. Verifica aparecer um evento de "Abertura".

**Assertions**:
- [ ] Evento de abertura visível na timeline
- [ ] Evento tem `chainStatus: sealed` depois de alguns segundos (se a UI mostrar esse campo)
- [ ] Toast de sucesso apareceu

---

### F10 — BulaParser: upload PDF mock

**Mock**: usa qualquer PDF pequeno que tenha no sistema (pode ser o próprio README do projeto exportado pra PDF, ou um PDF de 1 página criado com:

```bash
echo "BULA MOCK — Controle Hematologia SMOKE TEST" > mock.txt
# converte pra PDF se tiver pandoc disponível, senão pula este teste
```

Se não tiver pandoc/chrome-headless pra gerar PDF: **marca como BLOQUEADO** com nota.

**Steps**:
1. Hub → "Importar bula PDF"
2. Upload do PDF mock
3. Espera resposta do Gemini (timeout 60s)
4. Screenshot: `f10-01-bula-result.png`

**Assertions**:
- [ ] Sem crash no upload
- [ ] Cloud Function `extractFromBula` foi chamada
- [ ] Resposta tem estrutura `{ controlName, expiryDate, levels: [...] }` (pode estar vazia pra um PDF de teste — é esperado)
- [ ] Toast de warning "Nenhum nível extraído" pode aparecer — isso é PASS (esperado pra PDF mock)

---

### F11 — Relatórios: visualização + filtro

**Steps**:
1. Hub → "Relatórios"
2. Aplica filtro: últimos 30 dias, todos módulos, todos status.
3. Screenshot: `f11-01-reports.png`
4. Clica "Exportar CSV" ou equivalente — **captura o download** e verifica que é um arquivo não-vazio.
5. NÃO clica "Enviar por email" (evita disparar Resend).

**Assertions**:
- [ ] Tabela de relatório renderizou
- [ ] Download de CSV > 100 bytes
- [ ] Sem erros no console

---

### F12 — Configurações do lab (Lab-Settings)

**Requer**: role=admin ou owner ou SuperAdmin. Se o usuário de teste não tem essa role, marca como SKIP.

**Steps**:
1. Hub → "Configurações"
2. Screenshot: `f12-01-settings.png`
3. Toggle uma regra Westgard (ex: "1-2s") — se estiver desligada, liga; se ligada, deixa como estava.
4. Clica "Salvar" (só se fez mudança).
5. Verifica toast de sucesso.
6. Se mudou algo, DESFAZ antes de sair.

**Assertions**:
- [ ] Regras Westgard persistem após reload da página
- [ ] Input de email de backup aceita múltiplos (separados por vírgula ou linha)

---

### F13 — Admin / SuperAdmin: users + migrations

**Requer**: SuperAdmin (durante período de testes, todos devem ser — vide grant).

**Steps**:
1. Menu de conta (canto superior direito) → "Painel Super Admin" ou Hub → "Super Admin"
2. Aba "Usuários"
3. Screenshot: `f13-01-users-list.png`
4. Verifica que a lista carrega pelo menos o próprio usuário.
5. Aba "Migrations"
6. Screenshot: `f13-02-migrations.png`
7. **NÃO clica "Aplicar" em nenhuma migration.** Só clica em "Dry-run" das migrations que têm dry-run disponível:
   - "Dry-run (inspeciona diff)" em "Provisioning de claims" — deve retornar `updated: 0` se claims já provisionadas
   - "Dry-run grant" em "SuperAdmin temporário" — retorna lista sem aplicar
8. Screenshot dos resultados.

**Assertions**:
- [ ] Dry-runs executaram e retornaram JSON com contadores
- [ ] Nenhum dry-run tentou escrever (scanned > 0, mas updated == 0 ou > 0 conforme estado)
- [ ] Se apareceu "auditLogId" nos retornos, registra no report

---

### F14 — Email diário: backup + operacional (verifica existência, NÃO dispara)

**Não dispara o envio** — só valida que as configurações estão acessíveis.

**Steps**:
1. Configurações → seção "Backup Diário"
2. Screenshot: `f14-01-backup-settings.png`
3. Verifica campos:
   - "Backup habilitado": toggle visível
   - "Emails destinatários": input com pelo menos 1 email
   - "Threshold de inatividade": input numérico
4. Verifica campo informativo "Relatório Operacional (2º anexo)" ou "Anexo operacional" — deve mencionar o novo PDF.

**Assertions**:
- [ ] Configuração de backup está presente e editável (se for admin)
- [ ] Email list tem formato válido
- [ ] Menção ao relatório operacional aparece (comprova que a Onda nova está refletida na UI)

---

## 4. Fluxos negativos (expectativas de falha controlada)

### N01 — Login com senha errada

- Preenche senha errada proposital
- **Espera**: toast de erro com mensagem amigável
- **Não espera**: crash, página branca, erro 500 visível

### N02 — Upload de arquivo inválido (OCR)

- Upload de um .txt renomeado pra .jpg no campo de run
- **Espera**: erro controlado ("formato inválido" ou "não foi possível ler a imagem")
- **Não espera**: crash do frontend

### N03 — Formulário com campos obrigatórios vazios

- Abre "Novo Produto", clica "Salvar" sem preencher nada
- **Espera**: validação inline bloqueia o submit
- **Não espera**: request ao servidor

---

## 5. Políticas gerais

### Não pode
- Deletar QUALQUER dado existente
- Confirmar ("Salvar" / "Confirmar" / "Enviar") operações em dados reais — só em dados criados pelo próprio teste com prefix `SMOKE_`
- Chamar `grantTemporarySuperAdminToAll`, `revokeTemporarySuperAdmin`, `provisionModulesClaims`, `deleteUser`, `removeUserFromLab` — essas são destrutivas
- Disparar `triggerCQIReport`, `triggerLabBackup`, `triggerFirestoreExport` — enviam email/consomem quota
- Testar em mais de um lab simultaneamente

### Deve
- Tirar screenshot ANTES e DEPOIS de cada ação destrutiva/criativa
- Capturar console logs e errors (`page.on('console')`, `page.on('pageerror')`)
- Capturar network requests falhos (`response.status() >= 400`)
- Gerar `REPORT.md` completo ao final, mesmo se falhar no meio
- Fazer `page.waitForLoadState('networkidle')` entre navegações

### Boas práticas
- Antes de cada fluxo, reset: fecha modais abertos, volta pro Hub via menu
- Timeout global: 60s por ação (OCR pode demorar)
- Retry: 2x em falhas de rede (ECONNRESET, 503)
- Captura HAR (`await page.context().tracing.start(...)`) pra fluxos que falharem

---

## 6. Resumo de cobertura esperada

| Módulo | F# | Criticidade | OCR? | Cria dados? |
|---|---|---|---|---|
| Auth | F01 | Bloqueador | — | — |
| Navegação | F02 | Alta | — | — |
| Hematologia | F03, F04 | Alta | ✅ Gemini | Não (cancela) |
| CIQ-Imuno | F05 | Alta | ✅ Gemini | Não |
| Uroanálise | F06 | Média | ✅ Gemini | Não |
| Coagulação | F07 | Média | — | — |
| Insumos | F08, F09 | Alta | — | ✅ (SMOKE_*) |
| BulaParser | F10 | Média | ✅ Gemini | Não |
| Reports | F11 | Média | — | — |
| Settings | F12 | Baixa | — | Toggle revertido |
| Admin | F13 | Média | — | Só dry-runs |
| Backup config | F14 | Baixa | — | — |
| Negativos | N01-N03 | Média | — | — |

**Critério de passa global**: F01 + F02 + F03 + F05 + F06 + F08 + F13 passam → smoke OK.
Se qualquer um dos bloqueadores falhar → smoke FAIL e merge do app deve ser revertido.

---

## 7. Entrega

Ao terminar:
1. `$OUTPUT_DIR/REPORT.md` com sumário executivo
2. `$OUTPUT_DIR/screenshots/*.png` organizados por fluxo
3. `$OUTPUT_DIR/console.log` com logs agregados do browser
4. `$OUTPUT_DIR/network-failures.json` com requests que retornaram >= 400
5. Exit code: 0 se tudo passou; 1 se 1+ bloqueador falhou; 2 se erros em fluxos não-bloqueadores

Se exit != 0, imprime no terminal:
```
❌ SMOKE FAIL
   bloqueadores falhos: F01, F03
   Relatório completo: $OUTPUT_DIR/REPORT.md
```
