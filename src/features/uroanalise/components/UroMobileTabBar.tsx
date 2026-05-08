import { memo, useCallback } from 'react';

export type UroTabKey = 'lotes' | 'corrida' | 'auditoria';

export interface UroMobileTab {
  key: UroTabKey;
  label: string;
  badge?: number;
}

export interface UroMobileTabBarProps {
  tabs?: UroMobileTab[];
  activeTab: UroTabKey;
  onChange: (tab: UroTabKey) => void;
  className?: string;
}

const DEFAULT_TABS: UroMobileTab[] = [
  { key: 'lotes', label: 'Lotes' },
  { key: 'corrida', label: 'Corrida' },
  { key: 'auditoria', label: 'Auditoria' },
];

interface IconProps {
  className?: string;
}

function FlaskIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 3h6v6l3 9a2 2 0 01-2 3H8a2 2 0 01-2-3l3-9V3z" />
    </svg>
  );
}

function PencilIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 17l4-1L18 5l-3-3L4 13l-1 4z" />
    </svg>
  );
}

function ChecklistIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 5h14M5 12h14M5 19h14" />
    </svg>
  );
}

function renderIcon(key: UroTabKey, className?: string) {
  switch (key) {
    case 'lotes':
      return <FlaskIcon className={className} />;
    case 'corrida':
      return <PencilIcon className={className} />;
    case 'auditoria':
      return <ChecklistIcon className={className} />;
  }
}

interface TabButtonProps {
  tab: UroMobileTab;
  isActive: boolean;
  onSelect: (key: UroTabKey) => void;
}

const TabButton = memo(function TabButton({ tab, isActive, onSelect }: TabButtonProps) {
  const handleClick = useCallback(() => {
    onSelect(tab.key);
  }, [onSelect, tab.key]);

  const showBadge = typeof tab.badge === 'number' && tab.badge > 0;
  const badgeLabel = showBadge ? (tab.badge! > 9 ? '9+' : String(tab.badge)) : null;

  const baseClasses =
    'relative flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 px-1 ' +
    'transition-colors duration-150 ' +
    'active:scale-[0.97] motion-reduce:active:scale-100 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-inset';

  const stateClasses = isActive
    ? 'text-amber-700 dark:text-amber-300 bg-amber-500/[0.08]'
    : 'text-slate-500 dark:text-white/50 active:bg-slate-100 dark:active:bg-white/[0.04]';

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={tab.label + (showBadge ? ` (${tab.badge} pendentes)` : '')}
      onClick={handleClick}
      className={`${baseClasses} ${stateClasses}`}
    >
      <span className="relative inline-flex">
        {renderIcon(tab.key, 'w-4 h-4')}
        {showBadge && (
          <span
            className="absolute -top-0.5 -right-1.5 text-[9px] font-bold leading-none px-1 py-0.5 rounded-full bg-amber-500 text-white min-w-[14px] text-center"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wider leading-none">
        {tab.label}
      </span>
      {isActive && (
        <span
          className="w-1 h-1 rounded-full bg-amber-500 absolute bottom-1.5"
          aria-hidden="true"
        />
      )}
    </button>
  );
});

export const UroMobileTabBar = memo(function UroMobileTabBar({
  tabs = DEFAULT_TABS,
  activeTab,
  onChange,
  className = '',
}: UroMobileTabBarProps) {
  const columnsClass =
    tabs.length === 3
      ? 'grid-cols-3'
      : tabs.length === 4
        ? 'grid-cols-4'
        : tabs.length === 2
          ? 'grid-cols-2'
          : 'grid-cols-1';

  return (
    <nav
      role="tablist"
      aria-label="Navegação uroanálise"
      className={
        'fixed bottom-0 inset-x-0 z-30 sm:hidden ' +
        'border-t border-slate-200 dark:border-white/[0.08] ' +
        'bg-white/95 dark:bg-[#0f1318]/95 backdrop-blur-sm ' +
        'pb-[env(safe-area-inset-bottom)] ' +
        className
      }
    >
      <div className={`grid ${columnsClass}`}>
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={tab.key === activeTab}
            onSelect={onChange}
          />
        ))}
      </div>
    </nav>
  );
});

export default UroMobileTabBar;
