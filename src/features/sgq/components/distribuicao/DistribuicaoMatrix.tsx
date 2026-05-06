/**
 * DistribuicaoMatrix.tsx
 *
 * Matrix: rows = docs, columns = 17 setores.
 * Cell highlight when doc distributed.
 * Virtual scroll for >50 rows.
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import type { StatusVigencia } from '../lm/StatusVigenciaBadge';
import { TipoDocumentoBadge, type TipoDocumento } from '../lm/TipoDocumentoBadge';
import { MeusDocsAlert } from './MeusDocsAlert';
import type { FilterState } from '../lm/ListaMestraFilters';

const SETORES = [
  'Bioquímica', 'Hematologia', 'Imunologia', 'Coagulação', 'Microbiologia',
  'Citologia', 'Histopatologia', 'Uroanálise', 'Endocrinologia', 'Farmácia',
  'Recepção', 'Financeiro', 'TI', 'Qualidade', 'Direção', 'RH', 'Almoxarifado',
];

interface DocumentoDistribuicao {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoDocumento;
  status: StatusVigencia;
  setoresDistribuidos: string[];
}

interface DistribuicaoMatrixProps {
  documentos: DocumentoDistribuicao[];
  loading?: boolean;
  filters?: FilterState;
  onDocumentClick?: (id: string) => void;
  userSetores?: string[];
}

const VIRTUAL_ROW_HEIGHT = 48;
const VISIBLE_ROWS = 20;

export function DistribuicaoMatrix({
  documentos,
  loading = false,
  filters = {},
  onDocumentClick,
  userSetores = [],
}: DistribuicaoMatrixProps) {
  const [focusedSetor, setFocusedSetor] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let result = [...documentos];
    if (filters.tipo) result = result.filter(d => d.tipo === filters.tipo);
    if (filters.status) result = result.filter(d => d.status === filters.status);
    if (filters.setor) {
      setFocusedSetor(filters.setor);
      result = result.filter(d => d.setoresDistribuidos.includes(filters.setor || ''));
    }
    return result;
  }, [documentos, filters]);

  const useVirtualization = filtered.length > 50;
  const startIdx = useVirtualization ? Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) : 0;
  const endIdx = useVirtualization ? startIdx + VISIBLE_ROWS + 1 : filtered.length;
  const visibleRows = filtered.slice(startIdx, endIdx);
  const offsetY = useVirtualization ? startIdx * VIRTUAL_ROW_HEIGHT : 0;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
  };

  const handleExportCSV = () => {
    const headers = ['Código', 'Título', 'Tipo', ...SETORES];
    const rows = filtered.map(doc => [
      doc.codigo,
      doc.titulo,
      doc.tipo,
      ...SETORES.map(s => doc.setoresDistribuidos.includes(s) ? '✓' : ''),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'distribuicao-matriz.csv';
    a.click();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60 text-sm">Nenhum documento encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/60">
          Mostrando <span className="font-semibold text-white">{filtered.length}</span> documentos
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      {/* Meus Docs Alert */}
      {userSetores.length > 0 && (
        <MeusDocsAlert
          userSetores={userSetores}
          documentos={filtered}
          onDocumentClick={onDocumentClick}
        />
      )}

      {/* Matrix */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#141417]">
        <div className="min-w-min">
          {/* Header row */}
          <div className="flex sticky top-0 z-10 bg-white/5 border-b border-white/10">
            <div className="w-32 px-3 py-2 border-r border-white/10 text-xs font-semibold text-white/70 uppercase tracking-wide sticky left-0 bg-white/5">
              Documento
            </div>
            {SETORES.map(setor => (
              <div
                key={setor}
                onClick={() => setFocusedSetor(focusedSetor === setor ? null : setor)}
                className={`w-12 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors border-r border-white/10 ${
                  focusedSetor === setor
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-white/70 hover:bg-white/5'
                }`}
                title={setor}
              >
                {setor.substring(0, 3)}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="max-h-[600px] overflow-y-auto"
          >
            <div style={{ height: useVirtualization ? filtered.length * VIRTUAL_ROW_HEIGHT : 'auto' }}>
              {useVirtualization && (
                <div style={{ transform: `translateY(${offsetY}px)` }}>
                  {visibleRows.map(doc => (
                    <MatrixRow
                      key={doc.id}
                      doc={doc}
                      setores={SETORES}
                      focusedSetor={focusedSetor}
                      onDocumentClick={onDocumentClick}
                      isVirtual
                    />
                  ))}
                </div>
              )}
              {!useVirtualization && filtered.map(doc => (
                <MatrixRow
                  key={doc.id}
                  doc={doc}
                  setores={SETORES}
                  focusedSetor={focusedSetor}
                  onDocumentClick={onDocumentClick}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Single matrix row component
 */
interface MatrixRowProps {
  doc: DocumentoDistribuicao;
  setores: string[];
  focusedSetor: string | null;
  onDocumentClick?: (id: string) => void;
  isVirtual?: boolean;
}

function MatrixRow({
  doc,
  setores,
  focusedSetor,
  onDocumentClick,
  isVirtual,
}: MatrixRowProps) {
  return (
    <div className={`flex border-b border-white/5 hover:bg-white/[0.02] transition-colors ${isVirtual ? '' : ''}`}>
      <div
        onClick={() => onDocumentClick?.(doc.id)}
        className="w-32 px-3 py-2 border-r border-white/10 cursor-pointer truncate sticky left-0 bg-[#141417] hover:bg-white/5 transition-colors"
      >
        <div className="text-xs font-mono text-white/70">{doc.codigo}</div>
        <div className="text-xs text-white/50 truncate mt-0.5">{doc.titulo}</div>
      </div>
      {setores.map(setor => {
        const isDistributed = doc.setoresDistribuidos.includes(setor);
        const isFocused = focusedSetor === setor;
        return (
          <div
            key={setor}
            className={`w-12 px-2 py-2 text-center border-r border-white/10 transition-colors ${
              isFocused
                ? 'bg-violet-500/10'
                : isDistributed
                  ? 'bg-emerald-500/10'
                  : ''
            }`}
            title={isDistributed ? `${doc.codigo} distribuído para ${setor}` : ''}
          >
            {isDistributed && <span className="text-emerald-400 font-bold">✓</span>}
          </div>
        );
      })}
    </div>
  );
}
