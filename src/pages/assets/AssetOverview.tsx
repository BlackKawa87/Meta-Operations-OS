import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { useAssets, useAssetSummary, useCreateAsset, type AssetFilters } from '@/hooks/useAssets';
import { useAssetTypes } from '@/hooks/useAssetTypes';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/Field';
import { StatusBadge, CriticalityBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { AssetForm, type AssetFormValues } from '@/components/assets/AssetForm';
import { ASSET_STATUSES, CRITICALITY_LEVELS } from '@/lib/validation/asset';

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warning' }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            tone === 'danger' ? 'text-danger-500' : tone === 'warning' ? 'text-warning-600' : 'text-[var(--text-primary)]'
          }`}
        >
          {value}
        </p>
      </CardBody>
    </Card>
  );
}

export function AssetOverview() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { assetTypes } = useAssetTypes();
  const [filters, setFilters] = useState<AssetFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const { assets, loading, error, refetch } = useAssets(filters);
  const { summary } = useAssetSummary();
  const { createAsset, submitting, error: createError } = useCreateAsset();
  const [formOpen, setFormOpen] = useState(false);

  const typeLabel = (key: string) => {
    const type = assetTypes.find((t2) => t2.key === key);
    if (!type) return key;
    return i18n.language === 'pt' ? type.label_pt : i18n.language === 'es' ? type.label_es : type.label_en;
  };

  const handleCreate = async (values: AssetFormValues) => {
    const created = await createAsset(values);
    setFormOpen(false);
    refetch();
    if (created) navigate(`/assets/${created.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('assets.title')}</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> {t('assets.newAsset')}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label={t('assets.summary.total')} value={summary.total} />
          <SummaryCard label={t('assets.summary.active')} value={summary.active} />
          <SummaryCard label={t('assets.summary.atRisk')} value={summary.at_risk} tone="warning" />
          <SummaryCard label={t('assets.summary.blocked')} value={summary.blocked} tone="danger" />
          <SummaryCard label={t('assets.summary.noBackup')} value={summary.no_backup} tone="warning" />
          <SummaryCard label={t('assets.summary.critical')} value={summary.critical} tone="danger" />
        </div>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder={t('assets.searchPlaceholder') ?? ''}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setFilters((f) => ({ ...f, search: searchInput }));
              }}
            />
          </div>

          <Select
            value={filters.asset_type_id ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, asset_type_id: e.target.value || undefined }))}
            className="w-auto"
          >
            <option value="">{t('assets.filters.allTypes')}</option>
            {assetTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {typeLabel(type.key)}
              </option>
            ))}
          </Select>

          <Select
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
            className="w-auto"
          >
            <option value="">{t('assets.filters.allStatuses')}</option>
            {ASSET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>

          <Select
            value={filters.criticality ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, criticality: e.target.value || undefined }))}
            className="w-auto"
          >
            <option value="">{t('assets.filters.allCriticality')}</option>
            {CRITICALITY_LEVELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <LoadingState label={t('assets.loading')} />
        ) : error ? (
          <ErrorState label={t('assets.error')} onRetry={refetch} retryLabel={t('common.retry') ?? undefined} />
        ) : assets.length === 0 ? (
          <EmptyState
            label={t('assets.empty')}
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> {t('assets.newAsset')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-5 py-3">{t('assets.table.name')}</th>
                  <th className="px-5 py-3">{t('assets.table.type')}</th>
                  <th className="px-5 py-3">{t('assets.table.status')}</th>
                  <th className="px-5 py-3">{t('assets.table.criticality')}</th>
                  <th className="px-5 py-3">{t('assets.table.health')}</th>
                  <th className="px-5 py-3">{t('assets.table.updated')}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-muted)]"
                  >
                    <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{asset.name}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{typeLabel(asset.asset_types.key)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="px-5 py-3">
                      <CriticalityBadge criticality={asset.criticality} />
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{asset.health_score}</td>
                    <td className="px-5 py-3 text-[var(--text-muted)]">
                      {new Date(asset.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AssetForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        assetTypes={assetTypes}
        mode="create"
        submitting={submitting}
        errorMessage={createError}
        onSubmit={handleCreate}
      />
    </div>
  );
}
