import Papa from 'papaparse';
import { URO_ANALITOS, URO_ANALITO_LABELS } from '../UroAnalyteConfig';
import type { UroanaliseRun } from '../types/Uroanalise';
import type { UroAnalitoId } from '../types/_shared_refs';

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Exporta corridas de Uroanálise para CSV compatível com o registro FR-036 /
 * formulário de CIQ de urinálise rotina.
 *
 * Gera colunas fixas de identificação + colunas dinâmicas de obtido/esperado
 * para cada um dos 10 analitos. Para pH e densidade, inclui também valor
 * numérico em coluna separada.
 *
 * - Encoding: UTF-8 com BOM (Excel BR lê latinos)
 * - Delimiter: ponto-e-vírgula
 * - Triggers download automático no browser
 */
export function exportUroRunsToCSV(
  runs: UroanaliseRun[],
  filename: string = 'FR036_Uroanalise',
): void {
  if (runs.length === 0) {
    throw new Error('Nenhuma corrida disponível para exportação.');
  }

  type Row = Record<string, string>;

  const rows: Row[] = runs.map((r) => {
    const row: Row = {
      Código: r.runCode ?? '—',
      'Data Realização': r.dataRealizacao,
      Frequência: r.frequencia === 'DIARIA' ? 'Diária' : 'Por lote',
      Nível: r.nivel === 'N' ? 'N (Normal)' : 'P (Patológico)',
      'Lote Tira': r.loteTira,
      'Marca Tira': r.tiraMarca ?? '—',
      'Fabricante Tira': r.fabricanteTira ?? '—',
      'Validade Tira': r.validadeTira ?? '—',
      'Lote Controle': r.loteControle,
      'Fabricante Controle': r.fabricanteControle,
      'Abertura Controle': r.aberturaControle,
      'Validade Controle': r.validadeControle,
    };

    // Colunas dinâmicas: esperado + obtido por analito
    for (const id of URO_ANALITOS) {
      const label = URO_ANALITO_LABELS[id];
      row[`${label} — Esperado`] = formatEsperado(id, r.resultadosEsperados?.[id]);
      row[`${label} — Obtido`] = formatObtido(r.resultados[id]);
      row[`${label} — Origem`] = r.resultados[id]?.origem ?? '—';
    }

    row['Conformidade'] = r.conformidade === 'A' ? 'Aceitável' : 'Rejeitado';
    row['Analitos Não Conformes'] = r.analitosNaoConformes.join('; ') || '—';
    row['Alertas'] = (r.alertas ?? []).join('; ') || '—';
    row['Ação Corretiva'] = r.acaoCorretiva ?? '—';
    row['Temperatura (°C)'] =
      r.temperaturaAmbiente !== undefined ? String(r.temperaturaAmbiente) : '—';
    row['Umidade (%)'] = r.umidadeAmbiente !== undefined ? String(r.umidadeAmbiente) : '—';
    row['NOTIVISA Tipo'] = r.notivisaTipo ?? '—';
    row['NOTIVISA Status'] = r.notivisaStatus ?? '—';
    row['NOTIVISA Protocolo'] = r.notivisaProtocolo ?? '—';
    row['NOTIVISA Data Envio'] = r.notivisaDataEnvio ?? '—';
    row['NOTIVISA Justificativa'] = r.notivisaJustificativa ?? '—';
    row['Operador'] = r.operatorName;
    row['Cargo'] = r.operatorRole;
    row['Documento Profissional'] = r.operatorDocument ?? '—';
    row['Assinatura Digital'] = r.logicalSignature ?? '—';
    row['Registrado Em'] = formatTimestamp(r.createdAt);

    return row;
  });

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEsperado(
  id: UroAnalitoId,
  expected: UroanaliseRun['resultadosEsperados'][UroAnalitoId] | undefined,
): string {
  if (!expected) return '—';
  if (id === 'ph' || id === 'densidade') {
    const range = expected as { min: number; max: number };
    return `${range.min}–${range.max}`;
  }
  return String(expected);
}

function formatObtido(field: UroanaliseRun['resultados'][UroAnalitoId] | undefined): string {
  if (!field || field.valor === null || field.valor === undefined) return '—';
  return String(field.valor);
}

function formatTimestamp(ts: import('firebase/firestore').Timestamp | null | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return '—';
  }
}
