# Avaliação de Impacto à Proteção de Dados (DPIA) — Tratamento por IA via Google Gemini Vision

**Documento:** IT-LGPD-DPIA-002 v0.1
**Status:** **DRAFT — PENDENTE ASSINATURA RT/DPO**
**Data de Emissão:** 2026-05-08
**Próxima Revisão:** 2027-05-08 (anual obrigatória — LGPD Art. 38)
**Autoridade Emitente:** RT — Direção Técnica (a confirmar)
**Encarregado de Proteção de Dados (DPO):** [PREENCHER ANTES DA PUBLICAÇÃO]
**Substitui:** —
**Substituído por:** —
**Cross-link:** ADR-0010, ADR-0025, IT-LGPD-DPIA-001 v1.1, POL-LGPD-001 (Aditamento 2026-05-08)

---

> ⚠️ **AVISO DE STATUS — DRAFT**
>
> Este documento é uma minuta. A operação de classificação de strips de teste rápido por meio do Google Gemini Vision API **NÃO está autorizada para processar dados pessoais de pacientes em produção** até a assinatura formal do RT e do DPO designado. O bloqueio operacional permanece ativo (rollout do módulo IA-Strip suspenso) até conclusão da validação documental e implementação dos controles aqui exigidos.

---

## 1. Identificação do Tratamento

| Campo                             | Valor                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome do tratamento**            | Classificação automatizada de strips de teste rápido por Inteligência Artificial generativa multimodal                                                                  |
| **Módulo do sistema**             | `ia-strip` (callable `classifyStripGemini`)                                                                                                                             |
| **Controlador**                   | Laboratório Clínico (operador do tenant)                                                                                                                                |
| **Operador (sub-operador)**       | Google LLC / Google Cloud Brasil — Google Gemini API (`generativelanguage.googleapis.com`)                                                                              |
| **Suboperação inserida via**      | Google Cloud Platform — Vertex AI / Generative Language API                                                                                                             |
| **Categoria de tratamento**       | Decisão automatizada com revisão humana condicional (Art. 20 LGPD)                                                                                                      |
| **Ambiente regional do operador** | Estados Unidos da América (modelo `gemini-2.5-flash` — endpoint global Google), com possível roteamento multirregional. **Vide Seção 8 — Transferência Internacional.** |
| **Início pretendido**             | A definir após assinatura RT/DPO                                                                                                                                        |
| **Volume estimado**               | Até 10.000 classificações/mês por laboratório (Phase 11)                                                                                                                |

---

## 2. Descrição do Fluxo de Dados (Data Flow)

### 2.1. Captura

1. Operador habilitado do laboratório fotografa o strip de teste rápido (HIV, dengue, sífilis, COVID, HCG) via aplicativo web/mobile do HC Quality.
2. Imagem é codificada em **Base64** no cliente (web/mobile) e enviada como payload `inlineData` em chamada à Cloud Function callable `classifyStripGemini`.

### 2.2. Processamento Server-Side

3. A Cloud Function (região `southamerica-east1`):
   - Verifica autenticação Firebase do operador.
   - Verifica vínculo ativo (`isActiveMemberOfLab`) ao `labId`.
   - Valida MIME type (`image/jpeg|png|webp`) e tipo de teste (HIV/dengue/sífilis/COVID/HCG).
   - Lê configuração do laboratório (limiar de confiança, alocação de variantes A/B de prompt).

### 2.3. Inferência Externa (TRANSFERÊNCIA INTERNACIONAL)

4. A imagem em Base64 é enviada, **junto ao prompt clínico**, para o endpoint **Google Gemini 2.5 Flash** (`generativelanguage.googleapis.com`) por meio do SDK `@google/generative-ai`. A chave de API é gerenciada via Secret Manager do GCP (`GEMINI_API_KEY`).
5. O modelo retorna JSON com `classification ∈ {R, NR, INCONCLUSIVE}`, `confidence ∈ [0,1]` e `reasoning` (texto livre, ≤500 chars).

