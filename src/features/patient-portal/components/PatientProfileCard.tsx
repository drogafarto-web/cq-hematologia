import React from 'react';
import { usePatientSessionCountdown } from '../hooks/usePatientSession';

interface PatientProfileCardProps {
  patientName: string;
  labName: string;
  onLogout: () => void;
  onSettings?: () => void;
}

/**
 * PatientProfileCard — Sidebar/header profile info
 *
 * Shows:
 * - Patient name
 * - Lab name
 * - Session expiry countdown (color warning: green → yellow → red)
 * - Logout button
 * - Settings link (TBD Phase 11+)
 *
 * RN-P02: Token expiry countdown updates every 10s
 * Warns user before session expires (< 5 mins = yellow)
 *
 * Usage:
 *   <PatientProfileCard
 *     patientName="João Silva"
 *     labName="Lab Clínico"
 *     onLogout={handleLogout}
 *   />
 */

export const PatientProfileCard = React.memo(function PatientProfileCard({
  patientName,
  labName,
  onLogout,
  onSettings,
}: PatientProfileCardProps) {
  const { remainingMs, formattedTime, isExpired } = usePatientSessionCountdown();

  const expiryStatusColor = (() => {
    if (isExpired) return 'text-red-400';
    if (remainingMs < 5 * 60 * 1000) return 'text-amber-400'; // < 5 mins
    return 'text-emerald-400';
  })();

  const expiryBgColor = (() => {
    if (isExpired) return 'bg-red-500/10 border-red-500/30';
    if (remainingMs < 5 * 60 * 1000) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-emerald-500/10 border-emerald-500/30';
  })();

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-4">
      {/* Profile */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/30 border border-blue-500/50 flex items-center justify-center">
            <span className="text-sm font-semibold text-blue-300">
              {patientName
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-white truncate">{patientName}</h3>
            <p className="text-xs text-slate-400 truncate">{labName}</p>
          </div>
        </div>
      </div>

      {/* Session status */}
      <div className={`rounded-lg border p-3 mb-4 ${expiryBgColor}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Sessão
          </span>
          <span className={`text-xs font-mono ${expiryStatusColor}`}>{formattedTime}</span>
        </div>

        {isExpired ? (
          <p className="text-xs text-red-300">Sessão expirada. Faça login novamente.</p>
        ) : remainingMs < 5 * 60 * 1000 ? (
          <p className="text-xs text-amber-300">
            Sessão vencendo em breve. {remainingMs < 60 * 1000 ? 'Faça logout e login novamente.' : ''}
          </p>
        ) : (
          <p className="text-xs text-emerald-300">Sessão ativa.</p>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/6 mb-4" />

      {/* Actions */}
      <div className="space-y-2">
        {onSettings && (
          <button
            onClick={onSettings}
            className="
              w-full px-3 py-2 rounded-lg text-sm
              bg-slate-500/20 text-slate-300 hover:bg-slate-500/30
              border border-slate-500/30 transition-colors
              text-left
            "
            aria-label="Configurações"
          >
            ⚙ Configurações
          </button>
        )}

        <button
          onClick={onLogout}
          className="
            w-full px-3 py-2 rounded-lg text-sm
            bg-red-500/20 text-red-300 hover:bg-red-500/30
            border border-red-500/30 transition-colors
            text-left font-medium
          "
          aria-label="Fazer logout"
        >
          ← Sair
        </button>
      </div>

      {/* Legal notice */}
      <div className="mt-4 pt-4 border-t border-white/6 text-xs text-slate-500">
        <p>
          Dados protegidos pela LGPD.{' '}
          <a href="/privacy" className="text-blue-400 hover:text-blue-300">
            Ver política
          </a>
        </p>
      </div>
    </div>
  );
});
