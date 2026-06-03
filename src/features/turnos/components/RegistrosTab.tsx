import { useState } from 'react';
import { useTurnos } from '../hooks/useTurnos';
import { TurnoForm } from './TurnoForm';
import type { Turno } from '../types/Turno';

const PERIODO_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  plantao: 'Plantão',
};

export function RegistrosTab() {
  const { turnos, isLoading } = useTurnos();
  const [showForm, setShowForm] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<Turno | undefined>(undefined);

  const nonDeleted = turnos.filter((t) => !t.deletadoEm);

  const handleEdit = (turno: Turno) => {
    setSelectedTurno(turno);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>
          {nonDeleted.length} registro{nonDeleted.length !== 1 ? 's' : ''} de supervisão
        </p>
        <button
          type="button"
          onClick={() => {
            setSelectedTurno(undefined);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors"
          style={{ fontSize: '12px', background: 'var(--accent-600, #2563EB)', color: '#fff' }}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Turno
        </button>
      </div>

      {/* Table */}
      {isLoading && nonDeleted.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg"
              style={{ background: 'var(--surface-muted, #161B23)' }}
            />
          ))}
        </div>
      ) : nonDeleted.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl py-16"
          style={{
            background: 'var(--surface-card, #11161D)',
            border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
          }}
        >
          <svg
            className="mb-3 h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
            style={{ color: 'var(--text-faint, #64748B)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>
            Nenhum turno registrado ainda.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-faint, #64748B)' }}>
            Registre a supervisão efetiva de cada período.
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: 'var(--surface-card, #11161D)',
            border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
          }}
        >
          <table className="w-full">
            <thead>
              <tr
                style={{ borderBottom: '1px solid var(--border-hairline, rgba(255,255,255,0.04))' }}
              >
                {['Data', 'Período', 'Supervisor', 'CRBM', 'Status'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left font-semibold uppercase"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.06em',
                      color: 'var(--text-faint, #64748B)',
                      background: 'var(--surface-card, #11161D)',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nonDeleted.map((turno) => (
                <tr
                  key={turno.id}
                  onClick={() => handleEdit(turno)}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border-hairline, rgba(255,255,255,0.04))',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(37,99,235,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '';
                  }}
                >
                  <td
                    className="px-4 py-2.5"
                    style={{
                      fontSize: '13px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 500,
                      color: 'var(--text-body, rgba(255,255,255,0.82))',
                    }}
                  >
                    {turno.data}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex rounded px-2 py-0.5"
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        background: 'rgba(37,99,235,0.1)',
                        color: 'var(--accent-400, #60A5FA)',
                      }}
                    >
                      {PERIODO_LABELS[turno.periodo] ?? turno.periodo}
                    </span>
                  </td>
                  <td
                    className="px-4 py-2.5"
                    style={{ fontSize: '13px', color: 'var(--text-body, rgba(255,255,255,0.82))' }}
                  >
                    {turno.supervisorName}
                  </td>
                  <td
                    className="px-4 py-2.5"
                    style={{
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--text-muted, #94A3B8)',
                    }}
                  >
                    {turno.supervisorCRBM || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 rounded px-2 py-0.5"
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        background: turno.inferred
                          ? 'rgba(245,158,11,0.1)'
                          : 'rgba(16,185,129,0.1)',
                        color: turno.inferred
                          ? 'var(--warning-500, #F59E0B)'
                          : 'var(--success-500, #10B981)',
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: turno.inferred
                            ? 'var(--warning-500, #F59E0B)'
                            : 'var(--success-500, #10B981)',
                        }}
                      />
                      {turno.inferred ? 'Inferido' : 'Registrado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Drawer */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setSelectedTurno(undefined);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--surface-card, #11161D)',
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
            }}
          >
            <TurnoForm
              turnoId={selectedTurno?.id}
              onClose={() => {
                setShowForm(false);
                setSelectedTurno(undefined);
              }}
              onSuccess={() => {
                setShowForm(false);
                setSelectedTurno(undefined);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