### 2.4. Persistência e Auditoria

6. Resultado é gravado em `imuno-ia-dev/{labId}/events/{captureId}` com assinatura lógica (`hash`, `operatorId`, `ts`) conforme padrão tamper-evident do projeto.
7. Custos e contagem de tokens gravados em `imuno-ia-cost/{labId}/daily/{YYYY-MM-DD}`.
8. **Imagem original e o Base64 NÃO devem ser persistidos** após retorno da inferência (controle exigido — vide Seção 6).

### 2.5. Decisão Clínica

9. Se `confidence ≥ threshold` (default 0.85): resultado pré-preenche o registro do paciente para confirmação humana.
10. Se `confidence < threshold`: revisão manual obrigatória pelo RT antes de qualquer associação ao laudo.
11. Em todos os casos, a **decisão final é humana** — operador/RT assina lógica e legalmente o resultado (Art. 20 LGPD).

---

## 3. Categorias de Dados Pessoais Tratados

| Categoria                                    | Descrição                                                                                                                           | Sensibilidade (LGPD Art. 5º, II)                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Imagem de strip de teste rápido              | Fotografia da área reativa do dispositivo, podendo conter reflexos, fundo da bancada, mãos enluvadas, etiquetas com identificadores | **Dado pessoal sensível — referente à saúde** (Art. 5º, II)    |
| Identificador de captura (`captureId`)       | UUID gerado client-side, vinculado ao paciente em coleções correlatas                                                               | Dado pessoal (indireto)                                        |
| Identificador do operador (`operatorId`)     | UID Firebase do colaborador que realizou a captura                                                                                  | Dado pessoal — profissional                                    |
| Identificador do laboratório (`labId`)       | Tenant — multi-tenant marker                                                                                                        | Dado de pessoa jurídica                                        |
| Tipo de teste (`testType`)                   | HIV / dengue / sífilis / COVID / HCG                                                                                                | **Dado sensível por inferência** (revela hipótese diagnóstica) |
| Resultado interpretado (`R/NR/INCONCLUSIVE`) | Classificação retornada por IA                                                                                                      | **Dado sensível — referente à saúde**                          |
| Metadados técnicos                           | Latência, variante de prompt, tokens consumidos, custo estimado                                                                     | Dado operacional                                               |

> **Atenção LGPD Art. 11.** O conjunto da imagem + tipo de teste + resultado constitui **dado pessoal sensível** (saúde). O tratamento exige base legal específica do Art. 11 (não basta o Art. 7).

---

## 4. Bases Legais (LGPD Arts. 7º e 11)

### 4.1. Base legal primária — Art. 11, II, alínea "f"

> _"tutela da saúde, exclusivamente, em procedimento realizado por profissionais de saúde, serviços de saúde ou autoridade sanitária."_

A classificação por IA integra o procedimento de execução de teste rápido realizado por profissional habilitado do laboratório, em prol da saúde do titular. A IA atua como **ferramenta auxiliar de leitura**, sob supervisão humana (Art. 20 LGPD — direito de revisão por pessoa natural).

### 4.2. Base legal complementar — Art. 7º, II / Art. 11, II, alínea "a"

> _"cumprimento de obrigação legal ou regulatória pelo controlador"_ (Art. 7º, II) e _"consentimento, de forma específica e destacada, para finalidades específicas"_ (Art. 11, II, "a").

Como o uso de IA Generativa **não é exigido por norma sanitária** (RDC 978 não obriga IA), e o titular pode legitimamente recusar o processamento por IA mantendo o procedimento manual, **adota-se consentimento específico e destacado como reforço** quando o paciente está identificável e antes de a imagem ser enviada ao operador externo.

### 4.3. Base legal — interesses legítimos (Art. 10) NÃO se aplica

