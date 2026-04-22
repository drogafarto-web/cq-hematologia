/**
 * FornecedoresView — aba da InsumosView com o cadastro global de fornecedores
 * e notas fiscais do lab.
 *
 * Duas colunas conceituais:
 *   - Fornecedores (catálogo) — cadastros estáveis com CNPJ.
 *   - Notas fiscais (entrada) — documentos que trazem lotes ao lab.
 *
 * Switcher de sub-view no topo. Cada item tem ações contextuais.
 */

import React, { useMemo, useState } from 'react';
import { useUser } from '../../store/useAuthStore';
import { useFornecedores } from './hooks/useFornecedores';
import { useNotasFiscais } from './hooks/useNotasFiscais';
import { useInsumos } from '../insumos/hooks/useInsumos';
import {
  deactivateFornecedor,
  reactivateFornecedor,
  deleteFornecedor,
  countNotasByFornecedor,
} from './services/fornecedorService';
import {
  deleteNotaFiscal,
  countInsumosByNota,
} from './services/notaFiscalService';
import { FornecedorFormModal } from './components/FornecedorFormModal';
import { NotaFiscalFormModal } from './components/NotaFiscalFormModal';
import { formatCnpj } from './types/Fornecedor';
import type { Fornecedor } from './types/Fornecedor';
import type { NotaFiscal } from './types/NotaFiscal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

