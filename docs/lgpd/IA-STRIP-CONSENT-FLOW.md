# Fluxo Operacional de Consentimento, Limitação de Finalidade, Opt-Out e Retenção

## Módulo IA-Strip (classificação assistida por Google Gemini Vision)

**Documento:** IA-STRIP-CONSENT-FLOW v0.1
**Status:** **DRAFT — PENDENTE ASSINATURA RT/DPO**
**Data de Emissão:** 2026-05-08
**Próxima Revisão:** 2027-05-08 (anual obrigatória)
**Documentos correlatos:** POL-LGPD-001-AMENDMENT-2026-05-08 (DRAFT), IT-LGPD-DPIA-002 v0.1 (DRAFT), ADR-0010, ADR-0025

---

> ⚠️ **AVISO DE STATUS — DRAFT**
>
> Este documento descreve o fluxo operacional **a ser implementado e validado** antes do rollout do módulo `ia-strip`. Os controles aqui descritos como "implementados" referem-se ao código já existente; os marcados como "pendentes" devem ser entregues como parte do gate de liberação. **A operação com dados reais permanece bloqueada** até que (i) este fluxo esteja completamente implementado, (ii) a DPIA IT-LGPD-DPIA-002 seja assinada e (iii) o Aditamento POL-LGPD-001 seja publicado.

---

## 1. Objetivo

Operacionalizar, no produto e nos procedimentos do laboratório, os requisitos da LGPD (Arts. 6º, 7º, 11, 18, 20, 33) e da POL-LGPD-001 v1.0 + Aditamento 2026-05-08 para o tratamento de imagens de strips de teste rápido por meio do operador externo Google LLC (Gemini 2.5 Flash Vision API).

Este documento descreve **onde** o consentimento é capturado, **como** a finalidade é limitada, **qual** é o caminho de opt-out e **quando** os dados são eliminados.

---

## 2. Aplicabilidade

| Item                        | Valor                                                                       |
| --------------------------- | --------------------------------------------------------------------------- |
| Módulo do sistema           | `ia-strip`                                                                  |
| Callable                    | `classifyStripGemini` (Cloud Function, região `southamerica-east1`)         |
| Tipos de teste cobertos     | HIV, Dengue (IgM/IgG), Sífilis, COVID-19 (Antígeno), HCG                    |
| Perfis impactados           | Pacientes (titulares de dados sensíveis), Operadores laboratoriais, RT, DPO |
| Hipótese legal primária     | Art. 11, II, "f" — tutela da saúde                                          |
| Hipótese legal complementar | Art. 11, II, "a" — consentimento específico (reforço)                       |

---

## 3. Pontos de Captura de Consentimento

### 3.1. Consentimento amplo (na admissão / ficha de cadastro do paciente)

**Onde:** Termo de Consentimento Livre e Esclarecido (TCLE) assinado no ato de cadastro.

**Cláusula a incluir (texto-base obrigatório):**

> _"Autorizo o Laboratório Clínico Riopomba a tratar meus dados pessoais e dados pessoais sensíveis (saúde) para a execução dos exames solicitados e para fins de leitura assistida por Inteligência Artificial em testes rápidos, quando aplicável. Estou ciente de que, na leitura assistida por IA, a imagem da área reativa do meu teste pode ser transmitida ao operador Google LLC, com servidores nos Estados Unidos da América, sob cláusulas contratuais padrão de proteção de dados, sem persistência da imagem após a inferência e sem uso para treinamento de modelos. Estou ciente de que posso recusar o processamento por IA mantendo a leitura exclusivamente manual, sem qualquer prejuízo ao meu atendimento."_

**Persistência:** Documento físico assinado + escaneamento em `docs-pacientes/{labId}/{pacienteId}/tcle-vYYYY-MM-DD.pdf` + flag `consenteIA: true|false` no documento do paciente.

### 3.2. Consentimento específico no momento da captura (UI)

**Onde:** Tela de captura do strip (`src/features/ia-strip/components/StripCapture.tsx`), antes de o operador disparar a classificação.

**Comportamento exigido (TC-11 da DPIA):**

