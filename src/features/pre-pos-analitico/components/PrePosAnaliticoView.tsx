/**
 * PrePosAnaliticoView — entrada SGQ Bloco 8 (Pré & Pós-analítico).
 * Shell até fluxos dedicados (order entry, triagem, laudos) serem priorizados.
 */

import React from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';

const BUTTON_GHOST = `
  px-3 h-9 rounded-lg text-xs font-medium
  text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85
  hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all
`.trim();

export function PrePosAnaliticoView(): React.ReactElement {
  const activeLab = useActiveLab();
  const goBack = useAppStore((s) => s.goBack);

  if (!activeLab) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500 dark:text-white/45">
        Nenhum laboratório ativo.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white">
      <header className="h-14 bg-white dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-4 px-6 sticky top-0 z-10">
        <button
          type="button"
          onClick={goBack}
          className={BUTTON_GHOST}
          aria-label="Voltar ao contexto anterior"
        >
          ← Voltar
        </button>
        <div className="h-5 w-px bg-slate-200 dark:bg-white/[0.08]" />
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-white/85">
            Pré & Pós-analítico
          </div>
          <div className="text-xs text-slate-500 dark:text-white/40">{activeLab.name}</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-10 space-y-6">
        <p className="text-xs font-bold tracking-widest uppercase text-fuchsia-400/90">
          Bloco 8 · SGQ
        </p>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white/90 tracking-tight">
          Cadastro, coleta e laudos
        </h1>
        <p className="text-sm text-slate-600 dark:text-white/50 leading-relaxed">
          Este espaço consolida o escopo pré-analítico, analítico e pós-analítico do DICQ. Os fluxos
          de order entry, triagem com valores críticos e revisão de laudos serão expandidos aqui;
          enquanto isso, use os módulos operacionais já ligados ao laboratório (CIQ, críticos,
          portal, exportações).
        </p>
        <ul className="text-sm text-slate-600 dark:text-white/45 space-y-2 list-disc pl-5">
          <li>Order entry e consentimento</li>
          <li>Triagem e valores críticos</li>
          <li>Laudos e revisão</li>
        </ul>
      </main>
    </div>
  );
}
