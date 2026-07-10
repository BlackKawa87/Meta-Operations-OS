import { z } from 'zod';

export const ASSET_STATUSES = [
  'active', 'inactive', 'pending', 'under_review', 'limited', 'restricted',
  'blocked', 'disabled', 'suspended', 'needs_verification', 'at_risk',
  'backup', 'archived',
] as const;

export const CRITICALITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const RELATIONSHIP_TYPES = [
  'owns', 'uses', 'depends_on', 'shares_with', 'managed_by', 'backup_for',
  'connected_to', 'assigned_to', 'verified_by', 'funded_by', 'controls', 'runs_on',
] as const;

export const RELATIONSHIP_STRENGTHS = ['informational', 'normal', 'critical'] as const;

// `workspace_id` is intentionally not a client-supplied field: in Single
// Operator Mode the API always injects DEFAULT_WORKSPACE_ID server-side
// (see api/_lib/config.ts). `owner_id`/`team_id` stay in the schema for
// when multi-tenant/multi-user comes back, even though the UI doesn't
// expose them right now.
export const createAssetSchema = z.object({
  asset_type_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(4000).optional().nullable(),
  status: z.enum(ASSET_STATUSES).default('pending'),
  criticality: z.enum(CRITICALITY_LEVELS).default('medium'),
  owner_id: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string().max(40)).max(20).default([]),
});

export const updateAssetSchema = createAssetSchema.omit({ asset_type_id: true }).partial();

export const updateAssetStatusSchema = z.object({
  new_status: z.enum(ASSET_STATUSES),
  reason: z.string().max(1000).optional().nullable(),
});

export const createAssetNoteSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const updateAssetNoteSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const createAssetRelationshipSchema = z.object({
  target_asset_id: z.string().uuid(),
  relationship_type: z.enum(RELATIONSHIP_TYPES),
  strength: z.enum(RELATIONSHIP_STRENGTHS).default('normal'),
  notes: z.string().max(2000).optional().nullable(),
});

// The client sends the file inline as base64 (no direct browser-to-Storage
// upload anymore — there's no user JWT for Storage RLS to check against in
// Single Operator Mode). The API decodes it, uploads via the service-role
// client, and computes storage_path/size_bytes itself. Fine for the
// single-operator document sizes this module targets; a large-file path
// (signed upload URLs) can come back once multi-tenant/auth is reactivated.
export const createAssetDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  file_name: z.string().min(1),
  mime_type: z.string().optional().nullable(),
  content_base64: z.string().min(1),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type UpdateAssetStatusInput = z.infer<typeof updateAssetStatusSchema>;
export type CreateAssetNoteInput = z.infer<typeof createAssetNoteSchema>;
export type CreateAssetRelationshipInput = z.infer<typeof createAssetRelationshipSchema>;
export type CreateAssetDocumentInput = z.infer<typeof createAssetDocumentSchema>;
