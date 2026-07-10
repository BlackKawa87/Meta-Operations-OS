import type { AssetStatus, Criticality, RelationshipType } from '../types/database.js';

// Deterministic, rule-based engines for Contingency Core — same philosophy
// as scoring.ts: every number is explainable from real data, never a
// guess. See ARCHITECTURE.md §21 for the design this implements.

const PROBLEMATIC_STATUSES: AssetStatus[] = [
  'blocked', 'restricted', 'suspended', 'disabled', 'at_risk', 'limited', 'needs_verification',
];

// Roles considered "live" (actively used by the operation) vs. roles that
// count as redundancy coverage for a live role of the same asset type.
const LIVE_ROLES = new Set(['vault', 'production', 'master', 'operational', 'primary', 'secondary', 'owner', 'administrator', 'advertiser']);
const BACKUP_ROLES = new Set(['backup', 'standby', 'recovery']);

// The "vault" role (BM Fortaleza / VM Vault) and "master" role (Pixel
// Master) are the architecture's core patrimony — losing them without a
// backup counterpart is always the top continuity finding, regardless of
// any other score (ARCHITECTURE.md §21.5).
const PATRIMONY_ROLES = new Set(['vault', 'master']);

export interface ArchitectureAssetSummary {
  id: string;
  name: string;
  type_key: string;
  role: string | null;
  status: AssetStatus;
  criticality: Criticality;
  health_score: number;
  backup_coverage: number;
}

export interface RelationshipEdge {
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: RelationshipType;
}

