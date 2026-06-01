interface ResultInputProps {
  label: string;
  value: number | undefined;
  unit: string;
  expectedRange: string;
  onChange: (value: number | undefined) => void;
}

export function ResultInput({ label, value, unit, expectedRange, onChange }: ResultInputProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-6 border-b border-[var(--cl-border)] py-4 sm:py-6">
      <label className="w-full sm:w-56 text-base font-medium text-[var(--cl-text-body)]">
        {label}
      </label>

      <div className="flex flex-1 items-baseline gap-2 sm:items-center">
        <input
          type="number"
          step="any"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full sm:w-32 border-b border-transparent bg-transparent text-right font-mono text-2xl sm:text-3xl tabular-nums text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none py-1 sm:py-0"
          placeholder="—"
          autoComplete="off"
        />
        {unit && <span className="text-base text-[var(--cl-text-muted)]">{unit}</span>}
      </div>

      <div className="ml-0 sm:ml-auto flex items-baseline gap-2 text-sm text-[var(--cl-text-faint)]">
        <span className="tabular-nums">{expectedRange}</span>
      </div>
    </div>
  );
}
