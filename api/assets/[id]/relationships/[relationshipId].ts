import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../../_lib/http';
import { getServiceClient } from '../../../_lib/supabaseServer';
import { recomputeAssetScores } from '../../../_lib/recompute';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['DELETE'])) return;
  const relationshipId = req.query.relationshipId as string;

  try {
    const supabase = getServiceClient();

    const { data: rel, error: fetchError } = await supabase
      .from('asset_relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();
    if (fetchError) throw new HttpError(404, 'Relationship not found');

    const { error: deleteError } = await supabase.from('asset_relationships').delete().eq('id', relationshipId);
    if (deleteError) throw deleteError;

    await supabase.from('asset_events').insert({
      workspace_id: rel.workspace_id,
      asset_id: rel.source_asset_id,
      event_type: 'relationship.removed',
      payload: { target_asset_id: rel.target_asset_id, relationship_type: rel.relationship_type },
    });

    const [{ data: source }, { data: target }] = await Promise.all([
      supabase.from('assets').select('*').eq('id', rel.source_asset_id).single(),
      supabase.from('assets').select('*').eq('id', rel.target_asset_id).single(),
    ]);
    if (source) await recomputeAssetScores(supabase, source);
    if (target) await recomputeAssetScores(supabase, target);

    return res.status(204).end();
  } catch (err) {
    return sendError(res, err);
  }
}
