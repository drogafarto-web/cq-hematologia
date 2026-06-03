import React from 'react';
import { WestgardViolation } from '../utils/westgardRulesCLSI';

interface ViolationChipsProps {
  violations: WestgardViolation[];
  onHighlight?: (ruleId: string) => void;
}

const severityColors = {
  warn: 'bg-amber-900/40 text-amber-200 border-amber-700/50',
  reject: 'bg-red-900/40 text-red-200 border-red-700/50',
};

const severityDotColors = {
  warn: 'bg-amber-500',
  reject: 'bg-red-500',
};

export const ViolationChips: React.FC<ViolationChipsProps> = ({ violations, onHighlight }) => {
  if (violations.length === 0) {
    return <span className="text-xs text-green-400/80">✓ Sem violações</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {violations.map((v, idx) => (
        <div
          key={idx}
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
            severityColors[v.severity]
          } hover:opacity-80`}
          title={v.detail}
          onClick={() => onHighlight?.(v.rule)}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${severityDotColors[v.severity]}`} />
          <span>{v.rule}</span>
        </div>
      ))}
    </div>
  );
};

export default ViolationChips;
