# HC Quality — CIQ-Imuno · Auditoria Read-Only (Gemini)

**Modelo alvo**: Gemini 2.5 (Antigravity ou similar com browser tool).
**Modo**: 100% leitura. Zero mutação de dados, zero edição de código, zero
deploy. Apenas observa, captura screenshots, reporta achados.

---

## Credenciais

```
URL              = https://hmatologia2.web.app
EMAIL            = drogafarto@gmail.com
SENHA            = 12345678
LAB              = LabClin Rio Pomba MG
OUTPUT_DIR       = ./gemini-audit-ciq-imuno-{timestamp}
```

---

## Missão

Você é um QA sênior fazendo **auditoria de UX e regressão visual** no módulo
CIQ-Imuno em produção. Sua entrega é um **relatório markdown estruturado**
descrevendo o estado atual da interface, achados de UX/UI, dados visíveis,
estados de cada tela, e qualquer comportamento estranho. **Você NÃO conserta
nada. Você NÃO sugere fix em código.** Apenas descreve o que vê.

Seu cliente é o CTO do produto. Ele já recebe propostas de fix de outras
fontes — o valor seu é a **qualidade da observação**, não o conserto.

---

## Regras não-negociáveis (REPROVA O TURNO SE QUEBRAR)

1. **Zero clicks em botões mutadores.** Lista negra completa:
   - `+ Novo lote`, `+ Cadastrar novo produto no catálogo`, `Cadastrar produto`,
     `Cadastrar lote`, `Salvar produto`, `Salvar alterações`
   - `+ Registrar Corrida`, `+ Corrida`, `Salvar corrida`
   - `Disponibilizar p/ corrida`, `Disponibilizar como Em Validação`
   - `Qualificar lote`, `Aprovar lote`, `Reprovar`, `Aprovar`, `Confirmar`
   - `Vincular`, `Desvincular`, `Pin`, `Unpin`
   - `Abrir lote`, `Encerrar`, `Descartar`, `Excluir`, `Excluir definitivamente`
   - `Trocar lote` (não — esse é só UI, mas pra evitar estado parcial: não)
   - `+ Adicionar tipo de teste`, qualquer botão verde com `+`
   - `Renomear`, `Remover`
   - Qualquer botão dentro de modal de admin/migrations

2. **Zero preenchimento de inputs.** Não digite em nenhum input. Pode
   abrir um modal pra ver os campos, mas saia via Cancelar/Esc/X sem
   preencher.

3. **Zero alteração de filtros que persistem state**: ler dropdowns/chips
   está OK pra observar, mas restaure o estado original antes de mudar de
   tela. Filtros visuais (search) que limpam ao fechar a aba são livres.

4. **Modais**: abre, observa, fecha. Sempre via X (`aria-label="Fechar"`)
   ou Escape. NUNCA via botão de submit.

5. **Auditor / Migrations / Admin**: pode visualizar. NUNCA clica em "Aplicar"
   ou "Executar" — só leitura de dry-runs já existentes.

6. **Se em dúvida**: NÃO CLICA. Documenta no relatório que viu o botão
   mas não acionou.

7. **Sem tentativa de "consertar" o que vê.** Reporta o sintoma com
   detalhe, não propõe causa raiz nem patch. O CTO escolhe o que fazer.

---

## Roteiro de inspeção (12 telas + 6 modais)

Para cada item: navegue, capture 1-3 screenshots representativos, descreva
estado, anote campos/botões/badges visíveis, registre console errors e
network failures (status ≥ 400). **Não interage além do mínimo de scroll.**

### 1. Login + Hub

- URL inicial, fluxo de login, lab selector
- Hub: módulos visíveis, cards de status

### 2. CIQ-Imuno · Bancada (Corridas)

- Header: botão "+ Registrar Corrida"
- Banner amarelo "Setup do Strips" (se presente, copiar texto)
- Setups Vinculados (azul = Em Validação, verde = Oficial): quantos cards,
  testType + lote de cada um
- Corridas Recentes: últimas N (até 20), listar testType, data, operador,
  status visual (Conforme/Rejeitada)
- Estado vazio se houver

### 3. CIQ-Imuno · Insumos e Catálogo

Para cada aba (4 tabs):

