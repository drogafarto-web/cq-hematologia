# Roteiro E2E Profundo — HC Quality no Antigravity (Gemini 3 Flash + Computer Use 2.5)

> **Data de referência:** 20/04/2026. **Laboratório:** LabClin Rio Pomba MG. **App:** https://hmatologia2.web.app
>
> Este é o **roteiro profundo**. Cobre cadastro, registro, integridade de banco, autorização, auditoria, invariantes de negócio, edge cases e regressão das falhas conhecidas. Tempo estimado: **3-5h** em Agent mode.

---

## Boas práticas aplicadas (Antigravity + engenharia)

- **Modo:** Agent-driven com Allow List controlada (não deixar o agente rodar `firebase deploy` por conta própria).
- **Browser extension obrigatória** — agente precisa ler DOM e tomar screenshot.
- **Artifacts:** o agente deve produzir um Plano no início e um Walkthrough final com evidências.
- **Testes organizados em pirâmide invertida** (E2E primeiro porque o unit/integration já existe em `test/unit/`).
- **Cobertura por princípios:** boundary testing, equivalence partitioning, negative cases, regression, fuzz leve, permission matrix, CRUD completo, integridade referencial.
- **Evidências:** timestamp + screenshot + ID do documento Firestore gerado (lido do DevTools/Network) pra cada PASS/FAIL.
- **Isolamento:** cada fase salva IDs criados pra cleanup ao final. Nada fica permanente em produção.

---

## Dados hipotéticos (fonte única da verdade — NÃO invente outros)

### Kits reagentes (Wama Diagnóstica)

| # | Ensaio | Lote | Abertura | Validade | Status | Notas |
|---|--------|------|----------|----------|--------|-------|
| K1 | Dengue NS1 | `WMD-1587-A` | 2026-04-20 | 2027-06-30 | R | lote novo — teste happy path |
| K2 | HIV 1/2 | `WMH-2041` | 2026-03-10 | 2027-02-28 | R | lote médio prazo |
| K3 | HBsAg | `WMB-8822` | 2026-04-18 | 2027-01-15 | R | usar em Cenário 10 |
| K4 | Anti-HCV | `WMC-3315` | 2026-04-01 | 2027-03-20 | R | usar em Cenário 11 |
| K5 | Sífilis | `WMS-7710-EXP` | 2026-04-01 | **2026-04-18** | R | **reagente vencido há 2d** |
| K6 | COVID-19 Ag | `WMC19-9900` | 2026-04-20 | **2026-04-27** | R | **vence em 7d — limite crítico** |
| K7 | BhCG | `WMBH-0502` | 2026-04-20 | **2026-05-04** | R | **vence em 14d — limite warning** |
| K8 | Troponina | `WMT-4410-XSS` | 2026-04-20 | 2027-05-30 | R | lote com string especial pra fuzz: `WMT<script>4410` |

### Controles (Controlab + hipotéticos)

| # | Lote | Tipo | Fabricante | Abertura | Validade | Notas |
|---|------|------|------------|----------|----------|-------|
| C1 | `BT3938` | Reagente positivo | Controlab | 2026-04-20 | 2026-12-15 | controle principal — 239d |
| C2 | `BT4112` | Não-reagente | Controlab | 2026-04-20 | 2026-11-28 | par negativo de C1 |
| C3 | `BT4999` | Reagente positivo | Controlab | 2026-04-10 | **2026-04-25** | **critical — 5d restantes** |
| C4 | `BT4501-EXP` | Reagente positivo | Controlab | 2026-04-01 | **2026-04-18** | **expirado há 2d** |
| C5 | `BT-UNICODE-São` | Reagente positivo | Controllab Ltda. | 2026-04-20 | 2026-12-01 | acentos pra teste de serialização |
| C6 | `BT5050` | Reagente positivo | Controlab | 2026-04-20 | 2026-11-15 | usar em apenas 1 corrida |
| C7 | `BT6060` | Não-reagente | Controlab | 2026-04-20 | 2026-10-30 | usar em 3 corridas e aprovar |

### Ensaios hipotéticos pra test type manager

