# Customer Overlay Catalog

This directory holds **customer-specific overlay packs** for the GSD-IC framework. Each subdirectory is one IC customer (NGA, NSA, NRO, CIA, DIA, ...).

Per spec §2.3 single-program-instantiation, exactly one overlay is selected at install time:

```bash
npx @adelphi/gsd-ic@latest install --customer=nga
```

The selected overlay's `agent_skills` map is wired into the program's `.planning/config.json`; other overlays are not consulted at runtime.

## Adding a new customer overlay

See `docs/ic-pack/ADDING-A-CUSTOMER-OVERLAY.md` for the full procedure.

Quick form:

1. `mkdir config-overlays/<customer>/`
2. Write `overlay.json` with the customer's `agent_skills` map
3. Write `overlay.md` with human-readable customer notes (UNCLASSIFIED only)
4. Optional: drop customer-specific reference doc additions in `<customer>/refs/`
5. Commit; ships in next pack release

## Classification

All overlay content must be UNCLASSIFIED. CI validator `tools/ci/validate-classification.sh` enforces this.