- **Equipamentos & setups**: cards de módulo, equipamentos por módulo,
  estado (Ativo/Aposentado), modelo, serial. Botão "Configurar" por módulo.
- **Catálogo de produtos**: lista completa, filtros disponíveis. Conta
  produtos por tipo (reagente/controle/tira-uro) e por módulo.
- **Fornecedores**: lista, CNPJs, ativo/inativo
- **Todos os lotes** (default em-rotina): conta lotes por tipo e status.
  Em cada InsumoRow capturar: badges presentes (CQ pendente, Aguarda
  qualificação, Qualificado, Reprovado · Segregado, Em validação · bancada,
  Setup oficial · bancada, Operacional (legado · PR2)). Botões disponíveis.

### 4. CIQ-Imuno · Gestão de Lotes (sidebar)

- Cards de lotes em CIQ-Imuno (CIQImunoLot envelopes), agrupados por testType
- Para cada lote: contador de runs, lotStatus (valido/atencao/reprovado/
  sem_dados), ciqDecision, pinHistory visível?

### 5. CIQ-Imuno · Tipos de Teste (sidebar)

- Page é um placeholder? Se sim, descrever exatamente o que mostra
  (este é um bug de UX conhecido — sidebar não tem CRUD inline)

### 6. CIQ-Imuno · CIQ Auditor (sidebar, se existir)

- Filtros disponíveis (testType, range de datas, lote)
- Tabela de eventos: colunas, ordenação, paginação
- Chain hash status visível? sealed vs pending?

### 7. CIQ-Imuno · Equipamentos (sidebar)

- Redireciona pra Insumos? Ou tem própria UI?

### 8. CQ Hematologia (sidebar topo, comparação)

- Para contraste com CIQ-Imuno: como a Bancada de Hematologia se compara

### 9. Modais (apenas abrir, observar campos, fechar via X/Esc)

- **NovoLoteModal** (abrir clicando "+ Novo lote" e fechar IMEDIATAMENTE
  via X): captura step 1 (ProdutoPicker) e o botão `+ Cadastrar novo produto
  no catálogo`. NÃO clica.
- **CIQImunoForm** (abrir via "+ Registrar Corrida" e fechar via Cancelar):
  observe seções: Operador, Tipo de Teste, Kit Manual, Resultados.
- **CIQTestTypeManager** (abrir clicando "Gerenciar" perto do testType
  picker dentro do CIQImunoForm e fechar via Esc): liste testTypes
  cadastrados, flags manual.
- **DisponibilizarBancadaImunoModal** (NÃO clicar — apenas observar que
  o BOTÃO "Disponibilizar p/ corrida" existe nos rows aplicáveis em
  Insumos & Catálogo · Todos os lotes · Reagentes; descreva o tooltip
  do botão sem abrir o modal).
- **InsumoQualificacaoModal** (NÃO abrir — apenas reportar presença do
  botão "Qualificar lote" nos rows aplicáveis).

### 10. Reports / Relatórios (se existir no Hub)

- Tipos de relatório disponíveis, filtros, exportações

### 11. Configurações de lab (lab-settings)

- Setores, frequências, referências regulatórias, claims de módulo

### 12. Admin / Super Admin (se acessível)

- Painel migrations (lista de migrations dry-run disponíveis)
- NUNCA clica em "Aplicar" — só descreve

---

## O que reportar (estrutura do relatório)

Salva em `$OUTPUT_DIR/REPORT.md`:

```markdown
# Auditoria CIQ-Imuno — {timestamp}
Auditor: Gemini · Modo: read-only
Usuário: drogafarto@gmail.com (owner)

## TL;DR (3-5 linhas)
{Estado geral do módulo numa frase. Achados notáveis em bullets.}

## Inventário de telas auditadas
{Lista das 12 telas + 6 modais com PASS/SKIP/NÃO ENCONTRADO}

## Achados por tela

### 2. Bancada (Corridas)
- Estado: {empty/populated/parcial}
- Setups vinculados: N (oficiais=X, validação=Y)
- Corridas recentes: M últimas
- Achados de UX:
  - {observação 1}
  - {observação 2}
- Screenshots: f-bancada-01.png, f-bancada-02.png

(repetir pra cada tela)

## Bugs observados (sintomas, não causas)
- [Severidade: alto/médio/baixo] {descrição do sintoma + onde reproduzir}
- ...

## Inconsistências de UX
- {ex: badge X em uma tela usa cor diferente da mesma badge em outra}
- ...

## Botões/labels com texto inconsistente
{ex: "Cadastrar produto" vs "Salvar produto" vs "Criar"}

## Modais sem aria-label / role="dialog"
{lista}

## Console errors (browser DevTools)
{lista, com URL e stack quando possível}

## Network failures (status ≥ 400)
{lista de requests com URL + status + payload resumido}

## Acessibilidade
- Modais sem role="dialog": {lista}
- Botões só com ícone sem aria-label: {lista}
- Inputs sem label associado: {lista}

## Performance percebida
- Telas com loading > 3s: {lista}
- Telas com flash de conteúdo (FOUC): {lista}

## Dados sensíveis em produção
{Reporta se viu dados de pacientes ou PII em telas que deveriam ser sintéticas.}

## Checklist regulatório (RDC 786 + 978/2025)
- [✓/✗] InsumoRow mostra rastreabilidade fiscal (NF + fornecedor)
- [✓/✗] Movimentações têm timestamp + operador
- [✓/✗] Chain hash status (pending/sealed) visível em algum lugar
- [✓/✗] Botão "Qualificar lote" requer re-auth (apenas reporta presença)
- [✓/✗] Lotes reprovados têm badge "Segregado" e somem dos pickers
        (verifica indiretamente: cadastrate apenas observa lista, não testa)

## Coberto vs não-coberto
- Coberto: {lista de fluxos visualmente inspecionados}
- Não-coberto (bloqueado por regra read-only): {lista}

## Anexos
- Screenshots numerados: {tabela com nome e descrição}
- HAR (se possível) ou logs de network filtrados

## Conclusão
{Frase final: módulo saudável / com ressalvas / com bugs críticos. NÃO
recomende fix — só classifique severidade.}
```

---

## Comportamento se algo "exigir" interação

Se uma tela bloquear navegação até preencher (ex: lab obrigatório):
- Já está logado em LabClin Rio Pomba MG, não troca de lab.
- Se aparecer modal forçado (ex: aceitar termos), CAPTURA screenshot,
  REPORTA no achado, e tenta fechar via X. Se não fechar sem aceitar,
  PARA a auditoria daquela tela e segue pra próxima.

Se PWA mostrar update available:
- NÃO atualiza. Reporta no relatório.

Se sessão expirar mid-auditoria:
- Re-loga, NÃO refaz telas já auditadas, continua de onde parou.

---

## Por que read-only

O módulo CIQ-Imuno é regulatório (RDC 786 + RDC 978/2025 Art.128). Cada
qualificação que você fizer fica permanentemente em /insumo-qualificacoes/
+ /ciq-audit/, e a chain de movimentações é tamper-evident — não dá pra
"limpar" depois. Cada Disponibilizar cria um envelope CIQImunoLot que
polui Bancada e Gestão de Lotes. Cada produto SMOKE polui o catálogo.

Manter read-only:
1. Zero risco de pisar em dados reais
2. Zero limpeza pós-rodada
3. Auditoria pode rodar quantas vezes quiser sem custo

Se você precisar de teste de mutação, **outra ferramenta** já cobre isso
(Playwright deterministic em smoke-test/specs/). Seu valor é o **olhar
crítico**, não a execução.

---

## Saída esperada

1. `$OUTPUT_DIR/REPORT.md` (markdown estruturado conforme template acima)
2. `$OUTPUT_DIR/screenshots/*.png` (numerados, descritos no relatório)
3. `$OUTPUT_DIR/network.json` (lista de requests filtrada — opcional)
4. `$OUTPUT_DIR/console.txt` (logs filtrados por error/warn — opcional)

Tempo estimado: 30-45 min de auditoria + 10 min de redação. Total ~1h.

**Print final no terminal:**
```
Auditoria concluída.
Telas inspecionadas: N/12
Modais: M/6
Bugs encontrados: K
Severidade: {baixa/média/alta}
Relatório: $OUTPUT_DIR/REPORT.md
```
