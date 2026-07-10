import type { AssetStatus, Criticality } from '@/types/database';

const PROBLEMATIC_STATUSES: AssetStatus[] = [
  'blocked', 'restricted', 'suspended', 'disabled', 'at_risk', 'limited', 'needs_verification',
];

const CRITICALITY_ORDER: Criticality[] = ['low', 'medium', 'high', 'critical'];

export interface ScoreInput {
  status: AssetStatus;
  criticality: Criticality;
  hasDocumentation: boolean; // at least one note or document
  hasBackupCoverage: boolean; // a 'backup_for' relationship exists for this asset
  dependentCount: number; // how many other assets point at this one (depends_on/uses/etc.)
}

export interface ScoreResult {
  health_score: number;
  risk_score: number;
  recovery_score: number;
  backup_coverage: number;
  criticality: Criticality;
  reasons: string[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function escalate(current: Criticality, minimum: Criticality): Criticality {
  return CRITICALITY_ORDER.indexOf(current) >= CRITICALITY_ORDER.indexOf(minimum) ? current : minimum;
}

// Rule-based v1 scoring — the initial, simple calculation the module asks
// for. The full Health Engine (weighted history, incident correlation,
// scheduled recomputation) is a later phase per ARCHITECTURE.md roadmap.
//
// No "missing owner" penalty here: Single Operator Mode has no UI to assign
// `owner_id` (it requires a user to assign it to), so that check would flag
// every asset permanently with no way to resolve it. Bring it back alongside
// the owner picker when multi-user is reactivated.
export function computeAssetScores(input: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  let health = 100;
  let risk = 0;
  let recovery = 100;
  let criticality = input.criticality;

  if (PROBLEMATIC_STATUSES.includes(input.status)) {
    health -= 30;
    risk += 15;
    reasons.push(`Status "${input.status}" reduces health and adds risk`);
  }

  if (!input.hasDocumentation) {
    health -= 15;
    reasons.push('No documentation (notes or documents) on file');
  }

  if (!input.hasBackupCoverage) {
    recovery -= 40;
    reasons.push('No backup relationship found for this asset');
  }

  if (input.dependentCount >= 5) {
    criticality = escalate(criticality, 'critical');
    reasons.push(`${input.dependentCount} other assets depend on this one`);
  } else if (input.dependentCount >= 2) {
    criticality = escalate(criticality, 'high');
    reasons.push(`${input.dependentCount} other assets depend on this one`);
  }

  if (criticality === 'critical') risk += 20;
  else if (criticality === 'high') risk += 10;

  const backup_coverage = input.hasBackupCoverage ? 100 : 0;

  return {
    health_score: clamp(health),
    risk_score: clamp(risk),
    recovery_score: clamp(recovery),
    backup_coverage,
    criticality,
    reasons,
  };
}
