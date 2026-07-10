import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';
import { generateRecoveryPlan, type ArchitectureAssetSummary } from '../../../src/lib/contingency.js';

// Failure Simulator backend: "what happens if I lose this asset, and how
// do I recover?" — combines the Impact Engine (dependents) with the
// Recovery Plan generator (ARCHITECTURE.md §21).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    const { data: target, error: targetError } = await supabase
      .from('assets')
      .select('id, name, role, architecture_id, status, criticality, health_score, backup_coverage, asset_types(key)')
      .eq('id', id)
      .single();
    if (targetError) throw new HttpError(404, 'Asset not found');
    if (!target.architecture_id) {
      throw new HttpError(400, 'Asset has no Operational Architecture assigned — assign one to simulate recovery');
    }

    const { data: archAssetsRaw, error: archAssetsError } = await supabase
      .from('assets')
      .select('id, name, role, status, criticality, health_score, backup_coverage, asset_types(key)')
      .eq('architecture_id', target.architecture_id)
      .is('archived_at', null);
    if (archAssetsError) throw archAssetsError;

    const toSummary = (r: {
      id: string; name: string; role: string | null; status: typeof target.status;
      criticality: typeof target.criticality; health_score: number; backup_coverage: number;
      asset_types: unknown;
    }): ArchitectureAssetSummary => ({
      id: r.id,
      name: r.name,
      type_key: (r.asset_types as unknown as { key: string }).key,
      role: r.role,
      status: r.status,
      criticality: r.criticality,
      health_score: r.health_score,
      backup_coverage: r.backup_coverage,
    });

    const allAssets = (archAssetsRaw ?? []).map(toSummary);
    const targetSummary = toSummary(target);

    const { data: impactRows } = await supabase.rpc('get_asset_impact', { p_asset_id: id, p_max_depth: 5 });
    const affectedIds = new Set((impactRows ?? []).map((r: { affected_asset_id: string }) => r.affected_asset_id));
    const dependents = allAssets.filter((a) => affectedIds.has(a.id));

    const plan = generateRecoveryPlan(targetSummary, allAssets, dependents);

    return res.status(200).json({ data: plan });
  } catch (err) {
    return sendError(res, err);
  }
}
