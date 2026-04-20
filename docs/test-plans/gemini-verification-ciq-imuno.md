# Prompt de Verificação End-to-End — CQ LabClin (CIQ-Imuno + RDC 978/2025)

> **Propósito:** roteiro pra um agente autônomo (Antigravity Gemini) executar um teste completo do sistema HC Quality no ar em `https://hmatologia2.web.app`, simulando um fluxo real de laboratório clínico de imunologia rápida.
>
> **Cole o bloco "PROMPT" abaixo na sessão do Gemini.**
>
> **Data de referência pros cenários:** 20 de abril de 2026.

---

## Dados hipotéticos (use EXATAMENTE esses)

### Kits reagentes (testes rápidos)

| # | Teste | Marca | Lote | Abertura | Validade | Status abertura |
|---|-------|-------|------|----------|----------|-----------------|
| 1 | Dengue NS1 | Wama | `WMD-1587-A` | 2026-04-20 | 2027-06-30 | R (reagente) |
| 2 | HIV 1/2 | Wama | `WMH-2041` | 2026-03-10 | 2027-02-28 | R |
| 3 | HBsAg | Wama | `WMB-8822` | 2026-04-18 | 2027-01-15 | R |
| 4 | Anti-HCV | Wama | `WMC-3315` | 2026-04-01 | 2027-03-20 | R |
| 5 | Sífilis (dupla banda) | Wama | `WMS-7710-EXP` | 2026-04-01 | **2026-04-18** (vencido há 2 dias) | R |

### Material de controle (Controlab)

| # | Lote | Tipo | Abertura | Validade | Observação |
|---|------|------|----------|----------|------------|
| A | `BT3938` | Reagente positivo | 2026-04-20 | 2026-12-15 | Controle principal — longe do vencimento |
| B | `BT4112` | Não-reagente | 2026-04-20 | 2026-11-28 | Controle negativo — par do BT3938 |
| C | `BT4999` | Reagente positivo | 2026-04-10 | **2026-04-25** | **Validade crítica — 5 dias** |
| D | `BT4501-EXP` | Reagente positivo | 2026-04-01 | **2026-04-18** | **Vencido há 2 dias** |

### Usuários (já existentes no sistema)

| Email | Papel | Senha |
|---|---|---|
| drogafarto@gmail.com | Owner · SuperAdmin · RT | 12345678 |
| gqlabclin@gmail.com | Admin (Coordenadora Qualidade — "Ana Costa") | 12345678 |
| areatecnicalabclinlabclin@gmail.com | Member (Técnico Área) | 12345678 |

### URLs

- App: https://hmatologia2.web.app
- Console (só SuperAdmin) acesso via menu → Admin

---

## PROMPT (cole tudo abaixo no Antigravity Gemini)

