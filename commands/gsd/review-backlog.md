---
name: gsd:review-backlog
description: Review and promote backlog items to active milestone
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Review all 999.x backlog items and optionally promote them into the active
milestone sequence or remove stale entries.
</objective>

<process>

1. **List backlog items:**
   ```bash
   ls -d .planning/phases/999* 2>/dev/null || echo "No backlog items found"
   ```

2. **Read ROADMAP.md** and extract all 999.x phase entries:
   ```bash
   cat .planning/ROADMAP.md
   ```
   Show each backlog item with its description, any accumulated context (CONTEXT.md, RESEARCH.md), and creation date.

3. **Present the list to the user** via AskUserQuestion:
   - For each backlog item, show: phase number, description, accumulated artifacts
   - Options per item: **Promote** (move to active), **Keep** (leave in backlog), **Remove** (delete)

4. **For items to PROMOTE:**
   - Find the next sequential phase number in the active milestone
   - Rename the directory from `999.x-slug` to `{new_num}-slug`:
     ```bash
     NEW_NUM=$(gsd-sdk query phase.add "${DESCRIPTION}" --raw)
     ```
   - Move accumulated artifacts to the new phase directory
   - Update ROADMAP.md: move the entry from `## Backlog` section to the active phase list
   - Remove `(BACKLOG)` marker
   - Add appropriate `**Depends on:**` field

5. **For items to REMOVE:**
   - Delete the phase directory
   - Remove the entry from ROADMAP.md `## Backlog` section

6. **Commit changes:**
   ```bash
   gsd-sdk query commit "docs: review backlog — promoted N, removed M" .planning/ROADMAP.md
   ```

7. **Report summary:**
   ```
   ## 📋 Backlog Review Complete

   Promoted: {list of promoted items with new phase numbers}
   Kept: {list of items remaining in backlog}
   Removed: {list of deleted items}
   ```

</process>
