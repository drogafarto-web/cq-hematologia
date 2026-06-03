# Manual rápido — rotina do laboratório

> Pra quem nunca usou o sistema. Linguagem simples, passo a passo. Foco em hematologia (Yumizen H550), mas o jeito é parecido nos outros módulos (imuno, coagulação, uroanálise).

---

## Antes de tudo: o que é cada coisa

Aprenda esses 5 termos uma vez e já era:

| Palavra             | O que significa, sem firula                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sangue controle** | Frasquinho de sangue "fake" com valores conhecidos. A gente passa todo dia pra ver se a máquina tá medindo certo. Se ela acerta no controle, dá pra confiar no sangue do paciente.        |
| **Lote**            | Cada caixa nova de sangue controle vem com um número (ex.: "Lote 12345"). É tipo o número de série. Cada lote tem valores certos diferentes.                                              |
| **Bula**            | O papelzinho que vem dentro da caixa. Diz: "neste lote, hemoglobina deve dar entre 12 e 14, eritrócitos entre 4 e 5, etc." Esses números são a **régua** que usamos pra julgar a corrida. |
| **Corrida**         | Cada vez que você passa o controle na máquina = uma corrida. Toda corrida vira um pontinho no gráfico.                                                                                    |
| **Westgard**        | Regrinhas que olham os pontinhos e falam "tá tudo bem" ou "tem coisa errada". O sistema aplica sozinho. Você só lê o resultado.                                                           |

Cores que vai aparecer na tela:

- 🟢 **Verde** — passou. Pode liberar laudo.
- 🟡 **Amarelo** — atenção. Não é desastre, mas olha com cuidado.
- 🔴 **Vermelho** — reprovou. **Não libera laudo até resolver.**

---

## Cenário 1 — Toda manhã: passar o sangue controle

### O que fazer (5 minutos)

1. **Liga a máquina** (Yumizen H550) e espera ela aquecer (segue o procedimento normal do equipamento, isso é fora do sistema).
2. **Pega o frasco de sangue controle** que está em uso. Misture devagar 8-10 vezes invertendo (não chacoalhe).
3. **Passa o controle na máquina** — ela cospe os 17 valores (hemoglobina, eritrócitos, leucócitos, etc.).
4. **Abre o sistema HC Quality** no navegador, faz login.
5. Na tela inicial (**ModuleHub**), clica em **Hematologia**.
6. No topo da tela, confirma a "**pílula DESTINO**" — é a faixa que mostra qual lote você está usando hoje. Tem que bater com o frasco que você passou.
7. Clica no botão **"+ Corrida"** (ou **"+ Corrida vinculada"** se aparecer).
8. **PreFlightCheck** — uma janelinha aparece e pergunta se a máquina, o lote e o reagente estão certos. Confere e clica em "OK".
9. Os 17 valores aparecem (vêm direto do equipamento via OCR ou você digita). Confere se nenhum tá esquisito (tipo "0" ou em branco).
10. Clica em **Confirmar** / **Salvar corrida**.

Pronto. A corrida virou um pontinho no **gráfico de Levey-Jennings** — uma reta horizontal com pontinhos em cima e embaixo dela.

### O que olhar pra saber se tá tudo certo

Depois de salvar a corrida, **olha 3 coisas**:

#### 1. A cor do resultado da corrida

- 🟢 **Verde** = passou em todas as regras Westgard. **Pode liberar laudo dos pacientes do dia.**
- 🟡 **Amarelo** = passou, mas chegou perto do limite. Anota mentalmente e segue. Se acontecer 2 dias seguidos, fala com o RT (Responsável Técnico).
- 🔴 **Vermelho** = reprovou alguma regra. **PARA. Não libera nada de paciente.** Vai pra seção "Quando reprova".

#### 2. O gráfico de Levey-Jennings

Cada analito (hemoglobina, leucócitos, etc.) tem um gráfico próprio. Olha esses sinais:

- **Pontinho dentro da faixa do meio** (entre as linhas tracejadas internas) = 👍
- **Pontinho na faixa amarela** (entre interna e externa) = ⚠️ atenção
- **Pontinho na faixa vermelha ou fora** = 🚨 problema
- **3-4 pontinhos seguidos do mesmo lado da reta central** = a máquina está **deslocada** (tendência). O sistema avisa, mas vale você ver de olho também.

#### 3. Tem corrida hoje?

Antes de liberar QUALQUER laudo de paciente, confirma na tela do módulo:

- Já tem **uma corrida verde de hoje** com o lote correto? ✅ Pode liberar.
- Não tem corrida de hoje ainda? ❌ Não libera. Passa o controle primeiro.

### Quando reprova (vermelho) — o que NÃO fazer e o que fazer

**❌ NÃO faça:**

- Não passa o controle de novo "pra ver se desta vez dá certo". Cada corrida fica registrada — o sistema vê todas. Repetir não esconde o problema.
- Não libera laudo de paciente.
- Não apaga a corrida (você não consegue mesmo, é à prova de adulteração).

**✅ Faça:**

1. Anota mentalmente qual analito reprovou (pode ser só hemoglobina, ou vários).
2. Verifica o **óbvio primeiro**, na ordem:
   - O frasco do controle ainda está na validade?
   - Foi misturado direito (8-10 inversões)?
   - O frasco fica geladinho (2-8°C)? Tava fora da geladeira muito tempo?
   - Reagente da máquina está OK?
3. Se o óbvio está OK, **chama o RT** (Responsável Técnico do laboratório).
4. O RT vai abrir uma **Ação Corretiva** (obrigatório por lei — RDC 978 Art. 128). É uma anotação dizendo "o que aconteceu, o que fiz pra resolver". Sem isso, a auditoria reclama.

---

## Cenário 2 — Chegou caixa nova de sangue controle, MAS sem bula

Acontece. A caixa veio, mas a folhinha com os valores está perdida ou ainda não chegou. Você quer começar a usar o lote já, então faz assim:

### Passo a passo — cadastrar sem bula

1. Abre o sistema → **Hematologia**.
2. Clica em **"+ Novo Lote"** (ou ícone equivalente — abre o **NovoLoteModal**).
3. **Importante:** existe a opção **"Cadastrar sem bula"** (ou um botão **"Cadastro avulso"** que abre o **CadastroSemBulaModal**). Clica nessa.
4. Preenche o que VOCÊ TEM:
   - Número do lote (lê na caixa)
   - Data de validade (lê na caixa)
   - Fabricante / produto (lê na caixa)
   - Pulei a bula? Sim — marca a opção **"Bula pendente"**.
5. Salva.

O sistema cria o lote com a marca **`bulaPendente`** (você vai ver um aviso amarelo no card do lote dizendo "sem bula").

### O que isso muda no dia-a-dia

- ✅ **Você pode usar esse lote.** Pode passar corrida nele normalmente.
- ⚠️ **As corridas ficam "em validação"** — o gráfico aparece, mas sem a faixa central da bula, o sistema não consegue julgar 100% (não tem com o quê comparar).
- ⚠️ **NÃO use ele como "principal" oficial ainda.** O sistema permite passar como **`validacao_paralela`** (validação paralela). Quer dizer: você está rodando ele do lado do lote oficial, pra acumular dados até a bula chegar.
- ❌ **O RT ainda não pode aprovar (ciqDecision = 'A')** porque não há bula pra validar.

Em uma frase: **gravamos tudo, mas o julgamento fica esperando a bula chegar**.

### Cuidado importante

Não invente valores "chutados" pra bula. Não copie da bula de outro lote (mesmo que pareça parecido). Espera a bula real chegar. Até lá, o lote fica em modo "esperando bula" e tá tudo bem.

---

## Cenário 3 — A bula chegou (depois de você ter cadastrado sem ela)