- `Chikungunya` (add)
- `Zika` (add)
- `chikungunya` (duplicate case-insensitive — deve ser rejeitado)
- `Dengue` (já existe — deve ser rejeitado)
- `Rubéola` (add com acento)
- `Teste" OR 1=1--` (fuzz / injection attempt — deve ser aceito como string literal sem quebrar)

### Usuários (já criados em produção)

| Email | Senha | Papel | Nome | CRBM |
|-------|-------|-------|------|------|
| drogafarto@gmail.com | 12345678 | Owner/SuperAdmin/RT | Bruno Pires | MG 12345 |
| gqlabclin@gmail.com | 12345678 | Admin | Ana Costa | — |
| areatecnicalabclinlabclin@gmail.com | 12345678 | Member | Areatecnica Labclin | — |
| drogafartomercadolivre@gmail.com | 12345678 | Admin | Drogafarto Admin | — |

### Cenário de carga (concorrência)

Para phases que exigem simulação de duas abas simultâneas, abrir 2 janelas do Chrome com sessions independentes (profile A e profile B), logar em Owner e Admin respectivamente.

---

## PROMPT (colar no Antigravity — Agent mode)

````
# IDENTIDADE

Você é um QA Engineer sênior conduzindo verificação E2E profunda do HC Quality
(SaaS multi-tenant de CQI laboratorial, React 19 + Firebase + Gemini OCR,
compliance RDC 978/2025 + LGPD). Objetivo: validar CADASTRO, REGISTRO,
INTEGRIDADE DO BANCO, AUTORIZAÇÃO, AUDITORIA e EDGE CASES.

# ARTIFACTS OBRIGATÓRIOS (produza nessa ordem)

1. PLANO — lista numerada das 14 fases abaixo com tempo estimado por fase
   (apresente antes de começar a executar).
2. WALKTHROUGH — ao final, relatório estruturado em markdown com:
   - Resumo (X/Y fases PASS, Z bugs encontrados, classificados por severidade)
   - Por fase: status + screenshots + IDs de documento Firestore criados
   - Tabela de bugs: [severidade] [descrição] [passos] [esperado vs obtido]
   - Apêndice: lista de IDs pra cleanup (runs, lots, test types, corridas)
   - Veredito final de aderência à RDC 978/2025

# REGRAS DE CONDUTA

- Use os dados hipotéticos EXATAMENTE como especificados. Não invente outros.
- Screenshot em pontos de decisão (antes/depois de cada cadastro, cada erro).
- Para cada escrita, capture no DevTools > Firestore o ID do doc gerado.
- Se encontrar bug [CRITICAL] (perda de dado, crash total, vazamento), PARE
  e reporte antes de continuar.
- NUNCA execute: firebase deploy, gcloud, git push, npm run deploy, ou
  qualquer mutação em infra. Apenas interaja com a UI do app.
- NUNCA crie usuários além dos pré-existentes. Apenas use os 4 listados.

# AMBIENTE

- App: https://hmatologia2.web.app
- Login Owner: drogafarto@gmail.com / 12345678
- Login Admin: gqlabclin@gmail.com / 12345678
- Login Member: areatecnicalabclinlabclin@gmail.com / 12345678
- Login Admin 2: drogafartomercadolivre@gmail.com / 12345678
- Data de hoje: 2026-04-20

# DADOS HIPOTÉTICOS (use EXATAMENTE)

## Kits (reagentes Wama)
- K1 Dengue NS1 | WMD-1587-A | abr 2026-04-20 | val 2027-06-30 | R
- K2 HIV 1/2 | WMH-2041 | abr 2026-03-10 | val 2027-02-28 | R
- K3 HBsAg | WMB-8822 | abr 2026-04-18 | val 2027-01-15 | R
- K4 Anti-HCV | WMC-3315 | abr 2026-04-01 | val 2027-03-20 | R
- K5 Sífilis | WMS-7710-EXP | abr 2026-04-01 | val 2026-04-18 (vencido 2d) | R
- K6 COVID-19 Ag | WMC19-9900 | abr 2026-04-20 | val 2026-04-27 (crítico 7d) | R
- K7 BhCG | WMBH-0502 | abr 2026-04-20 | val 2026-05-04 (warning 14d) | R
- K8 Troponina | WMT-4410-XSS | abr 2026-04-20 | val 2027-05-30 | R

