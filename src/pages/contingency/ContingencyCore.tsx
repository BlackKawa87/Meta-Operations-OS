import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useArchitectures, useContinuity, useArchitectureMap, useChecklists, useFailureSimulation } from '@/hooks/useArchitectures';
import { useAssets } from '@/hooks/useAssets';
import type { CreateArchitectureInput } from '@/lib/validation/architecture';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, FieldWrapper } from '@/components/ui/Field';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';

const READINESS_TONE: Record<string, string> = {
  ready: 'bg-success-500/10 text-success-600 ring-success-500/20',
  partial: 'bg-warning-500/10 text-warning-600 ring-warning-500/20',
  critical: 'bg-danger-500/10 text-danger-600 ring-danger-500/20',
  insufficient: 'bg-danger-500/10 text-danger-600 ring-danger-500/20',
};

const TABS = ['overview', 'map', 'simulator', 'checklist'] as const;
type Tab = (typeof TABS)[number];

export function ContingencyCore() {
  const { t } = useTranslation();
  const { architectures, loading, createArchitecture } = useArchitectures();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const selected = architectures.find((a) => a.id === selectedId) ?? architectures[0] ?? null;
  const activeId = selected?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('contingency.title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('contingency.subtitle')}</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> {t('contingency.newArchitecture')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('contingency.architectures')}</p>
          </CardHeader>
          <CardBody className="p-2">
            {loading ? (
              <LoadingState label={t('common.loading')} />
            ) : architectures.length === 0 ? (
              <EmptyState label={t('contingency.noArchitectures')} />
            ) : (
              <ul>
                {architectures.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        activeId === a.id ? 'bg-brand-600/10 text-brand-700 dark:text-brand-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{a.country ?? '—'} · {a.continuity_score}%</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          {!activeId ? (
            <Card>
              <EmptyState label={t('contingency.selectArchitecture')} />
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-wrap gap-1">
                {TABS.map((tb) => (
                  <button
                    key={tb}
                    onClick={() => setTab(tb)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      tab === tb ? 'bg-brand-600/10 text-brand-700 dark:text-brand-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    {t(`contingency.tabs.${tb}`)}
                  </button>
                ))}
              </CardHeader>
              <CardBody>
                {tab === 'overview' && <OverviewTab architectureId={activeId} />}
                {tab === 'map' && <MapTab architectureId={activeId} />}
                {tab === 'simulator' && <SimulatorTab />}
                {tab === 'checklist' && <ChecklistTab architectureId={activeId} />}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('contingency.newArchitecture')}>
        <ArchitectureForm
          onSubmit={async (values) => {
            const created = await createArchitecture(values);
            setFormOpen(false);
            if (created) setSelectedId(created.id);
          }}
        />
      </Modal>
    </div>
  );
}

function ArchitectureForm({ onSubmit }: { onSubmit: (values: CreateArchitectureInput) => Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('');
  const [product, setProduct] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, description, country, product, environment: 'production', status: 'active' });
      }}
    >
      <FieldWrapper label={t('contingency.form.name')} required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </FieldWrapper>
      <FieldWrapper label={t('contingency.form.description')}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </FieldWrapper>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label={t('contingency.form.country')}>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
        </FieldWrapper>
        <FieldWrapper label={t('contingency.form.product')}>
          <Input value={product} onChange={(e) => setProduct(e.target.value)} />
        </FieldWrapper>
      </div>
      <Button type="submit" className="mt-2 w-full">{t('common.save')}</Button>
    </form>
  );
}