Por se tratar de dado pessoal sensível (saúde), o Art. 10 está **expressamente vedado** (Art. 11, §4º). Não pode ser invocado.

### 4.4. Princípios aplicáveis (Art. 6º)

- **Finalidade** — uso restrito a leitura assistida de strip; vedada qualquer reutilização.
- **Adequação** — IA é instrumento auxiliar, não substitui profissional.
- **Necessidade** — apenas a área da imagem do strip é enviada (recomendação de cropping no cliente — vide Seção 6).
- **Livre acesso** — titular pode consultar e questionar o resultado da IA via direitos do Art. 18.
- **Qualidade dos dados** — limiar de confiança + revisão humana.
- **Transparência** — esta DPIA + aditamento POL-LGPD-001 + aviso operacional ao titular.
- **Segurança** — TLS 1.2+, Secret Manager, ausência de persistência de imagem.
- **Prevenção** — limiar de confiança e bloqueio em caso de queda do serviço.
- **Não discriminação** — auditoria mensal de acurácia por tipo de teste.
- **Responsabilização e prestação de contas** — esta DPIA, audit trail, ADRs 0010/0025.

---

## 5. Finalidade e Limitação de Uso

**Finalidade única:** Auxiliar o operador habilitado do laboratório clínico na leitura visual de strips de teste rápido, retornando uma classificação preliminar (`R/NR/INCONCLUSIVE`) com indicador de confiança, sujeita a confirmação humana antes de qualquer registro clínico definitivo.

**Usos vedados (proibições explícitas):**

- ❌ Treinamento de modelos de IA com as imagens enviadas — Google declara, em seus Termos da Generative Language API (consumer tier), uso de prompts/imagens para melhoria do produto. **A operação só está autorizada via tier que garanta no-training (Vertex AI ou Gemini API com flag `customerData=opt-out`).** Vide Seção 8.
- ❌ Qualquer marketing, perfilamento ou enriquecimento de dados.
- ❌ Compartilhamento com terceiros não previstos nesta DPIA.
- ❌ Decisão clínica autônoma sem revisão humana (Art. 20 LGPD).
- ❌ Reuso da imagem para finalidade diversa do strip atual.

---

## 6. Controles Técnicos e Organizacionais Exigidos

### 6.1. Controles técnicos obrigatórios (BLOCKERS para liberação do rollout)

| ID    | Controle                                                                                                                       | Status atual                                   | Exigido para liberação                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | Não persistir Base64 da imagem após resposta da Gemini (Cloud Function não escreve em Storage; campo Base64 fora do audit log) | ✅ Implementado (revisão de código)            | Manter                                                                                                                                                                           |
| TC-02 | Cropping client-side da região do strip (remover fundo, etiquetas com nome/CPF)                                                | ❌ Pendente                                    | Implementar em `src/features/ia-strip/components/StripCapture.tsx` antes do rollout                                                                                              |
| TC-03 | Conta Google contratada em tier "no-training" (Vertex AI on GCP `hmatologia2`)                                                 | ❌ Pendente confirmação                        | Migrar de `@google/generative-ai` (SDK consumer) para Vertex AI SDK (`@google-cloud/vertexai`) **OU** confirmar contratualmente flag `disable_data_collection_for_training=true` |
| TC-04 | TLS 1.2+ em trânsito                                                                                                           | ✅ Implementado (HTTPS por default GCP)        | Manter                                                                                                                                                                           |
| TC-05 | Secret Manager para `GEMINI_API_KEY` com rotação ≤90 dias                                                                      | ✅ Implementado (preflight-secrets-check)      | Documentar política de rotação                                                                                                                                                   |
| TC-06 | Audit trail tamper-evident por captura                                                                                         | ✅ Implementado                                | Manter                                                                                                                                                                           |
| TC-07 | Limiar de confiança configurável por laboratório com default ≥0.85                                                             | ✅ Implementado                                | Manter                                                                                                                                                                           |
| TC-08 | Logging server-side **sem** Base64 da imagem (já em código — confirmar absence em logs estruturados)                           | 🟡 Verificar                                   | Auditar `console.error` paths                                                                                                                                                    |
| TC-09 | Anonimização do `captureId` no nível do prompt (não enviar nome/CPF como texto ao modelo)                                      | ✅ Por design (apenas imagem + prompt clínico) | Manter                                                                                                                                                                           |
| TC-10 | Retenção limitada do evento `imuno-ia-dev/{labId}/events/{captureId}` — purga após 5 anos (alinhada a RDC 978 Art. 115)        | ❌ Pendente cron de purga                      | Implementar `scheduledPurgeIaEvents`                                                                                                                                             |
| TC-11 | Capacidade do titular de **opt-out** da IA mantendo leitura manual                                                             | ❌ Pendente UI                                 | Implementar toggle "Não autorizo análise por IA" no fluxo de captura                                                                                                             |

