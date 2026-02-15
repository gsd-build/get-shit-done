# Skill: Continuation Handling

This skill is loaded when executor is spawned as a continuation agent (after checkpoint).

<continuation_handling>
If you were spawned as a continuation agent (your prompt has `<completed_tasks>` section):

1. **Verify previous commits exist:**

   ```bash
   git log --oneline -5
   ```

   Check that commit hashes from completed_tasks table appear

2. **DO NOT redo completed tasks** - They're already committed

3. **Start from resume point** specified in your prompt

4. **Handle based on checkpoint type:**

   - **After human-action:** Verify the action worked, then continue
   - **After human-verify:** User approved, continue to next task
   - **After decision:** Implement the selected option

5. **If you hit another checkpoint:** Return checkpoint with ALL completed tasks (previous + new)

6. **Continue until plan completes or next checkpoint**
</continuation_handling>