```
Você é um auditor de sistema simulando o uso diário de um SaaS de Controle 
de Qualidade Interno laboratorial (CIQ) chamado "HC Quality", conforme 
RDC 978/2025 da ANVISA. Laboratório de referência: LabClin Rio Pomba MG.

Sua missão: executar 9 cenários end-to-end e produzir um relatório 
objetivo com cada cenário marcado como [PASS], [FAIL] ou [PARTIAL], 
com screenshots e justificativa.

---

## AMBIENTE

- URL: https://hmatologia2.web.app
- Login principal: drogafarto@gmail.com · senha 12345678 (SuperAdmin/RT)
- Login alternativo 1: gqlabclin@gmail.com · senha 12345678 (Admin)
- Login alternativo 2: areatecnicalabclinlabclin@gmail.com · senha 12345678 (Member)

Módulo a testar: CIQ-Imuno (imunoensaios rápidos).

---

## DADOS HIPOTÉTICOS (use EXATAMENTE esses valores)

### Kits reagentes

| # | Teste            | Marca | Lote         | Abertura   | Validade   | Status |
|---|------------------|-------|--------------|------------|------------|--------|
| 1 | Dengue NS1       | Wama  | WMD-1587-A   | 2026-04-20 | 2027-06-30 | R      |
| 2 | HIV 1/2          | Wama  | WMH-2041     | 2026-03-10 | 2027-02-28 | R      |
| 3 | HBsAg            | Wama  | WMB-8822     | 2026-04-18 | 2027-01-15 | R      |
| 4 | Anti-HCV         | Wama  | WMC-3315     | 2026-04-01 | 2027-03-20 | R      |
| 5 | Sífilis          | Wama  | WMS-7710-EXP | 2026-04-01 | 2026-04-18 | R      |

### Controles Controlab

| # | Lote        | Tipo              | Abertura   | Validade   |
|---|-------------|-------------------|------------|------------|
| A | BT3938      | Reagente positivo | 2026-04-20 | 2026-12-15 |
| B | BT4112      | Não-reagente      | 2026-04-20 | 2026-11-28 |
| C | BT4999      | Reagente positivo | 2026-04-10 | 2026-04-25 |
| D | BT4501-EXP  | Reagente positivo | 2026-04-01 | 2026-04-18 |

---

## CENÁRIOS

### Cenário 1 — Happy path: validação de lote novo de kit Dengue

Premissa: hoje (20/abr/2026) chegou uma caixa nova do kit Dengue NS1 
Wama lote WMD-1587-A. A RDC 978/2025 exige CIQ antes de liberar o lote 
para uso em pacientes.

Passos:
1. Login como drogafarto@gmail.com.
2. Navegue para CIQ-Imuno (pode estar como "CIQ-Imuno" ou "Imunologia").
3. Clique em "Nova corrida".
4. Preencha:
   - Imunoensaio: Dengue
   - Lote do controle: BT3938
   - Fabricante controle: Controlab
   - Abertura controle: 2026-04-20
   - Validade controle: 2026-12-15
   - Lote do reagente: WMD-1587-A
   - Fabricante reagente: Wama
   - Status reagente: R
   - Abertura reagente: 2026-04-20
   - Validade reagente: 2027-06-30
   - Resultado esperado: R
   - Resultado obtido: R
   - Data realização: 2026-04-20
5. Salve.

Validações esperadas:
[ ] Corrida salva com código auto-gerado formato CI-2026-NNNN.
[ ] Lote Dengue/BT3938 aparece na barra lateral.
[ ] Tabela de corridas mostra:
    - coluna CÓDIGO com o CI-2026-NNNN
    - coluna LOTE REAGENTE com "WMD-1587-A"
    - coluna RESULTADO com "R → R" (neutro)
    - coluna CONFORMIDADE com ✓ Conforme (verde)
    - coluna ASSINATURA com "Bruno Pires" + hash curto (ex: "f3a9b2c1…")
[ ] Card "Total Corridas" = 1.
[ ] Card "Não Conformes" = 0.
[ ] Card "Taxa NR" = 0.0% (0 de 1).
[ ] NÃO aparece banner de validade (controle vence em >15 dias).

### Cenário 2 — Não conformidade (falso negativo)

Premissa: rodando o BT3938 (esperado POSITIVO) com outro kit, o teste 
deu NEGATIVO. É um sinal de falha do kit ou armazenamento.

Passos:
1. Nova corrida no mesmo lote Dengue/BT3938.
2. Mesmos dados do Cenário 1, MAS:
   - Resultado esperado: R
   - Resultado obtido: NR
3. Tente salvar.

Validações esperadas:
[ ] Sistema obriga preencher "Ação corretiva" antes de salvar (RDC 978 Art. 128).
[ ] Preencha: "Rodada repetida com novo strip da mesma caixa, novo resultado NR. Lote suspenso para investigação — comunicação ao fornecedor Wama em curso."
[ ] Após salvar, tabela mostra a corrida com CONFORMIDADE = ✗ NC (vermelho).
[ ] Card "Não Conformes" vai a 1.
[ ] Status do lote no header pode mudar para "Atenção" (amarelo) ou permanecer "Válido" se não houver 3+ NC consecutivos.

### Cenário 3 — Validade crítica (< 7 dias)

Passos:
1. Nova corrida.
2. Imunoensaio: HIV
3. Lote controle: BT4999
4. Validade controle: 2026-04-25 (faltam 5 dias)
5. Demais dados: usar kit WMH-2041, resultados R → R.
6. Salve.

Validações esperadas:
[ ] Corrida salva.
[ ] No header do lote HIV/BT4999 aparece badge vermelho "⚠ Controle vence em 5d".
[ ] Acima da tabela de corridas aparece banner vermelho claro: 
    "Controle vence em 5 dia(s). Peça reposição urgente."

### Cenário 4 — Controle EXPIRADO (bloqueio / alerta forte)

Passos:
1. Nova corrida.
2. Imunoensaio: HBsAg
3. Lote controle: BT4501-EXP
4. Validade controle: 2026-04-18 (vencido há 2 dias)
5. Data realização: 2026-04-20

Validações esperadas:
[ ] O sistema DEVE rejeitar o save com mensagem de validação 
    ("Data de realização posterior à validade do controle").
[ ] Se conseguir salvar (bug), verificar se badge "⚠ Controle EXPIRADO há 2d"
    aparece em vermelho forte.
[ ] Banner acima da tabela: "Controle expirado há 2 dia(s). Não registre 
    mais corridas neste lote — substitua o material de controle."

### Cenário 5 — Reagente EXPIRADO

Passos:
1. Nova corrida.
2. Imunoensaio: Sifilis
3. Lote controle: BT3938 (ok)
4. Lote reagente: WMS-7710-EXP
5. Validade reagente: 2026-04-18
6. Data realização: 2026-04-20

Validações esperadas:
[ ] Sistema rejeita com mensagem sobre validade do reagente.
[ ] Se passar, o banner deve destacar reagente vencido.

### Cenário 6 — Gerenciamento de tipos de teste

Passos:
1. Na tela de nova corrida, clique no botão "Gerenciar" ao lado do 
   dropdown "Imunoensaio".
2. Adicione um teste novo chamado "Chikungunya".
3. Feche o modal.
4. Verifique que aparece no dropdown.
5. Reabra Gerenciar e delete "Chikungunya".

Validações esperadas:
[ ] Adição persiste (reload da página mantém).
[ ] Deleção persiste.
[ ] Não há race condition — se abrir o modal em outra aba simultânea 
    e adicionar, o estado continua consistente (edge case, difícil de 
    testar via Gemini — pule se complicado).

### Cenário 7 — Configuração de múltiplos destinatários de relatório

Passos:
1. Faça logout e login como drogafarto@gmail.com.
2. Acesse "Configurações de Relatório" (ou equivalente) em /labsettings.
3. Ative o toggle "Envio automático ativo".
4. Remova o email atual (se houver) e adicione estes 3:
   - drogafarto@gmail.com
   - gqlabclin@gmail.com
   - areatecnicalabclinlabclin@gmail.com
   (Pressione Enter após cada um. Devem virar chips.)
5. Salve configurações.
6. Clique em "Testar envio" (botão só visível pra SuperAdmin).

Validações esperadas:
[ ] Os 3 emails aparecem como chips separados.
[ ] Salvar funciona sem erro.
[ ] Mensagem após "Testar envio": 
    "✓ Relatório enviado para 3 destinatários (Hematologia, Imunologia)." 
    OU 
    "Nenhum setor com corridas hoje — nenhum relatório foi enviado."
    (Depende se foram rodadas corridas hoje — veja se os cenários 
    anteriores geraram dados.)

### Cenário 8 — Aprovação formal de lote pelo RT

Premissa: após acumular ≥3 corridas conformes, o RT deve aprovar o lote.

Passos:
1. Navegue até o lote Dengue/BT3938 (criado no Cenário 1).
2. Garanta que há pelo menos 3 corridas conformes.
3. Clique em "Aprovar lote" (visível se você for owner/admin).
4. Confirme.

Validações esperadas:
[ ] Aparece banner verde "Decisão formal: Aprovado · RT registrado".
[ ] O botão "Aprovar lote" some.
[ ] O botão "Reprovar lote" continua disponível.

### Cenário 9 — Relatório PDF e export CSV (FR-036)

Passos:
1. No lote Dengue/BT3938 (com ≥1 corrida).
2. Clique em "Relatório PDF". Verifique se baixa um PDF.
3. Clique em "FR-036 CSV". Verifique se baixa um CSV.

Validações esperadas:
[ ] PDF abre e tem: identificação do laboratório, nome do RT, lote, 
    corridas listadas, campo para assinatura física.
[ ] CSV tem colunas: Código, Data, Operador, Cargo, Lote Controle, 
    Lote Reagente, Resultado Esperado, Resultado Obtido, Conformidade, 
    Assinatura.

---

## RELATÓRIO FINAL

Ao terminar, produza um relatório em Markdown com:

1. Resumo executivo (X de 9 cenários passaram).
2. Para cada cenário: [PASS] / [FAIL] / [PARTIAL] + screenshots chave + 
   observações.
3. Lista de bugs encontrados (cada um com: passos para reproduzir, 
   comportamento observado, comportamento esperado).
4. Sugestões de melhoria UX (campos confusos, mensagens de erro, 
   fluxos que quebram expectativa).
5. Avaliação geral de aderência à RDC 978/2025 (é possível rodar o 
   CIQ completo de um laboratório usando só essa ferramenta? o que 
   ainda falta?).

IMPORTANTE:
- Use EXATAMENTE os lotes e datas acima. Qualquer desvio cria ruído.
- Registre data/hora de cada ação (timestamps ajudam a correlacionar 
  com logs do servidor).
- Se um cenário depender de dado que não existe ainda, crie na hora, 
  mas documente que foi criado.
- Se encontrar bug crítico (perda de dado, email não enviado, crash), 
  marque [CRITICAL] e pare para reportar antes de seguir.
```

---

## Como rodar

1. Abra o Antigravity (Gemini 3.x) em uma janela nova do Chrome.
2. Garanta que o navegador esteja logado no Google com permissão de preview do app.
3. Cole TUDO dentro do bloco marcado `## PROMPT` acima.
4. Deixe rodar. Tempo estimado: 25-45 minutos para os 9 cenários.
5. Receba o relatório final e me cole aqui pra eu triar os bugs encontrados.

## O que esperar

O Gemini vai:
- Clicar, digitar, tirar screenshot
- Fazer logout/login várias vezes
- Testar tanto o happy path quanto casos borderline (validades no limite)
- Enviar o email real de teste (vai chegar na sua caixa)

## Limpeza depois

Os dados dos cenários vão criar corridas reais no Firestore. Como é produção de um lab único, depois de auditar:
- Você pode excluir os lotes de teste via UI (botão "Excluir" em cada lote)
- O audit trail (CIQ audit log) mantém registro da exclusão
- Se preferir zerar tudo, me peça e eu rodo um script com Admin SDK