### 6.2. Controles organizacionais

- Treinamento obrigatório dos operadores antes de uso do módulo (registro em `treinamentos`).
- Aviso ao titular no momento da coleta (cartaz físico + texto digital de consentimento).
- Revisão anual desta DPIA (cron `scheduledAnnualReview` já implantado para módulo `lgpd`).
- Reclassificação de risco no módulo `risks` com `categoria='dados-pessoais'` e revisão semestral mínima (cross-link ADR-0016 / IT-LGPD-DPIA-001 v1.1).

---

## 7. Retenção e Eliminação

| Artefato                                                                                            | Retenção                                                                                        | Justificativa                                                       |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Imagem Base64 do strip (RAM da Cloud Function)                                                      | ≤30s (duração da inferência)                                                                    | Princípio da necessidade — imagem nunca persiste em disco/Storage   |
| Documento `imuno-ia-dev/{labId}/events/{captureId}` (sem imagem; somente classificação + metadados) | 5 anos (alinhado a RDC 978 Art. 115)                                                            | Rastreabilidade do procedimento clínico                             |
| Documento `imuno-ia-cost/{labId}/daily/{YYYY-MM-DD}` (custo agregado, sem PII)                      | 7 anos                                                                                          | Obrigação fiscal/contábil                                           |
| Logs do Cloud Logging contendo metadados (sem imagem)                                               | 90 dias (default GCP)                                                                           | Operacional; configurar export para BigQuery se for necessário >90d |
| Resposta retida pela Google (Gemini API)                                                            | **Conforme contrato GCP/Vertex AI no-training tier** — confirmar zero retenção do payload bruto | TC-03                                                               |

**Eliminação:** ao expirar o prazo, soft-delete via `deletadoEm` (RN-06) com purga lógica em job agendado. Audit trail preserva metadados (não a imagem).

---

## 8. Avaliação de Transferência Internacional (LGPD Art. 33)

### 8.1. Caracterização

A inferência ocorre em infraestrutura Google operada nos EUA (e possivelmente em outras regiões do Google Cloud), configurando **transferência internacional de dados pessoais sensíveis** ao operador Google LLC.

### 8.2. Hipótese legal aplicável

**Art. 33, I — País com nível de proteção adequado:** ANPD ainda não publicou lista oficial de países adequados; portanto, **não se invoca esta hipótese**.

**Art. 33, II — Garantias específicas via cláusulas contratuais padrão / cláusulas-tipo / normas corporativas globais:** Aplicável. O Google Cloud Platform fornece o _Data Processing and Security Terms_ (DPST) com Cláusulas Contratuais Padrão (Standard Contractual Clauses — SCCs) tipo módulo C2P (Controller to Processor), aceitas pela CNIL e referenciadas pela ANPD em consultas públicas. **Exigência:** assinar/aceitar formalmente o DPA Google na conta `hmatologia2` e arquivar PDF assinado em `docs/contracts/`.

