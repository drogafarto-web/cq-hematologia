interface ConformityBadgeProps {
  isConforme: boolean;
}

export function ConformityBadge({ isConforme }: ConformityBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
        isConforme
          ? 'bg-[var(--cl-success-bg)] text-[var(--cl-success)]'
          : 'bg-[var(--cl-danger-bg)] text-[var(--cl-danger)]'
      }`}
    >
      <span>{isConforme ? '✓' : '✕'}</span>
      <span>{isConforme ? 'Dentro dos limites' : 'Fora dos limites'}</span>
    </div>
  );
}
