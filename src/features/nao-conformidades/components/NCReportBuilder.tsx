/**
 * NCReportBuilder.tsx
 *
 * Gerador de relatório de Não Conformidades — client-side.
 * Gera PDF via window.print() com layout otimizado para impressão.
 * Lê de ambas as coleções (naoConformidades + capa).
 *
 * RDC 978/2025 Art. 134 — Relatórios de indicadores
 * DICQ 4.14.7 — Documentação de indicadores de qualidade
 */

import React, { useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';

interface NCReportBuilderProps {
  labId: string;
}

type Periodo = '7d' | '30d' | '90d' | 'custom';

interface ReportData {
  total: number;
  abertas: number;
  fechadas: number;
  vencidas: number;
  porSetor: Record<string, number>;
  porOrigem: Record<string, number>;
  porPrioridade: Record<string, number>;
  itens: any[];
}

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

export function NCReportBuilder({ labId }: NCReportBuilderProps) {
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = useCallback((): [Date, Date] => {
    const end = new Date();
    const start = new Date();
    switch (periodo) {
      case '7d': start.setDate(end.getDate() - 7); break;
      case '30d': start.setDate(end.getDate() - 30); break;
      case '90d': start.setDate(end.getDate() - 90); break;
      case 'custom':
        return [new Date(customStart), new Date(customEnd)];
    }
    return [start, end];
  }, [periodo, customStart, customEnd]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      const [startDate, endDate] = getDateRange();

      // Fetch from both collections
      const [ncSnap, capaSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'labs', labId, 'naoConformidades'),
          where('deletadoEm', '==', null)
        )),
        getDocs(query(
          collection(db, 'labs', labId, 'capa'),
          where('deletadoEm', '==', null)
        )),
      ]);

      const allItems: any[] = [];

      ncSnap.docs.forEach((d) => {
        const data = d.data();
        const abertaEm = toDate(data.abertaEm);
        if (abertaEm && abertaEm >= startDate && abertaEm <= endDate) {
          allItems.push({
            id: d.id,
            titulo: data.titulo || data.codigo || 'NC sem título',
            descricao: data.descricao || '',
            setor: data.moduloOrigem || 'Não informado',
            origem: data.origem || 'Não informado',
            prioridade: data.severidade || 'moderada',
            status: data.capaStatus || 'nao_iniciada',
            abertaEm,
            source: 'naoConformidades',
          });
        }
      });

      capaSnap.docs.forEach((d) => {
        const data = d.data();
        const criadoEm = toDate(data.criadoEm);
        if (criadoEm && criadoEm >= startDate && criadoEm <= endDate) {
          allItems.push({
            id: d.id,
            titulo: data.titulo || 'CAPA sem título',
            descricao: data.descricao || '',
            setor: data.setor || 'Não informado',
            origem: data.origem || 'Não informado',
            prioridade: String(data.prioridade || 3),
            status: data.status || 'aberta',
            abertaEm: criadoEm,
            source: 'capa',
          });
        }
      });

      const isClosed = (s: string) => ['fechada', 'cancelada'].includes(s);
      const now = new Date();

      const porSetor: Record<string, number> = {};
      const porOrigem: Record<string, number> = {};
      const porPrioridade: Record<string, number> = {};

      allItems.forEach((item) => {
        porSetor[item.setor] = (porSetor[item.setor] || 0) + 1;
        porOrigem[item.origem] = (porOrigem[item.origem] || 0) + 1;
        porPrioridade[item.prioridade] = (porPrioridade[item.prioridade] || 0) + 1;
      });

      setReportData({
        total: allItems.length,
        abertas: allItems.filter((i) => !isClosed(i.status)).length,
        fechadas: allItems.filter((i) => isClosed(i.status)).length,
        vencidas: 0, // Would need prazoClosure check
        porSetor,
        porOrigem,
        porPrioridade,
        itens: allItems.sort((a, b) => b.abertaEm.getTime() - a.abertaEm.getTime()),
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  }, [labId, getDateRange]);

  const handlePrint = () => {
    window.print();
  };

  const INPUT_CLS = 'px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent';

  return (
    <div className="space-y-6">
      {/* Config — hidden on print */}
      <div className="print:hidden space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Relatório de Não Conformidades</h2>
          <p className="text-xs text-white/40 mt-1">Selecione o período e gere o relatório para impressão/PDF</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-white/60">Período</label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={INPUT_CLS}>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {periodo === 'custom' && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-white/60">De</label>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={INPUT_CLS} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/60">Até</label>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={INPUT_CLS} />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={generateReport}
            disabled={loading || (periodo === 'custom' && (!customStart || !customEnd))}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </button>

          {reportData && (
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded-lg transition-colors"
            >
              Imprimir / Salvar PDF
            </button>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-900/20 border border-red-700/30 rounded-lg">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}
      </div>

      {/* Report Content — visible on screen and print */}
      {reportData && (
        <div className="space-y-6 print:text-black print:bg-white" id="nc-report">
          {/* Header */}
          <div className="border-b border-white/10 print:border-black/20 pb-4">
            <h1 className="text-xl font-bold text-white print:text-black">
              Relatório de Não Conformidades
            </h1>
            <p className="text-xs text-white/50 print:text-gray-600 mt-1">
              Período: {getDateRange()[0].toLocaleDateString('pt-BR')} a {getDateRange()[1].toLocaleDateString('pt-BR')}
              {' | '}Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: reportData.total, color: 'text-white print:text-black' },
              { label: 'Abertas', value: reportData.abertas, color: 'text-red-400 print:text-red-600' },
              { label: 'Fechadas', value: reportData.fechadas, color: 'text-emerald-400 print:text-green-600' },
              { label: 'Vencidas', value: reportData.vencidas, color: 'text-amber-400 print:text-orange-600' },
            ].map((card) => (
              <div key={card.label} className="p-3 rounded-lg bg-white/[0.03] print:bg-gray-50 border border-white/[0.06] print:border-gray-200">
                <p className="text-[10px] text-white/40 print:text-gray-500 uppercase">{card.label}</p>
                <p className={`text-xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Distribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Por Setor */}
            <div className="p-4 rounded-lg bg-white/[0.02] print:bg-gray-50 border border-white/[0.06] print:border-gray-200">
              <p className="text-xs font-semibold text-white/70 print:text-gray-700 mb-2">Por Setor</p>
              {Object.entries(reportData.porSetor).sort((a, b) => b[1] - a[1]).map(([setor, count]) => (
                <div key={setor} className="flex justify-between text-xs py-1 border-b border-white/[0.04] print:border-gray-100 last:border-0">
                  <span className="text-white/60 print:text-gray-600">{setor}</span>
                  <span className="text-white/90 print:text-black font-medium tabular-nums">{count}</span>
                </div>
              ))}
              {Object.keys(reportData.porSetor).length === 0 && (
                <p className="text-xs text-white/30 print:text-gray-400">Nenhum dado</p>
              )}
            </div>

            {/* Por Origem */}
            <div className="p-4 rounded-lg bg-white/[0.02] print:bg-gray-50 border border-white/[0.06] print:border-gray-200">
              <p className="text-xs font-semibold text-white/70 print:text-gray-700 mb-2">Por Origem</p>
              {Object.entries(reportData.porOrigem).sort((a, b) => b[1] - a[1]).map(([origem, count]) => (
                <div key={origem} className="flex justify-between text-xs py-1 border-b border-white/[0.04] print:border-gray-100 last:border-0">
                  <span className="text-white/60 print:text-gray-600">{origem}</span>
                  <span className="text-white/90 print:text-black font-medium tabular-nums">{count}</span>
                </div>
              ))}
              {Object.keys(reportData.porOrigem).length === 0 && (
                <p className="text-xs text-white/30 print:text-gray-400">Nenhum dado</p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 print:border-gray-300">
                  <th className="text-left py-2 text-white/50 print:text-gray-500 font-medium">Data</th>
                  <th className="text-left py-2 text-white/50 print:text-gray-500 font-medium">Título</th>
                  <th className="text-left py-2 text-white/50 print:text-gray-500 font-medium">Setor</th>
                  <th className="text-left py-2 text-white/50 print:text-gray-500 font-medium">Origem</th>
                  <th className="text-left py-2 text-white/50 print:text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.itens.map((item) => (
                  <tr key={item.id} className="border-b border-white/[0.04] print:border-gray-100">
                    <td className="py-2 text-white/60 print:text-gray-600 whitespace-nowrap">
                      {item.abertaEm.toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 text-white/90 print:text-black max-w-[200px] truncate">
                      {item.titulo}
                    </td>
                    <td className="py-2 text-white/60 print:text-gray-600">{item.setor}</td>
                    <td className="py-2 text-white/60 print:text-gray-600">{item.origem}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        ['fechada', 'cancelada'].includes(item.status)
                          ? 'bg-emerald-500/20 text-emerald-300 print:bg-green-100 print:text-green-700'
                          : 'bg-amber-500/20 text-amber-300 print:bg-orange-100 print:text-orange-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportData.itens.length === 0 && (
              <p className="text-center text-white/30 print:text-gray-400 py-8 text-sm">
                Nenhuma NC encontrada no período selecionado
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 print:border-gray-200 text-[10px] text-white/30 print:text-gray-400">
            <p>Relatório gerado automaticamente pelo HC Quality — RDC 978/2025 Art. 134 | DICQ 4.14.7</p>
          </div>
        </div>
      )}
    </div>
  );
}
