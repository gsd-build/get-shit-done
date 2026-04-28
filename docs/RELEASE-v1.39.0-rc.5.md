# v1.39.0-rc.5 Release Notes

Pre-release candidate. Published to npm under the `next` tag.

```bash
npx get-shit-done-cc@next
```

---

## What's in this release

All fixes from rc.4, plus:

### Fixed

**Codex hooks migrator correctness hardening** (#2809)

Five edge-cases in the `[[hooks.<Event>]]` → `[[hooks.<Event>.hooks]]` two-level nested
schema migration path, discovered across five rounds of code review:

| Finding | Fix |
|---------|-----|
| `parseHooksBody` used a bare regex (`/^([\w.]+)\s*=/`) that silently dropped hyphenated keys such as `status-message` and any quoted TOML key | Replaced with `parseTomlKey()`, the existing full TOML key parser |
| `buildNestedBlock` unconditionally emitted `[[hooks.TYPE.hooks]]` even when no handler fields were present, producing an entry with `type = "command"` but no `command` | Added guard: matcher-only / handler-field-free sections emit only the event-entry block |
| `legacyMapSections` filter used `section.path.startsWith('hooks.')` without checking the segment count, so three-segment tables like `[hooks.SessionStart.hooks]` were misclassified as event entries and re-emitted as bogus nested events | Now uses `section.segments.length === 2` (same fix previously applied to `staleNamespacedAotSections`) |
| No regression test for quoted event names containing dots — `[[hooks."before.tool"]]` has a 2-segment path but 3 dot-parts, and a `split('.')` check would misclassify it | Regression test added; quoted-dot names are correctly treated as a single two-segment namespace |
| Handler command path assertion in install tests used a regex (`/gsd-check-update\.js/`) rather than the exact absolute path | Strengthened to `assert.strictEqual` with `path.join(codexHome, 'hooks', 'gsd-check-update.js')` |

---

## What was in rc.4

### Added

**`--minimal` install flag** (alias `--core-only`) (#2762)

Writes only the six core skills needed to run the main workflow loop:
`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `help`, `update`.
No `gsd-*` subagents are installed.

| Mode | Cold-start system-prompt overhead |
|------|-----------------------------------|
| full (default) | ~12k tokens |
| minimal | ~700 tokens |

Useful for local LLMs with 32K–128K context windows. Sonnet 4.6 / Opus 4.7 users
don't need it — the full surface is the right default for cloud models.

The install manifest records `mode: "minimal" | "full"`. Run `gsd update` without
`--minimal` at any time to expand to the full skill set.

### Fixed (rc.4)

**Codex install no longer corrupts `~/.codex/config.toml`** (#2760)

The installer now:

- Strips legacy `[agents]` (single-bracket) and `[[agents]]` (sequence) blocks
  unconditionally — both are invalid in the current Codex TOML schema, regardless of
  whether a GSD marker is present.
- Emits the GSD-managed hook in the shape the user's config already uses:
  `[[hooks.<Event>]]` namespaced AoT if any existing hook uses that form, otherwise
  top-level `[[hooks]]`.
- Migrates any legacy `[hooks.<Event>]` (map format) to `[[hooks.<Event>]]` (array
  format) during write.
- Writes atomically via a temp file + `renameSync` — no partial writes.
- Validates the post-write bytes with a strict TOML parser that rejects duplicate
  keys, repeated table headers, trailing bytes after values, and unsupported value
  types.
- On any pre-write or write-time failure, restores the pre-install snapshot and aborts
  with a clear error instead of warn-and-continue.

---

## Installing the pre-release

```bash
# npm
npm install -g get-shit-done-cc@next

# npx (one-shot)
npx get-shit-done-cc@next
```

To pin to this exact RC:

```bash
npm install -g get-shit-done-cc@1.39.0-rc.5
```

---

## What's next

- Run `rc` again on the release branch to publish rc.6 if further fixes land before
  finalization.
- Run `finalize` on the release workflow to promote `1.39.0` to `latest` when the RC
  is stable.
