import { useState, useMemo } from 'react';
import { useTurnos } from '../hooks/useTurnos';
import { TurnoForm } from './TurnoForm';
import { TurnosList } from './TurnosList';
import { CoberturaReport } from './CoberturaReport';
import type { Turno } from '../types/Turno';

type Tab = 'lista' | 'cobertura';

export function TurnosView() {
  const { turnos, isLoading } = useTurnos();
  const [activeTab, setActiveTab] = useState<Tab>('lista');
  const [showForm, setShowForm] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<Turno | undefined>(undefined);

  const stats = useMemo(() => {
    const nonDeleted = turnos.filter((t) => !t.deletadoEm);
    const inferred = nonDeleted.filter((t) => t.inferred);
    return {
      total: nonDeleted.length,
      inferred: inferred.length,
      registered: nonDeleted.length - inferred.length,
    };
  }, [turnos]);

  const handleSelectTurno = (turno: Turno) => {
    setSelectedTurno(turno);
    setShowForm(true);
  };

  return (
    <div className="flex h-screen flex-col bg-slate-850 text-slate-100">
      {/* Topbar */}
      <div className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="text-emerald-400 hover:text-emerald-300"
              title="Voltar para Hub"
            >
              ← Hub
            </button>
            <h1 className="text-2xl font-semibold">Turnos e Supervisão</h1>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs font-medium text-slate-400">Total 90d</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.total}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs font-medium text-slate-400">Registrados</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.registered}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs font-medium text-slate-400">Inferidos (pendente)</p>
              <p className="text-2xl font-bold text-amber-400">{stats.inferred}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-4 border-b border-slate-700">
            <button
              onClick={() => setActiveTab('lista')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'lista'
                  ? 'border-b-2 border-emerald-500 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setActiveTab('cobertura')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'cobertura'
                  ? 'border-b-2 border-emerald-500 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cobertura (90 dias)
            </button>
          </div>

          {/* Create button */}
          <div className="mb-6">
            <button
              onClick={() => {
                setSelectedTurno(undefined);
                setShowForm(true);
              }}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + Novo Turno
            </button>
          </div>

          {/* Content */}
          {isLoading && turnos.length === 0 ? (
            <div className="text-center text-slate-400">Carregando...</div>
          ) : activeTab === 'lista' ? (
            <TurnosList onEdit={handleSelectTurno} />
          ) : (
            <CoberturaReport onSelectTurno={handleSelectTurno} />
          )}
        </div>
      </div>

      {/* Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full max-w-md border-t border-l border-slate-700 bg-slate-900 p-6 shadow-lg max-h-screen overflow-y-auto">
            <TurnoForm
              turnoId={selectedTurno?.id}
              onClose={() => {
                setShowForm(false);
                setSelectedTurno(undefined);
              }}
              onSuccess={() => {
                setShowForm(false);
                setSelectedTurno(undefined);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
