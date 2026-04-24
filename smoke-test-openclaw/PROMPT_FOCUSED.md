# HC Quality — Smoke Test Focado (4 fluxos críticos restantes)

**Duração estimada**: 8-12 min. Assume que F01/F02/F07/F13 já passaram.

Preenche no topo:

```
BASE_URL               = https://hmatologia2.web.app
TEST_USER_EMAIL        = [preencha]
TEST_USER_PASSWORD     = [preencha — senha ≥ 8 chars]
TEST_LAB_NAME          = [preencha]
WHATSAPP_IMAGES_DIR    = [preencha — ex: C:\Users\labcl\Downloads\WhatsApp]
OUTPUT_DIR             = ./smoke-focused-$(date +%Y%m%d-%H%M)
```

---

Você é QA senior. Faz login em `$BASE_URL` (preenche E-mail/Senha, clica "Entrar", seleciona `$TEST_LAB_NAME` se aparecer LabSelector) e executa os 4 fluxos abaixo. Playwright com Chromium. Timeout 60s por ação (OCR demora).

**Políticas não-negociáveis**:
- Zero DELETE
- Zero confirmação em dados reais — em runs, sempre clica "Cancelar" após ver o resultado
- Cria apenas dados com prefix `SMOKE_`
- Não clica em nada que diga "Aplicar", "Conceder", "Revogar" em Migrations
- Screenshot antes e depois de cada ação

---

## F03b — Hematologia: OCR com imagens reais do WhatsApp (CRÍTICO)

Este é o fluxo que mais importa — valida OCR Gemini em hardware/imagem real.

**Steps**:

1. Hub → clica "Hematologia"
2. Espera LotSwitcher carregar. Se houver dropdown "Selecione um lote", escolhe o primeiro disponível. Se mostrar "Nenhum lote ativo" → marca BLOQUEADO e pula.
3. Clica o botão de nova corrida (pode ter texto "Nova Corrida", "Registrar corrida", "+ Corrida", ou ícone de câmera)
4. Screenshot: `f03b-01-form-aberto.png`
5. Lista arquivos em `$WHATSAPP_IMAGES_DIR`: pega os 3 primeiros `*.jpg|*.jpeg|*.png` ordenados por modificação asc
6. **Para cada uma das 3 imagens**:
   a. Upload da imagem no campo de arquivo
   b. Espera `analyzeImmunoStrip` ou `extractFromImage` responder — monitora via `page.on('response', r => ...)` aguardando POST 200 pra `*cloudfunctions.net/extractFromImage`
   c. Após resposta, espera 2s pra UI atualizar
   d. Screenshot: `f03b-img{N}-extracted.png` (N = 1, 2, 3)
   e. Captura do DOM quais campos numéricos ficaram preenchidos. Analitos esperados (17):
      `RBC, HGB, HCT, MCV, MCH, MCHC, RDW, PLT, MPV, PDW, PCT, WBC, NEU#, LYM#, MON#, EOS#, BAS#`
   f. **Clica "Cancelar"** (ou fecha modal com ESC) — NÃO confirma
   g. Reabre o form da corrida pra próxima imagem

**Assertions por imagem**:
- [ ] HTTP response do `extractFromImage` foi 200
- [ ] ≥ 10 dos 17 analitos preenchidos com número (não NaN, null, undefined, vazio)
- [ ] Campo "Sample ID" preenchido OU nulo (ambos OK) — mas não "undefined"
- [ ] Nenhum toast de erro apareceu durante o fluxo
- [ ] Gráfico Levey-Jennings renderizou (canvas ou div `.recharts-wrapper` presente)

**Output**: tabela por imagem: `[img, analitos_preenchidos/17, sampleId, status]`. Se ≥ 2 das 3 imagens tiveram ≥ 10 analitos → PASS. Se todas falharam → FAIL crítico (OCR quebrado).

---

## F08 — Insumos: criar produto + lote (prefix SMOKE_)

**Steps**:

1. Hub → "Insumos"
2. Aba "Produtos" (ou "Catálogo")
3. Clica "Novo Produto" / "+ Produto"
4. Screenshot: `f08-01-produto-form.png`
5. Preenche:
   - Módulo: `hematologia`
   - Tipo: `controle`
   - Fabricante: `SMOKE_Bio-Rad`
   - Nome Comercial: `SMOKE_Multiqual ${Date.now()}` (use timestamp pra evitar duplicata)
   - Estabilidade (dias): `30`
   - Nível Default: `2`
   - Outros campos obrigatórios: preenche com valor válido qualquer, prefixa `SMOKE_` quando for string
6. Clica "Salvar"
7. Screenshot: `f08-02-produto-salvo.png`
8. Espera toast (seletor `[role=alert]`). Captura o texto.

**Em seguida, cria um lote**:

9. Aba "Lotes" (ou "Frascos" / "Estoque")
10. Clica "+ Lote" / "Novo Lote"
11. Seleciona o produto `SMOKE_Multiqual ${timestamp}` que acabou de criar
12. Preenche:
    - Lote: `SMOKE-LOT-${Date.now()}`
    - Data Vencimento: 180 dias a partir de hoje (ISO: `new Date(Date.now() + 180*86400000).toISOString().slice(0,10)`)
13. Clica "Salvar"
14. Screenshot: `f08-03-lote-salvo.png`

