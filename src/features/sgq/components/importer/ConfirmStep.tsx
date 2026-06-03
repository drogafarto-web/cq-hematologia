/**
 * src/features/sgq/components/importer/ConfirmStep.tsx
 *
 * Step 5: Final confirmation and batch import
 */

import React, { useState } from 'react';
import { aprovarBatchImport } from '../../services/driveImportService';

export interface ConfirmStepProps {
  labId: string;
  onSuccess: (importJobId: string, count: number) => void;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function ConfirmStep({
  labId,
  onSuccess,
  onError,
  isLoading,
  setIsLoading,
}: ConfirmStepProps) {
  const [importProgress, setImportProgress] = useState(0);

  const handleImport = async () => {
    try {
      setIsLoading(true);
      // TODO: Get docs from wizard state
      const result = await aprovarBatchImport(labId, []);
      onSuccess(result.importJobId, result.importedCount);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-2">Pronto para importar</h3>
        <p className="text-sm text-neutral-400">
          Revise o resumo e confirme a importação dos documentos.
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Total de documentos:</span>
          <span className="text-white font-medium">— documentos</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Status final:</span>
          <span className="text-white">Em revisão (aguardando aprovação RT)</span>
        </div>
      </div>

      {importProgress > 0 && (
        <div className="space-y-2">
          <div className="w-full bg-neutral-800 rounded h-2 overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-xs text-neutral-400 text-center">{importProgress}% completo</p>
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
      >
        {isLoading ? 'Importando...' : 'Importar agora'}
      </button>
    </div>
  );
}
