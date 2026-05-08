# Aditamento à Política de Privacidade e Proteção de Dados Pessoais (POL-LGPD-001)
## Inclusão de Tratamento por Inteligência Artificial Generativa (Google Gemini Vision)

**Documento:** POL-LGPD-001-AMENDMENT-2026-05-08 v0.1
**Status:** **DRAFT — PENDENTE ASSINATURA RT/DPO**
**Data de Emissão:** 2026-05-08
**Eficácia pretendida:** A partir da data de assinatura conjunta RT + DPO + CTO
**Documento principal alterado:** POL-LGPD-001 v1.0 (`docs/policies/POL-LGPD-001-v1.0.md`)
**Cross-link:** IT-LGPD-DPIA-002 v0.1 (DRAFT), IA-STRIP-CONSENT-FLOW.md (DRAFT)

---

> ⚠️ **AVISO DE STATUS — DRAFT**
>
> Este aditamento é uma minuta. **Enquanto não assinado pelo RT e pelo DPO, é vedada a operação em produção do módulo `ia-strip` com dados de pacientes reais.** A versão consolidada da Política (POL-LGPD-001 v1.1) só será emitida após assinatura formal e publicação no SGQ via fluxo `revisao-emitida` (RN-SGQ-03).

---

## 1. Motivação do Aditamento

A versão 1.0 da Política de Privacidade do Laboratório Clínico Riopomba (LABCLIN-RIOPOMBA), publicada conforme Plan 00-02 (cf. `00-02-lgpd-pol-and-dpia-PLAN.md`), **não contempla expressamente o tratamento de dados pessoais sensíveis por meio de Inteligência Artificial Generativa multimodal operada por terceiro estrangeiro**.

A introdução do módulo `ia-strip` — que envia imagens de strips de teste rápido (HIV, dengue, sífilis, COVID-19, HCG) ao operador externo **Google LLC** via API `generativelanguage.googleapis.com` para classificação automatizada — exige aditamento formal da Política para:

1. Cumprir o princípio da **transparência** (Art. 6º, VI da LGPD);
2. Documentar a **base legal específica** para tratamento de dado pessoal sensível (Art. 11);
3. Comunicar a **transferência internacional** de dados pessoais sensíveis (Art. 33);
4. Estabelecer a **finalidade restrita** e o **limite de retenção** específicos do tratamento por IA;
5. Garantir o **direito de revisão humana** de decisões automatizadas (Art. 20);
6. Atender ao dever de **prestação de contas** (Art. 6º, X) com a publicação concorrente da DPIA específica (IT-LGPD-DPIA-002).

---

## 2. Alterações ao Texto da POL-LGPD-001 v1.0

### 2.1. Inclusão na Seção 1 — Coleta de Dados

**Adicionar ao item 3 (Dados Biométricos):**

> 3.c. **Imagens de strips de teste rápido** capturadas no ato do procedimento, contendo a área reativa do dispositivo, com finalidade exclusiva de leitura assistida por Inteligência Artificial multimodal e/ou registro fotográfico do procedimento. As imagens podem ser submetidas a operador externo (Google LLC) conforme Seção 5.6 desta Política, observados os controles previstos na DPIA específica IT-LGPD-DPIA-002.

### 2.2. Inclusão na Seção 2 — Finalidades de Tratamento

**Adicionar como novo item 6:**

> 6. **Leitura Automatizada Assistida por IA:**
>    - Classificação preliminar de strips de teste rápido por modelo de visão multimodal (Google Gemini 2.5 Flash) para auxílio do operador laboratorial habilitado.
>    - A classificação por IA **não substitui** a interpretação clínica do RT e está sempre sujeita a revisão humana antes do registro definitivo no laudo.
>    - A finalidade é exclusiva de auxílio diagnóstico interno; vedada qualquer reutilização para perfilamento, marketing ou treinamento de modelo.

### 2.3. Substituição da Seção 3 — Base Legal para Tratamento

**Adicionar como item 4 (após item 3 vigente):**

> 4. **Art. 11º, II, alínea "f" — Tutela da Saúde (tratamento por IA):**
>    - Base legal primária para classificação automatizada de strips por IA, por se tratar de procedimento realizado por profissionais de saúde para tutela da saúde do titular.
>    - Reforçada por **consentimento específico e destacado** (Art. 11, II, alínea "a") obtido no momento da captura, garantindo ao titular o direito de optar pela leitura **manual** sem submissão à IA.

### 2.4. Substituição da Seção 4 — Retenção de Dados

**Adicionar como item 5:**

> 5. **Imagens enviadas a operador de IA:**
>    - **Não são persistidas** após retorno da inferência (residência ≤30 segundos em memória da Cloud Function, sem gravação em Storage).
>    - O operador externo (Google LLC) é contratualmente vedado de reter ou utilizar a imagem para treinamento (cláusula no-training do Data Processing Addendum).
>    - O resultado interpretado (classificação `R/NR/INCONCLUSIVE` + metadados) é retido por **5 anos**, alinhado ao Art. 115 da RDC 978/2025.

### 2.5. Substituição da Seção 5 — Compartilhamento de Dados

**Adicionar como item 6:**

