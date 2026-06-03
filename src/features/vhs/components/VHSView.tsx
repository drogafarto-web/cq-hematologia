import { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useActiveLab, useActiveLabId } from '../../../store/useAuthStore';
import { useTheme } from '../../../shared/hooks/useTheme';
import { VHSExamForm } from './VHSExamForm';
import { VHSExamList } from './VHSExamList';
import { VHSDualVerification } from './VHSDualVerification';
import type { VHSExam, VHSStatus } from '../types/VHSExam';

type MainTab = 'novo' | 'exames';

export function VHSView() {
  const goBack = useAppStore((s) => s.goBack);
  const activeLab = useActiveLab();
  const labId = useActiveLabId();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<MainTab>('novo');
  const [selectedExam, setSelectedExam] = useState<VHSExam | null>(null);
  const [listFilter, setListFilter] = useState<VHSStatus | 'todos'>('pendente');

  const wrapperBg = isDark ? 'bg-[#0c0c0e]' : 'bg-zinc-50';
  const textColor = isDark ? 'text-zinc-100' : 'text-zinc-900';

  return (
    <div className={`min-h-screen p-6 ${wrapperBg} ${textColor}`}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={goBack}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          aria-label="Voltar"
        >
          <span className="sr-only">Voltar</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold tracking-tight">
          VHS · Velocidade de Hemossedimentacao
        </h1>
      </div>

      {!activeLab ? (
        <div className="rounded-xl border border-zinc-800 bg-[#141417] p-8 text-center text-sm text-zinc-400">
          Selecione um laboratorio para acessar o modulo VHS.
        </div>
      ) : (
        <>
          {/* Tabs principais */}
          <div className="mb-6 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            {(
              [
                { key: 'novo', label: 'Novo exame' },
                { key: 'exames', label: 'Exames registrados' },
              ] as { key: MainTab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.key
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Conteudo */}
          {activeTab === 'novo' && (
            <VHSExamForm
              labId={labId!}
              onSuccess={() => {
                setActiveTab('exames');
              }}
            />
          )}

          {activeTab === 'exames' && (
            <div className="space-y-4">
              {/* Sub-tabs de filtro */}
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'todos', label: 'Todos' },
                    { key: 'pendente', label: 'Pendentes' },
                    { key: 'divergente', label: 'Divergentes' },
                    { key: 'liberado', label: 'Liberados' },
                  ] as { key: VHSStatus | 'todos'; label: string }[]
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setListFilter(f.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      listFilter === f.key
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <VHSExamList
                onSelectExam={(exam) => {
                  if (exam.status === 'pendente' || exam.status === 'divergente') {
                    setSelectedExam(exam);
                  }
                }}
                filterStatus={listFilter === 'todos' ? undefined : listFilter}
              />
            </div>
          )}

          {/* Modal / drawer de verificacao */}
          {selectedExam && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-12">
              <div className="relative w-full max-w-2xl rounded-xl border border-zinc-800 bg-[#141417] p-6 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setSelectedExam(null)}
                  className="absolute right-4 top-4 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Fechar"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <VHSDualVerification
                  exam={selectedExam}
                  labId={labId!}
                  onSuccess={() => {
                    setSelectedExam(null);
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VHSView;
