# Data Protection Impact Assessment (DPIA)

## Template de Avaliação de Impacto de Proteção de Dados

**Documento:** IT-LGPD-DPIA-001 v1.0  
**Data de Criação:** [DATA_EMISSAO]  
**Última Revisão:** [DATA_REVISAO]  
**Próxima Revisão:** [PROXIMA_REVISAO]  
**Autoridade Emitente:** [PREENCHER ANTES DE PUBLICAR - RT/Diretor Técnico]  
**Status:** Vigente

---

## 1. Descrição do Tratamento

### 1.1 Escopo do Tratamento

Uma DPIA (Data Protection Impact Assessment) ou Avaliação de Impacto de Proteção de Dados é um instrumento de conformidade LGPD (Art. 32) que documenta sistematicamente:

- **O que** dados estão sendo coletados
- **Por que** estão sendo coletados (finalidades)
- **De quem** são coletados (titulares)
- **Como** são processados e armazenados
- **Quem** tem acesso
- **Riscos** potenciais identificados
- **Medidas** implementadas para mitigar esses riscos

### 1.2 Procedimento de Aplicação

Este template destina-se a ser preenchido para:

1. Qualquer **novo tratamento de dados** introduzido no laboratório
2. **Mudanças significativas** em tratamentos existentes
3. **Avaliações periódicas** (anual ou quando solicitado)

Exemplos de ativações:

- Implementação de novo sistema de gestão de laudos
- Integração com plataforma externa de análise
- Mudança de provedor de nuvem
- Expansão de coleta de dados para novas finalidades

---

## 2. Categorias de Dados Tratados

Para o tratamento sendo avaliado, identificar:

### 2.1 Dados Pessoais (Obrigatório)

- [ ] Dados identificadores (nome, CPF, RG, documento)
- [ ] Dados de contato (email, telefone, endereço)
- [ ] Dados demográficos (idade, sexo, data nascimento)
- [ ] Dados clínicos (diagnóstico, medicamentos, condições de saúde)
- [ ] Dados biométricos (sangue, urina, materiais corporais)
- [ ] Dados de profissionais (credenciais, CRBM, CRFA)
- [ ] Dados de navegação/sistemas (IP, logs de acesso)
- [ ] Dados de localização
- [ ] Outro: ************\_\_\_************

### 2.2 Categorias de Titulares

- [ ] Pacientes do laboratório
- [ ] Profissionais de saúde (médicos, solicitantes)
- [ ] Colaboradores do laboratório
- [ ] Fornecedores
- [ ] Representantes legais de menores
- [ ] Outro: ************\_\_\_************

### 2.3 Volume Estimado de Dados

- Total de registros: ******\_\_\_\_******
- Taxa de crescimento: ******\_\_\_\_******
- Período de retenção: ******\_\_\_\_******

---

## 3. Finalidades Específicas e Base Legal

Para cada finalidade de tratamento, documentar:

| Finalidade                         | Base Legal                           | Consentimento Necessário? | Terceiros Envolvidos     |
| ---------------------------------- | ------------------------------------ | ------------------------- | ------------------------ |
| Realização de exames laboratoriais | Art. 7º II (obrigação legal RDC 978) | Não                       | —                        |
| Emissão de laudos ao solicitante   | Art. 7º II (obrigação legal)         | Não                       | Médicos/hospitais        |
| Faturamento e cobrança             | Art. 7º II (obrigação legal)         | Não                       | Operadoras de saúde      |
| Controle de qualidade interno      | Art. 7º II (DICQ 4.3)                | Não                       | —                        |
| Auditoria interna e externa        | Art. 7º II (conformidade)            | Não                       | Auditores                |
| Conformidade regulatória (ANVISA)  | Art. 7º II (obrigação legal)         | Não                       | ANVISA, Vigilância       |
| Pesquisa clínica (se aplicável)    | Art. 7º (consentimento)              | **SIM**                   | Instituições de pesquisa |
| Gestão de RH (colaboradores)       | Art. 7º II + Art. 7º III             | Não/Sim                   | —                        |
| Outro:                             |                                      |                           |                          |

---

## 4. Riscos Identificados

### 4.1 Categorias de Risco

Avaliar cada categoria conforme: **Probabilidade × Impacto = Risco**

#### A. Riscos de Confidencialidade (Vazamento Não-Autorizado)

- **R-C1:** Acesso não-autorizado a dados clínicos sensíveis
  - Probabilidade: **\_** (Baixa/Média/Alta)
  - Impacto: **\_** (Baixo/Médio/Alto)
  - Evidência: ******\_******

- **R-C2:** Interceção de dados em trânsito
  - Probabilidade: **\_**
  - Impacto: **\_**
  - Evidência: ******\_******

- **R-C3:** Exposição por colaborador malicioso
  - Probabilidade: **\_**
  - Impacto: **\_**
  - Evidência: ******\_******

#### B. Riscos de Integridade (Modificação Não-Autorizada)

- **R-I1:** Alteração de resultados de exames
  - Probabilidade: **\_**
  - Impacto: **CRÍTICO** (afeta diagnóstico)
  - Evidência: ******\_******

- **R-I2:** Modificação de audit trail
  - Probabilidade: **\_**
  - Impacto: **CRÍTICO** (invalida conformidade)
  - Evidência: ******\_******

#### C. Riscos de Disponibilidade

- **R-A1:** Indisponibilidade do sistema
  - Probabilidade: **\_**
  - Impacto: **\_**
  - Evidência: ******\_******

- **R-A2:** Perda de dados por backup falho
  - Probabilidade: **\_**
  - Impacto: **\_**
  - Evidência: ******\_******

