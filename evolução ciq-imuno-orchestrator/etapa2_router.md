# ETAPA 2/8: INTEGRAÇÃO NO GUARDACHUCA — VIEW + HUB + ROUTER (20min)

## Passo 1: View type
Arquivo: `src/types/index.ts` (linha ~240)
Adicione `'ciq-imuno'` ao union para habilitar o estado global de navegação:
```ts
export type View = 'hub' | 'analyzer' | 'bulaparser' | 'labadmin' | 'superadmin' | 'reports' | 'ciq-imuno';
```

## Passo 2: AppRouter
Arquivo: `src/features/auth/AuthWrapper.tsx`
Registre o componente principal do módulo no roteador interno. Adicione antes do fallback final:
```tsx
import { CIQImunoDashboard } from '../ciq-imuno/components/CIQImunoDashboard';

// ... dentro do AppRouter
if (currentView === 'ciq-imuno') return <CIQImunoDashboard />;
```

## Passo 3: Adicionar Card ao ModuleHub
Arquivo: `src/features/hub/ModuleHub.tsx`

Primeiro, defina o ícone SVG inline (NUNCA utilize bibliotecas de ícones externas):
```tsx
function ImunoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}
```

Em seguida, adicione a entrada ao array `MODULES`:
```tsx
{
  id: 'ciq-imuno',
  name: 'CIQ-Imuno',
  tagline: 'Imunoensaios · Strips · RDC 978/2025 · FR-036',
  icon: <ImunoIcon />,
  iconBg: 'bg-emerald-500/15',
  iconColor: 'text-emerald-400',
  status: 'active',
  view: 'ciq-imuno',
},
```

## Critérios de Aceite
- [ ] Navegação via `setCurrentView('ciq-imuno')` funciona.
- [ ] Card visível no Hub com as cores `emerald`.
- [ ] Ícone renderizado via SVG nativo.