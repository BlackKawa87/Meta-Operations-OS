import type { ReactNode } from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { Button } from './Button';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ label, onRetry, retryLabel }: { label: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle className="h-6 w-6 text-danger-500" />
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel ?? 'Retry'}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Inbox className="h-6 w-6 text-[var(--text-muted)]" />
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      {action}
    </div>
  );
}
