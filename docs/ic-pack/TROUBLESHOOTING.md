<!-- CLASSIFICATION: UNCLASSIFIED -->
# Troubleshooting

> **Status:** Stub. Populated as install/sync/CI failure modes accumulate.

## Install fails: "GSD not detected"

The IC pack installer requires upstream GSD to be installed first. Run:

```bash
npx get-shit-done-cc@latest
```

Then re-run the IC pack install.

## Install fails: "incompatible GSD version"

The IC pack pins to a known-compatible GSD version range (see `peerDependencies` in `package.json`). Either upgrade GSD or pin the IC pack to an older version (`npx @adelphi/gsd-ic@<older> install ...`).

(More entries added as failure modes are observed.)
