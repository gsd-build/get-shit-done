# GSD-Jira Integration

## What This Is

CLI tooling and GSD command extensions that integrate the Get Shit Done (GSD) workflow framework with Jira Cloud Scrum boards via the Atlassian CLI (`acli`). This enables collaborative multi-developer workflows by automatically syncing GSD planning artifacts with Jira issues.

## Core Value

**Developers think in GSD, teams coordinate in Jira.**

GSD remains the developer's primary tool for planning and deep work. Jira serves as the visibility layer for project managers and team coordination. The integration keeps both systems in sync automatically, so developers never context-switch to update Jira manually.

## The Problem

- Developers using GSD work in `.planning/` markdown files
- Project managers and stakeholders need visibility in Jira
- Manual sync is tedious and gets stale
- No current way to bridge GSD's structured planning with Jira's execution tracking

## The Solution

Automatic bidirectional sync between GSD artifacts and Jira issues:
- GSD pushes milestones/phases/plans/tasks to Jira
- Jira pushes status changes, comments, and PM-created issues back to GSD
- Conflicts flagged for manual resolution
- Sprint lifecycle managed automatically

## Artifact Mapping

| GSD | Jira | Notes |
|-----|------|-------|
| Milestone | Initiative | Requires Jira Advanced Roadmaps |
| Phase | Epic | Primary planning unit |
| Plan | Story | Implementation details |
| Task | Sub-task | Atomic work items |

## Sync Behavior

**GSD → Jira (Push):**
- New artifacts created as Jira issues
- Updates to titles, descriptions, status propagate
- Deletions archive Jira issues (not delete)

**Jira → GSD (Pull):**
- Status changes sync back (done, in-progress, blocked)
- Comments and blockers imported
- Issues created directly in Jira auto-import to GSD

**Conflict Resolution:**
- Both sides modified → flag for manual resolution
- Conflict report shows diff and asks user to choose

## Sprint Management

**Auto Mode (Default):**
- Fixed-duration sprints (configurable, e.g., 2 weeks)
- Auto-close sprint on schedule, move incomplete items to next
- Auto-create next sprint when current closes
- Completed items assigned to current sprint for tracking

**Manual Mode:**
- User explicitly manages sprint boundaries
- Reminders when sprint should end

## Target Users

- **Developers:** Use GSD commands as primary workflow. Never touch Jira directly.
- **Project Managers:** Use Jira for visibility, reports, stakeholder communication.
- **Team:** Visualize planned work in Jira boards/roadmaps.

## Technical Approach

**Stack:**
- Python CLI (aligns with GSD patterns)
- `acli` CLI wrapper (no custom Jira API client)
- API tokens via environment variables

**Architecture:**
- New GSD commands: `/gsd:jira-sync`, `/gsd:jira-status`, `/gsd:jira-link`
- Hook into existing GSD commands (auto-sync on phase complete, etc.)
- Config stored in `.planning/jira/config.json`
- Sync state in `.planning/jira/sync-state.json`

**Jira Requirements:**
- Jira Cloud (not Server/Data Center)
- Advanced Roadmaps (for Initiative issue type)
- Scrum board configured

## Constraints

- **Use `acli` CLI** — no custom Jira REST API client
- **Spec files in consuming projects** — `.planning/jira/` lives in each project using the integration
- **Implementation in this repo** — GSD fork/extension
- **Jira Cloud only** — Server/Data Center not supported initially

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use `acli` not REST API | Simplifies auth, reduces maintenance, leverages existing tooling | Pending |
| Initiative for Milestone | Full Jira hierarchy mapping requires Advanced Roadmaps | Pending |
| Manual conflict resolution | Safest approach, avoids data loss | Pending |
| Fixed-duration sprints | Matches common Scrum practice, predictable | Pending |
| Auto-import Jira issues | Full bidirectional sync, no orphaned issues | Pending |

## Requirements

### Validated

(None yet — new project)

### Active

**Mapping & Configuration:**
- [ ] GSD → Jira issue type mapping (Initiative/Epic/Story/Sub-task)
- [ ] Project-level Jira config (`.planning/jira/config.json`)
- [ ] Sync state tracking (`.planning/jira/sync-state.json`)

**Sync Operations:**
- [ ] Push GSD artifacts to Jira (create/update)
- [ ] Pull Jira changes to GSD (status/comments)
- [ ] Conflict detection and flagging
- [ ] Manual conflict resolution flow

**Sprint Management:**
- [ ] Auto sprint lifecycle (close/create on schedule)
- [ ] Assign completed items to current sprint
- [ ] Manual sprint mode option

**GSD Command Integration:**
- [ ] `/gsd:jira-sync` — manual sync trigger
- [ ] `/gsd:jira-status` — show sync state
- [ ] Auto-sync hooks in existing GSD commands

**Reporting:**
- [ ] Sync status report
- [ ] Leverage Jira native reports (burndown, velocity)

### Out of Scope

- Jira Server/Data Center support — Cloud only for v1
- Custom Jira REST API client — use `acli` only
- Jira Kanban boards — Scrum boards only
- Multi-project sync — one GSD project = one Jira project

---
*Last updated: 2026-01-31 after initialization*
