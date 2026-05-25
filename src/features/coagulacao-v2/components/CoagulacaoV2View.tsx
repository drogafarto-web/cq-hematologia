import { useState } from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { AttemptForm } from './AttemptForm';

export function CoagulacaoV2View() {
  const lab = useActiveLab();
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const [saved, setSaved] = useState(false);

  if (!lab) {
    return <div className="p-8 text-zinc-500">Selecione um laboratório</div>;
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-emerald-700 bg-emerald-900/20 p-6 text-center">
          <p className="mb-4 text-lg text-emerald-400">Tentativa salva com sucesso</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setSaved(false)}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
            >
              Nova tentativa
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('hub')}
              className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Voltar ao hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-medium text-white">Coagulação v2</h1>
        <span className="text-xs text-zinc-600">Controle Interno de Qualidade</span>
      </div>
      <AttemptForm
        labId={lab.id}
        onSaved={() => setSaved(true)}
        onCancel={() => setCurrentView('hub')}
      />
    </div>
  );
}
