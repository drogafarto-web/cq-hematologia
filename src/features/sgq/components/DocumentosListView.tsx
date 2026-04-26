/**
 * Lista mestra de Documentos do SGQ.
 *
 * Tabela densa, dark-first, com filtros por tipo e status. Indicadores visuais:
 *   • verde — vigente, dentro do prazo
 *   • amarelo — vigente, vence em ≤30 dias
 *   • vermelho — vigente, fora do prazo (auditor pega isso na hora)
 *   • cinza — em revisão
 *   • slate — obsoleto (oculto por default; toggle "incluir obsoletos")
 *
 * Auditor pede 3 coisas: (1) lista mestra, (2) controle de versão, (3)
 * obsoletos segregados. Esta view atende todos. Auditoria detalhada do doc
 * (audit log) é feita expandindo a linha — fora do MVP, vai pra v2.
 */

import { useMemo, useState } from 'react';

import {
  isProximoVencimento,
  isVencido,
  STATUS_LABEL,
  TIPO_LABEL,
  type Documento,
  type StatusDocumento,
  type TipoDocumento,
} from '../types/Documento';

const TIPOS: TipoDocumento[] = ['MQ', 'PQ', 'IT', 'FR', 'POL'];
const STATUSES: StatusDocumento[] = ['em_revisao', 'vigente', 'obsoleto'];

interface Props {
  documentos: Documento[];
  isLoading: boolean;
  filtroTipo: TipoDocumento | 'todos';
  filtroStatus: StatusDocumento | 'todos';
  incluirObsoletos: boolean;
  onFiltroTipo: (tipo: TipoDocumento | 'todos') => void;
  onFiltroStatus: (status: StatusDocumento | 'todos') => void;
  onToggleObsoletos: () => void;
  onEditar: (doc: Documento) => void;
  onRevisar: (doc: Documento) => void;
  onMudarStatus: (doc: Documento, toStatus: StatusDocumento) => void;
  onRemover: (doc: Documento) => void;
}

export function DocumentosListView({
  documentos,
  isLoading,
  filtroTipo,
  filtroStatus,
  incluirObsoletos,
  onFiltroTipo,
  onFiltroStatus,
  onToggleObsoletos,
  onEditar,
  onRevisar,
  onMudarStatus,
  onRemover,
}: Props) {
  // Ordenação: vigentes primeiro, dentro de cada grupo ordena por código.
  const sorted = useMemo(() => {
    const order: Record<StatusDocumento, number> = {
      vigente: 0,
      em_revisao: 1,
      obsoleto: 2,
    };
    return [...documentos].sort((a, b) => {
      const so = order[a.status] - order[b.status];
      if (so !== 0) return so;
      return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
    });
  }, [documentos]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <FiltroChip
          label="Todos os tipos"
          active={filtroTipo === 'todos'}
          onClick={() => onFiltroTipo('todos')}
        />
        {TIPOS.map((t) => (
          <FiltroChip
            key={t}
            label={t}
            title={TIPO_LABEL[t]}
            active={filtroTipo === t}
            onClick={() => onFiltroTipo(t)}
          />
        ))}

        <span className="mx-2 h-4 w-px bg-white/10" aria-hidden />

        <FiltroChip
          label="Todos os status"
          active={filtroStatus === 'todos'}
          onClick={() => onFiltroStatus('todos')}
        />
        {STATUSES.map((s) => (
          <FiltroChip
            key={s}
            label={STATUS_LABEL[s]}
            active={filtroStatus === s}
            onClick={() => onFiltroStatus(s)}
          />
        ))}

        <span className="mx-2 h-4 w-px bg-white/10" aria-hidden />

        <FiltroChip
          label={incluirObsoletos ? 'Ocultando obsoletos' : 'Incluir obsoletos'}
          active={incluirObsoletos}
          onClick={onToggleObsoletos}
        />
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0F0F11] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-white/[0.02]">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Código</th>
              <th className="text-left px-4 py-3 font-semibold">Título</th>
              <th className="text-left px-4 py-3 font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold">Versão</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Próx. revisão</th>
              <th className="text-right px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isLoading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-white/40 text-xs">
                  Nenhum documento. Comece pelo Manual da Qualidade (MQ-001).
                </td>
              </tr>
            ) : (
              sorted.map((d) => (
                <DocumentoRow
                  key={d.id}
                  doc={d}
                  onEditar={() => onEditar(d)}
                  onRevisar={() => onRevisar(d)}
                  onMudarStatus={(s) => onMudarStatus(d, s)}
                  onRemover={() => onRemover(d)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FiltroChip({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
        active
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:text-white/80 hover:border-white/[0.1]'
      }`}
    >
      {label}
    </button>
  );
}

function DocumentoRow({
  doc,
  onEditar,
  onRevisar,
  onMudarStatus,
  onRemover,
}: {
  doc: Documento;
  onEditar: () => void;
  onRevisar: () => void;
  onMudarStatus: (toStatus: StatusDocumento) => void;
  onRemover: () => void;
}) {
  const vencido = isVencido(doc);
  const proximo = isProximoVencimento(doc);

  const statusBadge =
    doc.status === 'vigente'
      ? vencido
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : proximo
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : doc.status === 'em_revisao'
        ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
        : 'border-white/10 bg-white/[0.02] text-white/30';

  const statusLabel =
    doc.status === 'vigente' && vencido
      ? 'Vencido'
      : doc.status === 'vigente' && proximo
        ? 'Vence ≤30d'
        : STATUS_LABEL[doc.status];

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-2.5 font-mono text-xs text-white/85">{doc.codigo}</td>
      <td className="px-4 py-2.5 text-white/85 truncate max-w-xs">{doc.titulo}</td>
      <td className="px-4 py-2.5 text-white/50 text-xs">{TIPO_LABEL[doc.tipo]}</td>
      <td className="px-4 py-2.5 text-white/50 text-xs">v{doc.versao}</td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-2.5 text-white/50 text-xs">
        {doc.proximaRevisao.toDate().toLocaleDateString('pt-BR')}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="inline-flex items-center gap-1 justify-end">
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
            title="Abrir documento"
          >
            Abrir
          </a>
          {doc.status === 'em_revisao' && (
            <>
              <button
                type="button"
                onClick={() => onMudarStatus('vigente')}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10"
              >
                Publicar
              </button>
              <button
                type="button"
                onClick={onEditar}
                className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={onRemover}
                className="text-[11px] text-red-400/70 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10"
              >
                Remover
              </button>
            </>
          )}
          {doc.status === 'vigente' && (
            <>
              <button
                type="button"
                onClick={onRevisar}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10"
              >
                Revisar
              </button>
              <button
                type="button"
                onClick={onEditar}
                className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
              >
                Editar
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i}>
          <td colSpan={7} className="px-4 py-3">
            <div className="h-5 animate-pulse rounded bg-white/[0.04]" />
          </td>
        </tr>
      ))}
    </>
  );
}
