import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';

// Impact Engine: unlimited-depth, bidirectional blast radius via the
// get_asset_impact() recursive SQL function (ARCHITECTURE.md §21.7).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;
  const id = req.query.id as string;
  const maxDepth = req.query.depth ? Number(req.query.depth) : 10;

  try {
    const supabase = getServiceClient();

    const { data: target, error: targetError } = await supabase
      .from('assets')
      .select('id, name, role, architecture_id, asset_types(key, label_en)')
      .eq('id', id)
      .single();
    if (targetError) throw new HttpError(404, 'Asset not found');

    const { data: impactRows, error: impactError } = await supabase.rpc('get_asset_impact', {
      p_asset_id: id,
      p_max_depth: maxDepth,
    });
    if (impactError) throw impactError;

    const affectedIds = (impactRows ?? []).map((r: { affected_asset_id: string }) => r.affected_asset_id);
    const { data: affectedAssets } = affectedIds.length
      ? await supabase
          .from('assets')
          .select('id, name, status, criticality, backup_coverage, asset_types(key, label_en, category)')
          .in('id', affectedIds)
      : { data: [] };

    const byId = new Map((affectedAssets ?? []).map((a) => [a.id, a]));
    const enriched = (impactRows ?? []).map((r: { affected_asset_id: string; depth: number; via_relationship_type: string; direction: string }) => ({
      ...r,
      asset: byId.get(r.affected_asset_id) ?? null,
    }));

    const campaigns = enriched.filter((e: (typeof enriched)[number]) => (e.asset?.asset_types as unknown as { key: string })?.key === 'campaign');
    const products = enriched.filter((e: (typeof enriched)[number]) => (e.asset?.asset_types as unknown as { key: string })?.key === 'product');
    const withoutBackup = enriched.filter((e: (typeof enriched)[number]) => (e.asset?.backup_coverage ?? 100) === 0);

    return res.status(200).json({
      data: {
        target,
        affected: enriched,
        total_affected: enriched.length,
        campaigns_affected: campaigns.length,
        products_affected: products.length,
        affected_without_backup: withoutBackup.length,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
}
