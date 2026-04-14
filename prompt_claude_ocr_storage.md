# Plano de Execução: Especialista OCR e Auditabilidade com Firebase Storage

Prezado Claude, você assumirá agora o papel de Arquiteto de Software e Integrador Especialista Firebase/IA. Recebemos um documento de arquitetura rigoroso para o módulo de "Analisador Hematológico" (Yumizen H550). Verificamos que o core do Levey-Jennings e da Interface do Revisão (Amber dot) já funciona primorosamente, mas faltam duas engrenagens de alto nível.

**Sua missão é executar, rigorosamente e passo a passo, as duas etapas lógicas a seguir. Não deixe passar nenhum detalhe técnico e faça os *commits* ou as rodadas de testes entre as etapas.**

---

### ETAPA 1: Refinamento Robusto do Motor de Visão Computacional (OCR / Gemini)
Atualmente a Cloud Function `extractFromImage` (`functions/src/index.ts`) contém um prompt genérico. O analisador **Yumizen H550** exige um tratamento analítico espacial. 

Siga para `functions/src/index.ts` e altere a function `extractFromImage`:

1. **Expansão do Prompt (`OCR_PROMPT`)**:
   - Injete instruções geográficas claras para o Gemini 1.5 Flash: *"O layout da tela divide-se em blocos: Eritrócitos (RBC) e índices no topo esquerdo. Plaquetas (PLT) e MPV no topo direito. Série Branca (WBC, DIFF) na parte inferior ou central direita".*
   - Crie uma diretriz absoluta sobre notação: *"Sempre converta vírgulas encontradas nas leituras em pontos decimais no JSON de saída".*
   - Crie a regra hematológica de desambiguação: *"Para Leucócitos (WBC) e parâmetros de fórmula leucocitária diferencial (NEU, LYM, MON, EOS, BAS), você deve ignorar completamente o valor numérico em porcentagem (%) e extrair EXCLUSIVAMENTE o valor numérico que representa o número absoluto (ex: # ou mm³)".*
2. **Deploy das Functions**:
   Depois de alterar as lógicas e testar a tipagem localmente (em TypeScript), não esqueça de garantir que a Cloud Function construa corretamente. 

---

### ETAPA 2: Auditabilidade e Rastreabilidade Visual (Firebase Storage)
Nossa plataforma promete alta rastreabilidade (Audit Trail). Atualmente o componente `NewRunForm` envia o arquivo (Blob) para o `ReviewRunModal`, mas ao clicar em "Confirmar", a URL efêmera (`URL.createObjectURL(file)`) é perdida e apenas os resultados da IA são gravados no Firestore. O negócio demanda que a imagem que originou os dados seja preservada na nuvem.

1. **Atualizar os Modelos de Dados (`src/types/index.ts`)**:
   - Na interface `Run` (ou onde os dados da Corrida são mapeados e atrelados aos lotes), crie a propriedade opcional: `imageUrl?: string;`  para hospedar o link seguro da foto daquele dia.

2. **Engenharia de Upload no Client-Side (`Refatoração do Service de Lotes / Runs`)**:
   - Vá ao arquivo responsável por salvar a nova corrida (geralmente `lotService.ts` ou o hook que invoca as Firebase Actions em `runs`).
   - Importe `getStorage`, `ref`, `uploadBytes` e `getDownloadURL` do `firebase/storage`.
   - Modifique o método que adiciona o ponto no gráfico (que empurra o JSON pra dentro de `lots/{lotId}/runs`).
   - Insira uma chamada para subir o arquivo `File` recebido pelo componente frontend:
     - Endereço no Bucket: `labs/{labId}/lots/{lotId}/runs/{runId}.jpg` usando `uuid()` da corrida para nomear a foto.
     - Faça isso rodar sob um `try { ... } catch`, com `Promise.all` não bloqueante se necessário, mas o ideal é obter a URL com `getDownloadURL(imageRef)` após terminar o `uploadBytes()`.
   - Inclua o atributo `imageUrl` recém obtido no objeto da corrida a ser atualizado/inserido no array do Firestore e execute o Commit (`updateDoc`).
   
3. **Refletir na Interface de Histórico (`ResultsHistory.tsx` ou similar)**:
   - Se aplicável, adicione um ícone (exemplo: clipe de papel 📎 ou miniatura de câmera 📷) em cada linha do histórico da corrida caso `run.imageUrl` esteja presente.
   - Opcional: Programe para que, ao clicar nesse ícone no histórico, uma janela/modal lateral exiba a `imageUrl` hospedada no Firestore para que o supervisor de qualidade constate com os próprios olhos a foto se houver uma não-conformidade no Levey-Jennings (3SD).

Finalize rodando o servidor de front-end, crie uma "Corrida Fake" tirando uma foto do computador e audite as "Regras Confirmação" de imagem indo até o painel web do Firebase console e confirmando que o Blob ocupou seu devido espaço na aba "Storage" na nuvem!