```
[ IMAGEM CAPTURADA ]

  [✓] Autorizo análise por Inteligência Artificial (Google Gemini)
       ▸ A imagem do strip será enviada ao Google (EUA) para leitura assistida.
       ▸ A imagem não é armazenada após a leitura.
       ▸ A decisão final é sempre humana (revisão pelo profissional habilitado).
       ▸ Você pode recusar e manter leitura manual sem prejuízo.

  [ Ler manualmente (sem IA) ]    [ Classificar com IA ]
```

**Regras:**

- Default: **opt-in explícito** (checkbox **não pré-marcado**).
- Se `consenteIA === false` no cadastro: o botão "Classificar com IA" fica desabilitado por design.
- O timestamp do consentimento específico é gravado em `imuno-ia-dev/{labId}/events/{captureId}.consentTs`.

### 3.3. Aviso físico nos pontos de coleta

**Onde:** Cartaz A4 nos pontos de coleta e laboratório.

**Texto mínimo:**

> _"Aviso ao paciente: este laboratório utiliza Inteligência Artificial (Google Gemini) como ferramenta auxiliar de leitura em alguns testes rápidos. A imagem do seu teste pode ser enviada ao Google nos EUA, com proteções contratuais e sem armazenamento permanente. Você pode recusar essa análise a qualquer momento, mantendo leitura exclusivamente manual. Dúvidas: dpo@labclin-riopomba.com.br"_

---

## 4. Limitação de Finalidade

### 4.1. Usos autorizados (lista taxativa)

1. Classificação preliminar de strip de teste rápido para auxílio do operador habilitado.
2. Geração de assinatura lógica e audit trail (`imuno-ia-dev/{labId}/events/{captureId}`).
3. Métricas agregadas de custo e latência (`imuno-ia-cost/{labId}/daily/{YYYY-MM-DD}`), sem PII.
4. A/B testing de variantes de prompt clínico (`v1`, `v2`, `v3`), sem reuso da imagem fora da inferência ativa.

### 4.2. Usos vedados (lista taxativa)

- ❌ Marketing, perfilamento ou comunicação a terceiros não previstos.
- ❌ Treinamento de modelos próprios ou de terceiros com as imagens enviadas.
- ❌ Armazenamento de Base64 da imagem em Firestore, Storage, BigQuery ou logs.
- ❌ Inclusão de nome, CPF, data de nascimento, número de prontuário ou outro identificador direto no payload da Gemini API.
- ❌ Uso de IA como decisão clínica autônoma (sem revisão humana).
- ❌ Compartilhamento das imagens com convênios, operadoras de plano de saúde ou empresas de marketing.

### 4.3. Cropping obrigatório (TC-02)

A imagem enviada à Gemini deve ser **cropada client-side para a área reativa do strip** antes da codificação Base64. O componente `StripCapture` deve:

1. Apresentar guia visual de enquadramento.
2. Recortar automaticamente a região central (preset por tipo de teste).
3. Permitir ajuste manual do recorte pelo operador.
4. Bloquear envio se o recorte exceder área máxima (ex.: >40% da foto), forçando reenquadramento.

---

## 5. Caminho de Opt-Out

### 5.1. Opt-out no cadastro

- Paciente assinala "Não autorizo análise por IA" no TCLE → flag `consenteIA: false` persistido no documento do paciente.
- Reflexo no produto: tela de captura do strip não exibe a opção "Classificar com IA"; apenas leitura manual.
- Reversível: paciente pode atualizar consentimento em qualquer atendimento futuro mediante novo TCLE assinado.

### 5.2. Opt-out no momento da captura

- Mesmo com `consenteIA: true` no cadastro, o operador deve **sempre** apresentar o checkbox de consentimento específico.
- Paciente pode recusar pontualmente para o teste atual, sem alterar a flag global.

### 5.3. Revogação posterior

- Paciente pode contatar o DPO requerendo revogação retroativa.
- Resultados anteriores **não são apagados** (dever legal de prontuário, RDC 978 Art. 115), mas:
  - Novo TCLE com `consenteIA: false` é arquivado.
  - Tratamentos futuros são bloqueados.
  - Registro de revogação é gravado em `lgpd-titular-requests/{labId}/{requestId}`.

### 5.4. Indicador no histórico do paciente

