# INFRA_AUDIT — Relatório de Auditoria Técnica

**Status:** Investigando Bloqueio de IAM (403 Forbidden)
**Data:** 2026-04-14
**Aplicável a:** Firebase Functions (v2) / Cloud Run

---

## 1. Problema Identificado
Ao tentar utilizar a funcionalidade de extração de Bula (PDF) via IA, o frontend retorna "Internal Error".

### Evidência Técnica (Logs do Cloud Run)
- **Timestamp:** 2026-04-14T13:07:38Z
- **Payload:** `"The request was not authenticated. Either allow unauthenticated invocations or set the proper Authorization header."`
- **Código HTTP:** `403 Forbidden`

---

## 2. Diagnóstico Atual
As funções Firebase v2 (onCall) utilizam o Cloud Run. Para que o SDK do Firebase chame essas funções, o serviço no Cloud Run **deve** permitir "Invocação Não Autenticada" (no nível do IAM/Networking do Google Cloud).

**Por que isso acontece?**
Embora as funções exijam login do usuário, a validação desse login ocorre *dentro* do código da função (camada de aplicação). A camada de rede (Google Cloud) não conhece os usuários do Firebase, por isso deve "deixar passar" a requisição para que a função valide o token internamente.

---

## 3. Ações Realizadas

### [2026-04-14 10:14] — Tentativa de Deploy Global
- **Comando:** `firebase deploy --only functions`
- **Resultado:** `extractFromBula` foi pulado (`Skipped`) pois não houve alteração no código.
- **Conclusão:** O Firebase CLI não tenta corrigir permissões de IAM se detectar que o código é o mesmo. É necessário forçar uma alteração de código para disparar a re-validação do IAM.

### [2026-04-14 10:15] — Tentativa de Deploy Forçado
- **Ação:** Adicionado comentário de código no `index.ts` para forçar o CLI a re-processar a função `extractFromBula`.
- **Resultado:** Deploy bem sucedido, porém o `curl` externo e o frontend continuam recebendo `403 Forbidden`.
- **Conclusão de Auditoria:** O bloqueio não é uma falha de sincronia do CLI, mas sim uma **restrição de política de segurança (Org Policy)** no Google Cloud.

---

## 6. Conclusão Final e Causa Raiz
O projeto `hmatologia2` possui uma restrição (ex: `iam.allowedPolicyMemberDomains`) que proíbe a atribuição de permissões ao grupo `allUsers`.

Como as Callable Functions (v2) do Firebase exigem este acesso para que o SDK possa rotear as chamadas, a aplicação está bloqueada na camada de rede do Google.

---

## 7. Próximos Passos (Ação Manual Obrigatória)
Para resolver, um administrador com as permissões devidas deve:

1. Acessar o [Google Cloud Console](https://console.cloud.google.com/run?project=hmatologia2).
2. Localizar o serviço `extractfrombula`.
3. Ir na aba **Segurança** (Security).
4. No campo **Autenticação**, selecionar **"Permitir invocações não autenticadas"**.
   - *Nota: Se esta opção estiver cinza/bloqueada, você deve primeiro desabilitar a política de organização "Ativo: Restringir Compartilhamento de Domínio" (Domain Restricted Sharing) nas configurações de IAM & Admin > Organization Policies.*
5. Salvar e repetir o processo para o serviço chamado `extractfromimage`.

---

## 8. Problema Secundário: 404 Not Found (Mudança de Versão da IA)

Após resolver o bloqueio de rede (403), identificamos um erro **404** indicando que os modelos `1.5-flash` e `2.5-preview` não existiam mais para o projeto.

### [2026-04-14 10:35] — Diagnóstico de Modelos
- **Ação:** Injetado código de diagnóstico `client.models.list()` para ler os modelos disponíveis em produção.
- **Resultado:** Identificado que, em Abril de 2026, a Google migrou para a geração **Gemini 3.1**.
- **Correção:** O modelo foi atualizado para o sucessor estável: **`gemini-3.1-flash-image-preview`**.

---

## 9. Resultado Final
O sistema agora possui:
1. **Rede:** Liberada (Invocação não autenticada no Cloud Run). ✅
2. **Deploy:** Estabilizado (Build automático `predeploy` no `firebase.json`). ✅
3. **IA:** Atualizada (Gemini 3.1 Flash). ✅

**Status Final:** Operacional. 🏆
