/**
 * EquipamentoDetail - hub central do equipamento com abas.
 *
 * Abas: Resumo | Documentos | Manutencao | Calibracao | CIQ | Qualificacao
 * Integra todos os modulos que conversam com o equipamento.
 */

import React, { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';

import type { Equipamento } from '../types/Equipamento';
import { useCalibracaoStatus } from '../hooks/useCalibracaoStatus';
import type { CalibracaoStatus } from '../hooks/useCalibracaoStatus';
import { CalibracaoBadge } from './CalibracaoBadge';
import { ManutencaoList } from './ManutencaoList';
import { ManutencaoFormModal } from './ManutencaoFormModal';
import { DocumentosList } from './DocumentosList';
import { DocumentoUploadModal } from './DocumentoUploadModal';
import { QualificacaoTimeline } from './QualificacaoTimeline';
import { functions } from '../../../shared/services/firebase';

const callGenerateEquipamentoReport = httpsCallable<
  { labId: string; equipamentoId: string },
  { url: string }
>(functions, 'generateEquipamentoReport');

type TabId = 'resumo' | 'documentos' | 'manutencao' | 'calibracao' | 'qualificacao';

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'manutencao', label: 'Manutencao' },
  { id: 'calibracao', label: 'Calibracao' },
  { id: 'qualificacao', label: 'Qualificacao' },
];

export interface EquipamentoDetailProps {
  equipamento: Equipamento;
}

const FREQ_LABEL: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export function EquipamentoDetail({ equipamento }: EquipamentoDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('resumo');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManutencaoForm, setShowManutencaoForm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const proximaCalibracao = equipamento.proximaCalibracao;
  const { calibracaoStatus } = useCalibracaoStatus(proximaCalibracao);

  const handleExportReport = useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      const { data } = await callGenerateEquipamentoReport({
        labId: equipamento.labId,
        equipamentoId: equipamento.id,
      });
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar relatorio.';
      setExportError(msg);
    } finally {
      setExporting(false);
    }
  }, [equipamento.id, equipamento.labId]);

  return (
    <div className="space-y-4">
      {/* Header com status badges */}
      <div className="flex flex-wrap items-center gap-2">
        {equipamento.ciqPendenteAposManutencao && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            CIQ pendente apos manutencao
          </span>
        )}
        {equipamento.ciqPendenteAposCalibracao && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            CIQ pendente apos calibracao
          </span>
        )}
        {proximaCalibracao && <CalibracaoBadge calibracaoStatus={calibracaoStatus} />}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void handleExportReport()}
          disabled={exporting}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.12] dark:bg-[#141417] dark:text-white/90 dark:hover:bg-white/[0.06]"
        >
          {exporting ? 'Gerando...' : 'Exportar relatorio'}
        </button>
      </div>
      {exportError && <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500 bg-violet-500/5'
                : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === 'resumo' && <TabResumo equipamento={equipamento} />}
        {activeTab === 'documentos' && (
          <>
            <DocumentosList
              labId={equipamento.labId}
              equipamentoId={equipamento.id}
              onUploadClick={() => setShowUploadModal(true)}
            />
            {showUploadModal && (
              <DocumentoUploadModal
                labId={equipamento.labId}
                equipamentoId={equipamento.id}
                onClose={() => setShowUploadModal(false)}
              />
            )}
          </>
        )}
        {activeTab === 'manutencao' && (
          <div className="space-y-3">
            {equipamento.ciqPendenteAposManutencao && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  RDC 978 Art. 183 - Execute o Controle Interno de Qualidade (CIQ) antes de liberar
                  este equipamento para a rotina.
                </p>
              </div>
            )}
            <ProximaManutencaoAlerta equipamento={equipamento} />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManutencaoForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Registrar manutencao
              </button>
            </div>
            <ManutencaoList
              labId={equipamento.labId}
              equipamentoId={equipamento.id}
              omitCalibracaoBadge
            />
            {showManutencaoForm && (
              <ManutencaoFormModal
                labId={equipamento.labId}
                equipamentoId={equipamento.id}
                onClose={() => setShowManutencaoForm(false)}
              />
            )}
          </div>
        )}
        {activeTab === 'calibracao' && (
          <TabCalibracao equipamento={equipamento} calibracaoStatus={calibracaoStatus} />
        )}
        {activeTab === 'qualificacao' && (
          <QualificacaoTimeline labId={equipamento.labId} equipamentoId={equipamento.id} />
        )}
      </div>
    </div>
  );
}

// ─── Tab Resumo ─────────────────────────────────────────────────────────────

