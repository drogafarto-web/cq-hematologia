# HC Quality — Smoke Test Completo do Módulo CIQ-Imuno

**Duração estimada**: 25-35 min. Cobre 12 fluxos end-to-end do módulo de imunoensaios — Bancada, Cadastro, Disponibilizar, Corridas, Westgard, Qualificação Formal (PR1), Auditoria.

Preenche no topo:

```
BASE_URL               = https://hmatologia2.web.app
TEST_USER_EMAIL        = drogafarto@gmail.com
TEST_USER_PASSWORD     = 12345678
TEST_LAB_NAME          = LabClin Rio Pomba MG
OUTPUT_DIR             = ./smoke-ciq-imuno-$(date +%Y%m%d-%H%M)
```

---

Você é QA senior. Faz login em `$BASE_URL` (preenche E-mail/Senha, clica "Entrar", seleciona `$TEST_LAB_NAME` se aparecer LabSelector) e executa os 12 fluxos abaixo. Playwright com Chromium. Timeout 60s por ação (Firestore/callables podem demorar em cold start).

**Pattern global — fechar modal antes de cada navegação por sidebar:**

Modais HC Quality usam backdrop `fixed inset-0 ... bg-black/60` que intercepta
clicks no que está atrás. Antes de QUALQUER click em sidebar/topbar, executa:

```js
async function closeAnyOpenModal(page) {
  // Tenta ESC primeiro (CIQTestTypeManager + qualificacao + delete escutam)
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
  // Fallback: clica em aria-label="Fechar" se ainda houver modal
  const closeBtn = page.locator('[aria-label="Fechar"]').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(200);
  }
  // Último recurso: clica fora do conteúdo do modal (no backdrop)
  // Modais aceitam click no parent (e.target === e.currentTarget)
}
```

Chame `await closeAnyOpenModal(page)` ANTES de cada `page.click(sidebar...)`.

**Políticas não-negociáveis**:
- Zero DELETE em dados que não tenham prefix `SMOKE_`
- Cria apenas dados com prefix `SMOKE_` ou suffix `_SMOKE_${Date.now()}`
- Em corridas reais (sem prefix SMOKE_), sempre clica "Cancelar" — NÃO confirma save
- NUNCA roda migrations/scripts admin — apenas UI
- NUNCA aprova/reprova lotes reais via UI; criação de qualificação só em lotes `SMOKE_`
- Screenshot antes e depois de cada ação crítica
- Captura console.error e Network requests com status ≥ 400 ao longo de TODO o fluxo
- Na re-autenticação para qualificação (PR1), usa `$TEST_USER_PASSWORD`

---

## F-IM-00 — Login + navegação inicial

**Steps**:

1. Vai pra `$BASE_URL`
2. Espera form de login. Screenshot: `f-im-00-login.png`
3. Preenche email + senha, clica "Entrar"
4. Se aparecer LabSelector, escolhe `$TEST_LAB_NAME`
5. Espera Hub carregar. Screenshot: `f-im-00-hub.png`
6. Clica em "CIQ Hematologia" ou navega pra "CIQ-Imuno" (label pode variar — procura por "Imuno", "Imunoensaio" ou ícone de gota com sigla "Im")
7. Espera CIQImunoContent/Dashboard carregar. Screenshot: `f-im-00-ciq-imuno-entry.png`
8. Captura do DOM: número de "setups vinculados", "Tipos de Teste cadastrados", "lotes ativos"

**Assertions**:
- [ ] Login bem-sucedido (URL muda pra `/hub` ou similar)
- [ ] Lab Riopomba aparece selecionado no header
- [ ] Tela CIQ-Imuno renderiza sem console.error
- [ ] Banner amarelo "Nenhum insumo ativo configurado…" — captura presença/ausência (informativo, não blocker)

---

## F-IM-01 — Tipos de Teste: criar SMOKE testType manual

**Importante**: a sidebar "Tipos de Teste" é apenas um placeholder/stub que aponta
pra Configurações; o CRUD **real** só está dentro de um modal aberto via
botão "Gerenciar" da CIQImunoForm. Não tente criar pela sidebar.