**Assertions**:
- [ ] Produto aparece na lista com o prefix `SMOKE_`
- [ ] Toast "Produto criado"/"salvo com sucesso" apareceu
- [ ] Request POST/SET pra Firestore em `/labs/{labId}/produtos-insumos` teve status 200
- [ ] Lote aparece vinculado ao produto
- [ ] Request pra `/labs/{labId}/insumos` criou o doc (via Network tab)

**Grava no relatório**: o `produtoId` e `insumoId` criados — precisa pro próximo fluxo.

---

## F09 — Movimentação (abertura) + chain hash selar

**Steps**:

1. Ainda em Insumos, localiza o lote `SMOKE-LOT-*` criado em F08 (use filtro ou scroll)
2. Clica no lote pra abrir detalhes / opções
3. Clica "Abrir frasco" / "Registrar abertura" / "Movimentação → Abertura"
4. Se pedir motivo/observação, preenche: `SMOKE_abertura_test`
5. Confirma
6. Screenshot: `f09-01-movimentacao-criada.png`
7. Espera 5-8 segundos (tempo do trigger `onInsumoMovimentacaoCreate` selar o doc)
8. Recarrega a página OU abre timeline do lote
9. Screenshot: `f09-02-timeline.png`
10. Captura do DOM o status da movimentação

**Assertions**:
- [ ] Evento "Abertura" aparece na timeline do lote
- [ ] Request pra Firestore `/labs/{labId}/insumo-movimentacoes/{movId}` deu 200 no create (com `chainStatus=pending` e `chainHash=null` no payload)
- [ ] Após 5s, o doc foi atualizado com `chainStatus=sealed` (verifica via leitura — Firebase DevTools ou inspeção do DOM se a UI refletir). Se a UI não mostrar `chainStatus`, marca como "não-observável via UI" e anota no relatório
- [ ] Nenhum erro no console durante o fluxo

**Se chain hash não selar em 10s**: BLOQUEADOR. Significa que o trigger `onInsumoMovimentacaoCreate` está quebrado ou não deployou.

---

## F13b — Admin Migrations: os 3 dry-runs novos (sem aplicar)

**Steps**:

1. Menu de conta (canto sup. direito) → "Painel Super Admin" (precisa ser SuperAdmin)
2. Aba "Migrations"
3. Screenshot: `f13b-01-migrations.png`
4. Localiza as 4 seções:
   - Migração Fase D (Setups → Equipamentos)
   - Limpeza pós-retenção RDC 786
   - **"Onda 2 · Provisioning de claims"** (NOVA)
   - **"⚠ Operação crítica · Período de testes — SuperAdmin temporário"** (NOVA, card vermelho)

**Para "Onda 2 — Provisioning de claims"**:

5. Clica **"Dry-run (inspeciona diff)"**
6. Espera resposta. Screenshot: `f13b-02-provision-dryrun.png`
7. Captura do DOM os contadores: `scanned`, `updated`, `unchanged`, `skipped`

**Para "SuperAdmin temporário — grant"**:

8. Clica **"Dry-run grant"**
9. Espera. Screenshot: `f13b-03-grant-dryrun.png`
10. Captura: `scanned`, `toPromote`, `alreadySuperAdmin`

**Para "SuperAdmin temporário — revoke"**:

11. Clica **"Dry-run revoke"**
12. Espera. Screenshot: `f13b-04-revoke-dryrun.png`
13. Captura: `scanned`, `reverted`, `keptSuperAdmin`

**NUNCA CLICA**: "Aplicar", "Conceder SuperAdmin a todos", "Revogar SuperAdmin temporário"

**Assertions**:
- [ ] As 4 seções aparecem (2 antigas + 2 novas)
- [ ] Card vermelho "Operação crítica" tem o banner de riscos visível (LGPD, cross-lab, etc)
- [ ] Dry-run provision retornou JSON com 4 contadores
- [ ] Dry-run grant retornou com 3 contadores
- [ ] Dry-run revoke retornou sem erro (pode ter `scanned=0` se nada foi promovido ainda — é OK)
- [ ] Nenhuma callable foi chamada em modo apply (confirma via Network que `dryRun: true` está no payload)
- [ ] Audit logs foram criados (`auditLogs` com action `TEMP_SUPERADMIN_*_DRY_RUN` e `PROVISION_MODULES_DRY_RUN`) — se não conseguir verificar via UI, marca não-observável

---

## Saída

`$OUTPUT_DIR/REPORT.md`:

```
# Smoke Focado — {timestamp}

## Sumário
- F03b (OCR Hemato):   [PASS/FAIL/BLOCK]  imagens_ok=N/3
- F08 (Insumos CRUD):  [PASS/FAIL/BLOCK]  produtoId=... insumoId=...
- F09 (Chain hash):    [PASS/FAIL/BLOCK]  selou=true/false
- F13b (Dry-runs):     [PASS/FAIL/BLOCK]  3/3 dry-runs ok

## Contadores dos dry-runs
- provision: scanned=X, updated=Y, unchanged=Z, skipped=W
- grant:     scanned=X, toPromote=Y, alreadySuperAdmin=Z
- revoke:    scanned=X, reverted=Y, keptSuperAdmin=Z

## Network failures
[lista de requests status >= 400]

## Console errors
[lista de console.error do browser]

## Evidências
- f03b-*.png
- f08-*.png
- f09-*.png
- f13b-*.png
```

Exit 0 se todos passaram; 1 se qualquer FAIL ou BLOCK.

Print no terminal final:
```
F03b=PASS  F08=PASS  F09=PASS  F13b=PASS
relatorio: $OUTPUT_DIR/REPORT.md
```
