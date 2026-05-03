export function fallbackBridgeNotices(command: string): string[] {
  return [
    `[gsd-sdk] '${command}' not in native registry; falling back to gsd-tools.cjs.`,
    '[gsd-sdk] Transparent bridge — prefer adding a native handler when parity matters.',
  ];
}
