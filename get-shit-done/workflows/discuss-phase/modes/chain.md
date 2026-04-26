# --chain mode — interactive discuss, then auto-advance

> **Lazy-loaded.** Read this file from `workflows/discuss-phase.md` when
> `--chain` is present in `$ARGUMENTS`, or when the parent's `auto_advance`
> step needs to dispatch to plan-phase under `--auto`.

## Effect

- Discussion is **fully interactive** — questions, gray-area selection, and
  follow-ups behave exactly the same as default mode.
- After discussion completes, **auto-advance to plan-phase → execute-phase**
  (same downstream behavior as `--auto`).
- This is the middle ground: the user controls the discuss decisions, then
  plan and execute run autonomously.

## auto_advance step (executed by the parent file)

1. Parse `--auto` and `--chain` flags from `$ARGUMENTS`. **Note:** `--all`
   is NOT an auto-advance trigger — it only affects area selection. A
   session with `--all` but without `--auto` or `--chain` returns to manual
   next-steps after discussion completes.

2. **Sync chain flag with intent** — if user invoked manually (no `--auto`
   and no `--chain`), clear the ephemeral chain flag from any previous
   interrupted `--auto` chain. This does NOT touch `workflow.auto_advance`
   (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then
     gsd-sdk query config-set workflow._auto_chain_active false || true
   fi
   ```

3. Read consolidated auto-mode (`active` = chain flag OR user preference):
   ```bash
   AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
   ```

4. **If `--auto` or `--chain` flag present AND `AUTO_MODE` is not true:**
   Persist chain flag to config (handles direct usage without new-project):
   ```bash
   gsd-sdk query config-set workflow._auto_chain_active true
   ```

5. **If `--auto` flag present OR `--chain` flag present OR `AUTO_MODE` is
   true:** display banner and launch plan-phase.

   Banner:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► AUTO-ADVANCING TO PLAN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Context captured. Launching plan-phase...
   ```

   Launch plan-phase using the Skill tool to avoid nested Task sessions
   (which cause runtime freezes due to deep agent nesting — see #686):
   ```
   Skill(skill="gsd-plan-phase", args="${PHASE} --auto ${GSD_WS}")
   ```

   This keeps the auto-advance chain flat — discuss, plan, and execute all
   run at the same nesting level rather than spawning increasingly deep
   Task agents.

6. **Handle plan-phase return:**

   - **PHASE COMPLETE** → Full chain succeeded. Display:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      GSD ► PHASE ${PHASE} COMPLETE
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     Auto-advance pipeline finished: discuss → plan → execute

     /clear then:

     Next: /gsd-discuss-phase ${NEXT_PHASE} ${WAS_CHAIN ? "--chain" : "--auto"} ${GSD_WS}
     ```
   - **PLANNING COMPLETE** → Planning done, execution didn't complete:
     ```
     Auto-advance partial: Planning complete, execution did not finish.
     Continue: /gsd-execute-phase ${PHASE} ${GSD_WS}
     ```
   - **PLANNING INCONCLUSIVE / CHECKPOINT** → Stop chain:
     ```
     Auto-advance stopped: Planning needs input.
     Continue: /gsd-plan-phase ${PHASE} ${GSD_WS}
     ```
   - **GAPS FOUND** → Stop chain:
     ```
     Auto-advance stopped: Gaps found during execution.
     Continue: /gsd-plan-phase ${PHASE} --gaps ${GSD_WS}
     ```

7. **If none of `--auto`, `--chain`, nor config enabled:** route to
   `confirm_creation` step (existing behavior — show manual next steps).
