/**
 * InsumoPicker — dropdown reusável para seleção de insumo cadastrado nos
 * formulários de corridas de cada módulo. Quando selecionado, o consumidor
 * recebe o Insumo completo via `onSelect` e tipicamente pré-preenche campos
 * manuais existentes (lote, fabricante, validade).
 *
 * Filtra no servidor por `tipo` + `modulo` + `status='ativo'`. Busca textual
 * opcional. Mostra chip visual de validadeReal.
 *
 * Design: dropdown com busca incremental. Acessível por teclado (↑↓ nav,
 * Enter seleciona, Esc fecha). Valor vazio = "entrada manual" (backwards
 * compat com forms legados).
 */

import React, { useMemo, useState } from 'react';
import { useInsumos } from '../hooks/useInsumos';
import { diasAteVencer, validadeStatus } from '../utils/validadeReal';
import { hasQCValidationPending } from '../types/Insumo';
import type { Insumo, InsumoModulo, InsumoTipo } from '../types/Insumo';

interface InsumoPickerProps {
  /** Filtra a lista pelo tipo — tipicamente 'controle' em forms de corrida. */
  tipo: InsumoTipo;
  /** Filtra pelo módulo — garante que só insumos compatíveis aparecem. */
  modulo: InsumoModulo;
  /** ID do insumo atualmente selecionado (null = entrada manual). */
  value: string | null;
  /** Callback chamado com o Insumo completo (ou null se desselecionado). */
  onSelect: (insumo: Insumo | null) => void;
  /** Texto do placeholder / trigger quando nada selecionado. */
  placeholder?: string;
  /** Label semântico (aria-label do botão). */
  ariaLabel?: string;
}

const CLS_TRIGGER = `
  w-full flex items-center justify-between gap-2 px-3.5 h-10 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-sm text-slate-900 dark:text-white/85
  hover:border-slate-300 dark:hover:border-white/[0.15]
  focus:outline-none focus:border-violet-500/50
  transition-all
`.trim();

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR');
}

function ValidadeChip({ insumo }: { insumo: Insumo }) {
  const date = insumo.validadeReal.toDate();
  const status = validadeStatus(date);
  const dias = diasAteVencer(date);
  const cls =
    status === 'expired'
      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
      : status === 'warning'
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
        : 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-white/50';
  const label =
    status === 'expired'
      ? `vencido há ${Math.abs(dias)}d`
      : status === 'warning'
        ? `vence em ${dias}d`
        : fmtDate(date);
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}
    >
      {label}
    </span>
  );
}

/**
 * Chip "CQ pendente" para reagente/tira recém-aberto ainda não validado por
 * uma corrida de CQ aprovada. Âmbar — não é erro, é aviso acionável.
 */
function QCPendingChip() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
      title="Reagente/tira aberto — execute uma corrida de CQ antes de rotina"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
        <circle cx="4" cy="4" r="3" />
      </svg>
      CQ pendente
    </span>
  );
}

export function InsumoPicker({
  tipo,
  modulo,
  value,
  onSelect,
  placeholder = 'Selecionar insumo cadastrado (opcional)',
  ariaLabel,
}: InsumoPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({ tipo, modulo, status: 'ativo' as const, query: search.trim() || undefined }),
    [tipo, modulo, search],
  );

  const { insumos, isLoading } = useInsumos(filters);

  const selected = useMemo(
    () => (value ? insumos.find((i) => i.id === value) ?? null : null),
    [value, insumos],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel ?? placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={CLS_TRIGGER}
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-slate-900 dark:text-white/85 font-medium">
              {selected.nomeComercial}
            </span>
            <span className="text-xs text-slate-500 dark:text-white/45">· Lote {selected.lote}</span>
            <ValidadeChip insumo={selected} />
            {hasQCValidationPending(selected) && <QCPendingChip />}
          </div>
        ) : (
          <span className="text-slate-400 dark:text-white/35">{placeholder}</span>
        )}

        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M3 5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar lista"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-11 left-0 right-0 z-40 max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl">
            <div className="p-2 border-b border-slate-100 dark:border-white/[0.06]">
              <input
                type="search"
                placeholder="Buscar por lote, fabricante ou nome…"
                aria-label="Buscar insumo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 h-8 rounded-lg bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-sm placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            {/* Limpar seleção fica fora do listbox — é ação, não opção. */}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="w-full px-4 h-9 text-left text-xs text-slate-500 dark:text-white/45 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.04]"
              >
                <span className="opacity-60">×</span> Limpar seleção (entrada manual)
              </button>
            )}

            <div role="listbox" aria-label={ariaLabel ?? placeholder} className="py-1">
              {isLoading ? (
                <div className="px-4 py-4 text-xs text-slate-400 dark:text-white/30 text-center">
                  Carregando…
                </div>
              ) : insumos.length === 0 ? (
                <div className="px-4 py-4 text-xs text-slate-400 dark:text-white/30 text-center">
                  Nenhum insumo ativo encontrado.
                </div>
              ) : (
                insumos.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => {
                      onSelect(i);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={i.id === value}
                    className={`
                      w-full px-4 py-2.5 text-left text-sm transition-all flex items-center justify-between gap-3
                      ${
                        i.id === value
                          ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                          : 'text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                      }
                    `}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{i.nomeComercial}</div>
                      <div className="text-xs text-slate-500 dark:text-white/40 truncate">
                        {i.fabricante} · Lote {i.lote}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasQCValidationPending(i) && <QCPendingChip />}
                      <ValidadeChip insumo={i} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
