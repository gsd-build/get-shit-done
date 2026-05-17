export interface FallowUnusedExport {
  file?: string;
  symbol?: string;
  line?: number | null;
}

export interface FallowDuplicateBlock {
  left?: { file?: string; start?: number | null; end?: number | null };
  right?: { file?: string; start?: number | null; end?: number | null };
  similarity?: number;
}

export interface FallowCircularDependency {
  cycle?: string[];
}

export interface FallowReport {
  unusedExports?: FallowUnusedExport[];
  duplicates?: FallowDuplicateBlock[];
  circularDependencies?: FallowCircularDependency[];
}

export interface NormalizedFallowFinding {
  type: 'unused_export' | 'duplicate_block' | 'circular_dependency';
  message: string;
  file: string;
  line: number | null;
  related_file?: string;
}

export interface NormalizedFallowReport {
  summary: {
    unused_exports: number;
    duplicates: number;
    circular_dependencies: number;
    total: number;
  };
  findings: NormalizedFallowFinding[];
}

// TODO(parity): SDK lacks a TS test harness for normalizeFallowReport. CJS parity tests live in
// tests/feat-3210-fallow-integration.test.cjs (H1 suite). When a TS test runner is added,
// mirror those cases here — especially the line:0 preservation assertions.
export function normalizeFallowReport(report: FallowReport | null | undefined): NormalizedFallowReport {
  const unused = Array.isArray(report?.unusedExports) ? report.unusedExports : [];
  const duplicates = Array.isArray(report?.duplicates) ? report.duplicates : [];
  const circular = Array.isArray(report?.circularDependencies) ? report.circularDependencies : [];

  const findings: NormalizedFallowFinding[] = [];

  for (const item of unused) {
    findings.push({
      type: 'unused_export',
      message: `Unused export ${item.symbol || '<unknown>'}`,
      file: item.file || '',
      line: item.line ?? null,
    });
  }

  for (const item of duplicates) {
    findings.push({
      type: 'duplicate_block',
      message: `Duplicate block (${Math.round((item.similarity || 0) * 100)}% similarity)`,
      file: item.left?.file || '',
      line: item.left?.start ?? null,
      related_file: item.right?.file || '',
    });
  }

  for (const item of circular) {
    findings.push({
      type: 'circular_dependency',
      message: `Circular dependency: ${(item.cycle || []).join(' -> ')}`,
      file: Array.isArray(item.cycle) && item.cycle.length > 0 ? item.cycle[0] : '',
      line: null,
    });
  }

  return {
    summary: {
      unused_exports: unused.length,
      duplicates: duplicates.length,
      circular_dependencies: circular.length,
      total: findings.length,
    },
    findings,
  };
}
