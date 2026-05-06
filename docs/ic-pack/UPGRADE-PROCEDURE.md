<!-- CLASSIFICATION: UNCLASSIFIED -->
# Dev-Side Upgrade Procedure: Soft-Fork Sync from Upstream

> **Status:** Stub. Fleshed out by Task 25 of this plan (sync-from-upstream tooling).

This document is for **maintainers of the gsd-ic dev repo**, not for consumers. Consumers see [CONSUMER-UPGRADE.md](CONSUMER-UPGRADE.md).

The gsd-ic dev repo is a soft-fork of `gsd-build/get-shit-done`. To pull upstream improvements:

```bash
npm run sync-upstream
```

Which runs `tools/sync/sync-from-upstream.sh` (see Task 25 of Plan 0).