## Controles (Controlab)
- C1 BT3938 | R pos | val 2026-12-15 | principal
- C2 BT4112 | NR | val 2026-11-28 | par negativo
- C3 BT4999 | R pos | val 2026-04-25 (5d) | crítico
- C4 BT4501-EXP | R pos | val 2026-04-18 (vencido 2d) | expirado
- C5 BT-UNICODE-São | R pos | val 2026-12-01 | acentos
- C6 BT5050 | R pos | val 2026-11-15 | única corrida
- C7 BT6060 | NR | val 2026-10-30 | 3 corridas + aprovação

---

# FASES DE TESTE (14 fases)

## FASE 1 — Autenticação & Matriz de Permissões (20min)

### 1.1 Login/logout básico
- Login com cada uma das 4 contas. Verifique redirect pós-login.
- Logout em cada. Verifique cleanup da session (não dá pra voltar com back button).

### 1.2 Credenciais inválidas
- Tentar login com drogafarto@gmail.com / senha_errada
  - ESPERADO: erro "credenciais inválidas", sem vazamento de info (não dizer "email existe mas senha está errada" vs "email não existe").
- Tentar login com email inexistente@gmail.com / qualquer_coisa
  - ESPERADO: mesma mensagem de erro genérica.

### 1.3 Matriz de permissões (critical)
Para cada papel, tentar:

| Ação | Owner/SuperAdmin | Admin | Member |
|------|------------------|-------|--------|
| Criar usuário (painel admin) | PASS esperado | PASS esperado | FAIL esperado (UI esconde) |
| Deletar usuário | PASS | FAIL | FAIL |
| Setar SuperAdmin | PASS | FAIL | FAIL |
| Criar lote CIQ-Imuno | PASS | PASS | PASS |
| Aprovar lote formalmente | PASS | PASS | FAIL esperado |
| Reprovar lote | PASS | PASS | FAIL |
| Editar config LabCQISettings | PASS | PASS | FAIL (esconde botão salvar) |
| Ver botão "Testar envio" | PASS | FAIL | FAIL |
| Disparar backup manual | PASS | FAIL | FAIL |
| Excluir lote | PASS | PASS | FAIL |

Para cada célula "FAIL esperado", confirmar que ou:
- UI esconde a ação, OU
- UI mostra mas ação retorna erro "permission-denied" do Firebase.

Screenshot de ao menos 3 tentativas bloqueadas.

## FASE 2 — Integridade referencial & JWT claims (10min)

### 2.1 Custom claims
- Logado como SuperAdmin, abra DevTools > Application > Storage > IndexedDB
  > firebaseLocalStorageDb. Procure `customClaims` no payload do token.
- ESPERADO: `{ isSuperAdmin: true }`.
- Se ausente: [CRITICAL] — claim não sincronizada.

### 2.2 Token refresh após change role
Cenário (requer 2 browsers/profiles):
- Browser A: SuperAdmin logado.
- Browser B: Admin (gqlabclin) logado.
- No Browser A, muda Admin → Member pelo painel (se existir função).
- No Browser B, tentar editar um lote (ação de Admin).
- ESPERADO: falhar com permission-denied OU refresh automático do token e refletir o Member.
- Documentar o tempo até propagação.

## FASE 3 — Cadastro de Tipos de Teste (CRUD + race) (15min)

### 3.1 CRUD básico
Como Owner, abrir Gerenciar tipos no form CIQ-Imuno.
- Adicionar `Chikungunya` → ESPERADO: persiste, aparece no dropdown.
- Adicionar `Zika` → PASS.
- Adicionar `chikungunya` (lowercase) → ESPERADO: rejeitado com erro "já existe".
- Adicionar `Dengue` → ESPERADO: rejeitado (já default).
- Adicionar `Rubéola` → PASS (acentos suportados).
- Adicionar `Teste" OR 1=1--` → PASS (string literal). Depois VERIFICAR que o valor
  aparece no dropdown com a string exata, SEM executar como código (vistoria XSS).
- Renomear `Zika` → `Zika Vírus` → PASS.
- Deletar `Teste" OR 1=1--` → PASS.

