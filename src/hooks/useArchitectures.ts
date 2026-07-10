import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { OperationalArchitectureRow, ChecklistRow } from '@/types/database';
import type { CreateArchitectureInput } from '@/lib/validation/architecture';
import type { SpofFinding, RecoveryReadiness, RecoveryPlan } from '@/lib/contingency';

export function useArchitectures() {
  const [architectures, setArchitectures] = useState<OperationalArchitectureRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: OperationalArchitectureRow[] }>('/architectures')
      .then(({ data }) => setArchitectures(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const createArchitecture = async (input: CreateArchitectureInput) => {
    const { data } = await api.post<{ data: OperationalArchitectureRow }>('/architectures', input);
    load();
    return data;
  };

  return { architectures, loading, refetch: load, createArchitecture };
}

export interface ContinuityReport {
  architecture_id: string;
  continuity_score: number;
  continuity_reasons: string[];
  health_score: number;
  health_reasons: string[];
  spof: SpofFinding[];
  recovery_readiness: RecoveryReadiness;
  recovery_readiness_reason: string;
  asset_count: number;
}

export function useContinuity(architectureId: string | null) {
  const [report, setReport] = useState<ContinuityReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!architectureId) return;
    setLoading(true);
    api
      .get<{ data: ContinuityReport }>(`/architectures/${architectureId}/continuity`)
      .then(({ data }) => setReport(data ?? null))
      .finally(() => setLoading(false));
  }, [architectureId]);

  useEffect(load, [load]);

  return { report, loading, refetch: load };
}

export interface MapNode {
  id: string;
  name: string;
  role: string | null;
  status: string;
  criticality: string;
  backup_coverage: number;
  asset_types: { key: string; label_en: string; icon: string };
}
export interface MapEdge {
  id: string;
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: string;
  strength: string;
}

export function useArchitectureMap(architectureId: string | null) {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!architectureId) return;
    setLoading(true);
    api
      .get<{ data: { nodes: MapNode[]; edges: MapEdge[] } }>(`/architectures/${architectureId}/map`)
      .then(({ data }) => {
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
      })
      .finally(() => setLoading(false));
  }, [architectureId]);

  return { nodes, edges, loading };
}

export function useChecklists(architectureId: string | null) {
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!architectureId) return;
    setLoading(true);
    api
      .get<{ data: ChecklistRow[] }>(`/architectures/${architectureId}/checklist`)
      .then(({ data }) => setChecklists(data ?? []))
      .finally(() => setLoading(false));
  }, [architectureId]);

  useEffect(load, [load]);

  const generateDefault = async () => {
    await api.post(`/architectures/${architectureId}/checklist`, {});
    load();
  };

  const toggleItem = async (checklistId: string, key: string, done: boolean) => {
    await api.patch(`/checklists/${checklistId}/items/${key}`, { done });
    load();
  };

  return { checklists, loading, generateDefault, toggleItem };
}

export function useFailureSimulation() {
  const [loading, setLoading] = useState(false);

  const simulate = async (assetId: string) => {
    setLoading(true);
    try {
      const [{ data: impact }, { data: plan }] = await Promise.all([
        api.get<{ data: unknown }>(`/assets/${assetId}/impact`),
        api.get<{ data: RecoveryPlan }>(`/assets/${assetId}/recovery-plan`).catch(() => ({ data: null })),
      ]);
      return { impact, plan };
    } finally {
      setLoading(false);
    }
  };

  return { simulate, loading };
}
