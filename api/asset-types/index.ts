import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard } from '../_lib/http.js';
import { getServiceClient } from '../_lib/supabaseServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.from('asset_types').select('*').order('category').order('label_en');
    if (error) throw error;
    return res.status(200).json({ data });
  } catch (err) {
    return sendError(res, err);
  }
}
