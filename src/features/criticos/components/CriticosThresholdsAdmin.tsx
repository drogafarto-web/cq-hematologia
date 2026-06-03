/**
 * CriticosThresholdsAdmin
 *
 * RT/admin/owner CRUD for critical-value thresholds.
 * RDC 978/2025 Art. 167 — RT is the authority for defining critical values.
 *
 * Design: dark-first, editorial typography, tabular-nums in numeric grid.
 * Server enforces uniqueness (analyteId, ageGroup, sex). UI surfaces the
 * server's error verbatim so the operator understands collisions.
 */

import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Field,
  IconClose,
  IconEdit,
  IconPlus,
  Skeleton,
  inputClass,
  selectClass,
} from './_ui';
import {
  useCriticosThresholds,
  type AgeGroup,
  type CriticosThresholdRecord,
  type Sex,
  type CreateThresholdInput,
  type UpdateThresholdInput,
} from '../hooks/useCriticosThresholds';

const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: 'ALL', label: 'Todas as faixas' },
  { value: 'NEONATE', label: 'Neonato (0–28 d)' },
  { value: 'INFANT', label: 'Lactente (29 d – 1 a)' },
  { value: 'CHILD', label: 'Criança (1–11 a)' },
  { value: 'ADOLESCENT', label: 'Adolescente (12–17 a)' },
  { value: 'ADULT', label: 'Adulto (18–64 a)' },
  { value: 'ELDERLY', label: 'Idoso (65+)' },
];

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
];

function ageLabel(value: AgeGroup): string {
  return AGE_GROUPS.find((g) => g.value === value)?.label ?? value;
}

function sexLabel(value: Sex): string {
  return SEX_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

export function CriticosThresholdsAdmin() {
  const { thresholds, isLoading, error, create, update, refresh } = useCriticosThresholds();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CriticosThresholdRecord | null>(null);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (rec: CriticosThresholdRecord) => {
    setEditing(rec);
    setEditorOpen(true);
  };
  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-white">Limites críticos</h2>
          <p className="mt-1 text-xs text-white/50">
            Configuração por analito · faixa etária · sexo. Editável apenas por RT, admin ou owner.
            Auditado automaticamente.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} aria-label="Adicionar threshold">
          <IconPlus />
          Novo threshold
        </Button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-200"
        >
          <p className="font-medium">Falha ao carregar</p>
          <p className="mt-1 text-red-300/80">{error.message}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 text-xs underline-offset-2 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {isLoading ? (
        <ThresholdSkeleton />
      ) : thresholds.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <ThresholdGrid items={thresholds} onEdit={openEdit} />
      )}

      {editorOpen && (
        <ThresholdEditor
          existing={editing}
          onClose={closeEditor}
          onCreate={create}
          onUpdate={update}
        />
      )}
    </div>
  );
}

// ─── Grid ───────────────────────────────────────────────────────────────────

