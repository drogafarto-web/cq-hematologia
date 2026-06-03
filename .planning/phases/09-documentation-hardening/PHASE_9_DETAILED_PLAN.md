# Phase 9 — Documentation Hardening (Wave 3)

## Manual da Qualidade + Quality Policy + Environment Procedures

**Phase:** 9 (Wave 3 of 3)  
**Duration:** 1.5 weeks (2026-05-07 to 2026-05-21)  
**Audience:** CTO, Head of QA, Bioquimica Module Engineer, DevOps, Compliance Auditors  
**Status:** Planning (implementation-ready spec)  
**Version:** 1.0

---

## Executive Summary

Phase 9 — Documentation Hardening delivers the **Quality Management System (QMS)** foundations required by **ISO 15189:2015 § 4.3** and **DICQ 8th Edition § 4.1.2.3–4.1.2.7**. This wave introduces:

1. **Manual da Qualidade** (ISO structure) — downloadable, versionable, mandatory in onboarding
2. **Quality Policy** — annual review trigger, lab-wide distribution
3. **Environment Procedures** — sample collection, transport, storage, Controle Temperatura integration
4. **Laboratorial Procedures** — 20 bioquimica-specific templates, DICQ 5.5.3 compliance
5. **Governance Checklist Module** — admin dashboard with completion %, owner assignment, overdue alerts
6. **Versioning + Audit Trail** — timestamp + user on every edit, immutable snapshots
7. **Firestore Schema** — sgq-documentos-governance extension
8. **Cloud Functions** — callables for publishManualQualidade, generateProcedureTemplate, triggerGovernanceReview
9. **E2E Test Specs** — 4 critical scenarios
10. **DICQ Mapping** — Blocks A, D, E coverage
11. **PDF Export** — cover page + table of contents + branding
12. **Risk Register** — scope creep, completeness, approval delays

**Target Metrics:**

- 1 Manual da Qualidade template (8-12 KB gzipped)
- 1 Quality Policy doc + 20 environment/laboratorial procedures
- Governance checklist module ≤ 45 KB gzipped
- 4 Cloud Functions callables (recordGovernanceApproval, publishManualQualidade, generateProcedureTemplate, triggerGovernanceReview)
- 4 E2E test specs (all green)
- DICQ coverage: blocks A (4.1.2.3–4.1.2.5) + D (4.1.2.4, 4.14) + E (5.4, 5.5.3) = 16 requisitos
- Zero outstanding compliance gaps post-Wave 3

**Compliance Drivers:**

- RDC 978/2025 Arts. 4–8 (Quality Management System)
- ISO 15189:2015 § 4.3 (Documentation + Control)
- DICQ § 4.1.2.3–4.1.2.7 (Quality Manual, Procedures, Records, Responsibilities)
- LGPD compliance marker: POL-LGPD-001 linked in QMS

---

## 1. Manual da Qualidade Template

### 1.1 Document Structure (ISO 15189 + DICQ 4.1.2.3)

The **Manual da Qualidade** is a living document that establishes:

- Lab identity, mission, scope, and regulatory commitments
- Quality policy and organization chart
- Roles, responsibilities, and competencies (links to `treinamentos` module)
- Supplier management and external services
- Risk management framework (links to `risks` module)
- Document and record control
- Corrective/preventive action process (links to `sgq` naoConformidade)
- Internal audit and management review (links to `auditoria-interna`)

### 1.2 Template Outline (ISO structure)

```
MANUAL DA QUALIDADE v{N}
{Lab Name} — CNPJ {CNPJ}
RDC 978/2025 + ISO 15189:2015 + DICQ 8ª Ed.

1. Prefácio
   1.1 Identidade do Laboratório
       - Nome legal, razão social, endereço, telefone
       - CNPJ e licenças regulatórias
       - Acreditação / ISO 15189 status
       - Date of issuance, effective date, version, owner

   1.2 Escopo
       - Domínios analíticos (bioquímica, hematologia, imunologia, etc.)
       - Patient population (pediatric/adult/geriatric restrictions if any)
       - Specimen types accepted
       - Geographic service area
       - Exclusions (e.g., "não realiza testes genéticos")

   1.3 Normas Aplicáveis
       - RDC 978/2025 (Diagnosis regulation)
       - ISO 15189:2015 (Clinical lab quality)
       - DICQ 8ª Ed. (ANVISA guidance)
       - LGPD (Data protection)
       - RDC 222/2018 (Biohazard waste) — cross-ref to `pgrss`
       - RDC 786/2023 (Biosafety) — cross-ref to `biosseguranca`

   1.4 Contatos-chave
       - Director of Quality (name, phone, email)
       - Technical Director (name, phone, email)
       - Regulatory Affairs (name, phone, email)
       - IT Security (name, phone, email)

2. Política da Qualidade
   2.1 Declaração da Política (signed, dated)
       - Commitment to regulatory compliance (RDC 978, ISO 15189)
       - Commitment to patient safety and data protection
       - Commitment to continuous improvement
       - Commitment to employee competency and well-being
       - Link to downloadable PDF (PDF-QP-001-v{N})

   2.2 Objetivos da Qualidade (SMART goals)
       - Example: "Manter turnaround < 4h em 95% dos exames" (link to `kpis`)
       - Example: "Zero non-conformities categorizadas como críticas" (link to `sgq`)
       - Example: "100% conformidade em trilha de audit" (link to `auditoria`)
       - Example: "98% compliance com treinamentos obrigatórios" (link to `treinamentos`)
       - Annual review trigger (cross-ref management-review module)

3. Organização e Responsabilidades
   3.1 Organograma
       - SVG embedded (auto-generated from `personnel` module)
       - Reporting lines, delegation of authority
       - Succession planning note

   3.2 Matriz de Responsabilidades (RACI)
       - Qualidade (Document control, audit, NC, CAPA)
       - Técnica (Método validation, equipment calibration, result release)
       - Operacional (Sample collection, processing, reporting)
       - Administrativa (Budget, vendor mgmt, HR)
       - LGPD (Data protection, consent, breach response)
       Table with roles across rows, domains across columns; marks: R (Responsible), A (Accountable), C (Consulted), I (Informed)

   3.3 Competência e Treinamento
       - Mandatory training matrix (cross-ref `treinamentos` module)
       - Proficiency testing schedule (cross-ref `ceq` module)
       - Revalidation cycles per role
       - Link to IT-trainning-001 (Instruction of Work)

4. Gestão de Recursos
   4.1 Facilities & Environment
       - Climate control requirements (ref to `controle-temperatura` FR-11)
       - Biosafety levels (ref to `biosseguranca`)
       - Equipment inventory (ref to `equipamentos`)
       - Maintenance & calibration procedures (callable link to `calibracao`)

   4.2 Supplier & External Services Management
       - Vendor approval process (ref to `fornecedores`)
       - Lab support contract oversight (ref to `lab-apoio`)
       - Quality agreements and service level agreements (SLAs)
       - Annual audit of external providers

   4.3 Information Technology (IT)
       - System availability targets (e.g., 99.5%)
       - Backup and disaster recovery (ref to docs/DR_PLAN.md)
       - Data security and access control
       - Audit trail compliance (ref to `auditoria-interna`)

5. Processos & Procedimentos
   5.1 Procedimentos Operacionais Padrão (POPs)
       - List of all approved POPs with version and link
       - Grouped by phase: Pre-analytical, Analytical, Post-analytical
       - Example: POP-Coleta-Venosa-v3, POP-Bioquimica-v1, etc.
       - Integration with `sgq/pops` module

   5.2 Instruções de Trabalho (ITs)
       - Equipment-specific or method-specific instructions
       - E.g., IT-ANALYZER-001, IT-Centrifuge-003
       - Version-controlled via `sgq` module

   5.3 Formulários & Registros
       - Quality forms (Sample tracking, Chain of custody, Equipment maintenance logs)
       - Integration with `sgd` (Document Management System)
       - Retention periods per RDC 978 Art. 183

6. Gestão de Riscos & Não-conformidades
   6.1 Processo de Avaliação de Riscos
       - FMEA-Lite methodology (ref to `risks` module, ADR-0016)
       - Risk thresholds: Low (NPR 1–35), Medium (36–75), High (76–125)
       - Annual review cycle

   6.2 Gestão de Não-conformidades
       - Root cause analysis (5-Why, Fishbone)
       - Corrective/preventive actions (CAP link to `sgq` naoConformidade)
       - Tracking and closure criteria
       - Trend analysis (quarterly review, link to management-review)

   6.3 Internal Audit
       - Annual audit plan (link to `auditoria-interna`)
       - Audit scheduling, scope, checklists
       - Findings documentation
       - Follow-up and closure verification

7. Gestão de Dados & Privacidade
   7.1 Conformidade LGPD
       - Privacy policy (POL-LGPD-001)
       - Data Protection Impact Assessment (IT-LGPD-DPIA-001)
       - Patient rights exercise (access, portability, deletion)
       - Link to `lgpd` module

   7.2 Audit Trail & Records Management
       - Legal signature (RDC 978 Art. 183, RDC 986)
       - Immutable records
       - Retention and deletion policies
       - Link to `auditoria-interna` with audit trail detail

8. Controle de Documentos
   8.1 Document Control Procedure
       - Approval workflow (Draft → Review → Approved → Effective)
       - Version numbering (v1.0, v1.1, v2.0)
       - Obsolescence management
       - Link to `sgq-documentos` List of Masters

   8.2 Distribuição de Documentos
       - Who receives which documents (distribution matrix)
       - Update notification process
       - Acknowledgment records
       - Link to `sgd` distribution module

9. Revisão pela Direção (Management Review)
   9.1 Input & Output
       - Review frequency: annually + ad-hoc if critical events
       - Input: audit results, NC trends, KPI review, customer feedback
       - Output: decisions on resource allocation, policy updates, organizational changes
       - Link to `management-review` module

10. Apêndices
    A. Glossário de Siglas
       - CQ = Controle de Qualidade
       - DICQ = Documento sobre Incerteza de Medição
       - RDC = Resolução da Diretoria Colegiada
       - LGPD = Lei Geral de Proteção de Dados
       - etc.

    B. Índice de Documentos Relacionados
       - All POPs, ITs, Policies, Forms referenced with doc code + version
       - Organized by functional area (pre-analytical, analytical, post-analytical, administrative)
       - Linked to `sgd` List of Masters

    C. Histórico de Revisão
       - Table: Version | Date | Changes | Approved By
       - Immutable record from Firestore audit log

    D. Contatos de Emergência
       - 24/7 escalation contacts (director, technical, IT)
       - External contacts (regulatory authority, accreditation body)
```