function formatBRL(value: number | undefined): string {
  if (typeof value !== 'number') return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── View ────────────────────────────────────────────────────────────────────

interface FornecedoresViewProps {
  labId: string;
  canMutate: boolean;
}

type SubView = 'fornecedores' | 'notas';

export function FornecedoresView({ labId, canMutate }: FornecedoresViewProps) {
  const [subView, setSubView] = useState<SubView>('fornecedores');

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white/90">
          Fornecedores & notas fiscais
        </h2>
        <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5 max-w-2xl leading-relaxed">
          Cadastro global do lab. Fornecedor → nota fiscal → lote — rastreabilidade
          fiscal completa exigida pela RDC 786/2023 art. 42. Cada lote cadastrado
          pode (e deve) ser vinculado a uma nota.
        </p>
      </header>

      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg w-fit">
        {[
          { id: 'fornecedores' as const, label: 'Fornecedores' },
          { id: 'notas' as const, label: 'Notas fiscais' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubView(t.id)}
            className={`
              px-4 h-8 rounded-md text-xs font-medium transition-all
              ${
                subView === t.id
                  ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white/90 shadow-sm'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/75'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subView === 'fornecedores' ? (
        <FornecedoresSection labId={labId} canMutate={canMutate} />
      ) : (
        <NotasSection labId={labId} canMutate={canMutate} />
      )}
    </section>
  );
}

// ─── Fornecedores section ────────────────────────────────────────────────────

function FornecedoresSection({ labId, canMutate }: { labId: string; canMutate: boolean }) {
  const user = useUser();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [showNovo, setShowNovo] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Fornecedor | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      ...(showInactive ? {} : { ativo: true }),
      query: search.trim() || undefined,
    }),
    [showInactive, search],
  );
  const { fornecedores, isLoading, error } = useFornecedores(filters);

  // Contagem de notas por fornecedor — subscription de todas as notas + agrega.
  const { notas } = useNotasFiscais();
  const notasByFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notas) {
      m.set(n.fornecedorId, (m.get(n.fornecedorId) ?? 0) + 1);
    }
    return m;
  }, [notas]);

  const totalGastoByFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notas) {
      if (typeof n.valorTotal !== 'number') continue;
      m.set(n.fornecedorId, (m.get(n.fornecedorId) ?? 0) + n.valorTotal);
    }
    return m;
  }, [notas]);

  async function handleDeactivate(f: Fornecedor) {
    if (!user) return;
    setActionError(null);
    const ok = window.confirm(
      `Desativar fornecedor "${f.razaoSocial}"?\n\nO histórico de notas e lotes permanece — ` +
        'o fornecedor só some dos pickers de nova nota. Pode ser reativado depois.',
    );
    if (!ok) return;
    try {
      await deactivateFornecedor(labId, f.id, user.uid);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao desativar.');
    }
  }

  async function handleReactivate(f: Fornecedor) {
    if (!user) return;
    setActionError(null);
    try {
      await reactivateFornecedor(labId, f.id, user.uid);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao reativar.');
    }
  }

  async function handleDelete(f: Fornecedor) {
    setActionError(null);
    try {
      const n = await countNotasByFornecedor(labId, f.id);
      if (n > 0) {
        setActionError(
          `Não é possível excluir: fornecedor tem ${n} nota(s) fiscal(is) vinculada(s). ` +
            'Desative em vez de excluir pra preservar o histórico.',
        );
        return;
      }
      const ok = window.confirm(
        `Excluir fornecedor "${f.razaoSocial}"?\n\nAção permanente — nenhum histórico existe.`,
      );
      if (!ok) return;
      await deleteFornecedor(labId, f.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por razão social, fantasia ou CNPJ…"
          className="flex-1 min-w-[260px] h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-violet-500/50"
        />
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/55 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-violet-600 focus:ring-violet-500"
          />
          Mostrar inativos
        </label>
        {canMutate && (
          <button
            type="button"
            onClick={() => setShowNovo(true)}
            className="px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all inline-flex items-center gap-2 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M6 2v8M2 6h8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Novo fornecedor
          </button>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-slate-500 dark:text-white/40">
          Carregando fornecedores…
        </div>
      ) : fornecedores.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 dark:border-white/[0.08] rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-white/70">
            {search.trim() || showInactive
              ? 'Nenhum fornecedor com os filtros atuais.'
              : 'Nenhum fornecedor cadastrado'}
          </p>
          {!search.trim() && !showInactive && canMutate && (
            <>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 max-w-md mx-auto leading-relaxed">
                Cadastre os fornecedores do lab pra vincular notas fiscais e
                acompanhar histórico de fornecimento.
              </p>
              <button
                type="button"
                onClick={() => setShowNovo(true)}
                className="mt-4 px-5 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium"
              >
                Cadastrar primeiro fornecedor
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0F1318] overflow-hidden">
          <ul>
            {fornecedores.map((f, idx) => {
              const qtdNotas = notasByFornecedor.get(f.id) ?? 0;
              const total = totalGastoByFornecedor.get(f.id);
              return (
                <li
                  key={f.id}
                  className={`
                    group flex items-start gap-4 px-4 py-3.5
                    ${idx !== fornecedores.length - 1 ? 'border-b border-slate-100 dark:border-white/[0.04]' : ''}
                    hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors
                    ${!f.ativo ? 'opacity-55' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white/85">
                        {f.nomeFantasia ?? f.razaoSocial}
                      </p>
                      {!f.ativo && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-600 dark:text-slate-300 font-medium">
                          Inativo
                        </span>
                      )}
                    </div>
                    {f.nomeFantasia && (
                      <p className="text-[11px] text-slate-500 dark:text-white/45 truncate">
                        {f.razaoSocial}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-[11px] text-slate-500 dark:text-white/45 font-mono">
                        CNPJ {formatCnpj(f.cnpj)}
                      </span>
                      {f.inscricaoEstadual && (
                        <span className="text-[11px] text-slate-500 dark:text-white/45">
                          IE {f.inscricaoEstadual}
                        </span>
                      )}
                      {f.telefone && (
                        <span className="text-[11px] text-slate-500 dark:text-white/45">
                          {f.telefone}
                        </span>
                      )}
                      {f.email && (
                        <span className="text-[11px] text-slate-500 dark:text-white/45 truncate">
                          {f.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30">
                        Histórico
                      </p>
                      <p className="text-xs font-medium text-slate-700 dark:text-white/70">
                        {qtdNotas} {qtdNotas === 1 ? 'nota' : 'notas'}
                      </p>
                      {typeof total === 'number' && (
                        <p className="text-[11px] text-slate-500 dark:text-white/40">
                          {formatBRL(total)}
                        </p>
                      )}
                    </div>
                    {canMutate && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEmEdicao(f)}
                          aria-label={`Editar ${f.razaoSocial}`}
                          title="Editar"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-violet-600 dark:text-white/45 dark:hover:text-violet-300 hover:bg-violet-500/10"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path
                              d="M8.5 2l1.5 1.5-6 6L2.5 10l.5-1.5 5.5-6.5z"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {f.ativo ? (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(f)}
                            aria-label={`Desativar ${f.razaoSocial}`}
                            title="Desativar (preserva histórico)"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-amber-600 dark:text-white/45 dark:hover:text-amber-400 hover:bg-amber-500/10"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M3 9l6-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReactivate(f)}
                              aria-label={`Reativar ${f.razaoSocial}`}
                              title="Reativar"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-emerald-600 dark:text-white/45 dark:hover:text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(f)}
                              aria-label={`Excluir ${f.razaoSocial}`}
                              title="Excluir (só se não tiver notas)"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-red-600 dark:text-white/45 dark:hover:text-red-400 hover:bg-red-500/10"
                            >
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                                <path
                                  d="M2.5 3.5h7M5 2h2m-3 1.5v6.5a1 1 0 001 1h2a1 1 0 001-1V3.5m-3 2v4m2-4v4"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showNovo && (
        <FornecedorFormModal labId={labId} onClose={() => setShowNovo(false)} />
      )}
      {emEdicao && (
        <FornecedorFormModal
          labId={labId}
          fornecedor={emEdicao}
          onClose={() => setEmEdicao(null)}
        />
      )}
    </div>
  );
}

// ─── Notas section ───────────────────────────────────────────────────────────

function NotasSection({ labId, canMutate }: { labId: string; canMutate: boolean }) {
  const [search, setSearch] = useState('');
  const [showNovo, setShowNovo] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ query: search.trim() || undefined }),
    [search],
  );
  const { notas, isLoading, error } = useNotasFiscais(filters);
  const { fornecedores } = useFornecedores();
  const fornecedorById = useMemo(() => {
    const m = new Map<string, Fornecedor>();
    for (const f of fornecedores) m.set(f.id, f);
    return m;
  }, [fornecedores]);

  // Lotes vinculados por nota
  const { insumos: lotesAtivos } = useInsumos();
  const lotesByNota = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of lotesAtivos) {
      if (!i.notaFiscalId) continue;
      m.set(i.notaFiscalId, (m.get(i.notaFiscalId) ?? 0) + 1);
    }
    return m;
  }, [lotesAtivos]);

  async function handleDelete(n: NotaFiscal) {
    setActionError(null);
    try {
      const count = await countInsumosByNota(labId, n.id);
      if (count > 0) {
        setActionError(
          `Não é possível excluir: nota tem ${count} lote(s) vinculado(s). ` +
            'Remova os lotes primeiro.',
        );
        return;
      }
      const ok = window.confirm(
        `Excluir nota ${n.numero}?\n\nAção permanente — nenhum lote vinculado.`,
      );
      if (!ok) return;
      await deleteNotaFiscal(labId, n.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número ou chave de acesso…"
          className="flex-1 min-w-[260px] h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-violet-500/50"
        />
        {canMutate && (
          <button
            type="button"
            onClick={() => setShowNovo(true)}
            className="px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all inline-flex items-center gap-2 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M6 2v8M2 6h8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Nova nota
          </button>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-slate-500 dark:text-white/40">
          Carregando notas…
        </div>
      ) : notas.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 dark:border-white/[0.08] rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-white/70">
            {search.trim()
              ? 'Nenhuma nota encontrada com este filtro.'
              : 'Nenhuma nota fiscal cadastrada'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0F1318] overflow-hidden">
          <ul>
            {notas.map((n, idx) => {
              const f = fornecedorById.get(n.fornecedorId);
              const lotesCount = lotesByNota.get(n.id) ?? 0;
              return (
                <li
                  key={n.id}
                  className={`
                    group flex items-start gap-4 px-4 py-3.5
                    ${idx !== notas.length - 1 ? 'border-b border-slate-100 dark:border-white/[0.04]' : ''}
                    hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white/85">
                        NF {n.numero}
                        {n.serie && n.serie !== '1' && (
                          <span className="text-slate-500 dark:text-white/45 font-normal">
                            {' '}· Série {n.serie}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5 truncate">
                      {f ? `${f.nomeFantasia ?? f.razaoSocial} · ${formatCnpj(f.cnpj)}` : 'Fornecedor removido'}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-[11px] text-slate-500 dark:text-white/45">
                        Emissão {formatDate(n.dataEmissao)}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-white/45">
                        Recebida {formatDate(n.dataRecebimento)}
                      </span>
                      {typeof n.valorTotal === 'number' && (
                        <span className="text-[11px] text-slate-700 dark:text-white/70 font-medium">
                          {formatBRL(n.valorTotal)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {lotesCount > 0 && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium"
                        title={`${lotesCount} lote(s) desta nota atualmente ativos`}
                      >
                        {lotesCount} {lotesCount === 1 ? 'lote' : 'lotes'}
                      </span>
                    )}
                    {canMutate && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleDelete(n)}
                          aria-label={`Excluir nota ${n.numero}`}
                          title="Excluir (só se não tiver lotes)"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-red-600 dark:text-white/45 dark:hover:text-red-400 hover:bg-red-500/10"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path
                              d="M2.5 3.5h7M5 2h2m-3 1.5v6.5a1 1 0 001 1h2a1 1 0 001-1V3.5m-3 2v4m2-4v4"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showNovo && (
        <NotaFiscalFormModal labId={labId} onClose={() => setShowNovo(false)} />
      )}
    </div>
  );
}
