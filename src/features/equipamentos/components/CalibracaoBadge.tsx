/**
 * CalibracaoBadge — pill de status de calibração (apresentação; sem Firebase).
 *
 * Layout alinhado ao padrão `CHIP` de `EquipamentoCard`; cores vêm do hook.
 */

import type { CalibracaoStatus } from '../hooks/useCalibracaoStatus';
import { useCalibracaoBadgePresentation } from '../hooks/useCalibracaoBadgePresentation';

/** Base espacial/tipográfica do módulo (espelha `CHIP` em EquipamentoCard). */
const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold';

export interface CalibracaoBadgeProps {
  calibracaoStatus: CalibracaoStatus;
}

export function CalibracaoBadge({ calibracaoStatus }: CalibracaoBadgeProps) {
  const { label, toneClasses } = useCalibracaoBadgePresentation(calibracaoStatus);

  return (
    <span className={`${BADGE_BASE} ${toneClasses}`} role="status">
      {label}
    </span>
  );
}