### 1.3 Firestore Schema for Manual da Qualidade

```firestore
/labs/{labId}/sgq-documentos/{manualId}
  {
    id: string                              // auto-generated docId
    labId: string                           // lab identifier (redundant in path)
    codigo: "MQ-001"                        // unique code per lab
    titulo: "Manual da Qualidade v{N}"     // version in title
    tipo: "manual_qualidade"                // document type enum
    versao: number                          // monotonic (1, 2, 3, ...)
    status: "vigente" | "obsoleto"          // active or archived
    conteudoHTML: string                    // full document content (structured HTML)
    secoes: {
      [key: string]: {                      // e.g., "4.1_organograma"
        titulo: string
        conteudo: string
        subsecoes: { ... }
      }
    }
    links: {
      pops: [{ popId, codigo, titulo }]     // to sgq/pops
      politicas: [{...}]                    // to sgq/documentos type=politica
      riscosModulo: "risks"                 // cross-module link
      auditModulo: "auditoria-interna"      // cross-module link
      kpisModulo: "kpis"                    // cross-module link
    }
    certificadoHash: string                 // SHA-256(conteudo) — immutable
    criadoEm: timestamp
    criadoPor: string                       // uid
    ultimaRevisaoEm: timestamp
    ultimaRevisaoPor: string                // uid
    proximaRevisaoAgendadaEm: timestamp     // 12 months from approval
    dataEfetiva: timestamp                  // when doc becomes vigente
    deletadoEm: null | timestamp            // soft-delete only
    metadados: {
      nomeLabCompleto: string
      cnpj: string
      enderecoCompleto: string
      diretorQualidade: string
      diretorTecnico: string
      responsavelLGPD: string
      certificacoesAtuais: [string]         // e.g., ["ISO 15189:2015"]
    }
  }

/labs/{labId}/sgq-documentos-audit/{auditId}
  {
    id: string
    labId: string
    documentoId: string                     // reference to parent manual
    evento: "criado" | "revisado" | "status-mudou" | "obsoleto"
    timestamp: timestamp (server-set)
    operadorId: string (uid, server-set)
    chainHash: string                       // hash of event + previous event
    delta: {                                // what changed (for reviews)
      campo: string
      valorAnterior: any
      valorNovo: any
    }
  }
```

### 1.4 Callable Function: `publishManualQualidade`

```typescript
// functions/src/modules/sgq/publishManualQualidade.ts

export const publishManualQualidade = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const {
      labId,
      manualId,
      conteudoHTML,
      secoes,
      metadados,
    } = data;

    // Validation
    if (!context.auth?.uid) throw new Error('Unauthenticated');
    const labSnapshot = await db.doc(`labs/${labId}/members/${context.auth.uid}`).get();
    if (!labSnapshot.exists) throw new Error('Not a member of this lab');
    const member = labSnapshot.data() as LabMember;
    if (!member.isAdminOrOwner) throw new Error('Admin role required');

    // Lock down: manual published = immutable until superseded
    const batch = db.batch();

    // 1. Create new version if updating existing
    if (manualId) {
      const oldManual = await db.doc(`labs/${labId}/sgq-documentos/${manualId}`).get();
      if (oldManual.exists && oldManual.data()?.status === 'vigente') {
        batch.update(oldManual.ref, {
          status: 'obsoleto',
          deletadoEm: null, // never actually delete
        });
      }
    }

    // 2. Create new manual doc
    const newManualRef = db.collection(`labs/${labId}/sgq-documentos`).doc();
    const certificadoHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ conteudoHTML, secoes }))
      .digest('hex');

    batch.set(newManualRef, {
      labId,
      codigo: 'MQ-001',
      titulo: `Manual da Qualidade v${/* version from existing */}`,
      tipo: 'manual_qualidade',
      versao: (oldManual?.data()?.versao || 0) + 1,
      status: 'vigente',
      conteudoHTML,
      secoes,
      certificadoHash,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: context.auth.uid,
      ultimaRevisaoEm: admin.firestore.FieldValue.serverTimestamp(),
      ultimaRevisaoPor: context.auth.uid,
      proximaRevisaoAgendadaEm: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000), // 12 months
      dataEfetiva: admin.firestore.FieldValue.serverTimestamp(),
      deletadoEm: null,
      metadados,
    });

    // 3. Audit entry
    const auditRef = db.collection(`labs/${labId}/sgq-documentos-audit`).doc();
    batch.set(auditRef, {
      labId,
      documentoId: newManualRef.id,
      evento: 'criado',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      operadorId: context.auth.uid,
      chainHash: await computeChainHash(labId, 'manual_qualidade'),
    });

    await batch.commit();

    return {
      success: true,
      manualId: newManualRef.id,
      versao: (oldManual?.data()?.versao || 0) + 1,
      dataEfetiva: new Date().toISOString(),
    };
  });
```

---

## 2. Quality Policy Document

### 2.1 Document Purpose

The **Quality Policy** (POL-QUALIDADE-001) is a standalone, downloadable document that declares the lab's commitment to:

- Regulatory compliance (RDC 978, ISO 15189)
- Patient safety and data protection
- Continuous quality improvement
- Employee competency and engagement

**Use Cases:**

- Distributed to all staff during onboarding (`treinamentos` module → training checklist)
- Displayed in reception (printed + signed by Director)
- Referenced in management review (`management-review` module)
- Included in accreditation audits

### 2.2 Template Outline

```
POL-QUALIDADE-001 v{N}
POLÍTICA DA QUALIDADE
{Lab Name} — CNPJ {CNPJ}

1. DECLARAÇÃO EXECUTIVA

O laboratório {Lab Name}, operando sob CNPJ {CNPJ}, é comprometido com:

(a) Conformidade regulatória total com:
    - RDC 978/2025 (Diagnosis in Health)
    - ISO 15189:2015 (Clinical Laboratory Quality & Competence)
    - DICQ 8ª Ed. (ANVISA guidance on measurement uncertainty)
    - RDC 222/2018 (Biohazard waste management)
    - RDC 786/2023 (Biosafety)
    - LGPD (Data protection)

(b) Segurança do paciente:
    - Metodologia validada e aprovada
    - Controle de qualidade interno (CIQ) + externo (CEQ) obrigatório
    - Rastreabilidade de amostras e resultados
    - Resultado correto no paciente correto no tempo correto

(c) Proteção de dados:
    - Sigilo e confidencialidade de informações clínicas
    - Cumprimento de direitos LGPD (acesso, portabilidade, exclusão)
    - Auditoria imutável de acesso a dados sensíveis
    - Incidente response < 72h (RDC 978)

(d) Melhoria contínua:
    - Análise de tendências de não-conformidades (NC)
    - Ações corretivas e preventivas (CAPA) efetivas
    - Auditorias internas anuais
    - Revisão pela direção anual + ad-hoc

(e) Competência e bem-estar:
    - Treinamento obrigatório para todas as funções
    - Avaliação periódica de competência (proficiency testing)
    - Ambiente de trabalho seguro e respeitoso
    - Engajamento de colaboradores

2. OBJETIVOS DA QUALIDADE

Estes objetivos são SMART, mensuráveis, e revisados anualmente:

OBJ-01: Conformidade Regulatória
  Meta: 100% conformidade com checklist DICQ em auditorias internas
  Medição: Audit % conformidade (semestral)
  Responsável: Diretor de Qualidade
  Prazo: 31/12/2026

OBJ-02: Segurança do Paciente
  Meta: Turnaround time < 4h em 95% dos exames de rotina
  Medição: KPI em dashboard (diário)
  Responsável: Diretor Técnico
  Prazo: 30/06/2026

OBJ-03: Qualidade Analítica
  Meta: Zero não-conformidades categorizadas como críticas (impacto direto em diagnóstico)
  Medição: NC trend (mensal)
  Responsável: Chefia Analítica
  Prazo: 31/12/2026

OBJ-04: Trilha Auditável
  Meta: 100% conformidade com RDC 986 (assinatura digital + audit trail)
  Medição: Audit trail coverage (trimestral)
  Responsável: Responsável LGPD
  Prazo: 31/12/2026

OBJ-05: Treinamento & Competência
  Meta: 100% de colaboradores com treinamento obrigatório vigente
  Medição: Compliance matriz de treinamento (mensal)
  Responsável: Gestor de RH
  Prazo: 30/06/2026

3. LINHAS DE AUTORIDADE E RESPONSABILIDADE

[ORGANOGRAMA SIMPLIFICADO]

Diretor de Qualidade:
  - Propõe e monitora objetivos da qualidade
  - Aprova todas as mudanças em POPs e ITs
  - Lidera reuniões de revisão pela direção
  - Responsável pela trilha de audit

Diretor Técnico:
  - Valida metodologias e equipamentos
  - Aprova liberação de resultados
  - Monitora CIQ + CEQ
  - Escala de crítica valor

Responsável LGPD:
  - Políticas de proteção de dados
  - Breach response
  - Direitos do titular (acesso, portabilidade, exclusão)

Gestor de RH:
  - Matriz de treinamento obrigatório
  - Competência profissional
  - Avaliação periódica

4. REVISÃO E ATUALIZAÇÃO DESTA POLÍTICA

Esta política será:
- Revisada anualmente em reunião de direção (data: ___/___/___);
- Atualizada se houve mudança de lei, norma, ou objetivo estratégico;
- Comunicada a 100% dos colaboradores (via email + impressa);
- Assinada pelo Diretor Responsável.

Última revisão: ___/___/___
Próxima revisão: ___/___/___

Aprovado por: ________________________________  Data: ___/___/___
              (Assinatura do Diretor Responsável)

Anexo A: Mapa de Competências por Cargo
Anexo B: Matriz de Treinamento Obrigatório
Anexo C: Indicadores de Qualidade (KPIs)
Anexo D: Links aos Procedimentos (POPs, ITs, Políticas)
```

