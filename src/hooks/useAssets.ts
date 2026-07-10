import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AssetRow, AssetTypeRow } from '@/types/database';
import type { CreateAssetInput } from '@/lib/validation/asset';

export type AssetWithType = AssetRow & { asset_types: Pick<AssetTypeRow, 'key' | 'label_en' | 'label_pt' | 'label_es' | 'icon' | 'category'> };

export interface AssetFilters {
  status?: string;
  asset_type_id?: string;
  criticality?: string;
  search?: string;
}

export interface AssetSummary {
  total: number;
  active: number;
  at_risk: number;
  blocked: number;
  no_backup: number;
  critical: number;
}

// Single Operator Mode: no workspaceId param — the API always resolves
// DEFAULT_WORKSPACE_ID server-side (api/_lib/config.ts).
export function useAssets(filters: AssetFilters) {
  const [assets, setAssets] = useState<AssetWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.asset_type_id) params.set('asset_type_id', filters.asset_type_id);
    if (filters.criticality) params.set('criticality', filters.criticality);
    if (filters.search) params.set('search', filters.search);

    api
      .get<{ data: AssetWithType[] }>(`/assets?${params.toString()}`)
      .then(({ data }) => setAssets(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters.status, filters.asset_type_id, filters.criticality, filters.search]);

  useEffect(load, [load]);

  return { assets, loading, error, refetch: load };
}

export function useAssetSummary() {
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: AssetSummary }>('/assets/summary')
      .then(({ data }) => setSummary(data ?? null))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return { summary, loading, refetch: load };
}

export interface RiskAlert {
  type: 'criticalNoBackup' | 'blockedActive' | 'noDocs' | 'noRelationships' | 'problematicStatus';
  asset: { id: string; name: string; status: string; criticality: string; asset_types: { label_en: string } };
}

export function useAssetRisk() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ data: RiskAlert[] }>('/assets/risk')
      .then(({ data }) => setAlerts(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return { alerts, loading, error, refetch: load };
}

export function useCreateAsset() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAsset = async (input: CreateAssetInput) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<{ data: AssetRow }>('/assets', input);
      return data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return { createAsset, submitting, error };
}