**Steps**:

1. CIQ-Imuno → sidebar "Bancada (Corridas)"
2. Header → clica **"+ Registrar Corrida"** (botão preto)
3. Form abre. Localiza seção "TIPO DE TESTE" (header em uppercase). Ao lado
   direito do título tem um botão pequeno **"Gerenciar"** (texto exato, com
   ícone de engrenagem). Clica.
4. Modal `CIQTestTypeManager` abre (fundo escuro, lista de tipos existentes).
   Screenshot: `f-im-01-manager-aberto.png`
5. Captura nomes existentes (ex: Dengue NS1)
6. Rola até seção rodapé **"Adicionar novo"**
7. Input com placeholder exato `Nome do teste… ex: Chagas` — preenche
   `SMOKE_PCR_${Date.now()}` (ex: `SMOKE_PCR_1714000000000`)
8. Logo abaixo do input, radiogroup com `aria-label="Tipo de execução do teste"`
   tem 2 botões role=radio. Clica no segundo botão (texto "Manual") pra
   aria-checked=true
9. Clica o botão verde quadrado à direita do input (PlusIcon, sem texto,
   classe `bg-emerald-500`, é o único botão verde no rodapé)
10. Screenshot: `f-im-01-test-type-criado.png`
11. Confirma que `SMOKE_PCR_*` aparece na lista acima com badge/ícone "manual"
12. Fecha modal (ícone X no canto superior do modal)
13. **Guarda nome em `$SMOKE_TEST_TYPE_NAME`** — usa em todos os fluxos seguintes

**Assertions**:
- [ ] Toast/feedback de sucesso ou aparição imediata na lista
- [ ] testType aparece com flag "manual"
- [ ] Network: write em `/labs/{labId}/ciq-imuno-config/testTypes` deu 200
- [ ] Modal fecha sem erro

---

## F-IM-02 — Cadastro de lote reagente imuno (kit manual)

Cadastra 1 reagente + 1 controle positivo + 1 controle negativo do mesmo "kit" SMOKE pra alimentar os fluxos seguintes.

**Importante: feche TODOS os modais antes de cada navegação por sidebar.**
Modais em HC Quality usam `bg-black/60 backdrop-blur-sm` e interceptam clicks.
Use `keyboard.press('Escape')` ou click no botão `aria-label="Fechar"` antes
de cada `page.goto`/click no sidebar. CIQTestTypeManager passou a fechar em
ESC desde 2026-04-26 (commit be6bf87).

**Seletores verificados (lidos do código):**

| Elemento | Selector primário | Fallback (texto) |
|---|---|---|
| Botão "+ Novo lote" | `button:has-text("+ Novo lote")` | regex /\+ Novo lote/ |
| "+ Cadastrar novo produto" (etapa 1) | `button:has-text("+ Cadastrar novo produto")` | regex /Cadastrar novo produto/ |
| Input fabricante (produto) | `input#fabricante` | `[placeholder*="Bio-Rad"]` |
| Input nome comercial (produto) | `input#nomeComercial` | `[placeholder*="ABX Diluent"]` |
| Input registro ANVISA | `input#registroAnvisa` | `[placeholder*="10009010123"]` |
| Input função técnica | `input#funcaoTecnica` | — |
| Submit do produto | `button:has-text("Salvar produto")` ou `button[type="submit"]` no modal | — |
| Input número do lote (etapa 2) | `input#loteNum` | `[placeholder="ex: 2841A24"]` |
| Input validade | `input#validade` (type=date) | `[aria-label="Validade do fabricante"]` |
| Checkbox "já foi aberto" | `input#alreadyOpen` | `[aria-label*="já está em uso"]` |
| Input dataAbertura | `input#dataAbertura` (type=date) | `[aria-label="Data de abertura"]` |
| Input dias estabilidade | `input#diasEstab` (type=number) | `[aria-label="Dias de estabilidade pós-abertura"]` |
| Submit do lote | `button:has-text("Cadastrar lote")` | `button[type="submit"]` |
| Voltar (etapa 1) | `button:has-text("← Voltar")` | — |

