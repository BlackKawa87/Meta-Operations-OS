import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// Single Operator Mode: no user session, so no email/sign-out here —
// just theme and language, which don't depend on identity.
export function Header() {
  const { i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6">
      <div />
      <div className="flex items-center gap-3">
        <select
          value={i18n.language}
          onChange={(e) => {
            i18n.changeLanguage(e.target.value);
            localStorage.setItem('locale', e.target.value);
          }}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-page)] px-2 py-1 text-xs text-[var(--text-primary)]"
        >
          <option value="en">EN</option>
          <option value="pt">PT</option>
          <option value="es">ES</option>
        </select>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
