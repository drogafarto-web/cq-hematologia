import Papa from 'papaparse';
import type { CIQImunoRun } from '../types/CIQImuno';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Colunas do formulário FR-036 (RDC 978/2025) */
interface FR036Row {
  'Data Realização':      string;
  'Tipo de Teste':        string;
  'Lote Controle':        string;
  'Abertura Controle':    string;
  'Validade Controle':    string;
  'Lote Reagente':        string;
  'Status Abertura Kit':  string;
  'Resultado Esperado':   string;
  'Resultado Obtido':     string;
  'Conformidade':         string;
  'Alertas Westgard':     string;
  'Operador':             string;
  'Cargo':                string;
  'Assinatura Digital':   string;
  'Registrado Em':        string;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Exporta corridas CIQ-Imuno para CSV compatível com o formulário FR-036.
 *
 * - Encoding: UTF-8 com BOM (garante leitura correta de caracteres latinos no Excel)
 * - Delimiter: ponto-e-vírgula (padrão BR para Excel)
 * - Triggers download automático no browser
 *
 * @param runs      Corridas a exportar (já ordenadas pelo caller, se necessário)
 * @param filename  Nome do arquivo sem extensão (ex: "FR036_HIV_2026-04")
 */
export function exportRunsToCSV(
  runs:     CIQImunoRun[],
  filename: string = 'FR036_CIQ_Imuno',
): void {
  if (runs.length === 0) {
    throw new Error('Nenhuma corrida disponível para exportação.');
  }

  const rows: FR036Row[] = runs.map((r) => ({
    'Data Realização':      r.dataRealizacao,
    'Tipo de Teste':        r.testType,
    'Lote Controle':        r.loteControle,
    'Abertura Controle':    r.aberturaControle,
    'Validade Controle':    r.validadeControle,
    'Lote Reagente':        r.loteReagente,
    'Status Abertura Kit':  r.reagenteStatus === 'R' ? 'Reagente' : 'Não Reagente',
    'Resultado Esperado':   r.resultadoEsperado === 'R' ? 'Reagente' : 'Não Reagente',
    'Resultado Obtido':     r.resultadoObtido   === 'R' ? 'Reagente' : 'Não Reagente',
    'Conformidade':         r.resultadoObtido === r.resultadoEsperado ? 'Conforme' : 'Não Conforme',
    'Alertas Westgard':     (r.westgardCategorico ?? []).join('; ') || '—',
    'Operador':             r.operatorName,
    'Cargo':                r.operatorRole,
    'Assinatura Digital':   r.logicalSignature ?? '—',
    'Registrado Em':        formatTimestamp(r.createdAt),
  }));

  const csv = Papa.unparse(rows, {
    delimiter: ';',
    header:    true,
    newline:   '\r\n',
  });

  // UTF-8 BOM para leitura correta no Excel BR
  const bom     = '\uFEFF';
  const content = bom + csv;
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);

  const link    = document.createElement('a');
  link.href     = url;
  link.download = `${filename}.csv`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Libera memória após o download iniciar
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatTimestamp(
  ts: import('firebase/firestore').Timestamp | null | undefined
): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return '—';
  }
}