### 2.3 Firestore Integration

The Quality Policy is stored in `sgq-documentos` as:

```firestore
/labs/{labId}/sgq-documentos/{policyId}
  {
    codigo: "POL-QUALIDADE-001"
    tipo: "politica"
    versao: 1
    status: "vigente"
    conteudoHTML: "...full HTML render of template above..."
    certificadoHash: "sha256hash"
    criadoEm: timestamp
    ultimaRevisaoEm: timestamp
    proximaRevisaoAgendadaEm: timestamp (12 months later)
    assinaturaDiretor: {
      nomeCompleto: string
      dataAssinatura: timestamp
      chainHash: string
    }
    dataEfetiva: timestamp
    deletadoEm: null
  }
```

**PDF Export:** Policy generated as downloadable PDF via Cloud Function `generatePolicyPDF`:

```
GET /project/hmatologia2/us-central1/generatePolicyPDF?labId={labId}&policyId={policyId}
→ Response: PDF stream (POL-QUALIDADE-001-v1.pdf)
```

---

## 3. Environment Procedures (Pre-analytical)

### 3.1 Procedures Covered (DICQ 5.3, RDC 978 Art. 179)

**All mandatory per DICQ § 5.3.1–5.3.3:**

| Procedure                            | Code        | Compliance Driver             | Integration                             |
| ------------------------------------ | ----------- | ----------------------------- | --------------------------------------- |
| Sample Collection (Venous Blood)     | POP-COL-001 | RDC 978 Art. 179 + DICQ 5.3.1 | `sgq/pops` + training in `treinamentos` |
| Sample Transport & Storage           | POP-TRS-001 | DICQ 5.3.2                    | `controle-temperatura` FR-11 monitor    |
| Specimen Labeling & Chain of Custody | POP-LAB-001 | RDC 978 Art. 181              | `sgd` document tracking                 |
| Reception & Specimen Evaluation      | POP-REC-001 | DICQ 5.3.3                    | `analyzer` OCR integration              |
| Sample Rejection Criteria            | POP-REJ-001 | DICQ 5.3.3 + RDC 978 Art. 167 | NC tracking in `sgq`                    |
| Environmental Monitoring             | POP-ENV-001 | ISO 14644 + `biosseguranca`   | Calibration module                      |
| Equipment Maintenance & Calibration  | POP-EQP-001 | RDC 978 Art. 179              | `calibracao` + `equipamentos`           |

### 3.2 Sample Collection Procedure Template (POP-COL-001)

```
POP-COL-001 v1
PROCEDIMENTO OPERACIONAL PADRÃO
Coleta de Sangue Venoso

1. OBJETIVO
   Coletar amostra de sangue venoso seguro, representativo, e rastreável
   conforme DICQ § 5.3.1 e RDC 978 Art. 179.

2. ESCOPO
   - Pacientes adultos e pediátricos
   - Coleta em braço, mão, ou calcâneo (pediátrico)
   - Exclusões: pacientes com queimaduras, edema, heparinização prévia
   - Responsável: Coletador (COREN + treinamento obrigatório em `treinamentos`)

3. REFERÊNCIAS NORMATIVAS
   - DICQ § 5.3.1 (Coleta de Amostras)
   - RDC 978/2025 Arts. 179–181
   - ISO 15189:2015 § 5.3
   - CLSI GP41 (Venipuncture)

4. MATERIAIS & EQUIPAMENTOS
   - Agulhas esterilizadas (calibre 21–23)
   - Tubos com anticoagulante (EDTA, citrato, soro gel)
   - Algodão ou álcool 70%
   - Garrote (torniquete) estéril
   - Bandagem estéril
   - Etiqueta pré-impressa com:
     - Nome do paciente (legível + código barra)
     - Data + horário da coleta
     - Nome do coletador
     - Número de rastreabilidade (link a `sgd`)

5. INSTRUÇÕES PASSO A PASSO
   5.1 Pré-coleta
       a) Verificar identidade do paciente (nome completo + CPF/prontuário)
       b) Confirmar jejum (se aplicável)
       c) Paciente em repouso por ≥ 5 min
       d) Explicar procedimento; obter consentimento verbal
       e) Higienize mãos com álcool 70%

   5.2 Seleção do Local
       a) Preferência: veia mediana do braço
       b) Secundária: basílica ou cefálica
       c) Evitar: braço com edema, paralisia, infusão IV, hematomas recentes
       d) Local sem cicatrizes, tatuagens, ou queimaduras

   5.3 Punção
       a) Aplique garrote 10 cm acima do local
       b) Desinfete a pele com álcool 70% em movimentos circulares (10–15s)
       c) Deixe secar completamente (não soprar)
       d) Com a mão não dominante, estique a pele
       e) Introduza agulha com bisel para cima, ângulo 15–30°
       f) Aplicar pressão suave para evitar hemólise
       g) Retire agulha, aplique pressão com gaze estéril

   5.4 Preenchimento de Tubos
       a) Ordem de coleta (RDC 978 exige para rastreabilidade):
          1. Tubo de soro gel (citologia/imunoensaios)
          2. Tubo EDTA (hematologia)
          3. Tubo citrato (coagulação)
       b) Homogeneizem gentilmente (8–10 inversões), não agitar
       c) Identifique cada tubo com etiqueta impressa (rastreabilidade)

   5.5 Pós-coleta
       a) Aplique bandagem estéril
       b) Registre: horário, local de punção, volume coletado
       c) Verifique integridade das amostras (sem hemólise, coágulos)
       d) Transporte imediatamente para lab (POP-TRS-001)

6. CRITÉRIOS DE REJEIÇÃO
   - Amostra hemolisada (link ao módulo `analyzer` para OCR detection)
   - Coágulos em tubo EDTA ou citrato
   - Identificação ilegível ou falta de rastreabilidade
   - Coleta > 4h antes da análise (temperature-dependent, monitored via `controle-temperatura` FR-11)

7. DOCUMENTAÇÃO
   - Caderno de coleta com assinatura do coletador
   - Registro eletrônico em `sgd` (linked to specimen ID)
   - Incident report se houve rejeição (triggers NC workflow in `sgq`)

8. REVISÃO & COMPETÊNCIA
   - Revisar anualmente (Data: ___/___/___)
   - Treinamento obrigatório: ingresso + retraining a cada 2 anos
   - Avaliação de competência: 100% dos coletadores no ingresso + reassessment anual
   - Link ao `treinamentos` module para tracking

9. ANEXOS
   A. Imagens de Locais de Coleta (Anatomia)
   B. Fluxograma de Decisão (Rejeição)
   C. Planilha de Treinamento Assinado
   D. Certificação de Competência
```

### 3.3 Transport & Storage Procedure (POP-TRS-001)

```
POP-TRS-001 v1
PROCEDIMENTO OPERACIONAL PADRÃO
Transporte e Armazenamento de Amostras

1. OBJETIVO
   Manter integridade de amostra durante transporte e armazenamento
   conforme DICQ § 5.3.2 e RDC 978 Art. 179.

2. CONDIÇÕES AMBIENTAIS (DICQ Tabela 5.3.2)

   Tipo de Análise | Transporte | Armazenamento | Máx Tempo | Ref
   ---|---|---|---|---
   Bioquímica (soro) | 15–25°C | 2–8°C | 7 dias | POP-COL-001
   Hematologia (sangue total) | 15–25°C | 18–24°C | 24h | DICQ
   Coagulação (citrato) | 18–24°C | 18–24°C | 4h | RDC 978
   Imunologia (soro) | 2–8°C | -20°C | 30 dias | CLSI
   Uroanálise | 2–8°C | 2–8°C | 2h | DICQ

3. MONITORAMENTO DE TEMPERATURA
   - Sensor IoT ESP32 integrado via `controle-temperatura` FR-11
   - Leitura a cada 5 min durante transporte
   - Alerta automático se temperatura sair de range
   - Snapshot imutável em Firestore (audit trail)
   - Link: `/labs/{labId}/controle-temperatura/monitoramento/{eventId}`

4. PROTOCOLO DE TRANSPORTE
   - Caixas isotérmicas com gelo reciclável (≤ 8°C)
   - Embalagem dupla com absorvedor de impacto
   - Identificação clara: "Amostra Biológica — Frágil"
   - Lacre de segurança (tamper-evident) — ref a `auditoria` RDC 986
   - Tempo máx: 2h (soro) ou 4h (citrato) antes de processamento

5. ARMAZENAMENTO EM LAB
   - Freezer -20°C (soro) — daily validation via sensor
   - Geladeira 2–8°C (processamento) — monitored
   - Congelador -80°C (backup) — rare, RDC 978 Art. 183 allows
   - Rack identificado com data de expiração
   - Descongelamento: uma única vez, nunca recongelar

6. REJEIÇÃO POR TRANSPORTE INADEQUADO
   - Se temp > máximo + duração > máximo → NC gerada automaticamente
   - Coletador notificado via SMS + email (triggers `treinamentos` refresher)

7. RASTREABILIDADE
   - QR code em cada caixa (linked to `sgd` box tracking)
   - GPS timestamp + sensor data stored immutably
   - Audit trail: entry/exit de geladeiras registrado via `auditoria`

8. DESCARTE
   - Amostra expirada → PGRSS workflow (RDC 222/2018) via `pgrss` module
   - Log immutável: quem, quando, como
```

