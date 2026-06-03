/**
 * src/features/sgq/components/importer/DriveListStep.tsx
 *
 * Step 2: List documents from Drive matching LM-01
 */

import React, { useState, useEffect } from 'react';
import { listarDocsDrive } from '../../services/driveImportService';

export interface DriveListStepProps {
  labId: string;
  onNext: () => void;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const LM01_SHEET_ID = 'RIOPOMBA_LM01_SHEET_ID'; // TODO: Get from lab config

export function DriveListStep({
  labId,
  onNext,
  onError,
  isLoading,
  setIsLoading,
}: DriveListStepProps) {
  const [matched, setMatched] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        setIsLoading(true);
        const result = await listarDocsDrive(labId, LM01_SHEET_ID);
        setMatched(result.matched);
        setGaps(result.gaps);
        setTotal(result.totalLM01);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to list documents');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocs();
  }, [labId, onError, setIsLoading]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-2">Documentos encontrados no Drive</h3>
        <p className="text-sm text-neutral-400">
          {matched.length} de {total} documentos da Lista Mestra foram encontrados no Drive
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-neutral-400">Buscando documentos...</p>
        </div>
      ) : (
        <>
          {/* Matched documents */}
          {matched.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-green-400 text-sm">✓ {matched.length} encontrados</h4>
              <div className="bg-neutral-900 border border-neutral-800 rounded max-h-48 overflow-y-auto">
                {matched.slice(0, 10).map((doc) => (
                  <div
                    key={doc.driveFileId}
                    className="p-2 border-b border-neutral-800 last:border-b-0 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white">{doc.codigo}</div>
                        <div className="text-neutral-400 text-xs">{doc.driveName}</div>
                      </div>
                      <div className="text-neutral-500 text-xs">{doc.tipo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {gaps.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-yellow-600 text-sm">
                ⚠ {gaps.length} não encontrados
              </h4>
              <div className="bg-neutral-900 border border-neutral-800 rounded max-h-32 overflow-y-auto">
                {gaps.slice(0, 5).map((gap) => (
                  <div
                    key={gap.codigo}
                    className="p-2 border-b border-neutral-800 last:border-b-0 text-xs text-yellow-600"
                  >
                    {gap.codigo} — {gap.titulo}
                  </div>
                ))}
                {gaps.length > 5 && (
                  <div className="p-2 text-xs text-neutral-500">+ {gaps.length - 5} mais...</div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={onNext}
            disabled={matched.length === 0}
            className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
          >
            Continuar com {matched.length} documento(s)
          </button>
        </>
      )}
    </div>
  );
}