### 3.2 Regressão da race condition (critical)
Abrir 2 abas simultâneas logadas como Owner:
- Aba A: abrir Gerenciar tipos.
- Aba B: abrir Gerenciar tipos.
- Em Aba A adicionar `ConcorrenciaA`. Em Aba B IMEDIATAMENTE adicionar `ConcorrenciaB`.
- ESPERADO (pós-fix de 2026-04-19): ambos persistem. Recarregando Aba C,
  ambos aparecem.
- FALHA se: um dos dois desaparece (bug original, já corrigido via transactions).
- Evidência: screenshot de Aba C com ambos visíveis.

### 3.3 Loading gate (regressão)
- Abrir o form CIQ-Imuno pela primeira vez numa session fresca.
- Enquanto o spinner "Carregando tipos de teste…" está visível, tentar clicar
  em "Gerenciar".
- ESPERADO: botão desabilitado (opacity reduzida), tooltip "Aguarde o carregamento".
- FALHA se: modal abre com lista vazia e permite adicionar (risco de apagar base).

## FASE 4 — Validações Zod no form CIQ-Imuno (25min)

Para cada um dos casos abaixo, tentar salvar uma nova corrida e verificar
se o schema bloqueia corretamente. Use K1 + C1 como base e substitua só o
campo alvo.

### 4.1 Data inválida
- `dataRealizacao` = "2026-13-45" → ESPERADO: erro "Formato YYYY-MM-DD".
- `dataRealizacao` = "2026/04/20" → ESPERADO: erro.
- `dataRealizacao` = "" → ESPERADO: erro "obrigatório".

### 4.2 Data posterior à validade (RDC 978 hard rule)
- `dataRealizacao` = 2026-04-20, `validadeControle` = 2026-04-19
  → ESPERADO: erro "Data de realização não pode ser posterior à validade do controle".
- `dataRealizacao` = 2026-04-20, `validadeReagente` = 2026-04-19
  → ESPERADO: erro análogo para reagente.
- `dataRealizacao` = 2026-04-20, `validadeControle` = 2026-04-20 (igual)
  → ESPERADO: PASS (<= permite o dia exato).

### 4.3 Abertura após realização
- `aberturaControle` = 2026-04-21, `dataRealizacao` = 2026-04-20
  → ESPERADO: erro "abertura não pode ser posterior à realização".

### 4.4 Campos obrigatórios vazios
Salvar com cada um desses vazios separadamente:
- `loteControle` vazio → ESPERADO: erro
- `loteReagente` vazio → ESPERADO: erro
- `resultadoEsperado` vazio → ESPERADO: erro
- `resultadoObtido` vazio → ESPERADO: erro

### 4.5 TestType fora do enum
- Via DevTools > React DevTools, mutar o select pra "TestInexistente" e submeter.
- ESPERADO: Zod rejeita com erro de enum (`Invalid enum value`).

### 4.6 Ação corretiva obrigatória em NC
- `resultadoEsperado` = R, `resultadoObtido` = NR, `acaoCorretiva` vazia.
- ESPERADO: erro "Ação corretiva obrigatória em não-conformidade" (RDC Art.128).
- Com `acaoCorretiva` = "Repeti o teste com outro strip. Mesma divergência. Lote 1587 suspenso pra investigação com Wama."
- ESPERADO: PASS.

## FASE 5 — Registro de corrida — Happy path completo (15min)

### 5.1 Criação de lote novo
Como Owner, nova corrida com K1 + C1 + R → R (conforme).
- ESPERADO:
  - Lote Dengue/BT3938 criado na barra lateral.
  - Contador "Total Corridas" = 1.
  - Tabela mostra: CÓDIGO CI-2026-0001 (ou próximo), DATA 2026-04-20,
    LOTE REAGENTE WMD-1587-A, RESULTADO "R → R", CONFORMIDADE "✓ Conforme"
    (verde), ASSINATURA "Bruno Pires" + hash SHA-256 (8 chars visíveis).
- Capturar o `runId` no Firestore (DevTools > Network > aba com setDoc).