**Art. 33, V — Consentimento específico do titular:** Reforço — o consentimento do paciente coletado no momento da captura informa explicitamente: _"O processamento por IA envolve transferência da imagem do seu teste para servidores da Google nos Estados Unidos."_

### 8.3. Avaliação de Impacto da Transferência (TIA — Transfer Impact Assessment)

| Fator                                       | Avaliação                                                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adequação do país de destino (EUA)          | Cloud Act / FISA 702 representam risco residual; mitigado por cláusulas SCC do GCP DPA + criptografia em trânsito + ausência de identificadores diretos no payload (somente imagem + tipo de teste). |
| Categoria de dados                          | Sensível (saúde) — eleva exigência.                                                                                                                                                                  |
| Escala                                      | Volume estimado <10k/mês por laboratório — não massivo.                                                                                                                                              |
| Possibilidade de reidentificação no destino | **Baixa**, pois (a) imagem é cropada para área do strip (TC-02), (b) `operatorId` e `captureId` são UUIDs sem PII direta, (c) ausência de nome/CPF no prompt.                                        |
| Ações governamentais previsíveis no destino | Risco teórico de requisição governamental; mitigado por DPA e por ausência de identificadores diretos.                                                                                               |
| Veredicto da TIA                            | **Risco residual TOLERÁVEL**, condicionado aos controles TC-01 a TC-11 implementados e ao DPA Google ativo.                                                                                          |

---

## 9. Direitos do Titular (LGPD Art. 18)

| Direito                                                                    | Como é atendido neste tratamento                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Confirmação e acesso (Art. 18, I e II)                                     | Titular pode requerer ao DPO o histórico de classificações por IA associadas ao seu `pacienteId`              |
| Correção (Art. 18, III)                                                    | Resultado revisado e corrigido pelo RT é o registro de verdade; pode ser corrigido a posteriori               |
| Anonimização, bloqueio ou eliminação de dados desnecessários (Art. 18, IV) | Imagem nunca é persistida; metadados são purgados após 5 anos                                                 |
| Portabilidade (Art. 18, V)                                                 | Exportação JSON/CSV do registro do paciente inclui histórico de classificações                                |
| Eliminação dos dados tratados com consentimento (Art. 18, VI)              | Revogação possível; resultados anteriores permanecem retidos por dever legal de prontuário (RDC 978 Art. 115) |
| Informação sobre compartilhamento (Art. 18, VII)                           | Esta DPIA é pública aos titulares mediante solicitação ao DPO                                                 |
| Informação sobre não fornecer consentimento (Art. 18, VIII)                | Operador deve informar disponibilidade de leitura **manual** sem IA                                           |
| Revisão de decisão automatizada (Art. 20)                                  | **Garantida por design** — toda classificação é revisada por RT antes de associação a laudo                   |

---

## 10. Avaliação de Risco Residual (FMEA-lite — ADR-0016)

| RISK-ID    | Cenário                                                           | P (1-5) | S (1-5) | D (1-5) | NPR | Nível | Tratamento                                                   |
| ---------- | ----------------------------------------------------------------- | ------- | ------- | ------- | --- | ----- | ------------------------------------------------------------ |
| RISK-IA-01 | Imagem do strip persistida acidentalmente em log/Storage          | 2       | 4       | 3       | 24  | baixo | Reduzir — TC-08 (auditar logs); cron `scheduledLogScanStrip` |
| RISK-IA-02 | Reuso da imagem para treinamento pelo Google                      | 3       | 5       | 4       | 60  | médio | Reduzir — TC-03 (Vertex AI no-training tier + DPA assinado)  |
| RISK-IA-03 | Reidentificação por inclusão de etiqueta com nome/CPF na foto     | 4       | 5       | 3       | 60  | médio | Reduzir — TC-02 (cropping + instrução visual ao operador)    |
| RISK-IA-04 | Falha do operador externo (Gemini outage) → perda de continuidade | 3       | 2       | 1       | 6   | baixo | Aceitar — fallback manual já existe                          |
| RISK-IA-05 | Decisão automatizada sem revisão humana                           | 1       | 5       | 1       | 5   | baixo | Aceitar — bloqueio por design (RT confirma)                  |
| RISK-IA-06 | Vazamento da `GEMINI_API_KEY`                                     | 2       | 4       | 2       | 16  | baixo | Reduzir — Secret Manager + rotação 90d                       |
| RISK-IA-07 | Transferência internacional sem DPA assinado                      | 4       | 5       | 1       | 20  | baixo | **BLOCKER de rollout** — não classificar até DPA ativo       |
| RISK-IA-08 | Titular não foi informado da transferência aos EUA                | 4       | 4       | 3       | 48  | médio | Reduzir — TC-11 + texto de consentimento                     |