A tela de histórico do paciente exibe, para cada strip processado:

- 🤖 ícone "lido por IA (Gemini)" + timestamp de consentimento + confidence + revisor humano.
- 👤 ícone "lido manualmente" — sem submissão à IA.

---

## 6. Retenção e Eliminação

| Artefato                                                             | Retenção                                                        | Eliminação                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Imagem Base64 (durante a inferência)                                 | ≤30s em RAM da Cloud Function                                   | Garbage collected pelo runtime; **nunca persiste**              |
| Documento `imuno-ia-dev/{labId}/events/{captureId}` (sem imagem)     | 5 anos a partir de `classifiedAt` (alinhado a RDC 978 Art. 115) | Soft-delete via cron `scheduledPurgeIaEvents` (TC-10, pendente) |
| `imuno-ia-cost/{labId}/daily/{YYYY-MM-DD}` (custo agregado, sem PII) | 7 anos                                                          | Soft-delete por cron contábil                                   |
| Cloud Logging (sem imagem; somente metadados operacionais)           | 90 dias (default GCP)                                           | Auto-rotated por GCP                                            |
| Resposta retida pela Google                                          | **Zero retenção** (cláusula no-training do GCP DPA)             | Confirmado contratualmente (TC-03)                              |
| Audit trail de consentimento                                         | 5 anos                                                          | Soft-delete acompanha purga do evento                           |

### 6.1. Cron de purga (TC-10 — pendente implementação)

Definição funcional do `scheduledPurgeIaEvents` (a ser implementado em `functions/src/modules/ia-strip/scheduledPurge.ts`):

- Frequência: diária, 03:00 BRT.
- Critério: `classifiedAt < now() - 5 anos AND deletadoEm == null`.
- Ação: `deletadoEm = serverTimestamp()` (RN-06 — soft-delete only).
- Audit: log em `auditLogs/{labId}/iaPurges/{ts}` com contagem de documentos purgados.
- Notificação: email mensal ao DPO com sumário das purgas realizadas.

---

## 7. Direitos do Titular — Operacionalização

| Direito                                                       | Canal                                | SLA                                         |
| ------------------------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| Confirmação e acesso (Art. 18, I e II)                        | dpo@labclin-riopomba.com.br          | 15 dias                                     |
| Correção (Art. 18, III)                                       | DPO + RT                             | 15 dias                                     |
| Anonimização / bloqueio / eliminação (Art. 18, IV)            | DPO                                  | 15 dias (sujeito a dever legal de retenção) |
| Portabilidade (Art. 18, V)                                    | Portal do Paciente (Phase 13) ou DPO | 15 dias                                     |
| Eliminação dos dados tratados com consentimento (Art. 18, VI) | DPO                                  | 15 dias (sujeito a Art. 16)                 |
| Revisão de decisão automatizada (Art. 20)                     | DPO + RT                             | 5 dias úteis                                |
| Recusa pontual de processamento por IA                        | UI de captura                        | Imediato                                    |
| Revogação global do consentimento de IA                       | TCLE atualizado ou DPO               | 1 dia útil                                  |

---

## 8. Responsabilidades

| Papel                        | Responsabilidades                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **RT (Direção Técnica)**     | Aprovar este fluxo; revisar anualmente; supervisionar revisão humana de classificações                              |
| **DPO**                      | Atender solicitações de titulares; monitorar conformidade; revisar audit trail mensalmente; manter contato com ANPD |
| **CTO / Engenharia**         | Implementar e manter os controles TC-01 a TC-11 da DPIA; garantir secrets e DPA Google ativos                       |
| **Operadores laboratoriais** | Apresentar consentimento específico em cada captura; revisar resultados de baixa confiança; nunca burlar o opt-out  |
| **Recepção / Cadastro**      | Coletar TCLE assinado e digitalizar no momento da admissão                                                          |

---

## 9. Métricas e Monitoramento

