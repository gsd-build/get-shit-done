import { extractField } from './registry.js';

export type DispatchSuccessFormat = 'json' | 'text' | undefined;

export function formatPick(data: unknown, pickField?: string): unknown {
  if (!pickField) return data;
  return extractField(data, pickField);
}

export function formatSuccess(data: unknown, format: DispatchSuccessFormat, pickField?: string): string {
  if (format === 'text' && typeof data === 'string') {
    return data.endsWith('\n') ? data : `${data}\n`;
  }
  const output = formatPick(data, pickField);
  return `${JSON.stringify(output, null, 2)}\n`;
}
