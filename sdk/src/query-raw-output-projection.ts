import { formatStateLoadRawStdout } from './query/state-project-load.js';

/**
 * Raw output projection for native query results.
 * Owns CLI-facing string contracts for raw mode commands.
 */
export function formatQueryRawOutput(registryCommand: string, data: unknown): string {
  if (registryCommand === 'state.load') {
    return formatStateLoadRawStdout(data);
  }

  if (registryCommand === 'commit') {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      return JSON.stringify(data, null, 2);
    }
    const d = data as Record<string, unknown>;
    if (d.committed === true) {
      return d.hash != null ? String(d.hash) : 'committed';
    }
    if (d.committed === false) {
      const r = String(d.reason ?? '');
      if (
        r.includes('commit_docs') ||
        r.includes('skipped') ||
        r.includes('gitignored') ||
        r === 'skipped_commit_docs_false'
      ) {
        return 'skipped';
      }
      if (r.includes('nothing') || r.includes('nothing_to_commit')) {
        return 'nothing';
      }
      return r || 'nothing';
    }
    return JSON.stringify(data, null, 2);
  }

  if (registryCommand === 'config-set') {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      return JSON.stringify(data, null, 2);
    }
    const d = data as Record<string, unknown>;
    if ((d.updated === true || d.set === true) && d.key !== undefined) {
      const v = d.value;
      if (v === null || v === undefined) {
        return `${d.key}=`;
      }
      if (typeof v === 'object') {
        return `${d.key}=${JSON.stringify(v)}`;
      }
      return `${d.key}=${String(v)}`;
    }
    return JSON.stringify(data, null, 2);
  }

  if (registryCommand === 'state.begin-phase' || registryCommand === 'state begin-phase') {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      return JSON.stringify(data, null, 2);
    }
    const d = data as Record<string, unknown>;
    const u = d.updated as string[] | undefined;
    return Array.isArray(u) && u.length > 0 ? 'true' : 'false';
  }

  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data, null, 2);
}
