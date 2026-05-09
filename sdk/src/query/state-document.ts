/**
 * STATE.md Document Module.
 *
 * Pure transforms for STATE.md text. This module does not read the filesystem
 * and does not own persistence or locking.
 */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stateExtractField(content: string, fieldName: string): string | null {
  const escaped = escapeRegex(fieldName);
  const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*[ \\t]*(.+)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();
  const plainPattern = new RegExp(`^${escaped}:[ \\t]*(.+)`, 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}

export function stateReplaceField(content: string, fieldName: string, newValue: string): string | null {
  const escaped = escapeRegex(fieldName);
  const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (boldPattern.test(content)) {
    return content.replace(boldPattern, (_match, prefix: string) => `${prefix}${newValue}`);
  }
  const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
  if (plainPattern.test(content)) {
    return content.replace(plainPattern, (_match, prefix: string) => `${prefix}${newValue}`);
  }
  return null;
}

export function stateReplaceFieldWithFallback(
  content: string,
  primary: string,
  fallback: string | null,
  value: string,
): string {
  let result = stateReplaceField(content, primary, value);
  if (result) return result;
  if (fallback) {
    result = stateReplaceField(content, fallback, value);
    if (result) return result;
  }
  return content;
}

export function normalizeStateStatus(status: string | null | undefined, pausedAt?: string | null): string {
  let normalizedStatus = status || 'unknown';
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('paused') || statusLower.includes('stopped') || pausedAt) {
    normalizedStatus = 'paused';
  } else if (statusLower.includes('executing') || statusLower.includes('in progress')) {
    normalizedStatus = 'executing';
  } else if (statusLower.includes('planning') || statusLower.includes('ready to plan')) {
    normalizedStatus = 'planning';
  } else if (statusLower.includes('discussing')) {
    normalizedStatus = 'discussing';
  } else if (statusLower.includes('verif')) {
    normalizedStatus = 'verifying';
  } else if (statusLower.includes('complete') || statusLower.includes('done')) {
    normalizedStatus = 'completed';
  } else if (statusLower.includes('ready to execute')) {
    normalizedStatus = 'executing';
  }
  return normalizedStatus;
}

export function computeProgressPercent(
  completedPlans: number | null,
  totalPlans: number | null,
  completedPhases: number | null,
  totalPhases: number | null,
): number | null {
  const hasPlanData = totalPlans !== null && totalPlans > 0 && completedPlans !== null;
  const hasPhaseData = totalPhases !== null && totalPhases > 0 && completedPhases !== null;

  if (!hasPlanData && !hasPhaseData) return null;

  const planFraction = hasPlanData ? completedPlans / totalPlans : 1;
  const phaseFraction = hasPhaseData ? completedPhases / totalPhases : 1;

  return Math.min(100, Math.round(Math.min(planFraction, phaseFraction) * 100));
}

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function existingProgressExceedsDerived(
  existingProgress: Record<string, unknown>,
  derivedProgress: Record<string, unknown>,
  key: string,
): boolean {
  const existing = toFiniteNumber(existingProgress[key]);
  const derived = toFiniteNumber(derivedProgress[key]);
  return existing !== null && derived !== null && existing > derived;
}

export function shouldPreserveExistingProgress(
  existingProgress: unknown,
  derivedProgress: unknown,
): existingProgress is Record<string, unknown> {
  if (!existingProgress || typeof existingProgress !== 'object') return false;
  if (!derivedProgress || typeof derivedProgress !== 'object') return false;

  const existing = existingProgress as Record<string, unknown>;
  const derived = derivedProgress as Record<string, unknown>;
  return (
    existingProgressExceedsDerived(existing, derived, 'total_phases') ||
    existingProgressExceedsDerived(existing, derived, 'completed_phases') ||
    existingProgressExceedsDerived(existing, derived, 'total_plans') ||
    existingProgressExceedsDerived(existing, derived, 'completed_plans')
  );
}

export function normalizeProgressNumbers(progress: unknown): unknown {
  if (!progress || typeof progress !== 'object') return progress;

  const normalized: Record<string, unknown> = { ...(progress as Record<string, unknown>) };
  for (const key of ['total_phases', 'completed_phases', 'total_plans', 'completed_plans', 'percent']) {
    const number = toFiniteNumber(normalized[key]);
    if (number !== null) normalized[key] = number;
  }
  return normalized;
}
