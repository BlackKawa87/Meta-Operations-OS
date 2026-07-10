import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('asset_status_history')
      .select('*')
      .eq('asset_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ data });
  } catch (err) {
    return sendError(res, err);
  }
}
