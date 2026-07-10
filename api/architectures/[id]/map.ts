import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';

// Contingency Map data: nodes (assets in this architecture, with role +
// backup coverage so the frontend can render protected/unprotected/SPOF
// visually) and edges (relationships between them).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, name, role, status, criticality, backup_coverage, asset_types(key, label_en, icon)')
      .eq('architecture_id', id)
      .is('archived_at', null);
    if (assetsError) throw assetsError;

    const ids = (assets ?? []).map((a) => a.id);
    const edges = ids.length
      ? (
          await supabase
            .from('asset_relationships')
            .select('id, source_asset_id, target_asset_id, relationship_type, strength')
            .in('source_asset_id', ids)
            .in('target_asset_id', ids)
        ).data ?? []
      : [];

    return res.status(200).json({ data: { nodes: assets ?? [], edges } });
  } catch (err) {
    return sendError(res, err);
  }
}
