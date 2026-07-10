import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';
import { createChecklistSchema } from '../../../src/lib/validation/architecture.js';
import type { ChecklistItem } from '../../../src/types/database.js';

// The default continuity checklist template (ARCHITECTURE.md's "Checklist"
// example) — used when the caller doesn't supply custom items.
const DEFAULT_ITEMS: { key: string; label: string }[] = [
  { key: 'vault_bm_created', label: 'BM Fortaleza created' },
  { key: 'pixel_protected', label: 'Master Pixel protected (has a backup)' },
  { key: 'backup_exists', label: 'Backup exists for every core asset' },
  { key: 'reserve_account', label: 'Reserve ad account available' },
  { key: 'profile_backup', label: 'Backup profile available' },
  { key: 'page_backup', label: 'Backup page available' },
  { key: 'domain_backup', label: 'Backup domain available' },
  { key: 'shares_configured', label: 'Sharing from Vault to Production configured' },
  { key: 'audit_done', label: 'Continuity audit performed' },
  { key: 'recovery_validated', label: 'Recovery plan validated' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const architectureId = req.query.id as string;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('architecture_id', architectureId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    const { data: architecture, error: archError } = await supabase
      .from('operational_architectures')
      .select('id, name, workspace_id')
      .eq('id', architectureId)
      .single();
    if (archError) throw new HttpError(404, 'Architecture not found');

    const bodyIsEmpty = !req.body || Object.keys(req.body).length === 0;
    const source = bodyIsEmpty ? { title: `${architecture.name} — Continuity Checklist`, items: DEFAULT_ITEMS } : req.body;

    const parsed = createChecklistSchema.safeParse(source);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }

    const items: ChecklistItem[] = parsed.data.items.map((i) => ({ key: i.key, label: i.label, done: false, done_at: null }));

    const { data, error } = await supabase
      .from('checklists')
      .insert({ workspace_id: architecture.workspace_id, architecture_id: architectureId, title: parsed.data.title, items })
      .select('*')
      .single();
    if (error) throw error;

    return res.status(201).json({ data });
  } catch (err) {
    return sendError(res, err);
  }
}
