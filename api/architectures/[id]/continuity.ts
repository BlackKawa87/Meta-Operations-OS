import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';
import { computeContinuity, computeArchitectureHealth, computeRecoveryReadiness, type ArchitectureAssetSummary } from '../../../src/lib/contingency.js';

// The Contingency Core "engine" endpoint: answers the platform's core
// question for one Operational Architecture — continuity score, health
// score, single points of failure, and recovery readiness, all computed
// live from real asset/role data (ARCHITECTURE.md §21).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    const { error: archError } = await supabase
      .from('operational_architectures')
      .select('id')
      .eq('id', id)
      .single();
    if (archError) throw new HttpError(404, 'Architecture not found');

    const { data: rows, error: assetsError } = await supabase
      .from('assets')
      .select('id, name, role, status, criticality, health_score, backup_coverage, asset_types(key)')
      .eq('architecture_id', id)
      .is('archived_at', null);
    if (assetsError) throw assetsError;

    const assets: ArchitectureAssetSummary[] = (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      type_key: (r.asset_types as unknown as { key: string }).key,
      role: r.role,
      status: r.status,
      criticality: r.criticality,
      health_score: r.health_score,
      backup_coverage: r.backup_coverage,
    }));

    const continuity = computeContinuity(assets);
    const health = computeArchitectureHealth(assets);
    const readiness = computeRecoveryReadiness(continuity.score, continuity.spof.length);

    await supabase
      .from('operational_architectures')
      .update({ continuity_score: continuity.score, health_score: health.score, last_audit_at: new Date().toISOString() })
      .eq('id', id);

    return res.status(200).json({
      data: {
        architecture_id: id,
        continuity_score: continuity.score,
        continuity_reasons: continuity.reasons,
        health_score: health.score,
        health_reasons: health.reasons,
        spof: continuity.spof,
        recovery_readiness: readiness.level,
        recovery_readiness_reason: readiness.reason,
        asset_count: assets.length,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
}
