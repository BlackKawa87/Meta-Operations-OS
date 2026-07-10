import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard } from '../_lib/http';
import { getServiceClient } from '../_lib/supabaseServer';
import { DEFAULT_WORKSPACE_ID } from '../_lib/config';

const PROBLEMATIC_STATUSES = ['blocked', 'restricted', 'suspended', 'disabled', 'at_risk', 'limited', 'needs_verification'];

// No "missing owner" alert: Single Operator Mode has no UI to assign
// owner_id, so that check would flag every asset with no way to resolve
// it. Bring it back alongside the owner picker when multi-user returns.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  try {
    const supabase = getServiceClient();

    const [{ data: assets, error: assetsError }, { data: notes }, { data: docs }, { data: rels }] = await Promise.all([
      supabase
        .from('assets')
        .select('id, name, status, criticality, backup_coverage, asset_types(label_en)')
        .eq('workspace_id', DEFAULT_WORKSPACE_ID)
        .is('archived_at', null),
      supabase.from('asset_notes').select('asset_id').eq('workspace_id', DEFAULT_WORKSPACE_ID),
      supabase.from('asset_documents').select('asset_id').eq('workspace_id', DEFAULT_WORKSPACE_ID),
      supabase.from('asset_relationships').select('source_asset_id, target_asset_id').eq('workspace_id', DEFAULT_WORKSPACE_ID),
    ]);
    if (assetsError) throw assetsError;

    const docCount = new Map<string, number>();
    for (const n of notes ?? []) docCount.set(n.asset_id, (docCount.get(n.asset_id) ?? 0) + 1);
    for (const d of docs ?? []) docCount.set(d.asset_id, (docCount.get(d.asset_id) ?? 0) + 1);

    const relCount = new Map<string, number>();
    const dependentCount = new Map<string, number>();
    for (const r of rels ?? []) {
      relCount.set(r.source_asset_id, (relCount.get(r.source_asset_id) ?? 0) + 1);
      relCount.set(r.target_asset_id, (relCount.get(r.target_asset_id) ?? 0) + 1);
      dependentCount.set(r.target_asset_id, (dependentCount.get(r.target_asset_id) ?? 0) + 1);
    }

    const alerts = (assets ?? []).flatMap((asset) => {
      const found: { type: string; asset: typeof asset }[] = [];
      const hasDependents = (dependentCount.get(asset.id) ?? 0) > 0;

      if (asset.criticality === 'critical' && asset.backup_coverage === 0) {
        found.push({ type: 'criticalNoBackup', asset });
      }
      if (['blocked', 'restricted', 'suspended'].includes(asset.status) && hasDependents) {
        found.push({ type: 'blockedActive', asset });
      }
      if ((docCount.get(asset.id) ?? 0) === 0) {
        found.push({ type: 'noDocs', asset });
      }
      if ((relCount.get(asset.id) ?? 0) === 0) {
        found.push({ type: 'noRelationships', asset });
      }
      if (PROBLEMATIC_STATUSES.includes(asset.status)) {
        found.push({ type: 'problematicStatus', asset });
      }
      return found;
    });

    return res.status(200).json({ data: alerts });
  } catch (err) {
    return sendError(res, err);
  }
}
