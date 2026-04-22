/**
 * CatalogoProdutosView — catálogo GLOBAL de produtos do lab.
 *
 * 2026-04-21 (3º turno da Fase D). Existe porque produto é entidade estável
 * do laboratório — independente de módulo e equipamento. A versão anterior
 * escondia o cadastro dentro de cada card de equipamento, o que criava a
 * ilusão de acoplamento "produto pertence ao equipamento". O modelo de dados
 * sempre foi global (path `/labs/{labId}/produtos-insumos/{produtoId}`); esta
 * tela finalmente espelha isso na UI.
 *
 * Responsabilidades:
 *   - Listar produtos do lab com filtros (busca, módulo, tipo).
 *   - Cadastro, edição e exclusão de produto — único ponto de mutação do
 *     catálogo. O card do equipamento vira read-only e aponta pra cá.
 *   - Mostrar quantos lotes ativos cada produto tem — sinal de "em uso" que
 *     também é o gate pra permitir exclusão.
 */

import React, { useMemo, useState } from 'react';
import { useProdutos } from '../hooks/useProdutos';
import { useInsumos } from '../hooks/useInsumos';
import { ProdutoFormModal } from './ProdutoFormModal';
import { ConfirmDeleteProdutoModal } from './ConfirmDeleteProdutoModal';
import type { ProdutoInsumo } from '../types/ProdutoInsumo';
import type { InsumoModulo, InsumoTipo } from '../types/Insumo';

// ─── Labels ──────────────────────────────────────────────────────────────────

const MODULO_LABEL: Record<InsumoModulo, string> = {
  hematologia: 'Hematologia',
  coagulacao: 'Coagulação',
  uroanalise: 'Uroanálise',
  imunologia: 'Imunologia',
};

const TIPO_LABEL: Record<InsumoTipo, string> = {
  reagente: 'Reagente',
  controle: 'Controle',
  'tira-uro': 'Tira (uroanálise)',
};

const MODULOS: InsumoModulo[] = ['hematologia', 'coagulacao', 'uroanalise', 'imunologia'];
const TIPOS: InsumoTipo[] = ['reagente', 'controle', 'tira-uro'];

// ─── Component ───────────────────────────────────────────────────────────────

interface CatalogoProdutosViewProps {
  labId: string;
  canMutate: boolean;
  /** Pré-seleciona o filtro de módulo ao abrir (vindo de um CTA contextual). */
  initialModuloFilter?: InsumoModulo;
}

