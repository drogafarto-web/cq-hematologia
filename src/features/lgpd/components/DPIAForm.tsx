/**
 * DPIAForm Component — Admin form for Data Protection Impact Assessment
 *
 * Features:
 * - 5 sections: Dados Coletados, Fluxos de Dados, Riscos, Medidas, Histórico
 * - Version history display
 * - PDF export capability
 * - Dark-first design
 *
 * Soft-delete preservation: deletadoEm field handled by service
 * Chain-hash preservation: LogicalSignature fields preserved during updates
 */

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useDPIA } from '../hooks/useDPIA';
import { saveDPIA } from '../services/lgpdService';
import { exportDPIAToPDF } from '../utils/dpiaExport';
import type { DPIA, DPIADataColetada, DPIAFluxoDados, DPIARisco, DPIAMedida } from '../types';

interface DPIAFormProps {
  labId: string;
}

export function DPIAForm({ labId }: DPIAFormProps) {
  const { dpia, loading, error } = useDPIA(labId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form state (derived from dpia)
  const [datasColetadas, setDatasColetadas] = useState<DPIADataColetada[]>([]);
  const [fluxosDados, setFluxosDados] = useState<DPIAFluxoDados[]>([]);
  const [riscos, setRiscos] = useState<DPIARisco[]>([]);
  const [medidas, setMedidas] = useState<DPIAMedida[]>([]);
  const [responsavelDados, setResponsavelDados] = useState('');
  const [revisaoJuridica, setRevisaoJuridica] = useState(false);

  // Initialize form from DPIA
  useEffect(() => {
    if (dpia) {
      setDatasColetadas(dpia.datasColetadas || []);
      setFluxosDados(dpia.fluxosDados || []);
      setRiscos(dpia.riscos || []);
      setMedidas(dpia.medidas || []);
      setResponsavelDados(dpia.responsavelDados || '');
      setRevisaoJuridica(dpia.revisaoJuridica || false);
    }
  }, [dpia]);

  const handleSaveDPIA = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveDPIA(labId, {
        dataPreenchimento: Timestamp.now(),
        responsavelDados,
        datasColetadas,
        fluxosDados,
        riscos,
        medidas,
        revisaoJuridica,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar DPIA');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!dpia) return;
    setIsExporting(true);
    try {
      const blob = await exportDPIAToPDF(dpia);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DPIA_v${dpia.versao}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-pulse w-12 h-12 bg-white/10 rounded-lg mx-auto" />
          <p>Carregando DPIA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-red-400">Erro ao carregar DPIA</p>
          <p className="text-sm text-white/60">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141417] text-white/90">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#141417]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-semibold mb-2">Avaliação de Impacto à Proteção de Dados</h1>
              {dpia && (
                <p className="text-white/60">
                  Versão {dpia.versao} • Atualizado em{' '}
                  {dpia.atualizadoEm?.toDate().toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExportPDF}
                disabled={!dpia || isExporting}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? 'Exportando...' : 'Exportar PDF'}
              </button>
              <button
                onClick={handleSaveDPIA}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          {/* Messages */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-200">
              ✓ DPIA salva com sucesso
            </div>
          )}
          {saveError && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
              ✗ {saveError}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Responsável */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Responsável pelos Dados</h2>
          <input
            type="text"
            value={responsavelDados}
            onChange={(e) => setResponsavelDados(e.target.value)}
            placeholder="Nome ou cargo do responsável"
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
          />
        </section>

        {/* Dados Coletados */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Dados Coletados</h2>
          <div className="space-y-3">
            {datasColetadas.map((item, idx) => (
              <div key={idx} className="p-4 border border-white/10 rounded-lg space-y-3">
                <input
                  type="text"
                  value={item.campo}
                  onChange={(e) => {
                    const updated = [...datasColetadas];
                    updated[idx].campo = e.target.value;
                    setDatasColetadas(updated);
                  }}
                  placeholder="Campo (ex: nome, email)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={item.proposito}
                  onChange={(e) => {
                    const updated = [...datasColetadas];
                    updated[idx].proposito = e.target.value;
                    setDatasColetadas(updated);
                  }}
                  placeholder="Propósito"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={item.retencao}
                  onChange={(e) => {
                    const updated = [...datasColetadas];
                    updated[idx].retencao = e.target.value;
                    setDatasColetadas(updated);
                  }}
                  placeholder="Período de retenção (ex: 6 meses)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setDatasColetadas([...datasColetadas, { campo: '', proposito: '', retencao: '' }])
            }
            className="text-violet-400 hover:text-violet-300 text-sm font-medium"
          >
            + Adicionar dado
          </button>
        </section>

        {/* Fluxos de Dados */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Fluxos de Dados</h2>
          <div className="space-y-3">
            {fluxosDados.map((item, idx) => (
              <div key={idx} className="p-4 border border-white/10 rounded-lg space-y-3">
                <input
                  type="text"
                  value={item.entrada}
                  onChange={(e) => {
                    const updated = [...fluxosDados];
                    updated[idx].entrada = e.target.value;
                    setFluxosDados(updated);
                  }}
                  placeholder="Entrada (ex: Formulário web)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={item.processamento}
                  onChange={(e) => {
                    const updated = [...fluxosDados];
                    updated[idx].processamento = e.target.value;
                    setFluxosDados(updated);
                  }}
                  placeholder="Processamento"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={item.saida}
                  onChange={(e) => {
                    const updated = [...fluxosDados];
                    updated[idx].saida = e.target.value;
                    setFluxosDados(updated);
                  }}
                  placeholder="Saída (ex: Relatório PDF)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setFluxosDados([...fluxosDados, { entrada: '', processamento: '', saida: '' }])
            }
            className="text-violet-400 hover:text-violet-300 text-sm font-medium"
          >
            + Adicionar fluxo
          </button>
        </section>

        {/* Riscos */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Riscos Identificados</h2>
          <div className="space-y-3">
            {riscos.map((item, idx) => (
              <div key={idx} className="p-4 border border-white/10 rounded-lg space-y-3">
                <select
                  value={item.tipo}
                  onChange={(e) => {
                    const updated = [...riscos];
                    updated[idx].tipo = e.target.value as any;
                    setRiscos(updated);
                  }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">Selecione tipo</option>
                  <option value="conformidade">Conformidade</option>
                  <option value="seguranca">Segurança</option>
                  <option value="reputacao">Reputação</option>
                </select>
                <input
                  type="text"
                  value={item.descricao}
                  onChange={(e) => {
                    const updated = [...riscos];
                    updated[idx].descricao = e.target.value;
                    setRiscos(updated);
                  }}
                  placeholder="Descrição do risco"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={item.probabilidade}
                    onChange={(e) => {
                      const updated = [...riscos];
                      updated[idx].probabilidade = e.target.value as any;
                      setRiscos(updated);
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Probabilidade</option>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                  <select
                    value={item.impacto}
                    onChange={(e) => {
                      const updated = [...riscos];
                      updated[idx].impacto = e.target.value as any;
                      setRiscos(updated);
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Impacto</option>
                    <option value="baixo">Baixo</option>
                    <option value="medio">Médio</option>
                    <option value="alto">Alto</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setRiscos([
                ...riscos,
                {
                  tipo: 'conformidade',
                  descricao: '',
                  probabilidade: 'baixa',
                  impacto: 'baixo',
                },
              ])
            }
            className="text-violet-400 hover:text-violet-300 text-sm font-medium"
          >
            + Adicionar risco
          </button>
        </section>

        {/* Medidas */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Medidas de Mitigação</h2>
          <div className="space-y-3">
            {medidas.map((item, idx) => (
              <div key={idx} className="p-4 border border-white/10 rounded-lg space-y-3">
                <input
                  type="text"
                  value={item.medida}
                  onChange={(e) => {
                    const updated = [...medidas];
                    updated[idx].medida = e.target.value;
                    setMedidas(updated);
                  }}
                  placeholder="Medida"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={item.responsavel}
                  onChange={(e) => {
                    const updated = [...medidas];
                    updated[idx].responsavel = e.target.value;
                    setMedidas(updated);
                  }}
                  placeholder="Responsável"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={item.prazo}
                  onChange={(e) => {
                    const updated = [...medidas];
                    updated[idx].prazo = e.target.value;
                    setMedidas(updated);
                  }}
                  placeholder="Prazo (ex: 30 dias)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setMedidas([...medidas, { medida: '', responsavel: '', prazo: '' }])
            }
            className="text-violet-400 hover:text-violet-300 text-sm font-medium"
          >
            + Adicionar medida
          </button>
        </section>

        {/* Revisão Jurídica */}
        <section className="space-y-4 p-4 border border-white/10 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={revisaoJuridica}
              onChange={(e) => setRevisaoJuridica(e.target.checked)}
              className="w-5 h-5 rounded bg-white/10 border border-white/20 cursor-pointer accent-violet-500"
            />
            <span>Revisão jurídica aprovada</span>
          </label>
        </section>

        {/* Version History */}
        {dpia && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Histórico de Versões</h2>
            <div className="space-y-2 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex justify-between">
                <span>Versão {dpia.versao}</span>
                <span className="text-white/60">
                  {dpia.atualizadoEm?.toDate().toLocaleDateString('pt-BR')}
                </span>
              </div>
              {dpia.dataAprovacao && (
                <div className="text-sm text-emerald-400">
                  ✓ Aprovada em {dpia.dataAprovacao.toDate().toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default DPIAForm;
