import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'asset')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return res.status(200).json({ data });
  } catch (err) {
    return sendError(res, err);
  }
}
