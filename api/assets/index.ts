import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../_lib/http.js';
import { getServiceClient } from '../_lib/supabaseServer.js';
import { DEFAULT_WORKSPACE_ID } from '../_lib/config.js';
import { createAssetSchema } from '../../src/lib/validation/asset.js';
import { recomputeAssetScores } from '../_lib/recompute.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      const { status, asset_type_id, criticality, search, include_archived } = req.query;

      let query = supabase
        .from('assets')
        .select('*, asset_types(key, label_en, label_pt, label_es, icon, category)')
        .eq('workspace_id', DEFAULT_WORKSPACE_ID)
        .order('updated_at', { ascending: false });

      if (include_archived !== 'true') {
        query = query.is('archived_at', null);
      }
      if (typeof status === 'string') query = query.eq('status', status);
      if (typeof asset_type_id === 'string') query = query.eq('asset_type_id', asset_type_id);
      if (typeof criticality === 'string') query = query.eq('criticality', criticality);
      if (typeof search === 'string' && search.trim()) query = query.ilike('name', `%${search.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ data });
    }

    // POST — create asset
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }
    const input = parsed.data;

    const { data: created, error: insertError } = await supabase
      .from('assets')
      .insert({
        ...input,
        workspace_id: DEFAULT_WORKSPACE_ID,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    await supabase.from('asset_status_history').insert({
      workspace_id: created.workspace_id,
      asset_id: created.id,
      previous_status: null,
      new_status: created.status,
      reason: 'Asset created',
    });

    await supabase.from('asset_events').insert({
      workspace_id: created.workspace_id,
      asset_id: created.id,
      event_type: 'asset.created',
      payload: { name: created.name, status: created.status },
    });

    const scores = await recomputeAssetScores(supabase, created);

    return res.status(201).json({ data: { ...created, ...scores } });
  } catch (err) {
    return sendError(res, err);
  }
}
