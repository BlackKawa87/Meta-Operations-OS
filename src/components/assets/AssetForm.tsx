import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrapper, Input, Select, Textarea } from '@/components/ui/Field';
import { ASSET_STATUSES, CRITICALITY_LEVELS } from '@/lib/validation/asset';
import type { AssetTypeRow, AssetTypeFieldDef, Criticality, AssetStatus } from '@/types/database';
import type { AssetDetail } from '@/hooks/useAsset';
import { useArchitectures } from '@/hooks/useArchitectures';

// Single Operator Mode: no owner/member picker — `owner_id` stays in the
// data model (nullable) for when multi-user comes back, it's just not
// exposed in this form right now.
export interface AssetFormValues {
  asset_type_id: string;
  name: string;
  description: string | null;
  status: AssetStatus;
  criticality: Criticality;
  attributes: Record<string, unknown>;
  tags: string[];
  architecture_id: string | null;
  role: string | null;
}

interface AssetFormProps {
  open: boolean;
  onClose: () => void;
  assetTypes: AssetTypeRow[];
  mode: 'create' | 'edit';
  initialAsset?: AssetDetail;
  submitting: boolean;
  errorMessage?: string | null;
  onSubmit: (values: AssetFormValues) => Promise<void> | void;
}

function localizedLabel(field: AssetTypeFieldDef, locale: string): string {
  if (locale === 'pt') return field.label_pt;
  if (locale === 'es') return field.label_es;
  return field.label_en;
}

function localizedTypeLabel(type: AssetTypeRow, locale: string): string {
  if (locale === 'pt') return type.label_pt;
  if (locale === 'es') return type.label_es;
  return type.label_en;
}

function localizedRoleLabel(role: AssetTypeRow['roles'][number], locale: string): string {
  if (locale === 'pt') return role.label_pt;
  if (locale === 'es') return role.label_es;
  return role.label_en;
}

export function AssetForm({
  open, onClose, assetTypes, mode, initialAsset, submitting, errorMessage, onSubmit,
}: AssetFormProps) {
  const { t, i18n } = useTranslation();

  const [assetTypeId, setAssetTypeId] = useState(initialAsset?.asset_type_id ?? '');
  const [name, setName] = useState(initialAsset?.name ?? '');
  const [description, setDescription] = useState(initialAsset?.description ?? '');
  const [status, setStatus] = useState<AssetStatus>(initialAsset?.status ?? 'pending');
  const [criticality, setCriticality] = useState<Criticality>(initialAsset?.criticality ?? 'medium');
  const [tagsInput, setTagsInput] = useState((initialAsset?.tags ?? []).join(', '));
  const [attributes, setAttributes] = useState<Record<string, unknown>>(initialAsset?.attributes ?? {});
  const [architectureId, setArchitectureId] = useState(initialAsset?.architecture_id ?? '');
  const [role, setRole] = useState(initialAsset?.role ?? '');

  const { architectures } = useArchitectures();

  const selectedType = useMemo(
    () => assetTypes.find((t2) => t2.id === assetTypeId) ?? initialAsset?.asset_types,
    [assetTypes, assetTypeId, initialAsset],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      asset_type_id: assetTypeId,
      name,
      description: description || null,
      status,
      criticality,
      attributes,
      tags: tagsInput.split(',').map((t2) => t2.trim()).filter(Boolean),
      architecture_id: architectureId || null,
      role: role || null,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'create' ? t('assets.newAsset') : t('assets.detail.edit')} width="lg">
      <form onSubmit={handleSubmit}>
        {mode === 'create' && (
          <FieldWrapper label={t('assets.form.type')} required>
            <Select value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} required>
              <option value="" disabled>
                {t('assets.form.selectType')}
              </option>
              {assetTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {localizedTypeLabel(type, i18n.language)}
                </option>
              ))}
            </Select>
          </FieldWrapper>
        )}

        <FieldWrapper label={t('assets.form.name')} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </FieldWrapper>

        <FieldWrapper label={t('assets.form.description')}>
          <Textarea value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
        </FieldWrapper>

        <div className="grid grid-cols-2 gap-3">
          <FieldWrapper label={t('assets.form.status')}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <FieldWrapper label={t('assets.form.criticality')}>
            <Select value={criticality} onChange={(e) => setCriticality(e.target.value as Criticality)}>
              {CRITICALITY_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FieldWrapper>
        </div>

        <FieldWrapper label={t('assets.form.tags')}>
          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tag1, tag2" />
        </FieldWrapper>

        <div className="grid grid-cols-2 gap-3">
          <FieldWrapper label={t('assets.form.architecture')}>
            <Select value={architectureId} onChange={(e) => setArchitectureId(e.target.value)}>
              <option value="">—</option>
              {architectures.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <FieldWrapper label={t('assets.form.role')}>
            <Select value={role} onChange={(e) => setRole(e.target.value)} disabled={!selectedType || selectedType.roles.length === 0}>
              <option value="">—</option>
              {(selectedType?.roles ?? []).map((r) => (
                <option key={r.key} value={r.key}>
                  {localizedRoleLabel(r, i18n.language)}
                </option>
              ))}
            </Select>
          </FieldWrapper>
        </div>

        {selectedType && selectedType.fields.length > 0 && (
          <div className="mt-2 border-t border-[var(--border-subtle)] pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {localizedTypeLabel(selectedType, i18n.language)}
            </p>
            {selectedType.fields.map((field) => (
              <FieldWrapper key={field.key} label={localizedLabel(field, i18n.language)} required={field.required}>
                {field.type === 'select' ? (
                  <Select
                    value={(attributes[field.key] as string) ?? ''}
                    required={field.required}
                    onChange={(e) => setAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                ) : field.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(attributes[field.key])}
                    onChange={(e) => setAttributes((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-[var(--border-default)]"
                  />
                ) : field.type === 'textarea' ? (
                  <Textarea
                    value={(attributes[field.key] as string) ?? ''}
                    required={field.required}
                    onChange={(e) => setAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
                    required={field.required}
                    value={(attributes[field.key] as string) ?? ''}
                    onChange={(e) =>
                      setAttributes((prev) => ({
                        ...prev,
                        [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))
                    }
                  />
                )}
              </FieldWrapper>
            ))}
          </div>
        )}

        {errorMessage && <p className="mb-3 text-sm text-danger-500">{errorMessage}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {mode === 'create' ? t('assets.form.create') : t('assets.form.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
