import Papa from 'papaparse';
import type { CoagulacaoRun } from '../types/Coagulacao';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Colunas do formulário de registro de controle interno de coagulação (espelha FR-036 / Formulário-008). */
interface CoagCSVRow {
  Código: string;
  'Data Realização': string;
  Frequência: string;
  Equipamento: string;
  Nível: string;
  // Controle
  'Lote Controle': string;
  'Fabricante Controle': string;
  'Abertura Controle': string;
  'Validade Controle': string;
  // Reagente
  'Lote Reagente': string;
  'Fabricante Reagente': string;
  'Abertura Reagente': string;
  'Validade Reagente': string;
  // Calibração
  ISI: string;
  'MNPT (s)': string;
  // Resultados
  'AP (%)': string;
  RNI: string;
  'TTPA (s)': string;
  // Qualidade
  Conformidade: string;
  'Analitos com Violação': string;
  'Violações Westgard': string;
  'Ação Corretiva': string;
  // Ambiente
  'Temperatura (°C)': string;
  'Umidade (%)': string;
  // Tecnovigilância
  'NOTIVISA Tipo': string;
  'NOTIVISA Status': string;
  'NOTIVISA Protocolo': string;
  'NOTIVISA Data Envio': string;
  'NOTIVISA Justificativa': string;
  // Operador
  Operador: string;
  Cargo: string;
  'Documento Profissional': string;
  'Assinatura Digital': string;
  'Registrado Em': string;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Exporta corridas de Coagulação para CSV compatível com o registro FR-036 / Formulário-008.
 *
 * - Encoding: UTF-8 com BOM (Excel BR lê latinos corretamente)
 * - Delimiter: ponto-e-vírgula
 * - Triggers download automático no browser
 *
 * @param runs      Corridas a exportar (ordem preservada do caller)
 * @param filename  Nome do arquivo sem extensão (ex: "FR036_Coag_NivelI_2026-04")
 */
export function exportCoagRunsToCSV(
  runs: CoagulacaoRun[],
  filename: string = 'FR036_Coagulacao',
): void {
  if (runs.length === 0) {
    throw new Error('Nenhuma corrida disponível para exportação.');
  }

  const rows: CoagCSVRow[] = runs.map((r) => ({
    Código: r.runCode ?? '—',
    'Data Realização': r.dataRealizacao,
    Frequência: r.frequencia === 'DIARIA' ? 'Diária' : 'Por lote',
    Equipamento: r.equipamento,
    Nível: r.nivel === 'I' ? 'I (Normal)' : 'II (Patológico)',
    // Controle
    'Lote Controle': r.loteControle,
    'Fabricante Controle': r.fabricanteControle,
    'Abertura Controle': r.aberturaControle,
    'Validade Controle': r.validadeControle,
    // Reagente
    'Lote Reagente': r.loteReagente,
    'Fabricante Reagente': r.fabricanteReagente,
    'Abertura Reagente': r.aberturaReagente,
    'Validade Reagente': r.validadeReagente,
    // Calibração
    ISI: r.isi !== undefined ? String(r.isi) : '—',
    'MNPT (s)': r.mnpt !== undefined ? String(r.mnpt) : '—',
    // Resultados
    'AP (%)': String(r.resultados.atividadeProtrombinica),
    RNI: r.resultados.rni.toFixed(2),
    'TTPA (s)': r.resultados.ttpa.toFixed(1),
    // Qualidade
    Conformidade: r.conformidade === 'A' ? 'Aceitável' : 'Rejeitado',
    'Analitos com Violação': r.analitosComViolacao.join('; ') || '—',
    'Violações Westgard': (r.westgardViolations ?? []).join('; ') || '—',
    'Ação Corretiva': r.acaoCorretiva ?? '—',
    // Ambiente
    'Temperatura (°C)': r.temperaturaAmbiente !== undefined ? String(r.temperaturaAmbiente) : '—',
    'Umidade (%)': r.umidadeAmbiente !== undefined ? String(r.umidadeAmbiente) : '—',
    // Tecnovigilância
    'NOTIVISA Tipo': r.notivisaTipo ?? '—',
    'NOTIVISA Status': r.notivisaStatus ?? '—',
    'NOTIVISA Protocolo': r.notivisaProtocolo ?? '—',
    'NOTIVISA Data Envio': r.notivisaDataEnvio ?? '—',
    'NOTIVISA Justificativa': r.notivisaJustificativa ?? '—',
    // Operador
    Operador: r.operatorName,
    Cargo: r.operatorRole,
    'Documento Profissional': r.operatorDocument ?? '—',
    'Assinatura Digital': r.logicalSignature ?? '—',
    'Registrado Em': formatTimestamp(r.createdAt),
  }));

  const csv = Papa.unparse(rows, {
    delimiter: ';',
    header: true,
    newline: '\r\n',
  });

  const bom = '\uFEFF';
  const content = bom + csv;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatTimestamp(ts: import('firebase/firestore').Timestamp | null | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return '—';
  }
}
