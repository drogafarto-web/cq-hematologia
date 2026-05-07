import React, { useState, useMemo } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';

/**
 * AuditTrailView — Trilha de eventos auditados com assinatura criptográfica
 *
 * Layout: sidebar (persistent filters) + main (AuditTrailList)
 * Scope: RDC 978 5.3 + DICQ 4.4 — event log com chainHash
 */
export function AuditTrailView() {
  const labId = useActiveLabId();

  // Sidebar filters
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [selectedResult, setSelectedResult] = useState<string>('');

  if (!labId) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <p>Lab não ativo</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      {/* ─── Left Sidebar (250px) ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-white/[0.06] bg-[#141417] p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-1">Filtros</h2>
          <p className="text-xs text-white/40">Refine a trilha de eventos</p>
        </div>

        {/* Module Filter */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-white/60 uppercase mb-3 tracking-wider">
            Módulo
          </label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
          >
            <option value="">Todos os módulos</option>
            <option value="analyzer">Hematologia</option>
            <option value="coagulacao">Coagulação</option>
            <option value="uroanalise">Uroanálise</option>
            <option value="ciq-imuno">CIQ-Imuno</option>
            <option value="bioquimica">Bioquímica</option>
            <option value="controle-temperatura">Controle de Temperatura</option>
            <option value="sgq">SGQ</option>
            <option value="turnos">Turnos</option>
            <option value="risks">Riscos</option>
          </select>
        </div>

        {/* Operator Filter */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-white/60 uppercase mb-3 tracking-wider">
            Operador
          </label>
          <select
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
          >
            <option value="">Todos os operadores</option>
            <option value="user1">João Silva</option>
            <option value="user2">Maria Santos</option>
            <option value="user3">Pedro Oliveira</option>
          </select>
        </div>

        {/* Result Filter */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-white/60 uppercase mb-3 tracking-wider">
            Resultado
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="result"
                value=""
                checked={selectedResult === ''}
                onChange={(e) => setSelectedResult(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm text-white/70">Todos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="result"
                value="success"
                checked={selectedResult === 'success'}
                onChange={(e) => setSelectedResult(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm text-emerald-400">Sucesso</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="result"
                value="error"
                checked={selectedResult === 'error'}
                onChange={(e) => setSelectedResult(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm text-red-400">Erro</span>
            </label>
          </div>
        </div>

        {/* Clear Filters */}
        <button
          onClick={() => {
            setSelectedModule('');
            setSelectedOperator('');
            setSelectedResult('');
          }}
          className="w-full py-2 px-3 text-xs font-medium text-white/60 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          Limpar filtros
        </button>
      </aside>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0B0F14]/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="mb-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-400/80">
                Conformidade
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Auditoria — Trilha de Eventos</h1>
            </div>
            <p className="text-sm text-white/40 mt-1">
              RDC 978 5.3 · DICQ 4.4 · Eventos com assinatura criptográfica (chainHash)
            </p>
          </div>
        </header>

        {/* Breadcrumb */}
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs text-white/40 flex gap-2">
          <span>Dashboard</span>
          <span>›</span>
          <span>Auditoria</span>
          <span>›</span>
          <span className="text-white/60">Trilha</span>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-6xl mx-auto px-6 py-6 w-full">
          <AuditTrailList
            module={selectedModule}
            operator={selectedOperator}
            result={selectedResult}
          />
        </div>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

interface AuditTrailListProps {
  module: string;
  operator: string;
  result: string;
}

/**
 * AuditTrailList — placeholder list component
 *
 * TODO: integrate with Firestore `/labs/{labId}/auditLogs` collection
 * - Real-time listener via `onSnapshot`
 * - Pagination (1000+ events expected)
 * - Signature verification UI
 */
function AuditTrailList({ module, operator, result }: AuditTrailListProps) {
  // Mock data for now
  const mockEvents = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 3600000),
      module: 'analyzer',
      operator: 'user1',
      action: 'create_run',
      result: 'success',
      signature: 'a1b2c3d4e5f6...',
      chainHash: 'prev: xyz789, current: abc123',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 7200000),
      module: 'coagulacao',
      operator: 'user2',
      action: 'approve_lot',
      result: 'success',
      signature: 'd7e8f9g0h1i2...',
      chainHash: 'prev: abc123, current: def456',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 10800000),
      module: 'sgq',
      operator: 'user1',
      action: 'update_doc',
      result: 'error',
      signature: 'j3k4l5m6n7o8...',
      chainHash: 'prev: def456, current: ghi789',
    },
  ];

  const filteredEvents = useMemo(() => {
    return mockEvents.filter((event) => {
      if (module && event.module !== module) return false;
      if (operator && event.operator !== operator) return false;
      if (result && event.result !== result) return false;
      return true;
    });
  }, [module, operator, result]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/60">
            {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} encontrado{filteredEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Event List */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-white/40">Nenhum evento corresponde aos filtros selecionados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Event Header */}
                  <div className="flex items-center gap-3 mb-2">
                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        event.result === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {event.result === 'success' ? '✓ Sucesso' : '✕ Erro'}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {event.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-white/40">
                      {event.timestamp.toLocaleString('pt-BR')}
                    </span>
                  </div>

                  {/* Event details */}
                  <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                    <div>
                      <span className="text-white/40">Módulo:</span>{' '}
                      <span className="text-white/70 font-medium">{event.module}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Operador:</span>{' '}
                      <span className="text-white/70 font-medium">{event.operator}</span>
                    </div>
                  </div>

                  {/* Signature verification */}
                  <div className="rounded bg-white/[0.02] border border-white/[0.04] p-3 space-y-1">
                    <div className="text-xs text-white/40">
                      <span>Assinatura:</span>{' '}
                      <code className="font-mono text-emerald-400/70">{event.signature}</code>
                    </div>
                    <div className="text-xs text-white/40">
                      <span>ChainHash:</span>{' '}
                      <code className="font-mono text-white/60 text-[10px]">{event.chainHash}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