Você já passou X corridas no lote sem bula. A bula chega. Agora:

### Passo a passo — anexar a bula

1. Abre o sistema → **Hematologia**.
2. Encontra o lote que estava esperando (vai estar com o aviso "bula pendente").
3. Clica nele → opção **"Anexar bula"** (ou similar — abre o **BatchCreationForm**).
4. Coloca a bula:
   - Faz upload do PDF da bula, OU
   - Digita os valores manualmente (hemoglobina min/máx, eritrócito min/máx, etc.) — 17 analitos.
5. **Confirma**.

### O que o sistema faz sozinho (a parte mágica)

Quando você anexa a bula, o sistema chama uma função chamada **`applyBulaToLot`**. Ela faz **3 coisas automáticas**:

1. **Atualiza o lote** — agora tem bula, sai do estado "pendente".
2. **Pega TODAS as corridas que você já fez nesse lote sem bula** — aquelas que estavam "em validação".
3. **Recalcula o Westgard de cada uma**, em ordem cronológica (a primeira corrida é avaliada primeiro, depois a segunda, e assim vai).

Resultado: aquelas corridas que estavam meio "no escuro" agora viram corridas julgadas direito. Verde, amarelo ou vermelho — o sistema agora tem com o que comparar.

### O que você precisa fazer DEPOIS de anexar a bula

1. **Olha o gráfico Levey-Jennings de novo.** Os pontinhos antigos agora têm cor. Vê se algum reprovou.
2. **Se algum reprovou retroativamente:**
   - Não entra em pânico. As corridas antigas são histórico — você não vai reabrir laudos antigos por causa disso (se foi liberado com base em controle paralelo aprovado, está OK).
   - **Mas** isso é sinal de que aquele lote talvez tenha problema. Mostra pro RT.
3. **Se tudo passou:** ótimo. O lote agora pode ser usado como **`principal`** (oficial). Fala com o RT pra ele aprovar (`ciqDecision = 'A'`) — só ele tem permissão pra isso.

### Sinal de que algo deu errado no merge

Se ao anexar a bula o sistema te der erro (algo como "falha ao aplicar bula"), **não tenta de novo no automático**. Chama o RT ou suporte. Recalcular Westgard fora de ordem pode bagunçar o histórico — melhor consertar com cuidado.

---

## Cenário 4 — Frasco acabou: encerrar o lote

O frasco vazia. Você não vai mais passar corrida nele. Mas **não joga fora do sistema** — ele precisa ficar no histórico (RDC 786 exige). O sistema tem um botão certinho pra isso.

### Antes de tudo: encerrar ≠ descartar

São duas coisas diferentes. Erra essa e estraga seu histórico.

| Ação          | Quando usar                                                                                               | O que faz                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Encerrar**  | Frasco acabou, **fim normal de vida útil**. Você usou tudo direitinho.                                    | Marca o lote como histórico. Mantém todas as corridas, todo o gráfico. Não pode passar mais corrida nele. ✅ Esse é o caminho normal. |
| **Descartar** | Frasco contaminou, vazou, ficou fora da geladeira a noite toda, ou bateu coliforme — **algo deu errado**. | Marca o lote como descartado por problema. Vira evidência num eventual relatório de não-conformidade.                                 |

**Regra simples**: se acabou normal → **Encerrar**. Se aconteceu acidente → **Descartar** (e provavelmente abre Ação Corretiva também).

### Passo a passo — Encerrar (uso normal)

1. Abre o sistema → módulo onde o lote vive (Hematologia ou aba Insumos).
2. Encontra o **card do lote** que acabou. Vai estar com status **"ativo"** ou **"em uso"**.
3. No card, procura o botão **"Encerrar"**.
   - Tooltip que aparece ao passar o mouse: _"Encerrar lote — fim de vida útil, mantém no histórico"_
4. Clica. Pronto.

O sistema:

- Marca o lote com `archivedAt` (data e hora do encerramento)
- Registra **quem** encerrou (você) — fica no log de auditoria
- Tira o lote da **pílula DESTINO** (não aparece mais como opção de corrida)
- Move pra aba **"Encerrados"** (filtro de status no topo da lista)
- Mantém **todas** as corridas, gráficos e histórico — nada some

### O que olhar depois

- ✅ O lote sumiu da pílula DESTINO no topo? Bom — quer dizer que foi encerrado.
- ✅ Aparece na aba **"Encerrados"** quando você troca o filtro? Bom — está no histórico, achável pra auditoria.
- ⚠️ A pílula DESTINO ficou vazia (sem nenhum lote ativo)? **Você ainda não cadastrou ou ativou o lote novo.** Faz isso ANTES de tentar passar a próxima corrida (volta pro Cenário 2 se for um lote sem bula, ou cadastra normal se já veio com bula).

### Cuidados

- **Não encerre o lote enquanto ainda tem frasco com líquido.** Encerrou, encerrou — é considerado fim de uso. Se você tentar voltar a usar depois, o sistema não deixa passar corrida.
- **Encerrou sem querer?** Não tem botão "desfazer" pra usuário comum. **Chama o RT.** Só ele consegue reverter, e mesmo assim com justificativa registrada (RDC 978 Art. 128).
- **Quem encerra fica registrado.** Não empresta seu login pra ninguém encerrar lote em seu nome — é a sua "assinatura" digital nesse evento.

### Quando NÃO usar Encerrar (use Descartar)

- Frasco com sinal de contaminação (turvo, cor estranha, cheiro)
- Frasco que ficou fora da geladeira tempo demais
- Frasco com data de validade vencida (o sistema pode até bloquear sozinho)
- Lote inteiro reprovou repetidamente sem causa identificável (mostra pro RT antes)

Nesses casos, usa **Descartar** e abre uma **Ação Corretiva** explicando o que aconteceu.

---

## Cartão de pânico — quando parar e chamar ajuda

Pare imediatamente e chame o RT (ou suporte técnico) quando:

- 🚨 Controle reprovou e o óbvio (validade, mistura, geladeira) está OK
- 🚨 Aparece mensagem de erro vermelha que você não entende
- 🚨 O sistema diz que a "chain-hash quebrou" ou "movimentação não foi selada" — **ISSO É GRAVE.** Não mexa em mais nada, é como adulteração de prontuário no sistema.
- 🚨 Você acha que clicou em alguma coisa errada que mexeu em outro paciente / outro lote
- 🚨 A máquina deu valor absurdo (hemoglobina 30, leucócitos 0)

**Nunca faça:**

- ❌ Apagar registros pra "consertar"
- ❌ Cadastrar a mesma corrida 2x pra "ver se vai"
- ❌ Liberar laudo de paciente sem ter corrida verde do dia
- ❌ Usar lote com bula pendente como principal sem aprovação do RT

**Sempre faça:**

- ✅ Se está em dúvida, chama o RT antes de clicar em qualquer coisa
- ✅ Se reprovou, anota no caderno (sim, em papel também) o que viu e o horário
- ✅ Se o sistema avisar pra abrir uma "Ação Corretiva", abre. É lei.

---

## Resumo em 4 frases

1. **Toda manhã**: passa o controle, olha se ficou verde, se ficou ✅ libera laudos do dia.
2. **Chegou caixa sem bula**: cadastra com "bula pendente", usa como `validacao_paralela`, espera a bula.
3. **Bula chegou**: anexa, o sistema recalcula tudo sozinho, RT aprova como principal.
4. **Frasco acabou**: clica em **Encerrar** no card do lote (não "Descartar" — esse é pra acidente). Vai pra aba "Encerrados", histórico fica salvo.

Se algo gritar vermelho ou der erro estranho — **para, anota, chama o RT**. Nunca apague, nunca refaça pra mascarar.

---

## 🔗 Conexões Centrais

- [[HC_Quality]]