### 5.2 Verificação da assinatura SHA-256
- Abra DevTools > Application > IndexedDB > firestore > Documents.
- Localize o run recém-criado em `labs/labclin-riopomba/ciq-imuno/*/runs/*`.
- Copie `logicalSignature`.
- ESPERADO: string hex de 64 caracteres. Se for menor ou com caracteres
  não-hex → [CRITICAL].

### 5.3 runCode sequential
- Criar 3 runs adicionais no mesmo lote (todas conformes, mesmos dados).
- ESPERADO: runCodes CI-2026-NNNN incrementando por 1.
- FALHA se: duplicatas, buracos, ou volta pra 0001.

### 5.4 Audit trail
- No Firestore, navegar em `labs/labclin-riopomba/ciq-imuno/{lotId}/audit`.
- ESPERADO: 0 documentos (audit é de EDIT, não de create).
- Agora edite o lote (mudar validadeControle de 2026-12-15 pra 2026-12-20).
- ESPERADO: 1 documento criado em audit com
  `action=lot_edit`, `actorUid`, `prevValues`, `newValues`, `createdAt`.
- Tente DELETAR esse doc de audit via console Firestore.
- ESPERADO: permission-denied (rule `allow update, delete: if false`).

## FASE 6 — Não-conformidade & Westgard Categórico (20min)

### 6.1 Registrar NC
- Nova corrida no lote Dengue/BT3938: esperado R, obtido NR, ação corretiva
  "Strip com banda T fraca; repetido com novo kit, obtido R correto. Caixa 1587
  segregada."
- ESPERADO: corrida salva com CONFORMIDADE ✗ NC (vermelho).
- Card "Não Conformes" = 1.
- Taxa NR recalculada corretamente.

### 6.2 Três NCs consecutivos
- Registrar mais 2 NCs seguidas.
- ESPERADO: alerta Westgard categórico aparece
  (`consecutivos_3nr` ou similar).
- Status do lote pode virar "Atenção" (amarelo) ou "Reprovado" (vermelho).
- Banner amarelo/vermelho acima da tabela descrevendo o problema.

### 6.3 Regressão — depois de NCs, criar Conformes
- Registrar 5 conformes seguidas.
- ESPERADO: alerta Westgard persiste no histórico mas status calculado
  pode voltar a "Válido" se regra for baseada em janela recente.
- Documentar comportamento observado.

### 6.4 Taxa de falha > 10%
- Contabilizar: runs totais no lote vs. NCs.
- Se >10%, ESPERADO: alerta `taxa_falha_10pct` visível.

## FASE 7 — Alertas de validade (20min)

### 7.1 Nível WARNING (8-15 dias)
- Criar corrida com C6 BT5050 (val 2026-11-15) e K7 BhCG (val 2026-05-04, 14d).
- ESPERADO:
  - Save funciona.
  - Badge no header do lote BhCG/BT5050: nenhum pra controle (ok),
    mas ValidityBanner mostra "Kit reagente lote WMBH-0502 vence em 14 dia(s)"
    em amarelo.

### 7.2 Nível CRITICAL (1-7 dias)
- Criar corrida com C3 BT4999 (val 2026-04-25, 5d) e K6 COVID-19 Ag
  (val 2026-04-27, 7d).
- ESPERADO:
  - Badge vermelho claro "⚠ Controle vence em 5d" no header.
  - Banner vermelho claro acima da tabela com 2 linhas (controle + reagente).

### 7.3 Controle EXPIRADO (-1+ dias)
- Tentar criar corrida com C4 BT4501-EXP (val 2026-04-18) + K1 + data
  realização 2026-04-20.
- ESPERADO: Zod refine bloqueia.
- Tentar com `dataRealizacao` = 2026-04-17 (dentro da validade).
- ESPERADO: PASS (realização antes do vencimento é válida).
- Navegar ao lote criado.
- ESPERADO: Badge vermelho forte "⚠ Controle EXPIRADO há 2d" no header.
- Banner vermelho forte no topo da lista de corridas.
- Tentar registrar NOVA corrida nesse lote com data de hoje.
- ESPERADO: bloqueado pelo Zod.

### 7.4 Reagente EXPIRADO
- Criar corrida com C1 + K5 WMS-7710-EXP (val 2026-04-18) + data 2026-04-20.
- ESPERADO: Zod refine `dataRealizacao <= validadeReagente` bloqueia.

