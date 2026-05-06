/**
 * src/features/sgq/components/importer/PreviewBatchStep.tsx
 *
 * Step 3: Preview and automatically classify documents
 */

import React, { useState } from 'react';

export interface PreviewBatchStepProps {
  labId: string;
  onNext: () => void;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function PreviewBatchStep({
  labId,
  onNext,
  onError,
  isLoading,
  setIsLoading,
}: PreviewBatchStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-2">
          Previsualizando documentos
        </h3>
        <p className="text-sm text-neutral-400">
          Carregando preview e classificação automática de cada documento...
        </p>
      </div>

      <div className="space-y-2">
        <div className="bg-neutral-900 border border-neutral-800 rounded p-4 text-center py-12">
          <p className="text-neutral-400 text-sm">Documentos serão previsualizados aqui</p>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
      >
        Revisar classificações
      </button>
    </div>
  );
}
