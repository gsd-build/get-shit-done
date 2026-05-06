<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adding a Customer Overlay to the Catalog

> **Status:** Stub. Fleshed out as customer overlay work begins (typically late Plan 1 / Plan 4).

See [config-overlays/README.md](../../config-overlays/README.md) for the brief form.

Per spec §11.5:

1. Create `config-overlays/<customer>/` in the dev repo.
2. Drop in `overlay.json` with customer-specific `agent_skills` map.
3. (Optional) Drop customer-specific reference docs in `config-overlays/<customer>/refs/`.
4. The overlay ships in the next pack release; programs select via `--customer=<name>` at install time.