### 7.5 Boundary exato (0 dias)
- Criar corrida com dataRealizacao = validadeControle = 2026-04-20.
- ESPERADO: PASS (refine é `<=`, não `<`).

## FASE 8 — Aprovação formal do lote (10min)

### 8.1 RT aprova lote
- Lote Dengue/BT3938 com 3+ conformes.
- Como Owner (RT), clicar "Aprovar lote".
- ESPERADO:
  - Banner verde "Decisão formal: Aprovado · RT registrado".
  - Doc do lote tem `ciqDecision: 'A'`, `decisionBy: <uid>`, `decisionAt: Timestamp`.
  - Botão "Aprovar" some.

### 8.2 Revogar aprovação (tentar reprovar)
- No mesmo lote aprovado, clicar "Reprovar lote".
- ESPERADO: muda `ciqDecision` pra 'Rejeitado', banner vira vermelho.

### 8.3 Member tenta aprovar
- Logout, login como Member (areatecnica).
- Navegar pro lote.
- ESPERADO: botão "Aprovar" NÃO aparece (canDecide = false).
- Se aparecer: [bug] verificar autorização via DevTools React.

## FASE 9 — Exclusão e auditoria de delete (10min)

### 9.1 Excluir lote com corridas
- Criar um lote descartável: nova corrida com C5 BT-UNICODE-São + K2 HIV.
- Excluir o lote pelo botão "Excluir".
- ESPERADO:
  - Confirmação modal.
  - Após OK: lote some da barra lateral.
  - No Firestore, `labs/labclin-riopomba/ciq-audit/{uuid}` tem novo doc
    com `action=lot_delete`, `lotSnapshot`, `actorUid`.
  - Doc do lote e subcoleção `runs/*` SOMEM do Firestore.
- Verificar que o audit record NÃO some (imutável via rule).

### 9.2 Member tenta deletar
- Logado como Member, tentar excluir lote.
- ESPERADO: botão escondido ou erro permission-denied.

### 9.3 Unicode/acentos preservados no audit
- Inspecionar o audit record de 9.1.
- `lotSnapshot.loteControle` deve ser `BT-UNICODE-São` exatamente (sem escape).

## FASE 10 — Configurações de relatório & multi-email (20min)

### 10.1 Carregamento
- Como Owner, abrir /labsettings ou equivalente.
- ESPERADO: chips carregam com emails existentes (drogafarto@gmail.com
  pelo menos).

### 10.2 Adicionar múltiplos
- Adicionar `drogafarto@gmail.com` (se não estiver),
  `gqlabclin@gmail.com`, `areatecnicalabclinlabclin@gmail.com`.
- Usar Enter após cada.
- ESPERADO: 3 chips, dedup case-insensitive.

### 10.3 Paste em lote
- Colar string `a@test.com, b@test.com; c@test.com d@test.com` no input.
- ESPERADO: 4 chips adicionados de uma vez.
- Remover os 4 antes de prosseguir.

### 10.4 Validação de formato
- Tentar `email_sem_arroba` → ESPERADO: erro inline "e-mail inválido".
- Tentar `abc@` → ESPERADO: erro.
- Tentar `@bcd.com` → ESPERADO: erro.

### 10.5 Max 10
- Adicionar 11 emails sequencialmente (emails@test.com, email2@test.com...
  email11@test.com).
- ESPERADO: 10º entra, 11º bloqueado com "Máximo de 10 destinatários".

### 10.6 Backspace empty
- Com 3 chips e input vazio, pressionar Backspace.
- ESPERADO: último chip removido.

### 10.7 Salvar
- Com 3 chips válidos, clicar "Salvar configurações".
- ESPERADO: mensagem ✓ Configurações salvas.
- Reload da página: 3 chips reaparecem.

### 10.8 Testar envio (SuperAdmin)
- Clicar "Testar envio".
- ESPERADO: mensagem verde "Relatório enviado para N destinatários…" ou
  cinza "Nenhum setor com corridas hoje" se não houver dados em 2026-04-20.
- Checar a caixa drogafarto@gmail.com após 1 minuto — email do remetente
  `cqi@app.labclinmg.com.br` DEVE estar lá.

