import React, { useEffect, useState, useMemo } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useSessao } from '../hooks/useAuditorias';
import { ChecklistItemCard } from './ChecklistItemCard';
import {
  ChevronLeft,
  Save,
  CheckCircle,
  Wifi,
  WifiOff,
  Menu,
  X,
  BookOpen,
  FileCheck,
} from 'lucide-react';

interface SessaoExecucaoPanelProps {
  auditoriaId: string;
  sessaoId: string;
  onBack: () => void;
}

interface ChecklistResponse {
  resposta: string;
  severidade?: string;
  timestamp: number;
}

const BLOCO_LABELS: Record<string, string> = {
  A: 'Doc. Legal',
  B: 'Contratos',
  C: 'Tecnologia',
  D: 'Gestão',
  E: 'Infraestrutura',
  F: 'Pré-Analítica',
  G: 'Analítica',
  H: 'Pós-Analítica',
  I: 'Informática',
  J: 'Qualidade',
};

export function SessaoExecucaoPanel({ auditoriaId, sessaoId, onBack }: SessaoExecucaoPanelProps) {
  const labId = useActiveLabId();
  const { sessao, checklistItems, isLoading } = useSessao(auditoriaId, sessaoId);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [draftResponses, setDraftResponses] = useState<Record<string, ChecklistResponse>>({});

  // Navigation State
  const [activeBloco, setActiveBloco] = useState<string>('A');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Group items by bloco
  const itemsByBloco = useMemo(() => {
    const groups: Record<string, typeof checklistItems> = {};
    checklistItems.forEach((item) => {
      const b = item.bloco || 'A';
      if (!groups[b]) groups[b] = [];
      groups[b].push(item);
    });
    return groups;
  }, [checklistItems]);

  const blocos = useMemo(() => Object.keys(itemsByBloco).sort(), [itemsByBloco]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(`sessao-${sessaoId}-draft`);
    if (draft) {
      try {
        setDraftResponses(JSON.parse(draft));
      } catch (e) {
        console.error('Failed to parse draft:', e);
      }
    }
  }, [sessaoId]);

  // Persist draft responses
  useEffect(() => {
    localStorage.setItem(`sessao-${sessaoId}-draft`, JSON.stringify(draftResponses));
  }, [draftResponses, sessaoId]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleItemResponse = (itemId: string, resposta: string, severidade?: string) => {
    setDraftResponses((prev) => ({
      ...prev,
      [itemId]: { resposta, severidade, timestamp: Date.now() },
    }));
  };

  const handleComplete = async () => {
    if (!labId) {
      alert('Lab não ativo');
      return;
    }
    console.log('Complete session:', draftResponses);
    alert('Sessão finalizada e sincronizada com sucesso!');
    onBack();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-spin w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm font-medium animate-pulse">Carregando checklist...</p>
        </div>
      </div>
    );
  }

  const currentItems = itemsByBloco[activeBloco] || [];
  const totalCompleted = Object.keys(draftResponses).length;
  const totalCount = checklistItems.length;

  return (
    <div className="min-h-screen bg-[#0f0f12] text-white/90 flex overflow-hidden">
      {/* Sidebar Navigation */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#141417] border-r border-white/10 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-violet-400" />
              <h3 className="font-bold text-lg">Módulos DICQ</h3>
            </div>
            <p className="text-xs text-white/40 uppercase tracking-widest font-black">
              Plataforma de Auditoria
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {blocos.map((b) => {
              const blockItems = itemsByBloco[b];
              const completed = blockItems.filter((i) => draftResponses[i.id]).length;
              const total = blockItems.length;
              const isSelected = activeBloco === b;

              return (
                <button
                  key={b}
                  onClick={() => {
                    setActiveBloco(b);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full text-left p-4 rounded-2xl transition-all duration-200 group
                    ${isSelected ? 'bg-violet-600 shadow-lg shadow-violet-600/20' : 'hover:bg-white/5'}
                  `}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-white/70'}`}
                    >
                      Bloco {b}
                    </span>
                    <span
                      className={`text-[10px] font-black ${isSelected ? 'text-white/60' : 'text-white/30'}`}
                    >
                      {completed}/{total}
                    </span>
                  </div>
                  <p
                    className={`text-xs truncate mb-2 ${isSelected ? 'text-white/80' : 'text-white/40'}`}
                  >
                    {BLOCO_LABELS[b] || 'Seção'}
                  </p>
                  <div className="h-1 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${isSelected ? 'bg-white' : 'bg-violet-500'}`}
                      style={{ width: `${(completed / total) * 100}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleComplete}
              disabled={totalCompleted < totalCount}
              className={`
                w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all
                ${
                  totalCompleted >= totalCount
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }
              `}
            >
              <FileCheck className="w-5 h-5" />
              Finalizar Auditoria
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0f0f12]">
        {/* Top Header */}
        <header className="h-20 bg-[#141417]/80 backdrop-blur-md border-b border-white/10 px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              onClick={onBack}
              className="hidden sm:flex items-center gap-2 text-white/40 hover:text-white transition group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Sair</span>
            </button>
            <div className="h-8 w-px bg-white/10 hidden sm:block mx-2" />
            <div>
              <h2 className="text-lg font-bold">Bloco {activeBloco}</h2>
              <p className="text-xs text-white/40 font-medium">{BLOCO_LABELS[activeBloco]}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-black">
                Progresso Geral
              </span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500"
                    style={{ width: `${(totalCompleted / totalCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-black">
                  {Math.round((totalCompleted / totalCount) * 100)}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400" title="Online">
                  <Wifi className="w-4 h-4" />
                </div>
              ) : (
                <div
                  className="p-2 rounded-xl bg-amber-500/10 text-amber-400"
                  title="Offline - Sincronização Local"
                >
                  <WifiOff className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Checklist */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {currentItems.map((item, index) => (
              <div
                key={item.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <ChecklistItemCard
                  item={item}
                  response={draftResponses[item.id]}
                  onChange={handleItemResponse}
                  labId={labId || undefined}
                  auditoriaId={auditoriaId}
                  sessaoId={sessaoId}
                  indicadorId={item.numeroDICQ}
                />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
