/**
 * src/features/sgq/components/importer/ImporterWizard.tsx
 *
 * 5-step wizard for importing documents from Google Drive
 *
 * Step 1: OAuth Consent — explain scopes
 * Step 2: Drive List — show matched documents
 * Step 3: Preview Batch — preview + classify
 * Step 4: Mapping Editor — edit classification/setores
 * Step 5: Confirm — final review + import
 */

import React, { useState } from 'react';
import { OAuthConsentStep } from './OAuthConsentStep';
import { DriveListStep } from './DriveListStep';
import { PreviewBatchStep } from './PreviewBatchStep';
import { MappingEditor } from './MappingEditor';
import { ConfirmStep } from './ConfirmStep';

type WizardStep = 'consent' | 'list' | 'preview' | 'mapping' | 'confirm';

export interface ImporterWizardProps {
  labId: string;
  onClose: () => void;
  onSuccess: (importJobId: string, count: number) => void;
}

export function ImporterWizard({
  labId,
  onClose,
  onSuccess,
}: ImporterWizardProps) {
  const [step, setStep] = useState<WizardStep>('consent');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    const steps: WizardStep[] = [
      'consent',
      'list',
      'preview',
      'mapping',
      'confirm',
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    const steps: WizardStep[] = [
      'consent',
      'list',
      'preview',
      'mapping',
      'confirm',
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Importar documentos do Drive
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Passo {['consent', 'list', 'preview', 'mapping', 'confirm'].indexOf(step) + 1} de 5
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 'consent' && (
            <OAuthConsentStep labId={labId} onNext={handleNext} />
          )}
          {step === 'list' && (
            <DriveListStep
              labId={labId}
              onNext={handleNext}
              onError={setError}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
          {step === 'preview' && (
            <PreviewBatchStep
              labId={labId}
              onNext={handleNext}
              onError={setError}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
          {step === 'mapping' && (
            <MappingEditor
              labId={labId}
              onNext={handleNext}
              onError={setError}
            />
          )}
          {step === 'confirm' && (
            <ConfirmStep
              labId={labId}
              onSuccess={onSuccess}
              onError={setError}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-800 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={step === 'consent' || isLoading}
            className="px-4 py-2 text-neutral-300 hover:text-white disabled:opacity-50 transition-colors"
          >
            ← Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={step === 'confirm' || isLoading}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded transition-colors"
          >
            Próximo →
          </button>
        </div>
      </div>
    </div>
  );
}