### 3.4 Controle Temperatura Integration

**Direct Integration with `controle-temperatura` Module:**

All temperature-sensitive procedures automatically log sensor data:

```firestore
/labs/{labId}/controle-temperatura/monitoramento/{eventId}
  {
    labId: string
    proceduraRelacionada: "POP-TRS-001" | "POP-REC-001"  // which procedure
    especimeId: string                    // if linked to sample
    equipmentId: string                   // which refrigerator/freezer
    temperaturaCelsius: number            // 2.5–8.0 for normal range
    humidade: number (%)                  // 40–60%
    timestamp: timestamp
    statusOK: boolean                     // true if in range
    chainHash: string                     // immutable signature
    observacoes: string                   // e.g., "Door left open 2min"
    notificacaoEnviada: boolean           // if alert triggered
    operadorId: string (if manual entry)
  }
```

If any reading is out of spec, automatic NC record created:

```typescript
// Pseudo-code in controle-temperatura Cloud Function
if (temperatura < 2 || temperatura > 8) {
  // Create NC in sgq/naoConformidade
  await createNC(labId, {
    titulo: `Temperatura fora de especificação: ${temperatura}°C`,
    proceduraRelacionada: 'POP-TRS-001',
    severidade: 'alta',
    causa: 'Falha de refrigeração / porta aberta',
    // Operator notified + training link auto-generated
  });
}
```

---

## 4. Laboratorial Procedures (Analytical Phase)

### 4.1 Bioquímica-Specific Procedures (DICQ 5.5.3)

**20 Mandatory Procedures** per DICQ for quantitative analysis (`bioquimica` module):

| ID  | Procedure                                 | Code                | DICQ Ref | Integration                   |
| --- | ----------------------------------------- | ------------------- | -------- | ----------------------------- |
| 1   | Technique Validation (new method)         | IT-BIQ-VAL-001      | 5.5.3.1  | `bioquimica` service layer    |
| 2   | Internal Quality Control (CIQ)            | IT-BIQ-CIQ-001      | 5.5.3.2  | `bioquimica` Westgard engine  |
| 3   | External Quality Control (CEQ)            | IT-BIQ-CEQ-001      | 5.5.3.3  | `ceq` module                  |
| 4   | Levey-Jennings Chart Interpretation       | IT-BIQ-LJ-001       | 5.5.3.4  | `bioquimica` chart component  |
| 5   | Equipment Operation & Maintenance         | IT-EQP-ANALYZER-001 | 5.5.3.5  | `equipamentos` + `calibracao` |
| 6   | Calibration & Linearity                   | IT-BIQ-CAL-001      | 5.5.3.6  | `calibracao` module           |
| 7   | Reagent Preparation & Control             | IT-BIQ-REA-001      | 5.5.3.7  | `insumos` module              |
| 8   | Sample Dilution Protocol                  | IT-BIQ-DIL-001      | 5.5.3.8  | `bioquimica` runs             |
| 9   | Delta Check (result vs. previous)         | IT-BIQ-DLT-001      | 5.5.3.9  | `bioquimica` logic            |
| 10  | Panic/Critical Value Alert                | IT-BIQ-CVL-001      | 5.5.3.10 | `escalacao` module            |
| 11  | Result Release Authorization              | IT-BIQ-REL-001      | 5.5.3.11 | `liberacao` module            |
| 12  | Calculation & Unit Conversion             | IT-BIQ-CALC-001     | 5.5.3.12 | `bioquimica` types            |
| 13  | Uncertainty of Measurement (MU)           | IT-BIQ-UNC-001      | 5.5.3.13 | `bioquimica` metadata         |
| 14  | Interference Testing (hemolysis, lipemia) | IT-BIQ-INT-001      | 5.5.3.14 | `analyzer` OCR pre-check      |
| 15  | Method Comparison Studies                 | IT-BIQ-CMP-001      | 5.5.3.15 | Cross-equipment analytics     |
| 16  | Equipment QC Troubleshooting              | IT-BIQ-TSH-001      | 5.5.3.16 | Support procedures            |
| 17  | Reagent Stability Verification            | IT-BIQ-STB-001      | 5.5.3.17 | `insumos` tracking            |
| 18  | Preventive Maintenance Schedule           | IT-BIQ-PMT-001      | 5.5.3.18 | `calibracao` calendar         |
| 19  | Accident/Incident Reporting               | IT-BIQ-INC-001      | 5.5.3.19 | `sgq` NC workflow             |
| 20  | Documentation & Archival                  | IT-BIQ-DOC-001      | 5.5.3.20 | `sgd` + audit trail           |

### 4.2 Instruction of Work: IT-BIQ-CIQ-001 (Example)

```
IT-BIQ-CIQ-001 v1
INSTRUÇÃO DE TRABALHO
Controle Interno de Qualidade (CIQ) — Bioquímica

1. OBJETIVO
   Executar e interpretar CIQ diário via Westgard CLSI Rules
   conforme RDC 978 Art. 179 + DICQ § 5.5.3.2.

2. ESCOPO
   - Todos os analitos quantitativos (glucose, creatinine, enzymes, etc.)
   - Níveis de controle: 1 (normal) + 1 (patológico) ou custom per analyte
   - Frequência: início de cada turno + reagent change + equipment maintenance
   - Responsável: Técnico Analítico (treinado em `treinamentos`)

3. REGRAS WESTGARD IMPLEMENTADAS (RDC 978 + CLSI)

   Regra | Decisão | Ação
   ---|---|---
   1–2s | Aviso (warning) | Monitorar próximo run
   1–3s | Rejeição (reject) | Recalibrar, investigar causa
   2–2s | Rejeição (trend) | Recalibrar, investigar reagente
   R–4s | Rejeição (range) | Recalibrar, check control material
   4–1s | Extended (optional) | Ativar se habilitado por analyte
   10x | Extended (optional) | Ativar se habilitado
   6–T | Extended (optional) | Ativar se habilitado
   6–X | Extended (optional) | Ativar se habilitado

4. PROCEDIMENTO PASSO A PASSO

   4.1 Preparação de Controle
       a) Remover controle de geladeira 2–8°C
       b) Aguarde 30 min à temperatura ambiente
       c) Inspecione vial: sem cristais, cor clara, expiration OK
       d) Homogeneize gentilmente (inverta 10x)
       e) Não usar se > 8h desde retirada da geladeira

   4.2 Análise
       a) Abra módulo `bioquimica` → tab "CIQ Diário"
       b) Selecione analyte (e.g., "Glucose")
       c) Selecione nível (1 = normal 70–100 mg/dL, 2 = pathologic 200–250 mg/dL)
       d) Selecione equipment (e.g., "Analyzer-001")
       e) Preencha resultado obtido no equipamento
       f) Clique "Registrar Run"
       g) Sistema calcula média/SD + aplica regras Westgard
       h) Status exibido: ✅ APROVADO | ⚠️ AVISO | ❌ REJEIÇÃO

   4.3 Interpretação (se rejeição)
       a) Anote resultado anômalo
       b) Verifique:
          - Expiração do controle
          - Calibração do equipamento (IT-BIQ-CAL-001)
          - Condição ambiental (temperatura, umidade)
          - Estado físico do controle (cor, precipitado)
       c) Se controle OK → recalibre equipamento
       d) Se equipamento OK → novo lote de controle
       e) Documente ações em formulário "CIQ Investigação"

   4.4 Aprovação de Resultados
       a) Westgard ✅ APROVADO → Libere resultados do turno
       b) Westgard ❌ REJEIÇÃO → Reanalise amostras de pacientes ou rejeite

5. REGISTRO DIGITAL

   Sistema registra automaticamente em Firestore:

   /labs/{labId}/bioquimica/root/runs/{runId}
     {
       analitoId: "GLU"
       equipmentId: "ANALYZER-001"
       nivelId: 1
       resultadoObtido: 98.5
       resultadoEsperado: 100 ± 10
       mediaRecente: 99.2
       desvio: 1.3
       westgardStatus: "APPROVED" | "WARNING" | "REJECTION"
       westgardRuleTriggered: "1-2s" | "1-3s" | "2-2s" | "R-4s" | null
       operadorId: uid
       timestamp: server-set
       chainHash: sha256(...)
       notaInvestigacao: "Controle OK, equipamento recalibrado"
       assinatura: {
         hash: "...",
         operadorId: "...",
         ts: timestamp
       }
     }

   Relatório mensal exportável (PDF):
   - Trending por analyte (Levey-Jennings chart)
   - % de rejections por causa
   - Ações corretivas implementadas

6. ALERTAS AUTOMÁTICOS

   - If Westgard rejection → SMS alert to Quality Manager
   - If CIQ > 2 rejections na mesma turno → auto-hold patient results
   - If pattern detected (10 rejections in 30 days) → NC automática
     Título: "Padrão de rejeição em CIQ — investigação necessária"
     Link: `sgq` naoConformidade workflow

7. COMPETÊNCIA & TREINAMENTO
   - Treinamento obrigatório antes de liberar operador
   - Revalidação a cada 6 meses (proficiency test)
   - Link: `treinamentos` module → tracking
```

### 4.3 Firestore Schema for Laboratorial Procedures