### 10.9 Legacy fallback
- Via Firestore console, criar um lab fake com SOMENTE o campo antigo
  `backup.email` (string) sem `emails`. Carregar a tela.
- ESPERADO: chip único com o email antigo (migração on-read via normalizeBackup).

## FASE 11 — Export & rastreabilidade (15min)

### 11.1 Relatório PDF
- Lote Dengue/BT3938 com runs. Clicar "Relatório PDF".
- ESPERADO: download do PDF.
- Abrir: deve conter cabeçalho do lab, dados do lote, tabela de runs,
  espaço pra assinatura física, data de geração.
- Verificar que mostra nome do operador por run.

### 11.2 CSV FR-036
- Clicar "FR-036 CSV".
- ESPERADO: download .csv.
- Abrir no Excel/text editor. Colunas devem incluir (sem ordem fixa):
  Código, Data, Operador, Cargo, Lote Controle, Lote Reagente,
  Resultado Esperado, Resultado Obtido, Conformidade, Assinatura.

### 11.3 QR Code
- No hover de uma linha, aparece ícone QR. Clicar.
- ESPERADO: modal com QR code escaneável. Scan com celular deve
  levar a uma URL ou mostrar dados da run.

## FASE 12 — Integridade do banco & invariantes (20min)

### 12.1 Isolamento por lab
- Abrir Firestore via DevTools. Tentar ler um path de lab OUTRO que
  `labclin-riopomba` (se houver). ESPERADO: permission-denied (rule
  `isActiveMemberOfLab`).

### 12.2 Updated status consistente
- Criar 2 runs conformes. Verificar `activeLot.runCount` = 2 no doc.
- Criar 1 NC. `runCount` = 3 (soma all), não só conformes.
- `lotStatus` deve ser recomputado via Westgard.

### 12.3 Counter atomic (generateRunCode)
- Criar 5 runs em 5 segundos (rapido). Confirmar runCodes sequenciais
  sem gaps, sem duplicatas.
- No Firestore, ler `labs/labclin-riopomba/ciq-imuno-meta/counters` —
  `runCount` deve == último CI-2026-NNNN.

### 12.4 Firestore backup logs
- Como SuperAdmin, ler `firestore-backup-logs/{YYYY-MM-DD}` do dia
  mais recente via Firestore console.
- ESPERADO: doc existe com `operationName`, `outputUri`, `triggeredAt`.
- Tentar criar um doc novo nessa coleção via client.
- ESPERADO: permission-denied (server-side only).

### 12.5 Timestamps serverTimestamp
- Inspecionar um run recém-criado.
- Campo `createdAt` e `confirmedAt` devem ser Firestore Timestamps
  (não strings, não Date do cliente). Verificar que o valor bate com
  o horário do servidor (±5s do browser time).

## FASE 13 — Edge cases, fuzz e UX (20min)

### 13.1 Double-click no save
- Preencher form, clicar "Salvar" 10 vezes rápido.
- ESPERADO: UMA corrida criada (idempotência via `isSaving` state).

### 13.2 Network throttle
- DevTools > Network > Slow 3G.
- Salvar corrida.
- ESPERADO: loading visível, save completa eventualmente.
- Agora Offline.
- Salvar: ESPERADO: erro visível, não crash.

### 13.3 Long strings
- Ação corretiva com 10.000 caracteres (copy paste Lorem Ipsum).
- ESPERADO: salva OU rejeita com max length claro. Não truncate silencioso.

### 13.4 XSS em lote reagente
- Lote reagente = `<script>alert('xss')</script>`.
- Salvar e visualizar na tabela.
- ESPERADO: string aparece literal, alert() NÃO executa.
- React auto-escapa — verificar que não há dangerouslySetInnerHTML no path.

### 13.5 Unicode / emoji
- Lote reagente = `Lote🧪Test`.
- ESPERADO: salva, exibe corretamente.

### 13.6 Colar muito conteúdo no draft de email
- No chip input, colar 50 emails separados por vírgula.
- ESPERADO: primeiros 10 entram, 11+ bloqueado, mensagem clara.

