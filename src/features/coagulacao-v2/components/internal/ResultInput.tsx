interface ResultInputProps {
  label: string;
  value: number | undefined;
  unit: string;
  expectedRange: string;
  onChange: (value: number | undefined) => void;
}

export function ResultInput({ label, value, unit, expectedRange, onChange }: ResultInputProps) {
  return (
    <div className="flex items-baseline gap-6 border-b border-[var(--cl-border)] py-4">
      <label className="w-56 text-base font-medium text-[var(--cl-text-body)]">
        {label}
      </label>

      <div className="flex items-baseline gap-2">
        <input
          type="number"
          step="any"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-32 border-b border-transparent bg-transparent text-right font-mono text-3xl tabular-nums text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none"
          placeholder="—"
          autoComplete="off"
        />
        {unit && <span className="text-base text-[var(--cl-text-muted)]">{unit}</span>}
      </div>

      <div className="ml-auto flex items-baseline gap-2 text-sm text-[var(--cl-text-faint)]">
        <span className="tabular-nums">{expectedRange}</span>
      </div>
    </div>
  );
}