**Steps**:

1. Garante que CIQTestTypeManager + qualquer modal de F-IM-01 foi fechado:
   `await page.keyboard.press('Escape')` (loop 2x se necessário)
2. Sidebar → "Insumos e Catálogo" (link com texto exato `Insumos e Catálogo`)
3. Aba topo "Todos os lotes" (texto `Todos os lotes`) — clica
4. Filter chip por tipo: clica em `Reagentes` (lista das chips abaixo da busca)
5. Screenshot: `f-im-02-lotes-list-before.png`
6. Clica `+ Novo lote` (botão violeta no topo direito)
7. NovoLoteModal abre (header `Novo lote de insumo`). Screenshot: `f-im-02-modal.png`
8. **Etapa 1**: clica `+ Cadastrar novo produto no catálogo` (botão tracejado no rodapé da lista de produtos)
9. ProdutoFormModal abre. Preenche:
   - `input#fabricante` → `SMOKE_Wama`
   - `input#nomeComercial` → `SMOKE_KitPCR_${Date.now()}`
   - Tipo: select com opções "Reagente"/"Controle"/"Tira uroanálise" — escolhe `Reagente`
   - Módulo (chips/checkboxes): marca apenas `Imunologia`
   - Estabilidade default: input com placeholder `Ex: 30` → `30`
   - Salva: `button:has-text("Salvar produto")` (ou `button[type="submit"]` no modal interno)
10. Modal de produto fecha; ProdutoPicker auto-seleciona o produto criado
11. Avança pra Etapa 2 (alguns fluxos auto-avançam após produto select)
12. **Etapa 2**: preenche
    - `input#loteNum` → `SMOKE-RG-${Date.now()}` (sem espaços, ASCII)
    - `input#validade` → hoje + 365 dias no formato `YYYY-MM-DD`
    - Marca `input#alreadyOpen` (checkbox)
    - `input#dataAbertura` → hoje no formato `YYYY-MM-DD`
    - `input#diasEstab` → `30` (limpa antes; é tipo number, default pode ser 0)
13. Submit: `button:has-text("Cadastrar lote")`
14. Screenshot: `f-im-02-reagente-criado.png`
15. **Repete pra controle positivo**:
    - "+ Novo lote" → "+ Cadastrar novo produto"
    - Tipo: `Controle`
    - Módulo: `Imunologia`
    - Aparece campo "Nível"/"Polaridade" (`label[for="nivel"]`) — escolhe `Positivo`
    - Fabricante `SMOKE_Wama`, Nome `SMOKE_CtrlPos_${Date.now()}`
    - Salva produto → etapa 2 → Lote `SMOKE-CP-${Date.now()}`, validade hoje+365, marca alreadyOpen, data hoje, estab 30 → Cadastrar lote
16. **Repete pra controle negativo**: mesmo mas Nível `Negativo`, Nome `SMOKE_CtrlNeg_${Date.now()}`, Lote `SMOKE-CN-${Date.now()}`
17. Screenshot: `f-im-02-3-lotes-criados.png`

**Assertions**:
- [ ] 3 lotes SMOKE_ aparecem na lista
- [ ] Cada um tem badge "Aguarda qualificação" (qcStatus pendente)
- [ ] Network: 3x POST em `/labs/{labId}/insumos` retornaram 200
- [ ] 3x POST em `/labs/{labId}/insumo-movimentacoes` (entrada) — chainStatus inicia 'pending'
- [ ] Após 5-10s, recarrega → movimentações estão `chainStatus='sealed'` (trigger funcionou)

**Guarda**: id do reagente em `$SMOKE_REAGENTE_ID`, controle pos em `$SMOKE_CTRL_POS_ID`, neg em `$SMOKE_CTRL_NEG_ID`

---

## F-IM-03 — Disponibilizar lote p/ corrida (FEATURE NOVA — 2026-04-26)

Esse é o fluxo crítico recém-deployado. Botão azul "Disponibilizar p/ corrida" no row do reagente.

**Steps**:

