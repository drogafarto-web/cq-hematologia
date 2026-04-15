import React, { useEffect } from 'react';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CIQRelatorioPrintProps {
  lot:    CIQImunoLot;
  runs:   CIQImunoRun[];
  labName?: string;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtTs(ts: import('firebase/firestore').Timestamp | null | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return '—';
  }
}

const ALERT_LABELS: Record<string, string> = {
  taxa_falha_10pct: '>10% NR no lote',
  consecutivos_3nr: '3+ NR consecutivos',
  consecutivos_4nr: '4+ NR nos últimos 10',
  lote_expirado:    'Lote expirado',
  validade_30d:     'Validade <30 dias',
};

const CARGO_LABELS: Record<string, string> = {
  biomedico:    'Biomédico(a)',
  tecnico:      'Técnico(a) de Laboratório',
  farmaceutico: 'Farmacêutico(a)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQRelatorioPrint({ lot, runs, labName, onClose }: CIQRelatorioPrintProps) {
  const totalRuns    = runs.length;
  const nrCount      = runs.filter((r) => r.resultadoObtido === 'NR').length;
  const ncCount      = runs.filter((r) => r.resultadoObtido !== r.resultadoEsperado).length;
  const taxaNR       = totalRuns > 0 ? ((nrCount / totalRuns) * 100).toFixed(1) : '—';
  const ultimaData   = runs.length > 0
    ? fmtDate([...runs].sort((a, b) => b.dataRealizacao.localeCompare(a.dataRealizacao))[0].dataRealizacao)
    : '—';
  const decisionLabel = lot.ciqDecision === 'A' ? 'Aprovado' : lot.ciqDecision === 'Rejeitado' ? 'Reprovado' : 'Pendente';

  // Auto-print and close on unmount
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 250);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [onClose]);

  return (
    <>
      {/* Print styles injected inline so they work without a separate CSS file */}
      <style>{`
        @media print {
          body > *:not(#ciq-print-root) { display: none !important; }
          #ciq-print-root { display: block !important; }
          @page { size: A4; margin: 18mm 15mm; }
        }
        @media screen {
          #ciq-print-root {
            position: fixed; inset: 0; z-index: 9999;
            background: white; overflow-y: auto;
            font-family: 'Inter', system-ui, sans-serif;
          }
        }
        #ciq-print-root * { box-sizing: border-box; }
        #ciq-print-root table { border-collapse: collapse; width: 100%; font-size: 9pt; }
        #ciq-print-root th, #ciq-print-root td {
          border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top;
        }
        #ciq-print-root th { background: #f3f4f6; font-weight: 600; }
        #ciq-print-root .nc-row td { background: #fff1f2; }
        #ciq-print-root .sig { font-family: 'Courier New', monospace; font-size: 7pt; word-break: break-all; }
      `}</style>

      <div id="ciq-print-root">
        {/* Screen close button — hidden on print */}
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10001 }}
             className="print:hidden">
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none',
                     borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
          >
            ✕ Fechar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ marginLeft: 8, padding: '8px 16px', background: '#059669',
                     color: 'white', border: 'none', borderRadius: 8,
                     cursor: 'pointer', fontSize: 13 }}
          >
            Imprimir / Salvar PDF
          </button>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px', color: '#111' }}>

          {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        borderBottom: '2px solid #111', paddingBottom: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                CQ LabClin — Controle Interno de Qualidade
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                Formulário FR-036 · RDC 978/2025 ANVISA
              </div>
              {labName && (
                <div style={{ fontSize: 12, marginTop: 4 }}>Laboratório: {labName}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#6b7280' }}>
              <div>Emitido em: {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
              <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 9 }}>
                CIQ-Imuno · {lot.testType}
              </div>
            </div>
          </div>

          {/* ── Identificação do Lote ────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          color: '#6b7280', letterSpacing: 1, marginBottom: 6 }}>
              Identificação do Lote
            </div>
            <table style={{ width: '100%', fontSize: 10 }}>
              <tbody>
                <tr>
                  <th style={{ width: '20%' }}>Tipo de Teste</th>
                  <td>{lot.testType}</td>
                  <th style={{ width: '20%' }}>Lote Controle</th>
                  <td>{lot.loteControle}</td>
                </tr>
                <tr>
                  <th>Abertura</th>
                  <td>{fmtDate(lot.aberturaControle)}</td>
                  <th>Validade</th>
                  <td>{fmtDate(lot.validadeControle)}</td>
                </tr>
                <tr>
                  <th>Total de Corridas</th>
                  <td>{totalRuns}</td>
                  <th>Decisão Formal (RT)</th>
                  <td style={{
                    color: lot.ciqDecision === 'A' ? '#059669'
                         : lot.ciqDecision === 'Rejeitado' ? '#dc2626' : '#6b7280',
                    fontWeight: 600,
                  }}>
                    {decisionLabel}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Indicadores ─────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          color: '#6b7280', letterSpacing: 1, marginBottom: 6 }}>
              Indicadores do Período
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Total corridas', value: String(totalRuns) },
                { label: 'NR (não reagentes)', value: String(nrCount) },
                { label: 'Não conformes', value: String(ncCount),
                  alert: ncCount > 0 },
                { label: 'Taxa NR', value: `${taxaNR}%`,
                  alert: parseFloat(taxaNR) > 10 },
                { label: 'Última corrida', value: ultimaData },
                { label: 'Westgard status', value: lot.lotStatus },
              ].map((ind) => (
                <div key={ind.label} style={{
                  border: `1px solid ${ind.alert ? '#fca5a5' : '#d1d5db'}`,
                  background: ind.alert ? '#fff1f2' : '#f9fafb',
                  borderRadius: 6, padding: '8px 10px',
                }}>
                  <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>{ind.label}</div>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: ind.alert ? '#dc2626' : '#111',
                  }}>
                    {ind.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tabela de Corridas ───────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          color: '#6b7280', letterSpacing: 1, marginBottom: 6 }}>
              Registro de Corridas
            </div>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Data</th>
                  <th>Esperado</th>
                  <th>Obtido</th>
                  <th>Conform.</th>
                  <th>Cargo</th>
                  <th>Operador</th>
                  <th>Alertas Westgard</th>
                  <th>Ação Corretiva</th>
                  <th>Assinatura (SHA-256)</th>
                </tr>
              </thead>
              <tbody>
                {[...runs]
                  .sort((a, b) => a.dataRealizacao.localeCompare(b.dataRealizacao))
                  .map((run) => {
                    const conforme = run.resultadoObtido === run.resultadoEsperado;
                    return (
                      <tr key={run.id} className={conforme ? '' : 'nc-row'}>
                        <td style={{ fontFamily: 'monospace', fontSize: 8 }}>
                          {run.runCode ?? '—'}
                        </td>
                        <td>{fmtDate(run.dataRealizacao)}</td>
                        <td>{run.resultadoEsperado}</td>
                        <td style={{ fontWeight: 600, color: conforme ? '#059669' : '#dc2626' }}>
                          {run.resultadoObtido}
                        </td>
                        <td style={{ color: conforme ? '#059669' : '#dc2626' }}>
                          {conforme ? 'Sim' : 'Não'}
                        </td>
                        <td>{CARGO_LABELS[run.operatorRole] ?? run.operatorRole}</td>
                        <td>{run.operatorName}</td>
                        <td style={{ fontSize: 8 }}>
                          {(run.westgardCategorico ?? [])
                            .map((a) => ALERT_LABELS[a] ?? a)
                            .join('; ') || '—'}
                        </td>
                        <td style={{ fontSize: 8 }}>
                          {run.acaoCorretiva ?? '—'}
                        </td>
                        <td className="sig">
                          {run.logicalSignature
                            ? `${run.logicalSignature.slice(0, 16)}…`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* ── Rodapé de assinatura ─────────────────────────────────────────── */}
          <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            {['Responsável Técnico', 'Supervisor de Qualidade', 'Conferente'].map((role) => (
              <div key={role} style={{ borderTop: '1px solid #111', paddingTop: 8 }}>
                <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>{role}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, fontSize: 8, color: '#9ca3af', borderTop: '1px solid #e5e7eb',
                        paddingTop: 8 }}>
            Documento gerado automaticamente pelo sistema CQ LabClin · RDC 978/2025 ANVISA ·
            Assinaturas SHA-256 verificáveis em {window.location.origin}/audit
          </div>
        </div>
      </div>
    </>
  );
}
