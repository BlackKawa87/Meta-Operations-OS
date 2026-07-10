import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useAssetRisk } from '@/hooks/useAssets';
import { Card } from '@/components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { CriticalityBadge } from '@/components/ui/Badge';

const ALERT_TONE: Record<string, string> = {
  criticalNoBackup: 'text-danger-500',
  blockedActive: 'text-danger-500',
  noDocs: 'text-warning-600',
  noRelationships: 'text-warning-600',
  problematicStatus: 'text-danger-500',
};

export function AssetRisk() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { alerts, loading, error, refetch } = useAssetRisk();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('assets.risk.title')}</h1>

      <Card>
        {loading ? (
          <LoadingState label={t('common.loading')} />
        ) : error ? (
          <ErrorState label={t('common.error')} onRetry={refetch} />
        ) : alerts.length === 0 ? (
          <EmptyState label={t('assets.risk.empty')} />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {alerts.map((alert, idx) => (
              <li
                key={`${alert.asset.id}-${alert.type}-${idx}`}
                onClick={() => navigate(`/assets/${alert.asset.id}`)}
                className="flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-[var(--bg-muted)]"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`h-4 w-4 ${ALERT_TONE[alert.type]}`} />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{alert.asset.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t(`assets.risk.${alert.type}`)} · {alert.asset.asset_types.label_en}
                    </p>
                  </div>
                </div>
                <CriticalityBadge criticality={alert.asset.criticality as 'low' | 'medium' | 'high' | 'critical'} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
