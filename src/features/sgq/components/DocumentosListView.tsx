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

import { memo, useCallback, useMemo, useState } from 'react';

import {
  isProximoVencimento,
  isVencido,
  STATUS_LABEL,
  TIPO_LABEL,
  formatVersao,
  type Documento,
  type StatusDocumento,
  type TipoAlteracao,
  type TipoDocumento,
} from '../types/Documento';
import { criarDocumentoGDocs, publicarDocumento, exportDocumentoPdfA4, exportFormularioXlsx } from '../services/documentoService';
import { PublicarDocumentoModal } from './PublicarDocumentoModal';
import { CarimboVirtual } from './CarimboVirtual';
import { useHistoricoVersoes } from '../hooks/useHistoricoVersoes';
import { useActiveLabId, useActiveLab } from '../../../store/useAuthStore';
import { storage, getDownloadURL, ref } from '../../../shared/services/firebase';

const TIPOS: TipoDocumento[] = ['MQ', 'PQ', 'PQ-ANA', 'PQ-EQP', 'IT', 'ITA', 'FR', 'POL', 'ATA', 'RAI'];
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
  const [publishTarget, setPublishTarget] = useState<Documento | null>(null);
  const labId = useActiveLabId();

  async function handlePublicar(pin: string, tipoAlteracao: TipoAlteracao, razao?: string) {
    if (!publishTarget || !labId) return;
    await publicarDocumento(labId, publishTarget.id, pin, tipoAlteracao, razao);
  }

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
                  labId={labId}
                  onEditar={onEditar}
                  onRevisar={onRevisar}
                  onMudarStatus={onMudarStatus}
                  onRemover={onRemover}
                  onPublicar={setPublishTarget}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal Publicar ───────────────────────────────────────────── */}
      {publishTarget && (
        <PublicarDocumentoModal
          isOpen={!!publishTarget}
          onClose={() => setPublishTarget(null)}
          documento={publishTarget}
          onPublicar={handlePublicar}
        />
      )}
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

const DocumentoRow = memo(function DocumentoRow({
  doc,
  labId,
  onEditar,
  onRevisar,
  onMudarStatus,
  onRemover,
  onPublicar,
}: {
  doc: Documento;
  labId: string | null;
  onEditar: (doc: Documento) => void;
  onRevisar: (doc: Documento) => void;
  onMudarStatus: (doc: Documento, toStatus: StatusDocumento) => void;
  onRemover: (doc: Documento) => void;
  onPublicar: (doc: Documento) => void;
}) {
  const [creatingGDocs, setCreatingGDocs] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleOpenPdf = useCallback(async () => {
    if (!doc.snapshotPdfUrl) return;
    if (doc.snapshotPdfUrl.startsWith('gs://')) {
      const path = doc.snapshotPdfUrl.replace(/^gs:\/\/[^/]+\//, '');
      const storageRef = ref(storage, path);
      const url = await getDownloadURL(storageRef);
      window.open(url, '_blank');
    } else {
      window.open(doc.snapshotPdfUrl, '_blank');
    }
  }, [doc.snapshotPdfUrl]);

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
    <>
    <tr
      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
      onClick={() => setExpanded((prev) => !prev)}
    >
      <td className="px-4 py-2.5 font-mono text-xs text-white/85">{doc.codigo}</td>
      <td className="px-4 py-2.5 text-white/85 truncate max-w-xs">{doc.titulo}</td>
      <td className="px-4 py-2.5 text-white/50 text-xs">{TIPO_LABEL[doc.tipo]}</td>
      <td className="px-4 py-2.5 text-white/50 text-xs">{formatVersao(doc.versao)}</td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-2.5 text-white/50 text-xs">
        {(doc.proximaRevisao && typeof doc.proximaRevisao.toDate === 'function'
          ? doc.proximaRevisao.toDate().toLocaleDateString('pt-BR')
          : doc.proximaRevisao instanceof Date
            ? doc.proximaRevisao.toLocaleDateString('pt-BR')
            : '—')}
      </td>
      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex items-center gap-1 justify-end">
          {/* Criar no Google Docs */}
          {!doc.googleDocId && doc.status === 'em_revisao' && labId && (
            <button
              type="button"
              onClick={async () => {
                setCreatingGDocs(true);
                try {
                  await criarDocumentoGDocs(labId, doc.id);
                } finally {
                  setCreatingGDocs(false);
                }
              }}
              disabled={creatingGDocs}
              className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05] disabled:opacity-40"
              title="Criar no Google Docs"
            >
              {creatingGDocs ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              )}
            </button>
          )}

          {/* Abrir no Google Docs */}
          {doc.googleDocId && doc.status === 'em_revisao' && doc.googleDocUrl && (
            <button
              type="button"
              onClick={() => window.open(doc.googleDocUrl!, '_blank')}
              className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
              title="Abrir no Google Docs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}

          {/* Ver PDF */}
          {doc.snapshotPdfUrl && (
            <button
              type="button"
              onClick={handleOpenPdf}
              className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
              title="Ver PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 15h6" />
                <path d="M9 11h6" />
              </svg>
            </button>
          )}

          {/* Abrir URL */}
          {doc.url && doc.url.startsWith('http') && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
              title="Abrir documento"
            >
              Abrir
            </a>
          )}

          {doc.status === 'em_revisao' && (
            <>
              {/* Publicar */}
              <button
                type="button"
                onClick={() => onPublicar(doc)}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30"
                title="Publicar documento"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Publicar
              </button>
              <button
                type="button"
                onClick={() => onEditar(doc)}
                className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onRemover(doc)}
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
                onClick={() => onRevisar(doc)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10"
              >
                Revisar
              </button>
              <button
                type="button"
                onClick={() => onEditar(doc)}
                className="text-[11px] text-white/50 hover:text-white/85 px-2 py-1 rounded hover:bg-white/[0.05]"
              >
                Editar
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
    {expanded && <ExpandedCarimboRow doc={doc} />}
    </>
  );
});

function ExpandedCarimboRow({ doc }: { doc: Documento }) {
  const { versoes, isLoading } = useHistoricoVersoes(doc.id);
  const lab = useActiveLab();
  const labId = useActiveLabId();
  const [exporting, setExporting] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  async function handleExportPdf() {
    if (!labId) return;
    setExporting(true);
    try {
      const { pdfUrl } = await exportDocumentoPdfA4(labId, doc.id);
      window.open(pdfUrl, '_blank');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportXlsx() {
    if (!labId) return;
    setExportingXlsx(true);
    try {
      const { xlsxUrl } = await exportFormularioXlsx(labId, doc.id, [], []);
      window.open(xlsxUrl, '_blank');
    } finally {
      setExportingXlsx(false);
    }
  }

  return (
    <tr>
      <td colSpan={7} className="px-4 py-3 bg-white/[0.01]">
        <div className="flex items-start gap-4">
          <CarimboVirtual
            documento={doc}
            versoes={versoes}
            labName={lab?.name ?? ''}
            isLoading={isLoading}
          />
          <div className="flex flex-col gap-2 shrink-0">
            {doc.googleDocId && (
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 hover:bg-violet-500/15 transition-colors disabled:opacity-40"
              >
                {exporting ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M12 18v-6M9 15l3 3 3-3" />
                  </svg>
                )}
                Exportar PDF A4
              </button>
            )}
            {doc.tipo === 'FR' && (
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={exportingXlsx}
                className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors disabled:opacity-40"
              >
                {exportingXlsx ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18M3 9h18M3 15h18" />
                  </svg>
                )}
                Exportar XLSX
              </button>
            )}
          </div>
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
