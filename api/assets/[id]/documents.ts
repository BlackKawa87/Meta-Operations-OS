import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, methodGuard, HttpError } from '../../_lib/http.js';
import { getServiceClient } from '../../_lib/supabaseServer.js';
import { createAssetDocumentSchema } from '../../../src/lib/validation/asset.js';
import { recomputeAssetScores } from '../../_lib/recompute.js';

// Body size for base64-encoded uploads is capped by Vercel's default
// serverless request body limit (~4.5MB) — fine for the documents this
// module targets (notes, PDFs, screenshots). Larger files are a later
// concern (signed upload URLs), reintroduced alongside multi-tenant auth.
export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const id = req.query.id as string;

  try {
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('asset_documents')
        .select('*')
        .eq('asset_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    const parsed = createAssetDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { title, file_name, mime_type, content_base64 } = parsed.data;

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();
    if (assetError) throw new HttpError(404, 'Asset not found');

    const buffer = Buffer.from(content_base64, 'base64');
    const storagePath = `${asset.workspace_id}/${asset.id}/${Date.now()}-${file_name}`;

    const { error: uploadError } = await supabase.storage
      .from('asset-documents')
      .upload(storagePath, buffer, { contentType: mime_type ?? 'application/octet-stream' });
    if (uploadError) throw new HttpError(500, `Upload failed: ${uploadError.message}`);

    const { data: doc, error: docError } = await supabase
      .from('asset_documents')
      .insert({
        workspace_id: asset.workspace_id,
        asset_id: id,
        title,
        file_name,
        mime_type: mime_type ?? null,
        storage_path: storagePath,
        size_bytes: buffer.byteLength,
      })
      .select('*')
      .single();
    if (docError) throw docError;

    await supabase.from('asset_events').insert({
      workspace_id: asset.workspace_id,
      asset_id: id,
      event_type: 'asset.document_added',
      payload: { title: doc.title },
    });

    await recomputeAssetScores(supabase, asset);

    return res.status(201).json({ data: doc });
  } catch (err) {
    return sendError(res, err);
  }
}
