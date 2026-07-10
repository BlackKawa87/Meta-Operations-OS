import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, ShieldAlert, Settings } from 'lucide-react';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-600/10 text-brand-700 dark:text-brand-400'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
  }`;

// Single Operator Mode: no workspace switcher — the app always operates
// against the one default workspace (see api/_lib/config.ts).
export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-4">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('app.name')}</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <NavLink to="/" end className={navItemClass}>
          <LayoutGrid className="h-4 w-4" /> {t('nav.overview')}
        </NavLink>
        <NavLink to="/risk" className={navItemClass}>
          <ShieldAlert className="h-4 w-4" /> {t('nav.risk')}
        </NavLink>
        <NavLink to="/settings" className={navItemClass}>
          <Settings className="h-4 w-4" /> {t('nav.settings')}
        </NavLink>
      </nav>
    </aside>
  );
}