**Veredicto agregado:** Após implementação dos controles TC-01 a TC-11, **risco residual é tolerável** (todos ≤60 NPR; nenhum crítico). **Sem implementação dos TC-02, TC-03, TC-10 e TC-11, o risco supera o apetite e o rollout permanece bloqueado.**

---

## 11. Dependências e Aprovações

### 11.1. Pré-requisitos para sair de DRAFT

- [ ] Assinatura do RT — Direção Técnica
- [ ] Assinatura do DPO designado
- [ ] DPA Google Cloud assinado e arquivado
- [ ] TC-02 (cropping client-side) implementado e revisado
- [ ] TC-03 (migração para Vertex AI no-training ou confirmação contratual no-training) confirmado
- [ ] TC-10 (cron de purga após 5 anos) implementado
- [ ] TC-11 (UI de opt-out) implementado
- [ ] Risco RISK-IA-\* registrados no módulo `risks` com `categoria='dados-pessoais'`
- [ ] Aditamento POL-LGPD-001-AMENDMENT-2026-05-08 aprovado e publicado
- [ ] IA-STRIP-CONSENT-FLOW.md aprovado e implementado

### 11.2. Aprovação

| Papel                                  | Nome        | Assinatura   | Data                   |
| -------------------------------------- | ----------- | ------------ | ---------------------- |
| RT — Direção Técnica                   | [PREENCHER] | ****\_\_**** | \_**\_/\_\_**/\_\_\_\_ |
| DPO — Encarregado de Proteção de Dados | [PREENCHER] | ****\_\_**** | \_**\_/\_\_**/\_\_\_\_ |
| CTO                                    | [PREENCHER] | ****\_\_**** | \_**\_/\_\_**/\_\_\_\_ |

---

## 12. Histórico de Revisões

| Versão | Data       | Status | Mudança                                                                                                                 |
| ------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| 0.1    | 2026-05-08 | DRAFT  | Versão inicial — DPIA específica para classificação de strips por Google Gemini Vision API. Pendente assinatura RT/DPO. |

---

## Referências

- **LGPD** — Lei 13.709/2018, especialmente Arts. 5º, 6º, 7º, 9º, 11, 18, 20, 32, 33, 38, 46.
- **POL-LGPD-001 v1.0** — Política Geral LGPD do laboratório.
- **POL-LGPD-001 — Aditamento 2026-05-08** — Inclusão de IA Generativa no escopo.
- **IT-LGPD-DPIA-001 v1.1** — Template-mãe de DPIA da plataforma.
- **ADR-0010** — Gemini Vision API as IA Baseline.
- **ADR-0016** — FMEA-lite Methodology.
- **ADR-0025** — IA Strip Classification — Gemini 2.5 Flash Vision API.
- **RDC 978/2025** — Art. 115 (retenção de prontuário).
- **Google Cloud Data Processing and Security Terms (DPST)** — Cláusulas SCC C2P.

---

**Status do documento:** **DRAFT — NÃO APLICÁVEL EM PRODUÇÃO ATÉ ASSINATURA**
