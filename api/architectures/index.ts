import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../_lib/http.js';
import { getServiceClient } from '../_lib/supabaseServer.js';
import { DEFAULT_WORKSPACE_ID } from '../_lib/config.js';
import { createArchitectureSchema } from '../../src/lib/validation/architecture.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('operational_architectures')
        .select('*')
        .eq('workspace_id', DEFAULT_WORKSPACE_ID)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    const parsed = createArchitectureSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { data, error } = await supabase
      .from('operational_architectures')
      .insert({ ...parsed.data, workspace_id: DEFAULT_WORKSPACE_ID })
      .select('*')
      .single();
    if (error) throw error;

    return res.status(201).json({ data });
  } catch (err) {
    return sendError(res, err);
  }
}
