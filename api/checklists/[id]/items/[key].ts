import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../../_lib/http.js';
import { getServiceClient } from '../../../_lib/supabaseServer.js';
import type { ChecklistItem } from '../../../../src/types/database.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['PATCH'])) return;
  const id = req.query.id as string;
  const key = req.query.key as string;
  const done = Boolean(req.body?.done);

  try {
    const supabase = getServiceClient();
    const { data: checklist, error: fetchError } = await supabase.from('checklists').select('*').eq('id', id).single();
    if (fetchError) throw new HttpError(404, 'Checklist not found');

    const items: ChecklistItem[] = (checklist.items as ChecklistItem[]).map((item) =>
      item.key === key ? { ...item, done, done_at: done ? new Date().toISOString() : null } : item,
    );

    const { data, error } = await supabase.from('checklists').update({ items }).eq('id', id).select('*').single();
    if (error) throw error;

    return res.status(200).json({ data });
  } catch (err) {
    return sendError(res, err);
  }
}