1. Em "Todos os lotes" → tab "Reagentes" → localiza `SMOKE_KitPCR_*` (linha do reagente)
2. Confirma que aparece botão azul **"Disponibilizar p/ corrida"** na coluna Ações
3. Screenshot: `f-im-03-01-button-visible.png`
4. Clica
5. Modal abre. Screenshot: `f-im-03-02-modal-open.png`
6. Header mostra: `SMOKE_KitPCR_*` · Lote `SMOKE-RG-*`
7. Dropdown "Tipo de teste" lista todos os testTypes — incluindo `$SMOKE_TEST_TYPE_NAME`
8. Seleciona `$SMOKE_TEST_TYPE_NAME` (deve aparecer com sufixo "· manual")
9. Clica "Disponibilizar como Em Validação"
10. Screenshot: `f-im-03-03-after-confirm.png`
11. Após sucesso, deve auto-navegar pra Bancada de Imunoensaios

**Assertions**:
- [ ] Modal abre sem console.error
- [ ] Dropdown traz testTypes manuais primeiro (ordenação)
- [ ] Network: POST em `/labs/{labId}/ciq-imuno/{newId}` (createCIQLot) retornou 200
- [ ] Network: PATCH/UPDATE com `setupType: 'validacao_paralela'`, `pinnedBy: <uid>`, `pinHistory: [...]` retornou 200
- [ ] Após sucesso, URL/state muda pra Bancada
- [ ] Bancada mostra novo card azul "Em Validação" com `$SMOKE_TEST_TYPE_NAME` · Lote SMOKE-RG-*

---

## F-IM-04 — Bancada de Imunoensaios: visualização

**Steps**:

1. Já está na Bancada (auto-navegado). Screenshot: `f-im-04-01-bancada.png`
2. Captura do DOM:
   - Header: "X setup(s) vinculado(s) · Y em validação"
   - Lista de Setups Vinculados (cards azuis = validação, verdes = oficial)
   - Banner azul "Lote(s) em validação na bancada" com lista de testTypes
   - Painel lateral "Corridas Recentes"
3. Volta pra InsumosView (sidebar "Insumos e Catálogo") → tab "Reagentes"
4. Localiza `SMOKE_KitPCR_*` row → confirma badge **"Em validação · bancada"** (azul)
5. Screenshot: `f-im-04-02-badge-vinculado.png`
6. Confirma que botão "Disponibilizar p/ corrida" SUMIU (já está vinculado)

**Assertions**:
- [ ] Setup card aparece com testType, lote, "Vinculado por <uid>"
- [ ] Badge "Em validação · bancada" aparece no row do reagente em InsumosView
- [ ] Botão "Disponibilizar p/ corrida" não aparece mais (estado correto pós-pin)
- [ ] Banner "Lote em validação na bancada" cita `$SMOKE_TEST_TYPE_NAME`

---

## F-IM-05 — "+ Registrar Corrida" do header (form em branco — fix 2026-04-26)

Antes o botão auto-prefillava com o único lote pinned, travando testType. Fix garantiu que abre sempre em branco.

**Steps**:

1. Bancada → clica "+ Registrar Corrida" no header (botão preto/escuro)
2. Modal/form abre. Screenshot: `f-im-05-01-form-blank.png`
3. **Verifica que o campo "Imunoensaio" (testType) NÃO está disabled** — operador pode escolher
4. **Verifica que o campo "Lote" do controle está vazio** (não pré-preenchido)
5. Não há banner azul "Corrida vinculada" no topo (porque é blank, não há prefillFromLot)
6. Seleciona testType `$SMOKE_TEST_TYPE_NAME`
7. Confirma que aparece o **ManualKitPicker** (porque o testType é manual)
8. Screenshot: `f-im-05-02-manual-picker.png`
9. Captura do DOM: ManualKitPicker mostra slots reagente + controle positivo + controle negativo, com seus lotes SMOKE_ disponíveis no dropdown
10. **NÃO finaliza save** — clica Cancelar / fecha modal

