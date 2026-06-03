/**
 * src/features/sgq/components/importer/MappingEditor.tsx
 *
 * Step 4: Edit document classifications and metadata before import
 */

import React from 'react';

export interface MappingEditorProps {
  labId: string;
  onNext: () => void;
  onError: (error: string) => void;
}

export function MappingEditor({ labId, onNext, onError }: MappingEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-2">Revisar e editar classificações</h3>
        <p className="text-sm text-neutral-400">
          Você pode editar o tipo, setor e outros metadados de cada documento.
        </p>
      </div>

      <div className="space-y-2">
        <div className="bg-neutral-900 border border-neutral-800 rounded p-4 text-center py-12">
          <p className="text-neutral-400 text-sm">Editor de mapeamento será exibido aqui</p>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded font-medium transition-colors"
      >
        Confirmar importação
      </button>
    </div>
  );
}
