import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Archive, Pencil } from 'lucide-react';
import { useAsset, useAssetRelationships, useAssetNotes, useAssetDocuments, useAssetHistory, useAssetEvents, useAssetAudit } from '@/hooks/useAsset';
import { useAssetTypes } from '@/hooks/useAssetTypes';
import { useAssets } from '@/hooks/useAssets';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Textarea, Input } from '@/components/ui/Field';
import { StatusBadge, CriticalityBadge, Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { AssetForm, type AssetFormValues } from '@/components/assets/AssetForm';
import { ASSET_STATUSES, RELATIONSHIP_TYPES } from '@/lib/validation/asset';
import type { AssetStatus } from '@/types/database';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const TABS = ['overview', 'relationships', 'risk', 'notes', 'documents', 'history', 'events', 'audit'] as const;
type Tab = (typeof TABS)[number];

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { assetTypes } = useAssetTypes();
  const { asset, loading, error, refetch, updateAsset, changeStatus, archiveAsset } = useAsset(id ?? null);
  const { relationships, loading: relLoading, addRelationship, removeRelationship } = useAssetRelationships(id ?? null);
  const { notes, loading: notesLoading, addNote } = useAssetNotes(id ?? null);
  const { documents, loading: docsLoading, registerDocument } = useAssetDocuments(id ?? null);
  const { history, loading: historyLoading } = useAssetHistory(id ?? null);
  const { events, loading: eventsLoading } = useAssetEvents(id ?? null);
  const { auditLogs, loading: auditLoading } = useAssetAudit(id ?? null);
  const { assets: allAssets } = useAssets({});

  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [relModalOpen, setRelModalOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [uploading, setUploading] = useState(false);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error || !asset) return <ErrorState label={t('assets.error')} onRetry={refetch} />;

  const handleEdit = async (values: AssetFormValues) => {
    await updateAsset(values);
    setEditOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{asset.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={asset.status} />
            <CriticalityBadge criticality={asset.criticality} />
            <Badge>{asset.asset_types.label_en}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setStatusModalOpen(true)}>
            {t('assets.detail.changeStatus')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> {t('assets.detail.edit')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              await archiveAsset();
              navigate('/');
            }}
          >
            <Archive className="h-3.5 w-3.5" /> {t('assets.detail.archive')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--text-muted)]">{t('assets.detail.healthScore')}</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{asset.health_score}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--text-muted)]">{t('assets.detail.riskScore')}</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{asset.risk_score}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--text-muted)]">{t('assets.detail.recoveryScore')}</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{asset.recovery_score}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--text-muted)]">{t('assets.detail.backupCoverage')}</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{asset.backup_coverage}%</p>
          </CardBody>
        </Card>
      </div>

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
              {t(`assets.detail.${tb}`)}
            </button>
          ))}
        </CardHeader>
        <CardBody>
          {tab === 'overview' && (
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--text-muted)]">{t('assets.form.description')}</dt>
                <dd className="text-sm text-[var(--text-primary)]">{asset.description || '—'}</dd>
              </div>
              {asset.asset_types.fields.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs text-[var(--text-muted)]">{f.label_en}</dt>
                  <dd className="text-sm text-[var(--text-primary)]">{String(asset.attributes[f.key] ?? '—')}</dd>
                </div>
              ))}
            </dl>
          )}

          {tab === 'relationships' && (
            <div>
              <div className="mb-3 flex justify-end">
                <Button size="sm" onClick={() => setRelModalOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> {t('assets.detail.addRelationship')}
                </Button>
              </div>
              {relLoading ? (
                <LoadingState label={t('common.loading')} />
              ) : relationships.length === 0 ? (
                <EmptyState label={t('assets.detail.noRelationships')} />
              ) : (
                <ul className="space-y-2">
                  {relationships.map((rel) => {
                    const other = rel.source_asset_id === id ? rel.target : rel.source;
                    const direction = rel.source_asset_id === id ? '→' : '←';
                    return (
                      <li key={rel.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                        <span className="text-sm text-[var(--text-primary)]">
                          {direction} {rel.relationship_type} {direction} <strong>{other.name}</strong>{' '}
                          <StatusBadge status={other.status} />
                        </span>
                        <button onClick={() => removeRelationship(rel.id)} className="text-[var(--text-muted)] hover:text-danger-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'risk' && (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <p>Health: {asset.health_score} · Risk: {asset.risk_score} · Recovery: {asset.recovery_score} · Backup coverage: {asset.backup_coverage}%</p>
              <p>Criticality: <CriticalityBadge criticality={asset.criticality} /></p>
            </div>
          )}

          {tab === 'notes' && (
            <div>
              <form
                className="mb-4 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!noteBody.trim()) return;
                  await addNote(noteBody);
                  setNoteBody('');
                }}
              >
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="min-h-[60px]"
                  aria-label={t('assets.detail.addNote') ?? undefined}
                />
                <Button type="submit">{t('assets.detail.addNote')}</Button>
              </form>
              {notesLoading ? (
                <LoadingState label={t('common.loading')} />
              ) : notes.length === 0 ? (
                <EmptyState label={t('assets.detail.noNotes')} />
              ) : (
                <ul className="space-y-2">
                  {notes.map((note) => (
                    <li key={note.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]">
                      {note.body}
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(note.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div>
              <div className="mb-4">
                <input
                  type="file"
                  aria-label={t('assets.detail.documents') ?? undefined}
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !asset) return;
                    setUploading(true);
                    try {
                      const content_base64 = await readFileAsBase64(file);
                      await registerDocument({
                        title: file.name,
                        file_name: file.name,
                        mime_type: file.type,
                        content_base64,
                      });
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              {docsLoading ? (
                <LoadingState label={t('common.loading')} />
              ) : documents.length === 0 ? (
                <EmptyState label={t('assets.detail.noDocuments')} />
              ) : (
                <ul className="space-y-2">
                  {documents.map((doc) => (
                    <li key={doc.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]">
                      {doc.title} <span className="text-xs text-[var(--text-muted)]">({doc.file_name})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'history' && (
            historyLoading ? (
              <LoadingState label={t('common.loading')} />
            ) : history.length === 0 ? (
              <EmptyState label={t('assets.detail.noHistory')} />
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="text-sm text-[var(--text-secondary)]">
                    <span className="text-[var(--text-primary)]">{h.previous_status ?? '—'} → {h.new_status}</span>
                    {h.reason && ` — ${h.reason}`}
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{new Date(h.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'events' && (
            eventsLoading ? (
              <LoadingState label={t('common.loading')} />
            ) : events.length === 0 ? (
              <EmptyState label={t('assets.detail.noEvents')} />
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id} className="text-sm text-[var(--text-secondary)]">
                    <span className="text-[var(--text-primary)]">{ev.event_type}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{new Date(ev.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'audit' && (
            auditLoading ? (
              <LoadingState label={t('common.loading')} />
            ) : auditLogs.length === 0 ? (
              <EmptyState label={t('assets.detail.noAudit')} />
            ) : (
              <ul className="space-y-2">
                {auditLogs.map((a) => (
                  <li key={a.id} className="text-sm text-[var(--text-secondary)]">
                    <span className="text-[var(--text-primary)]">{a.action}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{new Date(a.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )
          )}
        </CardBody>
      </Card>

      <AssetForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        assetTypes={assetTypes}
        mode="edit"
        initialAsset={asset}
        submitting={false}
        onSubmit={handleEdit}
      />

      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title={t('assets.detail.changeStatus')} width="sm">
        <StatusChangeForm
          currentStatus={asset.status}
          onSubmit={async (newStatus, reason) => {
            await changeStatus(newStatus, reason);
            setStatusModalOpen(false);
          }}
        />
      </Modal>

      <Modal open={relModalOpen} onClose={() => setRelModalOpen(false)} title={t('assets.detail.addRelationship')} width="sm">
        <RelationshipForm
          candidates={allAssets.filter((a) => a.id !== id)}
          onSubmit={async (targetId, relType, notes) => {
            await addRelationship({ target_asset_id: targetId, relationship_type: relType, strength: 'normal', notes });
            setRelModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function StatusChangeForm({ currentStatus, onSubmit }: { currentStatus: AssetStatus; onSubmit: (s: AssetStatus, reason?: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AssetStatus>(currentStatus);
  const [reason, setReason] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(status, reason || undefined);
      }}
      className="space-y-3"
    >
      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value as AssetStatus)}
        aria-label={t('assets.form.status') ?? undefined}
      >
        {ASSET_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ')}
          </option>
        ))}
      </Select>
      <Textarea placeholder={t('assets.detail.reason') ?? ''} value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button type="submit" className="w-full">
        {t('common.save')}
      </Button>
    </form>
  );
}

function RelationshipForm({
  candidates,
  onSubmit,
}: {
  candidates: { id: string; name: string }[];
  onSubmit: (targetId: string, relType: (typeof RELATIONSHIP_TYPES)[number], notes?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState<(typeof RELATIONSHIP_TYPES)[number]>('depends_on');
  const [notes, setNotes] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (targetId) onSubmit(targetId, relType, notes || undefined);
      }}
      className="space-y-3"
    >
      <Select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        required
        aria-label={t('assets.detail.addRelationship') ?? undefined}
      >
        <option value="" disabled>
          {t('assets.form.selectType')}
        </option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        value={relType}
        onChange={(e) => setRelType(e.target.value as (typeof RELATIONSHIP_TYPES)[number])}
        aria-label={t('assets.filters.type') ?? undefined}
      >
        {RELATIONSHIP_TYPES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Input
        placeholder={t('assets.form.description') ?? ''}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button type="submit" className="w-full">
        {t('common.save')}
      </Button>
    </form>
  );
}
