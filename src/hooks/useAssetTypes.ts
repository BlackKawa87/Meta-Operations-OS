import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AssetTypeRow } from '@/types/database';

export function useAssetTypes() {
  const [assetTypes, setAssetTypes] = useState<AssetTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ data: AssetTypeRow[] }>('/asset-types')
      .then(({ data }) => setAssetTypes(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { assetTypes, loading, error };
}