export interface SpofFinding {
  asset_id: string;
  asset_name: string;
  type_key: string;
  role: string | null;
  reason: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface ContinuityResult {
  score: number;
  reasons: string[];
  spof: SpofFinding[];
}

function hasBackupCounterpart(asset: ArchitectureAssetSummary, all: ArchitectureAssetSummary[]): boolean {
  return all.some((a) => a.id !== asset.id && a.type_key === asset.type_key && a.role !== null && BACKUP_ROLES.has(a.role));
}

export function computeContinuity(assets: ArchitectureAssetSummary[]): ContinuityResult {
  const reasons: string[] = [];
  const spof: SpofFinding[] = [];
  let score = 100;

  const liveCoreAssets = assets.filter((a) => a.role !== null && LIVE_ROLES.has(a.role));

  for (const asset of liveCoreAssets) {
    if (!hasBackupCounterpart(asset, assets)) {
      const isPatrimony = PATRIMONY_ROLES.has(asset.role!);
      const penalty = isPatrimony ? 25 : 12;
      score -= penalty;
      const reason = `${asset.name} (${asset.role}) has no backup counterpart of the same type`;
      reasons.push(reason);
      spof.push({
        asset_id: asset.id,
        asset_name: asset.name,
        type_key: asset.type_key,
        role: asset.role,
        reason,
        severity: isPatrimony ? 'critical' : 'high',
      });
    }
  }

  // Single-administrator check: exactly one profile holding owner/administrator
  // across the whole architecture is a continuity risk (ARCHITECTURE.md §21.6).
  const admins = assets.filter((a) => a.type_key === 'profile' && (a.role === 'owner' || a.role === 'administrator'));
  if (admins.length === 1) {
    score -= 15;
    const reason = `Only one administrator profile (${admins[0].name}) — no one else can take over access`;
    reasons.push(reason);
    spof.push({
      asset_id: admins[0].id,
      asset_name: admins[0].name,
      type_key: 'profile',
      role: admins[0].role,
      reason,
      severity: 'high',
    });
  } else if (admins.length === 0 && assets.some((a) => a.type_key === 'profile')) {
    score -= 10;
    reasons.push('No profile holds the owner/administrator role in this architecture');
  }

  if (liveCoreAssets.length === 0) {
    reasons.push('No core assets (BM, Pixel, Account, Profile, VM, Domain, Page) have a role assigned yet — assign roles to enable continuity analysis');
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, spof };
}

export function computeArchitectureHealth(assets: ArchitectureAssetSummary[]): { score: number; reasons: string[] } {
  if (assets.length === 0) return { score: 100, reasons: ['No assets assigned to this architecture yet'] };

  const reasons: string[] = [];
  const problematic = assets.filter((a) => PROBLEMATIC_STATUSES.includes(a.status));
  const avgAssetHealth = Math.round(assets.reduce((sum, a) => sum + a.health_score, 0) / assets.length);

  let score = avgAssetHealth;
  if (problematic.length > 0) {
    score -= Math.min(40, problematic.length * 10);
    reasons.push(`${problematic.length} asset(s) in a problematic status: ${problematic.map((a) => a.name).join(', ')}`);
  }
  const needsVerification = assets.filter((a) => a.status === 'needs_verification');
  if (needsVerification.length > 0) {
    reasons.push(`${needsVerification.length} asset(s) pending verification`);
  }
  if (reasons.length === 0) reasons.push('All assets healthy and active');

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export type RecoveryReadiness = 'ready' | 'partial' | 'critical' | 'insufficient';

export function computeRecoveryReadiness(continuityScore: number, spofCount: number): { level: RecoveryReadiness; reason: string } {
  if (continuityScore >= 80 && spofCount === 0) {
    return { level: 'ready', reason: 'No single points of failure detected; every core role has backup coverage' };
  }
  if (continuityScore >= 50) {
    return { level: 'partial', reason: `${spofCount} single point(s) of failure found, but overall coverage is adequate` };
  }
  if (continuityScore >= 25) {
    return { level: 'critical', reason: `${spofCount} single point(s) of failure — recovery would require creating new assets, not just promoting backups` };
  }
  return { level: 'insufficient', reason: `${spofCount} single point(s) of failure with little to no redundancy — this architecture cannot self-recover today` };
}

export interface RecoveryStep {
  label: string;
  estimated_minutes: number;
}

export interface RecoveryPlan {
  target_asset_id: string;
  target_asset_name: string;
  steps: RecoveryStep[];
  total_estimated_minutes: number;
  strategy: 'promote_backup' | 'create_new';
}

// Generates the recovery plan for losing one specific asset — the
// "Failure Simulator" / "Recovery Plan" contract from ARCHITECTURE.md §21.
export function generateRecoveryPlan(
  target: ArchitectureAssetSummary,
  allAssets: ArchitectureAssetSummary[],
  dependents: ArchitectureAssetSummary[],
): RecoveryPlan {
  const backupCandidate = allAssets.find(
    (a) => a.id !== target.id && a.type_key === target.type_key && a.role !== null && BACKUP_ROLES.has(a.role),
  );

  const steps: RecoveryStep[] = [];

  if (backupCandidate) {
    steps.push({ label: `Promote ${backupCandidate.name} from "${backupCandidate.role}" to "${target.role}"`, estimated_minutes: 5 });
    steps.push({ label: `Re-establish sharing/relationships previously pointing at ${target.name}`, estimated_minutes: 5 * Math.max(1, dependents.length) });
    steps.push({ label: 'Validate the promoted asset is functioning correctly', estimated_minutes: 5 });
    if (dependents.length > 0) {
      steps.push({ label: `Reactivate ${dependents.length} dependent asset(s): ${dependents.slice(0, 5).map((d) => d.name).join(', ')}${dependents.length > 5 ? '…' : ''}`, estimated_minutes: 3 * dependents.length });
    }
    const total = steps.reduce((sum, s) => sum + s.estimated_minutes, 0);
    return { target_asset_id: target.id, target_asset_name: target.name, steps, total_estimated_minutes: total, strategy: 'promote_backup' };
  }

  steps.push({ label: `Create a new ${target.type_key} asset with role "${target.role}" (no backup exists — full rebuild required)`, estimated_minutes: 20 });
  steps.push({ label: 'Re-establish sharing/relationships from the surviving core assets', estimated_minutes: 10 * Math.max(1, dependents.length) });
  steps.push({ label: 'Validate the new asset end-to-end', estimated_minutes: 10 });
  if (dependents.length > 0) {
    steps.push({ label: `Reactivate ${dependents.length} dependent asset(s): ${dependents.slice(0, 5).map((d) => d.name).join(', ')}${dependents.length > 5 ? '…' : ''}`, estimated_minutes: 5 * dependents.length });
  }
  const total = steps.reduce((sum, s) => sum + s.estimated_minutes, 0);
  return { target_asset_id: target.id, target_asset_name: target.name, steps, total_estimated_minutes: total, strategy: 'create_new' };
}
