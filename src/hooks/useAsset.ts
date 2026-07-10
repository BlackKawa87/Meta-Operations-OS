import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type {
  AssetRow, AssetTypeRow, AssetStatusHistoryRow, AssetNoteRow, AssetDocumentRow,
  AssetRelationshipRow, AssetEventRow, AuditLogRow, AssetStatus,
} from '@/types/database';
import type { UpdateAssetInput, CreateAssetRelationshipInput, CreateAssetDocumentInput } from '@/lib/validation/asset';

export type AssetDetail = AssetRow & { asset_types: AssetTypeRow };

function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    api
      .get<{ data: T }>(path)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(load, [load]);

  return { data, loading, error, refetch: load };
}

export function useAsset(id: string | null) {
  const { data: asset, loading, error, refetch } = useResource<AssetDetail>(id ? `/assets/${id}` : null);

  const updateAsset = async (input: UpdateAssetInput) => {
    await api.patch(`/assets/${id}`, input);
    refetch();
  };

  const changeStatus = async (new_status: AssetStatus, reason?: string) => {
    await api.patch(`/assets/${id}/status`, { new_status, reason });
    refetch();
  };

  const archiveAsset = async () => {
    await api.delete(`/assets/${id}`);
    refetch();
  };

  return { asset, loading, error, refetch, updateAsset, changeStatus, archiveAsset };
}

export function useAssetRelationships(assetId: string | null) {
  const { data, loading, error, refetch } = useResource<
    (AssetRelationshipRow & { source: { id: string; name: string; status: AssetStatus }; target: { id: string; name: string; status: AssetStatus } })[]
  >(assetId ? `/assets/${assetId}/relationships` : null);

  const addRelationship = async (input: CreateAssetRelationshipInput) => {
    await api.post(`/assets/${assetId}/relationships`, input);
    refetch();
  };

  const removeRelationship = async (relationshipId: string) => {
    await api.delete(`/assets/${assetId}/relationships/${relationshipId}`);
    refetch();
  };

  return { relationships: data ?? [], loading, error, addRelationship, removeRelationship };
}

export function useAssetNotes(assetId: string | null) {
  const { data, loading, error, refetch } = useResource<AssetNoteRow[]>(assetId ? `/assets/${assetId}/notes` : null);

  const addNote = async (body: string) => {
    await api.post(`/assets/${assetId}/notes`, { body });
    refetch();
  };

  return { notes: data ?? [], loading, error, addNote };
}

export function useAssetDocuments(assetId: string | null) {
  const { data, loading, error, refetch } = useResource<AssetDocumentRow[]>(
    assetId ? `/assets/${assetId}/documents` : null,
  );

  const registerDocument = async (input: CreateAssetDocumentInput) => {
    await api.post(`/assets/${assetId}/documents`, input);
    refetch();
  };

  return { documents: data ?? [], loading, error, registerDocument };
}

export function useAssetHistory(assetId: string | null) {
  const { data, loading, error } = useResource<AssetStatusHistoryRow[]>(assetId ? `/assets/${assetId}/history` : null);
  return { history: data ?? [], loading, error };
}

export function useAssetEvents(assetId: string | null) {
  const { data, loading, error } = useResource<AssetEventRow[]>(assetId ? `/assets/${assetId}/events` : null);
  return { events: data ?? [], loading, error };
}

export function useAssetAudit(assetId: string | null) {
  const { data, loading, error } = useResource<AuditLogRow[]>(assetId ? `/assets/${assetId}/audit` : null);
  return { auditLogs: data ?? [], loading, error };
}
