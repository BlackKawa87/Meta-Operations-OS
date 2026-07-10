import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http';
import { getServiceClient } from '../../_lib/supabaseServer';
import { createAssetRelationshipSchema } from '../../../src/lib/validation/asset';
import { recomputeAssetScores } from '../../_lib/recompute';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      // Direct relationships only (both directions) — the "basic preview"
      // this module ships; full recursive blast-radius traversal is the
      // Relationship Engine's job in a later phase (ARCHITECTURE.md §20).
      const { data, error } = await supabase
        .from('asset_relationships')
        .select(
          '*, source:assets!asset_relationships_source_asset_id_fkey(id, name, status), target:assets!asset_relationships_target_asset_id_fkey(id, name, status)',
        )
        .or(`source_asset_id.eq.${id},target_asset_id.eq.${id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    const parsed = createAssetRelationshipSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }
    if (parsed.data.target_asset_id === id) {
      throw new HttpError(400, 'An asset cannot relate to itself');
    }

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();
    if (assetError) throw new HttpError(404, 'Asset not found');

    const { data: rel, error: relError } = await supabase
      .from('asset_relationships')
      .insert({
        workspace_id: asset.workspace_id,
        source_asset_id: id,
        target_asset_id: parsed.data.target_asset_id,
        relationship_type: parsed.data.relationship_type,
        strength: parsed.data.strength,
        notes: parsed.data.notes ?? null,
      })
      .select('*')
      .single();
    if (relError) throw relError;

    await supabase.from('asset_events').insert({
      workspace_id: asset.workspace_id,
      asset_id: id,
      event_type: 'relationship.created',
      payload: { target_asset_id: rel.target_asset_id, relationship_type: rel.relationship_type },
    });

    await recomputeAssetScores(supabase, asset);
    // The target asset's dependent count changed too (it's now depended on / backed up).
    const { data: targetAsset } = await supabase.from('assets').select('*').eq('id', rel.target_asset_id).single();
    if (targetAsset) await recomputeAssetScores(supabase, targetAsset);

    return res.status(201).json({ data: rel });
  } catch (err) {
    return sendError(res, err);
  }
}