### 13.7 Recarga durante save
- Iniciar save, F5 durante loading.
- ESPERADO: ou salvou e reload mostra, ou não salvou e tem que refazer.
  NUNCA: dado parcial (lote criado sem run, por exemplo).

## FASE 14 — Performance, a11y, observabilidade (15min)

### 14.1 Lighthouse
- DevTools > Lighthouse > Categoria: Performance, Accessibility, Best Practices.
- Rodar em /labsettings e em CIQ-Imuno.
- Reportar scores LCP, INP, CLS, bundle size.

### 14.2 axe smoke (a11y)
- Instalar extensão axe DevTools do Chrome (se possível).
- Scan em /labsettings e no modal "Gerenciar tipos".
- Reportar critical violations (label sem for, contraste, ARIA).

### 14.3 Navegação por teclado
- Partindo do header, Tab/Shift-Tab.
- Cada chip de email deve ter botão X focável.
- Enter no input = commitEmailDraft.
- ESPERADO: todos os controles alcançáveis sem mouse.

### 14.4 Console warnings
- Reload completo, abrir Console.
- ESPERADO: zero errors. Warnings são ok mas anotar.
- FALHA [MEDIUM] se houver: "Can't perform React state update on unmounted",
  "Each child should have unique key", fetch errors.

---

# CHECKLIST FINAL

Ao terminar as 14 fases, produza:

- [ ] Relatório markdown conforme seção ARTIFACTS.
- [ ] Lista de IDs criados pra cleanup: todos os lotes test, corridas,
      test types adicionados, configurações modificadas.
- [ ] Ranking de bugs por severidade:
      [CRITICAL] (perda de dado / segurança) >
      [HIGH] (fluxo quebrado) >
      [MEDIUM] (UX ruim) >
      [LOW] (polimento).
- [ ] Cobertura estimada: fases PASS / total.
- [ ] Avaliação de aderência RDC 978/2025 numa escala 0-10 com justificativa.

---

## ANTI-PADRÕES A MONITORAR

Durante todo o teste, anote se encontrar:
- Dados clínicos no console.log ou network em claro (PII leak).
- Requests pra domínios não-Firebase sem justificativa.
- Tokens JWT expostos no localStorage (padrão Firebase é ok, mas verificar).
- Formulários sem label, botões sem aria-label.
- Cores carregando semântica sem texto/ícone (ex: vermelho = erro sem texto "erro").
- Racing saves (clicar salvar + voltar rapidamente).
- Estados visuais inconsistentes (loading spinner que não some).

````

---

## Notas de execução

1. **Modo do Agent:** use **Agent-driven** com allow list estrita (só `navigator.*`, `DOM.click`, `keyboard.type`). Deny: terminal commands.
2. **Paralelização:** fases 1-3 podem rodar em sequência. Fase 3.2 exige 2 janelas — configure o Agent com 2 browser contexts.
3. **Cleanup:** após aprovar relatório, me peça um script para remover os lotes e test types criados (eu mando via Admin SDK).
4. **Reexecução:** se o Gemini travar no meio, marque a fase onde parou e resume. Dados hipotéticos são idempotentes (criar lote com mesmo (testType, loteControle) retorna o existente via `findCIQLot`).
5. **Custo estimado:** ~3-5h de browser time. Gemini 3 Flash cobra por token — é um teste pesado, prepare budget.

## Sources (Antigravity docs)

- [Google Antigravity — página oficial](https://antigravity.google/)
- [Gemini 3 Flash in Google Antigravity](https://antigravity.google/blog/gemini-3-flash-in-google-antigravity)
- [Getting Started with Google Antigravity (Codelabs)](https://codelabs.developers.google.com/getting-started-google-antigravity)
- [Google Antigravity — docs](https://www.googleantigravity.org/docs)
- [Antigravity GEMINI.md & System Prompt Guide 2026](https://antigravity.codes/blog/antigravity-gemini-md-system-prompt-guide)
- [15 Essential Antigravity Tips (DEV Community)](https://dev.to/czmilo/15-essential-google-antigravity-tips-and-tricks-complete-guide-in-2025-3omj)
- [Choosing Antigravity or Gemini CLI — Google Cloud Blog](https://cloud.google.com/blog/topics/developers-practitioners/choosing-antigravity-or-gemini-cli)