| Métrica                                               | Frequência | Owner | Alerta                                            |
| ----------------------------------------------------- | ---------- | ----- | ------------------------------------------------- |
| Taxa de opt-out de IA por paciente                    | Mensal     | DPO   | >30% requer revisão da clareza do TCLE            |
| Acurácia da IA por tipo de teste                      | Mensal     | RT    | Acurácia <85% requer reavaliação do prompt        |
| Volume de classificações por laboratório              | Diário     | CTO   | Spike >2x baseline requer investigação            |
| Solicitações de Art. 18 envolvendo IA                 | Mensal     | DPO   | Qualquer >0 requer atualização do registro        |
| Eventos `imuno-ia-dev` purgados pelo cron             | Mensal     | DPO   | Falha do cron >1d é incidente                     |
| Gaps de consentimento (`consentTs == null` em events) | Diário     | CTO   | Qualquer ocorrência é INCIDENTE — bloquear módulo |

---

## 10. Plano de Implementação (gates)

| Etapa | Entregável                                                                              | Owner             | Status                |
| ----- | --------------------------------------------------------------------------------------- | ----------------- | --------------------- |
| 1     | Aprovar e assinar este fluxo + DPIA + Aditamento POL                                    | RT + DPO + CTO    | ⏳ DRAFT              |
| 2     | Implementar TC-02 (cropping client-side) em `StripCapture.tsx`                          | Eng. front-end    | ❌ Pendente           |
| 3     | Confirmar tier no-training Vertex AI **OU** assinar DPA Google com cláusula no-training | CTO + Jurídico    | ❌ Pendente           |
| 4     | Implementar TC-10 (cron `scheduledPurgeIaEvents`)                                       | Eng. backend      | ❌ Pendente           |
| 5     | Implementar TC-11 (UI de opt-out na captura)                                            | Eng. front-end    | ❌ Pendente           |
| 6     | Atualizar TCLE físico com cláusula de IA (item 3.1)                                     | DPO + RH          | ❌ Pendente           |
| 7     | Treinamento dos operadores via módulo `treinamentos`                                    | RT + RH           | ❌ Pendente           |
| 8     | Cartaz físico nos pontos de coleta                                                      | DPO + comunicação | ❌ Pendente           |
| 9     | Smoke test em produção com paciente fictício                                            | RT + Eng.         | ❌ Pendente           |
| 10    | Habilitar feature flag `iaStripEnabled` para Riopomba                                   | CTO               | ❌ Pendente (BLOCKER) |

---

## 11. Bloco de Aprovação

> **AVISO:** As assinaturas abaixo são exigência formal. **Sem todas, este fluxo permanece em DRAFT e o módulo `ia-strip` não pode ser ativado em produção com dados de pacientes.**

| Papel                                  | Nome        | Assinatura   | Data                   |
| -------------------------------------- | ----------- | ------------ | ---------------------- |
| Responsável Técnico (RT)               | [PREENCHER] | ****\_\_**** | \_**\_/\_\_**/\_\_\_\_ |
| Encarregado de Proteção de Dados (DPO) | [PREENCHER] | ****\_\_**** | \_**\_/\_\_**/\_\_\_\_ |
| Diretor de Tecnologia (CTO)            | [PREENCHER] | ****\_\_**** | \_**\_/\_\_**/\_\_\_\_ |

---

## 12. Histórico de Revisões

| Versão | Data       | Status | Mudança                                                                   |
| ------ | ---------- | ------ | ------------------------------------------------------------------------- |
| 0.1    | 2026-05-08 | DRAFT  | Emissão inicial — fluxo operacional do consentimento, opt-out e retenção. |

---

## Referências

- **LGPD** — Lei 13.709/2018, Arts. 6º, 7º, 11, 16, 18, 20, 33, 38, 46.
- **POL-LGPD-001 v1.0** + Aditamento 2026-05-08.
- **IT-LGPD-DPIA-002 v0.1** — DPIA específica.
- **ADR-0010** — Gemini Vision API as IA Baseline.
- **ADR-0025** — IA Strip Classification — Gemini 2.5 Flash Vision API.
- **RDC 978/2025** — Art. 115 (retenção mínima de 5 anos).
- **DICQ 8ª Ed.** — Bloco J (Proteção de Dados).
- **Google Cloud Data Processing and Security Terms (DPST)** — Cláusulas SCC C2P.

---

**Status do documento:** **DRAFT — NÃO APLICÁVEL EM PRODUÇÃO ATÉ ASSINATURA CONJUNTA**
