'use strict';

const LEGACY_ORPHAN_FILES = [
  'hooks/gsd-notify.sh',
  'hooks/statusline.js',
];

module.exports = {
  id: '2026-05-11-legacy-orphan-files',
  title: 'Remove manifest-managed legacy orphan hook files',
  description: 'Remove legacy orphan hook files that are still manifest-managed.',
  introducedIn: '1.50.0',
  scopes: ['global', 'local'],
  destructive: true,
  // Retired generated hook files are removed only with manifest-managed
  // evidence. This follows docs/installer-migrations.md#ownership and avoids
  // relying on whether a runtime currently registers host hook config in the
  // runtime contract registry.
  plan: ({ classifyArtifact }) => {
    const actions = [];
    for (const relPath of LEGACY_ORPHAN_FILES) {
      const artifact = classifyArtifact(relPath);
      if (artifact.classification === 'managed-pristine') {
        actions.push({
          type: 'remove-managed',
          relPath,
          reason: 'legacy orphan hook file retired by installer migration',
          ownershipEvidence: 'legacy hook path is manifest-managed in gsd-file-manifest.json',
        });
      } else if (artifact.classification === 'managed-modified') {
        actions.push({
          type: 'backup-and-remove',
          relPath,
          reason: 'legacy orphan hook file retired by installer migration',
          ownershipEvidence: 'legacy hook path is manifest-managed in gsd-file-manifest.json',
        });
      }
    }
    return actions;
  },
};
