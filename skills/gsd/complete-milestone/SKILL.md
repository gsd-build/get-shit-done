---
name: complete-milestone
description: Archive completed milestone and prepare for next version
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# complete-milestone Skill

## Objective

Mark milestone {{version}} complete, archive to milestones/, and update ROADMAP.md.
Purpose: Create historical record of shipped version, collapse completed work in roadmap, and prepare for next milestone.
Output: Milestone archived, roadmap reorganized, git tagged.
**Load these files NOW (before proceeding):**
- @~/.claude/get-shit-done/workflows/complete-milestone.md (main workflow)

## When to Use



## Process

**Follow complete-milestone.md workflow:**
1. **Verify readiness:**
   - Check all phases in milestone have completed plans (SUMMARY.md exists)
   - Present milestone scope and stats
   - Wait for confirmation
2. **Gather stats:**
   - Count phases, plans, tasks
   - Calculate git range, file changes, LOC
   - Extract timeline from git log
   - Present summary, confirm
3. **Extract accomplishments:**
   - Read all phase SUMMARY.md files in milestone range
   - Extract 4-6 key accomplishments
   - Present for approval
4. **Archive milestone:**
   - Create `.planning/milestones/v{{version}}-ROADMAP.md`
   - Extract full phase details from ROADMAP.md
   - Fill milestone-archive.md template
   - Update ROADMAP.md to one-line summary with link
   - Offer to create next milestone
5. **Update PROJECT.md:**
   - Add "Current State" section with shipped version
   - Add "Next Milestone Goals" section
   - Archive previous content in `` (if v1.1+)
6. **Commit and tag:**
   - Stage: MILESTONES.md, PROJECT.md, ROADMAP.md, STATE.md, archive file
   - Commit: `chore: archive v{{version}} milestone`
   - Tag: `git tag -a v{{version}} -m "[milestone summary]"`
   - Ask about pushing tag
7. **Offer next steps:**
   - Plan next milestone
   - Archive planning
   - Done for now

## Success Criteria

- Milestone archived to `.planning/milestones/v{{version}}-ROADMAP.md`
- ROADMAP.md collapsed to one-line entry
- PROJECT.md updated with current state
- Git tag v{{version}} created
- Commit successful
- User knows next steps
  
- **Load workflow first:** Read complete-milestone.md before executing
- **Verify completion:** All phases must have SUMMARY.md files
- **User confirmation:** Wait for approval at verification gates
- **Archive before collapsing:** Always create archive file before updating ROADMAP.md
- **One-line summary:** Collapsed milestone in ROADMAP.md should be single line with link
- **Context efficiency:** Archive keeps ROADMAP.md constant size
  

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