> 6. **Operadores Estrangeiros de Inteligência Artificial:**
>    - **Google LLC / Google Cloud** (endpoint `generativelanguage.googleapis.com`, modelo `gemini-2.5-flash`).
>    - Categoria: operador / sub-operador (Art. 5º, VII LGPD).
>    - Localidade do processamento: Estados Unidos da América (com possível roteamento multirregional Google Cloud).
>    - **Transferência internacional fundamentada em cláusulas contratuais padrão** (SCC tipo C2P) do Google Cloud Data Processing and Security Terms (DPST) — hipótese do Art. 33, II da LGPD.
>    - Reforço: consentimento específico do titular (Art. 33, V LGPD) obtido no momento da captura.
>    - **Avaliação de Impacto da Transferência (TIA)**: documentada em IT-LGPD-DPIA-002 §8.
>    - Dados transferidos: imagem da área reativa do strip + tipo de teste + identificadores técnicos (`captureId`, `operatorId`, `labId`). **Vedado o envio de nome, CPF, data de nascimento ou outros identificadores diretos.**

### 2.6. Inclusão na Seção 6 — Direitos do Titular

**Adicionar como novo item 7:**

> 7. **Direito de Revisão de Decisão Automatizada (Art. 20 LGPD):**
>    - Toda classificação automatizada por IA é submetida obrigatoriamente à revisão de profissional habilitado (RT ou operador autorizado) antes de qualquer associação a laudo definitivo.
>    - O titular pode requerer ao DPO informações claras sobre a lógica e os critérios da classificação automatizada que afetou seu resultado.
>    - O titular pode **recusar** o processamento por IA no momento da coleta, exigindo leitura exclusivamente manual, sem qualquer prejuízo ao atendimento.

### 2.7. Substituição da Seção 8 — Medidas de Segurança

**Adicionar ao bloco "Medidas Técnicas":**

> 5. **Controles específicos para tratamento por IA:**
>    - Imagem **não persistida** em disco/Storage após inferência;
>    - **Cropping client-side** da região do strip antes do envio (remoção de fundo, etiquetas com PII);
>    - **Consentimento granular** captado no fluxo de captura, com opção de opt-out;
>    - **Conta corporativa GCP em tier no-training** (Vertex AI ou flag contratual equivalente);
>    - Chave de API gerenciada via Secret Manager (`GEMINI_API_KEY`), com rotação ≤90 dias;
>    - Limiar de confiança configurável por laboratório (default 0.85) com revisão humana obrigatória abaixo do limiar;
>    - Audit trail tamper-evident por captura (`imuno-ia-dev/{labId}/events/{captureId}`);
>    - Cron de purga após 5 anos (`scheduledPurgeIaEvents`).

---

## 3. Documentos Correlatos Emitidos Concomitantemente

| Documento | Versão | Status | Função |
| --- | --- | --- | --- |
| **IT-LGPD-DPIA-002** | 0.1 DRAFT | Pendente assinatura | DPIA específica para o tratamento por Gemini Vision |
| **IA-STRIP-CONSENT-FLOW.md** | 0.1 DRAFT | Pendente assinatura | Documento operacional do fluxo de consentimento, opt-out e retenção |

A vigência deste Aditamento depende da aprovação conjunta dos três documentos.

---

## 4. Eficácia, Vigência e Publicação

- **Eficácia:** A partir da data da última das três assinaturas exigidas (RT, DPO, CTO).
- **Vigência:** Indeterminada, sujeita à revisão anual obrigatória junto à POL-LGPD-001 (Art. 38 LGPD).
- **Publicação:**
  1. Arquivamento em `docs/lgpd/POL-LGPD-001-AMENDMENT-2026-05-08.md`.
  2. Cadastro no SGQ módulo `sgq-documentos` com `codigo='POL-LGPD-001-AM-2026-05-08'`, `tipo='POL'`, `status='vigente'`.
  3. Emissão de POL-LGPD-001 v1.1 consolidada após validação de revisão anual.
  4. Comunicação a todos os colaboradores via módulo `treinamentos` com obrigação de leitura registrada.
  5. Divulgação ao público no portal do paciente e nos pontos de coleta (cartaz informativo).

---

## 5. Bloco de Aprovação

> **AVISO:** As assinaturas abaixo são exigência formal. **Sem todas as três, este Aditamento permanece em DRAFT e o módulo `ia-strip` não pode ser ativado em produção com dados de pacientes.**

| Papel | Nome | Registro Profissional | Assinatura | Data |
| --- | --- | --- | --- | --- |
| Responsável Técnico (RT) — Direção Técnica | [PREENCHER] | CRBM/CRF/CRM ___________ | __________ | ____/____/____ |
| Encarregado de Proteção de Dados (DPO) | [PREENCHER] | — | __________ | ____/____/____ |
| Diretor de Tecnologia (CTO) | [PREENCHER] | — | __________ | ____/____/____ |

---

## 6. Histórico de Revisões

| Versão | Data | Status | Mudança |
| --- | --- | --- | --- |
| 0.1 | 2026-05-08 | DRAFT | Emissão inicial. Pendente assinatura RT + DPO + CTO. |

---

## Referências Normativas

- **LGPD** — Lei 13.709/2018, Arts. 5º, 6º, 7º, 9º, 11, 18, 20, 33, 38, 46.
- **POL-LGPD-001 v1.0** — Política-mãe a ser aditada.
- **IT-LGPD-DPIA-002 v0.1** — DPIA específica do tratamento.
- **IA-STRIP-CONSENT-FLOW.md v0.1** — Fluxo operacional de consentimento.
- **RDC 978/2025** — Procedimentos Técnicos para Laboratórios Clínicos, Art. 115 (retenção de prontuário).
- **DICQ 8ª Ed. — Bloco J** — Proteção de Dados.
- **ISO/IEC 27701:2019** — Sistema de Gestão de Privacidade da Informação.
- **Google Cloud Data Processing and Security Terms (DPST)** — Cláusulas Contratuais Padrão (SCC) tipo C2P.

---

**Status do documento:** **DRAFT — NÃO APLICÁVEL EM PRODUÇÃO ATÉ ASSINATURA CONJUNTA**
