<system>
Você é um engenheiro sênior full-stack especializado em TypeScript,
React 18, Firebase e arquitetura de SaaS multi-tenant para sistemas
regulados de saúde (RDC 978/2025, ISO 15189:2022, ANVISA).

MODO OPERACIONAL — TIRO ÚNICO:
- Implemente o módulo inteiro de ponta a ponta em sequência contínua
- NÃO pare para aprovações intermediárias
- Raciocine em <thinking> antes de cada arquivo
- Sinalize ⚠️ trade-offs mas não pare — documente e siga
- Ao finalizar TUDO, apresente relatório completo de entrega
- Nunca leia arquivos fora do escopo definido
</system>

<contexto_projeto>
  <nome>HC Quality</nome>
  <url>hematologia2.web.app</url>
  <stack>
    Frontend: React 18 + TypeScript strict + Vite
    Backend: Firebase (Firestore + Cloud Functions + Auth + Storage)
    Estado: Zustand — useAppStore, useAuthStore
    Assinatura: src/utils/logicalSignature.ts
    Padrão de módulos: src/features/[módulo]/
      └── components/ | hooks/ | services/ | types/
    Exportação PDF: padrão de ecExportService.ts
    Import XLSX: padrão já implementado no módulo educacao-continuada
    Shared global: src/shared/ (apenas importar, nunca modificar)
  </stack>
  <modulos_finalizados>
    educacao-continuada ✅ — NÃO TOCAR
    analyzer ✅ | coagulacao ✅ | ciq-imuno ✅ | insumos ✅
  </modulos_finalizados>
</contexto_projeto>

