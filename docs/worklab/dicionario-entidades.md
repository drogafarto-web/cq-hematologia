# Worklab — Dicionário de Entidades

> Entidades inferidas da conversa WhatsApp e análise do sistema.

---

## Paciente

| Campo           | Tipo     | Descrição                                |
| --------------- | -------- | ---------------------------------------- |
| id (código)     | numérico | Código sequencial do exame (ex: 0094270) |
| nome            | texto    | Nome completo do paciente                |
| telefone        | texto    | WhatsApp para notificações               |
| email           | texto    | Opcional                                 |
| data_nascimento | data     | Para cálculo de idade                    |
| sus_id          | texto    | Número Cartão SUS                        |
| convenio        | FK       | Referência ao convênio                   |
| posto_coleta    | FK       | Posto onde foi cadastrado                |

**Regras:**

- Cadastro SUS pode levar até 30 minutos (linha 2003)
- WhatsApp de boas-vindas enviado automaticamente após cadastro

---

## Médico / Solicitante

| Campo         | Tipo  | Descrição                |
| ------------- | ----- | ------------------------ |
| nome          | texto | Nome do médico           |
| CRM           | texto | Registro profissional    |
| especialidade | texto | —                        |
| telefone      | texto | —                        |
| email         | texto | Para envio de resultados |

**Integração:** Função `syncMedicosWorklab` (cron nightly) no HC Quality sincroniza médicos do Worklab.

---

## Convênio

| Campo         | Tipo  | Descrição                                      |
| ------------- | ----- | ---------------------------------------------- |
| nome          | texto | Unimed, Plasc, GEAP, Energisa, SUS, Particular |
| codigo        | texto | Código interno                                 |
| tabela_precos | FK    | Tabela de preços vinculada                     |
| vigencia      | data  | Início/fim do contrato                         |

**Exemplos identificados:**

- Unimed Guarani
- Plasc Guarani
- GEAP Guarani
- Energisa
- SUS (Prefeitura)
- Particular

---

## Exame

| Campo              | Tipo    | Descrição                                            |
| ------------------ | ------- | ---------------------------------------------------- |
| codigo             | texto   | Código interno Worklab                               |
| nome               | texto   | Nome do exame                                        |
| setor              | enum    | hematologia/bioquímica/imuno/uro/coag/parasito/micro |
| metodo             | texto   | Metodologia                                          |
| valores_referencia | texto   | Por faixa etária/sexo                                |
| unidade            | texto   | mg/dL, UI/mL, etc.                                   |
| preco_particular   | decimal | Preço de balcão                                      |
| terceirizado       | bool    | Se é enviado ao DB ou apoio                          |
| integrado          | bool    | Se tem interface com equipamento                     |

**Exames terceirizados (DB):** maioria dos exames de alta complexidade
**Exames próprios:** hematograma, uroanálise, testes rápidos, coagulograma, parasitológico

---

## Posto de Coleta / Unidade

| Campo       | Tipo     | Descrição                          |
| ----------- | -------- | ---------------------------------- |
| id          | numérico | Código da unidade                  |
| nome        | texto    | Ex: "LabClin Guarani"              |
| tipo        | enum     | central / posto_coleta             |
| senha       | texto    | Senha própria de acesso ao Worklab |
| endereco    | texto    | —                                  |
| responsavel | texto    | —                                  |

**Unidades conhecidas:**

- Rio Pomba (central, ID 386)
- Guarani
- Silveirânia
- Mercês

---

## Coleta

| Campo            | Tipo     | Descrição                               |
| ---------------- | -------- | --------------------------------------- |
| paciente_id      | FK       | —                                       |
| data_coleta      | datetime | —                                       |
| tipo             | enum     | sangue/urina/swab/fezes                 |
| local            | enum     | laboratorio/domicilio/posto             |
| coletador        | FK       | Operador que coletou                    |
| tubos_utilizados | lista    | —                                       |
| observacoes      | texto    | Veia difícil, volume insuficiente, etc. |

---

## Resultado / Laudo

| Campo          | Tipo     | Descrição                                       |
| -------------- | -------- | ----------------------------------------------- |
| id (código)    | numérico | Código sequencial, ex: 0094270                  |
| paciente_id    | FK       | —                                               |
| exames         | lista    | Resultados por exame                            |
| status         | enum     | pendente/coletado/em_analise/conferido/liberado |
| liberado_por   | FK       | Operador RT que liberou                         |
| data_liberacao | datetime | —                                               |
| portal_hash    | hash     | Hash para URL do portal                         |
| impresso       | bool     | Se já foi impresso                              |
| qr_code        | bool     | Se tem QR code no laudo                         |

**URL do portal:**
`https://portal.worklabweb.com.br/resultados/{labId}?c={code}&p={hash}`

---

## Faturamento

| Campo            | Tipo    | Descrição                |
| ---------------- | ------- | ------------------------ |
| unidade_id       | FK      | Posto de coleta          |
| periodo          | mes/ano | —                        |
| convenio_id      | FK      | Convênio                 |
| valor_total      | decimal | —                        |
| impostos_simples | decimal | Alíquota variável mensal |
| valor_imposto_nf | decimal | —                        |
| valor_liquido    | decimal | —                        |
| nf_emitida       | bool    | —                        |
| comissao_posto   | decimal | 5% sobre faturamento     |

---

## NOTIVISA

| Campo            | Tipo     | Descrição                  |
| ---------------- | -------- | -------------------------- |
| protocolo        | texto    | Número do protocolo ANVISA |
| paciente_id      | FK       | —                          |
| exame_id         | FK       | —                          |
| resultado        | texto    | Resultado notificado       |
| data_notificacao | datetime | —                          |

---

## Usuário / Operador

| Campo          | Tipo  | Descrição                               |
| -------------- | ----- | --------------------------------------- |
| username       | texto | Formato `{labId}/{nome}`, ex: 386/BRUNO |
| senha          | hash  | —                                       |
| email          | texto | Para 2FA e recuperação                  |
| perfil         | enum  | gestor/supervisor/atendente             |
| posto_coleta   | FK    | Posto vinculado (se posto)              |
| 2fa_habilitado | bool  | Obrigatório desde 07/2025               |
| ativo          | bool  | —                                       |