```firestore
/labs/{labId}/sgq-documentos/{procId}
  {
    tipo: "instrucao_trabalho"                // IT vs POP
    codigo: "IT-BIQ-CIQ-001"                  // Código único
    titulo: "CIQ — Bioquímica"
    versao: 1
    status: "vigente"
    modulo: "bioquimica"                      // which module it's for
    areaOperacional: "analytical"             // pre | analytical | post
    conteudoHTML: "..."
    camposObrigatorios: [
      "analitoId",
      "nivelControle",
      "equipmentId",
      "resultadoObtido",
      "operadorId"
    ]
    referenciasProcedimento: [
      { modulo: "bioquimica", tipo: "run", descricao: "Registra run no sistema" },
      { modulo: "sgq", tipo: "nc", descricao: "Triggers NC se rejeição" }
    ]
    dataEfetiva: timestamp
    proximaRevisaoAgendada: timestamp
  }
```

---

## 5. Governance Checklist Module

### 5.1 Purpose & Use Cases

The **Governance Checklist** is an admin dashboard that tracks compliance with governance procedures:

- Document publishing status (Manual, Policies, POPs, ITs, FRs)
- Training completion %
- Management review completion
- Audit schedule adherence
- NC closure rate

**Use Case:** Director opens `sgq/governance-checklist` → sees:

- "Manual da Qualidade: PENDING (Due 2026-05-31)"
- "Policy Reviews: 95% complete (4/4 staff, 1 pending)"
- "Internal Audits: 2/4 scheduled Q1 2026 completed"
- "CAPA Closure: 12/15 open NCs have corrective actions assigned"

### 5.2 UI Layout (Responsive, Dark-First)

```
┌─────────────────────────────────────────────────────────────┐
│ Gestão de Conformidade — Checklist de Governança             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 📊 KPIs                          │ ⚠️  Alertas                │
│ ├─ Documentos vigentes: 18/20    │ ├─ Policy Review DUE      │
│ ├─ Treinamentos cumpridos: 95%   │ ├─ 2 NCs Overdue (>30d)   │
│ ├─ Auditorias no prazo: 80%      │ └─ 1 Calibração Vencida   │
│ └─ Conformidade DICQ: 78.5%      │                           │
│                                  │ 📅 Próximos Prazos        │
│ 🔍 Detalhamento:                 │ ├─ 2026-05-31: Manual v2  │
│                                  │ ├─ 2026-06-15: Audit Q2   │
│ ┌─ Documentação da Qualidade     │ └─ 2026-07-01: Review Dir │
│ │ ├─ ✅ Manual da Qualidade       │
│ │ │   Status: VIGENTE (v2)       │
│ │ │   Pub: 2026-05-07            │
│ │ │   Próx: 2027-05-07           │
│ │ │   Owner: Dir. Qualidade      │
│ │ │                              │
│ │ ├─ ⏳ POL-QUALIDADE-001          │
│ │ │   Status: EM_REVISÃO (50%)   │
│ │ │   Prazo: 2026-05-31          │
│ │ │   Owner: Dir. Qualidade      │
│ │ │   [Edit] [Publish] [Preview] │
│ │ │                              │
│ │ └─ ✅ IT-BIQ-CIQ-001            │
│ │     Status: VIGENTE (v1)       │
│ │     Pub: 2026-05-06            │
│ │     Próx: 2027-05-06           │
│ │     Owner: Chefia Analítica    │
│ │                                │
│ ┌─ Treinamentos Obrigatórios      │
│ │ ├─ Coleta Venosa (POP-COL-001)  │
│ │ │   Compliance: 18/19 staff ✅  │
│ │ │   1 pending (João Silva)      │
│ │ │   [View Pending] [Reschedule] │
│ │ │                              │
│ │ ├─ CIQ Bioquímica (IT-BIQ-CIQ)  │
│ │ │   Compliance: 12/12 staff ✅  │
│ │ │   Last: 2026-04-15           │
│ │ │   Next due: 2026-10-15       │
│ │ │                              │
│ │ └─ LGPD Data Protection         │
│ │     Compliance: 15/19 staff ⚠️  │
│ │     4 overdue (>30d)            │
│ │     [Send Reminders]            │
│ │                                │
│ ┌─ Auditorias Internas            │
│ │ ├─ Audit Q1 2026 (POP-AUD-001)  │
│ │ │   Schedule: 2026-05-10        │
│ │ │   Status: ✅ EXECUTADA        │
│ │ │   Findings: 3                 │
│ │ │   CAPA Assinado: 2026-05-17   │
│ │ │   [View Report] [View CAPA]   │
│ │ │                              │
│ │ └─ Audit Q2 2026 (planejar)     │
│ │     Scheduled: 2026-07-15       │
│ │     Dias restantes: 70          │
│ │     [Edit Schedule] [View Plan] │
│ │                                │
│ ┌─ Revisão pela Direção (Management Review) │
│ │ ├─ Review 2025 (COMPLETE)       │
│ │ │   Data: 2025-12-15            │
│ │ │   Participantes: 8            │
│ │ │   Decisões: 5 action items    │
│ │ │   [View Minutes]              │
│ │ │                              │
│ │ └─ Review 2026 (PENDING)        │
│ │     Scheduled: 2026-12-01       │
│ │     Dias restantes: 209         │
│ │     Próc. Preparação: 60%       │
│ │     [View Preparation] [Edit]   │
│ │                                │
│ └─ Não-conformidades & Ações Corretivas │
│   ├─ Open NCs: 15                 │
│   │   Críticas: 0 ✅              │
│   │   Maiores: 2 ⚠️ (overdue)     │
│   │   Menores: 13 ✅              │
│   │   [View List] [Aging Report]  │
│   │                              │
│   └─ CAPA Status:                 │
│       ├─ Assigned: 12/15          │
│       ├─ In Progress: 8           │
│       ├─ Ready for Close: 4       │
│       └─ Closed: 53               │
│                                  │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Firestore Schema for Governance Checklist

```firestore
/labs/{labId}/sgq-governance/{checklistId}
  {
    labId: string
    ano: number                          // e.g., 2026
    trimestre: 1 | 2 | 3 | 4            // Q1-Q4
    status: "planejado" | "em_execucao" | "fechado"

    // Document Management
    documentos: {
      manualQualidade: {
        codigo: "MQ-001"
        versaoAtual: 2
        dataPublicacao: timestamp
        proximaRevisao: timestamp
        owner: "uid"
        status: "vigente" | "em_revisao" | "pendente"
      },
      politicas: [
        {
          codigo: "POL-QUALIDADE-001",
          status: "vigente",
          dataPublicacao: timestamp,
          proximaRevisao: timestamp,
          owner: "uid"
        }
      ],
      procedures: [  // POPs + ITs
        {
          codigo: "POP-COL-001",
          versao: 3,
          status: "vigente",
          dataPublicacao: timestamp,
          proximaRevisao: timestamp,
          owner: "uid",
          modulo: "sgq"
        }
      ]
    }

    // Training Compliance
    treinamentosObrigatorios: [
      {
        codigoTreinamento: "TRN-COLETA-001"
        descricao: "Coleta Venosa Segura"
        procedureCode: "POP-COL-001"
        totalStaff: 19
        concluido: 18
        pendente: [{ uid: "...", nome: "João Silva", diasAtrasado: 32 }]
        dataProximaRevalidacao: timestamp
        responsavel: "uid"
      }
    ]

    // Internal Audits
    auditorias: [
      {
        codigo: "AUD-Q1-2026"
        dataAgendada: timestamp
        dataExecucao: timestamp (null if not yet done)
        auditor: "uid"
        findings: number // number of findings
        capaAssinado: boolean
        dataCAPA: timestamp (null if not signed)
        owner: "uid"
      }
    ]

    // Management Review
    managementReview: {
      ano: 2026
      dataAgendada: timestamp
      dataExecucao: timestamp (null if not yet done)
      participantes: ["uid1", "uid2", ...]
      inputPreparacaoPercentual: number // 0–100
      decisionItems: number
      actionItems: [{ id, descricao, prazo, owner, status }]
      minutasURL: string | null
      owner: "uid"
    }

    // DICQ Compliance Percentage
    dicqCompliancePercentual: number      // 78.5 as of 2026-05-07
    dicqBlocksProgress: {
      A: 90,   // Gestão QMS
      B: 75,   // Responsabilidade Direção
      C: 85,   // Gestão Recursos
      D: 70,   // Realização do Produto (processes)
      E: 78,   // Medição, Análise, Melhoria
      F: 95,   // Domínio Analítico (Bioquímica done)
      ...      // etc.
    }

    // Non-Conformities & CAPAs
    naoConformidades: {
      total: 15
      criticas: 0
      maiores: 2
      menores: 13
      capaAssignedPercentual: 80        // 12/15 have CAPA
      capaFechadoPercentual: 35         // 5/15 CAPA closed
      mediaIdadeEmDias: 18
      oldestOpenDays: 42
    }

    // Risk Register (FMEA-Lite)
    riscos: {
      total: 8
      nprMedios: 3
      nprAltos: 1
      revisaoAgendada: timestamp
      nprComputation: { P: 5, S: 4, D: 2 }
    }

    // Metadata
    criadoEm: timestamp
    atualizadoEm: timestamp
    atualizadoPor: "uid"
    chainHash: string
    versao: number
  }

// Subcollection: history of changes
/labs/{labId}/sgq-governance/{checklistId}/historico/{eventId}
  {
    timestamp: timestamp
    campo: "documentos.manualQualidade.status" | ...
    valorAnterior: string
    valorNovo: string
    operadorId: "uid"
    chainHash: string
  }
```

### 5.4 Cloud Function: `triggerGovernanceReview`

```typescript
// functions/src/modules/sgq/triggerGovernanceReview.ts

