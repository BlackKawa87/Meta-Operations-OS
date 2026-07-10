import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';
import { updateAssetStatusSchema } from '../../../src/lib/validation/asset.js';
import { recomputeAssetScores } from '../../_lib/recompute.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['PATCH'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();
    const parsed = updateAssetStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { data: current, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw new HttpError(404, 'Asset not found');

    const { new_status, reason } = parsed.data;

    const { data: updated, error: updateError } = await supabase
      .from('assets')
      .update({ status: new_status })
      .eq('id', id)
      .select('*')
      .single();
    if (updateError) throw updateError;

    await supabase.from('asset_status_history').insert({
      workspace_id: updated.workspace_id,
      asset_id: updated.id,
      previous_status: current.status,
      new_status,
      reason: reason ?? null,
    });

    await supabase.from('asset_events').insert({
      workspace_id: updated.workspace_id,
      asset_id: updated.id,
      event_type: 'asset.status_changed',
      payload: { previous_status: current.status, new_status },
    });

    const scores = await recomputeAssetScores(supabase, updated);

    return res.status(200).json({ data: { ...updated, ...scores } });
  } catch (err) {
    return sendError(res, err);
  }
}
