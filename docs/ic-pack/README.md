<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adelphi IC Pack for GSD

The IC pack is a soft-fork extension of [Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) that adds 58 specialized agents, 3 deterministic hooks, and 4 behavioral skills tailored to intelligence-community software prototyping.

It is distributed as the npm package `@adelphi/gsd-ic` and installed per program via:

```bash
npx @adelphi/gsd-ic@latest install --customer=<nga|nsa|nro|cia|dia>
```

Per the [design spec](../specs/2026-05-05-ic-agent-pack-design.md) §2.3, each program runs its own GSD-IC instance — one program, one customer, one repo.

## When to use

- You are building IC-focused software prototypes that need rapid demo cadence + the contracting paperwork (capability statements, white papers, ATO drafts) alongside.
- Your program has at least one SME per primary INT discipline in scope.
- Your code is UNCLASSIFIED in this repo (the IC pack does not handle classified content; CI enforces this).

## When not to use

- Code that already lives on a classified system. The IC pack is for low-side prototyping only.
- Programs without SME staffing — references decay without curators.
- Non-IC programs. Stock GSD is the right tool.

## Documentation map

- [QUICKSTART.md](QUICKSTART.md) — `npx install` to first agent invocation in 30 minutes
- [ARCHITECTURE.md](ARCHITECTURE.md) — layered architecture (subset of the design spec)
- [ADDING-AN-AGENT.md](ADDING-AN-AGENT.md) — how to author and register a new agent
- [ADDING-A-REFERENCE.md](ADDING-A-REFERENCE.md) — how to add a knowledge-layer reference doc
- [ADDING-A-SKILL.md](ADDING-A-SKILL.md) — how to author and inject a behavioral skill
- [ADDING-A-CUSTOMER-OVERLAY.md](ADDING-A-CUSTOMER-OVERLAY.md) — onboarding a new customer to the catalog
- [PER-CUSTOMER-PLAYBOOK.md](PER-CUSTOMER-PLAYBOOK.md) — gotchas + tradecraft notes per AO
- [UPGRADE-PROCEDURE.md](UPGRADE-PROCEDURE.md) — dev-side: soft-fork sync from upstream `gsd-build/get-shit-done`
- [CONSUMER-UPGRADE.md](CONSUMER-UPGRADE.md) — consumer-side: re-running `npx ... install` to bump pack version
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — common failure modes
