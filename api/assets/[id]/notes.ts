import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http';
import { getServiceClient } from '../../_lib/supabaseServer';
import { createAssetNoteSchema } from '../../../src/lib/validation/asset';
import { recomputeAssetScores } from '../../_lib/recompute';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('asset_notes')
        .select('*')
        .eq('asset_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    const parsed = createAssetNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();
    if (assetError) throw new HttpError(404, 'Asset not found');

    const { data: note, error: noteError } = await supabase
      .from('asset_notes')
      .insert({
        workspace_id: asset.workspace_id,
        asset_id: id,
        body: parsed.data.body,
      })
      .select('*')
      .single();
    if (noteError) throw noteError;

    await supabase.from('asset_events').insert({
      workspace_id: asset.workspace_id,
      asset_id: id,
      event_type: 'asset.note_added',
      payload: {},
    });

    await recomputeAssetScores(supabase, asset);

    return res.status(201).json({ data: note });
  } catch (err) {
    return sendError(res, err);
  }
}
