import { useState } from 'react';
import { EscalaTab } from './EscalaTab';
import { RegistrosTab } from './RegistrosTab';
import { CoberturaTab } from './CoberturaTab';
import { useEscalas } from '../hooks/useEscalas';
import { useTurnos } from '../hooks/useTurnos';

type Tab = 'escala' | 'registros' | 'cobertura';

export function TurnosShell() {
  const [activeTab, setActiveTab] = useState<Tab>('escala');
  const { alertasCount } = useEscalas();
  const { turnos } = useTurnos();

  const registrosCount = turnos.filter((t) => !t.deletadoEm).length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'escala', label: 'Escala', count: 7 },
    { id: 'registros', label: 'Registros', count: registrosCount },
    { id: 'cobertura', label: 'Cobertura' },
  ];

  return (
    <main className="min-h-screen" style={{ background: 'var(--surface-page, #0B0F14)' }}>
      {/* PageHeader */}
      <div
        className="sticky top-0 z-30 backdrop-blur-sm"
        style={{
          background: 'color-mix(in srgb, var(--surface-page, #0B0F14) 95%, transparent)',
          borderBottom: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        }}
      >
        <div className="mx-auto max-w-7xl px-8 pt-6 pb-0">
          <h1
            className="font-semibold"
            style={{
              fontSize: '20px',
              letterSpacing: '-0.02em',
              color: 'var(--text-strong, #fff)',
            }}
          >
            Turnos e Supervisão
          </h1>
          <p className="mt-1" style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>
            RDC 978 Art. 122 · Planejamento e registro de cobertura RT
          </p>

          {/* Alert banner */}
          {alertasCount > 0 && (
            <div
              className="mt-4 flex items-center gap-3 rounded-lg px-4 py-3"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
              role="alert"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full animate-pulse"
                style={{ background: 'var(--danger-500, #EF4444)' }}
                aria-hidden="true"
              />
              <p style={{ fontSize: '13px', color: 'rgba(239, 68, 68, 0.9)' }}>
                <span className="font-medium">
                  {alertasCount} dia{alertasCount !== 1 ? 's' : ''}
                </span>{' '}
                sem cobertura RT nesta semana.
              </p>
            </div>
          )}

          {/* Tabs */}
          <nav className="mt-6 flex gap-6" role="tablist" aria-label="Seções de turnos">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className="relative pb-3 transition-colors"
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color:
                    activeTab === tab.id
                      ? 'var(--text-strong, #fff)'
                      : 'var(--text-muted, #94A3B8)',
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center rounded px-1.5"
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      background:
                        activeTab === tab.id ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255,255,255,0.06)',
                      color:
                        activeTab === tab.id
                          ? 'var(--accent-400, #60A5FA)'
                          : 'var(--text-faint, #64748B)',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--accent-600, #2563EB)' }}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-8 py-6">
        <div id="panel-escala" role="tabpanel" hidden={activeTab !== 'escala'}>
          {activeTab === 'escala' && <EscalaTab />}
        </div>
        <div id="panel-registros" role="tabpanel" hidden={activeTab !== 'registros'}>
          {activeTab === 'registros' && <RegistrosTab />}
        </div>
        <div id="panel-cobertura" role="tabpanel" hidden={activeTab !== 'cobertura'}>
          {activeTab === 'cobertura' && <CoberturaTab />}
        </div>
      </div>
    </main>
  );
}
