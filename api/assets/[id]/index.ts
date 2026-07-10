import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';
import { updateAssetSchema } from '../../../src/lib/validation/asset.js';
import { recomputeAssetScores } from '../../_lib/recompute.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('assets')
        .select('*, asset_types(key, label_en, label_pt, label_es, icon, category, fields)')
        .eq('id', id)
        .single();
      if (error) throw new HttpError(404, 'Asset not found');
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE') {
      // Soft delete only — never a hard DELETE on an asset (see ARCHITECTURE.md §13.7).
      const { data, error } = await supabase
        .from('assets')
        .update({ archived_at: new Date().toISOString(), status: 'archived' })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      await supabase.from('asset_events').insert({
        workspace_id: data.workspace_id,
        asset_id: data.id,
        event_type: 'asset.archived',
        payload: {},
      });

      return res.status(200).json({ data });
    }

    // PATCH — update
    const parsed = updateAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { data: updated, error: updateError } = await supabase
      .from('assets')
      .update({ ...parsed.data })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    await supabase.from('asset_events').insert({
      workspace_id: updated.workspace_id,
      asset_id: updated.id,
      event_type: 'asset.updated',
      payload: { fields: Object.keys(parsed.data) },
    });

    const scores = await recomputeAssetScores(supabase, updated);

    return res.status(200).json({ data: { ...updated, ...scores } });
  } catch (err) {
    return sendError(res, err);
  }
}
