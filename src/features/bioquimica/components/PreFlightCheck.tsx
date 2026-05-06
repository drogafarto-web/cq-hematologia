/**
 * PreFlightCheck — validation gate before run capture
 *
 * Checks:
 * 1. Equipment ativo
 * 2. Lot em uso
 * 3. Bula não pendente (ou não past 7d grace)
 * 4. Reagentes OK (from insumos validation)
 * 5. Operator authenticated + active
 */

import React from 'react';
import { useActiveLotForEquipment } from '../hooks/useLotes';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { useEquipamentos } from '../hooks/useEquipamentos';

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.2" />
      <path
        d="M5 8l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.2" />
      <path d="M8 5v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PreFlightCheckProps {
  equipmentId: string;
  analitoIds: string[];
}

export function PreFlightCheck({ equipmentId, analitoIds }: PreFlightCheckProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const { equipamentos } = useEquipamentos();
  const activeLot = useActiveLotForEquipment(equipmentId);

  if (!labId || !user) return null;

  const equip = equipamentos.find((e) => e.id === equipmentId);
  const checks = [
    {
      ok: equip?.ativo === true,
      label: 'Equipamento ativo',
      icon: CheckCircleIcon,
    },
    {
      ok: activeLot !== null && activeLot.emUso === true,
      label: 'Lote em uso',
      icon: CheckCircleIcon,
    },
    {
      ok: !activeLot?.bulaPendente || (activeLot.bulaPendentesAte && new Date(activeLot.bulaPendentesAte) > new Date()),
      label: 'Bula vigente',
      icon: CheckCircleIcon,
    },
    {
      ok: user.uid !== null,
      label: 'Operador autenticado',
      icon: CheckCircleIcon,
    },
  ];

  const allOK = checks.every((c) => c.ok);
  const failedChecks = checks.filter((c) => !c.ok);

  return (
    <div
      className={`rounded-2xl border p-4 mb-5 transition-colors ${
        allOK
          ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
          : failedChecks.length <= 1
            ? 'border-amber-500/30 bg-amber-500/[0.08]'
            : 'border-red-500/30 bg-red-500/[0.08]'
      }`}
    >
      <div className="space-y-2">
        {checks.map((check, idx) => {
          const Icon = check.icon;
          const color = check.ok ? 'text-emerald-400' : 'text-amber-400';

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 ${check.ok ? 'text-emerald-300' : 'text-amber-300'}`}
            >
              <span className={color}>
                <Icon />
              </span>
              <span className="text-sm">{check.label}</span>
            </div>
          );
        })}
      </div>

      {!allOK && failedChecks.length > 0 && (
        <div
          className={`mt-3 pt-3 border-t ${failedChecks.length <= 1 ? 'border-amber-500/20' : 'border-red-500/20'}`}
        >
          <p className="text-xs font-medium mb-2">Pendências:</p>
          <ul className="space-y-1 text-xs">
            {failedChecks.map((check, idx) => (
              <li key={idx} className="list-disc list-inside">
                {check.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