function TabResumo({ equipamento }: { equipamento: Equipamento }) {
  const e = equipamento;

  const fields: { label: string; value: string | undefined | null }[] = [
    { label: 'Modelo', value: e.modelo },
    { label: 'Fabricante', value: e.fabricante },
    { label: 'N Serie', value: e.numeroSerie },
    { label: 'Registro ANVISA', value: e.registroAnvisa },
    { label: 'Patrimonio/TAG', value: e.patrimonio },
    { label: 'Localizacao', value: e.localizacao },
    { label: 'Data Instalacao', value: e.dataInstalacao?.toDate?.().toLocaleDateString('pt-BR') },
    { label: 'Ano Fabricacao', value: e.anoFabricacao?.toString() },
    { label: 'Ano Aquisicao', value: e.anoAquisicao?.toString() },
    {
      label: 'Freq. Manutencao',
      value: e.frequenciaManutencao ? FREQ_LABEL[e.frequenciaManutencao] : undefined,
    },
    {
      label: 'Freq. Calibracao',
      value: e.frequenciaCalibracao ? FREQ_LABEL[e.frequenciaCalibracao] : undefined,
    },
    { label: 'Responsavel Tecnico', value: e.responsavelTecnicoNome },
  ];

  return (
    <div className="space-y-4">
      {/* Dados cadastrais */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map((f) => (
          <div
            key={f.label}
            className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05]"
          >
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/25 font-medium">
              {f.label}
            </p>
            <p className="text-sm text-slate-800 dark:text-white/75 mt-0.5 truncate">
              {f.value || <span className="text-slate-300 dark:text-white/15">-</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Contrato de manutencao */}
      {e.contratoManutencao && (
        <div className="p-3 rounded-xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08]">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30 mb-2">
            Contrato de Manutencao
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 dark:text-white/35">N:</span>{' '}
              {e.contratoManutencao.numero}
            </div>
            <div>
              <span className="text-slate-500 dark:text-white/35">Empresa:</span>{' '}
              {e.contratoManutencao.empresa}
            </div>
            <div>
              <span className="text-slate-500 dark:text-white/35">Inicio:</span>{' '}
              {e.contratoManutencao.vigenciaInicio?.toDate?.().toLocaleDateString('pt-BR')}
            </div>
            <div>
              <span className="text-slate-500 dark:text-white/35">Fim:</span>{' '}
              {e.contratoManutencao.vigenciaFim?.toDate?.().toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      )}

      {/* Condicoes ambientais */}
      {e.condicoesAmbientais && (
        <div className="p-3 rounded-xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08]">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30 mb-2">
            Condicoes Ambientais Requeridas
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs text-slate-700 dark:text-white/60">
            {(e.condicoesAmbientais.temperaturaMin != null ||
              e.condicoesAmbientais.temperaturaMax != null) && (
              <div>
                Temp: {e.condicoesAmbientais.temperaturaMin ?? '?'} -{' '}
                {e.condicoesAmbientais.temperaturaMax ?? '?'} C
              </div>
            )}
            {(e.condicoesAmbientais.umidadeMin != null ||
              e.condicoesAmbientais.umidadeMax != null) && (
              <div>
                Umidade: {e.condicoesAmbientais.umidadeMin ?? '?'} -{' '}
                {e.condicoesAmbientais.umidadeMax ?? '?'}%
              </div>
            )}
            {e.condicoesAmbientais.voltagem && (
              <div>Voltagem: {e.condicoesAmbientais.voltagem}</div>
            )}
          </div>
        </div>
      )}

      {/* Observacoes */}
      {e.observacoes && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05]">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30 mb-1">
            Observacoes
          </p>
          <p className="text-xs text-slate-600 dark:text-white/50 whitespace-pre-wrap">
            {e.observacoes}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab Calibracao ─────────────────────────────────────────────────────────

function TabCalibracao({
  equipamento,
  calibracaoStatus,
}: {
  equipamento: Equipamento;
  calibracaoStatus: CalibracaoStatus;
}) {
  const [showForm, setShowForm] = useState(false);
  const [proximaData, setProximaData] = useState('');
  const [certificadoUrl, setCertificadoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveCalib = async () => {
    if (!proximaData) return;
    setSaving(true);
    try {
      const { updateDoc, doc, getFirestore, Timestamp } = await import('firebase/firestore');
      const db = getFirestore();
      const ref = doc(db, 'labs', equipamento.labId, 'equipamentos', equipamento.id);
      await updateDoc(ref, {
        proximaCalibracao: Timestamp.fromDate(new Date(proximaData + 'T12:00:00')),
        ...(certificadoUrl.trim() && { certificadoCalibracaoUrl: certificadoUrl.trim() }),
        ciqPendenteAposCalibracao: true,
        calibracaoStatus: 'em_dia',
      });
      setShowForm(false);
      setProximaData('');
      setCertificadoUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const proximaCalibracao = equipamento.proximaCalibracao;

  return (
    <div className="space-y-3">
      {equipamento.ciqPendenteAposCalibracao && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Execute o CIQ apos calibracao para verificar o desempenho do equipamento.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Registrar calibracao
        </button>
      </div>

      {showForm && (
        <div className="p-4 rounded-xl bg-white dark:bg-[#0F1318] border border-violet-200 dark:border-violet-500/20 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-white/70">Nova calibracao</p>
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-white/40 mb-1">
              Proxima calibracao *
            </label>
            <input
              type="date"
              value={proximaData}
              onChange={(e) => setProximaData(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-sm text-slate-900 dark:text-white/90"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-white/40 mb-1">
              URL do certificado (opcional)
            </label>
            <input
              type="text"
              value={certificadoUrl}
              onChange={(e) => setCertificadoUrl(e.target.value)}
              placeholder="Cole o link ou use a aba Documentos para upload"
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-sm text-slate-900 dark:text-white/90"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSaveCalib()}
              disabled={!proximaData || saving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-40"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {proximaCalibracao ? (
        <div className="rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30">
            Proxima Calibracao
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white/90 mt-1">
            {proximaCalibracao.toDate().toLocaleDateString('pt-BR')}
          </p>
          <div className="mt-2">
            <CalibracaoBadge calibracaoStatus={calibracaoStatus} />
          </div>
          {equipamento.certificadoCalibracaoUrl && (
            <a
              href={equipamento.certificadoCalibracaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              Ver certificado
            </a>
          )}
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl">
          <p className="text-sm text-slate-400 dark:text-white/25">
            Nenhuma calibracao registrada.
          </p>
          <p className="text-xs text-slate-400 dark:text-white/20 mt-1">
            Use o botao acima para registrar a proxima calibracao.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Alerta de Proxima Manutencao Preventiva ────────────────────────────────

const FREQ_DAYS: Record<string, number> = {
  mensal: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

function ProximaManutencaoAlerta({ equipamento }: { equipamento: Equipamento }) {
  const freq = equipamento.frequenciaManutencao;
  if (!freq) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-white/[0.12] bg-slate-50 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <span className="text-base">&#x2139;&#xFE0F;</span>
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-white/50">
              Frequencia de manutencao preventiva nao configurada
            </p>
            <p className="text-[11px] text-slate-400 dark:text-white/30">
              Edite o equipamento e preencha &quot;Frequencia Manutencao Preventiva&quot; na secao
              DICQ para ativar alertas automaticos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const diasIntervalo = FREQ_DAYS[freq] || 0;
  if (!diasIntervalo) return null;

  const dataInstalacao = equipamento.dataInstalacao;
  const createdAt = equipamento.createdAt;

  let baseDate: Date | null = null;
  if (dataInstalacao) {
    baseDate = dataInstalacao.toDate();
  } else if (createdAt) {
    baseDate = createdAt.toDate();
  }

  if (!baseDate) return null;

  const now = new Date();
  const msSinceBase = now.getTime() - baseDate.getTime();
  const daysSinceBase = Math.floor(msSinceBase / (1000 * 60 * 60 * 24));
  const diasRestantes = diasIntervalo - (daysSinceBase % diasIntervalo);

  const proximaData = new Date(now.getTime() + diasRestantes * 24 * 60 * 60 * 1000);

  let alertStyle = 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08]';
  let textStyle = 'text-slate-600 dark:text-white/50';
  let iconText = '\u{1F4C5}';

  if (diasRestantes <= 7) {
    alertStyle = 'bg-red-500/10 border-red-500/20';
    textStyle = 'text-red-700 dark:text-red-300';
    iconText = '\u{1F6A8}';
  } else if (diasRestantes <= 30) {
    alertStyle = 'bg-amber-500/10 border-amber-500/20';
    textStyle = 'text-amber-700 dark:text-amber-300';
    iconText = '⚠️';
  }

  return (
    <div className={`p-3 rounded-xl border ${alertStyle}`}>
      <div className="flex items-center gap-2">
        <span>{iconText}</span>
        <div>
          <p className={`text-xs font-medium ${textStyle}`}>
            Proxima manutencao preventiva ({FREQ_LABEL[freq]}):{' '}
            {proximaData.toLocaleDateString('pt-BR')}
          </p>
          <p className={`text-[11px] ${textStyle} opacity-70`}>
            {diasRestantes <= 0 ? 'Manutencao preventiva VENCIDA' : `Faltam ${diasRestantes} dias`}
          </p>
        </div>
      </div>
    </div>
  );
}