function OverviewTab({ architectureId }: { architectureId: string }) {
  const { t } = useTranslation();
  const { report, loading } = useContinuity(architectureId);
  if (loading) return <LoadingState label={t('common.loading')} />;
  if (!report) return <EmptyState label={t('common.error')} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardBody><p className="text-xs text-[var(--text-muted)]">{t('contingency.continuityScore')}</p><p className="text-2xl font-semibold">{report.continuity_score}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-[var(--text-muted)]">{t('contingency.healthScore')}</p><p className="text-2xl font-semibold">{report.health_score}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-[var(--text-muted)]">{t('contingency.spofCount')}</p><p className="text-2xl font-semibold text-danger-500">{report.spof.length}</p></CardBody></Card>
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--text-muted)]">{t('contingency.readiness')}</p>
            <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${READINESS_TONE[report.recovery_readiness]}`}>
              {t(`contingency.readinessLevels.${report.recovery_readiness}`)}
            </span>
          </CardBody>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('contingency.readiness')}</p>
        <p className="text-sm text-[var(--text-secondary)]">{report.recovery_readiness_reason}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('contingency.spofDetector')}</p>
        {report.spof.length === 0 ? (
          <EmptyState label={t('contingency.noSpof')} />
        ) : (
          <ul className="space-y-2">
            {report.spof.map((s, i) => (
              <li key={i} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <span className={`mr-2 font-medium ${s.severity === 'critical' ? 'text-danger-500' : 'text-warning-600'}`}>{s.severity.toUpperCase()}</span>
                {s.reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('contingency.continuityScore')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
          {report.continuity_reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>
    </div>
  );
}

function MapTab({ architectureId }: { architectureId: string }) {
  const { t } = useTranslation();
  const { nodes, edges, loading } = useArchitectureMap(architectureId);
  if (loading) return <LoadingState label={t('common.loading')} />;
  if (nodes.length === 0) return <EmptyState label={t('contingency.noAssetsInArchitecture')} />;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`rounded-lg border px-3 py-2 text-xs ${
              n.backup_coverage === 0 ? 'border-danger-500/40 bg-danger-500/5' : 'border-[var(--border-subtle)]'
            }`}
          >
            <p className="font-medium text-[var(--text-primary)]">{n.name}</p>
            <p className="text-[var(--text-muted)]">{n.asset_types.label_en} {n.role ? `· ${n.role}` : ''}</p>
            {n.backup_coverage === 0 && <p className="mt-1 font-medium text-danger-500">{t('contingency.noBackupTag')}</p>}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('assets.detail.relationships')}</p>
        {edges.length === 0 ? (
          <EmptyState label={t('assets.detail.noRelationships')} />
        ) : (
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
            {edges.map((e) => (
              <li key={e.id}>{byId.get(e.source_asset_id)?.name} → <span className="text-[var(--text-muted)]">{e.relationship_type}</span> → {byId.get(e.target_asset_id)?.name}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SimulatorTab() {
  const { t } = useTranslation();
  const { assets } = useAssets({});
  const { simulate, loading } = useFailureSimulation();
  const [assetId, setAssetId] = useState('');
  const [result, setResult] = useState<{ impact: unknown; plan: import('@/lib/contingency').RecoveryPlan | null } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="flex-1">
          <option value="">{t('contingency.form.selectType')}</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Button
          disabled={!assetId || loading}
          onClick={async () => {
            const r = await simulate(assetId);
            setResult(r);
          }}
        >
          {t('contingency.simulateFailure')}
        </Button>
      </div>

      {loading && <LoadingState label={t('common.loading')} />}

      {result && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('contingency.impact')}</p>
            <pre className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] p-3 text-xs text-[var(--text-secondary)]">
              {JSON.stringify(result.impact, null, 2)}
            </pre>
          </div>
          {result.plan && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('contingency.recoveryPlan')} — {result.plan.total_estimated_minutes} min
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                {result.plan.steps.map((s, i) => <li key={i}>{s.label} <span className="text-[var(--text-muted)]">({s.estimated_minutes} min)</span></li>)}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistTab({ architectureId }: { architectureId: string }) {
  const { t } = useTranslation();
  const { checklists, loading, generateDefault, toggleItem } = useChecklists(architectureId);
  if (loading) return <LoadingState label={t('common.loading')} />;

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={generateDefault}>{t('contingency.generateChecklist')}</Button>
      {checklists.length === 0 ? (
        <EmptyState label={t('contingency.noChecklists')} />
      ) : (
        checklists.map((c) => (
          <div key={c.id}>
            <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">{c.title}</p>
            <ul className="space-y-1">
              {c.items.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => toggleItem(c.id, item.key, e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-default)]"
                  />
                  <span className={item.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
