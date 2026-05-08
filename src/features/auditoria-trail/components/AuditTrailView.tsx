import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { AuditTrailList } from '../../qualidade/components/AuditTrailList';
import { ChainValidatorModal } from '../../qualidade/components/ChainValidatorModal';
import { AuditExportButton } from '../../qualidade/components/AuditExportButton';
import type { AuditTrailFilters } from '../../qualidade/types/auditUI';

/**
 * AuditTrailView — Trilha de eventos auditados com assinatura criptográfica
 *
 * Integrates:
 * - AuditTrailList: paginated table with filters
 * - ChainValidatorModal: real-time chain integrity validation
 * - AuditExportButton: CSV/PDF export with signature
 *
 * Scope: RDC 978 5.3 + DICQ 4.4 — immutable event log com chainHash
 */
export function AuditTrailView() {
  const labId = useActiveLabId();
  const [chainValidationOpen, setChainValidationOpen] = useState(false);
  const [filters, setFilters] = useState<AuditTrailFilters>({});

  if (!labId) {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-white/90 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-white/60">Lab não ativo</p>
          <p className="text-sm text-white/40 mt-1">Selecione um laboratório para continuar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F14]">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0B0F14]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="mb-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-400/80">
              Conformidade
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Auditoria — Trilha de Eventos</h1>
          </div>
          <p className="text-sm text-white/40 mt-1">
            RDC 978 Art. 5.3 · DICQ 4.4 — Eventos com assinatura criptográfica e validação de cadeia
          </p>
        </div>
      </header>

      {/* ─── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="max-w-6xl mx-auto px-6 py-3 text-xs text-white/40 flex gap-2" aria-label="Breadcrumb">
        <span>Dashboard</span>
        <span>›</span>
        <span>Auditoria</span>
        <span>›</span>
        <span className="text-white/60">Trilha de Eventos</span>
      </nav>

      {/* ─── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-4 w-full flex justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Verificação de Cadeia</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChainValidationOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center gap-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Verificar integridade da trilha de eventos"
            title="Validar cadeia de hashes da auditoria"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Verificar integridade
          </button>

          <AuditExportButton labId={labId} filters={filters} />
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-6 w-full">
        <AuditTrailList labId={labId} />
      </main>

      {/* ─── Chain Validator Modal ────────────────────────────────────────── */}
      <ChainValidatorModal
        open={chainValidationOpen}
        labId={labId}
        onClose={() => setChainValidationOpen(false)}
      />
    </div>
  );
}