**Assertions**:
- [ ] testType dropdown é editável (não disabled)
- [ ] Loto control vazio
- [ ] ManualKitPicker renderiza após testType selecionado
- [ ] Slots do picker listam `SMOKE_KitPCR_*` (reagente), `SMOKE_CtrlPos_*`, `SMOKE_CtrlNeg_*`
- [ ] Cada item tem badge "aguarda qualificação" (qcStatus pendente — NÃO bloqueia seleção)

---

## F-IM-06 — "+ Corrida" do card (prefilled + "Trocar lote")

**Steps**:

1. Volta pra Bancada
2. Localiza card azul `$SMOKE_TEST_TYPE_NAME` · Lote SMOKE-RG-*
3. Clica botão **"+ Corrida"** dentro do card
4. Form abre prefilled. Screenshot: `f-im-06-01-prefilled.png`
5. Verifica:
   - Banner azul no topo: "Corrida vinculada · `$SMOKE_TEST_TYPE_NAME` · Lote SMOKE-RG-*"
   - Campo testType **DISABLED**
   - Campo loteControle **DISABLED**
   - Datas pré-preenchidas
6. Clica link **"Trocar lote"** no banner
7. Screenshot: `f-im-06-02-unlocked.png`
8. Verifica:
   - Campo testType **agora editável** (disabled removido)
   - Campo loteControle agora editável
   - Link "Trocar lote" sumiu (já foi usado)
9. **NÃO finaliza save** — Cancelar

**Assertions**:
- [ ] Form abre com prefill correto (testType, lote)
- [ ] Banner mostra texto "Corrida vinculada"
- [ ] Link "Trocar lote" presente quando bloqueado
- [ ] Após click em "Trocar lote", campos disabled liberam
- [ ] Link some após click

---

## F-IM-07 — Salvar corrida de validação (kit manual conforme)

Salva 1 corrida válida (P=R, N=NR — ambos conformes) usando os SMOKE kits.

**Steps**:

1. Volta pra Bancada → "+ Registrar Corrida" do header
2. testType: `$SMOKE_TEST_TYPE_NAME`
3. ManualKitPicker:
   - Slot reagente: seleciona `SMOKE_KitPCR_*`
   - Slot controle positivo: `SMOKE_CtrlPos_*`
   - Slot controle negativo: `SMOKE_CtrlNeg_*`
   - Marca checkbox "Confirmo que estes kits estão sendo usados nesta corrida"
4. Resultados:
   - Esperado positivo: `R`
   - Obtido positivo: `R` (conforme)
   - Esperado negativo: `NR`
   - Obtido negativo: `NR` (conforme)
5. Cargo profissional: "Biomédico(a)" (ou outro)
6. Reagente — preenche fabricante e validade automáticos do snapshot (deve auto-fill quando reagente é selecionado no picker)
7. dataRealizacao: hoje
8. Screenshot: `f-im-07-01-form-completo.png`
9. Clica "Salvar corrida"
10. Espera resposta. Screenshot: `f-im-07-02-saved.png`

**Assertions**:
- [ ] Toast de sucesso aparece
- [ ] Corrida aparece em "Corridas Recentes" como "Conforme" (verde)
- [ ] Network: POST em `/labs/{labId}/ciq-imuno/{lotId}/runs/{runId}` retornou 200
- [ ] runCode no formato `CI-YYYY-NNNN`
- [ ] `classificacaoImuno: 'validacao'` no payload (porque insumo qcStatus=pendente)
- [ ] Card do setup atualiza contador (1 corrida)
- [ ] Nenhum console.error

**Guarda**: runId em `$SMOKE_RUN_VALIDA_ID` — usa em F-IM-08.

---

## F-IM-08 — Corrida não-conforme + Westgard categórico

Salva 3 corridas seguidas com obtido NEG diferente do esperado pra disparar Westgard `consecutivos_3nr`.

**Steps**:

1. Bancada → "+ Registrar Corrida" do header
2. testType: `$SMOKE_TEST_TYPE_NAME`, mesmos slots SMOKE_
3. Resultados: esperado positivo R, **obtido positivo NR** (não-conforme); esperado negativo NR, obtido negativo NR
4. Preenche `acaoCorretiva: SMOKE_aco_corretiva_test_${i}` (campo fica obrigatório quando há divergência)
5. Salva. Screenshot: `f-im-08-{i}-saved.png` (i = 1, 2, 3)
6. **Repete 2 vezes mais** (3 corridas NR no total) com timestamp ligeiramente diferente em ações corretivas

