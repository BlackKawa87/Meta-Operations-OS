import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssetRow } from '../../src/types/database';
import { computeAssetScores } from '../../src/lib/scoring';

// Recalculates and persists the score snapshot for one asset: writes the
// denormalized current values on `assets` and appends a row to
// `asset_scores` (history). Called after any mutation that could change the
// inputs (status change, note/document added, relationship added/removed) —
// the "cálculo inicial simples baseado em regras" the module asks for, run
// synchronously rather than on a schedule.
export async function recomputeAssetScores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  asset: Pick<AssetRow, 'id' | 'workspace_id' | 'status' | 'criticality'>,
) {
  const [{ count: noteCount }, { count: docCount }, { data: relationships }] = await Promise.all([
    supabase.from('asset_notes').select('id', { count: 'exact', head: true }).eq('asset_id', asset.id),
    supabase.from('asset_documents').select('id', { count: 'exact', head: true }).eq('asset_id', asset.id),
    supabase
      .from('asset_relationships')
      .select('relationship_type, source_asset_id, target_asset_id')
      .or(`source_asset_id.eq.${asset.id},target_asset_id.eq.${asset.id}`),
  ]);

  const rels = relationships ?? [];
  const hasBackupCoverage = rels.some((r) => r.relationship_type === 'backup_for');
  const dependentCount = rels.filter(
    (r) => r.target_asset_id === asset.id && r.source_asset_id !== asset.id,
  ).length;

  const result = computeAssetScores({
    status: asset.status,
    criticality: asset.criticality,
    hasDocumentation: (noteCount ?? 0) > 0 || (docCount ?? 0) > 0,
    hasBackupCoverage,
    dependentCount,
  });

  await supabase
    .from('assets')
    .update({
      health_score: result.health_score,
      risk_score: result.risk_score,
      recovery_score: result.recovery_score,
      backup_coverage: result.backup_coverage,
      criticality: result.criticality,
    })
    .eq('id', asset.id);

  await supabase.from('asset_scores').insert({
    workspace_id: asset.workspace_id,
    asset_id: asset.id,
    health_score: result.health_score,
    risk_score: result.risk_score,
    recovery_score: result.recovery_score,
    backup_coverage: result.backup_coverage,
    criticality: result.criticality,
    reasons: result.reasons,
  });

  return result;
}
