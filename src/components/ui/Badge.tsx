import clsx from 'clsx';
import type { AssetStatus, Criticality } from '@/types/database';

const STATUS_STYLES: Record<AssetStatus, string> = {
  active: 'bg-success-500/10 text-success-600 dark:text-success-500 ring-success-500/20',
  inactive: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20',
  pending: 'bg-info-500/10 text-info-500 ring-info-500/20',
  under_review: 'bg-info-500/10 text-info-500 ring-info-500/20',
  limited: 'bg-warning-500/10 text-warning-600 dark:text-warning-500 ring-warning-500/20',
  restricted: 'bg-warning-500/10 text-warning-600 dark:text-warning-500 ring-warning-500/20',
  blocked: 'bg-danger-500/10 text-danger-600 dark:text-danger-500 ring-danger-500/20',
  disabled: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20',
  suspended: 'bg-danger-500/10 text-danger-600 dark:text-danger-500 ring-danger-500/20',
  needs_verification: 'bg-warning-500/10 text-warning-600 dark:text-warning-500 ring-warning-500/20',
  at_risk: 'bg-danger-500/10 text-danger-600 dark:text-danger-500 ring-danger-500/20',
  backup: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-brand-500/20',
  archived: 'bg-slate-500/10 text-slate-500 ring-slate-500/20',
};

const CRITICALITY_STYLES: Record<Criticality, string> = {
  low: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20',
  medium: 'bg-info-500/10 text-info-500 ring-info-500/20',
  high: 'bg-warning-500/10 text-warning-600 dark:text-warning-500 ring-warning-500/20',
  critical: 'bg-danger-500/10 text-danger-600 dark:text-danger-500 ring-danger-500/20',
};

function baseBadgeClasses(extra?: string) {
  return clsx(
    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
    extra,
  );
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  return <span className={baseBadgeClasses(STATUS_STYLES[status])}>{status.replace(/_/g, ' ')}</span>;
}

export function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  return <span className={baseBadgeClasses(CRITICALITY_STYLES[criticality])}>{criticality}</span>;
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        'bg-[var(--bg-muted)] text-[var(--text-secondary)] ring-[var(--border-subtle)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
