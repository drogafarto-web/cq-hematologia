/**
 * RegulatoryReferencesBar — chips de referências regulatórias por módulo.
 *
 * Fase B1 (2026-04-21): substitui a fusão "Diária — RDC 302/2005" que misturava
 * frequência operacional com base normativa. Agora a legislação vem de config
 * por módulo (ver RegulatoryConfig.ts) e aparece como seção separada.
 *
 * MVP: usa apenas os defaults resolvidos pelo módulo — config editável em
 * lab-settings entra junto com a aba de edição.
 */

import React from 'react';
import {
  resolveRegulatoryReferences,
  type ModuleRegulatoryConfig,
} from '../types/RegulatoryConfig';
import type { InsumoModulo } from '../types/Insumo';

interface RegulatoryReferencesBarProps {
  module: InsumoModulo;
  /** Configuração do lab — se ausente, usa defaults. */
  labOverrides?: Partial<Record<InsumoModulo, ModuleRegulatoryConfig>>;
}

export function RegulatoryReferencesBar({
  module,
  labOverrides,
}: RegulatoryReferencesBarProps) {
  const refs = resolveRegulatoryReferences(module, labOverrides);
  if (refs.length === 0) return null;

  return (
    <div
      role="note"
      aria-label="Base regulatória"
      className="rounded-lg border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.015] px-3 py-2"
    >
      <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-1.5">
        Base regulatória
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {refs.map((ref) => (
          <li
            key={ref}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-white/55 border border-slate-200 dark:border-white/[0.06]"
          >
            {ref}
          </li>
        ))}
      </ul>
    </div>
  );
}