export const triggerGovernanceReview = functions
  .region('southamerica-east1')
  .pubsub.schedule('0 9 1 * *') // Monthly on 1st at 9am BR time
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const allLabs = await db.collection('labs').listDocuments();

    for (const labRef of allLabs) {
      const labId = labRef.id;

      // 1. Count vigente documents
      const docsSnapshot = await db
        .collection(`labs/${labId}/sgq-documentos`)
        .where('status', '==', 'vigente')
        .count()
        .get();
      const vigenteCount = docsSnapshot.data().count;

      // 2. Count training compliance
      const trainings = await db
        .collection(`labs/${labId}/treinamentos`)
        .where('status', '==', 'obrigatorio')
        .get();
      let completionPercentual = 0;
      let overallCompliance = 0;
      for (const trainingDoc of trainings.docs) {
        const training = trainingDoc.data() as any;
        const compliance = (training.concluido / training.totalStaff) * 100;
        overallCompliance += compliance;
      }
      completionPercentual = trainings.size > 0 ? overallCompliance / trainings.size : 0;

      // 3. Count open NCs
      const ncsSnapshot = await db
        .collection(`labs/${labId}/sgq-naoConformidade`)
        .where('status', '!=', 'fechado')
        .count()
        .get();
      const openNCs = ncsSnapshot.data().count;

      // 4. Count NCs with CAPA
      const capaSnapshot = await db
        .collection(`labs/${labId}/sgq-naoConformidade`)
        .where('capaAssinado', '==', true)
        .count()
        .get();
      const withCAPA = capaSnapshot.data().count;

      // 5. Create/update governance checklist
      const checklistRef = db.doc(
        `labs/${labId}/sgq-governance/trimestral-${new Date().getFullYear()}-${Math.ceil(new Date().getMonth() / 3)}`,
      );

      await checklistRef.set(
        {
          labId,
          ano: new Date().getFullYear(),
          trimestre: Math.ceil((new Date().getMonth() + 1) / 3),
          documentos: { count: vigenteCount },
          treinamentos: { compliancePercentual: Math.round(completionPercentual) },
          naoConformidades: {
            total: openNCs,
            capaAssignedPercentual: (withCAPA / (openNCs || 1)) * 100,
          },
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
          chainHash: await computeChainHash(labId, 'governance'),
        },
        { merge: true },
      );

      // 6. Send summary email to Director of Quality
      const directorRef = await db.doc(`labs/${labId}/roles/director-quality`).get();
      if (directorRef.exists) {
        const director = directorRef.data() as any;
        await admin
          .auth()
          .getUser(director.uid)
          .then((user) => {
            // Send email via sendGrid / resend
            console.log(`Monthly governance summary sent to ${user.email}`);
          });
      }
    }
  });
```

---

## 6. Versioning & Audit Trail

### 6.1 Immutable Snapshot Pattern

Every time a governance document is created or updated, an **immutable snapshot** is stored:

```firestore
/labs/{labId}/sgq-documentos/{docId}
  {
    versao: 3
    status: "vigente"
    conteudo: "..."
    certificadoHash: "abc123def456..."  // SHA-256
    // ... other fields
  }

/labs/{labId}/sgq-documentos/{docId}/snapshots/{snapshotId}
  {
    versao: 3
    conteudo: "..."
    certificadoHash: "abc123def456..."
    criadoEm: timestamp
    criadoPor: uid
    operacaoTipo: "criacao" | "revisao" | "status-mudou"
    deltaAnterior: { versao: 2, hash: "xyz789..." }  // immutable backref
    assinatura: {
      hash: "hash(versao+conteudo+operacaoTipo)",
      operadorId: uid,
      ts: timestamp
    }
  }
```

### 6.2 Audit Trail Collection

```firestore
/labs/{labId}/sgq-documentos-audit/{auditId}
  {
    labId: string
    documentoId: string                 // e.g., "MQ-001"
    operacao: "criado" | "revisado" | "status-mudou" | "obsoleto"
    timestamp: timestamp (server-set)
    operadorId: string (uid, server-set)
    versaoAnterior: number | null
    versaoNova: number
    motivoMudanca: string               // e.g., "Review anual"
    chainHash: string                   // SHA-256(prevChainHash + versaoNova + timestamp)
    assinatura: {
      hash: string                      // logical signature
      operadorId: string
      ts: timestamp
    }
  }
```

### 6.3 Firestore Rules Enforcing Immutability

```firestore
// In firestore.rules

match /labs/{labId}/sgq-documentos/{docId}/snapshots/{snapshotId} {
  // Snapshots are append-only, never updated or deleted
  allow create: if request.auth.uid != null && request.auth.uid == request.resource.data.criadoPor;
  allow read: if request.auth.uid != null && isMemberOfLab(labId);
  allow update, delete: never;
}

match /labs/{labId}/sgq-documentos-audit/{auditId} {
  // Audit entries are append-only, immutable
  allow create: if request.auth.uid != null && request.resource.data.operadorId == request.auth.uid;
  allow read: if request.auth.uid != null && isMemberOfLab(labId);
  allow update, delete: never;
}
```

---

## 7. Firestore Schema Sketch (SGQ Extensions)

### 7.1 Collection Hierarchy

```
/labs/{labId}/sgq-documentos/
  ├── {docId}                           // All document types
  │   ├── /snapshots/{snapshotId}      // Immutable version snapshots
  │   └── /metadata/{...}              // Future use
  └── (special code="MQ-001")           // Manual da Qualidade
  └── (special type="politica")         // Policies
  └── (special type="pop")              // POPs
  └── (special type="it")               // ITs
  └── (special type="formulario")       // Forms

/labs/{labId}/sgq-documentos-audit/
  └── {auditId}                         // Append-only audit log

/labs/{labId}/sgq-governance/
  └── {checklistId}                     // Trimestral checklists
      └── /historico/{eventId}         // Change history

/labs/{labId}/sgq-naoConformidade/
  ├── {ncId}                           // Non-conformities (existing)
  └── /capa/{capaId}                   // Corrective/Preventive Actions

/labs/{labId}/management-review/
  └── {reviewId}                        // Annual management reviews
      ├── /findings/{findingId}
      ├── /decisions/{decisionId}
      └── /action-items/{itemId}
```

### 7.2 Document Type Enum

```typescript
// src/types/DocumentoTipo.ts

export enum DocumentoTipo {
  // Core QMS
  'manual_qualidade' = 'manual_qualidade', // MQ-001, etc
  'politica' = 'politica', // POL-*
  'procedimento' = 'pop', // POP-*
  'instrucao_trabalho' = 'it', // IT-*
  'formulario' = 'formulario', // FR-*

  // Regulatory policies
  'politica_lgpd' = 'politica_lgpd', // POL-LGPD-*
  'dpia' = 'dpia', // IT-LGPD-DPIA-*

  // Future modules
  'matriz_risco' = 'matriz_risco', // risks module
  'plano_auditoria' = 'plano_auditoria', // audit plan
}
```

---

## 8. Cloud Functions Callables

### 8.1 `publishManualQualidade` (Already Detailed Above)

### 8.2 `generateProcedureTemplate`

```typescript
// functions/src/modules/sgq/generateProcedureTemplate.ts

interface GenerateProcedureTemplateRequest {
  labId: string;
  tipo: 'pop' | 'it' | 'formulario';
  areaOperacional: 'pre_analytical' | 'analytical' | 'post_analytical' | 'administrative';
  titulo: string;
  modulo?: string; // e.g., 'bioquimica', 'analyzer', etc.
}

export const generateProcedureTemplate = functions
  .region('southamerica-east1')
  .https.onCall(async (data: GenerateProcedureTemplateRequest, context) => {
    if (!context.auth?.uid) throw new Error('Unauthenticated');

    const { labId, tipo, areaOperacional, titulo, modulo } = data;

    // Verify admin
    const member = await db.doc(`labs/${labId}/members/${context.auth.uid}`).get();
    if (!member.exists || !member.data()?.isAdminOrOwner) {
      throw new Error('Admin required');
    }

    // Generate HTML template based on tipo
    const templates = {
      pop: popTemplate,
      it: itTemplate,
      formulario: formularioTemplate,
    };

    const conteudoHTML = templates[tipo]({
      titulo,
      areaOperacional,
      modulo,
      labName: (await db.doc(`labs/${labId}`).get()).data()?.nomeCompleto,
    });

    // Create document
    const docRef = db.collection(`labs/${labId}/sgq-documentos`).doc();
    const codigo = `${tipo === 'pop' ? 'POP' : tipo === 'it' ? 'IT' : 'FR'}-${areaOperacional.substring(0, 3).toUpperCase()}-001`;

    await docRef.set({
      labId,
      codigo,
      titulo,
      tipo,
      versao: 1,
      status: 'em_revisao',
      areaOperacional,
      modulo: modulo || null,
      conteudoHTML,
      certificadoHash: null, // Not signed until published
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: context.auth.uid,
      ultimaRevisaoEm: null,
      proximaRevisaoAgendadaEm: null,
      deletadoEm: null,
    });

    return {
      success: true,
      docId: docRef.id,
      codigo,
      status: 'em_revisao',
      url: `/sgq/documentos/${docRef.id}`,
    };
  });
```

### 8.3 `recordGovernanceApproval`

```typescript
// functions/src/modules/sgq/recordGovernanceApproval.ts

