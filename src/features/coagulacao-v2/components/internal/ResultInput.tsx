interface ResultInputProps {
  label: string;
  value: number | undefined;
  unit: string;
  expectedRange: string;
  onChange: (value: number | undefined) => void;
}

export function ResultInput({ label, value, unit, expectedRange, onChange }: ResultInputProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-48 text-sm text-zinc-300">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-24 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-right text-sm text-white focus:border-amber-500 focus:outline-none"
        />
        <span className="text-sm text-zinc-500">{unit}</span>
      </div>
      <span className="text-xs text-zinc-600">esperado: {expectedRange}</span>
    </div>
  );
}
