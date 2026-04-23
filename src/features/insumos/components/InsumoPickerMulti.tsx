/**
 * InsumoPickerMulti — variante multi-select do InsumoPicker para declarar N
 * insumos em uso simultâneo num equipamento (ex: Yumizen H550 carrega diluente
 * + lise + detergente ao mesmo tempo).
 *
 * Filtra no servidor por `tipo` + `modulo` + `status='ativo'`. Busca textual
 * opcional. Checkbox por item. Trigger mostra contagem.
 *
 * Design: listbox com aria-multiselectable. Fechamento explícito pelo "Concluir"
 * (evita fechar após 1ª seleção quando o fluxo é escolher várias).
 */

import { useMemo, useState } from 'react';
import { useInsumos } from '../hooks/useInsumos';
import { diasAteVencer, validadeStatus } from '../utils/validadeReal';
import { hasQCValidationPending } from '../types/Insumo';
import type { Insumo, InsumoModulo, InsumoTipo } from '../types/Insumo';

interface InsumoPickerMultiProps {
  tipo: InsumoTipo;
  modulo: InsumoModulo;
  /** IDs atualmente selecionados. */
  value: string[];
  /** Callback com a lista completa de Insumos selecionados (snapshot pronto). */
  onSelect: (insumos: Insumo[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  /**
   * Quando presente, picker exibe botão "+ Novo lote" que dispara este callback.
   * Caller abre um `NovoLoteModal` em overlay (preservando o estado da corrida).
   * Ausência do callback = botão oculto — comportamento legado.
   */
  onNovoLote?: () => void;
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

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
        checked
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-transparent border-slate-300 dark:border-white/20'
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function InsumoPickerMulti({
  tipo,
  modulo,
  value,
  onSelect,
  placeholder = 'Selecionar insumos em uso (opcional)',
  ariaLabel,
  onNovoLote,
}: InsumoPickerMultiProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({ tipo, modulo, status: 'ativo' as const, query: search.trim() || undefined }),
    [tipo, modulo, search],
  );

  const { insumos, isLoading } = useInsumos(filters);

  const selectedInsumos = useMemo(
    () => insumos.filter((i) => value.includes(i.id)),
    [insumos, value],
  );

  /**
   * Bloqueio de seleção — retorna motivo não-null quando o insumo NÃO pode ser
   * usado numa corrida. Vencido e reprovado no CQ (Imuno) são hard-blocks na
   * própria UI para forçar o operador a trocar; override continua disponível
   * no ReviewRunModal com justificativa auditada.
   */
  function blockReason(i: Insumo): string | null {
    const date = i.validadeReal.toDate();
    if (validadeStatus(date) === 'expired') {
      return `Vencido há ${Math.abs(diasAteVencer(date))}d — uso bloqueado`;
    }
    if ((i.tipo === 'reagente' || i.tipo === 'tira-uro') && i.qcStatus === 'reprovado') {
      return 'Lote reprovado no CQ — uso bloqueado';
    }
    return null;
  }

  function toggle(insumo: Insumo) {
    if (blockReason(insumo) && !value.includes(insumo.id)) return; // bloqueia novas seleções; desmarcar sempre permitido
    const next = value.includes(insumo.id)
      ? selectedInsumos.filter((i) => i.id !== insumo.id)
      : [...selectedInsumos, insumo];
    onSelect(next);
  }

  function clear() {
    onSelect([]);
  }

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1 && selectedInsumos[0]
        ? selectedInsumos[0].nomeComercial
        : `${value.length} reagentes selecionados`;

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
        <span
          className={`truncate ${
            value.length === 0
              ? 'text-slate-400 dark:text-white/35'
              : 'text-slate-900 dark:text-white/85 font-medium'
          }`}
        >
          {triggerLabel}
        </span>
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
          <div className="absolute top-11 left-0 right-0 z-40 max-h-80 overflow-hidden rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl flex flex-col">
            <div className="p-2 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
              <input
                type="search"
                placeholder="Buscar por lote, fabricante ou nome…"
                aria-label="Buscar insumo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 h-8 rounded-lg bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-sm placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div
              role="listbox"
              aria-multiselectable
              aria-label={ariaLabel ?? placeholder}
              className="flex-1 overflow-y-auto py-1"
            >
              {isLoading ? (
                <div className="px-4 py-4 text-xs text-slate-400 dark:text-white/30 text-center">
                  Carregando…
                </div>
              ) : insumos.length === 0 ? (
                <div className="px-4 py-4 text-xs text-slate-400 dark:text-white/30 text-center">
                  Nenhum insumo ativo encontrado.
                </div>
              ) : (
                insumos.map((i) => {
                  const checked = value.includes(i.id);
                  const blocked = blockReason(i);
                  const isBlocked = blocked !== null && !checked; // item já marcado pode ser desmarcado
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => toggle(i)}
                      disabled={isBlocked}
                      role="option"
                      aria-selected={checked}
                      title={blocked ?? undefined}
                      className={`
                        w-full px-3 py-2 text-left text-sm transition-all flex items-center gap-3
                        ${
                          isBlocked
                            ? 'opacity-50 cursor-not-allowed text-slate-500 dark:text-white/40'
                            : checked
                              ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                              : 'text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      <Checkbox checked={checked} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{i.nomeComercial}</div>
                        <div className="text-xs text-slate-500 dark:text-white/40 truncate">
                          {i.fabricante} · Lote {i.lote}
                          {blocked && (
                            <span className="ml-2 text-red-600 dark:text-red-400/80 font-medium">
                              · {blocked}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasQCValidationPending(i) && <QCPendingChip />}
                        <ValidadeChip insumo={i} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-3 py-2 border-t border-slate-100 dark:border-white/[0.06] shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clear}
                  disabled={value.length === 0}
                  className="text-xs text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Limpar
                </button>
                {onNovoLote && (
                  <>
                    <span className="text-slate-300 dark:text-white/10">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onNovoLote();
                      }}
                      className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                    >
                      + Novo lote
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 dark:text-white/35">
                  {value.length} selecionado{value.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 px-3 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
