import { useState } from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { useTheme } from '../../../shared/hooks/useTheme';
import { useControlOperacional } from '../hooks/useControlOperacional';
import { AttemptForm } from './AttemptForm';
import { ControlHub } from './ControlHub';

type Tab = 'tentativa' | 'controles';

export function CoagulacaoV2View() {
  const lab = useActiveLab();
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const { isDark } = useTheme();
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>('tentativa');

  const wrapperCls = `coag-clinical${isDark ? '' : ' coag-light'}`;

  if (!lab) {
    return <div className={`${wrapperCls} p-8 text-[var(--cl-text-muted)]`}>Selecione um laboratório</div>;
  }

  if (saved) {
    return (
      <div className={`${wrapperCls} mx-auto max-w-2xl p-8`}>
        <div className="rounded-lg border border-[var(--cl-success)]/30 bg-[var(--cl-success-bg)] p-6 text-center">
          <p className="mb-4 text-lg text-[var(--cl-success)]">Execução registrada</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setSaved(false)}
              className="rounded bg-[var(--cl-accent)] px-4 py-2 text-sm font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)]"
            >
              Nova execução
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('hub')}
              className="rounded border border-[var(--cl-border)] px-4 py-2 text-sm text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)]"
            >
              Voltar ao painel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${wrapperCls} mx-auto max-w-2xl p-8`}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-medium text-[var(--cl-text-strong)]">Coagulação</h1>
        <span className="text-xs text-[var(--cl-text-faint)]">Controle interno de qualidade</span>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] p-1">
        <TabButton active={tab === 'tentativa'} onClick={() => setTab('tentativa')}>
          Execução
        </TabButton>
        <TabButton active={tab === 'controles'} onClick={() => setTab('controles')}>
          <ControlesLabel labId={lab.id} />
        </TabButton>
      </div>

      {tab === 'tentativa' && (
        <AttemptForm
          labId={lab.id}
          onSaved={() => setSaved(true)}
          onCancel={() => setCurrentView('hub')}
        />
      )}

      {tab === 'controles' && <ControlHub labId={lab.id} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--cl-card-elevated)] text-[var(--cl-text-strong)]'
          : 'text-[var(--cl-text-muted)] hover:text-[var(--cl-text-body)]'
      }`}
    >
      {children}
    </button>
  );
}

function ControlesLabel({ labId }: { labId: string }) {
  const { controls, isLoading } = useControlOperacional(labId);
  const activeCount = controls.filter((c) => c.status === 'ativo').length;
  return (
    <span>
      Lotes em uso
      {!isLoading && activeCount > 0 && (
        <span className="ml-1 text-xs text-[var(--cl-accent)]">({activeCount})</span>
      )}
    </span>
  );
}
