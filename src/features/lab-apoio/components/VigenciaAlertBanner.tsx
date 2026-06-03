/**
 * VigenciaAlertBanner — alertas de vigência de contrato e validade de certificações (≤30d ou vencido).
 * Apenas contratos ativos e não deletados; certificações com ativo + dataValidade.
 */

import React, { useMemo } from 'react';
import type { Contrato } from '../types/LabApoio';

export interface VigenciaAlertBannerProps {
  contratos: Contrato[];
}

type AlertLine = { key: string; expired: boolean; text: string };

function collectAlerts(contratos: Contrato[]): AlertLine[] {
  const nowIso = new Date().toISOString().split('T')[0];
  const dayMs = 1000 * 60 * 60 * 24;
  const out: AlertLine[] = [];
  const active = contratos.filter((c) => c.ativo && c.deletadoEm === null);

  for (const c of active) {
    const daysVig = Math.floor(
      (new Date(c.vigenciaFim).getTime() - new Date(nowIso).getTime()) / dayMs,
    );
    if (daysVig < 0) {
      out.push({
        key: `vig-exp-${c.id}`,
        expired: true,
        text: `Contrato «${c.nome}»: vigência vencida em ${c.vigenciaFim}.`,
      });
    } else if (daysVig <= 30) {
      out.push({
        key: `vig-soon-${c.id}`,
        expired: false,
        text: `Contrato «${c.nome}»: vigência encerra em ${c.vigenciaFim} (${daysVig === 0 ? 'hoje' : `em ${daysVig} dia(s)`}).`,
      });
    }

    for (const cert of c.certificacoes) {
      if (!cert.ativo || cert.dataValidade === null) continue;
      const certIso = cert.dataValidade.toDate().toISOString().split('T')[0];
      const daysCert = Math.floor(
        (new Date(certIso).getTime() - new Date(nowIso).getTime()) / dayMs,
      );
      if (daysCert < 0) {
        out.push({
          key: `cert-exp-${c.id}-${cert.id}`,
          expired: true,
          text: `Certificação «${cert.nome}» (${c.nome}): validade vencida em ${certIso}.`,
        });
      } else if (daysCert <= 30) {
        out.push({
          key: `cert-soon-${c.id}-${cert.id}`,
          expired: false,
          text: `Certificação «${cert.nome}» (${c.nome}): validade até ${certIso} (${daysCert === 0 ? 'hoje' : `em ${daysCert} dia(s)`}).`,
        });
      }
    }
  }

  out.sort((a, b) => {
    if (a.expired !== b.expired) return a.expired ? -1 : 1;
    return a.text.localeCompare(b.text, 'pt-BR');
  });
  return out;
}

export function VigenciaAlertBanner({ contratos }: VigenciaAlertBannerProps) {
  const lines = useMemo(() => collectAlerts(contratos), [contratos]);

  if (lines.length === 0) return null;

  return (
    <section
      role="region"
      aria-label="Alertas de vigência e certificações"
      className="mx-6 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/90 mb-2">
        Vigência e certificações
      </h2>
      <ul className="space-y-1.5 text-sm text-white/90 list-disc list-inside tabular-nums">
        {lines.map((line) => (
          <li
            key={line.key}
            className={
              line.expired
                ? 'text-red-300/95 marker:text-red-400'
                : 'text-amber-100/95 marker:text-amber-400'
            }
          >
            {line.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