#### D. Riscos de Conformidade Regulatória

- **R-Reg1:** Não conformidade com RDC 978 (retenção de 5 anos)
  - Probabilidade: **\_**
  - Impacto: **CRÍTICO** (auditoria falha)
  - Evidência: ******\_******

- **R-Reg2:** Violação de direitos do titular (acesso negado)
  - Probabilidade: **\_**
  - Impacto: **\_**
  - Evidência: ******\_******

### 4.2 Referência a FMEA e Análises Complementares

**Nota:** Esta DPIA v1.0 faz referência cruzada a análises de risco mais detalhadas que serão formalizadas em:

- **ADR-0016** — Arquitetura de Mitigação de Riscos (FMEA-lite) — [Referência Futura]
- **Plano 00-04** — Publicação de ADR-0016 com matriz de riscos completa

A v1.1 desta DPIA será atualizada após a conclusão do ADR-0016 para incluir a matriz de FMEA com correlação entre este documento e a análise de falhas.

---

## 5. Medidas de Mitigação

Para cada risco identificado na Seção 4, documentar as medidas implementadas:

### 5.1 Medidas Técnicas

- [ ] Criptografia em trânsito (TLS 1.2+)
- [ ] Criptografia em repouso (AES-256 GCP)
- [ ] Autenticação multifator (MFA)
- [ ] Controle de acesso por papéis (RBAC)
- [ ] Audit trail tamper-evident (append-only)
- [ ] Soft delete (marcação, nunca destruição física)
- [ ] Backup automático com redundância geográfica
- [ ] Isolamento de ambiente (dev/prod)
- [ ] Rate limiting e detecção de anomalias
- [ ] Validação de entrada em todos os endpoints
- [ ] Outra: ******\_******

### 5.2 Medidas Organizacionais

- [ ] Treinamento obrigatório em proteção de dados
- [ ] Acordo de confidencialidade com colaboradores
- [ ] Procedimento de resposta a incidentes
- [ ] Política de retenção de dados documentada
- [ ] Processo de concessão/revogação de acesso
- [ ] Revisão periódica de permissões
- [ ] Designação de Data Protection Officer (DPO)
- [ ] Avaliação de terceiros (processadores de dados)
- [ ] Documentação de contrato de processamento (Art. 28 LGPD)
- [ ] Outra: ******\_******

### 5.3 Efetividade das Medidas

Após implementação, avaliar:

| Risco  | Medida                         | Redução de Risco | Status         |
| ------ | ------------------------------ | ---------------- | -------------- |
| R-C1   | Audit trail + MFA              | 80%              | Implementado ✓ |
| R-I1   | Validação de hash + assinatura | 95%              | Implementado ✓ |
| R-I2   | Coleção append-only            | 100%             | Implementado ✓ |
| R-Reg1 | Retenção automática 5 anos     | 90%              | Implementado ✓ |

---

## 6. Responsabilidades e Aprovação

### 6.1 Proprietário do Tratamento

- **Nome:** ****************\_****************
- **Cargo:** ****************\_****************
- **Data:** ****************\_****************
- **Assinatura:** **************\_**************

### 6.2 Revisor de Conformidade / Encarregado de Proteção de Dados

- **Nome:** [PREENCHER ANTES DE PUBLICAR - DPO]
- **Cargo:** Encarregado de Proteção de Dados
- **Data de Revisão:** **********\_\_\_**********
- **Observações:** ************\_\_\_************
- **Assinatura:** **************\_**************

### 6.3 Aprovação pelo Gestor/Diretor Técnico

- **Nome:** [PREENCHER ANTES DE PUBLICAR - RT]
- **Cargo:** Responsável Técnico / Diretor
- **Data de Aprovação:** **********\_\_**********
- **Assinatura:** **************\_**************

---

## 7. Histórico de Revisões

| Versão | Data           | Revisor     | Mudanças                            |
| ------ | -------------- | ----------- | ----------------------------------- |
| 1.0    | [DATA_EMISSAO] | [PREENCHER] | Criação inicial                     |
| 1.1    | [TBD]          | DPO         | Inclusão de análise FMEA (ADR-0016) |
|        |                |             |                                     |

---

## 8. Próxima Revisão e Agendamento

**Data de Próxima Revisão:** [PROXIMA_REVISAO] (365 dias)

Esta DPIA será revisada:

- Anualmente (conforme cronograma acima), OU
- Quando mudanças significativas no tratamento forem implementadas, OU
- Quando requisitado pela ANPD ou autoridades reguladoras

**Agendamento:** Sistema automaticamente registrará lembrete em [PROXIMA_REVISAO]

---

## Referências Normativas

1. **Lei 13.709/2018** — Lei Geral de Proteção de Dados (LGPD)
   - Art. 32 — Avaliação de Impacto em Proteção de Dados
   - Art. 28 — Contrato de Processamento de Dados

2. **RDC 978/2025** — Procedimentos Técnicos para Laboratórios Clínicos
   - Art. 77 — Política de Privacidade Documentada
   - Art. 115 — Retenção de Registros (5 anos mínimo)

3. **DICQ 8ª Ed.** — Diretrizes de Acreditação de Laboratórios Clínicos
   - Cl. 4.3 — Controle de Documentos
   - Cl. 4.13 — Controle de Registros

4. **ISO 15189:2015** — Laboratórios Clínicos — Requisitos
   - Cl. 4.13 — Segurança de Informação

---

**Documento Confidencial — Uso Interno**

_Para dúvidas ou sugestões sobre esta DPIA, contatar o Encarregado de Proteção de Dados (DPO)._