**Assertions**:
- [ ] 3 corridas marcadas "Rejeitada"/vermelho aparecem em "Corridas Recentes"
- [ ] Após 3ª corrida, alerta Westgard `consecutivos_3nr` aparece (badge ou modal)
- [ ] `lotStatus` do envelope vira `reprovado` (visível na UI e no doc Firestore)
- [ ] Network: 3x POST em runs deram 200
- [ ] Cada run tem `westgardCategorico` no payload com pelo menos 1 alerta após a 3ª

---

## F-IM-09 — Qualificação Formal RT (PR1 — 2026-04-26)

Aprova o lote via callable `approveQualificacao` usando a corrida válida F-IM-07 como evidência.

**Steps**:

1. Sidebar → "Insumos e Catálogo" → "Todos os lotes" → tab "Reagentes"
2. Localiza `SMOKE_KitPCR_*` row → clica botão verde **"Qualificar lote"**
3. `InsumoQualificacaoModal` abre. Screenshot: `f-im-09-01-modal.png`
4. Verifica:
   - Modo detectado: `corrida-validacao` (porque há runs no envelope)
   - Bloco 1: 5 checkboxes de checklist de recebimento
   - Bloco 2: lista de runs candidatas (incluindo `$SMOKE_RUN_VALIDA_ID`)
   - Campo de senha pra re-auth no rodapé
5. Marca todos os 5 checkboxes do checklist
6. Seleciona pelo menos 1 corrida conforme como evidência (`$SMOKE_RUN_VALIDA_ID`)
7. **Não seleciona corridas rejeitadas** — operação proibida pela rule
8. Preenche senha = `$TEST_USER_PASSWORD`
9. Screenshot: `f-im-09-02-filled.png`
10. Clica "Aprovar lote"
11. Espera resposta da callable. Screenshot: `f-im-09-03-approved.png`

**Assertions**:
- [ ] Modal não abre se usuário NÃO for owner/admin (gate de role) — confirma que `drogafarto@gmail.com` é owner e abre
- [ ] Re-auth bem-sucedida (senha correta)
- [ ] Network: callable `approveQualificacao` retornou 200 com `qualificacaoId`
- [ ] Após sucesso: row do reagente vira badge **"Qualificado"** (verde)
- [ ] Doc `/labs/{labId}/insumo-qualificacoes/{qId}` foi criado (verifica via Firebase DevTools se possível)
- [ ] Doc do insumo: `qcStatus: 'aprovado'`, `qualificacaoId: <qId>`, `qcApprovedBy: <uid>`, `qcApprovalMethod: 'corrida-validacao'`
- [ ] Movimentação `tipo: 'qualificacao'` em `/labs/{labId}/insumo-movimentacoes`
- [ ] Após 5s: cópia em `/labs/{labId}/ciq-audit/qual_<qId>` (trigger `onInsumoQualificacaoCreate`)
- [ ] Botão "Qualificar lote" sumiu da row (estado terminal)

---

## F-IM-10 — Promover envelope a Setup Oficial após aprovação

Após qualificação aprovada, lote pode virar setup principal (uso-normal).

**Steps**:

1. Volta pra Bancada
2. Card SMOKE ainda aparece como "Em Validação" (azul) — qualificação aprovou o INSUMO mas não muda automaticamente o envelope
3. Vai pra Gestão de Lotes (sidebar) — encontra envelope `$SMOKE_TEST_TYPE_NAME · SMOKE-RG-*`
4. Card mostra que insumo está aprovado (qualificado)
5. **Aprovar lote no envelope (CIQImunoLot)**: localiza botão "Aprovar lote (RT)" ou similar — clica
6. Confirma decisão `ciqDecision: 'A'` — preenche se houver campo
7. Screenshot: `f-im-10-01-lote-aprovado.png`
8. Volta pra Bancada → card vira VERDE "Setup Oficial"
9. Screenshot: `f-im-10-02-bancada-oficial.png`

