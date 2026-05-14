interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  blocoNome: string;
}

export function ProgressBar({ currentStep, totalSteps, blocoNome }: ProgressBarProps) {
  const percent = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-2">
      <span className="text-xs text-white/50">
        Bloco {currentStep} de {totalSteps} — {blocoNome}
      </span>
      <div className="h-1.5 rounded-full bg-white/[0.06] w-full">
        <div
          className="h-1.5 rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label={`Progresso: bloco ${currentStep} de ${totalSteps}`}
        />
      </div>
    </div>
  );
}
