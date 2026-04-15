import React, { useEffect, useMemo } from 'react';
import { useActiveLab, useUser }      from '../../../store/useAuthStore';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CIQRelatorioPrintProps {
  lot:     CIQImunoLot;
  runs:    CIQImunoRun[];
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtTs(ts: import('firebase/firestore').Timestamp | null | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtTsDateOnly(ts: import('firebase/firestore').Timestamp | null | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function fmtTsTimeOnly(ts: import('firebase/firestore').Timestamp | null | undefined): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Hash determinístico do par labId+lotId para código de auditoria */
function auditCode(labId: string, lotId: string): string {
  const seed = `${labId}-${lotId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `CIQ-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
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
  tecnico:      'Técnico(a)',
  farmaceutico: 'Farmacêutico(a)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQRelatorioPrint({ lot, runs, onClose }: CIQRelatorioPrintProps) {
  const activeLab   = useActiveLab();
  const user        = useUser();
  const generatedAt = useMemo(() => new Date(), []);
  const code        = useMemo(() => auditCode(lot.labId, lot.id), [lot.labId, lot.id]);

  // ── Métricas ──────────────────────────────────────────────────────────────
  const sorted      = useMemo(
    () => [...runs].sort((a, b) => a.dataRealizacao.localeCompare(b.dataRealizacao)),
    [runs],
  );
  const totalRuns   = sorted.length;
  const aprovadas   = sorted.filter((r) => r.resultadoObtido === r.resultadoEsperado).length;
  const naoAprov    = totalRuns - aprovadas;
  const ncList      = sorted.filter((r) => r.resultadoObtido !== r.resultadoEsperado);
  const taxaAprov   = totalRuns > 0 ? ((aprovadas / totalRuns) * 100).toFixed(1) : '—';
  const allAlerts   = [...new Set(sorted.flatMap((r) => r.westgardCategorico ?? []))];

  // Fabricante e equipamento (do primeiro run — consistente por lote na maioria dos casos)
  const firstRun      = sorted[0];
  const fabControle   = firstRun?.fabricanteControle ?? '—';
  const fabReagente   = firstRun?.fabricanteReagente ?? '—';

  // Decisão formal
  const decisionLabel =
    lot.ciqDecision === 'A'        ? 'Aprovado' :
    lot.ciqDecision === 'Rejeitado' ? 'Reprovado' :
                                     'Pendente';
  const decisionColor =
    lot.ciqDecision === 'A'        ? '#059669' :
    lot.ciqDecision === 'Rejeitado' ? '#dc2626' :
                                     '#9ca3af';

  // ── Auto-print ────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [onClose]);

  return (
    <>
      {/* ── Print styles ──────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body > *:not(#ciq-print-root) { display: none !important; }
          #ciq-print-root { display: block !important; }
          @page { size: A4; margin: 15mm 14mm; }
          .no-print { display: none !important; }
          .print-avoid-break { break-inside: avoid; }
        }
        @media screen {
          #ciq-print-root {
            position: fixed; inset: 0; z-index: 9999;
            background: white; overflow-y: auto;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
        }
        #ciq-print-root * { box-sizing: border-box; }
        #ciq-print-root table { border-collapse: collapse; width: 100%; }
        #ciq-print-root th, #ciq-print-root td {
          border: 1px solid #e5e7eb;
          padding: 5px 7px;
          text-align: left;
          vertical-align: top;
        }
        #ciq-print-root thead th { background: #f9fafb; }
        #ciq-print-root .nc-row td { background: #fff1f2; }
        #ciq-print-root .mono { font-family: 'Courier New', monospace; }
      `}</style>

      <div id="ciq-print-root">

        {/* ── Screen controls — ocultos na impressão ─────────────────────── */}
        <div className="no-print" style={{
          position: 'fixed', top: 16, right: 16, zIndex: 10001,
          display: 'flex', gap: 8,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', background: '#f3f4f6',
              border: '1px solid #e5e7eb', borderRadius: 8,
              cursor: 'pointer', fontSize: 13, color: '#374151',
            }}
          >
            ✕ Fechar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              padding: '8px 16px', background: '#059669', color: 'white',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Imprimir / Salvar PDF
          </button>
        </div>

        {/* ── Conteúdo imprimível ──────────────────────────────────────────── */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', color: '#111827' }}>

          {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            borderBottom: '2px solid #111827', paddingBottom: 12, marginBottom: 20,
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: 2, color: '#6b7280', marginBottom: 4 }}>
                Registro de Controle Interno de Qualidade · FR-036 · RDC 978/2025 ANVISA
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                {activeLab?.name ?? 'Laboratório'}
              </div>
              {activeLab?.cnpj && (
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                  CNPJ: {activeLab.cnpj}
                </div>
              )}
              {activeLab?.address && (
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {activeLab.address.city} — {activeLab.address.state}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 24 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 2 }}>Emitido por</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                {user?.displayName ?? user?.email ?? 'Operador'}
              </div>
              <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 6, marginBottom: 2 }}>Gerado em</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#374151' }}>
                {generatedAt.toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* ── Bloco do Lote ─────────────────────────────────────────────── */}
          <div className="print-avoid-break" style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: 1.5, color: '#6b7280', marginBottom: 8 }}>
              Identificação do Lote
            </div>
            <table style={{ fontSize: 10 }}>
              <tbody>
                <tr>
                  <th style={{ width: '16%', background: '#f9fafb' }}>Tipo de Teste</th>
                  <td style={{ width: '18%', fontWeight: 700 }}>{lot.testType}</td>
                  <th style={{ width: '16%', background: '#f9fafb' }}>Lote do Controle</th>
                  <td style={{ width: '18%', fontFamily: 'monospace' }}>{lot.loteControle}</td>
                  <th style={{ width: '16%', background: '#f9fafb' }}>Fabricante Controle</th>
                  <td style={{ width: '16%' }}>{fabControle}</td>
                </tr>
                <tr>
                  <th style={{ background: '#f9fafb' }}>Abertura Controle</th>
                  <td>{fmtDate(lot.aberturaControle)}</td>
                  <th style={{ background: '#f9fafb' }}>Validade Controle</th>
                  <td>{fmtDate(lot.validadeControle)}</td>
                  <th style={{ background: '#f9fafb' }}>Fabricante Reagente</th>
                  <td>{fabReagente}</td>
                </tr>
                <tr>
                  <th style={{ background: '#f9fafb' }}>Total de Corridas</th>
                  <td><strong>{totalRuns}</strong></td>
                  <th style={{ background: '#f9fafb' }}>Decisão Formal (RT)</th>
                  <td style={{ color: decisionColor, fontWeight: 700 }}>{decisionLabel}</td>
                  <th style={{ background: '#f9fafb' }}>Westgard Status</th>
                  <td style={{
                    color: lot.lotStatus === 'reprovado' ? '#dc2626'
                         : lot.lotStatus === 'atencao'   ? '#d97706'
                         : lot.lotStatus === 'valido'    ? '#059669'
                         : '#9ca3af',
                    fontWeight: 600,
                  }}>
                    {lot.lotStatus === 'sem_dados' ? 'Sem dados'
                     : lot.lotStatus === 'valido'   ? 'Válido'
                     : lot.lotStatus === 'atencao'  ? 'Atenção'
                     :                               'Reprovado'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Barra de Resumo ───────────────────────────────────────────── */}
          <div className="print-avoid-break" style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: 1.5, color: '#6b7280', marginBottom: 8 }}>
              Resumo do Período
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
                          border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { label: 'Total de corridas',  value: String(totalRuns), color: '#111827' },
                { label: 'Aprovadas',           value: String(aprovadas), color: '#059669' },
                { label: 'Não aprovadas',       value: String(naoAprov),  color: naoAprov > 0 ? '#dc2626' : '#374151' },
                { label: 'Não conformes',       value: String(ncList.length), color: ncList.length > 0 ? '#d97706' : '#374151' },
                { label: 'Taxa de aprovação',   value: `${taxaAprov}%`,   color: '#4f46e5' },
              ].map(({ label, value, color }, i) => (
                <div key={label} style={{
                  padding: '10px 14px', textAlign: 'center',
                  borderLeft: i > 0 ? '1px solid #e5e7eb' : 'none',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tabela FR-036 Digital ─────────────────────────────────────── */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: 1.5, color: '#6b7280', marginBottom: 8 }}>
              Registro de Corridas (FR-036 Digital)
            </div>
            <table style={{ fontSize: 8.5 }}>
              <thead>
                <tr>
                  <th style={{ width: '7%',  textAlign: 'center' }}>ID Corrida</th>
                  <th style={{ width: '10%' }}>Data</th>
                  <th style={{ width: '6%',  textAlign: 'center' }}>Hora</th>
                  <th style={{ width: '9%' }}>Lote Reagente</th>
                  <th style={{ width: '9%' }}>Fab. Reagente</th>
                  <th style={{ width: '6%',  textAlign: 'center' }}>Esp.</th>
                  <th style={{ width: '6%',  textAlign: 'center' }}>Obt.</th>
                  <th style={{ width: '7%',  textAlign: 'center' }}>Aprovação</th>
                  <th style={{ width: '11%' }}>Operador</th>
                  <th style={{ width: '7%',  textAlign: 'center' }}>Cargo</th>
                  <th style={{ width: '10%' }}>Alertas Westgard</th>
                  <th style={{ width: '12%' }}>Ação Corretiva</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((run) => {
                  const conforme = run.resultadoObtido === run.resultadoEsperado;
                  const alerts   = (run.westgardCategorico ?? [])
                    .map((a) => ALERT_LABELS[a] ?? a);
                  const dateStr  = run.createdAt
                    ? fmtTsDateOnly(run.createdAt)
                    : fmtDate(run.dataRealizacao);
                  const timeStr  = run.createdAt ? fmtTsTimeOnly(run.createdAt) : '';

                  return (
                    <tr key={run.id} className={conforme ? '' : 'nc-row'}>
                      <td className="mono" style={{ textAlign: 'center', fontSize: 7.5 }}>
                        {run.runCode ?? '—'}
                      </td>
                      <td>{dateStr}</td>
                      <td style={{ textAlign: 'center', color: '#6b7280' }}>
                        {timeStr || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: 8 }}>{run.loteReagente}</td>
                      <td style={{ fontSize: 8 }}>
                        {run.fabricanteReagente ?? '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        {run.resultadoEsperado}
                      </td>
                      <td style={{
                        textAlign: 'center', fontWeight: 700,
                        color: conforme ? '#059669' : '#dc2626',
                      }}>
                        {run.resultadoObtido}
                      </td>
                      <td style={{
                        textAlign: 'center', fontWeight: 700,
                        color: conforme ? '#059669' : '#dc2626',
                      }}>
                        {conforme ? 'A' : 'NA'}
                      </td>
                      <td style={{ fontSize: 8 }}>{run.operatorName}</td>
                      <td style={{ fontSize: 7.5, color: '#6b7280' }}>
                        {CARGO_LABELS[run.operatorRole] ?? run.operatorRole}
                      </td>
                      <td style={{ fontSize: 7.5, color: alerts.length ? '#d97706' : '#9ca3af' }}>
                        {alerts.join('; ') || '—'}
                      </td>
                      <td style={{ fontSize: 7.5, color: run.acaoCorretiva ? '#374151' : '#9ca3af' }}>
                        {run.acaoCorretiva ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 4 }}>
              <strong>Legendas:</strong> Esp. = Resultado esperado · Obt. = Resultado obtido ·
              A = Aprovado · NA = Não aprovado · Linhas vermelhas = não conformidade
            </div>
          </div>

          {/* ── Não Conformidades (se houver) ─────────────────────────────── */}
          {ncList.length > 0 && (
            <div className="print-avoid-break" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: 1.5, color: '#dc2626', marginBottom: 8 }}>
                Não Conformidades — Detalhamento
              </div>
              <table style={{ fontSize: 8.5 }}>
                <thead>
                  <tr>
                    <th style={{ background: '#fff1f2' }}>ID Corrida</th>
                    <th style={{ background: '#fff1f2' }}>Data</th>
                    <th style={{ background: '#fff1f2' }}>Esp.</th>
                    <th style={{ background: '#fff1f2' }}>Obt.</th>
                    <th style={{ background: '#fff1f2' }}>Operador</th>
                    <th style={{ background: '#fff1f2' }}>Ação Corretiva</th>
                    <th style={{ background: '#fff1f2' }}>Alertas Westgard</th>
                  </tr>
                </thead>
                <tbody>
                  {ncList.map((run) => (
                    <tr key={run.id} style={{ background: '#fff8f8' }}>
                      <td className="mono" style={{ fontSize: 8 }}>{run.runCode ?? '—'}</td>
                      <td>{fmtDate(run.dataRealizacao)}</td>
                      <td style={{ textAlign: 'center' }}>{run.resultadoEsperado}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>
                        {run.resultadoObtido}
                      </td>
                      <td style={{ fontSize: 8 }}>{run.operatorName}</td>
                      <td style={{ fontSize: 8, color: run.acaoCorretiva ? '#374151' : '#dc2626', fontStyle: run.acaoCorretiva ? 'normal' : 'italic' }}>
                        {run.acaoCorretiva ?? 'SEM AÇÃO CORRETIVA REGISTRADA'}
                      </td>
                      <td style={{ fontSize: 7.5, color: '#d97706' }}>
                        {(run.westgardCategorico ?? []).map((a) => ALERT_LABELS[a] ?? a).join('; ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Alertas Westgard (se houver) ──────────────────────────────── */}
          {allAlerts.length > 0 && (
            <div className="print-avoid-break" style={{
              marginBottom: 18, padding: '10px 14px',
              border: '1px solid #fcd34d', borderRadius: 8, background: '#fffbeb',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: 1.5, color: '#92400e', marginBottom: 6 }}>
                Alertas de Qualidade (Westgard Categórico)
              </div>
              <ul style={{ margin: 0, paddingLeft: 14 }}>
                {allAlerts.map((a) => (
                  <li key={a} style={{ fontSize: 9, color: '#78350f', marginBottom: 2 }}>
                    {ALERT_LABELS[a] ?? a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Bloco de Auditoria ────────────────────────────────────────── */}
          <div className="print-avoid-break" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: 1.5, color: '#6b7280', marginBottom: 8 }}>
              Rastreabilidade
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 8,
            }}>
              {/* QR placeholder */}
              <div style={{ flexShrink: 0, width: 72, height: 72,
                            border: '1px solid #d1d5db', borderRadius: 6, padding: 4 }}>
                <svg width="64" height="64" viewBox="0 0 56 56" fill="none">
                  <rect x="2"  y="2"  width="16" height="16" rx="2" fill="none" stroke="#374151" strokeWidth="2" />
                  <rect x="5"  y="5"  width="10" height="10" rx="1" fill="#374151" />
                  <rect x="38" y="2"  width="16" height="16" rx="2" fill="none" stroke="#374151" strokeWidth="2" />
                  <rect x="41" y="5"  width="10" height="10" rx="1" fill="#374151" />
                  <rect x="2"  y="38" width="16" height="16" rx="2" fill="none" stroke="#374151" strokeWidth="2" />
                  <rect x="5"  y="41" width="10" height="10" rx="1" fill="#374151" />
                  {[20,23,26,29,32,35,38,20,26,32,38,23,29,35].map((x, i) => (
                    <rect key={i} x={x} y={20 + (i % 5) * 4} width="3" height="3" rx="0.5"
                      fill={code.charCodeAt(i % code.length) % 2 === 0 ? '#374151' : 'transparent'} />
                  ))}
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                              letterSpacing: 1.5, color: '#6b7280', marginBottom: 4 }}>
                  Código de Auditoria — RDC 978/2025 ANVISA
                </div>
                <div style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 700,
                              color: '#111827', letterSpacing: 2 }}>
                  {code}
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 4 }}>
                  Gerado em {generatedAt.toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <div style={{ fontSize: 8, color: '#d1d5db', marginTop: 2 }}>
                  Este código identifica unicamente este relatório para fins de rastreabilidade e auditoria regulatória.
                  Retenção mínima: 5 anos (ANVISA/RDC 978/2025).
                </div>
              </div>
            </div>
          </div>

          {/* ── Linha de assinaturas ──────────────────────────────────────── */}
          <div className="print-avoid-break" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 32, marginBottom: 24,
          }}>
            {['Responsável Técnico', 'Supervisor de Qualidade', 'Conferente'].map((role) => (
              <div key={role}>
                <div style={{ borderTop: '1px solid #374151', paddingTop: 6 }}>
                  <div style={{ fontSize: 8.5, color: '#374151', fontWeight: 600 }}>{role}</div>
                  <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 2 }}>
                    Assinatura / Carimbo
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Rodapé LGPD ──────────────────────────────────────────────── */}
          <footer style={{
            marginTop: 8, paddingTop: 12,
            borderTop: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
              background: '#f3f4f6', display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '1px solid #e5e7eb',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L2 4v4c0 4 2.5 6 6 7 3.5-1 6-3 6-7V4L8 1z"
                  stroke="#6b7280" strokeWidth="1.3" fill="none" />
                <path d="M5.5 8l2 2 3-3" stroke="#6b7280" strokeWidth="1.3"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: 1, color: '#6b7280', marginBottom: 3 }}>
                Aviso de Privacidade — LGPD (Lei 13.709/2018)
              </div>
              <div style={{ fontSize: 8, color: '#9ca3af', lineHeight: 1.5 }}>
                Este documento contém dados de controle de qualidade laboratorial processados em conformidade com
                a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei Federal 13.709/2018) e com a RDC 978/2025 da ANVISA.
                Os dados pessoais presentes neste relatório (operador, laboratório) são tratados exclusivamente para fins
                de rastreabilidade, controle de qualidade e cumprimento de obrigações regulatórias.
                O acesso a este documento deve ser restrito a profissionais autorizados.
                Retenção documental conforme exigência ANVISA: mínimo 5 anos.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            marginTop: 6, paddingTop: 6, borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 7, color: '#d1d5db' }}>
                  Sistema CQ LabClin · CIQ-Imuno · RDC 978/2025 compliant
                </div>
                <div style={{ fontSize: 7, color: '#d1d5db' }}>
                  Gerado em: {generatedAt.toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}
