interface ConformityBadgeProps {
  isConforme: boolean;
}

export function ConformityBadge({ isConforme }: ConformityBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
        isConforme
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-red-500/10 text-red-400'
      }`}
    >
      <span>{isConforme ? '✓' : '✕'}</span>
      <span>{isConforme ? 'Dentro dos limites' : 'Fora dos limites'}</span>
    </div>
  );
}
