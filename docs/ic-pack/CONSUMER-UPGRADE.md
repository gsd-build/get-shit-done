<!-- CLASSIFICATION: UNCLASSIFIED -->
# Consumer-Side Upgrade: Bumping the Installed Pack Version

> **Status:** Stub. Fleshed out as the install entry-point matures (Tasks 18–23 of this plan).

To upgrade the IC pack version installed in a program:

```bash
cd /path/to/your/program
npx @adelphi/gsd-ic@latest install --customer=<same-customer-as-before>
```

The install is idempotent — re-running with the same `--customer` updates managed pack content without disturbing program-owned files (`.planning/intel-context.md`, etc.).
