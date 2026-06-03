import { ReleaseState } from '../types/releaseState';

/**
 * State machine para liberação de laudo
 * Puro — sem deps de Firebase, sem side effects
 *
 * Estados:
 * Pendente → Em Revisão → Liberado → Comunicado → Superado
 *     ↓ (auto)                           ↑ (via retificação)
 * Auto-Liberado ──────────────────────────┘
 */

interface Transition {
  from: ReleaseState;
  to: ReleaseState;
  allowedRoles: ('RT' | 'RT-Substituto' | 'Sistema')[];
}

const TRANSITIONS: Transition[] = [
  // Pendente → * transitions
  { from: 'Pendente', to: 'Em Revisão', allowedRoles: ['RT', 'RT-Substituto'] },
  {
    from: 'Pendente',
    to: 'Auto-Liberado',
    allowedRoles: ['Sistema'],
  },

  // Em Revisão → * transitions
  { from: 'Em Revisão', to: 'Liberado', allowedRoles: ['RT', 'RT-Substituto'] },
  {
    from: 'Em Revisão',
    to: 'Pendente',
    allowedRoles: ['RT', 'RT-Substituto'],
  }, // unlock

  // Liberado → * transitions
  {
    from: 'Liberado',
    to: 'Comunicado',
    allowedRoles: ['RT', 'RT-Substituto', 'Sistema'],
  },
  {
    from: 'Liberado',
    to: 'Superado',
    allowedRoles: ['RT', 'RT-Substituto'],
  }, // retificação

  // Auto-Liberado → * transitions
  {
    from: 'Auto-Liberado',
    to: 'Comunicado',
    allowedRoles: ['RT', 'RT-Substituto', 'Sistema'],
  },
  {
    from: 'Auto-Liberado',
    to: 'Superado',
    allowedRoles: ['RT', 'RT-Substituto'],
  },

  // Comunicado → * transitions
  {
    from: 'Comunicado',
    to: 'Superado',
    allowedRoles: ['RT', 'RT-Substituto'],
  },
];

interface ValidateTransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Valida se transição é permitida
 * @param from Estado atual
 * @param to Estado desejado
 * @param role Papel do operator (RT, RT-Substituto, Sistema)
 * @param ctx Contexto opcional (ex: hasComunicado)
 * @returns { allowed: boolean, reason?: string }
 */
export function validateTransition(
  from: ReleaseState,
  to: ReleaseState,
  role: string,
  ctx?: { hasComunicado: boolean },
): ValidateTransitionResult {
  // Busca transição definida
  const transition = TRANSITIONS.find((t) => t.from === from && t.to === to);

  if (!transition) {
    return {
      allowed: false,
      reason: `Transição ${from} → ${to} não permitida`,
    };
  }

  // Valida role
  if (!transition.allowedRoles.includes(role as any)) {
    return {
      allowed: false,
      reason: `Role '${role}' não autorizado para transição ${from} → ${to}`,
    };
  }

  // Validação customizada se necessário
  if (to === 'Superado' && from !== 'Comunicado' && ctx?.hasComunicado) {
    return {
      allowed: false,
      reason: 'Laudo comunicado precisa transição via Comunicado → Superado (manter sequência)',
    };
  }

  return { allowed: true };
}

/**
 * Lista os estados para os quais é possível transicionar
 * Útil para renderizar botões disponíveis no UI
 *
 * @param from Estado atual
 * @param role Papel do operator
 * @returns Array de estados permitidos
 */
export function nextStates(from: ReleaseState, role: string): ReleaseState[] {
  return TRANSITIONS.filter((t) => t.from === from && t.allowedRoles.includes(role as any)).map(
    (t) => t.to,
  );
}

/**
 * Descrição legível do estado
 */
export function stateLabel(state: ReleaseState): string {
  const labels: Record<ReleaseState, string> = {
    Pendente: 'Pendente (aguardando revisão)',
    'Em Revisão': 'Em Revisão (RT analisando)',
    Liberado: 'Liberado (RT aprovou)',
    'Auto-Liberado': 'Auto-Liberado (sistema aprovou)',
    Comunicado: 'Comunicado (crítico registrado)',
    Superado: 'Superado (retificado)',
  };
  return labels[state] || state;
}

/**
 * Cor semântica para estado
 */
export function stateColor(
  state: ReleaseState,
): 'gray' | 'yellow' | 'green' | 'violet' | 'emerald' | 'slate' {
  const colors: Record<ReleaseState, string> = {
    Pendente: 'gray',
    'Em Revisão': 'yellow',
    Liberado: 'green',
    'Auto-Liberado': 'violet',
    Comunicado: 'emerald',
    Superado: 'slate',
  };
  return colors[state] as any;
}
