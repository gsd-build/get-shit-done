import { formatStateLoadRawStdout } from './query/state-project-load.js';

function safeStringify(value: unknown): string {
  const out = JSON.stringify(value, null, 2);
  return out ?? String(value);
}

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
      return safeStringify(data);
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
    return safeStringify(data);
  }

  if (registryCommand === 'config-set') {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      return safeStringify(data);
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
    return safeStringify(data);
  }

  if (registryCommand === 'state.begin-phase' || registryCommand === 'state begin-phase') {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      return safeStringify(data);
    }
    const d = data as Record<string, unknown>;
    const u = d.updated as string[] | undefined;
    return Array.isArray(u) && u.length > 0 ? 'true' : 'false';
  }

  // #3631: CJS handlers projected these to a scalar under --raw. Mirror that
  // here so SDK dispatch matches CJS behaviour when family routers request
  // mode: 'raw' on the bridge.
  if (registryCommand === 'phase.next-decimal') {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const next = (data as Record<string, unknown>).next;
      if (typeof next === 'string') return next;
    }
    return safeStringify(data);
  }

  if (registryCommand === 'roadmap.get-phase') {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const section = (data as Record<string, unknown>).section;
      if (typeof section === 'string') return section;
    }
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }
  return safeStringify(data);
}