export function CatalogoProdutosView({
  labId: labId,
  canMutate,
  initialModuloFilter,
}: CatalogoProdutosViewProps) {
  const [moduloFilter, setModuloFilter] = useState<InsumoModulo | 'all'>(
    initialModuloFilter ?? 'all',
  );
  const [tipoFilter, setTipoFilter] = useState<InsumoTipo | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showNovo, setShowNovo] = useState(false);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<ProdutoInsumo | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<ProdutoInsumo | null>(null);

  const filters = useMemo(
    () => ({
      modulo: moduloFilter === 'all' ? undefined : moduloFilter,
      tipo: tipoFilter === 'all' ? undefined : tipoFilter,
      query: searchQuery.trim() || undefined,
    }),
    [moduloFilter, tipoFilter, searchQuery],
  );

  const { produtos, isLoading, error } = useProdutos(filters);

  // Lotes ativos — pra mostrar "em uso" em cada linha e como contexto visual
  // de quais produtos têm tráfego real no lab. Listener compartilhado; não
  // triggera N queries.
  const insumosFilters = useMemo(() => ({ status: 'ativo' as const }), []);
  const { insumos: lotesAtivos } = useInsumos(insumosFilters);
  const countByProduto = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of lotesAtivos) {
      if (!i.produtoId) continue;
      m.set(i.produtoId, (m.get(i.produtoId) ?? 0) + 1);
    }
    return m;
  }, [lotesAtivos]);

  return (
    <section className="space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white/90">
            Catálogo de produtos
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5 max-w-2xl leading-relaxed">
            Cadastro único por laboratório — produto é entidade estável (Bio-Rad Multiqual,
            Horiba ABX Diluent). Lotes físicos ficam em cada equipamento, vinculados ao produto
            do catálogo.
          </p>
        </div>
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
            Novo produto
          </button>
        )}
      </header>

      {/* Filtros */}
      <div className="space-y-3">
        <label htmlFor="catalogo-busca" className="sr-only">
          Buscar produto
        </label>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
          >
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            id="catalogo-busca"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por fabricante, nome comercial ou código…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30 mr-1">
            Módulo
          </span>
          <FilterChip
            active={moduloFilter === 'all'}
            onClick={() => setModuloFilter('all')}
            label="Todos"
          />
          {MODULOS.map((m) => (
            <FilterChip
              key={m}
              active={moduloFilter === m}
              onClick={() => setModuloFilter(m)}
              label={MODULO_LABEL[m]}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30 mr-1">
            Tipo
          </span>
          <FilterChip
            active={tipoFilter === 'all'}
            onClick={() => setTipoFilter('all')}
            label="Todos"
          />
          {TIPOS.map((t) => (
            <FilterChip
              key={t}
              active={tipoFilter === t}
              onClick={() => setTipoFilter(t)}
              label={TIPO_LABEL[t]}
            />
          ))}
        </div>
      </div>

      {/* Lista */}
      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : isLoading ? (
        <div className="py-10 text-center text-sm text-slate-500 dark:text-white/40">
          Carregando catálogo…
        </div>
      ) : produtos.length === 0 ? (
        <EmptyState
          hasFilters={
            moduloFilter !== 'all' || tipoFilter !== 'all' || searchQuery.trim() !== ''
          }
          canMutate={canMutate}
          onNovo={() => setShowNovo(true)}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0F1318] overflow-hidden">
          <ul>
            {produtos.map((p, idx) => (
              <ProdutoRow
                key={p.id}
                produto={p}
                lotesAtivos={countByProduto.get(p.id) ?? 0}
                canMutate={canMutate}
                isLast={idx === produtos.length - 1}
                onEdit={() => setProdutoEmEdicao(p)}
                onDelete={() => setProdutoParaExcluir(p)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Modals */}
      {showNovo && (
        <ProdutoFormModal
          labId={labId}
          initialModulo={moduloFilter === 'all' ? undefined : moduloFilter}
          initialTipo={tipoFilter === 'all' ? undefined : tipoFilter}
          onClose={() => setShowNovo(false)}
        />
      )}
      {produtoEmEdicao && (
        <ProdutoFormModal
          labId={labId}
          produto={produtoEmEdicao}
          onClose={() => setProdutoEmEdicao(null)}
        />
      )}
      {produtoParaExcluir && (
        <ConfirmDeleteProdutoModal
          labId={labId}
          produto={produtoParaExcluir}
          onClose={() => setProdutoParaExcluir(null)}
        />
      )}
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ? 'true' : 'false'}
      className={`
        px-3 h-7 rounded-full text-xs font-medium border transition-all
        ${
          active
            ? 'bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-300'
            : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/55 hover:border-slate-300 dark:hover:border-white/15'
        }
      `}
    >
      {label}
    </button>
  );
}

function ProdutoRow({
  produto,
  lotesAtivos,
  canMutate,
  isLast,
  onEdit,
  onDelete,
}: {
  produto: ProdutoInsumo;
  lotesAtivos: number;
  canMutate: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`
        group flex items-start gap-4 px-4 py-3.5
        ${!isLast ? 'border-b border-slate-100 dark:border-white/[0.04]' : ''}
        hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 dark:text-white/85">
            {produto.nomeComercial}
          </p>
          <p className="text-[11px] uppercase tracking-widest font-medium text-slate-400 dark:text-white/35">
            {produto.fabricante}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          {produto.codigoFabricante && (
            <span className="text-[11px] text-slate-500 dark:text-white/45">
              Cód. {produto.codigoFabricante}
            </span>
          )}
          {produto.registroAnvisa && (
            <span className="text-[11px] text-slate-500 dark:text-white/45">
              ANVISA {produto.registroAnvisa}
            </span>
          )}
          {produto.equipamentosCompativeis && produto.equipamentosCompativeis.length > 0 && (
            <span className="text-[11px] text-slate-500 dark:text-white/45 truncate">
              Equipamentos: {produto.equipamentosCompativeis.join(', ')}
            </span>
          )}
        </div>
        {produto.funcaoTecnica && (
          <p className="text-[11px] text-slate-500 dark:text-white/40 mt-1 leading-relaxed line-clamp-2">
            {produto.funcaoTecnica}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {produto.modulos.map((m) => (
            <span
              key={m}
              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-white/55 border border-slate-200 dark:border-white/[0.06]"
            >
              {MODULO_LABEL[m]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {lotesAtivos > 0 && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium"
            title={`${lotesAtivos} lote(s) ativo(s) vinculado(s) a este produto`}
          >
            {lotesAtivos} {lotesAtivos === 1 ? 'lote ativo' : 'lotes ativos'}
          </span>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-white/[0.05] text-slate-600 dark:text-white/50 font-medium">
          {TIPO_LABEL[produto.tipo]}
        </span>
        {canMutate && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar ${produto.nomeComercial}`}
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
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Excluir ${produto.nomeComercial}`}
              title="Excluir"
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
}

function EmptyState({
  hasFilters,
  canMutate,
  onNovo,
}: {
  hasFilters: boolean;
  canMutate: boolean;
  onNovo: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 dark:text-white/40">
        Nenhum produto bate com os filtros atuais.
      </div>
    );
  }
  return (
    <div className="border-2 border-dashed border-slate-300 dark:border-white/[0.08] rounded-xl p-8 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-white/70">
        Catálogo vazio
      </p>
      <p className="text-xs text-slate-500 dark:text-white/40 mt-1 max-w-md mx-auto leading-relaxed">
        Cadastre os produtos usados pelo lab — reagentes, controles e tiras.
        Cada produto aqui pode receber N lotes físicos em uso nos equipamentos.
      </p>
      {canMutate && (
        <button
          type="button"
          onClick={onNovo}
          className="mt-4 px-5 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium"
        >
          Cadastrar primeiro produto
        </button>
      )}
    </div>
  );
}
