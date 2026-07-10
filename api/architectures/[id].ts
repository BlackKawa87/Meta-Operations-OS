import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../_lib/http.js';
import { getServiceClient } from '../_lib/supabaseServer.js';
import { updateArchitectureSchema } from '../../src/lib/validation/architecture.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'PATCH'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('operational_architectures').select('*').eq('id', id).single();
      if (error) throw new HttpError(404, 'Architecture not found');
      return res.status(200).json({ data });
    }

    const parsed = updateArchitectureSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { data, error } = await supabase
      .from('operational_architectures')
      .update(parsed.data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    return res.status(200).json({ data });
  } catch (err) {
    return sendError(res, err);
  }
}