function ThresholdGrid({
  items,
  onEdit,
}: {
  items: CriticosThresholdRecord[];
  onEdit: (rec: CriticosThresholdRecord) => void;
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wide text-white/50">
              <th className="px-4 py-3 font-medium">Analito</th>
              <th className="px-4 py-3 font-medium">Faixa</th>
              <th className="px-4 py-3 font-medium">Sexo</th>
              <th className="px-4 py-3 text-right font-medium">Pânico baixo</th>
              <th className="px-4 py-3 text-right font-medium">Crítico baixo</th>
              <th className="px-4 py-3 text-right font-medium">Crítico alto</th>
              <th className="px-4 py-3 text-right font-medium">Pânico alto</th>
              <th className="px-4 py-3 font-medium">Unidade</th>
              <th className="px-4 py-3 sr-only">Ações</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {items.map((t) => (
              <tr
                key={t.id}
                className="border-b border-white/[0.04] transition-colors duration-150 hover:bg-white/[0.02] motion-reduce:transition-none"
              >
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-white">{t.analyteName}</div>
                  <div className="font-mono text-[11px] text-white/40">{t.analyteId}</div>
                </td>
                <td className="px-4 py-3 align-top text-white/70">{ageLabel(t.ageGroup)}</td>
                <td className="px-4 py-3 align-top text-white/70">{sexLabel(t.sex)}</td>
                <td className="px-4 py-3 text-right align-top">{fmt(t.panicLow, 'panic')}</td>
                <td className="px-4 py-3 text-right align-top">
                  {fmt(t.lowThreshold, 'critical')}
                </td>
                <td className="px-4 py-3 text-right align-top">
                  {fmt(t.highThreshold, 'critical')}
                </td>
                <td className="px-4 py-3 text-right align-top">{fmt(t.panicHigh, 'panic')}</td>
                <td className="px-4 py-3 align-top text-white/60">{t.unit}</td>
                <td className="px-4 py-3 align-top text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-white/70 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 motion-reduce:transition-none"
                    aria-label={`Editar threshold de ${t.analyteName}`}
                  >
                    <IconEdit className="h-3.5 w-3.5" />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function fmt(v: number | null, kind: 'panic' | 'critical'): React.ReactNode {
  if (v === null || v === undefined) {
    return <span className="text-white/25">—</span>;
  }
  const cls = kind === 'panic' ? 'text-red-300' : 'text-amber-300';
  return <span className={cls}>{v}</span>;
}

// ─── Empty / Skeleton ───────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-300">
        <IconPlus className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-white">Nenhum threshold configurado</p>
      <p className="mt-1 text-xs text-white/50">
        Defina os limites críticos por analito para que o sistema dispare comunicação automática
        quando um resultado violar o intervalo.
      </p>
      <div className="mt-6">
        <Button variant="primary" onClick={onCreate}>
          <IconPlus />
          Adicionar primeiro threshold
        </Button>
      </div>
    </Card>
  );
}

function ThresholdSkeleton() {
  return (
    <Card className="p-4 space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </Card>
  );
}

// ─── Editor (modal) ─────────────────────────────────────────────────────────

interface EditorProps {
  existing: CriticosThresholdRecord | null;
  onClose: () => void;
  onCreate: (input: CreateThresholdInput) => Promise<CriticosThresholdRecord>;
  onUpdate: (input: UpdateThresholdInput) => Promise<CriticosThresholdRecord>;
}

interface FormState {
  analyteId: string;
  analyteName: string;
  unit: string;
  ageGroup: AgeGroup;
  sex: Sex;
  panicLow: string;
  lowThreshold: string;
  highThreshold: string;
  panicHigh: string;
  notas: string;
}

function ThresholdEditor({ existing, onClose, onCreate, onUpdate }: EditorProps) {
  const isEdit = existing !== null;

  const initial: FormState = useMemo(() => {
    if (!existing) {
      return {
        analyteId: '',
        analyteName: '',
        unit: '',
        ageGroup: 'ADULT',
        sex: 'ALL',
        panicLow: '',
        lowThreshold: '',
        highThreshold: '',
        panicHigh: '',
        notas: '',
      };
    }
    return {
      analyteId: existing.analyteId,
      analyteName: existing.analyteName,
      unit: existing.unit,
      ageGroup: existing.ageGroup,
      sex: existing.sex,
      panicLow: existing.panicLow?.toString() ?? '',
      lowThreshold: existing.lowThreshold?.toString() ?? '',
      highThreshold: existing.highThreshold?.toString() ?? '',
      panicHigh: existing.panicHigh?.toString() ?? '',
      notas: existing.notas ?? '',
    };
  }, [existing]);

  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const parseNum = (s: string): number | undefined => {
    if (s.trim() === '') return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && existing) {
        // Build update — null = explicit clear, undefined = no change.
        const updateInput: UpdateThresholdInput = {
          thresholdId: existing.id,
          unit: form.unit !== existing.unit ? form.unit : undefined,
          notas: form.notas === (existing.notas ?? '') ? undefined : form.notas || null,
          panicLow: form.panicLow === '' ? null : (parseNum(form.panicLow) ?? null),
          lowThreshold: form.lowThreshold === '' ? null : (parseNum(form.lowThreshold) ?? null),
          highThreshold: form.highThreshold === '' ? null : (parseNum(form.highThreshold) ?? null),
          panicHigh: form.panicHigh === '' ? null : (parseNum(form.panicHigh) ?? null),
        };
        await onUpdate(updateInput);
      } else {
        const createInput: CreateThresholdInput = {
          analyteId: form.analyteId.trim(),
          analyteName: form.analyteName.trim(),
          unit: form.unit.trim(),
          ageGroup: form.ageGroup,
          sex: form.sex,
          panicLow: parseNum(form.panicLow),
          lowThreshold: parseNum(form.lowThreshold),
          highThreshold: parseNum(form.highThreshold),
          panicHigh: parseNum(form.panicHigh),
          notas: form.notas.trim() || undefined,
        };
        await onCreate(createInput);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="th-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-xl rounded-xl border border-white/[0.08] bg-[#141417] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 id="th-editor-title" className="text-[15px] font-semibold tracking-tight text-white">
            {isEdit ? 'Editar threshold' : 'Novo threshold'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/50 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 motion-reduce:transition-none"
            aria-label="Fechar"
          >
            <IconClose />
          </button>
        </header>

        <div className="space-y-4 px-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="ID do analito"
              htmlFor="th-analyteId"
              hint={isEdit ? 'Imutável após criação' : 'Ex.: K, NA, GLU. Sem espaços.'}
            >
              <input
                id="th-analyteId"
                aria-label="ID do analito"
                className={inputClass}
                value={form.analyteId}
                onChange={(e) => setField('analyteId', e.target.value)}
                required
                disabled={isEdit}
                pattern="[A-Za-z0-9_-]+"
                maxLength={64}
              />
            </Field>
            <Field label="Nome legível" htmlFor="th-analyteName">
              <input
                id="th-analyteName"
                aria-label="Nome do analito"
                className={inputClass}
                value={form.analyteName}
                onChange={(e) => setField('analyteName', e.target.value)}
                required
                disabled={isEdit}
                maxLength={120}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Faixa etária" htmlFor="th-age">
              <select
                id="th-age"
                aria-label="Faixa etária"
                className={selectClass}
                value={form.ageGroup}
                onChange={(e) => setField('ageGroup', e.target.value as AgeGroup)}
                disabled={isEdit}
              >
                {AGE_GROUPS.map((g) => (
                  <option key={g.value} value={g.value} className="bg-[#141417]">
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sexo" htmlFor="th-sex">
              <select
                id="th-sex"
                aria-label="Sexo"
                className={selectClass}
                value={form.sex}
                onChange={(e) => setField('sex', e.target.value as Sex)}
                disabled={isEdit}
              >
                {SEX_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#141417]">
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unidade" htmlFor="th-unit" hint="Ex.: mg/dL, mmol/L">
              <input
                id="th-unit"
                aria-label="Unidade"
                className={inputClass}
                value={form.unit}
                onChange={(e) => setField('unit', e.target.value)}
                required
                maxLength={32}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wide text-white/50">
              Limites · ordem requerida: pânico ≤ crítico ≤ crítico ≤ pânico
            </p>
            <div className="grid grid-cols-4 gap-4">
              <Field label="Pânico baixo" htmlFor="th-pl">
                <input
                  id="th-pl"
                  aria-label="Pânico baixo"
                  type="number"
                  step="any"
                  className={inputClass + ' tabular-nums'}
                  value={form.panicLow}
                  onChange={(e) => setField('panicLow', e.target.value)}
                  placeholder="—"
                />
              </Field>
              <Field label="Crítico baixo" htmlFor="th-lt">
                <input
                  id="th-lt"
                  aria-label="Crítico baixo"
                  type="number"
                  step="any"
                  className={inputClass + ' tabular-nums'}
                  value={form.lowThreshold}
                  onChange={(e) => setField('lowThreshold', e.target.value)}
                  placeholder="—"
                />
              </Field>
              <Field label="Crítico alto" htmlFor="th-ht">
                <input
                  id="th-ht"
                  aria-label="Crítico alto"
                  type="number"
                  step="any"
                  className={inputClass + ' tabular-nums'}
                  value={form.highThreshold}
                  onChange={(e) => setField('highThreshold', e.target.value)}
                  placeholder="—"
                />
              </Field>
              <Field label="Pânico alto" htmlFor="th-ph">
                <input
                  id="th-ph"
                  aria-label="Pânico alto"
                  type="number"
                  step="any"
                  className={inputClass + ' tabular-nums'}
                  value={form.panicHigh}
                  onChange={(e) => setField('panicHigh', e.target.value)}
                  placeholder="—"
                />
              </Field>
            </div>
          </div>

          <Field label="Notas (opcional)" htmlFor="th-notas">
            <textarea
              id="th-notas"
              aria-label="Notas"
              className={inputClass + ' min-h-[64px] resize-y'}
              value={form.notas}
              onChange={(e) => setField('notas', e.target.value)}
              maxLength={500}
            />
          </Field>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-200"
            >
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={submitting}
            aria-label={isEdit ? 'Salvar alterações' : 'Criar threshold'}
          >
            {submitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar threshold'}
          </Button>
        </footer>
      </form>
    </div>
  );
}
