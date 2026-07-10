// Hand-written to match supabase/migrations/*.sql. Once the project is
// linked (`supabase link`), regenerate with:
//   supabase gen types typescript --linked > src/types/database.ts
// and re-apply the `@/*` import alias usage across the app if needed.

export type AssetStatus =
  | 'active' | 'inactive' | 'pending' | 'under_review' | 'limited' | 'restricted'
  | 'blocked' | 'disabled' | 'suspended' | 'needs_verification' | 'at_risk'
  | 'backup' | 'archived';

export type Criticality = 'low' | 'medium' | 'high' | 'critical';

export type MembershipRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer' | 'auditor';

export type RelationshipType =
  | 'owns' | 'uses' | 'depends_on' | 'shares_with' | 'managed_by' | 'backup_for'
  | 'connected_to' | 'assigned_to' | 'verified_by' | 'funded_by' | 'controls' | 'runs_on';

export type RelationshipStrength = 'informational' | 'normal' | 'critical';

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface WorkspaceRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface TeamRow {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface UserProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: 'en' | 'pt' | 'es';
  created_at: string;
  updated_at: string;
}

export interface MembershipRow {
  id: string;
  user_id: string;
  workspace_id: string;
  team_id: string | null;
  role: MembershipRole;
  created_at: string;
  created_by: string | null;
}

export interface AssetTypeFieldDef {
  key: string;
  label_en: string;
  label_pt: string;
  label_es: string;
  type: 'text' | 'textarea' | 'number' | 'url' | 'date' | 'select' | 'boolean';
  required: boolean;
  options?: string[];
}

export interface AssetTypeRoleDef {
  key: string;
  label_en: string;
  label_pt: string;
  label_es: string;
}

export interface AssetTypeRow {
  id: string;
  key: string;
  category: string;
  label_en: string;
  label_pt: string;
  label_es: string;
  icon: string;
  fields: AssetTypeFieldDef[];
  roles: AssetTypeRoleDef[];
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  id: string;
  workspace_id: string;
  asset_type_id: string;
  architecture_id: string | null;
  role: string | null;
  name: string;
  description: string | null;
  status: AssetStatus;
  criticality: Criticality;
  owner_id: string | null;
  team_id: string | null;
  health_score: number;
  risk_score: number;
  recovery_score: number;
  backup_coverage: number;
  attributes: Record<string, unknown>;
  tags: string[];
  last_used_at: string | null;
  last_incident_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface AssetStatusHistoryRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AssetNoteRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface AssetDocumentRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  title: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  created_by: string | null;
}

export interface AssetRelationshipRow {
  id: string;
  workspace_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: RelationshipType;
  strength: RelationshipStrength;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AssetScoreRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  health_score: number;
  risk_score: number;
  recovery_score: number;
  backup_coverage: number;
  criticality: Criticality;
  reasons: string[];
  calculated_at: string;
}

export interface AssetEventRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface AuditLogRow {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: 'insert' | 'update' | 'delete' | 'status_change';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface OperationalArchitectureRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  country: string | null;
  product: string | null;
  environment: 'production' | 'testing' | 'recovery';
  objective: string | null;
  status: 'active' | 'inactive' | 'archived';
  continuity_score: number;
  health_score: number;
  created_at: string;
  updated_at: string;
  last_audit_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  done_at: string | null;
}

export interface ChecklistRow {
  id: string;
  workspace_id: string;
  architecture_id: string | null;
  title: string;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Database {
  public: {
    Tables: {
      companies: { Row: CompanyRow; Insert: Partial<CompanyRow>; Update: Partial<CompanyRow> };
      workspaces: { Row: WorkspaceRow; Insert: Partial<WorkspaceRow>; Update: Partial<WorkspaceRow> };
      teams: { Row: TeamRow; Insert: Partial<TeamRow>; Update: Partial<TeamRow> };
      users_profile: { Row: UserProfileRow; Insert: Partial<UserProfileRow>; Update: Partial<UserProfileRow> };
      memberships: { Row: MembershipRow; Insert: Partial<MembershipRow>; Update: Partial<MembershipRow> };
      asset_types: { Row: AssetTypeRow; Insert: Partial<AssetTypeRow>; Update: Partial<AssetTypeRow> };
      assets: { Row: AssetRow; Insert: Partial<AssetRow>; Update: Partial<AssetRow> };
      asset_status_history: { Row: AssetStatusHistoryRow; Insert: Partial<AssetStatusHistoryRow>; Update: Partial<AssetStatusHistoryRow> };
      asset_notes: { Row: AssetNoteRow; Insert: Partial<AssetNoteRow>; Update: Partial<AssetNoteRow> };
      asset_documents: { Row: AssetDocumentRow; Insert: Partial<AssetDocumentRow>; Update: Partial<AssetDocumentRow> };
      asset_relationships: { Row: AssetRelationshipRow; Insert: Partial<AssetRelationshipRow>; Update: Partial<AssetRelationshipRow> };
      asset_scores: { Row: AssetScoreRow; Insert: Partial<AssetScoreRow>; Update: Partial<AssetScoreRow> };
      asset_events: { Row: AssetEventRow; Insert: Partial<AssetEventRow>; Update: Partial<AssetEventRow> };
      audit_logs: { Row: AuditLogRow; Insert: Partial<AuditLogRow>; Update: Partial<AuditLogRow> };
    };
  };
}
