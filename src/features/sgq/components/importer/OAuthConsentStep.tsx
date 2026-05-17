/**
 * src/features/sgq/components/importer/OAuthConsentStep.tsx
 *
 * Step 1: Explain OAuth scopes and initiate authorization flow
 */

import React from 'react';
import { initiateOAuthFlow } from '../../services/driveImportService';

export interface OAuthConsentStepProps {
  labId: string;
  onNext: () => void;
}

export function OAuthConsentStep({
  labId,
  onNext,
}: OAuthConsentStepProps) {
  const handleAuthorize = () => {
    const authUrl = initiateOAuthFlow(labId);
    window.location.href = authUrl;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-2">
          Autorizar acesso ao Google Drive
        </h3>
        <p className="text-sm text-neutral-400">
          Para gerenciar documentos, precisamos acessar seu Google Drive e Google Docs.
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
        <h4 className="font-medium text-white text-sm">Permissões solicitadas:</h4>
        <ul className="space-y-1 text-sm text-neutral-400">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>Leitura de arquivos do Drive</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>Visualização de metadados (nome, tamanho, última modificação)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>Criar e editar documentos do Google Docs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>Gerenciar arquivos criados pelo HC Quality</span>
          </li>
        </ul>
      </div>

      <div className="bg-blue-900/20 border border-blue-900/50 rounded p-4">
        <p className="text-xs text-blue-300">
          Sua autenticação é segura. Usamos OAuth 2.0 com tokens armazenados encriptados.
          O acesso pode ser revogado a qualquer momento nas configurações do Google.
        </p>
      </div>

      <button
        onClick={handleAuthorize}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
      >
        Autorizar Drive
      </button>
    </div>
  );
}