<escopo_desta_sessao>
  ✅ LEIA APENAS:
    src/features/controle-temperatura/**    (criar — pasta nova)
    src/utils/logicalSignature.ts           (contrato — não modificar)
    src/shared/services/firebase.ts         (inicialização — não modificar)
    src/store/useAuthStore.ts               (labId/userId — não modificar)
    src/features/educacao-continuada/services/ecExportService.ts
      (padrão PDF — não modificar, só consultar)
    src/features/educacao-continuada/services/ecXlsxService.ts
      (padrão import XLSX — não modificar, só consultar para replicar)

  ❌ PROIBIDO:
    Qualquer outro arquivo fora desta lista
    Modificar módulos finalizados

  ⚠️ DESVIOS PRÉ-AUTORIZADOS:
    functions/src/index.ts → registrar ctIoT Cloud Function
    storage.rules → adicionar regra controle-temperatura/
    Ambos autorizados explicitamente pelo responsável do projeto
</escopo_desta_sessao>

<referencia_ui_aprovada>
  O mockup React abaixo foi aprovado como especificação visual.
  Implemente a UI FIEL a este mockup — cores, layout, cards,
  animações (animate-in), sidebar, mobile-first no modal de leitura.

  SUBSTITUIÇÕES obrigatórias do mockup para implementação real:
  - mockEquipamentos    → useEquipamentos() (Firebase real)
  - mockLeiturasPendentes → useLeiturasPrevistas()
  - mockNCs             → useNCs()
  - setModalOpen + salvar → useSaveLeitura() + logicalSignature.ts
  - Tabs placeholder (Equipamentos, Configurações) → implementar completo

```jsx
import React, { useState } from 'react';
import {
  Thermometer, ThermometerSun, Activity, AlertTriangle,
  FileText, Settings, Server, Plus, Check, X, Clock,
  ChevronRight, Download, Filter, Search
} from 'lucide-react';

const mockEquipamentos = [
  { id: '1', nome: 'Geladeira Reagentes - Bioquímica', tipo: 'geladeira', status: 'ativo', tempAtual: 4.2, limites: { min: 2, max: 8 }, online: true, pendente: false },
  { id: '2', nome: 'Freezer Plasma - Banco de Sangue', tipo: 'freezer', status: 'ativo', tempAtual: -28.5, limites: { min: -30, max: -20 }, online: false, pendente: true },
  { id: '3', nome: 'Estufa Cultura - Microbiologia', tipo: 'estufa', status: 'ativo', tempAtual: 37.5, limites: { min: 36.5, max: 37.5 }, online: true, pendente: false, alerta: true },
  { id: '4', nome: 'Ambiente - Sala de Coleta', tipo: 'sala', status: 'ativo', tempAtual: 22.1, limites: { min: 20, max: 24 }, online: true, pendente: false },
];

const StatusBadge = ({ type, text }) => {
  const styles = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-rose-100 text-rose-800 border-rose-200',
    neutral: 'bg-slate-100 text-slate-800 border-slate-200'
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[type]}`}>{text}</span>;
};

// Dashboard, LeiturasTab, NaoConformidadesTab, RelatoriosTab
// e estrutura de sidebar completa conforme código aprovado
// [VERSÃO COMPLETA APROVADA EM 24/04/2026 — cole o código completo aqui]
```
</referencia_ui_aprovada>

<modelo_de_dados>

  // ── EQUIPAMENTO MONITORADO ────────────────────────────────────
  type TipoEquipamento =
    | "geladeira" | "freezer" | "freezer_ultrabaixo"
    | "sala" | "banho_maria" | "estufa" | "incubadora" | "outro";

  type StatusEquipamento = "ativo" | "manutencao" | "inativo";

  interface ConfiguracaoCalendario {
    diasUteis:  { obrigatorio: boolean; horarios: string[] };
    sabado:     { obrigatorio: boolean; horarios: string[] };
    domingo:    { obrigatorio: boolean; horarios: string[] };
    feriados:   { obrigatorio: boolean; horarios: string[] };
  }

  interface LimitesAceitabilidade {
    temperaturaMin: number;
    temperaturaMax: number;
    umidadeMin?: number;
    umidadeMax?: number;
  }

  interface EquipamentoMonitorado {
    id: string;
    labId: string;
    nome: string;
    tipo: TipoEquipamento;
    localizacao: string;
    termometroId: string;              // FK para Termometro
    limites: LimitesAceitabilidade;
    calendario: ConfiguracaoCalendario;
    status: StatusEquipamento;
    dispositivoIoTId?: string;
    observacoes?: string;
    criadoEm: Timestamp;
    atualizadoEm: Timestamp;
    deletadoEm: Timestamp | null;
  }

  // ── TERMÔMETRO + HISTÓRICO DE CALIBRAÇÃO ─────────────────────
  interface CertificadoCalibração {
    versao: number;                    // 1, 2, 3... incrementa a cada renovação
    dataEmissao: Timestamp;
    dataValidade: Timestamp;
    certificadoUrl: string;            // Firebase Storage PDF
    laboratorioCalibrador: string;
    numeroCertificado: string;         // ex: CERT-2026-TM0012
    arquivadoEm?: Timestamp;           // preenchido quando substituído
  }

  interface Termometro {
    id: string;
    labId: string;
    numeroSerie: string;
    modelo: string;
    fabricante: string;
    incertezaMedicao: number;          // ±°C
    calibracaoAtual: CertificadoCalibração;   // versão vigente
    historicoCalibracoes: CertificadoCalibração[]; // todas as versões
    proximaCalibracao: Timestamp;      // derivado de calibracaoAtual.dataValidade
    statusCalibracao: "valido" | "vencendo" | "vencido"; // derivado
    ativo: boolean;
    criadoEm: Timestamp;
    deletadoEm: Timestamp | null;
  }

  // Regras de statusCalibracao:
  // "valido"   → dataValidade > hoje + 30 dias
  // "vencendo" → dataValidade entre hoje e hoje + 30 dias (alerta âmbar)
  // "vencido"  → dataValidade < hoje (alerta vermelho, bloqueia emissão FR-11)

  // ── DISPOSITIVO IoT ───────────────────────────────────────────
  interface DispositivoIoT {
    id: string;
    labId: string;
    equipamentoId: string;
    macAddress: string;
    modelo: string;                    // "ESP32+DHT22"
    intervaloEnvioMinutos: number;
    ultimaTransmissao: Timestamp | null;
    online: boolean;                   // < 2x intervalo = online
    firmwareVersao: string;
    tokenAcesso: string;               // hash SHA-256
    ativo: boolean;
    criadoEm: Timestamp;
    deletadoEm: Timestamp | null;
  }

  // ── LEITURA DE TEMPERATURA ────────────────────────────────────
  type OrigemLeitura   = "manual" | "automatica_iot";
  type StatusLeitura   = "realizada" | "perdida" | "justificada";

  interface LeituraTemperatura {
    id: string;
    labId: string;
    equipamentoId: string;
    dataHora: Timestamp;
    turno: "manha" | "tarde" | "noite" | "automatica";
    temperaturaAtual: number;
    umidade?: number;
    temperaturaMax: number;
    temperaturaMin: number;
    foraDosLimites: boolean;           // derivado automaticamente (RN-01)
    origem: OrigemLeitura;
    dispositivoIoTId?: string;
    status: StatusLeitura;
    justificativaPerdida?: string;
    assinatura?: LogicalSignature;     // obrigatório se origem = "manual"
    observacao?: string;
    deletadoEm: Timestamp | null;
  }

  // ── LEITURA PREVISTA ──────────────────────────────────────────
  interface LeituraPrevista {
    id: string;
    labId: string;
    equipamentoId: string;
    dataHoraPrevista: Timestamp;
    turno: string;
    status: "pendente" | "realizada" | "perdida" | "justificada";
    leituraId?: string;
  }

  // ── NÃO CONFORMIDADE DE TEMPERATURA ──────────────────────────
  type StatusNC = "aberta" | "em_andamento" | "resolvida";

  interface NaoConformidadeTemp {
    id: string;
    labId: string;
    leituraId: string;
    equipamentoId: string;
    temperaturaRegistrada: number;
    limiteViolado: "max" | "min" | "umidade";
    descricao: string;
    acaoImediata: string;
    acaoCorretiva?: string;
    responsavelAcao: string;
    dataAbertura: Timestamp;
    dataResolucao?: Timestamp;
    status: StatusNC;
    assinatura: LogicalSignature;
    deletadoEm: Timestamp | null;
  }

  // ── INPUT DTOs ────────────────────────────────────────────────
  type EquipamentoInput  = Omit<EquipamentoMonitorado,
    "id"|"labId"|"criadoEm"|"atualizadoEm"|"deletadoEm">;
  type LeituraInput      = Omit<LeituraTemperatura,
    "id"|"labId"|"foraDosLimites"|"deletadoEm">;
  type NCInput           = Omit<NaoConformidadeTemp,
    "id"|"labId"|"dataAbertura"|"deletadoEm">;
  type DispositivoInput  = Omit<DispositivoIoT,
    "id"|"labId"|"ultimaTransmissao"|"online"|"criadoEm"|"deletadoEm">;
  type TermometroInput   = Omit<Termometro,
    "id"|"labId"|"criadoEm"|"deletadoEm"|"statusCalibracao"|"proximaCalibracao">;

</modelo_de_dados>

<regras_de_negocio>
  RN-01: Ao salvar LeituraTemperatura, calcular foraDosLimites
         comparando com limites do EquipamentoMonitorado.
         Se foraDosLimites = true → criar NaoConformidadeTemp
         automaticamente com status "aberta".

  RN-02: LeituraTemperatura manual → assinatura obrigatória.
         LeituraTemperatura automática (IoT) → dispensa assinatura.

  RN-03: Cloud Function scheduled diária gera LeituraPrevista[]
         para o dia seguinte baseado no calendario de cada equipamento.
         Respeitar: diasUteis, sabado, domingo, feriados.

  RN-04: LeituraPrevista "pendente" há mais de 1h após dataHoraPrevista
         → status = "perdida" + alerta gerado.

  RN-05: Termometro com statusCalibracao = "vencendo" (≤30 dias)
         → alerta âmbar no Dashboard.
         statusCalibracao = "vencido" → alerta vermelho +
         bloquear emissão do FR-11 para o equipamento vinculado.

  RN-06: DispositivoIoT com ultimaTransmissao > 2x intervaloEnvio
         → online = false + alerta "dispositivo offline" no Dashboard.

  RN-07: Deleção sempre lógica (deletadoEm). Guarda 5 anos (RDC 978).

  RN-08: FR-11 gerado automaticamente para 1 mês por equipamento.
         Valores fora dos limites marcados com "*" automaticamente.
         NCs do mês listadas no verso do relatório.
         Rodapé inclui: termômetro + número de série + incerteza +
         número do certificado de calibração vigente.

  RN-09: Ao registrar nova calibração (CertificadoCalibração):
         - arquivar calibração anterior (arquivadoEm = now())
         - atualizar calibracaoAtual
         - adicionar ao historicoCalibracoes
         - recalcular statusCalibracao e proximaCalibracao
         - fechar automaticamente o alerta de vencimento se existir
         Nunca deletar histórico — rastreabilidade metrológica.

  RN-10: Import XLSX em batch:
         - Validar cada linha antes de qualquer escrita
         - Preview com erros por linha antes de confirmar
         - writeBatch atômico no Firestore após confirmação
         - Ao importar: gerar LeituraPrevista[] para 7 dias à frente
</regras_de_negocio>

<funcionalidade_import_xlsx>
  IMPORT EM MASSA DE EQUIPAMENTOS VIA XLSX

  Botão "Baixar modelo XLSX" → gera arquivo com 3 abas:

  ABA 1 — Equipamentos:
  Coluna              | Obrigatório | Valores aceitos
  Nome                | ✅          | texto livre
  Tipo                | ✅          | geladeira | freezer | freezer_ultrabaixo |
                      |             | sala | banho_maria | estufa | incubadora | outro
  Localização         | ✅          | texto livre
  Nº Série Termômetro | ✅          | deve existir na Aba 2
  Temp. Mín (°C)      | ✅          | número
  Temp. Máx (°C)      | ✅          | número (> Temp. Mín)
  Umidade Mín (%)     | ❌          | número 0-100
  Umidade Máx (%)     | ❌          | número > Umidade Mín
  Leituras por dia    | ✅          | 1 | 2 | 3
  Horário 1           | ✅          | HH:MM
  Horário 2           | ❌          | HH:MM
  Horário 3           | ❌          | HH:MM
  Dias úteis          | ✅          | Sim | Não
  Sábado              | ✅          | Sim | Não
  Domingo             | ✅          | Sim | Não
  Feriados            | ✅          | Sim | Não
  Observações         | ❌          | texto livre

  ABA 2 — Termômetros:
  Coluna                    | Obrigatório
  Nº Série                  | ✅
  Modelo                    | ✅
  Fabricante                | ✅
  Incerteza (±°C)           | ✅
  Última calibração         | ✅  (DD/MM/AAAA)
  Validade do certificado   | ✅  (DD/MM/AAAA)
  Nº do Certificado         | ✅  (ex: CERT-2026-TM0012)
  Lab. Calibrador           | ✅
  [Certificado PDF]         | ❌  → upload separado após import via UI

  ABA 3 — Instruções (bloqueada para edição):
  Tabela de valores aceitos por campo com exemplos.
  Regras de validação explicadas.
  Instrução: "Não renomear abas. Não alterar cabeçalhos."

  FLUXO NA UI:
  1. [Baixar modelo XLSX] → download do arquivo modelo pré-formatado
  2. Usuário preenche Aba 1 + Aba 2
  3. [Importar XLSX] → drag & drop ou file picker
  4. Parser valida linha a linha ANTES de qualquer escrita
  5. Preview mostra:
     ✅ 8 equipamentos válidos
     ❌ Linha 4: Temp. Mín (8°C) maior que Temp. Máx (2°C)
     ❌ Linha 7: Tipo "geladeira2" inválido
     ⚠️ Linha 3: Termômetro "TM-9999" não encontrado na Aba 2
  6. [Confirmar import] → writeBatch atômico
     - Cria EquipamentoMonitorado[] com labId
     - Cria Termometro[] com calibracaoAtual preenchida
     - Gera LeituraPrevista[] para 7 dias à frente
     - Cards de "Certificado PDF pendente" para cada termômetro
  7. Pós-import: cada termômetro mostra botão [📎 Anexar certificado]
     → upload Firebase Storage → atualiza certificadoUrl

  ARQUIVOS NOVOS:
  services/ctXlsxService.ts    → geração do modelo + parser + validação
  components/CTImportXlsx.tsx  → UI drag&drop + preview de erros + confirm
</funcionalidade_import_xlsx>

<funcionalidade_certificado_calibracao>
  GESTÃO DE CERTIFICADOS DE CALIBRAÇÃO

  Card do Termômetro na UI (Tab Configurações → Termômetros):
  ┌────────────────────────────────────────────────────────┐
  │ 🌡️ TM-0012 — Incoterm Digital                         │
  │ Fabricante: Incoterm  •  Incerteza: ±0.5°C             │
  │                                                        │
  │ Certificado vigente:  CERT-2026-TM0012                 │
  │ Emitido por: LabMetro SP                               │
  │ Validade: 15/01/2027  ✅ 266 dias restantes            │
  │                                                        │
  │ [📄 Visualizar PDF]  [🔄 Renovar calibração]           │
  │                                                        │
  │ Histórico: 3 certificados anteriores  [Ver histórico]  │
  └────────────────────────────────────────────────────────┘

  Cores do prazo:
  ✅ Verde   → > 60 dias
  🟡 Âmbar  → 30–60 dias  (RN-05 gera alerta)
  🔴 Vermelho → < 30 dias  (RN-05 bloqueia FR-11)

  Modal "Renovar calibração":
  - Data de emissão do novo certificado
  - Data de validade
  - Nº do certificado
  - Laboratório calibrador
  - [📎 Upload do PDF] → Firebase Storage
  - Ao salvar: executa RN-09 (arquiva anterior, atualiza atual)

  Modal "Histórico de calibrações":
  - Tabela: versão | período de vigência | nº certificado | lab calibrador
  - Cada linha com [📄 Ver PDF] do certificado daquele período
  - Nenhuma linha deletável — somente leitura

  RASTREABILIDADE NO FR-11 PDF (rodapé):
  "Termômetro: TM-0012 | Incoterm Digital | Incerteza: ±0.5°C
   Certificado: CERT-2026-TM0012 | Válido até: 15/01/2027
   ISO 15189:2022 cl. 5.3.1 — rastreabilidade metrológica"
</funcionalidade_certificado_calibracao>

<endpoint_iot>
  // functions/src/modules/ctIoT/index.ts
  // Registrar em functions/src/index.ts (desvio pré-autorizado)

  export const registrarLeituraIoT = onRequest(async (req, res) => {
    // 1. Validar X-Device-Token (buscar por hash SHA-256)
    //    → 401 se inválido com log: uid tentativa + timestamp
    // 2. Buscar DispositivoIoT + EquipamentoMonitorado vinculado
    // 3. Calcular foraDosLimites vs limites do equipamento
    // 4. writeBatch:
    //    a. Salvar LeituraTemperatura (origem: "automatica_iot")
    //    b. Se foraDosLimites → criar NaoConformidadeTemp
    //    c. Atualizar DispositivoIoT.ultimaTransmissao + online = true
    //    d. Marcar LeituraPrevista correspondente como "realizada"
    // 5. res.json({ ok: true, leituraId, foraDosLimites })
  });

  Payload do ESP32:
  POST /registrarLeituraIoT
  Header: X-Device-Token: {token}
  Body: {
    "temperatura": 4.2,
    "umidade": 65.0,
    "temperaturaMax": 4.8,
    "temperaturaMin": 3.9
  }

  Código de referência Arduino (incluir na documentação do módulo):
  void loop() {
    float temp = dht.readTemperature();
    float umid = dht.readHumidity();
    HTTPClient http;
    http.begin("https://us-central1-hematologia2.cloudfunctions.net/registrarLeituraIoT");
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
    http.addHeader("Content-Type", "application/json");
    String body = "{\"temperatura\":" + String(temp) +
                  ",\"umidade\":" + String(umid) +
                  ",\"temperaturaMax\":" + String(tempMax) +
                  ",\"temperaturaMin\":" + String(tempMin) + "}";
    http.POST(body);
    delay(INTERVALO_MS);
  }
</endpoint_iot>

<fr11_pdf_spec>
  PDF idêntico ao formulário papel FR-11 (arquivo de referência aprovado).

  CABEÇALHO:
  Logo LabClin | "CONTROLE DE TEMPERATURA" | FR-11 / Ver.00 / Página 1de1

  CAMPOS DE IDENTIFICAÇÃO:
  Ambiente: [localizacao do equipamento]
  Equipamento: [nome do equipamento]
  Aceitabilidade: [limiteMin]°C a [limiteMax]°C | Umid: [umidMin]% a [umidMax]%
  Termômetro: [numeroSerie]
  Mês: [mês por extenso]
  Ano: [ano]

  TABELA (31 linhas — dias 01 a 31):
  Dia | Hora | T.Atual | Umid. | T.Máx | T.Mín | Responsável |
  Hora | T.Atual | Umid. | T.Máx | T.Mín | Responsável

  Regras automáticas de preenchimento:
  - Valor fora do limite → exibir com "*" em vermelho
  - Leitura não realizada → "—" em cinza
  - Leitura justificada → "J" com tooltip da justificativa
  - Leitura IoT automática → sem campo responsável (preencher "IoT")

  OBSERVAÇÕES (verso):
  Lista das NCs do mês:
  Data | Equipamento | Valor registrado | Limite | Ação adotada | Responsável

  RODAPÉ:
  Gerência da Qualidade: [assinatura logicalSignature] | Data: [data emissão]
  PQ-06 — Gestão de Materiais

  RODAPÉ DE RASTREABILIDADE METROLÓGICA (ISO 15189:2022 cl. 5.3.1):
  Termômetro: [serie] | [modelo] | Incerteza: ±[valor]°C
  Certificado: [numeroCertificado] | Válido até: [dataValidade]
  Emitido por HC Quality em [timestamp] | Hash: [hash do documento]

  BLOQUEIO: se statusCalibracao do termômetro = "vencido"
  → não emitir FR-11 → exibir erro:
  "Certificado de calibração vencido. Renove antes de emitir o relatório."
</fr11_pdf_spec>

<estrutura_de_arquivos>
  src/features/controle-temperatura/
  ├── ControlTemperaturaView.tsx        ← entry point + 6 tabs
  ├── components/
  │   ├── CTDashboard.tsx               ← cards status em tempo real
  │   ├── EquipamentoForm.tsx           ← cadastro individual + config calendário
  │   ├── CTImportXlsx.tsx             ← import em massa via XLSX
  │   ├── LeituraRapidaForm.tsx         ← modal mobile-first
  │   ├── LeituraListaPendentes.tsx     ← leituras do turno atual
  │   ├── NCForm.tsx                    ← registro/edição de NC
  │   ├── NCList.tsx                    ← kanban abertas/resolvidas
  │   ├── TermometroForm.tsx            ← cadastro + upload certificado
  │   ├── CertificadoCalibracaoModal.tsx← renovação + histórico
  │   ├── DispositivoIoTForm.tsx        ← cadastro ESP32 + QR config
  │   ├── GraficoTemperatura.tsx        ← recharts linha + banda limite
  │   ├── CTRelatorioPrint.tsx          ← preview + emissão FR-11
  │   └── CTIndicadores.tsx            ← % conformidade mensal
  ├── hooks/
  │   ├── useEquipamentos.ts
  │   ├── useLeituras.ts
  │   ├── useLeiturasPrevistas.ts
  │   ├── useNCs.ts
  │   ├── useTermometros.ts
  │   ├── useDispositivosIoT.ts
  │   ├── useSaveLeitura.ts            ← orquestra RN-01 + RN-02
  │   ├── useSaveCalibração.ts         ← orquestra RN-09
  │   └── useCTIndicadores.ts
  ├── services/
  │   ├── ctFirebaseService.ts         ← CRUD multi-tenant completo
  │   ├── ctXlsxService.ts            ← geração modelo + parser + validação
  │   ├── ctExportService.ts          ← geração PDF FR-11
  │   └── ctIoTService.ts             ← Cloud Function ESP32
  └── types/
      └── ControlTemperatura.ts        ← todas as interfaces
</estrutura_de_arquivos>

<ordem_de_implementacao_tiro_unico>
  Execute sem parar nesta ordem:

  [1]  types/ControlTemperatura.ts
  [2]  services/ctFirebaseService.ts     (CRUD + labId em tudo)
  [3]  services/ctIoTService.ts          (Cloud Function + registrar em index.ts)
  [4]  services/ctXlsxService.ts         (geração modelo XLSX 3 abas + parser)
  [5]  hooks/useEquipamentos.ts
  [6]  hooks/useLeituras.ts + useLeiturasPrevistas.ts
  [7]  hooks/useNCs.ts
  [8]  hooks/useTermometros.ts
  [9]  hooks/useDispositivosIoT.ts
  [10] hooks/useSaveLeitura.ts           (RN-01 + RN-02)
  [11] hooks/useSaveCalibração.ts        (RN-09 — arquiva anterior)
  [12] hooks/useCTIndicadores.ts
  [13] components/LeituraRapidaForm.tsx  (mobile-first, validação inline)
  [14] components/LeituraListaPendentes.tsx
  [15] components/GraficoTemperatura.tsx (recharts + banda de aceitabilidade)
  [16] components/NCForm.tsx + NCList.tsx
  [17] components/TermometroForm.tsx
  [18] components/CertificadoCalibracaoModal.tsx (renovação + histórico)
  [19] components/DispositivoIoTForm.tsx (QR code com URL do endpoint)
  [20] components/CTImportXlsx.tsx       (drag&drop + preview erros + confirm)
  [21] components/EquipamentoForm.tsx    (cadastro individual + calendário visual)
  [22] services/ctExportService.ts       (PDF FR-11 fiel ao papel)
  [23] components/CTRelatorioPrint.tsx   (preview + bloqueio se cal. vencida)
  [24] components/CTIndicadores.tsx
  [25] components/CTDashboard.tsx        (cards tempo real + alertas calibração)
  [26] ControlTemperaturaView.tsx        (entry point 6 tabs + lazy loading)
  [27] storage.rules                     (regra controle-temperatura/ — pré-autorizado)
  [28] CLAUDE.md do módulo

  AO FINALIZAR [28]:
  Apresentar relatório de entrega com:
  - Lista completa de arquivos criados
  - Desvios de escopo realizados e motivo
  - Débitos técnicos identificados
  - Instrução de configuração do ESP32 (hardware + código Arduino)
  - Próximos passos sugeridos (notificações push, ML de tendência)
</ordem_de_implementacao_tiro_unico>

<restricoes_absolutas>
  ❌ NÃO use `any` — tipagem estrita obrigatória em tudo
  ❌ NÃO faça deleção física — apenas deletadoEm (RN-07)
  ❌ NÃO modifique src/shared/ — apenas importe
  ❌ NÃO toque em módulos finalizados
  ❌ NÃO pare para aprovação intermediária — tiro único
  ❌ NÃO envie token ou hash de autenticação IoT ao cliente
  ❌ NÃO emita FR-11 se calibração do termômetro estiver vencida (RN-05)
</restricoes_absolutas>

<inicio>
  <thinking>
    Antes do primeiro arquivo:
    1. Leia logicalSignature.ts — contrato de assinatura
    2. Leia useAuthStore.ts — labId e userId
    3. Leia ecExportService.ts — padrão de geração PDF
    4. Leia ecXlsxService.ts — padrão de import XLSX (para replicar)
    5. Verifique package.json:
       - recharts instalado? (gráfico de temperatura)
       - xlsx instalado? (já usado no EC — confirmar)
       - qrcode instalado? (QR do dispositivo IoT)
       - jspdf/pdfmake? (qual lib de PDF está sendo usada no EC)
    6. Planeje autenticação IoT:
       - tokenAcesso = SHA-256 do token bruto
       - token bruto: gerado no cadastro do dispositivo, exibido UMA vez
       - após exibição: só o hash é armazenado (nunca o token bruto)
  </thinking>

  Leia os 4 arquivos de referência e verifique o package.json.
  Em seguida implemente do [1] ao [28] sem parar.
  Ao terminar, apresente o relatório de entrega.
</inicio>