**Assertions**:
- [ ] `ciqDecision: 'A'` salvo no envelope
- [ ] Card vira verde
- [ ] Badge no row do insumo: **"Setup oficial · bancada"** (verde)
- [ ] Próximas corridas no envelope viram `classificacaoImuno: 'uso-normal'` (não validação)

---

## F-IM-11 — Reprovação → segregado (rejeita um lote SMOKE separado)

Cria um SEGUNDO reagente SMOKE pra reprovar (não usa o já qualificado).

**Steps**:

1. InsumosView → cadastra novo reagente: `SMOKE_KitPCR_REPROVAR_${Date.now()}`, lote `SMOKE-RG-REJ-${Date.now()}` (tipo reagente, módulo imuno, datas válidas)
2. Disponibiliza p/ corrida (F-IM-03 simplified) — pin como Em Validação
3. Roda 1 corrida não-conforme (F-IM-08 simplified)
4. InsumosView → row → "Qualificar lote"
5. Modal abre, marca 5 checkboxes do checklist
6. **NÃO seleciona evidência analítica** OU seleciona apenas a corrida rejeitada
7. Clica em modo "Reprovar" (botão vermelho ou tab dedicada)
8. Preenche `motivoReprovacao: SMOKE_motivo_reprov_<ts>`
9. Senha = `$TEST_USER_PASSWORD`
10. Confirma
11. Screenshot: `f-im-11-01-reproved.png`

**Assertions**:
- [ ] Callable `reproveQualificacao` retornou 200
- [ ] Row mostra badge **"Reprovado · Segregado"** (vermelho)
- [ ] `insumo.status: 'segregado'`, `qcStatus: 'reprovado'`, `motivoReprovacao` preenchido
- [ ] ManualKitPicker NÃO mostra esse lote em corridas futuras (filtro `evaluateInsumoUsability`)
- [ ] Setup card no Bancada: pode permanecer ou ser desvinculado (confirma comportamento)

---

## F-IM-12 — Auditor: chain de movimentações + assinaturas

**Steps**:

1. CIQ-Imuno → "CIQ Auditor" (sidebar)
2. Filtra pelo lote `$SMOKE_REAGENTE_ID` ou pelo testType `$SMOKE_TEST_TYPE_NAME`
3. Screenshot: `f-im-12-01-auditor.png`
4. Captura timeline:
   - entrada (cadastro)
   - abertura
   - qualificacao (PR1)
5. Verifica chain hash de cada movimentação:
   - chainStatus = 'sealed'
   - chainHash != null
   - sealedAt presente
6. Para a movimentação `qualificacao`: verifica que `payloadSignature` é válido (64 chars hex)
7. Cross-check: clica em "Ver corrida" pra `$SMOKE_RUN_VALIDA_ID` — confirma que `usadaComoEvidencia: true` e `qualificacaoId: $qId` aparecem (metadados PR1)

**Assertions**:
- [ ] Todas as movimentações do reagente SMOKE têm chainStatus='sealed'
- [ ] Chain hash conecta movimentações (cada uma referencia a anterior via previousHash implícito no SHA-256)
- [ ] Doc `qualificacao` mov tem `qualificacaoId` no payload
- [ ] Run aprovada tem `qualificacaoId` + `usadaComoEvidencia: true`
- [ ] Nenhum doc da cadeia tem chainStatus='pending' após >10s do create

---

## Saída

`$OUTPUT_DIR/REPORT.md`:

```markdown
# Smoke CIQ-Imuno — {timestamp}
Usuário: drogafarto@gmail.com (owner LabClin Rio Pomba MG)

## Sumário (12 fluxos)
- F-IM-00 (login + entry):              [PASS/FAIL]
- F-IM-01 (testType SMOKE manual):      [PASS/FAIL]  testType=$SMOKE_TEST_TYPE_NAME
- F-IM-02 (cadastro 3 lotes SMOKE):     [PASS/FAIL]  reagente=$id pos=$id neg=$id
- F-IM-03 (Disponibilizar p/ corrida):  [PASS/FAIL]  envelopeId=$id
- F-IM-04 (Bancada visualização):       [PASS/FAIL]
- F-IM-05 ("+ Registrar Corrida" blank):[PASS/FAIL]
- F-IM-06 ("+ Corrida" + Trocar lote):  [PASS/FAIL]
- F-IM-07 (corrida válida):             [PASS/FAIL]  runId=$SMOKE_RUN_VALIDA_ID
- F-IM-08 (Westgard 3NR):               [PASS/FAIL]  alerta_disparou=true/false
- F-IM-09 (Qualificação RT PR1):        [PASS/FAIL]  qualificacaoId=$qId
- F-IM-10 (promover oficial):           [PASS/FAIL]
- F-IM-11 (reprovação → segregado):     [PASS/FAIL]
- F-IM-12 (auditor + chain):            [PASS/FAIL]  todos_sealed=true/false

## Métricas chave
- Total de docs SMOKE_ criados: insumos=N produtos=N qualificacoes=N runs=N
- Latência média callable approveQualificacao: Xms
- Latência média trigger onInsumoMovimentacaoCreate (selar): Xms
- Movimentações pending → sealed: K/K dentro de 10s

## Network failures (status >= 400)
[lista]

## Console errors
[lista]

## Compliance check (PR1)
- [✓/✗] Re-auth obrigatória antes de approveQualificacao
- [✓/✗] qcStatus protegido contra write client (rules bloqueiam)
- [✓/✗] qualificacaoId fora do canonical signature de runs
- [✓/✗] Doc em /insumo-qualificacoes/ com signatureStatus='valid'
- [✓/✗] Cópia em /ciq-audit/qual_$qId existe (trigger funcionou)
- [✓/✗] Insumo reprovado vira status='segregado' (não simplesmente 'inativo')

## Evidências
- f-im-00-*.png .. f-im-12-*.png

## Cleanup pendente (manual, fora do smoke)
- Excluir produto SMOKE_KitPCR_*, SMOKE_CtrlPos_*, SMOKE_CtrlNeg_* via UI (tab Catálogo)
- Excluir testType $SMOKE_TEST_TYPE_NAME via "Tipos de Teste"
- (lotes SMOKE_ permanecem por integridade da chain — aceitável)
```

Exit 0 se todos passaram; 1 se qualquer FAIL.

Print no terminal final:

```
F-IM-00=PASS  F-IM-01=PASS  F-IM-02=PASS  F-IM-03=PASS
F-IM-04=PASS  F-IM-05=PASS  F-IM-06=PASS  F-IM-07=PASS
F-IM-08=PASS  F-IM-09=PASS  F-IM-10=PASS  F-IM-11=PASS  F-IM-12=PASS
relatorio: $OUTPUT_DIR/REPORT.md
```

---

## Notas pra QA

**Por que cobrir tantos fluxos:**
- O CIQ-Imuno é o módulo mais regulatório (RDC 786 + RDC 978/2025 Art.128 + NOTIVISA)
- PR1 (2026-04-26) acabou de separar Processo 1 (qualificação RT) de Processo 2 (corrida CIQ) — separação de duties tem que ser provada
- Chain de assinaturas SHA-256 + chain hash precisa selar SEMPRE (qualquer pending stuck = bloqueador)
- Botão "Disponibilizar p/ corrida" é o link novo entre cadastro de Insumo e Bancada — sem isso o operador trava

**Sinais de problema:**
- Insumo `SMOKE_*` aparece em Setups Vinculados duplicado → bug em `findCIQLot` (não desduplicou)
- Westgard `consecutivos_3nr` não dispara após 3ª corrida → quebra do `useCIQWestgard`
- Callable `approveQualificacao` 401/403 → custom claims do user não propagaram (re-login)
- Chain hash stuck em 'pending' >10s → `onInsumoMovimentacaoCreate` quebrou ou não deployou
- Insumo reprovado ainda aparece no ManualKitPicker → `evaluateInsumoUsability` esqueceu de filtrar segregado
