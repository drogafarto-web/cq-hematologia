/**
 * DocumentosObrigatoriosBadge — strip de status de documentos obrigatórios.
 *
 * Renderiza um conjunto de documentos obrigatórios (POL-LGPD-001, IT-LGPD-DPIA-001)
 * com status visual (verde = vigente, amarelo = em_revisao, vermelho = faltando).
 *
 * Colocado no header do SGQView, abaixo dos KPIs, acima dos filtros.
 * Clique navega para o documento na tabela ou abre modal em modo view.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { useDocumentos } from '../hooks/useDocumentos';
import { DocumentoFormModal } from './DocumentoFormModal';
import type { Documento } from '../types/Documento';

interface DocumentoObrigatorio {
  codigo: string;
  label: string;
}

const DOCUMENTOS_OBRIGATORIOS: DocumentoObrigatorio[] = [
  {
    codigo: 'POL-LGPD-001',
    label: 'Política de Privacidade (LGPD)',
  },
  {
    codigo: 'IT-LGPD-DPIA-001',
    label: 'Template DPIA (LGPD)',
  },
];

export function DocumentosObrigatoriosBadge() {
  const { documentos } = useDocumentos({
    filters: { includeObsoletos: false },
  });

  // Map of codigo → latest vigente document
  const docMap = useMemo(() => {
    const map = new Map<string, Documento>();

    for (const doc of documentos) {
      if (doc.status === 'vigente') {
        const existing = map.get(doc.codigo);
        // Keep the highest version
        if (!existing || doc.versao > existing.versao) {
          map.set(doc.codigo, doc);
        }
      }
    }

    return map;
  }, [documentos]);

  // Determine status for each required document
  const items = useMemo(() => {
    return DOCUMENTOS_OBRIGATORIOS.map((req) => {
      const doc = docMap.get(req.codigo);
      return {
        ...req,
        doc,
        status: doc ? ('vigente' as const) : ('missing' as const),
      };
    });
  }, [docMap]);

  if (items.every((item) => item.status === 'vigente')) {
    // All mandatory docs vigentes — show only a check
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <CheckIcon />
        <span className="text-sm font-medium text-emerald-400">
          Documentos obrigatórios vigentes
        </span>
      </div>
    );
  }

  // Show status breakdown
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <BadgeChip
            key={item.codigo}
            doc={item.doc}
            label={item.label}
            codigo={item.codigo}
          />
        ))}
      </div>
    </div>
  );
}

interface BadgeChipProps {
  doc: Documento | undefined;
  label: string;
  codigo: string;
}

function BadgeChip({ doc, label, codigo }: BadgeChipProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = useCallback(() => {
    if (doc) {
      setShowModal(true);
    }
  }, [doc]);

  const isVigente = doc?.status === 'vigente';
  const isMissing = !doc;

  const bgColor = isVigente ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'bg-red-500/10 hover:bg-red-500/15';
  const borderColor = isVigente ? 'border-emerald-500/30' : 'border-red-500/30';
  const textColor = isVigente ? 'text-emerald-400' : 'text-red-400';
  const cursorStyle = doc ? 'cursor-pointer' : 'cursor-default';

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors 150ms ${bgColor} ${borderColor} ${cursorStyle}`}
        onClick={handleClick}
      >
        {isVigente ? (
          <>
            <CheckIcon className="w-4 h-4" />
            <span className={`text-xs font-mono font-semibold ${textColor}`}>
              v{doc!.versao}
            </span>
          </>
        ) : (
          <>
            <XIcon className="w-4 h-4" />
            <span className={`text-xs font-semibold ${textColor}`}>Faltando</span>
          </>
        )}
      </div>
      <div className={`text-xs ${textColor} ml-2`}>{label}</div>

      {showModal && doc && (
        <DocumentoFormModal
          documento={doc}
          onClose={() => setShowModal(false)}
          onSubmit={async () => {}}
        />
      )}
    </>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className={className}
    >
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className={className}
    >
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
