---
type: Security
issue: 3628
---
**Installer no longer auto-removes user-authored or retired `hooks/gsd-*` files** — the `bundled-gsd-hook` classifier added in #3610 used a shape regex (`/^hooks\/gsd-[^/]+\.(?:js|sh|cjs|mjs)$/`) that matched any file with that naming shape, not only the 13 hooks actually shipped in the npm package. User-authored custom hooks (e.g. `hooks/gsd-personal-experiment.js`) and retired bundled hooks from prior versions were silently auto-classified and removed on first-time-baseline scan. The classifier now whitelists the explicit set of shipped hook filenames (`BUNDLED_GSD_HOOK_FILES`); files outside the whitelist fall through to the existing block-or-prompt flow so the user retains control. A drift guard in `tests/bug-3628-bundled-hook-classifier-whitelist.test.cjs` fails CI if the whitelist diverges from the on-disk `hooks/` directory in either direction.