export const recordGovernanceApproval = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, documentoId, assinadorId, carimbo } = data;

    if (!context.auth?.uid) throw new Error('Unauthenticated');

    // Verify approver is admin
    const approver = await db.doc(`labs/${labId}/members/${context.auth.uid}`).get();
    if (!approver.exists || !approver.data()?.isAdminOrOwner) {
      throw new Error('Admin role required for approval');
    }

    const batch = db.batch();

    // 1. Update document: status vigente + sign
    const docRef = db.doc(`labs/${labId}/sgq-documentos/${documentoId}`);
    const docData = (await docRef.get()).data() as any;

    batch.update(docRef, {
      status: 'vigente',
      dataEfetiva: admin.firestore.FieldValue.serverTimestamp(),
      ultimaRevisaoEm: admin.firestore.FieldValue.serverTimestamp(),
      ultimaRevisaoPor: context.auth.uid,
      proximaRevisaoAgendadaEm: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
      assinatura: {
        hash: carimbo.hash, // computed by client
        operadorId: context.auth.uid,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    // 2. Create audit entry
    const auditRef = db.collection(`labs/${labId}/sgq-documentos-audit`).doc();
    batch.set(auditRef, {
      labId,
      documentoId,
      operacao: 'status-mudou',
      valorAnterior: docData.status,
      valorNovo: 'vigente',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      operadorId: context.auth.uid,
      chainHash: await computeChainHash(labId, documentoId),
    });

    // 3. Create immutable snapshot
    const snapshotRef = docRef.collection('snapshots').doc();
    batch.set(snapshotRef, {
      versao: docData.versao,
      conteudo: docData.conteudoHTML,
      certificadoHash: docData.certificadoHash,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: context.auth.uid,
      operacaoTipo: 'status-mudou',
      assinatura: {
        hash: carimbo.hash,
        operadorId: context.auth.uid,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    await batch.commit();

    return { success: true, documentoId, status: 'vigente' };
  });
```

---

## 9. E2E Test Specs

### 9.1 Test Scenario 1: Publish Manual da Qualidade

**Path:** `functions/test/sgq/governance.e2e.test.mjs`

```typescript
describe('Governance E2E: Manual da Qualidade', () => {
  it('should publish Manual da Qualidade v1 and trigger monthly review', async () => {
    // 1. Setup: create lab, admin user
    const labId = 'test-lab-001';
    const adminUid = 'admin-uid';

    // 2. Call publishManualQualidade
    const response = await runWithContext(
      publishManualQualidade,
      {
        labId,
        manualId: null,
        conteudoHTML: '<h1>Manual...</h1>',
        secoes: { '1': { titulo: 'Prefácio', conteudo: '...' } },
        metadados: {
          nomeLabCompleto: 'Lab Test',
          cnpj: '12345678901234',
          diretorQualidade: 'John Doe',
        },
      },
      { auth: { uid: adminUid } },
    );

    // 3. Assert: manual created, vigente, audit logged
    expect(response.success).toBe(true);
    expect(response.versao).toBe(1);

    const manualSnapshot = await db.doc(`labs/${labId}/sgq-documentos/${response.manualId}`).get();
    expect(manualSnapshot.data().status).toBe('vigente');
    expect(manualSnapshot.data().dataEfetiva).toBeDefined();

    // 4. Assert: audit trail entry exists
    const auditSnapshot = await db
      .collection(`labs/${labId}/sgq-documentos-audit`)
      .where('documentoId', '==', response.manualId)
      .get();
    expect(auditSnapshot.size).toBeGreaterThan(0);
    expect(auditSnapshot.docs[0].data().operacao).toBe('criado');
    expect(auditSnapshot.docs[0].data().operadorId).toBe(adminUid);

    // 5. Assert: snapshot created (immutable)
    const snapshots = await manualSnapshot.ref.collection('snapshots').get();
    expect(snapshots.size).toBeGreaterThan(0);
    expect(snapshots.docs[0].data().operacaoTipo).toBe('criacao');
  });
});
```

### 9.2 Test Scenario 2: Governance Checklist Auto-Update

```typescript
describe('Governance E2E: Checklist Auto-Update', () => {
  it('should trigger monthly governance review and compute compliance %', async () => {
    // 1. Setup: lab with docs, trainings, NCs
    const labId = 'test-lab-002';

    // Create 5 vigente docs
    for (let i = 0; i < 5; i++) {
      await db.collection(`labs/${labId}/sgq-documentos`).doc().set({
        status: 'vigente',
        labId,
        // ...
      });
    }

    // Create training with 90% compliance
    await db.collection(`labs/${labId}/treinamentos`).doc().set({
      status: 'obrigatorio',
      totalStaff: 10,
      concluido: 9,
      labId,
    });

    // Create 10 open NCs, 7 with CAPA
    for (let i = 0; i < 10; i++) {
      const ncId = await db
        .collection(`labs/${labId}/sgq-naoConformidade`)
        .add({ status: i < 7 ? 'aberto_capa' : 'aberto', labId });
    }

    // 2. Trigger monthly review function
    await triggerGovernanceReview();

    // 3. Assert: checklist created with correct percentages
    const currentYear = new Date().getFullYear();
    const quarter = Math.ceil((new Date().getMonth() + 1) / 3);
    const checklistSnapshot = await db
      .doc(`labs/${labId}/sgq-governance/trimestral-${currentYear}-${quarter}`)
      .get();

    expect(checklistSnapshot.exists).toBe(true);
    const checklist = checklistSnapshot.data();
    expect(checklist.documentos.count).toBe(5);
    expect(checklist.treinamentos.compliancePercentual).toBe(90);
    expect(checklist.naoConformidades.capaAssignedPercentual).toBe(70);
  });
});
```

### 9.3 Test Scenario 3: Document Approval & Immutability

```typescript
describe('Governance E2E: Document Approval & Audit Trail', () => {
  it('should enforce immutability after approval signature', async () => {
    const labId = 'test-lab-003';
    const adminUid = 'admin-uid';

    // 1. Create procedure in em_revisao
    const docId = await db
      .collection(`labs/${labId}/sgq-documentos`)
      .add({
        status: 'em_revisao',
        tipo: 'pop',
        codigo: 'POP-TEST-001',
        versao: 1,
        conteudoHTML: '<h1>Original</h1>',
        labId,
      })
      .then((r) => r.id);

    // 2. Approve via recordGovernanceApproval
    const carimbo = {
      hash: 'sha256_hash_of_content',
    };
    const approvalResponse = await runWithContext(
      recordGovernanceApproval,
      { labId, documentoId: docId, assinadorId: adminUid, carimbo },
      { auth: { uid: adminUid } },
    );

    expect(approvalResponse.success).toBe(true);

    // 3. Assert: document is now vigente
    const docAfterApproval = await db.doc(`labs/${labId}/sgq-documentos/${docId}`).get();
    expect(docAfterApproval.data().status).toBe('vigente');
    expect(docAfterApproval.data().assinatura.operadorId).toBe(adminUid);

    // 4. Assert: snapshot was created (immutable copy)
    const snapshots = await docAfterApproval.ref
      .collection('snapshots')
      .where('operacaoTipo', '==', 'status-mudou')
      .get();
    expect(snapshots.size).toBeGreaterThan(0);

    // 5. Assert: cannot delete or overwrite snapshot (rules enforce)
    const snapshotToDelete = snapshots.docs[0].ref;
    try {
      await snapshotToDelete.delete();
      fail('Should not allow snapshot deletion');
    } catch (err) {
      expect(err.message).toContain('Permission denied');
    }

    // 6. Assert: audit trail has entry with chainHash
    const auditEntries = await db
      .collection(`labs/${labId}/sgq-documentos-audit`)
      .where('documentoId', '==', docId)
      .get();
    expect(auditEntries.size).toBeGreaterThan(0);
    const latestAudit = auditEntries.docs[auditEntries.size - 1].data();
    expect(latestAudit.chainHash).toBeDefined();
  });
});
```

### 9.4 Test Scenario 4: Training Completion Tracking

```typescript
describe('Governance E2E: Training Compliance Tracking', () => {
  it('should mark training as complete and update checklist', async () => {
    const labId = 'test-lab-004';

    // 1. Create training requirement linked to POP-COL-001
    const trainingId = await db
      .collection(`labs/${labId}/treinamentos`)
      .add({
        titulo: 'Coleta Venosa Segura',
        procedureCode: 'POP-COL-001',
        totalStaff: 15,
        concluido: 10,
        labId,
        status: 'obrigatorio',
        dataProximaRevalidacao: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      .then((r) => r.id);

    // 2. Complete training for 3 more staff
    const staffUids = ['staff-1', 'staff-2', 'staff-3'];
    const batch = db.batch();
    for (const staffUid of staffUids) {
      const completionRef = db
        .collection(`labs/${labId}/treinamentos/${trainingId}/completions`)
        .doc(staffUid);
      batch.set(completionRef, {
        staffUid,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        certificado: 'https://...',
      });
    }
    await batch.commit();

    // 3. Trigger monthly review
    await triggerGovernanceReview();

    // 4. Assert: checklist updated to 13/15 (86%)
    const checklistSnapshot = await db
      .doc(
        `labs/${labId}/sgq-governance/trimestral-${new Date().getFullYear()}-${Math.ceil((new Date().getMonth() + 1) / 3)}`,
      )
      .get();
    expect(checklistSnapshot.data().treinamentos.compliancePercentual).toBe(86);
  });
});
```

---

## 10. DICQ Mapping

### 10.1 Blocks A, D, E Coverage

| DICQ Block | Requisito | Artigo   | Descrição                      | Módulo / Documento                   | Status | Wave 3 |
| ---------- | --------- | -------- | ------------------------------ | ------------------------------------ | ------ | ------ |
| **A**      | 4.1.2.3   | Art. 179 | Manual da Qualidade            | MQ-001 + sgq-documentos              | ✅     | ✅     |
| **A**      | 4.1.2.4   | Art. 179 | Política da Qualidade          | POL-QUALIDADE-001                    | ✅     | ✅     |
| **A**      | 4.1.2.5   | Art. 179 | Responsabilidades & Autoridade | Organograma + RACI matrix            | ✅     | ✅     |
| **D**      | 4.1.2.4   | Art. 179 | Procedimentos Operacionais     | POPs (20 templates)                  | ✅     | ✅     |
| **D**      | 4.14      | Art. 179 | Gestão de Fornecedores         | `fornecedores` + `lab-apoio` modules | ✅     | ✅     |
| **E**      | 5.4.4     | Art. 183 | Rastreabilidade de Amostras    | POP-LAB-001 + `sgd` + audit trail    | ✅     | ✅     |
| **E**      | 5.4.5     | Art. 183 | Gestão de Registros            | `sgd` + retention policies           | ✅     | ✅     |
| **E**      | 5.5.3     | Art. 179 | Procedimentos Analíticos       | 20 ITs (bioquimica focus)            | ✅     | ✅     |

### 10.2 Non-Covered DICQ Blocks (Future Phases)

- **Block B** (Responsibility of Direction) — Management Review module (Phase 4+)
- **Block C** (Resource Management) — Personnel competency deep-dive (Phase 5+)
- **Block F** (Analytical Phase) — Partially done (Bioquímica done in Phase 9); others in Phase 10–12

---

## 11. PDF Export with Branding

### 11.1 PDF Generation Function

```typescript
// functions/src/modules/sgq/generateManualPDF.ts

export const generateManualPDF = functions
  .region('southamerica-east1')
  .https.onRequest(async (req, res) => {
    const { labId, documentoId } = req.query;

    // Fetch document
    const docSnapshot = await db.doc(`labs/${labId}/sgq-documentos/${documentoId}`).get();
    const doc = docSnapshot.data() as any;

    // Fetch lab branding
    const labSnapshot = await db.doc(`labs/${labId}`).get();
    const lab = labSnapshot.data() as any;

    // Render HTML to PDF via puppeteer
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 40px; }
            .cover-page { page-break-after: always; text-align: center; padding-top: 100px; }
            .cover-page img { max-width: 300px; }
            .cover-page h1 { font-size: 32px; margin-top: 40px; }
            .cover-page .meta { margin-top: 200px; font-size: 12px; color: #666; }
            .toc { page-break-after: always; }
            .toc ul { list-style: none; }
            .toc li { margin: 8px 0; }
            .toc a { text-decoration: none; color: #0066cc; }
            .section { page-break-before: always; margin-top: 20px; }
            .section h2 { border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          <!-- Cover Page -->
          <div class="cover-page">
            <img src="${lab.logoCdnUrl || ''}" alt="Lab Logo">
            <h1>${doc.titulo}</h1>
            <p>${lab.nomeCompleto}</p>
            <p>CNPJ: ${lab.cnpj}</p>
            <div class="meta">
              <p>Versão: ${doc.versao}</p>
              <p>Data de emissão: ${doc.dataEfetiva.toDate().toLocaleDateString('pt-BR')}</p>
              <p>Próxima revisão: ${doc.proximaRevisaoAgendadaEm?.toDate().toLocaleDateString('pt-BR') || 'N/A'}</p>
              <p>Assinado por: ${doc.ultimaRevisaoPor || 'N/A'}</p>
            </div>
          </div>

          <!-- Table of Contents -->
          <div class="toc">
            <h2>Índice</h2>
            <ul>
              ${Object.keys(doc.secoes)
                .map((key) => `<li><a href="#${key}">${doc.secoes[key].titulo}</a></li>`)
                .join('')}
            </ul>
          </div>

          <!-- Content Sections -->
          ${Object.keys(doc.secoes)
            .map(
              (key) => `
                <div class="section" id="${key}">
                  <h2>${doc.secoes[key].titulo}</h2>
                  ${doc.secoes[key].conteudo}
                </div>
              `,
            )
            .join('')}

          <!-- Footer -->
          <div style="margin-top: 100px; border-top: 1px solid #ccc; padding-top: 20px; font-size: 10px; color: #999;">
            <p>Documento gerado eletronicamente. Assinado digitalmente conforme RDC 978/2025 Art. 183.</p>
            <p>Hash: ${doc.certificadoHash.substring(0, 16)}...</p>
          </div>
        </body>
      </html>
    `;

    // Render to PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
    });

    await browser.close();

    // Return as downloadable
    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.codigo}-v${doc.versao}.pdf"`);
    res.send(pdfBuffer);
  });
```

### 11.2 Cloud Function: Callable Wrapper

```typescript
export const generateDocumentoPDF = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, documentoId } = data;

    if (!context.auth?.uid) throw new Error('Unauthenticated');

    // Verify member
    const member = await db.doc(`labs/${labId}/members/${context.auth.uid}`).get();
    if (!member.exists) throw new Error('Not a member of this lab');

    // Generate PDF via HTTP request to generateManualPDF
    const pdfUrl = `https://{region}-{project}.cloudfunctions.net/generateManualPDF?labId=${labId}&documentoId=${documentoId}`;

    return {
      success: true,
      pdfUrl,
      filename: `${documentoId}-v1.pdf`,
    };
  });
```

---

## 12. Risk Register

### 12.1 Scope Creep Risks

| Risk                                                 | Probability | Impact | Mitigation                                                                                     |
| ---------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------- |
| Procedure templates exceed 50 pages each             | Medium      | High   | Limit to 5–7 core sections per template; link to detailed appendices                           |
| DICQ coverage expectations > 85%                     | Medium      | Medium | Clearly document Wave 3 covers Blocks A, D, E only (78.5%); Phases 4+ handle B, C, F expansion |
| Integration with 15+ existing modules                | High        | High   | Use simple OneToMany refs in Firestore; avoid deep cross-module dependencies                   |
| Governance checklist auto-updates slow down database | Low         | Medium | Trigger monthly (not daily); use indexed queries on status field                               |

### 12.2 Document Completeness Risks

| Risk                                                | Probability | Impact | Mitigation                                                                   |
| --------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------- |
| Manual da Qualidade missing sections                | Medium      | High   | Use template checklist; QA validates against DICQ 4.1.2.3 before publish     |
| Procedure content outdated within 6 months          | High        | Medium | Auto-trigger review 60 days before expiry; send director reminder            |
| Training matrix incomplete (missing staff)          | High        | Medium | Monthly compliance report auto-generated; missing staff flagged in checklist |
| Regulatory changes (new RDC articles) not reflected | Low         | High   | Quarterly audit of current RDC versions; governance checklist flags drift    |

### 12.3 Approval Delays Risks

| Risk                                                           | Probability | Impact | Mitigation                                                                                |
| -------------------------------------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------- |
| Manual da Qualidade approval bottleneck (director unavailable) | Medium      | High   | Allow delegated approval via roles (Director + Assistant); email escalation after 14 days |
| Training completion slower than schedule                       | High        | Medium | Auto-notify staff 7 days before due; escalation after 30 days                             |
| Internal audit rescheduled mid-quarter                         | Medium      | Medium | Flexible scheduling UI; audit can slide 30 days with documented justification             |
| CAPA closure delayed (>60 days)                                | High        | Medium | Dashboard shows aging; escalation to Director if > 60 days open                           |

---

## Implementation Checklist

### Wave 3a: Foundation (Days 1–3)

- [ ] Implement Firestore schema (`sgq-documentos-governance`, snapshots, audit)
- [ ] Deploy Cloud Function skeleton: `publishManualQualidade`, `generateProcedureTemplate`, `recordGovernanceApproval`, `triggerGovernanceReview`
- [ ] Create Manual da Qualidade HTML template (Section 1)
- [ ] Write 5 core POPs (COL, TRS, LAB, REC, REJ)
- [ ] Write 1 IT example (BIQ-CIQ-001)
- [ ] E2E test setup (Firebase Emulator + test data)

### Wave 3b: UI & Integration (Days 4–7)

- [ ] Build `sgq/governance-checklist` component (responsive dark-first)
- [ ] Implement document upload/edit flows (modals)
- [ ] Add PDF export button (linked to callable)
- [ ] Integrate `controle-temperatura` FR-11 into transport procedures
- [ ] Link training completion to governance checklist
- [ ] Create approval workflow UI (signature capture)

### Wave 3c: Testing & Rollout (Days 8–10)

- [ ] Run 4 E2E test scenarios (green)
- [ ] Compliance audit: DICQ blocks A, D, E check
- [ ] Staging smoke tests (manual PDF generation, approval workflow)
- [ ] Documentation: CLAUDE.md for sgq/governance subdomain
- [ ] Deploy to production
- [ ] Director approval of Manual v1
- [ ] Staff onboarding training (linked in `treinamentos`)

---

## Success Criteria

1. ✅ **Manual da Qualidade v1 published & digitally signed** (Firestore immutable snapshot)
2. ✅ **Quality Policy distributed** (all staff notified + linked in onboarding)
3. ✅ **20+ procedures published** (POPs + ITs in vigor, audit trail complete)
4. ✅ **Governance Checklist automated** (monthly trigger, KPI dashboard live)
5. ✅ **Training compliance tracked** (95%+ staff have mandatory training on record)
6. ✅ **DICQ compliance at 80%+** (Blocks A, D, E fully covered)
7. ✅ **Zero audit trail gaps** (RDC 978 Art. 183 + RDC 986 compliant)
8. ✅ **4/4 E2E tests passing** (green in CI/CD pipeline)
9. ✅ **Zero security findings** (Firestore rules audit passed; chainHash validation in place)
10. ✅ **PDF exports consistent** (branding applied, TOC + cover page present)

---

**Document Version:** 1.0  
**Created:** 2026-05-07  
**Status:** Implementation-Ready  
**Owner:** CTO + Head of Quality  
**Approval Required Before:** Phase 9 Wave 3a Start (2026-05-20)
