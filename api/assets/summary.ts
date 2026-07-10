import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard } from '../_lib/http';
import { getServiceClient } from '../_lib/supabaseServer';
import { DEFAULT_WORKSPACE_ID } from '../_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('assets')
      .select('status, criticality, backup_coverage')
      .eq('workspace_id', DEFAULT_WORKSPACE_ID)
      .is('archived_at', null);
    if (error) throw error;

    const rows = data ?? [];
    const summary = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      at_risk: rows.filter((r) => r.status === 'at_risk').length,
      blocked: rows.filter((r) => ['blocked', 'restricted', 'suspended', 'disabled'].includes(r.status)).length,
      no_backup: rows.filter((r) => r.backup_coverage === 0).length,
      critical: rows.filter((r) => r.criticality === 'critical').length,
    };

    return res.status(200).json({ data: summary });
  } catch (err) {
    return sendError(res, err);
  }
}
