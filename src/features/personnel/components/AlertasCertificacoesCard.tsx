/**
 * AlertasCertificacoesCard — Point 5
 *
 * Shows validity status for professional registrations (CRF, CRBM, CREF)
 * and structured certifications with color-coded expiry alerts.
 *
 * Color coding:
 * - Green: >60 days until expiry
 * - Amber: 30-60 days until expiry
 * - Red: <30 days until expiry
 * - Dark red: expired
 */

import React, { useMemo } from 'react';
import type { Timestamp } from '../../../shared/services/firebase';
import type { CertificacaoRegistro, PersonnelDossier } from '../types';

type AlertLevel = 'ok' | 'warning' | 'danger' | 'expired' | 'none';

interface ValidityItem {
  label: string;
  numero: string | null;
  validade: Timestamp | null;
  level: AlertLevel;
  diasRestantes: number | null;
}

function getAlertLevel(validade: Timestamp | null): {
  level: AlertLevel;
  diasRestantes: number | null;
} {
  if (!validade) return { level: 'none', diasRestantes: null };
  const now = Date.now();
  const expiryMs = validade.toMillis();
  const diffMs = expiryMs - now;
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0) return { level: 'expired', diasRestantes: dias };
  if (dias < 30) return { level: 'danger', diasRestantes: dias };
  if (dias <= 60) return { level: 'warning', diasRestantes: dias };
  return { level: 'ok', diasRestantes: dias };
}

const LEVEL_STYLES: Record<AlertLevel, { dot: string; text: string; bg: string }> = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  danger: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
  expired: { dot: 'bg-red-700', text: 'text-red-300', bg: 'bg-red-700/10' },
  none: { dot: 'bg-white/20', text: 'text-white/40', bg: 'bg-white/5' },
};

function formatDias(dias: number | null, level: AlertLevel): string {
  if (level === 'none') return 'Sem validade definida';
  if (dias === null) return '';
  if (dias < 0) return `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`;
  if (dias === 0) return 'Vence hoje';
  return `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`;
}

interface AlertasCertificacoesCardProps {
  dossier: PersonnelDossier;
}

export function AlertasCertificacoesCard({
  dossier,
}: AlertasCertificacoesCardProps): React.ReactElement {
  const items = useMemo<ValidityItem[]>(() => {
    const registros: ValidityItem[] = [];

    if (dossier.registroCRF) {
      const { level, diasRestantes } = getAlertLevel(dossier.registroCRFValidade);
      registros.push({
        label: 'CRF',
        numero: dossier.registroCRF,
        validade: dossier.registroCRFValidade,
        level,
        diasRestantes,
      });
    }
    if (dossier.registroCRBM) {
      const { level, diasRestantes } = getAlertLevel(dossier.registroCRBMValidade);
      registros.push({
        label: 'CRBM',
        numero: dossier.registroCRBM,
        validade: dossier.registroCRBMValidade,
        level,
        diasRestantes,
      });
    }
    if (dossier.registroCREF) {
      const { level, diasRestantes } = getAlertLevel(dossier.registroCREFValidade);
      registros.push({
        label: 'CREF',
        numero: dossier.registroCREF,
        validade: dossier.registroCREFValidade,
        level,
        diasRestantes,
      });
    }

    // Structured certifications
    for (const cert of dossier.certificacoes) {
      const { level, diasRestantes } = getAlertLevel(cert.dataValidade);
      registros.push({
        label: cert.nome,
        numero: cert.numero,
        validade: cert.dataValidade,
        level,
        diasRestantes,
      });
    }

    return registros;
  }, [dossier]);

  const attentionCount = useMemo(
    () =>
      items.filter((i) => i.level === 'warning' || i.level === 'danger' || i.level === 'expired')
        .length,
    [items],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <p className="text-sm text-white/50">
          Nenhum registro profissional ou certificação cadastrada.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Validade de Registros e Certificações</h3>
        {attentionCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-300">
            {attentionCount} atenção
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const styles = LEVEL_STYLES[item.level];
          return (
            <div
              key={`${item.label}-${idx}`}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${styles.bg}`}
            >
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden="true" />
                <div>
                  <span className="text-sm font-medium text-white">{item.label}</span>
                  {item.numero && <span className="ml-2 text-xs text-white/50">{item.numero}</span>}
                </div>
              </div>
              <span className={`text-xs font-medium ${styles.text}`}>
                {formatDias(item.diasRestantes, item.level)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
