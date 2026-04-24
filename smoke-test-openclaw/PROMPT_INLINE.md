# HC Quality — Prompt Inline para Smoke Test

**Como usar**: preenche as 5 variáveis abaixo, copia o bloco inteiro (a partir de `---`) e cola como primeira mensagem no OpenClaw.

```
TEST_USER_EMAIL        = [preencha]
TEST_USER_PASSWORD     = [preencha]
TEST_LAB_NAME          = [preencha]
WHATSAPP_IMAGES_DIR    = [preencha — ex: C:\Users\labcl\Downloads\WhatsApp]
OUTPUT_DIR             = ./smoke-results
```

---

Você é QA engineer senior. Execute um smoke test end-to-end do **HC Quality** em `https://hmatologia2.web.app` usando Playwright (instale com `npx playwright install chromium` se precisar). O app é um SPA React de CIQ laboratorial em produção.

**Contexto**: router custom via Zustand (não URL-based), navegação por cliques em botões com labels pt-BR. Login exige email verificado. Após login, ModuleHub mostra botões: Hematologia, Coagulação, Uroanálise, CIQ-Imuno, Importar bula PDF, Relatórios, Insumos, Configurações, Super Admin. Feedback via toast auto-dismiss 3.5s (seletor: `[role=alert]`).

**Políticas**:
- NUNCA delete nada
- Cria apenas dados com prefix `SMOKE_`
- Não confirme operações em dados reais — tire screenshot do modal e clique Cancelar
- Não chame: grantTemporarySuperAdminToAll, deleteUser, triggerCQIReport, triggerLabBackup
- Timeout global: 60s (OCR pode demorar)
- Retry 2x em falhas de rede

**Execute nessa ordem, pare no primeiro bloqueador falho**:

**F01 Login (BLOQUEADOR)**: goto `$BASE_URL`, preenche "E-mail"/`$TEST_USER_EMAIL` + "Senha"/`$TEST_USER_PASSWORD`, clica "Entrar". Se aparecer LabSelectorScreen, clica em `$TEST_LAB_NAME`. Valida que chega no ModuleHub (texto "Hematologia" + "CIQ-Imuno" visíveis). Screenshot `f01.png`.

**F02 Navegação**: clica em cada view e volta. Valida zero `console.error`, zero toast de erro automático, body > 500 chars. Views: Hematologia, Coagulação, Uroanálise, CIQ-Imuno, Importar bula PDF, Relatórios, Insumos, Configurações, Super Admin. Screenshot por view `f02-XX.png`.

**F03 Hematologia OCR (BLOQUEADOR)**: Hematologia → seleciona qualquer lote → "Nova Corrida" → upload primeira imagem de `$WHATSAPP_IMAGES_DIR/*.{jpg,png}` (são screenshots de Yumizen H550). Espera OCR (até 60s). Valida ≥10 dos 17 analitos preenchidos (RBC, HGB, HCT, MCV, MCH, MCHC, RDW, PLT, MPV, PDW, PCT, WBC, NEU#, LYM#, MON#, EOS#, BAS#) com números (não NaN/null). **Clique Cancelar — não confirme**. Screenshot `f03.png`.

**F04 Levey-Jennings**: na mesma view, toggle "Gráfico". Seleciona analito com histórico (HGB). Valida linhas ±1SD, ±2SD, ±3SD renderizadas. Alterna "Fabricante" ↔ "Interna". Screenshots `f04-lj.png`, `f04-stats.png`.

**F05 CIQ-Imuno (BLOQUEADOR)**: CIQ-Imuno → lote existente → "Nova Corrida" → tipo "HIV" → upload imagem (usa a mesma do WhatsApp como placeholder — OCR vai dar low confidence, é esperado). Valida que POST pra `*/analyzeImmunoStrip` foi feito (capture via `page.on('response')`) e retornou 200 com `resultadoObtido` + `confidence`. Clique Cancelar. Screenshot `f05.png`.

**F06 Uroanálise**: Uroanálise → lote → "Nova Corrida" → upload imagem. Valida POST pra `*/parseUrinaTira` retornando os 7 analitos (glicose, cetonas, proteína, nitrito, sangue, leucócitos, pH). Cancelar. Screenshot `f06.png`.

**F07 Coagulação read-only**: abre view, screenshot. Se houver lote, abre detalhes e screenshot. Nenhuma ação destrutiva.

**F08 Insumos — cria mock (BLOQUEADOR)**: Insumos → aba Produtos → "Novo Produto" → preencha:
- Módulo: hematologia
- Tipo: controle
- Fabricante: `SMOKE_Bio-Rad`
- Nome Comercial: `SMOKE_Multiqual Test`
- Estabilidade: 30
- Nível Default: 2
Salva. Valida toast "Produto criado" ou equivalente. Screenshot `f08-produto.png`.

Aba Lotes → "+ Lote" → Produto = o recém-criado → Lote = `SMOKE-LOT-${Date.now()}` → Data Vencimento = +180d. Salva. Screenshot `f08-lote.png`.

**F09 Movimentação (chain hash)**: no lote criado, clica "Abrir frasco" → confirma. Aguarda 5s. Abre timeline, valida evento de abertura com `chainStatus: sealed` (ou equivalente). Screenshot `f09.png`.

**F10 BulaParser**: Importar bula PDF → upload qualquer PDF pequeno (se não tiver, pula F10 e marca BLOQUEADO). Valida POST pra `*/extractFromBula`. Screenshot `f10.png`.

**F11 Relatórios**: Relatórios → filtro últimos 30 dias. Screenshot. Download CSV (valida > 100 bytes). Não envie email.

**F12 Settings** (se admin/owner): Configurações → toggle regra Westgard → salva → reload → valida persistência → desfaz mudança. Screenshot antes/depois.

**F13 SuperAdmin** (se SuperAdmin): Painel Super Admin → aba Migrations → clica "Dry-run (inspeciona diff)" em "Provisioning de claims" → valida retorno com `scanned`, `updated`, `unchanged`. Clica "Dry-run grant" em "SuperAdmin temporário" → valida lista retornada. **NÃO clique em nada que diga "Aplicar", "Conceder", "Revogar"**. Screenshots.

**F14 Backup config**: Configurações → seção Backup Diário. Valida existência de toggle "habilitado", inputs de emails, menção a "relatório operacional" ou "anexo operacional" (evidência da nova feature Onda recente). Screenshot.

**Negativos**:
- N01: login com senha errada → espera toast de erro amigável, não crash
- N02: upload .txt renomeado .jpg num campo de run → espera erro controlado
- N03: "Novo Produto" → submit vazio → espera validação inline bloquear

**Ao final** grave `$OUTPUT_DIR/REPORT.md` com:
- Sumário: total, passou, falhou, bloqueado
- Por fluxo: status, duração, screenshot path, assertions count, notas
- Links pros screenshots
- Console errors agregados
- Network failures (status >= 400)

Exit code: 0 se todos bloqueadores passaram; 1 caso contrário.

Imprima no terminal ao final:
```
SMOKE OK / FAIL
passou=X falhou=Y bloqueado=Z
relatorio: $OUTPUT_DIR/REPORT.md
```
